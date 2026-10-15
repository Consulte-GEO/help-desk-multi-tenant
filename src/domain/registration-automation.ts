import {copyRegistrationValue,registrationRecord,registrationUuid,registrationRef,registrationRevision,registrationDigest,registrationHash,registrationFailure} from './registration-canonical.ts';
import {getRegistrationAction} from './registration-action-catalog.ts';
import {parseRegistrationInputSnapshot,parseRegistrationDraft,createRegistrationDraft,type RegistrationInputSnapshot,type RegistrationDraft,type AgentAnalysisJob,type AgentAnalysis} from './registration-contracts.ts';
import {parseAgentAnalysisJob,parseAgentAnalysis} from './registration-analysis.ts';

export type RegistrationAnalysisStatus = 'queued_analysis'|'analyzing'|'draft_ready'|'needs_information'|'manual_review'|'analysis_failed'|'cancelled';
export type RegistrationState = Readonly<{
  schema:1;snapshot:RegistrationInputSnapshot;revision:number;status:RegistrationAnalysisStatus;analysisFence:number;
  job:AgentAnalysisJob|null;draft:RegistrationDraft|null;draftRevision:number;
  lastEvent:Readonly<{eventId:string;hash:string;revision:number}>|null;
}>;
export type RegistrationDecision = Readonly<{state:RegistrationState;outcome:'applied'|'replay';analysis:AgentAnalysis|null;ticketMutation:'none';originMutation:'none'}>;
const statuses:readonly string[]=['queued_analysis','analyzing','draft_ready','needs_information','manual_review','analysis_failed','cancelled'];
const fail=(code='registration_state_invalid',status=409):never=>{throw registrationFailure(code,status);};
function jobMatches(job:AgentAnalysisJob,snapshot:RegistrationInputSnapshot):boolean {
  return job.operationId===snapshot.operationId&&job.inputRevision===snapshot.inputRevision&&job.requestHash===snapshot.requestHash&&job.actionKey===snapshot.actionKey&&job.actionSchemaHash===snapshot.actionSchemaHash&&job.targetHash===snapshot.targetHash;
}
export function createRegistrationState(snapshot:RegistrationInputSnapshot):RegistrationState {
  return Object.freeze({schema:1,snapshot:parseRegistrationInputSnapshot(snapshot),revision:1,status:'queued_analysis',analysisFence:0,job:null,draft:null,draftRevision:0,lastEvent:null});
}
export function parseRegistrationState(raw:unknown):RegistrationState {
  const x=registrationRecord(raw,['schema','snapshot','revision','status','analysisFence','job','draft','draftRevision','lastEvent']);
  if(x.schema!==1||!statuses.includes(x.status as string))return fail();
  const snapshot=parseRegistrationInputSnapshot(x.snapshot),revision=registrationRevision(x.revision),analysisFence=registrationRevision(x.analysisFence,0),draftRevision=registrationRevision(x.draftRevision,0),status=x.status as RegistrationAnalysisStatus;
  const job=x.job===null?null:parseAgentAnalysisJob(x.job),draft=x.draft===null?null:parseRegistrationDraft(x.draft);
  let lastEvent:RegistrationState['lastEvent']=null;
  if(x.lastEvent!==null){const l=registrationRecord(x.lastEvent,['eventId','hash','revision']);lastEvent=Object.freeze({eventId:registrationUuid(l.eventId),hash:registrationDigest(l.hash),revision:registrationRevision(l.revision)});}
  if(lastEvent===null?(revision!==1||status!=='queued_analysis'||analysisFence!==0||draftRevision!==0||job!==null||draft!==null):(lastEvent.revision!==revision||revision===1))return fail();
  if(job&&(!jobMatches(job,snapshot)||job.fence!==analysisFence))return fail();
  if(status==='queued_analysis'&&(job!==null||draft!==null))return fail();
  if(!['queued_analysis','cancelled'].includes(status)&&!job)return fail();
  if(status==='draft_ready'){
    if(!draft||!job||draft.operationId!==snapshot.operationId||draft.inputRevision!==snapshot.inputRevision||draft.requestHash!==snapshot.requestHash||draft.targetHash!==snapshot.targetHash||draft.actionKey!==snapshot.actionKey||draft.actionSchemaHash!==snapshot.actionSchemaHash||draft.draftRevision!==draftRevision||draft.analysisJobId!==job.jobId||draft.agentVersionRef!==job.agentVersionRef)return fail();
  }else if(draft!==null)return fail();
  return Object.freeze({schema:1,snapshot,revision,status,analysisFence,job,draft,draftRevision,lastEvent});
}
const eventFields:Readonly<Record<string,readonly string[]>>=Object.freeze({
  analysis_started:['job'],analysis_completed:['jobId','fence','output','policyVersion'],analysis_failed:['jobId','fence','reason'],
  retry_analysis:[],input_revised:['snapshot'],cancel_analysis:[]
});
/** PURE analysis lifecycle only. It is not an HTTP handler, authorization check,
 * database, queue or a worker lease issuer. The later application layer must hold
 * scoped transactions and verify real claims/grants. The last-event check is NOT
 * a durable inbox: older replays require HDA-02's persistent receipts.
 *
 * Execution-related events deliberately have no transition in this increment.
 */
export function decideRegistrationTransition(rawState:RegistrationState,rawEvent:unknown):RegistrationDecision {
  const state=parseRegistrationState(rawState),json=copyRegistrationValue(rawEvent);
  if(!json||typeof json!=='object'||Array.isArray(json))throw registrationFailure();
  const type=(json as Record<string,unknown>).type;
  if(typeof type!=='string'||!Object.hasOwn(eventFields,type))return fail('registration_transition_unsupported',422);
  const e=registrationRecord(json,['eventId','operationId','expectedRevision','type',...eventFields[type]!]);
  const eventId=registrationUuid(e.eventId),operationId=registrationUuid(e.operationId),expected=registrationRevision(e.expectedRevision),hash=registrationHash(e);
  if(operationId!==state.snapshot.operationId)return fail('registration_operation_mismatch',403);
  if(state.lastEvent?.eventId===eventId){
    if(state.lastEvent.hash!==hash)return fail('registration_event_conflict');
    return Object.freeze({state,outcome:'replay',analysis:null,ticketMutation:'none',originMutation:'none'});
  }
  if(expected!==state.revision)return fail('registration_revision_conflict',412);
  if(state.revision===Number.MAX_SAFE_INTEGER||state.status==='cancelled')return fail('registration_transition_forbidden');
  const next={...state,revision:state.revision+1};let analysis:AgentAnalysis|null=null;
  const requireStatus=(allowed:readonly string[])=>{if(!allowed.includes(state.status))fail('registration_transition_forbidden');};
  const requireClaim=()=>{requireStatus(['analyzing']);if(!state.job||e.jobId!==state.job.jobId||e.fence!==state.analysisFence)fail('registration_stale_analysis');};
  if(type==='analysis_started'){
    requireStatus(['queued_analysis','analyzing']);const job=parseAgentAnalysisJob(e.job);
    if(!jobMatches(job,state.snapshot))return fail('registration_analysis_mismatch');
    if(job.fence<=state.analysisFence)return fail('registration_stale_analysis');
    next.job=job;next.analysisFence=job.fence;next.status='analyzing';next.draft=null;
  }else if(type==='analysis_completed'){
    requireClaim();const policyVersion=registrationRef(e.policyVersion);analysis=parseAgentAnalysis(e.output,state.job!,getRegistrationAction(state.snapshot.actionKey));
    if(analysis.disposition==='proposal'){
      if(state.draftRevision===Number.MAX_SAFE_INTEGER)return fail();
      next.draftRevision=state.draftRevision+1;next.draft=createRegistrationDraft(state.snapshot,analysis,next.draftRevision,policyVersion);next.status='draft_ready';
    }else {next.draft=null;next.status=analysis.disposition==='needs_information'?'needs_information':'manual_review';}
  }else if(type==='analysis_failed'){
    requireClaim();if(!['offline','timeout','invalid_output','runner_failed'].includes(e.reason as string))throw registrationFailure();next.status='analysis_failed';next.draft=null;
  }else if(type==='retry_analysis'){
    requireStatus(['analysis_failed']);next.status='queued_analysis';next.job=null;next.draft=null;
  }else if(type==='input_revised'){
    const snapshot=parseRegistrationInputSnapshot(e.snapshot),old=state.snapshot;
    if(old.inputRevision===Number.MAX_SAFE_INTEGER||snapshot.inputRevision!==old.inputRevision+1||snapshot.operationId!==old.operationId||snapshot.ticketId!==old.ticketId||snapshot.actionKey!==old.actionKey)return fail('registration_snapshot_mismatch');
    // Work/beneficiary corrections still need live ACL in HDA-03/06; a new tenant is never a revision.
    for(const key of ['workspaceId','accountId','sourceConnectionId','sourceInstanceId','sourceTenantKey','sourceContractCode'] as const)if(snapshot.target[key]!==old.target[key])return fail('registration_scope_changed',403);
    next.snapshot=snapshot;next.job=null;next.draft=null;next.status='queued_analysis';
  }else if(type==='cancel_analysis'){
    next.status='cancelled';next.draft=null;
  }
  next.lastEvent=Object.freeze({eventId,hash,revision:next.revision});
  return Object.freeze({state:parseRegistrationState(next),outcome:'applied',analysis,ticketMutation:'none',originMutation:'none'});
}
