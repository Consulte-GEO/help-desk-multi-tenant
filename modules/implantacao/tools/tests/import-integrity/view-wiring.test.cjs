'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../..');
function view(ports={}){
 const s=fs.readFileSync(path.join(root,'frontend/src/views/ImportProcessView.vue'),'utf8');
 const dependencies={
  '../components/ImportProcessPanel.vue':{},
  '../services/importProcessSession':{startImportProcessHost:ports.startImportProcessHost||(()=>{throw Error('unexpected host bootstrap');})},
 };
 const script=s.match(/<script>\s*([\s\S]*?)<\/script>/)[1]
  .replace(/^import\s+(.+?)\s+from\s+(['"])(.+?)\2;?\s*$/gm,(_line,binding,_quote,specifier)=>{
   if(!Object.hasOwn(dependencies,specifier))throw Error('Unsupported view dependency: '+specifier);
   return 'const '+binding+'=dependencies['+JSON.stringify(specifier)+'];';
  }).replace('export default','module.exports=');
 const m={exports:{}};new vm.Script(script).runInNewContext({module:m,dependencies});return m.exports;
}
function context(v,extra={}){return {...v.data.call({caseId:'antigo'}),...extra};}
test('rota não consulta outro processo quando guarda é recusada',async()=>{const v=view(),calls=[],ctx=context(v,{available:true,host:{open:async()=>calls.push('host')},$refs:{panel:{requestExit:async()=>false}},$store:{dispatch:async()=>calls.push('store')}});assert.equal(await v.beforeRouteUpdate.call(ctx,{params:{caseId:'novo'}},{params:{caseId:'antigo'}}),false);assert.equal(calls.length,0)});
test('rota aguarda consulta da seleção nova depois da confirmação',async()=>{
 const v=view(),calls=[];let release,settled=false;
 const ctx=context(v,{available:true,$refs:{panel:{requestExit:async()=>true}},host:{open:async caseId=>{calls.push(caseId);await new Promise(resolve=>{release=resolve;});}},$store:{dispatch:async()=>assert.fail('route must use the authenticated host')}});
 const navigating=v.beforeRouteUpdate.call(ctx,{params:{caseId:'novo'}},{params:{caseId:'antigo'}}).then(value=>{settled=true;return value;});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(calls,['novo']);assert.equal(settled,false);assert.equal(ctx.loading,true);assert.equal(ctx.openedCaseId,'novo');
 release();assert.equal(await navigating,true);assert.equal(ctx.loading,false);
});
test('rota indisponível não faz requests mesmo autenticada',async()=>{const v=view(),ctx=context(v,{available:false,loading:false,$refs:{panel:{requestExit:async()=>true}},$store:{dispatch:()=>{throw Error('unexpected')}}});assert.equal(await v.beforeRouteUpdate.call(ctx,{params:{caseId:'novo'}},{params:{caseId:'antigo'}}),true)});
test('falha da guarda impede navegação, não silencia descarte',async()=>{const v=view(),ctx={$refs:{panel:{requestExit:async()=>{throw Error('failed')}}}};assert.equal(await v.beforeRouteLeave.call(ctx),false)});
test('mesmo processo não refaz consulta nem abre confirmação',async()=>{const v=view(),ctx={$refs:{panel:{requestExit:async()=>{throw Error('unexpected')}}}};assert.equal(await v.beforeRouteUpdate.call(ctx,{params:{caseId:'mesmo'}},{params:{caseId:'mesmo'}}),true)});
test('desmontagem durante bootstrap descarta host tardio sem listar nem abrir',async()=>{
 let release,disposed=0,listCalls=0,openCalls=0;
 const host={dispose(){disposed++;},list:async()=>{listCalls++;return {cases:[],more:false};},open:async()=>{openCalls++;},scopeCount:1};
 const v=view({startImportProcessHost:()=>new Promise(resolve=>{release=resolve;})}),ctx=context(v,{caseId:'antigo',$store:{}});
 const creating=v.created.call(ctx);v.beforeUnmount.call(ctx);release(host);await creating;
 assert.equal(disposed,1);assert.equal(listCalls,0);assert.equal(openCalls,0);assert.equal(ctx.host,null);
});
test('desmontagem encerra host ativo uma única vez pelo ciclo da view',()=>{
 const v=view();let disposed=0;const ctx=context(v,{host:{dispose(){disposed++;}}});v.beforeUnmount.call(ctx);assert.equal(ctx.stopped,true);assert.equal(disposed,1);
});
test('componente não usa v-html, não cria identidade e não baixa URLs de arquivos',()=>{const s=fs.readFileSync(path.join(root,'frontend/src/components/ImportProcessPanel.vue'),'utf8');assert.ok(!s.includes('v-html'));assert.ok(!s.includes('service_role'));assert.ok(!s.includes('createImportProcessHttpHandler'));assert.ok(!s.includes('href="https://'));assert.match(s,/Salvar revisão/);assert.match(s,/role="alertdialog"/)});
