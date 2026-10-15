/* SimilarityEngine self-test S1-S21 — browser + Node.
 * IMP-01: S11/S15 substituem políticas anteriores incompatíveis com o plano
 * aprovado: especificação não é medição; unidade ausente não é inferida.
 * Nenhum caso removido, ignorado ou convertido em skip. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./similarity-engine.js'));
  else root.SimilaritySelfTest = factory(root.SimilarityEngine);
}(typeof globalThis !== 'undefined' ? globalThis : this, function (E) {
  'use strict';
  function run() {
    var results = [];
    function test(id, name, fn) {
      try { fn(); results.push({ id:id, name:name, ok:true }); }
      catch (err) { results.push({ id:id, name:name, ok:false, error:err && err.message || String(err) }); }
    }
    function eq(actual, expected, msg) { if (actual !== expected) throw new Error((msg || 'valor') + ': esperado ' + expected + ', obtido ' + actual); }
    function ok(value, msg) { if (!value) throw new Error(msg || 'condição falsa'); }
    var traceSlump = 'FCK 30 | BRITA 1 | SLUMP 12±2 CM';
    test('S1','slump ausente exibe referência 12, sem medição',function(){ var p=E.freshProposals({Slump:'',Flow:''},traceSlump);eq(p.length,1);eq(p[0].field,'Slump');eq(p[0].value,12);eq(p[0].referenceOnly,true); });
    test('S2','slump presente não é sobrescrito',function(){ var r={Slump:10,Flow:''},p=E.freshProposals(r,traceSlump);eq(p.length,0);eq(r.Slump,10); });
    test('S3','FLOW propõe flow e não slump',function(){ var p=E.freshProposals({Slump:'',Flow:''},'FCK 35 FLOW 60±5 CM');eq(p.length,1);eq(p[0].field,'Flow');eq(p[0].value,60); });
    test('S4','traço sem slump não propõe',function(){ eq(E.freshProposals({Slump:'',Flow:''},'FCK 30 BRITA 1').length,0); });
    var traces1=[{id:'t1',nome:'FCK 30 | SLUMP 12±2',fck:30,aplicacao:'laje'}];
    test('S5','FCK 30 com traço único propõe associação',function(){ var p=E.traceProposal({Concreto:''},{fck:30,application:'laje'},traces1);ok(p);eq(p.value,traces1[0].nome);eq(p.requiresHuman,false); });
    test('S6','FCK 30 com dois traços lista candidatos',function(){ var p=E.traceProposal({Concreto:''},{fck:30},traces1.concat([{id:'t2',nome:'FCK 30 | FLOW 60',fck:30}]));ok(p);eq(p.value,'');eq(p.candidates.length,2);eq(p.requiresHuman,true); });
    test('S7','usina única propõe vazios com proveniência',function(){ var rows=[{_rowId:'1',Usina:'Concrelagos'},{_rowId:'2',Usina:''},{_rowId:'3',Usina:''},{_rowId:'4',Usina:''}];var ps=E.uniqueFieldProposals(rows,'Usina','UNIQUE_USINA');eq(ps.length,3);ok(ps.every(function(p){return p.value==='Concrelagos'&&p.provenance===E.PROVENANCE.INFERRED;})); });
    test('S8','duas usinas não propõem',function(){ var rows=[{Usina:'A'},{Usina:'B'},{Usina:''}];eq(E.uniqueFieldProposals(rows,'Usina','UNIQUE_USINA').length,0); });
    test('S9','placa ausente vira IMPORT operacional',function(){ var p=E.operationalProposals({Placa:'',Volume:8},{})[0];eq(p.field,'Placa');eq(p.value,'IMPORT');eq(p.provenance,E.PROVENANCE.OPERATIONAL); });
    test('S10','volume exige autorização explícita',function(){ var r={Placa:'X',Volume:''};eq(E.operationalProposals(r,{volumeDefault:8,volumeDefaultAuthorized:false}).length,0);var p=E.operationalProposals(r,{volumeDefault:8,volumeDefaultAuthorized:true});eq(p.length,1);eq(p[0].value,8); });
    test('S11','nominal não preenche medição nem após aceite; rejeição preserva pendência',function(){ var r={_rowId:'1',Slump:''},p=E.freshProposals(r,traceSlump)[0];eq(E.apply(r,p),false);eq(r.Slump,'');eq(p.status,'blocked-measurement');eq(r._provenance.Slump.provenance,E.PROVENANCE.PENDING);var r2={_rowId:'2',Slump:''},p2=E.freshProposals(r2,traceSlump)[0];E.reject(r2,p2);eq(r2.Slump,'');eq(r2._provenance.Slump.provenance,E.PROVENANCE.PENDING); });
    test('S12','FCK conflitante vira pendência',function(){ var p=E.traceProposal({Concreto:''},{fck:40,observation:'utilizado FCK 30'},traces1);ok(p);eq(p.rule,'FCK_CONFLICT');eq(p.provenance,E.PROVENANCE.PENDING);eq(p.conflict,true); });
    /* ── v5.22.46 · casos de REGRESSÃO dos bugs corrigidos na V9 ── */
    test('S13','traço NÃO é proposto sem FCK identificado (regressão bug ALTA)',function(){ var p=E.traceProposal({Concreto:''},{application:'laje piso'},traces1);ok(p,'deveria retornar pendência');eq(p.value,'');eq(p.rule,'TRACE_SEM_FCK');eq(p.provenance,E.PROVENANCE.PENDING);eq(p.requiresHuman,true); });
    test('S14','slump em mm é convertido para cm (regressão bug ALTA)',function(){ var p=E.freshProposals({Slump:'',Flow:''},'ABATIMENTO 100 ± 20 MM');eq(p.length,1);eq(p[0].value,10); });
    test('S15','unidade ausente conserva 120 bruto, sem inventar conversão para 12 cm',function(){ var p=E.freshProposals({Slump:'',Flow:''},'SLUMP 120±20'),parsed=E.parseFresh('SLUMP 120±20');eq(p.length,1);eq(p[0].value,120);eq(p[0].referenceOnly,true);eq(parsed.nominal,null);eq(parsed.requiresUnitConfirmation,true);eq(parsed.rawNominal,120); });
    test('S16','"SLUMP12" sem espaço é reconhecido',function(){ var p=E.freshProposals({Slump:'',Flow:''},'FCK 30 SLUMP12');eq(p.length,1);eq(p[0].value,12); });
    test('S17','slump decimal 12,5 preservado',function(){ var p=E.freshProposals({Slump:'',Flow:''},'SLUMP 12,5±2 CM');eq(p.length,1);eq(p[0].value,12.5); });
    test('S18','rejeitar proposta NÃO degrada DADO_ORIGINAL (regressão bug MÉDIA)',function(){ var r={_rowId:'9',Usina:'Concrelagos'};E.seed(r,'Usina','Concrelagos');var fake={field:'Usina',rule:'UNIQUE_USINA',source:'x',provenance:E.PROVENANCE.INFERRED};E.reject(r,fake);eq(r.Usina,'Concrelagos');eq(r._provenance.Usina.provenance,E.PROVENANCE.ORIGINAL); });
    test('S19','row null/undefined não quebra os geradores',function(){ eq(E.freshProposals(null,traceSlump).length,0);eq(E.operationalProposals(null,{}).length,0);eq(E.traceProposal(null,{fck:30},traces1),null); });
    test('S20','traço com FLOW e SLUMP juntos: FLOW vence e não cria Slump',function(){ var p=E.freshProposals({Slump:'',Flow:''},'FCK 40 | SLUMP 12±2 | FLOW 60±5 CM');eq(p.length,1);eq(p[0].field,'Flow'); });
    test('S21','laboratório único também propõe (regra 5 além de Usina)',function(){ var rows=[{_rowId:'1',Laboratorio:'GeoLab'},{_rowId:'2',Laboratorio:''},{_rowId:'3',Laboratorio:''}];var ps=E.uniqueFieldProposals(rows,'Laboratorio','UNIQUE_LAB');eq(ps.length,2);ok(ps.every(function(x){return x.value==='GeoLab';})); });
    return { ok:results.every(function(r){return r.ok;}), passed:results.filter(function(r){return r.ok;}).length, total:results.length, results:results };
  }
  return { run:run };
}));
