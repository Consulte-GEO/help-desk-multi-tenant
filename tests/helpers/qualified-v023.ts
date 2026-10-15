/** Test-only exact qualification of the immutable schema 0.23 prefix. */
import {readFile} from 'node:fs/promises';
import {HelpdeskError} from '../../src/domain/errors.ts';
import {DATABASE_SECURITY_CONTRACT} from '../../src/infrastructure/consultegeo-v023-security-contract.ts';
import {DATABASE_SECURITY_QUERY,READINESS_FLAGS} from '../../src/infrastructure/database-security.ts';
import {assertSafeDatabaseRole} from '../../src/infrastructure/postgres.ts';
import type {SqlPool,SqlClient} from '../../src/infrastructure/sql.ts';
import type {CheckId,PreflightCheck,DatabaseProbeReport} from '../../src/infrastructure/runtime-preflight.ts';
import {loadMigrationBundle} from '../../scripts/migration-files.ts';
import type {MigrationBundle} from '../../scripts/migration-files.ts';
export {DATABASE_SECURITY_CONTRACT,DATABASE_SECURITY_QUERY};
const baseline=JSON.parse(await readFile(new URL('../fixtures/migration-baselines/v023.json',import.meta.url),'utf8')) as {format:1;schemaVersion:string;migrations:{file:string;sha256:string}[]};
export async function loadQualifiedV023Bundle(root:string):Promise<MigrationBundle>{
 const bundle=await loadMigrationBundle(root);
 if(!((bundle.schemaVersion==='0.23.0'&&bundle.migrations.length===16)||(bundle.schemaVersion==='0.24.0'&&bundle.migrations.length===17)||(bundle.schemaVersion==='0.25.0'&&(bundle.migrations.length===18||bundle.migrations.length===19))||(bundle.schemaVersion==='0.26.0'&&bundle.migrations.length===20))
  ||JSON.stringify(bundle.migrations.slice(0,16).map(({file,sha256})=>({file,sha256})))!==JSON.stringify(baseline.migrations))
  throw Error('The qualified 0.23 migration prefix changed.');
 if(bundle.migrations.length>=17){const {verifyConsulteGeoUpgrade}=await import('../../scripts/consultegeo-upgrade.ts');await verifyConsulteGeoUpgrade(root);}
 return Object.freeze({schemaVersion:'0.23.0',migrations:Object.freeze(bundle.migrations.slice(0,16))});
}
export async function assertSchemaCompatibility(pool:SqlPool):Promise<void>{
 let version:unknown;try{version=(await pool.query('select helpdesk_auth.schema_version() as version')).rows[0]?.version;}catch{throw new HelpdeskError(503,'schema_version_mismatch','Banco incompatível com esta versão da API.');}
 if(version!==DATABASE_SECURITY_CONTRACT.schemaVersion)throw new HelpdeskError(503,'schema_version_mismatch','Banco incompatível com esta versão da API.');
}
export async function assertDatabaseSecurity(pool:SqlPool):Promise<void>{
 const result=await pool.query(DATABASE_SECURITY_QUERY,[JSON.stringify(DATABASE_SECURITY_CONTRACT),[...DATABASE_SECURITY_CONTRACT.schemas]]),row=result.rows[0];
 if(result.rows.length!==1||!row||row.table_count!==DATABASE_SECURITY_CONTRACT.tables.length||row.unsafe_tables!==0
  ||row.public_schema_access!==false||row.client_schema_access!==false||row.public_helper_execute!==false||READINESS_FLAGS.some(key=>row[key]!==true))
  throw new HelpdeskError(503,'unsafe_database_policies','Estrutura ou proteções do banco não correspondem à versão homologável.');
}
const databaseIds:readonly CheckId[]=['read_only','database_role','schema','database_security','rollback'];
const emptyChecks=(names:readonly CheckId[]):PreflightCheck[]=>names.map(id=>({id,status:'not_executed',code:'not_executed'}));
function mark(checks:PreflightCheck[],id:CheckId,status:'passed'|'failed',code:string=status):void{
 const item=checks.find(c=>c.id===id);if(!item)throw Error('Unknown preflight stage');Object.assign(item,{status,code});
}
const safeCodes=new Set(['invalid_configuration','configuration_required','unsafe_database_configuration',
 'unsafe_tls_configuration','invalid_auth_configuration','rate_limit_configuration_required','unsafe_database_role',
 'schema_version_mismatch','unsafe_database_policies','read_only_required','tls_not_verified']);
function safeCode(error:unknown,fallback:string):string{
 return error instanceof HelpdeskError&&safeCodes.has(error.code)?error.code:fallback;
}

export async function probeDatabaseReadOnly(client:SqlClient):Promise<DatabaseProbeReport>{
 const checks=emptyChecks(databaseIds);let stage:CheckId='read_only';
 const borrowed:SqlPool={query:(sql,values)=>client.query(sql,values),
  connect:async()=>{throw Error('Preflight guards must use the leased connection');},end:async()=>{}};
 try{
  const begin=await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  if(begin.command!=='BEGIN')throw new HelpdeskError(503,'read_only_required','Diagnóstico exige transação somente leitura.');
  for(const statement of ["SET LOCAL statement_timeout = '5s'","SET LOCAL lock_timeout = '2s'","SET LOCAL idle_in_transaction_session_timeout = '10s'"]){
   const result=await client.query(statement);if(result.command!=='SET')throw new HelpdeskError(503,'read_only_required','Diagnóstico exige transação somente leitura.');
  }
  const state=await client.query("select current_setting('transaction_read_only') as read_only");
  if(state.rows.length!==1||state.rows[0]?.read_only!=='on')throw new HelpdeskError(503,'read_only_required','Diagnóstico exige transação somente leitura.');
  mark(checks,stage,'passed');
  stage='database_role';await assertSafeDatabaseRole(borrowed);mark(checks,stage,'passed');
  stage='schema';await assertSchemaCompatibility(borrowed);mark(checks,stage,'passed');
  stage='database_security';await assertDatabaseSecurity(borrowed);mark(checks,stage,'passed');
 }catch(error){mark(checks,stage,'failed',safeCode(error,stage+'_check_failed'));}
 // Even uncertain BEGIN acknowledgement is cleaned up. This is not a retry or a COMMIT.
 try{
  const rollback=await client.query('ROLLBACK');
  if(rollback.command!=='ROLLBACK')throw Error('Rollback acknowledgement missing');
  mark(checks,'rollback','passed');
 }catch{mark(checks,'rollback','failed','rollback_failed');}
 return {success:checks.every(c=>c.status==='passed'),checks};
}
