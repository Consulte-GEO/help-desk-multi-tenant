import {randomUUID} from 'node:crypto';
import type {Principal} from '../domain/model.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {requestHash} from '../domain/canonical.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {isCanonicalInstant,compareInstants} from '../../shared/instant.js';
import {exactAdminRecord,adminRevision,parseAdminWorkspace,parseAdminMember} from '../domain/admin-policy.ts';
import type {MemberAdminStore,MemberAdminReceipt,StoredMemberReceipt,MemberAdminAudit} from './member-admin.ts';
const fail=(status:number,code:string)=>new HelpdeskError(status,code,'Não foi possível concluir a aceitação do convite.');
/** Accept only the already authenticated person's own pending invitation.
 * Authentication belongs to the server mount, never an email/body/header selector.
 * No capability, business scope, GEO grant, user or credential is created here.
 */
export function createMemberInvitationAcceptance(options:{store:MemberAdminStore;clock?:()=>string}){
 const clock=options.clock??(()=>new Date().toISOString());
 async function accept(principal:Principal,raw:unknown,key:string):Promise<MemberAdminReceipt>{
  let p:Principal,expected:number,memberRevision:number;
  try{
   if(principal.kind!=='human')throw Error();
   p=structuredClone(principal);p.id=uuidIdentifier(p.id);p.workspaceId=uuidIdentifier(p.workspaceId);
   const x=exactAdminRecord(raw,['expectedRevision','expectedMemberRevision']);expected=adminRevision(x.expectedRevision);memberRevision=adminRevision(x.expectedMemberRevision);
   if(typeof key!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw Error();
  }catch{throw fail(400,'invalid_invitation_acceptance');}
  const snapshot=requestHash(p),hash=requestHash({workspaceId:p.workspaceId,principalId:p.id,expected,memberRevision,action:'accept_invitation'});
  let last:string|undefined,expiry:string|undefined,prepared=false,poisoned=false;
  const admission=()=>{
   try{
    const at=clock();if(poisoned||requestHash(p)!==snapshot||!isCanonicalInstant(at)||last&&compareInstants(at,last)<0)throw Error();last=at;
    if(expiry&&compareInstants(expiry,at)<=0)throw fail(403,'invitation_unavailable');
   }catch{poisoned=true;throw fail(403,'invitation_unavailable');}
  };
  try{return await options.store.transaction(p,admission,async tx=>{
   admission();const state=parseAdminWorkspace(await tx.readWorkspace());admission();
   if(state.workspaceId!==p.workspaceId)throw fail(403,'invitation_unavailable');
   const current=state.members.find(m=>m.principalId===p.id);
   if(!current||current.role!=='agent'||current.status==='revoked'||current.expiresAt===null)throw fail(403,'invitation_unavailable');
   expiry=current.expiresAt;admission();
   const prior=await tx.getReceipt(key);admission();
   if(prior!==null){
    const s=exactAdminRecord(prior,['key','workspaceId','actorId','hash','result']);
    if(s.workspaceId!==p.workspaceId||s.actorId!==p.id||s.key!==key||s.hash!==hash)throw fail(409,'member_idempotency_conflict');
    const r=exactAdminRecord(s.result,['workspaceId','actorId','revision','member','auditId','notification','replayed']);
    const member=parseAdminMember(r.member);
    if(r.workspaceId!==p.workspaceId||r.actorId!==p.id||r.notification!=='not_requested'||r.replayed!==false||member.principalId!==p.id||member.role!=='agent'||member.status!=='active'||current.status!=='active'||adminRevision(r.revision)>state.revision)throw fail(503,'invalid_administrative_state');
    return Object.freeze({workspaceId:p.workspaceId,actorId:p.id,revision:adminRevision(r.revision),member,auditId:uuidIdentifier(r.auditId),notification:'not_requested',replayed:true});
   }
   if(state.revision!==expected||current.revision!==memberRevision)throw fail(412,'member_version_conflict');
   if(current.status!=='invited')throw fail(403,'invitation_unavailable');
   const member=parseAdminMember({...current,status:'active',revision:adminRevision(current.revision+1)}),auditId=randomUUID();
   const result:MemberAdminReceipt=Object.freeze({workspaceId:p.workspaceId,actorId:p.id,revision:adminRevision(state.revision+1),member,auditId,notification:'not_requested',replayed:false});
   const receipt:StoredMemberReceipt={key,workspaceId:p.workspaceId,actorId:p.id,hash,result};
   const audit:MemberAdminAudit={id:auditId,workspaceId:p.workspaceId,actorId:p.id,targetPrincipalId:p.id,action:'accept_invitation',reason:'Aceitação explícita pela própria pessoa autenticada.',at:last!,before:current,after:member,successorPrincipalId:null};
   await tx.commitChange(expected,member,audit,receipt);admission();prepared=true;return result;
  });}catch(e){
   if(prepared)throw fail(503,'member_admin_outcome_unknown');
   let code='invalid_administrative_state',status=503;
   try{const value=e&&typeof e==='object'?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;
    const allowed:Record<string,number>={invitation_unavailable:403,member_version_conflict:412,member_idempotency_conflict:409,invalid_administrative_state:503};
    if(typeof value==='string'&&Object.hasOwn(allowed,value)){code=value;status=allowed[value]!;}
   }catch{/* hostile descriptors are not a safe error */}
   throw fail(status,code);
  }
 }
 return Object.freeze({accept});
}
