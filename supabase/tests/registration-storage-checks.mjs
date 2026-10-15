/** Owned disposable cluster only. Synthetic fixtures prove persistence and refusal,
 * never origin qualification, hosted identity publication or an AI analysis. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {captureM05SecurityInventory} from './m05-security-inventory.ts';
import {REGISTRATION_SECURITY_CONTRACT} from '../../src/infrastructure/registration-security-contract.ts';
import {assertDatabaseSecurity} from '../../src/infrastructure/database-security.ts';
import {createRegistrationAnalysisWorker} from '../../src/application/registration-analysis-worker.ts';
import {createManualRegistrationEngine} from '../../src/infrastructure/registration-runtime.ts';
import {createPostgresRegistrationTransactions} from '../../src/infrastructure/registration-transactions.ts';
import {executeRegistrationCommand} from '../../src/application/registration-persistence.ts';
import {createPostgresRegistrationStore} from '../../src/infrastructure/registration-store.ts';
import {runTransaction,assertBorrowedTransactionIdentity,rejectTransactionValidation} from '../../src/infrastructure/transaction.ts';
import {HelpdeskService} from '../../src/application/helpdesk.ts';import {PostgresUnitOfWork} from '../../src/infrastructure/postgres.ts';
import {createRegistrationInputSnapshot} from '../../src/domain/registration-contracts.ts';
import {input,id} from '../../tests/fixtures/registration/sample.ts';
import {writeFile} from 'node:fs/promises';
export async function runRegistrationStorageChecks({owner,app,worker,test}){
 await test('official0.26 exact full catalogue and dedicated worker effective ACLs qualify',async()=>{
  await assertDatabaseSecurity(app,'0.26.0');
  const inventory=await captureM05SecurityInventory(owner,{directory:'evidence/hda-ci/production-promotion',schemaVersion:'0.26.0',notificationWorker:true});
  const actual=(await owner.query("select n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')' as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname=any($1) and has_function_privilege('helpdesk_registration_worker',p.oid,'EXECUTE') order by signature",[inventory.schemas])).rows;
  inventory.roles.push({name:'helpdesk_registration_worker',schemas:['helpdesk_auth'],functions:actual.map(row=>row.signature)});
  await writeFile('evidence/hda-ci/production-promotion/security-inventory.json',JSON.stringify(inventory,null,2)+'\n');
  const normalized=rows=>[...rows].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  for(const key of ['tables','functions','triggers','constraints','policies','roles'])assert.deepEqual(normalized(inventory[key]),normalized(REGISTRATION_SECURITY_CONTRACT[key]),key);
  assert.equal((await worker.query('select helpdesk_auth.hda02_storage_version() version')).rows[0].version,'1.0.0');
 });
 await test('empty authorized queue is idle and app cannot enumerate worker targets',async()=>{
  assert.equal((await worker.query('select helpdesk_auth.hda02_worker_target() target')).rows[0].target,null);
  await assert.rejects(app.query('select helpdesk_auth.hda02_worker_target()'),{code:'42501'});
  for(const pool of [app,worker])await assert.rejects(pool.query('select * from helpdesk_integration.hda02_operations'),{code:'42501'});
 });
 const w=id(1),a=id(2),who=id(20),product=id(30),instance=randomUUID(),connection=randomUUID(),actor=randomUUID();
 await owner.query("insert into helpdesk_core.product_instances(workspace_id,product_id,id,environment) values($1,$2,$3,'staging')",[w,product,instance]);
 await owner.query("insert into helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) values($1,$2,$3,$4,'SUPPORT',$5,$6)",[w,a,product,instance,id(32),randomUUID()]);
 await owner.query("insert into helpdesk_auth.principals(id,kind) values($1,'integration')",[actor]);
 await owner.query("insert into helpdesk_auth.integration_connections(workspace_id,id,product_instance_id,principal_id) values($1,$2,$3,$4)",[w,connection,instance,actor]);
 await owner.query("insert into helpdesk_auth.source_scope_bindings(workspace_id,connection_id,account_id,external_account_ref) values($1,$2,$3,'owned-fixture')",[w,connection,a]);
 const person={id:who,workspaceId:w,kind:'human',workspaceRole:null,grants:[{accountId:a,role:'account_manager'}],scopes:['tickets:read','tickets:write']};
 const analyzer={id:actor,workspaceId:w,kind:'integration',workspaceRole:null,grants:[{accountId:a,role:'requester'}],scopes:['tickets:read','tickets:write'],productInstanceIds:[instance],connectionId:connection};
 const queued=async requester=>{
  const ticket=(await new HelpdeskService(new PostgresUnitOfWork(app)).create(requester,{accountId:a,productInstanceId:instance,serviceCode:'SUPPORT',subject:'Synthetic manual review',description:'Owned cluster only',priority:'normal'},randomUUID(),randomUUID())).ticket.id;
  const binding=randomUUID(),op=randomUUID(),snapshot=createRegistrationInputSnapshot({...input(),operationId:op,ticketId:ticket});
  await owner.query("insert into helpdesk_integration.hda02_bindings values($1,$2,$3,$4,$5::jsonb,$6,1,true,clock_timestamp()+interval '1 hour')",[w,a,binding,ticket,JSON.stringify(snapshot.target),snapshot.targetHash]);
  for(const [principal,permissions] of [[who,['read','prepare']],[actor,['read','claim','complete','fail']]])await owner.query("insert into helpdesk_integration.hda02_grants values($1,$2,$3,$4,true,clock_timestamp()+interval '1 hour')",[w,binding,principal,permissions]);
  const scope={workspaceId:w,accountId:a,actorId:who,bindingId:binding,permission:'prepare'};
  await runTransaction(app,person,async c=>executeRegistrationCommand(createPostgresRegistrationStore(c,person,{assertCurrent:()=>assertBorrowedTransactionIdentity(c,person),reject:e=>rejectTransactionValidation(c,e)}),scope,{type:'prepare',commandId:randomUUID(),snapshot,jobId:randomUUID(),configuration:{agentVersionRef:'manual-review.v1',knowledgeRefs:[],policyVersion:'manual-review.v1'}}));
  return {ticket,binding,op,snapshot};
 };
 const human=await queued(person),changedTarget=await queued(analyzer),changedTicket=await queued(analyzer);
 const retarget={...changedTarget.snapshot.target,sourceBeneficiaryKey:'retargeted-fixture'};
 await owner.query('update helpdesk_integration.hda02_bindings set target=$3::jsonb,target_hash=helpdesk_auth.hda02_hash($3::jsonb),revision=revision+1 where workspace_id=$1 and id=$2',[w,changedTarget.binding,JSON.stringify(retarget)]);
 await owner.query('update helpdesk_integration.hda02_bindings set ticket_id=$3,revision=revision+1 where workspace_id=$1 and id=$2',[w,changedTicket.binding,human.ticket]);
 const {ticket,binding,op}=await queued(analyzer);
 // A second actual fixture actor has account/product/HDA grants for the older
 // protected job. Discovery must still ignore it; no technical CG bypass.
 const protectedActor=randomUUID(),protectedConnection=randomUUID(),protectedBinding=(await owner.query('select binding_id from helpdesk_integration.hda02_operations where id<>$1 order by created_at limit 1',[op])).rows[0].binding_id;
 await owner.query("insert into helpdesk_auth.principals(id,kind) values($1,'integration')",[protectedActor]);
 await owner.query('insert into helpdesk_auth.integration_connections(workspace_id,id,product_instance_id,principal_id) values($1,$2,$3,$4)',[w,protectedConnection,id(4),protectedActor]);
 await owner.query("insert into helpdesk_auth.source_scope_bindings(workspace_id,connection_id,account_id,external_account_ref) values($1,$2,$3,'owned-protected-fixture')",[w,protectedConnection,a]);
 await owner.query("insert into helpdesk_integration.hda02_grants values($1,$2,$3,array['read','claim','complete','fail'],true,clock_timestamp()+interval '1 hour')",[w,protectedBinding,protectedActor]);
 const identity={workspaceId:w,accountId:a,actorId:actor,bindingId:binding};
 const analysis=createRegistrationAnalysisWorker({identity,transactions:createPostgresRegistrationTransactions({pool:worker,identity}),runner:createManualRegistrationEngine(),enabled:()=>true});
 await test('real restricted worker settles manual_review atomically without draft, ticket mutation or outbox',async()=>{
  const context=(await worker.query("select nullif(current_setting('app.workspace_id',true),'') workspace,nullif(current_setting('app.principal_id',true),'') actor")).rows[0];
  assert.deepEqual(context,{workspace:null,actor:null});
  assert.deepEqual((await worker.query('select helpdesk_auth.hda02_worker_target() target')).rows[0].target,identity);
  const stale=(await owner.query('select state from helpdesk_integration.hda02_operations where id=any($1::uuid[])',[[human.op,changedTarget.op,changedTicket.op]])).rows;
  assert.equal(stale.length,3);assert.ok(stale.every(row=>row.state.status==='queued_analysis'));
  const before=(await owner.query('select status,version from helpdesk_core.tickets where id=$1',[ticket])).rows[0],outbox=Number((await owner.query('select count(*) n from helpdesk_integration.outbox_events')).rows[0].n);
  const result=await analysis.runOnce(randomUUID());assert.equal(result.status,'manual_review');
  const state=(await owner.query('select state from helpdesk_integration.hda02_operations where id=$1',[op])).rows[0].state;
  assert.equal(state.status,'manual_review');assert.equal(state.draft,null);
  assert.deepEqual((await owner.query('select status,version from helpdesk_core.tickets where id=$1',[ticket])).rows[0],before);
  assert.equal(Number((await owner.query('select count(*) n from helpdesk_integration.outbox_events')).rows[0].n),outbox);
  assert.equal(Number((await owner.query('select count(*) n from helpdesk_integration.hda02_inbox where operation_id=$1',[op])).rows[0].n),3);
  assert.equal((await worker.query('select helpdesk_auth.hda02_worker_target() target')).rows[0].target,null);
  const denied=createRegistrationAnalysisWorker({identity:{workspaceId:w,accountId:a,actorId:protectedActor,bindingId:protectedBinding},transactions:createPostgresRegistrationTransactions({pool:worker,identity:{workspaceId:w,accountId:a,actorId:protectedActor,bindingId:protectedBinding}}),runner:createManualRegistrationEngine(),enabled:()=>true});
  assert.equal((await denied.runOnce(randomUUID())).status,'reconciliation_required');
 });
 await test('revocation refuses the same worker and never synthesizes a replacement identity',async()=>{
  await owner.query('update helpdesk_integration.hda02_grants set enabled=false where workspace_id=$1 and binding_id=$2 and principal_id=$3',[w,binding,actor]);
  assert.equal((await analysis.runOnce(randomUUID())).status,'reconciliation_required');
  assert.equal((await worker.query('select helpdesk_auth.hda02_worker_target() target')).rows[0].target,null);
 });
}
