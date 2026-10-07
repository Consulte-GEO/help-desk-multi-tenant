/** Real handler/application; memory persistence and synthetic identity, no hosted claims. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createTicketCreateState,retryCreateIntent} from '../web/ticket-create-state.js';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import type {UnitOfWork} from '../src/application/ports.ts';
import {coverage,principal} from './fixtures.ts';

const identity={workspace:'workspace-a',principal:'person-a',session:1};
const input={account_id:'account-a',product_instance_id:'geolab-production',service_code:'SUPPORT',subject:'Recuperação do pedido',description:'Descrição original do pedido.',priority:'normal' as const};
function fixture(explicit=false){
 const db=new MemoryUnitOfWork({coverages:[coverage()]});let actor=principal(),now='2026-09-17T12:00:00.000Z',badCache=false;
 const uow:UnitOfWork={run:(p,work)=>db.run(p,s=>work({...s,getIdempotency:async(op,key)=>{const r=await s.getIdempotency(op,key);return badCache&&r?{...r,result:{}}:r;}}))};
 const handler=createHttpHandler({service:new HelpdeskService(uow,()=>new Date(now)),authenticate:async()=>actor});
 const state=createTicketCreateState(()=> 'create-recovery-key-001');state.reset(identity);state.prepare({...input,...(explicit?{coverage_id:'coverage-a'}:{})});
 const send=()=>{const op=state.begin()!,{path,...options}=retryCreateIntent(op,identity);return {op,response:handler(new Request('http://127.0.0.1/v1'+path,{...options,headers:{...options.headers,'content-type':'application/json'}}))};};
 return {db,state,send,setNow:(v:string)=>{now=v;},revoke:()=>{actor=principal({grants:[]});},corrupt:()=>{badCache=true;}};
}

for(const explicit of [false,true])test(`frozen creation replay after coverage expiry preserves one ticket/event/outbox (explicit=${explicit})`,async()=>{
 const f=fixture(explicit),first=f.send();assert.equal((await first.response).status,201);const original=await (await first.response).json();f.state.fail(first.op);
 const before=f.db.snapshot();assert.equal(before.tickets.length,1);assert.equal(before.events.length,1);assert.equal(before.outbox.length,1);
 f.setNow('2027-01-01T00:00:00.000Z');const again=f.send(),response=await again.response;assert.equal(response.status,200);assert.equal(response.headers.get('idempotency-replayed'),'true');
 const replay=await response.json();assert.deepEqual(replay,original);assert.equal(f.state.confirm(again.op,replay),true);assert.deepEqual(f.db.snapshot(),before);
});

test('revocation before frozen creation replay denies receipt and creates no effect',async()=>{
 const f=fixture(),first=f.send();const initial=await first.response;assert.equal(initial.status,201);await initial.arrayBuffer();f.state.fail(first.op);const before=f.db.snapshot();
 f.revoke();const again=f.send(),denied=await again.response;assert.equal(denied.status,404);f.state.fail(again.op);
 assert.equal(f.state.intent()?.status,'unknown');assert.deepEqual(f.db.snapshot(),before);
});

test('invalid persistent cache is a 503 and cannot release or replace unknown creation',async()=>{
 const f=fixture(),first=f.send();const initial=await first.response;assert.equal(initial.status,201);await initial.arrayBuffer();f.state.fail(first.op);const before=f.db.snapshot();
 f.corrupt();const again=f.send(),broken=await again.response;assert.equal(broken.status,503);assert.equal((await broken.json()).code,'invalid_idempotency_result');f.state.fail(again.op);
 assert.throws(()=>f.state.prepare({...input,subject:'Outro pedido'}),/unresolved/);assert.equal(f.state.begin()?.key,first.op.key);assert.deepEqual(f.db.snapshot(),before);
});
