import {parseEvidenceQuery,type ChecklistEvidencePage,type ChecklistEvidenceQuery} from '../../shared/checklist-evidence.js';
import type {Principal} from '../domain/model.ts';
import type {ExternalResourceRef} from '../domain/external-resource.ts';
import type {createResourceAccessResolver,ResourceScopeContext} from './resource-access.ts';
import type {SqlPool} from '../infrastructure/sql.ts';
import type {TransactionAdmission} from '../infrastructure/transaction.ts';
import {runResourceTicketTransaction} from '../infrastructure/resource-access-store.ts';
import {createPostgresExecutionChecklistStore} from '../infrastructure/execution-checklist-store.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {requestHash} from '../domain/canonical.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {isCanonicalInstant,compareInstants} from '../../shared/instant.js';
import {checklistError,decideExecutionChecklistMark,parseChecklistMark,parseChecklistRecord,requireChecklistOperator,type ChecklistMark,type ChecklistRecord} from '../domain/execution-checklist-mark.ts';
export type ChecklistMarkReceipt=Readonly<{ticketId:string;workspaceId:string;accountId:string;actorId:string;itemId:string;status:ChecklistMark['status'];ticketVersion:number;checklistRevision:number;auditId:string;at:string;replayed:boolean}>;
const safeCodes:Record<string,number>={release_gate_closed:503,request_cancelled:409,invalid_checklist_evidence_query:400,invalid_checklist_mark:400,invalid_resource_selection:400,checklist_forbidden:403,checklist_evidence_denied:403,checklist_state_conflict:409,checklist_intent_conflict:409,checklist_binding_required:409,checklist_risk_ack_required:409,checklist_version_conflict:412,checklist_store_invalid:503,checklist_store_unavailable:503,resource_scope_denied:403,resource_scope_unavailable:503,resource_scope_database_mismatch:403,resource_scope_database_unavailable:503,transaction_identity_changed:403,transaction_statement_failed:503,transaction_work_incomplete:503,transaction_outcome_unknown:503,database_unavailable:503};
function safe(error:unknown){let code:unknown;try{code=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined;}catch{}return typeof code==='string'&&Object.hasOwn(safeCodes,code)?checklistError(code,safeCodes[code]):checklistError('checklist_store_unavailable');}
function object(raw:unknown,keys:string[]):Record<string,unknown>{const r=copyFormData(raw) as Record<string,unknown>;if(!r||Array.isArray(r)||Object.keys(r).length!==keys.length||keys.some(k=>!Object.hasOwn(r,k)))throw checklistError();return r;}
function bound(raw:unknown,p:Principal,target:string,scope:ResourceScopeContext):ChecklistRecord{const r=parseChecklistRecord(raw),c=r.context;
 if(scope.principalId!==p.id||c.ticketId!==target||c.workspaceId!==scope.workspaceId||c.accountId!==scope.accountId)throw checklistError();requireChecklistOperator(p,c);return r;
}
function receipt(raw:unknown,p:Principal,record:ChecklistRecord,c:ChecklistMark):ChecklistMarkReceipt{
 const r=object(raw,['ticketId','workspaceId','accountId','actorId','itemId','status','ticketVersion','checklistRevision','auditId','at','replayed']);
 if(r.workspaceId!==p.workspaceId||r.accountId!==record.context.accountId||r.ticketId!==record.context.ticketId||r.actorId!==p.id||r.itemId!==c.itemId||r.status!==c.status
  ||r.ticketVersion!==c.expectedTicketVersion||r.checklistRevision!==c.expectedChecklistRevision+1||r.replayed!==false||!isCanonicalInstant(r.at))throw checklistError();
 uuidIdentifier(r.auditId);return r as ChecklistMarkReceipt;
}
/** Internal use only: pass an authenticated server Principal, never request JSON.
 * The existing resource resolver, current SQL proof and transaction executor stay
 * authoritative. No API endpoint, MFA policy, grant or source execution is enabled.
 * The optional admission is a SERVER callback passed by the HTTP composition,
 * never a request field. The original runner checks it around queries and before
 * COMMIT; loss after COMMIT dispatch retains confirmed/unknown semantics.
 * A private existing execution note is the only qualified evidence in this slice.
 */
export function createExecutionChecklistService(o:{pool:SqlPool;resolver:ReturnType<typeof createResourceAccessResolver>}){
 return Object.freeze({
  async queryEvidence(p:Principal,target:string,refs:readonly ExternalResourceRef[],raw:unknown,signal?:AbortSignal,admission?:TransactionAdmission):Promise<ChecklistEvidencePage>{
   try{
    let q:ChecklistEvidenceQuery;try{q=parseEvidenceQuery(raw);}catch{throw checklistError('invalid_checklist_evidence_query',400);}
    const actor=freezeFormData(copyFormData(p)) as Principal,ticketId=uuidIdentifier(target);
    const proof=await o.resolver.resolveResourceScope(actor,refs,'notes.read',signal);
    return await runResourceTicketTransaction(o.pool,o.resolver,actor,ticketId,refs,'notes.read',proof,async(client,scope)=>{
     const store=createPostgresExecutionChecklistStore(client);await store.assertReady();
     const record=bound(await store.read(ticketId),actor,ticketId,scope);
     requireChecklistOperator(actor,record.context,true,record.assignedTo);
     if(!['triage','open','waiting_internal','waiting_third_party'].includes(record.ticketStatus))throw checklistError('checklist_state_conflict',409);
     if(q.expectedTicketVersion!==record.context.ticketVersion||q.expectedChecklistRevision!==(record.snapshot?.revision??0))throw checklistError('checklist_version_conflict',412);
     return store.queryEvidence({principalId:actor.id,workspaceId:scope.workspaceId,accountId:scope.accountId,ticketId,
      ticketVersion:record.context.ticketVersion,checklistRevision:record.snapshot?.revision??0,readAt:record.readAt},q);
    },signal,admission);
   }catch(e){throw safe(e);}
  },
  async read(p:Principal,target:string,refs:readonly ExternalResourceRef[],signal?:AbortSignal,admission?:TransactionAdmission):Promise<ChecklistRecord>{
   try{const actor=freezeFormData(copyFormData(p)) as Principal,ticketId=uuidIdentifier(target);
    const proof=await o.resolver.resolveResourceScope(actor,refs,'notes.read',signal);
    return await runResourceTicketTransaction(o.pool,o.resolver,actor,ticketId,refs,'notes.read',proof,async(client,scope)=>{
     const store=createPostgresExecutionChecklistStore(client);await store.assertReady();return bound(await store.read(ticketId),actor,ticketId,scope);
    },signal,admission);
   }catch(e){throw safe(e);}
  },
  async mark(p:Principal,target:string,refs:readonly ExternalResourceRef[],raw:unknown,key:string,requestId:string,signal?:AbortSignal,admission?:TransactionAdmission):Promise<ChecklistMarkReceipt>{
   try{const command=parseChecklistMark(raw),actor=freezeFormData(copyFormData(p)) as Principal,ticketId=uuidIdentifier(target);uuidIdentifier(requestId);
    if(!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw checklistError('invalid_checklist_mark',400);
    const hash=requestHash({workspaceId:actor.workspaceId,actorId:actor.id,ticketId,command});
    const proof=await o.resolver.resolveResourceScope(actor,refs,'notes.write',signal);
    return await runResourceTicketTransaction(o.pool,o.resolver,actor,ticketId,refs,'notes.write',proof,async(client,scope)=>{
     const store=createPostgresExecutionChecklistStore(client);await store.assertReady();
     const record=bound(await store.read(ticketId),actor,ticketId,scope),previous=await store.readReceipt(ticketId,key);
     if(previous!==null){const saved=object(previous,['key','hash','command','result']);
      if(saved.key!==key)throw checklistError();
      if(saved.hash!==hash||requestHash(saved.command)!==requestHash(command))throw checklistError('checklist_intent_conflict',409);
      const prior=receipt(saved.result,actor,record,command);
      if(prior.ticketVersion>record.context.ticketVersion||compareInstants(prior.at,record.readAt)>0
       ||prior.ticketVersion===record.context.ticketVersion&&prior.checklistRevision>(record.snapshot?.revision??0))throw checklistError();
      return freezeFormData({...prior,replayed:true});
     }
     requireChecklistOperator(actor,record.context,true,record.assignedTo);
     const evidence=await store.readEvidence(ticketId,command.evidenceRefs);
     // Validate before mutation. DB independently stamps the accepted operation.
     decideExecutionChecklistMark(actor,record,command,evidence,record.readAt);
     const applied=object(await store.mark(ticketId,command,hash,key,requestId),['receipt','record']);
     const r=receipt(applied.receipt,actor,record,command);
     if(compareInstants(r.at,record.readAt)<0)throw checklistError();
     const expected=decideExecutionChecklistMark(actor,record,command,evidence,r.at);
     const after=bound(applied.record,actor,ticketId,scope);
     if(requestHash(after.context)!==requestHash(record.context)||requestHash(after.template)!==requestHash(record.template)
      ||requestHash(after.snapshot)!==requestHash(expected.snapshot)||after.ticketStatus!==record.ticketStatus||after.assignedTo!==record.assignedTo)throw checklistError();
     return freezeFormData(r);
    },signal,admission);
   }catch(e){throw safe(e);}
  }
 });
}
