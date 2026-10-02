/** Fault injection stays inside the test-owned memory fixture; no hosted mutation is run. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {runHostedWriteAcceptance} from '../scripts/hosted-write-acceptance-core.ts';
import {hostedFixture,uuid} from './fixtures/hosted-acceptance-fixture.ts';

const postconditions=['machine-post-denials-notes','machine-post-denials-human-ticket',
 'machine-post-denials-human-messages','machine-post-denials-human-timeline'];
async function fixture(){const f=await hostedFixture();return {...f,writeConfig:{schema:1,readFixture:f.config,
 executionId:uuid(9616),coverageId:uuid(401),includeMachineWrites:true}};}
type Fixture=Awaited<ReturnType<typeof fixture>>;
async function run(f:Fixture,fetcher:typeof fetch=f.fetcher){
 const p=await runHostedWriteAcceptance(f.writeConfig);
 return runHostedWriteAcceptance(f.writeConfig,f.tokens,{execute:true,allowTicketMutations:true,
  confirmOrigin:f.config.origin,confirmConfigSha256:p.config_sha256,fetcher});
}
const humanTicket=(f:Fixture)=>f.db.snapshot().tickets.find(t=>t.createdBy===f.config.accountA.requesterId&&t.subject.includes(f.writeConfig.executionId))!;
const machineTicket=(f:Fixture)=>f.db.snapshot().tickets.find(t=>t.createdBy===f.config.integrationId&&t.subject.includes(f.writeConfig.executionId))!;
const replace=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{
 'content-type':status>=400?'application/problem+json':'application/json','cache-control':'no-store',
 'x-content-type-options':'nosniff','x-request-id':req.headers.get('x-request-id')!}});
function assertFailed(r:Awaited<ReturnType<typeof run>>,id:string){
 assert.equal(r.status,'failed');const index=r.checks.findIndex(c=>c.id===id);assert.ok(index>=0);
 assert.equal(r.checks[index]!.status,'failed');assert.ok(r.checks.slice(index+1).every(c=>c.status==='blocked'));
 assert.equal(r.atomicity_verified,false);assert.equal(r.postgres_tested,false);assert.equal(r.platform_approved,false);
}

test('R16 opt-in plans four read-only postconditions, legacy plans remain unchanged',async()=>{
 const f=await fixture();let reads=0;
 const p=await runHostedWriteAcceptance(f.writeConfig,new Proxy({},{get(){reads++;throw Error('SECRET');}}));
 assert.deepEqual(p.checks.slice(-4).map(c=>c.id),postconditions);assert.equal(p.checks.length,43);
 assert.ok(p.checks.slice(-4).every(c=>c.idempotency_key===null&&c.outcome==='not_applicable'&&c.status==='not_run'));
 assert.equal(reads,0);assert.equal(p.transport,'none');
 const {includeMachineWrites,...legacy}=f.writeConfig;assert.equal((await runHostedWriteAcceptance(legacy)).checks.length,18);
});

test('R16 HTTP 403 cannot conceal a persisted internal note from the final agent read',async()=>{
 const f=await fixture();let injected=false;
 const r=await run(f,async(input,init)=>{
  const req=new Request(input,init),copy=req.clone(),res=await f.fetcher(req);
  if(copy.headers.get('idempotency-key')?.endsWith('machine:deny-note')){
   assert.equal(res.status,403);copy.headers.set('authorization','Bearer '+f.tokens.agentA);
   // Exercise the real service under an authorized test identity to simulate a server side effect.
   const ghost=await f.handler(copy);assert.equal(ghost.status,201);await ghost.body?.cancel();injected=true;
  }
  return res;
 });
 assert.equal(injected,true);assert.equal(f.db.snapshot().notes.filter(n=>n.ticketId===machineTicket(f).id).length,1);
 assertFailed(r,postconditions[0]!);assert.equal(r.checks.find(c=>c.id==='machine-deny-note')?.outcome,'rejected');
 assert.ok(!JSON.stringify(r).includes('Tentativa sintética de nota M2M proibida.'));
});

test('R16 HTTP 404 cannot conceal a persisted message in the previously verified human ticket',async()=>{
 const f=await fixture();let injected=false;
 const r=await run(f,async(input,init)=>{
  const req=new Request(input,init),copy=req.clone(),res=await f.fetcher(req);
  if(copy.headers.get('idempotency-key')?.endsWith('machine:cannot-write-human')){
   assert.equal(res.status,404);copy.headers.set('authorization','Bearer '+f.tokens.requesterA);
   const ghost=await f.handler(copy);assert.equal(ghost.status,201);await ghost.body?.cancel();injected=true;
  }
  return res;
 });
 assert.equal(injected,true);assert.equal(humanTicket(f).version,4);
 assertFailed(r,postconditions[1]!);
});

test('R16 a changed timestamp with the original version is not an unchanged human ticket',async()=>{
 const f=await fixture();let injected=false;
 const r=await run(f,async(input,init)=>{
  const req=new Request(input,init),res=await f.fetcher(req);
  if(req.headers.get('idempotency-key')?.endsWith('machine:deny-account')){
   const t=humanTicket(f);assert.equal(t.version,3);f.db.seedTicket({...t,updatedAt:'2031-01-01T00:00:00Z'});injected=true;
  }
  return res;
 });
 assert.equal(injected,true);assertFailed(r,postconditions[1]!);
});

for(const target of ['messages','timeline'] as const)test('R16 final human '+target+' is re-read after machine denials',async()=>{
 const f=await fixture();let afterDenials=false,altered=false;
 const r=await run(f,async(input,init)=>{
  const req=new Request(input,init),res=await f.fetcher(req);
  if(req.headers.get('idempotency-key')?.endsWith('machine:cannot-write-machine'))afterDenials=true;
  if(afterDenials&&req.method==='GET'&&new URL(req.url).pathname==='/v1/tickets/'+humanTicket(f).id+'/'+target){
   const b=await res.json();b.items[0].created_at='2031-02-02T00:00:00Z';altered=true;return replace(req,b);
  }
  return res;
 });
 assert.equal(altered,true);assertFailed(r,'machine-post-denials-human-'+target);
});

for(const fault of ['missing','paginated','contaminated','network'] as const)test('R16 final notes control refuses '+fault+' without retry or disclosure',async()=>{
 const f=await fixture();let intercepted=0,armed=false;const secret='PRIVATE_R16_NOTE_SENTINEL';
 const r=await run(f,async(input,init)=>{
  const req=new Request(input,init);
  if(req.headers.get('idempotency-key')?.endsWith('machine:cannot-write-machine'))armed=true;
  const isControl=armed&&req.method==='GET'&&new URL(req.url).pathname.endsWith('/notes');
  if(isControl){intercepted++;
   assert.equal(req.headers.get('authorization'),'Bearer '+f.tokens.agentA);
   if(fault==='network')throw Error(secret);
   if(fault==='missing')return replace(req,{status:403,code:'forbidden'},403);
   if(fault==='paginated')return replace(req,{items:[],next_cursor:'pending'});
   return replace(req,{items:[{id:uuid(9899),ticket_id:machineTicket(f).id,body:secret}],next_cursor:null});
  }
  return f.fetcher(req);
 });
 assert.equal(intercepted,1);assertFailed(r,postconditions[0]!);assert.ok(!JSON.stringify(r).includes(secret));
});

test('R16 final controls are GET-only, use existing identities and do not add mutation intents',async()=>{
 const f=await fixture(),r=await run(f);assert.equal(r.status,'passed',JSON.stringify(r.checks));
 assert.deepEqual(r.checks.slice(-4).map(c=>c.id),postconditions);
 const last=f.requests.slice(-4);assert.equal(last.length,4);
 assert.ok(last.every(q=>q.method==='GET'&&!q.headers.has('idempotency-key')));
 assert.equal(last[0]!.headers.get('authorization'),'Bearer '+f.tokens.agentA);
 assert.ok(last.slice(1).every(q=>q.headers.get('authorization')==='Bearer '+f.tokens.requesterA));
 const state=f.db.snapshot(),h=humanTicket(f),m=machineTicket(f);
 assert.equal(h.version,3);assert.equal(m.version,2);assert.equal(state.notes.filter(n=>n.ticketId===m.id).length,0);
 assert.equal(state.tickets.filter(t=>t.subject.includes(f.writeConfig.executionId)).length,2);
 assert.equal(r.transport,'injected');assert.equal(r.atomicity_verified,false);assert.equal(r.operational,false);
});
