import test from 'node:test';
import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import type {UnitOfWork,Store} from '../src/application/ports.ts';
import type {Principal} from '../src/domain/model.ts';
import {principal,coverage,ticket} from './fixtures.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {readObject} from '../src/http/validation.ts';

const input={accountId:'account-a',productInstanceId:'geolab-production',serviceCode:'SUPPORT',subject:'Contrato durante espera',description:'Fixture local',priority:'normal' as const};
test('contract expiring while coverage rows are awaited is rejected atomically',async()=>{
 const db=new MemoryUnitOfWork({coverages:[coverage({validUntil:'2026-09-16T12:00:01.000Z'})]});
 let now=new Date('2026-09-16T12:00:00.000Z');
 const delayed:UnitOfWork={run:<T>(p:Principal,work:(s:Store)=>Promise<T>)=>db.run(p,s=>work({...s,coverages:async c=>{const rows=await s.coverages(c);now=new Date('2026-09-16T12:00:02.000Z');return rows;}}))};
 await assert.rejects(()=>new HelpdeskService(delayed,()=>now).create(principal(),input,'m1b-expiry-lock-key','test'),{code:'no_coverage'});
 assert.equal(db.snapshot().tickets.length,0);assert.equal(db.snapshot().outbox.length,0);assert.equal(db.snapshot().idempotency.length,0);
});
test('creation timestamp is sampled after coverage-lock wait',async()=>{
 const db=new MemoryUnitOfWork({coverages:[coverage()]});let now=new Date('2026-09-16T12:00:00.000Z');
 const delayed:UnitOfWork={run:<T>(p:Principal,work:(s:Store)=>Promise<T>)=>db.run(p,s=>work({...s,coverages:async c=>{const rows=await s.coverages(c);now=new Date('2026-09-16T12:00:02.000Z');return rows;}}))};
 const result=await new HelpdeskService(delayed,()=>now).create(principal(),input,'m1b-timestamp-key','test');
 assert.equal(result.ticket.createdAt,'2026-09-16T12:00:02.000Z');
});
function http(){return createHttpHandler({service:new HelpdeskService(new MemoryUnitOfWork({tickets:[ticket()]})),authenticate:async()=>principal()});}
for(const q of ['limit=1&limit=100','account_id=account-a&account_id=account-b','cursor=&cursor=other'])
 test('ticket list rejects ambiguous duplicate query: '+q,async()=>{assert.equal((await http()(new Request('https://hd.test/v1/tickets?'+q))).status,400);});
test('ticket list rejects explicitly empty cursor rather than resetting pagination',async()=>{assert.equal((await http()(new Request('https://hd.test/v1/tickets?cursor='))).status,400);});
test('ticket list rejects explicitly empty account filter',async()=>{assert.equal((await http()(new Request('https://hd.test/v1/tickets?account_id='))).status,400);});
for(const length of ['-1','NaN','1.5','1e3','1, 1',''])test('body rejects invalid declared length: '+JSON.stringify(length),async()=>{
 const req=new Request('https://hd.test',{method:'POST',headers:{'content-type':'application/json','content-length':length},body:'{}'});
 await assert.rejects(()=>readObject(req,[]),{status:400});
});
test('body rejects byte count not matching declared length',async()=>{
 const req=new Request('https://hd.test',{method:'POST',headers:{'content-type':'application/json','content-length':'2'},body:'{"body":"abc"}'});
 await assert.rejects(()=>readObject(req,['body']),{status:400});
});
test('body rejects corrupted UTF-8 without storing replacement characters',async()=>{
 const bytes=new Uint8Array([123,34,98,111,100,121,34,58,34,255,34,125]);
 await assert.rejects(()=>readObject(new Request('https://hd.test',{method:'POST',headers:{'content-type':'application/json'},body:bytes}),['body']),{status:400});
});
test('body stream failure returns controlled 400 instead of infrastructure detail',async()=>{
 const body=new ReadableStream({start(c){c.error(new Error('PRIVATE-STREAM-DETAIL'));}});
 const req=new Request('https://hd.test',{method:'POST',headers:{'content-type':'application/json'},body,duplex:'half'} as RequestInit);
 await assert.rejects(()=>readObject(req,[]),(e:unknown)=>{assert.equal((e as {status:number}).status,400);assert.doesNotMatch(String(e),/PRIVATE-STREAM/);return true;});
});
test('body reader supports an explicit bounded deadline without waiting indefinitely',async()=>{
 let cancelled=false;const body=new ReadableStream({cancel(){cancelled=true;}});
 const req=new Request('https://hd.test',{method:'POST',headers:{'content-type':'application/json'},body,duplex:'half'} as RequestInit);
 // Timer closes baseline stream so the regression itself never hangs.
 const stop=setTimeout(()=>{void body.cancel().catch(()=>{});},80);
 const bounded=readObject as (r:Request,a:readonly string[],options?:{timeoutMs:number})=>Promise<unknown>;
 const outcome=await Promise.race([bounded(req,[],{timeoutMs:15}).then(()=>({status:200}),(e:unknown)=>e),new Promise(resolve=>setTimeout(()=>resolve({status:999}),60))]);
 clearTimeout(stop);assert.equal((outcome as {status:number}).status,408);assert.equal(cancelled,true);
});
