import test from 'node:test';import assert from 'node:assert/strict';
import {createRegistrationState,parseRegistrationState,decideRegistrationTransition} from '../src/domain/registration-automation.ts';
import {createRegistrationInputSnapshot} from '../src/domain/registration-contracts.ts';
import {createAgentAnalysisJob} from '../src/connectors/dev-agent/contract.ts';
import {id,input,output} from './fixtures/registration/sample.ts';
const initial=()=>createRegistrationState(createRegistrationInputSnapshot(input()));
const event=(s:any,type:string,body:any={})=>({eventId:id(100+s.revision),operationId:s.snapshot.operationId,expectedRevision:s.revision,type,...body});
function started(){const s=initial();const job=createAgentAnalysisJob(s.snapshot,{jobId:id(20),fence:1,agentVersionRef:'synthetic-agent-v1',knowledgeRefs:[]});const e=event(s,'analysis_started',{job});return {decision:decideRegistrationTransition(s,e),event:e};}
function prepared(){const s=started().decision.state;const e=event(s,'analysis_completed',{jobId:s.job!.jobId,fence:s.analysisFence,output:output(s.job),policyVersion:'policy-v1'});return {decision:decideRegistrationTransition(s,e),event:e};}
const error=(code:string)=>(e:any)=>e.name==='HelpdeskError'&&e.code===code;
test('state starts with a candidate analysis only, without side effects',()=>{
 const s=initial();assert.equal(s.status,'queued_analysis');assert.equal(s.revision,1);assert.equal(s.draft,null);assert.equal(s.job,null);assert.ok(Object.isFrozen(s.snapshot.target));assert.deepEqual(parseRegistrationState(s),s);
});
test('analysis result builds draft but never approves, writes or closes ticket',()=>{
 const result=prepared().decision;assert.equal(result.state.status,'draft_ready');assert.equal(result.state.draftRevision,1);assert.equal(result.analysis?.executionAllowed,false);
 assert.equal(result.ticketMutation,'none');assert.equal(result.originMutation,'none');assert.equal(result.state.draft?.executionAllowed,false);
});
for(const d of ['needs_information','manual_review','unsupported'])test('analysis disposition '+d+' keeps operation out of execution',()=>{
 const s=started().decision.state;const r=decideRegistrationTransition(s,event(s,'analysis_completed',{jobId:s.job!.jobId,fence:1,output:output(s.job,d),policyVersion:'policy-v1'}));
 assert.equal(r.state.status,d==='unsupported'?'manual_review':d);assert.equal(r.state.draft,null);assert.equal(r.originMutation,'none');
});
test('F03 immediate last event replay is a no-op; divergent same ID conflicts',()=>{
 const {decision,event:e}=prepared();const replay=decideRegistrationTransition(decision.state,e);assert.equal(replay.outcome,'replay');assert.deepEqual(replay.state,decision.state);assert.equal(replay.analysis,null);
 assert.throws(()=>decideRegistrationTransition(decision.state,{...e,policyVersion:'other'}),error('registration_event_conflict'));
});
test('old events after a newer event need durable inbox; stale CAS does not mutate',()=>{
 const start=started(),s=start.decision.state;const r=decideRegistrationTransition(s,event(s,'analysis_failed',{jobId:s.job!.jobId,fence:1,reason:'timeout'}));
 assert.throws(()=>decideRegistrationTransition(r.state,start.event),error('registration_revision_conflict'));
});
test('J05 newer fence prevents late worker result replacing proposal',()=>{
 const s=started().decision.state;const newJob=createAgentAnalysisJob(s.snapshot,{jobId:id(21),fence:2,agentVersionRef:'synthetic-agent-v1',knowledgeRefs:[]});
 const current=decideRegistrationTransition(s,event(s,'analysis_started',{job:newJob})).state;
 assert.throws(()=>decideRegistrationTransition(current,event(current,'analysis_completed',{jobId:s.job!.jobId,fence:1,output:output(s.job),policyVersion:'policy-v1'})),error('registration_stale_analysis'));
 const done=decideRegistrationTransition(current,event(current,'analysis_completed',{jobId:newJob.jobId,fence:2,output:output(newJob),policyVersion:'policy-v1'}));assert.equal(done.state.status,'draft_ready');
});
test('J05 equal or lower fence and wrong snapshot job are refused',()=>{
 const s=started().decision.state;assert.throws(()=>decideRegistrationTransition(s,event(s,'analysis_started',{job:s.job})),error('registration_stale_analysis'));
 const old={...s.job,fence:2,requestHash:'0'.repeat(64)};assert.throws(()=>decideRegistrationTransition(s,event(s,'analysis_started',{job:old})),error('registration_analysis_mismatch'));
});
test('failed analysis can retry without changing snapshot or operation identity',()=>{
 const s=started().decision.state;const failed=decideRegistrationTransition(s,event(s,'analysis_failed',{jobId:s.job!.jobId,fence:1,reason:'runner_failed'})).state;
 const queued=decideRegistrationTransition(failed,event(failed,'retry_analysis')).state;assert.equal(queued.status,'queued_analysis');assert.equal(queued.snapshot.requestHash,s.snapshot.requestHash);assert.equal(queued.analysisFence,1);
});
test('input revision invalidates proposal but preserves monotonic draft revision',()=>{
 const s=prepared().decision.state;const snap=createRegistrationInputSnapshot({...input(),inputRevision:2,answers:{requestConfirmation:true,note:'Informação corrigida.'}});
 const revised=decideRegistrationTransition(s,event(s,'input_revised',{snapshot:snap})).state;
 assert.equal(revised.status,'queued_analysis');assert.equal(revised.draft,null);assert.equal(revised.draftRevision,1);assert.equal(revised.job,null);
 const j=createAgentAnalysisJob(snap,{jobId:id(22),fence:2,agentVersionRef:'synthetic-agent-v1',knowledgeRefs:[]});const working=decideRegistrationTransition(revised,event(revised,'analysis_started',{job:j})).state;
 const done=decideRegistrationTransition(working,event(working,'analysis_completed',{jobId:j.jobId,fence:2,output:output(j),policyVersion:'policy-v1'}));assert.equal(done.state.draftRevision,2);
});
test('S01 input revision cannot change operation, ticket or tenant boundary',()=>{
 const s=prepared().decision.state;for(const changes of [{operationId:id(90)},{ticketId:id(91)},{target:{...s.snapshot.target,sourceTenantKey:'tenant-B'}},{target:{...s.snapshot.target,accountId:id(99)}},{inputRevision:5}]){
  const snap=createRegistrationInputSnapshot({...input(),inputRevision:2,...changes});assert.throws(()=>decideRegistrationTransition(s,event(s,'input_revised',{snapshot:snap})));
 }
});
test('R02/F01 approval from support, model completion and verified flags cannot execute',()=>{
 const s=prepared().decision.state;for(const type of ['execution_approved','execute','committed','origin_observed','support.approval','registration.completed.v1'])assert.throws(()=>decideRegistrationTransition(s,event(s,type,{verified:true,actorKind:'human',approved:true})),error('registration_transition_unsupported'));
 assert.equal(s.status,'draft_ready');assert.equal(s.draft?.executionAllowed,false);
});
test('irrelevant ticket comment is not a registration revision',()=>{
 const s=prepared().decision.state;assert.throws(()=>decideRegistrationTransition(s,event(s,'ticket_comment',{text:'Olá'})),error('registration_transition_unsupported'));assert.equal(s.draftRevision,1);
});
test('cancelled analysis stays cancelled and late result cannot resurrect it',()=>{
 const s=started().decision.state;const cancelled=decideRegistrationTransition(s,event(s,'cancel_analysis')).state;assert.equal(cancelled.status,'cancelled');
 assert.throws(()=>decideRegistrationTransition(cancelled,event(cancelled,'analysis_completed',{jobId:s.job!.jobId,fence:1,output:output(s.job),policyVersion:'policy-v1'})));
 assert.throws(()=>decideRegistrationTransition(cancelled,event(cancelled,'input_revised',{snapshot:createRegistrationInputSnapshot({...input(),inputRevision:2})})));
});
test('state parser rejects forged terminal state, malformed revisions and mixed drafts',()=>{
 const s=prepared().decision.state;for(const changes of [{status:'committed'},{revision:0},{job:null},{draftRevision:2},{draft:null},{analysisFence:0},{lastEvent:null}])assert.throws(()=>parseRegistrationState({...s,...changes}));
});
test('event parser refuses unknown fields, unsafe revision overflow and corrupt last-event record',()=>{
 const s=started().decision.state;assert.throws(()=>decideRegistrationTransition(s,event(s,'cancel_analysis',{secret:'private-secret'})));
 const overflow={...s,revision:Number.MAX_SAFE_INTEGER,lastEvent:{...s.lastEvent!,revision:Number.MAX_SAFE_INTEGER}};assert.throws(()=>decideRegistrationTransition(overflow,event(overflow,'cancel_analysis')));
 assert.throws(()=>parseRegistrationState({...s,lastEvent:{eventId:id(101),hash:'bad',revision:s.revision}}));
});
test('first state cannot pretend that a claim or a draft already happened',()=>{
 for(const s of [started().decision.state,prepared().decision.state])assert.throws(()=>parseRegistrationState({...s,revision:1,lastEvent:null}));
});
test('non-proposal analysis also requires a valid pinned policy reference',()=>{
 const s=started().decision.state;assert.throws(()=>decideRegistrationTransition(s,event(s,'analysis_completed',{jobId:s.job!.jobId,fence:1,output:output(s.job,'manual_review'),policyVersion:null})));
});
