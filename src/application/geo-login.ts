import {randomBytes,randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {HelpdeskError} from '../domain/errors.ts';
import {secretHash} from '../domain/canonical.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {parseExternalIdentityRef,parseIdentityObservation,type IdentityObservation,type ExternalIdentityRef} from '../domain/external-identity.ts';
import {createExternalIdentityResolver,type ExternalIdentityDirectory,type ExternalIdentityMatch} from './external-identity.ts';
import {validatePrincipal} from '../infrastructure/principal-validation.ts';
import type {Principal} from '../domain/model.ts';
import type {OidcExchange,OidcRegistration,OidcSecrets} from '../infrastructure/oidc-client.ts';
import {compareInstants,isCanonicalInstant,zonedInstantMicros} from '../../shared/instant.js';

export type OwnedLoginFlow=Readonly<{id:string;stateHash:string;browserHash:string;registrationHash:string;returnPath:string;createdAt:string;expiresAt:string;privateEnvelope:string}>;
export type StoredPersonSession=Readonly<{id:string;principalId:string;identityId:string;identityRevision:string;reference:ExternalIdentityRef;workspaceId:string;contextRevision:string;generation:number;accessHash:string;refreshHash:string;accessExpiresAt:string;absoluteExpiresAt:string;registrationHash:string;privateEnvelope:string;returnPath:string;status:'active'|'refreshing'|'revoked'}>;
export type PersonSessionReceipt=Readonly<{principalId:string;workspaceId:string;accessToken:string;refreshToken:string;expiresAt:string;absoluteExpiresAt:string;returnPath:string}>;
export interface OwnedLoginFlowStore{
 put(flow:OwnedLoginFlow):Promise<void>;
 /** Atomically match BOTH hashes and consume once. Wrong browser must not consume. */
 take(stateHash:string,browserHash:string):Promise<unknown>;
}
export interface PersonSessionStore{
 /** The durable implementation must check admission just before commit. */
 create(session:StoredPersonSession,admission:()=>void):Promise<void>;
 readAccess(hash:string):Promise<unknown>;
 /** Atomically active -> refreshing. Old access is unusable while claimed. */
 claimRefresh(hash:string,at:string):Promise<unknown>;
 /** CAS on id+generation+refreshing, never resurrect a revoked family. */
 replaceClaimed(id:string,generation:number,next:StoredPersonSession,admission:()=>void):Promise<boolean>;
 revoke(id:string):Promise<void>;
 /** Revoke by possession of the access digest even while a refresh is claimed.
  * The durable store must include refreshing rows; this is not a live access check. */
 revokeAccess(accessHash:string):Promise<void>;
}
export interface PersonContextAuthority{
 /** Private, live Help Desk relationships, not user_metadata or client grants.
  * If workspace is omitted, resolve ONLY an unambiguous eligible workspace. */
 resolve(identity:ExternalIdentityMatch,workspaceId:string|undefined,signal:AbortSignal):Promise<unknown>;
}
export type OidcProtocol={registration:OidcRegistration;registrationHash:string;authorizationUrl(state:string,nonce:string,verifier:string):string;exchange(code:string,verifier:string,nonce:string,signal:AbortSignal):Promise<OidcExchange>;refresh(refresh:string,nonce:string,subject:string,signal:AbortSignal):Promise<OidcExchange>};
export type GeoLoginOptions={provider:OidcProtocol;flowStore:OwnedLoginFlowStore;sessionStore:PersonSessionStore;identityDirectory:ExternalIdentityDirectory;contextAuthority:PersonContextAuthority;vault:{seal(value:string,aad:string):string;open(value:string,aad:string):string};flowLifetimeSeconds:number;accessLifetimeSeconds:number;sessionLifetimeSeconds:number;allowedReturnPaths:readonly string[];timeoutMs:number;clock?:()=>string};
const fail=(code:string,status=401)=>new HelpdeskError(status,code,'Não foi possível confirmar este acesso. Nenhuma permissão foi ampliada.');
const opaque=()=>randomBytes(32).toString('base64url');
const randomPattern=/^[A-Za-z0-9_-]{43}$/;
const hashPattern=/^[a-f0-9]{64}$/;
const revision=(v:unknown):v is string=>typeof v==='string'&&/^[1-9][0-9]{0,15}$/.test(v)&&Number.isSafeInteger(Number(v));
function plain(value:unknown):unknown{
 let remaining=2000;
 const copy=(v:unknown,depth:number):unknown=>{
  if(--remaining<0||depth>8)throw Error();
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return v;
  if(!v||typeof v!=='object'||types.isProxy(v))throw Error();
  if(Array.isArray(v)){
   if(Object.getPrototypeOf(v)!==Array.prototype||v.length>500||Reflect.ownKeys(v).length!==v.length+1)throw Error();
   return Array.from({length:v.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d||!Object.hasOwn(d,'value'))throw Error();return copy(d.value,depth+1);});
  }
  if(Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)throw Error();
  const out:Record<string,unknown>={};for(const k of Reflect.ownKeys(v)){if(typeof k!=='string'||k==='__proto__')throw Error();const d=Object.getOwnPropertyDescriptor(v,k)!;if(!d.enumerable||!Object.hasOwn(d,'value'))throw Error();out[k]=copy(d.value,depth+1);}return out;
 };return copy(value,0);
}
function fields(input:unknown,names:readonly string[]):Record<string,unknown>{
 const v=plain(input);if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==names.length||Object.keys(v).some(k=>!names.includes(k)))throw Error();return v as Record<string,unknown>;
}
const minimum=(...values:string[])=>values.reduce((a,b)=>compareInstants(a,b)<0?a:b);
function addSeconds(at:string,seconds:number):string{
 const micros=zonedInstantMicros(at)!+BigInt(seconds)*1000000n;
 const ms=micros/1000n,sub=micros%1000n;
 return new Date(Number(ms)).toISOString().slice(0,23)+(sub.toString().padStart(3,'0'))+'Z';
}
/** Optional server composition. There is intentionally no memory store, issuer
 * default, role inferred from claims, runtime activation, migration or network
 * discovery here. PostgreSQL ports and the registration must be qualified first. */
export function createGeoLogin(o:GeoLoginOptions){
 const clock=o.clock??(()=>new Date().toISOString()),provider=o.provider;
 let returns:readonly string[];
 try{
  if(!Number.isInteger(o.flowLifetimeSeconds)||o.flowLifetimeSeconds<30||o.flowLifetimeSeconds>600||!Number.isInteger(o.accessLifetimeSeconds)||o.accessLifetimeSeconds<30||o.accessLifetimeSeconds>600||!Number.isInteger(o.sessionLifetimeSeconds)||o.sessionLifetimeSeconds<o.accessLifetimeSeconds||o.sessionLifetimeSeconds>86400||!Number.isInteger(o.timeoutMs)||o.timeoutMs<1||o.timeoutMs>5000||!hashPattern.test(provider.registrationHash))throw Error();
  returns=Object.freeze([...o.allowedReturnPaths]);if(!returns.length||returns.length>20||new Set(returns).size!==returns.length||returns.some(p=>typeof p!=='string'||!/^\/(?:[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*)?$/.test(p)))throw Error();
  for(const fn of [o.flowStore.put,o.flowStore.take,o.sessionStore.create,o.sessionStore.readAccess,o.sessionStore.claimRefresh,o.sessionStore.replaceClaimed,o.sessionStore.revoke,o.sessionStore.revokeAccess,o.identityDirectory.lookup,o.contextAuthority.resolve,o.vault.open,o.vault.seal])if(typeof fn!=='function')throw Error();
 }catch{throw fail('geo_login_configuration_invalid',500);}
 function operation(signal?:AbortSignal){
  if(signal!==undefined&&!(signal instanceof AbortSignal))throw fail('geo_login_input_invalid',400);
  const controller=new AbortController(),deadline=performance.now()+o.timeoutMs;let previous:bigint|undefined;
  const abort=()=>controller.abort(),timer=setTimeout(abort,o.timeoutMs);signal?.addEventListener('abort',abort,{once:true});
  const check=()=>{if(signal?.aborted)throw fail('geo_login_cancelled',409);if(controller.signal.aborted||performance.now()>=deadline)throw fail('geo_login_unavailable',503);};
  const now=()=>{check();try{const v=clock();if(!isCanonicalInstant(v))throw Error();const n=zonedInstantMicros(v)!;if(previous!==undefined&&n<previous)throw Error();previous=n;return v;}catch(e){if(e instanceof HelpdeskError)throw e;throw fail('geo_login_unavailable',503);}};
  const live=(until:string)=>{if(compareInstants(now(),until)>=0)throw fail('person_session_expired');};
  const bounded=async<T>(work:()=>Promise<T>):Promise<T>=>{
   check();return new Promise<T>((resolve,reject)=>{const cancelled=()=>reject(fail(signal?.aborted?'geo_login_cancelled':'geo_login_unavailable',signal?.aborted?409:503));controller.signal.addEventListener('abort',cancelled,{once:true});
    Promise.resolve().then(()=>{check();return work();}).then(v=>{controller.signal.removeEventListener('abort',cancelled);try{check();resolve(v);}catch(e){reject(e);}},()=>{controller.signal.removeEventListener('abort',cancelled);try{check();}catch(e){reject(e);return;}reject(fail('geo_login_unavailable',503));});});
  };
  return {check,now,live,bounded,signal:controller.signal,close:()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);}};
 }
 function flowRow(input:unknown):OwnedLoginFlow{
  try{const r=fields(input,['id','stateHash','browserHash','registrationHash','returnPath','createdAt','expiresAt','privateEnvelope']);uuidIdentifier(r.id);if(![r.stateHash,r.browserHash,r.registrationHash].every(v=>typeof v==='string'&&hashPattern.test(v))||r.registrationHash!==provider.registrationHash||!returns.includes(r.returnPath as string)||!isCanonicalInstant(r.createdAt)||!isCanonicalInstant(r.expiresAt)||compareInstants(r.createdAt,r.expiresAt)>=0||typeof r.privateEnvelope!=='string')throw Error();return r as OwnedLoginFlow;}catch{throw fail('geo_login_flow_invalid');}
 }
 function sessionRow(input:unknown):StoredPersonSession{
  try{const r=fields(input,['id','principalId','identityId','identityRevision','reference','workspaceId','contextRevision','generation','accessHash','refreshHash','accessExpiresAt','absoluteExpiresAt','registrationHash','privateEnvelope','returnPath','status']);for(const name of ['id','principalId','identityId','workspaceId'])uuidIdentifier(r[name]);parseExternalIdentityRef(r.reference);
   if(!revision(r.identityRevision)||!revision(r.contextRevision)||!Number.isSafeInteger(r.generation)||Number(r.generation)<1||![r.accessHash,r.refreshHash,r.registrationHash].every(v=>typeof v==='string'&&hashPattern.test(v))||r.registrationHash!==provider.registrationHash||!isCanonicalInstant(r.accessExpiresAt)||!isCanonicalInstant(r.absoluteExpiresAt)||compareInstants(r.accessExpiresAt,r.absoluteExpiresAt)>0||typeof r.privateEnvelope!=='string'||!returns.includes(r.returnPath as string)||!['active','refreshing','revoked'].includes(r.status as string))throw Error();
   return r as StoredPersonSession;
  }catch{throw fail('person_session_invalid');}
 }
 const aadFlow=(id:string)=>'flow:'+provider.registrationHash+':'+id;
 const aadSession=(id:string,generation:number)=>'session:'+provider.registrationHash+':'+id+':'+generation;
 const identityResolver=(identity:IdentityObservation)=>createExternalIdentityResolver({namespace:{issuer:provider.registration.issuer,clientId:provider.registration.clientId},verifier:{verify:async()=>identity},directory:o.identityDirectory,timeoutMs:o.timeoutMs,maxObservationAgeMicros:5000000n,clock});
 async function context(match:ExternalIdentityMatch,workspace:string|undefined,op:ReturnType<typeof operation>){
  const raw=await op.bounded(()=>o.contextAuthority.resolve(match,workspace,op.signal));
  try{
   const r=fields(raw,['principal','identityId','identityRevision','revision','asOf','expiresAt']);const p=r.principal as Principal;
   const parsed=validatePrincipal(p,workspace??uuidIdentifier(p.workspaceId),'human');
   if(parsed.id!==match.principalId||r.identityId!==match.identityId||r.identityRevision!==match.identityRevision||!revision(r.revision)||!isCanonicalInstant(r.asOf)||!isCanonicalInstant(r.expiresAt)||compareInstants(r.asOf,op.now())>0||compareInstants(r.asOf,r.expiresAt)>=0)throw Error();op.live(r.expiresAt);
   return {principal:parsed,revision:r.revision,expiresAt:r.expiresAt};
  }catch{throw fail('person_session_context_invalid',403);}
 }
 async function currentIdentity(row:StoredPersonSession,op:ReturnType<typeof operation>){
  // Matching an active local session is the credential; this synthetic observation
  // is NOT a caller token. Its lifetime is bounded by that session family.
  const match=await identityResolver({issuer:row.reference.issuer,subject:row.reference.subject,clientId:provider.registration.clientId,asOf:op.now(),expiresAt:row.absoluteExpiresAt}).resolve(null,{signal:op.signal});
  if(match.principalId!==row.principalId||match.identityId!==row.identityId||match.identityRevision!==row.identityRevision)throw fail('person_session_identity_changed',403);
  return match;
 }
 function credentials(){return {accessToken:'hd_person_'+opaque(),refreshToken:'hd_person_refresh_'+opaque()};}
 function privateData(envelope:string,aad:string):{nonce:string;secrets:OidcSecrets}{
  try{const r=fields(JSON.parse(o.vault.open(envelope,aad)),['nonce','secrets']);const s=fields(r.secrets,['accessToken','refreshToken','accessExpiresAt']);if(typeof r.nonce!=='string'||!randomPattern.test(r.nonce)||typeof s.accessToken!=='string'||!s.accessToken||s.refreshToken!==null&&typeof s.refreshToken!=='string'||!isCanonicalInstant(s.accessExpiresAt))throw Error();return {nonce:r.nonce,secrets:s as OidcSecrets};}catch{throw fail('person_session_invalid');}
 }
 function receipt(row:StoredPersonSession,tokens:ReturnType<typeof credentials>):PersonSessionReceipt{return Object.freeze({principalId:row.principalId,workspaceId:row.workspaceId,...tokens,expiresAt:row.accessExpiresAt,absoluteExpiresAt:row.absoluteExpiresAt,returnPath:row.returnPath});}
 async function beginGeoLogin(returnPath:string,signal?:AbortSignal){
  if(!returns.includes(returnPath))throw fail('geo_login_input_invalid',400);const op=operation(signal);
  try{const createdAt=op.now(),expiresAt=addSeconds(createdAt,o.flowLifetimeSeconds),id=randomUUID(),state=opaque(),browserBinding=opaque(),nonce=opaque(),verifier=opaque();
   const row:OwnedLoginFlow={id,stateHash:secretHash(state),browserHash:secretHash(browserBinding),registrationHash:provider.registrationHash,returnPath,createdAt,expiresAt,privateEnvelope:o.vault.seal(JSON.stringify({nonce,verifier}),aadFlow(id))};
   await op.bounded(()=>o.flowStore.put(row));return Object.freeze({authorizationUrl:provider.authorizationUrl(state,nonce,verifier),browserBinding,expiresAt,returnPath});
  }finally{op.close();}
 }
 async function completeGeoLogin(input:unknown,browserBinding:string,workspaceId?:string,signal?:AbortSignal):Promise<PersonSessionReceipt>{
  const op=operation(signal);let creating=false;
  try{
   let callback:Record<string,unknown>;try{callback=fields(input,['code','state','iss']);if(typeof callback.code!=='string'||!callback.code||callback.code.length>4096||typeof callback.state!=='string'||!randomPattern.test(callback.state)||callback.iss!==provider.registration.issuer||typeof browserBinding!=='string'||!randomPattern.test(browserBinding))throw Error();if(workspaceId!==undefined)workspaceId=uuidIdentifier(workspaceId);}catch{throw fail('geo_login_flow_invalid');}
   const row=flowRow(await op.bounded(()=>o.flowStore.take(secretHash(callback.state as string),secretHash(browserBinding))));
   if(row.stateHash!==secretHash(callback.state as string)||row.browserHash!==secretHash(browserBinding)||compareInstants(row.createdAt,op.now())>0)throw fail('geo_login_flow_invalid');op.live(row.expiresAt);
   let secret:Record<string,unknown>;try{secret=fields(JSON.parse(o.vault.open(row.privateEnvelope,aadFlow(row.id))),['nonce','verifier']);if(![secret.nonce,secret.verifier].every(v=>typeof v==='string'&&randomPattern.test(v)))throw Error();}catch{throw fail('geo_login_flow_invalid');}
   const exchange=await provider.exchange(callback.code as string,secret.verifier as string,secret.nonce as string,op.signal);op.live(row.expiresAt);
   const observed=parseIdentityObservation(exchange.identity),match=await identityResolver(observed).resolve(null,{signal:op.signal}),ctx=await context(match,workspaceId,op);
   const at=op.now(),absoluteExpiresAt=addSeconds(at,o.sessionLifetimeSeconds),tokens=credentials(),id=randomUUID();
   const session:StoredPersonSession={id,principalId:match.principalId,identityId:match.identityId,identityRevision:match.identityRevision,reference:match.reference,workspaceId:ctx.principal.workspaceId,contextRevision:ctx.revision,generation:1,accessHash:secretHash(tokens.accessToken),refreshHash:secretHash(tokens.refreshToken),accessExpiresAt:minimum(addSeconds(at,o.accessLifetimeSeconds),observed.expiresAt,exchange.secrets.accessExpiresAt,ctx.expiresAt,absoluteExpiresAt),absoluteExpiresAt,registrationHash:provider.registrationHash,privateEnvelope:o.vault.seal(JSON.stringify({nonce:secret.nonce,secrets:exchange.secrets}),aadSession(id,1)),returnPath:row.returnPath,status:'active'};
   const admit=()=>{op.live(row.expiresAt);op.live(session.accessExpiresAt);};admit();creating=true;
   await o.sessionStore.create(session,admit);return receipt(session,tokens);
  }catch(e){if(creating)throw fail('person_session_outcome_unknown',503);if(e instanceof HelpdeskError)throw e;throw fail('geo_login_unavailable',503);}finally{op.close();}
 }
 async function authenticatePersonSession(token:string,workspaceId:string,signal?:AbortSignal):Promise<Principal>{
  const op=operation(signal);
  try{
   if(typeof token!=='string'||!/^hd_person_[A-Za-z0-9_-]{43}$/.test(token))throw fail('person_session_invalid');workspaceId=uuidIdentifier(workspaceId);
   const row=sessionRow(await op.bounded(()=>o.sessionStore.readAccess(secretHash(token))));if(row.status!=='active'||row.workspaceId!==workspaceId||row.accessHash!==secretHash(token))throw fail('person_session_invalid');op.live(row.accessExpiresAt);op.live(row.absoluteExpiresAt);
   const match=await currentIdentity(row,op),ctx=await context(match,workspaceId,op);if(ctx.revision!==row.contextRevision)throw fail('person_session_context_changed',403);
   const latest=sessionRow(await op.bounded(()=>o.sessionStore.readAccess(secretHash(token))));
   if(latest.status!=='active'||latest.id!==row.id||latest.generation!==row.generation||latest.accessHash!==row.accessHash||latest.contextRevision!==row.contextRevision||latest.identityRevision!==row.identityRevision||latest.workspaceId!==row.workspaceId||latest.principalId!==row.principalId)throw fail('person_session_revoked');
   op.live(row.accessExpiresAt);return ctx.principal;
  }catch(e){if(e instanceof HelpdeskError)throw e;throw fail('person_session_invalid');}finally{op.close();}
 }
 async function rotatePersonSession(token:string,signal?:AbortSignal):Promise<PersonSessionReceipt>{
  const op=operation(signal);let claimed:StoredPersonSession|undefined,committing=false;
  try{
   if(typeof token!=='string'||!/^hd_person_refresh_[A-Za-z0-9_-]{43}$/.test(token))throw fail('person_session_invalid');
   const row=sessionRow(await op.bounded(()=>o.sessionStore.claimRefresh(secretHash(token),op.now())));if(row.status!=='refreshing'||row.refreshHash!==secretHash(token))throw fail('person_session_invalid');claimed=row;op.live(row.absoluteExpiresAt);
   const oldMatch=await currentIdentity(row,op),oldContext=await context(oldMatch,row.workspaceId,op);if(oldContext.revision!==row.contextRevision)throw fail('person_session_context_changed',403);
   const old=privateData(row.privateEnvelope,aadSession(row.id,row.generation));if(!old.secrets.refreshToken)throw fail('person_session_refresh_unavailable',403);
   const exchanged=await provider.refresh(old.secrets.refreshToken,old.nonce,row.reference.subject,op.signal);op.live(row.absoluteExpiresAt);
   const identity=parseIdentityObservation(exchanged.identity),match=await identityResolver(identity).resolve(null,{signal:op.signal});if(match.identityId!==row.identityId||match.identityRevision!==row.identityRevision||match.principalId!==row.principalId||match.reference.subject!==row.reference.subject||match.reference.issuer!==row.reference.issuer)throw fail('person_session_identity_changed',403);
   const ctx=await context(match,row.workspaceId,op);if(ctx.revision!==row.contextRevision)throw fail('person_session_context_changed',403);
   const generation=row.generation+1;if(!Number.isSafeInteger(generation))throw fail('person_session_invalid');const tokens=credentials(),at=op.now();
   const next:StoredPersonSession={...row,generation,accessHash:secretHash(tokens.accessToken),refreshHash:secretHash(tokens.refreshToken),accessExpiresAt:minimum(addSeconds(at,o.accessLifetimeSeconds),identity.expiresAt,exchanged.secrets.accessExpiresAt,ctx.expiresAt,row.absoluteExpiresAt),privateEnvelope:o.vault.seal(JSON.stringify({nonce:old.nonce,secrets:exchanged.secrets}),aadSession(row.id,generation)),status:'active'};
   const admit=()=>{op.live(next.accessExpiresAt);op.live(row.absoluteExpiresAt);};admit();committing=true;
   const replaced=await o.sessionStore.replaceClaimed(row.id,row.generation,next,admit);if(!replaced){committing=false;throw fail('person_session_revoked');}return receipt(next,tokens);
  }catch(e){if(committing)throw fail('person_session_outcome_unknown',503);if(claimed){try{await o.sessionStore.revoke(claimed.id);}catch{/* remain fail-closed; no success or global-revocation claim */}}
   if(e instanceof HelpdeskError)throw e;throw fail('person_session_invalid');
  }finally{op.close();}
 }
 async function logoutPersonSession(token:string):Promise<void>{
  if(typeof token!=='string'||!/^hd_person_[A-Za-z0-9_-]{43}$/.test(token))throw fail('person_session_invalid');
  try{await o.sessionStore.revokeAccess(secretHash(token));}catch{throw fail('person_session_logout_unknown',503);}
 }
 return Object.freeze({beginGeoLogin,completeGeoLogin,authenticatePersonSession,rotatePersonSession,logoutPersonSession});
}
