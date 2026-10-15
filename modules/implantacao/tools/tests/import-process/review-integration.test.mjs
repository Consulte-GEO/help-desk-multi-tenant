import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {environment,scope,command,id,empty} from './fixtures.mjs';
import {createImportProcessService} from '../../../modules/import-process/service.ts';
import {correctSnapshotField} from '../../../modules/import-process-client/field-review.ts';
import {parseSnapshot} from '../../../modules/import-process/canonical.ts';
import {registerImportProcessSession} from '../../../modules/import-process-client/vuex-binding.ts';
import {createImportProcessController} from '../../../modules/import-process-client/controller.ts';
import {createSessionRecoveryJournal} from '../../../modules/import-process-client/recovery-journal.ts';
const require=createRequire(new URL('../../../frontend/package.json',import.meta.url));
const {createStore}=require('vuex');
const field={rawValue:1,rawUnit:'MPa',value:1,unit:'MPa',presence:'present',provenance:'operator_corrected',semanticRole:'measured',locations:[]};
for(const value of ['9007199254740991.1','9007199254740990.5','1.00000000000000001',('0.'+'0'.repeat(400)+'1')])test('correção não perde precisão decimal '+value.slice(0,25),()=>{
 const snapshot={...empty(),records:[{id:'r',kind:'result',fields:{strength:field},links:{}}]};
 assert.throws(()=>correctSnapshotField(snapshot,{recordId:'r',field:'strength',expectedField:field,presence:'present',value,valueType:'number',reason:'Conferido'}),/INVALID_CORRECTION_NUMBER/);
});
test('falha após persistir marcador limpa intenção comprovadamente não enviada',async()=>{
 const e=environment(),service=createImportProcessService(e.options());await service.createCase({},command());
 let stored=null,failRead=false,writes=0,failCleanup=true;
 const journal=createSessionRecoveryJournal({getItem(){if(failRead){failRead=false;throw Error('read failure');}return stored;},setItem(_k,v){stored=v;failRead=true;},removeItem(){if(failCleanup)throw Error('cleanup failure');stored=null;}});
 const controller=createImportProcessController({newId:()=>id(29),client:{getCase:()=>service.getCase({},scope),saveRevision:async()=>{writes++;assert.fail('not sent');},getOperationReceipt:async()=>assert.fail('not sent')},recovery:{identity:{workspaceId:scope.workspaceId,accountId:scope.accountId,actorId:id(4)},journal}});
 await controller.open(scope.caseId);controller.edit(empty());await controller.save('Conferido');
 assert.equal(writes,0);assert.equal(controller.getState().phase,'cleanup_required');assert.ok(stored);
 failCleanup=false;await controller.recover();assert.equal(stored,null);assert.equal(writes,0);assert.equal(controller.getState().phase,'ready');assert.equal(controller.getState().dirty,true);
});
test('Vuex real publica snapshot grande válido, salva e encerra sem alterar módulos existentes',async()=>{
 const e=environment(),service=createImportProcessService(e.options());await service.createCase({},command());
 const data=await service.getCase({},scope);
 const snapshot=parseSnapshot({...empty(),records:Array.from({length:3600},(_,n)=>({id:'r'+n,kind:'result',fields:{strength:{...field}},links:{}}))});
 data.currentRevision.snapshot=snapshot;
 const store=createStore({state:{setup:{preserved:true}}});
 const binding=registerImportProcessSession({enabled:true,store,newId:()=>id(29),client:{getCase:async()=>data,saveRevision:()=>assert.fail('no write requested')}});
 await store.dispatch('importProcess/open',{caseId:scope.caseId});
 assert.equal(store.state.importProcess.phase,'ready');
 assert.equal(store.state.importProcess.draft.records.length,3600);
 assert.equal(store.getters['importProcess/presentation'].serverVersion,1);
 binding.endSession();assert.equal(store.hasModule('importProcess'),false);assert.equal(store.state.setup.preserved,true);
});
