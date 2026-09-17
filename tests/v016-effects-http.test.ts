/** Real local HTTP transport. Synthetic identity + memory, not hosted PostgreSQL. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {randomUUID} from 'node:crypto';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import type {Store} from '../src/application/ports.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {principal,ticket} from './fixtures.ts';
const tid='16000000-0000-4000-8000-000000000001';
async function fixture(){
 const db=new MemoryUnitOfWork({tickets:[ticket({id:tid})]});
 let alteration:(s:Store)=>Store=s=>s;const logs:unknown[]=[];
 const service=new HelpdeskService({run:(p,f)=>db.run(p,s=>f(alteration(s)))});
 const handler=createHttpHandler({service,authenticate:async()=>principal({workspaceRole:'admin'}),observe:e=>{logs.push(e);}});
 const server=createServer(async(req,res)=>{try{
  const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks);
  const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
  const response=await handler(new Request('http://127.0.0.1'+req.url,{method:req.method,headers,...(body.length?{body}:{})}));
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('{}');}});
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const a=server.address();assert.ok(a&&typeof a==='object');
 return {db,logs,alter:(fn:typeof alteration)=>{alteration=fn;},
  post:(kind:string,body:unknown,key:string)=>fetch(`http://127.0.0.1:${a.port}/v1/tickets/${tid}/${kind}`,{
   method:'POST',headers:{'content-type':'application/json','idempotency-key':key,'if-match':'"1"','x-request-id':randomUUID()},body:JSON.stringify(body)}),
  close:async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
for(const loss of ['event','outbox'] as const)test(`HTTP ${loss} omitted silently: no success, no partial state, explicit retry only`,async()=>{
 const f=await fixture();try{
  const key=randomUUID(),body={body:'SENTINEL-not-for-logs'},before=f.db.snapshot();
  f.alter(s=>({...s,...(loss==='event'?{addEvent:async()=>{}}:{enqueue:async()=>{}})}));
  const failed=await f.post('messages',body,key),text=await failed.text();
  assert.equal(failed.status,503);assert.equal(JSON.parse(text).code,'transaction_effect_mismatch');assert.equal(failed.headers.get('cache-control'),'no-store');
  assert.doesNotMatch(text,/SENTINEL|person-a|account-a/);assert.deepEqual(f.db.snapshot(),before);
  assert.match(JSON.stringify(f.logs),/transaction_effect_mismatch/);assert.doesNotMatch(JSON.stringify(f.logs),/SENTINEL/);
  f.alter(s=>s);const retry=await f.post('messages',body,key);assert.equal(retry.status,201);const original=await retry.json();
  const repeated=await f.post('messages',body,key);assert.equal(repeated.status,200);assert.deepEqual(await repeated.json(),original);
  assert.equal(f.db.snapshot().messages.length,1);assert.equal(f.db.snapshot().events.length,1);assert.equal(f.db.snapshot().outbox.length,1);
 }finally{await f.close();}
});
test('HTTP orphaned note produces no private data or success and no external delivery',async()=>{
 const f=await fixture();try{
  f.alter(s=>({...s,addEvent:async()=>{}}));const denied=await f.post('notes',{body:'SENTINEL-internal'},randomUUID());
  assert.equal(denied.status,503);assert.doesNotMatch(await denied.text(),/SENTINEL/);assert.equal(f.db.snapshot().notes.length,0);
  f.alter(s=>s);const good=await f.post('notes',{body:'SENTINEL-internal'},randomUUID());assert.equal(good.status,201);await good.arrayBuffer();
  assert.equal(f.db.snapshot().notes.length,1);assert.equal(f.db.snapshot().events[0]?.customerVisible,false);assert.equal(f.db.snapshot().outbox.length,0);
 }finally{await f.close();}
});
