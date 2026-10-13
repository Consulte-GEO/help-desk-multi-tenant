import test from 'node:test';
import assert from 'node:assert/strict';
import {createResourceAccessResolver} from '../src/application/resource-access.ts';
import {createDurablePostgresSupportWorkflow} from '../src/infrastructure/support-workflow-store.ts';
import {decideSupportTransition,type SupportTicket,type SupportWorkflowProfile} from '../src/domain/support-workflow.ts';
import {decideExecutionChecklistMark} from '../src/domain/execution-checklist-mark.ts';
import {markingFixture,id,AT} from './fixtures/checklist/marking.ts';
import type {SqlPool,SqlResult} from '../src/infrastructure/sql.ts';
// Real application/workflow/resolver/store/transaction modules. Only the physical
// SQL transport and source authority are modeled. This is NOT PostgreSQL evidence.
function fixture(checklist=false){
 const f=markingFixture(),p=f.principal,refs=[{connectionId:id(4),tenantId:'T1',type:'work',id:'A'}];
 const until='2026-10-12T12:01:00.000001Z';let revoked=false,lost=false,corrupt=false,acquired=0,writes=0;
 let record=f.record;
 for(const [i,index] of f.template.items.map((i,n)=>[i,n] as const)){
  const cmd={...f.command,itemId:i.id,expectedChecklistRevision:index,evidenceRefs:i.evidenceRequired?[f.evidence.reference]:[],acknowledgeRisk:i.risk==='sensitive'};
  record={...record,snapshot:decideExecutionChecklistMark(p,record,cmd,i.evidenceRequired?[f.evidence]:[],AT).snapshot};
 }
 const profile:SupportWorkflowProfile={versionId:'P1',status:'published',reopenWindowMicros:'604800000000',...(checklist?{executionChecklist:f.context.reference}:{})};
 const initial:SupportTicket={id:id(6),workspaceId:id(1),accountId:id(3),productInstanceId:id(7),serviceCode:'SUPPORT',createdBy:p.id,assignedTo:p.id,subject:'Cadastro',description:'Synthetic',status:'open',priority:'normal',version:4,coverageId:id(9),contractVersionId:id(10),contractSnapshot:{contractId:id(11),version:1,policy:{}},createdAt:AT,updatedAt:AT,profileVersionId:'P1',lastEventAt:AT,closedAt:null,resolution:null,approval:'not_required'};
 let saved={ticket:initial,receipts:new Map<string,unknown>()};const calls:string[]=[];
 const resolver=createResourceAccessResolver({manifestFingerprint:'a'.repeat(64),maxAgeMicros:60000000n,timeoutMs:1000,clock:()=>AT,authority:{async readAccess(q){return revoked?null:{principal:p,binding:{id:id(5),workspaceId:id(1),accountId:id(3),connectionId:id(4),tenantId:'T1',revision:'1',active:true},accessRevision:'1',manifestFingerprint:'a'.repeat(64),operation:q.operation,asOf:AT,expiresAt:until,resources:refs};}}});
 const pool:SqlPool={async connect(){acquired++;let stage=structuredClone(saved);return {async query(sql,values=[]):Promise<SqlResult>{
  calls.push(sql);const result=(r:unknown):SqlResult=>({command:'SELECT',rows:[{result:structuredClone(r)}],rowCount:1});
  if(sql==='BEGIN'){stage=structuredClone(saved);return {command:'BEGIN',rows:[],rowCount:null};}
  if(sql==='ROLLBACK')return {command:'ROLLBACK',rows:[],rowCount:null};
  if(sql==='COMMIT'){saved=structuredClone(stage);if(lost){lost=false;throw Error('Synthetic lost ACK');}return {command:'COMMIT',rows:[],rowCount:null};}
  if(sql.startsWith('select set_config'))return result(null);
  if(sql.includes('cg_lock_ticket_scope'))return {command:'SELECT',rowCount:1,rows:[{scope:{ticketId:id(6),principalId:p.id,workspaceId:id(1),accountId:id(3),bindingId:id(5),bindingRevision:'1',accessRevision:'1',manifestFingerprint:'a'.repeat(64),operation:values[1],asOf:AT,expiresAt:until,refs}}]};
  if(sql.includes('hdn_checklist_contract'))return result({role:'helpdesk_app',login:'helpdesk_app',superuser:false,bypass:false,createRole:false,createDatabase:false,replication:false,member:false,owner:false,contract:'hdn-checklist-candidate-1'});
  if(sql.includes('hdn_lock_execution_checklist_resolution'))return result({record,evidence:record.snapshot===null?[]:[f.evidence]});
  if(sql.includes('hdn_read_support_workflow'))return result({principalId:p.id,ticket:stage.ticket,profile});
  if(sql.includes('hdn_support_workflow_receipt'))return result(stage.receipts.get(values[1] as string)??null);
  if(sql.includes('hdn_commit_support_workflow')){
   const s=values[1] as any;const d=decideSupportTransition(p,stage.ticket,profile,s.command,s.at);stage.ticket=d.after;
   stage.receipts.set(s.key,{key:s.key,hash:s.hash,result:s.receipt});writes++;
   return result(corrupt?{invalid:true}:s.receipt);
  }
  throw Error('Unexpected statement');
 },release(){}};},query:async()=>assert.fail('Never acquire another pool client'),end:async()=>{}};
 const flow=createDurablePostgresSupportWorkflow({pool,resolver,clock:()=>AT}),command={action:'resolve',expectedVersion:4,body:'Cadastro conferido.'},key='durable-intent-0001';
 return {execute:()=>flow.execute(p,id(6),refs,command,key,id(90)),calls,state:()=>saved,acquired:()=>acquired,writes:()=>writes,
  lose:()=>{lost=true;},malformed:()=>{corrupt=true;},revoke:()=>{revoked=true;},incomplete:()=>{record={...record,snapshot:null};}};
}
test('durable composition uses concrete writer on a single borrowed connection',async()=>{const f=fixture(),r=await f.execute();assert.equal(r.status,'resolved');assert.equal(f.state().ticket.version,5);assert.equal(f.acquired(),1);assert.equal(f.writes(),1);assert.equal(f.calls.at(-1),'COMMIT');});
test('durable composition consumes pinned checklist and revalidates it before writing',async()=>{const f=fixture(true);assert.equal((await f.execute()).status,'resolved');assert.equal(f.calls.filter(s=>s.includes('hdn_lock_execution_checklist_resolution')).length,2);assert.equal(f.acquired(),1);});
test('missing required checklist prevents invoking concrete SQL writer',async()=>{const f=fixture(true);f.incomplete();await assert.rejects(f.execute(),{code:'workflow_checklist_required'});assert.equal(f.writes(),0);assert.equal(f.calls.at(-1),'ROLLBACK');});
test('lost COMMIT acknowledgement remains unknown and replay returns same result without another write',async()=>{const f=fixture();f.lose();await assert.rejects(f.execute(),{code:'transaction_outcome_unknown'});assert.equal(f.state().ticket.status,'resolved');const r=await f.execute();assert.equal(r.replayed,true);assert.equal(f.writes(),1);});
test('invalid writer response rolls back staged workflow before it can return a receipt',async()=>{const f=fixture();f.malformed();await assert.rejects(f.execute(),{code:'workflow_store_unavailable'});assert.equal(f.state().ticket.status,'open');assert.equal(f.state().receipts.size,0);assert.equal(f.calls.includes('COMMIT'),false);});
test('revoked authority never acquires the database for a workflow mutation',async()=>{const f=fixture();f.revoke();await assert.rejects(f.execute(),{code:'resource_scope_denied'});assert.equal(f.acquired(),0);assert.equal(f.writes(),0);});
