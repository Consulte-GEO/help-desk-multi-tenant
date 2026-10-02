import test from 'node:test';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {hostedFixture,uuid} from './fixtures/hosted-acceptance-fixture.ts';

const modulePath='../scripts/hosted-write-acceptance-core.ts';
async function implementation(){
 const m=await import(modulePath).catch((e:NodeJS.ErrnoException)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof m.runHostedWriteAcceptance,'function','Hosted write acceptance is not implemented');return m;
}
async function fixture(){const f=await hostedFixture();return {...f,config:{schema:1,readFixture:f.config,executionId:uuid(9501),coverageId:uuid(401)}};}
type Fixture=Awaited<ReturnType<typeof fixture>>;
async function options(f:Fixture,fetcher:typeof fetch=f.fetcher){
 const m=await implementation(),plan=await m.runHostedWriteAcceptance(f.config);
 return {execute:true,allowTicketMutations:true,confirmOrigin:f.config.readFixture.origin,confirmConfigSha256:plan.config_sha256,fetcher};
}
async function run(f:Fixture,fetcher:typeof fetch=f.fetcher){const m=await implementation();return m.runHostedWriteAcceptance(f.config,f.tokens,await options(f,fetcher));}
const path=(r:Request)=>new URL(r.url).pathname;
const domainWrite=(r:Request)=>r.method!=='GET'&&path(r).startsWith('/v1/tickets');
function response(req:Request,data:unknown,status=200,headers:Record<string,string>={}){
 return new Response(JSON.stringify(data),{status,headers:{'content-type':status>=400?'application/problem+json':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','x-request-id':req.headers.get('x-request-id')!,...headers}});
}
function state(f:Fixture,id:string){const s=f.db.snapshot();return {tickets:s.tickets.filter(x=>x.id===id),messages:s.messages.filter(x=>x.ticketId===id),events:s.events.filter(x=>x.ticketId===id),outbox:s.outbox.filter(x=>x.ticketId===id)};}

test('R12 plan validates configuration without reading tokens or sending network requests',async()=>{
 const f=await fixture(),m=await implementation();let calls=0;
 const credentials=new Proxy({}, {get(){throw Error('credentials accessed during plan');}});
 const r=await m.runHostedWriteAcceptance(f.config,credentials,{fetcher:async()=>{calls++;throw Error();}});
 assert.equal(calls,0);assert.equal(r.status,'planned');assert.equal(r.transport,'none');assert.equal(r.checks.length,18);assert.equal(r.preflight.checks.length,28);
 assert.ok(r.checks.every((c:any)=>c.status==='not_run'));assert.equal(r.platform_approved,false);assert.equal(r.atomicity_verified,false);
 assert.match(r.keys.create,/^hd-accept-write:/);assert.ok(r.keys.create.includes(f.config.executionId));
});
for(const missing of ['allowTicketMutations','confirmOrigin','confirmConfigSha256'])test('R12 execution refuses missing confirmation '+missing,async()=>{
 const f=await fixture(),m=await implementation(),o:any=await options(f);delete o[missing];
 await assert.rejects(()=>m.runHostedWriteAcceptance(f.config,f.tokens,o));assert.equal(f.requests.length,0);
});
for(const malformed of ['executionId','coverageId','extra','mutableOrigin'])test('R12 refuses unsafe write configuration '+malformed,async()=>{
 const f=await fixture(),m=await implementation();const input:any=structuredClone(f.config);
 if(malformed==='extra')input.password='SYNTHETIC_SECRET';else if(malformed==='mutableOrigin')input.readFixture.origin='https://helpdesk-consultegeo.netlify.app';else input[malformed]='not-a-uuid';
 await assert.rejects(()=>m.runHostedWriteAcceptance(input));assert.equal(f.requests.length,0);
});
test('R12 changed configuration cannot reuse the previous confirmation hash',async()=>{
 const f=await fixture(),m=await implementation(),o=await options(f);f.config.coverageId=uuid(9999);
 await assert.rejects(()=>m.runHostedWriteAcceptance(f.config,f.tokens,o));assert.equal(f.requests.length,0);
});
test('R12 closed release gate prevents all mutation attempts',async()=>{
 const f=await fixture(),r=await run(f,async(input,init)=>{const req=new Request(input,init);f.requests.push(req);return response(req,{status:503,code:'release_gate_closed'},503);});
 assert.equal(r.status,'blocked');assert.equal(f.requests.length,1);assert.equal(f.requests[0]!.headers.has('authorization'),false);assert.ok(r.checks.every((c:any)=>c.status==='blocked'));
});
for(const who of ['requesterA','agentA'] as const)test('R12 missing write scope blocks creation for '+who,async()=>{
 const f=await fixture();f.people[f.tokens[who]]!.scopes=['contexts:resolve','tickets:read',...(who==='agentA'?['notes:read']:[])];
 const r=await run(f);assert.equal(r.status,'failed');assert.equal(f.requests.filter(domainWrite).length,0);
});
test('R12 explicitly selected coverage must exist before any domain mutation',async()=>{
 const f=await fixture();f.config.coverageId=uuid(9999);const r=await run(f);
 assert.equal(r.status,'failed');assert.equal(f.requests.filter(domainWrite).length,0);
});
test('R12 full journey uses existing handlers and creates one ticket/message and three effects in memory',async()=>{
 const f=await fixture(),before=f.db.snapshot(),r=await run(f);
 assert.equal(r.status,'passed',JSON.stringify(r));assert.equal(r.transport,'injected');assert.equal(r.checks.length,18);
 assert.equal(r.preflight.status,'passed');assert.ok(r.checks.every((c:any)=>c.status==='passed'));
 const s=state(f,r.resources.ticket_id);assert.equal(s.tickets.length,1);assert.equal(s.messages.length,1);assert.equal(s.events.length,3);assert.equal(s.outbox.length,3);
 assert.equal(s.tickets[0]!.version,3);assert.equal(s.tickets[0]!.priority,'high');assert.equal(f.db.snapshot().tickets.length,before.tickets.length+1);
 assert.equal(r.atomicity_verified,false);assert.equal(r.contract_snapshot_verified,false);assert.equal(r.outbox_delivery_tested,false);assert.equal(r.postgres_tested,false);assert.equal(r.operational,false);
 const out=JSON.stringify(r);for(const token of Object.values(f.tokens))assert.equal(out.includes(token),false);
 assert.equal(out.includes(s.tickets[0]!.description),false);assert.equal(out.includes(s.messages[0]!.body),false);assert.equal(out.includes(f.config.readFixture.internalNoteMarker),false);
 assert.ok(f.requests.every(q=>q.redirect==='error'));assert.equal(f.requests.some(q=>q.method==='DELETE'),false);
});
test('R12 deliberate repeat with the same fixture uses the same keys and creates no duplicate effects',async()=>{
 const f=await fixture(),first=await run(f),before=f.db.snapshot(),second=await run(f);
 assert.equal(first.status,'passed');assert.equal(second.status,'passed',JSON.stringify(second));assert.deepEqual(first.keys,second.keys);assert.deepEqual(second.resources,first.resources);
 assert.deepEqual(f.db.snapshot(),before);
 assert.equal(second.checks.find((c:any)=>c.id==='create-ticket').replayed,true);
});
for(const point of ['create','message','priority'])test('R12 lost '+point+' response stops writes and can be recovered by a deliberate same-key invocation',async()=>{
 const f=await fixture();let lost=false;
 const r=await run(f,async(input,init)=>{
  const req=new Request(input,init),result=await f.fetcher(req);
  if(!lost&&((point==='create'&&path(req)==='/v1/tickets'&&req.method==='POST')||(point==='message'&&path(req).endsWith('/messages')&&req.method==='POST')||(point==='priority'&&req.method==='PATCH'))){lost=true;await result.body?.cancel();throw Error('SYNTHETIC_TOKEN_MUST_NOT_LEAK');}
  return result;
 });
 assert.equal(lost,true);assert.equal(r.status,'failed');assert.equal(r.checks.filter((c:any)=>c.outcome==='unknown').length,1);assert.equal(JSON.stringify(r).includes('SYNTHETIC_TOKEN'),false);
 assert.equal(f.requests.filter(domainWrite).length,point==='create'?1:point==='message'?4:7);
 const recovered=await run(f);assert.equal(recovered.status,'passed',JSON.stringify(recovered));assert.deepEqual(recovered.keys,r.keys);
 const s=state(f,recovered.resources.ticket_id);assert.equal(s.tickets.length,1);assert.equal(s.messages.length,1);assert.equal(s.events.length,3);assert.equal(s.outbox.length,3);
});
for(const corruption of ['etag','replay','location','existingId','html','redirect'])test('R12 refuses unsafe mutation confirmation '+corruption,async()=>{
 const f=await fixture();let changed=false;
 const r=await run(f,async(input,init)=>{
  const req=new Request(input,init),res=await f.fetcher(req);
  if(!changed&&domainWrite(req)){
   changed=true;
   if(corruption==='html'){await res.body?.cancel();return new Response('<html>SYNTHETIC_SECRET</html>',{status:200,headers:{'content-type':'text/html'}});}
   if(corruption==='redirect'){await res.body?.cancel();return new Response(null,{status:307,headers:{location:'https://other.invalid'}});}
   const b=await res.json();const h=Object.fromEntries(res.headers);
   if(corruption==='etag')h.etag='"999"';if(corruption==='replay')h['idempotency-replayed']='true';if(corruption==='location')h.location='https://other.invalid/'+b.id;
   if(corruption==='existingId'){b.id=f.config.readFixture.accountA.ticketId;h.location='/v1/tickets/'+b.id;}
   return response(req,b,201,h);
  }return res;
 });
 assert.equal(r.status,'failed');assert.equal(f.requests.filter(domainWrite).length,1);assert.equal(r.checks.find((c:any)=>c.id==='create-ticket').outcome,'unknown');
});
test('R12 creation replay after mutation must preserve the historical receipt, not return the current ticket',async()=>{
 const f=await fixture();let creates=0;
 const r=await run(f,async(input,init)=>{
  const req=new Request(input,init),res=await f.fetcher(req);
  if(path(req)==='/v1/tickets'&&req.method==='POST'&&++creates===4){const b=await res.json();b.priority='high';b.version=3;return response(req,b,200,{...Object.fromEntries(res.headers),etag:'"3"'});}return res;
 });
 assert.equal(r.status,'failed');assert.equal(r.checks.find((c:any)=>c.id==='historical-create-replay').status,'failed');
});
test('R12 an unavailable conflict response is not proof of expected refusal',async()=>{
 const f=await fixture();let creates=0;
 const r=await run(f,async(input,init)=>{const req=new Request(input,init);if(path(req)==='/v1/tickets'&&req.method==='POST'&&++creates===3){f.requests.push(req);return response(req,{status:503,code:'database_unavailable'},503);}return f.fetcher(req);});
 assert.equal(r.status,'failed');assert.equal(r.checks.find((c:any)=>c.id==='conflict-ticket').outcome,'unknown');assert.equal(f.requests.filter(domainWrite).length,3);
});
test('R12 caller mutation during preflight cannot redirect writes or replace tokens',async()=>{
 const f=await fixture(),original=structuredClone(f.config),originalToken=f.tokens.requesterA;
 const r=await run(f,async(input,init)=>{f.config.readFixture.origin='https://other.invalid';f.config.executionId=uuid(9599);f.tokens.requesterA='bad';return f.fetcher(input,init);});
 assert.equal(r.status,'passed',JSON.stringify(r));assert.equal(r.origin,original.readFixture.origin);assert.ok(r.keys.create.includes(original.executionId));
 assert.ok(f.requests.filter(domainWrite).filter(q=>q.method==='POST').every(q=>q.headers.get('authorization')==='Bearer '+originalToken));
});
test('R12 failure of outbox in the reference adapter is not reported as successful creation',async()=>{
 const f=await fixture();f.db.failOutbox=true;const before=f.db.snapshot(),r=await run(f);
 assert.equal(r.status,'failed');assert.equal(r.checks.find((c:any)=>c.id==='create-ticket').outcome,'unknown');assert.deepEqual(f.db.snapshot(),before);
});
test('R12 CLI default prints a plan without exposing credentials from the environment',async()=>{
 await implementation();const f=await fixture(),dir=await mkdtemp(join(tmpdir(),'helpdesk-write-cli-'));
 try{const file=join(dir,'fixture.json');await writeFile(file,JSON.stringify(f.config));const env:NodeJS.ProcessEnv={...process.env,HELPDESK_TEST_HUMAN_A:'DO_NOT_PRINT'};delete env.NODE_TEST_CONTEXT;
  const r=spawnSync(process.execPath,['--experimental-strip-types','scripts/hosted-write-acceptance.ts','--config',file],{encoding:'utf8',env,timeout:10000});
  assert.equal(r.status,0,r.stderr);const plan=JSON.parse(r.stdout);assert.equal(plan.status,'planned');assert.equal(plan.transport,'none');assert.equal((r.stdout+r.stderr).includes('DO_NOT_PRINT'),false);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('R12 real loopback HTTP sockets exercise the new journey without claiming hosted authentication',async()=>{
 const f=await fixture();const server=createServer(async(req,res)=>{try{
  const chunks:Buffer[]=[];for await(const part of req)chunks.push(Buffer.from(part));
  const headers=new Headers();for(const [name,value] of Object.entries(req.headers))if(value)headers.set(name,Array.isArray(value)?value.join(','):value);
  const body=Buffer.concat(chunks),request=new Request(f.config.readFixture.origin+req.url,{method:req.method,headers,...(body.length?{body}:{})});
  const result=await f.fetcher(request);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch{res.writeHead(500);res.end();}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();assert.ok(address&&typeof address==='object');
 try{
  const fetcher:typeof fetch=(input,init)=>{const req=new Request(input,init),url=new URL(req.url);return fetch(`http://127.0.0.1:${address.port}${url.pathname}${url.search}`,{method:req.method,headers:req.headers,body:req.method==='GET'?undefined:req.body,duplex:'half',signal:req.signal,redirect:'error'} as RequestInit);};
  const r=await run(f,fetcher);assert.equal(r.status,'passed',JSON.stringify(r));assert.equal(r.transport,'injected');assert.equal(r.atomicity_verified,false);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
for(const corruption of ['oversized','invalid-utf8','unexpected-private-data'])test('R12 unsafe response body keeps mutation unconfirmed: '+corruption,async()=>{
 const f=await fixture();let changed=false;
 const r=await run(f,async(input,init)=>{const req=new Request(input,init),res=await f.fetcher(req);
  if(!changed&&domainWrite(req)){changed=true;const b=await res.json();
   if(corruption==='unexpected-private-data'){b.policy={SYNTHETIC_SECRET:'private'};return response(req,b,201,Object.fromEntries(res.headers));}
   const bytes=corruption==='oversized'?new TextEncoder().encode(JSON.stringify({extra:'x'.repeat(65536)})):new Uint8Array([123,34,97,34,58,34,255,34,125]);
   return new Response(bytes,{status:201,headers:res.headers});
  }return res;
 });assert.equal(r.status,'failed');assert.equal(r.checks.find((c:any)=>c.id==='create-ticket').outcome,'unknown');assert.equal(f.requests.filter(domainWrite).length,1);assert.equal(JSON.stringify(r).includes('SYNTHETIC_SECRET'),false);
});
test('R12 unfinished mutation body respects the five-second deadline and is not retried',async()=>{
 const f=await fixture();let changed=false,cancelled=false;const keepAlive=setTimeout(()=>{},6500);
 try{const r=await run(f,async(input,init)=>{const req=new Request(input,init),res=await f.fetcher(req);
  if(!changed&&domainWrite(req)){changed=true;await res.body?.cancel();return new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:201,headers:res.headers});}return res;});
  assert.equal(r.status,'failed');assert.equal(r.checks.find((c:any)=>c.id==='create-ticket').code,'invalid_json_response');assert.equal(cancelled,true);assert.equal(f.requests.filter(domainWrite).length,1);
 }finally{clearTimeout(keepAlive);}
});
test('R12 a modified replay body is refused even when HTTP replay headers look correct',async()=>{
 const f=await fixture();let count=0;
 const r=await run(f,async(input,init)=>{const req=new Request(input,init),res=await f.fetcher(req);
  if(path(req)==='/v1/tickets'&&req.method==='POST'&&++count===2){const b=await res.json();b.updated_at='2030-01-01T00:00:00Z';return response(req,b,200,Object.fromEntries(res.headers));}return res;});
 assert.equal(r.status,'failed');assert.equal(f.requests.filter(domainWrite).length,2);
});
test('R12 partial or duplicated final collections do not prove uniqueness',async()=>{
 const f=await fixture(),r=await run(f,async(input,init)=>{const req=new Request(input,init),res=await f.fetcher(req);
  if(path(req)==='/v1/tickets'&&req.method==='GET'&&new URL(req.url).searchParams.has('q')){const b=await res.json();b.next_cursor='more';return response(req,b);}return res;});
 assert.equal(r.status,'failed');assert.equal(r.checks.find((c:any)=>c.id==='unique-ticket').status,'failed');assert.equal(r.atomicity_verified,false);
});
for(const args of [['--execute'],['--allow-ticket-mutations'],['--config','--execute'],['--config','missing','--password','PRIVATE_SENTINEL'],['--config','missing','--config','another']])test('R12 CLI refuses incomplete, repeated or secret-bearing flags '+args[0],async()=>{
 const env:NodeJS.ProcessEnv={...process.env};delete env.NODE_TEST_CONTEXT;
 const r=spawnSync(process.execPath,['--experimental-strip-types','scripts/hosted-write-acceptance.ts',...args],{encoding:'utf8',env,timeout:10000});
 assert.equal(r.status,1);assert.equal((r.stdout+r.stderr).includes('PRIVATE_SENTINEL'),false);assert.equal(r.stdout,'');
});

test('R12 inconsistent resolved coverage cardinality fails before creating a ticket',async()=>{
 const f=await fixture(),r=await run(f,async(input,init)=>{const req=new Request(input,init),res=await f.fetcher(req);
  if(path(req)==='/v1/contexts/resolve'){const b=await res.json();b.candidates.push({...b.candidates[0],coverage_id:uuid(9901)});return response(req,b);}return res;});
 assert.equal(r.status,'failed');assert.equal(f.requests.filter(domainWrite).length,0);
});

test('R12 expired idempotency receipt is an explicit stop, never permission to generate a new key',async()=>{
 const f=await fixture(),r=await run(f,async(input,init)=>{const req=new Request(input,init);
  if(domainWrite(req)){f.requests.push(req);return response(req,{status:409,code:'idempotency_expired'},409);}return f.fetcher(req);});
 assert.equal(r.status,'failed');assert.equal(r.checks.find((c:any)=>c.id==='create-ticket').code,'idempotency_expired');assert.equal(f.requests.filter(domainWrite).length,1);
 assert.ok(r.keys.create.includes(f.config.executionId));assert.equal(r.checks.find((c:any)=>c.id==='create-ticket').outcome,'unknown');
});
