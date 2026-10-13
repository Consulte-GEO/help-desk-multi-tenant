import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresExecutionChecklistStore} from '../src/infrastructure/execution-checklist-store.ts';
import {runTransaction} from '../src/infrastructure/transaction.ts';
import type {SqlClient,SqlPool,SqlResult} from '../src/infrastructure/sql.ts';
import {markingFixture,id,AT} from './fixtures/checklist/marking.ts';
import {decideExecutionChecklistMark} from '../src/domain/execution-checklist-mark.ts';

// The store and transaction runner are real. This transport deliberately allows
// COMMIT after a successful SELECT with an invalid result, to exercise the gap
// that PostgreSQL's natural transaction-abort on SQL errors cannot prove.
function fixture(){
 const f=markingFixture(),calls:string[]=[],released:(Error|undefined)[]=[];
 let staged=0,persisted=0;
 const good=(result:unknown):SqlResult=>({command:'SELECT',rowCount:1,rows:[{result}]});
 let answer:(sql:string)=>SqlResult|Promise<SqlResult>=()=>good(f.record);
 const client:SqlClient={async query(sql){
  calls.push(sql);
  if(sql==='BEGIN'){staged=0;return {command:'BEGIN',rowCount:null,rows:[]};}
  if(sql==='ROLLBACK'){staged=0;return {command:'ROLLBACK',rowCount:null,rows:[]};}
  if(sql==='COMMIT'){persisted+=staged;staged=0;return {command:'COMMIT',rowCount:null,rows:[]};}
  if(sql.startsWith('select set_config'))return good(null);
  if(sql==='insert staged_business'){staged++;return {command:'INSERT',rowCount:1,rows:[]};}
  if(sql.includes('hdn_mark_execution_checklist'))staged++;
  return answer(sql);
 },release(e){released.push(e);}};
 const pool:SqlPool={connect:async()=>client,query:async()=>assert.fail('pool.query is forbidden'),end:async()=>{}};
 return {...f,pool,calls,released,good,answer:(fn:typeof answer)=>{answer=fn;},persisted:()=>persisted};
}
const rejected={code:'transaction_validation_failed'};
const invalid={code:'checklist_store_invalid'};
function noCommit(f:ReturnType<typeof fixture>){
 assert.equal(f.calls.includes('COMMIT'),false);assert.equal(f.calls.at(-1),'ROLLBACK');
 assert.equal(f.persisted(),0);assert.equal(f.released.length,1);
}
const badEnvelopes:Record<string,SqlResult>={
 'unexpected command tag':{command:'UPDATE',rowCount:1,rows:[{result:null}]},
 'no row':{command:'SELECT',rowCount:0,rows:[]},
 'multiple rows':{command:'SELECT',rowCount:2,rows:[{result:null},{result:null}]},
 'private extra column':{command:'SELECT',rowCount:1,rows:[{result:null,private:'synthetic-private-marker'}]},
};
for(const [name,result] of Object.entries(badEnvelopes))test('checklist rejects the transaction after caught '+name,async()=>{
 const f=fixture();f.answer(()=>result);
 await assert.rejects(runTransaction(f.pool,f.principal,async c=>{
  await c.query('insert staged_business');
  await assert.rejects(createPostgresExecutionChecklistStore(c).readReceipt(id(6),'intent-validation-001'),invalid);
 }),rejected);noCommit(f);
});

test('a successful mutation SELECT with an invalid envelope cannot leave its write committed',async()=>{
 const f=fixture();f.answer(()=>badEnvelopes['unexpected command tag']!);
 await assert.rejects(runTransaction(f.pool,f.principal,async c=>{
  await assert.rejects(createPostgresExecutionChecklistStore(c).mark(id(6),f.command,'a'.repeat(64),'intent-validation-002',id(99)),invalid);
 }),rejected);noCommit(f);assert.equal(f.calls.filter(s=>s.includes('hdn_mark_execution_checklist')).length,1);
});

test('a parsed result with an unsafe role also invalidates prior staged work',async()=>{
 const f=fixture();f.answer(()=>f.good({role:'postgres',login:'postgres',superuser:true,bypass:true,createRole:true,createDatabase:true,replication:true,member:false,owner:true,contract:'hdn-checklist-candidate-1'}));
 await assert.rejects(runTransaction(f.pool,f.principal,async c=>{
  await c.query('insert staged_business');await assert.rejects(createPostgresExecutionChecklistStore(c).assertReady(),invalid);
 }),rejected);noCommit(f);
});

test('a malformed persisted checklist record poisons the operation even after catching its parser error',async()=>{
 const f=fixture();f.answer(()=>f.good({...f.record,snapshot:{revision:1,entries:[]}}));
 await assert.rejects(runTransaction(f.pool,f.principal,async c=>{
  await c.query('insert staged_business');await assert.rejects(createPostgresExecutionChecklistStore(c).read(id(6)),invalid);
 }),rejected);noCommit(f);
});

test('a resolution evidence mismatch is not downgraded to a successful empty result',async()=>{
 const f=fixture();const decision=decideExecutionChecklistMark(f.principal,f.record,f.command,[f.evidence],AT);
 f.answer(()=>f.good({record:{...f.record,snapshot:decision.snapshot},evidence:[]}));
 await assert.rejects(runTransaction(f.pool,f.principal,async c=>{
  await c.query('insert staged_business');await assert.rejects(createPostgresExecutionChecklistStore(c).readExecutionChecklist(id(6)),{code:'checklist_evidence_denied'});
 }),rejected);noCommit(f);
});

test('a resolution result for a different ticket cannot be swallowed',async()=>{
 const f=fixture();f.answer(()=>f.good({record:{...f.record,context:{...f.context,ticketId:id(61)}},evidence:[]}));
 await assert.rejects(runTransaction(f.pool,f.principal,async c=>{
  await c.query('insert staged_business');await assert.rejects(createPostgresExecutionChecklistStore(c).readExecutionChecklist(id(6)),invalid);
 }),rejected);noCommit(f);
});

test('private or malformed evidence options invalidate the transaction, not only the page',async()=>{
 const f=fixture();f.answer(()=>({command:'SELECT',rowCount:1,rows:[{id:id(90),at:AT,body:'synthetic-private-marker'}]}));
 await assert.rejects(runTransaction(f.pool,f.principal,async c=>{
  await c.query('insert staged_business');
  await assert.rejects(createPostgresExecutionChecklistStore(c).queryEvidence({principalId:f.principal.id,workspaceId:f.context.workspaceId,accountId:f.context.accountId,ticketId:id(6),ticketVersion:4,checklistRevision:0,readAt:AT},{expectedTicketVersion:4,expectedChecklistRevision:0,before:null}),invalid);
 }),rejected);noCommit(f);
});

test('invalid mark input is rejected before SQL and cannot be caught to confirm earlier work',async()=>{
 const f=fixture();
 await assert.rejects(runTransaction(f.pool,f.principal,async c=>{
  await c.query('insert staged_business');
  await assert.rejects(async()=>createPostgresExecutionChecklistStore(c).mark(id(6),{...f.command,expectedTicketVersion:0},'a'.repeat(64),'intent-validation-003',id(99)),{code:'invalid_checklist_mark'});
 }),rejected);noCommit(f);assert.equal(f.calls.some(s=>s.includes('hdn_mark_execution_checklist')),false);
});

test('after a caught validation refusal even another store on the same borrowed client cannot query',async()=>{
 const f=fixture();f.answer(()=>badEnvelopes['private extra column']!);
 await assert.rejects(runTransaction(f.pool,f.principal,async c=>{
  const a=createPostgresExecutionChecklistStore(c),b=createPostgresExecutionChecklistStore(c);
  await assert.rejects(a.readReceipt(id(6),'intent-validation-004'),invalid);
  f.answer(()=>f.good(f.record));await assert.rejects(b.read(id(6)),rejected);
 }),rejected);noCommit(f);assert.equal(f.calls.some(s=>s.includes('hdn_lock_execution_checklist')),false);
});

test('a propagated semantic refusal keeps its classification while rolling back staged work',async()=>{
 const f=fixture();f.answer(()=>f.good({record:{...f.record,context:{...f.context,ticketId:id(61)}},evidence:[]}));
 await assert.rejects(runTransaction(f.pool,f.principal,async c=>{
  await c.query('insert staged_business');return createPostgresExecutionChecklistStore(c).readExecutionChecklist(id(6));
 }),invalid);noCommit(f);
});

test('a real driver rejection keeps statement_failed rather than validation_failed',async()=>{
 const f=fixture();f.answer(()=>{throw Object.assign(Error('synthetic driver detail'),{code:'HD004'});});
 await assert.rejects(runTransaction(f.pool,f.principal,async c=>{
  await c.query('insert staged_business');await assert.rejects(createPostgresExecutionChecklistStore(c).read(id(6)),{code:'checklist_evidence_denied'});
 }),{code:'transaction_statement_failed'});noCommit(f);
});

test('legitimate absence of a prior receipt is not a validation refusal',async()=>{
 const f=fixture();f.answer(()=>f.good(null));
 assert.equal(await runTransaction(f.pool,f.principal,c=>createPostgresExecutionChecklistStore(c).readReceipt(id(6),'intent-validation-005')),null);
 assert.equal(f.calls.at(-1),'COMMIT');assert.equal(f.released.length,1);
});

test('a valid read and empty evidence for an unmarked snapshot still commit normally',async()=>{
 const f=fixture();f.answer(sql=>f.good(sql.includes('_resolution')?{record:f.record,evidence:[]}:f.record));
 await runTransaction(f.pool,f.principal,async c=>{
  const store=createPostgresExecutionChecklistStore(c);assert.deepEqual(await store.read(id(6)),f.record);
  assert.deepEqual(await store.readExecutionChecklist(id(6)),{template:f.template,snapshot:null});
 });assert.equal(f.calls.at(-1),'COMMIT');
});

test('a successfully returned mark envelope is unchanged and not retried',async()=>{
 const f=fixture(),value={receipt:{fixture:true},record:{fixture:true}};f.answer(()=>f.good(value));
 assert.deepEqual(await runTransaction(f.pool,f.principal,c=>createPostgresExecutionChecklistStore(c).mark(id(6),f.command,'a'.repeat(64),'intent-validation-006',id(99))),value);
 assert.equal(f.persisted(),1);assert.equal(f.calls.filter(s=>s.includes('hdn_mark_execution_checklist')).length,1);
});

test('a rejected operation does not poison a later transaction on the same physical connection',async()=>{
 const f=fixture();let stale!:ReturnType<typeof createPostgresExecutionChecklistStore>;f.answer(()=>badEnvelopes['no row']!);
 await assert.rejects(runTransaction(f.pool,f.principal,async c=>{stale=createPostgresExecutionChecklistStore(c);await assert.rejects(stale.read(id(6)),invalid);}),rejected);
 f.answer(()=>f.good(f.record));
 await runTransaction(f.pool,f.principal,async c=>{
  await assert.rejects(stale.read(id(6)),{code:'checklist_store_unavailable'});
  assert.deepEqual(await createPostgresExecutionChecklistStore(c).read(id(6)),f.record);
 });assert.equal(f.calls.filter(s=>s==='COMMIT').length,1);assert.equal(f.released.length,2);
});

test('validation failure does not release the connection before another in-flight query ends',async()=>{
 const f=fixture();let entered!:()=>void,finish!:()=>void;const started=new Promise<void>(r=>entered=r),wait=new Promise<void>(r=>finish=r);
 f.answer(async sql=>{if(sql==='select concurrent'){entered();await wait;return f.good(null);}return badEnvelopes['no row']!;});
 const pending=runTransaction(f.pool,f.principal,async c=>{
  const other=c.query('select concurrent');await started;
  await assert.rejects(createPostgresExecutionChecklistStore(c).read(id(6)),invalid);await other;
 });const checked=assert.rejects(pending,rejected);
 await started;await new Promise<void>(r=>setImmediate(r));assert.equal(f.released.length,0);assert.equal(f.calls.includes('ROLLBACK'),false);
 finish();await checked;noCommit(f);
});

test('evidence helper envelope validation is also mandatory for the whole transaction',async()=>{
 const f=fixture();f.answer(()=>badEnvelopes['private extra column']!);
 await assert.rejects(runTransaction(f.pool,f.principal,async c=>{
  await c.query('insert staged_business');await assert.rejects(createPostgresExecutionChecklistStore(c).readEvidence(id(6),['note:'+id(90)]),invalid);
 }),rejected);noCommit(f);
});
