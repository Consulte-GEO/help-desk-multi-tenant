// Real HTTP sockets exercise our Auth/Storage boundary. These unsigned fixture
// JWTs are accepted only by this fixture, and do not qualify Supabase cloud Auth.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import * as storage from '../../../modules/import-process/storage.ts';
import {id,scope} from './fixtures.mjs';

async function fixture(t){
 const state={now:1800000000000,calls:[],loginStatus:200,userStatus:200,claims:{},user:{},expiresIn:3600,oversize:false,redirect:false};
 let origin;
 const server=http.createServer(async(req,res)=>{
  const body=Buffer.concat(await Array.fromAsync(req));state.calls.push({url:req.url,method:req.method,headers:req.headers,body});
  res.setHeader('content-type','application/json');
  const user={id:id(9),role:'authenticated',app_metadata:{setup_import_inspector:true},...state.user};
  if(req.url==='/auth/v1/token?grant_type=password'){
   if(state.redirect){res.writeHead(302,{location:origin+'/auth/v1/user'});res.end();return;}
   res.statusCode=state.loginStatus;
   const claims={sub:id(9),role:'authenticated',iss:origin+'/auth/v1',exp:Math.floor(state.now/1000)+3600,app_metadata:{setup_import_inspector:true},...state.claims};
   state.token=['e30',Buffer.from(JSON.stringify(claims)).toString('base64url'),'fixture-signature'].join('.');
   res.end(state.oversize?' '.repeat(65537):JSON.stringify({access_token:state.token,token_type:'bearer',expires_in:state.expiresIn,refresh_token:'DO-NOT-PERSIST-OR-SEND',user}));return;
  }
  if(req.url==='/auth/v1/user'){res.statusCode=state.userStatus;res.end(JSON.stringify(user));return;}
  if(req.url==='/storage/v1/bucket/setup-import-artifacts'){res.end(JSON.stringify({id:'setup-import-artifacts',public:false}));return;}
  res.setHeader('etag','"real-bytes-v1"');res.end('%PDF-1.7\nbytes\n%%EOF');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
 const options={supabaseUrl:origin,publishableKey:'sb_publishable_fixture',email:'inspector@example.invalid',password:'fixture-password-32-characters-only',userId:id(9),allowInsecureLocalhost:true,clock:()=>state.now};
 return {state,origin,options,provider:()=>storage.createSupabaseInspectorTokenProvider(options)};
}

test('IMP02 renewable inspector authenticates pinned identity and reads Storage with its real returned bearer',async t=>{
 const x=await fixture(t),provider=x.provider();
 const privateStorage=storage.createSupabaseArtifactStorage({...x.options,accessToken:provider.accessToken});
 const objectKey=[scope.workspaceId,scope.accountId,scope.caseId,id(8)].join('/');
 const result=await privateStorage.read(objectKey);
 assert.equal(new TextDecoder().decode(result.bytes),'%PDF-1.7\nbytes\n%%EOF');
 assert.equal(result.private,true);
 const [login,user,bucket,object]=x.state.calls;
 assert.equal(login.url,'/auth/v1/token?grant_type=password');assert.equal(login.method,'POST');
 assert.deepEqual(JSON.parse(login.body),{email:x.options.email,password:x.options.password});
 assert.equal(login.headers.apikey,'sb_publishable_fixture');assert.equal(login.headers.authorization,undefined);
 for(const call of [user,bucket,object]){
  assert.equal(call.headers.authorization,'Bearer '+x.state.token);
  assert.equal(call.body.includes(x.options.password),false);assert.equal(call.body.includes('DO-NOT-PERSIST'),false);
 }
 assert.equal(user.url,'/auth/v1/user');
 assert.equal(await provider.accessToken(),x.state.token);assert.equal(x.state.calls.length,4);
});

test('IMP02 inspector renewal precedes expiry and concurrent callers share one password grant',async t=>{
 const x=await fixture(t),provider=x.provider();
 const first=await Promise.all(Array.from({length:12},()=>provider.accessToken()));
 assert.equal(new Set(first).size,1);assert.equal(x.state.calls.length,2);
 x.state.now+=3539*1000;assert.equal(await provider.accessToken(),first[0]);assert.equal(x.state.calls.length,2);
 x.state.now+=1000;const renewed=await Promise.all(Array.from({length:12},()=>provider.accessToken()));
 assert.notEqual(renewed[0],first[0]);assert.equal(new Set(renewed).size,1);assert.equal(x.state.calls.length,4);
 assert.equal(x.state.calls.some(c=>c.url.includes('refresh_token')),false);
});

test('IMP02 inspector rejects unprivileged, forged, expired, indefinite or mismatched Auth responses before Storage',async t=>{
 for(const bad of [
  {claims:{role:'service_role'}},{claims:{sub:id(10)}},{claims:{exp:null}},
  {claims:{exp:1800000000}},{claims:{exp:1800086400}},{claims:{iss:'https://other.example/auth/v1'}},
  {claims:{app_metadata:{}}},{claims:{app_metadata:{},user_metadata:{setup_import_inspector:true}}},
  {user:{id:id(10)}},{user:{app_metadata:{}}},{userStatus:401},{expiresIn:0},{expiresIn:86400},
 ])await t.test(JSON.stringify(bad),async t=>{
  const x=await fixture(t);Object.assign(x.state,bad);
  await assert.rejects(()=>x.provider().accessToken(),/INSPECTOR_AUTH_UNAVAILABLE/);
  assert.equal(x.state.calls.some(c=>c.url.startsWith('/storage/')),false);
 });
});

test('IMP02 inspector Auth outage is sanitized, throttled, and recoverable without stale fallback',async t=>{
 const x=await fixture(t),provider=x.provider();await provider.accessToken();
 x.state.now+=3540000;x.state.loginStatus=429;
 await assert.rejects(()=>provider.accessToken(),e=>e.message==='INSPECTOR_AUTH_UNAVAILABLE');
 const calls=x.state.calls.length;
 await assert.rejects(()=>provider.accessToken(),/INSPECTOR_AUTH_UNAVAILABLE/);assert.equal(x.state.calls.length,calls);
 x.state.now+=30000;x.state.loginStatus=200;assert.equal(typeof await provider.accessToken(),'string');assert.equal(x.state.calls.length,calls+2);
});

test('IMP02 inspector Auth rejects redirects and oversized response without forwarding secrets',async t=>{
 for(const setting of ['redirect','oversize'])await t.test(setting,async t=>{
  const x=await fixture(t);x.state[setting]=true;
  await assert.rejects(()=>x.provider().accessToken(),e=>e.message==='INSPECTOR_AUTH_UNAVAILABLE');
  assert.equal(x.state.calls.length,1);
 });
});

test('IMP02 inspector rejects unsafe endpoints and privileged project keys before network',async t=>{
 const x=await fixture(t);
 assert.throws(()=>storage.createSupabaseInspectorTokenProvider({...x.options,supabaseUrl:'http://example.com'}),/INVALID_STORAGE_ENDPOINT/);
 assert.throws(()=>storage.createSupabaseInspectorTokenProvider({...x.options,publishableKey:'sb_secret_forbidden'}),/INVALID_STORAGE_CREDENTIAL/);
 assert.throws(()=>storage.createSupabaseInspectorTokenProvider({...x.options,userId:'x'.repeat(36)}),/INVALID_UUID/);
 assert.equal(x.state.calls.length,0);
});
