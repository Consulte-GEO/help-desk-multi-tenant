/** Structural sentinels only. They do NOT execute SQL or prove RLS. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DATABASE_SECURITY_CONTRACT as contract} from '../src/infrastructure/database-security-contract.ts';
import {loadMigrationBundle} from '../scripts/migration-files.ts';
const path='supabase/migrations/20260917000900_human_scope_versions.sql';
const sql=()=>readFile(path,'utf8');
test('scope migration and runtime catalogue name the same private version table',async()=>{
 assert.ok(contract.tables.some(x=>x.name==='helpdesk_auth.human_scope_versions'));
 assert.match(await sql(),/create table helpdesk_auth\.human_scope_versions/i);
 assert.equal(contract.schemaVersion,'0.19.0');
});
test('scope writes remain outside HTTP role and private table is FORCE RLS with no runtime policy',async()=>{
 const text=await sql();assert.match(text,/human_scope_versions enable row level security/i);assert.match(text,/human_scope_versions force row level security/i);
 assert.doesNotMatch(text,/grant\s+(?:all|execute).*set_human_scopes[^;]*to helpdesk_app/i);
 assert.match(text,/revoke all on function helpdesk_auth\.set_human_scopes[^;]*from public,helpdesk_app/i);
 const table=contract.tables.find(x=>x.name==='helpdesk_auth.human_scope_versions')!;
 assert.equal(table.read,false);assert.equal(table.insert,false);assert.equal(table.updates.length,0);
});
test('scope history serializes revisions, rejects UPDATE/DELETE, and captures database identity',async()=>{
 const text=await sql();assert.match(text,/pg_advisory_xact_lock/);assert.match(text,/new\.revision is distinct from prior_revision\+1/i);
 assert.match(text,/tg_op<>'INSERT'/);assert.match(text,/new\.changed_by:=session_user/i);
 assert.match(text,/before update or delete on helpdesk_auth\.human_scope_versions/i);
});
test('Auth and RLS read the same live scopes and absent profile is empty',async()=>{
 const text=await sql();assert.match(text,/coalesce\(\(select v\.scopes[\s\S]*array\[\]::text\[\]/i);
 const resolve=text.slice(text.indexOf('create or replace function helpdesk_auth.resolve_human'),text.indexOf('create or replace function helpdesk_auth.has_scope'));
 assert.match(resolve,/human_scopes\(w,p\.id\)/);assert.doesNotMatch(resolve,/jsonb_build_array/);
 assert.match(text,/requested=any\(helpdesk_auth\.human_scopes\(w,p\.id\)\)/);
});
test('note receipt needs current write but not general note read',async()=>{
 const text=await sql();const lookup=text.slice(text.indexOf('create or replace function helpdesk_auth.lookup_idempotency'));
 assert.match(lookup,/op like 'notes\.create:%'[\s\S]*has_scope\(t\.workspace_id,'notes:write'\)/);
 assert.doesNotMatch(lookup,/has_scope\(t\.workspace_id,'notes:read'\)/);
 assert.match(lookup,/principal_id=helpdesk_auth\.actor_id\(\)/);
});
test('manifest extends rather than alters the eight earlier migrations',async()=>{
 const b=await loadMigrationBundle(process.cwd());assert.equal(b.migrations.length,12);assert.equal(b.schemaVersion,'0.19.0');
 const old=JSON.parse(await readFile('tests/fixtures/migration-baselines/v015.json','utf8'));
 assert.deepEqual(b.migrations.slice(0,8).map(x=>({file:x.file,sha256:x.sha256})),old.migrations);
});

test('readiness accepts only the table count of the new catalogue',async()=>{
 const {assertDatabaseSecurity,READINESS_FLAGS}=await import('../src/infrastructure/database-security.ts');
 const row={table_count:24,unsafe_tables:0,public_schema_access:false,client_schema_access:false,public_helper_execute:false,...Object.fromEntries(READINESS_FLAGS.map(k=>[k,true]))};
 const pool=(count:number)=>({query:async()=>({rows:[{...row,table_count:count}],rowCount:1}),connect:async()=>{throw Error('unused');},end:async()=>{}});
 await assertDatabaseSecurity(pool(contract.tables.length));await assert.rejects(()=>assertDatabaseSecurity(pool(contract.tables.length-1)),{code:'unsafe_database_policies'});
});
