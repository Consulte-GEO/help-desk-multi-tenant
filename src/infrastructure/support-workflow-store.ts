import type {Principal} from '../domain/model.ts';
import {statuses} from '../domain/model.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';
import {requestHash} from '../domain/canonical.ts';
import {canReadTicket,isOperator} from '../domain/policy.ts';
import {decideSupportTransition,type SupportTicket,type SupportWorkflowProfile,type WorkflowDecision} from '../domain/support-workflow.ts';
import {parseExecutionChecklistReference,assertExecutionChecklistComplete} from '../domain/execution-checklist.ts';
import type {SupportWorkflowTransaction,SupportTransitionReceipt} from '../application/support-workflow.ts';
import type {SqlClient} from './sql.ts';
import {rejectTransactionValidation} from './transaction.ts';
import {createPostgresExecutionChecklistStore} from './execution-checklist-store.ts';
import {createPostgresChecklistWorkflow} from './support-workflow-checklist.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {isCanonicalInstant,compareInstants} from '../../shared/instant.js';

const failure=(code='workflow_store_unavailable',status=503)=>new HelpdeskError(status,code,'Não foi possível confirmar o atendimento desta revisão.');
const mapped:Readonly<Record<string,readonly [string,number]>>=Object.freeze({
 HDW01:['workflow_forbidden',403],HDW02:['workflow_version_conflict',412],HDW03:['workflow_transition_forbidden',409],
 HDW04:['workflow_checklist_required',409],HDW05:['workflow_idempotency_conflict',409],HDW06:['invalid_workflow_command',400],
 HDW07:['workflow_profile_mismatch',409],HDW08:['workflow_time_conflict',409],
 HD001:['checklist_forbidden',403],HD004:['checklist_evidence_denied',403],HD007:['checklist_binding_required',409],
});
function object(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw failure();
 return value as Record<string,unknown>;
}
function rev(v:unknown){if(!Number.isSafeInteger(v)||(v as number)<1||(v as number)>=Number.MAX_SAFE_INTEGER)throw failure();return v as number;}
function identifier(v:unknown){if(typeof v!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(v))throw failure();return v;}
function when(v:unknown){if(!isCanonicalInstant(v))throw failure();return v;}
function equal(a:unknown,b:unknown){if(requestHash(a)!==requestHash(b))throw failure();}
const ticketKeys=['id','workspaceId','accountId','productInstanceId','serviceCode','createdBy','assignedTo','subject','description','status','priority','version','coverageId','contractVersionId','contractSnapshot','createdAt','updatedAt','profileVersionId','lastEventAt','closedAt','resolution','approval'];
function ticket(value:unknown,p:Principal,target:string):SupportTicket{
 const t=object(value,ticketKeys);
 for(const k of ['id','workspaceId','accountId','productInstanceId','createdBy','coverageId','contractVersionId'])if(uuidIdentifier(t[k])!==t[k])throw failure();
 if(t.assignedTo!==null)uuidIdentifier(t.assignedTo);
 if(t.id!==target||t.workspaceId!==p.workspaceId||!statuses.includes(t.status as SupportTicket['status'])||!['low','normal','high','urgent'].includes(t.priority as string))throw failure();
 rev(t.version);identifier(t.profileVersionId);identifier(t.serviceCode);
 for(const k of ['subject','description'])if(!isPersistableText(t[k])||(t[k] as string).length>12000)throw failure();
 when(t.createdAt);when(t.updatedAt);when(t.lastEventAt);
 if(compareInstants(t.createdAt as string,t.updatedAt as string)>0||compareInstants(t.updatedAt as string,t.lastEventAt as string)>0)throw failure();
 if(t.closedAt!==null&&compareInstants(when(t.closedAt),t.lastEventAt as string)>0)throw failure();
 if(t.resolution!==null&&(!isPersistableText(t.resolution)||!t.resolution.trim()||t.resolution.length>12000))throw failure();
 if(!['not_required','pending','approved'].includes(t.approval as string))throw failure();
 if(['resolved','closed'].includes(t.status as string)&&t.resolution===null)throw failure();
 const c=object(t.contractSnapshot,['contractId','version','policy']);uuidIdentifier(c.contractId);rev(c.version);
 if(!c.policy||typeof c.policy!=='object'||Array.isArray(c.policy))throw failure();
 const result=t as unknown as SupportTicket;if(!canReadTicket(p,result))throw failure('workflow_forbidden',403);
 return freezeFormData(result);
}
function profile(value:unknown,id:string):SupportWorkflowProfile{
 if(!value||typeof value!=='object')throw failure();
 const keys=['versionId','status','reopenWindowMicros',...(Object.hasOwn(value,'executionChecklist')?['executionChecklist']:[])];
 const d=object(value,keys);
 if(identifier(d.versionId)!==id||d.status!=='published'||typeof d.reopenWindowMicros!=='string'||!/^(0|[1-9]\d{0,17})$/.test(d.reopenWindowMicros))throw failure('workflow_profile_mismatch',409);
 if(Object.hasOwn(d,'executionChecklist'))parseExecutionChecklistReference(d.executionChecklist);
 return freezeFormData(d) as unknown as SupportWorkflowProfile;
}
const resultKeys=['ticketId','workspaceId','accountId','actorId','profileVersionId','version','status','eventId','replayed'];
function storedResult(raw:unknown,p:Principal,t:SupportTicket):SupportTransitionReceipt{
 const r=object(raw,resultKeys);
 if(r.ticketId!==t.id||r.workspaceId!==p.workspaceId||r.accountId!==t.accountId||r.actorId!==p.id||r.profileVersionId!==t.profileVersionId||r.replayed!==false||!statuses.includes(r.status as SupportTicket['status']))throw failure();
 if(rev(r.version)<2)throw failure();uuidIdentifier(r.eventId);
 return r as SupportTransitionReceipt;
}
function commandFor(d:WorkflowDecision,a:Record<string,unknown>,expected:number):Record<string,unknown>{
 const action=a.action,c:Record<string,unknown>={action,expectedVersion:expected};
 if(['reply','customer_reply','request_customer','resolve'].includes(action as string))c.body=d.event.body;
 else if(action==='handoff'){c.target=d.after.status==='waiting_internal'?'internal':'third_party';c.reason=a.reason;}
 else if(['reopen','cancel'].includes(action as string))c.reason=a.reason;
 else if(!['start','triage','close'].includes(action as string))throw failure('workflow_transition_forbidden',409);
 return c;
}

/** M02 writer: one borrowed client, one ticket, pinned profile and immutable receipt.
 * The companion CANDIDATE SQL implements the storage contract and independently
 * authorizes each operation. It is not installed by this module. No pool, COMMIT,
 * source-GEO write, synthetic directory, automatic retry, or secret is introduced.
 * Transfers are deliberately denied until the target-assignee policy is qualified;
 * the original authenticated claim/release commands are not replaced here.
 */
export function createPostgresSupportWorkflowStore(client:SqlClient,principal:Principal):SupportWorkflowTransaction{
 const p=freezeFormData(copyFormData(principal)) as Principal;
 let target:string|undefined,locked:SupportTicket|undefined,pinned:SupportWorkflowProfile|undefined,committed=false;
 function current(){if(!locked||!pinned||committed)throw failure();return {t:locked,d:pinned};}
 async function query(sql:string,values:unknown[]):Promise<unknown>{
  let response;
  try{response=await client.query(sql,values);}catch(error){
   let code:unknown;try{code=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined;}catch{throw failure();}
   if(typeof code==='string'&&Object.hasOwn(mapped,code)){const m=mapped[code]!;throw failure(m[0],m[1]);}
   const admission:Record<string,number>={resource_scope_denied:403,resource_scope_unavailable:503,release_gate_closed:503,request_cancelled:409,transaction_identity_changed:403,transaction_validation_failed:503,transaction_statement_failed:503,transaction_work_incomplete:503,transaction_outcome_unknown:503,database_unavailable:503};
   if(typeof code==='string'&&Object.hasOwn(admission,code))throw failure(code,admission[code]);
   throw failure();
  }
  if(response.command!=='SELECT'||response.rowCount!==1||!Array.isArray(response.rows)||response.rows.length!==1)throw failure();
  const row=object(copyFormData(response.rows[0]),['result']);return freezeFormData(copyFormData(row.result));
 }
 function required<A extends unknown[],R>(fn:(...a:A)=>Promise<R>){return async(...args:A):Promise<R>=>{try{return await fn(...args);}catch(e){return rejectTransactionValidation(client,e instanceof HelpdeskError?e:failure());}};}
 return Object.freeze({
  readTicket:required(async(id:string)=>{
   const next=uuidIdentifier(id);if(target!==undefined&&target!==next)throw failure();if(committed)throw failure();
   target=next;
   const raw=await query('select helpdesk_auth.hdn_read_support_workflow($1) as result',[next]);
   if(raw===null){locked=undefined;pinned=undefined;return null;}
   const e=object(raw,['principalId','ticket','profile']);if(e.principalId!==p.id)throw failure();
   const t=ticket(e.ticket,p,next),d=profile(e.profile,t.profileVersionId);
   locked=t;pinned=d;return t;
  }),
  readProfile:required(async(id:string)=>{const s=current();if(id!==s.d.versionId)throw failure('workflow_profile_mismatch',409);return s.d;}),
  readReceipt:required(async(key:string)=>{
   const {t}=current();if(!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw failure('invalid_workflow_command',400);
   const value=await query('select helpdesk_auth.hdn_support_workflow_receipt($1,$2) as result',[t.id,key]);
   if(value===null)return null;
   const r=object(value,['key','hash','result']);if(r.key!==key||typeof r.hash!=='string'||!/^[a-f0-9]{64}$/.test(r.hash))throw failure();
   const saved=storedResult(r.result,p,t);if(saved.version>t.version)throw failure();return value;
  }),
  verifyAssignee:required(async(_id:string,_scope:unknown)=>{current();throw failure('workflow_assignee_denied',403);}),
  commitDecision:required(async(expected:number,rawDecision:WorkflowDecision,rawAudit:Readonly<Record<string,unknown>>,rawOutbox:Readonly<Record<string,unknown>>|null,rawReceipt:Readonly<{key:string;hash:string;result:SupportTransitionReceipt}>)=>{
   const {t,d}=current();if(rev(expected)!==t.version)throw failure('workflow_version_conflict',412);
   const decision=copyFormData(rawDecision) as WorkflowDecision,audit=copyFormData(rawAudit) as Record<string,unknown>,receipt=object(copyFormData(rawReceipt),['key','hash','result']);
   const at=when(audit.at),cmd=commandFor(decision,audit,expected),recomputed=decideSupportTransition(p,t,d,cmd,at);equal(recomputed,decision);
   if(cmd.action==='reopen'&&t.status==='closed'||cmd.action==='customer_reply'&&t.status==='waiting_customer'&&!isOperator(p,t.workspaceId,t.accountId))throw failure('workflow_transition_forbidden',409);
   const result=storedResult(receipt.result,p,t);if(result.version!==expected+1||result.status!==decision.after.status)throw failure();
   const expectedAudit:Record<string,unknown>={id:result.eventId,workspaceId:p.workspaceId,ticketId:t.id,actorId:p.id,requestId:uuidIdentifier(audit.requestId),at,action:decision.audit.action,reason:decision.audit.reason,from:t.status,to:decision.after.status,version:decision.after.version};
   if(decision.requirements.some(r=>r.kind==='execution_checklist')){
    const checklist=createPostgresExecutionChecklistStore(client);await checklist.assertReady();
    const snapshot=await checklist.readExecutionChecklist(t.id);
    expectedAudit.executionChecklist=assertExecutionChecklistComplete(snapshot,{workspaceId:t.workspaceId,accountId:t.accountId,ticketId:t.id,ticketVersion:t.version,profileVersionId:t.profileVersionId,reference:d.executionChecklist!},at);
   }
   equal(expectedAudit,audit);
   const minimal={id:result.eventId,workspaceId:p.workspaceId,accountId:t.accountId,ticketId:t.id,type:'support.'+decision.event.type,version:result.version,requestId:audit.requestId,createdAt:at};
   equal(minimal,copyFormData(rawOutbox));
   if(typeof receipt.key!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(receipt.key))throw failure();
   const hash=requestHash({workspaceId:p.workspaceId,actorId:p.id,ticketId:t.id,command:cmd});if(receipt.hash!==hash)throw failure('workflow_idempotency_conflict',409);
   const submission=freezeFormData({schema:1,profileVersionId:d.versionId,command:cmd,at,requestId:audit.requestId,eventId:result.eventId,key:receipt.key,hash,audit,receipt:result});
   const confirmed=await query('select helpdesk_auth.hdn_commit_support_workflow($1,$2) as result',[t.id,submission]);
   equal(confirmed,result);committed=true;
  }),
 });
}

/** The host supplies only real pool/resolver/clock; it cannot inject a memory writer. */
export function createDurablePostgresSupportWorkflow(options:Omit<Parameters<typeof createPostgresChecklistWorkflow>[0],'createStore'>){
 return createPostgresChecklistWorkflow({...options,createStore:createPostgresSupportWorkflowStore});
}
