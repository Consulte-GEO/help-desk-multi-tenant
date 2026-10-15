import test from 'node:test';import assert from 'node:assert/strict';
import {environment,scope,command,id,empty} from './fixtures.mjs';
import {createImportProcessService} from '../../../modules/import-process/service.ts';
const V=await import('../../../modules/import-process-client/vuex-binding.ts').catch(()=>({}));
const P=await import('../../../modules/import-process-client/presentation.ts').catch(()=>({}));
// Structural harness for the documented Vuex 4 module API, NOT the Vuex runtime.
class StoreHarness{
 state={setup:{preserve:true}};modules=new Map();commits=[];
 hasModule(k){return this.modules.has(k)}
 registerModule(k,m){this.modules.set(k,m);this.state[k]=m.state()}
 unregisterModule(k){this.modules.delete(k);delete this.state[k]}
 commit(key,payload){const [name,fn]=key.split('/');this.commits.push(key);this.modules.get(name).mutations[fn](this.state[name],payload)}
 async dispatch(key,payload){const [name,fn]=key.split('/');return this.modules.get(name).actions[fn]({},payload)}
 view(){return this.modules.get('importProcess').getters.presentation(this.state.importProcess)}
}
async function setup(){const e=environment(),s=createImportProcessService(e.options());await s.createCase({},command());return {e,store:new StoreHarness(),client:{getCase:()=>s.getCase({},scope),saveRevision:(_id,c)=>s.saveRevision({}, {...c,scope})}};}
function mount(x,extras={}){assert.equal(typeof V.registerImportProcessSession,'function');return V.registerImportProcessSession({store:x.store,client:x.client,newId:()=>id(20),enabled:true,...extras})}
test('R04 binding gate fechado não registra módulo nem chama cliente',async()=>{const x=await setup();const s=mount(x,{enabled:false});assert.equal(s.available,false);assert.equal(x.store.hasModule('importProcess'),false);assert.deepEqual(x.store.state.setup,{preserve:true});s.dispose();});
test('R04 binding Vuex registra namespace e executa salvar pelo controlador real',async()=>{const x=await setup(),s=mount(x);assert.equal(s.available,true);assert.equal(x.store.modules.get('importProcess').namespaced,true);await x.store.dispatch('importProcess/open',{caseId:scope.caseId});await x.store.dispatch('importProcess/edit',{...empty(),findings:[{text:'Revisão'}]});assert.equal(x.store.view().canSave,true);await x.store.dispatch('importProcess/save','Conferido');assert.equal(x.store.state.importProcess.lastReceipt.version,2);assert.equal(x.store.view().canSave,false);assert.equal(x.store.view().receiptVersion,2);assert.deepEqual(x.store.state.setup,{preserve:true});assert.ok(x.store.commits.every(c=>c==='importProcess/replace'));});
test('R04 binding recusa colisão em vez de remover módulo alheio',async()=>{const x=await setup();mount(x);assert.throws(()=>mount(x),/IMPORT_PROCESS_NAMESPACE_EXISTS/);});
test('R04 dois stores não compartilham controlador/rascunhos',async()=>{const a=await setup(),b=await setup();mount(a);mount(b);await a.store.dispatch('importProcess/open',{caseId:scope.caseId});await a.store.dispatch('importProcess/edit',{...empty(),findings:[{text:'somente A'}]});assert.equal(b.store.state.importProcess.phase,'idle');assert.equal(b.store.state.importProcess.draft,null);});
test('R04 dispose invalida callbacks tardios e remove somente seu módulo',async()=>{const x=await setup();let resolve;const reply=new Promise(r=>resolve=r);const d=await x.client.getCase();const session=mount(x,{client:{...x.client,getCase:()=>reply}});const opening=x.store.dispatch('importProcess/open',{caseId:scope.caseId});session.dispose();resolve(d);await opening;assert.equal(x.store.hasModule('importProcess'),false);assert.deepEqual(x.store.state.setup,{preserve:true});session.dispose();});
test('R04 binding não remove namespace substituído por outro proprietário',async()=>{const x=await setup(),s=mount(x);const other={foreign:true};x.store.state.importProcess=other;s.dispose();assert.equal(x.store.state.importProcess,other);});
test('R04 ações capturadas antes do dispose não reativam sessão',async()=>{const x=await setup(),s=mount(x),open=x.store.modules.get('importProcess').actions.open;s.dispose();await assert.rejects(Promise.resolve().then(()=>open({}, {caseId:scope.caseId})),/IMPORT_PROCESS_SESSION_CLOSED/);});
test('R04 payload aberto desconhecido é recusado sem ampliar escopo',async()=>{const x=await setup();mount(x);await assert.rejects(x.store.dispatch('importProcess/open',{caseId:scope.caseId,actorId:id(90)}));assert.equal(x.store.state.importProcess.phase,'idle');});
test('R04 projeção distingue leitura de confirmação de gravação',async()=>{const x=await setup();mount(x);await x.store.dispatch('importProcess/open',{caseId:scope.caseId});const view=x.store.view();assert.equal(view.receiptVersion,null);assert.equal(view.serverVersion,1);assert.equal(view.label,'Versão consultada');assert.equal(view.shouldWarnBeforeUnload,false);});
for(const phase of ['saving','recovering','uncertain','cleanup_required'])test('R04 apresentação bloqueia salvar/editar/sair durante '+phase,()=>{assert.equal(typeof P.presentImportProcess,'function');const view=P.presentImportProcess({phase,caseId:id(3),pendingOperationId:id(20),dirty:false,data:null,draft:null,lastReceipt:null,message:null});assert.equal(view.canSave,false);assert.equal(view.canEdit,false);assert.equal(view.shouldWarnBeforeUnload,true);});
test('R04 conflito mantém aviso de perda e edição disponível mas não save',()=>{assert.equal(typeof P.presentImportProcess,'function');const view=P.presentImportProcess({phase:'conflict',caseId:id(3),pendingOperationId:null,dirty:true,data:{process:{status:'draft',version:1}},draft:empty(),lastReceipt:null,message:'Conflito'});assert.equal(view.canEdit,true);assert.equal(view.canSave,false);assert.equal(view.shouldWarnBeforeUnload,true);assert.equal(view.message,'Conflito');});
test('R04 modelo de apresentação desconhecido falha fechado',()=>{assert.equal(typeof P.presentImportProcess,'function');assert.throws(()=>P.presentImportProcess({phase:'published',dirty:false}),/INVALID_PRESENTATION_PHASE/);});
test('R04 dispose de componente não apaga confirmação pendente; endSession limpa explicitamente',async()=>{
 const x=await setup();let marker=null,clears=0;const journal={read:()=>marker,write:m=>{marker=m},clear:()=>{clears++;marker=null}};
 const client={...x.client,getOperationReceipt:async()=>{throw Error('unused')},saveRevision:async(...args)=>{await x.client.saveRevision(...args);throw Error('ACK lost')}};
 const identity={workspaceId:scope.workspaceId,accountId:scope.accountId,actorId:id(4)};
 const s=mount(x,{client,recovery:{identity,journal}});await x.store.dispatch('importProcess/open',{caseId:scope.caseId});await x.store.dispatch('importProcess/edit',empty());await x.store.dispatch('importProcess/save','Enviado');assert.ok(marker);s.dispose();assert.equal(clears,0);assert.ok(marker);
 const next=mount(x,{client,recovery:{identity,journal}});assert.equal(typeof next.endSession,'function');next.endSession();assert.equal(marker,null);assert.equal(x.store.hasModule('importProcess'),false);
});
test('R04 binding substituído não limpa marcador que pertence à nova montagem',async()=>{
 const x=await setup();let cleared=0;const marker={};const s=mount(x,{client:{...x.client,getOperationReceipt:async()=>{}},recovery:{identity:{workspaceId:scope.workspaceId,accountId:scope.accountId,actorId:id(4)},journal:{read:()=>marker,write(){},clear(){cleared++}}}});
 x.store.state.importProcess={replacement:true};s.dispose();assert.equal(cleared,0);
});
