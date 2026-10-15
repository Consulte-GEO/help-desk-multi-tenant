'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./load-source.cjs');
const I = loadSource('frontend/public/assets/import-integrity.js',true);
const row=(id,patch={})=>({_rowId:id,_source:{sheet:'Histórico',line:Number(id.replace(/\D/g,''))||1},'Data Concretagem':'01/10/2026',Bloco:'Torre A',Unidade:'1º Pavimento',Peça:'Laje',...patch});
function fn(name){assert.equal(typeof I[name],'function',`Falta ${name}`);return I[name];}
for(const [raw,unit,value] of [['120 MM','',12],['12 CM','',12],['12,5','cm',12.5],[120,'mm',12],[0,'cm',0],['12','mm',1.2]]) {
 test(`medição com evidência de unidade: ${raw} / ${unit}`,()=>{
   const v=fn('readFreshMeasurement')(raw,{sourceUnit:unit});
   assert.equal(v.value,value);assert.equal(v.semanticRole,'measured');assert.equal(v.raw,raw);
 });
}
for(const raw of ['120','12',120]) test(`medição sem unidade fica pendente: ${raw}`,()=>{
 const v=fn('readFreshMeasurement')(raw,{});assert.equal(v.value,'');assert.equal(v.code,'SOURCE_UNIT_REQUIRED');assert.equal(v.raw,raw);
});
for(const raw of ['12±2 CM','120 +/- 20 MM','08/17','abc12','1.234.56',Infinity]) test(`entrada ambígua não vira medição: ${raw}`,()=>{
 const v=fn('readFreshMeasurement')(raw,{sourceUnit:'cm',meaning:'measured'});assert.equal(v.value,'');assert.ok(v.code);
});
test('especificação declarada não vira medição mesmo sendo um único número',()=>{
 const v=fn('readFreshMeasurement')('12',{sourceUnit:'cm',meaning:'specification'});assert.equal(v.value,'');assert.equal(v.semanticRole,'specified');
});
test('unidade explícita conflitante não é silenciosamente sobrescrita',()=>{
 const v=fn('readFreshMeasurement')('120 MM',{sourceUnit:'cm'});assert.equal(v.value,'');assert.equal(v.code,'SOURCE_UNIT_CONFLICT');
});
test('dois eventos no mesmo local/dia não são fundidos sem decisão',()=>{
 const out=fn('numberLegacyEvents')([row('r1'),row('r2')]);
 assert.notEqual(out.assignments.r1,out.assignments.r2);
 assert.equal(out.issues.filter(x=>x.code==='EVENT_GROUPING_REQUIRED').length,2);
});
test('o mesmo número explicitamente revisado agrupa os caminhões',()=>{
 const rows=[row('r1'),row('r2')];
 rows.forEach(r=>r._importEventDecision={number:7,context:fn('eventContext')(r)});
 const out=fn('numberLegacyEvents')(rows);assert.equal(out.assignments.r1,7);assert.equal(out.assignments.r2,7);assert.equal(out.issues.length,0);
});
test('números de eventos distintos são preservados após revalidar',()=>{
 const rows=[row('r1'),row('r2')];rows.forEach((r,i)=>r._importEventDecision={number:i+5,context:fn('eventContext')(r)});
 const out=fn('numberLegacyEvents')(rows);assert.equal(out.assignments.r1,5);assert.equal(out.assignments.r2,6);assert.equal(out.issues.length,0);
});
test('mudar o local invalida a decisão de evento anterior',()=>{
 const r=row('r1');r._importEventDecision={number:7,context:fn('eventContext')(r)};r.Bloco='Torre B';
 assert.ok(fn('numberLegacyEvents')([r]).issues.some(x=>x.code==='EVENT_CONTEXT_CHANGED'));
});
test('mesmo número em contextos incompatíveis bloqueia, sem reagrupar automaticamente',()=>{
 const rows=[row('r1'),row('r2',{Unidade:'2º Pavimento'})];rows.forEach(r=>r._importEventDecision={number:7,context:fn('eventContext')(r)});
 assert.equal(fn('numberLegacyEvents')(rows).issues.filter(x=>x.code==='EVENT_CONTEXT_CONFLICT').length,2);
});
test('resultado é estável ao permutar as linhas de origem',()=>{
 const rows=[row('r2'),row('r1')];assert.deepEqual(fn('numberLegacyEvents')(rows).assignments,fn('numberLegacyEvents')([...rows].reverse()).assignments);
});
test('IDs de linha duplicados são recusados antes de produzir atribuições',()=>{
 assert.throws(()=>fn('numberLegacyEvents')([row('r1'),row('r1')]),/DUPLICATE_SOURCE_ID/);
});
test('fonte inclui hash, aba, linha e ordinal e não deduplica CPs pelo valor',()=>{
 const f=fn('sourceRecordId'),base={artifactHash:'a'.repeat(64),sheet:'A:B',row:1,kind:'specimen',ordinal:0};
 assert.notEqual(f(base),f({...base,ordinal:1}));assert.notEqual(f(base),f({...base,sheet:'A',row:2}));assert.equal(f(base),f({...base}));
});
test('hash de fonte inválido é recusado',()=>{assert.throws(()=>fn('sourceRecordId')({artifactHash:'x',sheet:'A',row:1,kind:'specimen',ordinal:0}),/INVALID_SOURCE/);});
test('dois CPs da mesma entrega não multiplicam volume',()=>{
 const records=[{sourceId:'s1',scope:'obra1',kind:'specimen',deliveryRef:'d1',deliveryEvidence:'reviewed',volume:'8.25',result:30},{sourceId:'s2',scope:'obra1',kind:'specimen',deliveryRef:'d1',deliveryEvidence:'reviewed',volume:'8.25',result:30}];
 const result=fn('summarizeDeliveries')(records);assert.equal(result.specimenCount,2);assert.equal(result.deliveryCount,1);assert.equal(result.volume,'8.25');assert.equal(result.issues.length,0);
});
test('volumes conflitantes na mesma entrega não são escolhidos por conveniência',()=>{
 const records=[{sourceId:'s1',scope:'obra1',kind:'specimen',deliveryRef:'d1',deliveryEvidence:'source',volume:'8'},{sourceId:'s2',scope:'obra1',kind:'specimen',deliveryRef:'d1',deliveryEvidence:'source',volume:'9'}];
 const result=fn('summarizeDeliveries')(records);assert.equal(result.volume,null);assert.ok(result.issues.some(x=>x.code==='DELIVERY_VOLUME_CONFLICT'));
});
test('CP sem vínculo confiável não contribui para total que parece completo',()=>{
 const result=fn('summarizeDeliveries')([{sourceId:'s1',scope:'obra1',kind:'specimen',volume:'8'}]);assert.equal(result.volume,null);assert.ok(result.issues.some(x=>x.code==='DELIVERY_REFERENCE_REQUIRED'));
});
test('somatório decimal é exato, sem arredondar o original',()=>{
 const records=['0.10','0.20'].map((v,i)=>({sourceId:`s${i}`,scope:'obra1',kind:'delivery',deliveryRef:`d${i}`,deliveryEvidence:'source',volume:v}));
 assert.equal(fn('summarizeDeliveries')(records).volume,'0.30');
});
test('não soma dados de obras/contas diferentes',()=>{
 assert.throws(()=>fn('summarizeDeliveries')([{sourceId:'s1',scope:'a',kind:'delivery',deliveryRef:'d1',deliveryEvidence:'source',volume:'8'},{sourceId:'s2',scope:'b',kind:'delivery',deliveryRef:'d2',deliveryEvidence:'source',volume:'8'}]),/CROSS_SCOPE/);
});
test('precisão de volume maior que duas casas vira pendência, não arredondamento',()=>{
 const result=fn('summarizeDeliveries')([{sourceId:'s1',scope:'a',kind:'delivery',deliveryRef:'d1',deliveryEvidence:'source',volume:'8.123'}]);assert.equal(result.volume,null);assert.ok(result.issues.some(x=>x.code==='INVALID_DELIVERY_VOLUME'));
});
test('proveniência inferida em medição já preenchida impede exportação final',()=>{
 const r=row('r1',{Slump:12,_provenance:{Slump:{provenance:'INFERIDO_POR_SIMILARIDADE'}}});
 assert.ok(fn('legacyFindings')([r]).some(i=>i.type==='MEASUREMENT_WITHOUT_EVIDENCE'&&i.severity==='CRÍTICO'));
});
