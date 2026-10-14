import test from 'node:test';import assert from 'node:assert/strict';
import {HelpdeskError} from '../src/domain/errors.ts';
import {createNotificationScheduledHandler} from '../src/infrastructure/notification-runtime.ts';
const origin='https://helpdesk.example.invalid',context={deploy:{context:'production',published:true}};
const config={enabled:'true',releaseApproved:'true',databaseUrl:'postgresql://helpdesk_notification_worker.project:PRIVATE_PASSWORD@pooler.invalid:5432/postgres',databaseCa:'PRIVATE_CA',origin,resendApiKey:'PRIVATE_RESEND_KEY',resendFrom:'Consulte GEO <private@example.invalid>',senderVerified:'true'};
const expectedPresence={enabled:true,releaseApproved:true,databaseUrl:true,databaseCa:true,origin:true,resendApiKey:true,resendFrom:true,senderVerified:true};
test('scheduled diagnostics identify deployment refusal without reading configuration',async()=>{
 const logs:unknown[]=[];let reads=0;const handler=createNotificationScheduledHandler({configuration:()=>{reads++;return config;},runtime:async()=>{throw Error();},observe:e=>logs.push(e)});
 assert.equal((await handler(new Request(origin),{deploy:{context:'PRIVATE_CONTEXT',published:false}})).status,503);assert.equal(reads,0);
 assert.deepEqual(logs,[{component:'helpdesk.notifications',event:'scheduled_worker_failed',phase:'deploy_guard',code:'notification_unavailable',deployContext:'other',publishedDeploy:false,configuration:null}]);
});
test('scheduled diagnostics retain only configuration presence and approved flags',async()=>{
 const logs:unknown[]=[];const handler=createNotificationScheduledHandler({configuration:()=>({...config,enabled:'PRIVATE_DISABLED'}),runtime:async()=>{throw Error();},observe:e=>logs.push(e)});
 assert.equal((await handler(new Request(origin),context)).status,503);
 assert.deepEqual(logs,[{component:'helpdesk.notifications',event:'scheduled_worker_failed',phase:'configuration',code:'notification_configuration_required',deployContext:'production',publishedDeploy:true,configuration:{...expectedPresence,enabled:false}}]);assert.doesNotMatch(JSON.stringify(logs),/PRIVATE_|private@|postgresql|pooler/);
});
test('scheduled diagnostics distinguish initialization and cycle without serializing errors',async()=>{
 for(const phase of ['initialization','cycle'] as const)for(const error of [new Error('PRIVATE_ERROR_STACK'),new HelpdeskError(503,'PRIVATE_ERROR_CODE','PRIVATE_ERROR_MESSAGE'),{toJSON(){throw Error('must never serialize raw errors');},marker:'PRIVATE_OBJECT'}]){
  const logs:any[]=[];const handler=createNotificationScheduledHandler({configuration:()=>config,runtime:async()=>{if(phase==='initialization')throw error;return {async runOnce(){throw error;}};},observe:e=>logs.push(e)});
  const response=await handler(new Request(origin),context);assert.equal(response.status,503);assert.deepEqual(await response.json(),{code:'notification_unavailable'});assert.equal(logs.length,1);assert.equal(logs[0].phase,phase);assert.equal(logs[0].code,'notification_unavailable');assert.deepEqual(logs[0].configuration,expectedPresence);assert.doesNotMatch(JSON.stringify(logs),/PRIVATE_|private@|postgresql|pooler|stack|marker/);
 }
 const logs:any[]=[];const handler=createNotificationScheduledHandler({configuration:()=>config,runtime:async()=>{throw new HelpdeskError(503,'notification_database_unqualified','PRIVATE_DETAIL');},observe:e=>logs.push(e)});assert.equal((await handler(new Request(origin),context)).status,503);assert.equal(logs[0].code,'notification_database_unqualified');
});
test('diagnostic sink failure cannot change refusal or successful dispatch',async()=>{
 const observe=()=>{throw Error('PRIVATE_LOGGER_ERROR');};const denied=createNotificationScheduledHandler({configuration:()=>config,runtime:async()=>{throw Error();},observe});assert.equal((await denied(new Request(origin),{})).status,503);
 let logs=0;const success=createNotificationScheduledHandler({configuration:()=>config,runtime:async()=>({async runOnce(){return {planned:0,processed:0,attention:0};}}),observe:()=>{logs++;observe();}});assert.equal((await success(new Request(origin),context)).status,204);assert.equal(logs,0);
});
test('scheduled observation phase and configuration are isolated across concurrent invocations',async()=>{
 const logs:any[]=[];let release!:()=>void,calls=0;const waiting=new Promise<void>(resolve=>{release=resolve;});const handler=createNotificationScheduledHandler({configuration:()=>calls++===0?config:{...config,enabled:'false',databaseUrl:undefined},runtime:async()=>{await waiting;throw Error('PRIVATE_INITIALIZATION');},observe:e=>logs.push(e)});
 const first=handler(new Request(origin),context);const second=handler(new Request(origin),context);assert.equal((await second).status,503);release();assert.equal((await first).status,503);assert.deepEqual(logs.map(e=>[e.phase,e.configuration.enabled,e.configuration.databaseUrl]),[['configuration',false,false],['initialization',true,true]]);
});
