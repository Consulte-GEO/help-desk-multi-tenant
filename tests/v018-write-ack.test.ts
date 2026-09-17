import test from 'node:test';import assert from 'node:assert/strict';
import {PostgresUnitOfWork} from '../src/infrastructure/postgres.ts';
import type {SqlPool,SqlClient,SqlResult} from '../src/infrastructure/sql.ts';
import type {Store} from '../src/application/ports.ts';
import {currentTicket,noteWriter,id} from './helpers/v018-driver.ts';
const p=noteWriter(),t=currentTicket(),at='2026-09-17T18:00:00.000Z';
const n={id:id(901),workspaceId:t.workspaceId,accountId:t.accountId,ticketId:t.id,actorId:p.id,body:'SENSITIVE-not-for-diagnostics',createdAt:at};
const e={id:id(902),workspaceId:t.workspaceId,accountId:t.accountId,ticketId:t.id,actorId:p.id,type:'note.created',customerVisible:false,data:{noteId:n.id},createdAt:at};
const inserts:Record<string,(s:Store)=>Promise<void>>={
 ticket:s=>s.insertTicket(t),message:s=>s.addMessage({...n,actorType:'human_agent'}),note:s=>s.addNote(n),event:s=>s.addEvent(e),
 outbox:s=>s.enqueue({id:e.id,workspaceId:t.workspaceId,accountId:t.accountId,ticketId:t.id,type:'ticket.created',payload:{},requestId:'r',createdAt:at}),
 replay:s=>s.saveIdempotency({workspaceId:p.workspaceId,principalId:p.id,operation:'notes.create:'+t.id,key:'v018-save-result-01',hash:'a'.repeat(64),result:n})
};
const updates:Record<string,(s:Store)=>Promise<void>>={
 status:s=>s.updateTicket({...t,status:'open',version:2},1),priority:s=>s.updatePriority({...t,priority:'high',version:2},1),assignment:s=>s.updateAssignment({...t,assignedTo:p.id,version:2},1)
};
function harness(reply:unknown){
 const calls:string[]=[],releases:(Error|undefined)[]=[];
 const client:SqlClient={query:async sql=>{
  calls.push(sql);if(/^(insert|update) /i.test(sql))return reply as SqlResult;
  return {command:sql.split(' ')[0]!.toUpperCase(),rows:[],rowCount:null};
 },release:e=>{releases.push(e);}};
 const pool:SqlPool={connect:async()=>client,query:async()=>{throw Error('No pool query');},end:async()=>{}};
 return {db:new PostgresUnitOfWork(pool),calls,releases};
}
for(const [name,write] of Object.entries(inserts))test('INSERT '+name+' requires a one-row INSERT acknowledgement before commit',async()=>{
 for(const reply of [undefined,null,{}, {command:'INSERT',rows:[],rowCount:0},{command:'INSERT',rows:[],rowCount:2},{command:'INSERT',rows:[],rowCount:'1'},{command:'SELECT',rows:[],rowCount:1},{command:'INSERT',rows:[{private:'SENSITIVE'}],rowCount:1},{command:'INSERT',rows:null,rowCount:1}]){
  const h=harness(reply);await assert.rejects(()=>h.db.run(p,write),{status:503,code:'invalid_database_write_result'});
  assert.ok(h.calls.includes('ROLLBACK'));assert.ok(!h.calls.includes('COMMIT'));assert.equal(h.releases.length,1);
 }
});
for(const [name,write] of Object.entries(updates))test('UPDATE '+name+' rejects malformed command/count/returned-row acknowledgements',async()=>{
 for(const reply of [null,{command:'UPDATE',rows:[],rowCount:null},{command:'SELECT',rows:[],rowCount:1},{command:'UPDATE',rows:[],rowCount:2},{command:'UPDATE',rows:[],rowCount:'1'},{command:'UPDATE',rows:[{private:'SENSITIVE'}],rowCount:1}]){
  const h=harness(reply);await assert.rejects(()=>h.db.run(p,write),{status:503,code:'invalid_database_write_result'});
  assert.ok(!h.calls.includes('COMMIT'));assert.ok(h.calls.includes('ROLLBACK'));
 }
});
test('a valid zero-row UPDATE remains a 412 conflict, not malformed protocol',async()=>{
 for(const write of Object.values(updates)){const h=harness({command:'UPDATE',rows:[],rowCount:0});await assert.rejects(()=>h.db.run(p,write),{status:412,code:'version_conflict'});assert.ok(!h.calls.includes('COMMIT'));}
});
test('all existing single-row writes accept normal pg result tags without requiring RETURNING',async()=>{
 for(const [kind,writes] of [['INSERT',inserts],['UPDATE',updates]] as const)for(const write of Object.values(writes)){
  const h=harness({command:kind,rows:[],rowCount:1});await h.db.run(p,write);assert.ok(h.calls.includes('COMMIT'));assert.ok(!h.calls.includes('ROLLBACK'));
 }
});
test('incompatible write result never includes the returned private payload or SQL in its error',async()=>{
 const h=harness({command:'SELECT',rows:[{token:'SENSITIVE-token',sql:'SENSITIVE-query'}],rowCount:1});
 await assert.rejects(()=>h.db.run(p,inserts.replay!),error=>{assert.equal((error as {code:string}).code,'invalid_database_write_result');assert.doesNotMatch(JSON.stringify(error),/SENSITIVE|api_idempotency_keys|SELECT/);return true;});
});
