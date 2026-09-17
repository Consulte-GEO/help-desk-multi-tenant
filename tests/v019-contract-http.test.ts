/** Real loopback HTTP; authentication and persistence are local synthetic fixtures. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import type {UnitOfWork} from '../src/application/ports.ts';
import type {Coverage} from '../src/domain/model.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {coverage,principal} from './fixtures.ts';

const context={account_id:'account-a',product_instance_id:'geolab-production',service_code:'SUPPORT'};
const body={...context,subject:'V019 contractual HTTP fixture',description:'Synthetic request body',priority:'normal'};
class ExactDate extends Date{readonly exact:string;constructor(exact:string){super(exact);this.exact=exact;}override toISOString(){return this.exact;}}
async function fixture(initial:Coverage[],instant='2026-09-17T12:00:00.123000Z'){
 const db=new MemoryUnitOfWork({coverages:[coverage()]});let source:unknown=initial,now=instant,calls=0;
 const uow:UnitOfWork={run:(p,work)=>db.run(p,s=>work({...s,coverages:async()=>{calls++;return source as Coverage[];}}))};
 const observations:unknown[]=[];
 const handler=createHttpHandler({service:new HelpdeskService(uow,()=>new ExactDate(now)),authenticate:async()=>principal(),observe:e=>{observations.push(e);}});
 const server=createServer(async(req,res)=>{try{
  const chunks:Buffer[]=[];for await(const c of req)chunks.push(Buffer.from(c));const bytes=Buffer.concat(chunks),headers=new Headers();
  for(const [k,v] of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
  const result=await handler(new Request('http://127.0.0.1'+req.url,{method:req.method,headers,...(bytes.length?{body:bytes}:{})}));
  res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch{res.writeHead(500);res.end('{}');}});
 await new Promise<void>((ok,bad)=>{server.once('error',bad);server.listen(0,'127.0.0.1',ok);});
 const address=server.address();assert.ok(address&&typeof address==='object');
 return {db,observations,setSource:(v:unknown)=>{source=v;},setNow:(v:string)=>{now=v;},calls:()=>calls,
  post:(path:string,payload:unknown,key=randomUUID())=>fetch(`http://127.0.0.1:${address.port}/v1${path}`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':key,'x-request-id':randomUUID()},body:JSON.stringify(payload)}),
  close:async()=>{server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}};
}

test('HTTP a future microsecond start produces no_coverage and cannot create side effects',async()=>{
 const f=await fixture([coverage({validFrom:'2026-09-17T12:00:00.123456Z'})]);try{
  const before=f.db.snapshot(),key=randomUUID();
  const resolved=await f.post('/contexts/resolve',context);assert.equal(resolved.status,200);assert.equal((await resolved.json()).status,'no_coverage');
  const denied=await f.post('/tickets',body,key);assert.equal(denied.status,422);assert.equal((await denied.json()).code,'no_coverage');assert.deepEqual(f.db.snapshot(),before);
  f.setNow('2026-09-17T12:00:00.123456Z');
  const created=await f.post('/tickets',body,key);assert.equal(created.status,201);await created.arrayBuffer();assert.equal(f.db.snapshot().tickets.length,1);
 }finally{await f.close();}
});
test('HTTP inconsistent coverage is a safe 503, never a miss, partial candidate or duplicate mutation',async()=>{
 const f=await fixture([coverage()]);try{
  const key=randomUUID(),before=f.db.snapshot();
  f.setSource([coverage(),{...coverage({id:'bad',accountId:'foreign-account'}),policy:{private:'SENTINEL-FOREIGN-CONTRACT'}}]);
  for(const [path,payload] of [['/contexts/resolve',context],['/tickets',{...body,coverage_id:'coverage-a'}]] as const){
   const result=await f.post(path,payload,key),text=await result.text();assert.equal(result.status,503);assert.equal(JSON.parse(text).code,'invalid_coverage_result');
   assert.equal(result.headers.get('cache-control'),'no-store');assert.equal(result.headers.get('idempotency-replayed'),null);
   assert.doesNotMatch(text,/SENTINEL|foreign-account|coverage-a/);assert.deepEqual(f.db.snapshot(),before);
  }
  assert.match(JSON.stringify(f.observations),/invalid_coverage_result/);assert.doesNotMatch(JSON.stringify(f.observations),/SENTINEL|foreign-account|Synthetic request/);
  f.setSource([coverage()]);const first=await f.post('/tickets',body,key);assert.equal(first.status,201);const original=await first.json();
  const again=await f.post('/tickets',body,key);assert.equal(again.status,200);assert.deepEqual(await again.json(),original);assert.equal(f.db.snapshot().tickets.length,1);
 }finally{await f.close();}
});
test('HTTP a still-valid microsecond expiry permits creation; replay after expiry keeps the historical snapshot',async()=>{
 const until='2026-09-17T12:00:00.123457Z';
 const f=await fixture([coverage({validFrom:'2026-09-17T09:00:00.123456-03:00',validUntil:until})],'2026-09-17T12:00:00.123456Z');try{
  const resolved=await f.post('/contexts/resolve',context);assert.equal(resolved.status,200);const resolution=await resolved.json();
  assert.equal(resolution.status,'resolved');assert.equal(resolution.candidates[0].valid_until,until);
  const key=randomUUID(),first=await f.post('/tickets',body,key);assert.equal(first.status,201);const original=await first.json(),before=f.db.snapshot(),calls=f.calls();
  f.setNow(until);f.setSource(null); // Current coverage is deliberately unreadable: replay must not resolve it.
  const replay=await f.post('/tickets',body,key);assert.equal(replay.status,200);assert.equal(replay.headers.get('idempotency-replayed'),'true');assert.deepEqual(await replay.json(),original);
  assert.equal(f.calls(),calls);assert.deepEqual(f.db.snapshot(),before);
  f.setSource([coverage({validUntil:until})]);
  const next=await f.post('/tickets',body,randomUUID());assert.equal(next.status,422);assert.equal((await next.json()).code,'no_coverage');assert.deepEqual(f.db.snapshot(),before);
 }finally{await f.close();}
});
