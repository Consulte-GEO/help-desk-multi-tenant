import test from 'node:test';
import assert from 'node:assert/strict';
import {TLSSocket} from 'node:tls';
import {Socket} from 'node:net';
import {validateBackendConfig,validateRuntimeConfig} from '../src/infrastructure/runtime-config.ts';
import type {RuntimeConfig,BackendConfig} from '../src/infrastructure/runtime-config.ts';
import type {SqlPool,SqlClient,SqlResult} from '../src/infrastructure/sql.ts';
import {READINESS_FLAGS} from '../src/infrastructure/database-security.ts';
import {DATABASE_SECURITY_CONTRACT} from '../src/infrastructure/database-security-contract.ts';

const modulePath='../src/infrastructure/runtime-preflight.ts';
async function implementation(){
 const m=await import(modulePath).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof m.runRuntimePreflight,'function','Private runtime preflight is not implemented');
 return m;
}
const config:RuntimeConfig={databaseUrl:'postgresql://helpdesk_app:fixture_password@pooler.invalid/postgres',
 supabaseUrl:'https://project.supabase.co',publishableKey:'sb_publishable_fixture',rateLimitHmacKey:'f'.repeat(43),releaseApproved:'false'};
const role={name:'helpdesk_app',login_name:'helpdesk_app',superuser:false,bypass_rls:false,owns_tables:false,
 owns_objects:false,create_role:false,create_database:false,replication:false,member_of_roles:false};
const security={table_count:DATABASE_SECURITY_CONTRACT.tables.length,unsafe_tables:0,public_schema_access:false,
 client_schema_access:false,public_helper_execute:false,...Object.fromEntries(READINESS_FLAGS.map(k=>[k,true]))};
type FixtureOptions={role?:Record<string,unknown>;schema?:string;security?:Record<string,unknown>;readOnly?:string;
 failAt?:'begin'|'timeouts'|'rollback'|'connect'|'release'|'end';tls?:'plain'|'unauthorized'|'missing'|'impostor';
 queryFailure?:boolean;badRollbackTag?:boolean;badBeginTag?:boolean};
function fixture(o:FixtureOptions={}){
 const calls:string[]=[],releases:(Error|undefined)[]=[];let ends=0,connects=0,poolQueries=0;
 const socket=new TLSSocket(new Socket());socket.authorized=o.tls!=='unauthorized';
 const query=async(sql:string,values?:unknown[]):Promise<SqlResult>=>{
  calls.push(sql);
  if(sql.startsWith('BEGIN')){if(o.failAt==='begin')throw Error('SECRET connection URL');return {command:o.badBeginTag?'SELECT':'BEGIN',rows:[],rowCount:null};}
  if(sql==='ROLLBACK'){if(o.failAt==='rollback')throw Error('SECRET rollback');return {command:o.badRollbackTag?'SELECT':'ROLLBACK',rows:[],rowCount:null};}
  if(sql.startsWith('SET LOCAL')){if(o.failAt==='timeouts')throw Error('SECRET settings');return {command:'SET',rows:[],rowCount:null};}
  if(sql.includes("current_setting('transaction_read_only')"))return {command:'SELECT',rows:[{read_only:o.readOnly??'on'}],rowCount:1};
  if(o.queryFailure)throw Object.assign(Error('SECRET SQL'),{code:'42P01'});
  if(sql.includes('session_user as login_name'))return {command:'SELECT',rows:[o.role??role],rowCount:1};
  if(sql.includes('helpdesk_auth.schema_version()'))return {command:'SELECT',rows:[{version:o.schema??'0.21.0'}],rowCount:1};
  if(sql.includes('expected_tables')){assert.equal(values?.[0],JSON.stringify(DATABASE_SECURITY_CONTRACT));return {command:'SELECT',rows:[o.security??security],rowCount:1};}
  throw Error('Unexpected query in private preflight: '+sql);
 };
 const client:SqlClient&{connection?:{stream:unknown}}={query,release(error){releases.push(error);socket.destroy();if(o.failAt==='release')throw Error('SECRET release');},
  ...(o.tls==='missing'?{}:{connection:{stream:o.tls==='plain'?{}:o.tls==='impostor'?{encrypted:true,authorized:true}:socket}})};
 const pool:SqlPool={query:async()=>{poolQueries++;throw Error('Guards must share the leased transaction');},
  connect:async()=>{connects++;if(o.failAt==='connect')throw Error('SECRET password');return client;},
  end:async()=>{ends++;socket.destroy();if(o.failAt==='end')throw Error('SECRET end');}};
 return {client,pool,calls,releases,done:()=>socket.destroy(),state:()=>({ends,connects,poolQueries})};
}
const check=(r:any,id:string)=>r.checks.find((c:any)=>c.id===id);
function noApproval(r:any){assert.equal(r.production_approved,false);assert.equal(r.operational,false);
 assert.equal(r.auth_tested,false);assert.equal(r.hosted_function_tested,false);assert.equal(r.business_operations_dispatched,0);}
function noSecrets(r:unknown){assert.doesNotMatch(JSON.stringify(r),/SECRET|fixture_password|pooler\.invalid|sb_publishable_fixture|select |BEGIN ISOLATION|"sql"|"stack"/i);}

test('offline preflight validates without opening the production gate or constructing a pool',async()=>{
 const {runRuntimePreflight}=await implementation();let creations=0;
 const before=structuredClone(config);
 const r=await runRuntimePreflight(config,{poolFactory:async()=>{creations++;throw Error('No driver allowed');}});
 assert.equal(r.success,true);assert.equal(r.mode,'configuration');assert.equal(r.release_flag,'closed');
 assert.equal(check(r,'configuration').status,'passed');assert.equal(check(r,'connection').status,'not_executed');
 assert.equal(creations,0);assert.deepEqual(config,before);noApproval(r);noSecrets(r);
 assert.throws(()=>validateRuntimeConfig(config),{code:'release_gate_closed'});
});
test('offline report explicitly distinguishes configured release flag from approval',async()=>{
 const {runRuntimePreflight}=await implementation();const r=await runRuntimePreflight({...config,releaseApproved:'true'});
 assert.equal(r.release_flag,'enabled');noApproval(r);
});
test('configuration error is safe and stops before driver creation',async()=>{
 const {runRuntimePreflight}=await implementation();let created=false;
 const r=await runRuntimePreflight({...config,databaseUrl:'postgresql://helpdesk_app%:SECRET@pooler.invalid/postgres'},
  {connect:true,poolFactory:async()=>{created=true;throw Error('Must not create');}});
 assert.equal(r.success,false);assert.equal(created,false);assert.equal(check(r,'configuration').code,'invalid_configuration');noSecrets(r);
});
test('connected preflight uses one restricted read-only transaction and the real guards',async()=>{
 const {runRuntimePreflight}=await implementation();const f=fixture();let seen:BackendConfig|undefined;
 const r=await runRuntimePreflight(config,{connect:true,poolFactory:async(c:BackendConfig)=>{seen=c;return f.pool;}});
 assert.equal(r.success,true);assert.equal(r.mode,'database');assert.equal(r.release_flag,'closed');
 assert.deepEqual(seen,validateBackendConfig(config));assert.deepEqual(f.state(),{ends:1,connects:1,poolQueries:0});
 assert.equal(f.calls[0],'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal(f.calls.at(-1),'ROLLBACK');
 assert.equal(f.calls.filter(s=>s==='ROLLBACK').length,1);assert.equal(f.releases.length,1);assert.ok(f.releases[0] instanceof Error);
 for(const id of ['configuration','driver','connection','tls','read_only','database_role','schema','database_security','rollback','cleanup'])assert.equal(check(r,id).status,'passed',id);
 assert.ok(f.calls.includes("SET LOCAL statement_timeout = '5s'"));assert.ok(f.calls.includes("SET LOCAL lock_timeout = '2s'"));
 assert.ok(f.calls.includes("SET LOCAL idle_in_transaction_session_timeout = '10s'"));
 assert.ok(!f.calls.some(s=>/^(INSERT|UPDATE|DELETE|GRANT|REVOKE|ALTER|COMMIT|CREATE|DROP|TRUNCATE)\b/i.test(s)));
 noApproval(r);noSecrets(r);
});
for(const tls of ['plain','unauthorized','missing','impostor'] as const)test('TLS '+tls+' prevents all SQL',async()=>{
 const {runRuntimePreflight}=await implementation();const f=fixture({tls});
 const r=await runRuntimePreflight(config,{connect:true,poolFactory:async()=>f.pool});
 assert.equal(r.success,false);assert.equal(check(r,'tls').status,'failed');assert.equal(check(r,'read_only').status,'not_executed');
 assert.deepEqual(f.calls,[]);assert.equal(f.state().ends,1);assert.equal(f.releases.length,1);noSecrets(r);
});
for(const [o,id,code] of [
 [{readOnly:'off'},'read_only','read_only_required'],
 [{role:{...role,name:'postgres'}},'database_role','unsafe_database_role'],
 [{role:{...role,login_name:'postgres'}},'database_role','unsafe_database_role'],
 [{schema:'0.17.0'},'schema','schema_version_mismatch'],
 [{security:{...security,public_helper_execute:true}},'database_security','unsafe_database_policies'],
 [{queryFailure:true},'database_role','database_role_check_failed']
] as [FixtureOptions,string,string][])test('probe safely rejects '+id+' '+code,async()=>{
 const {runRuntimePreflight}=await implementation();const f=fixture(o);
 const r=await runRuntimePreflight(config,{connect:true,poolFactory:async()=>f.pool});
 assert.equal(r.success,false);assert.equal(check(r,id).status,'failed');assert.equal(check(r,id).code,code);
 assert.equal(check(r,'rollback').status,'passed');assert.equal(f.calls.at(-1),'ROLLBACK');noSecrets(r);noApproval(r);
});
for(const failAt of ['begin','timeouts','rollback','connect','release','end'] as const)test('preflight fails safely and closes its pool after '+failAt,async()=>{
 const {runRuntimePreflight}=await implementation();const f=fixture({failAt});
 const r=await runRuntimePreflight(config,{connect:true,poolFactory:async()=>f.pool});
 assert.equal(r.success,false);assert.equal(f.state().ends,1);assert.equal(f.state().connects,1);noSecrets(r);noApproval(r);
 if(failAt!=='connect')assert.equal(f.releases.length,1);
});
for(const option of ['badRollbackTag','badBeginTag'] as const)test('missing transaction acknowledgement rejects '+option,async()=>{
 const {runRuntimePreflight}=await implementation();const f=fixture({[option]:true});
 const r=await runRuntimePreflight(config,{connect:true,poolFactory:async()=>f.pool});assert.equal(r.success,false);noSecrets(r);
});
test('raw driver failure never reaches the report',async()=>{
 const {runRuntimePreflight}=await implementation();const r=await runRuntimePreflight(config,
  {connect:true,poolFactory:async()=>{throw Error('SECRET postgresql://private:password@host');}});
 assert.equal(r.success,false);assert.equal(check(r,'driver').status,'failed');noSecrets(r);
});
test('database probe alone returns its connection to the caller without taking ownership',async()=>{
 const {probeDatabaseReadOnly}=await implementation();const f=fixture();
 try{const r=await probeDatabaseReadOnly(f.client);assert.equal(r.success,true);assert.equal(f.releases.length,0);assert.equal(f.state().ends,0);}
 finally{f.done();}
});


test('default pool options enforce client TLS, CA and bounded exclusive connection',async()=>{
 const m=await implementation();assert.equal(typeof m.preflightPoolOptions,'function');
 const c=validateBackendConfig({...config,databaseCa:'certificate-fixture'});
 const options=m.preflightPoolOptions(c);
 assert.equal(options.max,1);assert.equal(options.connectionTimeoutMillis,5000);assert.equal(options.query_timeout,5000);
 assert.equal(options.idleTimeoutMillis,5000);assert.deepEqual(options.ssl,{rejectUnauthorized:true,ca:'certificate-fixture'});
 assert.equal(options.connectionString,c.databaseUrl);assert.equal(options.application_name,'helpdesk-runtime-preflight');
 assert.equal(Object.hasOwn(options,'allowExitOnIdle'),false);
});
test('idle pool error prevents success without logging its payload',async()=>{
 const {runRuntimePreflight}=await implementation();const f=fixture();let listener:((error:Error)=>void)|undefined;
 f.pool.on=(_event,fn)=>{listener=fn;};const end=f.pool.end;
 f.pool.end=async()=>{listener?.(Error('SECRET provider payload'));await end();};
 const report=await runRuntimePreflight(config,{connect:true,poolFactory:async()=>f.pool});
 assert.equal(report.success,false);assert.equal(check(report,'connection').code,'connection_check_failed');noSecrets(report);
});


test('M1-R2 gate includes the expanded application and PostgreSQL suites',async()=>{
 const path='../scripts/homologation-core.mjs';const {steps}=await import(path);
 assert.ok(steps.find((s:any)=>s.id==='application').minTests>=1099);
 assert.ok(steps.find((s:any)=>s.id==='postgres').minTests>=204);
});
