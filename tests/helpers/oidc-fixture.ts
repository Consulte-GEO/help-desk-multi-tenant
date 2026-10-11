import {generateKeyPairSync,sign,randomBytes} from 'node:crypto';
import {createOidcProtocolClient} from '../../src/infrastructure/oidc-client.ts';
import {createOidcTokenVault} from '../../src/infrastructure/oidc-token-vault.ts';
import {id} from './member-admin-fixture.ts';
export {id};
/** Test-only IdP transport and durable-store model. RSA verification is real. */
export function oidcFixture(){
 let at='2026-10-09T12:00:00.123Z',nonce='';
 const pair=generateKeyPairSync('rsa',{modulusLength:2048}),pub={...pair.publicKey.export({format:'jwk'}),kid:'key1',alg:'RS256'};
 const registration={issuer:'https://identity.example.invalid/realm',clientId:'helpdesk-test',authorizationEndpoint:'https://identity.example.invalid/authorize',tokenEndpoint:'https://identity.example.invalid/token',jwksUri:'https://identity.example.invalid/keys',redirectUri:'https://helpdesk.example.test/auth/geo/callback',scopes:['openid','source:read']};
 const calls={exchange:0,refresh:0,directory:0,context:0,issued:0,rotated:0};
 const controls:any={active:true,contextRevision:'1',identityRevision:'1',loseIssue:false,loseRotate:false,extraIdentity:false,wrongSubject:false,wrongIssuer:false,afterExchange:()=>{},beforeSessionCommit:()=>{},beforeRotate:()=>{},afterRead:()=>{}};
 const jwt=(isRefresh:boolean)=>{const h=Buffer.from(JSON.stringify({alg:'RS256',kid:'key1'})).toString('base64url'),c=Buffer.from(JSON.stringify({iss:controls.wrongIssuer?'https://foreign.invalid':registration.issuer,sub:controls.wrongSubject?'another':'0001',aud:registration.clientId,...(!isRefresh?{nonce}:{}),iat:Math.floor(Date.parse(at)/1000)-1,exp:Math.floor(Date.parse(at)/1000)+600})).toString('base64url');return h+'.'+c+'.'+sign('RSA-SHA256',Buffer.from(h+'.'+c),pair.privateKey).toString('base64url');};
 const provider=createOidcProtocolClient({registration,clientSecret:()=> 'synthetic-only',clock:()=>at,fetcher:async(url,options)=>{
  if(String(url)===registration.jwksUri)return Response.json({keys:[pub]});const form=new URLSearchParams(String(options?.body)),refresh=form.get('grant_type')==='refresh_token';if(refresh)calls.refresh++;else calls.exchange++;controls.afterExchange();
  return Response.json({access_token:'delegated-secret-access',refresh_token:'delegated-secret-refresh',token_type:'Bearer',expires_in:600,id_token:jwt(refresh)});
 }});
 const flows=new Map<string,any>();
 const flowStore={put:async(flow:any)=>{flows.set(flow.stateHash,structuredClone(flow));},take:async(hash:string,browserHash:string)=>{const row=flows.get(hash);if(!row||row.browserHash!==browserHash)return null;flows.delete(hash);return structuredClone(row);}};
 const sessions=new Map<string,any>();
 const sessionStore={
  create:async(row:any,admission:()=>void)=>{controls.beforeSessionCommit();admission();if(sessions.has(row.id))throw Error('duplicate');sessions.set(row.id,structuredClone(row));calls.issued++;if(controls.loseIssue){controls.loseIssue=false;throw Error('private lost commit');}},
  readAccess:async(hash:string)=>{const row=[...sessions.values()].find(r=>r.accessHash===hash&&r.status==='active');controls.afterRead();return row?structuredClone(row):null;},
  claimRefresh:async(hash:string,at:string)=>{const row=[...sessions.values()].find(r=>r.refreshHash===hash&&r.status==='active'&&r.absoluteExpiresAt>at);if(!row)return null;row.status='refreshing';return structuredClone(row);},
  replaceClaimed:async(id:string,generation:number,row:any,admission:()=>void)=>{controls.beforeRotate();admission();const old=sessions.get(id);if(!old||old.status!=='refreshing'||old.generation!==generation)return false;sessions.set(id,structuredClone(row));calls.rotated++;if(controls.loseRotate){controls.loseRotate=false;throw Error('private lost commit');}return true;},
  revoke:async(id:string)=>{const row=sessions.get(id);if(row)row.status='revoked';},
  revokeAccess:async(hash:string)=>{for(const row of sessions.values())if(row.accessHash===hash)row.status='revoked';}
 };
 const identityDirectory={lookup:async(ref:any)=>{calls.directory++;const one={principalId:id(2),principalKind:'human',revision:controls.identityRevision,active:controls.active,principalActive:true,origin:{kind:'external',identityId:id(8),issuer:registration.issuer,subject:'0001'}};return controls.extraIdentity?[one,one]:[one];}};
 const contextAuthority={resolve:async(match:any,workspaceId:string|undefined)=>{calls.context++;if(!controls.active||workspaceId!==undefined&&workspaceId!==id(1))return null;return {principal:{id:id(2),kind:'human',workspaceId:id(1),workspaceRole:null,grants:[{accountId:id(5),role:'requester'}],scopes:['contexts:resolve','tickets:read']},identityId:id(8),identityRevision:controls.identityRevision,revision:controls.contextRevision,asOf:at,expiresAt:new Date(Date.parse(at)+600000).toISOString()};}};
 return {provider,flowStore,sessionStore,identityDirectory,contextAuthority,vault:createOidcTokenVault(randomBytes(32)),flows,sessions,calls,controls,clock:()=>at,setTime:(value:string)=>{at=value;},setNonce:(url:string)=>{nonce=new URL(url).searchParams.get('nonce')!;},registration};
}
