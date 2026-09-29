import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {runTransaction,withControlTransactions} from '../src/infrastructure/transaction.ts';
import {PostgresUnitOfWork} from '../src/infrastructure/postgres.ts';
import {HelpdeskError} from '../src/domain/errors.ts';
import {principal} from './fixtures.ts';
import {transactionEventFixture,rawFailure} from './helpers/transaction-event-fixture.ts';
import type {SqlClient} from '../src/infrastructure/sql.ts';

// Child isolation is essential: the pre-fix async error must be observed without crashing this test runner.
for(const fault of ['begin','settings','work','commit','rollback','release','idle-work','after-release']){
 test('owned transaction client event is safe at '+fault,()=>{
  const script=`
   import {runTransaction} from './src/infrastructure/transaction.ts';
   import {transactionEventFixture,rawFailure} from './tests/helpers/transaction-event-fixture.ts';
   const h=transactionEventFixture(${JSON.stringify(['idle-work','after-release'].includes(fault)?'none':fault)});
   let code=null,value=null;
   try{value=await runTransaction(h.pool,undefined,async client=>{
    if(${JSON.stringify(fault)}==='idle-work')await new Promise(resolve=>setImmediate(()=>{h.client.emit('error',rawFailure());resolve();}));
    if(${JSON.stringify(fault)}==='rollback')throw Error('Synthetic callback rejection');
    await client.query('select 42');return 42;
   });}catch(e){code=e.code??'unmapped_error';}
   if(${JSON.stringify(fault)}==='after-release')await new Promise(resolve=>setImmediate(()=>{h.client.emit('error',rawFailure());resolve();}));
   console.log(JSON.stringify({code,value,calls:h.calls,releases:h.releases.map(e=>e?e.message:null),state:h.state()}));
  `;
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script],
   {encoding:'utf8',cwd:new URL('../',import.meta.url),env,timeout:5000});
  assert.equal(result.status,0,'Event must not crash the process: '+result.stderr);
  assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_TRANSACTION_SENTINEL|confidential driver/);
  const out=JSON.parse(result.stdout);
  assert.equal(out.state.connects,1);assert.equal(out.releases.length,1);
  if(fault==='release'||fault==='after-release'){
   // A connection error after an acknowledged COMMIT does not undo a confirmed write.
   assert.equal(out.value,42);assert.equal(out.code,null);
  }else{
   assert.equal(out.value,null);assert.equal(out.code,fault==='commit'?'transaction_outcome_unknown':'database_unavailable');
   assert.ok(out.releases[0]);
   if(fault!=='commit')assert.ok(!out.calls.includes('COMMIT'));
   if(fault!=='rollback')assert.ok(!out.calls.includes('ROLLBACK'),'No new SQL after a fatal event');
  }
 });
}

test('callback cannot dispatch another statement after catching a fatal client event',async()=>{
 const h=transactionEventFixture();const other=()=>{};h.client.on('error',other);let rejected=false;
 await assert.rejects(()=>runTransaction(h.pool,undefined,async client=>{
  await client.query('select 1');h.client.emit('error',rawFailure());
  try{await client.query('select MUST_NOT_RUN');}catch{rejected=true;}
  return 42;
 }),{status:503,code:'database_unavailable'});
 assert.equal(rejected,true);assert.ok(!h.calls.includes('select MUST_NOT_RUN'));assert.ok(!h.calls.includes('COMMIT'));
 assert.ok(h.client.listeners('error').includes(other));assert.equal(h.releases.length,1);assert.ok(h.releases[0]);
});

test('an error between callback completion and COMMIT causes no commit dispatch',async()=>{
 const h=transactionEventFixture();h.client.on('error',()=>{});
 await assert.rejects(()=>runTransaction(h.pool,undefined,async()=>{
  queueMicrotask(()=>h.client.emit('error',rawFailure()));return 1;
 }),{status:503,code:'database_unavailable'});
 assert.ok(!h.calls.includes('COMMIT'));assert.ok(!h.calls.includes('ROLLBACK'));
});

test('one permanent error guard per physical client prevents listener accumulation on reuse',async()=>{
 const h=transactionEventFixture();const other=()=>{};h.client.on('error',other);
 for(let i=0;i<25;i++)assert.equal(await runTransaction(h.pool,undefined,async c=>(await c.query('select 42')).rows[0]?.answer),42);
 assert.equal(h.client.listenerCount('error'),2);assert.ok(h.client.listeners('error').includes(other));
 assert.equal(h.releases.length,25);assert.ok(h.releases.every(e=>e===undefined));
});

test('a failed physical client returned by an adapter cannot be reused for a second transaction',async()=>{
 const h=transactionEventFixture();h.client.on('error',()=>{});
 await runTransaction(h.pool,undefined,async()=>1);h.client.emit('error',rawFailure());const count=h.calls.length;
 await assert.rejects(()=>runTransaction(h.pool,undefined,async()=>2),{status:503,code:'database_unavailable'});
 assert.equal(h.calls.length,count);assert.ok(h.releases.at(-1));
});

test('borrowed callback client cannot run SQL after its transaction has completed',async()=>{
 const h=transactionEventFixture();let borrowed:SqlClient|undefined;
 await runTransaction(h.pool,undefined,async c=>{borrowed=c;return 7;});const count=h.calls.length;
 await assert.rejects(()=>borrowed!.query('select LATE_QUERY'),{status:503,code:'database_unavailable'});
 assert.equal(h.calls.length,count);
});

test('borrowed callback cannot release its connection early',async()=>{
 const h=transactionEventFixture();
 await assert.rejects(()=>runTransaction(h.pool,undefined,async c=>{c.release();return 1;}),{status:503,code:'database_unavailable'});
 assert.equal(h.releases.length,1);assert.equal(h.calls.at(-1),'ROLLBACK');assert.ok(!h.calls.includes('COMMIT'));
});

test('control transactions are guarded without extra BEGIN or identity inheritance',async()=>{
 const h=transactionEventFixture();const raw=h.client.query.bind(h.client);h.client.on('error',()=>{});
 h.client.query=async(sql,values)=>{const result=await raw(sql,values);if(sql==='select helper()')h.client.emit('error',rawFailure());return result;};
 await assert.rejects(()=>withControlTransactions(h.pool).query('select helper()'),{status:503,code:'database_unavailable'});
 assert.equal(h.calls.filter(s=>s==='BEGIN').length,1);assert.equal(h.calls.filter(s=>s==='select helper()').length,1);
 assert.ok(!h.calls.includes('COMMIT'));assert.ok(!h.calls.includes('ROLLBACK'));assert.ok(h.releases[0]);
});

test('PostgresUnitOfWork does not repeat domain work when the leased client fails',async()=>{
 const h=transactionEventFixture();h.client.on('error',()=>{});let works=0;
 await assert.rejects(()=>new PostgresUnitOfWork(h.pool).run(principal(),async()=>{
  works++;h.client.emit('error',rawFailure());return 17;
 }),{status:503,code:'database_unavailable'});
 assert.equal(works,1);assert.equal(h.state().connects,1);assert.ok(!h.calls.includes('COMMIT'));
});

test('ordinary SQL rejection preserves its code and confirms one rollback for reuse',async()=>{
 const h=transactionEventFixture();const query=h.client.query.bind(h.client);const sqlError=Object.assign(Error('Fixture SQL rejection'),{code:'22012'});
 h.client.query=async(sql,values)=>{if(sql==='select 1/0')throw sqlError;return query(sql,values);};
 await assert.rejects(()=>runTransaction(h.pool,undefined,c=>c.query('select 1/0')),e=>e===sqlError);
 assert.equal(h.calls.filter(s=>s==='ROLLBACK').length,1);assert.deepEqual(h.releases,[undefined]);
 assert.equal(await runTransaction(h.pool,undefined,async()=>42),42);
});

test('domain failure remains unchanged after a confirmed rollback',async()=>{
 const h=transactionEventFixture();const expected=new HelpdeskError(409,'conflict','Synthetic conflict');
 await assert.rejects(()=>runTransaction(h.pool,undefined,async()=>{throw expected;}),e=>e===expected);
 assert.equal(h.calls.at(-1),'ROLLBACK');assert.deepEqual(h.releases,[undefined]);
});

test('release gate requires runtime-event regressions and the three real PostgreSQL scenarios',async()=>{
 const modulePath='../scripts/homologation-core.mjs';const {steps}=await import(modulePath);
 assert.ok(steps.find((s:{id:string})=>s.id==='application').minTests>=1133);
 assert.ok(steps.find((s:{id:string})=>s.id==='postgres').minTests>=207);
});
