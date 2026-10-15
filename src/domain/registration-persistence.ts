import {registrationRecord,registrationUuid,registrationRevision,registrationDigest,registrationRef,registrationInstant,registrationFailure,copyRegistrationValue} from './registration-canonical.ts';
import {parseRegistrationState,type RegistrationState,type RegistrationAnalysisStatus} from './registration-automation.ts';
import type {KnowledgeRef} from './registration-contracts.ts';

export const HDA_ANALYSIS_MAX_ATTEMPTS=3;
export const HDA_ANALYSIS_LEASE_SECONDS=Object.freeze({min:15,max:300,default:60});
export const HDA_ANALYSIS_PERMISSIONS=Object.freeze(['read','prepare','claim','complete','fail','retry','revise','cancel'] as const);
export type RegistrationPermission=typeof HDA_ANALYSIS_PERMISSIONS[number];
export type RegistrationScopeRequest=Readonly<{workspaceId:string;accountId:string;actorId:string;bindingId:string;permission:RegistrationPermission}>;
/** A parsed SQL observation, NOT an authorization obtainable from HTTP JSON. */
export type LockedRegistrationScope=RegistrationScopeRequest & Readonly<{actorKind:'human'|'analyzer';bindingRevision:number;targetHash:string;ticketId:string;databaseNow:string;expiresAt:string}>;
export type RegistrationJobConfiguration=Readonly<{agentVersionRef:string;knowledgeRefs:readonly KnowledgeRef[];policyVersion:string}>;
export type RegistrationAnalysisLease=Readonly<{leaseId:string;workerId:string;fence:number;issuedAt:string;expiresAt:string}>;
export type RegistrationQueueEntry=Readonly<{schema:1;jobId:string;operationId:string;inputRevision:number;requestHash:string;kind:'analysis';configuration:RegistrationJobConfiguration;status:'queued'|'leased'|'completed'|'failed'|'cancelled';attempts:number;lease:RegistrationAnalysisLease|null}>;
export type StoredRegistration=Readonly<{state:RegistrationState;queue:RegistrationQueueEntry}>;
export type LockedRegistration=StoredRegistration & Readonly<{databaseNow:string}>;
export type RegistrationPersistenceReceipt=Readonly<{schema:1;commandId:string;commandHash:string;permission:Exclude<RegistrationPermission,'read'>;workspaceId:string;accountId:string;actorId:string;bindingId:string;operationId:string;operationRevision:number;stateHash:string;jobId:string;fence:number;status:RegistrationAnalysisStatus;recordedAt:string}>;
const fail=(code='registration_persistence_invalid',status=409):never=>{throw registrationFailure(code,status);};
const scopeFields=['workspaceId','accountId','actorId','bindingId','permission'] as const;
export function parseRegistrationScopeRequest(raw:unknown):RegistrationScopeRequest {
 const r=registrationRecord(raw,scopeFields);
 if(!HDA_ANALYSIS_PERMISSIONS.includes(r.permission as RegistrationPermission))return fail();
 return Object.freeze({workspaceId:registrationUuid(r.workspaceId),accountId:registrationUuid(r.accountId),actorId:registrationUuid(r.actorId),bindingId:registrationUuid(r.bindingId),permission:r.permission as RegistrationPermission});
}
export function parseLockedRegistrationScope(raw:unknown,request:RegistrationScopeRequest):LockedRegistrationScope {
 const expected=parseRegistrationScopeRequest(request),r=registrationRecord(raw,[...scopeFields,'actorKind','bindingRevision','targetHash','ticketId','databaseNow','expiresAt']);
 for(const field of scopeFields)if(r[field]!==expected[field])return fail('registration_scope_changed',403);
 const actorKind=r.actorKind;if(actorKind!=='human'&&actorKind!=='analyzer')return fail();
 const allowed=actorKind==='human'?['read','prepare','retry','revise','cancel']:['read','claim','complete','fail'];
 if(!allowed.includes(expected.permission))return fail('registration_scope_denied',403);
 const databaseNow=registrationInstant(r.databaseNow),expiresAt=registrationInstant(r.expiresAt);
 if(expiresAt<=databaseNow)return fail('registration_scope_expired',409);
 return Object.freeze({...expected,actorKind,bindingRevision:registrationRevision(r.bindingRevision),targetHash:registrationDigest(r.targetHash),ticketId:registrationUuid(r.ticketId),databaseNow,expiresAt});
}
export function parseRegistrationJobConfiguration(raw:unknown):RegistrationJobConfiguration {
 const r=registrationRecord(raw,['agentVersionRef','knowledgeRefs','policyVersion']);
 if(!Array.isArray(r.knowledgeRefs)||r.knowledgeRefs.length>20)return fail();
 const seen=new Set<string>();const knowledgeRefs=r.knowledgeRefs.map(row=>{const k=registrationRecord(row,['id','hash']),id=registrationRef(k.id);if(seen.has(id))return fail();seen.add(id);return Object.freeze({id,hash:registrationDigest(k.hash)});});
 return Object.freeze({agentVersionRef:registrationRef(r.agentVersionRef),knowledgeRefs:Object.freeze(knowledgeRefs),policyVersion:registrationRef(r.policyVersion)});
}
export function parseRegistrationAnalysisLease(raw:unknown):RegistrationAnalysisLease {
 const r=registrationRecord(raw,['leaseId','workerId','fence','issuedAt','expiresAt']);
 const issuedAt=registrationInstant(r.issuedAt),expiresAt=registrationInstant(r.expiresAt),duration=Date.parse(expiresAt)-Date.parse(issuedAt);
 if(duration<1||duration>HDA_ANALYSIS_LEASE_SECONDS.max*1000)return fail('registration_lease_invalid');
 return Object.freeze({leaseId:registrationUuid(r.leaseId),workerId:registrationUuid(r.workerId),fence:registrationRevision(r.fence),issuedAt,expiresAt});
}
export function parseRegistrationQueueEntry(raw:unknown,stateInput:RegistrationState):RegistrationQueueEntry {
 const state=parseRegistrationState(stateInput),r=registrationRecord(raw,['schema','jobId','operationId','inputRevision','requestHash','kind','configuration','status','attempts','lease']);
 const jobId=registrationUuid(r.jobId),operationId=registrationUuid(r.operationId),inputRevision=registrationRevision(r.inputRevision),requestHash=registrationDigest(r.requestHash),attempts=registrationRevision(r.attempts,0);
 if(r.schema!==1||r.kind!=='analysis'||operationId!==state.snapshot.operationId||inputRevision!==state.snapshot.inputRevision||requestHash!==state.snapshot.requestHash||attempts>HDA_ANALYSIS_MAX_ATTEMPTS)return fail();
 const statuses:Record<RegistrationAnalysisStatus,string>={queued_analysis:'queued',analyzing:'leased',draft_ready:'completed',needs_information:'completed',manual_review:'completed',analysis_failed:'failed',cancelled:'cancelled'};
 if(r.status!==statuses[state.status])return fail();
 const configuration=parseRegistrationJobConfiguration(r.configuration),lease=r.lease===null?null:parseRegistrationAnalysisLease(r.lease);
 if(state.status==='analyzing'){
  if(!lease||attempts<1||!state.job||state.job.jobId!==jobId||state.job.fence!==lease.fence||state.analysisFence!==lease.fence)return fail();
 }else if(lease!==null)return fail();
 if(state.status==='queued_analysis'&&attempts!==0)return fail();
 if(!['queued_analysis','cancelled'].includes(state.status)&&attempts<1)return fail();
 if(state.job&&(state.job.jobId!==jobId||state.job.agentVersionRef!==configuration.agentVersionRef||JSON.stringify(state.job.knowledgeRefs)!==JSON.stringify(configuration.knowledgeRefs)))return fail();
 return Object.freeze({schema:1,jobId,operationId,inputRevision,requestHash,kind:'analysis',configuration,status:r.status as RegistrationQueueEntry['status'],attempts,lease});
}
export function parseStoredRegistration(raw:unknown):StoredRegistration {
 const r=registrationRecord(raw,['state','queue']),state=parseRegistrationState(r.state),queue=parseRegistrationQueueEntry(r.queue,state);
 return Object.freeze({state,queue});
}
export function parseLockedRegistration(raw:unknown,scope:LockedRegistrationScope):LockedRegistration {
 const r=registrationRecord(raw,['state','queue','databaseNow']),stored=parseStoredRegistration({state:r.state,queue:r.queue}),databaseNow=registrationInstant(r.databaseNow),s=stored.state.snapshot;
 if(s.target.workspaceId!==scope.workspaceId||s.target.accountId!==scope.accountId||s.ticketId!==scope.ticketId||s.targetHash!==scope.targetHash)return fail('registration_scope_changed',403);
 if(databaseNow<scope.databaseNow||databaseNow>=scope.expiresAt)return fail('registration_scope_expired',409);
 return Object.freeze({...stored,databaseNow});
}
export function parseRegistrationPersistenceReceipt(raw:unknown):RegistrationPersistenceReceipt {
 const r=registrationRecord(raw,['schema','commandId','commandHash','permission','workspaceId','accountId','actorId','bindingId','operationId','operationRevision','stateHash','jobId','fence','status','recordedAt']);
 if(r.schema!==1||r.permission==='read'||!HDA_ANALYSIS_PERMISSIONS.includes(r.permission as RegistrationPermission)||!['queued_analysis','analyzing','draft_ready','needs_information','manual_review','analysis_failed','cancelled'].includes(r.status as string))return fail();
 return Object.freeze({schema:1,commandId:registrationUuid(r.commandId),commandHash:registrationDigest(r.commandHash),permission:r.permission as RegistrationPersistenceReceipt['permission'],workspaceId:registrationUuid(r.workspaceId),accountId:registrationUuid(r.accountId),actorId:registrationUuid(r.actorId),bindingId:registrationUuid(r.bindingId),operationId:registrationUuid(r.operationId),operationRevision:registrationRevision(r.operationRevision),stateHash:registrationDigest(r.stateHash),jobId:registrationUuid(r.jobId),fence:registrationRevision(r.fence,0),status:r.status as RegistrationAnalysisStatus,recordedAt:registrationInstant(r.recordedAt)});
}
