import test from 'node:test';import assert from 'node:assert/strict';
import {createBorrowedPostgresUnitOfWork} from '../src/infrastructure/postgres.ts';import {HelpdeskService} from '../src/application/helpdesk.ts';
import {runTransaction} from '../src/infrastructure/transaction.ts';import type {SqlPool} from '../src/infrastructure/sql.ts';import {principal} from './fixtures.ts';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function fixture(){
 const calls:{sql:string;args?:unknown[]}[]=[],p=principal({id:id(2),workspaceId:id(1),workspaceRole:'admin',grants:[]});
 const contexts=[{accountId:id(3),productInstanceId:id(4),connectionId:id(5),tenantId:'mrv'}];
 const state:{row:unknown;contexts:unknown;rowCount:number}={row:{total:'607',received:'600',in_progress:'3',waiting_for_you:'2',resolved:'1',closed:'1'},contexts,rowCount:1};
 const pool:SqlPool={query:async()=>{throw Error('Second connection forbidden');},end:async()=>{},connect:async()=>({release(){},async query(sql,args){
  calls.push({sql,args});if(sql.includes('cg_local_prepare_ticket_collection'))return {command:'SELECT',rowCount:1,rows:[{source:state.contexts}]};
  if(sql.includes('from helpdesk_core.tickets'))return {command:'SELECT',rowCount:state.rowCount,rows:state.rowCount?[state.row as any]:[]};
  return {command:['BEGIN','COMMIT','ROLLBACK'].includes(sql)?sql:'SELECT',rowCount:0,rows:[]};
 }})};
 const read=(filters={})=>runTransaction(pool,p,c=>new HelpdeskService(createBorrowedPostgresUnitOfWork(c,p,{consulteGeoLocal:true,localCollection:true})).summarize(p,filters));
 return {calls,state,contexts,read};
}
test('agregação prepara namespace na mesma transação, parametriza filtros e não usa LIMIT',async()=>{
 const f=fixture(),r=await f.read({q:"' OR TRUE --",status:'in_progress',priority:'high',assignment:'mine'});assert.equal(r.total,607);
 const q=f.calls.find(c=>c.sql.includes('count(*)'));assert.ok(q);assert.equal(f.calls.filter(c=>c.sql==='BEGIN').length,1);assert.equal(f.calls.at(-1)?.sql,'COMMIT');
 assert.ok(f.calls.findIndex(c=>c.sql.includes('cg_local_prepare'))<f.calls.indexOf(q));
 assert.doesNotMatch(q.sql,/limit|offset|internal_notes|ticket_messages| OR TRUE --/i);assert.match(q.sql,/workspace_id=\$1/);assert.match(q.sql,/cg_local_ticket_directory/);
 assert.equal(q.args?.[2],"' or true --");assert.deepEqual(q.args?.[5],['open','waiting_internal','waiting_third_party']);assert.equal(q.args?.[6],'high');assert.equal(q.args?.[7],'mine');assert.match(q.sql,/\$10::jsonb->'accounts'/);assert.equal(q.args?.[10],JSON.stringify(f.contexts));
});
test('agregação inválida, overflow, campos extras ou soma divergente recusam integralmente e fazem rollback',async()=>{
 for(const row of [null,{}, {total:'0'}, {total:'9007199254740992',received:'9007199254740992',in_progress:'0',waiting_for_you:'0',resolved:'0',closed:'0'}, {total:'1',received:'0',in_progress:'0',waiting_for_you:'0',resolved:'0',closed:'0'}, {total:0,received:0,in_progress:0,waiting_for_you:0,resolved:0,closed:0}]){
  const f=fixture();f.state.row=row;await assert.rejects(f.read(),{status:503,code:'invalid_database_result'});assert.equal(f.calls.at(-1)?.sql,'ROLLBACK');
 }const f=fixture();f.state.rowCount=0;await assert.rejects(f.read(),{status:503});
});
test('namespace inválido recusa antes de contar; vazio mantém predicado restritivo',async()=>{
 const f=fixture();f.state.contexts=null;await assert.rejects(f.read(),{status:503});assert.ok(!f.calls.some(c=>c.sql.includes('count(*)')));
 const empty=fixture();empty.state.contexts=[];await empty.read();assert.equal(empty.calls.find(c=>c.sql.includes('count(*)'))?.args?.[10],'[]');
});

test('description summary chooses only developer-owned column and keeps malicious text parameterized',async()=>{
 const f=fixture(),q="Descrição %_ ' OR TRUE --";await f.read({q,search_in:'description'});
 const statement=f.calls.find(c=>c.sql.includes('count(*)'))!;
 assert.match(statement.sql,/strpos\(translate\(description,\$4::text,\$5::text\),\$3\)>0/);
 assert.equal(statement.args?.[2],"descrição %_ ' or true --");
 assert.doesNotMatch(statement.sql,/OR TRUE --|id::text=\$3|cg_local_ticket_summary|ticket_messages|internal_notes|limit/i);
 assert.match(statement.sql,/cg_local_ticket_directory/);assert.match(statement.sql,/\$10::jsonb->'accounts'/);
});
