/** Native PostgreSQL qualification helper, called only inside the disposable PG17
 * production qualifier. Creates protocol-equivalent Supabase auth/storage tables
 * in that empty cluster and applies the EXACT prepared production storage SQL.
 * This exercises PostgreSQL policies, not Supabase HTTP infrastructure. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createImportProcessService} from '../modules/import-process/service.ts';
import {createPostgresProcessRepository} from '../modules/import-process/postgres.ts';
const id=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const empty=()=>({schemaVersion:'1',records:[],decisions:[],findings:[],artifactIds:[]});
const bucket='setup-import-artifacts';
export async function qualifyImportStorage({admin,app,root,test}) {
 const ddl=fs.readFileSync(path.join(root,'docs/implantacao/sql/IMP02_STORAGE_PRODUCTION.sql'),'utf8');
 const restrictionDdl=fs.readFileSync(path.join(root,'docs/implantacao/sql/IMP02_STORAGE_INSPECTOR_RESTRICTIONS.sql'),'utf8');
 let ready=false;
 await test('storage production SQL: exact source applies to native RLS fixture',async()=>{
  await admin.query(`
   ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb;
   CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT (NULLIF(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
   CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
    $$ SELECT COALESCE(NULLIF(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
   GRANT USAGE ON SCHEMA auth TO authenticated,anon;
   GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO authenticated,anon;
   CREATE SCHEMA storage;
   CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean NOT NULL DEFAULT false,
    file_size_limit bigint,allowed_mime_types text[]);
   CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text NOT NULL REFERENCES storage.buckets(id),
    name text NOT NULL,UNIQUE(bucket_id,name));
   ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
   ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
   GRANT USAGE ON SCHEMA storage TO authenticated,anon;
   GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,anon;
   GRANT SELECT ON storage.buckets TO authenticated,anon;
  `);
  await admin.query(ddl);
  const actual=(await admin.query('SELECT public,file_size_limit FROM storage.buckets WHERE id=$1',[bucket])).rows[0];
  assert.equal(actual.public,false);assert.equal(Number(actual.file_size_limit),60*1024*1024);ready=true;
 });
 if(!ready)return {ddlSha256:crypto.createHash('sha256').update(ddl).digest('hex'),initialized:false};
 const actor=id(801),other=id(802),inspector=id(803),support=id(804),workspace=id(806),account=id(807),project=id(888);
 await admin.query('INSERT INTO auth.users(id) VALUES ($1),($2),($3),($4)',[actor,other,inspector,support]);
 await admin.query("UPDATE auth.users SET raw_app_meta_data=$2::jsonb WHERE id=$1",[support,JSON.stringify({is_admin:true})]);
 await admin.query("INSERT INTO setup_import.access_grants(workspace_id,account_id,actor_id,requester_id,role) VALUES ($1,$2,$3,$3,'requester'),($1,$2,$4,$4,'requester')",[workspace,account,actor,other]);
 function service(who,requester=who,role='requester'){
  return createImportProcessService({repository:createPostgresProcessRepository(app),clock:()=>new Date(),newId:()=>crypto.randomUUID(),retentionDays:90,
   authority:{resolve:async(_credential,s)=>({...s,actorId:who,requesterId:requester,role,accessVersion:1,expiresAt:new Date(Date.now()+60000).toISOString()})},
   inspector:{inspect:async()=>({sha256:'a'.repeat(64),bytes:100,mime:'application/pdf',private:true,contentValidated:true,scan:'clean',objectVersion:'native-storage-test-fixture'})}});
 }
 const requesterService=service(actor);
 async function make(svc,workRef=null){
  const scope={workspaceId:workspace,accountId:account,caseId:crypto.randomUUID(),workRef};
  await svc.createCase({}, {scope,operationId:crypto.randomUUID(),expectedVersion:0,purpose:'history',target:{system:'qualification_fixture',contractVersion:'1'},snapshot:empty(),reason:'Native storage RLS qualification fixture'});
  const registered=await svc.registerArtifact({}, {scope,operationId:crypto.randomUUID(),expectedVersion:1,name:'fixture.pdf',mime:'application/pdf',bytes:100,sha256:'a'.repeat(64)});
  return {scope,id:registered.artifactId,key:[workspace,account,scope.caseId,registered.artifactId].join('/')};
 }
 const own=await make(requesterService),foreign=await make(service(other)),finalized=await make(requesterService);
 await requesterService.finalizeArtifact({}, {scope:finalized.scope,operationId:crypto.randomUUID(),expectedVersion:2,artifactId:finalized.id});
 await admin.query("INSERT INTO storage.buckets(id,name,public) VALUES ('unrelated-private','unrelated-private',false)");
 // Reproduce existing production policies: despite their names, exports SELECT
 // and INSERT authorize every signed-in identity, including a technical user.
 await admin.query(`
  INSERT INTO storage.buckets(id,name,public) VALUES ('exports','exports',false);
  INSERT INTO storage.objects(bucket_id,name) VALUES ('exports','legacy-export-fixture');
  CREATE POLICY "Users read own exports" ON storage.objects FOR SELECT TO authenticated
   USING (bucket_id='exports' AND auth.uid() IS NOT NULL);
  CREATE POLICY "Users upload exports" ON storage.objects FOR INSERT TO authenticated
   WITH CHECK (bucket_id='exports' AND auth.uid() IS NOT NULL);
 `);
 await admin.query('INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2),($3,$2)',[bucket,'admin-seeded-fixture','unrelated-private']);
 async function asRole(who,query,values=[],metadata={},role='authenticated'){
  const c=await admin.connect();
  try{
   await c.query('BEGIN');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify({role,...(who?{sub:who}:{}),app_metadata:metadata})]);
   await c.query(role==='anon'?'SET LOCAL ROLE anon':'SET LOCAL ROLE authenticated');
   const r=await c.query(query,values);await c.query('COMMIT');return r;
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
 }
 const upload=(who,key=own.key,metadata={})=>asRole(who,'INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2)',[bucket,key],metadata);
 const allowed=(who,key=own.key,metadata={})=>asRole(who,'SELECT setup_import.can_upload_artifact($1) AS ok',[key],metadata).then(r=>r.rows[0].ok);
 // RED/GREEN against native PostgreSQL in one disposable cluster. First prove
 // the unmodified production policies leak SELECT/INSERT, then apply only the
 // new migration and exercise the same operations below with denial expected.
 await test('storage baseline reproduces inspector exports access before restrictive migration',async()=>{
  const metadata={setup_import_inspector:true};
  assert.equal((await asRole(inspector,"SELECT * FROM storage.objects WHERE bucket_id='exports'",[],metadata)).rowCount,1);
  assert.equal((await asRole(inspector,"INSERT INTO storage.objects(bucket_id,name) VALUES ('exports','baseline-inspector-upload')",[],metadata)).rowCount,1);
  await admin.query("DELETE FROM storage.objects WHERE bucket_id='exports' AND name='baseline-inspector-upload'");
 });
 await test('storage inspector restrictive SQL exact source applies without changing legacy policies',async()=>{
  await admin.query(restrictionDdl);
  const legacy=(await admin.query("SELECT policyname,permissive FROM pg_policies WHERE schemaname='storage' AND policyname IN ('Users read own exports','Users upload exports') ORDER BY policyname")).rows;
  assert.deepEqual(legacy,[{policyname:'Users read own exports',permissive:'PERMISSIVE'},{policyname:'Users upload exports',permissive:'PERMISSIVE'}]);
 });
 await test('storage restrictive inspector cannot read or upload exports while ordinary exports behavior survives',async()=>{
  const metadata={setup_import_inspector:true};
  assert.equal((await asRole(inspector,"SELECT * FROM storage.objects WHERE bucket_id='exports'",[],metadata)).rowCount,0);
  await assert.rejects(()=>asRole(inspector,"INSERT INTO storage.objects(bucket_id,name) VALUES ('exports','forbidden-inspector-upload')",[],metadata),/row-level security/);
  assert.equal((await asRole(actor,"SELECT * FROM storage.objects WHERE bucket_id='exports'")).rowCount,1);
  assert.equal((await asRole(actor,"INSERT INTO storage.objects(bucket_id,name) VALUES ('exports','ordinary-export-upload')")).rowCount,1);
  assert.equal((await asRole(actor,"SELECT * FROM storage.objects WHERE bucket_id='exports'")).rowCount,2);
 });
 await test('storage anon cannot insert or select private objects or bucket',async()=>{
  assert.equal((await asRole(null,'SELECT * FROM storage.objects',[],{},'anon')).rowCount,0);
  assert.equal((await asRole(null,'SELECT * FROM storage.buckets',[],{},'anon')).rowCount,0);
  await assert.rejects(()=>asRole(null,'INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2)',[bucket,own.key],{},'anon'),/row-level security|permission denied/);
 });
 await test('storage requester INSERT exact registered pending case only',async()=>{
  assert.equal(await allowed(actor),true);assert.equal((await upload(actor)).rowCount,1);
  assert.equal(await allowed(actor,foreign.key),false);assert.equal(await allowed(other,own.key),false);
  await assert.rejects(()=>upload(actor,foreign.key),/row-level security/);
  await assert.rejects(()=>upload(other,own.key),/row-level security/);
  await assert.rejects(()=>upload(actor,own.key+'/extra'),/row-level security/);
  await assert.rejects(()=>upload(actor,[id(999),account,own.scope.caseId,own.id].join('/')),/row-level security/);
  assert.equal(await allowed(actor,finalized.key),false);await assert.rejects(()=>upload(actor,finalized.key),/row-level security/);
 });
 await test('storage requester cannot SELECT UPDATE DELETE or overwrite existing object',async()=>{
  assert.equal((await asRole(actor,'SELECT * FROM storage.objects WHERE bucket_id=$1',[bucket])).rowCount,0);
  assert.equal((await asRole(actor,'SELECT * FROM storage.buckets')).rowCount,0);
  assert.equal((await asRole(actor,"UPDATE storage.objects SET name='replaced' WHERE bucket_id=$1 AND name=$2",[bucket,own.key])).rowCount,0);
  assert.equal((await asRole(actor,'DELETE FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,own.key])).rowCount,0);
  await assert.rejects(()=>upload(actor),/duplicate key/);
  await assert.rejects(()=>asRole(actor,'INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2) ON CONFLICT(bucket_id,name) DO UPDATE SET name=EXCLUDED.name',[bucket,own.key]),/row-level security/);
  assert.equal(Number((await admin.query('SELECT count(*) FROM storage.objects WHERE bucket_id=$1 AND name=$2',[bucket,own.key])).rows[0].count),1);
 });
 await test('storage inspector SELECT only dedicated bucket and never INSERT UPDATE DELETE',async()=>{
  const metadata={setup_import_inspector:true};
  const rows=(await asRole(inspector,'SELECT * FROM storage.objects',[],metadata)).rows;assert(rows.length>=2);assert(rows.every(r=>r.bucket_id===bucket));
  assert.deepEqual((await asRole(inspector,'SELECT id FROM storage.buckets',[],metadata)).rows,[{id:bucket}]);
  await assert.rejects(()=>upload(inspector,foreign.key,metadata),/row-level security/);
  await assert.rejects(()=>upload(actor,foreign.key,metadata),/row-level security/);
  assert.equal((await asRole(inspector,"UPDATE storage.objects SET name='replaced'",[],metadata)).rowCount,0);
  assert.equal((await asRole(inspector,'DELETE FROM storage.objects',[],metadata)).rowCount,0);
  assert.equal((await asRole(inspector,'SELECT * FROM storage.objects WHERE bucket_id=$1',[bucket])).rowCount,0);
 });
 await test('storage restrictive inspector veto survives permissive object and bucket policies without creating grants',async()=>{
  // These deliberately broad policies are adversarial fixtures, NOT production
  // policies or proposed grants. They make missing restrictive vetoes observable.
  await admin.query(`
   CREATE POLICY qualification_broad_objects ON storage.objects FOR ALL TO authenticated USING (true) WITH CHECK (true);
   CREATE POLICY qualification_broad_buckets ON storage.buckets FOR ALL TO authenticated USING (true) WITH CHECK (true);
   GRANT INSERT,UPDATE,DELETE ON storage.buckets TO authenticated;
  `);
  const metadata={setup_import_inspector:true};
  try{
   const objects=(await asRole(inspector,'SELECT * FROM storage.objects',[],metadata)).rows;
   assert(objects.length>=2);assert(objects.every(r=>r.bucket_id===bucket));
   assert.deepEqual((await asRole(inspector,'SELECT id FROM storage.buckets',[],metadata)).rows,[{id:bucket}]);
   // Missing/false app_metadata remains governed by existing permissive rules.
   assert.equal((await asRole(actor,"SELECT * FROM storage.buckets WHERE id='exports'")).rowCount,1);
   assert.equal((await asRole(actor,"SELECT * FROM storage.buckets WHERE id='exports'",[],{setup_import_inspector:false})).rowCount,1);
   for(const target of [bucket,'exports','unrelated-private']){
    await assert.rejects(()=>asRole(inspector,'INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2)',[target,'must-not-create'],metadata),/row-level security/);
    assert.equal((await asRole(inspector,"UPDATE storage.objects SET name='must-not-update' WHERE bucket_id=$1",[target],metadata)).rowCount,0);
    assert.equal((await asRole(inspector,'DELETE FROM storage.objects WHERE bucket_id=$1',[target],metadata)).rowCount,0);
    assert.equal((await asRole(inspector,"UPDATE storage.buckets SET name='must-not-update' WHERE id=$1",[target],metadata)).rowCount,0);
    assert.equal((await asRole(inspector,'DELETE FROM storage.buckets WHERE id=$1',[target],metadata)).rowCount,0);
   }
   await assert.rejects(()=>asRole(inspector,"INSERT INTO storage.buckets(id,name) VALUES ('must-not-create','must-not-create')",[],metadata),/row-level security/);
   // Own visible rows cannot be moved to another bucket, even by UPDATE/upsert.
   assert.equal((await asRole(inspector,"UPDATE storage.objects SET bucket_id='exports' WHERE bucket_id=$1",[bucket],metadata)).rowCount,0);
   await assert.rejects(()=>asRole(inspector,"INSERT INTO storage.objects(bucket_id,name) VALUES ($1,$2) ON CONFLICT(bucket_id,name) DO UPDATE SET name=EXCLUDED.name",[bucket,'admin-seeded-fixture'],metadata),/row-level security/);
  }finally{
   await admin.query('DROP POLICY qualification_broad_objects ON storage.objects; DROP POLICY qualification_broad_buckets ON storage.buckets; REVOKE INSERT,UPDATE,DELETE ON storage.buckets FROM authenticated');
  }
 });
 await test('storage live grant revocation and expiry block signing predicate',async()=>{
  await admin.query('UPDATE setup_import.access_grants SET revoked_at=now() WHERE actor_id=$1 AND work_ref IS NULL',[actor]);
  assert.equal(await allowed(actor),false);
  await admin.query("UPDATE setup_import.access_grants SET revoked_at=NULL,expires_at=now()-interval '1 second' WHERE actor_id=$1 AND work_ref IS NULL",[actor]);
  assert.equal(await allowed(actor),false);
  await admin.query('UPDATE setup_import.access_grants SET expires_at=NULL WHERE actor_id=$1 AND work_ref IS NULL',[actor]);assert.equal(await allowed(actor),true);
 });
 await admin.query('INSERT INTO public.projects(id,is_active,created_by) VALUES ($1,true,$2)',[project,other]);
 await admin.query("INSERT INTO public.project_members(project_id,user_id,role) VALUES ($1,$2,'member')",[project,actor]);
 await admin.query("INSERT INTO setup_import.access_grants(workspace_id,account_id,actor_id,requester_id,role,work_ref,project_id) VALUES ($1,$2,$3,$3,'requester',$4::text,$4::uuid)",[workspace,account,actor,project]);
 const linked=await make(requesterService,project);
 await test('storage bound project requires live active state and membership or creator',async()=>{
  assert.equal(await allowed(actor,linked.key),true);
  await admin.query('DELETE FROM public.project_members WHERE project_id=$1 AND user_id=$2',[project,actor]);assert.equal(await allowed(actor,linked.key),false);
  await assert.rejects(()=>upload(actor,linked.key),/row-level security/);
  await admin.query('UPDATE public.projects SET created_by=$2 WHERE id=$1',[project,actor]);assert.equal(await allowed(actor,linked.key),true);
  await admin.query('UPDATE public.projects SET is_active=false WHERE id=$1',[project]);assert.equal(await allowed(actor,linked.key),false);
  await assert.rejects(()=>upload(actor,linked.key),/row-level security/);
  await admin.query('UPDATE public.projects SET is_active=true,created_by=$2 WHERE id=$1',[project,other]);
 });
 await admin.query("INSERT INTO setup_import.access_grants(workspace_id,account_id,actor_id,requester_id,role,work_ref,project_id) VALUES ($1,$2,$3,$4,'support',$5::text,$5::uuid)",[workspace,account,support,actor,project]);
 await test('storage support uses live server admin state, never stale JWT admin claim',async()=>{
  assert.equal(await allowed(support,linked.key,{is_admin:true}),true);
  await admin.query("UPDATE auth.users SET raw_app_meta_data='{}'::jsonb WHERE id=$1",[support]);
  assert.equal(await allowed(support,linked.key,{is_admin:true}),false);
  await assert.rejects(()=>upload(support,linked.key,{is_admin:true}),/row-level security/);
 });
 await test('storage private helper cannot be invoked by anon or read private tables',async()=>{
  await assert.rejects(()=>asRole(null,'SELECT setup_import.can_upload_artifact($1)',[own.key],{},'anon'),/permission denied/);
  await assert.rejects(()=>asRole(actor,'SELECT * FROM setup_import.access_grants'),/permission denied/);
  await assert.rejects(()=>asRole(actor,'SELECT * FROM setup_import.cases'),/permission denied/);
 });
 return {ddlSha256:crypto.createHash('sha256').update(ddl).digest('hex'),restrictionDdlSha256:crypto.createHash('sha256').update(restrictionDdl).digest('hex'),initialized:true};
}
