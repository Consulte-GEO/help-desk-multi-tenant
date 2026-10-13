import test from 'node:test';
import assert from 'node:assert/strict';
import * as transaction from '../src/infrastructure/transaction.ts';
import type {SqlClient,SqlPool,SqlResult} from '../src/infrastructure/sql.ts';
import {HelpdeskError} from '../src/domain/errors.ts';
function invalidate(client:SqlClient,error:unknown):never{
 const fn=Reflect.get(transaction,'rejectTransactionValidation');
 assert.equal(typeof fn,'function','Runner must own transaction-scoped validation rejection');return fn(client,error);
}
function fixture(){
 const calls:string[]=[];let hook:(sql:string)=>void|Promise<void>=()=>{};const releases:(Error|undefined)[]=[];
 const physical:SqlClient={async query(sql){calls.push(sql);await hook(sql);return {command:['BEGIN','ROLLBACK','COMMIT'].includes(sql)?sql:'SELECT',rows:[],rowCount:null} as SqlResult;},release(error){releases.push(error);}};
 const pool:SqlPool={connect:async()=>physical,query:async()=>assert.fail('No direct pool query'),end:async()=>{}};
 return {pool,physical,calls,releases,hook:(next:typeof hook)=>{hook=next;}};
}
const refusal=()=>new HelpdeskError(409,'synthetic_validation_refusal','private synthetic detail');
const rejected={code:'transaction_validation_failed'};
test('caught logical refusal does not permit a later statement or COMMIT',async()=>{
 const f=fixture();
 await assert.rejects(transaction.runTransaction(f.pool,undefined,async c=>{
  await c.query('select before');try{invalidate(c,refusal());}catch{}
  await assert.rejects(c.query('select after'),rejected);
 }),rejected);
 assert.equal(f.calls.includes('select after'),false);assert.equal(f.calls.includes('COMMIT'),false);assert.equal(f.calls.at(-1),'ROLLBACK');
});
test('propagated validation error remains the original object',async()=>{
 const f=fixture(),original=refusal();
 await assert.rejects(transaction.runTransaction(f.pool,undefined,async c=>invalidate(c,original)),e=>e===original);
 assert.equal(f.calls.at(-1),'ROLLBACK');
});
test('swallowed undefined is still a failed validation, without retaining its content',async()=>{
 const f=fixture();await assert.rejects(transaction.runTransaction(f.pool,undefined,async c=>{try{invalidate(c,undefined);}catch{}}),rejected);
 assert.equal(f.calls.includes('COMMIT'),false);
});
test('repeat validation rejection has no reset operation',async()=>{
 const f=fixture();await assert.rejects(transaction.runTransaction(f.pool,undefined,async c=>{
  for(const reason of [false,null,refusal()]){try{invalidate(c,reason);}catch{}}
 }),rejected);
});
test('SQL failure keeps its existing classification when validator also reports failure',async()=>{
 const f=fixture();f.hook(sql=>{if(sql==='select rejected')throw Error('driver private details');});
 await assert.rejects(transaction.runTransaction(f.pool,undefined,async c=>{
  try{await c.query('select rejected');}catch(e){try{invalidate(c,e);}catch{}}
 }),{code:'transaction_statement_failed'});
});
test('borrowed client exposes no mutable rejection flags and added properties cannot reset it',async()=>{
 const f=fixture();await assert.rejects(transaction.runTransaction(f.pool,undefined,async c=>{
  assert.deepEqual(Object.keys(c).sort(),['query','release']);
  try{invalidate(c,refusal());}catch{}
  Object.assign(c,{validationFailed:false,rejected:false,active:true});
  await assert.rejects(c.query('select bypass'),rejected);
 }),rejected);assert.equal(f.calls.includes('select bypass'),false);assert.equal(f.calls.includes('COMMIT'),false);
});
test('a copied client cannot modify another owned validation state',async()=>{
 const f=fixture();await transaction.runTransaction(f.pool,undefined,async c=>{const e=refusal();assert.throws(()=>invalidate({...c},e),v=>v===e);});
 assert.equal(f.calls.at(-1),'COMMIT');
});
test('a previous callback cannot reject a subsequent transaction on the same physical connection',async()=>{
 const f=fixture();let previous!:SqlClient;
 await assert.rejects(transaction.runTransaction(f.pool,undefined,async c=>{previous=c;try{invalidate(c,refusal());}catch{}}),rejected);
 assert.equal(await transaction.runTransaction(f.pool,undefined,async c=>{try{invalidate(previous,refusal());}catch{}await c.query('select current');return 7;}),7);
 assert.equal(f.calls.filter(s=>s==='COMMIT').length,1);assert.equal(f.releases.length,2);
});
test('late rejection during acknowledged COMMIT cannot rewrite the confirmed outcome',async()=>{
 const f=fixture();let borrowed!:SqlClient;f.hook(sql=>{if(sql==='COMMIT'){try{invalidate(borrowed,refusal());}catch{}}});
 assert.equal(await transaction.runTransaction(f.pool,undefined,async c=>{borrowed=c;return 9;}),9);
});
test('lost COMMIT remains unknown, even with a late logical refusal',async()=>{
 const f=fixture();let borrowed!:SqlClient;f.hook(sql=>{if(sql==='COMMIT'){try{invalidate(borrowed,refusal());}catch{}throw Error('lost ACK');}});
 await assert.rejects(transaction.runTransaction(f.pool,undefined,async c=>{borrowed=c;return 9;}),{code:'transaction_outcome_unknown'});
 assert.equal(f.calls.filter(s=>s==='COMMIT').length,1);assert.ok(f.releases[0] instanceof Error);
});
test('logical refusal waits for an already running query before ROLLBACK/release',async()=>{
 const f=fixture();let begin!:()=>void,finish!:()=>void;const entered=new Promise<void>(r=>begin=r),wait=new Promise<void>(r=>finish=r);
 f.hook(async sql=>{if(sql==='select pending'){begin();await wait;}});
 const run=transaction.runTransaction(f.pool,undefined,async c=>{const pending=c.query('select pending');await entered;try{invalidate(c,refusal());}catch{}await pending;});
 await entered;await new Promise<void>(r=>setImmediate(r));assert.equal(f.calls.includes('ROLLBACK'),false);assert.equal(f.releases.length,0);finish();
 await assert.rejects(run,rejected);assert.equal(f.calls.at(-1),'ROLLBACK');assert.equal(f.releases.length,1);
});
test('rollback failure still discards the connection rather than claiming physical cleanup',async()=>{
 const f=fixture();f.hook(sql=>{if(sql==='ROLLBACK')throw Error('cleanup failed');});
 await assert.rejects(transaction.runTransaction(f.pool,undefined,async c=>{try{invalidate(c,refusal());}catch{}}),rejected);
 assert.ok(f.releases[0] instanceof Error);
});

test('another original business error is propagated without confirming earlier work',async()=>{
 const f=fixture(),business=Error('business rule');
 await assert.rejects(transaction.runTransaction(f.pool,undefined,async c=>{try{invalidate(c,refusal());}catch{}throw business;}),e=>e===business);
 assert.equal(f.calls.includes('COMMIT'),false);assert.equal(f.calls.at(-1),'ROLLBACK');
});
test('validation rejection never inspects a hostile error payload or returns private details',async()=>{
 const f=fixture();let touched=0;const hostile=new Proxy({}, {get(){touched++;throw Error('private-value');},getOwnPropertyDescriptor(){touched++;throw Error('private-value');}});
 await assert.rejects(transaction.runTransaction(f.pool,undefined,async c=>{try{invalidate(c,hostile);}catch{}}),e=>{
  assert.ok(e instanceof HelpdeskError);assert.equal(e.code,rejected.code);assert.equal(e.message.includes('private-value'),false);return true;
 });assert.equal(touched,0);
});
test('validation failure in one concurrent transaction cannot invalidate another',async()=>{
 const f=fixture(),g=fixture();let signal!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>signal=r),wait=new Promise<void>(r=>release=r);
 const bad=transaction.runTransaction(f.pool,undefined,async c=>{try{invalidate(c,refusal());}catch{}signal();await wait;});
 const badCheck=assert.rejects(bad,rejected);
 await entered;
 try{assert.equal(await transaction.runTransaction(g.pool,undefined,async c=>{await c.query('select independent');return 8;}),8);}finally{release();}
 await badCheck;assert.equal(f.calls.includes('COMMIT'),false);assert.equal(g.calls.filter(s=>s==='COMMIT').length,1);
});
