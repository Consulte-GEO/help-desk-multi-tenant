import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {runHostedWriteAcceptance} from '../scripts/hosted-write-acceptance-core.ts';
import {hostedFixture,uuid} from './fixtures/hosted-acceptance-fixture.ts';

async function fixture(){const f=await hostedFixture();return {...f,writeConfig:{schema:1,readFixture:f.config,executionId:uuid(9601),coverageId:uuid(401),includeMachineWrites:true}};}
type Fixture=Awaited<ReturnType<typeof fixture>>;
async function run(f:Fixture,fetcher:typeof fetch=f.fetcher){
 const plan=await runHostedWriteAcceptance(f.writeConfig);
 return runHostedWriteAcceptance(f.writeConfig,f.tokens,{execute:true,allowTicketMutations:true,confirmOrigin:f.config.origin,confirmConfigSha256:plan.config_sha256,fetcher});
}
const domainWrite=(r:Request)=>r.method!=='GET'&&new URL(r.url).pathname.startsWith('/v1/tickets');
const machine=(f:Fixture,r:Request)=>r.headers.get('authorization')==='Bearer '+f.tokens.machineA;
const changed=(r:Request,value:unknown,status:number,headers?:Headers)=>new Response(JSON.stringify(value),{status,headers:headers??{
 'content-type':status>=400?'application/problem+json':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','x-request-id':r.headers.get('x-request-id')!}});

test('R15 legacy config still plans eighteen steps and no M2M write keys',async()=>{
 const f=await fixture(),{includeMachineWrites,...legacy}=f.writeConfig;
 const p=await runHostedWriteAcceptance(legacy);assert.equal(p.checks.length,18);assert.equal((p as any).machine,undefined);
 const disabled=await runHostedWriteAcceptance({...legacy,includeMachineWrites:false});assert.equal(disabled.checks.length,18);assert.equal((disabled as any).machine,undefined);
});
test('R15 explicit machine plan is credential-free and has separate stable keys',async()=>{
 const f=await fixture();let sent=0;
 const p=await runHostedWriteAcceptance(f.writeConfig,new Proxy({},{get(){throw Error('TOKEN_READ');}}),{fetcher:async()=>{sent++;throw Error();}});
 assert.equal(sent,0);assert.equal(p.transport,'none');assert.equal(p.preflight.checks.length,28);assert.equal(p.checks.length,43);
 assert.ok(p.checks.every(c=>c.status==='not_run'));const block=(p as any).machine;assert.ok(block);assert.notEqual(block.keys.create,p.keys.create);
 assert.ok(block.keys.create.includes(':machine:'));assert.equal(p.atomicity_verified,false);assert.equal(p.platform_approved,false);
 assert.deepEqual((await runHostedWriteAcceptance(f.writeConfig) as any).machine.keys,block.keys);
});
for(const flag of ['true',1,null,{}])test('R15 rejects nonboolean machine opt-in '+JSON.stringify(flag),async()=>{
 const f=await fixture();await assert.rejects(()=>runHostedWriteAcceptance({...f.writeConfig,includeMachineWrites:flag}));assert.equal(f.requests.length,0);
});
test('R15 approval hash of a human-only plan cannot enable machine mutations',async()=>{
 const f=await fixture(),{includeMachineWrites,...old}=f.writeConfig,previous=await runHostedWriteAcceptance(old);
 await assert.rejects(()=>runHostedWriteAcceptance(f.writeConfig,f.tokens,{execute:true,allowTicketMutations:true,confirmOrigin:f.config.origin,confirmConfigSha256:previous.config_sha256,fetcher:f.fetcher}));
 assert.equal(f.requests.length,0);
});
test('R15 handler and memory prove two authors, unique effects and unchanged denied writes',async()=>{
 const f=await fixture(),r=await run(f);assert.equal(r.status,'passed',JSON.stringify(r.checks));assert.equal(r.checks.length,43);assert.equal(r.transport,'injected');
 const s=f.db.snapshot(),m=(r as any).machine,tid=m.resources.ticket_id;assert.ok(tid);assert.notEqual(tid,r.resources.ticket_id);
 const t=s.tickets.find(x=>x.id===tid)!;assert.equal(t.createdBy,f.config.integrationId);assert.equal(t.version,2);assert.equal(t.priority,'normal');
 const msgs=s.messages.filter(x=>x.ticketId===tid);assert.equal(msgs.length,1);assert.equal(msgs[0]!.actorType,'integration');
 assert.equal(s.notes.filter(x=>x.ticketId===tid).length,0);assert.equal(s.events.filter(x=>x.ticketId===tid).length,2);assert.equal(s.outbox.filter(x=>x.ticketId===tid).length,2);
 assert.equal(s.tickets.filter(x=>x.subject.includes(f.writeConfig.executionId)).length,2);
 assert.equal(s.tickets.find(x=>x.id===r.resources.ticket_id)!.version,3);
 assert.equal(s.messages.filter(x=>x.ticketId===r.resources.ticket_id).length,1);
 assert.ok(r.checks.filter(c=>c.id.includes('deny-')||c.id.includes('cannot-write-')).every(c=>c.outcome==='rejected'));
 assert.equal(r.postgres_tested,false);assert.equal(r.atomicity_verified,false);assert.equal(r.outbox_delivery_tested,false);
 const report=JSON.stringify(r);for(const token of Object.values(f.tokens))assert.ok(!report.includes(token));assert.ok(!report.includes(f.config.internalNoteMarker));
});
test('R15 machine capability mismatch blocks BEFORE human domain writes',async()=>{
 const f=await fixture();f.people[f.tokens.machineA]!.scopes=['contexts:resolve','tickets:read'];
 const r=await run(f);assert.equal(r.status,'failed');assert.equal(r.checks.find(c=>c.id==='machine-write-scope')?.status,'failed');assert.equal(f.requests.filter(domainWrite).length,0);
});
test('R15 machine coverage must agree with the human context before any domain write',async()=>{
 const f=await fixture(),r=await run(f,async(input,init)=>{const req=new Request(input,init),res=await f.fetcher(req);
  if(machine(f,req)&&new URL(req.url).pathname==='/v1/contexts/resolve'){const b=await res.json();b.candidates[0].contract_version_id=uuid(9991);return changed(req,b,res.status,res.headers);}return res;});
 assert.equal(r.status,'failed');assert.equal(r.checks.find(c=>c.id==='machine-resolve-coverage')?.status,'failed');assert.equal(f.requests.filter(domainWrite).length,0);
});
for(const operation of ['ticket','message'])test('R15 lost '+operation+' response stops and explicit same-key rerun does not duplicate',async()=>{
 const f=await fixture();let lost=false;
 const r=await run(f,async(input,init)=>{const req=new Request(input,init),res=await f.fetcher(req),path=new URL(req.url).pathname;
  if(!lost&&machine(f,req)&&req.method==='POST'&&(operation==='ticket'?path==='/v1/tickets':path.endsWith('/messages'))){lost=true;await res.body?.cancel();throw Error('PRIVATE_NETWORK_DETAIL');}return res;});
 assert.equal(lost,true);assert.equal(r.status,'failed');const failed=r.checks.find(c=>c.status==='failed')!;assert.equal(failed.outcome,'unknown');assert.equal(failed.id,operation==='ticket'?'machine-create-ticket':'machine-create-message');
 assert.ok(r.checks.slice(r.checks.indexOf(failed)+1).every(c=>c.status==='blocked'));assert.ok(!JSON.stringify(r).includes('PRIVATE_NETWORK_DETAIL'));
 const next=await run(f);assert.equal(next.status,'passed',JSON.stringify(next.checks));assert.deepEqual((r as any).machine.keys,(next as any).machine.keys);
 const id=(next as any).machine.resources.ticket_id,s=f.db.snapshot();assert.equal(s.tickets.filter(x=>x.id===id).length,1);assert.equal(s.messages.filter(x=>x.ticketId===id).length,1);assert.equal(s.events.filter(x=>x.ticketId===id).length,2);assert.equal(s.outbox.filter(x=>x.ticketId===id).length,2);
});
test('R15 a forged machine replay receipt fails closed with no subsequent send',async()=>{
 const f=await fixture();let count=0;
 const r=await run(f,async(input,init)=>{const req=new Request(input,init),res=await f.fetcher(req);
  if(machine(f,req)&&req.method==='POST'&&new URL(req.url).pathname==='/v1/tickets'&&++count===2){const b=await res.json();b.updated_at='2032-01-01T00:00:00Z';return changed(req,b,200,res.headers);}return res;});
 assert.equal(r.status,'failed');assert.equal(r.checks.find(c=>c.id==='machine-replay-ticket')?.status,'failed');assert.equal(count,2);
});
test('R15 machine message cannot be mislabeled as a human response',async()=>{
 const f=await fixture(),r=await run(f,async(input,init)=>{const req=new Request(input,init),res=await f.fetcher(req);
  if(machine(f,req)&&req.method==='POST'&&new URL(req.url).pathname.endsWith('/messages')&&res.status===201){const b=await res.json();b.actor_type='human_agent';return changed(req,b,201,res.headers);}return res;});
 assert.equal(r.status,'failed');assert.equal(r.checks.find(c=>c.id==='machine-create-message')?.code,'contract_mismatch');
});
test('R15 a successful forbidden account write is not reported as an expected rejection',async()=>{
 const f=await fixture(),r=await run(f,async(input,init)=>{const req=new Request(input,init);
  if(domainWrite(req)&&machine(f,req)&&new URL(req.url).pathname==='/v1/tickets'&&req.headers.get('idempotency-key')?.endsWith('deny-account'))return changed(req,{},201);
  return f.fetcher(req);});
 assert.equal(r.status,'failed');const c=r.checks.find(x=>x.id==='machine-deny-account')!;assert.equal(c.status,'failed');assert.equal(c.outcome,'unknown');
});
test('R15 partial machine collection cannot prove unique resources',async()=>{
 const f=await fixture(),r=await run(f,async(input,init)=>{const req=new Request(input,init),res=await f.fetcher(req);
  if(machine(f,req)&&req.method==='GET'&&new URL(req.url).searchParams.has('q')){const b=await res.json();b.next_cursor='pending';return changed(req,b,200,res.headers);}return res;});
 assert.equal(r.status,'failed');assert.equal(r.checks.find(c=>c.id==='machine-unique-ticket')?.status,'failed');
});
test('R15 explicit machine scenario runs through native HTTP loopback without hosted claims',async()=>{
 const f=await fixture();const server=createServer(async(req,res)=>{try{
  const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
  const request=new Request(f.config.origin+req.url,{method:req.method,headers:req.headers as Record<string,string>,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
  const result=await f.handler(request);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
 }catch{res.writeHead(500);res.end();}});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const port=(server.address() as {port:number}).port;const r=await run(f,(input,init)=>fetch('http://127.0.0.1:'+port+new URL(String(input)).pathname+new URL(String(input)).search,init));assert.equal(r.status,'passed',JSON.stringify(r.checks));assert.equal(r.transport,'injected');assert.equal(r.operational,false);}
 finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
