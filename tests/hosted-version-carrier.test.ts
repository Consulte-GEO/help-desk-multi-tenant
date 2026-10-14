import test from 'node:test';import assert from 'node:assert/strict';
import {createSessionFetch} from '../web/session-fetch.js';
import {createConsulteGeoDraftHttpHandler} from '../src/http/consultegeo-drafts.ts';
const origin='https://helpdesk.example.test',id='12345678-1234-4234-8234-123456789abc';
async function adapter(){const path='../src/infrastructure/hosted-version-carrier.ts',m=await import(path).catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});assert.equal(typeof m.restoreHostedVersionPrecondition,'function');return m.restoreHostedVersionPrecondition;}
test('authenticated browser draft save survives loss of the standard version header without defaulting its revision',async()=>{
 const restore=await adapter(),proof={accessToken:'synthetic-session-proof',workspace:id};let requests=0,saves=0;
 const server=createConsulteGeoDraftHttpHandler({enabled:()=>true,origin,authenticate:async(r:Request)=>{assert.equal(r.headers.get('authorization'),'Bearer synthetic-session-proof');assert.equal(r.headers.get('x-workspace-id'),id);return {id,workspaceId:id} as any;},rateLimiter:{beforeAuthentication:async()=>{},afterAuthentication:async()=>{}},catalog:{} as any,drafts:{saveFormDraft:async(_p:any,body:any,expected:number)=>{saves++;assert.equal(body.id,id);assert.equal(expected,0);return {id,accountId:id,refs:[],formId:id,formVersion:1,revision:1,expiresAt:'2026-10-15T00:00:00Z',answers:{},status:'editing',ticketId:null};}} as any});
 const session:any={authorization:async()=>proof,current:()=>true,canDispatch:()=>true,sameCredential:()=>true,reject:()=>{}};
 const request=createSessionFetch(session,async(path:any,init:any)=>{assert.equal(typeof path,'string');requests++;const headers=new Headers(init.headers);assert.equal(headers.get('if-match'),'"0"');assert.equal(headers.get('x-helpdesk-if-match'),'"0"');headers.delete('if-match');return server(restore(new Request(origin+path,{...init,headers})));});
 const response=await request('/form-drafts/'+id,{method:'PUT',headers:{origin,'content-type':'application/json','if-match':'"0"'},body:JSON.stringify({id})});
 assert.equal(response.status,200);assert.equal(response.headers.get('etag'),'"1"');assert.equal(requests,1);assert.equal(saves,1);
});
test('carrier preserves the pinned version, method, body, identity, URL and cancellation',async()=>{
 const restore=await adapter(),controller=new AbortController(),body='{"body":"Synthetic public reply"}',request=new Request(origin+'/v1/tickets/'+id+'/workflow-commands',{method:'POST',headers:{'x-helpdesk-if-match':'"7"',authorization:'Bearer synthetic-proof','x-workspace-id':id,'idempotency-key':'same-original-intent'},body,signal:controller.signal}),r=restore(request);
 assert.equal(r.headers.get('if-match'),'"7"');assert.equal(r.headers.has('x-helpdesk-if-match'),false);assert.equal(r.headers.get('authorization'),'Bearer synthetic-proof');assert.equal(r.headers.get('x-workspace-id'),id);assert.equal(r.headers.get('idempotency-key'),'same-original-intent');assert.equal(r.url,request.url);assert.equal(r.method,'POST');assert.equal(await r.text(),body);controller.abort();assert.equal(r.signal.aborted,true);
});
test('legacy requests and reads retain their original behavior',async()=>{const restore=await adapter();for(const r of [new Request(origin+'/v1/tickets',{method:'POST',headers:{'if-match':'"1"'},body:'{}'}),new Request(origin+'/v1/tickets',{headers:{'x-helpdesk-if-match':'"1"'}}),new Request(origin+'/other',{method:'POST',headers:{'x-helpdesk-if-match':'"1"'},body:'{}'})])assert.equal(restore(r),r);});
test('malformed, unsafe or contradictory carriers refuse without exposing input values',async()=>{
 const restore=await adapter();for(const value of ['','0','"01"','*','W/"1"','"1", "2"','"9007199254740992"','PRIVATE_HEADER_VALUE']){
  assert.throws(()=>restore(new Request(origin+'/v1/form-drafts/'+id,{method:'PUT',headers:{'x-helpdesk-if-match':value},body:'{}'})),(e:any)=>e.status===428&&e.code==='precondition_required'&&!e.message.includes(value||'PRIVATE'));
 }
 for(const native of ['"1"','*','0'])assert.throws(()=>restore(new Request(origin+'/v1/form-drafts/'+id,{method:'PUT',headers:{'if-match':native,'x-helpdesk-if-match':'"0"'},body:'{}'})),(e:any)=>e.status===428);
 const r=restore(new Request(origin+'/v1/form-drafts/'+id,{method:'PUT',headers:{'if-match':'"0"','x-helpdesk-if-match':'"0"'},body:'{}'}));assert.equal(r.headers.get('if-match'),'"0"');
});
