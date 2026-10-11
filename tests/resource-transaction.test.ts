import test from 'node:test';
import assert from 'node:assert/strict';
import {createResourceAccessResolver} from '../src/application/resource-access.ts';
import type {Principal} from '../src/domain/model.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';

// Real resolver/transaction engine; only Auth authority and connection are synthetic.
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const T='2026-10-09T12:00:00.000000Z',EXP='2026-10-09T12:00:02.000000Z';
const refs=[{connectionId:id(4),tenantId:'T1',type:'work',id:'0001'}];
const denied={code:'resource_scope_denied'},unavailable={code:'resource_scope_unavailable'};
function fixture(){
 let tick=T,reads=0;
 const p:Principal={id:id(2),workspaceId:id(1),kind:'human',workspaceRole:null,grants:[{accountId:id(3),role:'requester'}],scopes:['tickets:read','tickets:write']};
 const a=createResourceAccessResolver({manifestFingerprint:'a'.repeat(64),maxAgeMicros:10_000_000n,timeoutMs:1000,
  clock:()=>tick,authority:{readAccess:async()=>{reads++;return {principal:structuredClone(p),operation:'tickets.write',
   binding:{id:id(5),accountId:id(3),workspaceId:id(1),connectionId:id(4),tenantId:'T1',active:true,revision:'binding-r1'},
   accessRevision:'access-r1',manifestFingerprint:'a'.repeat(64),asOf:T,expiresAt:EXP,resources:refs};}}});
 let acquireHook:()=>void|Promise<void>=()=>{},queryHook:(sql:string)=>void|Promise<void>=()=>{};
 const calls:string[]=[],values:unknown[][]=[],released:unknown[]=[];
 const pool:SqlPool={connect:async()=>{await acquireHook();return {query:async(sql,v)=>{calls.push(sql);values.push(v??[]);await queryHook(sql);return {rows:[{value:1}],rowCount:1,command:sql.startsWith('select')?'SELECT':sql};},release:e=>{released.push(e);}};},
  query:async()=>{throw Error('pool.query must not be used');},end:async()=>{}};
 return {p,a,pool,calls,values,released,reads:()=>reads,time:(t:string)=>{tick=t;},acquire:(fn:typeof acquireHook)=>{acquireHook=fn;},query:(fn:typeof queryHook)=>{queryHook=fn;},
  resolve:()=>a.resolveResourceScope(p,refs,'tickets.write')};
}
function verify(f:ReturnType<typeof fixture>,p:Principal,ctx:unknown,lease:unknown){
 const fn=(f.a as any).assertResourceScopeCurrent;
 assert.equal(typeof fn,'function','CG03c resolver must own an active callback lease');fn(p,ctx,lease);
}
async function runner(){
 const path='../src/infrastructure/resource-transaction.ts';
 const api=await import(path).catch((e:unknown)=>{if((e as any).code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof api.runResourceTransaction,'function','CG03c resource transaction bridge is missing');
 return api.runResourceTransaction as (pool:SqlPool,resolver:any,p:Principal,refs:any,op:string,proof:unknown,work:(c:any,ctx:any)=>Promise<any>,signal?:AbortSignal)=>Promise<any>;
}
async function use(f:ReturnType<typeof fixture>,proof:unknown,work:(c:any,ctx:any)=>Promise<any>,signal?:AbortSignal){
 const run=await runner();return run(f.pool,f.a,f.p,refs,'tickets.write',proof,work,signal);
}
for(const kind of ['resolved async','rejected async','non-void sync'] as const)test('CG03c rejects '+kind+' additional admission before acquiring the pool',async()=>{
 const f=fixture(),proof=await f.resolve();let acquired=0,work=0;
 f.acquire(()=>{acquired++;});
 const guard=kind==='resolved async'?async()=>false:kind==='rejected async'?async()=>{throw Error('Synthetic admission failure');}:()=>false;
 const run=await runner() as (...args:any[])=>Promise<unknown>;
 await assert.rejects(run(f.pool,f.a,f.p,refs,'tickets.write',proof,async()=>{work++;},undefined,guard),{code:'database_unavailable'});
 assert.equal(acquired,0);assert.equal(work,0);assert.deepEqual(f.calls,[]);
});
const within=(f:ReturnType<typeof fixture>,proof:unknown,fn:(ctx:any,lease:any)=>Promise<any>,signal?:AbortSignal)=>
 (f.a.withResourceScope as any)(f.p,refs,'tickets.write',proof,fn,signal);

test('CG03c lease is opaque, callback-owned and invalid after successful return',async()=>{
 const f=fixture(),proof=await f.resolve();let saved:any;
 await within(f,proof,async(ctx,lease)=>{verify(f,f.p,ctx,lease);assert.equal(JSON.stringify(lease),'{}');assert.ok(Object.isFrozen(lease));saved={ctx,lease};});
 assert.throws(()=>verify(f,f.p,saved.ctx,saved.lease),denied);assert.equal(f.reads(),2);
});
test('CG03c lease ends on business error without converting or retrying the error',async()=>{
 const f=fixture(),proof=await f.resolve();let saved:any,calls=0;const failure=Error('business failure');
 await assert.rejects(within(f,proof,async(ctx,lease)=>{calls++;verify(f,f.p,ctx,lease);saved={ctx,lease};throw failure;}),e=>e===failure);
 assert.equal(calls,1);assert.throws(()=>verify(f,f.p,saved.ctx,saved.lease),denied);
});
test('CG03c copied or manufactured lease and other factory are refused',async()=>{
 const f=fixture(),g=fixture(),proof=await f.resolve();
 await within(f,proof,async(ctx,lease)=>{
  verify(f,f.p,ctx,lease);
  for(const fake of [{},true,JSON.parse(JSON.stringify(lease)),proof])assert.throws(()=>verify(f,f.p,ctx,fake),denied);
  assert.throws(()=>verify(g,f.p,ctx,lease),denied);verify(f,f.p,ctx,lease);
 });
});
test('CG03c replacing the context cannot reuse the active lease',async()=>{
 const f=fixture(),proof=await f.resolve();
 await within(f,proof,async(ctx,lease)=>{assert.throws(()=>verify(f,f.p,{...ctx},lease),denied);assert.throws(()=>verify(f,f.p,ctx,lease),denied);});
});
test('CG03c scope expiry observed in a callback cannot revive after clock restoration',async()=>{
 const f=fixture(),proof=await f.resolve();
 await within(f,proof,async(ctx,lease)=>{f.time(EXP);assert.throws(()=>verify(f,f.p,ctx,lease),denied);f.time(T);assert.throws(()=>verify(f,f.p,ctx,lease),denied);});
});
test('CG03c mutation of permissions during a callback invalidates the active lease permanently',async()=>{
 const f=fixture(),proof=await f.resolve();
 await within(f,proof,async(ctx,lease)=>{f.p.scopes.push('notes:read');assert.throws(()=>verify(f,f.p,ctx,lease),denied);f.p.scopes.pop();assert.throws(()=>verify(f,f.p,ctx,lease),denied);});
});
test('CG03c microsecond clock rollback between SQL checks invalidates admission',async()=>{
 const f=fixture(),proof=await f.resolve();
 await within(f,proof,async(ctx,lease)=>{
  f.time('2026-10-09T12:00:00.000002Z');verify(f,f.p,ctx,lease);
  f.time('2026-10-09T12:00:00.000001Z');assert.throws(()=>verify(f,f.p,ctx,lease),unavailable);
 });
});
test('CG03c cancel after authority validation is checked during the active callback',async()=>{
 const f=fixture(),proof=await f.resolve(),abort=new AbortController();
 await within(f,proof,async(ctx,lease)=>{verify(f,f.p,ctx,lease);abort.abort();assert.throws(()=>verify(f,f.p,ctx,lease),unavailable);},abort.signal);
});
test('CG03c a closed concurrent lease does not invalidate another callback',async()=>{
 const f=fixture(),a=await f.resolve(),b=await f.resolve();let release!:()=>void,saved:any;
 const wait=new Promise<void>(r=>{release=r;});
 const first=within(f,a,async(ctx,lease)=>{saved={ctx,lease};await wait;verify(f,f.p,ctx,lease);});
 try{await new Promise<void>(r=>setImmediate(r));await within(f,b,async(ctx,lease)=>verify(f,f.p,ctx,lease));verify(f,f.p,saved.ctx,saved.lease);}finally{release();}
 await first;
});
test('CG03c resource transaction uses one connection, two authority reads and original identity',async()=>{
 const f=fixture(),proof=await f.resolve();
 assert.equal(await use(f,proof,async(c,ctx)=>{assert.deepEqual(ctx.refs,refs);await c.query('select business');return 9;}),9);
 assert.equal(f.reads(),2);assert.deepEqual(f.values[1],[id(1),id(2)]);assert.equal(f.calls.at(-1),'COMMIT');assert.equal(f.released.length,1);
});
for(const boundary of ['pool','BEGIN','context'] as const)test('CG03c expiration during '+boundary+' prevents business execution',async()=>{
 const f=fixture(),proof=await f.resolve();let work=0;
 if(boundary==='pool')f.acquire(()=>f.time(EXP));else f.query(sql=>{if(boundary==='BEGIN'?sql==='BEGIN':sql.startsWith('select set_config'))f.time(EXP);});
 await assert.rejects(use(f,proof,async()=>{work++;}),denied);assert.equal(work,0);assert.equal(f.calls.includes('COMMIT'),false);
 assert.equal(f.released.length,1);if(boundary==='pool')assert.deepEqual(f.calls,[]);else assert.equal(f.calls.at(-1),'ROLLBACK');
});
test('CG03c swallowed expiration cannot commit an earlier business write',async()=>{
 const f=fixture(),proof=await f.resolve();
 await assert.rejects(use(f,proof,async(c)=>{
  await c.query('insert synthetic_work');f.time(EXP);
  await assert.rejects(c.query('select denied'),denied);f.time(T);return 'must not commit';
 }),denied);
 assert.equal(f.calls.includes('select denied'),false);assert.equal(f.calls.at(-1),'ROLLBACK');assert.equal(f.calls.includes('COMMIT'),false);
});
test('CG03c cancellation during business work prevents commit even with no additional query',async()=>{
 const f=fixture(),proof=await f.resolve(),abort=new AbortController();
 await assert.rejects(use(f,proof,async(c)=>{await c.query('insert synthetic_work');abort.abort();},abort.signal),unavailable);
 assert.equal(f.calls.at(-1),'ROLLBACK');
});
test('CG03c context returned by an ended callback is not a new transaction proof',async()=>{
 const f=fixture(),proof=await f.resolve();const ctx=await use(f,proof,async(_c,ctx)=>ctx);
 const count=f.calls.length;await assert.rejects(use(f,ctx,async()=>assert.fail()),denied);assert.equal(f.calls.length,count);
});
test('CG03c an acknowledged commit is not undone by expiration while acknowledgement arrives',async()=>{
 const f=fixture(),proof=await f.resolve();f.query(sql=>{if(sql==='COMMIT')f.time(EXP);});
 assert.equal(await use(f,proof,async()=>42),42);assert.equal(f.calls.at(-1),'COMMIT');
});
test('CG03c uncertain commit preserves outcome-unknown and one-use proof',async()=>{
 const f=fixture(),proof=await f.resolve();f.query(sql=>{if(sql==='COMMIT'){f.time(EXP);throw Error('lost acknowledgement');}});
 await assert.rejects(use(f,proof,async()=>42),{code:'transaction_outcome_unknown'});
 await assert.rejects(use(f,proof,async()=>assert.fail()),denied);assert.equal(f.calls.filter(x=>x==='COMMIT').length,1);
});
test('CG03c releasing connection does not leak a usable SQL capability after callback return',async()=>{
 const f=fixture(),proof=await f.resolve();let retained:any;
 await use(f,proof,async c=>{retained=c;});await assert.rejects(retained.query('select late'),{code:'database_unavailable'});
 assert.equal(f.calls.includes('select late'),false);
});
