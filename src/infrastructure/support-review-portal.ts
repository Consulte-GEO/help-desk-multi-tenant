import type {Principal} from '../domain/model.ts';import type {SqlClient,SqlPool} from './sql.ts';import type {createResourceAccessResolver,ResourceScopeContext} from '../application/resource-access.ts';import type {ReviewDirectory} from '../application/support-review.ts';
import {safeReviewError} from '../application/support-review.ts';import {runResourceTicketTransaction} from './resource-access-store.ts';import {assertBorrowedTransactionIdentity,runTransaction} from './transaction.ts';
import {reviewRecord,reviewRevision,reviewDigest,reviewText,reviewFailure as fail} from '../domain/support-review.ts';import {parseFormVersion} from '../domain/form-schema.ts';import {uuidIdentifier} from '../domain/input-values.ts';import {parseExternalResourceSelection,externalResourceSelectionKey} from '../domain/external-resource.ts';
import {copyFormData,freezeFormData,validateFormValues} from '../../shared/form-rules.js';import {requestHash} from '../domain/canonical.ts';import {instantMicros} from '../domain/business-calendar.ts';import {NOTIFICATION_KINDS,notificationRef} from '../domain/notification-delivery.ts';
export function parseSupportReviewView(raw:unknown,p:Principal,ticketId:string,s:Pick<ResourceScopeContext,'principalId'|'workspaceId'|'accountId'|'refs'>){
 if(raw===null)return null;
 const v=reviewRecord(raw,['schema','context','protocol','status','approval','form','capabilities','decision']),c=reviewRecord(v.context,['principalId','workspaceId','accountId','ticketId','version','formRevision','invitationId']),f=reviewRecord(v.form,['definition','formId','formVersion','schemaHash','answers','refs']),caps=reviewRecord(v.capabilities,['requestApproval','decideApproval','reviseForm']);
 if(v.schema!==1||c.principalId!==p.id||c.workspaceId!==p.workspaceId||c.accountId!==s.accountId||c.ticketId!==ticketId||s.principalId!==p.id||s.workspaceId!==p.workspaceId||typeof v.protocol!=='string'||!/^CG-[1-9]\d{4,17}$/.test(v.protocol)||!['new','triage','open','waiting_customer','waiting_internal','waiting_third_party','resolved','closed','cancelled'].includes(v.status as string)||!['not_required','pending','approved'].includes(v.approval as string))throw fail();
 uuidIdentifier(c.accountId);uuidIdentifier(c.ticketId);reviewRevision(c.version);reviewRevision(c.formRevision);for(const value of Object.values(caps))if(typeof value!=='boolean')throw fail();
 if(c.invitationId!==null)uuidIdentifier(c.invitationId);if((c.invitationId!==null)!==caps.decideApproval)throw fail();
 const definition=parseFormVersion(f.definition);reviewDigest(f.schemaHash);
 if(definition.id!==f.formId||definition.version!==f.formVersion||definition.status!=='published'||definition.fields.some(field=>field.public!==true)||externalResourceSelectionKey(parseExternalResourceSelection(f.refs))!==externalResourceSelectionKey(s.refs))throw fail();
 const answers=validateFormValues(definition,f.answers,{audience:'customer'});if(!answers.valid||requestHash(answers.publicAnswers)!==requestHash(f.answers))throw fail();
 if(v.decision!==null){const d=reviewRecord(v.decision,['decision','version','formRevision','at','reason']);if(!['approve','reject'].includes(d.decision as string)||reviewRevision(d.version)>Number(c.version)||reviewRevision(d.formRevision)>Number(c.formRevision))throw fail();instantMicros(d.at);reviewText(d.reason);}
 return freezeFormData(copyFormData(v));
}
export function parseDeliveryAttention(raw:unknown,p:Principal,ticketId:string,s:Pick<ResourceScopeContext,'accountId'>){
 const v=reviewRecord(raw,['ticketId','workspaceId','accountId','items','limit','resendAvailable']);
 if(v.ticketId!==ticketId||v.workspaceId!==p.workspaceId||v.accountId!==s.accountId||v.limit!==20||v.resendAvailable!==false||!Array.isArray(v.items)||v.items.length>20)throw fail();
 const seen=new Set<string>();for(const rawRow of v.items){const r=reviewRecord(rawRow,['id','kind','state','attempts','attention','updatedAt','nextAttemptAt','reason']),id=uuidIdentifier(r.id);if(seen.has(id)||!NOTIFICATION_KINDS.includes(r.kind as any)||!['pending','retry_wait','leased','sending','unknown','accepted','delivered','failed','suppressed'].includes(r.state as string)||!Number.isSafeInteger(r.attempts)||Number(r.attempts)<0||Number(r.attempts)>10||typeof r.attention!=='boolean')throw fail();seen.add(id);instantMicros(r.updatedAt);if(r.nextAttemptAt!==null)instantMicros(r.nextAttemptAt);if(r.reason!==null)notificationRef(r.reason,80);}
 return freezeFormData(copyFormData(v));
}
/** Same borrowed resource transaction as commands. Reads never call a provider,
 * sender, challenge writer or command. SQL must be promoted before mounting. */
export function createPostgresSupportReviewQueries(o:{pool:SqlPool;resolver:ReturnType<typeof createResourceAccessResolver>;directory:ReviewDirectory;assertStepUp:(p:Principal,proof:unknown)=>void;enabled?:()=>boolean}){
 async function read(p:Principal,id:string,attention:boolean,proof:unknown,signal?:AbortSignal,admission?:()=>void){try{
  const target=uuidIdentifier(id),identity=requestHash(copyFormData(p)),check=()=>{admission?.();if(o.enabled&&o.enabled()!==true)throw fail('release_gate_closed',503);if(requestHash(copyFormData(p))!==identity||p.kind!=='human')throw fail('approval_forbidden',403);if(attention){try{o.assertStepUp(p,proof);}catch{throw fail('review_step_up_required',403);}}};check();
  const located=await o.directory.locateTicket(p,target,signal);check();if(!located)throw fail('review_not_found',404);const refs=parseExternalResourceSelection(located.refs),lease=await o.resolver.resolveResourceScope(p,refs,'tickets.write',signal);check();
  return await runResourceTicketTransaction(o.pool,o.resolver,p,target,refs,'tickets.write',lease,async(c:SqlClient,s:ResourceScopeContext)=>{
   check();assertBorrowedTransactionIdentity(c,p);if(s.accountId!==located.accountId)throw fail('approval_forbidden',403);
   let result;try{result=await c.query(attention?'select helpdesk_auth.hdn_notification_attention($1) as result':'select helpdesk_auth.hdnr_view($1) as result',[target]);}catch(e){if(e&&typeof e==='object'&&Object.getOwnPropertyDescriptor(e,'code')?.value==='HDR01')throw fail('approval_forbidden',403);throw fail();}
   check();if(result.command!=='SELECT'||result.rowCount!==1||result.rows.length!==1)throw fail();const value=reviewRecord(result.rows[0],['result']).result;return attention?parseDeliveryAttention(value,p,target,s):parseSupportReviewView(value,p,target,s);
  },signal,check);
 }catch(e){throw safeReviewError(e);}}
 async function readApprovalLanding(p:Principal,id:string,signal?:AbortSignal,admission?:()=>void){try{
  const invitationId=uuidIdentifier(id),identity=requestHash(copyFormData(p)),check=()=>{admission?.();if(signal?.aborted)throw fail();if(o.enabled&&o.enabled()!==true)throw fail('release_gate_closed',503);if(p.kind!=='human'||requestHash(copyFormData(p))!==identity)throw fail('approval_forbidden',403);};check();
  return await runTransaction(o.pool,p,async c=>{
   check();assertBorrowedTransactionIdentity(c,p);let r;
   try{r=await c.query('select helpdesk_auth.hdnr_landing($1) as result',[invitationId]);}catch(e){const code=e&&typeof e==='object'?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;if(code==='HDR01'||code==='HDR05')throw fail('approval_forbidden',403);if(code==='HDR02')throw fail('approval_revision_changed',412);throw fail();}
   check();if(r.command!=='SELECT'||r.rowCount!==1||r.rows.length!==1)throw fail();const result=reviewRecord(reviewRecord(r.rows[0],['result']).result,['workspaceId','ticketId','invitationId']);if(result.workspaceId!==p.workspaceId||result.invitationId!==invitationId)throw fail();uuidIdentifier(result.ticketId);return freezeFormData(result);
  },check);
 }catch(e){throw safeReviewError(e);}}
 return Object.freeze({readApprovalLanding,readReviewContext:(p:Principal,id:string,signal?:AbortSignal,admission?:()=>void)=>read(p,id,false,undefined,signal,admission),readDeliveryAttention:(p:Principal,id:string,proof:unknown,signal?:AbortSignal,admission?:()=>void)=>read(p,id,true,proof,signal,admission)});
}
