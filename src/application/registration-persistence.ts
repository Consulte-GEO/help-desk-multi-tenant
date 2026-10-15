import {registrationRecord,registrationUuid,registrationRevision,registrationHash,registrationFailure,copyRegistrationValue,type RegistrationJson} from '../domain/registration-canonical.ts';
import {createRegistrationState,decideRegistrationTransition} from '../domain/registration-automation.ts';
import {parseRegistrationInputSnapshot,type AgentAnalysis,type AgentAnalysisJob} from '../domain/registration-contracts.ts';
import {parseRegistrationScopeRequest,parseLockedRegistrationScope,parseLockedRegistration,parseStoredRegistration,parseRegistrationJobConfiguration,parseRegistrationPersistenceReceipt,HDA_ANALYSIS_MAX_ATTEMPTS,HDA_ANALYSIS_LEASE_SECONDS,type RegistrationScopeRequest,type LockedRegistrationScope,type StoredRegistration,type RegistrationQueueEntry,type RegistrationAnalysisLease,type RegistrationPersistenceReceipt} from '../domain/registration-persistence.ts';
import type {RegistrationJobTransaction,RegistrationPersistenceWrite} from './registration-job-store.ts';
const fields:Readonly<Record<string,readonly string[]>>=Object.freeze({
 prepare:['snapshot','jobId','configuration'],claim:['leaseSeconds'],complete:['operationId','expectedRevision','jobId','leaseId','fence','output'],fail:['operationId','expectedRevision','jobId','leaseId','fence','reason'],retry:['operationId','expectedRevision','jobId'],revise:['operationId','expectedRevision','snapshot','jobId'],cancel:['operationId','expectedRevision']
});
export type RegistrationCommandResult=Readonly<{outcome:'applied'|'replay'|'idle'|'exhausted';receipt:RegistrationPersistenceReceipt|null;lease:RegistrationAnalysisLease|null}>;
const fail=(code='registration_persistence_invalid',status=409):never=>{throw registrationFailure(code,status);};
/** Sender namespace is part of the domain event ID. Two actors can legitimately
 * generate the same external UUID; lastEvent must not confuse their commands. */
export function registrationCommandEventId(scope:RegistrationScopeRequest,commandId:string):string {
 const s=parseRegistrationScopeRequest(scope),h=registrationHash({workspaceId:s.workspaceId,actorId:s.actorId,commandId:registrationUuid(commandId)});
 const hex=h.slice(0,12)+'8'+h.slice(13,16)+(8+(parseInt(h[16]!,16)&3)).toString(16)+h.slice(17,32);
 return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function command(raw:unknown){
 const copied=copyRegistrationValue(raw);if(!copied||typeof copied!=='object'||Array.isArray(copied))return fail();
 const type=(copied as Record<string,RegistrationJson>).type;
 if(typeof type!=='string'||!Object.hasOwn(fields,type))return fail('registration_transition_unsupported',422);
 const c=registrationRecord(copied,['type','commandId',...fields[type]!]);registrationUuid(c.commandId);
 if(Object.hasOwn(c,'operationId'))registrationUuid(c.operationId);
 if(Object.hasOwn(c,'expectedRevision'))registrationRevision(c.expectedRevision);
 if(Object.hasOwn(c,'jobId'))registrationUuid(c.jobId);
 if(type==='claim'){const n=registrationRevision(c.leaseSeconds,HDA_ANALYSIS_LEASE_SECONDS.min);if(n>HDA_ANALYSIS_LEASE_SECONDS.max)return fail('registration_lease_invalid',400);}
 return c;
}
function matchReceipt(raw:unknown,scope:LockedRegistrationScope,c:Readonly<Record<string,RegistrationJson>>,hash:string){
 const r=parseRegistrationPersistenceReceipt(raw);
 for(const key of ['workspaceId','accountId','actorId','bindingId','permission'] as const)if(r[key]!==scope[key])return fail('registration_event_conflict');
 if(r.commandId!==c.commandId||r.commandHash!==hash)return fail('registration_event_conflict');
 if(Object.hasOwn(c,'operationId')&&r.operationId!==c.operationId)return fail('registration_event_conflict');
 if(c.type==='prepare'&&r.operationId!==parseRegistrationInputSnapshot(c.snapshot).operationId)return fail('registration_event_conflict');
 return r;
}
function matchSnapshot(s:ReturnType<typeof parseRegistrationInputSnapshot>,scope:LockedRegistrationScope){
 if(s.target.workspaceId!==scope.workspaceId||s.target.accountId!==scope.accountId||s.ticketId!==scope.ticketId||s.targetHash!==scope.targetHash)return fail('registration_scope_changed',403);
}
function queued(state:StoredRegistration['state'],jobId:string,configuration:RegistrationQueueEntry['configuration']):RegistrationQueueEntry {
 return Object.freeze({schema:1,jobId:registrationUuid(jobId),operationId:state.snapshot.operationId,inputRevision:state.snapshot.inputRevision,requestHash:state.snapshot.requestHash,kind:'analysis',configuration,status:'queued',attempts:0,lease:null});
}
/** No COMMIT, no new pool, no invocation of Claude. The outer owner must await
 * runTransaction BEFORE using an applied lease. A replay deliberately returns
 * metadata only: it is never permission to launch the same model call again.
 */
export async function executeRegistrationCommand(tx:RegistrationJobTransaction,request:RegistrationScopeRequest,raw:unknown):Promise<RegistrationCommandResult>{
 try{
  const c=command(raw),scopeRequest=parseRegistrationScopeRequest(request);if(c.type!==scopeRequest.permission)return fail('registration_scope_denied',403);
  const scope=parseLockedRegistrationScope(await tx.lockScope(scopeRequest),scopeRequest),hash=registrationHash({scope:scopeRequest,command:c});
  const prior=await tx.readReceipt(c.commandId as string);
  if(prior!==null)return Object.freeze({outcome:'replay',receipt:matchReceipt(prior,scope,c,hash),lease:null});
  let next:StoredRegistration,event:RegistrationJson|null=null,analysis:AgentAnalysis|null=null,expectedRevision=0,beforeStateHash:string|null=null,outcome:'applied'|'exhausted'='applied',now=scope.databaseNow;
  let leaseDeadline:string|null=null;
  if(c.type==='prepare'){
   const snapshot=parseRegistrationInputSnapshot(c.snapshot);matchSnapshot(snapshot,scope);
   if(snapshot.inputRevision!==1)return fail('registration_snapshot_mismatch');
   if(await tx.lockOperation(snapshot.operationId)!==null)return fail('registration_operation_exists');
   const state=createRegistrationState(snapshot);next=parseStoredRegistration({state,queue:queued(state,c.jobId as string,parseRegistrationJobConfiguration(c.configuration))});
  }else{
   const rawRecord=c.type==='claim'?await tx.lockNextOperation():await tx.lockOperation(c.operationId as string);
   if(rawRecord===null){if(c.type==='claim')return Object.freeze({outcome:'idle',receipt:null,lease:null});return fail('registration_operation_not_found',404);}
   const current=parseLockedRegistration(rawRecord,scope),state=current.state,q=current.queue;now=current.databaseNow;
   if(c.type!=='claim'&&state.snapshot.operationId!==c.operationId)return fail('registration_scope_changed',403);
   expectedRevision=state.revision;beforeStateHash=registrationHash(state);
   const base={eventId:registrationCommandEventId(scopeRequest,c.commandId as string),operationId:state.snapshot.operationId,expectedRevision:c.type==='claim'?state.revision:registrationRevision(c.expectedRevision)};
   let queue:RegistrationQueueEntry;
   if(c.type==='claim'){
    if(q.status!=='queued'&&!(q.status==='leased'&&q.lease&&q.lease.expiresAt<=now))return fail('registration_lease_busy');
    if(q.attempts>=HDA_ANALYSIS_MAX_ATTEMPTS){
     if(!state.job||!q.lease)return fail();
     event={...base,type:'analysis_failed',jobId:q.jobId,fence:state.analysisFence,reason:'timeout'};
     queue={...q,status:'failed',lease:null};outcome='exhausted';
    }else{
     if(state.analysisFence===Number.MAX_SAFE_INTEGER)return fail('registration_fence_exhausted');
     const fence=state.analysisFence+1,expiresAt=new Date(Math.min(Date.parse(now)+Number(c.leaseSeconds)*1000,Date.parse(scope.expiresAt))).toISOString();
     if(expiresAt<=now)return fail('registration_scope_expired');
     leaseDeadline=expiresAt;
     const job:AgentAnalysisJob={schema:1,jobId:q.jobId,operationId:state.snapshot.operationId,inputRevision:state.snapshot.inputRevision,requestHash:state.snapshot.requestHash,actionKey:state.snapshot.actionKey,actionSchemaHash:state.snapshot.actionSchemaHash,targetHash:state.snapshot.targetHash,fence,agentVersionRef:q.configuration.agentVersionRef,knowledgeRefs:q.configuration.knowledgeRefs};
     event={...base,type:'analysis_started',job};
     queue={...q,status:'leased',attempts:q.attempts+1,lease:{leaseId:c.commandId as string,workerId:scope.actorId,fence,issuedAt:now,expiresAt}};
    }
   }else if(c.type==='complete'||c.type==='fail'){
    const lease=q.lease;
    if(q.status!=='leased'||!lease||lease.workerId!==scope.actorId||lease.leaseId!==c.leaseId||q.jobId!==c.jobId||lease.fence!==c.fence||lease.expiresAt<=now)return fail('registration_stale_analysis');
    leaseDeadline=lease.expiresAt;
    event=c.type==='complete'?{...base,type:'analysis_completed',jobId:q.jobId,fence:lease.fence,output:c.output!,policyVersion:q.configuration.policyVersion}:{...base,type:'analysis_failed',jobId:q.jobId,fence:lease.fence,reason:c.reason!};
    queue={...q,status:c.type==='complete'?'completed':'failed',lease:null};
   }else if(c.type==='revise'||c.type==='retry'){
    if(c.jobId===q.jobId)return fail('registration_job_conflict');
    if(c.type==='revise'){const snapshot=parseRegistrationInputSnapshot(c.snapshot);matchSnapshot(snapshot,scope);event={...base,type:'input_revised',snapshot};}
    else event={...base,type:'retry_analysis'};
    const decision=decideRegistrationTransition(state,event);next=parseStoredRegistration({state:decision.state,queue:queued(decision.state,c.jobId as string,q.configuration)});
    return await persist(next,event,null);
   }else{event={...base,type:'cancel_analysis'};queue={...q,status:'cancelled',lease:null};}
   const decision=decideRegistrationTransition(state,event);analysis=decision.analysis;next=parseStoredRegistration({state:decision.state,queue});
  }
  return await persist(next,event,analysis);
  async function persist(stored:StoredRegistration,ev:RegistrationJson|null,an:AgentAnalysis|null):Promise<RegistrationCommandResult>{
   const write:RegistrationPersistenceWrite={schema:1,command:c,commandHash:hash,expectedRevision,beforeStateHash,event:ev,next:stored,analysis:an};
   // Enforce a total envelope budget before passing data to a driver.
   copyRegistrationValue(write);
   const receipt=matchReceipt(await tx.apply(write),scope,c,hash);
   if(receipt.operationId!==stored.state.snapshot.operationId||receipt.operationRevision!==stored.state.revision||receipt.stateHash!==registrationHash(stored.state)||receipt.jobId!==stored.queue.jobId||receipt.fence!==stored.state.analysisFence||receipt.status!==stored.state.status||receipt.recordedAt<now||receipt.recordedAt>=scope.expiresAt||(leaseDeadline!==null&&receipt.recordedAt>=leaseDeadline))return fail('registration_ack_invalid',503);
   return Object.freeze({outcome,receipt,lease:c.type==='claim'&&outcome==='applied'?stored.queue.lease:null});
  }
 }catch(error){return tx.reject(error);}
}
