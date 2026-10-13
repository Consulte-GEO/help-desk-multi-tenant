import test from 'node:test';
import assert from 'node:assert/strict';
import {createExecutionChecklistService} from '../src/application/execution-checklist.ts';
import {createResourceAccessResolver} from '../src/application/resource-access.ts';
import {workflowScopeKey,type SupportWorkflowTransaction,type SupportTransitionReceipt} from '../src/application/support-workflow.ts';
import {decideExecutionChecklistMark,type ChecklistRecord} from '../src/domain/execution-checklist-mark.ts';
import type {SupportTicket,SupportWorkflowProfile,WorkflowDecision} from '../src/domain/support-workflow.ts';
import type {Principal} from '../src/domain/model.ts';
import type {SqlClient,SqlPool,SqlResult} from '../src/infrastructure/sql.ts';
import {requestHash} from '../src/domain/canonical.ts';
import {markingFixture,id,AT} from './fixtures/checklist/marking.ts';

// Real workflow + resource resolver + PostgreSQL checklist adapter + transaction
// runner. Only the physical SQL transport and unfinished workflow store below are
// synthetic. This is NOT a durability/RLS or hosted acceptance test.
async function factory(){
 const path='../src/infrastructure/support-workflow-checklist.ts';
 const api=await import(path).catch((e:unknown)=>{
  if(e&&typeof e==='object'&&'code' in e&&e.code==='ERR_MODULE_NOT_FOUND')return {};
  throw e;
 });
 assert.equal(typeof api.createPostgresChecklistWorkflow,'function','The existing workflow must be composed with its same-client PostgreSQL checklist reader');
 return api.createPostgresChecklistWorkflow as (o:{pool:SqlPool;resolver:ReturnType<typeof createResourceAccessResolver>;createStore:(client:SqlClient,p:Principal)=>Omit<SupportWorkflowTransaction,'readExecutionChecklist'>;clock?:()=>string})=>{execute:(p:Principal,ticketId:string,refs:any,command:unknown,key:string,requestId:string,signal?:AbortSignal)=>Promise<SupportTransitionReceipt>};
}
function fixture(){
 const f=markingFixture(),refs=[{connectionId:id(4),tenantId:'T1',type:'work',id:'A'}];
 const until='2026-10-12T12:01:00.000001Z';let time=AT,revoked=false;
 let record:ChecklistRecord=f.record;
 for(const [item,index] of f.template.items.map((item,index)=>[item,index] as const)){
  const d=decideExecutionChecklistMark(f.principal,record,{...f.command,itemId:item.id,expectedChecklistRevision:index,evidenceRefs:item.evidenceRequired?[f.evidence.reference]:[],acknowledgeRisk:item.risk==='sensitive'},item.evidenceRequired?[f.evidence]:[],AT);
  record={...record,snapshot:d.snapshot};
 }
 let profile:SupportWorkflowProfile={versionId:'P1',status:'published',reopenWindowMicros:'604800000000',executionChecklist:f.context.reference};
 type Receipt={key:string;hash:string;result:SupportTransitionReceipt};
 type Data={ticket:SupportTicket;receipts:Map<string,Receipt>;audits:Readonly<Record<string,unknown>>[];events:unknown[];outbox:unknown[]};
 let committed:Data={ticket:{id:id(6),workspaceId:id(1),accountId:id(3),productInstanceId:id(7),serviceCode:'SUPPORT',createdBy:f.principal.id,assignedTo:f.principal.id,subject:'Cadastro sintético',description:'Synthetic request',status:'open',priority:'normal',version:4,coverageId:id(9),contractVersionId:id(10),contractSnapshot:{contractId:id(11),version:1,policy:{}},createdAt:AT,updatedAt:AT,profileVersionId:'P1',lastEventAt:AT,closedAt:null,resolution:null,approval:'not_required'},receipts:new Map(),audits:[],events:[],outbox:[]};
 let stageRecord:ChecklistRecord,markReceipts=new Map<string,unknown>(),stageMarkReceipts:Map<string,unknown>;
 let stage:Data,acquisitions=0,releaseCount=0,readyCount=0,checklistCount=0,legacyReads=0,afterDecision=()=>{},loseCommit=false;
 let evidence:unknown=[f.evidence],role='helpdesk_app',envelope:(value:unknown)=>unknown=value=>value;
 const statements:{connection:number;sql:string}[]=[],borrowed:SqlClient[]=[];
 const authority=createResourceAccessResolver({manifestFingerprint:'a'.repeat(64),maxAgeMicros:60000000n,timeoutMs:1000,clock:()=>time,authority:{async readAccess(q){return revoked?null:{principal:f.principal,binding:{id:id(5),workspaceId:id(1),accountId:id(3),connectionId:id(4),tenantId:'T1',revision:'1',active:true},accessRevision:'1',manifestFingerprint:'a'.repeat(64),operation:q.operation,asOf:AT,expiresAt:until,resources:refs};}}});
 const pool:SqlPool={async connect(){const connection=++acquisitions;return {
  async query(sql,values):Promise<SqlResult>{
   statements.push({connection,sql});
   const result=(value:unknown):SqlResult=>({command:'SELECT',rowCount:1,rows:[{result:structuredClone(value)}]});
   if(sql==='BEGIN'){stage=structuredClone(committed);stageRecord=structuredClone(record);stageMarkReceipts=structuredClone(markReceipts);return {command:'BEGIN',rowCount:null,rows:[]};}
   if(sql==='ROLLBACK')return {command:'ROLLBACK',rowCount:null,rows:[]};
   if(sql==='COMMIT'){committed=structuredClone(stage);record=structuredClone(stageRecord);markReceipts=structuredClone(stageMarkReceipts);if(loseCommit){loseCommit=false;throw Error('Synthetic lost commit response');}return {command:'COMMIT',rowCount:null,rows:[]};}
   if(sql.startsWith('select set_config'))return result(null);
   if(sql.includes('cg_lock_ticket_scope'))return {command:'SELECT',rowCount:1,rows:[{scope:{ticketId:id(6),principalId:id(2),workspaceId:id(1),accountId:id(3),bindingId:id(5),bindingRevision:'1',accessRevision:'1',manifestFingerprint:'a'.repeat(64),operation:values?.[1],asOf:AT,expiresAt:until,refs}}]};
   if(sql.includes('hdn_checklist_contract')){readyCount++;return result({role,login:role,superuser:false,bypass:false,createRole:false,createDatabase:false,replication:false,member:false,owner:false,contract:'hdn-checklist-candidate-1'});}
   if(sql.includes('hdn_lock_execution_checklist_resolution')){checklistCount++;assert.deepEqual(values,[id(6)]);return result(envelope({record:stageRecord,evidence:stageRecord.snapshot===null?[]:evidence}));}
   if(sql==='select helpdesk_auth.hdn_lock_execution_checklist($1) as result')return result(stageRecord);
   if(sql==='select helpdesk_auth.hdn_checklist_receipt($1,$2) as result')return result(stageMarkReceipts.get(values?.[1] as string)??null);
   if(sql==='select helpdesk_auth.hdn_checklist_evidence($1,$2) as result')return result((values?.[1] as string[]).length?evidence:[]);
   if(sql==='select helpdesk_auth.hdn_mark_execution_checklist($1,$2,$3,$4,$5) as result'){
    const command=values?.[1] as Parameters<typeof decideExecutionChecklistMark>[2];
    const cmd=command as typeof f.command;
    const accepted=decideExecutionChecklistMark(f.principal,stageRecord,command,cmd.evidenceRefs.length?evidence:[],time);
    stageRecord={...stageRecord,snapshot:accepted.snapshot};
    const receipt={ticketId:id(6),workspaceId:id(1),accountId:id(3),actorId:f.principal.id,itemId:cmd.itemId,status:cmd.status,
     ticketVersion:4,checklistRevision:accepted.snapshot.revision,auditId:id(100+accepted.snapshot.revision),at:time,replayed:false};
    stageMarkReceipts.set(values?.[3] as string,{key:values?.[3],hash:values?.[2],command,result:receipt});
    return result({receipt,record:stageRecord});
   }
   if(sql.startsWith('select test.workflow_'))return result(null);
   if(sql==='update test.workflow_cas')return {command:'UPDATE',rowCount:1,rows:[]};
   assert.fail('Unexpected query in composed test: '+sql);
  },release(){releaseCount++;},
 };},query:async()=>assert.fail('No pool.query outside the transaction'),end:async()=>{}};
 // Prototype methods intentionally require `this`: spreading this instance into
 // an object is NOT valid delegation. The real host may provide a class too.
 class WorkflowStore {
  readonly client:SqlClient;readonly actor:Principal;
  constructor(client:SqlClient,actor:Principal){this.client=client;this.actor=actor;}
  async readTicket(target:string){assert.equal(target,id(6));await this.client.query('select test.workflow_ticket');return structuredClone(stage.ticket);}
  async readProfile(target:string){assert.equal(target,'P1');await this.client.query('select test.workflow_profile');return structuredClone(profile);}
  async readReceipt(key:string){await this.client.query('select test.workflow_receipt');return structuredClone(stage.receipts.get(key)??null);}
  async verifyAssignee(target:string,scope:Parameters<SupportWorkflowTransaction['verifyAssignee']>[1]){await this.client.query('select test.workflow_assignee');return {principalId:target,workspaceId:this.actor.workspaceId,accountId:id(3),scopeKey:workflowScopeKey(scope),active:true,operator:true};}
  async readExecutionChecklist(){legacyReads++;assert.fail('Do not use an unqualified reader inherited from the host');}
  async commitDecision(expected:number,decision:WorkflowDecision,audit:Readonly<Record<string,unknown>>,outbox:Readonly<Record<string,unknown>>|null,receipt:Receipt){
   assert.equal(stage.ticket.version,expected);assert.equal(this.actor.id,f.principal.id);
   await this.client.query('update test.workflow_cas');
   stage.ticket=structuredClone(decision.after);stage.events.push(decision.event);stage.audits.push(audit);if(outbox)stage.outbox.push(outbox);stage.receipts.set(receipt.key,receipt);afterDecision();
  }
 }
 const createStore=(client:SqlClient,p:Principal)=>{borrowed.push(client);return new WorkflowStore(client,p);};
 return {...f,refs,pool,authority,createStore,statements,borrowed,
  record:()=>record,setRecord:(r:ChecklistRecord)=>{record=r;},setEvidence:(v:unknown)=>{evidence=v;},setEnvelope:(fn:typeof envelope)=>{envelope=fn;},
  profile:()=>profile,setProfile:(value:SupportWorkflowProfile)=>{profile=value;},unsafeRole:()=>{role='postgres';},
  state:()=>committed,stats:()=>({acquisitions,releaseCount,readyCount,checklistCount,legacyReads}),revoke:()=>{revoked=true;},
  expireAfterDecision:()=>{afterDecision=()=>{time=until;};},loseCommit:()=>{loseCommit=true;},clock:()=>time,
  async markRequired(){
   const svc=createExecutionChecklistService({pool,resolver:authority});
   for(const item of f.template.items){
    const cmd={...f.command,itemId:item.id,expectedChecklistRevision:record.snapshot?.revision??0,evidenceRefs:item.evidenceRequired?[f.evidence.reference]:[],acknowledgeRisk:item.risk==='sensitive'};
    await svc.mark(f.principal,id(6),refs,cmd,'workflow-mark-'+item.id+'-0001',id(99));
   }
  },
  async execute(command:unknown={action:'resolve',expectedVersion:4,body:'Cadastro executado e conferido.'},key='workflow-checklist-intent-0001'){
   const create=await factory(),service=create({pool,resolver:authority,createStore,clock:()=>time});
   return service.execute(f.principal,id(6),refs,command,key,id(99));
  }
 };
}
function noCommit(f:ReturnType<typeof fixture>){assert.equal(f.state().ticket.version,4);assert.equal(f.state().audits.length,0);assert.equal(f.state().events.length,0);assert.equal(f.state().receipts.size,0);assert.equal(f.statements.some(s=>s.sql==='COMMIT'),false);assert.equal(f.statements.at(-1)?.sql,'ROLLBACK');}

test('PostgreSQL checklist reader and workflow use the same single borrowed connection',async()=>{
 const f=fixture(),result=await f.execute();assert.equal(result.status,'resolved');assert.equal(result.version,5);
 assert.deepEqual(f.stats(),{acquisitions:1,releaseCount:1,readyCount:1,checklistCount:1,legacyReads:0});
 assert.equal(new Set(f.statements.map(s=>s.connection)).size,1);assert.equal(f.statements.at(-1)?.sql,'COMMIT');
 const ready=f.statements.findIndex(s=>s.sql.includes('hdn_checklist_contract')),read=f.statements.findIndex(s=>s.sql.includes('hdn_lock_execution_checklist_resolution')),write=f.statements.findIndex(s=>s.sql==='update test.workflow_cas');assert.ok(ready<read&&read<write);
 await assert.rejects(f.borrowed[0]!.query('select after callback'),{code:'database_unavailable'});
});
test('completion binds exact private snapshot while public data remains minimal',async()=>{
 const f=fixture(),r=await f.execute(),audit=f.state().audits[0]!;
 assert.equal((audit.executionChecklist as any).snapshotSha256,requestHash(f.record().snapshot));
 assert.equal((audit.executionChecklist as any).snapshotRevision,3);
 assert.doesNotMatch(JSON.stringify([r,f.state().events,f.state().outbox]),/executionChecklist|evidenceRefs|riskAcknowledgement|note:|cadastro-usuario|"entries"/);
});
test('missing required markings prevents workflow persistence using the real SQL reader',async()=>{
 const f=fixture();f.setRecord({...f.record(),snapshot:null});f.setEvidence([]);
 await assert.rejects(f.execute(),{code:'workflow_checklist_required'});noCommit(f);assert.equal(f.stats().checklistCount,1);
});
test('current evidence is rechecked even if the supplied host reader claims completion',async()=>{
 const f=fixture();f.setEvidence([]);await assert.rejects(f.execute(),{code:'checklist_evidence_denied'});noCommit(f);assert.equal(f.stats().legacyReads,0);
});
for(const [name,change] of [
 ['foreign note', (e:any)=>({...e,ticketId:id(66)})],
 ['different author',(e:any)=>({...e,actorId:id(22)})],
 ['one-microsecond future note',(e:any)=>({...e,at:'2026-10-12T12:00:00.000002Z'})],
 ['private extra field',(e:any)=>({...e,body:'PRIVATE_NOTE_MARKER'})],
] as const)test('composed workflow refuses '+name,async()=>{
 const f=fixture();f.setEvidence([change(f.evidence)]);await assert.rejects(f.execute(),{code:'checklist_evidence_denied'});noCommit(f);
});
test('unsafe database role cannot reach checklist read or workflow persistence',async()=>{
 const f=fixture();f.unsafeRole();await assert.rejects(f.execute(),{code:'checklist_store_invalid'});noCommit(f);assert.equal(f.stats().checklistCount,0);
});
test('malformed resolution envelope is not replaced with the host snapshot',async()=>{
 const f=fixture();f.setEnvelope(v=>({...v as object,private:'PRIVATE_MARKER'}));await assert.rejects(f.execute(),{code:'checklist_store_invalid'});noCommit(f);assert.equal(f.stats().legacyReads,0);
});
test('profile mismatch cannot use an otherwise complete persisted checklist',async()=>{
 const f=fixture();f.setProfile({...f.profile(),executionChecklist:{...f.context.reference,sha256:'f'.repeat(64)}});await assert.rejects(f.execute(),{code:'workflow_checklist_mismatch'});noCommit(f);
});
test('ticket revision mismatch cannot inherit completed checklist',async()=>{
 const f=fixture(),r=f.record();f.setRecord({...r,context:{...r.context,ticketVersion:3},snapshot:{...r.snapshot!,ticketVersion:3}});await assert.rejects(f.execute(),{code:'workflow_checklist_mismatch'});noCommit(f);
});
test('a legacy profile without checklist does not require the candidate installation',async()=>{
 const f=fixture();f.setProfile({versionId:'P1',status:'published',reopenWindowMicros:'0'});f.unsafeRole();await f.execute();assert.equal(f.stats().readyCount,0);assert.equal(f.stats().checklistCount,0);assert.equal(f.state().ticket.status,'resolved');
});
test('returning an incomplete request to the customer does not demand completion',async()=>{
 const f=fixture();f.setRecord({...f.record(),snapshot:null});await f.execute({action:'request_customer',expectedVersion:4,body:'Confirme os dados do pedido.'});assert.equal(f.state().ticket.status,'waiting_customer');assert.equal(f.stats().checklistCount,0);
});
test('assignee verification preserves a prototype method receiver',async()=>{
 const f=fixture();await f.execute({action:'transfer',expectedVersion:4,targetPrincipalId:id(8),reason:'Transferência autorizada.'});assert.equal(f.state().ticket.assignedTo,id(8));assert.equal(f.stats().checklistCount,0);
});
test('authorized replay returns the original receipt without rereading completion',async()=>{
 const f=fixture(),first=await f.execute();f.setEvidence([]);const second=await f.execute();assert.equal(second.eventId,first.eventId);assert.equal(second.replayed,true);assert.equal(f.stats().checklistCount,1);assert.equal(f.state().events.length,1);
});
test('revoked authority cannot retrieve the previous resolution',async()=>{
 const f=fixture();await f.execute();const before=f.stats().acquisitions;f.revoke();await assert.rejects(f.execute(),{code:'resource_scope_denied'});assert.equal(f.stats().acquisitions,before);
});
test('lost COMMIT preserves unknown and replays a single resolution',async()=>{
 const f=fixture();f.loseCommit();await assert.rejects(f.execute(),{code:'transaction_outcome_unknown'});assert.equal(f.state().ticket.status,'resolved');const r=await f.execute();assert.equal(r.replayed,true);assert.equal(f.state().events.length,1);assert.equal(f.stats().checklistCount,1);
});
test('expiration after preparing the decision does not confirm staged work',async()=>{
 const f=fixture();f.expireAfterDecision();await assert.rejects(f.execute(),{code:'resource_scope_denied'});noCommit(f);
});

test('three real marking commands feed the SQL reader before one workflow resolution',async()=>{
 const f=fixture();f.setRecord({...f.record(),snapshot:null});
 await assert.rejects(f.execute(),{code:'workflow_checklist_required'});assert.equal(f.state().events.length,0);
 await f.markRequired();assert.equal(f.record().snapshot?.revision,3);assert.equal(f.state().ticket.status,'open');
 const r=await f.execute();assert.equal(r.status,'resolved');assert.equal(f.state().events.length,1);
 assert.equal(f.statements.filter(s=>s.sql==='select helpdesk_auth.hdn_mark_execution_checklist($1,$2,$3,$4,$5) as result').length,3);
 assert.equal((f.state().audits[0]!.executionChecklist as any).snapshotRevision,3);
});
test('evidence removed after real marking commands blocks resolution without erasing markings',async()=>{
 const f=fixture();f.setRecord({...f.record(),snapshot:null});await f.markRequired();
 f.setEvidence([]);await assert.rejects(f.execute(),{code:'checklist_evidence_denied'});
 assert.equal(f.state().ticket.status,'open');assert.equal(f.state().audits.length,0);assert.equal(f.record().snapshot?.revision,3);
});
