/** Local-only provider and SQL boundary. Real Auth/HTTP modules; no Supabase or PostgreSQL. */
import {createAuthentication} from '../../src/infrastructure/authentication.ts';
import {createHttpHandler} from '../../src/http/handler.ts';
import {HelpdeskService} from '../../src/application/helpdesk.ts';
import {secretHash} from '../../src/domain/canonical.ts';
import type {SqlPool} from '../../src/infrastructure/sql.ts';
import {hostedFixture,uuid} from './hosted-acceptance-fixture.ts';

export async function hostedAuthFixture(){
 const base=await hostedFixture();
 const config={schema:1,environment:'homologation',origin:base.config.origin,supabaseUrl:base.config.supabaseUrl,
  deploymentCommit:base.config.deploymentCommit,workspaceId:base.config.workspaceId,accountId:base.config.accountA.accountId,
  humanAuthUserId:uuid(9001),humanPrincipalId:base.config.accountA.requesterId,
  integrationPrincipalId:base.config.integrationId,productInstanceId:base.config.accountA.productInstanceId};
 const secrets={email:'acceptance@example.test',password:'Synthetic-password-only!',integrationKey:'hd_key_'+'k'.repeat(43)};
 const controls={loginStatus:200,refreshStatus:200,logoutStatus:204,keepHumanSession:false,keepMachineSession:false,
  humanMembership:true,machineInstance:config.productInstanceId};
 let sequence=0,exchanges=0,revocations=0,logouts=0,refreshCalls=0;
 const access=new Map<string,{user:string;session:string}>(),refresh=new Map<string,string>(),machines=new Map<string,boolean>();
 const issue=(session=uuid(9100+sequence))=>{
  sequence++;
  const claims={role:'authenticated',iss:config.supabaseUrl+'/auth/v1',aud:'authenticated',sub:config.humanAuthUserId,
   exp:Math.floor(Date.now()/1000)+3600,session_id:session,nonce:sequence};
  const token=Buffer.from('{"alg":"TEST"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.synthetic';
  const ref='refresh_synthetic_'+sequence;access.set(token,{user:config.humanAuthUserId,session});refresh.set(ref,session);
  return {access_token:token,refresh_token:ref,expires_in:3600,token_type:'bearer',user:{id:config.humanAuthUserId,user_metadata:{role:'admin'}}};
 };
 const requests:Request[]=[],providerRequests:Request[]=[];
 const provider:typeof fetch=async(input,init)=>{
  const req=new Request(input,init);providerRequests.push(req.clone());const url=new URL(req.url);
  if(url.origin!==config.supabaseUrl)throw Error('Synthetic provider origin mismatch');
  const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
  if(url.pathname==='/auth/v1/token'){
   const body=await req.json();
   if(url.search==='?grant_type=password'){
    if(controls.loginStatus!==200)return json({error:'synthetic login failure'},controls.loginStatus);
    if(body.email!==secrets.email||body.password!==secrets.password)return json({},400);
    return json(issue());
   }
   if(url.search==='?grant_type=refresh_token'){
    refreshCalls++;
    if(controls.refreshStatus!==200)return json({error:'synthetic refresh failure'},controls.refreshStatus);
    const session=refresh.get(body.refresh_token);if(!session)return json({error:'refresh_token_not_found'},400);
    refresh.delete(body.refresh_token);return json(issue(session));
   }
  }
  const bearer=req.headers.get('authorization')?.slice(7)??'',record=access.get(bearer);
  if(url.pathname==='/auth/v1/user')return record?json({id:record.user,user_metadata:{role:'admin'}}):json({},401);
  if(url.pathname==='/auth/v1/logout'&&url.search==='?scope=local'){
   logouts++;
   if(controls.logoutStatus!==204)return json({error:'synthetic logout failure'},controls.logoutStatus);
   if(!controls.keepHumanSession)for(const [key,session] of refresh)if(session===record?.session)refresh.delete(key);
   // Access JWT stays valid. Revocation of refresh is not immediate JWT invalidation.
   return new Response(null,{status:204});
  }
  return json({},404);
 };
 const pool:SqlPool={async query(sql,values=[]){
  const row=(key:string,value:unknown)=>({command:'SELECT',rowCount:1,rows:[{[key]:value}]});
  if(sql.includes('exchange_key')){exchanges++;if(values[0]!==secretHash(secrets.integrationKey))return row('result',null);
   machines.set(String(values[1]),true);return row('result',{workspaceId:config.workspaceId,expiresAt:new Date(Date.now()+590000).toISOString()});}
  if(sql.includes('revoke_session')){revocations++;if(!controls.keepMachineSession)machines.set(String(values[0]),false);return row('result',true);}
  if(sql.includes('resolve_session'))return row('principal',machines.get(String(values[0]))===true&&values[1]===config.workspaceId
   ?{...base.people[base.tokens.machineA],productInstanceIds:[controls.machineInstance]}:null);
  if(sql.includes('resolve_human'))return row('principal',controls.humanMembership&&values[0]===config.humanAuthUserId&&values[1]===config.workspaceId?base.people[base.tokens.requesterA]:null);
  throw Error('Unexpected synthetic query');
 },async connect(){throw Error('No PostgreSQL exists in this fixture');},async end(){}};
 const auth=createAuthentication(pool,{supabaseUrl:config.supabaseUrl,publishableKey:'sb_publishable_synthetic'},provider);
 const handler=createHttpHandler({service:new HelpdeskService(base.db),...auth,
  publicConfig:{supabaseUrl:config.supabaseUrl,publishableKey:'sb_publishable_synthetic'}});
 const fetcher:typeof fetch=async(input,init)=>{
  const req=new Request(input,init);requests.push(req.clone());
  return new URL(req.url).origin===config.supabaseUrl?provider(req):handler(req);
 };
 return {config,secrets,controls,requests,providerRequests,fetcher,handler,provider,base,access,refresh,machines,
  counters:()=>({exchanges,revocations,logouts,refreshCalls}),options:{execute:true,allowSessionMutations:true,confirmOrigin:config.origin,confirmAuthOrigin:config.supabaseUrl,fetcher}};
}
