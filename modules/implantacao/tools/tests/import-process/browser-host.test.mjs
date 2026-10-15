// Execute the actual frontend bootstrap with its Supabase/UI ports stubbed.
// Real Vuex and the real process service provide state and valid case envelopes.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {environment,command,scope,id,empty} from './fixtures.mjs';
import {createImportProcessService} from '../../../modules/import-process/service.ts';
const require=createRequire(import.meta.url);
const {loadSource,root}=require('../import-integrity/load-source.cjs');
const frontendRequire=createRequire(path.join(root,'frontend/package.json'));
const ts=frontendRequire('typescript');
const {createStore}=frontendRequire('vuex');

function frontendFactory(sb){
 const filename=path.join(root,'frontend/src/services/importProcessSession.ts');
 const source=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};
 new vm.Script('(function(require,module,exports){'+source+'\n})',{filename}).runInThisContext()(
  specifier=>specifier==='./supabaseClient'?{getSupabaseAsync:async()=>sb}:loadSource(path.relative(root,path.resolve(path.dirname(filename),specifier))),module,module.exports);
 return module.exports.startImportProcessHost;
}

test('a late initial open cannot replace the newer process or discard its edits',async()=>{
 const e=environment(),service=createImportProcessService(e.options());
 await service.createCase({},command());
 const other={...scope,caseId:id(9)};
 await service.createCase({}, {...command(11),scope:other});
 const values=new Map([[scope.caseId,await service.getCase({},scope)],[other.caseId,await service.getCase({},other)]]);
 let releaseA,held=false;
 const sb={auth:{getSession:async()=>({data:{session:{user:{id:id(4)},access_token:'test-token'}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};
 const previousWindow=globalThis.window;
 globalThis.window={location:{origin:'https://setup.example.test'},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},async fetch(url){
  const u=new URL(url);
  if(u.pathname.endsWith('/session'))return Response.json({actorId:id(4),scopes:[{workspaceId:scope.workspaceId,accountId:scope.accountId,requesterId:id(4),workRef:null,role:'requester'}],enabled:true,sourceIntegration:'prepared'});
  const caseId=u.pathname.split('/').pop();
  if(caseId===scope.caseId&&!held){held=true;await new Promise(resolve=>{releaseA=resolve;});}
  return Response.json(values.get(caseId),{headers:{etag:'"imp:'+caseId+':1"'}});
 }};
 let host,openingA;
 try{
  const store=createStore({});
  host=await frontendFactory(sb)(store);
  openingA=host.open(scope.caseId).catch(()=>undefined);
  while(!releaseA)await new Promise(resolve=>setImmediate(resolve));
  await host.open(other.caseId);
  await store.dispatch('importProcess/edit',{...empty(),findings:[{text:'Newer process edit must survive'}]});
  assert.equal(store.state.importProcess.caseId,other.caseId);
  releaseA();await openingA;
  assert.equal(store.state.importProcess.caseId,other.caseId);
  assert.equal(store.state.importProcess.dirty,true);
  assert.equal(store.state.importProcess.draft.findings[0].text,'Newer process edit must survive');
 }finally{
  releaseA?.();await openingA;host?.dispose();
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
 }
});

test('disposing during an initial open aborts it and never registers late private state',async()=>{
 const e=environment(),service=createImportProcessService(e.options());await service.createCase({},command());
 const data=await service.getCase({},scope);
 let release,signal,unsubscribed=0,writes=0;
 const sb={auth:{getSession:async()=>({data:{session:{user:{id:id(4)},access_token:'test-token'}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){unsubscribed++;}}}})}};
 const previousWindow=globalThis.window;
 globalThis.window={location:{origin:'https://setup.example.test'},sessionStorage:{getItem(){assert.fail('late open must not read recovery data');},setItem(){assert.fail('late open must not write recovery data');},removeItem(){assert.fail('late open must not clear recovery data');}},async fetch(url,init){
  if(new URL(url).pathname.endsWith('/session'))return Response.json({actorId:id(4),scopes:[{workspaceId:scope.workspaceId,accountId:scope.accountId,requesterId:id(4),workRef:null,role:'requester'}],enabled:true,sourceIntegration:'prepared'});
  if(init.method!=='GET')writes++;
  signal=init.signal;await new Promise(resolve=>{release=resolve;});
  return Response.json(data,{headers:{etag:'"imp:'+scope.caseId+':1"'}});
 }};
 let host,opening;
 try{
  const store=createStore({state:{setup:{preserved:true}}});host=await frontendFactory(sb)(store);
  opening=host.open(scope.caseId).then(()=>({fulfilled:true}),()=>({fulfilled:false}));
  while(!release)await new Promise(resolve=>setImmediate(resolve));
  host.dispose();assert.equal(signal.aborted,true);release();
  assert.equal((await opening).fulfilled,false);
  assert.equal(store.hasModule('importProcess'),false);assert.equal(store.state.importProcess,undefined);
  assert.equal(store.state.setup.preserved,true);assert.equal(unsubscribed,1);assert.equal(writes,0);
 }finally{
  release?.();await opening;host?.dispose();
  if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;
 }
});
