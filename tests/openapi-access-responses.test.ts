/** Owned synthetic SQL/Auth responses over the real access adapters. No network or credentials. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createOpenApiResponseValidator} from '../scripts/openapi-response.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {createAuthentication} from '../src/infrastructure/authentication.ts';
import {createConsulteGeoRuntimeHandlers} from '../src/infrastructure/consultegeo-runtime.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';
import type {HelpdeskService} from '../src/application/helpdesk.ts';
import {HelpdeskError} from '../src/domain/errors.ts';
import {secretHash} from '../src/domain/canonical.ts';
const gate=readFile(new URL('../docs/openapi.json',import.meta.url),'utf8').then(JSON.parse).then(createOpenApiResponseValidator);
const id=(n:number)=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0'),origin='https://helpdesk.example.test',at='2026-10-17T17:00:00.000Z';
const key='hd_key_'+'a'.repeat(43),session='hd_session_'+'b'.repeat(43),human='synthetic.human.fixture',correlation=id(99);
const catalog=[{id:id(2),name:'Workspace sintético'}];
type Options={catalog?:unknown;exchange?:unknown;revoke?:unknown;providerStatus?:number;databaseError?:string;limited?:boolean;composed?:boolean;authenticationOnly?:boolean};
function fixture(o:Options={}){
 const calls:{sql:string;values:unknown[]}[]=[];let identities=0;
 const pool={query:async(sql:string,values:unknown[]=[])=>{calls.push({sql,values});if(o.databaseError)throw Object.assign(Error('PRIVATE_DATABASE_SENTINEL'),{code:o.databaseError});
  if(sql.includes('list_human_workspaces'))return {rows:[{workspaces:Object.hasOwn(o,'catalog')?o.catalog:catalog}],rowCount:1};
  if(sql.includes('exchange_key'))return {rows:[{result:Object.hasOwn(o,'exchange')?o.exchange:{workspaceId:id(2),expiresAt:'2026-10-17T17:05:00.000Z',private:'PRIVATE_SQL_SENTINEL'}}],rowCount:1};
  if(sql.includes('revoke_session'))return {rows:[{result:Object.hasOwn(o,'revoke')?o.revoke:true}],rowCount:1};
  throw Error('Unexpected SQL');},connect:async()=>{throw Error('No domain connection');},end:async()=>{}} as unknown as SqlPool;
 const auth=createAuthentication(pool,{supabaseUrl:'https://synthetic.supabase.co',publishableKey:'sb_publishable_fixture'},async()=>{identities++;return new Response(JSON.stringify({id:id(1),user_metadata:{role:'admin',workspace_id:'PRIVATE_METADATA_SENTINEL'}}),{status:o.providerStatus??200,headers:{'content-type':'application/json'}});},()=>new Date(at));
 const rateLimiter={beforeAuthentication:async()=>{if(o.limited)throw Object.assign(new HelpdeskError(429,'rate_limit_exceeded','Limite temporário.'),{retryAfterSeconds:7});},afterAuthentication:async()=>{throw Error('No selected-workspace authority required by these routes');}};
 const legacy=createHttpHandler({...auth,rateLimiter,authenticationOnly:o.authenticationOnly,service:new Proxy({} as HelpdeskService,{get(){throw Error('No business dispatch');}})});
 const handler=o.composed?createConsulteGeoRuntimeHandlers({pool,origin,authentication:auth,rateLimiter,flags:{business:()=>false,workflow:()=>false,administration:()=>false},legacy}):legacy;
 return {handler,calls,identities:()=>identities};
}
function request(path:string,method='GET',token:string|null=human,body?:string){return new Request(origin+'/v1'+path,{method,headers:{'x-request-id':correlation,'x-workspace-id':'untrusted-selector',...(token?{authorization:'Bearer '+token}:{}),'content-type':'application/json'},...(body===undefined?{}:{body})});}
const operations=[['/workspaces','GET',human],['/integration-tokens','POST',key],['/integration-tokens/current','DELETE',session]] as const;
async function conform(path:string,method:string,r:Response,status:number){assert.equal(r.status,status);await(await gate)(path,method,r);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.equal(r.headers.get('referrer-policy'),'no-referrer');assert.equal(r.headers.get('x-request-id'),correlation);if(status!==204){const b=await r.clone().json();if(status>=400){assert.equal(b.request_id,correlation);assert.doesNotMatch(JSON.stringify(b),/PRIVATE_|hd_key_|hd_session_/);}return b;}assert.equal(await r.clone().text(),'');}

test('OpenAPI access: real discovery projects empty, populated and50-row catalogs without adopting metadata or workspace header',async()=>{
 for(const composed of [false,true])for(const rows of [[],catalog,Array.from({length:50},(_,i)=>({id:id(i+10),name:'Workspace '+i}))]){const f=fixture({catalog:rows,composed,authenticationOnly:true});const b=await conform('/workspaces','GET',await f.handler(request('/workspaces')),200);assert.deepEqual(b,{items:rows});assert.equal(f.identities(),1);assert.deepEqual(f.calls.map(c=>c.values),[[id(1)]]);}
});
test('OpenAPI access: invalid/oversized private catalogs fail atomically without a partial listing',async()=>{
 for(const rows of [null,{},[...catalog,...catalog],[{...catalog[0],private:'PRIVATE_SQL_SENTINEL'}],Array.from({length:51},(_,i)=>({id:id(i+10),name:'Workspace '+i}))]){const f=fixture({catalog:rows});const b=await conform('/workspaces','GET',await f.handler(request('/workspaces')),503);assert.equal(b.code,'invalid_workspace_catalog');assert.equal(f.calls.length,1);assert.equal(Object.hasOwn(b,'items'),false);}
});
test('OpenAPI access: discovery refuses machine/missing/rejected human identity before private SQL',async()=>{
 for(const token of [null,key,session]){const f=fixture();await conform('/workspaces','GET',await f.handler(request('/workspaces','GET',token)),401);assert.equal(f.identities(),0);assert.equal(f.calls.length,0);}
 for(const status of [401,429,503]){const f=fixture({providerStatus:status});await conform('/workspaces','GET',await f.handler(request('/workspaces')),status===401?401:503);assert.equal(f.calls.length,0);}
 const f=fixture();await conform('/workspaces','GET',await f.handler(request('/workspaces?user_id='+id(1))),400);assert.equal(f.identities(),0);assert.equal(f.calls.length,0);
});
test('OpenAPI access: real exchange emits only a canonical short session and hashes both SQL arguments',async()=>{
 for(const composed of [false,true]){const f=fixture({composed,authenticationOnly:true}),b=await conform('/integration-tokens','POST',await f.handler(request('/integration-tokens','POST',key)),201);assert.deepEqual(Object.keys(b).sort(),['access_token','expires_at','token_type','workspace_id']);assert.equal(b.workspace_id,id(2));assert.equal(b.expires_at,'2026-10-17T17:05:00.000Z');assert.equal(b.token_type,'Bearer');assert.match(b.access_token,/^hd_session_[A-Za-z0-9_-]{43}$/);assert.deepEqual(f.calls.map(c=>c.values),[[secretHash(key),secretHash(b.access_token)]]);assert.equal(f.identities(),0);assert.doesNotMatch(JSON.stringify(f.calls),/hd_key_|hd_session_|PRIVATE_/);}
});
test('OpenAPI access: malformed/revoked credentials and invalid private expiry cannot confirm exchange',async()=>{
 for(const token of [null,human,session,'hd_key_bad']){const f=fixture();await conform('/integration-tokens','POST',await f.handler(request('/integration-tokens','POST',token)),401);assert.equal(f.calls.length,0);}
 for(const value of [null,{workspaceId:id(2),expiresAt:at},{workspaceId:id(2),expiresAt:'PRIVATE_EXPIRY_SENTINEL'}]){const f=fixture({exchange:value});await conform('/integration-tokens','POST',await f.handler(request('/integration-tokens','POST',key)),value===null?401:503);assert.equal(f.calls.length,1);}
});
test('OpenAPI access: current session revocation remains empty204/idempotent without human or membership lookup',async()=>{
 for(const composed of [false,true]){const f=fixture({composed,authenticationOnly:true});for(let n=0;n<2;n++)await conform('/integration-tokens/current','DELETE',await f.handler(request('/integration-tokens/current','DELETE',session)),204);assert.equal(f.identities(),0);assert.equal(f.calls.length,2);assert(f.calls.every(c=>c.sql.includes('revoke_session')));assert.deepEqual(f.calls.map(c=>c.values),[[secretHash(session)],[secretHash(session)]]);}
});
test('OpenAPI access: revocation selectors, bodies and unsupported bearers cannot dispatch',async()=>{
 for(const [path,token,body,status]of [['/integration-tokens/current?token=other',session,undefined,400],['/integration-tokens/current',session,'{}',400],['/integration-tokens/current',human,undefined,401],['/integration-tokens/current',key,undefined,401]] as const){const f=fixture();await conform('/integration-tokens/current','DELETE',await f.handler(request(path,'DELETE',token,body)),status);assert.equal(f.calls.length,0);assert.equal(f.identities(),0);}
});
test('OpenAPI access: SQL outage/invalid revocation confirmation never becomes logout or leaks provider details',async()=>{
 for(const [path,method,token]of operations){const f=fixture({databaseError:'ECONNRESET'});const r=await f.handler(request(path,method,token));await conform(path,method,r,503);assert.equal(r.headers.get('retry-after'),'2');}
 const f=fixture({revoke:false});await conform('/integration-tokens/current','DELETE',await f.handler(request('/integration-tokens/current','DELETE',session)),503);
});
test('OpenAPI access: distributed ingress rate limit precedes all identity/SQL work',async()=>{
 for(const [path,method,token]of operations){const f=fixture({limited:true}),r=await f.handler(request(path,method,token));await conform(path,method,r,429);assert.equal(r.headers.get('retry-after'),'7');assert.equal(f.identities(),0);assert.equal(f.calls.length,0);}
});
test('OpenAPI access: missing adapters fail503; unexpected failures use safe500 and preserve correlation',async()=>{
 for(const [path,method,token]of operations){for(const broken of [false,true]){const fail=async()=>{throw Error('PRIVATE_CONNECTION_SENTINEL');};const handler=createHttpHandler({service:{} as HelpdeskService,authenticate:fail,...(broken?{discoverWorkspaces:fail,exchangeToken:fail,revokeSession:fail}:{})});await conform(path,method,await handler(request(path,method,token)),broken?500:503);}}
});
test('OpenAPI access gate rejects missing/malformed privacy and correlation headers on success and errors without copying raw values',async()=>{
 const check=await gate;for(const [path,method,token]of operations)for(const opts of [{},{limited:true},{databaseError:'ECONNRESET'}]){const f=fixture(opts),r=await f.handler(request(path,method,token));await check(path,method,r);const bytes=await r.clone().arrayBuffer();
  for(const name of ['cache-control','x-content-type-options','referrer-policy','x-request-id',...([429,503].includes(r.status)?['retry-after']:[])])for(const malformed of [false,true]){const h=new Headers(r.headers);if(malformed)h.set(name,'PRIVATE_INVALID_HEADER_SENTINEL');else h.delete(name);const m=new Response(r.status===204?null:bytes,{status:r.status,headers:h});await assert.rejects(()=>check(path,method,m),(e:Error)=>/response header/i.test(e.message)&&!e.message.includes('PRIVATE_'));}}
});
test('OpenAPI access gate rejects a51-item catalog that would otherwise satisfy the schema',async()=>{
 const f=fixture(),r=await f.handler(request('/workspaces'));await assert.rejects(()=>(gate.then(check=>check('/workspaces','GET',new Response(JSON.stringify({items:Array.from({length:51},(_,i)=>({id:id(i+10),name:'Workspace '+i}))}),{status:200,headers:r.headers})))),/Response body violates contract/);
});
