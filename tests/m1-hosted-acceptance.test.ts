import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {hostedFixture,uuid} from './fixtures/hosted-acceptance-fixture.ts';
const modulePath='../scripts/hosted-acceptance-core.ts';
async function implementation(){
 const m=await import(modulePath).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof m.runHostedReadAcceptance,'function','Hosted read acceptance is not implemented');return m;
}
async function run(f:Awaited<ReturnType<typeof hostedFixture>>,fetcher:typeof fetch=f.fetcher){
 const m=await implementation();return m.runHostedReadAcceptance(f.config,f.tokens,{execute:true,confirmOrigin:f.config.origin,fetcher});
}
const response=(req:Request,data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':status>=400?'application/problem+json':'application/json',
 'cache-control':'no-store','x-content-type-options':'nosniff','x-request-id':req.headers.get('x-request-id')!}});
test('R10 default is a network-free plan and never claims operational acceptance',async()=>{
 const f=await hostedFixture(),m=await implementation();let calls=0;
 const r=await m.runHostedReadAcceptance(f.config,{}, {fetcher:async()=>{calls++;throw Error('must not fetch');}});
 assert.equal(calls,0);assert.equal(r.status,'planned');assert.equal(r.platform_approved,false);assert.equal(r.operational,false);
 assert.ok(r.checks.length>=20);assert.ok(r.checks.every((c:{status:string})=>c.status==='not_run'));
});
for(const origin of ['https://helpdesk-consultegeo.netlify.app','http://'+ 'a'.repeat(24)+'--helpdesk-consultegeo.netlify.app','https://'+ 'a'.repeat(24)+'--helpdesk-consultegeo.netlify.app.evil.invalid','https://u:p@'+ 'a'.repeat(24)+'--helpdesk-consultegeo.netlify.app','https://'+ 'a'.repeat(24)+'--helpdesk-consultegeo.netlify.app/?token=x'])
 test('R10 refuses unsafe or mutable target '+origin,async()=>{
  const f=await hostedFixture(),m=await implementation();f.config.origin=origin;
  await assert.rejects(()=>m.runHostedReadAcceptance(f.config,f.tokens,{execute:true,confirmOrigin:origin,fetcher:f.fetcher}));assert.equal(f.requests.length,0);
 });
test('R10 execute requires the exact confirmed origin',async()=>{
 const f=await hostedFixture(),m=await implementation();await assert.rejects(()=>m.runHostedReadAcceptance(f.config,f.tokens,{execute:true,confirmOrigin:'other',fetcher:f.fetcher}));assert.equal(f.requests.length,0);
});
for(const kind of ['same_account','same_ticket','same_requester','unknown_field','bad_uuid','bad_marker'])test('R10 validates fixture separation: '+kind,async()=>{
 const f=await hostedFixture(),m=await implementation();const c=f.config as any;
 if(kind==='same_account')c.accountB.accountId=c.accountA.accountId;
 if(kind==='same_ticket')c.accountB.ticketId=c.accountA.ticketId;
 if(kind==='same_requester')c.accountB.requesterId=c.accountA.requesterId;
 if(kind==='unknown_field')c.password='do not accept';
 if(kind==='bad_uuid')c.workspaceId='not-a-uuid';
 if(kind==='bad_marker')c.internalNoteMarker='ordinary business data';
 await assert.rejects(()=>m.runHostedReadAcceptance(c,f.tokens,{execute:true,confirmOrigin:c.origin,fetcher:f.fetcher}));assert.equal(f.requests.length,0);
});
for(const kind of ['permanent_machine_key','privileged_human','same_humans','missing_token'])test('R10 refuses unsafe bearer configuration: '+kind,async()=>{
 const f=await hostedFixture();await implementation();
 if(kind==='permanent_machine_key')f.tokens.machineA='hd_key_'+'z'.repeat(43);
 if(kind==='privileged_human')f.tokens.requesterA='e30.'+Buffer.from('{"role":"service_role"}').toString('base64url')+'.synthetic';
 if(kind==='same_humans')f.tokens.requesterB=f.tokens.requesterA;
 if(kind==='missing_token')f.tokens.agentA='';
 await assert.rejects(()=>run(f));assert.equal(f.requests.length,0);
});
test('R10 closed runtime gate blocks all private probes before sending a bearer',async()=>{
 const f=await hostedFixture();const r=await run(f,async(input,init)=>{
  const req=new Request(input,init);f.requests.push(req);return response(req,{status:503,code:'release_gate_closed'},503);
 });
 assert.equal(r.status,'blocked');assert.equal(r.checks[0].code,'release_gate_closed');assert.equal(f.requests.length,1);assert.equal(f.requests[0]!.headers.has('authorization'),false);
 assert.ok(r.checks.slice(1).every((c:{status:string})=>c.status==='blocked'));
});
test('R10 wrong Supabase project stops before transmitting credentials',async()=>{
 const f=await hostedFixture();const r=await run(f,async(input,init)=>{const req=new Request(input,init);f.requests.push(req);return response(req,{supabase_url:'https://wrong.supabase.co',publishable_key:'sb_publishable_synthetic'});});
 assert.equal(r.status,'failed');assert.equal(f.requests.length,1);assert.equal(f.requests[0]!.headers.has('authorization'),false);
});
test('R10 all read scenarios pass against the real application handler with synthetic identities',async()=>{
 const f=await hostedFixture();const before=JSON.stringify(f.db);const r=await run(f);
 assert.equal(r.status,'passed',JSON.stringify(r));assert.equal(r.transport,'injected');assert.equal(r.platform_approved,false);
 assert.equal(r.login_lifecycle_tested,false);assert.equal(r.m2m_lifecycle_tested,false);assert.equal(r.browser_tested,false);
 assert.equal(JSON.stringify(f.db),before);assert.ok(f.requests.every(q=>q.method==='GET'));
 const out=JSON.stringify(r);for(const token of Object.values(f.tokens))assert.equal(out.includes(token),false);assert.equal(out.includes(f.config.internalNoteMarker),false);
 assert.equal(out.includes('Public synthetic message'),false);
});
test('R10 missing positive B fixture cannot create a false isolation pass',async()=>{
 const f=await hostedFixture();const r=await run(f,async(input,init)=>{const req=new Request(input,init);
  if(new URL(req.url).pathname==='/v1/tickets/'+f.config.accountB.ticketId)return response(req,{status:404,code:'resource_not_found'},404);return f.fetcher(req);
 });assert.equal(r.status,'failed');assert.equal(r.checks.find((c:{id:string})=>c.id==='ticket-b').status,'failed');
});
test('R10 internal note control must exist before the suite can pass privacy checks',async()=>{
 const f=await hostedFixture();const r=await run(f,async(input,init)=>{const req=new Request(input,init);
  if(new URL(req.url).pathname.endsWith('/notes')&&req.headers.get('authorization')==='Bearer '+f.tokens.agentA)return response(req,{items:[],next_cursor:null});return f.fetcher(req);
 });assert.equal(r.status,'failed');assert.equal(r.checks.find((c:{id:string})=>c.id==='internal-note-control').status,'failed');
});
test('R10 detects public serialization leaking the known internal marker',async()=>{
 const f=await hostedFixture();const r=await run(f,async(input,init)=>{const req=new Request(input,init);const res=await f.fetcher(req);
  if(new URL(req.url).pathname.endsWith('/messages')&&res.status===200){const b=await res.json();b.items.push({id:uuid(699),ticket_id:f.config.accountA.ticketId,body:f.config.internalNoteMarker,actor_type:'customer',created_at:'2026-01-01T00:00:00Z'});return response(req,b);}return res;
 });assert.equal(r.status,'failed');assert.equal(r.checks.find((c:{id:string})=>c.id==='public-messages').code,'privacy_violation');assert.equal(JSON.stringify(r).includes(f.config.internalNoteMarker),false);
});
test('R10 detects a requester receiving a foreign ticket instead of the expected hidden resource',async()=>{
 const f=await hostedFixture();const r=await run(f,async(input,init)=>{const req=new Request(input,init);
  if(new URL(req.url).pathname==='/v1/tickets/'+f.config.accountB.ticketId&&req.headers.get('authorization')==='Bearer '+f.tokens.requesterA){req.headers.set('authorization','Bearer '+f.tokens.requesterB);return f.fetcher(req);}return f.fetcher(req);
 });assert.equal(r.status,'failed');assert.equal(r.checks.find((c:{id:string})=>c.id==='deny-ticket-a-to-b').status,'failed');
});
test('R10 never retries or follows redirects and emits no provider exception content',async()=>{
 const f=await hostedFixture();let calls=0;const secret='provider error with PRIVATE-SECRET';
 const r=await run(f,async(_input,init)=>{calls++;assert.equal(init?.redirect,'error');assert.ok(init?.signal);throw Error(secret);});
 assert.equal(calls,1);assert.equal(r.status,'failed');assert.equal(JSON.stringify(r).includes(secret),false);
});
for(const fault of ['redirect','oversize','invalid_utf8','bad_content_type','cached','wrong_correlation'])test('R10 refuses unsafe HTTP response: '+fault,async()=>{
 const f=await hostedFixture();const r=await run(f,async(input,init)=>{const req=new Request(input,init);const headers={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','x-request-id':req.headers.get('x-request-id')!};
  if(fault==='redirect')return new Response(null,{status:302,headers:{...headers,location:'https://evil.invalid'}});
  if(fault==='bad_content_type')headers['content-type']='text/html';if(fault==='cached')headers['cache-control']='public, max-age=60';if(fault==='wrong_correlation')headers['x-request-id']='other';
  return new Response(fault==='oversize'?' '.repeat(65537):fault==='invalid_utf8'?new Uint8Array([0xff]):JSON.stringify({supabase_url:f.config.supabaseUrl,publishable_key:'sb_publishable_synthetic'}),{headers});
 });assert.equal(r.status,'failed');
});
test('R10 HTTP socket integration uses the real handler but is labeled injected, not hosted',async()=>{
 const f=await hostedFixture();let requests=0;
 const server=createServer(async(req,res)=>{try{
  requests++;const q=new Request(f.config.origin+(req.url??'/'),{headers:req.headers as Record<string,string>,method:req.method});const out=await f.handler(q);
  res.writeHead(out.status,Object.fromEntries(out.headers));res.end(Buffer.from(await out.arrayBuffer()));
 }catch{res.writeHead(500);res.end();}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address!=='string');
 try{const r=await run(f,async(input,init)=>{const q=new Request(input,init);const u=new URL(q.url);return fetch(`http://127.0.0.1:${address.port}${u.pathname}${u.search}`,{method:q.method,headers:q.headers,signal:init?.signal,redirect:'error'});});
  assert.equal(r.status,'passed',JSON.stringify(r));assert.equal(r.transport,'injected');assert.equal(requests,r.checks.length);
 }finally{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}
});
test('R10 CLI produces a plan without reading or exposing invalid environment tokens',async()=>{
 const f=await hostedFixture();await implementation();const dir=await mkdtemp(join(tmpdir(),'helpdesk-hosted-cli-'));
 try{const path=join(dir,'fixture.json');await writeFile(path,JSON.stringify(f.config));const env:NodeJS.ProcessEnv={...process.env,HELPDESK_TEST_HUMAN_A:'PRIVATE-SENTINEL'};delete env.NODE_TEST_CONTEXT;
  const r=spawnSync(process.execPath,['--experimental-strip-types','scripts/hosted-acceptance.ts','--config',path],{env,encoding:'utf8',timeout:10000});
  assert.equal(r.status,0,r.stderr);const out=JSON.parse(r.stdout);assert.equal(out.status,'planned');assert.equal(r.stdout.includes('PRIVATE-SENTINEL'),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('R10 headers rejected before JSON parsing cancel the unusable body',async()=>{
 const f=await hostedFixture();let cancelled=false;
 const r=await run(f,async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'text/html'}}));
 assert.equal(r.status,'failed');assert.equal(r.checks[0].code,'unsafe_http_response');assert.equal(cancelled,true);
});
test('R10 body deadline stops an unfinished response without retrying',async()=>{
 const f=await hostedFixture();let calls=0,cancelled=false;
 // Keep the test alive until the same 5s signal used by fetch expires.
 const keepAlive=setTimeout(()=>{},6500);
 try{
  const r=await run(f,async(input,init)=>{calls++;const q=new Request(input,init);return new Response(new ReadableStream({cancel(){cancelled=true;}}),{
   headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','x-request-id':q.headers.get('x-request-id')!}});});
  assert.equal(calls,1);assert.equal(r.status,'failed');assert.equal(r.checks[0].code,'invalid_json_response');assert.equal(cancelled,true);
 }finally{clearTimeout(keepAlive);}
});
test('R10 wrong release blocks private tokens before identity checks',async()=>{
 const f=await hostedFixture();let calls=0,privateCalls=0;
 const r=await run(f,async(input,init)=>{const q=new Request(input,init);calls++;if(q.headers.has('authorization'))privateCalls++;
  const out=await f.fetcher(q);if(new URL(q.url).pathname==='/v1/capabilities'){const b=await out.json();b.release='incompatible';return response(q,b);}return out;});
 assert.equal(r.status,'failed');assert.equal(r.checks[1].code,'contract_mismatch');assert.equal(calls,2);assert.equal(privateCalls,0);
});
test('R10 pre-provisioned account manager is not accepted as the requester isolation control',async()=>{
 const f=await hostedFixture();f.people[f.tokens.requesterA]!.grants[0]!.role='account_manager';const r=await run(f);
 assert.equal(r.status,'failed');assert.equal(r.checks.find((c:{id:string})=>c.id==='identity-requesterA').code,'contract_mismatch');
});
test('R10 finite fixture must be complete, not only the first page of a catalog',async()=>{
 const f=await hostedFixture();const r=await run(f,async(input,init)=>{const q=new Request(input,init);const out=await f.fetcher(q);
  if(new URL(q.url).pathname==='/v1/support-contexts'){const b=await out.json();b.next_cursor='more';return response(q,b);}return out;});
 assert.equal(r.status,'failed');assert.equal(r.checks.find((c:{id:string})=>c.id==='catalog-a').code,'fixture_missing');
});
test('R10 changes to caller configuration cannot change the already confirmed destination',async()=>{
 const f=await hostedFixture(),original=f.config.origin;
 const r=await run(f,async(input,init)=>{const q=new Request(input,init);assert.equal(new URL(q.url).origin,original);
  f.config.origin='https://evil.invalid';return f.fetcher(q);});assert.equal(r.status,'passed');assert.equal(r.origin,original);
});
