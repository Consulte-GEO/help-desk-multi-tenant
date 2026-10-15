import test from 'node:test';
import assert from 'node:assert/strict';
import {empty,id} from './fixtures.mjs';
const M=await import('../../../modules/import-process-client/field-review.ts').catch(()=>({}));
const field=()=>({rawValue:'32,4',rawUnit:'MPa',value:32.4,unit:'MPa',presence:'present',provenance:'normalized',semanticRole:'measured',locations:[{artifactId:id(8),page:2}]});
const snapshot=()=>({...empty(),artifactIds:[id(8)],records:[{id:'resultado-01',kind:'result',fields:{resistencia:field()},links:{}}]});
const cmd=()=>({recordId:'resultado-01',field:'resistencia',expectedField:field(),presence:'present',value:'33,1',valueType:'number',reason:'Conferido na página 2 do laudo'});
const requireFn=n=>{assert.equal(typeof M[n],'function',`Export ${n} requerido pela R05`);return M[n];};
test('correção numérica preserva bruto/unidade/localização e não altera snapshot de entrada',()=>{
 const s=snapshot(),before=structuredClone(s),next=requireFn('correctSnapshotField')(s,cmd());
 assert.deepEqual(s,before);assert.equal(next.records[0].fields.resistencia.value,33.1);
 assert.equal(next.records[0].fields.resistencia.rawValue,'32,4');assert.equal(next.records[0].fields.resistencia.unit,'MPa');
 assert.equal(next.records[0].fields.resistencia.semanticRole,'measured');assert.equal(next.records[0].fields.resistencia.provenance,'operator_corrected');
 assert.deepEqual(next.records[0].fields.resistencia.locations,field().locations);assert.equal(next.decisions.length,1);
 assert.equal(next.decisions[0].type,'field_correction');assert.equal(next.decisions[0].before.value,32.4);assert.equal(next.decisions[0].after.value,33.1);
 assert.equal(next.decisions[0].reason,cmd().reason);assert.equal(Object.hasOwn(next.decisions[0],'approved'),false);
});
for(const value of ['1.234,56','32,,4','1e3','Infinity','0x20','12 mm',' ','32.4 MPa'])test(`número ambíguo/inválido recusado: ${JSON.stringify(value)}`,()=>assert.throws(()=>requireFn('correctSnapshotField')(snapshot(),{...cmd(),value}),/INVALID_CORRECTION_NUMBER/));
test('zero é preservado e não tratado como ausente',()=>assert.equal(requireFn('correctSnapshotField')(snapshot(),{...cmd(),value:'0'}).records[0].fields.resistencia.value,0));
test('identificador texto mantém zeros à esquerda',()=>{
 const s=snapshot();s.records[0].fields.resistencia={...field(),value:'00123',rawValue:'00123',unit:null,rawUnit:null,semanticRole:'identifier'};
 const c={...cmd(),expectedField:s.records[0].fields.resistencia,value:'00124',valueType:'text'};
 assert.equal(requireFn('correctSnapshotField')(s,c).records[0].fields.resistencia.value,'00124');
 assert.throws(()=>M.correctSnapshotField(s,{...c,valueType:'number'}),/IDENTIFIER_MUST_REMAIN_TEXT/);
});
test('marcar ilegível limpa só valor final e mantém bruto',()=>{
 const s=requireFn('correctSnapshotField')(snapshot(),{...cmd(),presence:'illegible',value:''});
 assert.equal(s.records[0].fields.resistencia.value,null);assert.equal(s.records[0].fields.resistencia.rawValue,'32,4');
});
test('recusa texto preenchido quando estado é ausente',()=>assert.throws(()=>requireFn('correctSnapshotField')(snapshot(),{...cmd(),presence:'absent'}),/PRESENCE_VALUE_CONFLICT/));
test('edição obsoleta não sobrescreve uma correção anterior',()=>{
 const next=requireFn('correctSnapshotField')(snapshot(),cmd());
 assert.throws(()=>M.correctSnapshotField(next,{...cmd(),value:'40'}),/FIELD_CHANGED/);
});
test('não grava uma correção sem mudança ou justificativa',()=>{
 const fn=requireFn('correctSnapshotField');
 assert.throws(()=>fn(snapshot(),{...cmd(),value:'32.4'}),/NO_FIELD_CHANGE/);
 assert.throws(()=>fn(snapshot(),{...cmd(),reason:'  '}),/CORRECTION_REASON_REQUIRED/);
});
test('campo/registro inexistente e chaves extras são recusados',()=>{
 const fn=requireFn('correctSnapshotField');
 assert.throws(()=>fn(snapshot(),{...cmd(),field:'__proto__'}),/FIELD_NOT_FOUND/);
 assert.throws(()=>fn(snapshot(),{...cmd(),recordId:'outro'}),/RECORD_NOT_FOUND/);
 assert.throws(()=>fn(snapshot(),{...cmd(),approved:true}),/INVALID_SHAPE/);
});
test('projeção mostra original, final, local e texto não interpretado como HTML',()=>{
 const s=snapshot();s.records[0].fields.resistencia.rawValue='<img src=x onerror=alert(1)>';
 const p=requireFn('projectReviewFields')(s,{query:'',kind:'all',page:1,pageSize:25});
 assert.equal(p.total,1);assert.equal(p.rows[0].rawText,s.records[0].fields.resistencia.rawValue);
 assert.match(p.rows[0].sourceText,/Página 2/);assert.equal(p.rows[0].recordId,'resultado-01');
});
test('paginação por campos preserva acesso a todos e filtra por ID, campo e conteúdo',()=>{
 const s=snapshot();s.records=Array.from({length:80},(_,i)=>({...structuredClone(s.records[0]),id:`CP-${i}`}));
 const fn=requireFn('projectReviewFields'),p=fn(s,{query:'',kind:'result',page:4,pageSize:25});
 assert.equal(p.total,80);assert.equal(p.rows.length,5);assert.equal(p.pages,4);
 assert.equal(fn(s,{query:'CP-79',kind:'all',page:1,pageSize:25}).total,1);
 assert.equal(fn(s,{query:'resistência',kind:'all',page:1,pageSize:25}).total,80);
 assert.equal(fn(s,{query:'',kind:'delivery',page:1,pageSize:25}).total,0);
});
test('projeção recusa paginação excessiva e tipo inválido',()=>{
 const fn=requireFn('projectReviewFields');
 assert.throws(()=>fn(snapshot(),{query:'',kind:'all',page:1,pageSize:500}),/INVALID_INTEGER/);
 assert.throws(()=>fn(snapshot(),{query:'',kind:'inventado',page:1,pageSize:25}),/INVALID_ENUM/);
});
test('não arredonda silenciosamente um inteiro além da precisão segura',()=>assert.throws(()=>requireFn('correctSnapshotField')(snapshot(),{...cmd(),value:'9007199254740993'}),/INVALID_CORRECTION_NUMBER/));
test('campo numérico já tipado não pode escapar da validação trocando para texto',()=>assert.throws(()=>requireFn('correctSnapshotField')(snapshot(),{...cmd(),value:'1e3',valueType:'text'}),/CORRECTION_TYPE_CONFLICT/));
