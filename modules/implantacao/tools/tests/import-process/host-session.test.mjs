import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createAuthenticatedProcessTransport} from '../../../modules/import-process-client/host-session.ts';
const require=createRequire(new URL('../../../frontend/package.json',import.meta.url));
const {createStore}=require('vuex');
const actor='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
test('transport never dispatches without a current credential',async()=>{
 let calls=0;const host=createAuthenticatedProcessTransport({origin:'https://setup.consultegeo.org',credential:async()=>null,fetch:async()=>{calls++;throw Error();}});
 await assert.rejects(host.sessionFetch('/v1/import-processes/session'),/SESSION_REQUIRED/);assert.equal(calls,0);
});
test('transport restricts bearer to its exact same-origin process API',async()=>{
 const sent=[];const host=createAuthenticatedProcessTransport({origin:'https://setup.consultegeo.org',credential:async()=>({actorId:actor,accessToken:'opaque-secret'}),fetch:async(url,init)=>{sent.push([url,init]);return new Response('{}');}});
 for(const url of ['https://evil.test/v1/import-processes','//evil.test/v1/import-processes','/v1/import-processes-evil','/v1/import-processes/../other'])await assert.rejects(host.sessionFetch(url),/INVALID_PROCESS_URL/);
 await host.sessionFetch('/v1/import-processes/session');assert.equal(sent.length,1);assert.equal(sent[0][1].headers.get('authorization'),'Bearer opaque-secret');assert.equal(sent[0][1].credentials,'omit');assert.equal(sent[0][1].redirect,'error');
});
test('ending session aborts provider and prevents adopting its late response',async()=>{
 let release;let signal;const host=createAuthenticatedProcessTransport({origin:'https://setup.consultegeo.org',credential:async()=>({actorId:actor,accessToken:'opaque-secret'}),fetch:async(_url,init)=>{signal=init.signal;return await new Promise(r=>{release=r;});}});
 const work=host.sessionFetch('/v1/import-processes/session');await new Promise(r=>setImmediate(r));host.endSession();assert.equal(signal.aborted,true);release(new Response('{}'));await assert.rejects(work,/SESSION_CHANGED/);
});
test('changed actor invalidates transport and clears registered session synchronously',async()=>{
 let who=actor,clears=0;const host=createAuthenticatedProcessTransport({origin:'https://setup.consultegeo.org',credential:async()=>({actorId:who,accessToken:'token'}),fetch:async()=>new Response('{}'),onEnd:()=>clears++});
 await host.sessionFetch('/v1/import-processes/session');who=other;await assert.rejects(host.sessionFetch('/v1/import-processes/session'),/SESSION_CHANGED/);assert.equal(clears,1);
});
test('caller cancellation remains effective and supplied authorization cannot override current token',async()=>{
 let called=false;const host=createAuthenticatedProcessTransport({origin:'https://setup.consultegeo.org',credential:async()=>({actorId:actor,accessToken:'token'}),fetch:async(_url,init)=>{called=true;assert.equal(init.headers.get('authorization'),'Bearer token');assert.equal(init.signal.aborted,false);return new Response('{}');}});
 const ctl=new AbortController();ctl.abort();await assert.rejects(host.sessionFetch('/v1/import-processes/session',{signal:ctl.signal}),/SESSION_CHANGED/);assert.equal(called,false);
 await host.sessionFetch('/v1/import-processes/session',{headers:{authorization:'Bearer attacker'}});assert.equal(called,true);
});
