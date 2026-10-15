'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./load-source.cjs');
const E = loadSource('frontend/public/assets/similarity-engine.js');
for (const [field, text, value] of [['Slump','SLUMP 12±2 CM',12],['Flow','FLOW 60±5 CM',60]]) {
  test(`${field}: aceitar nominal não produz uma medição`, () => {
    const row = { _rowId: 'r1', Slump: '', Flow: '' };
    const proposal = E.freshProposals(row,text)[0];
    assert.equal(proposal.value,value); // referência continua consultável
    assert.equal(E.apply(row,proposal),false);
    assert.equal(row[field],'');
    assert.equal(proposal.semanticRole,'specified');
    assert.equal(proposal.status,'blocked-measurement');
  });
  test(`${field}: valor escolhido também não contorna a separação semântica`, () => {
    const row = { _rowId: 'r1', Slump: '', Flow: '' };
    assert.equal(E.apply(row,E.freshProposals(row,text)[0],value),false);
    assert.equal(row[field],'');
  });
}
test('volume padrão autorizado não vira volume observado', () => {
  const row={_rowId:'r1',Placa:'X',Volume:''};
  const p=E.operationalProposals(row,{volumeDefault:8,volumeDefaultAuthorized:true})[0];
  assert.equal(E.apply(row,p),false); assert.equal(row.Volume,'');
  assert.equal(p.semanticRole,'operational_placeholder');
});
test('placa IMPORT continua funcionando como marcador operacional', () => {
  const row={_rowId:'r1',Placa:'',Volume:8};
  const p=E.operationalProposals(row,{})[0];
  assert.equal(E.apply(row,p),true); assert.equal(row.Placa,'IMPORT');
});
test('medição da origem e proveniência não são substituídas', () => {
  const row={_rowId:'r1',Slump:10}; E.seed(row,'Slump',10);
  const before=JSON.stringify(row);
  assert.equal(E.apply(row,{field:'Slump',value:12,rule:'SLUMP_FROM_TRACE'}),false);
  assert.equal(JSON.stringify(row),before);
});
for (const [text, nominal,tolerance] of [
  ['ABATIMENTO 100 ± 20 MM',10,2], ['SLUMP 100 MM ± 20 MM',10,2],
  ['SLUMP 12±2 CM',12,2], ['FLOW 600±50 MM',60,5], ['SLUMP 12,5 CM',12.5,null],
]) test(`unidade explícita: ${text}`, () => {
  const p=E.parseFresh(text);assert.equal(p.nominal,nominal);assert.equal(p.tolerance,tolerance);
  assert.equal(p.unit,'cm');assert.equal(p.source,text);
});
for (const text of ['SLUMP 120±20','FLOW 600±50','SLUMP12']) test(`não inventa unidade: ${text}`, () => {
  const p=E.parseFresh(text);assert.equal(p.nominal,null);assert.equal(p.unit,null);
  assert.equal(p.convertedFromMm,false);assert.equal(p.requiresUnitConfirmation,true);
  assert.equal(p.source,text);assert.equal(typeof p.rawNominal,'number');
});
test('objeto/propriedade não autorizada não passa por apply', () => {
  const row={};const proto=Object.getPrototypeOf(row);
  assert.equal(E.apply(row,{field:'__proto__',value:{polluted:true}}),false);
  assert.equal(Object.getPrototypeOf(row),proto);
});
test('associação de usina inequívoca mantém comportamento existente', () => {
  const rows=[{_rowId:'r1',Usina:'Usina Exemplo'},{_rowId:'r2',Usina:''}];
  const p=E.uniqueFieldProposals(rows,'Usina','UNIQUE_USINA')[0];
  assert.equal(E.apply(rows[1],p),true);assert.equal(rows[1].Usina,'Usina Exemplo');
});
