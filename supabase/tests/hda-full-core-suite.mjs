/** Owned PG17 only: actual complete migration chain and HDA candidate. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {HelpdeskService} from '../../src/application/helpdesk.ts';
import {PostgresUnitOfWork} from '../../src/infrastructure/postgres.ts';
import {runTransaction,assertBorrowedTransactionIdentity,rejectTransactionValidation} from '../../src/infrastructure/transaction.ts';
import {createPostgresRegistrationStore} from '../../src/infrastructure/registration-store.ts';
import {executeRegistrationCommand} from '../../src/application/registration-persistence.ts';
import {createRegistrationInputSnapshot} from '../../src/domain/registration-contracts.ts';
import {input,id} from '../../tests/fixtures/registration/sample.ts';
import {REGISTRATION_SECURITY_CONTRACT as DATABASE_SECURITY_CONTRACT} from '../../src/infrastructure/registration-security-contract.ts';
import {assertDatabaseSecurity} from '../../src/infrastructure/database-security.ts';
import {runRegistrationStorageChecks} from './registration-storage-checks.mjs';
export async function runNativeSuite({owner,app,worker}){
 const checks=[];const test=async(name,fn)=>{try{await fn();checks.push({name,result:'passed'});}catch(e){checks.push({name,result:'failed',code:e.code??'assertion_or_runtime_error',message:String(e.message).slice(0,250)});}};
 const w=id(1),a=id(2),who=id(20),product=id(30),instance=id(4),contract=id(31),version=id(32),connection=id(33),cgBinding=id(34);
 await owner.query("insert into helpdesk_core.workspaces(id,name) values($1,'HDA complete chain')",[w]);
 await owner.query("insert into helpdesk_core.accounts(workspace_id,id,name) values($1,$2,'Synthetic')",[w,a]);
 await owner.query("insert into helpdesk_core.products(workspace_id,id,code,name) values($1,$2,'HDA','Synthetic')",[w,product]);
 await owner.query("insert into helpdesk_core.product_instances(workspace_id,product_id,id,environment) values($1,$2,$3,'staging')",[w,product,instance]);
 await owner.query("insert into helpdesk_core.services(workspace_id,product_id,code,name) values($1,$2,'SUPPORT','Support')",[w,product]);
 await owner.query("insert into helpdesk_core.support_contracts(workspace_id,id,name) values($1,$2,'Synthetic')",[w,contract]);
 await owner.query("insert into helpdesk_core.contract_versions(workspace_id,contract_id,id,version,published,valid_from,policy) values($1,$2,$3,1,true,'2020-01-01','{}')",[w,contract,version]);
 await owner.query("insert into helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) values($1,$2,$3,$4,'SUPPORT',$5,$6)",[w,a,product,instance,version,randomUUID()]);
 await owner.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[who,randomUUID()]);
 await owner.query("insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,'account_manager')",[w,a,who]);
 const person={id:who,workspaceId:w,kind:'human',workspaceRole:null,grants:[{accountId:a,role:'account_manager'}],scopes:['tickets:read','tickets:write']};
 await owner.query('select helpdesk_auth.set_human_scopes($1,$2,$3,0,$4,$5)',[w,who,person.scopes,'HDA owned fixture',randomUUID()]);
 const service=new HelpdeskService(new PostgresUnitOfWork(app));
 const ticket=(await service.create(person,{accountId:a,productInstanceId:instance,serviceCode:'SUPPORT',subject:'HDA synthetic',description:'Owned complete chain',priority:'normal'},randomUUID(),randomUUID())).ticket.id;
 const binding=randomUUID(),op=randomUUID(),snapshot=createRegistrationInputSnapshot({...input(),operationId:op,ticketId:ticket});
 await owner.query("insert into helpdesk_integration.hda02_bindings values($1,$2,$3,$4,$5::jsonb,$6,1,true,clock_timestamp()+interval '1 hour')",[w,a,binding,ticket,JSON.stringify(snapshot.target),snapshot.targetHash]);
 await owner.query("insert into helpdesk_integration.hda02_grants values($1,$2,$3,array['read','prepare','cancel'],true,clock_timestamp()+interval '1 hour')",[w,binding,who]);
 const scope=permission=>({workspaceId:w,accountId:a,actorId:who,bindingId:binding,permission});
 const invoke=command=>runTransaction(app,person,async c=>executeRegistrationCommand(createPostgresRegistrationStore(c,person,{assertCurrent:()=>assertBorrowedTransactionIdentity(c,person),reject:e=>rejectTransactionValidation(c,e)}),scope(command.type),command));
 const prepare={type:'prepare',commandId:randomUUID(),snapshot,jobId:randomUUID(),configuration:{agentVersionRef:'fixture.v1',knowledgeRefs:[],policyVersion:'policy.v1'}};
 const read=()=>runTransaction(app,person,async c=>{const store=createPostgresRegistrationStore(c,person,{assertCurrent:()=>assertBorrowedTransactionIdentity(c,person),reject:e=>rejectTransactionValidation(c,e)});await store.lockScope(scope('read'));return store.lockOperation(op);});
 await test('complete immutable migration chain matches the current fixed schema contract',async()=>assert.equal((await owner.query('select helpdesk_auth.schema_version() version')).rows[0].version,DATABASE_SECURITY_CONTRACT.schemaVersion));
 await test('unprotected core permits prepare through the real transaction service',async()=>{await invoke(prepare);assert.equal((await read()).state.snapshot.operationId,op);});
 const review=internal=>runTransaction(app,person,async c=>(await c.query('select helpdesk_auth.hda06_review_target($1::uuid,$2::boolean) result',[ticket,internal])).rows[0].result);
 await test('HDA customer target resolves only the authorized operation and never returns state or queue',async()=>{assert.deepEqual(await review(false),{workspaceId:w,accountId:a,ticketId:ticket,bindingId:binding,operationId:op});});
 await test('HDA account manager cannot choose the private operator audience',async()=>{await assert.rejects(review(true),{code:'HDJ01'});});
 await test('HDA private reader uses current database operator grant and refuses after revocation',async()=>{await owner.query("update helpdesk_auth.account_grants set role='agent' where workspace_id=$1 and account_id=$2 and principal_id=$3",[w,a,who]);assert.equal((await review(true)).operationId,op);await owner.query("update helpdesk_auth.account_grants set role='account_manager' where workspace_id=$1 and account_id=$2 and principal_id=$3",[w,a,who]);await assert.rejects(review(true),{code:'HDJ01'});});
 await test('HDA binding read grant revocation overrides core account access',async()=>{await owner.query('update helpdesk_integration.hda02_grants set enabled=false where workspace_id=$1 and binding_id=$2',[w,binding]);await assert.rejects(review(false),{code:'HDJ01'});await owner.query('update helpdesk_integration.hda02_grants set enabled=true where workspace_id=$1 and binding_id=$2',[w,binding]);});
 await owner.query('insert into helpdesk_auth.cg_resource_connections(workspace_id,id,product_instance_id) values($1,$2,$3)',[w,connection,instance]);
 await owner.query("insert into helpdesk_auth.cg_resource_bindings(workspace_id,account_id,id,connection_id,tenant_id) values($1,$2,$3,$4,'Synthetic')",[w,a,cgBinding,connection]);
 await owner.query('insert into helpdesk_core.cg_ticket_resource_sets(workspace_id,account_id,ticket_id,binding_id,expected_count) values($1,$2,$3,$4,1)',[w,a,ticket,cgBinding]);
 await owner.query("insert into helpdesk_core.cg_ticket_resource_refs(workspace_id,account_id,ticket_id,resource_type,resource_id) values($1,$2,$3,'work','A')",[w,a,ticket]);
 await owner.query('update helpdesk_core.cg_ticket_resource_sets set sealed=true where workspace_id=$1 and ticket_id=$2',[w,ticket]);
 for(const operation of ['tickets.read','tickets.write']){
  await owner.query("insert into helpdesk_auth.cg_resource_grant_sets(workspace_id,account_id,binding_id,principal_id,operation,source_revision,as_of,expires_at,expected_count) values($1,$2,$3,$4,$5,'source-1',clock_timestamp()-interval '1 second',clock_timestamp()+interval '10 minutes',1)",[w,a,cgBinding,who,operation]);
  await owner.query("insert into helpdesk_auth.cg_resource_grant_refs(workspace_id,account_id,binding_id,principal_id,operation,resource_type,resource_id) values($1,$2,$3,$4,$5,'work','A')",[w,a,cgBinding,who,operation]);
  await owner.query('update helpdesk_auth.cg_resource_grant_sets set active=true where workspace_id=$1 and binding_id=$2 and operation=$3',[w,cgBinding,operation]);
 }
 await owner.query("insert into helpdesk_auth.cg_resource_observations(workspace_id,account_id,binding_id,principal_id,operation,grant_revision,binding_revision,access_revision,manifest_fingerprint,as_of,expires_at,expected_count) select workspace_id,account_id,binding_id,principal_id,operation,revision,'binding-1',source_revision,$3,as_of,expires_at,expected_count from helpdesk_auth.cg_resource_grant_sets where workspace_id=$1 and binding_id=$2",[w,cgBinding,'a'.repeat(64)]);
 await test('protected read uses actual CG observation and bounds HDA deadline',async()=>{await read();await runTransaction(app,person,async c=>{const r=await c.query('select helpdesk_auth.hda02_lock_scope($1::jsonb) value',[JSON.stringify(scope('read'))]);assert.ok(Date.parse(r.rows[0].value.expiresAt)-Date.now()<610000);});});
 await test('write-only revocation preserves private read and denies cancellation',async()=>{
  await owner.query("update helpdesk_auth.cg_resource_grant_sets set active=false where workspace_id=$1 and binding_id=$2 and operation='tickets.write'",[w,cgBinding]);
  await read();await assert.rejects(invoke({type:'cancel',commandId:randomUUID(),operationId:op,expectedRevision:1}));
 });
 await owner.query("update helpdesk_auth.cg_resource_grant_sets set active=false where workspace_id=$1 and binding_id=$2 and operation='tickets.read'",[w,cgBinding]);
 await test('CG revocation overrides HDA grant for reads, replay and cancellation without writes',async()=>{
  await assert.rejects(read());await assert.rejects(review(false),{code:'HDJ01'});await assert.rejects(invoke(prepare));await assert.rejects(invoke({type:'cancel',commandId:randomUUID(),operationId:op,expectedRevision:1}));
  assert.equal(Number((await owner.query('select count(*) n from helpdesk_integration.hda02_inbox')).rows[0].n),1);
 });
 await test('CG expiry after command staging refuses COMMIT and rolls back cancellation',async()=>{
  await owner.query('update helpdesk_auth.cg_resource_grant_sets set active=false where workspace_id=$1 and binding_id=$2',[w,cgBinding]);
  await owner.query("update helpdesk_auth.cg_resource_grant_sets set expires_at=clock_timestamp()+interval '2 seconds',revision=revision+1 where workspace_id=$1 and binding_id=$2",[w,cgBinding]);
  await owner.query('update helpdesk_auth.cg_resource_grant_sets set active=true where workspace_id=$1 and binding_id=$2',[w,cgBinding]);
  await owner.query("insert into helpdesk_auth.cg_resource_observations(workspace_id,account_id,binding_id,principal_id,operation,grant_revision,binding_revision,access_revision,manifest_fingerprint,as_of,expires_at,expected_count) select workspace_id,account_id,binding_id,principal_id,operation,revision,'binding-1',source_revision,$3,as_of,expires_at,expected_count from helpdesk_auth.cg_resource_grant_sets where workspace_id=$1 and binding_id=$2",[w,cgBinding,'a'.repeat(64)]);
  let staged=false;
  await assert.rejects(runTransaction(app,person,async c=>{
   const store=createPostgresRegistrationStore(c,person,{assertCurrent:()=>assertBorrowedTransactionIdentity(c,person),reject:e=>rejectTransactionValidation(c,e)});
   await executeRegistrationCommand(store,scope('cancel'),{type:'cancel',commandId:randomUUID(),operationId:op,expectedRevision:1});staged=true;
   await c.query('select pg_sleep(2.1)');
  }));
  assert.equal(staged,true);assert.equal(Number((await owner.query('select count(*) n from helpdesk_integration.hda02_inbox')).rows[0].n),1);
  assert.equal((await owner.query('select state from helpdesk_integration.hda02_operations where id=$1',[op])).rows[0].state.status,'queued_analysis');
 });
 await runRegistrationStorageChecks({owner,app,worker,test});
 return {checks,total:checks.length,failures:checks.filter(x=>x.result!=='passed').length,fullCore:true,origin:false,hosted:false};
}
