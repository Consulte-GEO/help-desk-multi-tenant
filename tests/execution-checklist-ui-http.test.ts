import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {createExecutionChecklistController} from '../web/execution-checklist-state.js';
import {markingFixture,id} from './fixtures/checklist/marking.ts';
import {CHECKLIST_FIXTURE_AUTH} from './fixtures/checklist/composition.ts';

// Real local HTTP/controller/handler/service/resolver/adapter/runner. The identity
// authority and physical SQL transport are explicitly SYNTHETIC. No browser, live Auth or PostgreSQL is implied.
test('HDN optional controller composes with an owned HTTP fixture',async t=>{
 const root=fileURLToPath(new URL('../',import.meta.url));
 const child=spawn(process.execPath,['--experimental-strip-types','tests/fixtures/checklist/browser-server.ts'],{cwd:root,env:{...process.env,HELPDESK_OWNED_CHECKLIST_BROWSER:'synthetic-loopback'},stdio:['ignore','pipe','pipe']});
 const closed=new Promise<void>(resolve=>child.once('close',()=>resolve()));
 const lines=createInterface({input:child.stdout});let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const base=await new Promise<string>((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Fixture startup timeout')),5000);child.once('error',reject);child.once('close',()=>reject(Error('Fixture exited')));lines.once('line',line=>{try{const {url}=JSON.parse(line);assert.match(url,/^http:\/\/127\.0\.0\.1:\d+$/);resolve(url);}catch(e){reject(e);}});});clearTimeout(timer);
  child.stderr.on('data',()=>{});
  const f=markingFixture();
  const make=()=>createExecutionChecklistController({audience:{principalId:f.principal.id,workspaceId:f.context.workspaceId,accountId:f.context.accountId,ticketId:f.context.ticketId,canWrite:true},request:(path,init)=>fetch(base+path,{...init,headers:{...Object.fromEntries(new Headers(init.headers)),authorization:CHECKLIST_FIXTURE_AUTH,origin:base}})});
  const mode=(value:string)=>fetch(base+'/_test/mode?value='+value,{method:'POST'});
  const counts=async()=>await (await fetch(base+'/_test/counts')).json();
  const reset=()=>fetch(base+'/_test/reset',{method:'POST'});
  const prepare=async(c:ReturnType<typeof make>)=>{assert.equal(await c.load(),true);c.editItem('grupo');c.setField('evidenceText',id(90));assert.equal(c.review(),true);};
  await t.test('read/edit/confirm/reload preserves revisions over actual HTTP',async()=>{
   await reset();const c=make();await prepare(c);assert.equal((await counts()).writes,0);assert.equal(await c.confirm(),true);assert.equal(c.view().phase,'refresh_required');assert.equal((await counts()).writes,1);await c.load();assert.equal(c.view().requiredCompleted,1);c.destroy();
  });
  await t.test('lost confirmation followed by a refusal never creates another intention',async()=>{
   await reset();const c=make();await prepare(c);await mode('lost');await c.confirm();assert.equal(c.view().phase,'unknown');await mode('conflict');await c.reconcile();assert.equal(c.view().phase,'unknown');assert.equal((await counts()).writes,1);
   await mode('normal');assert.equal(await c.reconcile(),true);const result=await counts();assert.equal(result.writes,1);assert.equal(result.attempts.length,3);assert.deepEqual(result.attempts[0],result.attempts[1]);assert.deepEqual(result.attempts[1],result.attempts[2]);c.destroy();
  });
  await t.test('valid-looking note from another record is denied by fixture domain boundary',async()=>{
   await reset();const c=make();await c.load();c.editItem('grupo');c.setField('evidenceText',id(99));assert.equal(c.review(),true);assert.equal(await c.confirm(),false);assert.equal(c.view().phase,'refresh_required');assert.equal((await counts()).writes,0);c.destroy();
  });
  await t.test('access refusal clears old content without exposing the server detail',async()=>{
   await reset();const c=make();await c.load();await mode('forbidden');await c.load();assert.equal(c.view().record,null);assert.equal(JSON.stringify(c.view()).includes('DO_NOT_RENDER_PRIVATE_ERROR'),false);c.destroy();
  });
  await t.test('selecting an eligible note over HTTP prepares the same domain mark without creating evidence',async()=>{
   await reset();const c=make();await c.load();c.editItem('grupo');assert.equal(await c.loadEvidence(),true);assert.equal(c.view().evidence.items.length,1);assert.equal(c.toggleEvidence(id(90)),true);assert.equal((await counts()).writes,0);assert.equal(c.review(),true);assert.equal(await c.confirm(),true);assert.equal((await counts()).writes,1);c.destroy();
  });
  await t.test('fixture serves candidate modules with own-origin CSP and no source artifacts',async()=>{
   const r=await fetch(base+'/');assert.equal(r.status,200);assert.match(r.headers.get('content-security-policy')??'',/script-src 'self'/);assert.equal((await fetch(base+'/web/execution-checklist.js')).status,200);assert.equal((await fetch(base+'/package.json')).status,404);assert.equal((await fetch(base+'/../src/domain/canonical.ts')).status,404);
  });
 }finally{clearTimeout(timer);lines.close();child.kill('SIGTERM');const force=setTimeout(()=>child.kill('SIGKILL'),1000);await closed;clearTimeout(force);}
});
