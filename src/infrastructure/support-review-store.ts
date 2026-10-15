import type {Principal} from '../domain/model.ts';import type {SqlClient} from './sql.ts';
import type {ReviewTransaction,ReviewAggregate} from '../application/support-review.ts';
import type {ResourceScopeContext} from '../application/resource-access.ts';
import {assertBorrowedTransactionIdentity,rejectTransactionValidation} from './transaction.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {uuidIdentifier} from '../domain/input-values.ts';import {requestHash} from '../domain/canonical.ts';
import {parseExternalResourceSelection} from '../domain/external-resource.ts';
import {reviewRecord,parseApprovalInvitation,parseApprovalPolicy,reviewFailure as fail} from '../domain/support-review.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {createPostgresConsulteGeoIntakeStore} from './consultegeo-intake-store.ts';
const refusals:Readonly<Record<string,readonly [string,number]>>=Object.freeze({HDR01:['approval_forbidden',403],HDR02:['approval_revision_changed',412],HDR03:['approval_unavailable',409],HDR04:['review_idempotency_conflict',409],HDR05:['review_capability_required',403],HDR06:['review_draft_invalid',409],HDR07:['review_preview_changed',409]});
/** Borrowed request transaction only. Helpers must be natively qualified and
 * promoted before runtime composition; this adapter cannot provision authority,
 * create a policy, impersonate an approver or open an independent connection. */
export function createPostgresSupportReviewStore(c:SqlClient,person:Principal):ReviewTransaction{
 const p=freezeFormData(copyFormData(person)) as Principal;
 const intake=createPostgresConsulteGeoIntakeStore(c,p);let scope:ResourceScopeContext|undefined;
 function required(){assertBorrowedTransactionIdentity(c,p);if(!scope)return rejectTransactionValidation(c,fail('review_capability_required',403));return scope;}
 async function call(name:'aggregate'|'route'|'pending_invitation'|'invitation_receipt'|'invitation'|'grant'|'receipt'|'challenge'|'commit_invitation'|'commit_approval'|'commit_revision',values:unknown[]){
  assertBorrowedTransactionIdentity(c,p);
  try{
   const r=await c.query('select helpdesk_auth.hdnr_'+name+'('+values.map((_,i)=>'$'+(i+1)).join(',')+') as result',values);
   if(r.command!=='SELECT'||r.rowCount!==1||r.rows.length!==1)throw fail();
   const row=reviewRecord(r.rows[0],['result']);return freezeFormData(copyFormData(row.result));
  }catch(e){if(e instanceof HelpdeskError)return rejectTransactionValidation(c,e);
   const code=e&&typeof e==='object'?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;
   const pair=typeof code==='string'?refusals[code]:undefined;
   return rejectTransactionValidation(c,pair?fail(pair[0],pair[1]):fail());
  }
 }
 async function validated<T>(work:()=>Promise<T>):Promise<T>{try{return await work();}catch(e){return rejectTransactionValidation(c,e instanceof HelpdeskError?e:fail());}}
 const invitation=(raw:unknown,id?:string)=>{if(raw===null)return null;const i=parseApprovalInvitation(raw);if(i.workspaceId!==p.workspaceId||id!==undefined&&i.id!==id)throw fail();return i;};
 const envelope=(raw:unknown,key:string)=>{if(raw===null)return null;const r=reviewRecord(raw,['key','hash','result']);if(r.key!==key||typeof r.hash!=='string'||!/^[a-f0-9]{64}$/.test(r.hash))throw fail();return freezeFormData(r);};
 const committed=async(name:'commit_invitation'|'commit_approval'|'commit_revision',bundle:unknown,receipt:{key:string;hash:string;result:unknown})=>{
  required();const result=await call(name,[copyFormData(bundle),copyFormData(receipt)]);
  if(requestHash(result)!==requestHash(receipt.result))throw fail();
 };
 const store:ReviewTransaction={
  readAggregate:(id:string)=>validated(async()=>{
   const target=uuidIdentifier(id),raw=await call('aggregate',[target]);if(raw===null)return null;
   const e=reviewRecord(raw,['principalId','aggregate']);if(e.principalId!==p.id)throw fail('approval_forbidden',403);
   const a=reviewRecord(e.aggregate,['ticket','requesterId','protocol','refs','form','profile','approvalPolicy','events']) as unknown as ReviewAggregate;
   if(a.ticket.id!==target||a.ticket.workspaceId!==p.workspaceId||typeof a.protocol!=='string'||!/^CG-[1-9]\d{4,17}$/.test(a.protocol)||!Array.isArray(a.events))throw fail();
   uuidIdentifier(a.requesterId);uuidIdentifier(a.ticket.accountId);parseExternalResourceSelection(a.refs);parseApprovalPolicy(a.approvalPolicy);
   return freezeFormData(copyFormData(a)) as ReviewAggregate;
  }),
  lockReviewGrant:(cap:'approvals.request'|'approvals.decide'|'forms.revise',id:string,s:ResourceScopeContext)=>validated(async()=>{
   if(!['approvals.request','approvals.decide','forms.revise'].includes(cap)||s.principalId!==p.id||s.workspaceId!==p.workspaceId||s.operation!=='tickets.write')throw fail('review_capability_required',403);
   if(scope){if(requestHash(scope)!==requestHash(s))throw fail('review_capability_required',403);}else {const locked=await intake.lockScope(s);if(!locked)throw fail('review_capability_required',403);scope=locked;}
   return call('grant',[uuidIdentifier(id),cap,scope]);
  }),
  lockApprovalRoute:(id:string,s:ResourceScopeContext)=>validated(async()=>{if(requestHash(required())!==requestHash(s))throw fail();return call('route',[uuidIdentifier(id),s]);}),
  findPendingInvitation:(id:string)=>validated(async()=>{required();return invitation(await call('pending_invitation',[uuidIdentifier(id)]));}),
  readInvitationReceipt:(key:string)=>validated(async()=>{required();return envelope(await call('invitation_receipt',[key]),key);}),
  readInvitation:(id:string)=>validated(async()=>{required();return invitation(await call('invitation',[uuidIdentifier(id)]),id);}),
  readReceipt:(key:string)=>validated(async()=>{required();return envelope(await call('receipt',[key]),key);}),
  readDraft:(id:string)=>validated(async()=>{required();return intake.readDraft(uuidIdentifier(id));}),
  lockEvidence:(q,s)=>validated(async()=>{required();return intake.lockEvidence(q,s);}),
  lockLookup:(q,s)=>validated(async()=>{required();return intake.lockLookup(q,s);}),
  replaceChallenge:(i,expected)=>validated(async()=>{required();const parsed=invitation(i,i.id);if(!parsed||parsed.approverId!==p.id||!Number.isSafeInteger(expected)||expected<0||parsed.challenge?.generation!==expected+1)throw fail();const result=await call('challenge',[parsed,expected]);if(requestHash(result)!==requestHash(parsed))throw fail();}),
  commitInvitation:(bundle,receipt)=>validated(()=>committed('commit_invitation',bundle,receipt)),
  commitApproval:(bundle,receipt)=>validated(()=>committed('commit_approval',bundle,receipt)),
  commitRevision:(bundle,receipt)=>validated(()=>committed('commit_revision',bundle,receipt)),
 };return Object.freeze(store);
}
