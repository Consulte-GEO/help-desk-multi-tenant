import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateRegistrationRuntimeConfig,createRegistrationScheduledHandler,createManualRegistrationEngine,assertRegistrationWorkerDatabase,createRegistrationRuntime,REGISTRATION_WORKER_QUERY} from '../src/infrastructure/registration-runtime.ts';
import {REGISTRATION_SECURITY_CONTRACT,REGISTRATION_SECURITY_QUERY} from '../src/infrastructure/registration-security-contract.ts';
import {READINESS_FLAGS} from '../src/infrastructure/database-security.ts';
import {createRegistrationInputSnapshot} from '../src/domain/registration-contracts.ts';
import {createAgentAnalysisJob} from '../src/domain/registration-analysis.ts';
import {input,id} from './fixtures/registration/sample.ts';
const configuration={enabled:'true',releaseApproved:'true',mode:'manual_review',databaseUrl:'postgresql://helpdesk_registration_worker:private@db.example/db'};
test('registration scheduler rejects absent/preview native context before configuration or runtime',async()=>{
 let reads=0,calls=0;const handler=createRegistrationScheduledHandler({configuration:()=>{reads++;return configuration;},runtime:async()=>{calls++;return {runOnce:async()=>{}};}});
 for(const context of [{},{deploy:{context:'deploy-preview',published:true}},{deploy:{context:'branch-deploy',published:true}}])assert.equal((await handler(new Request('https://example.test/'),context)).status,503);
 assert.equal(reads,0);assert.equal(calls,0);
});
test('registration config refuses borrowed identities, absent explicit mode and URL TLS overrides',()=>{
 for(const patch of [{enabled:'false'},{releaseApproved:'false'},{mode:undefined},{mode:'claude'},{databaseUrl:'postgresql://helpdesk_app:p@db.example/db'},{databaseUrl:configuration.databaseUrl+'?sslmode=require'}])assert.throws(()=>validateRegistrationRuntimeConfig({...configuration,...patch}));
 assert.equal(validateRegistrationRuntimeConfig(configuration).mode,'manual_review');
});
test('registration scheduler admits native production without trusting the published bit or request input',async()=>{
 let calls=0;const handler=createRegistrationScheduledHandler({configuration:()=>configuration,runtime:async()=>({runOnce:async()=>{calls++;}})});
 const response=await handler(new Request('https://example.test/?actor=forged',{method:'POST',body:'forged'}),{deploy:{context:'production',published:false}});
 assert.equal(response.status,204);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(calls,1);
});
test('manual engine returns only explicit human review with no invented fields or external calls',async()=>{
 const snapshot=createRegistrationInputSnapshot(input()),job=createAgentAnalysisJob(snapshot,{jobId:id(12),fence:1,agentVersionRef:'manual-review.v1',knowledgeRefs:[]});
 const result=await createManualRegistrationEngine().analyze({snapshot,job,knowledge:[]});
 assert.equal((result.output as any).disposition,'manual_review');assert.deepEqual((result.output as any).proposedFields,{});
 assert.match((result.output as any).warnings[0],/humana/);
 const stop=new AbortController();stop.abort();await assert.rejects(createManualRegistrationEngine().analyze({snapshot,job,knowledge:[]},stop.signal));
 await assert.rejects(createManualRegistrationEngine().analyze({snapshot,job:{...job,agentVersionRef:'external-engine.v1'},knowledge:[]}),{code:'registration_runner_offline'});
});
test('registration deployment has native exclusive schedule and never imports the Claude bridge',()=>{
 const source=readFileSync(new URL('../netlify/functions/registration-worker.mts',import.meta.url),'utf8');assert.match(source,/schedule:\s*['"]\* \* \* \* \*['"]/);assert.doesNotMatch(source,/dev-agent-bridge|claude/i);
});
const core={table_count:REGISTRATION_SECURITY_CONTRACT.tables.length,unsafe_tables:0,public_schema_access:false,client_schema_access:false,public_helper_execute:false,...Object.fromEntries(READINESS_FLAGS.map(key=>[key,true]))};
const worker={actor:'helpdesk_registration_worker',login:'helpdesk_registration_worker',role:true,schemas:true,tables:true,helpers:true,auth:true,tls:true,storage:true};
test('worker readiness refuses any missing core guard, worker ACL, identity, TLS or storage version',async()=>{
 for(const field of READINESS_FLAGS)await assert.rejects(assertRegistrationWorkerDatabase({query:async()=>({command:'SELECT',rowCount:1,rows:[{...core,[field]:false}]})}));
 for(const patch of [{actor:'helpdesk_app'},{login:'postgres'},...['role','schemas','tables','helpers','auth','tls','storage'].map(field=>({[field]:false}))])await assert.rejects(assertRegistrationWorkerDatabase({query:async(sql)=>({command:'SELECT',rowCount:1,rows:[sql===REGISTRATION_WORKER_QUERY?{...worker,...patch}:core]})}));
 let queries=0;await assertRegistrationWorkerDatabase({query:async(sql)=>{queries++;return {command:'SELECT',rowCount:1,rows:[sql===REGISTRATION_WORKER_QUERY?worker:core]};}});assert.equal(queries,2);
 assert.match(REGISTRATION_SECURITY_QUERY,/expected_roles\)=3/);
});
test('unqualified startup closes its separate pool and never asks for a queue target',async()=>{
 let ended=0;const seen:string[]=[];await assert.rejects(createRegistrationRuntime(configuration,{poolFactory:options=>{
  assert.equal(options.max,1);assert.deepEqual(options.ssl,{rejectUnauthorized:true});assert.equal(options.application_name,'helpdesk-registration-worker');
  return {query:async(sql)=>{seen.push(sql);return {command:'SELECT',rowCount:0,rows:[]};},connect:async()=>{throw Error();},end:async()=>{ended++;}};
 }}));assert.equal(ended,1);assert.equal(seen.some(sql=>sql.includes('hda02_worker_target()')),false);
});
test('scheduler refuses work after initialization consumes its time budget',async t=>{
 let now=0,runs=0;t.mock.method(performance,'now',()=>now);const handler=createRegistrationScheduledHandler({configuration:()=>configuration,runtime:async()=>{now=25001;return {runOnce:async()=>{runs++;}};}});
 assert.equal((await handler(new Request('https://example.test/'),{deploy:{context:'production'}})).status,503);assert.equal(runs,0);
});
