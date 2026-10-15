/** E03 PostgreSQL regression scenarios. Invoked only by the owned native runner.
 * Written, NOT executed in E03's restricted development environment. */
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {id} from '../../tests/fixtures/registration/sample.ts';
import {createPostgresRegistrationStore} from '../../src/infrastructure/registration-store.ts';
export async function runHda03NativeRegressions(x){
 const {test,owner,app,fixture,invoke,start,state,count,scope,runTransaction,assertBorrowedTransactionIdentity,rejectTransactionValidation}=x;
 const scopes=async values=>owner.query('insert into helpdesk_auth.human_scope_versions(workspace_id,principal_id,revision,scopes) select $1,$2,coalesce(max(revision),0)+1,$3::text[] from helpdesk_auth.human_scope_versions where workspace_id=$1 and principal_id=$2',[id(1),id(20),values]);
 const human=['tickets:read','tickets:write'];
 await test('E03 native revoked core read scope denies an otherwise valid HDA receipt replay',async()=>{
  const f=await fixture();await invoke(f,f.prepare);
  try{await scopes([]);await assert.rejects(invoke(f,f.prepare),e=>e.code==='registration_scope_denied');assert.equal(await count(f,'inbox'),1);}
  finally{await scopes(human);}
  assert.equal((await invoke(f,f.prepare)).outcome,'replay');
 });
 await test('E03 native read-only core capability permits reading but not a human mutation',async()=>{
  const f=await fixture();await invoke(f,f.prepare);
  try{
   await scopes(['tickets:read']);await assert.rejects(invoke(f,{type:'cancel',commandId:randomUUID(),operationId:f.op,expectedRevision:1}),e=>e.code==='registration_scope_denied');
   const p={workspaceId:id(1),id:id(20)};
   await runTransaction(app,p,async c=>{const store=createPostgresRegistrationStore(c,p,{assertCurrent:()=>assertBorrowedTransactionIdentity(c,p),reject:e=>rejectTransactionValidation(c,e)});await store.lockScope(scope(f,'read'));assert.equal((await store.lockOperation(f.op)).state.status,'queued_analysis');});
  }finally{await scopes(human);}
 });
 await test('E03 native worker core read revocation denies claim without changing the queue',async()=>{
  const f=await fixture();await invoke(f,f.prepare);
  try{await owner.query("update helpdesk_auth.integration_connections set scopes=array[]::text[] where workspace_id=$1 and principal_id=$2",[id(1),id(21)]);await assert.rejects(invoke(f,{type:'claim',commandId:randomUUID(),leaseSeconds:15}),e=>e.code==='registration_scope_denied');assert.equal((await state(f)).status,'queued_analysis');}
  finally{await owner.query("update helpdesk_auth.integration_connections set scopes=array['tickets:read']::text[] where workspace_id=$1 and principal_id=$2",[id(1),id(21)]);}
 });
 for(const [name,args,callType] of [
  ['has_scope','w uuid,requested text','prepare'],['can_read_ticket','w uuid,a uuid,i uuid,requester uuid','prepare'],
  ['has_account','w uuid,a uuid','claim'],['product_allowed','w uuid,i uuid','claim']
 ])await test(`E03 native NULL from ${name} never authorizes an action`,async()=>{
  const f=await fixture();if(callType==='claim')await invoke(f,f.prepare);
  const sig='helpdesk_auth.'+name+'('+args.split(',').map(v=>v.trim().split(' ')[1]).join(',')+')';
  const definition=(await owner.query('select pg_get_functiondef($1::regprocedure) body',[sig])).rows[0].body;
  try{
   await owner.query(`create or replace function helpdesk_auth.${name}(${args}) returns boolean language sql stable security definer set search_path='' as $$select null::boolean$$`);
   await assert.rejects(invoke(f,callType==='prepare'?f.prepare:{type:'claim',commandId:randomUUID(),leaseSeconds:15}),e=>e.code==='registration_scope_denied');
  }finally{await owner.query(definition);}
 });
 await test('E03 native HDA grants reject NULL permission elements',async()=>{
  const f=await fixture();await assert.rejects(owner.query("update helpdesk_integration.hda02_grants set permissions=array['prepare',null]::text[] where workspace_id=$1 and binding_id=$2 and principal_id=$3",[id(1),f.binding,id(20)]),e=>e.code==='23514');
 });
 await test('E03 native standalone job mutation cannot diverge from the operation queue hash',async()=>{
  const f=await fixture();await invoke(f,f.prepare);
  const read=async()=>(await owner.query('select document from helpdesk_integration.hda02_jobs where workspace_id=$1 and id=$2',[id(1),f.job])).rows[0].document;
  const before=await read();
  await assert.rejects(owner.query("update helpdesk_integration.hda02_jobs set document=jsonb_set(document,'{configuration,policyVersion}','\"tampered.v1\"') where workspace_id=$1 and id=$2",[id(1),f.job]),e=>e.code==='HDJ05');
  assert.deepEqual(await read(),before);
 });
 await test('E03 native inconsistent lease column fails before any confirmation',async()=>{
  const f=await fixture();await start(f);
  await assert.rejects(owner.query("update helpdesk_integration.hda02_jobs set lease_until=lease_until+interval '1 millisecond' where workspace_id=$1 and id=$2",[id(1),f.job]),e=>e.code==='23514');
 });
 await test('E03 native tampering trigger cannot commit a different queue configuration',async()=>{
  const f=await fixture();await invoke(f,f.prepare);const before=await state(f);
  await owner.query("create function helpdesk_auth.hda_test_tamper_queue() returns trigger language plpgsql as $$begin new.document:=jsonb_set(new.document,'{configuration,policyVersion}','\"tampered.v1\"');return new;end$$;create trigger hda_test_tamper_queue before update on helpdesk_integration.hda02_jobs for each row execute function helpdesk_auth.hda_test_tamper_queue()");
  try{await assert.rejects(invoke(f,{type:'claim',commandId:randomUUID(),leaseSeconds:15}));assert.deepEqual(await state(f),before);assert.equal(await count(f,'inbox'),1);}
  finally{await owner.query('drop trigger hda_test_tamper_queue on helpdesk_integration.hda02_jobs;drop function helpdesk_auth.hda_test_tamper_queue()');}
 });
 await test('E03 native new human scope revision waits for the active HDA transaction',async()=>{
  const f=await fixture(),p={workspaceId:id(1),id:id(20)};
  await runTransaction(app,p,async c=>{
   const store=createPostgresRegistrationStore(c,p,{assertCurrent:()=>assertBorrowedTransactionIdentity(c,p),reject:e=>rejectTransactionValidation(c,e)});
   await store.lockScope(scope(f,'prepare'));
   const other=await owner.connect();
   try{await other.query("set lock_timeout='50ms'");await assert.rejects(other.query("insert into helpdesk_auth.human_scope_versions(workspace_id,principal_id,revision,scopes) select $1,$2,coalesce(max(revision),0)+1,array[]::text[] from helpdesk_auth.human_scope_versions where workspace_id=$1 and principal_id=$2",[id(1),id(20)]),e=>e.code==='55P03');}
   finally{await other.query("set lock_timeout='0'");other.release();}
  });
 });
}
