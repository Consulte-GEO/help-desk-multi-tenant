'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./load-source.cjs');
const I = loadSource('frontend/public/assets/import-integrity.js');
const S = loadSource('frontend/public/assets/similarity-engine.js');
const A = loadSource('frontend/public/assets/import-legacy-adapter.js', true);
const clone = x => JSON.parse(JSON.stringify(x));
function row(id, extra={}) {
  return {_rowId:id,_source:{sheet:'Controle',line:Number(id)||1},_raw:{slump:120,flow:''},
    _provenance:{Volume:{provenance:'DADO_ORIGINAL',original:8}},
    'Data Concretagem':'01/10/2026',Bloco:'Torre A',Unidade:'1º',Peça:'Laje',Volume:8,Slump:12,Flow:'',...extra};
}
// Colaboradores de interface mínimos. As regras novas são sempre o módulo real;
// este ensaio não simula leitura XLSX, autenticação ou a página inteira.
function fixture(rows=[row('1')]) {
  const appState={settings:{slumpSourceMeaning:'auto',strictMode:true},insumos:{estrutura:{pairs:[]}},pre:{
    candidateRows:rows,convertedRows:[],issues:[],corrections:[],proposals:[],decisionLog:[],
    selectedSheet:'Controle',columns:[{index:0,rawLabel:'Slump (mm)'}],mapping:{fields:{Slump:{sourceIndex:0}}}}};
  const calls={export:0,group:0,render:0,warnings:[]};
  const Utils={esc:x=>String(x).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
    isFilled:x=>x!==''&&x!=null, coerceDate:()=>new Date('2026-10-01')};
  const UI={render(){calls.render++},loading(){},preSetup(){return '<input id="setting-volumeDefault"><input id="setting-volumeDefaultAuthorized">Volume só é preenchido quando a autorização abaixo estiver marcada.'},preMapping(){return '<section>Mapeamento</section>'},prePreview(){return '<section>Validação</section>'},proposalCard(){return '<button data-action="accept-proposal">Aceitar nesta linha</button>'}};
  const Toast={warn:m=>calls.warnings.push(m),error:m=>calls.warnings.push(m)};
  const Converter={prepare(){},group:()=>({type:'slump'}),applyGroup(){calls.group++;appState.pre.candidateRows[0].Slump=12},
    finalize(){},refreshSummary(){const p=appState.pre;p.summary={total:p.convertedRows.length,criticals:p.issues.filter(x=>x.severity==='CRÍTICO').length}},
    sourceMark(r,f,raw,val){S.mark(r,f,'NORMALIZACAO_AUTOMATICA','Fonte',raw,true)}};
  const Validators={validateAll(){appState.pre.issues=appState.pre.issues.filter(x=>x.type==='business_existing');return appState.pre.issues}};
  const Actions={resetPreDerived(){appState.pre.candidateRows=[]},selectSheet(name){appState.pre.selectedSheet=name},
    findRow:id=>appState.pre.candidateRows.find(x=>x._rowId===id),
    editRow(id,k,v){const r=this.findRow(id);r[k]=v;S.mark(r,k,'DADO_ORIGINAL','Manual',null,true);this.renumberAndValidate();UI.render()},
    renumberAndValidate(){Converter.finalize()},finalizeConversion(){}};
  const Exporter={downloadImport(){if(appState.pre.summary?.criticals)return false;calls.export++;return true}};
  const listeners={}; const document={addEventListener:(name,fn)=>{listeners[name]=fn}};
  return {appState,Utils,UI,Toast,Converter,Validators,Actions,Exporter,document,integrity:I,Similarity:S,requiredFields:[],calls,listeners};
}
function mount(f) {assert.equal(typeof A.install,'function'); A.install(f);return f;}
test('adaptador recusa combinação de motores incompatível',()=>{assert.equal(typeof A.install,'function');const f=fixture();f.Similarity={...S,VERSION:'1.0.0'};assert.throws(()=>A.install(f),/INCOMPATIBLE/)});
test('instalação duplicada é recusada sem duplicar listeners',()=>{const f=mount(fixture());assert.throws(()=>A.install(f),/ALREADY_INSTALLED/)});
test('reavalia origem com mm explícito sem usar conversão pela magnitude',()=>{const f=mount(fixture());f.Converter.prepare();assert.equal(f.appState.pre.candidateRows[0].Slump,12);assert.equal(f.appState.pre.candidateRows[0]._freshEvidence.Slump.rawUnit,'mm')});
test('unidade ausente não mantém o 12 produzido pelo caminho antigo',()=>{const f=fixture();f.appState.pre.columns[0].rawLabel='Slump';mount(f);f.Converter.prepare();f.Converter.finalize();assert.equal(f.appState.pre.candidateRows[0].Slump,'');assert.ok(f.appState.pre.issues.some(x=>x.type==='SOURCE_UNIT_REQUIRED'))});
test('cabeçalho de especificação não produz medição',()=>{const f=fixture();f.appState.pre.columns[0].rawLabel='Slump previsto (cm)';mount(f);f.Converter.prepare();assert.equal(f.appState.pre.candidateRows[0].Slump,'');assert.equal(f.appState.pre.candidateRows[0]._freshEvidence.Slump.semanticRole,'specified')});
test('declaração explícita de unidade pertence à coluna/aba',()=>{const f=fixture();f.appState.pre.columns[0].rawLabel='Slump';mount(f);f.listeners.change({target:{dataset:{importUnitField:'Slump'},value:'mm'}});f.Converter.prepare();assert.equal(f.appState.pre.candidateRows[0].Slump,12);f.appState.pre.mapping.fields.Slump.sourceIndex=1;f.Converter.prepare();assert.equal(f.appState.pre.candidateRows[0].Slump,'')});
test('nova planilha descarta unidade escolhida no arquivo anterior',()=>{const f=mount(fixture());f.appState.pre._freshUnitDecisions={Slump:{unit:'mm'}};f.Actions.resetPreDerived();assert.deepEqual(f.appState.pre._freshUnitDecisions,{})});
test('troca de aba descarta decisões de unidade',()=>{const f=mount(fixture());f.appState.pre._freshUnitDecisions={Slump:{unit:'mm'}};f.Actions.selectSheet('Outra');assert.deepEqual(f.appState.pre._freshUnitDecisions,{})});
test('aplicação antiga de nominal por grupo é bloqueada antes do writer',()=>{const f=mount(fixture());const before=clone(f.appState.pre.candidateRows);f.Converter.applyGroup('old');assert.equal(f.calls.group,0);assert.deepEqual(f.appState.pre.candidateRows,before)});
test('preparo não carimba padrão de volume como aceito',()=>{const f=fixture();f.appState.pre.proposals=[{field:'Volume',referenceOnly:true,status:'accepted'}];f.appState.pre.decisionLog=[{type:'padrão_operacional',action:'aplicado',value:'Volume=8'}];mount(f);f.Converter.prepare();assert.equal(f.appState.pre.proposals[0].status,'reference');assert.equal(f.appState.pre.decisionLog[0].action,'nao_aplicado')});
test('datas e locais iguais não colapsam eventos sem revisão',()=>{const f=mount(fixture([row('1'),row('2')]));f.Converter.finalize();const rs=f.appState.pre.convertedRows;assert.notEqual(rs[0]['Número Concretagem'],rs[1]['Número Concretagem']);assert.equal(f.appState.pre.issues.filter(x=>x.type==='EVENT_GROUPING_REQUIRED').length,2)});
test('editar número confirma agrupamento e a revalidação preserva decisão',()=>{const f=mount(fixture([row('1'),row('2')]));f.Actions.editRow('1','Número Concretagem','8');f.Actions.editRow('2','Número Concretagem','8');f.Converter.finalize();assert.deepEqual(f.appState.pre.convertedRows.map(r=>r['Número Concretagem']),[8,8]);assert.ok(!f.appState.pre.issues.some(x=>x.type==='EVENT_GROUPING_REQUIRED'))});
test('número inválido é recusado antes de alterar linha',()=>{const f=mount(fixture());const before=clone(f.appState.pre.candidateRows[0]);f.Actions.editRow('1','Número Concretagem','8x');assert.deepEqual(f.appState.pre.candidateRows[0],before);assert.ok(f.calls.warnings.length)});
test('editar local invalida a revisão de evento',()=>{const f=mount(fixture());f.Actions.editRow('1','Número Concretagem','8');f.Actions.editRow('1','Peça','Pilar');assert.ok(f.appState.pre.issues.some(x=>x.type==='EVENT_CONTEXT_CHANGED'))});
test('edição manual de faixa não converte especificação em medição',()=>{const f=mount(fixture());f.Actions.editRow('1','Slump','12±2');assert.equal(f.appState.pre.candidateRows[0].Slump,12);assert.ok(f.calls.warnings.length);assert.equal(f.appState.pre.decisionLog.length,0)});
test('edição manual medida corrige pendência, preserva entrada e não duplica achados',()=>{const f=fixture();f.appState.pre.columns[0].rawLabel='Slump';mount(f);f.Converter.prepare();f.Actions.editRow('1','Slump','12,5');f.Validators.validateAll();f.Validators.validateAll();const r=f.appState.pre.candidateRows[0];assert.equal(r.Slump,12.5);assert.equal(r._freshEvidence.Slump.raw,'12,5');assert.equal(r._freshEvidence.Slump.unit,'cm');assert.ok(!f.appState.pre.issues.some(x=>x.type==='SOURCE_UNIT_REQUIRED'));assert.ok(f.appState.pre.decisionLog.some(x=>x.action==='medicao_confirmada'))});
test('medição manual mm explícito é convertida preservando original',()=>{const f=mount(fixture());f.Actions.editRow('1','Slump','125 mm');assert.equal(f.appState.pre.candidateRows[0].Slump,12.5);assert.equal(f.appState.pre.candidateRows[0]._freshEvidence.Slump.raw,'125 mm')});
test('exportação revalida antes de consumir resumo antigo',()=>{const f=mount(fixture([row('1'),row('2')]));f.appState.pre.convertedRows=f.appState.pre.candidateRows;f.appState.pre.summary={criticals:0};f.Exporter.downloadImport();assert.equal(f.calls.export,0);assert.ok(f.appState.pre.summary.criticals>0)});
test('guardas existentes não são descartadas',()=>{const f=fixture();f.appState.pre.issues=[{type:'business_existing',severity:'CRÍTICO'}];mount(f);f.Converter.finalize();assert.ok(f.appState.pre.issues.some(x=>x.type==='business_existing'))});
test('interface identifica referência e impede clique de aceite',()=>{const f=mount(fixture());const h=f.UI.proposalCard({referenceOnly:true});assert.match(h,/disabled/);assert.match(h,/Referência/)});
test('interface mostra escolha de unidade separada e numeração revisável',()=>{const f=mount(fixture());assert.match(f.UI.preMapping(),/data-import-unit-field="Slump"/);assert.match(f.UI.preMapping(),/data-import-unit-field="Flow"/);assert.match(f.UI.prePreview(),/Número Concretagem/);assert.match(f.UI.preSetup(),/id="setting-volumeDefault" disabled/)});

// R02: alterar origem invalida exportação; o mapeamento confirmado não é recalculado.
test('R02 preparo conserva mapeamento confirmado sem chamar refreshMapping',()=>{
 const f=fixture();let resets=0;
 f.Actions.refreshMapping=()=>{resets++;f.appState.pre.mapping.fields.Slump.sourceIndex=99};
 f.Actions.prepareInference=function(){this.refreshMapping();f.Converter.prepare()};
 mount(f);f.Actions.prepareInference();
 assert.equal(resets,0);assert.equal(f.appState.pre.mapping.fields.Slump.sourceIndex,0);
});
for(const [name,change] of [
 ['coluna', f=>{f.appState.pre.mapping.fields.Slump.sourceIndex=1}],
 ['aba', f=>{f.Actions.selectSheet('Nova')}],
 ['arquivo', f=>{f.appState.pre.file={name:'novo.xlsx',size:10,lastModified:1}}],
 ['cabecalho', f=>{f.appState.pre.columns[0].rawLabel='Slump previsto (mm)'}],
 ['unidade', f=>{f.listeners.change({target:{dataset:{importUnitField:'Slump'},value:'cm'}})}],
 ['politica', f=>{f.appState.settings.slumpSourceMeaning='specification'}],
 ['catalogo', f=>{f.appState.insumos.usinas=['Outra']}],
]) test('R02 recusa exportação obsoleta após alterar '+name,()=>{
 const f=mount(fixture());f.Converter.prepare();f.Converter.finalize();change(f);
 f.appState.settings.strictMode=false;f.Exporter.downloadImport();
 assert.equal(f.calls.export,0);assert.ok(f.calls.warnings.some(s=>/origem|mapeamento|prepar/i.test(s)));
});
test('R02 exportação exige preparo anterior mesmo sem crítico de negócio',()=>{
 const f=mount(fixture());f.Converter.finalize();f.Exporter.downloadImport();assert.equal(f.calls.export,0);
});
test('R02 edição de valor preserva contexto e permite exportar após conferência',()=>{
 const f=mount(fixture());f.Converter.prepare();f.Converter.finalize();f.Actions.editRow('1','Slump','12,5');
 assert.equal(f.Exporter.downloadImport(),true);assert.equal(f.calls.export,1);
});
test('R02 modo rascunho não invalida por si só o preparo',()=>{
 const f=mount(fixture());f.Converter.prepare();f.Converter.finalize();f.appState.settings.strictMode=false;
 assert.equal(f.Exporter.downloadImport(),true);
});
test('R02 novo preparo da origem atual permite exportação novamente',()=>{
 const f=mount(fixture());f.Converter.prepare();f.Converter.finalize();f.appState.pre.columns[0].rawLabel='Slump (cm)';
 f.Exporter.downloadImport();assert.equal(f.calls.export,0);
 f.Converter.prepare();f.Converter.finalize();assert.equal(f.Exporter.downloadImport(),true);
});
test('R02 porta de loading ausente é negada antes de instalar parcialmente',()=>{
 const f=fixture();delete f.UI.loading;const original=f.Converter.prepare;
 assert.throws(()=>A.install(f),/INVALID_IMPORT_ADAPTER_PORTS/);assert.equal(f.Converter.prepare,original);
});
