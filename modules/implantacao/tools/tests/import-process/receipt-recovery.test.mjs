import test from 'node:test';
import assert from 'node:assert/strict';
import {environment,command,scope,id,empty} from './fixtures.mjs';
import {createImportProcessService} from '../../../modules/import-process/service.ts';
import {createImportProcessHttpHandler} from '../../../modules/import-process/http.ts';
import {createImportProcessClient} from '../../../modules/import-process-client/client.ts';
import {contentHash} from '../../../modules/import-process/canonical.ts';
const origin='https://setup.example.test';
const save=()=>({operationId:id(20),expectedVersion:1,snapshot:{...empty(),findings:[{text:'Conferência privada'}]},reason:'Revisão autorizada'});
async function fixture(){
 const e=environment(),service=createImportProcessService(e.options());await service.createCase({},command());
 const h=createImportProcessHttpHandler({origin,service,enabled:()=>true,authenticate:async r=>r.headers.get('authorization')==='Bearer test'?{}:null,admit:async()=>true,locate:async(_c,caseId)=>e.repo.stored({...scope,caseId})?{...scope,caseId}:null});
 const calls=[];let map=r=>r;
 const client=createImportProcessClient({sessionFetch:async(p,i)=>{calls.push({path:p,method:i.method,body:i.body});const headers=new Headers(i.headers);headers.set('authorization','Bearer test');if(i.method==='POST')headers.set('origin',origin);return map(await h(new Request(origin+p,{...i,headers})));}});
 return {e,service,h,client,calls,mutateResponse:f=>map=f};
}
const hash=()=>contentHash({operation:'revise',command:{...save(),scope}});
test('R04 consulta confirma operação pelo ator sem mutações ou replay de POST',async()=>{
 const x=await fixture();await x.service.saveRevision({}, {...save(),scope});const before=JSON.stringify(x.e.repo.stored());
 assert.equal(typeof x.service.getOperationReceipt,'function');const r=await x.service.getOperationReceipt({},scope,id(20));
 assert.equal(r.status,'confirmed');assert.equal(r.receipt.version,2);assert.equal(r.receipt.replayed,true);assert.equal(r.requestHash,await hash());assert.equal(JSON.stringify(x.e.repo.stored()),before);
});
test('R04 ausência de recibo não é declarada rollback',async()=>{const x=await fixture();assert.equal(typeof x.service.getOperationReceipt,'function');assert.deepEqual(await x.service.getOperationReceipt({},scope,id(99)),{caseId:scope.caseId,operationId:id(99),status:'unconfirmed',requestHash:null,receipt:null});});
test('R04 suporte não lê recibo de outro ator mesmo tendo acesso ao processo',async()=>{const x=await fixture();await x.service.saveRevision({}, {...save(),scope});x.e.actor=id(50);x.e.role='support';assert.equal(typeof x.service.getOperationReceipt,'function');assert.equal((await x.service.getOperationReceipt({},scope,id(20))).status,'unconfirmed');});
test('R04 revogação antes da consulta nega recibo existente',async()=>{const x=await fixture();await x.service.saveRevision({}, {...save(),scope});x.e.deny=true;assert.equal(typeof x.service.getOperationReceipt,'function');await assert.rejects(x.service.getOperationReceipt({},scope,id(20)),/AUTHORITY_UNAVAILABLE/);});
test('R04 autorização mudando durante leitura impede retorno',async()=>{const x=await fixture();await x.service.saveRevision({}, {...save(),scope});x.e.changeOnSecond=true;assert.equal(typeof x.service.getOperationReceipt,'function');await assert.rejects(x.service.getOperationReceipt({},scope,id(20)),/AUTHORITY_CHANGED/);});
test('R04 recibo permanece consultável após cancelamento posterior',async()=>{const x=await fixture();await x.service.saveRevision({}, {...save(),scope});await x.service.cancelCase({}, {scope,operationId:id(21),expectedVersion:2,reason:'Cancelar'});assert.equal(typeof x.service.getOperationReceipt,'function');const r=await x.service.getOperationReceipt({},scope,id(20));assert.equal(r.receipt.version,2);assert.equal(x.e.repo.stored().process.version,3);});
for(const [name,tamper] of [
 ['hash do pedido',d=>d.receipts[1].requestHash='malformed'],
 ['snapshot da revisão',d=>d.revisions[1].snapshot.findings.push({text:'adulterado'})],
 ['recibo de outro caso',d=>d.receipts[1].result.caseId=id(88)],
 ['versão futura',d=>d.receipts[1].result.version=999],
])test('R04 consulta recusa '+name+' adulterado',async()=>{const x=await fixture();await x.service.saveRevision({}, {...save(),scope});tamper(x.e.repo.stored());assert.equal(typeof x.service.getOperationReceipt,'function');await assert.rejects(x.service.getOperationReceipt({},scope,id(20)),/RECEIPT_INTEGRITY/);});
test('R04 HTTP e cliente consultam recibo autorizado por GET com no-store',async()=>{
 const x=await fixture();await x.client.saveRevision(scope.caseId,save());assert.equal(typeof x.client.getOperationReceipt,'function');
 const r=await x.client.getOperationReceipt(scope.caseId,id(20),1,await hash());assert.equal(r.status,'confirmed');assert.equal(x.calls.at(-1).method,'GET');assert.equal(x.calls.at(-1).body,undefined);
 const response=await x.h(new Request(origin+x.calls.at(-1).path,{headers:{authorization:'Bearer test'}}));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(!(await response.text()).includes('Conferência privada'));
});
test('R04 GET sem bearer não localiza recibo',async()=>{const x=await fixture();const r=await x.h(new Request(origin+'/v1/import-processes/'+scope.caseId+'/operations/'+id(20)));assert.equal(r.status,401);});
test('R04 cliente não converte unconfirmed em concluído',async()=>{const x=await fixture();assert.equal(typeof x.client.getOperationReceipt,'function');const r=await x.client.getOperationReceipt(scope.caseId,id(20),1,await hash());assert.equal(r.status,'unconfirmed');assert.equal(r.receipt,null);});
test('R04 cliente recusa hash diferente do pedido que pretende recuperar',async()=>{const x=await fixture();await x.client.saveRevision(scope.caseId,save());assert.equal(typeof x.client.getOperationReceipt,'function');await assert.rejects(x.client.getOperationReceipt(scope.caseId,id(20),1,'b'.repeat(64)),e=>e.code==='INVALID_RESPONSE');});
for(const patch of [{operationId:id(99)},{status:'rolled_back'},{status:'unconfirmed'},{requestHash:'a'.repeat(64)}])test('R04 envelope de recuperação adulterado '+JSON.stringify(patch),async()=>{const x=await fixture();await x.client.saveRevision(scope.caseId,save());x.mutateResponse(async r=>new Response(JSON.stringify({...await r.json(),...patch}),{status:r.status,headers:r.headers}));assert.equal(typeof x.client.getOperationReceipt,'function');await assert.rejects(x.client.getOperationReceipt(scope.caseId,id(20),1,await hash()),e=>e.code==='INVALID_RESPONSE');});
