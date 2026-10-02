/** Explicit test-client session mutations only. No provisioning, domain writes or release approval. */
import {createHash,randomUUID} from 'node:crypto';
import {createHumanAuthTransport,HumanAuthError} from '../web/human-auth.js';
import type {HumanCredentials,HumanTransport} from '../web/human-auth.js';
import {readIdentityResponse} from '../src/infrastructure/auth-response.ts';
import {SHORT_SESSION_PATTERN,sessionResult} from '../src/infrastructure/session-lifecycle.ts';
import {RELEASE} from '../src/version.ts';
import {isPersistableText} from '../src/domain/input-values.ts';

type Obj=Record<string,unknown>;
export type AuthAcceptanceConfig={schema:1;environment:'homologation';origin:string;supabaseUrl:string;deploymentCommit:string;
 workspaceId:string;accountId:string;humanAuthUserId:string;humanPrincipalId:string;integrationPrincipalId:string;productInstanceId:string};
export type AuthAcceptanceSecrets={email:string;password:string;integrationKey:string};
export type AuthAcceptanceOptions={execute?:boolean;allowSessionMutations?:boolean;confirmOrigin?:string;confirmAuthOrigin?:string;fetcher?:typeof fetch};
type Code='not_run'|'ok'|'prerequisite_failed'|'release_gate_closed'|'configuration_mismatch'|'unsafe_response'|'unexpected_status'
 |'identity_mismatch'|'auth_rejected'|'auth_unavailable'|'http_unavailable'|'logout_unconfirmed'|'revocation_not_effective';
type Cleanup='not_requested'|'pending'|'confirmed'|'unconfirmed';
type Check={id:string;status:'not_run'|'passed'|'failed'|'blocked';code:Code;http_status:number|null;request_id:string|null};
export type AuthAcceptanceReport={schema:1;scope:'hosted-auth-acceptance';client_release:'M1-R11';run_id:string;
 status:'planned'|'passed'|'failed'|'blocked';transport:'none'|'injected'|'https';origin:string;auth_origin:string;
 declared_deployment_commit:string;deployment_commit_verified:false;config_sha256:string;started_at:string;completed_at:string;
 platform_approved:false;operational:false;expiry_tested:false;long_term_key_rotation_tested:false;long_term_key_revocation_tested:false;
 human_access_jwt_revocation_tested:false;browser_tested:false;restore_tested:false;
 unconfirmed_session_creation:boolean;cleanup:{human:Cleanup;machine:Cleanup};checks:Check[]};
const IDS=['public-config','capabilities','human-login','human-identity','human-refresh','human-refreshed-identity',
 'human-logout','human-refresh-rejected','machine-exchange','machine-identity','machine-revoke','machine-revoked'] as const;
const object=(v:unknown):v is Obj=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Obj,keys:readonly string[])=>Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v);
function invalid():never {throw Error('Argumentos, configuração ou credenciais de aceitação inválidos.');}
function configuration(value:unknown):AuthAcceptanceConfig{
 const fields=['schema','environment','origin','supabaseUrl','deploymentCommit','workspaceId','accountId','humanAuthUserId','humanPrincipalId','integrationPrincipalId','productInstanceId'];
 if(!object(value)||!exact(value,fields)||value.schema!==1||value.environment!=='homologation'
  ||typeof value.origin!=='string'||!/^https:\/\/[a-f0-9]{24}--helpdesk-consultegeo\.netlify\.app$/.test(value.origin)
  ||typeof value.supabaseUrl!=='string'||!/^https:\/\/[a-z]{20}\.supabase\.co$/.test(value.supabaseUrl)
  ||typeof value.deploymentCommit!=='string'||!/^[a-f0-9]{40}$/.test(value.deploymentCommit))invalid();
 for(const key of fields.slice(5))if(!uuid(value[key]))invalid();
 if(value.humanPrincipalId===value.integrationPrincipalId)invalid();
 return {...value} as AuthAcceptanceConfig;
}
function credentials(value:unknown):AuthAcceptanceSecrets{
 if(!object(value)||!exact(value,['email','password','integrationKey']))invalid();
 const text=(s:unknown,max:number):s is string=>typeof s==='string'&&s.length>0&&s.length<=max&&isPersistableText(s)&&!/[\0\r\n]/.test(s);
 if(!text(value.email,320)||!/^\S+@\S+\.\S+$/.test(value.email)||!text(value.password,4096)
  ||typeof value.integrationKey!=='string'||!/^hd_key_[A-Za-z0-9_-]{43,128}$/.test(value.integrationKey))invalid();
 return {...value} as AuthAcceptanceSecrets;
}
class Failure extends Error{code:Code;constructor(code:Code){super('Verificação de aceitação não aprovada.');this.code=code;}}
function need(value:unknown,code:Code='unsafe_response'):asserts value{if(!value)throw new Failure(code);}
function errorCode(error:unknown):Code{
 if(error instanceof Failure)return error.code;
 if(error instanceof HumanAuthError){
  if(['login_failed','session_rejected'].includes(error.code))return 'auth_rejected';
  if(error.code==='auth_response_invalid')return 'unsafe_response';
  if(error.code==='auth_logout_unconfirmed')return 'logout_unconfirmed';
  return 'auth_unavailable';
 }
 return 'unsafe_response';
}
function validateHuman(value:HumanCredentials,c:AuthAcceptanceConfig):void{
 let claims:unknown;
 try{claims=JSON.parse(Buffer.from(value.accessToken.split('.')[1]!,'base64url').toString('utf8'));}catch{throw new Failure('unsafe_response');}
 // Rejection filters only. These unverified claims do not grant any Help Desk permission.
 need(object(claims)&&claims.role==='authenticated'&&claims.iss===c.supabaseUrl+'/auth/v1'&&claims.aud==='authenticated','unsafe_response');
 need(value.userId===c.humanAuthUserId&&claims.sub===c.humanAuthUserId,'identity_mismatch');
 need(Number.isSafeInteger(claims.exp)&&Number(claims.exp)*1000>Date.now()&&uuid(claims.session_id),'unsafe_response');
}
function identity(value:unknown,c:AuthAcceptanceConfig,machine:boolean):void{
 need(object(value),'identity_mismatch');
 need(value.id===(machine?c.integrationPrincipalId:c.humanPrincipalId)&&value.kind===(machine?'integration':'human')
  &&value.workspace_id===c.workspaceId&&value.workspace_role===null&&Array.isArray(value.grants)&&value.grants.length===1,'identity_mismatch');
 const grant=value.grants[0];need(object(grant)&&grant.account_id===c.accountId&&grant.role==='requester','identity_mismatch');
 need(Array.isArray(value.scopes)&&value.scopes.includes('contexts:resolve')&&value.scopes.includes('tickets:read'),'identity_mismatch');
 need(Array.isArray(value.product_instance_ids)&&(machine?value.product_instance_ids.length===1&&value.product_instance_ids[0]===c.productInstanceId:value.product_instance_ids.length===0),'identity_mismatch');
}
function cancel(response?:Response):void{try{if(response?.body&&!response.body.locked)void response.body.cancel().catch(()=>{});}catch{/* never retain provider details */}}
/** Plan mode returns before accessing credentials or creating a transport. */
export async function runHostedAuthAcceptance(input:unknown,secretInput:unknown={},options:AuthAcceptanceOptions={}):Promise<AuthAcceptanceReport>{
 const c=configuration(input),started=new Date().toISOString();
 const report:AuthAcceptanceReport={schema:1,scope:'hosted-auth-acceptance',client_release:'M1-R11',run_id:randomUUID(),status:'planned',transport:'none',
  origin:c.origin,auth_origin:c.supabaseUrl,declared_deployment_commit:c.deploymentCommit,deployment_commit_verified:false,
  config_sha256:createHash('sha256').update(JSON.stringify(c)).digest('hex'),started_at:started,completed_at:started,
  platform_approved:false,operational:false,expiry_tested:false,long_term_key_rotation_tested:false,long_term_key_revocation_tested:false,
  human_access_jwt_revocation_tested:false,browser_tested:false,restore_tested:false,unconfirmed_session_creation:false,
  cleanup:{human:'not_requested',machine:'not_requested'},checks:IDS.map(id=>({id,status:'not_run',code:'not_run',http_status:null,request_id:null}))};
 if(options.execute!==true)return report;
 if(options.allowSessionMutations!==true||options.confirmOrigin!==c.origin||options.confirmAuthOrigin!==c.supabaseUrl
  ||(!options.fetcher&&process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0'))invalid();
 const secrets=credentials(secretInput),send=options.fetcher??fetch;
 report.transport=options.fetcher?'injected':'https';report.status='passed';
 let active:Check|undefined,transport:HumanTransport|undefined,human:HumanCredentials|undefined,machineToken:string|undefined;
 let humanNeedsLogout=false,machineNeedsRevoke=false;
 async function api(path:string,method:string,status:number,bearer?:string,workspace=false):Promise<unknown>{
  const requestId=randomUUID(),controller=new AbortController();let response:Response|undefined,timer:ReturnType<typeof setTimeout>|undefined;
  if(active)active.request_id=requestId;
  const deadline=new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Failure('http_unavailable'));},5000);});
  try{
   const headers:Record<string,string>={accept:'application/json','x-request-id':requestId};
   if(bearer)headers.authorization='Bearer '+bearer;if(workspace)headers['x-workspace-id']=c.workspaceId;
   const task=Promise.resolve().then(()=>send(c.origin+path,{method,headers,signal:controller.signal,redirect:'error',credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'}));
   void task.then(res=>{if(controller.signal.aborted)cancel(res);},()=>{});
   try{response=await Promise.race([task,deadline]);}catch{throw new Failure('http_unavailable');}
   if(active)active.http_status=response.status;
   need(!response.redirected&&!(response.status>=300&&response.status<400)
    &&/(?:^|,)\s*no-store\s*(?:,|$)/i.test(response.headers.get('cache-control')??'')
    &&response.headers.get('x-content-type-options')==='nosniff'&&response.headers.get('x-request-id')===requestId);
   if(response.status===204){need(status===204,'unexpected_status');need(response.body===null);return null;}
   const media=response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
   need(media===(response.status>=400?'application/problem+json':'application/json'));
   let body:unknown;try{body=await readIdentityResponse(response,controller.signal);}catch{throw new Failure('unsafe_response');}
   if(response.status===503&&object(body)&&body.code==='release_gate_closed')throw new Failure('release_gate_closed');
   need(response.status===status,'unexpected_status');return body;
  }finally{clearTimeout(timer);controller.abort();cancel(response);}
 }
 async function acquireHuman(action:()=>Promise<HumanCredentials>):Promise<void>{
  try{
   const candidate=await action();validateHuman(candidate,c);human=candidate;humanNeedsLogout=true;report.cleanup.human='pending';
  }catch(error){
   if(!['auth_rejected'].includes(errorCode(error))&&!(error instanceof HumanAuthError&&error.code==='auth_rate_limited')){
    report.unconfirmed_session_creation=true;if(!human)report.cleanup.human='unconfirmed';
   }
   throw error;
  }
 }
 async function logoutHuman():Promise<void>{
  need(human&&transport);humanNeedsLogout=false;report.cleanup.human='unconfirmed';
  try{await transport.signOut(human.accessToken);report.cleanup.human='confirmed';}catch{throw new Failure('logout_unconfirmed');}
 }
 async function revokeMachine():Promise<void>{
  need(machineToken);machineNeedsRevoke=false;report.cleanup.machine='unconfirmed';
  await api('/v1/integration-tokens/current','DELETE',204,machineToken);report.cleanup.machine='confirmed';
 }
 const actions:(()=>Promise<void>)[]=[
  async()=>{
   const body=await api('/v1/public-config','GET',200);
   need(object(body)&&exact(body,['supabase_url','publishable_key'])&&body.supabase_url===c.supabaseUrl
    &&typeof body.publishable_key==='string'&&/^sb_publishable_[A-Za-z0-9_-]{1,512}$/.test(body.publishable_key),'configuration_mismatch');
   const authFetcher:typeof fetch=async(i,o)=>{const res=await send(i,o);if(active)active.http_status=res.status;return res;};
   transport=createHumanAuthTransport({supabase_url:c.supabaseUrl,publishable_key:body.publishable_key},{fetcher:authFetcher});
  },
  async()=>{const body=await api('/v1/capabilities','GET',200);need(object(body)&&body.api_version==='v1'&&body.release===RELEASE
   &&object(body.capabilities)&&body.capabilities.integration_session_revocation===true,'configuration_mismatch');},
  async()=>{need(transport);await acquireHuman(()=>transport!.signIn(secrets.email,secrets.password));},
  async()=>{need(human);identity(await api('/v1/me','GET',200,human.accessToken,true),c,false);},
  async()=>{need(transport&&human);await acquireHuman(()=>transport!.refresh(human!.refreshToken));},
  async()=>{need(human);identity(await api('/v1/me','GET',200,human.accessToken,true),c,false);},
  logoutHuman,
  async()=>{
   need(transport&&human);
   try{await acquireHuman(()=>transport!.refresh(human!.refreshToken));}
   catch(error){if(error instanceof HumanAuthError&&error.code==='session_rejected')return;throw error;}
   throw new Failure('revocation_not_effective');
  },
  async()=>{
   try{
    const body=await api('/v1/integration-tokens','POST',201,secrets.integrationKey);
    need(object(body)&&exact(body,['access_token','token_type','expires_at','workspace_id'])&&typeof body.access_token==='string'
     &&SHORT_SESSION_PATTERN.test(body.access_token)&&body.token_type==='Bearer');
    // Only self-revocation may use this owned token until its workspace/lifetime is checked.
    machineToken=body.access_token;machineNeedsRevoke=true;report.cleanup.machine='pending';
    const result=sessionResult({workspaceId:body.workspace_id,expiresAt:body.expires_at},new Date());
    need(result.workspaceId===c.workspaceId,'identity_mismatch');
   }catch(error){
    if(!machineToken&&![400,401,403,429].includes(active?.http_status??0)){report.unconfirmed_session_creation=true;report.cleanup.machine='unconfirmed';}
    throw error;
   }
  },
  async()=>{need(machineToken);identity(await api('/v1/me','GET',200,machineToken,true),c,true);},
  revokeMachine,
  async()=>{
   need(machineToken);
   try{const body=await api('/v1/me','GET',403,machineToken,true);need(object(body)&&body.code==='membership_required'&&body.status===403);}
   catch(error){if(active?.http_status===200)throw new Failure('revocation_not_effective');throw error;}
  }
 ];
 try{
  for(const [index,action] of actions.entries()){
   active=report.checks[index]!;
   if(report.status!=='passed'){active.status='blocked';active.code='prerequisite_failed';continue;}
   try{await action();active.status='passed';active.code='ok';}
   catch(error){active.code=errorCode(error);active.status=active.code==='release_gate_closed'?'blocked':'failed';report.status=active.status;}
  }
 }finally{
  active=undefined;
  // Cleanup is not a retry. It only closes known acquisitions with no previous close attempt.
  if(humanNeedsLogout)try{await logoutHuman();}catch{report.status='failed';}
  if(machineNeedsRevoke)try{await revokeMachine();}catch{report.status='failed';}
  human=undefined;machineToken=undefined;report.completed_at=new Date().toISOString();
 }
 return report;
}
