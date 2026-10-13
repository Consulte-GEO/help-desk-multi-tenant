import test from 'node:test';
import assert from 'node:assert/strict';
import {markingFixture,id,AT} from './fixtures/checklist/marking.ts';
import {decideExecutionChecklistMark} from '../src/domain/execution-checklist-mark.ts';
import {createPostgresExecutionChecklistStore} from '../src/infrastructure/execution-checklist-store.ts';
import {runTransaction} from '../src/infrastructure/transaction.ts';
import type {SqlClient,SqlResult} from '../src/infrastructure/sql.ts';

// Real parser/adapter/transaction; database replies are deliberately controlled.
// These tests do not execute PL/pgSQL or certify PostgreSQL row locks.
const denied={code:'checklist_evidence_denied',status:403};
const invalid={code:'checklist_store_invalid',status:503};
function fixture(){
 const f=markingFixture();
 f.record.snapshot=decideExecutionChecklistMark(f.principal,f.record,f.command,[f.evidence],AT).snapshot;
 const record=structuredClone(f.record),evidence:any[]=[structuredClone(f.evidence)],calls:{sql:string;values?:unknown[]}[]=[];
 let error:unknown=null,raw:unknown=undefined;
 const client:SqlClient={query:async(sql,values)=>{
  calls.push({sql,values});if(error)throw error;
  // Old implementation reads only the record and silently ignores all evidence.
  const result=sql.includes('hdn_lock_execution_checklist_resolution')?(raw===undefined?{record,evidence}:raw):record;
  return {command:'SELECT',rowCount:1,rows:[{result}]};
 },release(){throw Error('Adapter must not release a borrowed client');}};
 return {...f,record,evidence,calls,store:createPostgresExecutionChecklistStore(client),client,
  error:(e:unknown)=>error=e,answer:(v:unknown)=>raw=v};
}
test('HDN01c resolution reads current evidence through the locked helper, with parameterized ticket',async()=>{
 const f=fixture(),r=await f.store.readExecutionChecklist(id(6));
 assert.deepEqual(r,{template:f.template,snapshot:f.record.snapshot});
 assert.equal(f.calls.length,1);assert.match(f.calls[0]!.sql,/hdn_lock_execution_checklist_resolution\(\$1\)/);
 assert.deepEqual(f.calls[0]!.values,[id(6)]);assert.ok(Object.isFrozen(r));
 assert.deepEqual(Object.keys(r).sort(),['snapshot','template']);
});
for(const [name,change] of [
 ['missing note',(f:ReturnType<typeof fixture>)=>f.evidence.splice(0)],
 ['another note',(f:ReturnType<typeof fixture>)=>f.evidence[0].reference='note:'+id(91)],
 ['another ticket',(f:ReturnType<typeof fixture>)=>f.evidence[0].ticketId=id(71)],
 ['another workspace',(f:ReturnType<typeof fixture>)=>f.evidence[0].workspaceId=id(71)],
 ['another account',(f:ReturnType<typeof fixture>)=>f.evidence[0].accountId=id(71)],
 ['another author',(f:ReturnType<typeof fixture>)=>f.evidence[0].actorId=id(71)],
 ['note created after the marking',(f:ReturnType<typeof fixture>)=>f.evidence[0].at='2026-10-12T12:00:00.000002Z'],
 ['duplicate evidence',(f:ReturnType<typeof fixture>)=>f.evidence.push(structuredClone(f.evidence[0]))],
 ['unexpected evidence',(f:ReturnType<typeof fixture>)=>f.evidence.push({...f.evidence[0],reference:'note:'+id(91)})],
 ['private note text in the evidence envelope',(f:ReturnType<typeof fixture>)=>f.evidence[0].body='private-marker-do-not-return'],
 ['forged verification Boolean',(f:ReturnType<typeof fixture>)=>f.evidence[0].verified=true],
 ['invalid instant',(f:ReturnType<typeof fixture>)=>f.evidence[0].at='2026-02-30T12:00:00.000001Z'],
 ['noncanonical selector',(f:ReturnType<typeof fixture>)=>f.evidence[0].reference='https://example.invalid/note'],
] as const)test('HDN01c refuses '+name+' before exposing a resolution snapshot',async()=>{
 const f=fixture();change(f);await assert.rejects(f.store.readExecutionChecklist(id(6)),denied);
});
test('HDN01c metadata matches each marking author rather than the current assignee',async()=>{
 const f=fixture();f.record.assignedTo=id(71);
 const r=await f.store.readExecutionChecklist(id(6));assert.deepEqual((r as any).snapshot,f.record.snapshot);
});
test('HDN01c equivalent millisecond timestamp does not lose a real microsecond distinction',async()=>{
 const f=fixture();f.evidence[0].at='2026-10-12T12:00:00.000Z';
 await f.store.readExecutionChecklist(id(6));
 f.evidence[0].at='2026-10-12T12:00:00.000002Z';await assert.rejects(f.store.readExecutionChecklist(id(6)),denied);
});
test('HDN01c one note shared by two items is read once but checked against both marks',async()=>{
 const f=fixture();f.record.snapshot.entries.push({...structuredClone(f.record.snapshot.entries[0]),itemId:'email'});
 await f.store.readExecutionChecklist(id(6));
 f.record.snapshot.entries[1].actorId=id(71);await assert.rejects(f.store.readExecutionChecklist(id(6)),denied);
});
test('HDN01c a shared note must predate every marking, not only the latest one',async()=>{
 const f=fixture();f.record.snapshot.entries.push({...structuredClone(f.record.snapshot.entries[0]),itemId:'email',at:'2026-10-12T12:00:00.000Z'});
 await assert.rejects(f.store.readExecutionChecklist(id(6)),denied);
});
test('HDN01c no snapshot still returns no snapshot, never a fabricated completion',async()=>{
 const f=fixture();f.record.snapshot=null;f.evidence.length=0;
 assert.deepEqual(await f.store.readExecutionChecklist(id(6)),{template:f.template,snapshot:null});
 f.evidence.push(f.evidence as any);await assert.rejects(f.store.readExecutionChecklist(id(6)),invalid);
});
test('HDN01c reset items require no stale evidence',async()=>{
 const f=fixture(),stale=structuredClone(f.evidence[0]);f.record.snapshot=decideExecutionChecklistMark(f.principal,f.record,{...f.command,status:'pending',expectedChecklistRevision:1,reason:'Conferir de novo',evidenceRefs:[]},[],AT).snapshot;
 f.evidence.length=0;await f.store.readExecutionChecklist(id(6));
 f.evidence.push(stale);await assert.rejects(f.store.readExecutionChecklist(id(6)),denied);
});
for(const value of [null,{},[],{record:{}},{record:{},evidence:[],approved:true}])test('HDN01c rejects malformed resolution envelope '+JSON.stringify(value),async()=>{
 const f=fixture();f.answer(value);await assert.rejects(f.store.readExecutionChecklist(id(6)),invalid);
});
test('HDN01c missing new SQL helper is unavailable, never fallback to the old snapshot read',async()=>{
 const f=fixture();f.error(Object.assign(Error('private-db-path'),{code:'42883'}));
 await assert.rejects(f.store.readExecutionChecklist(id(6)),{code:'checklist_store_unavailable'});
 assert.equal(f.calls.length,1);assert.match(f.calls[0]!.sql,/hdn_lock_execution_checklist_resolution/);
});
test('HDN01c SQL evidence denial stays safe and does not leak database text',async()=>{
 const f=fixture();f.error(Object.assign(Error('private-db-path'),{code:'HD004'}));
 await assert.rejects(f.store.readExecutionChecklist(id(6)),(e:any)=>e.code==='checklist_evidence_denied'&&!e.message.includes('private-db-path'));
});
test('HDN01c the record remains readable for correction despite unavailable evidence',async()=>{
 const f=fixture();f.evidence.length=0;
 assert.deepEqual(await f.store.read(id(6)),f.record);
 await assert.rejects(f.store.readExecutionChecklist(id(6)),denied);
});
test('HDN01c refuses a stale evidence-backed snapshot before the business command or COMMIT',async()=>{
 const f=fixture();f.evidence.length=0;const controls:string[]=[];let business=0;
 const pool:any={connect:async()=>({query:async(sql:string,values?:unknown[]):Promise<SqlResult>=>{
  controls.push(sql);
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {command:sql,rowCount:null,rows:[]};
  if(sql.startsWith('select set_config'))return {command:'SELECT',rowCount:1,rows:[]};
  return f.client.query(sql,values);
 },release:()=>controls.push('release')}),end:async()=>{},query:async()=>{throw Error('Must use borrowed connection');}};
 await assert.rejects(runTransaction(pool,f.principal,async c=>{await createPostgresExecutionChecklistStore(c).readExecutionChecklist(id(6));business++;}),denied);
 assert.equal(business,0);assert.ok(!controls.includes('COMMIT'));assert.ok(controls.includes('ROLLBACK'));assert.equal(controls.at(-1),'release');
});

import {createResourceAccessResolver} from '../src/application/resource-access.ts';
import {createSupportWorkflow} from '../src/application/support-workflow.ts';
function workflowFixture(){
 const f=fixture();
 for(const extra of [
  {itemId:'email',status:'not_applicable',evidenceRefs:[],reason:'Sem solicitação de envio.'},
  {itemId:'risco',status:'done',acknowledgeRisk:true},
 ])f.record.snapshot=decideExecutionChecklistMark(f.principal,f.record,{...f.command,...extra,expectedChecklistRevision:f.record.snapshot.revision},extra.evidenceRefs?.length===0?[]:f.evidence,AT).snapshot;
 const refs=[{connectionId:id(4),tenantId:'T1',type:'work',id:'A'}],expiresAt='2026-10-12T12:00:30.000001Z';
 const resolver=createResourceAccessResolver({manifestFingerprint:'a'.repeat(64),maxAgeMicros:60000000n,timeoutMs:5000,clock:()=>AT,authority:{readAccess:async q=>({principal:f.principal,binding:{id:id(5),workspaceId:id(1),accountId:id(3),connectionId:id(4),tenantId:'T1',revision:'1',active:true},accessRevision:'1',manifestFingerprint:'a'.repeat(64),operation:q.operation,asOf:AT,expiresAt,resources:refs})}});
 const scope={ticketId:id(6),principalId:id(2),workspaceId:id(1),accountId:id(3),bindingId:id(5),bindingRevision:'1',accessRevision:'1',manifestFingerprint:'a'.repeat(64),operation:'tickets.write',asOf:AT,expiresAt,refs};
 const ticket:any={id:id(6),workspaceId:id(1),accountId:id(3),productInstanceId:id(7),serviceCode:'SUPPORT',createdBy:id(2),assignedTo:id(2),subject:'Pedido sintético',description:'Sem informação privada',status:'open',priority:'normal',version:4,coverageId:id(9),contractVersionId:id(10),contractSnapshot:{contractId:id(11),version:1,policy:{}},createdAt:AT,updatedAt:AT,profileVersionId:'P1',lastEventAt:AT,closedAt:null,resolution:null,approval:'not_required'};
 const profile={versionId:'P1',status:'published' as const,reopenWindowMicros:'60000000',executionChecklist:f.context.reference};
 const controls:string[]=[],publicRecords:unknown[]=[],audits:unknown[]=[];let writes=0;
 const pool:any={connect:async()=>({query:async(sql:string,args?:unknown[]):Promise<SqlResult>=>{
  controls.push(sql);if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {command:sql,rowCount:null,rows:[]};
  if(sql.includes('cg_lock_ticket_scope'))return {command:'SELECT',rowCount:1,rows:[{scope}]};
  if(sql.startsWith('select set_config'))return {command:'SELECT',rowCount:1,rows:[]};
  return f.client.query(sql,args);
 },release:()=>controls.push('release')}),end:async()=>{},query:async()=>{throw Error('Pool escape');}};
 const service=createSupportWorkflow({pool,resolver,clock:()=>AT,createStore:client=>({
  readTicket:async()=>structuredClone(ticket),readProfile:async()=>structuredClone(profile),readReceipt:async()=>null,verifyAssignee:async()=>null,
  readExecutionChecklist:target=>createPostgresExecutionChecklistStore(client).readExecutionChecklist(target),
  commitDecision:async(_version,decision,audit,outbox,receipt)=>{writes++;publicRecords.push(decision.event,outbox,receipt.result);audits.push(audit);}
 })});
 return {...f,controls,publicRecords,audits,writes:()=>writes,run:()=>service.execute(f.principal,id(6),refs,{action:'resolve',expectedVersion:4,body:'Execução conferida.'},'hdn01c-resolution-001',id(99))};
}
test('HDN01c real workflow refuses unavailable evidence before commitDecision',async()=>{
 const f=workflowFixture();f.evidence.length=0;
 await assert.rejects(f.run(),{code:'checklist_evidence_denied',status:403});
 assert.equal(f.writes(),0);assert.ok(f.controls.includes('ROLLBACK'));assert.ok(!f.controls.includes('COMMIT'));assert.equal(f.publicRecords.length,0);
});
test('HDN01c real workflow uses current evidence but projects no evidence metadata publicly',async()=>{
 const f=workflowFixture();const receipt=await f.run();
 assert.equal(receipt.status,'resolved');assert.equal(f.writes(),1);assert.ok(f.controls.includes('COMMIT'));
 assert.doesNotMatch(JSON.stringify([receipt,...f.publicRecords]),/note:|evidence|riskAcknowledgement|checklist/i);
 const proof=(f.audits[0] as any).executionChecklist;assert.equal(proof.snapshotRevision,3);assert.equal(proof.doneCount,2);assert.equal(proof.waivedCount,1);
});
test('HDN01c a missing SQL completion function never uses a legacy resolver path',async()=>{
 const f=workflowFixture();f.error(Object.assign(new Error('private schema path'),{code:'42883'}));
 await assert.rejects(f.run(),{code:'checklist_store_unavailable',status:503});
 assert.equal(f.writes(),0);assert.ok(!f.controls.includes('COMMIT'));
 assert.equal(f.calls.length,1);assert.match(f.calls[0]!.sql,/hdn_lock_execution_checklist_resolution/);
});
test('HDN01c another internally consistent ticket returned by the helper is refused',async()=>{
 const f=fixture();f.record.context.ticketId=id(71);f.record.snapshot.ticketId=id(71);f.evidence[0].ticketId=id(71);
 await assert.rejects(f.store.readExecutionChecklist(id(6)),invalid);
});
