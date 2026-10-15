/** SERVER ONLY. Wiki ledger is independent of the HelpDesk ticket notification ledger. */
import {performance} from 'node:perf_hooks';
import type {SqlPool} from './sql.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {assertNotificationWorkerDatabase,validateNotificationRuntimeConfig,type NotificationRuntimeConfig} from './notification-runtime.ts';
import {createResendNotificationChannel} from '../integrations/notifications/resend-channel.ts';
import type {NotificationChannel} from '../application/outbox-dispatch.ts';
const fail=(code='wiki_notification_unavailable')=>new HelpdeskError(503,code,'Os avisos do Wiki estão temporariamente indisponíveis.');
const ORIGIN='https://helpdesk.consultegeo.org',TARGET='thiago@consultegeo.com.br';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const SIGNATURES=['public.wiki_cg_email_contract()','public.wiki_cg_email_claim()','public.wiki_cg_email_begin(bigint,uuid,bigint,text)','public.wiki_cg_email_finish(bigint,uuid,bigint,jsonb)'];
export type WikiEmailClaim=Readonly<{eventId:string;leaseId:string;revision:number}>;
export type WikiEmailEnvelope=WikiEmailClaim&Readonly<{from:string;to:string;subject:string;text:string;html:string;idempotencyKey:string}>;
export type WikiEmailResult=Readonly<{state:'unknown'}|{state:'accepted';providerMessageId:string}|{state:'not_accepted';retryable:boolean;reason:'rate_limited'|'rejected'}>;
export type WikiEmailReceipt=Readonly<{state:'accepted'|'retry_wait'|'unknown'|'failed'|'attention';attention:boolean}>;
export type WikiEmailAttention=Readonly<{attention:true}>;
export interface WikiEmailStore {
 claim():Promise<WikiEmailClaim|WikiEmailAttention|null>;
 begin(claim:WikiEmailClaim,from:string):Promise<WikiEmailEnvelope|null>;
 finish(claim:WikiEmailClaim,result:WikiEmailResult):Promise<WikiEmailReceipt>;
}
function object(raw:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length!==keys.length||keys.some(k=>!Object.hasOwn(raw,k)))throw fail();
 return raw as Record<string,unknown>;
}
function parseClaim(raw:unknown):WikiEmailClaim{
 const r=object(raw,['eventId','leaseId','revision']);
 if(typeof r.eventId!=='string'||!/^[1-9]\d{0,18}$/.test(r.eventId)||BigInt(r.eventId)>9223372036854775807n||typeof r.leaseId!=='string'||!UUID.test(r.leaseId)||!Number.isSafeInteger(r.revision)||Number(r.revision)<1)throw fail();
 return Object.freeze({eventId:r.eventId,leaseId:r.leaseId,revision:r.revision as number});
}
function parseEnvelope(raw:unknown,c:WikiEmailClaim,from:string):WikiEmailEnvelope{
 const r=object(raw,['eventId','leaseId','revision','from','to','subject','text','html','idempotencyKey']);
 const next=parseClaim({eventId:r.eventId,leaseId:r.leaseId,revision:r.revision});
 if(next.eventId!==c.eventId||next.leaseId!==c.leaseId||next.revision!==c.revision+1||r.from!==from||r.to!==TARGET
  ||typeof r.subject!=='string'||!r.subject.trim()||r.subject.length>160||/[\p{Cc}\p{Cs}]/u.test(r.subject)
  ||typeof r.text!=='string'||!r.text.trim()||r.text.length>20000||typeof r.html!=='string'||!r.html.trim()||r.html.length>64000
  ||typeof r.idempotencyKey!=='string'||!/^[a-f0-9]{64}$/.test(r.idempotencyKey))throw fail();
 return Object.freeze({...next,from,to:TARGET,subject:r.subject,text:r.text,html:r.html,idempotencyKey:r.idempotencyKey});
}
function parseReceipt(raw:unknown):WikiEmailReceipt{
 const r=object(raw,['state','attention']);if(!['accepted','retry_wait','unknown','failed','attention'].includes(r.state as string)||r.attention!==['failed','attention'].includes(r.state as string))throw fail();
 return Object.freeze(r) as WikiEmailReceipt;
}
function providerResult(raw:unknown):WikiEmailResult{
 if(raw&&typeof raw==='object'&&!Array.isArray(raw)){
  const r=raw as Record<string,unknown>;
  if(Object.keys(r).length===2&&r.state==='accepted'&&typeof r.providerMessageId==='string'&&UUID.test(r.providerMessageId))return {state:'accepted',providerMessageId:r.providerMessageId};
  if(Object.keys(r).length===3&&r.state==='not_accepted'&&((r.retryable===true&&r.reason==='rate_limited')||(r.retryable===false&&r.reason==='rejected')))return {state:'not_accepted',retryable:r.retryable,reason:r.reason};
 }
 return {state:'unknown'};
}
async function bounded<T>(ms:number,work:(signal:AbortSignal,check:()=>void)=>Promise<T>,parent?:AbortSignal):Promise<T>{
 const controller=new AbortController(),start=performance.now(),signal=parent?AbortSignal.any([parent,controller.signal]):controller.signal;
 let timer:ReturnType<typeof setTimeout>|undefined;
 const stop=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(fail());},ms);});
 const check=()=>{if(signal.aborted||performance.now()-start>=ms)throw fail();};
 try{check();const result=await Promise.race([work(signal,check),stop]);check();return result;}finally{clearTimeout(timer);controller.abort();}
}
/** begin() must COMMIT SENDING + immutable envelope before returning. Lost ACK never sends. */
export function createWikiNotificationCycle(o:{store:WikiEmailStore;channel:NotificationChannel;from:string}){
 if(o.channel.id!=='resend')throw fail();
 return async(parent?:AbortSignal):Promise<Readonly<{processed:number;attention:number}>>=>{
  try{return await bounded(20000,async(signal,check)=>{
   const raw=await o.store.claim();check();if(raw===null)return {processed:0,attention:0};
   if(Object.keys(raw).length===1&&'attention' in raw&&raw.attention===true)return {processed:0,attention:1};
   const claim=parseClaim(raw);
   const pending=await o.store.begin(claim,o.from);check();if(pending===null)return {processed:1,attention:1};
   const envelope=parseEnvelope(pending,claim,o.from);check();
   const {to,subject,text,html,idempotencyKey}=envelope;
   let result:WikiEmailResult={state:'unknown'};
   try{result=providerResult(await bounded(5000,s=>o.channel.send({to,subject,text,html,idempotencyKey},s),signal));}catch{/* Unknown acceptance must remain durable. */}
   check();const receipt=parseReceipt(await o.store.finish(envelope,result));check();return {processed:1,attention:receipt.attention?1:0};
  },parent);}catch{throw fail();}
 };
}
async function value(pool:Pick<SqlPool,'query'>,sql:string,args:unknown[]=[]):Promise<unknown>{
 const result=await pool.query(sql,args);if(result.command!=='SELECT'||result.rowCount!==1||result.rows.length!==1||!Object.hasOwn(result.rows[0]!,'value'))throw fail();return result.rows[0]!.value;
}
export function createWikiEmailStore(pool:Pick<SqlPool,'query'>):WikiEmailStore{return {
 async claim(){const raw=await value(pool,'select public.wiki_cg_email_claim() as value');if(raw===null)return null;
  if(raw&&typeof raw==='object'&&Object.keys(raw).length===1&&'attention' in raw&&raw.attention===true)return Object.freeze({attention:true as const});return parseClaim(raw);},
 async begin(c,from){const raw=await value(pool,'select public.wiki_cg_email_begin($1::bigint,$2::uuid,$3::bigint,$4::text) as value',[c.eventId,c.leaseId,c.revision,from]);return raw===null?null:parseEnvelope(raw,c,from);},
 async finish(c,result){return parseReceipt(await value(pool,'select public.wiki_cg_email_finish($1::bigint,$2::uuid,$3::bigint,$4::jsonb) as value',[c.eventId,c.leaseId,c.revision,JSON.stringify(result)]));}
};}
/** Extra attestation outside the existing four-schema / 13-helper HelpDesk contract. */
export const WIKI_EMAIL_DATABASE_QUERY=`with
 ns as(select oid,nspowner from pg_catalog.pg_namespace where nspname='wiki_cg'),
 funcs as(select p.*,n.nspname||'.'||p.proname||'('||replace(pg_catalog.oidvectortypes(p.proargtypes),' ','')||')' signature from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'wiki_cg_email_%'),
 tabs as(select c.* from pg_catalog.pg_class c join ns on ns.oid=c.relnamespace where c.relname in ('colab_email_config','colab_email_outbox','colab_email_attempts')),
 denied as(select oid from pg_catalog.pg_roles where rolname in ('anon','authenticated','service_role'))
 select session_user as "sessionUser",current_user as "currentUser",
 ((select count(*) from funcs)=4 and not exists(select 1 from funcs p where not(p.signature=any($1::text[])) or not p.prosecdef or p.proowner is distinct from (select nspowner from ns) or not coalesce(p.proconfig @> array['search_path=""'] or p.proconfig @> array['search_path='],false)
 or not pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE') or pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE WITH GRANT OPTION'))
 and not exists(select 1 from funcs p cross join denied r where pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE'))
 and not exists(select 1 from funcs p cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a where a.grantee=0)) as wrappers,
 ((select count(*) from tabs)=3 and not exists(select 1 from tabs where relkind<>'r' or not relrowsecurity or not relforcerowsecurity or relowner is distinct from (select nspowner from ns))
 and not exists(select 1 from pg_catalog.pg_policy p join tabs t on t.oid=p.polrelid)) as tables,
 (not exists(select 1 from ns where nspowner=(select oid from pg_catalog.pg_roles where rolname=current_user) or pg_catalog.has_schema_privilege(current_user,oid,'USAGE,CREATE'))
 and not exists(select 1 from pg_catalog.pg_class c join ns on ns.oid=c.relnamespace where c.relkind in ('r','p','v','m','f','S') and (pg_catalog.has_table_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') or pg_catalog.has_any_column_privilege(current_user,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')))
 and not exists(select 1 from pg_catalog.pg_proc p join ns on ns.oid=p.pronamespace where pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE'))
 and not exists(select 1 from tabs t cross join denied r where pg_catalog.has_table_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') or pg_catalog.has_any_column_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) as acl`;
export async function assertWikiEmailDatabase(pool:Pick<SqlPool,'query'>):Promise<void>{
 try{
  const r=await pool.query(WIKI_EMAIL_DATABASE_QUERY,[SIGNATURES]),row=r.rows[0];
  if(r.command!=='SELECT'||r.rowCount!==1||r.rows.length!==1||row?.sessionUser!=='helpdesk_notification_worker'||row.currentUser!=='helpdesk_notification_worker'||['wrappers','tables','acl'].some(k=>row[k]!==true))throw Error();
  if(await value(pool,'select public.wiki_cg_email_contract() as value')!=='wiki-cg-contribution-email-v1')throw Error();
 }catch{throw fail('wiki_notification_database_unqualified');}
}
export type WikiNotificationRuntime=Readonly<{runOnce(signal?:AbortSignal):Promise<Readonly<{processed:number;attention:number}>>;close():Promise<void>}>;
export async function createWikiNotificationRuntime(input:NotificationRuntimeConfig,ports:{poolFactory?:(options:Record<string,unknown>)=>SqlPool;fetch?:typeof fetch}={}):Promise<WikiNotificationRuntime>{
 const c=validateNotificationRuntimeConfig(input,'worker');if(c.origin!==ORIGIN)throw fail('wiki_notification_configuration_required');
 const driverName='pg',factory=ports.poolFactory??((await import(driverName) as {Pool:new(o:Record<string,unknown>)=>SqlPool}).Pool);
 const options={connectionString:c.databaseUrl,max:1,connectionTimeoutMillis:2000,idleTimeoutMillis:5000,query_timeout:5000,application_name:'wiki-notification-worker',ssl:{rejectUnauthorized:true,...(c.databaseCa?{ca:c.databaseCa}:{})}};
 const pool=ports.poolFactory?ports.poolFactory(options):new(factory as new(o:Record<string,unknown>)=>SqlPool)(options);
 pool.on?.('error',()=>{try{console.warn(JSON.stringify({component:'wiki.notifications',event:'idle_connection_error'}));}catch{}});
 try{
  await assertNotificationWorkerDatabase(pool);await assertWikiEmailDatabase(pool);
  const cycle=createWikiNotificationCycle({store:createWikiEmailStore(pool),channel:createResendNotificationChannel({id:'resend',apiKey:c.resendApiKey!,from:c.resendFrom!,fetch:ports.fetch}),from:c.resendFrom!});
  return Object.freeze({async runOnce(parent?:AbortSignal){return bounded(25000,async(signal,check)=>{await assertNotificationWorkerDatabase(pool);check();await assertWikiEmailDatabase(pool);check();return cycle(signal);},parent);},close:()=>pool.end()});
 }catch{await pool.end().catch(()=>{});throw fail('wiki_notification_database_unqualified');}
}
export function createLazyWikiNotificationRuntime(){let pending:Promise<WikiNotificationRuntime>|undefined;return (input:NotificationRuntimeConfig)=>{
 if(!pending){const created=createWikiNotificationRuntime(input);pending=created;void created.catch(()=>{if(pending===created)pending=undefined;});}return pending;
};}
type NativeContext={deploy?:{context?:string;published?:boolean}};
export type WikiNotificationObservation=Readonly<{component:'wiki.notifications';event:'scheduled_worker_failed'|'delivery_attention';code:string}>;
export function createWikiNotificationScheduledHandler(o:{configuration:()=>NotificationRuntimeConfig;runtime:(config:NotificationRuntimeConfig)=>Promise<Pick<WikiNotificationRuntime,'runOnce'>>;observe?:(entry:WikiNotificationObservation)=>void}){
 function observe(event:WikiNotificationObservation['event'],code:string){try{o.observe?.({component:'wiki.notifications',event,code});}catch{}}
 return async(_request:Request,context:NativeContext={}):Promise<Response>=>{
  const headers={'cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'};
  try{
   if(context.deploy?.context!=='production')throw fail();
   await bounded(25000,async(signal,check)=>{const config=o.configuration(),c=validateNotificationRuntimeConfig(config,'worker');if(c.origin!==ORIGIN)throw fail();check();const runtime=await o.runtime(config);check();const result=await runtime.runOnce(signal);check();if(result.attention>0)observe('delivery_attention','operator_attention_required');});
   return new Response(null,{status:204,headers});
  }catch{observe('scheduled_worker_failed','wiki_notification_unavailable');return Response.json({code:'wiki_notification_unavailable'},{status:503,headers});}
 };
}
