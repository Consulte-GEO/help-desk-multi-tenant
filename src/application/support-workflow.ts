import {randomUUID} from 'node:crypto';
import type {Principal} from '../domain/model.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {requestHash} from '../domain/canonical.ts';
import {canReadTicket} from '../domain/policy.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {decideSupportTransition,type SupportTicket,type SupportWorkflowProfile,type WorkflowDecision} from '../domain/support-workflow.ts';
import type {createResourceAccessResolver,ResourceScopeContext} from './resource-access.ts';
import type {ExternalResourceRef} from '../domain/external-resource.ts';
import type {SqlPool,SqlClient} from '../infrastructure/sql.ts';
import {runResourceTicketTransaction} from '../infrastructure/resource-access-store.ts';
export type SupportTransitionReceipt=Readonly<{ticketId:string;workspaceId:string;accountId:string;actorId:string;profileVersionId:string;version:number;status:SupportTicket['status'];eventId:string;replayed:boolean}>;
export interface SupportWorkflowTransaction {
 /** Lock ticket and pinned profile; the private reader is still subject to base RLS. */
 readTicket(ticketId:string):Promise<SupportTicket|null>;readProfile(id:string):Promise<SupportWorkflowProfile>;
 /** Lock the actor/ticket/key intent. Return null or the immutable stored envelope. */
 readReceipt(key:string):Promise<unknown>;
 /** Current operator + COMPLETE resource coverage, bound to workflowScopeKey. */
 verifyAssignee(id:string,context:ResourceScopeContext):Promise<unknown>;
 /** CAS + event + audit + optional minimal outbox + receipt: one transaction/client.
  * No COMMIT/ROLLBACK/pool acquisition here. No service-role or network inside this adapter.
  */
 commitDecision(expectedVersion:number,decision:WorkflowDecision,audit:Readonly<Record<string,unknown>>,outbox:Readonly<Record<string,unknown>>|null,receipt:Readonly<{key:string;hash:string;result:SupportTransitionReceipt}>):Promise<void>;
}
export function workflowScopeKey(scope:ResourceScopeContext){return requestHash({workspaceId:scope.workspaceId,accountId:scope.accountId,bindingId:scope.bindingId,bindingRevision:scope.bindingRevision,accessRevision:scope.accessRevision,refs:scope.refs});}
const fail=(code='workflow_store_unavailable',status=503)=>new HelpdeskError(status,code,'Não foi possível confirmar a operação de atendimento.');
const allowed:Record<string,number>={workflow_forbidden:403,workflow_profile_mismatch:409,workflow_version_conflict:412,workflow_time_conflict:409,invalid_workflow_command:400,workflow_approval_required:409,workflow_transition_forbidden:409,workflow_resolution_required:409,workflow_reopen_window_expired:409,workflow_assignee_denied:403,workflow_idempotency_conflict:409,
 resource_scope_denied:403,resource_scope_unavailable:503,resource_scope_database_mismatch:403,resource_scope_database_unavailable:503,transaction_outcome_unknown:503,transaction_identity_changed:403,transaction_work_incomplete:503,transaction_statement_failed:503,workflow_store_unavailable:503,workflow_not_found:404};
function safe(e:unknown){try{if(e instanceof HelpdeskError){const c=Object.getOwnPropertyDescriptor(e,'code')?.value;if(typeof c==='string'&&Object.hasOwn(allowed,c))return fail(c,allowed[c]);}}catch{}return fail();}
/** Optional application composition. Real directory/command store + runtime wiring
 * remain required. Preserves the existing transaction and opaque resource proof;
 * no fallback to an unscoped route, no machine impersonation, no implicit retry.
 */
export function createSupportWorkflow(o:{pool:SqlPool;resolver:ReturnType<typeof createResourceAccessResolver>;createStore:(client:SqlClient,p:Principal)=>SupportWorkflowTransaction;clock?:()=>string}){
 const clock=o.clock??(()=>new Date().toISOString());
 async function execute(p:Principal,target:string,refs:readonly ExternalResourceRef[],raw:unknown,key:string,requestId:string,signal?:AbortSignal):Promise<SupportTransitionReceipt>{
  try{
   const ticketId=uuidIdentifier(target);uuidIdentifier(requestId);if(!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw fail('invalid_workflow_command',400);
   const command=copyFormData(raw),hash=requestHash({workspaceId:p.workspaceId,actorId:p.id,ticketId,command});
   const proof=await o.resolver.resolveResourceScope(p,refs,'tickets.write',signal);
   return await runResourceTicketTransaction(o.pool,o.resolver,p,ticketId,refs,'tickets.write',proof,async(client,scope)=>{
    const store=o.createStore(client,p),source=await store.readTicket(ticketId);
    if(!source)throw fail('workflow_not_found',404);const t=copyFormData(source) as SupportTicket;
    if(t.id!==ticketId||t.workspaceId!==scope.workspaceId||t.accountId!==scope.accountId||!canReadTicket(p,t))throw fail('workflow_forbidden',403);
    const saved=await store.readReceipt(key);
    if(saved!==null){
     const s=copyFormData(saved) as {key:string;hash:string;result:SupportTransitionReceipt};
     if(!s||Object.keys(s).length!==3||s.key!==key)throw fail();if(s.hash!==hash)throw fail('workflow_idempotency_conflict',409);
     const r=s.result;
     if(!r||Object.keys(r).length!==9||r.ticketId!==ticketId||r.workspaceId!==p.workspaceId||r.accountId!==t.accountId||r.actorId!==p.id||r.profileVersionId!==t.profileVersionId||r.replayed!==false||!Number.isSafeInteger(r.version)||r.version<2||r.version>t.version||!['new','triage','open','waiting_customer','waiting_internal','waiting_third_party','resolved','closed','cancelled'].includes(r.status))throw fail();
     uuidIdentifier(r.eventId);return freezeFormData({...r,replayed:true});
    }
    const profile=await store.readProfile(t.profileVersionId),at=clock(),decision=decideSupportTransition(p,t,profile,command,at);
    for(const requirement of decision.requirements){
     const a=copyFormData(await store.verifyAssignee(requirement.principalId,scope)) as Record<string,unknown>;
     if(!a||Object.keys(a).length!==6||a.principalId!==requirement.principalId||a.workspaceId!==p.workspaceId||a.accountId!==scope.accountId||a.scopeKey!==workflowScopeKey(scope)||a.active!==true||a.operator!==true)throw fail('workflow_assignee_denied',403);
    }
    const eventId=randomUUID(),result=freezeFormData({ticketId,workspaceId:p.workspaceId,accountId:t.accountId,actorId:p.id,profileVersionId:t.profileVersionId,version:decision.after.version,status:decision.after.status,eventId,replayed:false});
    const audit=freezeFormData({id:eventId,workspaceId:p.workspaceId,ticketId,actorId:p.id,requestId,at,action:decision.audit.action,reason:decision.audit.reason,from:t.status,to:decision.after.status,version:decision.after.version});
    // Notification is an intent only. Do not export private reasons, note bodies,
    // complete forms or delegated tokens. Recipient ACL/delivery belongs to CG12.
    const outbox=decision.event.type==='assigned'?null:freezeFormData({id:eventId,workspaceId:p.workspaceId,accountId:t.accountId,ticketId,type:'support.'+decision.event.type,version:result.version,requestId,createdAt:at});
    await store.commitDecision(t.version,decision,audit,outbox,{key,hash,result});return result;
   },signal);
  }catch(e){throw safe(e);}
 }
 return Object.freeze({execute});
}
