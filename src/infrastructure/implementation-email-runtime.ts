/** SERVER ONLY. Private IMP queue; shared configured Resend transport and worker login. */
import {performance} from 'node:perf_hooks';
import type {SqlPool} from './sql.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {assertNotificationWorkerDatabase,validateNotificationRuntimeConfig,type NotificationRuntimeConfig} from './notification-runtime.ts';
import {createResendNotificationChannel} from '../integrations/notifications/resend-channel.ts';
import {requireVerifiedResendEvent,type VerifiedResendEvent} from '../integrations/notifications/resend-events.ts';
import {parseNativeResendReceipt,type NativeResendReceipt} from '../application/resend-delivery-receiver.ts';
import type {NotificationChannel} from '../application/outbox-dispatch.ts';
const fail=(code='implementation_email_unavailable')=>new HelpdeskError(503,code,'Os avisos do Apoio Implantação estão temporariamente indisponíveis.');
const ORIGIN='https://helpdesk.consultegeo.org',UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const WORKER_FUNCTIONS=['contract()','claim()','begin_send(uuid,uuid,integer,text)','finish_send(uuid,uuid,integer,jsonb)','receive_event(jsonb)'];
const APP_FUNCTIONS=['contract()','enqueue(uuid,uuid,uuid,uuid,text,text,text)','status(uuid,uuid,uuid,uuid)'];
const ALL_FUNCTIONS=[...new Set([...WORKER_FUNCTIONS,...APP_FUNCTIONS]),'require_login(text)','require_actor(uuid,uuid)','live_email(uuid,uuid,uuid)','project(uuid[])','immutable_envelope()'];
export type ImplementationEmailClaim=Readonly<{id:string;leaseId:string;revision:number}>;
export type ImplementationEmailEnvelope=ImplementationEmailClaim&Readonly<{from:string;to:string;subject:string;text:string;html:string;idempotencyKey:string}>;
export type ImplementationEmailResult=Readonly<{state:'unknown'}|{state:'accepted';providerMessageId:string}|{state:'not_accepted';retryable:boolean;reason:'rate_limited'|'rejected'}>;
type Receipt=Readonly<{state:'accepted'|'delivered'|'retry_wait'|'unknown'|'failed';attention:boolean}>;
export interface ImplementationEmailStore{
 claim():Promise<ImplementationEmailClaim|Readonly<{attention:true}>|null>;
 begin(claim:ImplementationEmailClaim,from:string):Promise<ImplementationEmailEnvelope|null>;
 finish(claim:ImplementationEmailClaim,result:ImplementationEmailResult):Promise<Receipt>;
}
function object(raw:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==keys.length||keys.some(k=>!Object.hasOwn(raw,k)))throw fail();return raw as Record<string,unknown>;
}
function parseClaim(raw:unknown):ImplementationEmailClaim{
 const r=object(raw,['id','leaseId','revision']);if(typeof r.id!=='string'||!UUID.test(r.id)||typeof r.leaseId!=='string'||!UUID.test(r.leaseId)||!Number.isSafeInteger(r.revision)||Number(r.revision)<1||Number(r.revision)>=2147483647)throw fail();
 return Object.freeze({id:r.id,leaseId:r.leaseId,revision:r.revision as number});
}
function parseEnvelope(raw:unknown,c:ImplementationEmailClaim,from:string):ImplementationEmailEnvelope{
 const r=object(raw,['id','leaseId','revision','from','to','subject','text','html','idempotencyKey']),next=parseClaim({id:r.id,leaseId:r.leaseId,revision:r.revision});
 if(next.id!==c.id||next.leaseId!==c.leaseId||next.revision!==c.revision+1||r.from!==from
  ||typeof r.to!=='string'||r.to.length>254||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(r.to)
  ||typeof r.subject!=='string'||!r.subject.trim()||r.subject.length>160||/[\p{Cc}\p{Cs}]/u.test(r.subject)
  ||typeof r.text!=='string'||!r.text.trim()||r.text.length>20000||typeof r.html!=='string'||!r.html.trim()||r.html.length>64000
  ||typeof r.idempotencyKey!=='string'||!/^[a-f0-9]{64}$/.test(r.idempotencyKey))throw fail();
 return Object.freeze({...next,from,to:r.to,subject:r.subject,text:r.text,html:r.html,idempotencyKey:r.idempotencyKey});
}
function parseReceipt(raw:unknown):Receipt{const r=object(raw,['state','attention']);if(!['accepted','delivered','retry_wait','unknown','failed'].includes(r.state as string)||typeof r.attention!=='boolean'||r.state==='unknown'&&r.attention!==true)throw fail();return Object.freeze(r) as Receipt;}
function providerResult(raw:unknown):ImplementationEmailResult{
 if(raw&&typeof raw==='object'&&!Array.isArray(raw)){const r=raw as Record<string,unknown>;
  if(Object.keys(r).length===2&&r.state==='accepted'&&typeof r.providerMessageId==='string'&&UUID.test(r.providerMessageId))return {state:'accepted',providerMessageId:r.providerMessageId};
  if(Object.keys(r).length===3&&r.state==='not_accepted'&&((r.retryable===true&&r.reason==='rate_limited')||(r.retryable===false&&r.reason==='rejected')))return {state:'not_accepted',retryable:r.retryable,reason:r.reason};
 }return {state:'unknown'};
}
async function bounded<T>(ms:number,work:(signal:AbortSignal,check:()=>void)=>Promise<T>,parent?:AbortSignal):Promise<T>{
 const controller=new AbortController(),started=performance.now(),signal=parent?AbortSignal.any([parent,controller.signal]):controller.signal;let timer:ReturnType<typeof setTimeout>|undefined;
 const stop=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(fail());},ms);});const check=()=>{if(signal.aborted||performance.now()-started>=ms)throw fail();};
 try{check();const result=await Promise.race([work(signal,check),stop]);check();return result;}finally{clearTimeout(timer);controller.abort();}
}
/** One atomic begin call must return a committed SENDING envelope before network.
 * No begin/finish/HTTP retry here; expired sending leases recover to unknown in SQL. */
export function createImplementationEmailCycle(o:{store:ImplementationEmailStore;channel:NotificationChannel;from:string}){
 if(o.channel.id!=='resend')throw fail();
 return async(parent?:AbortSignal):Promise<Readonly<{processed:number;attention:number}>>=>{try{return await bounded(20000,async(signal,check)=>{
  const raw=await o.store.claim();check();if(raw===null)return {processed:0,attention:0};
  if(Object.keys(raw).length===1&&'attention' in raw&&raw.attention===true)return {processed:0,attention:1};
  const claim=parseClaim(raw),pending=await o.store.begin(claim,o.from);check();if(pending===null)return {processed:1,attention:1};
  const envelope=parseEnvelope(pending,claim,o.from),{to,subject,text,html,idempotencyKey}=envelope;check();let result:ImplementationEmailResult={state:'unknown'};
  try{result=providerResult(await bounded(5000,s=>o.channel.send({to,subject,text,html,idempotencyKey},s),signal));}catch{/* Persist uncertainty, never infer nonacceptance from an exception. */}
  check();const receipt=parseReceipt(await o.store.finish(envelope,result));check();return {processed:1,attention:receipt.attention?1:0};
 },parent);}catch{throw fail();}};
}
async function value(pool:Pick<SqlPool,'query'>,sql:string,args:unknown[]=[]):Promise<unknown>{const r=await pool.query(sql,args);if(r.command!=='SELECT'||r.rowCount!==1||r.rows.length!==1||!Object.hasOwn(r.rows[0]!,'value'))throw fail();return r.rows[0]!.value;}
export function createImplementationEmailStore(pool:Pick<SqlPool,'query'>):ImplementationEmailStore{return {
 async claim(){const raw=await value(pool,'select helpdesk_implantacao_email.claim() as value');if(raw===null)return null;if(raw&&typeof raw==='object'&&Object.keys(raw).length===1&&'attention' in raw&&raw.attention===true)return {attention:true};return parseClaim(raw);},
 async begin(c,from){const raw=await value(pool,'select helpdesk_implantacao_email.begin_send($1::uuid,$2::uuid,$3::integer,$4::text) as value',[c.id,c.leaseId,c.revision,from]);return raw===null?null:parseEnvelope(raw,c,from);},
 async finish(c,result){return parseReceipt(await value(pool,'select helpdesk_implantacao_email.finish_send($1::uuid,$2::uuid,$3::integer,$4::jsonb) as value',[c.id,c.leaseId,c.revision,JSON.stringify(result)]));}
};}
/** Attest the addon independently after the unchanged four-schema core guard. */
export const IMPLEMENTATION_EMAIL_DATABASE_QUERY=`with
 ns as(select oid,nspowner from pg_catalog.pg_namespace where nspname='helpdesk_implantacao_email'),
 funcs as(select p.*,p.proname||'('||replace(pg_catalog.oidvectortypes(p.proargtypes),' ','')||')' signature from pg_catalog.pg_proc p join ns on ns.oid=p.pronamespace),
 tabs as(select c.* from pg_catalog.pg_class c join ns on ns.oid=c.relnamespace where c.relkind in ('r','p','v','m','f','S')),
 clients as(select oid from pg_catalog.pg_roles where rolname in('anon','authenticated','service_role'))
 select session_user as "sessionUser",current_user as "currentUser",
 ((select count(*) from ns)=1 and (select nspowner from ns)=(select proowner from pg_catalog.pg_proc where oid='helpdesk_auth.schema_version()'::regprocedure)
 and not exists(select 1 from ns where not pg_catalog.has_schema_privilege(current_user,oid,'USAGE') or pg_catalog.has_schema_privilege(current_user,oid,'CREATE,USAGE WITH GRANT OPTION'))
 and not exists(select 1 from ns cross join clients r where pg_catalog.has_schema_privilege(r.oid,ns.oid,'USAGE,CREATE'))
 and not exists(select 1 from tabs t cross join pg_catalog.pg_roles r where r.rolname in('helpdesk_app','helpdesk_notification_worker','anon','authenticated','service_role') and (pg_catalog.has_table_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') or pg_catalog.has_any_column_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,REFERENCES')))) as acl,
 ((select count(*) from tabs)=4 and not exists(select 1 from tabs t where t.relname not in('notifications','requests','quotas','provider_events') or t.relkind<>'r' or not t.relrowsecurity or not t.relforcerowsecurity or t.relowner is distinct from (select nspowner from ns))
 and (select count(*) from pg_catalog.pg_policy p join tabs t on t.oid=p.polrelid)=4
 and not exists(select 1 from pg_catalog.pg_policy p join tabs t on t.oid=p.polrelid where p.polroles is distinct from array[(select nspowner from ns)]::oid[] or p.polcmd<>'*' or pg_catalog.pg_get_expr(p.polqual,p.polrelid)<>'true' or pg_catalog.pg_get_expr(p.polwithcheck,p.polrelid)<>'true')) as tables,
 ((select count(*) from funcs)=12 and not exists(select 1 from funcs p where not(p.signature=any($1::text[])) or not p.prosecdef or p.proowner is distinct from (select nspowner from ns) or not coalesce(p.proconfig @> array['search_path=""'] or p.proconfig @> array['search_path='],false)
 or pg_catalog.has_function_privilege('helpdesk_notification_worker',p.oid,'EXECUTE') is distinct from (p.signature=any($2::text[]))
 or pg_catalog.has_function_privilege('helpdesk_app',p.oid,'EXECUTE') is distinct from (p.signature=any($3::text[]))
 or pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE WITH GRANT OPTION'))
 and not exists(select 1 from funcs p cross join clients r where pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE'))
 and not exists(select 1 from funcs p cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a where a.grantee=0)) as functions`;
export async function assertImplementationEmailDatabase(pool:Pick<SqlPool,'query'>):Promise<void>{try{
 const r=await pool.query(IMPLEMENTATION_EMAIL_DATABASE_QUERY,[ALL_FUNCTIONS,WORKER_FUNCTIONS,APP_FUNCTIONS]),row=r.rows[0];
 if(r.command!=='SELECT'||r.rowCount!==1||r.rows.length!==1||row?.sessionUser!=='helpdesk_notification_worker'||row.currentUser!=='helpdesk_notification_worker'||['acl','tables','functions'].some(k=>row[k]!==true))throw Error();
 const contract=object(await value(pool,'select helpdesk_implantacao_email.contract() as value'),['version','enabled']);if(contract.version!=='implementation-email-v1'||contract.enabled!==true)throw Error();
 }catch{throw fail('implementation_email_database_unqualified');}}
export type ImplementationEmailRuntime=Readonly<{runOnce(signal?:AbortSignal):Promise<Readonly<{processed:number;attention:number}>>;close():Promise<void>}>;
export async function createImplementationEmailRuntime(input:NotificationRuntimeConfig,ports:{poolFactory?:(options:Record<string,unknown>)=>SqlPool;fetch?:typeof fetch}={}):Promise<ImplementationEmailRuntime>{
 const c=validateNotificationRuntimeConfig(input,'worker');if(c.origin!==ORIGIN)throw fail('implementation_email_configuration_required');
 const driverName='pg',factory=ports.poolFactory??((await import(driverName) as {Pool:new(o:Record<string,unknown>)=>SqlPool}).Pool),options={connectionString:c.databaseUrl,max:1,connectionTimeoutMillis:2000,idleTimeoutMillis:5000,query_timeout:5000,application_name:'implementation-email-worker',ssl:{rejectUnauthorized:true,...(c.databaseCa?{ca:c.databaseCa}:{})}};
 const pool=ports.poolFactory?ports.poolFactory(options):new(factory as new(o:Record<string,unknown>)=>SqlPool)(options);
 pool.on?.('error',()=>{try{console.warn(JSON.stringify({component:'implementation.email',event:'idle_connection_error'}));}catch{}});
 try{await assertNotificationWorkerDatabase(pool);await assertImplementationEmailDatabase(pool);const cycle=createImplementationEmailCycle({store:createImplementationEmailStore(pool),channel:createResendNotificationChannel({id:'resend',apiKey:c.resendApiKey!,from:c.resendFrom!,fetch:ports.fetch}),from:c.resendFrom!});
  return Object.freeze({async runOnce(parent?:AbortSignal){return bounded(25000,async(signal,check)=>{await assertNotificationWorkerDatabase(pool);check();await assertImplementationEmailDatabase(pool);check();return cycle(signal);},parent);},close:()=>pool.end()});
 }catch{await pool.end().catch(()=>{});throw fail('implementation_email_database_unqualified');}
}
/** Existing webhook calls this only after a verified core receipt is unmatched.
 * Missing addon is neutral; malformed/unsafe installed addon fails closed. */
export async function acceptImplementationEmailEvent(pool:Pick<SqlPool,'query'>,raw:VerifiedResendEvent,parent?:AbortSignal):Promise<NativeResendReceipt>{
 const event=requireVerifiedResendEvent(raw);
 return bounded(25000,async(_signal,check)=>{
  await assertNotificationWorkerDatabase(pool);check();
  const exists=await pool.query("select to_regprocedure('helpdesk_implantacao_email.contract()') is not null as available");check();
  if(exists.command!=='SELECT'||exists.rowCount!==1||exists.rows.length!==1||typeof exists.rows[0]?.available!=='boolean')throw fail();
  if(exists.rows[0].available===false)return {eventId:event.eventId,disposition:'unmatched',intentId:null};
  await assertImplementationEmailDatabase(pool);check();
  const receipt=await value(pool,'select helpdesk_implantacao_email.receive_event($1::jsonb) as value',[JSON.stringify({eventId:event.eventId,eventHash:event.eventHash,eventType:event.eventType,providerMessageId:event.providerMessageId,occurredAt:event.occurredAt,outcome:event.outcome})]);check();return parseNativeResendReceipt(receipt,event.eventId);
 },parent);
}
export function createLazyImplementationEmailRuntime(){let pending:Promise<ImplementationEmailRuntime>|undefined;return (input:NotificationRuntimeConfig)=>{if(!pending){const created=createImplementationEmailRuntime(input);pending=created;void created.catch(()=>{if(pending===created)pending=undefined;});}return pending;};}
type NativeContext={deploy?:{context?:string;published?:boolean}};
type Observation=Readonly<{component:'implementation.email';event:'scheduled_worker_failed'|'delivery_attention';code:'implementation_email_unavailable'|'operator_attention_required'}>;
export function createImplementationEmailScheduledHandler(o:{configuration:()=>NotificationRuntimeConfig;runtime:(config:NotificationRuntimeConfig)=>Promise<Pick<ImplementationEmailRuntime,'runOnce'>>;observe?:(entry:Observation)=>void}){
 const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
 const observe=(event:Observation['event'],code:Observation['code'])=>{try{o.observe?.({component:'implementation.email',event,code});}catch{}};
 return async(_request:Request,context:NativeContext={}):Promise<Response>=>{try{
  if(context.deploy?.context!=='production')throw fail();
  await bounded(25000,async(signal,check)=>{const config=o.configuration(),c=validateNotificationRuntimeConfig(config,'worker');if(c.origin!==ORIGIN)throw fail();check();const runtime=await o.runtime(config);check();const result=await runtime.runOnce(signal);check();if(result.attention>0)observe('delivery_attention','operator_attention_required');});
  return new Response(null,{status:204,headers});
 }catch{observe('scheduled_worker_failed','implementation_email_unavailable');return Response.json({code:'implementation_email_unavailable'},{status:503,headers});}};
}
/** Both handlers own their 25s deadline; settled addon failure cannot cancel CG. */
export function createCombinedNotificationScheduledHandler(core:(request:Request,context:NativeContext)=>Promise<Response>,addon:(request:Request,context:NativeContext)=>Promise<Response>){
 return async(request:Request,context:NativeContext={}):Promise<Response>=>{
  const [primary,secondary]=await Promise.allSettled([Promise.resolve().then(()=>core(request,context)),Promise.resolve().then(()=>addon(request,context))]);
  const unavailable=(code:string)=>Response.json({code},{status:503,headers:{'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'}});
  if(primary?.status!=='fulfilled')return unavailable('notification_unavailable');
  if(!primary.value.ok)return primary.value;
  if(secondary?.status!=='fulfilled'||!secondary.value.ok)return unavailable('implementation_email_unavailable');
  return primary.value;
 };
}
