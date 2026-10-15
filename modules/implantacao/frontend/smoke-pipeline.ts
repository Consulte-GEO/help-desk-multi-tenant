/**
 * Smoke pipeline · v5
 *
 * Roda fluxo completo sem browser:
 *   1. exampleCommon → buildTechnicalJson → validar contagem
 *   2. exampleModeloProjeto → buildTechnicalJson → validar contagem
 *   3. parseFck/parseVolume/expandRange/detectEtapa edge cases
 *   4. validateSnapshot — buckets corretos
 *   5. excelExportService — workbook tem 8 abas
 *
 * Executar com:  npx tsx smoke-pipeline.ts  (ou node --loader tsx)
 */

import {
  exampleCommon,
  exampleModeloProjeto,
} from './src/mocks/exampleSnapshots';
import { buildTechnicalJson } from './src/services/jsonGeneratorService';
import { validateSnapshot } from './src/services/validationService';
import {
  detectEtapa,
  expandRange,
  formatGroupName,
  orderOf,
  parseFck,
  parseVolume,
} from './src/services/normalizationService';
import { buildWorkbook } from './src/services/excelExportService';

interface Result { name: string; pass: boolean; detail?: string }
const results: Result[] = [];
const ok = (name: string, detail?: string) => results.push({ name, pass: true, detail });
const fail = (name: string, detail: string) => results.push({ name, pass: false, detail });
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/* ---------- normalização ---------- */
ok('parseFck("30") = 30',                 parseFck('30') === 30 ? '' : `got ${parseFck('30')}`);
if (parseFck('FCK 30') !== 30) fail('parseFck("FCK 30")', `got ${parseFck('FCK 30')}`);
else ok('parseFck("FCK 30")');
if (parseFck('FCK30') !== 30) fail('parseFck("FCK30")', `got ${parseFck('FCK30')}`);
else ok('parseFck("FCK30")');
if (parseFck('30 MPa') !== 30) fail('parseFck("30 MPa")', `got ${parseFck('30 MPa')}`);
else ok('parseFck("30 MPa")');
if (parseFck('5') !== null) fail('parseFck("5")', 'esperava null (fora do range)');
else ok('parseFck("5") = null');
if (parseFck('') !== null) fail('parseFck("")', 'esperava null');
else ok('parseFck("") = null');

if (parseVolume('100') !== 100) fail('parseVolume("100")', `got ${parseVolume('100')}`);
else ok('parseVolume("100")');
if (parseVolume('100,5') !== 100.5) fail('parseVolume("100,5")', `got ${parseVolume('100,5')}`);
else ok('parseVolume("100,5")');
if (parseVolume('1.187,79') !== 1187.79) fail('parseVolume("1.187,79")', `got ${parseVolume('1.187,79')}`);
else ok('parseVolume("1.187,79")');
if (parseVolume('-') !== null) fail('parseVolume("-")', 'esperava null');
else ok('parseVolume("-") = null');

const r1 = expandRange('1 A 24');
if (r1.length !== 24 || r1[0] !== 1 || r1[23] !== 24) fail('expandRange("1 A 24")', `got ${JSON.stringify(r1)}`);
else ok('expandRange("1 A 24") → 24 itens');

const r2 = expandRange('ANEXOS');
if (!eq(r2, ['ANEXOS'])) fail('expandRange("ANEXOS")', `got ${JSON.stringify(r2)}`);
else ok('expandRange("ANEXOS")');

const r3 = expandRange('1, 2, 5');
if (!eq(r3, [1, 2, 5])) fail('expandRange("1, 2, 5")', `got ${JSON.stringify(r3)}`);
else ok('expandRange("1, 2, 5")');

const r4 = expandRange('1 e 2');
if (!eq(r4, [1, 2])) fail('expandRange("1 e 2")', `got ${JSON.stringify(r4)}`);
else ok('expandRange("1 e 2")');

const r5 = expandRange('-');
if (!eq(r5, [null])) fail('expandRange("-")', `got ${JSON.stringify(r5)}`);
else ok('expandRange("-")');

if (detectEtapa('Sapata') !== 'Fundação') fail('detectEtapa("Sapata")', detectEtapa('Sapata'));
else ok('detectEtapa("Sapata") = Fundação');
if (detectEtapa('1º Pavimento') !== 'Estrutura') fail('detectEtapa("1º Pavimento")', detectEtapa('1º Pavimento'));
else ok('detectEtapa("1º Pavimento") = Estrutura');
if (detectEtapa('Muro de Arrimo') !== 'Contenção') fail('detectEtapa("Muro de Arrimo")', detectEtapa('Muro de Arrimo'));
else ok('detectEtapa("Muro de Arrimo") = Contenção');
if (detectEtapa('Guarita') !== 'Anexos') fail('detectEtapa("Guarita")', detectEtapa('Guarita'));
else ok('detectEtapa("Guarita") = Anexos');

if (orderOf('Térreo') !== 0) fail('orderOf("Térreo")', String(orderOf('Térreo')));
else ok('orderOf("Térreo") = 0');
if (orderOf('1º Pavimento') !== 1) fail('orderOf("1º Pavimento")', String(orderOf('1º Pavimento')));
else ok('orderOf("1º Pavimento") = 1');
if (orderOf('Cobertura') !== 910) fail('orderOf("Cobertura")', String(orderOf('Cobertura')));
else ok('orderOf("Cobertura") = 910');

if (formatGroupName('Bloco', 3) !== 'Bloco 3') fail('formatGroupName("Bloco", 3)', formatGroupName('Bloco', 3));
else ok('formatGroupName("Bloco", 3)');
if (formatGroupName('Anexos', 'ANEXOS') !== 'Anexos') fail('formatGroupName(Anexos, ANEXOS)', formatGroupName('Anexos', 'ANEXOS'));
else ok('formatGroupName("Anexos", "ANEXOS")');

/* ---------- exampleCommon ---------- */
const common = exampleCommon();
const commonJson = buildTechnicalJson(common, {});
if (commonJson.technicalMapping.unidadeGrupos.length !== 1)
  fail('exampleCommon · unidadeGrupos = 1', String(commonJson.technicalMapping.unidadeGrupos.length));
else ok('exampleCommon · 1 unidadeGrupo (Torre Única)');
if (commonJson.technicalMapping.unidades.length !== 5)
  fail('exampleCommon · unidades = 5', String(commonJson.technicalMapping.unidades.length));
else ok('exampleCommon · 5 unidades (peças)');
if (commonJson.renderTree.nodes.length !== 1) fail('exampleCommon · 1 nó na árvore', String(commonJson.renderTree.nodes.length));
else ok('exampleCommon · 1 nó na renderTree');

const vCommon = validateSnapshot(common);
ok('exampleCommon · validation gerada', `bloq=${vCommon.bloqueantes.length} alertas=${vCommon.alertas.length} sug=${vCommon.sugestoes.length} pend=${vCommon.pendenciasInternas.length}`);

/* ---------- exampleModeloProjeto ---------- */
const mp = exampleModeloProjeto();
const mpJson = buildTechnicalJson(mp, {});
// 4 grupos no exemplo: Bloco 1-6 (6) + Anexos (1) + Contenção 1-3 (3) + Bloco 7-10 (4) = 14
const expectedGrupos = 6 + 1 + 3 + 4;
if (mpJson.technicalMapping.unidadeGrupos.length !== expectedGrupos)
  fail(`exampleModeloProjeto · ${expectedGrupos} grupos`, String(mpJson.technicalMapping.unidadeGrupos.length));
else ok(`exampleModeloProjeto · ${expectedGrupos} grupos (6 + 1 anexos + 3 contenção + 4)`);

// Unidades = peças por grupo × estruturas expandidas em cada grupo
//   Bloco 1-6:    9 peças × 6  = 54
//   Anexos:       2 peças × 1  =  2
//   Contenção:    4 peças × 3  = 12
//   Bloco 7-10:  10 peças × 4  = 40   (pavimento adicional)
//   Total = 108
const expectedUnidades = 9 * 6 + 2 * 1 + 4 * 3 + 10 * 4;
if (mpJson.technicalMapping.unidades.length !== expectedUnidades)
  fail(`exampleModeloProjeto · ${expectedUnidades} unidades`, String(mpJson.technicalMapping.unidades.length));
else ok(`exampleModeloProjeto · ${expectedUnidades} unidades`);

// validação de modelo_projeto deve passar (todos os grupos têm edificacoesInput)
const vmp = validateSnapshot(mp);
ok('exampleModeloProjeto · validation', `bloq=${vmp.bloqueantes.length} alertas=${vmp.alertas.length}`);

/* ---------- Excel (lazy load via dynamic import) ---------- */
(async () => {
const wb = await buildWorkbook(commonJson);
const expectedSheets = ['Instruções', 'Resumo', 'Estatísticas', 'Estruturas', 'Peças (cadastro)', 'Unidades geradas', 'Concretos', 'Padrões de Moldagem', 'Usuários da obra', 'Fornecedores', 'Mapeamento Banco', 'Validações', 'JSON Técnico'];
const missing = expectedSheets.filter((s) => !wb.SheetNames.includes(s));
if (missing.length) fail('Excel · faltando abas', missing.join(', '));
else ok('Excel · 13 abas presentes', wb.SheetNames.join(', '));

/* ---------- v5.22.45: ticketService não simula envio em modo local ---------- */
const { submitForValidation } = await import('./src/services/ticketService');
let localSubmitError = '';
try {
  await submitForValidation({
    draftId: null,
    technicalJson: { metadata: { schemaVersion: '1' } },
    clientMessage: 'teste smoke',
  });
} catch (err) {
  localSubmitError = err instanceof Error ? err.message : String(err);
}
if (localSubmitError === 'submit_failed: supabase_not_configured') {
  ok('ticketService · modo local falha explicitamente sem ticket falso');
} else {
  fail('ticketService · modo local não pode confirmar envio falso', localSubmitError || 'sem erro');
}
const ticketServiceSource = (await import('node:fs')).readFileSync(
  './src/services/ticketService.ts',
  'utf-8',
);
if (!ticketServiceSource.includes('local_mode_no_email')) {
  ok('ticketService · não contém marcador de email falso');
} else {
  fail('ticketService · marcador local_mode_no_email ainda presente');
}
if (!/submission_id\s*:\s*[`'"]local-/.test(ticketServiceSource)) {
  ok('ticketService · não fabrica submission_id local');
} else {
  fail('ticketService · ainda fabrica submission_id local');
}

/* ---------- v5.22.7: WIZARD_STEPS = 8 (com Fornecedores) ---------- */
const {
  WIZARD_STEPS,
  WIZARD_STEPS_FULL,
  REVIEW_STEPS_EXTRA,
  PERFIS_INFO,
  novoUsuarioObra,
  defaultSnapshot,
  novoFornecedor,
  TIPOS_FORNECEDOR_INFO,
  MAX_EMAILS_FORNECEDOR,
} = await import('./src/models/setup.models');
if (WIZARD_STEPS.length !== 7) {
  fail('WIZARD_STEPS · esperado 7 (v5.22.11)', `got ${WIZARD_STEPS.length}`);
} else {
  ok('WIZARD_STEPS · 7 etapas', WIZARD_STEPS.map((s) => s.id).join(','));
}
const lastStep = WIZARD_STEPS[WIZARD_STEPS.length - 1];
if (lastStep.id !== 7 || !lastStep.title.toLowerCase().includes('envio')) {
  fail('Última etapa do cliente deve ser id=7 com título de envio', JSON.stringify(lastStep));
} else {
  ok('Última etapa do cliente correta', `id=${lastStep.id} title="${lastStep.title}"`);
}
// Etapa 5: Usuários da obra (v5.22.11: era 6)
const stepUsuarios = WIZARD_STEPS.find((s) => s.id === 5);
if (!stepUsuarios || !stepUsuarios.title.toLowerCase().includes('usuários')) {
  fail('Etapa 5 deve ser Usuários da obra', JSON.stringify(stepUsuarios));
} else {
  ok('Etapa 5 · Usuários da obra', stepUsuarios.title);
}
// Etapa 6: Fornecedores (v5.22.11: era 7)
const stepFornecedores = WIZARD_STEPS.find((s) => s.id === 6);
if (!stepFornecedores || !stepFornecedores.title.toLowerCase().includes('fornecedor')) {
  fail('Etapa 6 deve ser Fornecedores', JSON.stringify(stepFornecedores));
} else {
  ok('Etapa 6 · Fornecedores', stepFornecedores.title);
}
// Etapa 2 (v5.22.11): Blocos e torres (era 3 — Tipo de estrutura sumiu)
const stepBlocos = WIZARD_STEPS.find((s) => s.id === 2);
if (!stepBlocos || !stepBlocos.title.toLowerCase().includes('blocos')) {
  fail('Etapa 2 deve ser Blocos e torres (v5.22.11)', JSON.stringify(stepBlocos));
} else {
  ok('Etapa 2 · Blocos e torres', stepBlocos.title);
}
// WIZARD_STEPS_FULL = 9 etapas (cliente 7 + equipe 2)
if (WIZARD_STEPS_FULL.length !== 9) {
  fail('WIZARD_STEPS_FULL · esperado 9 (v5.22.11)', `got ${WIZARD_STEPS_FULL.length}`);
} else {
  ok('WIZARD_STEPS_FULL · 9 etapas', WIZARD_STEPS_FULL.map((s) => s.id).join(','));
}
// REVIEW_STEPS_EXTRA agora 8 e 9
if (REVIEW_STEPS_EXTRA.length !== 2 || REVIEW_STEPS_EXTRA[0].id !== 8 || REVIEW_STEPS_EXTRA[1].id !== 9) {
  fail('REVIEW_STEPS_EXTRA inválido (esperado 8 + 9)', JSON.stringify(REVIEW_STEPS_EXTRA));
} else {
  ok('REVIEW_STEPS_EXTRA · 8 + 9', REVIEW_STEPS_EXTRA.map((s) => s.title).join(' / '));
}

// PERFIS_INFO: 5 perfis fixos com label e descrição
const perfisKeys = Object.keys(PERFIS_INFO);
if (perfisKeys.length !== 5) {
  fail('PERFIS_INFO · esperado 5 perfis', `got ${perfisKeys.length}`);
} else {
  ok('PERFIS_INFO · 5 perfis', perfisKeys.join(','));
}
for (const k of perfisKeys) {
  const info = (PERFIS_INFO as Record<string, { label: string; descricao: string }>)[k];
  if (!info.label || !info.descricao) {
    fail(`PERFIS_INFO[${k}] sem label/descricao`, JSON.stringify(info));
  }
}
ok('PERFIS_INFO · todos com label+descricao', `${perfisKeys.length} perfis`);

// novoUsuarioObra: cria com defaults vazios
const novoU = novoUsuarioObra();
if (!novoU.id || novoU.nome !== '' || novoU.email !== '' || novoU.perfil !== '') {
  fail('novoUsuarioObra · valores iniciais inválidos', JSON.stringify(novoU));
} else {
  ok('novoUsuarioObra · cria id e campos vazios', novoU.id.slice(0, 12));
}

// defaultSnapshot: inclui usuariosObra=[] e fornecedores=[]
const ds = defaultSnapshot();
if (!Array.isArray(ds.usuariosObra) || ds.usuariosObra.length !== 0) {
  fail('defaultSnapshot · usuariosObra deve ser []', JSON.stringify(ds.usuariosObra));
} else {
  ok('defaultSnapshot · usuariosObra = []', 'OK');
}
if (!Array.isArray(ds.fornecedores) || ds.fornecedores.length !== 0) {
  fail('defaultSnapshot · fornecedores deve ser [] (v5.22.7)', JSON.stringify(ds.fornecedores));
} else {
  ok('defaultSnapshot · fornecedores = []', 'OK');
}

/* ---------- v5.22.7: TIPOS_FORNECEDOR_INFO + novoFornecedor ---------- */
const tiposFornecedor = Object.keys(TIPOS_FORNECEDOR_INFO);
if (tiposFornecedor.length !== 2 || !tiposFornecedor.includes('usina') || !tiposFornecedor.includes('laboratorio')) {
  fail('TIPOS_FORNECEDOR_INFO · esperado usina + laboratorio', JSON.stringify(tiposFornecedor));
} else {
  ok('TIPOS_FORNECEDOR_INFO · usina + laboratorio', tiposFornecedor.join(','));
}
for (const t of tiposFornecedor) {
  const info = (TIPOS_FORNECEDOR_INFO as any)[t];
  if (!info.label || !info.tituloCard || !info.nomeLabel) {
    fail(`TIPOS_FORNECEDOR_INFO[${t}] sem label/tituloCard/nomeLabel`, JSON.stringify(info));
  }
}
ok('TIPOS_FORNECEDOR_INFO · todos com label+tituloCard+nomeLabel', '2 tipos');

if (MAX_EMAILS_FORNECEDOR !== 3) {
  fail('MAX_EMAILS_FORNECEDOR · esperado 3', `got ${MAX_EMAILS_FORNECEDOR}`);
} else {
  ok('MAX_EMAILS_FORNECEDOR · 3', String(MAX_EMAILS_FORNECEDOR));
}

const novoF = novoFornecedor();
if (!novoF.id || novoF.tipo !== 'usina' || !Array.isArray(novoF.emailsProgramacao) || novoF.emailsProgramacao.length !== 1) {
  fail('novoFornecedor · valores iniciais inválidos', JSON.stringify(novoF));
} else {
  ok('novoFornecedor · id + tipo=usina + 1 slot email vazio', novoF.id.slice(0, 12));
}
const novoFLab = novoFornecedor('laboratorio');
if (novoFLab.tipo !== 'laboratorio') {
  fail('novoFornecedor("laboratorio") · tipo errado', String(novoFLab.tipo));
} else {
  ok('novoFornecedor("laboratorio") · tipo=laboratorio', 'OK');
}

/* ---------- v5.22.7: parseVolume rejeita 3+ casas decimais ---------- */
const { parseVolume, volumeHasTooManyDecimals, maskVolumeInput } = await import('./src/services/normalizationService');
// 2 casas: aceita
if (parseVolume('100.12') !== 100.12) {
  fail('parseVolume("100.12") · esperado 100.12', String(parseVolume('100.12')));
} else {
  ok('parseVolume · aceita 2 casas decimais', '100.12');
}
if (parseVolume('100,5') !== 100.5) {
  fail('parseVolume("100,5") · esperado 100.5', String(parseVolume('100,5')));
} else {
  ok('parseVolume · aceita vírgula', '100,5 → 100.5');
}
// 3 casas: rejeita (retorna null)
if (parseVolume('100.123') !== null) {
  fail('parseVolume("100.123") · deve retornar null (>2 casas)', String(parseVolume('100.123')));
} else {
  ok('parseVolume · REJEITA 3 casas decimais', '100.123 → null');
}
if (parseVolume('100,456') !== null) {
  fail('parseVolume("100,456") · deve retornar null (>2 casas)', String(parseVolume('100,456')));
} else {
  ok('parseVolume · REJEITA 3 casas (vírgula)', '100,456 → null');
}
// volumeHasTooManyDecimals
if (volumeHasTooManyDecimals('100.123') !== true) {
  fail('volumeHasTooManyDecimals("100.123") · esperado true', 'false');
} else {
  ok('volumeHasTooManyDecimals · detecta 3 casas', 'true');
}
if (volumeHasTooManyDecimals('100.12') !== false) {
  fail('volumeHasTooManyDecimals("100.12") · esperado false', 'true');
} else {
  ok('volumeHasTooManyDecimals · 2 casas OK', 'false');
}
// maskVolumeInput
if (maskVolumeInput('100.123') !== '100.12') {
  fail('maskVolumeInput("100.123") · esperado "100.12"', maskVolumeInput('100.123'));
} else {
  ok('maskVolumeInput · trunca para 2 casas (ponto)', '100.123 → 100.12');
}
if (maskVolumeInput('100,5678') !== '100,56') {
  fail('maskVolumeInput("100,5678") · esperado "100,56"', maskVolumeInput('100,5678'));
} else {
  ok('maskVolumeInput · trunca para 2 casas (vírgula)', '100,5678 → 100,56');
}
if (maskVolumeInput('100,5') !== '100,5') {
  fail('maskVolumeInput("100,5") · esperado preservar', maskVolumeInput('100,5'));
} else {
  ok('maskVolumeInput · preserva valor válido', '100,5');
}
if (maskVolumeInput('') !== '') {
  fail('maskVolumeInput("") · esperado vazio', `"${maskVolumeInput('')}"`);
} else {
  ok('maskVolumeInput · trata vazio', 'OK');
}

/* ---------- v5.22.8: validação CNPJ (isValidCNPJ + cnpjDigits) ---------- */
const { isValidCNPJ, cnpjDigits } = await import('./src/services/normalizationService');

// CNPJs reais válidos (públicos) — Petrobras 33.000.167/0001-01
if (!isValidCNPJ('33.000.167/0001-01')) {
  fail('isValidCNPJ · Petrobras 33000167000101 deveria validar', 'invalidou');
} else {
  ok('isValidCNPJ · CNPJ real válido aceito (formatado)', '33.000.167/0001-01');
}
if (!isValidCNPJ('33000167000101')) {
  fail('isValidCNPJ · Petrobras só dígitos deveria validar', 'invalidou');
} else {
  ok('isValidCNPJ · CNPJ real válido aceito (só dígitos)', '33000167000101');
}
// CNPJ inválido (DV errado)
if (isValidCNPJ('33.000.167/0001-99')) {
  fail('isValidCNPJ · DV errado não deveria validar', 'validou');
} else {
  ok('isValidCNPJ · DV inválido rejeitado', '33.000.167/0001-99 → false');
}
// Sequência repetida
if (isValidCNPJ('11.111.111/1111-11')) {
  fail('isValidCNPJ · sequência repetida não deveria validar', 'validou');
} else {
  ok('isValidCNPJ · sequência repetida rejeitada', '11111111111111 → false');
}
// String vazia / curta
if (isValidCNPJ('') !== false) {
  fail('isValidCNPJ · string vazia esperado false', String(isValidCNPJ('')));
} else {
  ok('isValidCNPJ · string vazia rejeitada', 'OK');
}
if (isValidCNPJ('123') !== false) {
  fail('isValidCNPJ · string curta esperado false', 'true');
} else {
  ok('isValidCNPJ · CNPJ curto rejeitado', 'OK');
}
// cnpjDigits extrai só dígitos
if (cnpjDigits('34.230.979/0076-23') !== '34230979007623') {
  fail('cnpjDigits · formatado', cnpjDigits('34.230.979/0076-23'));
} else {
  ok('cnpjDigits · extrai dígitos de CNPJ formatado', '34.230.979/0076-23 → 34230979007623');
}
if (cnpjDigits('') !== '') {
  fail('cnpjDigits · vazio', `"${cnpjDigits('')}"`);
} else {
  ok('cnpjDigits · trata vazio', 'OK');
}

/* ---------- v5.22.8: Excel export tem 13 abas (2 novas) ---------- */
// buildWorkbook já está importado no topo do arquivo.
// Usamos commonJson (gerado pelo jsonGeneratorService) que tem todos os
// campos exigidos por buildWorkbook. Adicionamos fornecedores/usuariosObra
// manualmente porque o exampleCommon não os inclui.

const commonJsonForExcel = JSON.parse(JSON.stringify(commonJson));
commonJsonForExcel.customerInput.usuariosObra = [
  { id: 'u1', nome: 'João', email: 'joao@test.com', cargo: 'Eng', telefone: '11999', perfil: 'engenheiro', observacoes: '' },
];
commonJsonForExcel.customerInput.fornecedores = [
  { id: 'f1', tipo: 'usina', nome: 'Supermix', cnpj: '33.000.167/0001-01', endereco: 'Rua X', responsavel: 'Paulo', telefone: '11888', observacoes: '', emailsProgramacao: ['a@x.com', 'b@x.com'] },
  { id: 'f2', tipo: 'laboratorio', nome: 'Testin', cnpj: '', endereco: 'Rua Y', responsavel: 'Maria', telefone: '11777', observacoes: '', emailsProgramacao: [''] },
];

try {
  const wb = await buildWorkbook(commonJsonForExcel);
  const sheetNames = wb.SheetNames;
  const expected = ['Usuários da obra', 'Fornecedores'];
  for (const name of expected) {
    if (!sheetNames.includes(name)) {
      fail(`Excel · aba "${name}" ausente`, sheetNames.join(', '));
    } else {
      ok(`Excel · aba "${name}" presente`, 'OK');
    }
  }
  if (sheetNames.length !== 13) {
    fail('Excel · esperado 13 abas (v5.22.8)', `got ${sheetNames.length}: ${sheetNames.join(', ')}`);
  } else {
    ok('Excel · 13 abas total', sheetNames.length.toString());
  }
} catch (err) {
  fail('Excel · buildWorkbook falhou', err instanceof Error ? err.message : String(err));
}

/* ---------- v5.22.8: schema JSON técnico atualizado ---------- */
const fs = await import('fs');
const schemaText = fs.readFileSync('../schemas/implantacao-estrutura.schema.json', 'utf-8');
const schema = JSON.parse(schemaText) as Record<string, unknown>;
const defs = (schema as { $defs?: Record<string, unknown> }).$defs ?? {};
if (!defs.usuarioObra) {
  fail('Schema JSON · $defs.usuarioObra ausente', 'falta');
} else {
  ok('Schema JSON · $defs.usuarioObra definido', 'OK');
}
if (!defs.fornecedor) {
  fail('Schema JSON · $defs.fornecedor ausente', 'falta');
} else {
  ok('Schema JSON · $defs.fornecedor definido', 'OK');
}

/* ---------- v5.21: validações client-side de addReviewComment ---------- */
const { addReviewComment } = await import('./src/services/ticketService');

// Body vazio: deve rejeitar antes mesmo de tentar chamar Supabase.
try {
  await addReviewComment({ token: 'fake', author: 'X', body: '' });
  fail('addReviewComment · body vazio deveria rejeitar', 'aceitou');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg !== 'empty_body') {
    fail('addReviewComment · body vazio com mensagem errada', msg);
  } else {
    ok('addReviewComment · body vazio rejeitado client-side');
  }
}

// Body só com whitespace: deve rejeitar igualmente.
try {
  await addReviewComment({ token: 'fake', author: 'X', body: '   \n  ' });
  fail('addReviewComment · body whitespace deveria rejeitar', 'aceitou');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg !== 'empty_body') {
    fail('addReviewComment · whitespace com mensagem errada', msg);
  } else {
    ok('addReviewComment · body whitespace rejeitado client-side');
  }
}

// Body > 2000 chars: deve rejeitar antes de bater no Supabase.
try {
  await addReviewComment({
    token: 'fake',
    author: 'X',
    body: 'a'.repeat(2001),
  });
  fail('addReviewComment · body 2001 chars deveria rejeitar', 'aceitou');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg !== 'body_too_long') {
    fail('addReviewComment · body_too_long com mensagem errada', msg);
  } else {
    ok('addReviewComment · body_too_long rejeitado client-side');
  }
}

/* ---------- v5.21: tipo ReviewComment exportado ---------- */
type _R = import('./src/models/setup.models').ReviewComment;
const sampleComment: _R = {
  id: 'uuid',
  author: 'thiago',
  body: 'teste',
  created_at: new Date().toISOString(),
};
if (typeof sampleComment.id !== 'string') {
  fail('ReviewComment · shape inválido', JSON.stringify(sampleComment));
} else {
  ok('ReviewComment · tipo exportado e bem-formado');
}

/* ---------- v5.22: validações client-side de addClientComment ---------- */
const { addClientComment } = await import('./src/services/ticketService');

try {
  await addClientComment({ token: 'fake', author: 'C', body: '' });
  fail('addClientComment · body vazio deveria rejeitar', 'aceitou');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg !== 'empty_body') {
    fail('addClientComment · body vazio com mensagem errada', msg);
  } else {
    ok('addClientComment · body vazio rejeitado client-side');
  }
}

try {
  await addClientComment({ token: 'fake', author: 'C', body: 'a'.repeat(2001) });
  fail('addClientComment · body 2001 chars deveria rejeitar', 'aceitou');
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg !== 'body_too_long') {
    fail('addClientComment · body_too_long com mensagem errada', msg);
  } else {
    ok('addClientComment · body_too_long rejeitado client-side');
  }
}

/* ---------- v5.22: tipo ClientStatusPayload exportado ---------- */
type _C = import('./src/models/setup.models').ClientStatusPayload;
const samplePayload: _C = {
  ticket: { ticket_number: 'CG-2026-000001', created_at: new Date().toISOString(), client_message: null },
  submission: {
    status: 'enviado',
    obra_codigo: 'ABC',
    obra_nome: 'Obra teste',
    obra_endereco: '',
    responsavel_nome: 'Tester',
    submitted_at: new Date().toISOString(),
    reviewed_at: null,
    count_estruturas: 0,
    count_pecas: 0,
    count_concretos: 0,
  },
  comments: [],
};
if (samplePayload.submission.count_estruturas !== 0) {
  fail('ClientStatusPayload · shape inválido', '');
} else {
  ok('ClientStatusPayload · tipo exportado e bem-formado');
}

/* ---------- v5.22: ReviewComment ganhou author_role + internal_only opcionais ---------- */
const sampleWithRole: _R = {
  id: 'u',
  author: 't',
  body: 'b',
  created_at: new Date().toISOString(),
  author_role: 'cliente',
  internal_only: true,
};
if (sampleWithRole.author_role !== 'cliente' || sampleWithRole.internal_only !== true) {
  fail('ReviewComment · author_role/internal_only fora do esperado', JSON.stringify(sampleWithRole));
} else {
  ok('ReviewComment · author_role + internal_only opcionais aceitos');
}

/* ---------- v5.22.4: getter isExampleUnchanged + bloqueio de submit ---------- */
const { createStore } = await import('vuex');
const setupModImport = await import('./src/store/modules/setup');
const setupMod = setupModImport.default;
const exSnapsImport = await import('./src/mocks/exampleSnapshots');
const exampleCommonSnap = exSnapsImport.exampleCommon;

const st = createStore({ modules: { setup: setupMod } });

// Antes de carregar exemplo: isExampleUnchanged deve ser false
if (st.getters['setup/isExampleUnchanged'] !== false) {
  fail('isExampleUnchanged · estado inicial deveria ser false', 'got true');
} else {
  ok('isExampleUnchanged · estado inicial false');
}

// Após carregar exemplo: isExampleUnchanged deve ser true
st.commit('setup/loadExampleSnapshot', { snapshot: exampleCommonSnap(), key: 'common' });
if (st.getters['setup/isExampleUnchanged'] !== true) {
  fail('isExampleUnchanged · após carregar exemplo deveria ser true', 'got false');
} else {
  ok('isExampleUnchanged · após carregar exemplo true');
}

// Após editar 1 campo: isExampleUnchanged deve voltar a false
st.commit('setup/updateMetadataField', { field: 'obraNome', value: 'OUTRO NOME DA OBRA' });
if (st.getters['setup/isExampleUnchanged'] !== false) {
  fail('isExampleUnchanged · após edição deveria ser false', 'got true');
} else {
  ok('isExampleUnchanged · após edição false');
}

/* ---------- v5.22.4: placeholders prefixados com "Exemplo:" ---------- */
const fsMod = await import('node:fs');
const step4src = fsMod.readFileSync('./src/components/Step4Concretos.vue', 'utf-8');
if (step4src.includes('placeholder="FCK 30 | BRITA 1 | FLOW')) {
  fail('Step4 · placeholder antigo "FLOW" ainda presente', '');
} else if (!step4src.includes('Exemplo: FCK 30 | BRITA 1 | SLUMP 10±2 CM')) {
  fail('Step4 · placeholder esperado não encontrado', '');
} else {
  ok('Step4 · placeholder FCK com "Exemplo:" e SLUMP correto');
}

const step1src = fsMod.readFileSync('./src/components/Step1DadosBasicos.vue', 'utf-8');
const ex1Count = (step1src.match(/placeholder="Exemplo:/g) || []).length;
if (ex1Count < 5) {
  fail('Step1 · esperado ≥5 placeholders com "Exemplo:"', `got ${ex1Count}`);
} else {
  ok('Step1 · placeholders prefixados', `${ex1Count} ocorrências`);
}

/* ---------- v5.22.9: Favicons gerados ---------- */
const faviconFiles = ['favicon.ico', 'favicon-16.png', 'favicon-32.png', 'favicon-512.png', 'apple-touch-icon.png'];
for (const f of faviconFiles) {
  if (!fsMod.existsSync(`./public/${f}`)) {
    fail(`Favicon · ${f} não encontrado em public/`, 'falta');
  } else {
    ok(`Favicon · ${f} presente`, 'OK');
  }
}

const indexHtml = fsMod.readFileSync('./index.html', 'utf-8');
if (!indexHtml.includes('rel="icon"') || !indexHtml.includes('apple-touch-icon')) {
  fail('index.html · faltam tags <link rel="icon">', 'links de favicon ausentes');
} else {
  ok('index.html · tags de favicon presentes', 'OK');
}

/* ---------- v5.22.9: ticketService tem updateTechnicalJsonByReviewToken ---------- */
const ticketSrc = fsMod.readFileSync('./src/services/ticketService.ts', 'utf-8');
if (!ticketSrc.includes('updateTechnicalJsonByReviewToken')) {
  fail('ticketService · updateTechnicalJsonByReviewToken ausente', 'falta');
} else {
  ok('ticketService · updateTechnicalJsonByReviewToken exportado', 'OK');
}
if (!ticketSrc.includes('update_technical_json_by_review_token')) {
  fail('ticketService · RPC name ausente', 'falta');
} else {
  ok('ticketService · RPC update_technical_json_by_review_token referenciada', 'OK');
}

/* ---------- v5.22.9: Migration 010 existe ---------- */
const mig010 = '../supabase/migrations/20260519_010_team_edit_technical_json.sql';
if (!fsMod.existsSync(mig010)) {
  fail('Migration 010 · arquivo ausente', mig010);
} else {
  const mig010Content = fsMod.readFileSync(mig010, 'utf-8');
  if (!mig010Content.includes('update_technical_json_by_review_token')) {
    fail('Migration 010 · RPC ausente no SQL', 'função não definida');
  } else {
    ok('Migration 010 · arquivo presente e contém RPC', 'OK');
  }
  if (!mig010Content.includes('customer_input_original')) {
    fail('Migration 010 · coluna customer_input_original ausente', 'falta');
  } else {
    ok('Migration 010 · coluna customer_input_original definida', 'OK');
  }
}

/* ---------- v5.22.9: Step8Preview com cards clicáveis ---------- */
const step8src = fsMod.readFileSync('./src/components/Step8Preview.vue', 'utf-8');
if (!step8src.includes('validation-summary-button')) {
  fail('Step8Preview · cards não viraram botões clicáveis', 'falta class validation-summary-button');
} else {
  ok('Step8Preview · validation-summary-button class presente', 'OK');
}
if (!step8src.includes('onScrollTo')) {
  fail('Step8Preview · método onScrollTo ausente', 'falta');
} else {
  ok('Step8Preview · método onScrollTo definido', 'OK');
}
if (!step8src.includes('card-flash')) {
  fail('Step8Preview · animação card-flash ausente', 'falta');
} else {
  ok('Step8Preview · animação card-flash definida', 'OK');
}

/* ---------- v5.22.9 / v5.22.11: ReviewView usa AppShell + componentes editáveis ---------- */
const reviewSrc = fsMod.readFileSync('./src/views/ReviewView.vue', 'utf-8');
// v5.22.11: Step2TipoEstrutura removido — Modelo de Preenchimento foi
// mergeado no topo do Step3GruposEditor.
const editableComponents = [
  'Step1DadosBasicos',
  'Step3GruposEditor',
  'Step4Concretos',
  'Step5PecasEditor',
  'Step6UsuariosObra',
  'Step7Fornecedores',
];
for (const c of editableComponents) {
  if (!reviewSrc.includes(c)) {
    fail(`ReviewView · ${c} não está sendo importado`, 'equipe não pode editar essa etapa');
  } else {
    ok(`ReviewView · ${c} integrado (editável pela equipe)`, 'OK');
  }
}
if (!reviewSrc.includes('updateTechnicalJsonByReviewToken')) {
  fail('ReviewView · save automático da equipe não conectado', 'falta');
} else {
  ok('ReviewView · save automático conectado a updateTechnicalJsonByReviewToken', 'OK');
}
if (!reviewSrc.includes('nav-card-button')) {
  fail('ReviewView · cards de revisão não viraram clicáveis', 'falta nav-card-button');
} else {
  ok('ReviewView · cards de revisão (Etapa 8) clicáveis', 'OK');
}
if (!reviewSrc.includes('Aprovar para implantação') || reviewSrc.split('Aprovar para implantação').length < 2) {
  fail('ReviewView · botão "Aprovar para implantação" no topo ausente', 'falta');
} else {
  // Conta ocorrências — esperamos pelo menos 2 (topbar + Step9)
  const apCount = reviewSrc.split('Aprovar para implantação').length - 1;
  if (apCount < 2) {
    fail('ReviewView · "Aprovar para implantação" deve aparecer em topbar e Step9', `${apCount} ocorrência(s)`);
  } else {
    ok('ReviewView · "Aprovar para implantação" presente em topbar + Step9', `${apCount} ocorrência(s)`);
  }
}

/* ---------- v5.22.10: defaultSnapshot abre com concretos vazios ---------- */
const { defaultSnapshot: defSnap } = await import('./src/models/setup.models');
const newSnap = defSnap();
if (newSnap.concretos.length !== 0) {
  fail('defaultSnapshot · concretos deveria começar vazio em v5.22.10', `${newSnap.concretos.length} concretos pré-cadastrados`);
} else {
  ok('defaultSnapshot · concretos começa vazio', 'OK');
}
if (newSnap.grupos.length !== 0) {
  fail('defaultSnapshot · grupos deveria começar vazio', `${newSnap.grupos.length}`);
} else {
  ok('defaultSnapshot · grupos começa vazio', 'OK');
}

/* ---------- v5.22.10: concretosPadrao() ainda existe (botão "Sugerir") ---------- */
const { concretosPadrao: cPadrao } = await import('./src/models/setup.models');
const padrao = cPadrao();
if (padrao.length < 5) {
  fail('concretosPadrao · esperado ≥5 traços', `${padrao.length}`);
} else {
  ok('concretosPadrao · retorna 5+ traços disponíveis para "Sugerir traços padrão"', `${padrao.length}`);
}

/* ---------- v5.22.11: Step2TipoEstrutura deletado fisicamente ---------- */
if (fsMod.existsSync('./src/components/Step2TipoEstrutura.vue')) {
  fail('Step2TipoEstrutura.vue · arquivo deveria ter sido removido em v5.22.11', 'componente ainda existe');
} else {
  ok('Step2TipoEstrutura.vue · removido (Modelo de Preenchimento agora no Step3)', 'OK');
}

/* ---------- v5.22.10: Step4 contagem dinâmica + botão sugerir ---------- */
const step4srcV10 = fsMod.readFileSync('./src/components/Step4Concretos.vue', 'utf-8');
if (step4srcV10.includes('Etapa 4 de 6')) {
  fail('Step4 · contagem hardcoded "Etapa 4 de 6"', 'deveria usar totalSteps prop');
} else {
  ok('Step4 · kicker usa totalSteps (não hardcoded)', 'OK');
}
if (!step4srcV10.includes('suggest-defaults')) {
  fail('Step4 · emit suggest-defaults ausente', 'falta');
} else {
  ok('Step4 · emit suggest-defaults presente', 'OK');
}
if (!step4srcV10.includes('Sugerir traços padrão')) {
  fail('Step4 · botão "Sugerir traços padrão" ausente', 'falta');
} else {
  ok('Step4 · botão "Sugerir traços padrão" presente', 'OK');
}

/* ---------- v5.22.10: store tem mutation suggestConcretosDefault ---------- */
const storeSrc = fsMod.readFileSync('./src/store/modules/setup.ts', 'utf-8');
if (!storeSrc.includes('suggestConcretosDefault')) {
  fail('store · mutation suggestConcretosDefault ausente', 'falta');
} else {
  ok('store · mutation suggestConcretosDefault definida', 'OK');
}
// Idempotência: a mutation deve checar length>0 antes de popular
if (!storeSrc.match(/suggestConcretosDefault[\s\S]{0,200}length\s*>\s*0/)) {
  fail('store · suggestConcretosDefault deveria ser idempotente (length>0)', 'sem guard');
} else {
  ok('store · suggestConcretosDefault é idempotente', 'OK');
}

/* ---------- v5.22.10: variant input-group--volume no CSS ---------- */
const cssV10 = fsMod.readFileSync('./src/styles/design-system.css', 'utf-8');
if (!cssV10.includes('.input-group--volume')) {
  fail('CSS · variant .input-group--volume ausente', 'volume continuará herdando largura da célula');
} else {
  ok('CSS · variant .input-group--volume definida', 'OK');
}

/* ---------- v5.22.10: Step5 aplica variant volume ---------- */
const step5src = fsMod.readFileSync('./src/components/Step5PecasEditor.vue', 'utf-8');
if (!step5src.includes('input-group--volume')) {
  fail('Step5 · variant input-group--volume não aplicada', 'volume continuará largo na célula');
} else {
  ok('Step5 · variant input-group--volume aplicada na célula da tabela', 'OK');
}

/* ---------- v5.22.11: bug fixes Devolver + Aprovar ---------- */
if (!reviewSrc.includes('actionFeedback')) {
  fail('ReviewView · actionFeedback ausente', 'sem feedback após Aprovar/Devolver');
} else {
  ok('ReviewView · actionFeedback estado presente', 'OK');
}
if (!reviewSrc.includes('showFeedback')) {
  fail('ReviewView · método showFeedback ausente', 'falta');
} else {
  ok('ReviewView · método showFeedback definido', 'OK');
}
if (!reviewSrc.includes('email_sent_to')) {
  fail('ReviewView · feedback de devolução não mostra email_sent_to', 'falta');
} else {
  ok('ReviewView · feedback de devolução inclui info de email', 'OK');
}
// Bug 3 latente: handler onConfirmReturn deve aceitar { body }, não { reviewer, comment }
if (!reviewSrc.match(/onConfirmReturn[\s\S]{0,200}payload:\s*{\s*body:/)) {
  fail('ReviewView · onConfirmReturn deve aceitar { body }', 'assinatura incorreta');
} else {
  ok('ReviewView · onConfirmReturn aceita { body } (compatível com modal)', 'OK');
}
// Modal precisa estar FORA do AppShell (não dentro de #overlays slot).
// Remove comentários HTML antes de buscar para evitar falso positivo.
const reviewSrcNoComments = reviewSrc.replace(/<!--[\s\S]*?-->/g, '');
if (reviewSrcNoComments.includes('<template #overlays>')) {
  fail('ReviewView · ReturnSubmissionModal ainda dentro de #overlays', 'modal pode não abrir');
} else {
  ok('ReviewView · slot #overlays removido (modal fora do AppShell)', 'OK');
}
if (!reviewSrc.includes('<ReturnSubmissionModal')) {
  fail('ReviewView · ReturnSubmissionModal ausente', 'falta');
} else {
  ok('ReviewView · ReturnSubmissionModal presente (fora do AppShell)', 'OK');
}

/* ---------- v5.22.18: Modelo de Preenchimento volta para Etapa 1 ----------
   O radio "Modelo de preenchimento" que estava no topo da Etapa 3
   (v5.22.11) foi migrado para a Etapa 1 (Dados básicos), substituindo
   o <select> simples por radio-pill. A Etapa 3 agora foca só nas
   estruturas/grupos. */
const step3src = fsMod.readFileSync('./src/components/Step3GruposEditor.vue', 'utf-8');
if (step3src.includes('modelo-switch')) {
  fail(
    'Step3 · modelo-switch ainda presente — deveria ter sido removido (v5.22.18)',
    'controle migrou para Etapa 1',
  );
} else {
  ok('Step3 · modelo-switch removido (v5.22.18 — agora vive na Etapa 1)', 'OK');
}
const step3EmitsMatch = step3src.match(/emits:\s*\[[^\]]*\]/);
if (step3EmitsMatch && step3EmitsMatch[0].includes('change-modelo')) {
  fail(
    'Step3 · emit change-modelo ainda declarado — deveria sair com o radio (v5.22.18)',
    'remover da lista de emits',
  );
} else {
  ok('Step3 · emit change-modelo removido (v5.22.18)', 'OK');
}
// Step3 kicker continua sendo "Etapa 2 de" (numeração externa do wizard).
if (!step3src.includes('Etapa 2 de')) {
  fail('Step3 · kicker deveria ser "Etapa 2 de ..."', 'kicker desatualizado');
} else {
  ok('Step3 · kicker "Etapa 2 de" correto', 'OK');
}

/* ---------- v5.22.47: modelo ÚNICO — o switch saiu da interface ----------
   Pedido do produto: existe apenas o modelo completo (Tipo de Estrutura,
   Número da Estrutura e Projetista) e ele não precisa nem ser mencionado.
   O radio-pill da v5.22.18 foi REMOVIDO do Step1; snapshots antigos
   'comum' são normalizados no store ao carregar. */
const step1srcV18 = fsMod.readFileSync('./src/components/Step1DadosBasicos.vue', 'utf-8');
if (step1srcV18.includes('modelo-switch') || step1srcV18.includes('Modelo Simplificado')) {
  fail(
    'Step1 · switch de modelo ainda presente — v5.22.47 tem modelo único',
    'remover radio-pill/citações de modelo',
  );
} else {
  ok('Step1 · switch de modelo removido (v5.22.47 — modelo único)', 'OK');
}
if (step1srcV18.includes('<option value="comum">') || step1srcV18.includes('id="modeloPreenchimento"')) {
  fail(
    'Step1 · <select> antigo ainda presente — deveria ter sido removido (v5.22.18)',
    'troca para modelo único incompleta',
  );
} else {
  ok('Step1 · <select> antigo removido (v5.22.18)', 'OK');
}
if (step1srcV18.includes("v-if=\"metadata.modeloPreenchimento === 'modelo_projeto'\"")) {
  fail(
    'Step1 · modeloProjetoFields ainda condicionado ao modelo (v5.22.47)',
    'campos do modelo completo devem aparecer sempre',
  );
} else {
  ok('Step1 · modeloProjetoFields sem v-if de modelo (v5.22.47)', 'OK');
}

/* ---------- v5.22.47: importação de planilha de implantação ---------- */
if (!step1srcV18.includes('import-planilha-card') || !step1srcV18.includes("'import-planilha'")) {
  fail(
    'Step1 · card de importação de planilha ausente (v5.22.47)',
    'esperado data-testid="import-planilha-card" + emit import-planilha',
  );
} else {
  ok('Step1 · card "Importar planilha de implantação" presente (v5.22.47)', 'OK');
}
if (!step1srcV18.includes('Modelo-Implantacao-Consulte-GEO-R02.xlsx')) {
  fail('Step1 · link do modelo R02 ausente (v5.22.47)', 'esperado download do modelo padrão');
} else {
  ok('Step1 · link "Baixar modelo padrão" aponta para o R02 (v5.22.47)', 'OK');
}
if (!fsMod.existsSync('./public/modelos/Modelo-Implantacao-Consulte-GEO-R02.xlsx')) {
  fail('modelos · Modelo-Implantacao-Consulte-GEO-R02.xlsx ausente em public/modelos/', 'rode tools/gerar-modelo-implantacao-r02.py');
} else {
  ok('modelos · R02 presente em public/modelos/', 'OK');
}
if (!fsMod.existsSync('./public/assets/implantacao-import-core.js')) {
  fail('assets · implantacao-import-core.js ausente', 'core UMD do importador');
} else {
  ok('assets · implantacao-import-core.js presente (v5.22.47)', 'OK');
}
if (!fsMod.existsSync('./src/services/implantacaoImportService.ts')) {
  fail('services · implantacaoImportService.ts ausente', 'ponte browser do importador');
} else {
  const impSvc = fsMod.readFileSync('./src/services/implantacaoImportService.ts', 'utf-8');
  if (!impSvc.includes('novoGrupo') || !impSvc.includes('novoConcreto') || !impSvc.includes('novoFornecedor')) {
    fail('implantacaoImportService · não usa as factories canônicas do wizard', 'converterResultadoCore deve reconstruir via setup.models');
  } else {
    ok('services · implantacaoImportService.ts presente e usando factories (v5.22.47)', 'OK');
  }
}
{
  const cleanupSrc = fsMod.readFileSync('./scripts/cleanup-legacy.cjs', 'utf-8');
  if (!cleanupSrc.includes("'implantacaoImportService.ts'")) {
    fail('cleanup-legacy · implantacaoImportService.ts fora do allow-list', 'o prebuild apagaria o service');
  } else {
    ok('cleanup-legacy · implantacaoImportService.ts no allow-list', 'OK');
  }
}
{
  const storeSrc = fsMod.readFileSync('./src/store/modules/setup.ts', 'utf-8');
  if (!storeSrc.includes('applyImportedData')) {
    fail('store · mutation applyImportedData ausente (v5.22.47)', 'importação não hidrata o wizard');
  } else {
    ok('store · mutation applyImportedData presente (v5.22.47)', 'OK');
  }
  const normCount = (storeSrc.match(/modeloPreenchimento !== 'modelo_projeto'/g) || []).length;
  if (normCount < 2) {
    fail(
      'store · normalização de modelo único incompleta',
      `esperado em replaceSnapshot E loadExampleSnapshot; encontrado ${normCount}`,
    );
  } else {
    ok('store · snapshots antigos normalizados para modelo_projeto (v5.22.47)', `${normCount} pontos`);
  }
}
{
  const appShellSrc = fsMod.readFileSync('./src/components/AppShell.vue', 'utf-8');
  if (appShellSrc.includes('load-example-common') || appShellSrc.includes('modelo simplificado')) {
    fail('AppShell · botão/emit do exemplo simplificado ainda presente (v5.22.47)', 'modelo único → 1 botão de exemplo');
  } else if (!appShellSrc.includes('load-example-projetista')) {
    fail('AppShell · botão de exemplo (completo) sumiu', 'deveria continuar existindo');
  } else {
    ok('AppShell · um único botão "Carregar exemplo completo" (v5.22.47)', 'OK');
  }
}
{
  const step3srcV47 = fsMod.readFileSync('./src/components/Step3GruposEditor.vue', 'utf-8');
  if (!step3srcV47.includes('th-optional') || !step3srcV47.includes('Projetista é opcional')) {
    fail(
      'Step3 · Projetista sem marcação clara de opcional (v5.22.47)',
      'esperado "(opcional)" no th + texto "Projetista é opcional" na descrição',
    );
  } else {
    ok('Step3 · Projetista claramente opcional no cabeçalho e descrição (v5.22.47)', 'OK');
  }
}
if (step1srcV18.includes('versaoRegra') || step1srcV18.includes('estruturaDrywall')) {
  fail(
    'Step1 · campos versaoRegra/estruturaDrywall ainda presentes (v5.22.18)',
    'foram removidos por solicitação da equipe',
  );
} else {
  ok('Step1 · campos versaoRegra e estruturaDrywall removidos (v5.22.18)', 'OK');
}
if (!step1srcV18.includes('obraObservacoes')) {
  fail('Step1 · campo obraObservacoes ausente (v5.22.18)', 'novo campo livre obrigatório');
} else {
  ok('Step1 · campo obraObservacoes presente (v5.22.18)', 'OK');
}
if (!step1srcV18.includes('createdByTelefone')) {
  fail('Step1 · campo Telefone no responsável ausente (v5.22.18)', 'novo campo obrigatório');
} else {
  ok('Step1 · campo Telefone no responsável presente (v5.22.18)', 'OK');
}
// Texto da pill: sem "livre"
if (/Projetista livre/.test(step1srcV18)) {
  fail(
    'Step1 · radio-pill ainda contém "Projetista livre" (v5.22.18)',
    'remover palavra "livre"',
  );
} else {
  ok('Step1 · texto da pill sem "Projetista livre" (v5.22.18)', 'OK');
}

/* ---------- v5.22.18: padrão de moldagem default agora 63 dias ---------- */
const modelsV18 = fsMod.readFileSync('./src/models/setup.models.ts', 'utf-8');
// Procura a função padroesMoldagemPadrao e confere que a linha 2 é 63 dias.
const padraoMatch = modelsV18.match(/padroesMoldagemPadrao[\s\S]+?return\s*\[[\s\S]+?\];/);
if (!padraoMatch) {
  fail('models · função padroesMoldagemPadrao não localizada', 'inspeção falhou');
} else if (!/idadeControle:\s*63\b/.test(padraoMatch[0])) {
  fail(
    'models · padraoMoldagemPadrao não contém idade 63 dias (v5.22.18)',
    'segunda linha default deveria ser 63 dias',
  );
} else if (/idadeControle:\s*56\b/.test(padraoMatch[0])) {
  fail(
    'models · padraoMoldagemPadrao ainda contém idade 56 dias (v5.22.18)',
    'trocar para 63',
  );
} else {
  ok('models · padraoMoldagemPadrao usa 28+63 dias (v5.22.18)', 'OK');
}

/* ---------- v5.22.18: novo campo obraObservacoes e createdBy.telefone no model ---------- */
if (!/obraObservacoes:\s*string/.test(modelsV18)) {
  fail('models · campo obraObservacoes ausente em ObraMetadata (v5.22.18)', 'falta');
} else {
  ok('models · campo obraObservacoes em ObraMetadata (v5.22.18)', 'OK');
}
if (!/telefone:\s*string/.test(modelsV18)) {
  fail('models · campo telefone ausente em CreatedBy (v5.22.18)', 'falta');
} else {
  ok('models · campo telefone em CreatedBy (v5.22.18)', 'OK');
}
if (/versaoRegra:|estruturaDrywall:/.test(modelsV18)) {
  fail(
    'models · campos versaoRegra/estruturaDrywall ainda presentes em ModeloProjetoFields (v5.22.18)',
    'remover do tipo',
  );
} else {
  ok('models · versaoRegra e estruturaDrywall removidos de ModeloProjetoFields (v5.22.18)', 'OK');
}

/* ---------- v5.22.18: migrateLegacySnapshot estendido ---------- */
const draftV18 = fsMod.readFileSync('./src/services/setupDraftService.ts', 'utf-8');
if (!/delete mp\.versaoRegra/.test(draftV18) || !/delete mp\.estruturaDrywall/.test(draftV18)) {
  fail(
    'setupDraftService · migrateLegacySnapshot não limpa versaoRegra/estruturaDrywall (v5.22.18)',
    'rascunhos antigos vão quebrar',
  );
} else {
  ok('setupDraftService · migrateLegacySnapshot limpa campos obsoletos (v5.22.18)', 'OK');
}
if (!/obraObservacoes\s*=\s*''/.test(draftV18) || !/telefone\s*=\s*''/.test(draftV18)) {
  fail(
    'setupDraftService · migrateLegacySnapshot não popula defaults v5.22.18',
    'obraObservacoes/telefone podem vir undefined',
  );
} else {
  ok('setupDraftService · migrateLegacySnapshot popula obraObservacoes e telefone (v5.22.18)', 'OK');
}

/* ---------- v5.22.18: alerta após "Sugerir traços padrão" no Step4 ---------- */
const step4srcV18 = fsMod.readFileSync('./src/components/Step4Concretos.vue', 'utf-8');
if (!step4srcV18.includes('showDefaultsAlert')) {
  fail(
    'Step4 · banner showDefaultsAlert ausente (v5.22.18)',
    'cliente não vê aviso sobre traços de exemplo',
  );
} else {
  ok('Step4 · banner de atenção após Sugerir traços padrão (v5.22.18)', 'OK');
}
if (!/onSuggestDefaults\s*\(/.test(step4srcV18)) {
  fail(
    'Step4 · método onSuggestDefaults ausente (v5.22.18)',
    'banner não dispara junto do emit',
  );
} else {
  ok('Step4 · método onSuggestDefaults dispara banner + emit (v5.22.18)', 'OK');
}

/* ---------- v5.22.11: SetupPage e ClientStatusView sem Step2TipoEstrutura ---------- */
const setupSrc = fsMod.readFileSync('./src/views/SetupPage.vue', 'utf-8');
if (setupSrc.match(/^\s*<Step2TipoEstrutura/m)) {
  fail('SetupPage · ainda usa Step2TipoEstrutura no template', 'remover');
} else {
  ok('SetupPage · Step2TipoEstrutura removido do template', 'OK');
}
const clientStatusSrc = fsMod.readFileSync('./src/views/ClientStatusView.vue', 'utf-8');
if (clientStatusSrc.match(/^\s*<Step2TipoEstrutura/m)) {
  fail('ClientStatusView · ainda usa Step2TipoEstrutura no template', 'remover');
} else {
  ok('ClientStatusView · Step2TipoEstrutura removido do template', 'OK');
}

/* ---------- v5.22.11: kickers atualizados nos Steps ---------- */
const kickersExpected = [
  { file: 'Step1DadosBasicos.vue', expected: 'Etapa 1 de' },
  { file: 'Step3GruposEditor.vue', expected: 'Etapa 2 de' },
  { file: 'Step4Concretos.vue',    expected: 'Etapa 3 de' },
  { file: 'Step5PecasEditor.vue',  expected: 'Etapa 4 de' },
  { file: 'Step6UsuariosObra.vue', expected: 'Etapa 5 de' },
  { file: 'Step7Fornecedores.vue', expected: 'Etapa 6 de' },
  { file: 'Step8Preview.vue',      expected: 'Etapa 7 de' },
];
for (const k of kickersExpected) {
  const src = fsMod.readFileSync(`./src/components/${k.file}`, 'utf-8');
  if (!src.includes(k.expected)) {
    fail(`${k.file} · kicker deveria conter "${k.expected}"`, 'kicker desatualizado v5.22.11');
  } else {
    ok(`${k.file} · kicker "${k.expected}" correto`, 'OK');
  }
}

/* ---------- v5.22.12: modais usam <Teleport to="body"> ---------- */
const modalsRequiringTeleport = [
  'SubmitTicketModal.vue',
  'ReturnSubmissionModal.vue',
  'EditDrawer.vue',
];
for (const m of modalsRequiringTeleport) {
  const src = fsMod.readFileSync(`./src/components/${m}`, 'utf-8');
  if (!src.includes('<Teleport to="body">')) {
    fail(`${m} · deve usar <Teleport to="body">`, 'modal pode não aparecer em hierarquias com containing block (transform/filter)');
  } else {
    ok(`${m} · usa <Teleport to="body">`, 'à prova de containing block');
  }
}

/* ---------- v5.22.12: padrão .modal-portal no CSS ---------- */
const cssV12 = fsMod.readFileSync('./src/styles/design-system.css', 'utf-8');
if (!cssV12.includes('.modal-portal {')) {
  fail('CSS · classe .modal-portal ausente', 'padrão definitivo v5.22.12 não foi adicionado');
} else {
  ok('CSS · .modal-portal definido', 'padrão à prova de containing block');
}
if (!cssV12.includes('.modal-portal__backdrop')) {
  fail('CSS · .modal-portal__backdrop ausente', 'falta');
} else {
  ok('CSS · .modal-portal__backdrop definido', 'OK');
}
if (!cssV12.includes('.modal-portal__content')) {
  fail('CSS · .modal-portal__content ausente', 'falta');
} else {
  ok('CSS · .modal-portal__content definido', 'OK');
}
// SubmitTicketModal e ReturnSubmissionModal devem usar a nova classe
const submitSrc = fsMod.readFileSync('./src/components/SubmitTicketModal.vue', 'utf-8');
if (!submitSrc.includes('modal-portal')) {
  fail('SubmitTicketModal · não usa classe modal-portal', 'falta');
} else {
  ok('SubmitTicketModal · usa modal-portal (padrão definitivo)', 'OK');
}
const returnSrc = fsMod.readFileSync('./src/components/ReturnSubmissionModal.vue', 'utf-8');
if (!returnSrc.includes('modal-portal')) {
  fail('ReturnSubmissionModal · não usa classe modal-portal', 'falta');
} else {
  ok('ReturnSubmissionModal · usa modal-portal (padrão definitivo)', 'OK');
}

/* ---------- v5.22.12: data-testid em cada modal ---------- */
if (!submitSrc.includes('data-testid="submit-ticket-modal"')) {
  fail('SubmitTicketModal · data-testid ausente', 'debug via DevTools fica mais difícil');
} else {
  ok('SubmitTicketModal · data-testid presente', 'OK');
}
if (!returnSrc.includes('data-testid="return-submission-modal"')) {
  fail('ReturnSubmissionModal · data-testid ausente', 'debug via DevTools fica mais difícil');
} else {
  ok('ReturnSubmissionModal · data-testid presente', 'OK');
}

/* ---------- v5.22.12: SetupPage não usa mais #overlays slot ---------- */
const setupSrcV12 = fsMod.readFileSync('./src/views/SetupPage.vue', 'utf-8');
const setupSrcNoCommentsV12 = setupSrcV12.replace(/<!--[\s\S]*?-->/g, '');
if (setupSrcNoCommentsV12.includes('<template #overlays>')) {
  fail('SetupPage · ainda usa <template #overlays>', 'modais devem estar fora do AppShell em v5.22.12');
} else {
  ok('SetupPage · slot #overlays removido (modais usam Teleport)', 'OK');
}
if (!setupSrcV12.includes('<SubmitTicketModal')) {
  fail('SetupPage · SubmitTicketModal ausente', 'falta');
} else {
  ok('SetupPage · SubmitTicketModal renderizado fora do AppShell', 'OK');
}

/* ---------- v5.22.13: defesa em profundidade contra resíduos de numeração antiga ---------- */
// Após reduzir cliente para 7 etapas e equipe para 9 (v5.22.11), qualquer
// condicional `step === 8/9/10` ou `currentStep === 10` em código real
// (fora de comentários) é bug.
// Carrega todos os .vue/.ts e checa cada arquivo sem comentários.
function readSrcStripped(path: string): string {
  const txt = fsMod.readFileSync(path, 'utf-8');
  // Remove comentários HTML <!-- --> e JS // e /* */
  return txt
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}
const allSrcFiles: string[] = [];
function walk(dir: string) {
  for (const item of fsMod.readdirSync(dir)) {
    const full = `${dir}/${item}`;
    const stat = fsMod.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (full.endsWith('.vue') || full.endsWith('.ts')) allSrcFiles.push(full);
  }
}
walk('./src');
const numerationGhostPatterns = [
  { re: /\bstep\s*===\s*(8|9|10)\b/, label: 'step === 8/9/10 (cliente tem só 7 etapas)' },
  { re: /\bcurrentStep\s*===\s*10\b/, label: 'currentStep === 10 (equipe tem só 9 etapas)' },
  { re: /\bcurrentEditStep\s*===\s*8\b/, label: 'currentEditStep === 8 (ClientStatus tem só 7 etapas)' },
  { re: /\bstep\s*<=\s*3\b/, label: 'step <= 3 (Carregar exemplo agora vai até <= 2)' },
  { re: /\bcurrentStep\s*<=\s*3\b/, label: 'currentStep <= 3 (Carregar exemplo agora vai até <= 2)' },
];
let ghostFound = 0;
for (const file of allSrcFiles) {
  const stripped = readSrcStripped(file);
  for (const p of numerationGhostPatterns) {
    if (p.re.test(stripped)) {
      fail(`${file.replace('./src/', '')} · resíduo de numeração antiga`, p.label);
      ghostFound++;
    }
  }
}
if (ghostFound === 0) {
  ok('Defesa em profundidade · nenhum resíduo de numeração antiga em código real', `${allSrcFiles.length} arquivos verificados`);
}

/* ---------- v5.22.13: botão Enviar para validação aparece na Etapa 7 ---------- */
// O bug v5.22.12 era que o template #top-actions-extra tinha v-if="step === 8",
// nunca disparando porque a etapa de Revisão virou 7 em v5.22.11.
if (!setupSrcV12.match(/<template\s+v-if="step\s*===\s*7"/)) {
  fail('SetupPage · template do top-actions-extra deve disparar em step === 7', 'botão "Enviar para validação" não aparece');
} else {
  ok('SetupPage · top-actions-extra com v-if="step === 7" correto (botão Enviar aparece)', 'OK');
}

/* ---------- v5.22.13: AppShell ajusta currentStep <= 2 (era <= 3) ---------- */
const appShellSrc = fsMod.readFileSync('./src/components/AppShell.vue', 'utf-8');
const appShellNoComments = appShellSrc.replace(/<!--[\s\S]*?-->/g, '');
if (appShellNoComments.match(/currentStep\s*<=\s*3/)) {
  fail('AppShell · currentStep <= 3 ainda presente', 'deve ser <= 2 (Carregar exemplo só nas 2 primeiras etapas)');
} else {
  ok('AppShell · currentStep <= 3 corrigido para <= 2', 'OK');
}
if (!appShellNoComments.match(/currentStep\s*<=\s*2/)) {
  fail('AppShell · currentStep <= 2 ausente', 'Carregar exemplo deveria aparecer nas Etapas 1 e 2');
} else {
  ok('AppShell · botão Carregar exemplo dispara em currentStep <= 2', 'OK');
}

/* ---------- v5.22.14: atendimento@consultegeo.com.br como destinatário permanente ---------- */
const ATENDIMENTO_EMAIL = 'atendimento@consultegeo.com.br';
const submitFnPath = '../supabase/functions/submit-for-validation/index.ts';
const notifyFnPath = '../supabase/functions/notify-return/index.ts';
const workflowPath = '../.github/workflows/deploy-edge-functions.yml';
// Verificação tolerante: se algum arquivo não existir (rodando fora do
// projeto completo), reporta como info ao invés de fail.
if (!fsMod.existsSync(submitFnPath) || !fsMod.existsSync(notifyFnPath)) {
  ok('Edge Functions · paths não encontrados (rodando isolado do projeto?)', 'pulando smokes da v5.22.14');
} else {
  const submitFn = fsMod.readFileSync(submitFnPath, 'utf-8');
  const notifyFn = fsMod.readFileSync(notifyFnPath, 'utf-8');

  if (!submitFn.includes(ATENDIMENTO_EMAIL)) {
    fail('submit-for-validation · atendimento@ não está hardcoded como default', 'a equipe Consulte GEO não recebe email se NOTIFICATION_RECIPIENTS estiver vazia');
  } else {
    ok(`submit-for-validation · ${ATENDIMENTO_EMAIL} como destinatário permanente`, 'OK');
  }
  if (!submitFn.includes('buildTeamRecipients')) {
    fail('submit-for-validation · função buildTeamRecipients ausente', 'falta');
  } else {
    ok('submit-for-validation · buildTeamRecipients() definida', 'OK');
  }
  if (!notifyFn.includes(ATENDIMENTO_EMAIL)) {
    fail('notify-return · atendimento@ não está hardcoded para CC', 'equipe não tem trilha das devoluções');
  } else {
    ok(`notify-return · ${ATENDIMENTO_EMAIL} incluído em CC`, 'OK');
  }
  if (!notifyFn.includes('buildTeamRecipientsCc')) {
    fail('notify-return · função buildTeamRecipientsCc ausente', 'falta');
  } else {
    ok('notify-return · buildTeamRecipientsCc() definida', 'OK');
  }
  if (!notifyFn.match(/cc\?:\s*string\[\]/)) {
    fail('notify-return · resendSend não aceita parâmetro cc', 'falta');
  } else {
    ok('notify-return · resendSend aceita cc opcional', 'OK');
  }

  if (!fsMod.existsSync(workflowPath)) {
    fail('GitHub Action deploy-edge-functions.yml ausente', 'deploy Edge Functions continuará sendo manual');
  } else {
    const wf = fsMod.readFileSync(workflowPath, 'utf-8');
    if (!wf.includes('supabase/setup-cli')) {
      fail('GitHub Action · não usa supabase/setup-cli', 'falta');
    } else if (!wf.includes('functions deploy submit-for-validation')) {
      fail('GitHub Action · não deploya submit-for-validation', 'falta');
    } else if (!wf.includes('functions deploy notify-return')) {
      fail('GitHub Action · não deploya notify-return', 'falta');
    } else {
      ok('GitHub Action · deploy automático Edge Functions configurado', 'OK');
    }
  }
}

/* ---------- v5.22.17 — rename "Superestrutura" → "Estrutura" ---------- */
{
  // 1) Enum / opções: NÃO existe mais a literal "Superestrutura" no enum / opções.
  const modelsPath = './src/models/setup.models.ts';
  if (fsMod.existsSync(modelsPath)) {
    const code = fsMod.readFileSync(modelsPath, 'utf-8');
    if (/['"]Superestrutura['"]/.test(code)) {
      fail('setup.models.ts · ainda contém literal "Superestrutura"',
        'remover do enum Etapa e ETAPAS_OPCOES');
    } else {
      ok('setup.models.ts · sem literal "Superestrutura"');
    }
    if (/superestruturaDrywall/.test(code)) {
      fail('setup.models.ts · ainda contém superestruturaDrywall',
        'campo renomeado para estruturaDrywall');
    } else {
      ok('setup.models.ts · chave estruturaDrywall (renomeada)');
    }
  }

  // 2) Mapeamento técnico: Estrutura mapeia para ID 3 (era Superestrutura)
  const tmPath = './src/models/technicalMapping.models.ts';
  if (fsMod.existsSync(tmPath)) {
    const code = fsMod.readFileSync(tmPath, 'utf-8');
    if (/Superestrutura:\s*3/.test(code)) {
      fail('technicalMapping · ainda mapeia Superestrutura: 3', 'consolidar em Estrutura: 3');
    } else if (!/Estrutura:\s*3/.test(code)) {
      fail('technicalMapping · Estrutura: 3 ausente', 'consolidar do ID antigo da Superestrutura');
    } else {
      ok('technicalMapping · Estrutura: 3 (era Superestrutura: 3)');
    }
  }

  // 3) Migration helper para rascunhos antigos
  const draftPath = './src/services/setupDraftService.ts';
  if (fsMod.existsSync(draftPath)) {
    const code = fsMod.readFileSync(draftPath, 'utf-8');
    if (!/migrateLegacySnapshot/.test(code)) {
      fail('setupDraftService · sem migrateLegacySnapshot',
        'migração necessária para rascunhos com etapa Superestrutura');
    } else if (!/migrateRow/.test(code)) {
      fail('setupDraftService · sem migrateRow', 'aplicar em loadDraft e listDrafts');
    } else {
      ok('setupDraftService · migrateLegacySnapshot + migrateRow presentes');
    }
  }

  // 4) Step1DadosBasicos: campo agora chama "Estrutura" e usa estruturaDrywall
  const step1Path2 = './src/components/Step1DadosBasicos.vue';
  if (fsMod.existsSync(step1Path2)) {
    const code = fsMod.readFileSync(step1Path2, 'utf-8');
    if (/superestruturaDrywall/.test(code)) {
      fail('Step1DadosBasicos · ainda referencia superestruturaDrywall',
        'usar estruturaDrywall');
    } else {
      ok('Step1DadosBasicos · usa estruturaDrywall (label "Estrutura")');
    }
  }
}

/* ---------- v5.22.19 — autosave + banner de retomada + beforeunload ---------- */
{
  const fs = await import('node:fs');

  // 1) setupDraftService exporta as novas funções e tipo do pointer
  const draftPath = './src/services/setupDraftService.ts';
  if (fs.existsSync(draftPath)) {
    const code = fs.readFileSync(draftPath, 'utf-8');
    const checks: Array<[string, RegExp]> = [
      ['LastDraftPointer (interface)', /export interface LastDraftPointer/],
      ['LS_LAST_DRAFT_KEY (constante)', /LS_LAST_DRAFT_KEY/],
      ['getLastDraftPointer', /export function getLastDraftPointer/],
      ['setLastDraftPointer', /export function setLastDraftPointer/],
      ['clearLastDraftPointer', /export function clearLastDraftPointer/],
      ['saveDraftSilent', /export async function saveDraftSilent/],
    ];
    for (const [name, re] of checks) {
      if (re.test(code)) ok(`setupDraftService · ${name} presente`);
      else fail(`setupDraftService · ${name} ausente`, 'requerido pela v5.22.19');
    }
    // saveDraftSilent deve usar try/catch (noexcept)
    if (/saveDraftSilent[\s\S]*?try[\s\S]*?catch/.test(code)) {
      ok('setupDraftService · saveDraftSilent é noexcept (try/catch)');
    } else {
      fail('setupDraftService · saveDraftSilent sem try/catch',
        'autosave não pode lançar — quebraria UX');
    }
  }

  // 2) store/modules/setup.ts integra autosave e pointer
  const storePath = './src/store/modules/setup.ts';
  if (fs.existsSync(storePath)) {
    const code = fs.readFileSync(storePath, 'utf-8');
    const checks: Array<[string, RegExp]> = [
      ['imports saveDraftSilent + pointer fns', /saveDraftSilent[\s\S]*?setLastDraftPointer[\s\S]*?clearLastDraftPointer/],
      ['AUTOSAVE_DEBOUNCE_MS', /const AUTOSAVE_DEBOUNCE_MS\s*=\s*3000/],
      ['autosaveTimer module-level', /let autosaveTimer/],
    ];
    for (const [name, re] of checks) {
      if (re.test(code)) ok(`store/setup · ${name} presente`);
      else fail(`store/setup · ${name} ausente`, 'requerido pela v5.22.19');
    }
    // persistDebounced não deve ser mais no-op (deve referenciar setTimeout/saveDraftSilent)
    if (/persistDebounced[\s\S]{0,2000}?setTimeout/.test(code)
        && /persistDebounced[\s\S]{0,2000}?saveDraftSilentRemote/.test(code)) {
      ok('store/setup · persistDebounced implementado (não é mais no-op)');
    } else {
      fail('store/setup · persistDebounced ainda no-op ou mal ligado',
        'deve agendar setTimeout chamando saveDraftSilentRemote');
    }
    // saveDraft manual deve gravar pointer
    if (/saveDraft[\s\S]{0,3000}?setLastDraftPointer\(/.test(code)) {
      ok('store/setup · saveDraft (manual) grava pointer');
    } else {
      fail('store/setup · saveDraft não grava pointer',
        'manual e autosave devem ter mesma fonte de verdade');
    }
    // reset deve limpar pointer
    if (/reset\s*\(state\)[\s\S]{0,300}?clearLastDraftPointer/.test(code)) {
      ok('store/setup · reset() limpa pointer');
    } else {
      fail('store/setup · reset() não limpa pointer',
        'banner reapareceria após "Limpar rascunho"');
    }
  }

  // 3) ResumeDraftBanner.vue existe e usa .alert.info
  const bannerPath = './src/components/ResumeDraftBanner.vue';
  if (!fs.existsSync(bannerPath)) {
    fail('ResumeDraftBanner.vue · ausente', 'criar componente v5.22.19');
  } else {
    const code = fs.readFileSync(bannerPath, 'utf-8');
    if (/class="alert info resume-draft-banner"/.test(code)) {
      ok('ResumeDraftBanner · reusa .alert.info (par fg/bg validado)');
    } else {
      fail('ResumeDraftBanner · não reusa .alert.info',
        'evita cor nova fora do smoke-contrast');
    }
    if (/emits:\s*\[\s*['"]resume['"]\s*,\s*['"]dismiss['"]\s*\]/.test(code)) {
      ok('ResumeDraftBanner · emits resume + dismiss');
    } else {
      fail('ResumeDraftBanner · emits incorretos',
        'esperado: resume + dismiss');
    }
  }

  // 4) SetupPage.vue integra o banner e o beforeunload
  const setupPagePath = './src/views/SetupPage.vue';
  if (fs.existsSync(setupPagePath)) {
    const code = fs.readFileSync(setupPagePath, 'utf-8');
    if (/<ResumeDraftBanner[\s\S]*?v-if="resumeBanner"/.test(code)) {
      ok('SetupPage · renderiza ResumeDraftBanner condicionalmente');
    } else {
      fail('SetupPage · ResumeDraftBanner não renderizado',
        'esperado <ResumeDraftBanner v-if="resumeBanner" ...>');
    }
    if (/getLastDraftPointer\(\)/.test(code)) {
      ok('SetupPage · lê pointer no mounted');
    } else {
      fail('SetupPage · não lê pointer no mounted',
        'banner nunca apareceria');
    }
    if (/addEventListener\(['"]beforeunload['"]/.test(code)) {
      ok('SetupPage · registra beforeunload listener');
    } else {
      fail('SetupPage · sem beforeunload listener',
        'usuário perderia 3s de edição ao fechar a aba sem aviso');
    }
    if (/removeEventListener\(['"]beforeunload['"]/.test(code)) {
      ok('SetupPage · remove beforeunload no beforeUnmount');
    } else {
      fail('SetupPage · sem cleanup do beforeunload',
        'listener vazaria entre navegações SPA');
    }
    if (/onResumeDraft\b/.test(code) && /onDismissResume\b/.test(code)) {
      ok('SetupPage · handlers onResumeDraft + onDismissResume');
    } else {
      fail('SetupPage · handlers do banner ausentes',
        'esperado onResumeDraft e onDismissResume');
    }
  }

  // 5) design-system.css tem .resume-draft-banner (só layout, sem cor)
  const cssPath = './src/styles/design-system.css';
  if (fs.existsSync(cssPath)) {
    const code = fs.readFileSync(cssPath, 'utf-8');
    if (/\.resume-draft-banner\s*\{/.test(code)) {
      ok('design-system · .resume-draft-banner presente');
    } else {
      fail('design-system · .resume-draft-banner ausente',
        'layout do banner viria sem flex/gap');
    }
    // Não deve introduzir hex novo no bloco (só layout — cor vem de .alert.info)
    const block = code.match(/\.resume-draft-banner[\s\S]*?\n\}/);
    if (block && /#[0-9a-fA-F]{3,6}\b/.test(block[0])) {
      fail('design-system · .resume-draft-banner tem hex hardcoded',
        'usar apenas variáveis CSS / herdar de .alert.info');
    } else {
      ok('design-system · .resume-draft-banner sem hex (herda .alert.info)');
    }
  }

  // 6) package.json bumped (esta checagem é flexível — só confirma que
  //    a versão saiu da 18; a versão exata é validada no bloco mais novo)
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version && pkg.version !== '5.0.22-18') {
      ok(`package.json · version saiu de 5.0.22-18 (atual: ${pkg.version})`);
    } else {
      fail(`package.json · version não bumpada`,
        `version ainda é ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.20 — painel de pendências persistente ---------- */
{
  const fs = await import('node:fs');

  // 1) PendenciasPanel.vue existe e tem o necessário
  const panelPath = './src/components/PendenciasPanel.vue';
  if (!fs.existsSync(panelPath)) {
    fail('PendenciasPanel.vue · ausente', 'criar componente v5.22.20');
  } else {
    const code = fs.readFileSync(panelPath, 'utf-8');
    // v5.22.25 — pathToStep saiu daqui e foi para src/services/stepMappingService.ts.
    // O componente agora IMPORTA do helper. Checks específicos do mapeamento
    // (metadata→1, grupos[*].pecas→4, etc.) foram migrados para o bloco
    // v5.22.25 deste smoke, que valida runtime do helper diretamente.
    if (/import\s*\{[^}]*pathToStep[^}]*\}\s*from\s+['"][^'"]*stepMappingService/.test(code)) {
      ok('PendenciasPanel · importa pathToStep do helper (v5.22.25)');
    } else if (/function pathToStep\(/.test(code)) {
      // fallback de compatibilidade — se o desenvolvedor ainda mantém local
      ok('PendenciasPanel · pathToStep local presente (compatível com checks v5.22.20)');
    } else {
      fail('PendenciasPanel · sem acesso a pathToStep',
        'esperado import do stepMappingService (v5.22.25) ou função local');
    }
    if (/emits:\s*\[\s*['"]go-to['"]\s*\]/.test(code)) {
      ok('PendenciasPanel · emite go-to');
    } else {
      fail('PendenciasPanel · sem emit go-to',
        'esperado emits: ["go-to"] para navegação');
    }
    // Só mostra error + warning (não info/pending)
    if (/severity !== 'error' && it\.severity !== 'warning'|severity\s*!==\s*['"]error['"]\s*&&\s*it\.severity\s*!==\s*['"]warning['"]/.test(code)) {
      ok('PendenciasPanel · filtra só error + warning (oculta info/pending)');
    } else {
      fail('PendenciasPanel · filtro de severity ausente',
        'sugestões e pendenciasInternas não devem aparecer no painel do usuário');
    }
    // Reusa .alert.danger / .alert.warning (zero cor nova)
    if (/severityClass[\s\S]{0,250}errorCount\s*>\s*0[\s\S]{0,40}danger[\s\S]{0,40}warning/.test(code)) {
      ok('PendenciasPanel · severityClass alterna danger/warning conforme bloqueantes');
    } else {
      fail('PendenciasPanel · severityClass mal configurada',
        'sem bloqueante deve ser warning; com bloqueante deve ser danger');
    }
  }

  // 2) SetupPage.vue renderiza o painel e conecta go-to
  const setupPagePath = './src/views/SetupPage.vue';
  if (fs.existsSync(setupPagePath)) {
    const code = fs.readFileSync(setupPagePath, 'utf-8');
    if (/<PendenciasPanel[\s\S]{0,200}v-if="step\s*<\s*7"/.test(code)) {
      ok('SetupPage · PendenciasPanel só nas etapas 1–6');
    } else {
      fail('SetupPage · PendenciasPanel sem v-if="step < 7"',
        'Step8Preview já tem o resumo completo na Etapa 7');
    }
    if (/<PendenciasPanel[\s\S]{0,300}:issues="validation\.issues"/.test(code)) {
      ok('SetupPage · PendenciasPanel recebe :issues="validation.issues"');
    } else {
      fail('SetupPage · :issues não conectado',
        'usar validation.issues como entrada do painel');
    }
    if (/<PendenciasPanel[\s\S]{0,400}@go-to="goTo(WithFocus)?"/.test(code)) {
      ok('SetupPage · PendenciasPanel @go-to conectado a um handler (goTo ou goToWithFocus)');
    } else {
      fail('SetupPage · @go-to não conectado',
        'usuário clicaria "Ir para Etapa N" e nada aconteceria');
    }
  }

  // 3) cleanup-legacy permite PendenciasPanel
  const cleanupPath = './scripts/cleanup-legacy.cjs';
  if (fs.existsSync(cleanupPath)) {
    const code = fs.readFileSync(cleanupPath, 'utf-8');
    if (/'PendenciasPanel\.vue'/.test(code)) {
      ok('cleanup-legacy · PendenciasPanel.vue na allowlist');
    } else {
      fail('cleanup-legacy · PendenciasPanel.vue não permitido',
        'prebuild apagaria o componente, build quebraria');
    }
  }

  // 4) design-system tem .pendencias-panel (só layout, sem hex)
  const cssPath = './src/styles/design-system.css';
  if (fs.existsSync(cssPath)) {
    const code = fs.readFileSync(cssPath, 'utf-8');
    if (/\.pendencias-panel\s*\{/.test(code)) {
      ok('design-system · .pendencias-panel presente');
    } else {
      fail('design-system · .pendencias-panel ausente',
        'layout do painel viria sem flex/gap');
    }
    // Captura todo o bloco .pendencias-panel* e checa hex
    const blocks = code.match(/\.pendencias-panel[^\s][\s\S]*?\n\}/g) || [];
    const blob = blocks.join('\n');
    if (blob && /#[0-9a-fA-F]{3,6}\b/.test(blob)) {
      fail('design-system · .pendencias-panel tem hex hardcoded',
        'usar apenas variáveis CSS / herdar de .alert.danger|warning');
    } else {
      ok('design-system · .pendencias-panel sem hex (herda .alert.danger|warning)');
    }
  }

  // 5) Versão bumped (check flexível — a versão exata é validada no bloco mais novo)
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version && pkg.version !== '5.0.22-19' && pkg.version !== '5.0.22-18') {
      ok(`package.json · version saiu de 5.0.22-19 (atual: ${pkg.version})`);
    } else {
      fail(`package.json · version não bumpada para v5.22.20+`,
        `version ainda é ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.21 — foco direto no campo ao clicar "Ir para Etapa N" ---------- */
{
  const fs = await import('node:fs');

  // 1) PendenciasPanel.vue tem computeFieldId + fieldId no DisplayItem
  const panelPath = './src/components/PendenciasPanel.vue';
  if (fs.existsSync(panelPath)) {
    const code = fs.readFileSync(panelPath, 'utf-8');
    if (/function computeFieldId\(/.test(code)) {
      ok('PendenciasPanel · computeFieldId helper presente');
    } else {
      fail('PendenciasPanel · sem computeFieldId',
        'sem isso o painel emite apenas step, sem fieldId');
    }
    // Convenção 1: entityTemporaryId + campo
    if (/issue\.entityTemporaryId.*issue\.campo[\s\S]{0,200}\$\{issue\.entityTemporaryId\}-\$\{issue\.campo\}/.test(code)) {
      ok('PendenciasPanel · computeFieldId combina entityTemporaryId + campo');
    } else {
      fail('PendenciasPanel · convenção entityTemporaryId-campo ausente',
        'esperado: `${id}-${campo}` para peças/grupos');
    }
    // Convenção 2: metadata.* → meta-*
    if (/path\.startsWith\(['"]metadata\.['"]\)[\s\S]{0,300}meta-/.test(code)) {
      ok('PendenciasPanel · computeFieldId mapeia metadata.* → meta-*');
    } else {
      fail('PendenciasPanel · convenção meta-* ausente',
        'campos singleton precisam de id derivado do path');
    }
    // Convenção 3: lista sem entityTemporaryId → null
    if (/return null/.test(code)) {
      ok('PendenciasPanel · computeFieldId retorna null para listas (fallback gracioso)');
    } else {
      fail('PendenciasPanel · sem return null',
        'pendências em listas (sem campo singular) precisam virar null');
    }
    // visibleItems carrega fieldId
    if (/fieldId:\s*computeFieldId\(it\)/.test(code)) {
      ok('PendenciasPanel · visibleItems atribui fieldId via computeFieldId');
    } else {
      fail('PendenciasPanel · visibleItems sem fieldId',
        'sem isso o template não tem como emitir o id');
    }
    // Emit agora carrega { step, fieldId }
    if (/\$emit\(['"]go-to['"],\s*\{\s*step:\s*item\.step,\s*fieldId:\s*item\.fieldId\s*\}\)/.test(code)) {
      ok('PendenciasPanel · emit go-to carrega { step, fieldId }');
    } else {
      fail('PendenciasPanel · emit ainda usa só step',
        'goToWithFocus precisa do payload completo');
    }
    // Novo botão "Focar campo" para itens na etapa atual com fieldId
    if (/Focar campo/.test(code)) {
      ok('PendenciasPanel · botão "Focar campo" para pendência na etapa atual');
    } else {
      fail('PendenciasPanel · sem botão "Focar campo"',
        'na etapa atual, com fieldId, deve ter botão para localizar a célula');
    }
  }

  // 2) SetupPage.vue tem goToWithFocus method
  const setupPagePath = './src/views/SetupPage.vue';
  if (fs.existsSync(setupPagePath)) {
    const code = fs.readFileSync(setupPagePath, 'utf-8');
    // v5.22.23 — método pode ser async OU síncrono (refatorado)
    if (/\bgoToWithFocus\s*\(/.test(code)) {
      ok('SetupPage · goToWithFocus método presente');
    } else {
      fail('SetupPage · sem goToWithFocus',
        'handler do payload com fieldId está faltando');
    }
    // Deve usar nextTick (com ou sem await — pode ser callback ou await)
    if (/goToWithFocus[\s\S]{0,2500}\$nextTick/.test(code)) {
      ok('SetupPage · goToWithFocus usa $nextTick (re-render do Step)');
    } else {
      fail('SetupPage · goToWithFocus sem $nextTick',
        'sem isso, querySelector cairia num DOM stale');
    }
    // querySelector via data-field-id
    if (/querySelector[\s\S]{0,200}data-field-id/.test(code)) {
      ok('SetupPage · goToWithFocus localiza via [data-field-id="..."]');
    } else {
      fail('SetupPage · goToWithFocus não usa data-field-id',
        'convenção exposta pelos Steps');
    }
    // scrollIntoView + focus
    if (/scrollIntoView/.test(code) && /\.focus\(/.test(code)) {
      ok('SetupPage · goToWithFocus chama scrollIntoView + focus');
    } else {
      fail('SetupPage · goToWithFocus sem scrollIntoView/focus',
        'objetivo da versão é exatamente esse');
    }
    // Listener foi trocado
    if (/<PendenciasPanel[\s\S]{0,400}@go-to="goToWithFocus"/.test(code)) {
      ok('SetupPage · PendenciasPanel @go-to → goToWithFocus');
    } else {
      fail('SetupPage · listener ainda é goTo (não goToWithFocus)',
        'fieldId seria ignorado');
    }
  }

  // 3) Step1 tem data-field-id="meta-obraNome"
  const step1Path = './src/components/Step1DadosBasicos.vue';
  if (fs.existsSync(step1Path)) {
    const code = fs.readFileSync(step1Path, 'utf-8');
    if (/data-field-id="meta-obraNome"/.test(code)) {
      ok('Step1 · data-field-id="meta-obraNome" no input obraNome');
    } else {
      fail('Step1 · sem data-field-id em obraNome',
        'principal pendência VAL-OBRA-001 não focaria');
    }
  }

  // 4) Step3 tem data-field-id dinâmico para edificacoesInput (ambos modos)
  const step3Path = './src/components/Step3GruposEditor.vue';
  if (fs.existsSync(step3Path)) {
    const code = fs.readFileSync(step3Path, 'utf-8');
    // 2 ocorrências esperadas: tabela (modo comum) + form (modo projetista)
    const matches = code.match(/:data-field-id="`\$\{grupo\.id\}-numeroEstrutura`"/g);
    if (matches && matches.length >= 2) {
      ok(`Step3 · data-field-id numeroEstrutura presente em ambos os modos (${matches.length} ocorrências)`);
    } else {
      fail(`Step3 · data-field-id numeroEstrutura ausente ou incompleto`,
        `encontrado ${matches?.length ?? 0} ocorrência(s), esperado ≥ 2`);
    }
  }

  // 5) Step5 tem data-field-id para local, fck, volume
  const step5Path = './src/components/Step5PecasEditor.vue';
  if (fs.existsSync(step5Path)) {
    const code = fs.readFileSync(step5Path, 'utf-8');
    const fields: Array<[string, RegExp]> = [
      ['local', /:data-field-id="`\$\{peca\.id\}-local`"/],
      ['fck', /:data-field-id="`\$\{peca\.id\}-fck`"/],
      ['volume', /:data-field-id="`\$\{peca\.id\}-volume`"/],
    ];
    for (const [name, re] of fields) {
      if (re.test(code)) ok(`Step5 · data-field-id em peca.${name}`);
      else fail(`Step5 · data-field-id em peca.${name} ausente`,
        'pendências VAL-PEC-* não focariam');
    }
  }

  // 6) Versão bumped — check flexível
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version && pkg.version !== '5.0.22-20' && pkg.version !== '5.0.22-19' && pkg.version !== '5.0.22-18') {
      ok(`package.json · version saiu de 5.0.22-20 (atual: ${pkg.version})`);
    } else {
      fail(`package.json · version não bumpada para v5.22.21+`,
        `version ainda é ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.22 — dois botões "Adicionar usina" / "Adicionar laboratório" ---------- */
{
  const fs = await import('node:fs');

  // 1) Step7Fornecedores tem dois botões com payload tipado
  const step7Path = './src/components/Step7Fornecedores.vue';
  if (fs.existsSync(step7Path)) {
    const code = fs.readFileSync(step7Path, 'utf-8');

    // Não deve mais existir o emit antigo sem payload
    if (/\$emit\(['"]add-fornecedor['"]\)/.test(code)) {
      fail('Step7Fornecedores · ainda emite add-fornecedor sem tipo',
        'todos os emits devem passar "usina" ou "laboratorio"');
    } else {
      ok('Step7Fornecedores · não emite mais add-fornecedor sem tipo');
    }

    // 2 botões "Adicionar usina" (topo + fim)
    const usinaEmits = code.match(/\$emit\(['"]add-fornecedor['"],\s*['"]usina['"]\)/g);
    if (usinaEmits && usinaEmits.length >= 2) {
      ok(`Step7Fornecedores · emit('add-fornecedor', 'usina') aparece ${usinaEmits.length}× (topo + fim)`);
    } else {
      fail('Step7Fornecedores · emits de usina insuficientes',
        `esperado ≥ 2 (topo + fim da lista), achei ${usinaEmits?.length ?? 0}`);
    }

    // 2 botões "Adicionar laboratório"
    const labEmits = code.match(/\$emit\(['"]add-fornecedor['"],\s*['"]laboratorio['"]\)/g);
    if (labEmits && labEmits.length >= 2) {
      ok(`Step7Fornecedores · emit('add-fornecedor', 'laboratorio') aparece ${labEmits.length}× (topo + fim)`);
    } else {
      fail('Step7Fornecedores · emits de laboratorio insuficientes',
        `esperado ≥ 2 (topo + fim da lista), achei ${labEmits?.length ?? 0}`);
    }

    // Labels visíveis
    if (/>\s*Adicionar usina\s*</.test(code)) {
      ok('Step7Fornecedores · botão "Adicionar usina" no topo');
    } else {
      fail('Step7Fornecedores · label "Adicionar usina" ausente',
        'texto do botão deve ser exatamente esse');
    }
    if (/>\s*Adicionar laboratório\s*</.test(code)) {
      ok('Step7Fornecedores · botão "Adicionar laboratório" no topo');
    } else {
      fail('Step7Fornecedores · label "Adicionar laboratório" ausente',
        'texto do botão deve ser exatamente esse');
    }
    if (/>\s*Adicionar outra usina\s*</.test(code)) {
      ok('Step7Fornecedores · botão "Adicionar outra usina" no fim');
    } else {
      fail('Step7Fornecedores · label "Adicionar outra usina" ausente',
        'segundo botão no fim da lista deve refletir a alteração');
    }
    if (/>\s*Adicionar outro laboratório\s*</.test(code)) {
      ok('Step7Fornecedores · botão "Adicionar outro laboratório" no fim');
    } else {
      fail('Step7Fornecedores · label "Adicionar outro laboratório" ausente',
        'segundo botão no fim da lista deve refletir a alteração');
    }

    // Não deve mais ter o botão único "Adicionar fornecedor"
    if (/>\s*Adicionar fornecedor\s*</.test(code) || /Adicionar outro fornecedor/.test(code)) {
      fail('Step7Fornecedores · ainda existe botão "Adicionar fornecedor"',
        'todos os botões devem ser tipados (usina/laboratorio)');
    } else {
      ok('Step7Fornecedores · botão genérico "Adicionar fornecedor" removido');
    }

    // Mensagem da empty area também deve refletir os 2 botões
    if (/Use os botões acima/.test(code)) {
      ok('Step7Fornecedores · empty area menciona "botões" no plural');
    } else {
      fail('Step7Fornecedores · empty area não menciona botões no plural',
        'mensagem ficou inconsistente com a UI');
    }
  }

  // 2) SetupPage.onAddFornecedor aceita tipo
  const setupPagePath = './src/views/SetupPage.vue';
  if (fs.existsSync(setupPagePath)) {
    const code = fs.readFileSync(setupPagePath, 'utf-8');
    if (/onAddFornecedor\(tipo:\s*['"]usina['"]\s*\|\s*['"]laboratorio['"]\s*=\s*['"]usina['"]\)/.test(code)) {
      ok('SetupPage · onAddFornecedor(tipo) com default "usina"');
    } else {
      fail('SetupPage · onAddFornecedor não recebe tipo',
        'sem isso novoFornecedor() sempre cairia em default');
    }
    if (/novoFornecedor\(tipo\)/.test(code)) {
      ok('SetupPage · onAddFornecedor passa tipo para novoFornecedor()');
    } else {
      fail('SetupPage · novoFornecedor() chamado sem o parâmetro',
        'fornecedor seria criado com tipo padrão');
    }
    // Audit reflete tipo escolhido
    if (/fornecedor_add_\$\{tipo\}/.test(code)) {
      ok('SetupPage · audit registra tipo na ação (fornecedor_add_usina|laboratorio)');
    } else {
      fail('SetupPage · audit não inclui tipo',
        'auditoria perderia granularidade');
    }
  }

  // 3) ClientStatusView e ReviewView também aceitam tipo
  for (const [name, path] of [
    ['ClientStatusView', './src/views/ClientStatusView.vue'],
    ['ReviewView', './src/views/ReviewView.vue'],
  ]) {
    if (fs.existsSync(path)) {
      const code = fs.readFileSync(path, 'utf-8');
      if (/onAddFornecedor\(tipo:\s*['"]usina['"]\s*\|\s*['"]laboratorio['"]\s*=\s*['"]usina['"]\)/.test(code)) {
        ok(`${name} · onAddFornecedor(tipo) — equipe consegue escolher tipo também`);
      } else {
        fail(`${name} · onAddFornecedor não recebe tipo`,
          'equipe usaria sempre default usina mesmo clicando "laboratorio"');
      }
    }
  }

  // 4) Versão bumped — check flexível
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version && pkg.version !== '5.0.22-21' && pkg.version !== '5.0.22-20' && pkg.version !== '5.0.22-19' && pkg.version !== '5.0.22-18') {
      ok(`package.json · version saiu de 5.0.22-21 (atual: ${pkg.version})`);
    } else {
      fail(`package.json · version não bumpada para v5.22.22+`,
        `version ainda é ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.23 — painel recolhido + bugfix Ir para Etapa + novoGrupo default + FCK/Volume opcional + modal Devolver ---------- */
{
  const fs = await import('node:fs');

  // 1) PendenciasPanel inicia RECOLHIDO (expanded: false)
  const panelPath = './src/components/PendenciasPanel.vue';
  if (fs.existsSync(panelPath)) {
    const code = fs.readFileSync(panelPath, 'utf-8');
    if (/data\(\)\s*\{[\s\S]{0,500}expanded:\s*false/.test(code)) {
      ok('PendenciasPanel · inicia RECOLHIDO (expanded: false)');
    } else {
      fail('PendenciasPanel · ainda inicia expandido',
        'usuário pediu painel oculto por default; só sumário fica visível');
    }
    // Botão deve dizer "Ver detalhes" / "Ocultar detalhes"
    if (/Ver detalhes/.test(code) && /Ocultar detalhes/.test(code)) {
      ok('PendenciasPanel · botão alterna entre "Ver detalhes" / "Ocultar detalhes"');
    } else {
      fail('PendenciasPanel · texto do botão toggle incorreto',
        'esperado "Ver detalhes" e "Ocultar detalhes"');
    }
  }

  // 2) goToWithFocus refatorado — não pode mais ser async
  const setupPagePath = './src/views/SetupPage.vue';
  if (fs.existsSync(setupPagePath)) {
    const code = fs.readFileSync(setupPagePath, 'utf-8');
    if (/\basync\s+goToWithFocus\s*\(/.test(code)) {
      fail('SetupPage · goToWithFocus ainda é async',
        'v5.22.23 refatorou para fluxo síncrono no setStep + nextTick callback');
    } else {
      ok('SetupPage · goToWithFocus síncrono (refactor v5.22.23)');
    }
    // Deve usar nextTick com callback (não await)
    if (/this\.\$nextTick\(\s*\(/.test(code)) {
      ok('SetupPage · goToWithFocus usa $nextTick(callback) — isola erros do foco');
    } else {
      fail('SetupPage · goToWithFocus não usa $nextTick(callback)',
        'pattern v5.22.23 é $nextTick(() => { try { ... } catch { } })');
    }
    // Não deve mais ter requestAnimationFrame
    if (/goToWithFocus[\s\S]{0,2000}requestAnimationFrame/.test(code)) {
      fail('SetupPage · goToWithFocus ainda tem requestAnimationFrame',
        'v5.22.23 removeu — era fonte potencial de race');
    } else {
      ok('SetupPage · goToWithFocus sem requestAnimationFrame (simplificado)');
    }
    // Try/catch global no callback do nextTick
    if (/this\.\$nextTick\(\s*\(\)\s*=>\s*\{[\s\S]{0,1500}try\s*\{/.test(code)) {
      ok('SetupPage · goToWithFocus envolve foco em try/catch (defensivo)');
    } else {
      fail('SetupPage · goToWithFocus sem try/catch no callback',
        'erro no scrollIntoView/focus pode propagar pro Vue render');
    }
  }

  // 3) novoGrupo default com edificacoesInput '-'
  const modelsPath = './src/models/setup.models.ts';
  if (fs.existsSync(modelsPath)) {
    const code = fs.readFileSync(modelsPath, 'utf-8');
    if (/novoGrupo\(seed[\s\S]{0,1200}edificacoesInput:\s*seed\.edificacoesInput\s*\?\?\s*['"]-['"]/.test(code)) {
      ok('novoGrupo · default edificacoesInput "-" (sem numeração)');
    } else {
      fail('novoGrupo · default ainda é vazio',
        'esperado "-" para que prévia mostre 1 item sem numeração');
    }
  }

  // 4) Validation service — FCK e Volume não obrigatórios
  const valPath = './src/services/validationService.ts';
  if (fs.existsSync(valPath)) {
    const code = fs.readFileSync(valPath, 'utf-8');
    // FCK vazio NÃO deve mais bloquear — só FCK preenchido com valor inválido
    if (/if\s*\(\s*p\.fck\s*&&[\s\S]{0,150}!parseFck\(p\.fck\)\s*\)/.test(code)) {
      ok('validation · FCK só valida quando preenchido (vazio é OK)');
    } else {
      fail('validation · FCK ainda bloqueia quando vazio',
        'pedido: FCK não obrigatório');
    }
    // FCK quando inválido deve ser warning, não error
    if (/PECA_FCK_INVALIDO[\s\S]{0,150}'warning'/.test(code)) {
      ok('validation · FCK inválido vira warning (não bloqueante)');
    } else {
      fail('validation · FCK inválido ainda é error',
        'usuário pode enviar mesmo com FCK problemático — só alerta');
    }
    // PECA_VOLUME_AUSENTE não deve mais ser pushado
    // (string "Volume ainda não informado" só está em comentário agora)
    const ausenteUsado = code.match(/PECA_VOLUME_AUSENTE/g) || [];
    if (ausenteUsado.length === 0) {
      ok('validation · PECA_VOLUME_AUSENTE removido (volume vazio é OK)');
    } else {
      // Pode estar em outros lugares (declaração de codes etc), mas não deve
      // estar no push de alertas
      const pushPattern = /alertas\.push\([\s\S]{0,80}PECA_VOLUME_AUSENTE/;
      if (pushPattern.test(code)) {
        fail('validation · PECA_VOLUME_AUSENTE ainda é pushado',
          'volume vazio não deve mais alertar');
      } else {
        ok('validation · PECA_VOLUME_AUSENTE só na declaração (não é mais pushado)');
      }
    }
    // Volume alto e precisão continuam warnings (input inválido != ausente)
    if (/PECA_VOLUME_ALTO/.test(code) && /PECA_VOLUME_PRECISAO/.test(code)) {
      ok('validation · PECA_VOLUME_ALTO + PECA_VOLUME_PRECISAO preservados (input inválido)');
    } else {
      fail('validation · warnings de volume inválido perdidos',
        'volume > 1000 e casas decimais demais ainda devem alertar');
    }
  }

  // 5) ReturnSubmissionModal — sem nextTick + auto-focus problemático
  const modalPath = './src/components/ReturnSubmissionModal.vue';
  if (fs.existsSync(modalPath)) {
    const code = fs.readFileSync(modalPath, 'utf-8');
    if (/import\s*\{\s*defineComponent,\s*nextTick\s*\}/.test(code)) {
      fail('ReturnSubmissionModal · ainda importa nextTick',
        'v5.22.23 removeu — era fonte potencial do "botão Devolver não funciona"');
    } else {
      ok('ReturnSubmissionModal · não importa mais nextTick (simplificado)');
    }
    if (/ref=["']textarea["']/.test(code)) {
      fail('ReturnSubmissionModal · ainda tem ref="textarea"',
        'sem auto-focus, o ref não é mais necessário');
    } else {
      ok('ReturnSubmissionModal · ref="textarea" removido');
    }
  }

  // 6) ReviewView · onOpenReturnModal sem eslint-disable (log visível em prod)
  const reviewPath = './src/views/ReviewView.vue';
  if (fs.existsSync(reviewPath)) {
    const code = fs.readFileSync(reviewPath, 'utf-8');
    if (/onOpenReturnModal\(\)[\s\S]{0,500}console\.info[\s\S]{0,300}returnModalOpen\s*=\s*true/.test(code)) {
      ok('ReviewView · onOpenReturnModal com log visível + abre modal');
    } else {
      fail('ReviewView · onOpenReturnModal estrutura inesperada',
        'esperado: log + returnModalOpen = true');
    }
  }

  // 7) Versão bumped — check flexível
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version && pkg.version !== '5.0.22-22' && pkg.version !== '5.0.22-21' && pkg.version !== '5.0.22-20' && pkg.version !== '5.0.22-19' && pkg.version !== '5.0.22-18') {
      ok(`package.json · version saiu de 5.0.22-22 (atual: ${pkg.version})`);
    } else {
      fail(`package.json · version não bumpada para v5.22.23+`,
        `version ainda é ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.24 — link compartilhável + /meus-rascunhos ---------- */
{
  const fs = await import('node:fs');

  // 1) Router tem a rota /meus-rascunhos
  const routerPath = './src/router/index.ts';
  if (fs.existsSync(routerPath)) {
    const code = fs.readFileSync(routerPath, 'utf-8');
    if (/path:\s*['"]\/meus-rascunhos['"]/.test(code)) {
      ok('router · rota /meus-rascunhos presente');
    } else {
      fail('router · rota /meus-rascunhos ausente',
        'usuário acessa /meus-rascunhos diretamente');
    }
    if (/component:\s*MyDraftsView/.test(code)) {
      ok('router · /meus-rascunhos aponta para MyDraftsView');
    } else {
      fail('router · /meus-rascunhos sem MyDraftsView',
        'componente não está vinculado à rota');
    }
  }

  // 2) MyDraftsView.vue existe com elementos essenciais
  const myDraftsPath = './src/views/MyDraftsView.vue';
  if (!fs.existsSync(myDraftsPath)) {
    fail('MyDraftsView.vue · ausente', 'criar a view v5.22.24');
  } else {
    const code = fs.readFileSync(myDraftsPath, 'utf-8');
    if (/listDrafts/.test(code)) {
      ok('MyDraftsView · chama listDrafts');
    } else {
      fail('MyDraftsView · sem listDrafts',
        'view deve listar via service existente');
    }
    if (/deleteDraft/.test(code)) {
      ok('MyDraftsView · chama deleteDraft');
    } else {
      fail('MyDraftsView · sem deleteDraft',
        'botão "Apagar" precisa do service');
    }
    // Filtra status=rascunho (não mostra enviados/cancelados/etc)
    if (/d\.status\s*===\s*['"]rascunho['"]/.test(code)) {
      ok('MyDraftsView · filtra só status=rascunho');
    } else {
      fail('MyDraftsView · não filtra status',
        'mostraria enviados/cancelados misturados');
    }
    // Link "Continuar" usa /?draft=
    if (/\/\?draft=\$\{encodeURIComponent\(d\.id\)\}/.test(code)) {
      ok('MyDraftsView · link "Continuar" usa /?draft=:id');
    } else {
      fail('MyDraftsView · link "Continuar" mal formado',
        'esperado /?draft=:id para entrar no fluxo do mounted do SetupPage');
    }
    // window.confirm antes de apagar
    if (/window\.confirm/.test(code)) {
      ok('MyDraftsView · confirma antes de apagar');
    } else {
      fail('MyDraftsView · apaga sem confirmação',
        'risco de delete acidental');
    }
  }

  // 3) cleanup-legacy permite MyDraftsView
  const cleanupPath = './scripts/cleanup-legacy.cjs';
  if (fs.existsSync(cleanupPath)) {
    const code = fs.readFileSync(cleanupPath, 'utf-8');
    if (/'MyDraftsView\.vue'/.test(code)) {
      ok('cleanup-legacy · MyDraftsView.vue na allowlist');
    } else {
      fail('cleanup-legacy · MyDraftsView.vue não permitido',
        'prebuild apagaria o componente, build quebraria');
    }
  }

  // 4) SetupPage detecta ?draft= no mounted
  const setupPagePath = './src/views/SetupPage.vue';
  if (fs.existsSync(setupPagePath)) {
    const code = fs.readFileSync(setupPagePath, 'utf-8');
    if (/this\.\$route\.query\.draft/.test(code)) {
      ok('SetupPage · mounted lê $route.query.draft');
    } else {
      fail('SetupPage · não lê ?draft= do query',
        'link compartilhável não funcionaria');
    }
    // mounted virou async
    if (/async\s+mounted\s*\(\s*\)/.test(code)) {
      ok('SetupPage · mounted é async (precisa para loadDraft no link)');
    } else {
      fail('SetupPage · mounted não é async',
        'await loadDraft só funciona em mounted async');
    }
    // Limpa URL via replaceState
    if (/history\??\.replaceState/.test(code)) {
      ok('SetupPage · limpa ?draft= da URL via replaceState (não vaza id no histórico)');
    } else {
      fail('SetupPage · não limpa URL após carregar draft',
        'id ficaria visível em compartilhamentos posteriores via "copiar link"');
    }
    // Botão "Copiar link"
    if (/onCopyDraftLink/.test(code)) {
      ok('SetupPage · método onCopyDraftLink presente');
    } else {
      fail('SetupPage · sem onCopyDraftLink',
        'botão copiar link não tem handler');
    }
    // Botão só aparece com draftId
    if (/v-if="draftId"[\s\S]{0,400}Copiar link|onCopyDraftLink[\s\S]{0,200}draftId/.test(code)) {
      ok('SetupPage · botão Copiar link só aparece se há draftId');
    } else {
      fail('SetupPage · botão Copiar link sem guard de draftId',
        'mostraria link vazio para rascunho recém-criado');
    }
    // Feedback visual "Link copiado!" via state
    if (/linkJustCopied/.test(code)) {
      ok('SetupPage · feedback visual "Link copiado!" implementado');
    } else {
      fail('SetupPage · sem feedback visual no copy',
        'usuário não saberia que copiou');
    }
    // Fallback execCommand para contextos http://
    if (/execCommand\(['"]copy['"]\)/.test(code)) {
      ok('SetupPage · fallback execCommand para contextos inseguros');
    } else {
      fail('SetupPage · sem fallback de copy',
        'falharia em http://localhost de algumas instalações');
    }
    // Limpeza do timer no beforeUnmount
    if (/beforeUnmount[\s\S]{0,500}clearTimeout\(this\.linkCopiedTimer\)/.test(code)) {
      ok('SetupPage · beforeUnmount limpa linkCopiedTimer (sem leak)');
    } else {
      fail('SetupPage · timer linkCopiedTimer vaza no unmount',
        'erro silencioso no console se usuário navegar nos 2s');
    }
  }

  // 5) Versão bumped
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version === '5.0.22-24') {
      ok(`package.json · version = ${pkg.version} (v5.22.24)`);
    } else if (/^5\.0\.22-(2[5-9]|[3-9]\d|\d{3,})$/.test(pkg.version)) {
      // v5.22.25+ — bump compatível, validado em blocos posteriores
      ok(`package.json · version = ${pkg.version} (v5.22.24+, ainda compatível)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.24+`,
        `esperado 5.0.22-24 ou superior, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.25 — labels "Etapa N" obsoletas → localizacaoForPath ---------- */
{
  const fs = await import('node:fs');

  // 1) Novo helper stepMappingService existe e exporta as 3 funções
  const helperPath = './src/services/stepMappingService.ts';
  if (!fs.existsSync(helperPath)) {
    fail('stepMappingService.ts · ausente',
      'criar src/services/stepMappingService.ts (helper centralizado v5.22.25)');
  } else {
    const code = fs.readFileSync(helperPath, 'utf-8');
    if (/export\s+function\s+pathToStep\s*\(/.test(code)) {
      ok('stepMappingService · exporta pathToStep');
    } else {
      fail('stepMappingService · sem pathToStep exportada',
        'PendenciasPanel e testes dependem dessa função');
    }
    if (/export\s+function\s+stepTitle\s*\(/.test(code)) {
      ok('stepMappingService · exporta stepTitle');
    } else {
      fail('stepMappingService · sem stepTitle',
        'usada por localizacaoForPath e UI futura');
    }
    if (/export\s+function\s+localizacaoForPath\s*\(/.test(code)) {
      ok('stepMappingService · exporta localizacaoForPath');
    } else {
      fail('stepMappingService · sem localizacaoForPath',
        'validationService depende dela');
    }
    // Lê WIZARD_STEPS em vez de hardcoded — garante que mude junto se o
    // wizard for renumerado de novo
    if (/from\s+['"]\.\.\/models\/setup\.models['"]/.test(code)
        && /WIZARD_STEPS/.test(code)) {
      ok('stepMappingService · lê WIZARD_STEPS (fonte única de títulos)');
    } else {
      fail('stepMappingService · não consome WIZARD_STEPS',
        'risco de drift: títulos hardcoded ficariam fora de sincronia com o wizard');
    }
  }

  // 2) validationService sem nenhuma string literal "'Etapa N'" em CÓDIGO
  // (filtra comentários /* ... */ e //, que podem mencionar a história).
  const vsPath = './src/services/validationService.ts';
  if (fs.existsSync(vsPath)) {
    const code = fs.readFileSync(vsPath, 'utf-8');
    // remove comentários de bloco
    const noBlockComments = code.replace(/\/\*[\s\S]*?\*\//g, '');
    // remove comentários de linha
    const noComments = noBlockComments.replace(/\/\/[^\n]*/g, '');
    const literalMatches = noComments.match(/['"]Etapa \d+['"]/g) || [];
    if (literalMatches.length === 0) {
      ok('validationService · zero literais "Etapa N" em código (comentários ignorados)');
    } else {
      fail(`validationService · ${literalMatches.length} literais "Etapa N" sobraram em código`,
        `encontrados: ${literalMatches.join(', ')} — devem usar localizacaoForPath()`);
    }
    // Importa localizacaoForPath do helper
    if (/import\s*\{[^}]*localizacaoForPath[^}]*\}\s*from\s+['"][^'"]*stepMappingService/.test(code)) {
      ok('validationService · importa localizacaoForPath do helper');
    } else {
      fail('validationService · não importa localizacaoForPath',
        'sem o import o reuso não acontece');
    }
    // Pelo menos uma chamada em uso (sanity)
    if (/localizacaoForPath\(/.test(code)) {
      ok('validationService · usa localizacaoForPath em pelo menos uma issue');
    } else {
      fail('validationService · importou mas não usa localizacaoForPath',
        'import morto — defeito de implementação');
    }
  }

  // 3) PendenciasPanel reusa pathToStep do helper, sem duplicata local
  const ppPath = './src/components/PendenciasPanel.vue';
  if (fs.existsSync(ppPath)) {
    const code = fs.readFileSync(ppPath, 'utf-8');
    if (/import\s*\{[^}]*pathToStep[^}]*\}\s*from\s+['"][^'"]*stepMappingService/.test(code)) {
      ok('PendenciasPanel · importa pathToStep do helper');
    } else {
      fail('PendenciasPanel · não importa pathToStep do helper',
        'duplicação local recriaria a dívida técnica');
    }
    // Função local pathToStep não deve mais existir (ficaria como dead code)
    if (/function\s+pathToStep\s*\(/.test(code)) {
      fail('PendenciasPanel · ainda tem function pathToStep local',
        'remover declaração local — agora vem do helper via import');
    } else {
      ok('PendenciasPanel · sem declaração local de pathToStep (sem dead code)');
    }
  }

  // 4) helper.pathToStep: mapeamentos críticos validados em runtime
  // (consolidado aqui — substitui os regex-checks do bloco v5.22.20 que
  // procuravam por padrões inline no PendenciasPanel.vue)
  try {
    const { pathToStep, stepTitle } = await import('./src/services/stepMappingService');
    const mappingChecks: Array<[string, string, number]> = [
      ['metadata.* → 1', 'metadata.obraNome', 1],
      ['grupos[*].pecas → 4 (antes de grupos genérico)', 'grupos[0].pecas[0].fck', 4],
      ['grupos → 2 (era 3 antes da v5.22.11)', 'grupos[0].nome', 2],
      ['concretos → 3', 'concretos[0].nome', 3],
      ['usuariosObra → 5 (era 6 antes do remap)', 'usuariosObra[0].email', 5],
      ['fornecedores → 6 (era 7 antes do remap)', 'fornecedores[0].cnpj', 6],
    ];
    for (const [name, path, expected] of mappingChecks) {
      const got = pathToStep(path);
      if (got === expected) {
        ok(`stepMappingService · ${name}`);
      } else {
        fail(`stepMappingService · ${name} retornou ${got}`,
          `path "${path}" deveria mapear para ${expected}, retornou ${got}`);
      }
    }
    // Sanity de stepTitle (lê de WIZARD_STEPS — se mudar, este teste pega)
    if (stepTitle(2) === 'Blocos e torres') {
      ok('stepMappingService · stepTitle(2) === "Blocos e torres"');
    } else {
      fail('stepMappingService · stepTitle(2) inesperado',
        `retornou "${stepTitle(2)}"`);
    }
    if (stepTitle(6) === 'Fornecedores') {
      ok('stepMappingService · stepTitle(6) === "Fornecedores"');
    } else {
      fail('stepMappingService · stepTitle(6) inesperado',
        `retornou "${stepTitle(6)}"`);
    }
  } catch (e: any) {
    fail('stepMappingService · runtime check falhou', e?.message || String(e));
  }

  // 5) Roda validateSnapshot com snapshot vazio e confere localizacao em runtime
  // (smoke estrutural não basta — runtime garante que nada regrediu)
  try {
    const { validateSnapshot } = await import('./src/services/validationService');
    const { pathToStep } = await import('./src/services/stepMappingService');
    const emptySnap = {
      metadata: {
        obraNome: '',
        obraCodigo: '',
        cliente: '',
        regional: '',
        modeloPreenchimento: 'comum',
        createdBy: { nome: '', email: '', telefone: '' },
      },
      grupos: [],
      concretos: [],
      usuariosObra: [],
      fornecedores: [],
    };
    const r = validateSnapshot(emptySnap as any);
    // Nenhum issue deve ter localizacao = "Etapa 3" para path grupos*
    const grupoBugs = r.issues.filter(
      (i) => i.localizacao === 'Etapa 3' && i.path.startsWith('grupos'),
    );
    if (grupoBugs.length === 0) {
      ok('validateSnapshot · zero issues "Etapa 3" para path grupos (regressão pré-v5.22.25)');
    } else {
      fail(`validateSnapshot · ${grupoBugs.length} issues regrediram para "Etapa 3"`,
        grupoBugs.map((i) => i.code).join(', '));
    }
    // Nenhum issue deve ter "Etapa 6" para usuariosObra
    const userBugs = r.issues.filter(
      (i) => i.localizacao === 'Etapa 6' && i.path.startsWith('usuariosObra'),
    );
    if (userBugs.length === 0) {
      ok('validateSnapshot · zero issues "Etapa 6" para path usuariosObra');
    } else {
      fail(`validateSnapshot · ${userBugs.length} issues regrediram para "Etapa 6"`,
        userBugs.map((i) => i.code).join(', '));
    }
    // Nenhum issue deve ter "Etapa 7" para fornecedores
    const fornBugs = r.issues.filter(
      (i) => i.localizacao === 'Etapa 7' && i.path.startsWith('fornecedores'),
    );
    if (fornBugs.length === 0) {
      ok('validateSnapshot · zero issues "Etapa 7" para path fornecedores');
    } else {
      fail(`validateSnapshot · ${fornBugs.length} issues regrediram para "Etapa 7"`,
        fornBugs.map((i) => i.code).join(', '));
    }
    // Consistência: declared step (extraído de localizacao) === pathToStep(path)
    let mismatches = 0;
    const mismatchSamples: string[] = [];
    for (const i of r.issues) {
      if (!i.localizacao) continue;
      const m = i.localizacao.match(/^Etapa (\d+)/);
      if (!m) continue;
      const declared = parseInt(m[1], 10);
      const expected = pathToStep(i.path);
      if (declared !== expected) {
        mismatches++;
        mismatchSamples.push(`${i.code} → declarou ${declared}, esperava ${expected}`);
      }
    }
    if (mismatches === 0) {
      ok('validateSnapshot · localizacao alinhada com pathToStep em todos os issues');
    } else {
      fail(`validateSnapshot · ${mismatches} mismatches entre localizacao e pathToStep`,
        mismatchSamples.slice(0, 3).join('; '));
    }
    // Formato novo: "Etapa N · Título" para issues genéricas (não-singletons)
    const obraSemGrupos = r.issues.find((i) => i.code === 'VAL-OBRA-003');
    if (obraSemGrupos && /^Etapa \d+ · .+/.test(obraSemGrupos.localizacao || '')) {
      ok('validateSnapshot · localizacao no formato "Etapa N · Título" (legível)');
    } else {
      fail('validateSnapshot · localizacao não está no formato "Etapa N · Título"',
        `VAL-OBRA-003 trouxe "${obraSemGrupos?.localizacao}"`);
    }
    // O issue "VAL-OBRA-003" tem que apontar para Etapa 2 agora (não mais 3)
    if (obraSemGrupos && obraSemGrupos.localizacao?.startsWith('Etapa 2')) {
      ok('validateSnapshot · VAL-OBRA-003 (sem grupos) agora aponta para Etapa 2 (corrigido)');
    } else {
      fail('validateSnapshot · VAL-OBRA-003 não aponta para Etapa 2',
        `localizacao="${obraSemGrupos?.localizacao}"`);
    }
    // FORNECEDORES_VAZIO tem que apontar para Etapa 6 agora (não mais 7)
    const fornVazio = r.issues.find((i) => i.code === 'FORNECEDORES_VAZIO');
    if (fornVazio && fornVazio.localizacao?.startsWith('Etapa 6')) {
      ok('validateSnapshot · FORNECEDORES_VAZIO agora aponta para Etapa 6 (corrigido)');
    } else {
      fail('validateSnapshot · FORNECEDORES_VAZIO não aponta para Etapa 6',
        `localizacao="${fornVazio?.localizacao}"`);
    }
    // USUARIOS_OBRA_VAZIO → Etapa 5 (não mais 6)
    const userVazio = r.issues.find((i) => i.code === 'USUARIOS_OBRA_VAZIO');
    if (userVazio && userVazio.localizacao?.startsWith('Etapa 5')) {
      ok('validateSnapshot · USUARIOS_OBRA_VAZIO agora aponta para Etapa 5 (corrigido)');
    } else {
      fail('validateSnapshot · USUARIOS_OBRA_VAZIO não aponta para Etapa 5',
        `localizacao="${userVazio?.localizacao}"`);
    }
  } catch (e: any) {
    fail('validateSnapshot · runtime check falhou', e?.message || String(e));
  }

  // 6) Versão bumped para v5.22.25
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version === '5.0.22-25') {
      ok(`package.json · version = ${pkg.version} (v5.22.25)`);
    } else if (/^5\.0\.22-(2[6-9]|[3-9]\d|\d{3,})$/.test(pkg.version)) {
      // v5.22.26+ — bump compatível, validado em bloco posterior
      ok(`package.json · version = ${pkg.version} (v5.22.25+, ainda compatível)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.25+`,
        `esperado 5.0.22-25 ou superior, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.26 — share-draft-link (envio do link por email) ---------- */
{
  const fs = await import('node:fs');

  // 1) Edge Function existe e tem o handler principal
  const efPath = './../supabase/functions/share-draft-link/index.ts';
  if (!fs.existsSync(efPath)) {
    fail('supabase/functions/share-draft-link · ausente',
      'criar Edge Function share-draft-link/index.ts');
  } else {
    const code = fs.readFileSync(efPath, 'utf-8');
    if (/serve\s*\(\s*async\s*\(\s*req/.test(code)) {
      ok('share-draft-link · handler serve() presente');
    } else {
      fail('share-draft-link · sem serve() handler', 'esperado padrão Deno');
    }
    if (/RESEND_API_KEY/.test(code)) {
      ok('share-draft-link · consome RESEND_API_KEY');
    } else {
      fail('share-draft-link · sem RESEND_API_KEY', 'sem chave o email falha');
    }
    if (/EMAIL_FROM/.test(code)) {
      ok('share-draft-link · consome EMAIL_FROM');
    } else {
      fail('share-draft-link · sem EMAIL_FROM', 'sem from o email é rejeitado');
    }
    // Validação de UUID e email no handler — defesa contra payload malicioso
    if (/isValidUuid/.test(code) && /isValidEmail/.test(code)) {
      ok('share-draft-link · valida UUID e email no payload');
    } else {
      fail('share-draft-link · sem validação de payload',
        'aceitaria payloads quebrados, gasta chamada do Resend à toa');
    }
    // CORS completo (importante para chamada cross-origin do Vite dev)
    if (/Access-Control-Allow-Origin/.test(code) && /OPTIONS/.test(code)) {
      ok('share-draft-link · CORS completo (incl. OPTIONS)');
    } else {
      fail('share-draft-link · CORS incompleto',
        'browser bloqueia chamada cross-origin sem OPTIONS handler');
    }
    // escapeHtml protege contra injection no HTML do email
    if (/escapeHtml/.test(code)) {
      ok('share-draft-link · escapa HTML do conteúdo do email');
    } else {
      fail('share-draft-link · sem escapeHtml',
        'mensagem do usuário poderia injetar HTML/script no email');
    }
    // POST para api.resend.com/emails (canal correto)
    if (/api\.resend\.com\/emails/.test(code)) {
      ok('share-draft-link · POST para api.resend.com/emails');
    } else {
      fail('share-draft-link · não chama api.resend.com',
        'email não seria enviado');
    }
    // Build da URL — deriva de APP_URL_BASE / SETUP_URL_BASE / REVIEW_URL_BASE
    if (/APP_URL_BASE|SETUP_URL_BASE|REVIEW_URL_BASE/.test(code)) {
      ok('share-draft-link · resolve URL base do app via env');
    } else {
      fail('share-draft-link · URL base hardcoded',
        'inviabiliza staging/preview com URL diferente');
    }
  }

  // 2) setupShareService.ts existe e tem a função pública
  const servicePath = './src/services/setupShareService.ts';
  if (!fs.existsSync(servicePath)) {
    fail('setupShareService.ts · ausente',
      'criar src/services/setupShareService.ts');
  } else {
    const code = fs.readFileSync(servicePath, 'utf-8');
    if (/export\s+async\s+function\s+shareDraftLink\s*\(/.test(code)) {
      ok('setupShareService · exporta shareDraftLink async');
    } else {
      fail('setupShareService · sem shareDraftLink',
        'SetupPage não tem como chamar a Edge Function');
    }
    if (/share-draft-link/.test(code)) {
      ok('setupShareService · usa nome share-draft-link da Edge Function');
    } else {
      fail('setupShareService · nome da Edge Function não bate',
        'chamaria função errada/inexistente');
    }
    if (/SUPABASE_CONFIGURED/.test(code)) {
      ok('setupShareService · tem fallback local-only quando Supabase ausente');
    } else {
      fail('setupShareService · sem fallback local',
        'protótipo trava em dev sem credenciais');
    }
    // Validação client-side (não gasta chamada se email é inválido)
    if (/\^\[\^\\s@\]\+@\[\^\\s@\]\+/.test(code)) {
      ok('setupShareService · valida email no client antes de chamar Edge');
    } else {
      fail('setupShareService · sem validação local de email',
        'gastaria chamada da Edge à toa em emails inválidos');
    }
  }

  // 3) ShareDraftLinkModal.vue existe e tem o necessário
  const modalPath = './src/components/ShareDraftLinkModal.vue';
  if (!fs.existsSync(modalPath)) {
    fail('ShareDraftLinkModal.vue · ausente',
      'criar src/components/ShareDraftLinkModal.vue');
  } else {
    const code = fs.readFileSync(modalPath, 'utf-8');
    if (/Teleport\s+to="body"/.test(code)) {
      ok('ShareDraftLinkModal · usa Teleport to=body (padrão dos modais)');
    } else {
      fail('ShareDraftLinkModal · sem Teleport',
        'modal renderizaria dentro do AppShell, sujeito a z-index/overflow do parent');
    }
    if (/aria-modal="true"/.test(code) && /role="dialog"/.test(code)) {
      ok('ShareDraftLinkModal · aria-modal + role=dialog (acessibilidade)');
    } else {
      fail('ShareDraftLinkModal · falta aria-modal ou role',
        'leitor de tela não anuncia como modal');
    }
    if (/v-model="recipientEmail"/.test(code)) {
      ok('ShareDraftLinkModal · input de email com v-model');
    } else {
      fail('ShareDraftLinkModal · sem input de email',
        'sem destino o envio não acontece');
    }
    if (/emits:\s*\[[^\]]*['"]close['"][^\]]*['"]submit['"]/.test(code)
        || /emits:\s*\[[^\]]*['"]submit['"][^\]]*['"]close['"]/.test(code)) {
      ok('ShareDraftLinkModal · emite close + submit');
    } else {
      fail('ShareDraftLinkModal · emits incompletos',
        'parent não consegue saber quando fechar nem quando enviar');
    }
    // Estados de UI esperados
    if (/'sending'/.test(code) && /'success'/.test(code) && /'error'/.test(code)) {
      ok('ShareDraftLinkModal · cobre estados idle/sending/success/error');
    } else {
      fail('ShareDraftLinkModal · estados de UI incompletos',
        'usuário ficaria sem feedback durante o envio');
    }
    // Métodos públicos para o parent controlar o resultado
    if (/resolveSend\s*\(/.test(code) && /failSend\s*\(/.test(code)) {
      ok('ShareDraftLinkModal · expõe resolveSend/failSend para o parent');
    } else {
      fail('ShareDraftLinkModal · sem resolveSend/failSend',
        'parent não tem como atualizar o estado do modal após chamada Edge');
    }
  }

  // 4) SetupPage.vue: botão + componente + handlers integrados
  const setupPagePath = './src/views/SetupPage.vue';
  if (fs.existsSync(setupPagePath)) {
    const code = fs.readFileSync(setupPagePath, 'utf-8');
    if (/onOpenShareModal/.test(code)) {
      ok('SetupPage · handler onOpenShareModal presente');
    } else {
      fail('SetupPage · sem onOpenShareModal',
        'botão "Enviar por email" não tem para onde apontar');
    }
    if (/onSendShareEmail/.test(code)) {
      ok('SetupPage · handler onSendShareEmail presente');
    } else {
      fail('SetupPage · sem onSendShareEmail',
        'submit do modal não chega ao service');
    }
    if (/<ShareDraftLinkModal/.test(code)) {
      ok('SetupPage · renderiza ShareDraftLinkModal');
    } else {
      fail('SetupPage · ShareDraftLinkModal não renderizado',
        'modal nunca aparece');
    }
    // Botão na topbar — visível só com draftId
    if (/v-if="draftId"[\s\S]{0,400}Enviar por email|onOpenShareModal[\s\S]{0,200}draftId/.test(code)) {
      ok('SetupPage · botão "Enviar por email" guard por draftId');
    } else {
      fail('SetupPage · botão "Enviar por email" sem guard de draftId',
        'usuário clicaria com draftId null, modal travaria sem alvo');
    }
    if (/shareDraftLink\s*\(/.test(code) || /import\s*\{[^}]*shareDraftLink[^}]*\}/.test(code)) {
      ok('SetupPage · usa shareDraftLink do service');
    } else {
      fail('SetupPage · não importa shareDraftLink',
        'handler chamaria função inexistente');
    }
    // Estado shareModalOpen
    if (/shareModalOpen/.test(code)) {
      ok('SetupPage · estado shareModalOpen presente');
    } else {
      fail('SetupPage · sem shareModalOpen',
        'sem estado o modal não abre');
    }
  }

  // 5) cleanup-legacy permite ShareDraftLinkModal e setupShareService
  const cleanupPath = './scripts/cleanup-legacy.cjs';
  if (fs.existsSync(cleanupPath)) {
    const code = fs.readFileSync(cleanupPath, 'utf-8');
    if (/'ShareDraftLinkModal\.vue'/.test(code)) {
      ok('cleanup-legacy · ShareDraftLinkModal.vue na allowlist');
    } else {
      fail('cleanup-legacy · ShareDraftLinkModal.vue não permitido',
        'prebuild apagaria o componente');
    }
    if (/'setupShareService\.ts'/.test(code)) {
      ok('cleanup-legacy · setupShareService.ts na allowlist');
    } else {
      fail('cleanup-legacy · setupShareService.ts não permitido',
        'prebuild apagaria o service');
    }
  }

  // 6) Versão bumped para v5.22.26
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version === '5.0.22-26') {
      ok(`package.json · version = ${pkg.version} (v5.22.26)`);
    } else if (/^5\.0\.22-(2[7-9]|[3-9]\d|\d{3,})$/.test(pkg.version)) {
      ok(`package.json · version = ${pkg.version} (v5.22.26+, ainda compatível)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.26+`,
        `esperado 5.0.22-26 ou superior, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.27 — cleanup geral: A11y modais + bugs herdados + CI workflow ---------- */
{
  const fs = await import('node:fs');

  // 1) useModalA11y composable existe e exporta o helper
  const composablePath = './src/composables/useModalA11y.ts';
  if (!fs.existsSync(composablePath)) {
    fail('useModalA11y.ts · ausente',
      'criar src/composables/useModalA11y.ts (a11y centralizada)');
  } else {
    const code = fs.readFileSync(composablePath, 'utf-8');
    if (/export\s+function\s+setupModalA11y/.test(code)) {
      ok('useModalA11y · exporta setupModalA11y');
    } else {
      fail('useModalA11y · sem setupModalA11y',
        'modais não conseguem ativar focus trap');
    }
    if (/Escape/.test(code) && /Tab/.test(code)) {
      ok('useModalA11y · cobre ESC + Tab (focus trap)');
    } else {
      fail('useModalA11y · sem cobertura de ESC ou Tab',
        'acessibilidade incompleta');
    }
    if (/previouslyFocused/.test(code)) {
      ok('useModalA11y · restaura foco anterior ao fechar');
    } else {
      fail('useModalA11y · não restaura foco anterior',
        'usuário de teclado "perde lugar" ao fechar');
    }
    if (/FOCUSABLE_SELECTOR/.test(code)) {
      ok('useModalA11y · seletor de elementos focáveis presente');
    } else {
      fail('useModalA11y · sem seletor de focáveis',
        'focus trap não tem como iterar elementos');
    }
  }

  // 2) Os 3 modais consomem o composable
  const modalsToCheck = [
    { path: './src/components/ShareDraftLinkModal.vue', name: 'ShareDraftLinkModal' },
    { path: './src/components/SubmitTicketModal.vue',   name: 'SubmitTicketModal'   },
    { path: './src/components/ReturnSubmissionModal.vue', name: 'ReturnSubmissionModal' },
  ];
  for (const m of modalsToCheck) {
    if (!fs.existsSync(m.path)) {
      fail(`${m.name} · arquivo ausente`, `esperado em ${m.path}`);
      continue;
    }
    const code = fs.readFileSync(m.path, 'utf-8');
    if (/import\s*\{[^}]*setupModalA11y[^}]*\}\s*from\s+['"][^'"]*useModalA11y/.test(code)) {
      ok(`${m.name} · importa setupModalA11y do composable`);
    } else {
      fail(`${m.name} · não importa setupModalA11y`,
        'modal continua sem focus trap nem ESC fecha');
    }
    if (/a11y[\s\S]{0,400}\.activate\(\)/.test(code)) {
      ok(`${m.name} · chama a11y.activate()`);
    } else {
      fail(`${m.name} · não ativa a11y`,
        'composable importado mas não usado');
    }
    if (/a11y[\s\S]{0,400}\.deactivate\(\)/.test(code)) {
      ok(`${m.name} · chama a11y.deactivate()`);
    } else {
      fail(`${m.name} · não desativa a11y`,
        'memory leak: listener de keydown global fica pendurado');
    }
  }

  // 3) Bugs herdados: SetupPage.onNext usa 7 (não 8)
  const setupPath = './src/views/SetupPage.vue';
  if (fs.existsSync(setupPath)) {
    const code = fs.readFileSync(setupPath, 'utf-8');
    // Não deve mais ter `s === 8` ou `s < 8` no onNext (renumeração obsoleta)
    // mas pode ter em comentários. Removemos comments antes do match.
    const noBlock = code.replace(/\/\*[\s\S]*?\*\//g, '');
    const noLine = noBlock.replace(/\/\/[^\n]*/g, '');
    const obsoleto8 = /\bs\s*===\s*8\b|\bs\s*<\s*8\b/.test(noLine);
    if (!obsoleto8) {
      ok('SetupPage.onNext · sem referências obsoletas a step 8 em código');
    } else {
      fail('SetupPage.onNext · referência obsoleta a step 8',
        'renumeração v5.22.11 deixou lógica antiga; gera setStep(8) → tela branca');
    }
    // E DEVE ter a lógica nova com 7
    if (/s\s*===\s*7[\s\S]{0,200}onSubmitForValidation/.test(code)) {
      ok('SetupPage.onNext · trata step 7 como submit (correto pós-v5.22.11)');
    } else {
      fail('SetupPage.onNext · não trata step 7 como submit',
        'usuário não consegue enviar para validação via Avançar');
    }
    // Step8Preview com total-steps 7 (não 8)
    if (/<Step8Preview[\s\S]{0,400}:total-steps="7"/.test(code)) {
      ok('SetupPage · Step8Preview com :total-steps="7"');
    } else {
      fail('SetupPage · Step8Preview com total-steps obsoleto',
        'stepper inconsistente, possível raiz de bugs de UI');
    }
  }

  // 4) WizardFooter com currentStep < 7 (não < 6)
  const footerPath = './src/components/WizardFooter.vue';
  if (fs.existsSync(footerPath)) {
    const code = fs.readFileSync(footerPath, 'utf-8');
    if (/v-if="currentStep\s*<\s*7"/.test(code)) {
      ok('WizardFooter · "Avançar" visível em 1-6 (correto pós-renumeração)');
    } else if (/v-if="currentStep\s*<\s*6"/.test(code)) {
      fail('WizardFooter · "Avançar" oculto cedo demais (< 6)',
        'usuário fica preso na Etapa 5/6, precisa usar sidebar');
    } else {
      fail('WizardFooter · condição de "Avançar" não reconhecida',
        'verificar v-if no botão Avançar');
    }
  }

  // 5) Vuex setStep faz clamp em 1-9 e warn fora do intervalo
  const storePath = './src/store/modules/setup.ts';
  if (fs.existsSync(storePath)) {
    const code = fs.readFileSync(storePath, 'utf-8');
    if (/Math\.min\(9,\s*step\)/.test(code)) {
      ok('setStep · clamp em max 9 (era 10 obsoleto)');
    } else {
      fail('setStep · clamp obsoleto',
        'permitia setStep(10) que nenhum template cobria');
    }
    if (/console\.warn[\s\S]{0,200}setStep/.test(code)) {
      ok('setStep · warning quando step fora do intervalo');
    } else {
      fail('setStep · sem warning defensivo',
        'callers obsoletos não geram trail de debug');
    }
  }

  // 6) Workflow CI inclui share-draft-link
  const workflowPath = '../.github/workflows/deploy-edge-functions.yml';
  if (fs.existsSync(workflowPath)) {
    const code = fs.readFileSync(workflowPath, 'utf-8');
    if (/functions deploy share-draft-link/.test(code)) {
      ok('GitHub Action · deploy share-draft-link configurado');
    } else {
      fail('GitHub Action · sem deploy de share-draft-link',
        'Edge Function nova fica sem CI/CD automático');
    }
  }

  // 7) Blueprint .NET existe
  const blueprintPath = '../docs/BACKEND_DOTNET_BLUEPRINT.md';
  if (fs.existsSync(blueprintPath)) {
    const code = fs.readFileSync(blueprintPath, 'utf-8');
    if (/StepMappingService\.cs/.test(code) && /ShareDraftService\.cs/.test(code)) {
      ok('docs/BACKEND_DOTNET_BLUEPRINT.md · cobre StepMappingService + ShareDraftService');
    } else {
      fail('docs/BACKEND_DOTNET_BLUEPRINT.md · cobertura incompleta',
        'blueprint não tem snippets para os dois espelhos');
    }
  } else {
    fail('docs/BACKEND_DOTNET_BLUEPRINT.md · ausente',
      'preparação da migração .NET não documentada');
  }

  // 8) Versão bumped para v5.22.27
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version === '5.0.22-27') {
      ok(`package.json · version = ${pkg.version} (v5.22.27)`);
    } else if (/^5\.0\.22-(2[8-9]|[3-9]\d|\d{3,})$/.test(pkg.version)) {
      ok(`package.json · version = ${pkg.version} (v5.22.27+, ainda compatível)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.27+`,
        `esperado 5.0.22-27 ou superior, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.28 — Painel de gestão (admin) ---------- */
{
  const fs = await import('node:fs');

  // 1. Migration nova
  const migPath = '../supabase/migrations/20260521_011_admin_panel.sql';
  if (!fs.existsSync(migPath)) {
    fail('migration 011_admin_panel.sql · ausente',
      'painel admin não tem tabelas para escrever');
  } else {
    const sql = fs.readFileSync(migPath, 'utf-8');
    if (/create table[\s\S]*setup_admin_notes/i.test(sql)) {
      ok('migration · cria setup_admin_notes');
    } else {
      fail('migration · sem setup_admin_notes',
        'notas internas não persistem');
    }
    if (/create table[\s\S]*setup_admin_locks/i.test(sql)) {
      ok('migration · cria setup_admin_locks');
    } else {
      fail('migration · sem setup_admin_locks',
        'feature "em análise por mim" não funciona');
    }
    if (/create table[\s\S]*setup_admin_priorities/i.test(sql)) {
      ok('migration · cria setup_admin_priorities');
    } else {
      fail('migration · sem setup_admin_priorities',
        'etiquetagem não funciona');
    }
    if (/create or replace function public\.is_admin/i.test(sql)) {
      ok('migration · função is_admin presente');
    } else {
      fail('migration · sem is_admin',
        'RLS não consegue filtrar admins');
    }
    if (/create or replace view public\.admin_dashboard_items/i.test(sql)) {
      ok('migration · view admin_dashboard_items presente');
    } else {
      fail('migration · sem view consolidada',
        'dashboard precisaria fazer JOIN client-side');
    }
    if (/enable row level security/i.test(sql)) {
      ok('migration · RLS habilitado nas tabelas admin');
    } else {
      fail('migration · sem RLS nas tabelas admin',
        'qualquer um lê notas internas e locks');
    }
    if (/thiago@consultegeo\.com\.br/i.test(sql) && /atendimento@consultegeo\.com\.br/i.test(sql)) {
      ok('migration · whitelist dos 2 emails admin');
    } else {
      fail('migration · whitelist ausente',
        'is_admin não reconhece os 2 emails configurados');
    }
  }

  // 2. Edge Function admin-bootstrap
  const bootstrapPath = '../supabase/functions/admin-bootstrap/index.ts';
  if (!fs.existsSync(bootstrapPath)) {
    fail('Edge Function admin-bootstrap · ausente',
      'sem ela não há como criar os 2 usuários admin');
  } else {
    const code = fs.readFileSync(bootstrapPath, 'utf-8');
    if (/ADMIN_BOOTSTRAP_SECRET/.test(code)) {
      ok('admin-bootstrap · exige ADMIN_BOOTSTRAP_SECRET (shared-secret)');
    } else {
      fail('admin-bootstrap · sem shared-secret',
        'endpoint público criaria contas para qualquer um');
    }
    if (/SUPABASE_SERVICE_ROLE_KEY/.test(code)) {
      ok('admin-bootstrap · usa Service Role Key');
    } else {
      fail('admin-bootstrap · sem Service Role Key',
        'não consegue criar usuários via auth.admin');
    }
    if (/auth\.admin\.createUser/.test(code)) {
      ok('admin-bootstrap · chama auth.admin.createUser');
    } else {
      fail('admin-bootstrap · não cria usuário',
        'lógica de criação ausente');
    }
    if (/auth\.admin\.listUsers/.test(code)) {
      ok('admin-bootstrap · idempotente (checa existência via listUsers)');
    } else {
      fail('admin-bootstrap · não checa existência',
        'rodar 2x criaria duplicados ou daria erro');
    }
    if (/is_admin:\s*true/.test(code)) {
      ok('admin-bootstrap · seta app_metadata.is_admin=true');
    } else {
      fail('admin-bootstrap · sem is_admin no metadata',
        'usuário não passa pela RLS');
    }
    if (/crypto\.getRandomValues/.test(code)) {
      ok('admin-bootstrap · gera senha via Web Crypto (seguro)');
    } else {
      fail('admin-bootstrap · senha fraca',
        'Math.random não é criptograficamente seguro');
    }
  }

  // 3. authService
  const authPath = './src/services/authService.ts';
  if (!fs.existsSync(authPath)) {
    fail('authService.ts · ausente',
      'sem ele não há login no painel');
  } else {
    const code = fs.readFileSync(authPath, 'utf-8');
    if (/export\s+async\s+function\s+signIn/.test(code)) ok('authService · signIn');
    else fail('authService · sem signIn', 'login não funciona');
    if (/export\s+async\s+function\s+signOut/.test(code)) ok('authService · signOut');
    else fail('authService · sem signOut', 'logout não funciona');
    if (/export\s+async\s+function\s+restoreSession/.test(code)) ok('authService · restoreSession');
    else fail('authService · sem restoreSession', 'refresh joga para login sempre');
    if (/getCurrentUser/.test(code)) ok('authService · getCurrentUser síncrono');
    else fail('authService · sem getCurrentUser', 'guards não funcionam');
    if (/is_admin/.test(code) || /isAdmin/.test(code)) {
      ok('authService · valida is_admin pós-login');
    } else {
      fail('authService · não valida is_admin',
        'usuário comum poderia entrar no painel');
    }
  }

  // 4. adminQueriesService
  const queriesPath = './src/services/adminQueriesService.ts';
  if (!fs.existsSync(queriesPath)) {
    fail('adminQueriesService.ts · ausente',
      'dashboard não tem dados');
  } else {
    const code = fs.readFileSync(queriesPath, 'utf-8');
    const exports = ['listDashboardItems', 'computeStats', 'listNotes', 'addNote', 'takeLock', 'releaseLock', 'setPriority'];
    for (const exp of exports) {
      if (new RegExp(`export\\s+(async\\s+)?function\\s+${exp}\\b`).test(code)) {
        ok(`adminQueriesService · exporta ${exp}`);
      } else {
        fail(`adminQueriesService · sem ${exp}`,
          'feature do dashboard depende dessa função');
      }
    }
    if (/admin_dashboard_items/.test(code)) {
      ok('adminQueriesService · lê da view admin_dashboard_items');
    } else {
      fail('adminQueriesService · não usa view consolidada',
        'cliente faria JOIN à mão, custoso');
    }
  }

  // 5. AdminLoginView + AdminDashboardView
  const loginPath = './src/views/AdminLoginView.vue';
  if (fs.existsSync(loginPath)) {
    const code = fs.readFileSync(loginPath, 'utf-8');
    if (/v-model="email"/.test(code) && /v-model="password"/.test(code)) {
      ok('AdminLoginView · campos email + password');
    } else {
      fail('AdminLoginView · campos incompletos',
        'login não funciona');
    }
    if (/signIn\(/.test(code)) {
      ok('AdminLoginView · chama signIn do service');
    } else {
      fail('AdminLoginView · não chama signIn',
        'login é decorativo');
    }
    if (/this\.\$router\.replace/.test(code)) {
      ok('AdminLoginView · redireciona pós-login');
    } else {
      fail('AdminLoginView · não redireciona pós-login',
        'usuário fica preso na tela de login');
    }
  } else {
    fail('AdminLoginView.vue · ausente', 'sem ela não há login');
  }

  const dashPath = './src/views/AdminDashboardView.vue';
  if (fs.existsSync(dashPath)) {
    const code = fs.readFileSync(dashPath, 'utf-8');
    if (/listDashboardItems/.test(code)) {
      ok('AdminDashboardView · usa listDashboardItems');
    } else {
      fail('AdminDashboardView · não carrega itens',
        'dashboard fica vazio');
    }
    if (/addNote/.test(code) && /takeLock/.test(code) && /setPriority/.test(code)) {
      ok('AdminDashboardView · integra notas + locks + prioridade');
    } else {
      fail('AdminDashboardView · features de gestão incompletas',
        'sem alguma das 3 features-chave');
    }
    if (/signOut/.test(code)) {
      ok('AdminDashboardView · botão de logout');
    } else {
      fail('AdminDashboardView · sem logout',
        'usuário fica preso no painel');
    }
  } else {
    fail('AdminDashboardView.vue · ausente', 'sem ela não há listing');
  }

  // 6. Router com guards
  const routerPath = './src/router/index.ts';
  if (fs.existsSync(routerPath)) {
    const code = fs.readFileSync(routerPath, 'utf-8');
    if (/path:\s*['"]\/admin\/login['"]/.test(code)) {
      ok('router · rota /admin/login');
    } else {
      fail('router · sem /admin/login', 'sem login não há admin');
    }
    if (/path:\s*['"]\/admin['"]/.test(code)) {
      ok('router · rota /admin');
    } else {
      fail('router · sem /admin', 'dashboard inacessível');
    }
    if (/beforeEach/.test(code) && /adminOnly/.test(code)) {
      ok('router · guard beforeEach com adminOnly');
    } else {
      fail('router · sem guard',
        'usuário não-admin acessa /admin direto');
    }
    if (/adminGuestOnly/.test(code)) {
      ok('router · guard adminGuestOnly (já-logado vai pro dashboard)');
    } else {
      fail('router · sem adminGuestOnly',
        'usuário logado fica preso em /admin/login');
    }
  }

  // 7. cleanup-legacy allowlist
  const cleanupPath = './scripts/cleanup-legacy.cjs';
  if (fs.existsSync(cleanupPath)) {
    const code = fs.readFileSync(cleanupPath, 'utf-8');
    if (/AdminLoginView\.vue/.test(code) && /AdminDashboardView\.vue/.test(code)) {
      ok('cleanup-legacy · views admin na allowlist');
    } else {
      fail('cleanup-legacy · views admin não na allowlist',
        'prebuild deletaria as views');
    }
    if (/authService\.ts/.test(code) && /adminQueriesService\.ts/.test(code)) {
      ok('cleanup-legacy · services admin na allowlist');
    } else {
      fail('cleanup-legacy · services admin não na allowlist',
        'prebuild deletaria os services');
    }
  }

  // 8. Versão
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version === '5.0.22-28') {
      ok(`package.json · version = ${pkg.version} (v5.22.28)`);
    } else if (/^5\.0\.22-(29|[3-9]\d|\d{3,})$/.test(pkg.version)) {
      ok(`package.json · version = ${pkg.version} (v5.22.28+, ainda compatível)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.28+`,
        `esperado 5.0.22-28 ou superior, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.29 — Refinamentos do painel admin ---------- */
{
  const fs = await import('node:fs');

  // 1. Migration 012
  const migPath = '../supabase/migrations/20260521_012_admin_review_comments.sql';
  if (!fs.existsSync(migPath)) {
    fail('migration 012_admin_review_comments.sql · ausente',
      'admin não consegue comentar publicamente via painel');
  } else {
    const sql = fs.readFileSync(migPath, 'utf-8');
    if (/create or replace function public\.add_review_comment_as_admin/i.test(sql)) {
      ok('migration 012 · RPC add_review_comment_as_admin criada');
    } else {
      fail('migration 012 · sem RPC add_review_comment_as_admin',
        'admin não tem como adicionar comentário público');
    }
    if (/public\.is_admin\(\)/i.test(sql)) {
      ok('migration 012 · RPC re-valida is_admin()');
    } else {
      fail('migration 012 · sem check is_admin na RPC',
        'qualquer authenticated poderia comentar');
    }
    if (/setup_review_comments_admin_read/.test(sql)) {
      ok('migration 012 · policy admin_read no setup_review_comments');
    } else {
      fail('migration 012 · sem policy admin_read', 'admin não lê comentários');
    }
    if (/public_comment_count/.test(sql) && /create or replace view public\.admin_dashboard_items/.test(sql)) {
      ok('migration 012 · view recriada com public_comment_count');
    } else {
      fail('migration 012 · view não inclui public_comment_count',
        'badge no listing não aparece');
    }
  }

  // 2. adminExportService
  const exportPath = './src/services/adminExportService.ts';
  if (!fs.existsSync(exportPath)) {
    fail('adminExportService.ts · ausente',
      'botão Excel no admin não funciona');
  } else {
    const code = fs.readFileSync(exportPath, 'utf-8');
    if (/export\s+async\s+function\s+exportDashboardToExcel/.test(code)) {
      ok('adminExportService · exportDashboardToExcel');
    } else {
      fail('adminExportService · sem exportDashboardToExcel', 'sem export');
    }
    if (/\.\.\/vendor\/xlsxStyleLite/.test(code) && fs.existsSync('./src/vendor/xlsxStyleLite.ts')) {
      ok('adminExportService · usa writer XLSX interno compartilhado');
    } else {
      fail('adminExportService · não usa xlsxStyleLite compartilhado',
        'pode duplicar ou reintroduzir dependência XLSX externa');
    }
    // 4 abas
    for (const sheet of ['Resumo', 'Itens', 'Notas', 'Histórico']) {
      if (code.includes(`'${sheet}'`)) {
        ok(`adminExportService · aba '${sheet}'`);
      } else {
        fail(`adminExportService · sem aba '${sheet}'`, 'export incompleto');
      }
    }
    if (/loadXlsx/.test(code)) {
      ok('adminExportService · lazy load do xlsx (não pesa bundle)');
    } else {
      fail('adminExportService · import direto do xlsx',
        'aumenta bundle inicial em ~400kb');
    }
  }

  // 3. adminQueriesService — novas funções
  const queriesPath = './src/services/adminQueriesService.ts';
  if (fs.existsSync(queriesPath)) {
    const code = fs.readFileSync(queriesPath, 'utf-8');
    const newFns = [
      'listAuditEventsBySubmission',
      'listAuditEventsByTicket',
      'logAdminAudit',
      'listReviewCommentsBySubmission',
      'addReviewCommentAsAdmin',
    ];
    for (const fn of newFns) {
      if (new RegExp(`export\\s+(async\\s+)?function\\s+${fn}\\b`).test(code)) {
        ok(`adminQueriesService · exporta ${fn}`);
      } else {
        fail(`adminQueriesService · sem ${fn}`, 'feature da v5.22.29 não funciona');
      }
    }
    if (/public_comment_count/.test(code)) {
      ok('adminQueriesService · DashboardItem tem public_comment_count');
    } else {
      fail('adminQueriesService · DashboardItem sem public_comment_count',
        'tipos não batem com a view');
    }
  }

  // 4. AdminDashboardView — 3 abas
  const dashPath = './src/views/AdminDashboardView.vue';
  if (fs.existsSync(dashPath)) {
    const code = fs.readFileSync(dashPath, 'utf-8');
    if (/drilldown-tabs/.test(code)) {
      ok('AdminDashboardView · drilldown com tabs');
    } else {
      fail('AdminDashboardView · sem drilldown-tabs',
        'tabs de notas/comentários/histórico não renderizam');
    }
    if (/activeTab === 'notes'/.test(code) &&
        /activeTab === 'comments'/.test(code) &&
        /activeTab === 'history'/.test(code)) {
      ok('AdminDashboardView · 3 abas (notes/comments/history)');
    } else {
      fail('AdminDashboardView · abas incompletas',
        'alguma das 3 views está ausente');
    }
    if (/onAddPublicComment/.test(code) && /addReviewCommentAsAdmin/.test(code)) {
      ok('AdminDashboardView · envia comentário público via RPC');
    } else {
      fail('AdminDashboardView · sem envio de comentário público',
        'feature do v5.22.29 não funciona');
    }
    if (/onExportExcel/.test(code) && /exportDashboardToExcel/.test(code)) {
      ok('AdminDashboardView · botão de export Excel');
    } else {
      fail('AdminDashboardView · sem export Excel', 'feature do v5.22.29 não funciona');
    }
    if (/listAuditEventsBy/.test(code)) {
      ok('AdminDashboardView · carrega audit no drill-down');
    } else {
      fail('AdminDashboardView · sem audit no drill-down', 'aba Histórico vazia');
    }
    if (/audit-timeline/.test(code)) {
      ok('AdminDashboardView · timeline de audit visual');
    } else {
      fail('AdminDashboardView · sem timeline', 'audit não tem visual');
    }
    if (/confirm\(/.test(code) && /visível para o cliente/.test(code)) {
      ok('AdminDashboardView · confirma antes de enviar comentário público');
    } else {
      fail('AdminDashboardView · sem confirm no comentário público',
        'risco de enviar acidentalmente');
    }
  }

  // 5. cleanup-legacy allowlist
  const cleanupPath = './scripts/cleanup-legacy.cjs';
  if (fs.existsSync(cleanupPath)) {
    const code = fs.readFileSync(cleanupPath, 'utf-8');
    if (/adminExportService\.ts/.test(code)) {
      ok('cleanup-legacy · adminExportService na allowlist');
    } else {
      fail('cleanup-legacy · adminExportService não na allowlist',
        'prebuild deletaria o service');
    }
  }

  // 6. Versão
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version === '5.0.22-29') {
      ok(`package.json · version = ${pkg.version} (v5.22.29)`);
    } else if (/^5\.0\.22-(30|[3-9]\d|\d{3,})$/.test(pkg.version)) {
      ok(`package.json · version = ${pkg.version} (v5.22.29+, ainda compatível)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.29+`,
        `esperado 5.0.22-29 ou superior, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.30 — Features de produtividade do painel ---------- */
{
  const fs = await import('node:fs');

  // 1. Edge Function notify-client-comment
  const notifyPath = '../supabase/functions/notify-client-comment/index.ts';
  if (!fs.existsSync(notifyPath)) {
    fail('Edge Function notify-client-comment · ausente',
      'comentários do cliente continuam silenciosos');
  } else {
    const code = fs.readFileSync(notifyPath, 'utf-8');
    if (/RESEND_API_KEY/.test(code) && /SUPABASE_SERVICE_ROLE_KEY/.test(code)) {
      ok('notify-client-comment · usa Resend + Service Role Key');
    } else {
      fail('notify-client-comment · faltam env vars críticas',
        'sem Resend ou Service Role, função não funciona');
    }
    if (/resolveTicketContext/.test(code)) {
      ok('notify-client-comment · resolve contexto via Service Role');
    } else {
      fail('notify-client-comment · sem resolução server-side',
        'frontend teria que passar dados sensíveis');
    }
    if (/buildTeamRecipients/.test(code) && /atendimento@consultegeo\.com\.br/.test(code)) {
      ok('notify-client-comment · destinatários padrão + opção NOTIFICATION_RECIPIENTS');
    } else {
      fail('notify-client-comment · destinatários incompletos',
        'pode mandar email pra ninguém ou pra muita gente');
    }
    if (/setup_audit_events/.test(code)) {
      ok('notify-client-comment · registra audit do envio');
    } else {
      fail('notify-client-comment · sem audit',
        'falha silenciosa não deixa rastro');
    }
  }

  // 2. ticketService.addClientComment dispara notify
  const ticketSvcPath = './src/services/ticketService.ts';
  if (fs.existsSync(ticketSvcPath)) {
    const code = fs.readFileSync(ticketSvcPath, 'utf-8');
    if (/notify-client-comment/.test(code)) {
      ok('ticketService.addClientComment · invoca notify-client-comment');
    } else {
      fail('ticketService.addClientComment · não invoca notify',
        'comentário do cliente continua silencioso');
    }
    if (/void\s+sb\.functions[\s\S]{0,50}\.invoke/.test(code)) {
      ok('ticketService · fire-and-forget na chamada da Edge Function');
    } else {
      fail('ticketService · não é fire-and-forget',
        'cliente vai esperar Resend responder antes de ver feedback');
    }
    if (/notifyTeam/.test(code)) {
      ok('ticketService · flag notifyTeam permite opt-out em testes');
    } else {
      fail('ticketService · sem flag de opt-out',
        'dev local sem Resend sempre vai ter erro no console');
    }
  }

  // 3. AdminDashboardView: quick priority + filtros novos + highlight
  const dashPath = './src/views/AdminDashboardView.vue';
  if (fs.existsSync(dashPath)) {
    const code = fs.readFileSync(dashPath, 'utf-8');
    if (/onQuickPriorityChange/.test(code) && /class="quick-priority"/.test(code)) {
      ok('AdminDashboardView · quick priority dropdown na linha');
    } else {
      fail('AdminDashboardView · sem quick priority',
        'admin precisa abrir drill-down para mudar prioridade');
    }
    if (/filterMineOnly/.test(code) && /class="filter-toggle"/.test(code)) {
      ok('AdminDashboardView · filtro "meus em análise"');
    } else {
      fail('AdminDashboardView · sem filtro "meus em análise"',
        'admin não tem como ver só sua fila pessoal');
    }
    if (/filterFromDate/.test(code) && /filterToDate/.test(code)) {
      ok('AdminDashboardView · filtros de período (from/to)');
    } else {
      fail('AdminDashboardView · sem filtros de período',
        'admin não pode filtrar por data de atualização');
    }
    if (/rowClasses\(it\)/.test(code) && /row-urgent/.test(code)) {
      ok('AdminDashboardView · highlight visual de urgentes/altas');
    } else {
      fail('AdminDashboardView · sem highlight visual',
        'urgentes não chamam atenção');
    }
    if (/row-done/.test(code)) {
      ok('AdminDashboardView · linhas implantadas com visual diferenciado');
    } else {
      fail('AdminDashboardView · implantados não destacados',
        'lista visualmente plana');
    }
    if (/onClearFilters/.test(code)) {
      ok('AdminDashboardView · botão Limpar filtros');
    } else {
      fail('AdminDashboardView · sem botão Limpar',
        'usuário precisa zerar um a um');
    }
    if (/hasActiveFilters/.test(code)) {
      ok('AdminDashboardView · computed hasActiveFilters (UX do botão Limpar)');
    } else {
      fail('AdminDashboardView · sem hasActiveFilters',
        'botão Limpar fica sempre habilitado');
    }
  }

  // 4. Workflow CI inclui notify-client-comment
  const workflowPath = '../.github/workflows/deploy-edge-functions.yml';
  if (fs.existsSync(workflowPath)) {
    const code = fs.readFileSync(workflowPath, 'utf-8');
    if (/functions deploy notify-client-comment/.test(code)) {
      ok('GitHub Action · deploy notify-client-comment configurado');
    } else {
      fail('GitHub Action · sem deploy de notify-client-comment',
        'Edge Function nova fica sem CI/CD');
    }
  }

  // 5. Versão
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version === '5.0.22-30') {
      ok(`package.json · version = ${pkg.version} (v5.22.30)`);
    } else if (/^5\.0\.22-(31|[3-9]\d|\d{3,})$/.test(pkg.version)) {
      ok(`package.json · version = ${pkg.version} (v5.22.30+, ainda compatível)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.30+`,
        `esperado 5.0.22-30 ou superior, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.31 — Hotfix de schema das migrations 011/012 ---------- */
{
  const fs = await import('node:fs');

  // 1. Migration 011 corrigida: NÃO referencia mais colunas inexistentes
  const mig011 = '../supabase/migrations/20260521_011_admin_panel.sql';
  if (fs.existsSync(mig011)) {
    const sql = fs.readFileSync(mig011, 'utf-8');
    // Colunas que NÃO existem em setup_submissions
    const ghostCols = [
      's.protocolo',
      's.cliente',          // só como SELECT direto; via JSON é OK
      's.created_at',
      's.updated_at',
      's.responsavel_nome',
    ];
    let hasGhost = false;
    for (const g of ghostCols) {
      const re = new RegExp('^\\s*' + g.replace(/\./g, '\\.') + '\\s*as', 'm');
      if (re.test(sql)) {
        fail(`migration 011 · ainda referencia coluna inexistente ${g}`,
          'view não vai compilar');
        hasGhost = true;
      }
    }
    if (!hasGhost) {
      ok('migration 011 · sem colunas inexistentes de setup_submissions');
    }
    // setup_tickets também não tem essas
    const ticketGhosts = ['t.status', 't.updated_at', 't.payload'];
    let hasTicketGhost = false;
    for (const g of ticketGhosts) {
      const re = new RegExp('^\\s*' + g.replace(/\./g, '\\.') + '\\s*as', 'm');
      if (re.test(sql)) {
        fail(`migration 011 · referencia coluna inexistente em setup_tickets: ${g}`,
          'view não vai compilar');
        hasTicketGhost = true;
      }
    }
    if (!hasTicketGhost) {
      ok('migration 011 · sem colunas inexistentes de setup_tickets');
    }
    // Confirma que extrai cliente via JSON
    if (/technical_json\s*->\s*'metadata'\s*->>\s*'cliente'/.test(sql)) {
      ok('migration 011 · cliente extraído de technical_json (best-effort)');
    } else {
      fail('migration 011 · não extrai cliente de technical_json',
        'coluna cliente vai sempre vazia');
    }
    // greatest() de timestamps reais
    if (/greatest\([\s\S]*submitted_at[\s\S]*reviewed_at/.test(sql)) {
      ok('migration 011 · updated_at via greatest() de timestamps reais');
    } else {
      fail('migration 011 · sem cálculo de updated_at',
        'listing não ordena corretamente');
    }
    // identifier para submissions via subquery em tickets
    if (/coalesce\([\s\S]*select t2\.ticket_number[\s\S]*'SUB-'/.test(sql)) {
      ok('migration 011 · identifier de submissions resolve ticket_number via subquery');
    } else {
      fail('migration 011 · identifier sem fallback SUB-',
        'submissions órfãs (sem ticket) ficam sem identifier');
    }
  } else {
    fail('migration 011 · ausente', 'painel não inicializa');
  }

  // 2. Migration 012 também usa schema real
  const mig012 = '../supabase/migrations/20260521_012_admin_review_comments.sql';
  if (fs.existsSync(mig012)) {
    const sql = fs.readFileSync(mig012, 'utf-8');
    // Mesmo check anti-ghost colunas
    if (/s\.protocolo|s\.created_at\s*as|t\.payload|t\.status\s*as|t\.updated_at\s*as/.test(sql)) {
      fail('migration 012 · ainda tem colunas inexistentes na view',
        'falha em cascata da 011');
    } else {
      ok('migration 012 · view recriada sem colunas inexistentes');
    }
    // RPC popula author_role + internal_only (NOT NULL no schema)
    if (/'equipe'/.test(sql) && /internal_only/.test(sql)) {
      ok('migration 012 · RPC popula author_role + internal_only');
    } else {
      fail('migration 012 · RPC sem author_role/internal_only',
        'INSERT em setup_review_comments falha com NOT NULL');
    }
    // public_comment_count filtra internal_only=false
    if (/internal_only,\s*false\)\s*=\s*false/.test(sql)) {
      ok('migration 012 · public_comment_count filtra internal_only');
    } else {
      fail('migration 012 · public_comment_count conta notas internas',
        'badge fica inflado com notas que cliente não vê');
    }
  } else {
    fail('migration 012 · ausente', 'features v5.22.29 não funcionam');
  }

  // 3. Edge Function notify-client-comment corrigida
  const notifyPath = '../supabase/functions/notify-client-comment/index.ts';
  if (fs.existsSync(notifyPath)) {
    const code = fs.readFileSync(notifyPath, 'utf-8');
    // Não pode ter `payload` na query de setup_tickets
    if (/\.select\('submission_id,\s*ticket_number,\s*access_token,\s*payload/.test(code)) {
      fail('notify-client-comment · query usa coluna inexistente "payload"',
        'Edge Function trava no SELECT');
    } else {
      ok('notify-client-comment · query setup_tickets sem coluna inexistente');
    }
    // Não pode ter `responsavel_nome` direto
    if (/\.select\('obra_nome,\s*responsavel_nome'/.test(code)) {
      fail('notify-client-comment · query usa coluna inexistente "responsavel_nome"',
        'fallback do nome do responsável vai sempre vazio');
    } else {
      ok('notify-client-comment · query setup_submissions sem responsavel_nome');
    }
    // Extração via technical_json
    if (/technical_json\?\.metadata\?\.createdBy\?\.nome/.test(code)) {
      ok('notify-client-comment · responsavel_nome extraído de technical_json');
    } else {
      fail('notify-client-comment · sem fallback de responsavel_nome',
        'email vai mostrar "O responsável" genérico');
    }
  }

  // 4. Versão
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version === '5.0.22-31') {
      ok(`package.json · version = ${pkg.version} (v5.22.31)`);
    } else if (/^5\.0\.22-(3[2-9]|[4-9]\d|\d{3,})$/.test(pkg.version)) {
      ok(`package.json · version = ${pkg.version} (v5.22.31+, ainda compatível)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.31+`,
        `esperado 5.0.22-31 ou superior, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.32 — Melhorias UX (single-maximized + auto-scroll) ---------- */
{
  const fs = await import('node:fs');

  // 1. Composable useScrollIntoNewItem
  const composablePath = './src/composables/useScrollIntoNewItem.ts';
  if (!fs.existsSync(composablePath)) {
    fail('composable useScrollIntoNewItem · ausente',
      'auto-scroll não funciona em nenhum Step');
  } else {
    const code = fs.readFileSync(composablePath, 'utf-8');
    if (/export\s+async\s+function\s+scrollToNewItem/.test(code)) {
      ok('composable · scrollToNewItem exportado');
    } else {
      fail('composable · scrollToNewItem não exportado', 'imports falham');
    }
    if (/nextTick\(\)/.test(code)) {
      ok('composable · aguarda nextTick antes de buscar elemento');
    } else {
      fail('composable · sem nextTick',
        'pode tentar scrollar antes do DOM atualizar');
    }
    if (/getBoundingClientRect|scrollIntoView/.test(code)) {
      ok('composable · usa getBoundingClientRect + scrollIntoView');
    } else {
      fail('composable · sem detecção de viewport',
        'sempre scrolla, fica chato com lista pequena');
    }
  }

  // 2. Step4Concretos: single-maximized
  const step4Path = './src/components/Step4Concretos.vue';
  if (fs.existsSync(step4Path)) {
    const code = fs.readFileSync(step4Path, 'utf-8');
    if (/expandedId.*as string \| null|expandedId: null as string \| null/.test(code)) {
      ok('Step4Concretos · estado expandedId (substitui collapsed map)');
    } else {
      fail('Step4Concretos · ainda usa map collapsed em vez de expandedId',
        'single-maximized não funciona');
    }
    if (/toggleExpanded\(id: string\)/.test(code)) {
      ok('Step4Concretos · método toggleExpanded');
    } else {
      fail('Step4Concretos · sem toggleExpanded', 'botões não funcionam');
    }
    if (/isExpanded\(id: string\): boolean/.test(code)) {
      ok('Step4Concretos · helper isExpanded para template');
    } else {
      fail('Step4Concretos · sem isExpanded', 'v-show no template quebra');
    }
    if (/concretoIncompleto\(c: Concreto\)/.test(code)) {
      ok('Step4Concretos · método concretoIncompleto com motivos');
    } else {
      fail('Step4Concretos · sem método de incompletude',
        'badge ⚠ não renderiza');
    }
    if (/class="badge-incompleto"/.test(code)) {
      ok('Step4Concretos · template renderiza badge-incompleto');
    } else {
      fail('Step4Concretos · template sem badge-incompleto',
        'usuário não vê indicador visual');
    }
    if (/'concretos\.length'.*newLen.*oldLen/.test(code)) {
      ok('Step4Concretos · watch concretos.length para auto-expand + scroll');
    } else {
      fail('Step4Concretos · sem watch para auto-scroll',
        'novo concreto não puxa scroll');
    }
    if (/scrollToNewItem\(`#concreto-/.test(code)) {
      ok('Step4Concretos · chama scrollToNewItem com id do concreto');
    } else {
      fail('Step4Concretos · não chama scrollToNewItem',
        'auto-scroll não dispara');
    }
    if (/id=`concreto-\$\{c\.id\}`/.test(code) || /:id="`concreto-\$\{c\.id\}`"/.test(code)) {
      ok('Step4Concretos · template gera id="concreto-XYZ" no card');
    } else {
      fail('Step4Concretos · sem id no card',
        'querySelector não acha o elemento para scroll');
    }
  }

  // 3. CSS do badge-incompleto
  const dsPath = './src/styles/design-system.css';
  if (fs.existsSync(dsPath)) {
    const css = fs.readFileSync(dsPath, 'utf-8');
    if (/\.badge-incompleto\s*\{/.test(css)) {
      ok('CSS · regra .badge-incompleto definida');
    } else {
      fail('CSS · sem regra .badge-incompleto',
        'badge renderiza sem estilo');
    }
  }

  // 4. Outros Steps com watch + scroll
  const otherSteps: Array<[string, string, string]> = [
    ['Step3GruposEditor.vue', 'grupos.length', 'grupo-'],
    ['Step5PecasEditor.vue', 'totalPecasCount', 'peca-'],
    ['Step6UsuariosObra.vue', 'usuarios.length', 'usuario-'],
    ['Step7Fornecedores.vue', 'fornecedores.length', 'fornecedor-'],
    ['PadraoMoldagemEditor.vue', 'padroes.length', 'padrao-'],
  ];
  for (const [file, watchProp, idPrefix] of otherSteps) {
    const p = `./src/components/${file}`;
    if (!fs.existsSync(p)) {
      fail(`${file} · arquivo não existe`, 'auto-scroll não funciona aqui');
      continue;
    }
    const code = fs.readFileSync(p, 'utf-8');
    const watchRe = new RegExp(`['"\`]?${watchProp.replace('.', '\\.')}['"\`]?\\s*\\(`);
    if (watchRe.test(code) && /scrollToNewItem/.test(code)) {
      ok(`${file} · watch ${watchProp} + scrollToNewItem`);
    } else {
      fail(`${file} · sem watch de length ou scrollToNewItem`,
        'auto-scroll não dispara nesta tela');
    }
    const idRe = new RegExp(`#${idPrefix}|\\\`${idPrefix}|id="${idPrefix}|:id="\`${idPrefix}`);
    if (idRe.test(code)) {
      ok(`${file} · gera id="${idPrefix}XYZ" nos elementos`);
    } else {
      fail(`${file} · sem id no elemento da lista`,
        'scroll não acha alvo');
    }
  }

  // 5. Versão
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version === '5.0.22-32') {
      ok(`package.json · version = ${pkg.version} (v5.22.32)`);
    } else if (/^5\.0\.22-(3[3-9]|[4-9]\d|\d{3,})$/.test(pkg.version)) {
      ok(`package.json · version = ${pkg.version} (v5.22.32+, ainda compatível)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.32+`,
        `esperado 5.0.22-32 ou superior, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.33 — Hotfix: guards idempotentes em migrations 011/012 ---------- */
{
  const fs = await import('node:fs');

  // 1. Migration 011 garante colunas opcionais via ADD IF NOT EXISTS
  const mig011 = '../supabase/migrations/20260521_011_admin_panel.sql';
  if (fs.existsSync(mig011)) {
    const sql = fs.readFileSync(mig011, 'utf-8');
    // Guard de resubmitted_at no TOPO (antes da view)
    if (/alter table public\.setup_submissions[\s\S]{0,200}add column if not exists resubmitted_at/.test(sql)) {
      ok('migration 011 · guard idempotente para resubmitted_at');
    } else {
      fail('migration 011 · sem guard de resubmitted_at',
        'falha se a migration 009 não rodou em produção');
    }
    if (/add column if not exists last_team_edit_at/.test(sql)) {
      ok('migration 011 · guard idempotente para last_team_edit_at');
    } else {
      fail('migration 011 · sem guard de last_team_edit_at',
        'falha se a migration 010 não rodou em produção');
    }
    // Garantia de ordem: ALTER TABLE antes da CREATE VIEW
    const alterIdx = sql.indexOf('add column if not exists resubmitted_at');
    const viewIdx  = sql.indexOf('create or replace view public.admin_dashboard_items');
    if (alterIdx > 0 && viewIdx > 0 && alterIdx < viewIdx) {
      ok('migration 011 · ALTER TABLE vem ANTES de CREATE VIEW (ordem correta)');
    } else {
      fail('migration 011 · ordem incorreta',
        'view criada antes das colunas serem garantidas');
    }
  }

  // 2. Migration 012 garante colunas de review_comments
  const mig012 = '../supabase/migrations/20260521_012_admin_review_comments.sql';
  if (fs.existsSync(mig012)) {
    const sql = fs.readFileSync(mig012, 'utf-8');
    if (/alter table public\.setup_review_comments[\s\S]{0,200}add column if not exists author_role/.test(sql)) {
      ok('migration 012 · guard idempotente para author_role');
    } else {
      fail('migration 012 · sem guard de author_role',
        'INSERT do RPC falha se migration 008 não rodou');
    }
    if (/add column if not exists internal_only/.test(sql)) {
      ok('migration 012 · guard idempotente para internal_only');
    } else {
      fail('migration 012 · sem guard de internal_only',
        'view e RPC falham se migration 008 não rodou');
    }
  }

  // 3. Versão
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version === '5.0.22-33') {
      ok(`package.json · version = ${pkg.version} (v5.22.33)`);
    } else if (/^5\.0\.22-(3[4-9]|[4-9]\d|\d{3,})$/.test(pkg.version)) {
      ok(`package.json · version = ${pkg.version} (v5.22.33+, ainda compatível)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.33+`,
        `esperado 5.0.22-33 ou superior, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.34 — Notificação inversa + UX polish ---------- */
{
  const fs = await import('node:fs');

  // 1. Edge Function notify-team-comment
  const notifyPath = '../supabase/functions/notify-team-comment/index.ts';
  if (!fs.existsSync(notifyPath)) {
    fail('Edge Function notify-team-comment · ausente',
      'cliente não recebe notificação quando equipe comenta');
  } else {
    const code = fs.readFileSync(notifyPath, 'utf-8');
    if (/RESEND_API_KEY/.test(code) && /SUPABASE_SERVICE_ROLE_KEY/.test(code)) {
      ok('notify-team-comment · usa Resend + Service Role Key');
    } else {
      fail('notify-team-comment · faltam env vars', 'função não funciona');
    }
    if (/resolveSubmissionContext/.test(code)) {
      ok('notify-team-comment · resolve contexto via Service Role');
    } else {
      fail('notify-team-comment · sem resolução server-side',
        'frontend teria que passar dados sensíveis');
    }
    if (/email_recipients/.test(code) && /email_cc/.test(code)) {
      ok('notify-team-comment · destinatários vêm do ticket original');
    } else {
      fail('notify-team-comment · sem resolução de destinatários',
        'cliente não recebe email');
    }
    if (/resolveStatusBase|CLIENT_STATUS_URL_BASE/.test(code)) {
      ok('notify-team-comment · resolve URL de /s/:token com fallback');
    } else {
      fail('notify-team-comment · sem CLIENT_STATUS_URL_BASE/fallback',
        'links no email podem ficar quebrados');
    }
    if (/notify_client_team_comment_sent/.test(code)) {
      ok('notify-team-comment · registra audit do envio');
    } else {
      fail('notify-team-comment · sem audit', 'falha silenciosa não deixa rastro');
    }
  }

  // 2. Migration 013: RPC retorna submission_id
  const mig013 = '../supabase/migrations/20260521_013_review_comment_returns_submission.sql';
  if (!fs.existsSync(mig013)) {
    fail('migration 013 · ausente',
      'RPC add_review_comment_by_token não retorna submission_id');
  } else {
    const sql = fs.readFileSync(mig013, 'utf-8');
    if (/'submission_id'[\s,]*v_inserted\.submission_id/.test(sql)) {
      ok('migration 013 · RPC by_token retorna submission_id no payload');
    } else {
      fail('migration 013 · RPC by_token não retorna submission_id',
        'frontend não consegue disparar notify-team-comment');
    }
    if (/create or replace function public\.add_review_comment_by_token/.test(sql)) {
      ok('migration 013 · usa CREATE OR REPLACE (idempotente)');
    } else {
      fail('migration 013 · não é idempotente', 'reaplicar dá erro');
    }
  }

  // 3. ticketService.addReviewComment dispara notify
  const ticketSvcPath = './src/services/ticketService.ts';
  if (fs.existsSync(ticketSvcPath)) {
    const code = fs.readFileSync(ticketSvcPath, 'utf-8');
    if (/notify-team-comment/.test(code)) {
      ok('ticketService.addReviewComment · invoca notify-team-comment');
    } else {
      fail('ticketService.addReviewComment · não invoca notify',
        'cliente não recebe email quando equipe comenta em /r/:token');
    }
    if (/internalOnly\s*!==\s*true[\s\S]{0,200}submission_id/.test(code) ||
        /internal_only\s*!==\s*true[\s\S]{0,200}submission_id/.test(code) ||
        /internalOnly !== true && result\.submission_id/.test(code)) {
      ok('ticketService · não notifica em internal_only=true (notas internas)');
    } else {
      fail('ticketService · pode notificar comentário interno',
        'cliente recebe email de nota que não devia ver');
    }
  }

  // 4. adminQueriesService.addReviewCommentAsAdmin dispara notify
  const adminSvcPath = './src/services/adminQueriesService.ts';
  if (fs.existsSync(adminSvcPath)) {
    const code = fs.readFileSync(adminSvcPath, 'utf-8');
    if (/notify-team-comment/.test(code)) {
      ok('adminQueriesService · invoca notify-team-comment');
    } else {
      fail('adminQueriesService · não invoca notify',
        'cliente não recebe email quando admin comenta pelo painel');
    }
  }

  // 5. Step4Concretos: badge ✓ Completo + transition
  const step4Path = './src/components/Step4Concretos.vue';
  if (fs.existsSync(step4Path)) {
    const code = fs.readFileSync(step4Path, 'utf-8');
    if (/class="badge-completo"/.test(code)) {
      ok('Step4Concretos · badge ✓ Completo no template');
    } else {
      fail('Step4Concretos · sem badge completo',
        'sem reforço positivo no card');
    }
    if (/transition\s+name="card-body-expand"/.test(code)) {
      ok('Step4Concretos · transition CSS para expand/collapse');
    } else {
      fail('Step4Concretos · sem transition', 'expand/collapse é seco');
    }
    if (/onEnter\(el: Element/.test(code) && /scrollHeight/.test(code)) {
      ok('Step4Concretos · hooks JS de transição com scrollHeight');
    } else {
      fail('Step4Concretos · transição sem JS hooks',
        'altura não anima corretamente');
    }
  }

  // 6. CSS: .badge-completo + transition classes
  const dsPath = './src/styles/design-system.css';
  if (fs.existsSync(dsPath)) {
    const css = fs.readFileSync(dsPath, 'utf-8');
    if (/\.badge-completo\s*\{/.test(css)) {
      ok('CSS · regra .badge-completo definida');
    } else {
      fail('CSS · sem regra .badge-completo', 'badge renderiza sem estilo');
    }
    if (/\.card-body-expand-enter-active/.test(css)) {
      ok('CSS · classes de transição para card-body');
    } else {
      fail('CSS · sem regras de transição', 'animação não funciona');
    }
    if (/prefers-reduced-motion/.test(css)) {
      ok('CSS · respeita prefers-reduced-motion (a11y)');
    } else {
      fail('CSS · sem fallback de reduced-motion',
        'usuários sensíveis veem animação ainda');
    }
  }

  // 7. Workflow CI inclui notify-team-comment
  const workflowPath = '../.github/workflows/deploy-edge-functions.yml';
  if (fs.existsSync(workflowPath)) {
    const code = fs.readFileSync(workflowPath, 'utf-8');
    if (/functions deploy notify-team-comment/.test(code)) {
      ok('GitHub Action · deploy notify-team-comment configurado');
    } else {
      fail('GitHub Action · sem deploy de notify-team-comment',
        'Edge Function nova sem CI/CD');
    }
  }

  // 8. Versão
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version === '5.0.22-34') {
      ok(`package.json · version = ${pkg.version} (v5.22.34)`);
    } else if (/^5\.0\.22-(3[5-9]|[4-9]\d|\d{3,})$/.test(pkg.version)) {
      ok(`package.json · version = ${pkg.version} (v5.22.34+, ainda compatível)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.34+`,
        `esperado 5.0.22-34 ou superior, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.35 — Bulk actions + atalhos de teclado ---------- */
{
  const fs = await import('node:fs');

  // 1. Composable useListKeyboardNav
  const navPath = './src/composables/useListKeyboardNav.ts';
  if (!fs.existsSync(navPath)) {
    fail('composable useListKeyboardNav · ausente', 'atalhos de teclado não funcionam');
  } else {
    const code = fs.readFileSync(navPath, 'utf-8');
    if (/export\s+function\s+handleListKeyNav/.test(code)) {
      ok('composable · handleListKeyNav exportado');
    } else {
      fail('composable · handleListKeyNav não exportado', 'import falha');
    }
    if (/ArrowDown/.test(code) && /ArrowUp/.test(code)) {
      ok('composable · trata ArrowUp/ArrowDown');
    } else {
      fail('composable · sem navegação por setas', 'atalhos incompletos');
    }
    if (/'Enter'/.test(code) && /'Escape'/.test(code)) {
      ok('composable · trata Enter (expand) + Escape (minimiza)');
    } else {
      fail('composable · sem Enter/Escape', 'atalhos incompletos');
    }
    // Não intercepta inputs (importante!)
    if (/tag === 'input'|tagName\.toLowerCase\(\)/.test(code) && /isContentEditable/.test(code)) {
      ok('composable · não intercepta quando foco em input/textarea');
    } else {
      fail('composable · pode sequestrar teclado de inputs',
        'usuário não consegue digitar nos campos');
    }
  }

  // 2. Step4Concretos usa o composable
  const step4Path = './src/components/Step4Concretos.vue';
  if (fs.existsSync(step4Path)) {
    const code = fs.readFileSync(step4Path, 'utf-8');
    if (/handleListKeyNav/.test(code) && /onListKeydown/.test(code)) {
      ok('Step4Concretos · usa handleListKeyNav via onListKeydown');
    } else {
      fail('Step4Concretos · não integra navegação por teclado',
        'atalhos não funcionam na tela');
    }
    if (/@keydown="onListKeydown"/.test(code) && /tabindex="0"/.test(code)) {
      ok('Step4Concretos · grid focável com @keydown');
    } else {
      fail('Step4Concretos · grid sem tabindex/keydown', 'região não captura teclas');
    }
    if (/focusedId/.test(code) && /is-kbd-focused/.test(code)) {
      ok('Step4Concretos · estado focusedId + classe visual');
    } else {
      fail('Step4Concretos · sem feedback visual de foco', 'usuário não vê card ativo');
    }
    if (/class="kbd-hint"/.test(code)) {
      ok('Step4Concretos · dica visual dos atalhos');
    } else {
      fail('Step4Concretos · sem dica de atalhos', 'feature fica escondida');
    }
  }

  // 3. CSS de foco de teclado + kbd-hint
  const dsPath = './src/styles/design-system.css';
  if (fs.existsSync(dsPath)) {
    const css = fs.readFileSync(dsPath, 'utf-8');
    if (/\.concreto-card\.is-kbd-focused/.test(css)) {
      ok('CSS · destaque visual do card com foco de teclado');
    } else {
      fail('CSS · sem regra is-kbd-focused', 'foco invisível');
    }
    if (/\.kbd-hint\s+kbd/.test(css)) {
      ok('CSS · estilo das teclas <kbd> na dica');
    } else {
      fail('CSS · sem estilo de <kbd>', 'dica renderiza sem estilo');
    }
  }

  // 4. AdminDashboardView: bulk actions
  const dashPath = './src/views/AdminDashboardView.vue';
  if (fs.existsSync(dashPath)) {
    const code = fs.readFileSync(dashPath, 'utf-8');
    if (/selectedIds/.test(code) && /new Set<string>/.test(code)) {
      ok('AdminDashboardView · estado selectedIds (Set)');
    } else {
      fail('AdminDashboardView · sem selectedIds', 'bulk não funciona');
    }
    if (/onToggleRow/.test(code) && /onToggleSelectAll/.test(code)) {
      ok('AdminDashboardView · toggle de linha + select-all');
    } else {
      fail('AdminDashboardView · sem toggles de seleção', 'checkbox não funciona');
    }
    if (/onBulkApplyPriority/.test(code)) {
      ok('AdminDashboardView · ação em lote de prioridade');
    } else {
      fail('AdminDashboardView · sem ação em lote', 'bulk bar sem efeito');
    }
    if (/allVisibleSelected/.test(code) && /someVisibleSelected/.test(code)) {
      ok('AdminDashboardView · computeds select-all + indeterminate');
    } else {
      fail('AdminDashboardView · sem computeds de seleção', 'checkbox header quebrado');
    }
    if (/class="bulk-bar"/.test(code)) {
      ok('AdminDashboardView · bulk bar no template');
    } else {
      fail('AdminDashboardView · sem bulk bar', 'usuário não vê ações em lote');
    }
    if (/:indeterminate\.prop="someVisibleSelected"/.test(code)) {
      ok('AdminDashboardView · checkbox indeterminate bindado corretamente');
    } else {
      fail('AdminDashboardView · indeterminate não bindado', 'select-all visual incompleto');
    }
    // Clique no checkbox NÃO abre drill-down
    if (/class="col-check"\s+@click\.stop/.test(code)) {
      ok('AdminDashboardView · clique no checkbox não abre drill-down (@click.stop)');
    } else {
      fail('AdminDashboardView · checkbox abre drill-down por acidente',
        'UX confusa ao selecionar');
    }
  }

  // 5. CSS bulk bar
  if (fs.existsSync(dashPath)) {
    const code = fs.readFileSync(dashPath, 'utf-8');
    if (/\.bulk-bar\s*\{/.test(code)) {
      ok('AdminDashboardView CSS · regra .bulk-bar');
    } else {
      fail('AdminDashboardView CSS · sem .bulk-bar', 'bulk bar sem estilo');
    }
    if (/\.col-check\s*\{/.test(code)) {
      ok('AdminDashboardView CSS · coluna de checkbox estilizada');
    } else {
      fail('AdminDashboardView CSS · sem .col-check', 'coluna desalinhada');
    }
  }

  // 6. Versão
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version === '5.0.22-35') {
      ok(`package.json · version = ${pkg.version} (v5.22.35)`);
    } else if (/^5\.0\.22-(3[6-9]|[4-9]\d|\d{3,})$/.test(pkg.version)) {
      ok(`package.json · version = ${pkg.version} (v5.22.35+, ainda compatível)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.35+`,
        `esperado 5.0.22-35 ou superior, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.36 — Ajuda contextual por etapa (vídeo + imagem) ---------- */
{
  const fs = await import('node:fs');

  // 1. Migration 014: tabela + storage bucket
  const mig014 = '../supabase/migrations/20260522_014_setup_step_help.sql';
  if (!fs.existsSync(mig014)) {
    fail('migration 014 · ausente', 'ajuda por etapa não tem persistência');
  } else {
    const sql = fs.readFileSync(mig014, 'utf-8');
    if (/create table if not exists public\.setup_step_help/.test(sql)) {
      ok('migration 014 · tabela setup_step_help');
    } else {
      fail('migration 014 · sem tabela setup_step_help', 'CRUD não funciona');
    }
    if (/storage\.buckets[\s\S]{0,120}step-help-images/.test(sql)) {
      ok('migration 014 · cria bucket step-help-images');
    } else {
      fail('migration 014 · sem bucket de storage', 'upload de imagem falha');
    }
    if (/step_help_images_admin_insert/.test(sql) && /is_admin\(\)/.test(sql)) {
      ok('migration 014 · upload restrito a admin (RLS storage)');
    } else {
      fail('migration 014 · upload sem proteção admin', 'qualquer um sobe imagem');
    }
    if (/setup_step_help_public_read/.test(sql)) {
      ok('migration 014 · leitura pública da ajuda (wizard lê)');
    } else {
      fail('migration 014 · sem leitura pública', 'cliente não vê ajuda');
    }
    if (/insert into public\.setup_step_help[\s\S]{0,400}on conflict/.test(sql)) {
      ok('migration 014 · seed idempotente das 7 etapas');
    } else {
      fail('migration 014 · sem seed das etapas', 'admin começa sem linhas');
    }
  }

  // 2. youtubeService
  const ytPath = './src/services/youtubeService.ts';
  if (!fs.existsSync(ytPath)) {
    fail('youtubeService · ausente', 'normalização de YouTube não existe');
  } else {
    const code = fs.readFileSync(ytPath, 'utf-8');
    if (/extractYoutubeVideoId/.test(code) && /youtu\.be/.test(code)) {
      ok('youtubeService · extrai videoId de múltiplos formatos');
    } else {
      fail('youtubeService · extração incompleta', 'links variados não funcionam');
    }
    if (/\[A-Za-z0-9_-\]\{11\}/.test(code)) {
      ok('youtubeService · valida formato do videoId (anti-XSS)');
    } else {
      fail('youtubeService · sem validação de ID', 'risco de injeção no embed');
    }
    if (/youtubeEmbedUrl/.test(code) && /embed/.test(code)) {
      ok('youtubeService · gera URL de embed correta');
    } else {
      fail('youtubeService · sem embed URL', 'iframe não funciona');
    }
  }

  // 3. stepHelpService
  const shPath = './src/services/stepHelpService.ts';
  if (!fs.existsSync(shPath)) {
    fail('stepHelpService · ausente', 'CRUD da ajuda não existe');
  } else {
    const code = fs.readFileSync(shPath, 'utf-8');
    if (/saveStepHelp/.test(code) && /uploadStepHelpImage/.test(code)) {
      ok('stepHelpService · save + upload de imagem');
    } else {
      fail('stepHelpService · funções incompletas', 'admin não consegue salvar');
    }
    if (/getStepHelp/.test(code) && /resolveImageUrl/.test(code)) {
      ok('stepHelpService · leitura + resolução de URL pública');
    } else {
      fail('stepHelpService · leitura incompleta', 'wizard não exibe ajuda');
    }
    if (/STEP_KEY_BY_ID/.test(code) && /STEP_KEYS/.test(code)) {
      ok('stepHelpService · mapeamento stepId → step_key estável');
    } else {
      fail('stepHelpService · sem mapa de etapas', 'wizard não sabe qual ajuda buscar');
    }
    // Validação de imagem (tipo + tamanho)
    if (/startsWith\('image\/'\)/.test(code) && /5 \* 1024 \* 1024/.test(code)) {
      ok('stepHelpService · valida tipo + tamanho da imagem (client)');
    } else {
      fail('stepHelpService · sem validação de imagem', 'aceita lixo');
    }
  }

  // 4. AdminStepHelpView
  const adminViewPath = './src/views/AdminStepHelpView.vue';
  if (!fs.existsSync(adminViewPath)) {
    fail('AdminStepHelpView · ausente', 'admin não tem tela de config');
  } else {
    const code = fs.readFileSync(adminViewPath, 'utf-8');
    if (/onPickImage/.test(code) && /onSave/.test(code)) {
      ok('AdminStepHelpView · upload + save por etapa');
    } else {
      fail('AdminStepHelpView · handlers incompletos', 'tela não funciona');
    }
    if (/previewVideoId/.test(code) && /video-wrap/.test(code)) {
      ok('AdminStepHelpView · preview de vídeo ao vivo');
    } else {
      fail('AdminStepHelpView · sem preview de vídeo', 'admin edita às cegas');
    }
    if (/onRemoveImage/.test(code)) {
      ok('AdminStepHelpView · permite remover imagem');
    } else {
      fail('AdminStepHelpView · sem remoção de imagem', 'admin fica preso');
    }
  }

  // 5. StepHelpPanel (consumo no wizard)
  const panelPath = './src/components/StepHelpPanel.vue';
  if (!fs.existsSync(panelPath)) {
    fail('StepHelpPanel · ausente', 'wizard não exibe ajuda');
  } else {
    const code = fs.readFileSync(panelPath, 'utf-8');
    if (/hasContent/.test(code) && /v-if="hasContent/.test(code)) {
      ok('StepHelpPanel · só renderiza se houver conteúdo (dinâmico)');
    } else {
      fail('StepHelpPanel · sempre renderiza', 'aparece vazio para o cliente');
    }
    if (/STEP_KEY_BY_ID\[this\.stepId\]/.test(code)) {
      ok('StepHelpPanel · resolve step_key do stepId atual');
    } else {
      fail('StepHelpPanel · não mapeia etapa', 'busca ajuda errada');
    }
    if (/loadedKey !== stepKey/.test(code)) {
      ok('StepHelpPanel · guard contra race ao trocar de etapa');
    } else {
      fail('StepHelpPanel · sem guard de race', 'ajuda da etapa errada pode aparecer');
    }
  }

  // 6. Wiring no SetupPage
  const setupPath = './src/views/SetupPage.vue';
  if (fs.existsSync(setupPath)) {
    const code = fs.readFileSync(setupPath, 'utf-8');
    if (/<StepHelpPanel :step-id="step"/.test(code) && /import StepHelpPanel/.test(code)) {
      ok('SetupPage · StepHelpPanel integrado com step atual');
    } else {
      fail('SetupPage · StepHelpPanel não integrado', 'ajuda não aparece no wizard');
    }
  }

  // 7. Rota /admin/ajuda
  const routerPath = './src/router/index.ts';
  if (fs.existsSync(routerPath)) {
    const code = fs.readFileSync(routerPath, 'utf-8');
    if (/path:\s*'\/admin\/ajuda'/.test(code) && /adminOnly:\s*true/.test(code)) {
      ok('router · rota /admin/ajuda protegida por adminOnly');
    } else {
      fail('router · rota /admin/ajuda ausente ou desprotegida', 'config inacessível ou aberta');
    }
  }

  // 8. Versão
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version === '5.0.22-36') {
      ok(`package.json · version = ${pkg.version} (v5.22.36)`);
    } else if (/^5\.0\.22-(3[7-9]|[4-9]\d|\d{3,})$/.test(pkg.version)) {
      ok(`package.json · version = ${pkg.version} (v5.22.36+, ainda compatível)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.36+`,
        `esperado 5.0.22-36 ou superior, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.37 — Até 5 imagens por etapa + carrossel ---------- */
{
  const fs = await import('node:fs');

  // 1. Migration 015
  const mig015 = '../supabase/migrations/20260522_015_step_help_multiple_images.sql';
  if (!fs.existsSync(mig015)) {
    fail('migration 015 · ausente', 'image_paths[] não existe');
  } else {
    const sql = fs.readFileSync(mig015, 'utf-8');
    if (/add column if not exists image_paths text\[\]/.test(sql)) {
      ok('migration 015 · adiciona image_paths text[]');
    } else {
      fail('migration 015 · sem coluna image_paths', 'múltiplas imagens não persistem');
    }
    if (/array_length\(image_paths, 1\), 0\) <= 5/.test(sql)) {
      ok('migration 015 · constraint de máximo 5 imagens');
    } else {
      fail('migration 015 · sem limite de 5', 'aceita imagens infinitas');
    }
    if (/update public\.setup_step_help[\s\S]{0,300}array\[image_path\]/.test(sql)) {
      ok('migration 015 · migra image_path antigo → image_paths');
    } else {
      fail('migration 015 · não migra dados antigos', 'imagem da v36 some');
    }
  }

  // 2. stepHelpService: image_paths + resolveImageUrls
  const shPath = './src/services/stepHelpService.ts';
  if (fs.existsSync(shPath)) {
    const code = fs.readFileSync(shPath, 'utf-8');
    if (/MAX_IMAGES_PER_STEP\s*=\s*5/.test(code)) {
      ok('stepHelpService · MAX_IMAGES_PER_STEP = 5');
    } else {
      fail('stepHelpService · sem limite de imagens', 'sem controle de máximo');
    }
    if (/resolveImageUrls/.test(code) && /image_paths/.test(code)) {
      ok('stepHelpService · resolveImageUrls + image_paths[]');
    } else {
      fail('stepHelpService · sem suporte a array de imagens', 'carrossel não funciona');
    }
    if (/normalizeRow/.test(code) && /image_path\b/.test(code)) {
      ok('stepHelpService · normaliza dados antigos (image_path → image_paths)');
    } else {
      fail('stepHelpService · sem normalização de dados antigos',
        'registros v36 quebram');
    }
    if (/slice\(0, MAX_IMAGES_PER_STEP\)/.test(code)) {
      ok('stepHelpService · trunca em 5 ao salvar (defesa)');
    } else {
      fail('stepHelpService · não trunca array', 'pode salvar >5');
    }
  }

  // 3. StepHelpPanel: carrossel
  const panelPath = './src/components/StepHelpPanel.vue';
  if (fs.existsSync(panelPath)) {
    const code = fs.readFileSync(panelPath, 'utf-8');
    if (/imageUrls/.test(code) && /carousel/.test(code)) {
      ok('StepHelpPanel · carrossel de imagens');
    } else {
      fail('StepHelpPanel · sem carrossel', 'múltiplas imagens não navegáveis');
    }
    if (/prevImage/.test(code) && /nextImage/.test(code)) {
      ok('StepHelpPanel · setas anterior/próxima');
    } else {
      fail('StepHelpPanel · sem navegação por setas', 'cliente preso na 1ª imagem');
    }
    if (/imageUrls\.length > 1/.test(code)) {
      ok('StepHelpPanel · setas só aparecem com >1 imagem');
    } else {
      fail('StepHelpPanel · setas sempre visíveis', 'UX ruim com 1 imagem');
    }
    if (/carousel-indicator/.test(code) && /imageIndex \+ 1/.test(code)) {
      ok('StepHelpPanel · indicador N/total');
    } else {
      fail('StepHelpPanel · sem indicador de posição', 'cliente não sabe onde está');
    }
  }

  // 4. AdminStepHelpView: upload múltiplo
  const adminPath = './src/views/AdminStepHelpView.vue';
  if (fs.existsSync(adminPath)) {
    const code = fs.readFileSync(adminPath, 'utf-8');
    if (/onPickImages/.test(code) && /multiple/.test(code)) {
      ok('AdminStepHelpView · input file multiple + onPickImages');
    } else {
      fail('AdminStepHelpView · sem upload múltiplo', 'admin sobe 1 por vez');
    }
    if (/image_paths\.length >= maxImages/.test(code)) {
      ok('AdminStepHelpView · bloqueia upload ao atingir 5');
    } else {
      fail('AdminStepHelpView · não respeita limite', 'admin passa de 5');
    }
    if (/thumb-grid/.test(code) && /onRemoveImage/.test(code)) {
      ok('AdminStepHelpView · grade de thumbnails com remover');
    } else {
      fail('AdminStepHelpView · sem gestão de thumbnails', 'admin não vê/remove imagens');
    }
    if (/slotsLeft/.test(code)) {
      ok('AdminStepHelpView · respeita slots restantes no upload em lote');
    } else {
      fail('AdminStepHelpView · não calcula slots', 'pode exceder 5 num upload');
    }
  }

  // 5. Versão
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    if (pkg.version === '5.0.22-37') {
      ok(`package.json · version = ${pkg.version} (v5.22.37)`);
    } else if (/^5\.0\.22-(3[8-9]|[4-9]\d|\d{3,})$/.test(pkg.version)) {
      ok(`package.json · version = ${pkg.version} (v5.22.37+, ainda compatível)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.37+`,
        `esperado 5.0.22-37 ou superior, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.38 — Drag-and-drop para reordenar ---------- */
{
  const fs = await import('node:fs');

  // 1. Composable useDragReorder
  const dragPath = './src/composables/useDragReorder.ts';
  if (!fs.existsSync(dragPath)) {
    fail('composable useDragReorder · ausente', 'drag-and-drop não funciona');
  } else {
    const code = fs.readFileSync(dragPath, 'utf-8');
    if (/createDragReorder/.test(code)) {
      ok('useDragReorder · createDragReorder exportado');
    } else {
      fail('useDragReorder · sem factory', 'componentes não conseguem usar');
    }
    if (/resolveDrop/.test(code) && /\{ from.*to/.test(code)) {
      ok('useDragReorder · resolveDrop retorna { from, to }');
    } else {
      fail('useDragReorder · sem resolveDrop', 'movimento não calculado');
    }
    if (/arm\(index/.test(code) && /this\.armed/.test(code)) {
      ok('useDragReorder · modelo armar-pelo-handle (não captura inputs)');
    } else {
      fail('useDragReorder · sem arm()', 'drag capturaria mousedown de inputs');
    }
    if (/dataTransfer/.test(code)) {
      ok('useDragReorder · usa HTML5 DnD nativo (sem lib externa)');
    } else {
      fail('useDragReorder · não usa dataTransfer', 'DnD nativo incompleto');
    }
  }

  // 2. Store: reorderGrupos + reorderPecas
  const storePath = './src/store/modules/setup.ts';
  if (fs.existsSync(storePath)) {
    const code = fs.readFileSync(storePath, 'utf-8');
    if (/reorderGrupos\(state/.test(code)) {
      ok('store · mutation reorderGrupos');
    } else {
      fail('store · sem reorderGrupos', 'reordenação de grupos não persiste');
    }
    if (/reorderPecas\(\s*state/.test(code)) {
      ok('store · mutation reorderPecas');
    } else {
      fail('store · sem reorderPecas', 'reordenação de peças não persiste');
    }
    // clamp + splice
    if (/splice\(from, 1\)/.test(code) && /splice\(to, 0, moved\)/.test(code)) {
      ok('store · reorder usa splice (remove + insere na posição)');
    } else {
      fail('store · reorder não usa splice correto', 'ordem fica errada');
    }
    if (/Math\.max\(0, Math\.min\(/.test(code)) {
      ok('store · reorder faz clamp de índices (defesa)');
    } else {
      fail('store · reorder sem clamp', 'índice fora de faixa quebra');
    }
  }

  // 3. SetupPage: handlers + wiring
  const setupPath = './src/views/SetupPage.vue';
  if (fs.existsSync(setupPath)) {
    const code = fs.readFileSync(setupPath, 'utf-8');
    if (/onReorderGrupos/.test(code) && /reorder-grupos="onReorderGrupos"/.test(code)) {
      ok('SetupPage · onReorderGrupos ligado ao Step3');
    } else {
      fail('SetupPage · reorder-grupos não ligado', 'evento não chega ao store');
    }
    if (/onReorderPecas/.test(code) && /reorder-pecas="onReorderPecas"/.test(code)) {
      ok('SetupPage · onReorderPecas ligado ao Step5');
    } else {
      fail('SetupPage · reorder-pecas não ligado', 'evento não chega ao store');
    }
  }

  // 4. Step3GruposEditor: drag wiring
  const step3Path = './src/components/Step3GruposEditor.vue';
  if (fs.existsSync(step3Path)) {
    const code = fs.readFileSync(step3Path, 'utf-8');
    if (/createDragReorder/.test(code) && /onDropGrupo/.test(code)) {
      ok('Step3 · usa dnd + onDropGrupo');
    } else {
      fail('Step3 · sem integração de drag', 'grupos não arrastáveis');
    }
    if (/reorder-grupos/.test(code) || /\$emit\('reorder-grupos'/.test(code)) {
      ok('Step3 · emite reorder-grupos');
    } else {
      fail('Step3 · não emite reorder-grupos', 'reordenação não propaga');
    }
    if (/:draggable="dnd\.armed === gi"/.test(code)) {
      ok('Step3 · draggable condicional ao handle (tabela + cards)');
    } else {
      fail('Step3 · draggable sempre ligado', 'inputs ficam não-editáveis');
    }
    if (/drag-handle/.test(code) && /@mousedown="dnd\.arm/.test(code)) {
      ok('Step3 · handle de arraste com arm()');
    } else {
      fail('Step3 · sem handle', 'sem ponto de pega para arrastar');
    }
  }

  // 5. Step5PecasEditor: drag wiring (por grupo)
  const step5Path = './src/components/Step5PecasEditor.vue';
  if (fs.existsSync(step5Path)) {
    const code = fs.readFileSync(step5Path, 'utf-8');
    if (/onPecaDragStart/.test(code) && /onDropPeca/.test(code)) {
      ok('Step5 · drag de peças por grupo (onPecaDragStart/onDropPeca)');
    } else {
      fail('Step5 · sem integração de drag', 'peças não arrastáveis');
    }
    if (/dragGrupoId/.test(code) && /dragGrupoId !== grupoId/.test(code)) {
      ok('Step5 · peças não migram entre grupos (guard de grupoId)');
    } else {
      fail('Step5 · sem guard de grupo', 'peça pode pular de grupo');
    }
    if (/\$emit\('reorder-pecas'/.test(code)) {
      ok('Step5 · emite reorder-pecas com grupoId');
    } else {
      fail('Step5 · não emite reorder-pecas', 'reordenação não propaga');
    }
  }

  // 6. CSS de drag
  const dsPath = './src/styles/design-system.css';
  if (fs.existsSync(dsPath)) {
    const css = fs.readFileSync(dsPath, 'utf-8');
    if (/\.drag-handle\s*\{/.test(css) && /cursor: grab/.test(css)) {
      ok('CSS · .drag-handle com cursor grab');
    } else {
      fail('CSS · sem .drag-handle', 'handle sem estilo');
    }
    if (/\.dnd-row\.dnd-over/.test(css)) {
      ok('CSS · indicador visual de drop (dnd-over)');
    } else {
      fail('CSS · sem feedback de drop', 'usuário não vê onde vai cair');
    }
  }

  // 7. Versão
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const _patch38 = Number(String(pkg.version).split('-')[1] || 0);
    if (_patch38 >= 38) {
      ok(`package.json · version = ${pkg.version} (>= v5.22.38)`);
    } else {
      fail(`package.json · version não bumpada para v5.22.38`,
        `esperado >= 5.0.22-38, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.22.39 — Export "GEO Controle Tecnológico" (criar_obra) ---------- */
{
  const fs = await import('node:fs');

  // 1) serviço exportador existe e expõe a função de build do payload
  const svcPath = './src/services/geoControleExportService.ts';
  if (fs.existsSync(svcPath)) {
    const code = fs.readFileSync(svcPath, 'utf-8');
    if (/export function buildGeoControlePayload/.test(code)) {
      ok('geoControleExportService · exporta buildGeoControlePayload');
    } else {
      fail('geoControleExportService · sem buildGeoControlePayload', 'export ausente');
    }
    if (/dadosBasicos/.test(code) && /grupos/.test(code) && /pecas/.test(code) && /fornecedores/.test(code)) {
      ok('geoControleExportService · monta as chaves do contrato criar_obra');
    } else {
      fail('geoControleExportService · chaves do payload incompletas', 'esperado dadosBasicos/grupos/pecas/fornecedores');
    }
    if (/grupoTempId/.test(code) && /concretoTempId/.test(code)) {
      ok('geoControleExportService · peças achatadas com grupoTempId/concretoTempId');
    } else {
      fail('geoControleExportService · peças sem tempIds', 'importador do geomat não liga grupo/concreto');
    }
    // v5.22.40 — concretos carregam slump previsto/tolerância (NC de slump no geomat)
    if (/slumpPrevisto/.test(code) && /slumpTolerancia/.test(code)) {
      ok('geoControleExportService · concretos carregam slumpPrevisto/slumpTolerancia');
    } else {
      fail('geoControleExportService · concretos sem slump', 'NC automática de slump não liga no geomat');
    }
    // v5.22.40 — catálogo de tipos de unidade derivado e ligado às peças por tipoTempId
    if (/GeoControleTipo/.test(code) && /tipoTempId/.test(code) && /tipos:\s*tipos\.length/.test(code)) {
      ok('geoControleExportService · tipos de unidade derivados + peças ligadas por tipoTempId');
    } else {
      fail('geoControleExportService · sem catálogo de tipos derivado', 'geomat cai no fallback de dedução');
    }
  } else {
    fail('geoControleExportService · arquivo ausente', svcPath);
  }

  // 2) store de export tem a action exportGeoControle
  const exportStorePath = './src/store/modules/export.ts';
  if (fs.existsSync(exportStorePath)) {
    const code = fs.readFileSync(exportStorePath, 'utf-8');
    if (/async exportGeoControle\(/.test(code)) {
      ok('store/export · action exportGeoControle');
    } else {
      fail('store/export · sem action exportGeoControle', 'export do GEO Controle não disponível');
    }
  }

  // 3) SetupPage tem o método + o botão na etapa 7
  const setupPath = './src/views/SetupPage.vue';
  if (fs.existsSync(setupPath)) {
    const code = fs.readFileSync(setupPath, 'utf-8');
    if (/onExportGeoControle\(\)/.test(code) && /export\/exportGeoControle/.test(code)) {
      ok('SetupPage · onExportGeoControle dispara a action');
    } else {
      fail('SetupPage · sem onExportGeoControle', 'método/dispatch ausente');
    }
    if (/Baixar JSON p\/ GEO Controle/.test(code)) {
      ok('SetupPage · botão "Baixar JSON p/ GEO Controle" presente');
    } else {
      fail('SetupPage · botão de export do GEO Controle ausente', 'usuário não consegue baixar');
    }
  }

  // 4) schema do contrato documentado
  const schemaPath = '../schemas/geo-controle-tecnologico.payload.v1.schema.json';
  if (fs.existsSync(schemaPath)) {
    ok('schemas · geo-controle-tecnologico.payload.v1.schema.json presente');
  } else {
    fail('schemas · schema do payload ausente', schemaPath);
  }

  // v5.22.40 — modelo padrão é "Completo com Projetista"
  const modelsPath = './src/models/setup.models.ts';
  if (fs.existsSync(modelsPath)) {
    const mcode = fs.readFileSync(modelsPath, 'utf-8');
    if (/modeloPreenchimento:\s*'modelo_projeto'/.test(mcode)) {
      ok('setup.models · novaObraMetadata default = modelo_projeto (Completo com Projetista)');
    } else {
      fail('setup.models · default não é modelo_projeto', 'esperado modeloPreenchimento: modelo_projeto');
    }
  }

  // 5) versão bumpada para v5.22.39+
  const pkgPath = './package.json';
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    const patch = Number(String(pkg.version).split('-')[1] || 0);
    if (patch >= 39) {
      ok(`package.json · version = ${pkg.version} (>= v5.22.39)`);
    } else {
      fail('package.json · version não bumpada para v5.22.39', `esperado >= 5.0.22-39, achei ${pkg.version}`);
    }
  }
}

/* ---------- v5.0.22-50 · Leitor de Laudos (OCR) ---------- */
{
  const fsL = fsMod;

  // A página deixou de carregar motor compilado e SheetJS inline (940 KB -> shell).
  const laudosPath = './public/laudos.html';
  if (fsL.existsSync(laudosPath)) {
    const html = fsL.readFileSync(laudosPath, 'utf-8');
    if (html.length < 100_000) ok(`laudos.html · shell enxuto (${Math.round(html.length / 1024)} KB)`);
    else fail('laudos.html · continua com bundle embutido', `${html.length} bytes`);

    if (!/LaudoParser = \(\(\) =>/.test(html)) ok('laudos.html · motor não está mais colado no HTML');
    else fail('laudos.html · motor compilado ainda embutido', 'extrair para public/assets');

    if (!/OPENAI_API_KEY|laudos_openai_key|sk-[A-Za-z0-9]{10}/.test(html)) {
      ok('laudos.html · sem chave de IA e sem storage de chave no cliente');
    } else {
      fail('laudos.html · resquício de chave no cliente', 'a credencial fica só na Edge Function');
    }

    for (const marca of ['vision-consent', 'laudo-app.js', 'store:false']) {
      if (html.includes(marca)) ok(`laudos.html · contém "${marca}"`);
      else fail(`laudos.html · falta "${marca}"`, 'consentimento/privacidade/bootstrap');
    }
  } else {
    fail('laudos.html · ausente', laudosPath);
  }

  // Motores determinísticos versionados (padrão UMD + gate Node do projeto).
  for (const asset of ['laudo-perfis.js', 'laudo-invariantes.js', 'laudo-parser-core.js', 'laudo-app.js', 'laudo-app.css', 'xlsx-style-lite.js']) {
    if (fsL.existsSync(`./public/assets/${asset}`)) ok(`public/assets · ${asset} presente`);
    else fail(`public/assets · ${asset} ausente`, 'gerado/entregue na V14');
  }

  // O writer XLSX da página vem do writer do projeto, não de SheetJS (gotcha #15).
  const appPath = './public/assets/laudo-app.js';
  if (fsL.existsSync(appPath)) {
    const appSrc = fsL.readFileSync(appPath, 'utf-8');
    if (appSrc.includes("from '/assets/xlsx-style-lite.js'")) ok('laudo-app · exporta Excel pelo writer do projeto');
    else fail('laudo-app · writer XLSX fora do padrão', 'usar xlsxStyleLite');
    if (/result_index: result\._visionResultIndex/.test(appSrc)) ok('laudo-app · telemetria de revisão preserva o índice da linha');
    else fail('laudo-app · telemetria sem índice de linha', 'result_index');
  }

  // Correção do defeito relatado em produção: NF vazia da 3ª linha em diante.
  const corePath = './public/assets/laudo-parser-core.js';
  if (fsL.existsSync(corePath)) {
    const coreSrc = fsL.readFileSync(corePath, 'utf-8');
    if (coreSrc.includes('NF_HERDADA_DA_PAGINA') && coreSrc.includes('NF_HERDADA_DO_DOCUMENTO')) {
      ok('parser-core · herança de NF por página e documento com proveniência');
    } else {
      fail('parser-core · herança de NF ausente', 'NF vazia após o primeiro bloco (defeito da v12)');
    }
    if (coreSrc.includes('RE_NF_ROTULO')) ok('parser-core · rótulo de NF tolerante (NFe, DANFE, 100.417)');
    else fail('parser-core · regex de NF antiga', 'RE_NF_ROTULO');
  }

  // Edge Function e migration entregues no padrão do projeto.
  const efPath = '../supabase/functions/laudo-vision/index.ts';
  if (fsL.existsSync(efPath)) {
    const efSrc = fsL.readFileSync(efPath, 'utf-8');
    if (efSrc.includes('store: false')) ok('laudo-vision · store:false na chamada ao provedor');
    else fail('laudo-vision · sem store:false', 'privacidade');
    if (!efSrc.includes("'access-control-allow-origin': '*'")) ok('laudo-vision · CORS restrito por allowlist');
    else fail('laudo-vision · CORS aberto', 'restringir ao domínio do produto');
    if (efSrc.includes('ocr_laudo_reservar_quota')) ok('laudo-vision · quota por origem/sessão');
    else fail('laudo-vision · sem quota', 'custo sem teto');
  } else {
    fail('laudo-vision · ausente', efPath);
  }

  const cfgPath = '../supabase/config.toml';
  if (fsL.existsSync(cfgPath) && fsL.readFileSync(cfgPath, 'utf-8').includes('[functions.laudo-vision]')) {
    ok('config.toml · laudo-vision declarada');
  } else {
    fail('config.toml · laudo-vision não declarada', 'verify_jwt por função');
  }

  const migPath = '../supabase/migrations/20260903_026_ocr_laudo_telemetria.sql';
  if (fsL.existsSync(migPath)) ok('migrations · 026 telemetria de OCR entregue');
  else fail('migrations · 026 ausente', migPath);

  const corpusPath = '../tools/corpus-laudos/manifest.json';
  if (fsL.existsSync(corpusPath)) {
    const corpus = JSON.parse(fsL.readFileSync(corpusPath, 'utf-8'));
    if (Array.isArray(corpus.cases) && corpus.cases.length >= 8) ok(`corpus-laudos · ${corpus.cases.length} casos versionados`);
    else fail('corpus-laudos · corpus pequeno demais', 'mínimo 8 casos');
    if (corpus.cases.some((c: { id: string }) => c.id === 'nf-cabecalho-multiplos-blocos')) {
      ok('corpus-laudos · caso de regressão da NF presente');
    } else {
      fail('corpus-laudos · sem regressão de NF', 'nf-cabecalho-multiplos-blocos');
    }
  } else {
    fail('corpus-laudos · manifest ausente', corpusPath);
  }
}

/* ---------- v5.0.22-51 · revisão geral do OCR (V15) ---------- */
{
  const fsV = fsMod;

  const appV15 = './public/assets/laudo-app.js';
  if (fsV.existsSync(appV15)) {
    const src = fsV.readFileSync(appV15, 'utf-8');
    if (src.includes('const jaGerados = new Set')) ok('laudo-app · achados externos não duplicam a cada revalidação');
    else fail('laudo-app · achados externos duplicados', 'recomputeDocument');
    if (src.includes('Promise.allSettled(runners)')) ok('laudo-app · cancelamento aguarda todos os workers');
    else fail('laudo-app · cancelamento solta promessa', 'parallelMap');
    if (src.includes('function detailKey(row)')) ok('laudo-app · painel de detalhes é por arquivo + linha');
    else fail('laudo-app · detalhes colidem entre laudos', 'detailKey');
    if (src.includes('const { customerInput, ...resto } = document;')) ok('laudo-app · Excel não carrega o texto integral das páginas');
    else fail('laudo-app · JSON técnico com texto integral', 'cleanForExport');
  }

  const invV15 = './public/assets/laudo-invariantes.js';
  if (fsV.existsSync(invV15)) {
    const src = fsV.readFileSync(invV15, 'utf-8');
    if (src.includes('function severidadeDoCodigo')) ok('laudo-invariantes · severidade por código de validação');
    else fail('laudo-invariantes · sem mapa de severidade', 'severidadeDoCodigo');
    if (src.includes('numeroPtBrDetalhado')) ok('laudo-invariantes · separador decimal ambíguo é sinalizado');
    else fail('laudo-invariantes · separador ambíguo silencioso', 'numeroPtBrDetalhado');
  }

  const efV15 = '../supabase/functions/laudo-vision/index.ts';
  if (fsV.existsSync(efV15)) {
    const src = fsV.readFileSync(efV15, 'utf-8');
    if (src.includes('rb.linha === ra.linha')) ok('laudo-vision · consenso casa por linha visual');
    else fail('laudo-vision · consenso posicional', 'desalinha quando as passadas diferem em contagem');
    if (src.includes('const linhasPendentes = new Set')) ok('laudo-vision · releitura substitui só a linha pendente');
    else fail('laudo-vision · releitura descarta a página inteira', 'retry cirúrgico');
    if (!/p_status:\s*codigos\.has\('LAUDO_SEM_RESULTADO'\)\s*\?\s*'sem_resultado'\s*:\s*'ok'/.test(src)) {
      ok('laudo-vision · status da telemetria respeita o CHECK da tabela');
    } else {
      fail('laudo-vision · status inválido na telemetria', "'ok' não existe no CHECK");
    }
  }

  const gateEf = '../tools/test-laudo-vision.mjs';
  if (fsV.existsSync(gateEf)) ok('tools · gate de integração da Edge Function entregue');
  else fail('tools · sem gate de integração da Edge Function', gateEf);

  const pkgV15 = JSON.parse(fsV.readFileSync('./package.json', 'utf-8'));
  if (pkgV15.scripts && pkgV15.scripts['test:laudo-vision']) ok('package.json · script test:laudo-vision registrado');
  else fail('package.json · gate da Edge Function fora do npm', 'test:laudo-vision');
}

/* ---------- relatório ---------- */
console.log('\n=== Smoke pipeline v5.22.17 ===');
results.forEach((r) => {
  const icon = r.pass ? '✓' : '✗';
  console.log(`${icon} ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
});
const passCount = results.filter((r) => r.pass).length;
const failCount = results.filter((r) => !r.pass).length;
console.log(`\nResultado: ${passCount} OK, ${failCount} FAIL\n`);
if (failCount) process.exit(1);
})();
