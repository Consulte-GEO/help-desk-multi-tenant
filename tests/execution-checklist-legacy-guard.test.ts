import test from 'node:test';
import assert from 'node:assert/strict';
import {assertLegacyTerminalUpdateAllowed} from '../src/infrastructure/legacy-transition-guard.ts';
import {runTransaction} from '../src/infrastructure/transaction.ts';
import {HelpdeskError} from '../src/domain/errors.ts';
import type {SqlClient,SqlPool,SqlResult} from '../src/infrastructure/sql.ts';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const p={id:id(1),workspaceId:id(2)};
const target={id:id(3),workspaceId:p.workspaceId,accountId:id(4),status:'resolved',version:8,updatedAt:'2026-10-12T12:00:00.000000Z'};
const row=(x:Record<string,unknown>):SqlResult=>({command:'SELECT',rowCount:1,rows:[x]});
function fixture(){
 let catalog:SqlResult=row({bindings:true,guard:true});let decision:SqlResult=row({decision:'structured_required'});
 let failure:unknown;const calls:{sql:string;values:unknown[]}[]=[];
 const c:SqlClient={query:async(sql,values=[])=>{calls.push({sql,values});if(failure)throw failure;return sql.includes('to_regclass')?catalog:decision;},release:()=>assert.fail('guard must not release the connection')};
 return {c,calls,catalog:(x:SqlResult)=>catalog=x,decision:(x:SqlResult)=>decision=x,failure:(e:unknown)=>failure=e,run:(t=target)=>assertLegacyTerminalUpdateAllowed(c,p,t,7)};
}
for(const status of ['resolved','closed'])test('legacy '+status+' cannot finalize a bound ticket',async()=>{
 const f=fixture();await assert.rejects(f.run({...target,status}),{code:'structured_workflow_required',status:409});assert.equal(f.calls.length,2);
});
test('complete absence of HDN facility keeps legacy completion compatible',async()=>{const f=fixture();f.catalog(row({bindings:false,guard:false}));await f.run();assert.equal(f.calls.length,1);});
for(const catalog of [{bindings:true,guard:false},{bindings:false,guard:true}])test('partial HDN installation is unavailable, not an exemption '+JSON.stringify(catalog),async()=>{
 const f=fixture();f.catalog(row(catalog));await assert.rejects(f.run(),{code:'legacy_transition_guard_unavailable'});assert.equal(f.calls.length,1);
});
test('the SQL helper may allow an unbound ticket or a same-state update',async()=>{const f=fixture();f.decision(row({decision:'legacy_allowed'}));await f.run();assert.equal(f.calls.length,2);assert.deepEqual(f.calls[1]!.values,[p.workspaceId,target.accountId,target.id,'resolved',7]);});
for(const status of ['new','triage','open','waiting_customer','waiting_internal','waiting_third_party','cancelled'])test('nonterminal '+status+' adds no HDN lookup',async()=>{const f=fixture();await f.run({...target,status});assert.equal(f.calls.length,0);});
for(const bad of [row({bindings:null,guard:false}),row({bindings:false}),row({bindings:'false',guard:false}),row({bindings:false,guard:false,approved:true}),{command:'SELECT',rowCount:0,rows:[]},{command:'SELECT',rowCount:2,rows:[{bindings:false,guard:false},{bindings:false,guard:false}]},{command:'UPDATE',rowCount:1,rows:[{bindings:false,guard:false}]}])test('malformed catalog never permits legacy completion '+JSON.stringify(bad),async()=>{
 const f=fixture();f.catalog(bad as SqlResult);await assert.rejects(f.run(),{code:'legacy_transition_guard_unavailable'});assert.equal(f.calls.length,1);
});
for(const decision of [null,true,'unknown',{allowed:true}])test('only a closed helper decision is accepted '+JSON.stringify(decision),async()=>{const f=fixture();f.decision(row({decision}));await assert.rejects(f.run(),{code:'legacy_transition_guard_unavailable'});});
test('extra private fields from the helper cannot be returned or accepted',async()=>{const f=fixture();f.decision(row({decision:'legacy_allowed',privateNote:'PRIVATE'}));await assert.rejects(f.run(),e=>e instanceof HelpdeskError&&e.code==='legacy_transition_guard_unavailable'&&!e.message.includes('PRIVATE'));});
test('query failures are not a schema-absent fallback',async()=>{const f=fixture();f.failure(Object.assign(new Error('PRIVATE SQL'),{code:'42P01'}));await assert.rejects(f.run(),e=>e instanceof HelpdeskError&&e.code==='legacy_transition_guard_unavailable'&&!e.message.includes('PRIVATE'));});
for(const [sqlCode,code,status] of [['HD001','resource_not_found',404],['HD002','version_conflict',412],['release_gate_closed','release_gate_closed',503],['request_cancelled','request_cancelled',409]] as const)test('safe propagation '+sqlCode,async()=>{
 const f=fixture();f.failure(Object.assign(new Error('PRIVATE SQL'),{code:sqlCode}));await assert.rejects(f.run(),e=>e instanceof HelpdeskError&&e.code===code&&e.status===status&&!e.message.includes('PRIVATE'));
});
test('a hostile error code accessor is never executed',async()=>{const f=fixture();let invoked=0;f.failure(Object.defineProperty(new Error(), 'code',{get(){invoked++;throw Error('PRIVATE');}}));await assert.rejects(f.run(),{code:'legacy_transition_guard_unavailable'});assert.equal(invoked,0);});
for(const patch of [{workspaceId:id(99)},{id:'invalid'},{accountId:'invalid'}])test('invalid or foreign target never reaches SQL '+JSON.stringify(patch),async()=>{
 const f=fixture();await assert.rejects(f.run({...target,...patch}),{code:'legacy_transition_guard_unavailable'});assert.equal(f.calls.length,0);
});
test('guard uses the existing transaction and rejection prevents COMMIT',async()=>{
 const f=fixture(),calls:string[]=[];let released=0;
 const pool:SqlPool={connect:async()=>({query:async(sql,values)=>{calls.push(sql);if(sql==='BEGIN'||sql==='ROLLBACK'||sql==='COMMIT')return {command:sql,rowCount:null,rows:[]};if(sql.startsWith('select set_config'))return row({});return f.c.query(sql,values);},release:()=>{released++;}}),query:async()=>assert.fail('no separate pool query'),end:async()=>{}};
 await assert.rejects(runTransaction(pool,p,c=>assertLegacyTerminalUpdateAllowed(c,p,target,7)),{code:'structured_workflow_required'});
 assert.equal(calls.at(-1),'ROLLBACK');assert.equal(calls.includes('COMMIT'),false);assert.equal(released,1);
});
test('HD008 refusal from SQL is sanitized as a structured-workflow requirement',async()=>{
 const f=fixture();f.failure(Object.assign(new Error('PRIVATE CHECKLIST'),{code:'HD008'}));
 await assert.rejects(f.run(),e=>e instanceof HelpdeskError&&e.code==='structured_workflow_required'&&e.status===409&&!e.message.includes('PRIVATE'));
});
