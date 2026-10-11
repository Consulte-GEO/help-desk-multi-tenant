import {timingSafeEqual} from 'node:crypto';
import type {Principal} from './model.ts';
import type {SupportTicket,SupportWorkflowEvent} from './support-workflow.ts';
import {canReadTicket,isOperator} from './policy.ts';
import {uuidIdentifier} from './input-values.ts';
import {requestHash,secretHash} from './canonical.ts';
import {HelpdeskError} from './errors.ts';
import {instantMicros} from './business-calendar.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
export type ApprovalTarget=Readonly<{ticket:SupportTicket;requesterId:string;formRevision:number;formHash:string;refsHash:string}>;
export type ApprovalPolicy=Readonly<{versionId:string;status:'published';selfApprovalAllowed:boolean;sensitive:boolean;onApproved:'open'|'triage';onRejected:'waiting_customer';challengeTtlSeconds:number}>;
export type ApprovalInvitation=Readonly<{id:string;ticketId:string;workspaceId:string;accountId:string;approverId:string;policyVersionId:string;ticketVersion:number;formRevision:number;targetHash:string;status:'pending'|'used'|'revoked';createdAt:string;expiresAt:string;challenge:Readonly<{hash:string;generation:number;expiresAt:string}>|null}>;
export type ApprovalDecisionInput=Readonly<{ticketId:string;invitationId:string;expectedVersion:number;expectedFormRevision:number;token:string;decision:'approve'|'reject';reason:string}>;
export type FormAnswerDiff=Readonly<{path:string;beforePresent:boolean;afterPresent:boolean;before:unknown;after:unknown}>;
export const reviewFailure=(code='review_unavailable',status=503)=>new HelpdeskError(status,code,'Não foi possível confirmar a aprovação ou revisão. Atualize o estado antes de continuar.');
export function reviewRecord(raw:unknown,keys:readonly string[]):Record<string,unknown>{
 try{const r=copyFormData(raw) as Record<string,unknown>;if(!r||Array.isArray(r)||typeof r!=='object'||Object.keys(r).length!==keys.length||keys.some(k=>!Object.hasOwn(r,k)))throw Error();return r;}catch{throw reviewFailure('invalid_review_input',400);}
}
export function reviewRevision(v:unknown,min=1):number{if(!Number.isSafeInteger(v)||Number(v)<min)throw reviewFailure('invalid_review_input',400);return v as number;}
export function reviewText(v:unknown,max=12000,empty=false):string{if(typeof v!=='string'||v.length>max||!empty&&!v.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\p{Cs}]/u.test(v))throw reviewFailure('invalid_review_input',400);return v;}
export function reviewDigest(v:unknown):string{if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))throw reviewFailure('invalid_review_input',400);return v;}
export function parseApprovalPolicy(raw:unknown):ApprovalPolicy{
 const r=reviewRecord(raw,['versionId','status','selfApprovalAllowed','sensitive','onApproved','onRejected','challengeTtlSeconds']);
 if(typeof r.versionId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(r.versionId)||r.status!=='published'||typeof r.selfApprovalAllowed!=='boolean'||typeof r.sensitive!=='boolean'||!['open','triage'].includes(r.onApproved as string)||r.onRejected!=='waiting_customer'||reviewRevision(r.challengeTtlSeconds)>900)throw reviewFailure('invalid_review_input',400);
 return freezeFormData(r) as unknown as ApprovalPolicy;
}
/** Descriptive hash, never an authorization. Include immutable form/evidence digest
 * and the COMPLETE resource selection; a revision change requires a new invitation. */
export function approvalTargetHash(raw:ApprovalTarget):string{
 try{const x=copyFormData(raw) as ApprovalTarget,t=x.ticket;return requestHash({workspaceId:uuidIdentifier(t.workspaceId),accountId:uuidIdentifier(t.accountId),ticketId:uuidIdentifier(t.id),ticketVersion:reviewRevision(t.version),profileVersionId:t.profileVersionId,requesterId:uuidIdentifier(x.requesterId),formRevision:reviewRevision(x.formRevision),formHash:reviewDigest(x.formHash),refsHash:reviewDigest(x.refsHash)});}catch{throw reviewFailure('invalid_review_input',400);}
}
export function parseApprovalInvitation(raw:unknown):ApprovalInvitation{
 const r=reviewRecord(raw,['id','ticketId','workspaceId','accountId','approverId','policyVersionId','ticketVersion','formRevision','targetHash','status','createdAt','expiresAt','challenge']);
 for(const k of ['id','ticketId','workspaceId','accountId','approverId'])r[k]=uuidIdentifier(r[k]);
 reviewRevision(r.ticketVersion);reviewRevision(r.formRevision);reviewDigest(r.targetHash);
 if(!['pending','used','revoked'].includes(r.status as string)||typeof r.policyVersionId!=='string'||instantMicros(r.expiresAt)<=instantMicros(r.createdAt))throw reviewFailure('invalid_review_input',400);
 if(r.challenge!==null){const c=reviewRecord(r.challenge,['hash','generation','expiresAt']);reviewDigest(c.hash);reviewRevision(c.generation);if(instantMicros(c.expiresAt)>instantMicros(r.expiresAt))throw reviewFailure('invalid_review_input',400);r.challenge=c;}
 return freezeFormData(r) as unknown as ApprovalInvitation;
}
export function parseApprovalInput(raw:unknown):ApprovalDecisionInput{
 const r=reviewRecord(raw,['ticketId','invitationId','expectedVersion','expectedFormRevision','token','decision','reason']);
 if(!['approve','reject'].includes(r.decision as string)||typeof r.token!=='string'||!/^hd_approval_[A-Za-z0-9_-]{43}$/.test(r.token))throw reviewFailure('invalid_review_input',400);
 return freezeFormData({ticketId:uuidIdentifier(r.ticketId),invitationId:uuidIdentifier(r.invitationId),expectedVersion:reviewRevision(r.expectedVersion),expectedFormRevision:reviewRevision(r.expectedFormRevision),token:r.token,decision:r.decision as 'approve'|'reject',reason:reviewText(r.reason)});
}
function actor(p:Principal,x:ApprovalTarget){if(p.kind!=='human'||!p.scopes.includes('tickets:write')||!canReadTicket(p,x.ticket))throw reviewFailure('approval_forbidden',403);}
function writable(x:ApprovalTarget,expected:number,formExpected:number,at:string){
 if(expected!==x.ticket.version||formExpected!==x.formRevision)throw reviewFailure('approval_revision_changed',412);
 if(x.ticket.version===Number.MAX_SAFE_INTEGER||x.formRevision===Number.MAX_SAFE_INTEGER)throw reviewFailure('invalid_review_input',400);
 if(instantMicros(at)<instantMicros(x.ticket.lastEventAt))throw reviewFailure('review_time_conflict',409);
}
/** Pure additional decision. Current resource ACL, approval grant and step-up must
 * be enforced by the application in the same transaction; this function is not a
 * credential endpoint. Only an explicit POST decision may persist its result. */
export function decideScopedApproval(p:Principal,target:ApprovalTarget,rawPolicy:ApprovalPolicy,rawInvitation:ApprovalInvitation,raw:unknown,at:string){
 const x=copyFormData(target) as ApprovalTarget;actor(p,x);
 const i=parseApprovalInvitation(rawInvitation),policy=parseApprovalPolicy(rawPolicy),c=parseApprovalInput(raw);
 if(i.approverId!==p.id||i.workspaceId!==p.workspaceId||i.accountId!==x.ticket.accountId||i.ticketId!==x.ticket.id||c.ticketId!==i.ticketId||c.invitationId!==i.id)throw reviewFailure('approval_forbidden',403);
 writable(x,c.expectedVersion,c.expectedFormRevision,at);
 if(i.targetHash!==approvalTargetHash(x)||i.ticketVersion!==x.ticket.version||i.formRevision!==x.formRevision)throw reviewFailure('approval_revision_changed',412);
 if(i.status!=='pending'||x.ticket.approval!=='pending'||!['new','triage'].includes(x.ticket.status)||policy.versionId!==i.policyVersionId)throw reviewFailure('approval_unavailable',409);
 if(!policy.selfApprovalAllowed&&(p.id===x.ticket.createdBy||p.id===x.requesterId))throw reviewFailure('approval_self_forbidden',403);
 const now=instantMicros(at),challenge=i.challenge;
 if(!challenge||instantMicros(i.createdAt)>now||instantMicros(i.expiresAt)<=now||instantMicros(challenge.expiresAt)<=now||!timingSafeEqual(Buffer.from(challenge.hash,'hex'),Buffer.from(secretHash(c.token),'hex')))throw reviewFailure('approval_unavailable',409);
 const after:SupportTicket={...x.ticket,approval:c.decision==='approve'?'approved':'pending',status:c.decision==='approve'?policy.onApproved:policy.onRejected,version:x.ticket.version+1,updatedAt:at,lastEventAt:at};
 const event:SupportWorkflowEvent={ticketId:after.id,workspaceId:after.workspaceId,profileVersionId:after.profileVersionId,sequence:after.version,at,type:c.decision==='approve'?'approval_granted':'approval_rejected',actorId:p.id,actorKind:isOperator(p,p.workspaceId,after.accountId)?'human_agent':'customer',from:x.ticket.status,to:after.status};
 return freezeFormData({after,event,invitationId:i.id,challengeGeneration:challenge.generation,reason:c.reason,decision:c.decision,originPermissionGranted:false as const,originExecution:c.decision==='approve'?'pending_manual_action' as const:'not_requested' as const});
}
/** Bounded server diff. Arrays are atomic to avoid inventing stable row identities.
 * Presence flags distinguish omitted values from explicit null; never drops 0/false. */
export function diffFormAnswers(before:unknown,after:unknown):readonly FormAnswerDiff[]{
 try{
  const a=copyFormData(before),b=copyFormData(after),out:FormAnswerDiff[]=[];
  const walk=(left:unknown,right:unknown,path:string,hasLeft:boolean,hasRight:boolean,depth:number)=>{
   if(depth>12||out.length>=1000)throw Error();
   if(hasLeft&&hasRight&&requestHash(left)===requestHash(right))return;
   const obj=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
   if(hasLeft&&hasRight&&obj(left)&&obj(right))for(const key of [...new Set([...Object.keys(left),...Object.keys(right)])].sort())walk(left[key],right[key],path?path+'.'+key:key,Object.hasOwn(left,key),Object.hasOwn(right,key),depth+1);
   else out.push({path,beforePresent:hasLeft,afterPresent:hasRight,before:hasLeft?left:null,after:hasRight?right:null});
  };walk(a,b,'',true,true,0);return freezeFormData(out);
 }catch{throw reviewFailure('invalid_review_input',400);}
}
export function decideFormRevision(p:Principal,target:ApprovalTarget,policy:Readonly<{versionId:string;requiresApproval:boolean}>,raw:unknown,before:unknown,at:string){
 const x=copyFormData(target) as ApprovalTarget;actor(p,x);const c=reviewRecord(raw,['expectedVersion','expectedFormRevision','answers','comment']);
 writable(x,reviewRevision(c.expectedVersion),reviewRevision(c.expectedFormRevision),at);
 if(x.ticket.status!=='waiting_customer')throw reviewFailure('review_state_conflict',409);
 if(typeof policy.requiresApproval!=='boolean'||!policy.versionId)throw reviewFailure('invalid_review_input',400);
 const diff=diffFormAnswers(before,c.answers);if(!diff.length)throw reviewFailure('review_no_changes',409);
 const comment=reviewText(c.comment,12000,true),after:SupportTicket={...x.ticket,status:policy.requiresApproval?'triage':'open',approval:policy.requiresApproval?'pending':'not_required',version:x.ticket.version+1,updatedAt:at,lastEventAt:at};
 const event:SupportWorkflowEvent={ticketId:after.id,workspaceId:after.workspaceId,profileVersionId:after.profileVersionId,sequence:after.version,at,type:'form_revised',actorId:p.id,actorKind:isOperator(p,p.workspaceId,after.accountId)?'human_agent':'customer',from:x.ticket.status,to:after.status};
 return freezeFormData({after,event,formRevision:x.formRevision+1,answers:copyFormData(c.answers),diff,comment,invalidateInvitations:true as const});
}
