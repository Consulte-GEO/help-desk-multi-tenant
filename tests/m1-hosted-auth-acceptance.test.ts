import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {hostedAuthFixture,} from './fixtures/hosted-auth-fixture.ts';
import {uuid} from './fixtures/hosted-acceptance-fixture.ts';
const modulePath='../scripts/hosted-auth-acceptance-core.ts';
async function run(...args:unknown[]){
 assert.ok(existsSync(new URL(modulePath,import.meta.url)),'R11 acceptance capability must exist');
 const module=await import(modulePath);return module.runHostedAuthAcceptance(...args);
}
const check=(r:any,id:string)=>r.checks.find((c:any)=>c.id===id);
const json=(request:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':status>=400?'application/problem+json':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','x-request-id':request.headers.get('x-request-id')!}});
function cleanReport(r:unknown,f:Awaited<ReturnType<typeof hostedAuthFixture>>){const text=JSON.stringify(r);
 for(const secret of [...Object.values(f.secrets),...f.access.keys(),...f.refresh.keys()])assert.ok(!text.includes(secret));
 assert.doesNotMatch(text,/Synthetic-password|refresh_synthetic|hd_key_|hd_session_|user_metadata|stack/);
}

test('R11 plans twelve checks without reading credentials or making a request',async()=>{
 const f=await hostedAuthFixture();const secrets=new Proxy({}, {get(){throw Error('must not read credentials');},ownKeys(){throw Error('must not enumerate credentials');}});
 const r=await run(f.config,secrets,{fetcher:()=>{throw Error('must not call');}});
 assert.equal(r.status,'planned');assert.equal(r.transport,'none');assert.equal(r.checks.length,12);assert.ok(r.checks.every((c:any)=>c.status==='not_run'));
});
for(const [name,change] of Object.entries({session_mutations:{allowSessionMutations:false},origin:{confirmOrigin:'https://other.test'},auth_origin:{confirmAuthOrigin:'https://other.supabase.co'}}))
 test('R11 refuses execution without exact '+name+' opt-in',async()=>{
  const f=await hostedAuthFixture();await assert.rejects(()=>run(f.config,f.secrets,{...f.options,...change}));assert.equal(f.requests.length,0);
 });
for(const origin of ['http://localhost','https://helpdesk-consultegeo.netlify.app','https://'+'a'.repeat(24)+'--helpdesk-consultegeo.netlify.app/','https://'+'a'.repeat(24)+'--helpdesk-consultegeo.netlify.app.evil.test'])
 test('R11 refuses unsafe API origin '+origin,async()=>{
  const f=await hostedAuthFixture();await assert.rejects(()=>run({...f.config,origin},f.secrets,{...f.options,confirmOrigin:origin}));assert.equal(f.requests.length,0);
 });
test('R11 rejects malformed secrets and unexpected configuration fields before sending',async()=>{
 const f=await hostedAuthFixture();for(const values of [{...f.secrets,integrationKey:'hd_session_'+'k'.repeat(43)},{...f.secrets,password:''},{...f.secrets,password:'bad\ud800value'},{...f.secrets,password:'bad\0value'},{...f.secrets,email:'x\n@example.test'}])await assert.rejects(()=>run(f.config,values,f.options));
 await assert.rejects(()=>run({...f.config,token:'forbidden'},f.secrets,f.options));assert.equal(f.requests.length,0);
});
test('R11 completes human refresh/local logout and M2M self-revocation using existing real adapters',async()=>{
 const f=await hostedAuthFixture();const before=JSON.stringify(f.base.db.snapshot());const r=await run(f.config,f.secrets,f.options);
 assert.equal(r.status,'passed',JSON.stringify(r));assert.equal(r.checks.length,12);assert.ok(r.checks.every((c:any)=>c.status==='passed'));
 assert.equal(r.transport,'injected');assert.deepEqual(r.cleanup,{human:'confirmed',machine:'confirmed'});assert.equal(r.unconfirmed_session_creation,false);
 assert.equal(r.platform_approved,false);assert.equal(r.operational,false);assert.equal(r.expiry_tested,false);assert.equal(r.long_term_key_rotation_tested,false);assert.equal(r.human_access_jwt_revocation_tested,false);
 assert.equal(JSON.stringify(f.base.db.snapshot()),before);assert.deepEqual(f.counters(),{exchanges:1,revocations:1,logouts:1,refreshCalls:2});
 assert.equal(f.refresh.size,0);assert.ok([...f.machines.values()].every(v=>v===false));cleanReport(r,f);
 const methods=f.requests.filter(q=>new URL(q.url).origin===f.config.origin&&q.method!=='GET');assert.deepEqual(methods.map(q=>[q.method,new URL(q.url).pathname]),[['POST','/v1/integration-tokens'],['DELETE','/v1/integration-tokens/current']]);
 for(const req of f.requests){assert.equal(req.redirect,'error');const url=new URL(req.url);if(req.headers.get('authorization')?.includes('hd_key_'))assert.equal(url.pathname,'/v1/integration-tokens');}
});
test('R11 closed release gate blocks login and token issuance',async()=>{
 const f=await hostedAuthFixture();const fetcher:typeof fetch=async(i,o)=>json(new Request(i,o),{code:'release_gate_closed',status:503},503);
 const r=await run(f.config,f.secrets,{...f.options,fetcher});assert.equal(r.status,'blocked');assert.equal(check(r,'public-config').code,'release_gate_closed');assert.equal(f.providerRequests.length,0);assert.equal(f.counters().exchanges,0);
});
test('R11 wrong Supabase public configuration sends no credentials',async()=>{
 const f=await hostedAuthFixture();const fetcher:typeof fetch=async(i,o)=>json(new Request(i,o),{supabase_url:'https://'+'b'.repeat(20)+'.supabase.co',publishable_key:'sb_publishable_synthetic'});
 const r=await run(f.config,f.secrets,{...f.options,fetcher});assert.equal(r.status,'failed');assert.equal(f.providerRequests.length,0);
});
test('R11 missing revocation capability blocks session mutations',async()=>{
 const f=await hostedAuthFixture();const fetcher:typeof fetch=async(i,o)=>{const req=new Request(i,o),res=await f.fetcher(req);if(new URL(req.url).pathname!=='/v1/capabilities')return res;const body=await res.json();body.capabilities.integration_session_revocation=false;return json(req,body);};
 const r=await run(f.config,f.secrets,{...f.options,fetcher});assert.equal(r.status,'failed');assert.equal(f.providerRequests.length,0);
});
test('R11 login rejection stops without a retry or pretending a session was created',async()=>{
 const f=await hostedAuthFixture();f.controls.loginStatus=400;const r=await run(f.config,f.secrets,f.options);
 assert.equal(r.status,'failed');assert.equal(check(r,'human-login').code,'auth_rejected');assert.equal(r.cleanup.human,'not_requested');assert.equal(r.unconfirmed_session_creation,false);
 assert.equal(f.providerRequests.filter(q=>q.url.includes('grant_type=password')).length,1);
});
test('R11 missing live membership after login still closes the owned session',async()=>{
 const f=await hostedAuthFixture();f.controls.humanMembership=false;const r=await run(f.config,f.secrets,f.options);
 assert.equal(r.status,'failed');assert.equal(check(r,'human-identity').status,'failed');assert.equal(r.cleanup.human,'confirmed');assert.equal(f.counters().logouts,1);assert.equal(f.counters().exchanges,0);
});
test('R11 mismatched fixture Auth user is never accepted as the internal principal',async()=>{
 const f=await hostedAuthFixture();const r=await run({...f.config,humanAuthUserId:uuid(9991)},f.secrets,f.options);
 assert.equal(r.status,'failed');assert.equal(check(r,'human-login').code,'identity_mismatch');assert.equal(f.requests.some(q=>q.headers.has('authorization')&&q.url.endsWith('/v1/me')),false);
});
test('R11 transient refresh error is not a revocation proof and causes one cleanup',async()=>{
 const f=await hostedAuthFixture();f.controls.refreshStatus=503;const r=await run(f.config,f.secrets,f.options);
 assert.equal(r.status,'failed');assert.equal(check(r,'human-refresh').code,'auth_unavailable');assert.equal(check(r,'human-refresh-rejected').status,'blocked');assert.equal(f.counters().refreshCalls,1);assert.equal(f.counters().logouts,1);cleanReport(r,f);
});
test('R11 refresh accepted after logout fails and closes the unexpectedly returned session',async()=>{
 const f=await hostedAuthFixture();f.controls.keepHumanSession=true;const r=await run(f.config,f.secrets,f.options);
 assert.equal(r.status,'failed');assert.equal(check(r,'human-refresh-rejected').code,'revocation_not_effective');assert.equal(f.counters().logouts,2);assert.equal(f.counters().exchanges,0);
});
for(const status of [429,503])test('R11 '+status+' after logout is not accepted as refresh revocation',async()=>{
 const f=await hostedAuthFixture();const fetcher:typeof fetch=async(i,o)=>{const req=new Request(i,o);if(req.url.includes('grant_type=refresh_token')&&f.counters().logouts>0)return new Response('{}',{status,headers:{'content-type':'application/json'}});return f.fetcher(req);};
 const r=await run(f.config,f.secrets,{...f.options,fetcher});assert.equal(r.status,'failed');assert.equal(check(r,'human-refresh-rejected').code,'auth_unavailable');
});
test('R11 failed human logout is unconfirmed and never automatically repeated',async()=>{
 const f=await hostedAuthFixture();f.controls.logoutStatus=503;const r=await run(f.config,f.secrets,f.options);
 assert.equal(r.status,'failed');assert.equal(r.cleanup.human,'unconfirmed');assert.equal(f.counters().logouts,1);assert.equal(f.counters().exchanges,0);
});
test('R11 a machine from another product instance is refused and self-revoked once',async()=>{
 const f=await hostedAuthFixture();f.controls.machineInstance=uuid(9992);const r=await run(f.config,f.secrets,f.options);
 assert.equal(r.status,'failed');assert.equal(check(r,'machine-identity').code,'identity_mismatch');assert.equal(r.cleanup.machine,'confirmed');assert.equal(f.counters().revocations,1);
});
test('R11 claimed machine revocation without denied access fails the suite',async()=>{
 const f=await hostedAuthFixture();f.controls.keepMachineSession=true;const r=await run(f.config,f.secrets,f.options);
 assert.equal(r.status,'failed');assert.equal(check(r,'machine-revoked').code,'revocation_not_effective');assert.equal(f.counters().revocations,1);
});
test('R11 loss of machine issuance response is explicit and never repeats the key exchange',async()=>{
 const f=await hostedAuthFixture();const fetcher:typeof fetch=async(i,o)=>{const req=new Request(i,o);const res=await f.fetcher(req);if(req.method==='POST'&&req.url.endsWith('/integration-tokens')){await res.body?.cancel();throw Error('raw credential-shaped transport detail');}return res;};
 const r=await run(f.config,f.secrets,{...f.options,fetcher});assert.equal(r.status,'failed');assert.equal(r.unconfirmed_session_creation,true);assert.equal(r.cleanup.machine,'unconfirmed');assert.equal(f.counters().exchanges,1);assert.equal(f.counters().revocations,0);cleanReport(r,f);
});
test('R11 refuses redirected responses before forwarding a password',async()=>{
 const f=await hostedAuthFixture();const fetcher:typeof fetch=async()=>new Response(null,{status:302,headers:{location:'https://other.test'}});
 const r=await run(f.config,f.secrets,{...f.options,fetcher});assert.equal(r.status,'failed');assert.equal(f.providerRequests.length,0);
});
test('R11 rejects oversized JSON without disclosing response content',async()=>{
 const f=await hostedAuthFixture();const fetcher:typeof fetch=async(i,o)=>json(new Request(i,o),{data:'x'.repeat(65537)});
 const r=await run(f.config,f.secrets,{...f.options,fetcher});assert.equal(r.status,'failed');assert.equal(check(r,'public-config').code,'unsafe_response');assert.ok(JSON.stringify(r).length<15000);cleanReport(r,f);
});
test('R11 plan CLI works without session credentials and reports no network execution',async()=>{
 const f=await hostedAuthFixture(),dir=await mkdtemp(join(tmpdir(),'helpdesk-auth-plan-'));
 try{const path=join(dir,'config.json');await writeFile(path,JSON.stringify(f.config));
 const r=spawnSync(process.execPath,['--experimental-strip-types','scripts/hosted-auth-acceptance.ts','--config',path],{encoding:'utf8',env:{PATH:process.env.PATH},timeout:10000});
 assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).status,'planned');assert.equal(JSON.parse(r.stdout).transport,'none');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('R11 local socket tests the real HTTP/Auth modules but remains marked injected',async()=>{
 const f=await hostedAuthFixture();const server=createServer(async(req,res)=>{try{
 const chunks:Buffer[]=[];for await(const part of req)chunks.push(Buffer.from(part));
 const provider=req.url!.startsWith('/provider/'),path=req.url!.replace(/^\/(?:provider|api)/,'');
 const headers=new Headers();for(const [name,value] of Object.entries(req.headers))if(value)headers.set(name,Array.isArray(value)?value.join(','):value);
 const body=Buffer.concat(chunks);const request=new Request((provider?f.config.supabaseUrl:f.config.origin)+path,{method:req.method,headers,...(body.length?{body}:{})});
 const response=await f.fetcher(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end();}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const addr=server.address();assert.ok(addr&&typeof addr==='object');
 try{const fetcher:typeof fetch=(i,o)=>{const req=new Request(i,o),url=new URL(req.url);return fetch(`http://127.0.0.1:${addr.port}/${url.origin===f.config.supabaseUrl?'provider':'api'}${url.pathname}${url.search}`,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:req.body,duplex:'half',signal:req.signal,redirect:'error'} as RequestInit);};
 const r=await run(f.config,f.secrets,{...f.options,fetcher});assert.equal(r.status,'passed',JSON.stringify(r));assert.equal(r.transport,'injected');cleanReport(r,f);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('R11 wrong release is rejected before a session mutation',async()=>{
 const f=await hostedAuthFixture();const fetcher:typeof fetch=async(i,o)=>{const req=new Request(i,o),res=await f.fetcher(req);if(!req.url.endsWith('/capabilities'))return res;const body=await res.json();body.release='other-release';return json(req,body);};
 const r=await run(f.config,f.secrets,{...f.options,fetcher});assert.equal(r.status,'failed');assert.equal(f.providerRequests.length,0);assert.equal(f.counters().exchanges,0);
});
test('R11 rejects a privileged JWT returned by the provider without exposing or using it',async()=>{
 const f=await hostedAuthFixture();let privileged='';const fetcher:typeof fetch=async(i,o)=>{const req=new Request(i,o),res=await f.fetcher(req);if(!req.url.includes('grant_type=password'))return res;const body=await res.json();const claims=JSON.parse(Buffer.from(body.access_token.split('.')[1],'base64url').toString());claims.role='service_role';privileged='header.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';body.access_token=privileged;return new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});};
 const r=await run(f.config,f.secrets,{...f.options,fetcher});assert.equal(r.status,'failed');assert.equal(r.unconfirmed_session_creation,true);assert.equal(check(r,'human-login').code,'unsafe_response');
 assert.equal(f.requests.some(req=>req.headers.get('authorization')?.includes(privileged)),false);assert.ok(!JSON.stringify(r).includes(privileged));
});
test('R11 successful machine issuance with invalid lifetime still self-revokes its known token',async()=>{
 const f=await hostedAuthFixture();const fetcher:typeof fetch=async(i,o)=>{const req=new Request(i,o),res=await f.fetcher(req);if(req.method!=='POST'||!req.url.endsWith('/integration-tokens'))return res;const body=await res.json();body.expires_at=new Date(Date.now()+3600000).toISOString();return json(req,body,201);};
 const r=await run(f.config,f.secrets,{...f.options,fetcher});assert.equal(r.status,'failed');assert.equal(check(r,'machine-identity').status,'blocked');assert.equal(r.cleanup.machine,'confirmed');assert.equal(f.counters().revocations,1);
});
test('R11 uncertain self-revocation is not retried or converted to success',async()=>{
 const f=await hostedAuthFixture();const fetcher:typeof fetch=async(i,o)=>{const req=new Request(i,o),res=await f.fetcher(req);if(req.method==='DELETE')throw Error('SENSITIVE synthetic provider failure');return res;};
 const r=await run(f.config,f.secrets,{...f.options,fetcher});assert.equal(r.status,'failed');assert.equal(r.cleanup.machine,'unconfirmed');assert.equal(check(r,'machine-revoked').status,'blocked');assert.equal(f.counters().revocations,1);assert.doesNotMatch(JSON.stringify(r),/SENSITIVE/);
});
test('R11 cleanup failure does not erase the original failed identity check',async()=>{
 const f=await hostedAuthFixture();f.controls.humanMembership=false;f.controls.logoutStatus=503;const r=await run(f.config,f.secrets,f.options);
 assert.equal(r.status,'failed');assert.equal(check(r,'human-identity').code,'unexpected_status');assert.equal(r.cleanup.human,'unconfirmed');assert.equal(f.counters().logouts,1);
});
test('R11 request configuration and credentials are snapshotted before awaiting network',async()=>{
 const f=await hostedAuthFixture(),input={...f.config},secretInput={...f.secrets};let first=true;
 const fetcher:typeof fetch=async(i,o)=>{if(first){first=false;input.origin='https://other.test';secretInput.password='CHANGED';}return f.fetcher(i,o);};
 const r=await run(input,secretInput,{...f.options,fetcher});assert.equal(r.status,'passed',JSON.stringify(r));assert.equal(r.origin,f.config.origin);cleanReport(r,f);
});
test('R11 a 429 login response remains a rejection of the attempt, not an unknown session',async()=>{
 const f=await hostedAuthFixture();f.controls.loginStatus=429;const r=await run(f.config,f.secrets,f.options);assert.equal(r.status,'failed');assert.equal(r.unconfirmed_session_creation,false);assert.equal(f.counters().logouts,0);
});
test('R11 incomplete execute flags and TLS override are refused by the CLI',async()=>{
 const f=await hostedAuthFixture(),dir=await mkdtemp(join(tmpdir(),'helpdesk-auth-cli-'));
 try{const path=join(dir,'config.json');await writeFile(path,JSON.stringify(f.config));
 for(const args of [['--execute'],['--execute','--allow-session-mutations','--confirm-origin',f.config.origin,'--confirm-auth-origin',f.config.supabaseUrl]]){
 const r=spawnSync(process.execPath,['--experimental-strip-types','scripts/hosted-auth-acceptance.ts','--config',path,...args],{encoding:'utf8',env:{PATH:process.env.PATH,NODE_TLS_REJECT_UNAUTHORIZED:'0',HELPDESK_TEST_PASSWORD_A:'DO_NOT_PRINT_PASSWORD'},timeout:10000});
 assert.equal(r.status,1);assert.equal(r.stdout,'');assert.doesNotMatch(r.stderr,/DO_NOT_PRINT_PASSWORD/);assert.match(r.stderr,/não executada/);
 }
 }finally{await rm(dir,{recursive:true,force:true});}
});
