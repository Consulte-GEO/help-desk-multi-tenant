import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import type {SqlPool} from '../../src/infrastructure/sql.ts';
export function registerWorkspaceDiscoveryTests(adminPool:()=>SqlPool,appPool:()=>SqlPool){
 async function setup(){
  const admin=adminPool(),user=randomUUID(),person=randomUUID(),a=randomUUID(),b=randomUUID(),hidden=randomUUID(),account=randomUUID();
  for(const [id,name] of [[a,'Discovery A'],[b,'Discovery B'],[hidden,'Private neighbor']])await admin.query('insert into helpdesk_core.workspaces(id,name) values($1,$2)',[id,name]);
  await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[person,user]);
  await admin.query("insert into helpdesk_auth.workspace_memberships(workspace_id,principal_id,role) values($1,$2,'agent')",[a,person]);
  await admin.query('insert into helpdesk_core.accounts(workspace_id,id,name) values($1,$2,$3)',[b,account,'Grant-only fixture']);
  await admin.query("insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,'requester')",[b,account,person]);
  return {admin,app:appPool(),user,person,a,b,hidden};
 }
 async function list(f:Awaited<ReturnType<typeof setup>>){return (await f.app.query('select helpdesk_auth.list_human_workspaces($1) as result',[f.user])).rows[0]?.result as {id:string;name:string}[];}
 test('real restricted SQL discovers membership/grant-only workspaces and excludes unrelated neighbors',async()=>{
  const f=await setup();assert.deepEqual(await list(f),[{id:f.a,name:'Discovery A'},{id:f.b,name:'Discovery B'}]);
  const identity=(await f.app.query('select helpdesk_auth.resolve_human($1,$2) as result',[f.user,f.a])).rows[0]?.result as {scopes:string[]};assert.deepEqual(identity.scopes,[]);
  await assert.rejects(f.app.query('select id from helpdesk_core.workspaces'),{code:'42501'});
 });
 test('real discovery loses revoked links at next query with no cached workspace permission',async()=>{
  const f=await setup();await f.admin.query('update helpdesk_auth.workspace_memberships set active=false where principal_id=$1',[f.person]);assert.deepEqual(await list(f),[{id:f.b,name:'Discovery B'}]);
  await f.admin.query('update helpdesk_auth.account_grants set active=false where principal_id=$1',[f.person]);assert.deepEqual(await list(f),[]);
  assert.equal((await f.app.query('select helpdesk_auth.resolve_human($1,$2) as result',[f.user,f.a])).rows[0]?.result,null);
 });
 test('real discovery rejects inactive principal and never infers access for unknown identity',async()=>{
  const f=await setup();await f.admin.query('update helpdesk_auth.principals set active=false where id=$1',[f.person]);assert.deepEqual(await list(f),[]);
  assert.deepEqual((await f.app.query('select helpdesk_auth.list_human_workspaces($1) as result',[randomUUID()])).rows[0]?.result,[]);
 });
 test('workspace discovery is not executable by browser roles or PUBLIC',async()=>{
  const f=await setup();const r=await f.admin.query("select r.rolname from pg_roles r where r.rolname in ('anon','authenticated','service_role') and has_function_privilege(r.oid,'helpdesk_auth.list_human_workspaces(uuid)','EXECUTE')");assert.equal(r.rows.length,0);
  const p=await f.admin.query("select a.grantee from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid='helpdesk_auth.list_human_workspaces(uuid)'::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'");assert.equal(p.rows.length,0);
 });
 test('private discovery returns at most one overflow sentinel without silently truncating the API list',async()=>{
  const f=await setup();for(let i=0;i<50;i++){const w=randomUUID();await f.admin.query('insert into helpdesk_core.workspaces(id,name) values($1,$2)',[w,'Overflow '+i]);await f.admin.query("insert into helpdesk_auth.workspace_memberships(workspace_id,principal_id,role) values($1,$2,'agent')",[w,f.person]);}assert.equal((await list(f)).length,51);
 });
}
