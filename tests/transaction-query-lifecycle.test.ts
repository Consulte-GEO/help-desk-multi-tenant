import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {runTransaction} from '../src/infrastructure/transaction.ts';
import {HelpdeskError} from '../src/domain/errors.ts';
import type {SqlClient,SqlPool,SqlResult} from '../src/infrastructure/sql.ts';

const turn=()=>new Promise<void>(resolve=>setImmediate(resolve));
const result=(command:string):SqlResult=>({command,rows:[],rowCount:null});
function barrier(){let release!:()=>void;const wait=new Promise<void>(resolve=>{release=resolve;});return {wait,release};}
/** FIFO transport emulates driver scheduling only. No PostgreSQL or SQL authorization is mocked as proven. */
function transport(){
 const calls:string[]=[],finished:string[]=[],releaseErrors:(Error|undefined)[]=[];
 const gates=new Map<string,ReturnType<typeof barrier>>();
 const entered=new Map<string,ReturnType<typeof barrier>>();
 let after:((statement:string)=>void)|undefined,tail:Promise<unknown>=Promise.resolve();
 const client=Object.assign(new EventEmitter(),{
  query(statement:string):Promise<SqlResult>{
   const tag=statement.startsWith('select set_config')?'context':statement;calls.push(tag);
   const promise=tail.then(async()=>{entered.get(tag)?.release();await gates.get(tag)?.wait;after?.(tag);finished.push(tag);return result(tag==='context'?'SELECT':tag);});
   tail=promise.then(()=>{},()=>{});return promise;
  },
  release(error?:Error){calls.push('release');releaseErrors.push(error);}
 }) as SqlClient;
 const pool:SqlPool={connect:async()=>client,query:async()=>{throw Error('Do not query the pool');},end:async()=>{}};
 return {pool,calls,finished,releaseErrors,client,hook:(fn:typeof after)=>{after=fn;},hold:(tag:string)=>{
  const gate=barrier(),entry=barrier();gates.set(tag,gate);entered.set(tag,entry);return {entered:entry.wait,release:gate.release};
 }};
}
const incomplete={status:503,code:'transaction_work_incomplete'};

test('CG03h an unawaited query cannot queue COMMIT ahead of the completed-query admission check',async()=>{
 const f=transport(),slow=f.hold('SLOW');
 const running=runTransaction(f.pool,undefined,async c=>{void c.query('SLOW');await slow.entered;return 'must not commit';});
 const settled=running.then(value=>({value,error:undefined}),error=>({value:undefined,error}));
 await slow.entered;await turn();
 try{assert.equal(f.calls.includes('COMMIT'),false);assert.equal(f.calls.includes('ROLLBACK'),false);assert.equal(f.calls.includes('release'),false);}
 finally{slow.release();await settled;}
 const outcome=await settled;assert.equal(outcome.error?.code,incomplete.code);assert.equal(outcome.value,undefined);
 assert.deepEqual(f.calls,['BEGIN','context','SLOW','ROLLBACK','release']);
 assert.ok(f.finished.indexOf('SLOW')<f.finished.indexOf('ROLLBACK'));assert.equal(f.releaseErrors.length,1);
});

test('CG03h work that fails with a query in flight drains it before ROLLBACK and preserves its cause',async()=>{
 const f=transport(),slow=f.hold('SLOW'),cause=new HelpdeskError(409,'synthetic_work_failed','Synthetic failure');
 const running=runTransaction(f.pool,undefined,async c=>{void c.query('SLOW');await slow.entered;throw cause;});
 const rejected=assert.rejects(running,error=>error===cause);
 await slow.entered;await turn();
 try{assert.equal(f.calls.includes('ROLLBACK'),false);assert.equal(f.calls.includes('release'),false);}
 finally{slow.release();await rejected;}
 assert.deepEqual(f.calls,['BEGIN','context','SLOW','ROLLBACK','release']);
});

test('CG03h query-completion revocation cannot be overtaken by a queued COMMIT',async()=>{
 const f=transport(),slow=f.hold('SLOW');let denied=false;
 f.hook(tag=>{if(tag==='SLOW')denied=true;});
 const running=runTransaction(f.pool,undefined,async c=>{void c.query('SLOW').catch(()=>{});await slow.entered;return 'unsafe';},()=>{
  if(denied)throw new HelpdeskError(403,'resource_scope_denied','Synthetic revocation');
 });
 const settled=running.then(value=>({value,error:undefined}),error=>({value:undefined,error}));
 await slow.entered;await turn();slow.release();
 const outcome=await settled;assert.equal(outcome.value,undefined);assert.ok(outcome.error);
 assert.equal(f.calls.includes('COMMIT'),false);assert.equal(f.calls.filter(x=>x==='ROLLBACK').length,1);
});

test('CG03h all admitted queries finish before rollback even when one rejects',async()=>{
 const f=transport(),one=f.hold('ONE'),two=f.hold('TWO');f.hook(tag=>{if(tag==='ONE')throw Error('synthetic query failure');});
 const running=runTransaction(f.pool,undefined,async c=>{void c.query('ONE');void c.query('TWO');await one.entered;return true;});
 const settled=running.then(value=>({value,error:undefined}),error=>({value:undefined,error}));
 await one.entered;await turn();one.release();await two.entered;await turn();
 try{assert.equal(f.calls.includes('COMMIT'),false);assert.equal(f.calls.includes('ROLLBACK'),false);assert.equal(f.calls.includes('release'),false);}
 finally{two.release();await settled;}
 const outcome=await settled;assert.equal(outcome.error?.code,incomplete.code);assert.equal(outcome.value,undefined);
 assert.deepEqual(f.calls,['BEGIN','context','ONE','TWO','ROLLBACK','release']);
});

test('CG03h returning the query promise transfers proper ownership to the transaction',async()=>{
 const f=transport(),r=await runTransaction(f.pool,undefined,c=>c.query('SELECT'));
 assert.equal(r.command,'SELECT');assert.deepEqual(f.calls,['BEGIN','context','SELECT','COMMIT','release']);
});
test('CG03h explicitly awaited concurrent reads preserve the existing one-connection contract',async()=>{
 const f=transport(),values=await runTransaction(f.pool,undefined,c=>Promise.all([c.query('SELECT A'),c.query('SELECT B')]));
 assert.equal(values.length,2);assert.deepEqual(f.calls,['BEGIN','context','SELECT A','SELECT B','COMMIT','release']);
});
test('CG03h a callback with no queries can finish normally',async()=>{
 const f=transport();assert.equal(await runTransaction(f.pool,undefined,async()=>42),42);
 assert.deepEqual(f.calls,['BEGIN','context','COMMIT','release']);
});
test('CG03h an awaited statement error does not invent a retry or replace its original cause',async()=>{
 const f=transport(),cause=Error('synthetic query failure');f.hook(tag=>{if(tag==='FAIL')throw cause;});
 await assert.rejects(runTransaction(f.pool,undefined,c=>c.query('FAIL')),error=>error===cause);
 assert.deepEqual(f.calls,['BEGIN','context','FAIL','ROLLBACK','release']);
});
test('CG03h borrowed query reference cannot dispatch after the callback has ended',async()=>{
 const f=transport();let held:SqlClient|undefined;await runTransaction(f.pool,undefined,async c=>{held=c;await c.query('SELECT');});
 const before=[...f.calls];await assert.rejects(held!.query('AFTER'),{code:'database_unavailable'});assert.deepEqual(f.calls,before);
});
test('CG03h acknowledged COMMIT is not undone by an admission change during its response',async()=>{
 const f=transport();let denied=false;f.hook(tag=>{if(tag==='COMMIT')denied=true;});
 assert.equal(await runTransaction(f.pool,undefined,async c=>{await c.query('SELECT');return 'saved';},()=>{if(denied)throw Error('late');}),'saved');
 assert.equal(f.calls.includes('ROLLBACK'),false);
});
test('CG03h a lost COMMIT acknowledgement remains unknown without replay',async()=>{
 const f=transport();f.hook(tag=>{if(tag==='COMMIT')throw Error('lost ack');});
 await assert.rejects(runTransaction(f.pool,undefined,async c=>{await c.query('MUTATION');}),{code:'transaction_outcome_unknown'});
 assert.equal(f.calls.filter(x=>x==='MUTATION').length,1);assert.equal(f.calls.filter(x=>x==='COMMIT').length,1);assert.ok(f.releaseErrors[0]);
});
test('CG03h cleanup preserves a falsy callback rejection rather than fabricating a return value',async()=>{
 for(const cause of [undefined,null,0]){
  const f=transport(),slow=f.hold('SLOW');
  const running=runTransaction(f.pool,undefined,async c=>{void c.query('SLOW');await slow.entered;throw cause;});
  const rejected=assert.rejects(running,error=>error===cause);await slow.entered;await turn();slow.release();await rejected;
  assert.equal(f.calls.includes('COMMIT'),false);assert.equal(f.calls.filter(x=>x==='release').length,1);
 }
});
