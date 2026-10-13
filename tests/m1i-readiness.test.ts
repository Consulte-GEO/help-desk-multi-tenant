import {DATABASE_SECURITY_CONTRACT} from '../src/infrastructure/database-security-contract.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDatabaseSecurity} from '../src/infrastructure/postgres.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';
const good = () => ({table_count:DATABASE_SECURITY_CONTRACT.tables.length,unsafe_tables:0,public_schema_access:false,client_schema_access:false,public_helper_execute:false,
 schema_contract_ok:true,table_contract_ok:true,table_privileges_ok:true,column_privileges_ok:true,
 client_object_privileges_ok:true,helper_contract_ok:true,helper_privileges_ok:true,helper_settings_ok:true,
 trigger_contract_ok:true,constraint_contract_ok:true,index_contract_ok:true,policy_contract_ok:true,execution_settings_ok:true,reserved_roles_ok:true});
const poolFor=(row:Record<string,unknown>):SqlPool=>({query:async()=>({rows:[row],rowCount:1}),connect:async()=>{throw Error('unused');},end:async()=>{}});
test('readiness accepts a fully compatible catalogue report',async()=>{await assertDatabaseSecurity(poolFor(good()));});
const deviations = {
 schema_contract_ok:'schema CREATE or missing USAGE',table_contract_ok:'wrong table with unchanged count',
 table_privileges_ok:'credential SELECT or blanket UPDATE',column_privileges_ok:'column-only credential SELECT or context UPDATE',
 client_object_privileges_ok:'latent client table/function access',helper_contract_ok:'missing helper or unexpected overload',
 helper_privileges_ok:'maintenance helper executable by app',helper_settings_ok:'unsafe definer search_path or owner',
 trigger_contract_ok:'disabled or replaced deferred invariant',constraint_contract_ok:'missing or unvalidated constraint',
 index_contract_ok:'missing/invalid uniqueness index',policy_contract_ok:'missing/replaced/permissive policy',execution_settings_ok:'RLS off or replication mode wrong'
};
for(const [field,label] of Object.entries(deviations))test('readiness rejects '+label,async()=>{
 await assert.rejects(()=>assertDatabaseSecurity(poolFor({...good(),[field]:false})),{code:'unsafe_database_policies'});
});
test('incomplete catalogue reports cannot silently default to safe',async()=>{
 for(const field of Object.keys(deviations)){const r:Record<string,unknown>=good();delete r[field];await assert.rejects(()=>assertDatabaseSecurity(poolFor(r)),{code:'unsafe_database_policies'});}
});
test('NULL and textual booleans are not approvals',async()=>{
 for(const value of [null,'true',1,undefined])await assert.rejects(()=>assertDatabaseSecurity(poolFor({...good(),helper_settings_ok:value})),{code:'unsafe_database_policies'});
});
test('failed readiness response never embeds catalogue identifiers',async()=>{
 await assert.rejects(()=>assertDatabaseSecurity(poolFor({...good(),helper_privileges_ok:false,private_detail:'DO_NOT_LEAK'})),(e:unknown)=>{
  assert.equal((e as {code:string}).code,'unsafe_database_policies');assert.ok(!JSON.stringify(e).includes('DO_NOT_LEAK'));return true;
 });
});
test('catalogue query uses developer-owned parameters and only pg_catalog metadata',async()=>{
 const {DATABASE_SECURITY_QUERY}=await import('../src/infrastructure/database-security.ts');
 const calls:{sql:string;args:unknown[]|undefined}[]=[];
 const p=poolFor(good());p.query=async(sql,args)=>{calls.push({sql,args});return {rows:[good()],rowCount:1};};
 await assertDatabaseSecurity(p);assert.equal(calls.length,1);assert.equal(calls[0]!.sql,DATABASE_SECURITY_QUERY);
 assert.equal(calls[0]!.args!.length,2);assert.match(DATABASE_SECURITY_QUERY,/pg_catalog\.has_column_privilege/);
 assert.match(DATABASE_SECURITY_QUERY,/pg_catalog\.has_function_privilege/);assert.match(DATABASE_SECURITY_QUERY,/pg_catalog\.pg_trigger/);
 assert.doesNotMatch(DATABASE_SECURITY_QUERY,/\b(?:from|join)\s+helpdesk_(core|auth|integration|audit)\./i);
 assert.doesNotMatch(DATABASE_SECURITY_QUERY,/\b(?:grant|revoke|alter|drop|create)\s+(?:table|schema|function|role)\b/i);
});
test('schema contract has explicit least privileges and excludes administrative helper execution',async()=>{
 const {DATABASE_SECURITY_CONTRACT:c}=await import('../src/infrastructure/database-security-contract.ts');
 assert.equal(c.tables.length,48);assert.equal(c.functions.length,94);assert.equal(c.triggers.length,39);assert.equal(c.policies.length,38);
 assert.equal(new Set(c.tables.map(t=>t.name)).size,48);
 for(const t of c.tables.filter(t=>t.name.startsWith('helpdesk_auth.')))assert.deepEqual([t.read,t.insert,t.updates],[false,false,[]]);
 assert.deepEqual(c.tables.find(t=>t.name==='helpdesk_core.tickets')!.updates,['status','version','updated_at','priority','assigned_to']);
 assert.equal(c.functions.find(f=>f.signature==='helpdesk_auth.maintain_ephemeral(boolean, integer)')!.execute,false);
 assert.equal(c.functions.find(f=>f.signature==='helpdesk_auth.lookup_idempotency(text, text)')!.execute,true);
 assert.equal(c.triggers.filter(t=>t.deferred).length,7);
});
