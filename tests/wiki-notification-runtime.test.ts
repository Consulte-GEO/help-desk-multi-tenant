import test from 'node:test';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
const module=()=>import('../src/infrastructure/wiki-notification-runtime.ts');
const origin='https://helpdesk.consultegeo.org';
const config={enabled:'true',releaseApproved:'true',databaseUrl:'postgresql://helpdesk_notification_worker:local-only@localhost/db',origin,resendApiKey:'local-only',resendFrom:'Wiki <wiki@example.invalid>',senderVerified:'true'};
const claim={eventId:'17',leaseId:'00000000-0000-4000-8000-000000000017',revision:2};
const envelope={...claim,revision:3,from:config.resendFrom,to:'thiago@consultegeo.com.br',subject:'Wiki Consulte GEO · contribuição #2',text:'Uma correção foi enviada em 2026-10-15T10:20:30.000000Z.\n'+origin+'/wiki/contribuicoes/00000000-0000-4000-8000-000000000002',html:'<p>Uma correção foi enviada.</p>',idempotencyKey:'a'.repeat(64)};
test('untrusted native deploy context never reads secrets or starts runtime',async()=>{
 const {createWikiNotificationScheduledHandler}=await module();let reads=0,runs=0;
 const handler=createWikiNotificationScheduledHandler({configuration:()=>{reads++;return config;},runtime:async()=>({async runOnce(){runs++;return {processed:0,attention:0};}})});
 const request=new Request(origin,{method:'POST',headers:{'x-nf-deploy-context':'production'},body:'{"deploy":{"context":"production"}}'});
 for(const context of [{},{deploy:{}},{deploy:{context:'deploy-preview',published:true}},{deploy:{context:'branch-deploy',published:true}}])assert.equal((await handler(request,context)).status,503);
 assert.equal(reads,0);assert.equal(runs,0);
});
test('production schedule ignores published bit and never exposes queue identifiers',async()=>{
 const {createWikiNotificationScheduledHandler}=await module();let runs=0;
 const handler=createWikiNotificationScheduledHandler({configuration:()=>config,runtime:async()=>({async runOnce(){runs++;return {processed:1,attention:0};}})});
 const response=await handler(new Request(origin),{deploy:{context:'production',published:false}});
 assert.equal(response.status,204);assert.equal(await response.text(),'');assert.equal(runs,1);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('pre-send durable confirmation precedes network and provider acceptance is settled',async()=>{
 const {createWikiNotificationCycle}=await module();const order:string[]=[],settled:unknown[]=[];
 const cycle=createWikiNotificationCycle({from:config.resendFrom,store:{async claim(){order.push('claim');return claim;},async begin(c,from){assert.deepEqual(c,claim);assert.equal(from,config.resendFrom);order.push('committed');return envelope;},async finish(c,result){order.push('settled');settled.push(result);assert.equal(c.revision,3);return {state:'accepted',attention:false};}},channel:{id:'resend',async send(message){order.push('network');assert.equal(message.to,'thiago@consultegeo.com.br');return {state:'accepted',providerMessageId:'00000000-0000-4000-8000-000000000081'};},async lookup(){return null;}}});
 assert.deepEqual(await cycle(),{processed:1,attention:0});assert.deepEqual(order,['claim','committed','network','settled']);assert.deepEqual(settled,[{state:'accepted',providerMessageId:'00000000-0000-4000-8000-000000000081'}]);
});
test('lost pre-send ACK cannot invoke provider and lost settlement ACK cannot retry provider',async()=>{
 const {createWikiNotificationCycle}=await module();let calls=0;
 for(const failing of ['begin','finish']){
  const cycle=createWikiNotificationCycle({from:config.resendFrom,store:{async claim(){return claim;},async begin(){if(failing==='begin')throw Error('lost SQL ACK');return envelope;},async finish(){throw Error('lost SQL ACK');}},channel:{id:'resend',async send(){calls++;return {state:'accepted',providerMessageId:'00000000-0000-4000-8000-000000000081'};},async lookup(){return null;}}});
  await assert.rejects(cycle(),{code:'wiki_notification_unavailable'});
 }
 assert.equal(calls,1);
});
test('uncertain provider response records unknown rather than ordinary retry',async()=>{
 const {createWikiNotificationCycle}=await module();let seen:unknown;
 const cycle=createWikiNotificationCycle({from:config.resendFrom,store:{async claim(){return claim;},async begin(){return envelope;},async finish(_c,result){seen=result;return {state:'unknown',attention:false};}},channel:{id:'resend',async send(){throw Error('private upstream error');},async lookup(){return null;}}});
 assert.deepEqual(await cycle(),{processed:1,attention:0});assert.deepEqual(seen,{state:'unknown'});
});
test('closed SQL delivery gate and blocked current authority make no provider call',async()=>{
 const {createWikiNotificationCycle}=await module();let sends=0;
 for(const gated of ['claim','begin']){
  const cycle=createWikiNotificationCycle({from:config.resendFrom,store:{async claim(){return gated==='claim'?null:claim;},async begin(){return null;},async finish(){throw Error('must not settle');}},channel:{id:'resend',async send(){sends++;throw Error('must not send');},async lookup(){return null;}}});
  assert.deepEqual(await cycle(),{processed:gated==='claim'?0:1,attention:gated==='claim'?0:1});
 }
 assert.equal(sends,0);
});
test('claim expiry attention is observable without attempting another send',async()=>{
 const {createWikiNotificationCycle}=await module();let sends=0;
 const cycle=createWikiNotificationCycle({from:config.resendFrom,store:{async claim(){return {attention:true as const};},async begin(){throw Error('attention has no lease');},async finish(){throw Error('attention has no send');}},channel:{id:'resend',async send(){sends++;return {};},async lookup(){return null;}}});
 assert.deepEqual(await cycle(),{processed:0,attention:1});assert.equal(sends,0);
});
test('malformed or changed recipient/envelope cannot reach existing Resend transport',async()=>{
 const {createWikiNotificationCycle}=await module();let sends=0;
 for(const change of [{to:'attacker@example.invalid'},{from:'Other <other@example.invalid>'},{idempotencyKey:'invalid'},{revision:2}]){
  const cycle=createWikiNotificationCycle({from:config.resendFrom,store:{async claim(){return claim;},async begin(){return {...envelope,...change};},async finish(){throw Error('must not settle');}},channel:{id:'resend',async send(){sends++;return {};},async lookup(){return null;}}});
  await assert.rejects(cycle(),{code:'wiki_notification_unavailable'});
 }
 assert.equal(sends,0);
});
test('runtime rejects wrong canonical origin and closed config before pool allocation',async()=>{
 const {createWikiNotificationRuntime}=await module();let pools=0;
 for(const change of [{enabled:'false'},{origin:'https://attacker.example.invalid'}])await assert.rejects(createWikiNotificationRuntime({...config,...change},{poolFactory:()=>{pools++;throw Error('must not allocate');}}));
 assert.equal(pools,0);
});
test('native Function exports exclusive schedule and cold initialization cannot start late work',async t=>{
 const actual=await import('../netlify/functions/wiki-notification-worker.mts');assert.deepEqual(Object.keys(actual.config),['schedule']);assert.equal(typeof actual.config.schedule,'string');
 const {createWikiNotificationScheduledHandler}=await module();let time=0,runs=0;t.mock.method(performance,'now',()=>time);
 const handler=createWikiNotificationScheduledHandler({configuration:()=>config,runtime:async()=>{time=25001;return {async runOnce(){runs++;return {processed:0,attention:0};}};}});
 assert.equal((await handler(new Request(origin),{deploy:{context:'production'}})).status,503);assert.equal(runs,0);
});
test('expired pre-send time budget records uncertainty without starting late provider work',async t=>{
 const {createWikiNotificationCycle}=await module();let time=0,sends=0;t.mock.method(performance,'now',()=>time);
 const cycle=createWikiNotificationCycle({from:config.resendFrom,store:{async claim(){return claim;},async begin(){time=20001;return envelope;},async finish(){throw Error('no provider attempt');}},channel:{id:'resend',async send(){sends++;return {};},async lookup(){return null;}}});
 await assert.rejects(cycle(),{code:'wiki_notification_unavailable'});assert.equal(sends,0);
});
