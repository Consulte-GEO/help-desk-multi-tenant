import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {planFirstAdminBootstrap} from '../../src/application/first-admin-bootstrap.ts';
import type {SqlPool} from '../../src/infrastructure/sql.ts';

export function registerFirstAdminTests(adminPool:()=>SqlPool,appPool:()=>SqlPool){
 async function setup(reason='Approved genesis'){
  const admin=adminPool(),w=randomUUID(),person=randomUUID(),auth=randomUUID();
  await admin.query('insert into helpdesk_core.workspaces(id,name) values($1,$2)',[w,'Private bootstrap fixture']);
  await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[person,auth]);
  await admin.query("insert into helpdesk_auth.workspace_memberships(workspace_id,principal_id,role) values($1,$2,'agent')",[w,person]);
  await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,0,$4,$5)',[w,person,['contexts:resolve','tickets:read'],'Initial read-only ceiling',randomUUID()]);
  const input={workspace_id:w,principal_id:person,supabase_user_id:auth,expected_scope_revision:1,request_id:randomUUID(),reason};
  return {admin,w,person,input};
 }
 async function apply(pool:SqlPool,sql:string){const client=await pool.connect();
  try{await client.query(sql);}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 async function snapshot(f:Awaited<ReturnType<typeof setup>>){
  return (await f.admin.query(`select m.role,
   (select max(revision) from helpdesk_auth.human_scope_versions where workspace_id=$1 and principal_id=$2) as revision,
   helpdesk_auth.human_scopes($1,$2) as scopes,
   (select count(*)::integer from helpdesk_audit.audit_events where workspace_id=$1) as audit_count
   from helpdesk_auth.workspace_memberships m where m.workspace_id=$1 and m.principal_id=$2`,[f.w,f.person])).rows[0];
 }
 test('SQL first administrator preserves the exact read-only ceiling, operator audit and idempotent receipt',async()=>{
  const f=await setup(),plan=planFirstAdminBootstrap(f.input);
  await apply(f.admin,plan.sql);
  assert.deepEqual(await snapshot(f),{role:'admin',revision:2,scopes:['contexts:resolve','tickets:read'],audit_count:1});
  const provenance=(await f.admin.query('select changed_by,reason,request_id from helpdesk_auth.human_scope_versions where workspace_id=$1 and principal_id=$2 and revision=2',[f.w,f.person])).rows[0];
  assert.equal(provenance?.changed_by,'postgres');assert.equal(provenance?.request_id,f.input.request_id);
  assert.equal(provenance?.reason,'Bootstrap inicial: '+f.input.reason);
  await apply(f.admin,plan.sql);assert.equal((await snapshot(f))?.audit_count,1);assert.equal((await snapshot(f))?.revision,2);
 });
 test('SQL application login cannot bootstrap even with a valid subject UUID and complete plan',async()=>{
  const f=await setup();await assert.rejects(apply(appPool(),planFirstAdminBootstrap(f.input).sql),(e:any)=>e.code==='42501');
  assert.deepEqual(await snapshot(f),{role:'agent',revision:1,scopes:['contexts:resolve','tickets:read'],audit_count:0});
 });
 test('SQL changed Auth binding, stale scope revision and inactive membership deny without partial promotion',async()=>{
  for(const mode of ['auth','revision','inactive']){
   const f=await setup();const input={...f.input};
   if(mode==='auth')input.supabase_user_id=randomUUID();if(mode==='revision')input.expected_scope_revision=0;
   if(mode==='inactive')await f.admin.query('update helpdesk_auth.workspace_memberships set active=false where workspace_id=$1 and principal_id=$2',[f.w,f.person]);
   await assert.rejects(apply(f.admin,planFirstAdminBootstrap(input).sql),(e:any)=>['42501','40001'].includes(e.code));
   assert.equal((await snapshot(f))?.role,'agent');assert.equal((await snapshot(f))?.revision,1);assert.equal((await snapshot(f))?.audit_count,0);
  }
 });
 test('SQL two competing private bootstrap requests have exactly one winner',async()=>{
  const f=await setup();const results=await Promise.allSettled([
   apply(f.admin,planFirstAdminBootstrap(f.input).sql),
   apply(f.admin,planFirstAdminBootstrap({...f.input,request_id:randomUUID()}).sql)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.deepEqual(await snapshot(f),{role:'admin',revision:2,scopes:['contexts:resolve','tickets:read'],audit_count:1});
 });
 test('SQL unrelated audit names do not collide through underscore wildcards',async()=>{
  const f=await setup();await f.admin.query("insert into helpdesk_audit.audit_events(workspace_id,principal_id,action,request_id) values($1,$2,'workspace.firstXadminYbootstrap.v1:unrelated',$3)",[f.w,f.person,randomUUID()]);
  await apply(f.admin,planFirstAdminBootstrap(f.input).sql);
  assert.equal((await snapshot(f))?.role,'admin');assert.equal((await snapshot(f))?.revision,2);
 });
 test('SQL revoked administrator and conflicting request payload cannot repeat or renew bootstrap',async()=>{
  const f=await setup();await apply(f.admin,planFirstAdminBootstrap(f.input).sql);
  await assert.rejects(apply(f.admin,planFirstAdminBootstrap({...f.input,reason:'Different reason'}).sql),(e:any)=>e.code==='40001');
  await f.admin.query("update helpdesk_auth.workspace_memberships set role='agent' where workspace_id=$1 and principal_id=$2",[f.w,f.person]);
  await assert.rejects(apply(f.admin,planFirstAdminBootstrap(f.input).sql),(e:any)=>e.code==='42501');
  await assert.rejects(apply(f.admin,planFirstAdminBootstrap({...f.input,request_id:randomUUID(),expected_scope_revision:2}).sql),(e:any)=>e.code==='40001');
  assert.equal((await snapshot(f))?.role,'agent');assert.equal((await snapshot(f))?.revision,2);
 });
 test('SQL atomicity rolls back the role and permission revision when administrative audit fails',async()=>{
  const f=await setup();
  await f.admin.query(`create function helpdesk_audit.bootstrap_test_failure() returns trigger language plpgsql as $$begin
   if new.workspace_id='${f.w}'::uuid then raise exception 'Synthetic audit rejection'; end if;return new;end$$;
   create trigger bootstrap_test_failure before insert on helpdesk_audit.audit_events for each row execute function helpdesk_audit.bootstrap_test_failure();`);
  try{
   await assert.rejects(apply(f.admin,planFirstAdminBootstrap(f.input).sql),(e:any)=>e.message==='Synthetic audit rejection');
   assert.deepEqual(await snapshot(f),{role:'agent',revision:1,scopes:['contexts:resolve','tickets:read'],audit_count:0});
  }finally{await f.admin.query('drop trigger bootstrap_test_failure on helpdesk_audit.audit_events;drop function helpdesk_audit.bootstrap_test_failure();');}
 });
 test('SQL quoting keeps apostrophes, backslashes and DO delimiter text as audited prose',async()=>{
  const f=await setup("A ' quote \\ path $helpdesk_bootstrap$; UPDATE helpdesk_core.workspaces SET name='attack'; --");
  await apply(f.admin,planFirstAdminBootstrap(f.input).sql);
  assert.equal((await f.admin.query('select name from helpdesk_core.workspaces where id=$1',[f.w])).rows[0]?.name,'Private bootstrap fixture');
  assert.equal((await f.admin.query('select reason from helpdesk_auth.human_scope_versions where workspace_id=$1 and principal_id=$2 and revision=2',[f.w,f.person])).rows[0]?.reason,'Bootstrap inicial: '+f.input.reason);
 });
}
