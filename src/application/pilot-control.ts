import {randomUUID} from 'node:crypto';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';import {compareInstants} from '../../shared/instant.js';
import type {Principal} from '../domain/model.ts';import {HelpdeskError} from '../domain/errors.ts';import {requestHash} from '../domain/canonical.ts';import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';
import {parseAdminWorkspace,bindAdministrativeCapabilities,requireAdministrativeCapability,type AdministrativeCapability} from '../domain/admin-policy.ts';
import {assertAdministrativeAssurance,type VerifiedAdministrativeAssurance} from '../infrastructure/authentication.ts';
import {releaseRecord,releaseDigest,releaseInstant,releaseInteger,type ReleaseIdentity} from '../domain/release-manifest.ts';
import type {ReleaseAttestationVerifier} from '../infrastructure/release-attestation.ts';

export type PilotState='prepared'|'pilot'|'accepted'|'contained';
export type PilotRecord=Readonly<{schema:1;pilotId:string;workspaceId:string;revision:number;state:PilotState;manifestHash:string;releaseEnvelope:unknown;startedAt:string|null;acceptedAt:string|null;acceptanceEnvelope:unknown|null;changedAt:string;changedBy:string}>;
export type PilotResult=Readonly<{pilotId:string;workspaceId:string;actorId:string;revision:number;state:PilotState;manifestHash:string;action:string;changeId:string;at:string}>;
export type PilotReceipt=Readonly<{key:string;requestHash:string;workspaceId:string;actorId:string;pilotId:string;result:PilotResult}>;
export interface PilotControlTransaction {
 readWorkspace():Promise<unknown>;readPilot(id:string):Promise<unknown|null>;getReceipt(key:string):Promise<unknown|null>;
 /** One specific command: pilot row CAS + immutable audit + idempotent receipt,
  * with the admin snapshot and current row locked until acknowledged COMMIT. */
 write(expectedRevision:number,record:PilotRecord,audit:Readonly<Record<string,unknown>>,receipt:PilotReceipt):Promise<void>;
}
export interface PilotControlStore {
 transaction<T>(p:Principal,admission:()=>void,work:(tx:PilotControlTransaction)=>Promise<T>):Promise<T>;
}
const fail=(code='pilot_unavailable',status=503)=>new HelpdeskError(status,code,'Não foi possível confirmar a alteração do piloto. Consulte o registro antes de uma nova intenção.');
export function parsePilotRecord(raw:unknown):PilotRecord{try{
 const r=releaseRecord(raw,['schema','pilotId','workspaceId','revision','state','manifestHash','releaseEnvelope','startedAt','acceptedAt','acceptanceEnvelope','changedAt','changedBy']);if(r.schema!==1||!['prepared','pilot','accepted','contained'].includes(r.state as string))throw Error();for(const k of ['pilotId','workspaceId','changedBy'])r[k]=uuidIdentifier(r[k]);releaseInteger(r.revision,1);releaseDigest(r.manifestHash);releaseInstant(r.changedAt);
 for(const k of ['startedAt','acceptedAt'])if(r[k]!==null&&compareInstants(releaseInstant(r[k]),r.changedAt as string)>0)throw Error();
 if(r.state==='prepared'&&(r.startedAt!==null||r.acceptedAt!==null||r.acceptanceEnvelope!==null)||r.state==='pilot'&&(r.startedAt===null||r.acceptedAt!==null||r.acceptanceEnvelope!==null)||r.state==='accepted'&&(r.startedAt===null||r.acceptedAt===null||r.acceptanceEnvelope===null))throw Error();
 if(r.startedAt!==null&&r.acceptedAt!==null&&compareInstants(r.startedAt as string,r.acceptedAt as string)>0)throw Error();return freezeFormData(r) as unknown as PilotRecord;
 }catch{throw fail('pilot_state_invalid');}}
type PilotCommand={action:'prepare'|'start'|'accept'|'contain';pilotId:string;expectedRevision:number;reason:string;releaseEnvelope?:unknown;acceptanceEnvelope?:unknown};
export function parsePilotCommand(raw:unknown):PilotCommand{try{const c=copyFormData(raw) as Record<string,unknown>;if(!c||!['prepare','start','accept','contain'].includes(c.action as string))throw Error();const r=releaseRecord(c,['action','pilotId','expectedRevision','reason',...(c.action==='prepare'?['releaseEnvelope']:c.action==='accept'?['acceptanceEnvelope']:[])]);r.pilotId=uuidIdentifier(r.pilotId);releaseInteger(r.expectedRevision);if(!isPersistableText(r.reason)||r.reason.trim().length<3||r.reason.length>2000||/[\p{Cc}]/u.test(r.reason))throw Error();return freezeFormData(r) as unknown as PilotCommand;}catch{throw fail('pilot_command_invalid',400);}}
function safe(e:unknown):HelpdeskError{let code:unknown;try{code=Object.getOwnPropertyDescriptor(e??{},'code')?.value;}catch{}const statuses:Record<string,number>={administrative_assurance_required:403,administrative_capability_required:403,invalid_administrative_state:503,release_attestation_invalid:503,release_evidence_incomplete:503,pilot_scope_mismatch:403,pilot_revision_conflict:412,pilot_transition_invalid:409,pilot_new_release_required:409,pilot_acceptance_mismatch:409,pilot_idempotency_conflict:409,pilot_receipt_invalid:503,pilot_state_invalid:503,pilot_not_found:404,pilot_command_invalid:400};return typeof code==='string'&&Object.hasOwn(statuses,code)?fail(code,statuses[code]):fail();}
function priorReceipt(raw:unknown,p:Principal,cmd:PilotCommand,key:string,hash:string,current:PilotRecord|null):PilotResult|null{
 if(raw===null)return null;let r:Record<string,unknown>,v:Record<string,unknown>;
 try{r=releaseRecord(raw,['key','requestHash','workspaceId','actorId','pilotId','result']);v=releaseRecord(r.result,['pilotId','workspaceId','actorId','revision','state','manifestHash','action','changeId','at']);if(r.key!==key||r.workspaceId!==p.workspaceId||r.actorId!==p.id||r.pilotId!==cmd.pilotId||v.pilotId!==cmd.pilotId||v.workspaceId!==p.workspaceId||v.actorId!==p.id||v.action!==cmd.action||!['prepared','pilot','accepted','contained'].includes(v.state as string)||!current||releaseInteger(v.revision,1)>current.revision)throw Error();releaseDigest(r.requestHash);releaseDigest(v.manifestHash);uuidIdentifier(v.changeId);releaseInstant(v.at);
  const stateByAction={prepare:'prepared',start:'pilot',accept:'accepted',contain:'contained'};
  if(v.state!==stateByAction[cmd.action]||v.revision!==cmd.expectedRevision+1||compareInstants(v.at as string,current.changedAt)>0)throw Error();}catch{throw fail('pilot_receipt_invalid');}
 if(r.requestHash!==hash)throw fail('pilot_idempotency_conflict',409);return freezeFormData(v) as unknown as PilotResult;
}
/** Explicit administrative lifecycle; not a global release switch. No source record,
 * signed JSON or historical receipt grants data permissions or deploys code.
 * The production store, signers and acceptance process require separate qualification. */
export function createPilotControl(o:{store:PilotControlStore;verifier:ReleaseAttestationVerifier;observe:()=>ReleaseIdentity;clock?:()=>string}){
 const clock=o.clock??(()=>new Date().toISOString()),now=()=>releaseInstant(clock());
 const capabilities:Record<PilotCommand['action'],AdministrativeCapability>={prepare:'release.prepare',start:'release.pilot',accept:'release.accept',contain:'release.contain'};
 async function execute(p:Principal,proof:VerifiedAdministrativeAssurance,raw:unknown,key:string){
  const cmd=parsePilotCommand(raw);if(typeof key!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw fail('pilot_command_invalid',400);
  const hash=requestHash({actorId:p.id,workspaceId:p.workspaceId,command:cmd});let bound:{close():void}|undefined,prepared=false;const guards:(()=>void)[]=[];
  const check=()=>{assertAdministrativeAssurance(p,proof);if(bound)requireAdministrativeCapability(p,capabilities[cmd.action],proof);for(const guard of guards)guard();};
  try{return await o.store.transaction(p,check,async tx=>{
   check();const admin=parseAdminWorkspace(await tx.readWorkspace());check();bound=bindAdministrativeCapabilities(p,proof,admin,now);check();
   const input=await tx.readPilot(cmd.pilotId);check();const old=input===null?null:parsePilotRecord(input);
   if(old&&(old.workspaceId!==p.workspaceId||old.pilotId!==cmd.pilotId))throw fail('pilot_scope_mismatch',403);
   const prior=priorReceipt(await tx.getReceipt(key),p,cmd,key,hash,old);check();if(prior)return {...prior,replayed:true};
   if((old?.revision??0)!==cmd.expectedRevision||cmd.expectedRevision===Number.MAX_SAFE_INTEGER)throw fail('pilot_revision_conflict',412);
   if(cmd.action!=='prepare'&&!old)throw fail('pilot_not_found',404);const at=now();if(old&&compareInstants(at,old.changedAt)<0)throw fail('pilot_state_invalid');
   let next: PilotRecord;
   if(cmd.action==='prepare'){
    if(old&&old.state!=='contained')throw fail('pilot_transition_invalid',409);
    const verified=o.verifier.verifyRelease(cmd.releaseEnvelope,o.observe()),release=o.verifier.readRelease(verified,o.observe());guards.push(()=>{o.verifier.readRelease(verified,o.observe());});
    if(release.manifest.releaseId!==cmd.pilotId||release.manifest.cohorts.some(c=>c.workspaceId!==p.workspaceId))throw fail('pilot_scope_mismatch',403);
    if(old&&old.manifestHash===release.report.manifestHash)throw fail('pilot_new_release_required',409);
    next={schema:1,pilotId:cmd.pilotId,workspaceId:p.workspaceId,revision:cmd.expectedRevision+1,state:'prepared',manifestHash:release.report.manifestHash,releaseEnvelope:copyFormData(cmd.releaseEnvelope),startedAt:null,acceptedAt:null,acceptanceEnvelope:null,changedAt:at,changedBy:p.id};
   }else if(cmd.action==='contain'){
    if(old!.state==='contained')throw fail('pilot_transition_invalid',409);
    // Deliberately no certificate-validity requirement: containment remains possible
    // when the release evidence expires. Administrative MFA/capability is still live.
    next={...old!,revision:old!.revision+1,state:'contained',changedAt:at,changedBy:p.id};
   }else{
    if(cmd.action==='start'&&old!.state!=='prepared'||cmd.action==='accept'&&old!.state!=='pilot')throw fail('pilot_transition_invalid',409);
    const verified=o.verifier.verifyRelease(old!.releaseEnvelope,o.observe()),release=o.verifier.readRelease(verified,o.observe());if(release.report.manifestHash!==old!.manifestHash||release.manifest.releaseId!==old!.pilotId)throw fail('pilot_state_invalid');guards.push(()=>{o.verifier.readRelease(verified,o.observe());});
    if(cmd.action==='start')next={...old!,revision:old!.revision+1,state:'pilot',startedAt:at,changedAt:at,changedBy:p.id};
    else{
     const accepted=o.verifier.verifyAcceptance(cmd.acceptanceEnvelope),acceptance=o.verifier.readAcceptance(accepted);guards.push(()=>{o.verifier.readAcceptance(accepted);});
     if(acceptance.pilotId!==old!.pilotId||acceptance.pilotRevision!==old!.revision||acceptance.manifestHash!==old!.manifestHash||compareInstants(acceptance.startedAt,old!.startedAt!)!==0||!release.owners.some(owner=>owner.role==='customer'&&owner.principalId===acceptance.ownerId))throw fail('pilot_acceptance_mismatch',409);
     next={...old!,revision:old!.revision+1,state:'accepted',acceptedAt:at,acceptanceEnvelope:copyFormData(cmd.acceptanceEnvelope),changedAt:at,changedBy:p.id};
    }
   }
   next=parsePilotRecord(next);const changeId=randomUUID();const result:PilotResult=freezeFormData({pilotId:next.pilotId,workspaceId:p.workspaceId,actorId:p.id,revision:next.revision,state:next.state,manifestHash:next.manifestHash,action:cmd.action,changeId,at});
   const summary=(r:PilotRecord|null)=>r?{state:r.state,revision:r.revision,manifestHash:r.manifestHash}:null;
   check();await tx.write(cmd.expectedRevision,next,{id:changeId,workspaceId:p.workspaceId,actorId:p.id,pilotId:cmd.pilotId,action:cmd.action,reason:cmd.reason,at,before:summary(old),after:summary(next)},{key,requestHash:hash,workspaceId:p.workspaceId,actorId:p.id,pilotId:cmd.pilotId,result});check();prepared=true;
   return {...result,replayed:false};
  });}catch(e){if(prepared)throw fail('pilot_outcome_unknown');throw safe(e);}finally{bound?.close();}
 }
 async function read(p:Principal,proof:VerifiedAdministrativeAssurance,id:string){
  const target=uuidIdentifier(id);let bound:{close():void}|undefined;
  const check=()=>{assertAdministrativeAssurance(p,proof);if(bound)requireAdministrativeCapability(p,'release.read',proof);};
  try{return await o.store.transaction(p,check,async tx=>{
   check();const state=parseAdminWorkspace(await tx.readWorkspace());check();bound=bindAdministrativeCapabilities(p,proof,state,now);check();
   const raw=await tx.readPilot(target);check();if(raw===null)throw fail('pilot_not_found',404);const r=parsePilotRecord(raw);
   if(r.pilotId!==target||r.workspaceId!==p.workspaceId)throw fail('pilot_scope_mismatch',403);
   return freezeFormData({pilotId:r.pilotId,workspaceId:r.workspaceId,revision:r.revision,state:r.state,manifestHash:r.manifestHash,startedAt:r.startedAt,acceptedAt:r.acceptedAt,changedAt:r.changedAt});
  });}catch(e){throw safe(e);}finally{bound?.close();}
 }
 return Object.freeze({execute,read});
}
