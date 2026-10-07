import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {runHostedReadAcceptance} from '../scripts/hosted-acceptance-core.ts';
import {runHostedAuthAcceptance} from '../scripts/hosted-auth-acceptance-core.ts';
import {runHostedWriteAcceptance} from '../scripts/hosted-write-acceptance-core.ts';
import {hostedFixture, uuid} from './fixtures/hosted-acceptance-fixture.ts';

const site='another-helpdesk';
const origin='https://'+'a'.repeat(24)+'--'+site+'.netlify.app';
const legacyOrigin='https://'+'a'.repeat(24)+'--helpdesk-consultegeo.netlify.app';
async function examples(){
 return {
  read:JSON.parse(await readFile(new URL('../examples/hosted-acceptance.fixture.json',import.meta.url),'utf8')),
  auth:JSON.parse(await readFile(new URL('../examples/hosted-auth.fixture.json',import.meta.url),'utf8')),
  write:JSON.parse(await readFile(new URL('../examples/hosted-write.fixture.json',import.meta.url),'utf8')),
 };
}
async function selected(){
 const c=await examples();
 c.read={...c.read,origin,netlifySiteName:site};
 c.auth={...c.auth,origin,netlifySiteName:site};
 c.write={...c.write,readFixture:structuredClone(c.read),includeMachineWrites:true};
 return c;
}
async function plans(c:Awaited<ReturnType<typeof examples>>){
 return [await runHostedReadAcceptance(c.read),await runHostedAuthAcceptance(c.auth),await runHostedWriteAcceptance(c.write)];
}
async function allReject(c:Awaited<ReturnType<typeof examples>>){
 await assert.rejects(()=>runHostedReadAcceptance(c.read));
 await assert.rejects(()=>runHostedAuthAcceptance(c.auth));
 await assert.rejects(()=>runHostedWriteAcceptance(c.write));
}

test('R20 production configurations preserve their exact confirmation hashes and mutation keys',async()=>{
 const c=await examples();const [r,a,w]=await plans(c);
 assert.equal(r!.config_sha256,'73b7ee4f6b7c3c7955c0078f252f7b12cf1a0c722570ca8c04b3c81f5afb547e');
 assert.equal(a!.config_sha256,'4afeabf6530836e8c4d933302de86e60a4571266972b1720a84f47b3ccb67e8d');
 assert.equal(w!.config_sha256,'691f24e4ff8695a5d3e949e43d8a1214a82ae5eb25713b670eed19acfbf64af0');
 const old=await runHostedWriteAcceptance(c.write);
 assert.equal(old.keys.create,'hd-accept-write:00000000-0000-4000-8000-000000009501:create');
 assert.deepEqual([r!.checks.length,a!.checks.length,w!.checks.length],[28,12,18]);
});
test('R20 explicit selected site is accepted by the read plan without a transport',async()=>{
 const c=await selected(),p=await runHostedReadAcceptance(c.read);
 assert.equal(p.status,'planned');assert.equal(p.origin,origin);assert.equal(p.transport,'none');assert.equal(p.checks.length,28);
});
test('R20 explicit selected site is accepted by the auth plan without credentials',async()=>{
 const c=await selected(),p=await runHostedAuthAcceptance(c.auth);
 assert.equal(p.status,'planned');assert.equal(p.origin,origin);assert.equal(p.transport,'none');assert.equal(p.checks.length,12);
});
test('R20 write plan inherits the selected site and preserves the complete human/M2M journey',async()=>{
 const c=await selected(),p=await runHostedWriteAcceptance(c.write);
 assert.equal(p.status,'planned');assert.equal(p.origin,origin);assert.equal(p.preflight.checks.length,28);assert.equal(p.checks.length,43);
 assert.equal(p.keys.create,'hd-accept-write:00000000-0000-4000-8000-000000009501:create');
 assert.equal(p.machine?.keys.create,'hd-accept-write:00000000-0000-4000-8000-000000009501:machine:create');
});
test('R20 another site remains refused when no explicit site name is provided',async()=>{
 const c=await examples();c.read.origin=origin;c.auth.origin=origin;c.write.readFixture.origin=origin;await allReject(c);
});
test('R20 the declared site cannot authorize an origin belonging to another site',async()=>{
 const c=await selected();c.read.origin=legacyOrigin;c.auth.origin=legacyOrigin;c.write.readFixture.origin=legacyOrigin;await allReject(c);
});
test('R20 rejects invalid explicit names rather than silently using the legacy name',async()=>{
 for(const name of [undefined,null,0,true,'','Uppercase','a.b','*.netlify.app','-a','a-','a/b','a@b','a?b','a#b','a%62','a\\b','á','a\n','a\r','a\t','a '.trimStart(),'x'.repeat(38)]){
  const c=await examples();c.read.netlifySiteName=name;c.auth.netlifySiteName=name;c.write.readFixture.netlifySiteName=name;await allReject(c);
 }
});
test('R20 refuses aliases, redirects targets, noncanonical forms and suffix injection',async()=>{
 const bad=[`https://${site}.netlify.app`,`https://staging--${site}.netlify.app`,`https://deploy-preview-1--${site}.netlify.app`,
  origin.replace('https:','http:'),origin+'/',origin+'?x=1',origin+'#x',origin+':443',origin+'.evil.invalid',origin+'\n',origin+' ',
  origin.replace('https://','https://user@'),origin.replace(site,site.toUpperCase()),origin.replace('.netlify.app','.netlify.app.'),
  'https://127.0.0.1','https://localhost','https://example.invalid',origin.replace('a'.repeat(24),'a'.repeat(25))];
 for(const host of bad){const c=await selected();c.read.origin=host;c.auth.origin=host;c.write.readFixture.origin=host;await allReject(c);}
});
test('R20 valid names at the conservative length boundaries are accepted without normalization',async()=>{
 for(const name of ['a','site-1','x'.repeat(37)]){
  const c=await selected(),host='https://'+'1'.repeat(24)+'--'+name+'.netlify.app';
  c.read.origin=host;c.read.netlifySiteName=name;c.auth.origin=host;c.auth.netlifySiteName=name;
  c.write.readFixture=structuredClone(c.read);
  for(const p of await plans(c))assert.equal(p.origin,host);
 }
});
test('R20 explicit site selection changes confirmation hashes even for the legacy site',async()=>{
 const c=await examples(),old=await plans(c);
 c.read.netlifySiteName='helpdesk-consultegeo';c.auth.netlifySiteName='helpdesk-consultegeo';c.write.readFixture.netlifySiteName='helpdesk-consultegeo';
 const next=await plans(c);for(let i=0;i<next.length;i++)assert.notEqual(next[i]!.config_sha256,old[i]!.config_sha256);
});
test('R20 unknown configuration fields remain rejected',async()=>{
 const c=await selected();c.read.allowAnySite=true;c.auth.allowAnySite=true;c.write.readFixture.allowAnySite=true;await allReject(c);
});
test('R20 an inherited site name does not select a new destination',async()=>{
 const c=await examples();Object.setPrototypeOf(c.read,{netlifySiteName:site});c.read.origin=origin;
 Object.setPrototypeOf(c.auth,{netlifySiteName:site});c.auth.origin=origin;
 await assert.rejects(()=>runHostedReadAcceptance(c.read));await assert.rejects(()=>runHostedAuthAcceptance(c.auth));
});
test('R20 plan mode never touches supplied secrets or sends network requests',async()=>{
 const c=await selected();let sent=0;
 const secrets=new Proxy({}, {get(){throw Error('secret accessed');},ownKeys(){throw Error('secret enumerated');}});
 const fetcher:typeof fetch=async()=>{sent++;throw Error('must not send');};
 for(const p of [await runHostedReadAcceptance(c.read,secrets,{fetcher}),await runHostedAuthAcceptance(c.auth,secrets,{fetcher}),await runHostedWriteAcceptance(c.write,secrets,{fetcher})]){
  assert.equal(p.transport,'none');assert.equal(p.operational,false);assert.equal(p.platform_approved,false);assert.ok(p.checks.every(c=>c.status==='not_run'));
 }assert.equal(sent,0);
});
test('R20 wrong literal origin or write confirmation hash blocks before transport',async()=>{
 const c=await selected();let sent=0;const fetcher:typeof fetch=async()=>{sent++;throw Error('must not send');};
 await assert.rejects(()=>runHostedReadAcceptance(c.read,{}, {execute:true,confirmOrigin:legacyOrigin,fetcher}));
 await assert.rejects(()=>runHostedAuthAcceptance(c.auth,{}, {execute:true,allowSessionMutations:true,confirmOrigin:legacyOrigin,confirmAuthOrigin:c.auth.supabaseUrl,fetcher}));
 const p=await runHostedWriteAcceptance(c.write);
 await assert.rejects(()=>runHostedWriteAcceptance(c.write,{}, {execute:true,allowTicketMutations:true,confirmOrigin:legacyOrigin,confirmConfigSha256:p.config_sha256,fetcher}));
 await assert.rejects(()=>runHostedWriteAcceptance(c.write,{}, {execute:true,allowTicketMutations:true,confirmOrigin:origin,confirmConfigSha256:'0'.repeat(64),fetcher}));
 assert.equal(sent,0);
});
test('R20 mismatching Auth origin still blocks before any network call',async()=>{
 const c=await selected();let sent=0;const fetcher:typeof fetch=async()=>{sent++;throw Error('must not send');};
 await assert.rejects(()=>runHostedAuthAcceptance(c.auth,{}, {execute:true,allowSessionMutations:true,confirmOrigin:origin,confirmAuthOrigin:'https://'+'b'.repeat(20)+'.supabase.co',fetcher}));
 assert.equal(sent,0);
});
test('R20 read journey uses only the selected origin even if caller config changes mid-run',async()=>{
 const f=await hostedFixture(),c={...f.config,origin,netlifySiteName:site};
 const p=await runHostedReadAcceptance(c,f.tokens,{execute:true,confirmOrigin:origin,fetcher:async(input,init)=>{
  c.origin=legacyOrigin;c.netlifySiteName='helpdesk-consultegeo';return f.fetcher(input,init);
 }});
 assert.equal(p.status,'passed');assert.equal(p.transport,'injected');assert.equal(p.platform_approved,false);
 assert.ok(f.requests.length>=28);assert.ok(f.requests.every(r=>new URL(r.url).origin===origin));
});
test('R20 full write journey remains confined to the explicit selected site',async()=>{
 const f=await hostedFixture(),c={schema:1,readFixture:{...f.config,origin,netlifySiteName:site},executionId:uuid(9701),coverageId:uuid(401),includeMachineWrites:true};
 const plan=await runHostedWriteAcceptance(c);
 const p=await runHostedWriteAcceptance(c,f.tokens,{execute:true,allowTicketMutations:true,confirmOrigin:origin,confirmConfigSha256:plan.config_sha256,fetcher:f.fetcher});
 assert.equal(p.status,'passed',JSON.stringify(p.checks.filter(c=>c.status!=='passed')));assert.equal(p.preflight.checks.length,28);assert.equal(p.checks.length,43);
 assert.equal(p.transport,'injected');assert.equal(p.postgres_tested,false);assert.equal(p.platform_approved,false);
 assert.ok(f.requests.every(r=>new URL(r.url).origin===origin));assert.equal(f.db.snapshot().tickets.length,5);
});
test('R20 auth client selects the explicit site but does not bypass its runtime release gate',async()=>{
 const c=await selected();const requests:Request[]=[];
 const p=await runHostedAuthAcceptance(c.auth,{email:'synthetic@example.invalid',password:'synthetic-only',integrationKey:'hd_key_'+'q'.repeat(43)},
  {execute:true,allowSessionMutations:true,confirmOrigin:origin,confirmAuthOrigin:c.auth.supabaseUrl,fetcher:async(input,init)=>{
   const req=new Request(input,init);requests.push(req);
   return new Response(JSON.stringify({code:'release_gate_closed'}),{status:503,headers:{'content-type':'application/problem+json','cache-control':'no-store','x-content-type-options':'nosniff','x-request-id':req.headers.get('x-request-id')!}});
  }});
 assert.equal(requests.length,1);assert.equal(new URL(requests[0]!.url).origin,origin);assert.equal(requests[0]!.headers.has('authorization'),false);
 assert.equal(p.checks[0]!.code,'release_gate_closed');assert.ok(p.checks.slice(1).every(c=>c.status==='blocked'));assert.equal(p.platform_approved,false);
});
test('R20 all three existing CLIs produce selected-site plans without leaking environment secrets',async()=>{
 const c=await selected(),dir=await mkdtemp(join(tmpdir(),'helpdesk-r20-site-'));
 try{
  for(const [name,config] of [['hosted-acceptance',c.read],['hosted-auth-acceptance',c.auth],['hosted-write-acceptance',c.write]] as const){
   const path=join(dir,name+'.json');await writeFile(path,JSON.stringify(config));
   const env:NodeJS.ProcessEnv={...process.env,HELPDESK_TEST_HUMAN_A:'R20_SECRET_SENTINEL',HELPDESK_TEST_PASSWORD_A:'R20_SECRET_SENTINEL'};delete env.NODE_TEST_CONTEXT;
   const run=spawnSync(process.execPath,['--experimental-strip-types','scripts/'+name+'.ts','--config',path],{env,encoding:'utf8',timeout:10000});
   assert.ifError(run.error);assert.equal(run.status,0,run.stderr);const report=JSON.parse(run.stdout);
   assert.equal(report.status,'planned');assert.equal(report.origin,origin);assert.equal(report.transport,'none');assert.equal((run.stdout+run.stderr).includes('R20_SECRET_SENTINEL'),false);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});
