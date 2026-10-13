import test from 'node:test';
import assert from 'node:assert/strict';
import {createExecutionChecklistService} from '../src/application/execution-checklist.ts';
import {createExecutionChecklistHttpHandler} from '../src/http/execution-checklist.ts';
import {createResourceAccessResolver} from '../src/application/resource-access.ts';
import {decideExecutionChecklistMark} from '../src/domain/execution-checklist-mark.ts';
import {markingFixture,id,AT} from './fixtures/checklist/marking.ts';
import type {SqlPool,SqlResult} from '../src/infrastructure/sql.ts';

type Action='read'|'mark'|'evidence';
function fixture(){
 const f=markingFixture(),refs=[{connectionId:id(4),tenantId:'T1',type:'work',id:'A'}];
 const state={open:true,stopAt:'',lostCommit:false,authorizations:0,acquired:0,released:0,commits:0,rollbacks:0};
 let stored={record:structuredClone(f.record),receipts:new Map<string,unknown>(),audits:0};
 const statements:string[]=[];
 const stop=(at:string)=>{if(state.stopAt===at)state.open=false;};
 const resolver=createResourceAccessResolver({manifestFingerprint:'a'.repeat(64),maxAgeMicros:60000000n,timeoutMs:5000,clock:()=>AT,authority:{readAccess:async q=>{
  state.authorizations++;return {principal:f.principal,binding:{id:id(5),workspaceId:id(1),accountId:id(3),connectionId:id(4),tenantId:'T1',revision:'1',active:true},accessRevision:'1',manifestFingerprint:'a'.repeat(64),operation:q.operation,asOf:AT,expiresAt:'2026-10-12T12:00:30.000001Z',resources:refs};
 }}});
 const result=(v:unknown):SqlResult=>({command:'SELECT',rowCount:1,rows:[{result:v}]});
 const pool:SqlPool={connect:async()=>{
  state.acquired++;stop('pool');let staged=structuredClone(stored);
  return {release:()=>{state.released++;},query:async(sql,values=[])=>{
   statements.push(sql);
   if(sql==='BEGIN')return {command:'BEGIN',rowCount:0,rows:[]};
   if(sql==='ROLLBACK'){state.rollbacks++;return {command:'ROLLBACK',rowCount:0,rows:[]};}
   if(sql==='COMMIT'){stored=staged;state.commits++;stop('commit');if(state.lostCommit){state.lostCommit=false;throw Error('lost commit acknowledgement');}return {command:'COMMIT',rowCount:0,rows:[]};}
   if(sql.startsWith('select set_config'))return result(null);
   if(sql.includes('cg_lock_ticket_scope')){stop('scope');return {command:'SELECT',rowCount:1,rows:[{scope:{ticketId:id(6),principalId:id(2),workspaceId:id(1),accountId:id(3),bindingId:id(5),bindingRevision:'1',accessRevision:'1',manifestFingerprint:'a'.repeat(64),operation:values[1],asOf:AT,expiresAt:'2026-10-12T12:00:30.000001Z',refs}}]};}
   if(sql.includes('pg_roles')){stop('ready');return result({role:'helpdesk_app',login:'helpdesk_app',superuser:false,bypass:false,createRole:false,createDatabase:false,replication:false,member:false,owner:false,contract:'hdn-checklist-candidate-1'});}
   if(sql.includes('hdn_lock_execution_checklist')){stop('record');return result(structuredClone(staged.record));}
   if(sql.includes('hdn_checklist_receipt')){stop('receipt');return result(structuredClone(staged.receipts.get(String(values[1]))??null));}
   if(sql.includes('hdn_checklist_evidence')){stop('note');return result([f.evidence]);}
   if(sql.includes('FROM helpdesk_core.internal_notes')){stop('selection');return {command:'SELECT',rowCount:0,rows:[]};}
   if(sql.includes('hdn_mark_execution_checklist')){
    const command=values[1] as typeof f.command,decision=decideExecutionChecklistMark(f.principal,staged.record,command,[f.evidence],AT);
    staged.record.snapshot=decision.snapshot;staged.audits++;
    const receipt={ticketId:id(6),workspaceId:id(1),accountId:id(3),actorId:id(2),itemId:command.itemId,status:command.status,ticketVersion:4,checklistRevision:decision.snapshot.revision,auditId:id(81),at:AT,replayed:false};
    staged.receipts.set(String(values[3]),{key:values[3],hash:values[2],command:structuredClone(command),result:receipt});
    stop('mark');return result({receipt,record:structuredClone(staged.record)});
   }
   throw new Error('Unexpected SQL at admission fixture');
  }};
 },query:async()=>{throw new Error('No nested pool query');},end:async()=>{}};
 const service=createExecutionChecklistService({pool,resolver});
 const origin='https://helpdesk.example.test';
 const handler=createExecutionChecklistHttpHandler({enabled:()=>state.open,origin,authenticate:async()=>f.principal,rateLimiter:{beforeAuthentication:async()=>{},afterAuthentication:async()=>{}},directory:{readTicketResources:async()=>refs},service});
 const call=(kind:Action)=>handler(new Request(`${origin}/v1/internal/tickets/${id(6)}/execution-checklist${kind==='read'?'':kind==='mark'?'/marks':'/evidence'}`,{
  method:kind==='read'?'GET':'POST',headers:{origin,'content-type':'application/json','if-match':'"0"','idempotency-key':'hdn-admission-key-0001'},
  ...(kind==='read'?{}:{body:JSON.stringify(kind==='mark'?f.command:{expectedTicketVersion:4,expectedChecklistRevision:0,before:null})})
 }));
 return {...f,refs,pool,resolver,service,state,statements,stored:()=>stored,call};
}
for(const kind of ['read','mark','evidence'] as const){
 for(const stage of ['pool','scope','ready','record'])test(`HDN01f ${kind} admission after ${stage} prevents COMMIT with the existing runner`,async()=>{
  const f=fixture();f.state.stopAt=stage;const r=await f.call(kind);const body=await r.json();
  assert.equal(r.status,503);assert.equal(body.code,'release_gate_closed');
  assert.equal(f.state.commits,0);assert.equal(f.stored().audits,0);assert.equal(f.state.released,1);
  if(stage==='pool')assert.deepEqual(f.statements,[]);else assert.equal(f.statements.at(-1),'ROLLBACK');
 });
}
for(const stage of ['receipt','note','mark'])test(`HDN01f mark closure during ${stage} rolls back any staged marking and receipt`,async()=>{
 const f=fixture();f.state.stopAt=stage;const r=await f.call('mark');
 assert.equal((await r.json()).code,'release_gate_closed');assert.equal(f.state.commits,0);
 assert.equal(f.stored().audits,0);assert.equal(f.stored().receipts.size,0);assert.equal(f.stored().record.snapshot,null);
 assert.equal(f.statements.at(-1),'ROLLBACK');
});
test('HDN01f closure after evidence SELECT withholds data and prevents COMMIT',async()=>{
 const f=fixture();f.state.stopAt='selection';const r=await f.call('evidence');
 assert.equal((await r.json()).code,'release_gate_closed');assert.equal(f.state.commits,0);
});
test('HDN01f gate closing during acknowledged COMMIT preserves confirmed mark',async()=>{
 const f=fixture();f.state.stopAt='commit';const r=await f.call('mark');
 assert.equal(r.status,200);assert.equal((await r.json()).auditId,id(81));assert.equal(f.stored().audits,1);assert.equal(f.state.commits,1);
 assert.equal(f.statements.at(-1),'COMMIT');
});
test('HDN01f lost COMMIT remains unknown when gate closes; reopening reconciles the same single mark',async()=>{
 const f=fixture();f.state.stopAt='commit';f.state.lostCommit=true;const r=await f.call('mark');
 assert.equal(r.status,503);assert.equal((await r.json()).code,'transaction_outcome_unknown');
 assert.equal(f.stored().audits,1);
 const acquisitions=f.state.acquired;const closed=await f.call('mark');assert.equal((await closed.json()).code,'release_gate_closed');assert.equal(f.state.acquired,acquisitions);
 f.state.open=true;f.state.stopAt='';const replay=await f.call('mark');assert.equal(replay.status,200);assert.equal((await replay.json()).replayed,true);
 assert.equal(f.stored().audits,1);assert.equal(f.statements.filter(q=>q.includes('hdn_mark_execution_checklist')).length,1);
});
test('HDN01f read closing only after committed read still withholds private response',async()=>{
 const f=fixture();f.state.stopAt='commit';const r=await f.call('read');assert.equal(r.status,503);
 assert.doesNotMatch(await r.text(),/template|snapshot|readAt/);assert.equal(f.state.commits,1);assert.equal(f.stored().audits,0);
});
