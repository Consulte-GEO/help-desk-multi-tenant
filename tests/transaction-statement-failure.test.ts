import test from 'node:test';
import assert from 'node:assert/strict';
import {runTransaction} from '../src/infrastructure/transaction.ts';
import {HelpdeskError} from '../src/domain/errors.ts';
import type {SqlClient,SqlPool,SqlResult} from '../src/infrastructure/sql.ts';

const refused={status:503,code:'transaction_statement_failed'};
const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
/** Controlled transport only. A client-side rejection need not abort a server
 * transaction: this model deliberately remains able to acknowledge COMMIT.
 * It proves runner orchestration, not PostgreSQL durability or RLS.
 */
function fixture(cause:unknown=Error('private-parameter-detail'),mode:'sync'|'async'='async'){
 const calls:string[]=[],releases:(Error|undefined)[]=[],durable:string[]=[];
 let staged:string[]=[];
 const client:SqlClient={query(sql):Promise<SqlResult>{
  const tag=sql.startsWith('select set_config')?'CONTEXT':sql;calls.push(tag);
  if(tag==='FAIL'){
   if(mode==='sync')throw cause;
   return Promise.reject(cause);
  }
  if(tag==='BEGIN')staged=[];
  if(tag==='WRITE')staged.push('synthetic effect');
  if(tag==='DECODE_FAIL'){staged.push('synthetic decoded effect');return Promise.reject(cause);}
  if(tag==='COMMIT')durable.push(...staged);
  if(tag==='ROLLBACK')staged=[];
  return Promise.resolve({command:tag==='CONTEXT'?'SELECT':tag,rows:[],rowCount:null});
 },release:error=>{calls.push('RELEASE');releases.push(error);}};
 const pool:SqlPool={connect:async()=>client,query:async()=>{throw Error('No pool query');},end:async()=>{}};
 return {pool,calls,releases,durable};
}
for(const mode of ['sync','async'] as const)test('CG03i caught '+mode+' client rejection cannot confirm earlier statements',async()=>{
 const f=fixture(undefined,mode);
 await assert.rejects(runTransaction(f.pool,undefined,async c=>{
  await c.query('WRITE');await c.query('FAIL').catch(()=>{});return 'must not become success';
 }),refused);
 assert.equal(f.calls.includes('COMMIT'),false);assert.deepEqual(f.durable,[]);
 assert.deepEqual(f.calls,['BEGIN','CONTEXT','WRITE','FAIL','ROLLBACK','RELEASE']);
 assert.deepEqual(f.releases,[undefined]);
});
test('CG03i a failed statement permanently closes new statement admission in that transaction',async()=>{
 const f=fixture();
 await assert.rejects(runTransaction(f.pool,undefined,async c=>{
  await c.query('FAIL').catch(()=>{});
  for(let i=0;i<2;i++)await assert.rejects(c.query('AFTER_FAILURE'),refused);
  return 'cannot restore a failed transaction';
 }),refused);
 assert.equal(f.calls.includes('AFTER_FAILURE'),false);assert.equal(f.calls.includes('COMMIT'),false);
});
test('CG03i discarded rejection already settled before callback completion is still a failure',async()=>{
 const f=fixture();
 await assert.rejects(runTransaction(f.pool,undefined,async c=>{
  void c.query('FAIL');await turn();return 'all promises settled is not all statements succeeded';
 }),refused);
 assert.equal(f.calls.includes('COMMIT'),false);assert.equal(f.calls.filter(s=>s==='ROLLBACK').length,1);
});
test('CG03i allSettled cannot turn a failed batch into an acknowledged transaction',async()=>{
 const f=fixture();
 await assert.rejects(runTransaction(f.pool,undefined,async c=>{
  const results=await Promise.allSettled([c.query('WRITE'),c.query('FAIL')]);
  assert.equal(results.filter(x=>x.status==='rejected').length,1);return results;
 }),refused);
 assert.equal(f.calls.includes('COMMIT'),false);assert.deepEqual(f.durable,[]);
});
for(const cause of [undefined,null,0,false])test('CG03i falsy rejection '+String(cause)+' cannot disappear',async()=>{
 // Avoid the fixture default so undefined is also the actual rejected reason.
 const f=fixture();const original=f.pool.connect;
 f.pool.connect=async()=>{const c=await original();return {...c,query(sql,values){
  if(sql==='FALSY_FAILURE')return Promise.reject(cause);return c.query(sql,values);
 }};};
 await assert.rejects(runTransaction(f.pool,undefined,async c=>{
  await c.query('WRITE');await c.query('FALSY_FAILURE').catch(()=>{});return 1;
 }),refused);
 assert.equal(f.calls.includes('COMMIT'),false);assert.deepEqual(f.durable,[]);
});
test('CG03i failed decoding after a simulated statement effect also forces rollback',async()=>{
 const f=fixture();
 await assert.rejects(runTransaction(f.pool,undefined,async c=>{
  await c.query('DECODE_FAIL').catch(()=>{});return 'a server effect is not a usable successful response';
 }),refused);
 assert.deepEqual(f.durable,[]);assert.equal(f.calls.includes('COMMIT'),false);
});
test('CG03i an awaited failure that leaves the callback preserves its exact cause',async()=>{
 const cause=Error('original failure'),f=fixture(cause);
 await assert.rejects(runTransaction(f.pool,undefined,c=>c.query('FAIL')),error=>error===cause);
 assert.deepEqual(f.calls,['BEGIN','CONTEXT','FAIL','ROLLBACK','RELEASE']);
});
test('CG03i the callback original failure is not replaced by the latched statement failure',async()=>{
 const cause=new HelpdeskError(409,'synthetic_callback_rejection','Synthetic rejection'),f=fixture();
 await assert.rejects(runTransaction(f.pool,undefined,async c=>{
  await c.query('FAIL').catch(()=>{});throw cause;
 }),error=>error===cause);
 assert.equal(f.calls.includes('COMMIT'),false);
});
test('CG03i safe refusal does not expose a swallowed driver message',async()=>{
 const f=fixture(Error('private-parameter-detail'));
 await assert.rejects(runTransaction(f.pool,undefined,async c=>{await c.query('FAIL').catch(()=>{});}),error=>{
  assert.ok(error instanceof HelpdeskError);assert.equal(error.code,refused.code);
  assert.doesNotMatch(error.message,/private-parameter-detail/);return true;
 });
});
test('CG03i statement failure is transaction-local, not a permanent failure of a healthy pooled client',async()=>{
 const f=fixture();
 await assert.rejects(runTransaction(f.pool,undefined,async c=>{await c.query('FAIL').catch(()=>{});}),refused);
 assert.equal(await runTransaction(f.pool,undefined,async c=>{await c.query('WRITE');return 7;}),7);
 assert.deepEqual(f.durable,['synthetic effect']);assert.deepEqual(f.releases,[undefined,undefined]);
});
test('CG03i application-level handling of an empty successful query is still permitted',async()=>{
 const f=fixture();
 assert.equal(await runTransaction(f.pool,undefined,async c=>{const r=await c.query('SELECT');return r.rows.length===0?'empty':'found';}),'empty');
 assert.equal(f.calls.filter(x=>x==='COMMIT').length,1);
});
