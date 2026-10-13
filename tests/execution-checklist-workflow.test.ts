import test from 'node:test';
import assert from 'node:assert/strict';
import {requestHash} from '../src/domain/canonical.ts';
import {createResourceAccessResolver} from '../src/application/resource-access.ts';
import {createSupportWorkflow} from '../src/application/support-workflow.ts';
import {decideSupportTransition} from '../src/domain/support-workflow.ts';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const NOW='2026-10-12T12:00:00.000000Z',LATER='2026-10-12T12:01:00.000000Z';
function fixture(){
 const p:any={id:id(2),workspaceId:id(1),kind:'human',workspaceRole:null,grants:[{accountId:id(3),role:'agent'}],scopes:['tickets:read','tickets:write']};
 const refs=[{connectionId:id(4),tenantId:'T1',type:'work',id:'A'}];let time=NOW;
 const template:any={schema:1,id:'cadastro-usuario',version:1,status:'published',items:[{id:'obras',label:'Conferir vínculo a todas as obras do pedido',required:true,allowNotApplicable:false,evidenceRequired:true,risk:'ordinary'}]};
 const reference={id:template.id,version:1,sha256:requestHash(template)};
 const profile:any={versionId:'P1',status:'published',reopenWindowMicros:'60000000',executionChecklist:reference};
 const checklist:any={template,snapshot:{workspaceId:id(1),accountId:id(3),ticketId:id(6),ticketVersion:1,profileVersionId:'P1',reference:{...reference},revision:1,entries:[{itemId:'obras',status:'done',actorId:p.id,at:NOW,evidenceRefs:['private:source-audit'],reason:null,riskAcknowledgement:null}]}};
 const switches={revoke:false,loseCommit:false,missingReader:false,nullSnapshot:false,afterWrite:()=>{},afterRead:()=>{},readCalls:0,commitCalls:0};
 const resolver=createResourceAccessResolver({manifestFingerprint:'a'.repeat(64),maxAgeMicros:60000000n,timeoutMs:5000,clock:()=>time,authority:{readAccess:async q=>switches.revoke?null:{principal:p,binding:{id:id(5),workspaceId:id(1),accountId:id(3),connectionId:id(4),tenantId:'T1',revision:'1',active:true},accessRevision:'1',manifestFingerprint:'a'.repeat(64),operation:q.operation,asOf:NOW,expiresAt:LATER,resources:refs}}});
 const scope={ticketId:id(6),principalId:p.id,workspaceId:p.workspaceId,accountId:id(3),bindingId:id(5),bindingRevision:'1',accessRevision:'1',manifestFingerprint:'a'.repeat(64),operation:'tickets.write',asOf:NOW,expiresAt:LATER,refs};
 let current:any={id:id(6),workspaceId:id(1),accountId:id(3),productInstanceId:id(7),serviceCode:'SUPPORT',createdBy:p.id,assignedTo:id(8),subject:'Pedido sintético',description:'Synthetic',status:'open',priority:'normal',version:1,coverageId:id(9),contractVersionId:id(10),contractSnapshot:{contractId:id(11),version:1,policy:{}},createdAt:NOW,updatedAt:NOW,profileVersionId:'P1',lastEventAt:NOW,closedAt:null,resolution:null,approval:'not_required'};
 let receipts=new Map<string,any>(),events:any[]=[],audits:any[]=[],outbox:any[]=[],stage:any;const statements:string[]=[];
 // Real resource resolver + workflow + runner, transport and state are controlled.
 const pool:any={connect:async()=>({query:async(sql:string)=>{
  statements.push(sql);if(sql==='BEGIN')stage={current:structuredClone(current),receipts:new Map(receipts),events:[...events],audits:[...audits],outbox:[...outbox]};
  if(sql.includes('cg_lock_ticket_scope'))return {command:'SELECT',rowCount:1,rows:[{scope}]};
  if(sql==='COMMIT'){current=stage.current;receipts=stage.receipts;events=stage.events;audits=stage.audits;outbox=stage.outbox;if(switches.loseCommit){switches.loseCommit=false;throw Error('lost COMMIT');}}
  return {command:sql.startsWith('select')?'SELECT':sql,rowCount:0,rows:[]};
 },release:()=>{}}),query:async()=>{throw Error('No pool escape');},end:async()=>{}};
 const createStore=(client:any)=>({
  readTicket:async()=>{await client.query('select locked ticket');return stage.current;},
  readProfile:async()=>structuredClone(profile),readReceipt:async(k:string)=>structuredClone(stage.receipts.get(k)??null),
  verifyAssignee:async()=>null,
  ...(switches.missingReader?{}:{readExecutionChecklist:async()=>{switches.readCalls++;await client.query('select locked checklist');switches.afterRead();return switches.nullSnapshot?null:structuredClone(checklist);}}),
  commitDecision:async(expected:number,decision:any,audit:any,intent:any,receipt:any)=>{
   switches.commitCalls++;await client.query('update expected ticket revision');
   assert.equal(stage.current.version,expected);
   if(audit.executionChecklist)assert.equal(audit.executionChecklist.snapshotRevision,checklist.snapshot.revision);
   stage.current=structuredClone(decision.after);stage.events.push(decision.event);stage.audits.push(audit);if(intent)stage.outbox.push(intent);stage.receipts.set(receipt.key,structuredClone(receipt));switches.afterWrite();
  }
 });
 const service=createSupportWorkflow({pool,resolver,createStore,clock:()=>time});
 const command=()=>({action:'resolve',expectedVersion:1,body:'Cadastro executado e conferido.'});
 return {p,refs,profile,checklist,switches,statements,ticket:()=>current,events:()=>events,audits:()=>audits,outbox:()=>outbox,time:(v:string)=>time=v,command,use:(c:unknown=command(),key='hdn-checklist-intention-001')=>service.execute(p,id(6),refs,c,key,id(99))};
}
function pending(f:ReturnType<typeof fixture>){f.checklist.snapshot.entries=[{itemId:'obras',status:'pending',actorId:null,at:null,evidenceRefs:[],reason:null,riskAcknowledgement:null}];}
test('HDN01 resolve decision carries the pinned checklist requirement',()=>{const f=fixture(),d=decideSupportTransition(f.p,f.ticket(),f.profile,f.command(),NOW);assert.deepEqual(d.requirements,[{kind:'execution_checklist',reference:f.profile.executionChecklist}]);assert.ok(Object.isFrozen(d.requirements));});
test('HDN01 pending required step prevents commitDecision and rolls back',async()=>{const f=fixture();pending(f);await assert.rejects(f.use(),{code:'workflow_checklist_required'});assert.equal(f.switches.commitCalls,0);assert.equal(f.events().length,0);assert.equal(f.ticket().version,1);assert.equal(f.statements.at(-1),'ROLLBACK');});
test('HDN01 required checklist without a real store method fails closed',async()=>{const f=fixture();f.switches.missingReader=true;await assert.rejects(f.use(),{code:'workflow_checklist_unavailable'});assert.equal(f.switches.commitCalls,0);});
test('HDN01 required checklist with missing stored snapshot fails closed',async()=>{const f=fixture();f.switches.nullSnapshot=true;await assert.rejects(f.use(),{code:'workflow_checklist_required'});assert.equal(f.switches.commitCalls,0);});
for(const [field,value] of [['ticketVersion',2],['accountId',id(33)],['ticketId',id(66)],['profileVersionId','P2']] as const)test('HDN01 mismatching '+field+' never reaches persistence',async()=>{const f=fixture();f.checklist.snapshot[field]=value;await assert.rejects(f.use(),{code:'workflow_checklist_mismatch'});assert.equal(f.switches.commitCalls,0);});
test('HDN01 accepted checklist binds minimal completion to internal audit only',async()=>{const f=fixture(),r=await f.use();assert.equal(r.status,'resolved');assert.equal(f.switches.readCalls,1);assert.equal(f.switches.commitCalls,1);const proof=f.audits()[0].executionChecklist;assert.equal(proof.templateId,'cadastro-usuario');assert.equal(proof.snapshotSha256,requestHash(f.checklist.snapshot));assert.equal(proof.snapshotRevision,1);assert.doesNotMatch(JSON.stringify([r,f.events(),f.outbox()]),/checklist|source-audit|evidenceRefs|obras/i);assert.deepEqual(Object.keys(f.outbox()[0]).sort(),['id','workspaceId','accountId','ticketId','type','version','requestId','createdAt'].sort());assert.equal(Object.hasOwn(r,'executionChecklist'),false);assert.equal(Object.hasOwn(f.events()[0],'executionChecklist'),false);assert.equal(f.statements.at(-1),'COMMIT');});
test('HDN01 draft template cannot become completion through matching hash',async()=>{const f=fixture();f.checklist.template.status='draft';f.profile.executionChecklist.sha256=requestHash(f.checklist.template);f.checklist.snapshot.reference.sha256=f.profile.executionChecklist.sha256;await assert.rejects(f.use(),{code:'workflow_checklist_required'});assert.equal(f.switches.commitCalls,0);});
test('HDN01 client cannot submit an approved checklist in a resolve command',async()=>{const f=fixture();await assert.rejects(f.use({...f.command(),executionChecklist:f.checklist}),{code:'invalid_workflow_command'});assert.equal(f.switches.commitCalls,0);});
test('HDN01 malformed checklist requirement is not a legacy exemption',async()=>{const f=fixture();f.profile.executionChecklist=null;await assert.rejects(f.use(),{code:'workflow_checklist_unavailable'});assert.equal(f.switches.commitCalls,0);});
test('HDN01 absent checklist requirement preserves existing profile behavior',async()=>{const f=fixture();delete f.profile.executionChecklist;pending(f);await f.use();assert.equal(f.switches.readCalls,0);assert.equal(f.audits()[0].executionChecklist,undefined);assert.equal(f.ticket().status,'resolved');});
test('HDN01 pending execution does not block returning to the customer',async()=>{const f=fixture();pending(f);await f.use({action:'request_customer',expectedVersion:1,body:'Confirme as obras solicitadas.'});assert.equal(f.ticket().status,'waiting_customer');assert.equal(f.switches.readCalls,0);});
test('HDN01 pending execution does not block legitimate cancellation',async()=>{const f=fixture();pending(f);await f.use({action:'cancel',expectedVersion:1,reason:'Pedido duplicado.'});assert.equal(f.ticket().status,'cancelled');assert.equal(f.switches.readCalls,0);});
test('HDN01 replay retrieves historical result without another completion or event',async()=>{const f=fixture(),c=f.command(),a=await f.use(c);pending(f);const b=await f.use(c);assert.equal(b.replayed,true);assert.equal(b.eventId,a.eventId);assert.equal(f.switches.readCalls,1);assert.equal(f.switches.commitCalls,1);assert.equal(f.events().length,1);});
test('HDN01 replay does not bypass revoked resource access',async()=>{const f=fixture(),c=f.command();await f.use(c);f.switches.revoke=true;await assert.rejects(f.use(c),{code:'resource_scope_denied'});assert.equal(f.switches.commitCalls,1);});
test('HDN01 lost commit acknowledgement does not issue another resolution',async()=>{const f=fixture(),c=f.command();f.switches.loseCommit=true;await assert.rejects(f.use(c),{code:'transaction_outcome_unknown'});assert.equal(f.ticket().status,'resolved');const r=await f.use(c);assert.equal(r.replayed,true);assert.equal(f.switches.commitCalls,1);});
test('HDN01 access expiry after the staged resolution still rolls back',async()=>{const f=fixture();f.switches.afterWrite=()=>f.time(LATER);await assert.rejects(f.use(),{code:'resource_scope_denied'});assert.equal(f.ticket().version,1);assert.equal(f.audits().length,0);assert.equal(f.statements.at(-1),'ROLLBACK');});
test('HDN01 incomplete sensitive acknowledgement blocks the real composition',async()=>{const f=fixture();f.checklist.template.items[0].risk='sensitive';f.profile.executionChecklist.sha256=requestHash(f.checklist.template);f.checklist.snapshot.reference.sha256=f.profile.executionChecklist.sha256;await assert.rejects(f.use(),{code:'workflow_checklist_confirmation_required'});assert.equal(f.switches.commitCalls,0);});

test('HDN01 resolution event cannot predate the checklist evidence it uses',async()=>{const f=fixture();f.switches.afterRead=()=>{f.time('2026-10-12T12:00:00.000001Z');f.checklist.snapshot.entries[0].at='2026-10-12T12:00:00.000001Z';};await assert.rejects(f.use(),{code:'workflow_checklist_mismatch'});assert.equal(f.switches.commitCalls,0);});
