import test from 'node:test';
import assert from 'node:assert/strict';
import {createHttpHandler} from '../src/http/handler.ts';
import type {HelpdeskService} from '../src/application/helpdesk.ts';
import {HelpdeskError} from '../src/domain/errors.ts';
import {principal} from './fixtures.ts';
import {createHostedRuntime} from '../src/infrastructure/runtime.ts';

function fixture(){
 let authenticated=0,exchanged=0,revoked=0,ingress=0,budget=0;
 const actor=principal({workspaceRole:'admin',scopes:['contexts:resolve','tickets:read']});
 const handler=createHttpHandler({authenticationOnly:true,
  service:new Proxy({} as HelpdeskService,{get(){throw Error('Business dispatch forbidden');}}),
  authenticate:async request=>{authenticated++;if(request.headers.get('authorization')!=='Bearer valid')throw new HelpdeskError(401,'unauthorized','Identidade inválida.');return actor;},
  exchangeToken:async()=>{exchanged++;return {access_token:'fixture'};},revokeSession:async()=>{revoked++;},
  publicConfig:{supabaseUrl:'https://project.supabase.co',publishableKey:'sb_publishable_fixture'},
  rateLimiter:{beforeAuthentication:async()=>{ingress++;},afterAuthentication:async()=>{budget++;}}
 });
 return {handler,actor,counts:()=>({authenticated,exchanged,revoked,ingress,budget})};
}
for(const [method,path] of [
 ['GET','/tickets'],['POST','/tickets'],['GET','/tickets/id'],['PATCH','/tickets/id'],
 ['GET','/tickets/id/messages'],['POST','/tickets/id/messages'],['GET','/tickets/id/notes'],
 ['POST','/tickets/id/notes'],['GET','/tickets/id/timeline'],['POST','/tickets/id/assignments'],
 ['POST','/tickets/id/transitions'],['GET','/support-contexts'],['POST','/contexts/resolve'],
 ['GET','/tickets/?operational=true'],['POST','/me'],['GET','/integration-tokens/current'],
 ['GET','/unknown'],['GET','/me/extra'],['GET','/me//']
])test(`authentication-only denies ${method} ${path} before identity or domain dispatch`,async()=>{
 const f=fixture();const r=await f.handler(new Request('https://desk.example/v1'+path,{method,headers:{authorization:'Bearer valid','x-release-approved':'true'}}));
 assert.equal(r.status,503);assert.equal((await r.json()).code,'release_gate_closed');
 assert.deepEqual(f.counts(),{authenticated:0,exchanged:0,revoked:0,ingress:1,budget:0});
});
test('authentication-only exposes readiness and no business capabilities',async()=>{
 const f=fixture();const config=await (await f.handler(new Request('https://desk.example/v1/public-config'))).json();
 assert.deepEqual(config,{supabase_url:'https://project.supabase.co',publishable_key:'sb_publishable_fixture',operational:false});
 const caps=await (await f.handler(new Request('https://desk.example/v1/capabilities'))).json();
 assert.equal(caps.operational,false);assert.equal(caps.capabilities.integration_session_revocation,true);
 assert.ok(Object.entries(caps.capabilities).every(([key,value])=>key==='integration_session_revocation'||value===false));
});
test('authentication-only /me preserves live scopes and requires authentication',async()=>{
 const f=fixture();assert.equal((await f.handler(new Request('https://desk.example/v1/me'))).status,401);
 const r=await f.handler(new Request('https://desk.example/v1/me/',{headers:{authorization:'Bearer valid'}}));
 assert.equal(r.status,200);const body=await r.json();assert.equal(body.workspace_role,'admin');assert.deepEqual(body.scopes,f.actor.scopes);
 assert.equal(f.counts().budget,1);
});
test('authentication-only keeps existing integration session exchange and revocation validation',async()=>{
 const f=fixture();assert.equal((await f.handler(new Request('https://desk.example/v1/integration-tokens',{method:'POST'}))).status,401);
 assert.equal((await f.handler(new Request('https://desk.example/v1/integration-tokens',{method:'POST',headers:{authorization:'Bearer hd_key_'+'a'.repeat(43)}}))).status,201);
 const url='https://desk.example/v1/integration-tokens/current';const headers={authorization:'Bearer hd_session_'+'a'.repeat(43)};
 assert.equal((await f.handler(new Request(url+'?token=other',{method:'DELETE',headers}))).status,400);
 assert.equal((await f.handler(new Request(url,{method:'DELETE',headers,body:'{}'}))).status,400);
 assert.equal((await f.handler(new Request(url,{method:'DELETE',headers}))).status,204);
 assert.equal(f.counts().exchanged,1);assert.equal(f.counts().revoked,1);
});
test('authentication-only fails closed when the distributed ingress budget fails',async()=>{
 const handler=createHttpHandler({authenticationOnly:true,service:{} as HelpdeskService,authenticate:async()=>{throw Error('must not authenticate');},
  rateLimiter:{beforeAuthentication:async()=>{throw new HelpdeskError(503,'rate_limit_unavailable','Limite indisponível.');},afterAuthentication:async()=>{}}});
 assert.equal((await handler(new Request('https://desk.example/v1/public-config'))).status,503);
});
for(const releaseApproved of [undefined,'false','TRUE','1','true'])test(`hosted startup still validates restricted backend with release ${releaseApproved}`,async()=>{
 await assert.rejects(createHostedRuntime({releaseApproved,databaseUrl:'postgresql://postgres:private@invalid/db',
  supabaseUrl:'https://project.supabase.co',publishableKey:'sb_publishable_fixture',rateLimitHmacKey:'a'.repeat(43)}),
  (error:unknown)=>error instanceof HelpdeskError&&error.status===503&&error.code==='unsafe_database_configuration'&&!error.message.includes('private'));
});
