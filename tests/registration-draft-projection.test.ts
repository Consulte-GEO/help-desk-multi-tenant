import test from 'node:test';import assert from 'node:assert/strict';
import {id,input,output} from './fixtures/registration/sample.ts';
import {createRegistrationInputSnapshot} from '../src/domain/registration-contracts.ts';
import {createRegistrationState,decideRegistrationTransition} from '../src/domain/registration-automation.ts';
import {createAgentAnalysisJob} from '../src/domain/registration-analysis.ts';
const path='../src/application/registration-drafts.ts',m:any=await import(path).catch(()=>({}));
const viewPath='../shared/registration-review.js',v:any=await import(viewPath).catch(()=>({}));
export function reviewFixture(disposition='proposal',answers:Record<string,any>={requestConfirmation:true,note:'Vincular sem alterar perfil.',zero:0,no:false,empty:null}) {
 const snapshot=createRegistrationInputSnapshot({...input(),answers}),job=createAgentAnalysisJob(snapshot,{jobId:id(40),fence:1,agentVersionRef:'agent.v1',knowledgeRefs:[]});
 let state=createRegistrationState(snapshot);
 if(disposition==='queued')return state;
 state=decideRegistrationTransition(state,{type:'analysis_started',eventId:id(70),operationId:id(10),expectedRevision:1,job}).state;
 if(disposition==='analyzing')return state;
 if(disposition==='failed')return decideRegistrationTransition(state,{type:'analysis_failed',eventId:id(71),operationId:id(10),expectedRevision:2,jobId:job.jobId,fence:1,reason:'offline'}).state;
 if(disposition==='cancelled')return decideRegistrationTransition(state,{type:'cancel_analysis',eventId:id(71),operationId:id(10),expectedRevision:2}).state;
 return decideRegistrationTransition(state,{type:'analysis_completed',eventId:id(71),operationId:id(10),expectedRevision:2,jobId:job.jobId,fence:1,policyVersion:'policy.v1',output:output(job,disposition)}).state;
}
const context={workspaceId:id(1),accountId:id(2),ticketId:id(11),operationId:id(10)};
const meta=(audience='internal')=>({audience,context,observedAt:'2026-10-14T12:00:00.000Z',expiresAt:'2026-10-14T12:01:00.000Z'});
function project(state=reviewFixture(),audience='internal') {assert.equal(typeof m.projectRegistrationDraftReview,'function','read-only review projection required');return m.projectRegistrationDraftReview(state,meta(audience));}
test('internal projection contains requested data, exact opaque references and no execution authority',()=>{
 const state=reviewFixture(),before=JSON.stringify(state),r=project(state);
 assert.equal(JSON.stringify(state),before);assert.equal(r.detail.targets.find((x:any)=>x.key==='sourceWorkKey').value,'0007');
 assert.equal(r.detail.targets.find((x:any)=>x.key==='sourceBeneficiaryKey').value,'0009');
 assert.equal(r.detail.proposal[0].value,'Adicionar vínculo com uma obra');assert.deepEqual(r.capabilities,{edit:false,approve:false,execute:false});
 assert.ok(!JSON.stringify(r).includes('sourceConnectionId'));assert.ok(Object.isFrozen(r));assert.ok(Object.isFrozen(r.detail.requested));
});
for(const [key,value] of [['zero','0'],['no','Não'],['empty','Não informado']] as const)test('preserves '+key+' without truthiness loss',()=>assert.equal(project().detail.requested.find((x:any)=>x.key===key).value,value));
for(const disposition of ['queued','analyzing','proposal','needs_information','manual_review','unsupported','failed','cancelled'])test('projects '+disposition+' for both audiences without inventing completion',()=>{
 for(const audience of ['internal','customer']) {const r=project(reviewFixture(disposition),audience);assert.equal(r.audience,audience);assert.equal(r.capabilities.execute,false);assert.notEqual(r.status,'completed');if(audience==='customer')assert.equal(r.detail,null);}
});
test('customer projection omits private answers, draft, target and provider metadata',()=>{
 const r=project(reviewFixture('proposal',{note:'PRIVATE_CUSTOMER_SENTINEL',email:'internal@example.invalid'}),'customer'),text=JSON.stringify(r);
 for(const secret of ['PRIVATE_CUSTOMER_SENTINEL','internal@example.invalid','draftHash','0009','policy.v1','agent.v1','knowledgeRefs'])assert.ok(!text.includes(secret),secret);
});
for(const field of ['workspaceId','accountId','ticketId','operationId'])test('refuses mismatched authorized context '+field,()=>{
 assert.equal(typeof m.projectRegistrationDraftReview,'function');assert.throws(()=>m.projectRegistrationDraftReview(reviewFixture(),{...meta(),context:{...context,[field]:id(99)}}));
});
test('does not label corrupt persisted draft as ready',()=>{const s=structuredClone(reviewFixture()) as any;s.draft.payload.preserveExistingLinks=false;assert.throws(()=>project(s));});
test('large values explicitly indicate truncation instead of silently showing a complete proposal',()=>{const r=project(reviewFixture('proposal',{note:'x'.repeat(2000)}));assert.equal(r.detail.requested[0].truncated,true);assert.equal(r.detail.requested[0].value.length,1024);});
test('refuses invalid clocks and an observation window longer than sixty seconds',()=>{
 assert.equal(typeof m.projectRegistrationDraftReview,'function');for(const expiresAt of ['invalid','2026-10-14T12:00:00.000Z','2026-10-14T12:01:00.001Z'])assert.throws(()=>m.projectRegistrationDraftReview(reviewFixture(),{...meta(),expiresAt}));
});
test('missing information never invents missing fields or exposes raw worker warnings',()=>{const r=project(reviewFixture('needs_information'));assert.ok(r.detail.blockers.some((s:string)=>s.includes('ainda não está disponível')));assert.equal(r.detail.proposal.length,0);});
test('historical revisions are not invented from the latest state',()=>{const r=project();assert.equal(r.detail.historyLoaded,false);assert.equal(r.detail.draftRevision,1);});
test('browser wire contract refuses added capabilities, mixed audience and foreign context',()=>{
 const r=project();assert.equal(typeof v.parseRegistrationReviewView,'function');
 for(const value of [{...r,capabilities:{...r.capabilities,approve:true}},{...r,audience:'customer'},{...r,secret:'extra'}, {...r,context:{...r.context,accountId:id(99)}}])assert.throws(()=>v.parseRegistrationReviewView(value,{...context,audience:'internal'}));
});
test('browser parser never executes getters',()=>{const r={...project()};let touched=false;Object.defineProperty(r,'detail',{enumerable:true,get(){touched=true;throw Error('getter');}});assert.throws(()=>v.parseRegistrationReviewView(r,{...context,audience:'internal'}));assert.equal(touched,false);});
for(const status of ['__proto__','toString','unknown'])test('unknown status helper is safe for '+status,()=>{project();assert.deepEqual(v.registrationReviewStatus(status),{label:'Estado indisponível',message:'Consulte novamente antes de continuar.',tone:'warning'});});
