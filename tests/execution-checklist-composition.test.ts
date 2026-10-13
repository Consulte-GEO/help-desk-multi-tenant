import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {createExecutionChecklistController} from '../web/execution-checklist-state.js';
import {markingFixture,id} from './fixtures/checklist/marking.ts';
import {createChecklistCompositionFixture,CHECKLIST_FIXTURE_ORIGIN,CHECKLIST_FIXTURE_AUTH} from './fixtures/checklist/composition.ts';

// Integration through the SAME HTTP/service/resolver/store/transaction used by
// the module. Only identity authority and the physical SQL transport are models.
// No PostgreSQL, IdP, hosted write or browser acceptance is implied by this test.
test('HDN01k checklist fixture exercises the real application boundaries',async t=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const child=spawn(process.execPath,['--experimental-strip-types','tests/fixtures/checklist/browser-server.ts'],{
  cwd:root,env:{...process.env,HELPDESK_OWNED_CHECKLIST_BROWSER:'synthetic-loopback'},stdio:['ignore','pipe','pipe']});
 const closed=new Promise<void>(resolve=>child.once('close',()=>resolve()));
 const lines=createInterface({input:child.stdout});let timer:ReturnType<typeof setTimeout>|undefined;
 let stderr='';child.stderr.on('data',part=>{stderr=(stderr+part.toString()).slice(-2048);});
 try{
  const base=await new Promise<string>((resolve,reject)=>{
   timer=setTimeout(()=>reject(Error('Owned composition fixture did not start')),5000);
   child.once('error',reject);child.once('close',()=>reject(Error('Fixture exited: '+stderr)));
   lines.once('line',line=>{try{const r=JSON.parse(line);assert.match(r.url,/^http:\/\/127\.0\.0\.1:\d+$/);resolve(r.url);}catch(e){reject(e);}});
  });clearTimeout(timer);
  const f=markingFixture(),endpoint='/v1/internal/tickets/'+id(6)+'/execution-checklist';
  const counts=async()=>await (await fetch(base+'/_test/counts')).json();
  const mode=async(value:string)=>{const r=await fetch(base+'/_test/mode?value='+value,{method:'POST'});assert.equal(r.status,200);};
  const reset=async()=>{assert.equal((await fetch(base+'/_test/reset',{method:'POST'})).status,200);};
  const request=(path:string,init:RequestInit={})=>fetch(base+path,{...init,headers:{authorization:'Bearer synthetic-checklist-human',origin:base,...Object.fromEntries(new Headers(init.headers))}});
  const mark=(command:unknown=f.command,headers:Record<string,string>={})=>request(endpoint+'/marks',{method:'POST',headers:{'content-type':'application/json','if-match':'"0"','idempotency-key':'hdn01k-synthetic-mark-0001',...headers},body:JSON.stringify(command)});
  const make=()=>createExecutionChecklistController({audience:{principalId:f.principal.id,workspaceId:f.context.workspaceId,accountId:f.context.accountId,ticketId:f.context.ticketId,canWrite:true},request});
  const prepare=async(c:ReturnType<typeof make>)=>{assert.equal(await c.load(),true);assert.equal(c.editItem('grupo'),true);assert.equal(await c.loadEvidence(),true);assert.equal(c.toggleEvidence(id(90)),true);assert.equal(c.review(),true);};

  await t.test('normal browser transport passes real read and write boundaries',async()=>{
   await reset();const c=make();await prepare(c);assert.equal((await counts()).writes,0);
   assert.equal(await c.confirm(),true);assert.equal(c.view().phase,'refresh_required');
   const n=await counts();assert.equal(n.writes,1);assert.ok(n.authChecks>=3);assert.ok(n.resourceReads>=6);assert.ok(n.scopeChecks>=3);assert.equal(n.sqlMarks,1);
   assert.equal(n.boundary,'real-handler-service-resolver-store-runner');c.destroy();
  });
  await t.test('missing synthetic authentication does not reveal the checklist',async()=>{
   await reset();const r=await fetch(base+endpoint);assert.equal(r.status,401);assert.equal((await r.json()).code,'unauthorized');
   assert.equal((await counts()).resourceReads,0);
  });
  await t.test('wrong request origin is rejected before the service',async()=>{
   await reset();const r=await mark(f.command,{origin:'https://other.example.test'});assert.equal(r.status,403);assert.equal((await r.json()).code,'origin_denied');assert.equal((await counts()).sqlMarks,0);
  });
  await t.test('the HTTPS fixture alias is not a second caller origin',async()=>{
   await reset();const r=await mark(f.command,{origin:CHECKLIST_FIXTURE_ORIGIN});assert.equal(r.status,403);assert.equal((await counts()).sqlMarks,0);
  });
  await t.test('the production HTTP origin guard is also exercised without the loopback shim',async()=>{
   const fixture=createChecklistCompositionFixture();
   const r=await fixture.handler(new Request(CHECKLIST_FIXTURE_ORIGIN+endpoint+'/marks',{method:'POST',headers:{authorization:CHECKLIST_FIXTURE_AUTH,origin:'https://other.example.test','content-type':'application/json','if-match':'"0"','idempotency-key':'hdn01k-direct-handler-0001'},body:JSON.stringify(f.command)}));
   assert.equal(r.status,403);assert.equal((await r.json()).code,'origin_denied');assert.equal(fixture.counts().authChecks,0);assert.equal(fixture.counts().sqlMarks,0);
  });
  await t.test('invalid UTF-8 reaches the fatal JSON decoder without replacement',async()=>{
   await reset();const r=await request(endpoint+'/marks',{method:'POST',headers:{'content-type':'application/json','if-match':'"0"','idempotency-key':'hdn01k-invalid-utf8-0001'},body:Uint8Array.from([123,34,120,34,58,34,255,34,125]).buffer});
   assert.equal(r.status,400);assert.equal((await r.json()).code,'invalid_json');assert.equal((await counts()).sqlMarks,0);
  });
  await t.test('plain text cannot bypass the controlled JSON reader',async()=>{
   await reset();const r=await mark(f.command,{'content-type':'text/plain'});assert.equal(r.status,415);assert.equal((await counts()).writes,0);
  });
  await t.test('GET cannot record a marking',async()=>{
   await reset();const r=await request(endpoint+'/marks');assert.equal(r.status,405);assert.equal((await counts()).sqlMarks,0);
  });
  await t.test('missing precondition and missing idempotency key do not start SQL',async()=>{
   await reset();let r=await mark(f.command,{'if-match':''});assert.equal(r.status,428);
   r=await mark(f.command,{'idempotency-key':''});assert.equal(r.status,400);assert.equal((await counts()).scopeChecks,0);
  });
  await t.test('foreign workspace scope is rejected by the persisted-scope guard',async()=>{
   await reset();await mode('bad_scope');const r=await request(endpoint);assert.equal(r.status,403);assert.equal((await r.json()).code,'resource_scope_database_mismatch');
   const n=await counts();assert.equal(n.scopeChecks,1);assert.equal(n.sqlMarks,0);assert.equal(n.rollbacks,1);
  });
  await t.test('invalid receipt after SQL staging cannot leave a committed mark',async()=>{
   await reset();await mode('bad_receipt');const r=await mark();assert.equal(r.status,503);assert.equal((await r.json()).code,'checklist_store_invalid');
   const n=await counts();assert.equal(n.sqlMarks,1);assert.equal(n.writes,0);assert.equal(n.rollbacks,1);
  });
  await t.test('closing the gate during staging prevents COMMIT',async()=>{
   await reset();await mode('gate_during_mark');const r=await mark();assert.equal(r.status,503);assert.equal((await r.json()).code,'release_gate_closed');
   const n=await counts();assert.equal(n.sqlMarks,1);assert.equal(n.writes,0);assert.equal(n.rollbacks,1);
  });
  await t.test('closure after acknowledged commit does not turn success into a refusal',async()=>{
   await reset();await mode('gate_after_commit');const r=await mark();assert.equal(r.status,200);assert.equal((await counts()).writes,1);
   const read=await request(endpoint);assert.equal(read.status,503);assert.equal((await read.json()).code,'release_gate_closed');
  });
  await t.test('lost database COMMIT response reconciles without a second SQL mark',async()=>{
   await reset();const c=make();await prepare(c);await mode('lost');assert.equal(await c.confirm(),false);assert.equal(c.view().phase,'unknown');
   let n=await counts();assert.equal(n.writes,1);assert.equal(n.sqlMarks,1);assert.equal(c.editItem('email'),false);
   await mode('conflict');assert.equal(await c.reconcile(),false);assert.equal(c.view().phase,'unknown');
   await mode('normal');assert.equal(await c.reconcile(),true);n=await counts();assert.equal(n.writes,1);assert.equal(n.sqlMarks,1);
   assert.equal(n.attempts.length,3);assert.deepEqual(n.attempts[0],n.attempts[1]);assert.deepEqual(n.attempts[1],n.attempts[2]);c.destroy();
  });
  await t.test('unassigned operator can read but cannot mark or select evidence',async()=>{
   await reset();await mode('unassigned');const c=make();assert.equal(await c.load(),true);assert.equal(c.view().canEdit,false);
   const r=await mark();assert.equal(r.status,403);assert.equal((await counts()).sqlMarks,0);c.destroy();
  });
  await t.test('missing evidence is refused by the service before mutation',async()=>{
   await reset();await mode('missing_evidence');const r=await mark();assert.equal(r.status,403);assert.equal((await r.json()).code,'checklist_evidence_denied');assert.equal((await counts()).sqlMarks,0);
  });
  await t.test('private extra metadata is neither an empty page nor rendered content',async()=>{
   await reset();const c=make();await c.load();c.editItem('grupo');await mode('malformed_page');assert.equal(await c.loadEvidence(),false);
   assert.equal(c.view().evidence.phase,'error');assert.doesNotMatch(JSON.stringify(c.view()),/PRIVATE_TRANSPORT_MARKER/);assert.equal((await counts()).sqlMarks,0);c.destroy();
  });
  await t.test('reset restores synthetic state, never a published grant or template',async()=>{
   await reset();const n=await counts();assert.equal(n.writes,0);assert.equal(n.resourceReads,0);assert.equal(n.authChecks,0);assert.deepEqual(n.attempts,[]);
   const r=await fetch(base+'/src/application/execution-checklist.ts');assert.equal(r.status,404);
  });
 }finally{clearTimeout(timer);lines.close();child.kill('SIGTERM');const forced=setTimeout(()=>child.kill('SIGKILL'),1000);await closed;clearTimeout(forced);}
});
