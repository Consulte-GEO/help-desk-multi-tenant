import test from 'node:test';
import assert from 'node:assert/strict';
import {createExecutionChecklistHttpHandler, type ExecutionChecklistHttpOptions} from '../src/http/execution-checklist.ts';
import {markingFixture,id} from './fixtures/checklist/marking.ts';

/** Controlled ports expose the HTTP dispatch boundary, not PostgreSQL durability. */
function setup() {
 const f=markingFixture(), origin='https://helpdesk.example.test';
 let open=true, gateThrows=false;
 const calls:string[]=[], operations:string[]=[];
 const hooks:Record<string,()=>void|Promise<void>>={};
 const step=async(name:string)=>{calls.push(name);await hooks[name]?.();};
 const options:ExecutionChecklistHttpOptions={
  enabled:()=>{if(gateThrows)throw new Error('PRIVATE_AVAILABILITY_FAILURE');return open;},origin,
  authenticate:async()=>{await step('authenticate');return f.principal;},
  rateLimiter:{beforeAuthentication:async()=>step('before'),afterAuthentication:async()=>step('after')},
  directory:{readTicketResources:async()=>{await step('directory');return [{connectionId:id(4),tenantId:'T1',type:'work',id:'A'}];}},
  service:{
   read:async()=>{operations.push('read');await step('service');return f.record;},
   queryEvidence:async()=>{operations.push('evidence');await step('service');return {principalId:f.principal.id,workspaceId:id(1),accountId:id(3),ticketId:id(6),ticketVersion:4,checklistRevision:0,readAt:f.record.readAt,items:[],next:null};},
   mark:async()=>{operations.push('mark');await step('service');return {ticketId:id(6),workspaceId:id(1),accountId:id(3),actorId:f.principal.id,itemId:'grupo',status:'done',ticketVersion:4,checklistRevision:1,auditId:id(80),at:f.record.readAt,replayed:false};}
  }
 };
 const handler=createExecutionChecklistHttpHandler(options);
 const request=(kind:'read'|'mark'|'evidence', signal?:AbortSignal)=>{
  const body=kind==='mark'?f.command:{expectedTicketVersion:4,expectedChecklistRevision:0,before:null};
  return new Request(`${origin}/v1/internal/tickets/${id(6)}/execution-checklist${kind==='read'?'':kind==='mark'?'/marks':'/evidence'}`,{
   method:kind==='read'?'GET':'POST',signal,
   headers:{origin,'content-type':'application/json','if-match':'"0"','idempotency-key':'availability-test-0001'},
   ...(kind==='read'?{}:{body:JSON.stringify(body)})
  });
 };
 return {...f,handler,request,calls,operations,hooks,options,close:()=>{open=false;},throwGate:()=>{gateThrows=true;}};
}

for(const kind of ['read','mark','evidence'] as const){
 for(const boundary of ['before','authenticate','after','directory']){
  test(`HDN01f ${kind}: closing admission during ${boundary} prevents service dispatch`,async()=>{
   const f=setup();f.hooks[boundary]=()=>f.close();
   const response=await f.handler(f.request(kind));
   assert.equal(response.status,503);assert.equal((await response.json()).code,'release_gate_closed');
   assert.deepEqual(f.operations,[],'must not call business service after closure');
   const later={before:'authenticate',authenticate:'after',after:'directory',directory:'service'}[boundary]!;
   assert.equal(f.calls.includes(later),false,'must not proceed to the next awaited boundary');
  });
 }
 test(`HDN01f ${kind}: cancellation during authentication stops before post-auth and directory`,async()=>{
  const f=setup(),abort=new AbortController();f.hooks.authenticate=()=>abort.abort();
  const response=await f.handler(f.request(kind,abort.signal));
  assert.equal(response.status,409);assert.equal((await response.json()).code,'request_cancelled');
  assert.deepEqual(f.operations,[]);assert.equal(f.calls.includes('after'),false);
 });
 test(`HDN01f ${kind}: initially aborted request performs no authentication or quota work`,async()=>{
  const f=setup(),abort=new AbortController();abort.abort();
  const response=await f.handler(f.request(kind,abort.signal));
  assert.equal(response.status,409);assert.deepEqual(f.calls,[]);assert.deepEqual(f.operations,[]);
 });
}
for(const kind of ['mark','evidence'] as const){
 test(`HDN01f ${kind}: gate closing while body is consumed prevents directory dispatch`,async()=>{
  const f=setup(),normal=f.request(kind);const text=await normal.text();
  const body=new ReadableStream<Uint8Array>({pull(controller){f.close();controller.enqueue(new TextEncoder().encode(text));controller.close();}},{highWaterMark:0});
  const req=new Request(normal.url,{method:'POST',headers:normal.headers,body,duplex:'half'} as RequestInit);
  const response=await f.handler(req);
  assert.equal(response.status,503);assert.deepEqual(f.operations,[]);assert.equal(f.calls.includes('directory'),false);
 });
}
for(const kind of ['read','evidence'] as const){
 test(`HDN01f ${kind}: closure during a completed read withholds its private result`,async()=>{
  const f=setup();f.hooks.service=()=>f.close();const response=await f.handler(f.request(kind));
  assert.equal(response.status,503);const body=await response.text();assert.doesNotMatch(body,/template|snapshot|principalId|readAt/);
  assert.deepEqual(f.operations,[kind]);
 });
}
test('HDN01f confirmed mark is not reclassified as failure by a closure after its commit',async()=>{
 const f=setup();f.hooks.service=()=>f.close();const response=await f.handler(f.request('mark'));
 assert.equal(response.status,200);assert.equal((await response.json()).auditId,id(80));assert.deepEqual(f.operations,['mark']);
});
test('HDN01f gate failure after directory is sanitized and prevents service dispatch',async()=>{
 const f=setup();f.hooks.directory=()=>f.throwGate();const response=await f.handler(f.request('mark'));
 assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/PRIVATE_AVAILABILITY_FAILURE/);assert.deepEqual(f.operations,[]);
});
test('HDN01f normal explicit mark remains exactly one service invocation',async()=>{
 const f=setup(),response=await f.handler(f.request('mark'));assert.equal(response.status,200);
 assert.deepEqual(f.operations,['mark']);assert.equal(response.headers.get('idempotency-replayed'),'false');
});
