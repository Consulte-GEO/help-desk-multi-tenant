import {randomUUID} from 'node:crypto';
import type {SqlPool} from './sql.ts';import {HelpdeskError} from '../domain/errors.ts';import {DATABASE_SECURITY_CONTRACT} from './database-security-contract.ts';
import {OWNER_DEFAULTS_OK_SQL,QUALIFIED_SCHEMA_OWNER_SQL,unsafeServiceMembershipSql} from '../../scripts/consultegeo-service-membership.ts';
import {createPostgresNotificationDeliveryStore,NOTIFICATION_WORKER_HELPERS,type PostgresNotificationDeliveryStore} from './notification-delivery-store.ts';
import {createOutboxDispatcher,type NotificationChannel} from '../application/outbox-dispatch.ts';import {createResendNotificationChannel} from '../integrations/notifications/resend-channel.ts';
import {createResendDeliveryEvents,requireVerifiedResendEvent,type VerifiedResendEvent} from '../integrations/notifications/resend-events.ts';
import {createResendDeliveryReceiver,type NativeResendReceipt} from '../application/resend-delivery-receiver.ts';import {privateJson,httpFailure} from '../http/controlled-json.ts';
const failed=(code='notification_unavailable',status=503)=>new HelpdeskError(status,code,'A operação de email permanece indisponível até sua configuração e qualificação.');
export const RESEND_WEBHOOK_PATH='/integrations/resend/events';
const BUDGET_MS=25000;
export type NotificationRuntimeConfig={enabled?:string;webhookEnabled?:string;releaseApproved?:string;databaseUrl?:string;databaseCa?:string;origin?:string;resendApiKey?:string;resendFrom?:string;senderVerified?:string;webhookSecret?:string;webhookPreviousSecret?:string};
type Purpose='worker'|'webhook';
type ValidConfig={databaseUrl:string;databaseCa?:string;origin:string;resendApiKey?:string;resendFrom?:string;webhookSecrets:readonly string[]};
export function validateNotificationRuntimeConfig(raw:NotificationRuntimeConfig,purpose:Purpose='worker'):ValidConfig{
 const invalid=()=>failed('notification_configuration_required');try{
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||(purpose==='worker'?raw.enabled:raw.webhookEnabled??raw.enabled)!=='true'||raw.releaseApproved!=='true')throw invalid();
  for(const field of ['databaseUrl','databaseCa','origin','resendApiKey','resendFrom','senderVerified','webhookSecret','webhookPreviousSecret'] as const)if(raw[field]!==undefined&&typeof raw[field]!=='string')throw invalid();
  if(!raw.databaseUrl||!raw.origin||/[\u0000-\u0020\u007f]/.test(raw.databaseUrl)||/[\u0000-\u0020\u007f]/.test(raw.origin))throw invalid();
  const db=new URL(raw.databaseUrl),origin=new URL(raw.origin),user=decodeURIComponent(db.username),password=decodeURIComponent(db.password),database=decodeURIComponent(db.pathname);
  if(!['postgres:','postgresql:'].includes(db.protocol)||!/^helpdesk_notification_worker(?:\.[A-Za-z0-9_-]+)?$/.test(user)||!password||/[\u0000-\u001f\u007f]/.test(user+password+database)||!db.hostname||database.length<2||db.search||db.hash||origin.protocol!=='https:'||origin.origin!==raw.origin||origin.username||origin.password)throw invalid();
  if(raw.databaseCa!==undefined&&(!raw.databaseCa.trim()||raw.databaseCa.length>32768))throw invalid();
  let webhookSecrets:readonly string[]=[];
  if(purpose==='worker'){
   if(raw.senderVerified!=='true'||!raw.resendApiKey||!raw.resendFrom)throw invalid();
   // Reuse the real channel's credential/sender parser. No provider call here.
   createResendNotificationChannel({id:'resend',apiKey:raw.resendApiKey,from:raw.resendFrom});
  }else{
   webhookSecrets=[raw.webhookSecret!,...(raw.webhookPreviousSecret?[raw.webhookPreviousSecret]:[])];
   createResendDeliveryEvents({secrets:webhookSecrets,maxAgeSeconds:300,clock:()=>new Date().toISOString()});
  }
  return Object.freeze({databaseUrl:raw.databaseUrl,origin:origin.origin,...(raw.databaseCa?{databaseCa:raw.databaseCa}:{}),...(purpose==='worker'?{resendApiKey:raw.resendApiKey!,resendFrom:raw.resendFrom!}:{}),webhookSecrets:Object.freeze(webhookSecrets)});
 }catch{throw invalid();}
}
/** Fixed named reads only. Recipient/contact/authorization never come from env. */
export function readNotificationRuntimeEnvironment(get:(name:string)=>string|undefined,purpose:Purpose):NotificationRuntimeConfig{return {
 enabled:get('HELPDESK_NOTIFICATION_DELIVERY_ENABLED'),releaseApproved:get('HELPDESK_RELEASE_APPROVED'),databaseUrl:get('HELPDESK_NOTIFICATION_DATABASE_URL'),databaseCa:get('HELPDESK_NOTIFICATION_DATABASE_CA'),origin:get('HELPDESK_CONSULTEGEO_ORIGIN'),
 ...(purpose==='worker'?{resendApiKey:get('RESEND_API_KEY'),resendFrom:get('RESEND_FROM'),senderVerified:get('HELPDESK_NOTIFICATION_SENDER_VERIFIED')}:{webhookEnabled:get('HELPDESK_NOTIFICATION_WEBHOOK_ENABLED'),webhookSecret:get('RESEND_WEBHOOK_SECRET'),webhookPreviousSecret:get('RESEND_WEBHOOK_PREVIOUS_SECRET')})
};}
type NotificationDatabaseContract=Readonly<{schemaVersion:string;roles:readonly Readonly<{name:string;schemas:readonly string[];functions:readonly string[]}>[]}>;
const signatures=NOTIFICATION_WORKER_HELPERS.map(s=>'helpdesk_auth.'+s).sort();
function promotion(contract:NotificationDatabaseContract){const role=contract.roles.find(r=>r.name==='helpdesk_notification_worker');if(!/^\d+\.\d+\.\d+$/.test(contract.schemaVersion)||!role||role.schemas.length!==1||role.schemas[0]!=='helpdesk_auth'||JSON.stringify([...role.functions].map(s=>s.replaceAll(' ','')).sort())!==JSON.stringify(signatures))throw failed('notification_database_unqualified');return contract.schemaVersion;}
/** Startup and per-invocation catalogue check. No domain/credential/address read.
 * The bundled reviewed contract must first promote the exact worker allowlist. */
export const NOTIFICATION_DATABASE_QUERY=`with
 schemas as(select * from pg_catalog.pg_namespace where nspname in ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')),
 tables as(select c.*,n.nspname||'.'||c.relname as name from pg_catalog.pg_class c join schemas n on n.oid=c.relnamespace where c.relkind in ('r','p','v','m','f','S')),
 functions as(select p.*,n.nspname||'.'||p.proname||'('||replace(pg_catalog.oidvectortypes(p.proargtypes),' ','')||')' as signature from pg_catalog.pg_proc p join schemas n on n.oid=p.pronamespace),
 clients as(select oid from pg_catalog.pg_roles where rolname in ('anon','authenticated','service_role'))
 select session_user as "sessionUser",current_user as "currentUser",
 exists(select 1 from functions p where p.signature='helpdesk_auth.schema_version()' and p.provolatile='i' and lower(regexp_replace(p.prosrc,'\\s+|;','','g'))='select'''||$1::text||'''::text') as schema,
 coalesce((select not(r.rolsuper or r.rolbypassrls or r.rolcreaterole or r.rolcreatedb or r.rolreplication or r.rolinherit)
 and not ${unsafeServiceMembershipSql('r.oid')}
 and not exists(select 1 from schemas n where n.nspowner=r.oid)
 and not exists(select 1 from tables c where c.relowner=r.oid)
 and not exists(select 1 from functions p where p.proowner=r.oid)
 from pg_catalog.pg_roles r where r.rolname=current_user),false) as role,
 (not exists(select 1 from tables t where pg_catalog.has_table_privilege(current_user,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') or pg_catalog.has_any_column_privilege(current_user,t.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
 and not exists(select 1 from schemas n where pg_catalog.has_schema_privilege(current_user,n.oid,'USAGE') is distinct from (n.nspname='helpdesk_auth') or pg_catalog.has_schema_privilege(current_user,n.oid,'CREATE,USAGE WITH GRANT OPTION'))
 and not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relname='users' and (pg_catalog.has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') or pg_catalog.has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))) as acl,
 ((select count(*) from functions p where p.signature=any($2::text[]))=13
 and not exists(select 1 from functions p where pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE') is distinct from (p.signature=any($2::text[])) or pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE WITH GRANT OPTION'))
 and not exists(select 1 from functions p where p.signature=any($2::text[]) and (not p.prosecdef or p.proowner is distinct from ${QUALIFIED_SCHEMA_OWNER_SQL} or not coalesce(p.proconfig @> array['search_path=""'] or p.proconfig @> array['search_path='],false)))
 and ${OWNER_DEFAULTS_OK_SQL}) as helpers,
 ((select count(*) from tables t where t.name=any($3::text[]))=8 and not exists(select 1 from tables t where t.name=any($3::text[]) and (t.relkind<>'r' or not t.relrowsecurity or not t.relforcerowsecurity))
 and not exists(select 1 from pg_catalog.pg_policy p join tables t on t.oid=p.polrelid where t.name=any($3::text[]))) as tables,
 (not exists(select 1 from schemas n cross join clients r where pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE,CREATE'))
 and not exists(select 1 from tables t cross join clients r where pg_catalog.has_table_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') or pg_catalog.has_any_column_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
 and not exists(select 1 from functions p cross join clients r where pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE'))
 and not exists(select 1 from functions p cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE')
 and not exists(select 1 from tables t cross join lateral pg_catalog.aclexplode(coalesce(t.relacl,pg_catalog.acldefault('r',t.relowner))) a where a.grantee=0)
 and not exists(select 1 from tables t join pg_catalog.pg_attribute c on c.attrelid=t.oid cross join lateral pg_catalog.aclexplode(c.attacl) a where a.grantee=0)
 and not exists(select 1 from schemas n cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a where a.grantee=0)) as clients,
 (pg_catalog.current_setting('server_version_num')::integer between 170000 and 179999 and pg_catalog.current_setting('row_security')='on' and pg_catalog.current_setting('session_replication_role')='origin') as settings,
 coalesce((select ssl from pg_catalog.pg_stat_ssl where pid=pg_catalog.pg_backend_pid()),false) as tls`;
const notificationTables=['helpdesk_integration.hdn_notification_templates','helpdesk_integration.hdn_notification_routes','helpdesk_integration.hdn_notification_plans','helpdesk_integration.hdn_notification_records','helpdesk_integration.hdn_notification_attempts','helpdesk_integration.hdn_notification_events','helpdesk_integration.hdn_notification_native_receipts','helpdesk_audit.hdn_notification_audit'];
export async function assertNotificationWorkerDatabase(pool:Pick<SqlPool,'query'>,contract?:NotificationDatabaseContract):Promise<void>{
 const versions=contract?[promotion(contract)]:[promotion(DATABASE_SECURITY_CONTRACT),'0.24.0'];
 try{for(const [index,version] of versions.entries()){
  const r=await pool.query(NOTIFICATION_DATABASE_QUERY,[version,signatures,notificationTables]),row=r.rows[0];
  if(r.command!=='SELECT'||r.rowCount!==1||r.rows.length!==1||row?.sessionUser!=='helpdesk_notification_worker'||row.currentUser!=='helpdesk_notification_worker'||['role','acl','helpers','tables','clients','settings','tls'].some(k=>row[k]!==true))throw Error();
  if(row.schema===true)return;if(row.schema!==false||index===versions.length-1)throw Error();
 }}catch{throw failed('notification_database_unqualified');}throw failed('notification_database_unqualified');
}

async function budget<T>(work:(signal:AbortSignal,check:()=>void)=>Promise<T>,parent?:AbortSignal):Promise<T>{const control=new AbortController(),start=performance.now();let timer:ReturnType<typeof setTimeout>|undefined;const stop=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{control.abort();reject(failed('notification_deadline_exceeded'));},BUDGET_MS);});const signal=parent?AbortSignal.any([parent,control.signal]):control.signal;const check=()=>{if(signal.aborted||performance.now()-start>=BUDGET_MS)throw failed('notification_deadline_exceeded');};try{check();const result=await Promise.race([work(signal,check),stop]);check();return result;}finally{clearTimeout(timer);control.abort();}}
type CycleStore=Pick<PostgresNotificationDeliveryStore,'authority'|'materializePending'|'claimDelivery'|'locked'|'getTemplate'>;
/** SERVER composition only. Every cycle owns its deadline and one Resend port.
 * Provider work stays outside the existing durable sending transaction. */
export function createNotificationWorkerCycle(o:{store:CycleStore;channel:NotificationChannel;clock?:()=>string;origin:string}){
 try{if(o.channel.id!=='resend'||new URL(o.origin).origin!==o.origin||new URL(o.origin).protocol!=='https:')throw Error();}catch{throw failed('notification_configuration_required');}const clock=o.clock??(()=>new Date().toISOString());
 return async(workerId:string,parent?:AbortSignal)=>budget(async(signal,check)=>{
  check();const plans=await o.store.materializePending(clock(),1);check();
  const channel:NotificationChannel={id:'resend',async send(message,inner){check();const result=await o.channel.send(message,AbortSignal.any([signal,inner]));check();return result;},async lookup(){return null;}};
  const dispatcher=createOutboxDispatcher({store:o.store,authority:o.store.authority,channel,verifier:{verify(){throw failed('native_resend_receiver_required');}},portalOrigin:o.origin,clock,policy:{maxAttempts:3,backoffMicros:['60000000','300000000'],leaseMicros:'60000000',sendTimeoutMs:5000}});
  const results=await dispatcher.runOnce(workerId,1);check();return Object.freeze({planned:plans.length,processed:results.length,attention:results.filter(r=>r.attention===true).length});
 },parent);
}
export type NotificationRuntime=Readonly<{runOnce(workerId:string,signal?:AbortSignal):Promise<Readonly<{planned:number;processed:number;attention:number}>>;acceptNative(event:VerifiedResendEvent,signal?:AbortSignal):Promise<NativeResendReceipt>;close():Promise<void>}>;
export async function createNotificationRuntime(input:NotificationRuntimeConfig,ports:{purpose?:Purpose;poolFactory?:(options:Record<string,unknown>)=>SqlPool;fetch?:typeof fetch;clock?:()=>string}={}):Promise<NotificationRuntime>{
 const purpose=ports.purpose??'worker',c=validateNotificationRuntimeConfig(input,purpose);promotion(DATABASE_SECURITY_CONTRACT);
 const driverName='pg',factory=ports.poolFactory??((await import(driverName) as {Pool:new(o:Record<string,unknown>)=>SqlPool}).Pool);const options={connectionString:c.databaseUrl,max:1,connectionTimeoutMillis:2000,idleTimeoutMillis:5000,query_timeout:5000,application_name:'helpdesk-notification-worker',ssl:{rejectUnauthorized:true,...(c.databaseCa?{ca:c.databaseCa}:{})}};
 const pool=ports.poolFactory?ports.poolFactory(options):new (factory as new(o:Record<string,unknown>)=>SqlPool)(options);pool.on?.('error',()=>{try{console.warn(JSON.stringify({component:'helpdesk.notifications',event:'idle_connection_error'}));}catch{}});
 try{await assertNotificationWorkerDatabase(pool);const store=createPostgresNotificationDeliveryStore(pool),receiver=createResendDeliveryReceiver({store,clock:ports.clock});const cycle=purpose==='worker'?createNotificationWorkerCycle({store,channel:createResendNotificationChannel({id:'resend',apiKey:c.resendApiKey!,from:c.resendFrom!,fetch:ports.fetch}),clock:ports.clock,origin:c.origin}):null;
  return Object.freeze({async runOnce(workerId:string,signal?:AbortSignal){if(!cycle)throw failed();return budget(async(_inner,check)=>{check();await assertNotificationWorkerDatabase(pool);check();return cycle(workerId,_inner);},signal);},async acceptNative(event:VerifiedResendEvent,signal?:AbortSignal){requireVerifiedResendEvent(event);return budget(async(_inner,check)=>{check();await assertNotificationWorkerDatabase(pool);check();return receiver.acceptVerified(event);},signal);},close:()=>pool.end()});
 }catch{await pool.end().catch(()=>{});throw failed('notification_database_unqualified');}
}

async function nativeBytes(request:Request):Promise<Uint8Array>{
 if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type')??'')||request.headers.has('content-encoding'))throw httpFailure(415,'unsupported_media_type');
 const length=request.headers.get('content-length');if(length!==null&&(!/^(0|[1-9]\d*)$/.test(length)||BigInt(length)>32768n))throw httpFailure(413,'payload_too_large');
 const reader=request.body?.getReader();if(!reader)throw httpFailure(400,'invalid_json');const end=performance.now()+5000;let rejectStop:(e:unknown)=>void=()=>{};const stop=new Promise<never>((_,reject)=>{rejectStop=reject;}),abort=()=>rejectStop(httpFailure(409,'request_cancelled')),timer=setTimeout(()=>rejectStop(httpFailure(408,'request_timeout')),5000);request.signal.addEventListener('abort',abort,{once:true});
 try{const parts:Uint8Array[]=[];let total=0;for(;;){if(request.signal.aborted)throw httpFailure(409,'request_cancelled');if(performance.now()>=end)throw httpFailure(408,'request_timeout');const next=await Promise.race([reader.read(),stop]);if(performance.now()>=end)throw httpFailure(408,'request_timeout');if(request.signal.aborted)throw httpFailure(409,'request_cancelled');if(next.done)break;total+=next.value.byteLength;if(total>32768)throw httpFailure(413,'payload_too_large');parts.push(next.value);}const raw=new Uint8Array(total);let offset=0;for(const part of parts){raw.set(part,offset);offset+=part.length;}return raw;
 }catch(e){try{void reader.cancel().catch(()=>{});}catch{}throw e;}finally{clearTimeout(timer);request.signal.removeEventListener('abort',abort);try{reader.releaseLock();}catch{}}
}
function privateFailure(error:unknown){const safe=error instanceof HelpdeskError?error:failed();const allowed=['not_found','unknown_parameter','unsupported_media_type','invalid_json','request_timeout','request_cancelled','payload_too_large','delivery_signature_invalid','delivery_event_conflict'];return privateJson({code:allowed.includes(safe.code)?safe.code:'notification_unavailable'},allowed.includes(safe.code)?safe.status:503);}
export function createResendWebhookHandler(o:{configuration:()=>NotificationRuntimeConfig;runtime:(config:NotificationRuntimeConfig)=>Promise<Pick<NotificationRuntime,'acceptNative'>>;clock?:()=>string}){
 return async(request:Request):Promise<Response>=>{try{return await budget(async(signal,check)=>{const u=new URL(request.url);if(u.pathname!==RESEND_WEBHOOK_PATH)throw httpFailure(404,'not_found');if(request.method!=='POST')return privateJson({code:'method_not_allowed'},405,{allow:'POST'});if(u.search)throw httpFailure(400,'unknown_parameter');
  const raw=await nativeBytes(request);check();const source=o.configuration(),c=validateNotificationRuntimeConfig(source,'webhook');if(u.origin!==c.origin)throw httpFailure(404,'not_found');const verifier=createResendDeliveryEvents({secrets:c.webhookSecrets,maxAgeSeconds:300,clock:o.clock??(()=>new Date().toISOString())}),event=verifier.verify(request.headers,raw);
  check();const runtime=await o.runtime(source);check();await runtime.acceptNative(event,signal);check();return privateJson({received:true},200);
 },request.signal);}catch(e){return privateFailure(e);}};
}
type ScheduledContext={deploy?:{context?:string;published?:boolean}};
type ScheduledPhase='deploy_guard'|'configuration'|'initialization'|'cycle';
const observedConfigurationKeys=['enabled','releaseApproved','databaseUrl','databaseCa','origin','resendApiKey','resendFrom','senderVerified'] as const;
type ConfigurationPresence=Readonly<Record<typeof observedConfigurationKeys[number],boolean>>;
export type ScheduledWorkerObservation=Readonly<{component:'helpdesk.notifications';event:'scheduled_worker_failed';phase:ScheduledPhase;code:string;deployContext:'production'|'deploy-preview'|'branch-deploy'|'other';publishedDeploy:boolean;configuration:ConfigurationPresence|null}>;
/** Presence only, from own data properties. Never invoke getters or serialize config. */
function configurationPresence(raw:NotificationRuntimeConfig):ConfigurationPresence{
 return Object.freeze(Object.fromEntries(observedConfigurationKeys.map(key=>{const value=raw&&typeof raw==='object'?Object.getOwnPropertyDescriptor(raw,key)?.value:undefined;return [key,['enabled','releaseApproved','senderVerified'].includes(key)?value==='true':typeof value==='string'&&value.trim()!==''];})) as Record<typeof observedConfigurationKeys[number],boolean>);
}
export function createNotificationScheduledHandler(o:{configuration:()=>NotificationRuntimeConfig;runtime:(config:NotificationRuntimeConfig)=>Promise<Pick<NotificationRuntime,'runOnce'>>;observe?:(entry:ScheduledWorkerObservation)=>void}){
 // Bound exclusively by notification-worker's config.schedule: Netlify rejects
 // public URL invocation and schedules only the published deploy. Its scheduler
 // can supply published=false; that bit is observation, not admission here.
 // Native production context still rejects Run now on previews/branch deploys.
 return async(_request:Request,context:ScheduledContext={}):Promise<Response>=>{let phase:ScheduledPhase='deploy_guard',presence:ConfigurationPresence|null=null;try{if(context.deploy?.context!=='production')throw failed();return await budget(async(signal,check)=>{phase='configuration';const config=o.configuration();if(o.observe)try{presence=configurationPresence(config);}catch{}validateNotificationRuntimeConfig(config,'worker');check();phase='initialization';const runtime=await o.runtime(config);check();phase='cycle';await runtime.runOnce('netlify-worker:'+randomUUID(),signal);check();return new Response(null,{status:204,headers:{'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});});}catch(e){
  // One closed, private operational event. Observation cannot change the outcome.
  if(o.observe)try{const raw=e instanceof HelpdeskError?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined,code=['notification_unavailable','notification_configuration_required','notification_database_unqualified','notification_deadline_exceeded'].includes(raw)?raw:'notification_unavailable',candidate=context.deploy?.context,deployContext=candidate==='production'||candidate==='deploy-preview'||candidate==='branch-deploy'?candidate:'other';o.observe(Object.freeze({component:'helpdesk.notifications',event:'scheduled_worker_failed',phase,code,deployContext,publishedDeploy:context.deploy?.published===true,configuration:presence}));}catch{}
  return privateFailure(e);
 }};
}
/** Warm instance initialization is shared; failure resets it. Configuration is
 * private and immutable per deploy. No environment/driver access on import. */
export function createLazyNotificationRuntime(purpose:Purpose){let pending:Promise<NotificationRuntime>|undefined;return (input:NotificationRuntimeConfig)=>{if(!pending){const created=createNotificationRuntime(input,{purpose});pending=created;void created.catch(()=>{if(pending===created)pending=undefined;});}return pending;};}
