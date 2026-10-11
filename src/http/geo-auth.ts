import {randomUUID} from 'node:crypto';
import type {createGeoLogin,PersonSessionReceipt} from '../application/geo-login.ts';
import {configurationObject} from '../domain/support-configuration.ts';
import {controlledJson,privateJson,httpFailure as fail} from './controlled-json.ts';
const COOKIE='__Host-helpdesk_oidc';
const cookie=(value:string,maxAge:number)=>`${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
const problemCodes:Record<string,number>={release_gate_closed:503,origin_denied:403,not_found:404,method_not_allowed:405,unknown_parameter:400,invalid_json:400,unsupported_media_type:415,payload_too_large:413,request_timeout:408,request_cancelled:409,geo_login_input_invalid:400,geo_login_flow_invalid:401,geo_login_cancelled:409,geo_login_unavailable:503,geo_login_configuration_invalid:503,person_session_invalid:401,person_session_expired:401,person_session_context_invalid:403,person_session_context_changed:403,person_session_identity_changed:403,person_session_revoked:401,person_session_refresh_unavailable:403,person_session_outcome_unknown:503,person_session_logout_unknown:503,oidc_token_invalid:401,oidc_provider_invalid:503,oidc_provider_unavailable:503,oidc_cancelled:409,external_identity_not_linked:403,external_identity_ambiguous:403,rate_limit_exceeded:429};
const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Confirmar acesso ao Help Desk</title><script type="module" src="/geo-auth-callback.js"></script></head><body><main><h1>Confirmar acesso</h1><p>O retorno será validado somente ao confirmar. Nenhuma permissão é concedida por abrir esta página.</p><button id="confirm-geo-login" type="button" disabled>Confirmar e continuar</button><button id="cancel-geo-login" type="button">Cancelar</button><p id="geo-login-status" role="status" aria-live="polite"></p></main></body></html>`;
function dto(r:PersonSessionReceipt){return {principal_id:r.principalId,workspace_id:r.workspaceId,access_token:r.accessToken,refresh_token:r.refreshToken,expires_at:r.expiresAt,absolute_expires_at:r.absoluteExpiresAt,return_path:r.returnPath};}
function ownedCookie(req:Request):string{
 const parts=(req.headers.get('cookie')??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(COOKIE+'='));
 if(parts.length!==1)throw fail(401,'geo_login_flow_invalid');const v=parts[0]!.slice(COOKIE.length+1);if(!/^[A-Za-z0-9_-]{43}$/.test(v))throw fail(401,'geo_login_flow_invalid');return v;
}
/** Optional mount. Callback HTML never reflects its URL. The host must exclude
 * callback query strings from access logs and explicitly whitelist these assets.
 * No runtime gate/configuration is changed by creating this handler. */
export function createGeoAuthHandler(d:{enabled:()=>boolean;origin:string;api:ReturnType<typeof createGeoLogin>;flowLifetimeSeconds:number;rateLimiter:{beforeAuthentication(req:Request,context?:{clientIp?:string}):Promise<unknown>}}){
 if(new URL(d.origin).origin!==d.origin||!d.origin.startsWith('https://')||!Number.isSafeInteger(d.flowLifetimeSeconds)||d.flowLifetimeSeconds<30||d.flowLifetimeSeconds>600)throw Error('Invalid server login mount');
 return async(req:Request,context:{clientIp?:string}={}):Promise<Response>=>{
  const requestId=randomUUID();let consumes=false;
  try{
   if(d.enabled()!==true)throw fail(503,'release_gate_closed');await d.rateLimiter.beforeAuthentication(req,context);
   const u=new URL(req.url);if(u.origin!==d.origin)throw fail(403,'origin_denied');
   if(u.pathname==='/auth/geo/callback'){
    if(req.method!=='GET')throw fail(405,'method_not_allowed');
    return new Response(html,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff','x-frame-options':'DENY','content-security-policy':"default-src 'none'; script-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",'x-request-id':requestId}});
   }
   const path=u.pathname;if(!['/v1/auth/geo/begin','/v1/auth/geo/complete','/v1/auth/geo/refresh','/v1/auth/geo/logout'].includes(path))throw fail(404,'not_found');
   if(req.method!=='POST')throw fail(405,'method_not_allowed');if(u.search)throw fail(400,'unknown_parameter');
   if(req.headers.get('origin')!==d.origin||req.headers.get('sec-fetch-site')==='cross-site')throw fail(403,'origin_denied');
   const raw=await controlledJson(req);let input:Record<string,unknown>;
   const exact=(keys:string[])=>{try{return configurationObject(raw,keys);}catch{throw fail(400,'invalid_json');}};
   if(path.endsWith('/begin')){
    input=exact(['return_path']);if(typeof input.return_path!=='string')throw fail(400,'geo_login_input_invalid');
    const flow=await d.api.beginGeoLogin(input.return_path,req.signal);
    return privateJson({authorization_url:flow.authorizationUrl,expires_at:flow.expiresAt,return_path:flow.returnPath},200,{'set-cookie':cookie(flow.browserBinding,d.flowLifetimeSeconds),'x-request-id':requestId});
   }
   if(path.endsWith('/complete')){
    input=exact(['code','state','iss',...(Object.hasOwn(raw,'workspace_id')?['workspace_id']:[])]);const binding=ownedCookie(req);consumes=true;
    const result=await d.api.completeGeoLogin({code:input.code,state:input.state,iss:input.iss},binding,input.workspace_id as string|undefined,req.signal);
    return privateJson(dto(result),200,{'set-cookie':cookie('',0),'x-request-id':requestId});
   }
   if(path.endsWith('/refresh')){
    input=exact(['refresh_token']);if(typeof input.refresh_token!=='string')throw fail(400,'geo_login_input_invalid');return privateJson(dto(await d.api.rotatePersonSession(input.refresh_token,req.signal)),200,{'x-request-id':requestId});
   }
   exact([]);const token=/^Bearer (hd_person_[A-Za-z0-9_-]{43})$/.exec(req.headers.get('authorization')??'')?.[1];if(!token)throw fail(401,'person_session_invalid');
   await d.api.logoutPersonSession(token);return privateJson({revoked:'current_helpdesk_session',provider_logout:false},200,{'x-request-id':requestId});
  }catch(e){let code='geo_login_unavailable';try{const c=e&&typeof e==='object'?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;if(typeof c==='string'&&Object.hasOwn(problemCodes,c))code=c;}catch{/* no raw provider/body/token messages */}
   const status=problemCodes[code]??503;return privateJson({type:'about:blank',status,code,detail:code==='person_session_outcome_unknown'?'Confirmação desconhecida. Inicie uma nova entrada; não repita este código.':'Não foi possível confirmar o acesso.',request_id:requestId},status,{'content-type':'application/problem+json','x-request-id':requestId,...(consumes?{'set-cookie':cookie('',0)}:{})});
  }
 };
}
