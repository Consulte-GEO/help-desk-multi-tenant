import {randomUUID} from 'node:crypto';
import type {SqlPool} from './sql.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {privateJson} from '../http/controlled-json.ts';
import {createPostgresRegistrationTransactions} from './registration-transactions.ts';
import {createRegistrationAnalysisWorker} from '../application/registration-analysis-worker.ts';
import type {RegistrationAnalysisEngine,AnalysisEngineInput} from '../application/registration-analysis-ports.ts';
import {parseRegistrationScopeRequest} from '../domain/registration-persistence.ts';
import {REGISTRATION_SECURITY_CONTRACT,REGISTRATION_SECURITY_QUERY} from './registration-security-contract.ts';
import {READINESS_FLAGS} from './database-security.ts';
import {unsafeServiceMembershipSql} from '../../scripts/consultegeo-service-membership.ts';

const unavailable=()=>new HelpdeskError(503,'registration_worker_unavailable','Análise cadastral indisponível até qualificação.');
export type RegistrationRuntimeConfig={enabled?:string;releaseApproved?:string;mode?:string;databaseUrl?:string;databaseCa?:string};
export function readRegistrationRuntimeEnvironment(get:(name:string)=>string|undefined):RegistrationRuntimeConfig{return {enabled:get('HELPDESK_REGISTRATION_ANALYSIS_ENABLED'),releaseApproved:get('HELPDESK_RELEASE_APPROVED'),mode:get('HELPDESK_REGISTRATION_ANALYSIS_MODE'),databaseUrl:get('HELPDESK_REGISTRATION_DATABASE_URL'),databaseCa:get('HELPDESK_REGISTRATION_DATABASE_CA')};}
export function validateRegistrationRuntimeConfig(raw:RegistrationRuntimeConfig){
 try{
  if(raw.enabled!=='true'||raw.releaseApproved!=='true'||raw.mode!=='manual_review'||!raw.databaseUrl||/[\u0000-\u0020\u007f]/.test(raw.databaseUrl))throw unavailable();
  const url=new URL(raw.databaseUrl),user=decodeURIComponent(url.username),password=decodeURIComponent(url.password);
  if(!['postgres:','postgresql:'].includes(url.protocol)||!/^helpdesk_registration_worker(?:\.[A-Za-z0-9_-]+)?$/.test(user)||!password||/[\u0000-\u001f\u007f]/.test(user+password+decodeURIComponent(url.pathname))||!url.hostname||url.pathname.length<2||url.search||url.hash)throw unavailable();
  if(raw.databaseCa!==undefined&&(typeof raw.databaseCa!=='string'||!raw.databaseCa.trim()||raw.databaseCa.length>32768))throw unavailable();
  return Object.freeze({databaseUrl:raw.databaseUrl,mode:'manual_review' as const,...(raw.databaseCa?{databaseCa:raw.databaseCa}:{})});
 }catch{throw unavailable();}
}
/** Deliberate operational mode. No model, origin API, inferred proposal or clean result. */
export function createManualRegistrationEngine():RegistrationAnalysisEngine{return Object.freeze({async analyze({job}:AnalysisEngineInput,signal?:AbortSignal){
 if(signal?.aborted)throw unavailable();
 if(job.agentVersionRef!=='manual-review.v1')throw new HelpdeskError(503,'registration_runner_offline','Motor solicitado não configurado.');
 return {output:{schema:1,jobId:job.jobId,operationId:job.operationId,inputRevision:job.inputRevision,disposition:'manual_review',proposedFields:{},missingFields:[],warnings:['Análise automática e origem Novo GEO não configuradas. Conferência humana necessária.'],knowledgeRefs:[]}};
}});}
const workerRole=REGISTRATION_SECURITY_CONTRACT.roles.find(role=>role.name==='helpdesk_registration_worker')!;
export const REGISTRATION_WORKER_QUERY=`with schemas as(select * from pg_catalog.pg_namespace where nspname in ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')),
 tables as(select c.* from pg_catalog.pg_class c join schemas n on n.oid=c.relnamespace where c.relkind in ('r','p','v','m','f','S')),
 functions as(select p.*,n.nspname||'.'||p.proname||'('||pg_catalog.oidvectortypes(p.proargtypes)||')' as signature from pg_catalog.pg_proc p join schemas n on n.oid=p.pronamespace)
 select current_user as actor,session_user as login,
 exists(select 1 from pg_catalog.pg_roles r where r.rolname=current_user and not(r.rolsuper or r.rolbypassrls or r.rolcreatedb or r.rolcreaterole or r.rolreplication or r.rolinherit) and not ${unsafeServiceMembershipSql('r.oid')}) as role,
 not exists(select 1 from schemas n where n.nspowner=current_user::regrole or pg_catalog.has_schema_privilege(current_user,n.oid,'USAGE') is distinct from (n.nspname='helpdesk_auth') or pg_catalog.has_schema_privilege(current_user,n.oid,'CREATE,USAGE WITH GRANT OPTION')) as schemas,
 not exists(select 1 from tables t where t.relowner=current_user::regrole or pg_catalog.has_table_privilege(current_user,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') or pg_catalog.has_any_column_privilege(current_user,t.oid,'SELECT,INSERT,UPDATE,REFERENCES')) as tables,
 not exists(select 1 from functions p where p.proowner=current_user::regrole or pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE') is distinct from (p.signature=any($1::text[])) or pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE WITH GRANT OPTION')) as helpers,
 not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relname='users' and (pg_catalog.has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') or pg_catalog.has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) as auth,
 coalesce((select ssl from pg_catalog.pg_stat_ssl where pid=pg_catalog.pg_backend_pid()),false) as tls,
 helpdesk_auth.hda02_storage_version()='1.0.0' as storage`;
/** Full reviewed app catalogue plus independent dedicated worker effective ACL/TLS. */
export async function assertRegistrationWorkerDatabase(pool:Pick<SqlPool,'query'>){
 try{
  const core=await pool.query(REGISTRATION_SECURITY_QUERY.replaceAll('current_user',"'helpdesk_app'"),[JSON.stringify(REGISTRATION_SECURITY_CONTRACT),[...REGISTRATION_SECURITY_CONTRACT.schemas]]),row=core.rows[0];
  if(core.command!=='SELECT'||core.rowCount!==1||core.rows.length!==1||!row||row.table_count!==REGISTRATION_SECURITY_CONTRACT.tables.length||row.unsafe_tables!==0||row.public_schema_access!==false||row.client_schema_access!==false||row.public_helper_execute!==false||READINESS_FLAGS.some(key=>row[key]!==true))throw unavailable();
  const result=await pool.query(REGISTRATION_WORKER_QUERY,[[...workerRole.functions]]),worker=result.rows[0];
  if(result.command!=='SELECT'||result.rowCount!==1||result.rows.length!==1||worker?.actor!=='helpdesk_registration_worker'||worker.login!=='helpdesk_registration_worker'||['role','schemas','tables','helpers','auth','tls','storage'].some(key=>worker[key]!==true))throw unavailable();
 }catch{throw unavailable();}
}
export type RegistrationRuntime=Readonly<{runOnce:(signal?:AbortSignal)=>Promise<void>;close:()=>Promise<void>}>;
export async function createRegistrationRuntime(input:RegistrationRuntimeConfig,ports:{poolFactory?:(options:Record<string,unknown>)=>SqlPool}={}):Promise<RegistrationRuntime>{
 const c=validateRegistrationRuntimeConfig(input),driverName='pg';
 const factory=ports.poolFactory??((await import(driverName)) as {Pool:new(options:Record<string,unknown>)=>SqlPool}).Pool;
 const options={connectionString:c.databaseUrl,max:1,connectionTimeoutMillis:2000,idleTimeoutMillis:5000,query_timeout:5000,application_name:'helpdesk-registration-worker',ssl:{rejectUnauthorized:true,...(c.databaseCa?{ca:c.databaseCa}:{})}};
 const pool=ports.poolFactory?ports.poolFactory(options):new (factory as new(options:Record<string,unknown>)=>SqlPool)(options);
 pool.on?.('error',()=>{try{console.warn(JSON.stringify({component:'helpdesk.registration',event:'idle_connection_error'}));}catch{}});
 let busy=false;
 try{await assertRegistrationWorkerDatabase(pool);return Object.freeze({async runOnce(signal?:AbortSignal){
  if(busy)throw unavailable();busy=true;
  try{if(signal?.aborted)throw unavailable();await assertRegistrationWorkerDatabase(pool);if(signal?.aborted)throw unavailable();
   const selected=await pool.query('select helpdesk_auth.hda02_worker_target() as target');
   if(selected.command!=='SELECT'||selected.rowCount!==1||selected.rows.length!==1)throw unavailable();
   const target=selected.rows[0]?.target;if(target===null)return;
   const {permission:_,...identity}=parseRegistrationScopeRequest({...target as object,permission:'read'});
   const worker=createRegistrationAnalysisWorker({identity,transactions:createPostgresRegistrationTransactions({pool,identity}),runner:createManualRegistrationEngine(),enabled:()=>!signal?.aborted});
   const result=await worker.runOnce(randomUUID(),signal);
   if(!['idle','manual_review','exhausted','replay_no_launch'].includes(result.status))throw unavailable();
  }finally{busy=false;}
 },close:()=>pool.end()});}catch{await pool.end().catch(()=>{});throw unavailable();}
}
export function createLazyRegistrationRuntime(){let pending:Promise<RegistrationRuntime>|undefined;return (config:RegistrationRuntimeConfig)=>{if(!pending){const created=createRegistrationRuntime(config);pending=created;void created.catch(()=>{if(pending===created)pending=undefined;});}return pending;};}
/** This factory is bound only by registration-worker's native schedule. No URL authentication fallback. */
export function createRegistrationScheduledHandler(o:{configuration:()=>RegistrationRuntimeConfig;runtime:(config:RegistrationRuntimeConfig)=>Promise<Pick<RegistrationRuntime,'runOnce'>>}){
 return async(_request:Request,context:{deploy?:{context?:string;published?:boolean}}={}):Promise<Response>=>{
  const control=new AbortController(),started=performance.now();let timer:ReturnType<typeof setTimeout>|undefined;
  const stop=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{control.abort();reject(unavailable());},25000);});
  const check=()=>{if(control.signal.aborted||performance.now()-started>=25000){control.abort();throw unavailable();}};
  try{if(context.deploy?.context!=='production')throw unavailable();const config=o.configuration();validateRegistrationRuntimeConfig(config);
   const runtime=await Promise.race([o.runtime(config),stop]);check();await Promise.race([runtime.runOnce(control.signal),stop]);check();
   return new Response(null,{status:204,headers:{'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
  }catch{return privateJson({code:'registration_worker_unavailable'},503);}finally{clearTimeout(timer);}
 };
}
