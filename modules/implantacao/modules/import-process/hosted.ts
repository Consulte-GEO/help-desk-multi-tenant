import {fail,uuid,integer,ProcessError} from './canonical.ts';
import type {Authority,Scope,Operation,Artifact,Options} from './contracts.ts';
import {createImportProcessService} from './service.ts';
import {createImportProcessHttpHandler} from './http.ts';
import {createPostgresProcessRepository} from './postgres.ts';
import type {SqlPool,SqlConnection} from './postgres.ts';

export interface HostedConfiguration {enabled:boolean;origin:string;supabaseUrl:string;publishableKey:string;databaseUrl:string;databaseCa:string;retentionDays:number;}
export function readHostedConfiguration(get:(key:string)=>string|undefined):HostedConfiguration {
 const required=(key:string)=>{const value=get(key);if(!value)throw Error(key+'_REQUIRED');return value;};
 const origin=required('IMPORT_PROCESS_ORIGIN'),supabaseUrl=required('IMPORT_PROCESS_SUPABASE_URL');
 const app=new URL(origin),auth=new URL(supabaseUrl);
 if(app.origin!==origin||app.protocol!=='https:'||app.username||app.password)throw Error('INVALID_HTTP_ORIGIN');
 if(auth.origin!==supabaseUrl||auth.protocol!=='https:'||!/^[a-z0-9]+\.supabase\.co$/.test(auth.hostname))throw Error('INVALID_SUPABASE_URL');
 const publishableKey=required('IMPORT_PROCESS_PUBLISHABLE_KEY');
 if(!publishableKey.startsWith('sb_publishable_')){
  try{const claim=JSON.parse(atob(publishableKey.split('.')[1]!.replaceAll('-','+').replaceAll('_','/')));if(claim.role!=='anon')throw Error();}catch{throw Error('PUBLIC_SUPABASE_KEY_REQUIRED');}
 }
 const databaseUrl=required('IMPORT_PROCESS_DATABASE_URL');let db:URL;
 try{db=new URL(databaseUrl);}catch{throw Error('INVALID_DATABASE_URL');}
 const reference=auth.hostname.split('.')[0]!;
 if(!['postgres:','postgresql:'].includes(db.protocol)||!db.password||db.pathname!=='/postgres'||db.search||db.hash||
  ![ 'setup_import_app',`setup_import_app.${reference}`].includes(decodeURIComponent(db.username))||
  !(db.hostname===`db.${reference}.supabase.co`||/^[a-z0-9-]+\.pooler\.supabase\.com$/.test(db.hostname)))throw Error('INVALID_DATABASE_URL');
 // Empty CA uses Node's maintained system trust roots; verification is never disabled.
 const databaseCa=get('IMPORT_PROCESS_DATABASE_CA')||'';if(databaseCa&&!/^-----BEGIN CERTIFICATE-----\r?\n[\s\S]+\r?\n-----END CERTIFICATE-----\s*$/.test(databaseCa))throw Error('IMPORT_PROCESS_DATABASE_CA_REQUIRED');
 return {enabled:get('IMPORT_PROCESS_ENABLED')==='true',origin,supabaseUrl,publishableKey,databaseUrl,databaseCa,retentionDays:integer(Number(get('IMPORT_PROCESS_RETENTION_DAYS')||90),1,3650)};
}
interface Credential {actorId:string;accessToken:string;isAdmin:boolean;}
interface Grant {workspace_id:string;account_id:string;requester_id:string;actor_id:string;work_ref:string|null;role:'requester'|'support';access_version:number;expires_at:string|null;}
export interface HostedOptions {configuration:HostedConfiguration;pool:SqlPool;authorityPool?:SqlPool;inspector:Options['inspector'];fetch?:typeof fetch;clock?:()=>Date;newId?:()=>string;signUpload?:(artifact:Artifact,accessToken:string,signal:AbortSignal)=>Promise<unknown>;}
/** Credentials are request-local capabilities created only after live Auth validation.
 * Persisted operator-managed grants supply source bindings; client UUIDs never grant access. */
export function createHostedImportProcess(o:HostedOptions):(req:Request)=>Promise<Response> {
 const cfg=o.configuration,clock=o.clock||(()=>new Date()),fetcher=o.fetch||fetch;
 const credentials=new WeakSet<object>();
 const credential=(raw:unknown):Credential=>{if(typeof raw!=='object'||raw===null||!credentials.has(raw))fail('ACCESS_DENIED');return raw as Credential;};
 const authenticate=async(req:Request,signal:AbortSignal):Promise<Credential|null>=>{
  const header=req.headers.get('authorization')||'';
  if(header.length>8192||!/^Bearer [A-Za-z0-9._~+\/-]+=*$/.test(header))return null;
  const result=await fetcher(cfg.supabaseUrl+'/auth/v1/user',{headers:{authorization:header,apikey:cfg.publishableKey},signal,redirect:'error'});
  if(result.status===401||result.status===403)return null;
  if(!result.ok)throw Error('AUTHENTICATION_UNAVAILABLE');
  const reader=result.body?.getReader();if(!reader)throw Error('INVALID_AUTHENTICATION_RESPONSE');
  const chunks:Uint8Array[]=[];let length=0;
  try{while(true){const value=await reader.read();if(value.done)break;length+=value.value.length;if(length>65536){await reader.cancel();throw Error('AUTHENTICATION_BODY_LIMIT');}chunks.push(value.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const user=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as {id?:unknown;app_metadata?:{is_admin?:unknown}};
  const c=Object.freeze({actorId:uuid(user.id),accessToken:header.slice(7),isAdmin:user.app_metadata?.is_admin===true});credentials.add(c);return c;
 };
 async function actorTransaction<T>(raw:unknown,signal:AbortSignal|undefined,work:(connection:SqlConnection,c:Credential)=>Promise<T>):Promise<T>{
  const identity=credential(raw);if(signal?.aborted)throw Error('REQUEST_ABORTED');
  const connection=await (o.authorityPool||o.pool).connect();let discard:Error|undefined;
  try{
   await connection.query('BEGIN');
   const role=await connection.query('SELECT rolname AS name, rolsuper AS superuser, rolbypassrls AS bypass FROM pg_catalog.pg_roles WHERE rolname=current_user');
   if(role.rows.length!==1||role.rows[0]!.name!=='setup_import_app'||role.rows[0]!.superuser!==false||role.rows[0]!.bypass!==false)fail('UNSAFE_DATABASE_ROLE');
   await connection.query("SELECT set_config('statement_timeout','5000',true),set_config('lock_timeout','3000',true),set_config('idle_in_transaction_session_timeout','10000',true),set_config('setup_import.actor_id',$1,true)",[identity.actorId]);
   const value=await work(connection,identity);if(signal?.aborted)throw Error('REQUEST_ABORTED');await connection.query('COMMIT');return value;
  }catch(error){try{await connection.query('ROLLBACK');}catch{discard=new Error('ROLLBACK_FAILED');}throw error;}
  finally{connection.release(discard);}
 }
 async function grants(connection:SqlConnection,c:Credential):Promise<Grant[]> {
  const result=await connection.query(`SELECT g.workspace_id,g.account_id,g.actor_id,g.requester_id,g.work_ref,g.role,g.access_version,g.expires_at
   FROM setup_import.access_grants g
   LEFT JOIN public.projects p ON p.id=g.project_id
   WHERE g.actor_id=$1 AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at>clock_timestamp())
   AND (g.role='requester' OR (g.role='support' AND $2 AND setup_import.actor_is_admin()))
   AND (g.project_id IS NULL OR (p.is_active AND (p.created_by=$1 OR EXISTS
    (SELECT 1 FROM public.project_members m WHERE m.project_id=p.id AND m.user_id=$1) OR (g.role='support' AND $2 AND setup_import.actor_is_admin()))))
   ORDER BY g.workspace_id,g.account_id,g.requester_id,g.work_ref NULLS FIRST LIMIT 33`,[c.actorId,c.isAdmin]);
  if(result.rows.length>32)fail('AUTHORITY_UNAVAILABLE');
  return (result.rows as unknown as Grant[]).filter(g=>g.actor_id===c.actorId&&(g.role==='requester'&&g.requester_id===c.actorId||g.role==='support'&&c.isAdmin));
 }
 const authority={async resolve(raw:unknown,s:Scope,_operation:Operation,signal?:AbortSignal):Promise<Authority>{
  return actorTransaction(raw,signal,async(connection,c)=>{
   const matching=(await grants(connection,c)).filter(g=>g.workspace_id===s.workspaceId&&g.account_id===s.accountId&&g.work_ref===s.workRef);
   if(matching.length!==1)fail('ACCESS_DENIED');const g=matching[0]!;
   return {...s,actorId:c.actorId,requesterId:uuid(g.requester_id),role:g.role,accessVersion:integer(g.access_version,1),expiresAt:new Date(Math.min(clock().getTime()+30000,g.expires_at?new Date(g.expires_at).getTime():Infinity)).toISOString()};
  });
 }};
 const locate=async(raw:unknown,caseId:string,_operation:Operation,signal:AbortSignal):Promise<Scope|null>=>actorTransaction(raw,signal,async(connection,c)=>{
  const found:Scope[]=[];
  for(const g of await grants(connection,c)){
   await connection.query("SELECT set_config('setup_import.workspace_id',$1,true),set_config('setup_import.account_id',$2,true),set_config('setup_import.case_id',$3,true),set_config('setup_import.requester_id',$4,true)",[g.workspace_id,g.account_id,caseId,g.requester_id]);
   const result=await connection.query('SELECT body FROM setup_import.cases WHERE workspace_id=$1 AND account_id=$2 AND case_id=$3 AND body->>\'requesterId\'=$4 AND body->>\'workRef\' IS NOT DISTINCT FROM $5',[g.workspace_id,g.account_id,caseId,g.requester_id,g.work_ref]);
   if(result.rows.length===1)found.push({workspaceId:g.workspace_id,accountId:g.account_id,caseId,workRef:g.work_ref});
  }
  return found.length===1?found[0]!:null;
 });
 const admit=async(raw:unknown,_operation:Operation,signal:AbortSignal)=>actorTransaction(raw,signal,async(connection,c)=>{
  const result=await connection.query(`INSERT INTO setup_import.admission (actor_id,window_started,requests) VALUES ($1,date_trunc('minute',clock_timestamp()),1)
   ON CONFLICT (actor_id) DO UPDATE SET window_started=date_trunc('minute',clock_timestamp()),
   requests=CASE WHEN setup_import.admission.window_started=date_trunc('minute',clock_timestamp()) THEN setup_import.admission.requests+1 ELSE 1 END
   RETURNING requests<=120 AS admitted`,[c.actorId]);return result.rows.length===1&&result.rows[0]!.admitted===true;
 });
 const repository=createPostgresProcessRepository(o.pool);
 const service=createImportProcessService({repository,authority,inspector:o.inspector,clock,newId:o.newId||(()=>crypto.randomUUID()),retentionDays:cfg.retentionDays});
 const core=createImportProcessHttpHandler({origin:cfg.origin,service,authenticate,locate,admit,enabled:()=>cfg.enabled});
 const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','vary':'Authorization, Origin'}});
 return async(req:Request)=>{
  const url=new URL(req.url),session=url.pathname==='/v1/import-processes/session',list=url.pathname==='/v1/import-processes'&&req.method==='GET';
  const upload=/^\/v1\/import-processes\/([0-9a-f-]{36})\/artifacts\/([0-9a-f-]{36})\/upload-url$/.exec(url.pathname);
  if(!session&&!upload&&!list)return core(req);
  if(!cfg.enabled)return json({code:'PROCESS_GATE_CLOSED'},503);
  if(url.search)return json({code:'QUERY_NOT_ALLOWED'},400);
  if(req.method!==((session||list)?'GET':'POST'))return json({code:'METHOD_NOT_ALLOWED'},405);
  if(req.headers.get('origin')!==null&&req.headers.get('origin')!==cfg.origin||upload&&req.headers.get('origin')!==cfg.origin)return json({code:'ORIGIN_DENIED'},403);
  const timeout=AbortSignal.timeout(10000),signal=AbortSignal.any([req.signal,timeout]);
  try{
   const c=await authenticate(req,signal);if(!c)return json({code:'AUTHENTICATION_REQUIRED'},401);
   if(!await admit(c,'read',signal))return json({code:'RATE_LIMITED'},429);
   if(session){const scopes=await actorTransaction(c,signal,async(connection,identity)=>(await grants(connection,identity)).map(g=>({workspaceId:g.workspace_id,accountId:g.account_id,requesterId:g.requester_id,workRef:g.work_ref,role:g.role})));return json({actorId:c.actorId,scopes,enabled:true,sourceIntegration:'prepared'});}
   if(list){const cases=await actorTransaction(c,signal,async(connection,identity)=>{
    const values:Record<string,unknown>[]=[];
    for(const g of await grants(connection,identity)){
     await connection.query("SELECT set_config('setup_import.workspace_id',$1,true),set_config('setup_import.account_id',$2,true),set_config('setup_import.case_id','',true),set_config('setup_import.requester_id',$3,true)",[g.workspace_id,g.account_id,g.requester_id]);
     const result=await connection.query(`SELECT case_id AS "caseId",workspace_id AS "workspaceId",account_id AS "accountId",body->>'workRef' AS "workRef",body->>'purpose' AS purpose,body->>'status' AS status,version,body->>'updatedAt' AS "updatedAt"
      FROM setup_import.cases WHERE workspace_id=$1 AND account_id=$2 AND body->>'requesterId'=$3 AND body->>'workRef' IS NOT DISTINCT FROM $4
      ORDER BY body->>'updatedAt' DESC,case_id LIMIT 101`,[g.workspace_id,g.account_id,g.requester_id,g.work_ref]);values.push(...result.rows);
    }
    return [...new Map(values.map(value=>[value.caseId,value])).values()].sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))||String(a.caseId).localeCompare(String(b.caseId)));
   });return json({cases:cases.slice(0,100),more:cases.length>100});}
   if(!o.signUpload)return json({code:'STORAGE_UNAVAILABLE'},503);
   if(req.body!==null||req.headers.has('transfer-encoding')||req.headers.get('content-length')&&req.headers.get('content-length')!=='0')return json({code:'BODY_NOT_ALLOWED'},400);
   // Consume no capability or object key supplied by the client. Resolve both through live ACL and repository.
   const s=await locate(c,uuid(upload![1]),'artifact.register',signal);if(!s)return json({code:'CASE_NOT_FOUND'},404);
   const a=await authority.resolve(c,s,'artifact.register',signal);
   const artifact=await repository.transaction(a,async tx=>{const process=await tx.readProcess();if(!process||process.status!=='draft')fail('CASE_NOT_EDITABLE');const value=await tx.readArtifact(uuid(upload![2]));if(!value||value.status!=='pending')fail('ARTIFACT_NOT_PENDING');return value;});
   await authority.resolve(c,s,'artifact.register',signal);
   return json(await o.signUpload(artifact,c.accessToken,signal));
  }catch(error){if(error instanceof ProcessError&&error.code==='ACCESS_DENIED')return json({code:'ACCESS_DENIED'},403);if(error instanceof ProcessError&&['ARTIFACT_NOT_PENDING','CASE_NOT_EDITABLE'].includes(error.code))return json({code:error.code},409);return json({code:'PROCESS_UNAVAILABLE'},503);}
 };
}
