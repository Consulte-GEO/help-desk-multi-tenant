#!/usr/bin/env node
/**
 * Gate de CI — Importador de planilha de implantação (I1–I18).
 * Uso: node tools/run-implantacao-import-tests.js
 *
 * Testa frontend/public/assets/implantacao-import-core.js contra fixtures
 * SINTÉTICAS construídas em memória (nenhum dado real de cliente):
 *   - formato NOVO (R02 tabular);
 *   - formato LEGADO (R00/R01, seções em duas colunas + blocos rótulo/valor);
 *   - o próprio modelo R02 em branco gerado em public/modelos/ (regressão:
 *     o modelo que distribuímos precisa ser parseável pelo importador).
 */
'use strict';

var path = require('path');
var fs = require('fs');
var vm = require('vm');
var Module = require('module');

/* ── XLSX (mesma resolução do run-intake-tests.js) ─────────────────────── */
var XLSX;
var candidatos = ['xlsx', 'xlsx-js-style',
  path.join(__dirname, '..', 'frontend', 'node_modules', 'xlsx-js-style'),
  path.join(__dirname, '..', 'frontend', 'node_modules', 'xlsx')];
for (var i = 0; i < candidatos.length && !XLSX; i++) {
  try { XLSX = require(candidatos[i]); } catch (e) { /* próximo */ }
}
if (!XLSX) {
  try {
    var vendor = path.join(__dirname, '..', 'frontend', 'public', 'vendor', 'xlsx.full.min.js');
    var mod = new Module(vendor + '.cjs', module);
    mod.filename = vendor + '.cjs';
    mod.paths = Module._nodeModulePaths(path.dirname(vendor));
    mod._compile(fs.readFileSync(vendor, 'utf8'), mod.filename);
    XLSX = mod.exports;
  } catch (e) { /* abaixo */ }
}
if (!XLSX) { console.error('SheetJS indisponível: rode `npm ci` em frontend/ ou restaure frontend/public/vendor/xlsx.full.min.js.'); process.exit(2); }

/* ── core via vm (frontend é "type: module"; UMD publica no contexto) ──── */
var context = vm.createContext({ console: console });
context.globalThis = context;
context.self = context;
vm.runInContext(
  fs.readFileSync(path.join(__dirname, '..', 'frontend', 'public', 'assets', 'implantacao-import-core.js'), 'utf8'),
  context,
  { filename: 'implantacao-import-core.js' }
);
var Core = context.ImplantacaoImportCore;
if (!Core || typeof Core.parse !== 'function') {
  console.error('ImplantacaoImportCore não carregou.');
  process.exit(2);
}

/* ── harness ───────────────────────────────────────────────────────────── */
var results = [];
function check(id, name, fn) {
  try {
    var info = fn();
    results.push({ id: id, name: name, pass: true, info: info || '' });
  } catch (e) {
    results.push({ id: id, name: name, pass: false, info: e && e.message ? e.message : String(e) });
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }
function wbFromTabs(tabs) {
  var wb = XLSX.utils.book_new();
  Object.keys(tabs).forEach(function (nome) {
    var ws = XLSX.utils.aoa_to_sheet(tabs[nome].rows);
    if (tabs[nome].merges) ws['!merges'] = tabs[nome].merges;
    XLSX.utils.book_append_sheet(wb, ws, nome);
  });
  return wb;
}

/* ══ Fixture 1 — FORMATO NOVO (R02) ═════════════════════════════════════ */
var wbNovo = wbFromTabs({
  'Obra': { rows: [
    ['Dados da Obra', null],
    ['Empresa / Contratante *', 'Construtora Exemplo Alfa'],
    ['CNPJ', '00.000.000/0001-91'],
    ['Nome da Obra *', 'Residencial Teste Beta'],
    ['Endereço completo *', 'Rua Fictícia, 100 - Centro'],
    ['CEP', '00000-000'],
    ['Cidade / Regional', 'São Paulo - SP'],
    ['Quantidade de blocos/torres', 5],
    ['Número de unidades', 200],
    ['Engenheiro da obra', 'Eng. Sintético'],
  ] },
  'Estruturas': { rows: [
    ['Tipo de Estrutura *', 'Número da Estrutura *', 'Nomenclatura no Sistema', 'Projetista (opcional)', 'Observações'],
    ['Torre', '1 a 5', 'Torres 1 a 5', 'Projetos Fictícios Ltda', ''],
    ['Área Externa', '-', 'Área Externa', '', 'muros e passeio'],
    ['Pirâmide', '9', 'Formato inválido', '', ''],
  ] },
  'Concretos': { rows: [
    ['Concreto Padrão (descrição completa) *', 'Aplicação *', 'FCK (MPa)', 'Padrão de Moldagem dos Ensaios'],
    ['FCK 30 | Bombeável - Slump 120±20mm', 'Estrutura', 30, '1 CP - 7d / 2 CPs - 28d'],
    ['FCK 25 | Brita 1 - Slump 10±2cm', 'Fundação', '', '2 CPs - 28d'],
  ] },
  'Peças': { rows: [
    ['Estrutura *', 'Peça/Pavimento *', 'Etapa', 'FCK de Projeto *', 'Volume por unidade (m³)', 'Concreto aplicado', 'Observações'],
    ['1 a 5', 'Pavimento Tipo', 'Estrutura', 'FCK 30', 98.31782236, 'FCK 30 | Bombeável - Slump 120±20mm', ''],
    ['1 a 5', 'Estacas', '', 'FCK 25', '12,50', 'FCK 25 | Brita 1 - Slump 10±2cm', ''],
    ['Área Externa', 'Muro de Divisa', '', '30 MPa', '', 'Traço que não existe', ''],
    ['Estrutura Inexistente', 'Peça Órfã', '', '30', '1', '', ''],
  ] },
  'Usuários': { rows: [
    ['Nome *', 'Email *', 'Cargo', 'Telefone', 'Perfil de acesso'],
    ['Fulano de Teste', 'fulano@exemplo.com.br', 'Engenheiro Civil', '(00) 90000-0000', 'Engenheiro'],
    ['Beltrana Fictícia', 'beltrana@exemplo.com.br', 'Analista', '', 'Analista / Gestor'],
  ] },
  'Fornecedores': { rows: [
    ['Tipo *', 'Nome *', 'CNPJ', 'Endereço', 'Responsável', 'Emails de programação (até 3, separados por ;)', 'Telefone', 'Observações'],
    ['Usina', 'Usina Sintética Ltda', '11.111.111/0001-11', 'Av. Teste, 1', 'Resp. Usina', 'prog@usina-teste.com.br; com@usina-teste.com.br', '(00) 3333-0000', ''],
    ['Laboratório', 'Lab Exemplo', '', '', '', 'lab@exemplo.com.br', '', ''],
  ] },
});
var novo = Core.parseWorkbook(wbNovo, XLSX);

check('I1', 'novo · formato detectado', function () {
  assert(novo.formato === 'novo', 'formato=' + novo.formato);
  return 'novo';
});
check('I2', 'novo · metadata da obra', function () {
  assert(novo.metadata.clienteNome === 'Construtora Exemplo Alfa', 'clienteNome=' + novo.metadata.clienteNome);
  assert(novo.metadata.obraNome === 'Residencial Teste Beta', 'obraNome=' + novo.metadata.obraNome);
  assert(novo.metadata.obraCEP === '00000-000', 'cep=' + novo.metadata.obraCEP);
  assert(novo.metadata.obraEndereco.indexOf('Rua Fictícia') === 0, 'endereco=' + novo.metadata.obraEndereco);
  assert(/CNPJ:/.test(novo.metadata.obraObservacoes) && /Engenheiro da obra/.test(novo.metadata.obraObservacoes),
    'obs=' + novo.metadata.obraObservacoes);
  return novo.metadata.obraNome;
});
check('I3', 'novo · 3 estruturas com tipo/número/projetista', function () {
  assert(novo.grupos.length === 3, 'grupos=' + novo.grupos.length);
  var g = novo.grupos[0];
  assert(g.tipoEdificacao === 'Torre' && g.edificacoesInput === '1 a 5', g.tipoEdificacao + '/' + g.edificacoesInput);
  assert(g.projetista === 'Projetos Fictícios Ltda', 'projetista=' + g.projetista);
  assert(novo.grupos[1].tipoEdificacao === 'Área Externa', 'g2=' + novo.grupos[1].tipoEdificacao);
  return '3 grupos';
});
check('I4', 'novo · tipo fora da lista vira Bloco + aviso', function () {
  assert(novo.grupos[2].tipoEdificacao === 'Bloco', 'tipo=' + novo.grupos[2].tipoEdificacao);
  assert(novo.avisos.some(function (a) { return a.indexOf('Pirâmide') >= 0; }), 'sem aviso de tipo inválido');
  return 'Bloco + aviso';
});
check('I5', 'novo · peças vinculadas à estrutura certa', function () {
  assert(novo.grupos[0].pecas.length === 2, 'pecas torre=' + novo.grupos[0].pecas.length);
  assert(novo.grupos[1].pecas.length === 1, 'pecas area=' + novo.grupos[1].pecas.length);
  return '2+1 peças';
});
check('I6', 'novo · FCK extraído de "FCK 30" e "30 MPa"', function () {
  assert(novo.grupos[0].pecas[0].fck === 30, 'fck=' + novo.grupos[0].pecas[0].fck);
  assert(novo.grupos[1].pecas[0].fck === 30, 'fck area=' + novo.grupos[1].pecas[0].fck);
  return 'fck 30';
});
check('I7', 'novo · volume >2 casas arredondado com aviso; "12,50" preservado', function () {
  assert(novo.grupos[0].pecas[0].volume === '98,32', 'vol=' + novo.grupos[0].pecas[0].volume);
  assert(novo.grupos[0].pecas[1].volume === '12,5', 'vol2=' + novo.grupos[0].pecas[1].volume);
  assert(novo.avisos.some(function (a) { return /arredondad/.test(a); }), 'sem aviso de arredondamento');
  return '98,32';
});
check('I8', 'novo · concreto casado por descrição; não casado vira aviso', function () {
  assert(novo.concretos.length === 2, 'concretos=' + novo.concretos.length);
  var id = novo.concretos[0].id;
  assert(novo.grupos[0].pecas[0].concretoId === id, 'concretoId não casou');
  assert(novo.grupos[1].pecas[0].concretoId === '', 'deveria ficar vazio');
  assert(novo.avisos.some(function (a) { return /sem correspond/.test(a); }), 'sem aviso de concreto não casado');
  return 'casou 1º, avisou 3º';
});
check('I9', 'novo · peça com estrutura inexistente é ignorada com aviso', function () {
  var total = 0;
  novo.grupos.forEach(function (g) { total += g.pecas.length; });
  assert(total === 3, 'total pecas=' + total);
  assert(novo.avisos.some(function (a) { return a.indexOf('Estrutura Inexistente') >= 0; }), 'sem aviso de peça órfã');
  return '3 peças válidas';
});
check('I10', 'novo · usuários com perfil mapeado', function () {
  assert(novo.usuariosObra.length === 2, 'usuarios=' + novo.usuariosObra.length);
  assert(novo.usuariosObra[0].perfil === 'engenheiro', 'p1=' + novo.usuariosObra[0].perfil);
  assert(novo.usuariosObra[1].perfil === 'analista_gestor', 'p2=' + novo.usuariosObra[1].perfil);
  return 'engenheiro + analista_gestor';
});
check('I11', 'novo · fornecedores com tipo e emails divididos', function () {
  assert(novo.fornecedores.length === 2, 'fornecedores=' + novo.fornecedores.length);
  assert(novo.fornecedores[0].tipo === 'usina' && novo.fornecedores[0].emailsProgramacao.length === 2,
    novo.fornecedores[0].tipo + '/' + novo.fornecedores[0].emailsProgramacao.length);
  assert(novo.fornecedores[1].tipo === 'laboratorio', 'f2=' + novo.fornecedores[1].tipo);
  return '2 fornecedores';
});
check('I12', 'novo · resumo consistente', function () {
  assert(novo.resumo.estruturas === 3 && novo.resumo.pecas === 3 && novo.resumo.concretos === 2
    && novo.resumo.usuarios === 2 && novo.resumo.fornecedores === 2,
    JSON.stringify(novo.resumo));
  return JSON.stringify(novo.resumo);
});

/* ══ Fixture 2 — FORMATO LEGADO (R00/R01) ═══════════════════════════════ */
var wbLegado = wbFromTabs({
  'Dados Obra l Acessos': { rows: [
    [null, null, null],
    [null, 'EMPRESA/CONTRATANTE:', 'Construtora Legada Exemplo'],
    [null, 'CNPJ:', '22.222.222/0001-22'],
    [null, 'NOME DA OBRA:', 'Obra Legada Sintética'],
    [null, 'ENDEREÇO COMPLETO DA OBRA:', 'Rua Antiga, 50'],
    [null, 'CEP:', '11111-111'],
    [null, 'REGIONAL:', 'Regional Fictícia'],
    [null, 'QUANTIDADE DE BLOCOS/TORRES:', 3],
    [null, 'NUMERO DE UNIDADES:', 90],
    [null, 'ENGENHEIRO DA OBRA:', 'Eng. Legado'],
    [null, null, null],
    [null, 'USUÁRIO 1', null],
    [null, 'Nome', 'Usuária Sintética'],
    [null, 'Email', 'usuaria@exemplo.com.br'],
    [null, 'Cargo', 'Qualidade'],
    [null, 'Telefone', '(00) 98888-7777'],
    [null, 'Perfil', 'Qualidade'],
    [null, null, null],
    [null, 'USUÁRIO 2', null],
    [null, 'Nome', 'Operador Sintético'],
    [null, 'Email', 'operador@exemplo.com.br'],
    [null, 'Cargo', 'Apontador'],
    [null, 'Telefone', ''],
    [null, 'Perfil', 'Operador de campo'],
  ] },
  'Estrutura': {
    rows: [
      ['CONTROLE TECNOLÓGICO DO CONCRETO', null, null, null, null, null, null],
      ['TORRE: 1', null, null, null, 'ÁREA EXTERNA', null, null],
      ['Unidade/Peça *', 'FCK de Projeto *', 'Volume por unidade (m³)', null, 'Unidade/Peça *', 'FCK de Projeto *', 'Volume por unidade (m³)'],
      ['Estacas', 'FCK 25', '12,5', null, 'Muro de Arrimo', 'FCK 30', 8.123],
      ['Pavimento Tipo', 'FCK 30', 98.31782236, null, null, null, null],
      [null, null, null, null, null, null, null],
      ['CONTENÇÕES', null, null, null, null, null, null],
      ['Unidade/Peça *', 'FCK de Projeto *', 'Volume por unidade (m³)', null, null, null, null],
      ['Cortina Atirantada', 'FCK 35', '20', null, null, null, null],
    ],
    merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }],
  },
  'Concreto': { rows: [
    ['CONCRETOS DA OBRA', null, null, null],
    ['Concreto Padrão', 'Aplicação', 'Padrão de Moldagem dos Ensaios *', 'Curva de Crescimento'],
    ['FCK 30 | Bombeável - Slump 120±20mm', 'Estrutura', '1 CP - 7d / 2 CPs - 28d', '7d: 0,7'],
    ['FCK 25 | Brita 1', 'Fundação', '2 CPs - 28d', '14d: 0,85'],
    ['Curva de crescimento padrão', null, null, null],
  ] },
  'Usina': { rows: [
    ['Nome da usina', 'Usina Legada Sintética'],
    ['CNPJ', '33.333.333/0001-33'],
    ['Endereço', 'Rod. Teste, km 1'],
    ['Responsavel', 'Resp. Legado'],
    ['Email', 'prog@usinalegada.com.br com@usinalegada.com.br'],
    ['Telefone', '(00) 4444-0000'],
  ] },
  'Laboratório': { rows: [
    ['Nome do laboratório', 'Laboratório Legado'],
    ['CNPJ', ''],
    ['Endereço', ''],
    ['Responsavel', 'Resp. Lab'],
    ['Email', 'lab@legado.com.br'],
    ['Telefone', ''],
  ] },
});
var leg = Core.parseWorkbook(wbLegado, XLSX);

check('I13', 'legado · formato detectado + aviso de modelo antigo', function () {
  assert(leg.formato === 'legado', 'formato=' + leg.formato);
  assert(leg.avisos.some(function (a) { return /modelo antigo/i.test(a); }), 'sem aviso de modelo antigo');
  return 'legado';
});
check('I14', 'legado · obra + usuários dos blocos USUÁRIO N', function () {
  assert(leg.metadata.obraNome === 'Obra Legada Sintética', 'obraNome=' + leg.metadata.obraNome);
  assert(leg.metadata.clienteNome === 'Construtora Legada Exemplo', 'cliente=' + leg.metadata.clienteNome);
  assert(leg.usuariosObra.length === 2, 'usuarios=' + leg.usuariosObra.length);
  assert(leg.usuariosObra[0].perfil === 'qualidade', 'p1=' + leg.usuariosObra[0].perfil);
  assert(leg.usuariosObra[1].perfil === 'operador_campo', 'p2=' + leg.usuariosObra[1].perfil);
  return '2 usuários';
});
check('I15', 'legado · 3 seções em 2 colunas viram 3 estruturas', function () {
  assert(leg.grupos.length === 3, 'grupos=' + leg.grupos.length + ' (' + leg.grupos.map(function (g) { return g.tipoEdificacao + ':' + g.edificacoesInput; }).join(' | ') + ')');
  var torre = leg.grupos[0];
  assert(torre.tipoEdificacao === 'Torre' && torre.edificacoesInput === '1', torre.tipoEdificacao + '/' + torre.edificacoesInput);
  assert(torre.pecas.length === 2, 'pecas torre=' + torre.pecas.length);
  var area = leg.grupos.filter(function (g) { return g.tipoEdificacao === 'Área Externa'; })[0];
  assert(area && area.pecas.length === 1, 'área externa ausente ou sem peças');
  var cont = leg.grupos.filter(function (g) { return g.tipoEdificacao === 'Contenção'; })[0];
  assert(cont && cont.pecas.length === 1, 'contenção ausente');
  return 'Torre:1 + Área Externa + Contenção';
});
check('I16', 'legado · etapa por heurística (Estacas→Fundação, Cortina→Contenção)', function () {
  var torre = leg.grupos[0];
  assert(torre.pecas[0].etapa === 'Fundação', 'estacas=' + torre.pecas[0].etapa);
  assert(torre.pecas[1].etapa === 'Estrutura', 'pav=' + torre.pecas[1].etapa);
  var cont = leg.grupos.filter(function (g) { return g.tipoEdificacao === 'Contenção'; })[0];
  assert(cont.pecas[0].etapa === 'Contenção', 'cortina=' + cont.pecas[0].etapa);
  return 'heurística OK';
});
check('I17', 'legado · concretos sem linha de curva; usina+lab com emails', function () {
  assert(leg.concretos.length === 2, 'concretos=' + leg.concretos.length);
  assert(leg.concretos[0].fck === 30, 'fck=' + leg.concretos[0].fck);
  assert(leg.fornecedores.length === 2, 'fornecedores=' + leg.fornecedores.length);
  assert(leg.fornecedores[0].tipo === 'usina' && leg.fornecedores[0].emailsProgramacao.length === 2,
    'usina emails=' + leg.fornecedores[0].emailsProgramacao.length);
  assert(leg.fornecedores[1].tipo === 'laboratorio', 'f2=' + leg.fornecedores[1].tipo);
  return '2 concretos + 2 fornecedores';
});

/* ══ Formato desconhecido + modelo R02 real ═════════════════════════════ */
check('I18', 'formato desconhecido lança erro claro', function () {
  var wbX = wbFromTabs({ 'Planilha1': { rows: [['a', 'b'], [1, 2]] } });
  var threw = false;
  try { Core.parseWorkbook(wbX, XLSX); } catch (e) { threw = /não reconhecido/i.test(e.message); }
  assert(threw, 'não lançou/mensagem errada');
  return 'erro claro';
});
check('I19', 'modelo R02 distribuído em public/modelos parseia como novo (em branco)', function () {
  var arquivo = path.join(__dirname, '..', 'frontend', 'public', 'modelos', 'Modelo-Implantacao-Consulte-GEO-R02.xlsx');
  assert(fs.existsSync(arquivo), 'modelo R02 ausente em public/modelos/');
  var data = new Uint8Array(fs.readFileSync(arquivo));
  var out = Core.parse(data, XLSX);
  assert(out.formato === 'novo', 'formato=' + out.formato);
  assert(out.resumo.estruturas === 0 && out.resumo.pecas === 0, 'modelo em branco deveria ter 0 registros: ' + JSON.stringify(out.resumo));
  return 'novo · vazio';
});
check('I22', 'novo · peça referenciando o TIPO casa com a única estrutura do tipo (com aviso)', function () {
  var wbT = wbFromTabs({
    'Estruturas': { rows: [
      ['Tipo de Estrutura *', 'Número da Estrutura *', 'Nomenclatura no Sistema', 'Projetista (opcional)', 'Observações'],
      ['Torre', '1 a 2', 'Torres 1 e 2', '', ''],
      ['Contenção', '-', 'Contenções', '', ''],
      ['Área Externa', '-', 'Área Externa', '', ''],
    ] },
    'Peças': { rows: [
      ['Estrutura *', 'Peça/Pavimento *', 'Etapa', 'FCK de Projeto *', 'Volume por unidade (m³)', 'Concreto aplicado', 'Observações'],
      ['Contenção', 'Muro de Arrimo', '', 'FCK 30', '58,90', '', ''],
      ['Área Externa', 'Passeio', '', 'FCK 25', '35', '', ''],
      ['1 a 2', 'Pavimento Tipo', '', 'FCK 30', '76,40', '', ''],
    ] },
  });
  var out = Core.parseWorkbook(wbT, XLSX);
  var cont = out.grupos.filter(function (g) { return g.tipoEdificacao === 'Contenção'; })[0];
  var area = out.grupos.filter(function (g) { return g.tipoEdificacao === 'Área Externa'; })[0];
  var torre = out.grupos.filter(function (g) { return g.tipoEdificacao === 'Torre'; })[0];
  assert(cont.pecas.length === 1, 'contenção pecas=' + cont.pecas.length + ' (tipo não casou)');
  // regressão da colisão: '-' NÃO pode ser chave — senão Área Externa roubaria a peça da Contenção
  assert(area.pecas.length === 1 && area.pecas[0].local === 'Passeio', 'área externa pecas=' + area.pecas.length);
  assert(torre.pecas.length === 1, 'torre pecas=' + torre.pecas.length);
  assert(out.avisos.some(function (a) { return /pelo tipo em vez da nomenclatura/.test(a); }), 'sem aviso de casamento por tipo');
  return '3 peças casadas, 0 perdidas';
});
check('I23', 'novo · tipo AMBÍGUO (2 estruturas do mesmo tipo) não chuta — peça vira aviso', function () {
  var wbA = wbFromTabs({
    'Estruturas': { rows: [
      ['Tipo de Estrutura *', 'Número da Estrutura *', 'Nomenclatura no Sistema', 'Projetista (opcional)', 'Observações'],
      ['Contenção', '-', 'Contenção Norte', '', ''],
      ['Contenção', '-', 'Contenção Sul', '', ''],
    ] },
    'Peças': { rows: [
      ['Estrutura *', 'Peça/Pavimento *', 'Etapa', 'FCK de Projeto *', 'Volume por unidade (m³)', 'Concreto aplicado', 'Observações'],
      ['Contenção', 'Muro', '', 'FCK 30', '10', '', ''],
      ['Contenção Sul', 'Cortina', '', 'FCK 30', '20', '', ''],
    ] },
  });
  var out = Core.parseWorkbook(wbA, XLSX);
  var total = 0;
  out.grupos.forEach(function (g) { total += g.pecas.length; });
  assert(total === 1, 'esperado 1 peça casada (a exata); total=' + total);
  var sul = out.grupos.filter(function (g) { return g.nome === 'Contenção Sul'; })[0];
  assert(sul.pecas.length === 1 && sul.pecas[0].local === 'Cortina', 'peça exata não casou com Contenção Sul');
  assert(out.avisos.some(function (a) { return /não encontrada/.test(a); }), 'sem aviso da ambígua');
  return 'ambígua avisada, exata casada';
});
check('I21', 'legado · seção-template vazia duplicada é descartada; vazia única é mantida', function () {
  var wbDup = wbFromTabs({
    'Dados Obra l Acessos': { rows: [['NOME DA OBRA:', 'Obra Dedupe']] },
    'Estrutura': { rows: [
      ['CONTENÇÕES', null, null, null, 'CONTENÇÕES', null, null],
      ['Unidade/Peça *', 'FCK de Projeto *', 'Volume por unidade (m³)', null, 'Unidade/Peça *', 'FCK de Projeto *', 'Volume por unidade (m³)'],
      ['Muro de Arrimo', 'FCK 25', '10', null, 'Muro de Arrimo', null, null],
      ['Parede Diafragma', 'FCK 40', '20', null, 'Parede Diafragma', null, null],
      [null, null, null, null, null, null, null],
      ['ÁREA EXTERNA', null, null, null, null, null, null],
      ['Unidade/Peça *', 'FCK de Projeto *', 'Volume por unidade (m³)', null, null, null, null],
      ['Passeio', null, null, null, null, null, null],
    ] },
  });
  var out = Core.parseWorkbook(wbDup, XLSX);
  assert(out.grupos.length === 2, 'grupos=' + out.grupos.length + ' (esperado 2: contenção preenchida + área externa vazia única)');
  var cont = out.grupos.filter(function (g) { return g.tipoEdificacao === 'Contenção'; });
  assert(cont.length === 1, 'contenções=' + cont.length);
  assert(cont[0].pecas[0].fck === 25, 'manteve a errada? fck=' + cont[0].pecas[0].fck);
  var area = out.grupos.filter(function (g) { return g.tipoEdificacao === 'Área Externa'; });
  assert(area.length === 1 && area[0].pecas.length === 1, 'área externa vazia (sem duplicata) deveria ser mantida');
  assert(out.avisos.some(function (a) { return /template em branco/.test(a); }), 'sem aviso de descarte');
  return 'descartou 1 template, manteve vazia única';
});
check('I20', 'ids gerados pelo core são únicos', function () {
  var ids = [];
  novo.grupos.forEach(function (g) { ids.push(g.id); g.pecas.forEach(function (p) { ids.push(p.id); }); });
  novo.concretos.forEach(function (c) { ids.push(c.id); });
  leg.grupos.forEach(function (g) { ids.push(g.id); });
  var set = {};
  ids.forEach(function (id) { assert(!set[id], 'id duplicado: ' + id); set[id] = 1; });
  assert(ids.length > 8, 'poucos ids: ' + ids.length);
  return ids.length + ' ids únicos';
});

/* ── saída ─────────────────────────────────────────────────────────────── */
var failed = 0;
results.forEach(function (r) {
  if (!r.pass) failed++;
  console.log((r.pass ? 'OK   ' : 'FALHA') + ' ' + r.id + ' - ' + r.name + (r.pass ? (r.info ? '  → ' + r.info : '') : '  → ' + r.info));
});
console.log(results.length - failed + '/' + results.length + ' verdes');
process.exit(failed ? 1 : 0);
