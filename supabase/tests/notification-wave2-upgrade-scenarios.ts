/** Actual eighteenth-file migration on the owned non-superuser operator. */
import test from 'node:test';import assert from 'node:assert/strict';import type {SqlPool} from '../../src/infrastructure/sql.ts';import {loadMigrationBundle} from '../../scripts/migration-files.ts';import {verifyConsulteGeoEmailWave2} from '../../scripts/consultegeo-email-wave2-upgrade.ts';
import {DATABASE_SECURITY_CONTRACT as V024} from '../../src/infrastructure/consultegeo-v024-security-contract.ts';import {DATABASE_SECURITY_CONTRACT as V025} from '../../src/infrastructure/database-security-contract.ts';
import {assertSafeDatabaseRole,assertSchemaCompatibility,assertDatabaseSecurity} from '../../src/infrastructure/postgres.ts';import {assertRuntimeDatabase} from '../../src/infrastructure/authentication-database.ts';
import {verifyCustomerReturnRepair} from '../../scripts/consultegeo-customer-return-upgrade.ts';
export function registerWave2UpgradeTests(operatorPool:()=>SqlPool,controlPool:()=>SqlPool,appPool:()=>SqlPool,parentSnapshot:()=>Promise<unknown>){
 const mode={authenticationOnly:false,administration:false,workflow:true,intake:true};
 const priorRows=async()=>Promise.all(V024.tables.map(async t=>{const value=t.name==='helpdesk_integration.hdn_notification_routes'?"to_jsonb(t)-ARRAY['effective_after','recipient_ids']":'to_jsonb(t)';return {table:t.name,rows:(await controlPool().query(`select coalesce(jsonb_agg((${value}) order by (${value})::text),'[]'::jsonb) as rows from ${t.name} t`)).rows[0]!.rows};}));
 const snapshot=async()=>({catalogue:await parentSnapshot(),rows:await priorRows()});
 async function refuses(sql:string,code:string){const operator=operatorPool(),before=await snapshot();try{await assert.rejects(operator.query(sql.replace(/\bCOMMIT;\s*$/,'')),{code});}finally{await operator.query('ROLLBACK');assert.deepEqual(await snapshot(),before);}}
 test('wave2 migration refuses existing unsafe authority or partial installation before changing any row',async suite=>{
  assert.equal((await operatorPool().query('select current_database() db')).rows[0]!.db,'helpdesk_test');await verifyConsulteGeoEmailWave2(process.cwd());const bundle=await loadMigrationBundle(process.cwd()),sql=bundle.migrations[17]!.sql;
  assert.equal(await assertRuntimeDatabase(appPool(),mode),'0.24.0');
  for(const probe of [
   {name:'extra ordinary table read',apply:'GRANT SELECT ON helpdesk_integration.hdn_notification_templates TO helpdesk_app',undo:'REVOKE SELECT ON helpdesk_integration.hdn_notification_templates FROM helpdesk_app',code:'HDE04'},
   {name:'partial review function',apply:"CREATE FUNCTION helpdesk_auth.hdnr_unqualified() RETURNS boolean LANGUAGE sql SET search_path='' AS $$SELECT false$$",undo:'DROP FUNCTION helpdesk_auth.hdnr_unqualified()',code:'HDE03'}
  ])await suite.test(probe.name,async()=>{await operatorPool().query(probe.apply);try{await refuses(sql,probe.code);}finally{await operatorPool().query(probe.undo);}});
 });
 test('wave2 final catalogue failures roll back all fourteen bodies and preserve existing delivery history',async suite=>{
  const sql=(await loadMigrationBundle(process.cwd())).migrations[17]!.sql,marker='-- WAVE2 FINAL CATALOGUE';assert.ok(sql.includes(marker));
  for(const [name,fault] of [
   ['private form responses readable by app','GRANT SELECT ON helpdesk_core.hdnr_forms TO helpdesk_app;'],
   ['worker receives review command helper','GRANT EXECUTE ON FUNCTION helpdesk_auth.hdnr_context(uuid) TO helpdesk_notification_worker;'],
   ['authority publication trigger missing','DROP TRIGGER hdnr_authority_publication ON helpdesk_auth.hdnr_rosters;']
  ])await suite.test(name,()=>refuses(sql.replace(marker,fault+'\n'+marker),'HDE06'));
 });
 test('a genuine operator promotes the actual eighteenth file with exact application and worker authority and no data activation',async()=>{
  const before=await priorRows(),bundle=await loadMigrationBundle(process.cwd());try{await operatorPool().query(bundle.migrations[17]!.sql);}catch(e){await operatorPool().query('ROLLBACK');throw e;}
  await assertSafeDatabaseRole(appPool());await assertSchemaCompatibility(appPool());await assertDatabaseSecurity(appPool());assert.equal(await assertRuntimeDatabase(appPool(),mode),'0.25.0');assert.deepEqual(await priorRows(),before);
  assert.equal((await operatorPool().query("select count(*)::int as n from helpdesk_integration.hdn_notification_routes where effective_after is not null or recipient_ids is not null")).rows[0]!.n,0);
  const added=V025.tables.filter(t=>!V024.tables.some(old=>old.name===t.name));assert.equal(added.length,12);for(const t of added)assert.equal((await operatorPool().query('select count(*)::int as n from '+t.name)).rows[0]!.n,0,'Migration does not provision participants invitations policies or recipients');
  assert.deepEqual(V025.roles,V024.roles);assert.equal(V025.roles.find(r=>r.name==='helpdesk_notification_worker')!.functions.length,13);
 });
 test('replaying wave2 is refused without altering the promoted installation',async()=>{const sql=(await loadMigrationBundle(process.cwd())).migrations[17]!.sql;await refuses(sql,'HDE02');await assertDatabaseSecurity(appPool());});
 test('the nineteenth customer return repair preserves all rows and authority, and refuses unsafe or repeated application',async suite=>{
  const qualified=await verifyCustomerReturnRepair(process.cwd()),bundle=await loadMigrationBundle(process.cwd()),sql=bundle.migrations[18]!.sql;
  assert.equal(qualified.file,bundle.migrations[18]!.file);
  const rows=async()=>Promise.all(V025.tables.map(async t=>({table:t.name,rows:(await controlPool().query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as rows from ${t.name} t`)).rows[0]!.rows})));
  const unchangedCatalogue=async()=>{const snapshot=await parentSnapshot() as {functions:Record<string,unknown>[]};assert.equal(snapshot.functions.filter(f=>f.nspname==='helpdesk_auth'&&f.proname==='hdn_notification_facts_wave2_team').length,1);return {...snapshot,functions:snapshot.functions.map(f=>f.nspname==='helpdesk_auth'&&f.proname==='hdn_notification_facts_wave2_team'?{...f,body:'reviewed nineteenth append'}:f)};};
  const before=await rows(),catalogue=await unchangedCatalogue(),body=async()=>(await controlPool().query("select md5(prosrc) as hash from pg_proc where oid='helpdesk_auth.hdn_notification_facts_wave2_team(uuid)'::regprocedure")).rows[0]!.hash;
  const priorBody=await body();assert.equal(priorBody,'f8bb37b0667d9f56b0487b9f155ef225');
  for(const [name,probe,code] of [
   ['different predecessor body',sql.replace(priorBody,'0'.repeat(32)),'HDF02'],
   ['unsafe final catalogue',sql.replace('-- CUSTOMER RETURN FINAL CATALOGUE','GRANT SELECT ON helpdesk_core.hdnr_forms TO helpdesk_app;\n-- CUSTOMER RETURN FINAL CATALOGUE'),'HDE06']
  ] as const)await suite.test(name,async()=>{await refuses(probe,code);assert.equal(await body(),priorBody);assert.deepEqual(await rows(),before);});
  await suite.test('ordinary app cannot run the repair',async()=>{try{await assert.rejects(appPool().query(sql),{code:'HDF01'});}finally{await appPool().query('ROLLBACK');}assert.equal(await body(),priorBody);assert.deepEqual(await rows(),before);});
  try{await operatorPool().query(sql);}catch(error){await operatorPool().query('ROLLBACK');throw error;}
  assert.notEqual(await body(),priorBody);assert.deepEqual(await rows(),before);assert.deepEqual(await unchangedCatalogue(),catalogue);
  await assertDatabaseSecurity(appPool());assert.equal(await assertRuntimeDatabase(appPool(),mode),'0.25.0');
  await refuses(sql,'HDF02');assert.deepEqual(await rows(),before);
 });
}
