import test from 'node:test';import assert from 'node:assert/strict';
import {createHttpHandler} from '../src/http/handler.ts';import {HelpdeskError} from '../src/domain/errors.ts';
import {HelpdeskService} from '../src/application/helpdesk.ts';import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {principal,coverage} from './fixtures.ts';
import {RateLimitError} from '../src/infrastructure/rate-limit.ts';
const id='12345678-1234-4234-8234-123456789abc';
function fixture(failure?:unknown){const events:any[]=[];const db=new MemoryUnitOfWork({coverages:[coverage()]});
 const service=new HelpdeskService(db,()=>new Date('2026-09-16T12:00:00Z'));
 const handler=createHttpHandler({service,authenticate:async()=>{if(failure)throw failure;return principal();},observe:e=>{events.push(e);}});return {handler,events};}
async function telemetry(){const path='../src/observability/http.ts';const m=await import(path).catch(()=>null);assert.equal(typeof m?.httpObservation,'function');return m;}
async function hosted(){const path='../src/infrastructure/hosted-handler.ts';const m=await import(path).catch(()=>null);assert.equal(typeof m?.createHostedHandler,'function');return m;}
const request=(path='/v1/tickets',method='GET')=>new Request('https://hd.test'+path,{method,headers:{'x-request-id':id,authorization:'Bearer PRIVATE_TOKEN','x-forwarded-for':'1.2.3.4','idempotency-key':'PRIVATE_KEY'}});
test('HTTP diagnostics include route template, safe error code and release, not object identifiers',async()=>{
 const {handler,events}=fixture(new HelpdeskError(403,'forbidden','PRIVATE_EXCEPTION'));
 const r=await handler(request('/v1/tickets/TICKET_SECRET/notes?cursor=PRIVATE_CURSOR'));assert.equal(r.status,403);
 assert.equal(events.length,1);assert.equal(events[0].route,'/v1/tickets/{ticket_id}/notes');assert.equal(events[0].error_code,'forbidden');
 assert.equal(events[0].severity,'warn');assert.equal(events[0].component,'helpdesk.http');assert.equal(events[0].event_schema,1);
 assert.equal(events[0].request_id,r.headers.get('x-request-id'));assert.doesNotMatch(JSON.stringify(events),/PRIVATE|TICKET_SECRET|1\.2\.3\.4/);
});
test('requests containing only hyphens cannot choose a correlation identifier',async()=>{
 const {handler}=fixture();const r=await handler(new Request('https://hd.test/v1/capabilities',{headers:{'x-request-id':'-'.repeat(36)}}));
 assert.match(r.headers.get('x-request-id')!,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
test('successful requests are observed once without reading or modifying their response body',async()=>{
 const {handler,events}=fixture();const r=await handler(request('/v1/capabilities'));assert.equal((await r.json()).capabilities.tickets,true);
 assert.equal(events.length,1);assert.equal(events[0].error_code,null);assert.equal(events[0].severity,'info');assert.equal(events[0].status_class,'2xx');
 assert.ok(events[0].duration_ms>=0);assert.match(events[0].occurred_at,/Z$/);
});
test('database failures have their public mapped code, never raw exception details',async()=>{
 const {handler,events}=fixture(Object.assign(Error('password=PRIVATE_PG; select * from auth.users'),{code:'57014'}));
 assert.equal((await handler(request())).status,503);assert.equal(events[0].error_code,'retryable_conflict');assert.equal(events[0].severity,'error');assert.doesNotMatch(JSON.stringify(events),/PRIVATE_PG|auth.users/);
});
test('route-local problem responses are observed with their code and Allow header intact',async()=>{
 const {handler,events}=fixture();const r=await handler(request('/v1/support-contexts','DELETE'));
 assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET');assert.equal(events[0].error_code,'method_not_allowed');
});
test('unknown routes collapse to one bounded label, not a URL or query',async()=>{
 const {handler,events}=fixture();await handler(request('/UNKNOWN_PRIVATE/a/b?token=PRIVATE_QUERY'));assert.equal(events[0].route,'unmatched');assert.doesNotMatch(JSON.stringify(events),/PRIVATE/);
});
test('unregistered error codes are not accepted as free-form log fields',async()=>{
 const {handler,events}=fixture(new HelpdeskError(503,'PRIVATE_TOKEN','PRIVATE_DETAIL'));await handler(request());assert.equal(events[0].error_code,'unclassified_error');assert.doesNotMatch(JSON.stringify(events),/PRIVATE/);
});
test('ingress limiter refusals are captured before authentication',async()=>{
 const events:any[]=[];let authenticated=false;const h=createHttpHandler({service:null as never,authenticate:async()=>{authenticated=true;return principal();},rateLimiter:{beforeAuthentication:async()=>{throw new HelpdeskError(429,'rate_limited','Budget');},afterAuthentication:async()=>{}},observe:e=>{events.push(e);}});
 const r=await h(request());assert.equal(r.status,429);assert.equal(authenticated,false);assert.equal(events[0].error_code,'rate_limited');
});
test('observer failures, sync and async, cannot change HTTP outcome or become unhandled rejections',async()=>{
 const m=await telemetry();for(const observer of [()=>{throw Error('PRIVATE');},async()=>{throw Error('PRIVATE');}]){
  assert.doesNotThrow(()=>m.notifyObserver(observer,{status:200}));
 }await new Promise(resolve=>setImmediate(resolve));
 const h=createHttpHandler({service:null as never,authenticate:async()=>principal(),observe:async()=>{throw Error('PRIVATE');}});
 assert.equal((await h(request('/v1/capabilities'))).status,200);await new Promise(resolve=>setImmediate(resolve));
});
test('diagnostic factory uses closed fields, bounded method/route/code and invalid timing is null',async()=>{
 const m=await telemetry();const e=m.httpObservation({request:request('/v1/me'),requestId:id,status:200,errorCode:null,phase:'http',started:100,finished:99});
 assert.equal(e.duration_ms,null);assert.equal(m.httpObservation({request:request(),requestId:id,status:200,errorCode:null,phase:'http',started:NaN,finished:1}).duration_ms,null);
 assert.deepEqual(Object.keys(e).sort(),['component','duration_ms','error_code','event_schema','method','occurred_at','phase','release','request_id','route','severity','status','status_class'].sort());
 assert.equal(m.routeTemplate('/v1/tickets/abc/messages/'),'unmatched');assert.equal(m.routeTemplate('/v1/tickets/abc/messages'),'/v1/tickets/{ticket_id}/messages');
});
test('request ID accepts a canonical UUID but normalizes case and rejects all-zero UUID',async()=>{
 const m=await telemetry();assert.equal(m.requestIdFor(new Request('https://hd.test',{headers:{'x-request-id':id.toUpperCase()}})),id);
 assert.notEqual(m.requestIdFor(new Request('https://hd.test',{headers:{'x-request-id':'00000000-0000-0000-0000-000000000000'}})),'00000000-0000-0000-0000-000000000000');
});
test('startup failure emits one correlated safe event and permits a later initialization attempt',async()=>{
 const m=await hosted();const events:any[]=[];let calls=0;
 const handler=m.createHostedHandler(async()=>{calls++;if(calls===1)throw new HelpdeskError(503,'release_gate_closed','PRIVATE_CONFIG');return async()=>new Response('ok');},(e:any)=>{events.push(e);});
 const first=await handler(request());assert.equal(first.status,503);assert.equal(events.length,1);assert.equal(events[0].phase,'bootstrap');assert.equal(events[0].error_code,'release_gate_closed');
 assert.equal((await first.json()).request_id,events[0].request_id);assert.equal((await handler(request())).status,200);assert.equal(calls,2);assert.equal(events.length,1);assert.doesNotMatch(JSON.stringify(events),/PRIVATE/);
});
test('concurrent requests share one initialization promise without duplicating HTTP observations',async()=>{
 const m=await hosted();let calls=0;const events:any[]=[];const {handler:inner,events:innerEvents}=fixture();
 const h=m.createHostedHandler(async()=>{calls++;await new Promise(r=>setTimeout(r,5));return inner;},(e:any)=>{events.push(e);});
 const responses=await Promise.all(Array.from({length:8},()=>h(request('/v1/capabilities'))));assert.ok(responses.every(r=>r.status===200));assert.equal(calls,1);assert.equal(events.length,0);assert.equal(innerEvents.length,8);
});
test('unexpected dispatch failure is safe, correlated and distinguishable from bootstrap',async()=>{
 const m=await hosted();const events:any[]=[];const h=m.createHostedHandler(async()=>async()=>{throw Error('postgres://PRIVATE_PASSWORD');},(e:any)=>{events.push(e);});
 const r=await h(request());assert.equal(r.status,503);assert.equal(events[0].phase,'dispatch');assert.equal(events[0].error_code,'backend_unavailable');assert.doesNotMatch(await r.text(),/PRIVATE_PASSWORD/);
});
test('synchronous runtime factory failure and rejected diagnostic sink remain contained',async()=>{
 const m=await hosted();let calls=0;const h=m.createHostedHandler(()=>{calls++;throw Error('PRIVATE');},async()=>{throw Error('PRIVATE_LOGGER');});
 assert.equal((await h(request())).status,503);assert.equal((await h(request())).status,503);assert.equal(calls,2);await new Promise(r=>setImmediate(r));
});

test('real RateLimitError keeps Retry-After and records its registered code before authentication',async()=>{
 const events:any[]=[];let authCalls=0;const h=createHttpHandler({service:null as never,authenticate:async()=>{authCalls++;return principal();},rateLimiter:{beforeAuthentication:async()=>{throw new RateLimitError(17);},afterAuthentication:async()=>{}},observe:e=>{events.push(e);}});
 const r=await h(request());assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'17');assert.equal(authCalls,0);assert.equal(events.length,1);assert.equal(events[0].error_code,'rate_limit_exceeded');
});
test('duration outside the supported telemetry window is unobserved rather than an invalid event',async()=>{
 const m=await telemetry();for(const elapsed of [86_400_001,Number.MAX_VALUE]){
 const e=m.httpObservation({request:request(),requestId:id,status:200,phase:'http',started:0,finished:elapsed});assert.equal(e.duration_ms,null);
 }
});
