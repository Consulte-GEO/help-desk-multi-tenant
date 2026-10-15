'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./load-source.cjs');
const E=loadSource('frontend/src/services/geoControleExportService.ts');
const piece=(id,patch={})=>({id,local:'Laje',etapa:'Estrutura',fck:30,volume:'10',concretoId:'c1',observacoes:'',ordem:0,...patch});
const group=(id,pecas,patch={})=>({id,nome:'Torre',tipoEdificacao:'Torre',edificacoesInput:'1',projetista:'Projetista A',observacoes:'',pecas,...patch});
const snapshot=grupos=>({metadata:{obraNome:'Obra sintética',clienteNome:'Cliente sintético'},concretos:[{id:'c1',descricao:'FCK 30 SLUMP 12±2 CM',fck:30,aplicacao:'Laje',padroesMoldagem:[]}],grupos,usuariosObra:[],fornecedores:[]});
for(const [label,patch] of [['local',{local:'Pilar'}],['volume',{volume:'20'}],['observações',{observacoes:'Croqui específico'}],['FCK',{fck:40}],['concreto',{concretoId:'c2'}]]) {
  test(`tipos com ${label} diferente não colapsam`,()=>{
    const s=snapshot([group('g1',[piece('p1'),piece('p2',patch)])]);
    const out=E.buildGeoControlePayload(s);
    assert.equal(out.tipos.length,2); assert.notEqual(out.pecas[0].tipoTempId,out.pecas[1].tipoTempId);
    assert.equal(out.pecas.length,2);
  });
}
test('projetistas de grupos diferentes permanecem vinculados aos próprios tipos',()=>{
  const s=snapshot([group('g1',[piece('p1')]),group('g2',[piece('p2')],{projetista:'Projetista B'})]);
  const out=E.buildGeoControlePayload(s);assert.equal(out.tipos.length,2);
  for(const p of out.pecas){const t=out.tipos.find(t=>t.id===p.tipoTempId); assert.equal(t.projetista,p.grupoTempId==='g1'?'Projetista A':'Projetista B');}
});
test('equivalência só ocorre dentro do mesmo grupo e com todos os atributos coincidentes',()=>{
  const s=snapshot([group('g1',[piece('p1'),piece('p2',{ordem:1})])]);
  const out=E.buildGeoControlePayload(s);assert.equal(out.pecas.length,2);assert.equal(out.tipos.length,1);
});
test('volume por tipo vem da peça equivalente, sem somar repetições',()=>{
  const s=snapshot([group('g1',[piece('p1',{volume:'10,50'}),piece('p2',{volume:'10,50'})])]);
  const out=E.buildGeoControlePayload(s);assert.equal(String(out.tipos[0].volumeProjeto),'10,50');
  assert.deepEqual(out.pecas.map(p=>p.volume),['10,50','10,50']);
});
test('assinatura com delimitadores não causa colisão',()=>{
  const s=snapshot([group('g1',[piece('p1',{local:'A|B',etapa:'C'}),piece('p2',{local:'A',etapa:'B|C'})])]);
  assert.equal(E.buildGeoControlePayload(s).tipos.length,2);
});
test('exportação não altera os dados brutos nem o alvo geomat',()=>{
  const s=snapshot([group('g1',[piece('p1')])]);const original=JSON.stringify(s);
  const out=E.buildGeoControlePayload(s);assert.equal(JSON.stringify(s),original);
  assert.equal(out.meta.target,'geomat:criar_obra');assert.equal(out.meta.counts.pecas,1);
});
for(const [description,expected,tolerance] of [
  ['FCK 30 SLUMP 120±20 MM',12,2],
  ['FCK 30 SLUMP 120 MM ± 2 CM',12,2],
  ['FCK 30 SLUMP 12±2',null,null],
  ['FCK 40 FLOW 60±5 CM',null,null],
  ['FCK 40 SLUMP 12±2 CM FLOW 60±5 CM',null,null],
]) test(`exportador não confunde família/unidade: ${description}`,()=>{
  const s=snapshot([group('g1',[piece('p1')])]);s.concretos[0].descricao=description;
  const out=E.buildGeoControlePayload(s);assert.equal(out.concretos[0].slumpPrevisto,expected);
  assert.equal(out.concretos[0].slumpTolerancia,tolerance);assert.equal(out.concretos[0].descricao,description);
});
