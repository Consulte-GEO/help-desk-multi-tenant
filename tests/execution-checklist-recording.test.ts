import test from 'node:test';import assert from 'node:assert/strict';
import {markingFixture,id,AT} from './fixtures/checklist/marking.ts';
import {decideExecutionChecklistMark} from '../src/domain/execution-checklist-mark.ts';
import {createResourceAccessResolver} from '../src/application/resource-access.ts';
async function api(){const path='../src/application/execution-checklist.ts';const m=await import(path).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});assert.equal(typeof m.createExecutionChecklistService,'function','HDN01b resource-aware application missing');return m;}
function fixture(){
 const f=markingFixture(),refs=[{connectionId:id(4),tenantId:'T1',type:'work',id:'A'}];
 const switches={revoked:false,lostCommit:false,badReceipt:false,skipEvidence:false,afterMark:()=>{}};let now=AT;
 const resolver=createResourceAccessResolver({manifestFingerprint:'a'.repeat(64),maxAgeMicros:60000000n,timeoutMs:5000,clock:()=>now,authority:{readAccess:async q=>switches.revoked?null:{principal:f.principal,binding:{id:id(5),workspaceId:id(1),accountId:id(3),connectionId:id(4),tenantId:'T1',revision:'1',active:true},accessRevision:'1',manifestFingerprint:'a'.repeat(64),operation:q.operation,asOf:AT,expiresAt:'2026-10-12T12:00:30.000001Z',resources:refs}}});
 const scope={ticketId:id(6),principalId:id(2),workspaceId:id(1),accountId:id(3),bindingId:id(5),bindingRevision:'1',accessRevision:'1',manifestFingerprint:'a'.repeat(64),operation:'notes.write',asOf:AT,expiresAt:'2026-10-12T12:00:30.000001Z',refs};
 let state={record:structuredClone(f.record),receipts:new Map<string,any>(),audits:[] as any[]},stage:any;const calls:string[]=[];
 const result=(value:unknown)=>({command:'SELECT',rowCount:1,rows:[{result:value}]});
 const pool:any={connect:async()=>({query:async(sql:string,args:any[]=[])=>{
  calls.push(sql);
  if(sql==='BEGIN'){stage=structuredClone(state);return {command:'BEGIN',rowCount:0,rows:[]};}
  if(sql==='COMMIT'){state=stage;if(switches.lostCommit){switches.lostCommit=false;throw Error('lost ACK');}return {command:'COMMIT',rowCount:0,rows:[]};}
  if(sql==='ROLLBACK')return {command:'ROLLBACK',rowCount:0,rows:[]};
  if(sql.includes('cg_lock_ticket_scope'))return {command:'SELECT',rowCount:1,rows:[{scope:{...scope,operation:args[1]}}]};
  if(sql.includes('pg_roles'))return result({role:'helpdesk_app',login:'helpdesk_app',superuser:false,bypass:false,createRole:false,createDatabase:false,replication:false,member:false,owner:false,contract:'hdn-checklist-candidate-1'});
  if(sql.includes('hdn_lock_execution_checklist'))return result(structuredClone(stage.record));
  if(sql.includes('hdn_checklist_receipt'))return result(structuredClone(stage.receipts.get(args[1])??null));
  if(sql.includes('hdn_checklist_evidence'))return result(switches.skipEvidence?[]:args[1].length?[structuredClone(f.evidence)]:[]);
  if(sql.includes('hdn_mark_execution_checklist')){
   const decision=decideExecutionChecklistMark(f.principal,stage.record,args[1],args[1].evidenceRefs.length?[f.evidence]:[],AT);
   stage.record.snapshot=decision.snapshot;const receipt={ticketId:id(6),workspaceId:id(1),accountId:id(3),actorId:id(2),itemId:args[1].itemId,status:args[1].status,ticketVersion:4,checklistRevision:decision.snapshot.revision,auditId:id(80+decision.snapshot.revision),at:AT,replayed:false};
   stage.receipts.set(args[3],{key:args[3],hash:args[2],command:structuredClone(args[1]),result:receipt});stage.audits.push({requestId:args[4],before:state.record.snapshot,after:decision.snapshot});switches.afterMark();
   return result({receipt:switches.badReceipt?{...receipt,actorId:id(72)}:receipt,record:structuredClone(stage.record)});
  }
  if(sql.startsWith('select set_config'))return {command:'SELECT',rowCount:1,rows:[]};
  throw Error('Unexpected SQL in fixture');
 },release:()=>{}}),query:async()=>{throw Error('pool escape');},end:async()=>{}};
 return {...f,refs,switches,resolver,pool,calls,state:()=>state,time:(v:string)=>now=v};
}
async function make(){const m=await api(),f=fixture(),service=m.createExecutionChecklistService({pool:f.pool,resolver:f.resolver});return {...f,service,run:(command:unknown=f.command,key='checklist-intention-001')=>service.mark(f.principal,id(6),f.refs,command,key,id(99))};}
test('HDN01b real runner and adapter record one item, private audit and minimal receipt',async()=>{const f=await make(),r=await f.run();assert.equal(r.actorId,f.principal.id);assert.equal(r.checklistRevision,1);assert.equal(f.state().record.snapshot.entries[0].actorId,f.principal.id);assert.equal(f.state().audits.length,1);assert.equal(f.calls.at(-1),'COMMIT');assert.doesNotMatch(JSON.stringify(r),/note:|reason|evidenceRefs|riskAcknowledgement/);assert.equal(f.state().record.context.ticketVersion,4);});
test('HDN01b replay returns exact old receipt with no new mark or audit',async()=>{const f=await make(),a=await f.run(),b=await f.run();assert.equal(b.auditId,a.auditId);assert.equal(b.replayed,true);assert.equal(f.state().audits.length,1);assert.equal(f.calls.filter(s=>s.includes('hdn_mark_execution_checklist')).length,1);});
test('HDN01b changed payload under same key conflicts',async()=>{const f=await make();await f.run();await assert.rejects(f.run({...f.command,itemId:'email',evidenceRefs:[]}),{code:'checklist_intent_conflict'});assert.equal(f.state().audits.length,1);});
test('HDN01b revoked resources cannot retrieve a previous receipt',async()=>{const f=await make();await f.run();const calls=f.calls.length;f.switches.revoked=true;await assert.rejects(f.run(),{code:'resource_scope_denied'});assert.equal(f.calls.length,calls);});
test('HDN01b lost confirmation remains unknown; same intention recovers one result',async()=>{const f=await make();f.switches.lostCommit=true;await assert.rejects(f.run(),{code:'transaction_outcome_unknown'});assert.equal(f.state().audits.length,1);const r=await f.run();assert.equal(r.replayed,true);assert.equal(f.state().audits.length,1);});
test('HDN01b wrong SQL receipt rolls the mark back',async()=>{const f=await make();f.switches.badReceipt=true;await assert.rejects(f.run(),{code:'checklist_store_invalid'});assert.equal(f.state().audits.length,0);assert.equal(f.state().record.snapshot,null);assert.equal(f.calls.at(-1),'ROLLBACK');});
test('HDN01b missing note causes zero writes',async()=>{const f=await make();f.switches.skipEvidence=true;await assert.rejects(f.run(),{code:'checklist_evidence_denied'});assert.equal(f.calls.filter(s=>s.includes('hdn_mark_execution_checklist')).length,0);});
test('HDN01b access expiry after database mark rolls state and receipt back',async()=>{const f=await make();f.switches.afterMark=()=>f.time('2026-10-12T12:00:30.000001Z');await assert.rejects(f.run(),{code:'resource_scope_denied'});assert.equal(f.state().audits.length,0);assert.equal(f.state().receipts.size,0);});
test('HDN01b stale checklist revision cannot overwrite another completed marking',async()=>{const f=await make();await f.run();await assert.rejects(f.run({...f.command,itemId:'email',evidenceRefs:[]},'other-intention-002'),{code:'checklist_version_conflict'});assert.equal(f.state().audits.length,1);});
test('HDN01b current authorized operator can read private snapshot without taking ownership',async()=>{const f=await make();await f.run();const r=await f.service.read(f.principal,id(6),f.refs);assert.equal(r.snapshot.entries.length,1);assert.equal(f.state().audits.length,1);});
test('HDN01b foreign ticket envelope fails before evidence lookup',async()=>{const f=await make();f.state().record.context.ticketId=id(76);await assert.rejects(f.run(),{code:'checklist_store_invalid'});assert.equal(f.calls.filter(s=>s.includes('hdn_checklist_evidence')).length,0);});
test('HDN01b request actor/time fields never reach SQL',async()=>{const f=await make();await assert.rejects(f.run({...f.command,actorId:id(9)}),{code:'invalid_checklist_mark'});assert.equal(f.calls.length,0);});
test('HDN01b receipt tampering after save does not become a successful replay',async()=>{const f=await make();await f.run();f.state().receipts.get('checklist-intention-001').result.checklistRevision=9;await assert.rejects(f.run(),{code:'checklist_store_invalid'});assert.equal(f.state().audits.length,1);});
test('HDN01b receipt newer than the current ticket snapshot is not a valid replay',async()=>{const f=await make();await f.run();f.state().record.snapshot=null;await assert.rejects(f.run(),{code:'checklist_store_invalid'});assert.equal(f.state().audits.length,1);});
test('HDN01b authorized receipt of an older ticket revision stays historical',async()=>{const f=await make();const a=await f.run();f.state().record.context.ticketVersion=5;f.state().record.snapshot=null;const r=await f.run();assert.equal(r.replayed,true);assert.equal(r.ticketVersion,4);assert.equal(r.auditId,a.auditId);assert.equal(f.state().audits.length,1);});
