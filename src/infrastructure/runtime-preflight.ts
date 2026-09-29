import {TLSSocket} from 'node:tls';
import {HelpdeskError} from '../domain/errors.ts';
import {validateBackendConfig} from './runtime-config.ts';
import type {RuntimeConfig,BackendConfig} from './runtime-config.ts';
import {assertSafeDatabaseRole,assertSchemaCompatibility,assertDatabaseSecurity} from './postgres.ts';
import type {SqlClient,SqlPool} from './sql.ts';

export type CheckId='configuration'|'driver'|'connection'|'tls'|'read_only'|'database_role'|'schema'|'database_security'|'rollback'|'cleanup';
export type PreflightCheck={id:CheckId;status:'passed'|'failed'|'not_executed';code:string};
export type DatabaseProbeReport={success:boolean;checks:PreflightCheck[]};
export type RuntimePreflightReport={
 schema:'helpdesk.runtime-preflight.v1';mode:'configuration'|'database';success:boolean;
 release_flag:'closed'|'enabled';production_approved:false;operational:false;
 auth_tested:false;hosted_function_tested:false;business_operations_dispatched:0;checks:PreflightCheck[];
};
const ids:readonly CheckId[]=['configuration','driver','connection','tls','read_only','database_role','schema','database_security','rollback','cleanup'];
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

/** Fresh, idle leased connection only; never call inside an existing business transaction.
 * The production diagnostic owns its separate pool. This lower-level export also serves disposable SQL tests.
 * No pool/query hopping, identity provisioning, or business command. Caller retains connection ownership.
 */
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

/** pg 8.16.3 exposes its negotiated stream on client.connection.stream. Fail closed if that changes. */
export function assertVerifiedPreflightTls(client:SqlClient):void{
 const stream=(client as SqlClient&{connection?:{stream?:unknown}}).connection?.stream;
 if(!(stream instanceof TLSSocket)||stream.encrypted!==true||stream.authorized!==true
  ||stream.destroyed||stream.readableEnded||stream.writableEnded)
  throw new HelpdeskError(503,'tls_not_verified','Conexão TLS verificada não confirmada.');
}
export type PreflightPoolFactory=(config:BackendConfig)=>Promise<SqlPool>;

/** Fixed client settings; caller data cannot replace verification, bounds, or the pool size. */
export function preflightPoolOptions(config:BackendConfig):Record<string,unknown>{
 return {connectionString:config.databaseUrl,max:1,connectionTimeoutMillis:5000,
  query_timeout:5000,idleTimeoutMillis:5000,application_name:'helpdesk-runtime-preflight',
  ssl:{rejectUnauthorized:true,...(config.databaseCa?{ca:config.databaseCa}:{})}};
}
/** Called exclusively for an explicit connection probe. Never substitutes another driver or transport. */
export const createPreflightPool:PreflightPoolFactory=async config=>{
 const driverName='pg';
 const driver=await import(driverName) as {Pool:new(options:Record<string,unknown>)=>SqlPool};
 return new driver.Pool(preflightPoolOptions(config));
};

/** Diagnostic only. The injectable factory is for tests; the CLI always uses the real default factory. */
export async function runRuntimePreflight(input:RuntimeConfig,options:{connect?:boolean;poolFactory?:PreflightPoolFactory}={}):Promise<RuntimePreflightReport>{
 const report:RuntimePreflightReport={schema:'helpdesk.runtime-preflight.v1',mode:options.connect===true?'database':'configuration',
  success:false,release_flag:input?.releaseApproved==='true'?'enabled':'closed',production_approved:false,operational:false,
  auth_tested:false,hosted_function_tested:false,business_operations_dispatched:0,checks:emptyChecks(ids)};
 let config:BackendConfig;
 try{config=validateBackendConfig(input);mark(report.checks,'configuration','passed');}
 catch(error){mark(report.checks,'configuration','failed',safeCode(error,'invalid_configuration'));return report;}
 if(options.connect!==true){report.success=true;return report;}
 let pool:SqlPool|undefined,client:SqlClient|undefined,stage:CheckId='driver',connectionFailure=false;
 // A checked-out client is no longer covered by the pool's idle-error listener.
 // Keep our handler on this one-shot, discarded client; never remove another owner's listener.
 const failedConnection=()=>{connectionFailure=true;};
 const requireConnection=()=>{if(connectionFailure)throw new HelpdeskError(503,'connection_check_failed','Conexão indisponível durante o diagnóstico.');};
 try{
  pool=await (options.poolFactory??createPreflightPool)(config);mark(report.checks,'driver','passed');
  stage='connection';pool.on?.('error',failedConnection);client=await pool.connect();
  client.on?.('error',failedConnection);requireConnection();mark(report.checks,stage,'passed');
  stage='tls';assertVerifiedPreflightTls(client);mark(report.checks,stage,'passed');
  // A transport error can occur between two fulfilled queries. Do not dispatch the next
  // query (including a futile rollback) after it, or accept an acknowledgement racing it.
  const healthyClient:SqlClient={query:async(sql,values)=>{
   requireConnection();const result=await client!.query(sql,values);requireConnection();return result;
  },release:()=>{throw Error('Borrowed diagnostic connection cannot be released by a guard');}};
  stage='read_only';const database=await probeDatabaseReadOnly(healthyClient);
  for(const result of database.checks){const target=report.checks.find(c=>c.id===result.id)!;Object.assign(target,result);}
 }catch(error){mark(report.checks,stage,'failed',safeCode(error,stage+'_check_failed'));}
 finally{
  if(pool){
   let cleanupFailed=false;
   // This is a one-shot owned pool: discard even a successful connection, never reuse uncertain state.
   try{client?.release(new Error('Preflight connection disposed'));}catch{cleanupFailed=true;}
   try{await pool.end();}catch{cleanupFailed=true;}
   mark(report.checks,'cleanup',cleanupFailed?'failed':'passed',cleanupFailed?'cleanup_failed':'passed');
  }
 }
 if(connectionFailure)mark(report.checks,'connection','failed','connection_check_failed');
 report.success=report.checks.every(c=>c.status==='passed');
 return report;
}
