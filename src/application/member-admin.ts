import {randomUUID} from 'node:crypto';
import type {Principal} from '../domain/model.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {requestHash} from '../domain/canonical.ts';
import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';
import {compareInstants,isCanonicalInstant} from '../../shared/instant.js';
import {assertAdministrativeAssurance,type VerifiedAdministrativeAssurance} from '../infrastructure/authentication.ts';
import {ADMIN_CAPABILITIES,adminInvalid,adminDenied,parseAdminWorkspace,parseAdminMember,exactAdminRecord,adminRevision,bindAdministrativeCapabilities,requireAdministrativeCapability,memberIsCurrent,memberHasCapability,type AdministrativeCapability,type AdminMember,type AdminWorkspace} from '../domain/admin-policy.ts';

export type MemberAdminAction='invite'|'set_role'|'revoke'|'expire'|'handoff';
export type MemberAdminReceipt=Readonly<{workspaceId:string;actorId:string;revision:number;member:AdminMember;auditId:string;notification:'not_requested';replayed:boolean}>;
export type StoredMemberReceipt=Readonly<{key:string;workspaceId:string;actorId:string;hash:string;result:MemberAdminReceipt}>;
export type MemberAdminAudit=Readonly<{id:string;workspaceId:string;actorId:string;targetPrincipalId:string;action:MemberAdminAction|'accept_invitation';reason:string;at:string;before:AdminMember|null;after:AdminMember;successorPrincipalId:string|null}>;
export interface MemberAdminTransaction{
 /** Lock/revision must serialize membership AND capability changes for this workspace.
  * PostgreSQL implementation is required before live use; no memory fallback ships.
  */
 readWorkspace():Promise<unknown>;
 findPerson(principalId:string):Promise<unknown>;
 getReceipt(key:string):Promise<unknown>;
 commitChange(expectedRevision:number,member:AdminMember,audit:MemberAdminAudit,receipt:StoredMemberReceipt):Promise<void>;
}
export interface MemberAdminStore{
 /** Same transaction for state, current privileges, CAS, audit and immutable receipt.
  * Run admission after waits and BEFORE actual COMMIT, not after a confirmed COMMIT.
  * Driver failures/unfinished work must abort; lost confirmation must not retry.
  */
 transaction<T>(p:Principal,admission:()=>void,work:(tx:MemberAdminTransaction)=>Promise<T>):Promise<T>;
}
const error=(status:number,code:string,message:string)=>new HelpdeskError(status,code,message);
const badInput=()=>error(400,'invalid_member_command','Comando de administração inválido.');
const versionConflict=()=>error(412,'member_version_conflict','Os membros foram alterados. Atualize a lista.');
const actionCapability:Record<MemberAdminAction,AdministrativeCapability>={invite:'members.invite',set_role:'members.write',revoke:'members.revoke',expire:'members.write',handoff:'members.succession'};
type Command={action:MemberAdminAction;targetPrincipalId:string;expectedRevision:number;expectedMemberRevision?:number;reason:string;role?:'admin'|'agent';expiresAt?:string;successorPrincipalId?:string};
function command(raw:unknown):Command{
 try{
  if(!raw||typeof raw!=='object')throw badInput();
  const action=Object.getOwnPropertyDescriptor(raw,'action')?.value as MemberAdminAction;
  if(!Object.hasOwn(actionCapability,action))throw badInput();
  const keys=['action','targetPrincipalId','expectedRevision','reason',...(action==='invite'?['expiresAt']:['expectedMemberRevision']),...(action==='set_role'?['role']:[]),...(action==='handoff'?['successorPrincipalId']:[])];
  const x=exactAdminRecord(raw,keys);
  if(!isPersistableText(x.reason)||x.reason.trim().length<3||x.reason.length>2000||/[\p{Cc}]/u.test(x.reason))throw badInput();
  const out:Command={action,targetPrincipalId:uuidIdentifier(x.targetPrincipalId),expectedRevision:adminRevision(x.expectedRevision),reason:x.reason.trim()};
  if(action==='invite'){if(!isCanonicalInstant(x.expiresAt))throw badInput();out.expiresAt=x.expiresAt;}
  else out.expectedMemberRevision=adminRevision(x.expectedMemberRevision);
  if(action==='set_role'){if(x.role!=='admin'&&x.role!=='agent')throw badInput();out.role=x.role;}
  if(action==='handoff')out.successorPrincipalId=uuidIdentifier(x.successorPrincipalId);
  return Object.freeze(out);
 }catch{throw badInput();}
}
function hasSuccessor(state:AdminWorkspace,at:string,exclude:string,selected?:string):boolean{
 return state.members.some(m=>m.principalId!==exclude&&(selected===undefined||m.principalId===selected)&&m.role==='admin'&&m.expiresAt===null&&memberIsCurrent(m,at)&&memberHasCapability(state,m.principalId,'members.write',at));
}
function receipt(raw:unknown,p:Principal,key:string,hash:string,target:string,currentRevision:number):MemberAdminReceipt|null{
 if(raw===null)return null;
 let conflict:HelpdeskError|undefined;
 try{
  const x=exactAdminRecord(raw,['key','workspaceId','actorId','hash','result']);
  if(x.key!==key||x.workspaceId!==p.workspaceId||x.actorId!==p.id||typeof x.hash!=='string'||!/^[a-f0-9]{64}$/.test(x.hash))throw adminInvalid();
  if(x.hash!==hash){conflict=error(409,'member_idempotency_conflict','Chave já utilizada para outro comando.');throw conflict;}
  const r=exactAdminRecord(x.result,['workspaceId','actorId','revision','member','auditId','notification','replayed']);
  if(r.workspaceId!==p.workspaceId||r.actorId!==p.id||r.notification!=='not_requested'||r.replayed!==false)throw adminInvalid();
  const member=parseAdminMember(r.member);if(member.principalId!==target||adminRevision(r.revision)>currentRevision)throw adminInvalid();
  return Object.freeze({workspaceId:p.workspaceId,actorId:p.id,revision:adminRevision(r.revision),member,auditId:uuidIdentifier(r.auditId),notification:'not_requested',replayed:true});
 }catch(e){if(conflict&&e===conflict)throw conflict;throw adminInvalid();}
}
const safeErrors:Record<string,number>={administrative_assurance_required:403,administrative_capability_required:403,invalid_administrative_state:503,invalid_member_command:400,member_self_change_denied:403,member_version_conflict:412,member_cursor_stale:409,member_idempotency_conflict:409,member_already_registered:409,person_not_found:404,member_not_found:404,member_not_current:409,member_not_expired:409,last_administrator_required:409,successor_not_ready:409};
function safeFailure(e:unknown):HelpdeskError{
 try{if(e instanceof HelpdeskError){const code=Object.getOwnPropertyDescriptor(e,'code')?.value,status=Object.getOwnPropertyDescriptor(e,'status')?.value;
  if(typeof code==='string'&&Object.hasOwn(safeErrors,code)&&status===safeErrors[code])return error(status,code,'Não foi possível concluir a operação administrativa.');
 }}catch{/* Private transport and descriptor exceptions are not public application messages. */}
 return adminInvalid();
}
/** Workspace-team membership only. Not an account/work/geo grant setter.
 * No constructor seeds roles/capabilities, alters scopes, sends mail or creates people.
 */
export function createMemberAdministration(options:{store:MemberAdminStore;clock?:()=>string}){
 const clock=options.clock??(()=>new Date().toISOString());
 function at():string{const value=clock();if(!isCanonicalInstant(value))throw adminInvalid();return value;}
 async function authorized<T>(p:Principal,proof:VerifiedAdministrativeAssurance,capability:AdministrativeCapability,work:(tx:MemberAdminTransaction,state:AdminWorkspace,check:()=>void,requireAtCommit:(guard:()=>void)=>void)=>Promise<T>):Promise<T>{
  assertAdministrativeAssurance(p,proof);let binding:{close():void}|undefined;const invariants:(()=>void)[]=[];
  const check=()=>{assertAdministrativeAssurance(p,proof);if(binding)requireAdministrativeCapability(p,capability,proof);for(const invariant of invariants)invariant();};
  try{return await options.store.transaction(p,check,async tx=>{
   check();const state=parseAdminWorkspace(await tx.readWorkspace());check();
   binding=bindAdministrativeCapabilities(p,proof,state,at);check();
   return work(tx,state,check,guard=>invariants.push(guard));
  });}finally{binding?.close();}
 }
 async function list(p:Principal,proof:VerifiedAdministrativeAssurance,raw:unknown){
  try{
   if(!raw||typeof raw!=='object'||Array.isArray(raw))throw badInput();
   const keys=Object.hasOwn(raw,'cursor')?['limit','cursor']:['limit'];const opt=exactAdminRecord(raw,keys);
   if(!Number.isSafeInteger(opt.limit)||Number(opt.limit)<1||Number(opt.limit)>100)throw badInput();
   if(opt.cursor!==undefined&&(typeof opt.cursor!=='string'||opt.cursor.length>1024||!/^[A-Za-z0-9_-]+$/.test(opt.cursor)))throw badInput();
   return await authorized(p,proof,'members.read',async(_tx,state,check)=>{
    let after='';
    if(opt.cursor!==undefined){
     let cursor:Record<string,unknown>;try{cursor=exactAdminRecord(JSON.parse(Buffer.from(opt.cursor as string,'base64url').toString('utf8')),['v','workspaceId','principalId','revision','after']);}catch{throw badInput();}
     if(cursor.v!==1||cursor.workspaceId!==p.workspaceId||cursor.principalId!==p.id)throw badInput();
     if(cursor.revision!==state.revision)throw error(409,'member_cursor_stale','A lista mudou. Reinicie a consulta.');after=uuidIdentifier(cursor.after);
    }
    const now=at(),ordered=[...state.members].sort((a,b)=>a.principalId.localeCompare(b.principalId)),all=ordered.filter(m=>m.principalId>after);
    const page=all.slice(0,opt.limit as number),last=page.at(-1);check();
    return {workspaceId:p.workspaceId,revision:state.revision,total:ordered.length,availableActions:(Object.keys(actionCapability) as MemberAdminAction[]).filter(action=>memberHasCapability(state,p.id,actionCapability[action],now)),items:page.map(m=>({...m,effectiveStatus:m.status!=='revoked'&&m.expiresAt!==null&&compareInstants(m.expiresAt,now)<=0?'expired':m.status})),nextCursor:all.length>page.length&&last?Buffer.from(JSON.stringify({v:1,workspaceId:p.workspaceId,principalId:p.id,revision:state.revision,after:last.principalId})).toString('base64url'):null};
   });
  }catch(e){throw safeFailure(e);}
 }
 async function execute(p:Principal,proof:VerifiedAdministrativeAssurance,input:unknown,key:string):Promise<MemberAdminReceipt>{
  assertAdministrativeAssurance(p,proof);
  const cmd=command(input);if(typeof key!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw badInput();
  if(cmd.targetPrincipalId===p.id&&cmd.action!=='handoff')throw error(403,'member_self_change_denied','Alteração própria exige o fluxo de sucessão, sem autoelevação.');
  if(cmd.action==='handoff'&&cmd.targetPrincipalId!==p.id)throw error(403,'member_self_change_denied','A sucessão é iniciada pelo administrador que está saindo.');
  const hash=requestHash({workspaceId:p.workspaceId,actorId:p.id,command:cmd});let prepared=false;
  try{return await authorized(p,proof,actionCapability[cmd.action],async(tx,state,check,requireAtCommit)=>{
   const previous=receipt(await tx.getReceipt(key),p,key,hash,cmd.targetPrincipalId,state.revision);check();if(previous)return previous;
   if(state.revision!==cmd.expectedRevision)throw versionConflict();
   const now=at(),before=state.members.find(m=>m.principalId===cmd.targetPrincipalId)??null;let member:AdminMember;
   if(cmd.action==='invite'){
    if(before)throw error(409,'member_already_registered','A pessoa já possui um registro neste workspace.');
    if(compareInstants(cmd.expiresAt!,now)<=0)throw badInput();
    requireAtCommit(()=>{if(compareInstants(cmd.expiresAt!,at())<=0)throw badInput();});
    const rawPerson=await tx.findPerson(cmd.targetPrincipalId);check();
    if(rawPerson===null)throw error(404,'person_not_found','Pessoa humana não localizada.');
    const person=exactAdminRecord(rawPerson,['principalId','principalKind','active']);
    if(person.principalId!==cmd.targetPrincipalId||person.principalKind!=='human'||person.active!==true)throw error(404,'person_not_found','Pessoa humana não localizada.');
    member=Object.freeze({principalId:cmd.targetPrincipalId,principalKind:'human',role:'agent',status:'invited',revision:1,expiresAt:cmd.expiresAt!});
   }else{
    if(!before)throw error(404,'member_not_found','Membro não localizado.');
    if(before.revision!==cmd.expectedMemberRevision)throw versionConflict();
    if(before.status==='revoked')throw error(409,'member_not_current','Membro já revogado.');
    if(cmd.action==='handoff'){
     if(before.role!=='admin'||!memberIsCurrent(before,now)||!hasSuccessor(state,now,p.id,cmd.successorPrincipalId))throw error(409,'successor_not_ready','Informe outro administrador ativo, sem expiração e com capacidade de gestão vigente.');
     requireAtCommit(()=>{if(!hasSuccessor(state,at(),p.id,cmd.successorPrincipalId))throw error(409,'successor_not_ready','O sucessor não está mais apto.');});
     member={...before,role:'agent',revision:before.revision+1};
    }else if(cmd.action==='set_role'){
     if(!memberIsCurrent(before,now)||cmd.role==='admin'&&before.expiresAt!==null)throw error(409,'member_not_current','Promoção exige vínculo ativo sem expiração.');
     member={...before,role:cmd.role!,revision:before.revision+1};
    }else{
     if(cmd.action==='expire'&&(before.expiresAt===null||compareInstants(before.expiresAt,now)>0))throw error(409,'member_not_expired','Vínculo ainda não expirou.');
     member={...before,status:'revoked',revision:before.revision+1};
    }
    if(before.role==='admin'&&(member.role!=='admin'||member.status!=='active')){
     const invariant=()=>{if(!hasSuccessor(state,at(),before.principalId))throw error(409,'last_administrator_required','Não é permitido remover o último administrador com gestão vigente.');};
     invariant();requireAtCommit(invariant);
    }
   }
   member=parseAdminMember(member);const nextRevision=adminRevision(state.revision+1),auditId=randomUUID();
   const result:MemberAdminReceipt=Object.freeze({workspaceId:p.workspaceId,actorId:p.id,revision:nextRevision,member,auditId,notification:'not_requested',replayed:false});
   const saved:StoredMemberReceipt=Object.freeze({key,workspaceId:p.workspaceId,actorId:p.id,hash,result});
   const audit:MemberAdminAudit=Object.freeze({id:auditId,workspaceId:p.workspaceId,actorId:p.id,targetPrincipalId:cmd.targetPrincipalId,action:cmd.action,reason:cmd.reason,at:now,before,after:member,successorPrincipalId:cmd.successorPrincipalId??null});
   check();await tx.commitChange(state.revision,member,audit,saved);check();prepared=true;return result;
  });}catch(e){
   // Keep confirmed-commit semantics: store must not run an admission check after
   // acknowledged COMMIT. Without that guarantee, never invent an undo or retry.
   if(prepared)throw error(503,'member_admin_outcome_unknown','Confirmação desconhecida. Conserve a chave original para conciliação.');
   throw safeFailure(e);
  }
 }
 return Object.freeze({list,execute});
}
