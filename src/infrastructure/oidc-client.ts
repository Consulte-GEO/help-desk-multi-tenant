import {createHash} from 'node:crypto';
import {isIP} from 'node:net';
import {HelpdeskError} from '../domain/errors.ts';
import {requestHash} from '../domain/canonical.ts';
import {parseIdentityNamespace,type IdentityObservation} from '../domain/external-identity.ts';
import {compareInstants,isCanonicalInstant} from '../../shared/instant.js';
import {readIdentityResponse} from './auth-response.ts';
import {verifyOidcIdToken} from './oidc-identity.ts';
export type OidcRegistration=Readonly<{issuer:string;clientId:string;authorizationEndpoint:string;tokenEndpoint:string;jwksUri:string;redirectUri:string;scopes:readonly string[]}>;
export type OidcSecrets=Readonly<{accessToken:string;refreshToken:string|null;accessExpiresAt:string}>;
export type OidcExchange=Readonly<{identity:IdentityObservation;secrets:OidcSecrets}>;
const fail=(code:string,status=503)=>new HelpdeskError(status,code,'O provedor não confirmou este fluxo de identidade.');
function endpoint(value:string):string{
 if(typeof value!=='string'||value.length>2048||/[\s\\?#]/.test(value))throw Error();const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||isIP(u.hostname)||u.hostname==='localhost'||u.href!==value)throw Error();return value;
}
function registration(value:OidcRegistration):OidcRegistration{
 const namespace=parseIdentityNamespace({issuer:value.issuer,clientId:value.clientId});
 if(!Array.isArray(value.scopes)||!value.scopes.length||value.scopes.length>32||!value.scopes.includes('openid')||new Set(value.scopes).size!==value.scopes.length||value.scopes.some(s=>typeof s!=='string'||!s||s.length>100||! /^[\x21\x23-\x5b\x5d-\x7e]+$/.test(s)))throw Error();
 return Object.freeze({...namespace,authorizationEndpoint:endpoint(value.authorizationEndpoint),tokenEndpoint:endpoint(value.tokenEndpoint),jwksUri:endpoint(value.jwksUri),redirectUri:endpoint(value.redirectUri),scopes:Object.freeze([...value.scopes])});
}
/** Protocol adapter, not an approval mechanism. Only the server composition may
 * supply this registration after source qualification. There is no discovery,
 * env fallback, arbitrary token URL, retry or use of ID-token metadata as access.
 * Supported profile: code+S256, client_secret_basic, RS256; refresh returns a
 * signed ID token. A provider outside that profile requires explicit adaptation.
 */
export function createOidcProtocolClient(options:{registration:OidcRegistration;clientSecret:()=>string;fetcher?:typeof fetch;clock?:()=>string}){
 let config:OidcRegistration;try{config=registration(options.registration);if(typeof options.clientSecret!=='function')throw Error();}catch{throw fail('oidc_configuration_invalid',500);}
 const fetcher=options.fetcher??fetch,clock=options.clock??(()=>new Date().toISOString()),registrationHash=requestHash(config);
 const at=()=>{const value=clock();if(!isCanonicalInstant(value))throw fail('oidc_clock_invalid');return value;};
 function authorizationUrl(state:string,nonce:string,verifier:string):string{
  if([state,nonce,verifier].some(s=>typeof s!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(s)))throw fail('oidc_flow_invalid',400);
  const url=new URL(config.authorizationEndpoint);url.search=new URLSearchParams({response_type:'code',client_id:config.clientId,redirect_uri:config.redirectUri,scope:config.scopes.join(' '),state,nonce,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256'}).toString();return url.toString();
 }
 async function request(fields:Record<string,string>,nonce:string,caller:AbortSignal,subject?:string):Promise<OidcExchange>{
  if(!(caller instanceof AbortSignal)||caller.aborted)throw fail('oidc_cancelled',409);
  const signal=AbortSignal.any([caller,AbortSignal.timeout(5000)]),deadline=performance.now()+5000;
  const check=()=>{if(caller.aborted)throw fail('oidc_cancelled',409);if(signal.aborted||performance.now()>=deadline)throw fail('oidc_provider_unavailable');};
  const get=async(url:string,init:RequestInit)=>{
   check();let response:Response;try{response=await fetcher(url,{...init,signal,redirect:'error'});}catch{check();throw fail('oidc_provider_unavailable');}check();
   if(!response.ok){try{void response.body?.cancel().catch(()=>{});}catch{/* no raw errors */}throw fail('oidc_provider_unavailable');}
   let value:unknown;try{value=await readIdentityResponse(response,signal);}catch{throw fail('oidc_provider_unavailable');}check();return value;
  };
  let secret:string;try{secret=options.clientSecret();if(typeof secret!=='string'||!secret||secret.length>4096)throw Error();}catch{throw fail('oidc_configuration_invalid',500);}
  const body=new URLSearchParams(fields);
  const raw=await get(config.tokenEndpoint,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',accept:'application/json',authorization:'Basic '+Buffer.from(encodeURIComponent(config.clientId)+':'+encodeURIComponent(secret)).toString('base64')},body:body.toString()});secret='';
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw fail('oidc_provider_invalid');const r=raw as Record<string,unknown>;
  if(typeof r.access_token!=='string'||!r.access_token||r.access_token.length>16384||r.token_type!=='Bearer'||typeof r.id_token!=='string'||!Number.isSafeInteger(r.expires_in)||Number(r.expires_in)<1||Number(r.expires_in)>86400||r.refresh_token!==undefined&&(typeof r.refresh_token!=='string'||!r.refresh_token||r.refresh_token.length>16384))throw fail('oidc_provider_invalid');
  const jwks=await get(config.jwksUri,{method:'GET',headers:{accept:'application/json'}}),now=at();check();
  const identity=verifyOidcIdToken(r.id_token,jwks,{issuer:config.issuer,clientId:config.clientId,nonce,at:now,...(subject?{mode:'refresh' as const,subject}:{})});
  const accessExpiry=new Date(Date.parse(now)+Number(r.expires_in)*1000).toISOString();
  return Object.freeze({identity,secrets:Object.freeze({accessToken:r.access_token,refreshToken:typeof r.refresh_token==='string'?r.refresh_token:fields.refresh_token??null,accessExpiresAt:compareInstants(accessExpiry,identity.expiresAt)<0?accessExpiry:identity.expiresAt})});
 }
 async function exchange(code:string,verifier:string,nonce:string,signal:AbortSignal):Promise<OidcExchange>{
  if(typeof code!=='string'||!code||code.length>4096||/[\u0000-\u001f\u007f]/.test(code)||!/^[A-Za-z0-9_-]{43}$/.test(verifier))throw fail('oidc_flow_invalid',400);
  return request({grant_type:'authorization_code',code,redirect_uri:config.redirectUri,code_verifier:verifier},nonce,signal);
 }
 async function refresh(refreshToken:string,nonce:string,subject:string,signal:AbortSignal):Promise<OidcExchange>{
  if(typeof refreshToken!=='string'||!refreshToken||refreshToken.length>16384||typeof subject!=='string'||!subject)throw fail('oidc_flow_invalid',400);
  return request({grant_type:'refresh_token',refresh_token:refreshToken},nonce,signal,subject);
 }
 return Object.freeze({registration:config,registrationHash,authorizationUrl,exchange,refresh});
}
