import test from 'node:test';
import assert from 'node:assert/strict';
import {runTransaction} from '../src/infrastructure/transaction.ts';
import {assertLegacyTerminalUpdateAllowed} from '../src/infrastructure/legacy-transition-guard.ts';
import type {SqlClient,SqlPool,SqlResult} from '../src/infrastructure/sql.ts';

const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const person={id:id(1),workspaceId:id(2)};
const change={id:id(3),workspaceId:id(2),accountId:id(4),status:'resolved',version:8,updatedAt:'2026-10-12T12:00:00.000000Z'};
const row=(v:Record<string,unknown>):SqlResult=>({command:'SELECT',rows:[v],rowCount:1});
function fixture(catalog:SqlResult,decision:SqlResult=row({decision:'legacy_allowed'})){
 const statements:string[]=[];let staged=0,committed=0,released=0;
 const physical:SqlClient={
  async query(sql){
   statements.push(sql);
   if(sql==='BEGIN'){staged=0;return {command:'BEGIN',rows:[],rowCount:null};}
   if(sql==='COMMIT'){committed+=staged;staged=0;return {command:'COMMIT',rows:[],rowCount:null};}
   if(sql==='ROLLBACK'){staged=0;return {command:'ROLLBACK',rows:[],rowCount:null};}
   if(sql==='insert synthetic_business'){staged++;return {command:'INSERT',rows:[],rowCount:1};}
   if(sql.startsWith('select set_config'))return row({});
   if(sql.includes('to_regclass'))return catalog;
   if(sql.includes('hdn_legacy_terminal_update'))return decision;
   throw Error('Unexpected fixture statement');
  },release(){released++;}
 };
 const pool:SqlPool={connect:async()=>physical,query:async()=>assert.fail('No pool query'),end:async()=>{}};
 return {pool,statements,committed:()=>committed,released:()=>released};
}
const refusals:readonly [string,SqlResult,SqlResult,string][]=[
 ['partial installation',row({bindings:true,guard:false}),row({decision:'legacy_allowed'}),'legacy_transition_guard_unavailable'],
 ['structured refusal returned as data',row({bindings:true,guard:true}),row({decision:'structured_required'}),'structured_workflow_required'],
 ['malformed decision',row({bindings:true,guard:true}),row({decision:null}),'legacy_transition_guard_unavailable'],
 ['invalid SELECT acknowledgement',{command:'UPDATE',rows:[{bindings:false,guard:false}],rowCount:1},row({decision:'legacy_allowed'}),'legacy_transition_guard_unavailable'],
];
for(const [name,catalog,decision,code] of refusals){
 test(`caught ${name} cannot COMMIT an earlier business write`,async()=>{
  const f=fixture(catalog,decision);
  await assert.rejects(runTransaction(f.pool,person,async c=>{
   await c.query('insert synthetic_business');
   await assertLegacyTerminalUpdateAllowed(c,person,change,7).catch(e=>assert.equal(e.code,code));
   return 'caller swallowed validation failure';
  }),{code:'transaction_validation_failed'});
  assert.equal(f.committed(),0);assert.equal(f.statements.includes('COMMIT'),false);
  assert.equal(f.statements.at(-1),'ROLLBACK');assert.equal(f.released(),1);
 });
}
test('unbound legacy completion still commits once',async()=>{
 const f=fixture(row({bindings:false,guard:false}));
 await runTransaction(f.pool,person,async c=>{await c.query('insert synthetic_business');await assertLegacyTerminalUpdateAllowed(c,person,change,7);});
 assert.equal(f.committed(),1);assert.equal(f.statements.filter(s=>s==='COMMIT').length,1);
});
