import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthentication} from '../src/infrastructure/authentication.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';
import {secretHash} from '../src/domain/canonical.ts';
const workspace='10000000-0000-4000-8000-000000000001';
const at=new Date('2026-09-16T12:00:00.000Z');
const key='hd_key_'+'a'.repeat(43),token='hd_session_'+'b'.repeat(43);
const config={supabaseUrl:'https://project.supabase.co',publishableKey:'sb_publishable_test'};
function setup(result:unknown){
 const calls:{sql:string;values:unknown[]}[]=[];
 const pool:SqlPool={query:async(sql,values=[])=>{calls.push({sql,values});return {rows:[{result}],rowCount:1,command:'SELECT'};},connect:async()=>{throw Error('not used');},end:async()=>{}};
 // Fourth optional argument is the deterministic clock; older implementation ignores it.
 const auth=(createAuthentication as (...args:unknown[])=>ReturnType<typeof createAuthentication>)(pool,config,undefined,()=>at);
 return {auth,calls};
}
for(const [label,result] of Object.entries({
 missing_workspace:{expiresAt:'2026-09-16T12:05:00Z'},
 bad_workspace:{workspaceId:'../another',expiresAt:'2026-09-16T12:05:00Z'},
 alias_instead_of_uuid:{workspaceId:'workspace-a',expiresAt:'2026-09-16T12:05:00Z'},
 missing_expiry:{workspaceId:workspace},
 expired:{workspaceId:workspace,expiresAt:'2026-09-16T11:59:59Z'},
 zero_lifetime:{workspaceId:workspace,expiresAt:at.toISOString()},
 oversized_lifetime:{workspaceId:workspace,expiresAt:'2026-09-16T12:10:00.001Z'},
 ambiguous_date:{workspaceId:workspace,expiresAt:'2026-09-16 12:05:00'},
 invalid_date:{workspaceId:workspace,expiresAt:'not-a-date'},
 array:[{workspaceId:workspace,expiresAt:'2026-09-16T12:05:00Z'}],
 primitive:'sensitive-record'
}))test(`M2M exchange rejects private SQL result: ${label}`,async()=>{
 await assert.rejects(()=>setup(result).auth.exchangeToken(key),{status:503,code:'invalid_session_result'});
});
test('valid short session is projected canonically and does not expose extra private fields',async()=>{
 const {auth,calls}=setup({workspaceId:workspace.toUpperCase(),expiresAt:'2026-09-16T12:10:00+00:00',credential_hash:'secret',internal:{key:'secret'}});
 const result=await auth.exchangeToken(key);
 assert.equal(result.workspace_id,workspace);assert.equal(result.expires_at,'2026-09-16T12:10:00.000Z');
 assert.match(result.access_token,/^hd_session_[a-zA-Z0-9_-]{43}$/);assert.doesNotMatch(JSON.stringify(result),/secret|internal|credential_hash/);
 assert.equal(calls.length,1);assert.equal(calls[0]?.values[0],secretHash(key));assert.equal(calls[0]?.values[1],secretHash(result.access_token));
});
test('revoked credentials still return 401 rather than a malformed-result error',async()=>{
 await assert.rejects(()=>setup(null).auth.exchangeToken(key),{status:401});
});
function revoker(auth:ReturnType<typeof createAuthentication>){
 const revoke=(auth as unknown as Record<string,unknown>).revokeSession;
 assert.equal(typeof revoke,'function','short sessions must support explicit self-revocation');
 return revoke as (token:string)=>Promise<void>;
}
test('self-revocation sends only the session digest, never a bearer or another selector',async()=>{
 const {auth,calls}=setup(true);await revoker(auth)(token);
 assert.equal(calls.length,1);assert.match(calls[0]!.sql,/revoke_session\(\$1\)/);
 assert.deepEqual(calls[0]!.values,[secretHash(token)]);assert.doesNotMatch(JSON.stringify(calls),/hd_session_|hd_key_/);
});
for(const value of [key,'user.jwt','hd_session_x','',token+' extra'])test(`self-revocation rejects unsupported bearer ${value.slice(0,12)}`,async()=>{
 const {auth,calls}=setup(true);await assert.rejects(()=>revoker(auth)(value),{status:401});assert.equal(calls.length,0);
});
test('self-revocation does not report completion for an incompatible private response',async()=>{
 await assert.rejects(()=>revoker(setup({deleted:true}).auth)(token),{status:503,code:'invalid_session_result'});
});
function handler(overrides:Record<string,unknown>={}){
 return createHttpHandler({service:new HelpdeskService(new MemoryUnitOfWork()),authenticate:async()=>{throw Error('self-revocation must not require a current grant');},...overrides});
}
test('DELETE current session returns empty 204 on repeated revocation without workspace or grants',async()=>{
 let n=0;const handle=handler({revokeSession:async(value:string)=>{assert.equal(value,token);n++;}});
 for(let i=0;i<2;i++){
  const res=await handle(new Request('https://hd.test/v1/integration-tokens/current',{method:'DELETE',headers:{authorization:'Bearer '+token}}));
  assert.equal(res.status,204);assert.equal(await res.text(),'');assert.equal(res.headers.get('cache-control'),'no-store');
 }
 assert.equal(n,2);
});
test('self-revocation remains behind the trusted-IP ingress limiter',async()=>{
 let revoked=false;const handle=handler({revokeSession:async()=>{revoked=true;},rateLimiter:{beforeAuthentication:async()=>{throw Object.assign(Error('limit'),{code:'PHD01'});}}});
 const res=await handle(new Request('https://hd.test/v1/integration-tokens/current',{method:'DELETE',headers:{authorization:'Bearer '+token}}));
 assert.equal(res.status,429);assert.equal(revoked,false);
});
test('missing revocation backend is not silently reported as a successful logout',async()=>{
 const res=await handler()(new Request('https://hd.test/v1/integration-tokens/current',{method:'DELETE',headers:{authorization:'Bearer '+token}}));
 assert.equal(res.status,503);assert.equal((await res.json()).code,'feature_not_configured');
});
for(const suffix of ['?token=other','?workspace_id=other'])test(`self-revocation rejects a selector in query ${suffix}`,async()=>{
 let n=0;const res=await handler({revokeSession:async()=>{n++;}})(new Request('https://hd.test/v1/integration-tokens/current'+suffix,{method:'DELETE',headers:{authorization:'Bearer '+token}}));
 assert.equal(res.status,400);assert.equal(n,0);
});
test('self-revocation rejects a body requesting another session',async()=>{
 let n=0;const res=await handler({revokeSession:async()=>{n++;}})(new Request('https://hd.test/v1/integration-tokens/current',{method:'DELETE',body:'{"session":"other"}',headers:{authorization:'Bearer '+token}}));
 assert.equal(res.status,400);assert.equal(n,0);
});

test('session expiry is checked after the database wait, not before it',async()=>{
 let current=at;
 const pool:SqlPool={query:async()=>{current=new Date('2026-09-16T12:11:00Z');return {rows:[{result:{workspaceId:workspace,expiresAt:'2026-09-16T12:10:00Z'}}],rowCount:1};},connect:async()=>{throw Error('unused');},end:async()=>{}};
 const auth=createAuthentication(pool,config,undefined,()=>current);
 await assert.rejects(()=>auth.exchangeToken(key),{code:'invalid_session_result'});
});
test('DELETE current rejects a human bearer before querying the revocation adapter',async()=>{
 let called=false;
 const response=await handler({revokeSession:async()=>{called=true;}})(new Request('https://hd.test/v1/integration-tokens/current',{method:'DELETE',headers:{authorization:'Bearer human.jwt'}}));
 assert.equal(response.status,401);assert.equal(called,false);
});
test('self-revocation database outage is not reported as logout and does not leak details',async()=>{
 const response=await handler({revokeSession:async()=>{throw Object.assign(Error('DATABASE-PASSWORD internal-host'),{code:'ECONNRESET'});}})(new Request('https://hd.test/v1/integration-tokens/current',{method:'DELETE',headers:{authorization:'Bearer '+token}}));
 assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/DATABASE-PASSWORD|internal-host/);
});
test('self-revocation route does not accept POST as an implicit mutation alias',async()=>{
 let called=false;
 const response=await handler({revokeSession:async()=>{called=true;}})(new Request('https://hd.test/v1/integration-tokens/current',{method:'POST',headers:{authorization:'Bearer '+token}}));
 assert.equal(response.status,405);assert.equal(called,false);
});
test('capability negotiation disables session termination when its adapter is absent',async()=>{
 const res=await handler()(new Request('https://hd.test/v1/capabilities'));
 assert.equal((await res.json()).capabilities.integration_session_revocation,false);
});
test('capability negotiation advertises session termination only with the adapter',async()=>{
 const res=await handler({revokeSession:async()=>{}})(new Request('https://hd.test/v1/capabilities'));
 assert.equal((await res.json()).capabilities.integration_session_revocation,true);
});

test('empty transport stream is accepted as no body for self-revocation',async()=>{
 let called=false;const body=new ReadableStream({start(controller){controller.close();}});
 const req=new Request('https://hd.test/v1/integration-tokens/current',{method:'DELETE',headers:{authorization:'Bearer '+token,'content-length':'0'},body,duplex:'half'} as RequestInit);
 const response=await handler({revokeSession:async()=>{called=true;}})(req);
 assert.equal(response.status,204);assert.equal(called,true);
});
