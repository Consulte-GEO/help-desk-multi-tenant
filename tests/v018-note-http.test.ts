/** Real loopback HTTP, controlled pg protocol/identity. This does not execute SQL or RLS. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createServer} from 'node:http';import {randomUUID} from 'node:crypto';
import {noteDriver} from './helpers/v018-driver.ts';
import {PostgresUnitOfWork} from '../src/infrastructure/postgres.ts';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {createHttpHandler} from '../src/http/handler.ts';
async function fixture(){
 const f=noteDriver(),logs:unknown[]=[];
 const handler=createHttpHandler({service:new HelpdeskService(new PostgresUnitOfWork(f.pool)),authenticate:async()=>f.p,observe:e=>{logs.push(e);}});
 const server=createServer(async(req,res)=>{try{
  const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks);
  const headers=new Headers();for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
  const r=await handler(new Request('http://127.0.0.1'+req.url,{method:req.method,headers,...(body.length?{body}:{})}));
  res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
 }catch{res.writeHead(500);res.end('{}');}});
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const address=server.address();assert.ok(address&&typeof address==='object');const base=`http://127.0.0.1:${address.port}/v1/tickets/${f.t.id}`;
 return {...f,logs,get:(suffix='')=>fetch(base+suffix),post:(suffix:string,body:unknown,key:string)=>fetch(base+suffix,{method:'POST',headers:{'content-type':'application/json','idempotency-key':key},body:JSON.stringify(body)}),
  close:async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}};
}
test('HTTP note-only operator can create/replay a receipt but cannot read notes or write public messages',async()=>{
 const f=await fixture();try{
  const detail=await f.get();assert.equal(detail.status,200);const actions=(await detail.json()).available_actions;
  assert.equal(actions.add_note,true);assert.equal(actions.read_notes,false);assert.equal(actions.reply,false);
  const key=randomUUID(),body={body:'SYNTHETIC-INTERNAL-NOTE'};
  const first=await f.post('/notes',body,key);assert.equal(first.status,201);assert.equal(first.headers.get('idempotency-replayed'),'false');const receipt=await first.json();
  const again=await f.post('/notes',body,key);assert.equal(again.status,200);assert.equal(again.headers.get('idempotency-replayed'),'true');assert.deepEqual(await again.json(),receipt);
  for(const response of [await f.get('/notes'),await f.post('/messages',body,randomUUID())]){assert.equal(response.status,403);assert.doesNotMatch(await response.text(),/SYNTHETIC-INTERNAL-NOTE/);}
  assert.equal(f.snapshot().notes.length,1);assert.equal(f.snapshot().events.length,1);assert.equal(f.snapshot().cache.size,1);
  assert.ok(!f.calls.some(c=>/for update|update helpdesk_core.tickets|insert into helpdesk_integration.outbox_events/i.test(c.sql)));
 }finally{await f.close();}
});
test('HTTP zero-row cache INSERT rolls back the note before COMMIT; explicit retry creates once',async()=>{
 const f=await fixture();try{
  const key=randomUUID(),body={body:'SYNTHETIC-PRIVATE-DO-NOT-LOG'};
  f.failWith(sql=>sql.startsWith('insert into helpdesk_integration.api_idempotency_keys')?{command:'INSERT',rows:[],rowCount:0}:undefined);
  const response=await f.post('/notes',body,key),text=await response.text();assert.equal(response.status,503);assert.equal(JSON.parse(text).code,'invalid_database_write_result');assert.equal(response.headers.get('cache-control'),'no-store');
  assert.doesNotMatch(text,/SYNTHETIC|api_idempotency_keys|INSERT/);assert.deepEqual(f.snapshot(),{notes:[],events:[],cache:new Map()});
  assert.ok(f.calls.some(c=>c.sql==='ROLLBACK'));assert.ok(!f.calls.some(c=>c.sql==='COMMIT'));
  assert.match(JSON.stringify(f.logs),/invalid_database_write_result/);assert.doesNotMatch(JSON.stringify(f.logs),/SYNTHETIC|api_idempotency_keys/);
  f.failWith(()=>undefined);const retry=await f.post('/notes',body,key);assert.equal(retry.status,201);const saved=await retry.json();
  const replay=await f.post('/notes',body,key);assert.equal(replay.status,200);assert.deepEqual(await replay.json(),saved);
  assert.equal(f.snapshot().notes.length,1);assert.equal(f.snapshot().cache.size,1);
 }finally{await f.close();}
});
test('HTTP invalid acknowledgement at the first INSERT cannot reach the event, cache or COMMIT',async()=>{
 const f=await fixture();try{
  f.failWith(sql=>sql.startsWith('insert into helpdesk_core.internal_notes')?{command:'SELECT',rows:[{secret:'SYNTHETIC-PRIVATE'}],rowCount:1}:undefined);
  const r=await f.post('/notes',{body:'Private note'},randomUUID());assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/SYNTHETIC|internal_notes/);
  assert.ok(!f.calls.some(c=>/insert into helpdesk_core.ticket_events|insert into helpdesk_integration.api_idempotency_keys|^COMMIT$/i.test(c.sql)));
  assert.deepEqual(f.snapshot(),{notes:[],events:[],cache:new Map()});
 }finally{await f.close();}
});
