#!/usr/bin/env node
/* Gate Node do OCR de laudos. Zero dependências externas. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const ctx = { console, setTimeout, clearTimeout, structuredClone };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const name of ['laudo-perfis.js', 'laudo-invariantes.js', 'laudo-parser-core.js']) {
  const file = path.join(ROOT, 'frontend/public/assets', name);
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: name });
}
const P = ctx.LaudoParserCore;
const I = ctx.LaudoInvariantes;
const Profiles = ctx.LaudoPerfis;
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/corpus-laudos/manifest.json'), 'utf8'));
let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; console.log(`OK  ${name}`); }
  catch (error) { failures.push({ name, error: error.stack || String(error) }); console.error(`FAIL ${name}\n${error.stack || error}`); }
}
const values = (items, field) => items.map((r) => r[field] && r[field].valor);
const plain = (value) => JSON.parse(JSON.stringify(value));

for (const item of manifest.cases) {
  test(`corpus/${item.id}: quantidade`, () => {
    const out = P.parseDocumentoTexto(item.text, { perfil: item.profile === 'auto' ? null : item.profile });
    assert.equal(out.resultados.length, item.expected.count);
  });
  if (item.expected.ages) test(`corpus/${item.id}: idades preservadas`, () => {
    const out = P.parseDocumentoTexto(item.text);
    assert.deepEqual(plain(out.resultados.map((r) => [r.idade.valor, r.idade.unidade])), item.expected.ages);
  });
  if (item.expected.mpa) test(`corpus/${item.id}: MPa`, () => {
    const out = P.parseDocumentoTexto(item.text);
    assert.deepEqual(plain(values(out.resultados, 'mpa')), item.expected.mpa);
  });
  if (item.expected.cp) test(`corpus/${item.id}: CPs`, () => {
    const out = P.parseDocumentoTexto(item.text);
    assert.deepEqual(plain(values(out.resultados, 'cp')), item.expected.cp);
  });
  if (item.expected.profileDetected) test(`corpus/${item.id}: perfil`, () => {
    assert.equal(P.parseDocumentoTexto(item.text).metadata.perfilDetectado, item.expected.profileDetected);
  });
  if (item.expected.graphCuts != null) test(`corpus/${item.id}: gráfico removido`, () => {
    assert.equal(P.parseDocumentoTexto(item.text).diagnostico.cortesGrafico.length, item.expected.graphCuts);
  });
  if (item.expected.ageState) test(`corpus/${item.id}: idade não inventada`, () => {
    const out = P.parseDocumentoTexto(item.text);
    for (const r of out.resultados) { assert.equal(r.idade.estado, item.expected.ageState); assert.equal(r.idade.unidade, item.expected.ageUnit); }
  });
  if (item.expected.context) test(`corpus/${item.id}: contexto`, () => {
    const out = P.parseDocumentoTexto(item.text, { perfil: item.profile });
    for (const [key, expected] of Object.entries(item.expected.context)) assert.equal(out.contexto[key], expected);
  });
  if (item.expected.nf) test(`corpus/${item.id}: nota fiscal`, () => {
    const out = P.parseDocumentoTexto(item.text, { perfil: item.profile || null });
    assert.deepEqual(plain(values(out.resultados, 'nf')), item.expected.nf);
  });
  if (item.expected.nfOrigem) test(`corpus/${item.id}: proveniência da nota fiscal`, () => {
    const out = P.parseDocumentoTexto(item.text, { perfil: item.profile || null });
    assert.deepEqual(plain(out.resultados.map((r) => r.nf.origem)), item.expected.nfOrigem);
  });
  if (item.expected.pages) test(`corpus/${item.id}: detecção página a página`, () => {
    const out = P.parseDocumentoTexto(item.text);
    assert.equal(out.diagnostico.paginas, item.expected.pages);
    assert.equal(out.diagnostico.paginasEscaneadas, item.expected.scannedPages);
  });
}

test('D5: resultados iguais de CPs distintos não são deduplicados', () => {
  const item = manifest.cases.find((x) => x.id === 'texto-duplicados-legitimos');
  const out = P.parseDocumentoTexto(item.text);
  assert.equal(out.resultados.length, 2);
  assert.notEqual(out.resultados[0].id, out.resultados[1].id);
});
test('D6: 1 dia continua 1 dia; 2 dias continuam 2 dias', () => {
  const item = manifest.cases.find((x) => x.id === 'texto-idades-1e2-dias');
  const out = P.parseDocumentoTexto(item.text);
  assert.deepEqual(plain(out.resultados.slice(0, 2).map((r) => [r.idade.valor, r.idade.unidade])), [[1, 'dia'], [2, 'dia']]);
  assert.ok(out.resultados[0].normalizacoes.some((n) => n.code === 'IDADE_1D_12H_NAO_APLICADA'));
});
test('D13: raw, página e linha são preservados', () => {
  const out = P.parseDocumentoTexto(manifest.cases[0].text);
  assert.ok(out.resultados[0].mpa.raw);
  assert.ok(out.resultados[0].origem.textoLinha);
  assert.equal(out.resultados[0].origem.pagina, 1);
  assert.ok(out.resultados[0].origem.linha > 0);
});
test('C2: perfis são declarativos e aceitam override', () => {
  assert.equal(Profiles.detectar('qualquer texto', 'polimix').perfil.id, 'polimix');
  assert.equal(Profiles.detectar('CONCRELAB RELATORIO DE ENSAIO DE COMPRESSAO').perfil.id, 'concrelab');
});
test('C4: ausente e ilegível são estados diferentes', () => {
  assert.equal(I.estadoCampo({ estado: 'ausente', valor: null }, 'texto').estado, 'ausente');
  assert.equal(I.estadoCampo({ estado: 'ilegivel', valor: null, raw: '3?' }, 'texto').estado, 'ilegivel');
});
test('estado valor inválido vira ilegível, não valor:null', () => {
  const c = I.estadoCampo({ estado: 'valor', valor: 'abc', raw: 'abc' }, 'numero');
  assert.equal(c.estado, 'ilegivel'); assert.equal(c.valor, null);
});
test('C1: consenso igual mantém valor e marca concordância', () => {
  const row = { id:'a', cp:{estado:'valor',valor:'CP1',raw:'CP1'}, nf:{estado:'valor',valor:'123',raw:'123'}, idade:{estado:'valor',valor:28,unidade:'dia',raw:'28 d'}, mpa:{estado:'valor',valor:32.4,raw:'32,4'}, origem:{pagina:1,linha:1}, confianca:{nivel:'media',score:.7,legibilidade:.9}, revisaoHumana:{status:'pendente'} };
  const out = I.consenso([row], [structuredClone(row)], { pagina: 1 });
  assert.equal(out.divergencias.length, 0);
  assert.equal(out.resultados[0].mpa.valor, 32.4);
  assert.equal(out.resultados[0].confianca.concordanciaPassadas, true);
});
test('C1/C5: divergência de MPa vira ilegível e expõe candidatos', () => {
  const base = { id:'a', cp:{estado:'valor',valor:'CP1',raw:'CP1'}, nf:{estado:'valor',valor:'123',raw:'123'}, idade:{estado:'valor',valor:28,unidade:'dia',raw:'28 d'}, mpa:{estado:'valor',valor:32.4,raw:'32,4'}, origem:{pagina:1,linha:1}, confianca:{nivel:'media',score:.7,legibilidade:.9}, revisaoHumana:{status:'pendente'} };
  const b = structuredClone(base); b.mpa = { estado:'valor', valor:38.4, raw:'38,4' };
  const out = I.consenso([base], [b], { pagina: 1 });
  assert.equal(out.resultados[0].mpa.estado, 'ilegivel');
  assert.equal(out.resultados[0].candidatos.length, 1);
  assert.equal(out.divergencias[0].field, undefined); // API web usa 'campo'; garante que não há acoplamento oculto com proxy
  assert.equal(out.divergencias[0].campo, 'mpa');
});
test('D5: validação avisa duplicidade sem remover linhas', () => {
  const row = (id, cp) => ({ id, cp:{estado:'valor',valor:cp}, nf:{estado:'valor',valor:'123'}, idade:{estado:'valor',valor:28,unidade:'dia'}, mpa:{estado:'valor',valor:32.4}, origem:{pagina:1,linha:Number(cp)}, confianca:{nivel:'media',score:.7}, revisaoHumana:{status:'pendente'} });
  const out = I.validarDocumento({ metadata:{fonte:'texto'}, diagnostico:{legibilidadeMedia:.8}, resultados:[row('a','1'),row('b','2')] });
  assert.equal(out.resultados.length, 2);
  assert.ok(out.validation.some((v) => v.code === 'RESULTADO_DUPLICADO_SUSPEITO'));
});
test('C3: resistência decrescente gera alerta, não correção silenciosa', () => {
  const row = (id, age, mpa) => ({ id, cp:{estado:'valor',valor:'CP1'}, nf:{estado:'valor',valor:'123'}, idade:{estado:'valor',valor:age,unidade:'dia'}, mpa:{estado:'valor',valor:mpa}, origem:{pagina:1,linha:age}, confianca:{nivel:'media',score:.7}, revisaoHumana:{status:'pendente'} });
  const out = I.validarDocumento({ metadata:{fonte:'texto'}, diagnostico:{legibilidadeMedia:.8}, resultados:[row('a',7,35),row('b',28,20)] });
  assert.ok(out.validation.some((v) => v.code === 'RESISTENCIA_DECRESCENTE_COM_IDADE'));
  assert.equal(out.resultados[1].mpa.valor, 20);
});
test('D10/C8: confiança calculada cai com campo crítico ilegível', () => {
  const row = { id:'x', cp:{estado:'valor',valor:'1'}, nf:{estado:'valor',valor:'123'}, idade:{estado:'valor',valor:28,unidade:'dia'}, mpa:{estado:'ilegivel',valor:null,raw:'3?'}, origem:{pagina:1,linha:1}, confianca:{nivel:'alta',score:1,legibilidade:.8}, revisaoHumana:{status:'pendente'} };
  const out = I.validarDocumento({ metadata:{fonte:'visao-consenso'}, diagnostico:{legibilidadeMedia:.8}, resultados:[row] });
  assert.equal(out.resultados[0].confianca.nivel, 'baixa');
});
test('revalidação preserva snapshot, arquivo e campos editados', () => {
  const row = { id:'x', cp:{estado:'valor',valor:'1'}, nf:{estado:'valor',valor:'123'}, idade:{estado:'valor',valor:28,unidade:'dia'}, mpa:{estado:'valor',valor:30}, origem:{pagina:1,linha:1}, confianca:{nivel:'media',score:.7}, revisaoHumana:{status:'corrigido'}, _ocrSnapshot:{mpa:29}, _fileId:'f1', _fileName:'teste.pdf', _editedFields:new Set(['mpa']), normalizacoes:[{code:'x'}] };
  const out = I.validarDocumento({ metadata:{fonte:'texto'}, diagnostico:{legibilidadeMedia:.8}, resultados:[row] }).resultados[0];
  assert.equal(out._ocrSnapshot.mpa, 29); assert.equal(out._fileId, 'f1'); assert.equal(out._fileName, 'teste.pdf'); assert.ok(out._editedFields.has('mpa')); assert.equal(out.normalizacoes.length, 1);
});
test('schema versionado é JSON válido e estrito', () => {
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/laudo-ocr.v1.schema.json'), 'utf8'));
  assert.equal(schema.$id.includes('laudo-ocr.v1'), true);
  assert.equal(schema.additionalProperties, false);
  assert.ok(schema.required.includes('metadata') && schema.required.includes('resultados'));
});
test('HTML não contém chave OpenAI nem sessionStorage de chave', () => {
  const html = fs.readFileSync(path.join(ROOT, 'frontend/public/laudos.html'), 'utf8');
  assert.equal(/OPENAI_API_KEY|laudos_openai_key|sk-[A-Za-z0-9]/.test(html), false);
  assert.ok(html.includes('vision-consent'));
  assert.ok(html.includes('laudo-app.js'));
});
test('HTML não mantém motor compilado nem SheetJS inline', () => {
  const html = fs.readFileSync(path.join(ROOT, 'frontend/public/laudos.html'), 'utf8');
  assert.ok(html.length < 100000);
  assert.equal(html.includes('LaudoParser = (() =>'), false);
  assert.equal(html.includes('xlsx.js'), false);
});
test('Edge Function: Luna, Terra, Structured Outputs, store:false e anti-ancoragem', () => {
  const src = fs.readFileSync(path.join(ROOT, 'supabase/functions/laudo-vision/index.ts'), 'utf8');
  assert.ok(src.includes("PRIMARY_MODEL_DEFAULT = 'gpt-5.6-luna'"));
  assert.ok(src.includes("RETRY_MODEL_DEFAULT = 'gpt-5.6-terra'"));
  assert.ok(src.includes('store: false'));
  assert.ok(src.includes("type: 'json_schema'"));
  assert.ok(src.includes("strategy: 'linhas'")); assert.ok(src.includes("strategy: 'colunas'"));
  assert.ok(src.includes('sem usar valores de leituras anteriores'));
  assert.equal(/previous_response_id|JSON\.stringify\(merged\.page\)/.test(src), false);
});
test('Edge Function: segurança e limites explícitos', () => {
  const src = fs.readFileSync(path.join(ROOT, 'supabase/functions/laudo-vision/index.ts'), 'utf8');
  assert.ok(src.includes('ALLOWED_ORIGINS'));
  assert.ok(src.includes('MAX_IMAGE_BYTES'));
  assert.ok(src.includes('ocr_laudo_reservar_quota'));
  assert.ok(src.includes("candidate === 'gpt-5.6'"));
  assert.equal(src.includes("'access-control-allow-origin': '*'"), false);
});
test('Migration: RLS fechada, RPC restrita e view security_invoker', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260903_026_ocr_laudo_telemetria.sql'), 'utf8');
  assert.ok((sql.match(/enable row level security/g) || []).length >= 3);
  assert.ok(sql.includes('security_invoker = true'));
  assert.ok(sql.includes('revoke all on public.ocr_laudo_leitura from public, anon, authenticated'));
  assert.ok(sql.includes('grant execute on function public.ocr_laudo_registrar_leitura'));
  assert.equal(/valor_ocr\s+text|valor_final\s+text|imagem\s+bytea/i.test(sql), false);
});
test('V15: versão e scripts registrados', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend/package.json'), 'utf8'));
  // V15 establishes a release floor; subsequent reviewed releases retain its gates.
  assert.match(pkg.version, /^5\.0\.22-\d+$/);
  assert.ok(Number(pkg.version.split('-')[1]) >= 51);
  assert.ok(pkg.scripts['test:laudos']); assert.ok(pkg.scripts['corpus:laudos']);
  assert.ok(pkg.scripts['test:laudo-vision'], 'gate de integração da Edge Function');
  assert.ok(pkg.scripts['smoke:all'].includes('test:laudo-vision'));
});


test('D12: idade explícita fora da whitelist é preservada sem SNAP', () => {
  const out = P.parseDocumentoTexto('RELATORIO DE ENSAIO DE COMPRESSAO\nCP IDADE RESISTENCIA (MPa)\nA1 4 d 19,4');
  assert.equal(out.resultados.length, 1);
  assert.equal(out.resultados[0].idade.valor, 4);
  assert.equal(out.resultados[0].idade.unidade, 'dia');
});
test('D12: zero dia não é convertido silenciosamente para 12 horas', () => {
  const out = P.parseDocumentoTexto('RELATORIO DE ENSAIO DE COMPRESSAO\nCP IDADE RESISTENCIA (MPa)\nA1 0 d 9,4');
  assert.equal(out.resultados.length, 0);
});
test('D7/D23: app trata falha de visão por página sem abortar o documento', () => {
  const src = fs.readFileSync(path.join(ROOT, 'frontend/public/assets/laudo-app.js'), 'utf8');
  assert.ok(src.includes('Os resultados locais das demais páginas foram preservados'));
  assert.ok(src.includes('completedVisionPages += 1'));
  assert.ok(src.includes('pageLooksLikeResultTable'));
});
test('telemetria: índice original da linha de visão é preservado no consenso', () => {
  const local = { id:'l', cp:{estado:'valor',valor:'CP1'}, nf:{estado:'valor',valor:'123'}, idade:{estado:'valor',valor:28,unidade:'dia'}, mpa:{estado:'valor',valor:30}, origem:{pagina:1,linha:1}, confianca:{nivel:'media',score:.7}, revisaoHumana:{status:'pendente'} };
  const vision = structuredClone(local); vision._visionResultIndex = 7;
  const out = I.consenso([local], [vision], { pagina: 1 });
  assert.equal(out.resultados[0]._visionResultIndex, 7);
});
test('telemetria: app envia os 12 campos e usa _visionResultIndex', () => {
  const src = fs.readFileSync(path.join(ROOT, 'frontend/public/assets/laudo-app.js'), 'utf8');
  assert.ok(src.includes('result_index: result._visionResultIndex'));
  for (const field of ['carga','area','fck_projeto','slump','traco','local_aplicacao']) assert.ok(src.includes(`'${field}'`));
  assert.equal(src.includes("['idadeUnidade','idade_unidade']"), false);
});
test('Edge Function: uma passada sobrevivente não é promovida a consenso', () => {
  const src = fs.readFileSync(path.join(ROOT, 'supabase/functions/laudo-vision/index.ts'), 'utf8');
  assert.ok(src.includes('singlePassResult'));
  assert.ok(src.includes('a leitura sobrevivente não é consenso'));
  assert.equal(src.includes('const second = passB.ok ? passB.page! : passA.page!'), false);
});
test('Edge Function: conteúdo da imagem e detalhe são validados no servidor', () => {
  const src = fs.readFileSync(path.join(ROOT, 'supabase/functions/laudo-vision/index.ts'), 'utf8');
  assert.ok(src.includes('inspectImage(imageBase64, mime)'));
  assert.ok(src.includes('image_content_mismatch_or_dimensions_invalid'));
  assert.ok(src.includes('detailForModel'));
  assert.ok(src.includes('originalPatches > 30_000'));
});
test('Edge Function: retry técnico é limitado e consome quota adicional', () => {
  const src = fs.readFileSync(path.join(ROOT, 'supabase/functions/laudo-vision/index.ts'), 'utf8');
  assert.ok(src.includes('MAX_TECHNICAL_RETRIES = 1'));
  assert.ok(src.includes('beforeTechnicalRetry'));
  assert.ok(src.includes('totalHttpAttempts'));
  assert.equal(src.includes('[408, 500, 502, 503, 504]'), true);
});
test('Edge Function: requisição sem Origin é bloqueada por padrão', () => {
  const src = fs.readFileSync(path.join(ROOT, 'supabase/functions/laudo-vision/index.ts'), 'utf8');
  assert.ok(src.includes("LAUDO_VISION_ALLOW_NO_ORIGIN"));
  assert.ok(src.includes("error: 'origin_required'"));
});
test('Migration: quota aceita prefixos, auditoria append-only e métricas separadas', () => {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/migrations/20260903_026_ocr_laudo_telemetria.sql'), 'utf8');
  assert.ok(sql.includes("'^[a-z0-9:._-]+$'"));
  assert.ok(sql.includes("'ocr_laudo_confirmacao'"));
  assert.ok(sql.includes('false_fill_pct'));
  assert.ok(sql.includes('omissao_pct'));
});
test('Privacidade: UI não promete ausência absoluta de retenção técnica', () => {
  const html = fs.readFileSync(path.join(ROOT, 'frontend/public/laudos.html'), 'utf8');
  assert.ok(html.includes('store:false'));
  assert.ok(html.includes('retenções técnicas limitadas'));
  assert.equal(html.includes('A chamada usa retenção desativada'), false);
});
test('Design System: tela V13 não introduz cores hex hardcoded', () => {
  const files = ['frontend/public/laudos.html','frontend/public/assets/laudo-app.css','frontend/public/assets/laudo-app.js'];
  for (const file of files) assert.equal(/#[0-9a-f]{3,8}\b/i.test(fs.readFileSync(path.join(ROOT, file), 'utf8')), false, file);
});


/* ------------------------------------------------------------------ V14: NF */
test('V14/NF: laudo com NF só no cabeçalho preenche TODAS as linhas', () => {
  const item = manifest.cases.find((x) => x.id === 'nf-cabecalho-multiplos-blocos');
  const out = P.parseDocumentoTexto(item.text);
  assert.equal(out.resultados.length, 5);
  assert.equal(out.resultados.filter((r) => r.nf.valor === '100417').length, 5);
});
test('V14/NF: herança traz proveniência e motivo visíveis', () => {
  const item = manifest.cases.find((x) => x.id === 'nf-cabecalho-multiplos-blocos');
  const herdado = P.parseDocumentoTexto(item.text).resultados.find((r) => r.nf.origem === 'pagina');
  assert.ok(herdado, 'esperava ao menos um resultado com NF herdada da página');
  assert.ok(/herdada/i.test(herdado.nf.motivo || ''));
});
test('V14/NF: NF ambígua não é herdada (não adivinha)', () => {
  const item = manifest.cases.find((x) => x.id === 'nf-ambigua-nao-herda');
  const out = P.parseDocumentoTexto(item.text);
  assert.equal(out.resultados.filter((r) => r.nf.valor).length, 0);
  assert.ok(out.resultados.every((r) => r.nf.estado === 'ausente'));
});
test('V14/NF: 100.417, 0100417 e "Nota Fiscal n" normalizam para o mesmo número', () => {
  for (const id of ['nf-formato-com-ponto', 'nf-formato-nfe-com-zero']) {
    const item = manifest.cases.find((x) => x.id === id);
    const out = P.parseDocumentoTexto(item.text);
    assert.equal(out.resultados[0].nf.valor, '100417', id);
  }
});
test('V14/NF: herança de documento só ocorre com NF única', () => {
  const umaNf = P.parseDocumentoTexto('RELATORIO DE ENSAIO No 8001\nNOTA FISCAL 55501\nCP IDADE RESISTENCIA (MPa)\n1 28 dias 30,0\n\fCP IDADE RESISTENCIA (MPa)\n2 28 dias 31,0');
  assert.ok(umaNf.resultados.every((r) => r.nf.valor === '55501'));
  assert.ok(umaNf.resultados.some((r) => r.nf.origem === 'documento'));
});
test('V14: identificação do CP não é preenchida com a idade da linha (false fill)', () => {
  const item = manifest.cases.find((x) => x.id === 'nf-cabecalho-multiplos-blocos');
  const out = P.parseDocumentoTexto(item.text);
  assert.ok(out.resultados.every((r) => r.cp.valor === null));
});
test('V14: uma linha com duas colunas de idade mantém a origem nas duas', () => {
  const item = manifest.cases.find((x) => x.id === 'polimix-colunas-por-idade');
  const out = P.parseDocumentoTexto(item.text, { perfil: 'polimix' });
  assert.ok(out.resultados.every((r) => r.origem.linha > 0 && r.origem.textoLinha));
  assert.deepEqual(plain(values(out.resultados, 'cp')), ['101', '101', '102', '102']);
});


/* ------------------------------------------------------- V15: revisão geral */
test('V15/consenso: sobra sem par vira linha própria, não funde CPs distintos', () => {
  const mk = (id, cp, idade, mpa, linha) => ({ id, cp: { estado: 'valor', valor: cp }, nf: { estado: 'valor', valor: '55010' }, idade: { estado: 'valor', valor: idade, unidade: 'dia' }, mpa: { estado: 'valor', valor: mpa }, origem: { pagina: 1, linha }, confianca: { nivel: 'media', score: 0.7, legibilidade: 0.9 }, revisaoHumana: { status: 'pendente' } });
  const out = I.consenso([mk('a', 'CP-7', 7, 24.1, 1)], [mk('b', 'CP-9', 28, 41.7, 5)], { pagina: 1 });
  assert.equal(out.resultados.length, 2);
  assert.deepEqual(plain(out.resultados.map((r) => r.cp.valor)), ['CP-7', 'CP-9']);
});
test('V15/consenso: campos vazios que "concordam" não inflam o score', () => {
  const vazio = (mpa) => ({ id: 'x', cp: { estado: 'ausente', valor: null }, nf: { estado: 'ausente', valor: null }, idade: { estado: 'ausente', valor: null, unidade: null }, mpa: { estado: 'valor', valor: mpa }, carga: { estado: 'ausente', valor: null }, area: { estado: 'ausente', valor: null }, dataMoldagem: { estado: 'ausente', valor: null }, dataRompimento: { estado: 'ausente', valor: null }, fckProjeto: { estado: 'ausente', valor: null }, slump: { estado: 'ausente', valor: null }, traco: { estado: 'ausente', valor: null }, localAplicacao: { estado: 'ausente', valor: null }, origem: { pagina: 1, linha: 1 }, confianca: { nivel: 'media', score: 0.7, legibilidade: 0.9 }, revisaoHumana: { status: 'pendente' } });
  const out = I.consenso([vazio(25)], [vazio(41)], { pagina: 1 });
  assert.equal(out.resultados[0].mpa.estado, 'ilegivel');
  assert.equal(out.resultados[0].confianca.nivel, 'baixa');
});
test('V15/validação: dispersão entre gêmeos na MESMA idade não vira resistência decrescente', () => {
  const gemeo = (id, mpa) => ({ id, cp: { estado: 'ausente', valor: null }, nf: { estado: 'valor', valor: '55010' }, idade: { estado: 'valor', valor: 28, unidade: 'dia' }, mpa: { estado: 'valor', valor: mpa }, origem: { pagina: 1, linha: 1 }, confianca: { nivel: 'media', score: 0.7 }, revisaoHumana: { status: 'pendente' } });
  const out = I.validarDocumento({ metadata: { fonte: 'texto' }, diagnostico: { legibilidadeMedia: 0.8 }, resultados: [gemeo('a', 30), gemeo('b', 24)] });
  assert.equal(out.validation.some((v) => v.code === 'RESISTENCIA_DECRESCENTE_COM_IDADE'), false);
});
test('V15/validação: queda real do MESMO CP com idade crescente continua alertando', () => {
  const cp = (id, idade, mpa) => ({ id, cp: { estado: 'valor', valor: 'CP1' }, nf: { estado: 'valor', valor: '55010' }, idade: { estado: 'valor', valor: idade, unidade: 'dia' }, mpa: { estado: 'valor', valor: mpa }, origem: { pagina: 1, linha: idade }, confianca: { nivel: 'media', score: 0.7 }, revisaoHumana: { status: 'pendente' } });
  const out = I.validarDocumento({ metadata: { fonte: 'texto' }, diagnostico: { legibilidadeMedia: 0.8 }, resultados: [cp('a', 7, 35), cp('b', 28, 20)] });
  assert.ok(out.validation.some((v) => v.code === 'RESISTENCIA_DECRESCENTE_COM_IDADE'));
});
test('V15/validação: CAMPO_ILEGIVEL não é contado em dobro', () => {
  const row = { id: 'x', cp: { estado: 'valor', valor: '1' }, nf: { estado: 'valor', valor: '1' }, idade: { estado: 'ilegivel', valor: null }, mpa: { estado: 'ilegivel', valor: null, raw: '3?' }, origem: { pagina: 1, linha: 1 }, confianca: { nivel: 'alta', score: 1, legibilidade: 0.8 }, revisaoHumana: { status: 'pendente' } };
  const out = I.validarDocumento({ metadata: { fonte: 'texto' }, diagnostico: { legibilidadeMedia: 0.8 }, resultados: [row] });
  assert.equal(out.validation.filter((v) => v.code === 'CAMPO_ILEGIVEL').length, 2);
});
test('V15/NF: saneamento que zera a nota vira ilegível, não valor nulo', () => {
  const out = I.normalizarResultado({ id: 'n', nf: { estado: 'valor', valor: '№ ###', raw: '№ ###' }, mpa: { estado: 'valor', valor: 30 }, idade: { estado: 'valor', valor: 28, unidade: 'dia' } }, {});
  assert.equal(out.nf.estado, 'ilegivel');
  assert.equal(out.nf.valor, null);
});
test('V15/número: separador ambíguo é sinalizado, não escolhido em silêncio', () => {
  const det = I.numeroPtBrDetalhado('7.854');
  assert.equal(det.ambiguo, true);
  assert.equal(det.valor, 7.854);
  assert.equal(det.alternativa, 7854);
  const out = I.normalizarResultado({ id: 'a', area: { estado: 'valor', valor: '7.854', raw: '7.854' }, mpa: { estado: 'valor', valor: 30 }, idade: { estado: 'valor', valor: 28, unidade: 'dia' } }, {});
  assert.ok(out.normalizacoes.some((n) => n.code === 'SEPARADOR_AMBIGUO' && n.campo === 'area'));
});
test('V15/códigos: catálogo cobre o que a Edge Function emite, com severidade própria', () => {
  for (const code of ['PASSADA_UNICA_SEM_CONSENSO', 'RELEITURA_APLICADA', 'CAMPO_CRITICO_PENDENTE', 'QUANTIDADE_LINHAS_DIVERGE']) {
    assert.ok(I.VALIDATION_CODES.includes(code), code);
  }
  assert.equal(I.severidadeDoCodigo('PASSADA_UNICA_SEM_CONSENSO'), 'error');
  assert.equal(I.severidadeDoCodigo('RELEITURA_APLICADA'), 'info');
});
test('V15/app: achados externos não são duplicados a cada recomputação', () => {
  const src = fs.readFileSync(path.join(ROOT, 'frontend/public/assets/laudo-app.js'), 'utf8');
  assert.ok(src.includes('const jaGerados = new Set'));
  assert.equal(/validated\.validation\.push\(\.\.\.external\)/.test(src), false);
});
test('V15/app: fila é drenada quando chegam arquivos durante o lote', () => {
  const src = fs.readFileSync(path.join(ROOT, 'frontend/public/assets/laudo-app.js'), 'utf8');
  assert.ok(src.includes("some((entry) => entry.status === 'queued')"));
  assert.ok(src.includes('if (state.busy) return;'));
});
test('V15/app: cancelamento não deixa documento ressuscitar nem promessa solta', () => {
  const src = fs.readFileSync(path.join(ROOT, 'frontend/public/assets/laudo-app.js'), 'utf8');
  assert.ok(src.includes('Promise.allSettled(runners)'));
  assert.ok(src.includes("if (state.cancelled) throw new DOMException('Cancelado', 'AbortError');"));
});
test('V15/app: detalhes são por arquivo + resultado (ids colidem entre laudos)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'frontend/public/assets/laudo-app.js'), 'utf8');
  assert.ok(src.includes('function detailKey(row)'));
  assert.equal(src.includes('state.openDetails.has(result.id)'), false);
});
test('V15/app: linha rejeitada não vaza para Proveniência nem para o JSON técnico', () => {
  const src = fs.readFileSync(path.join(ROOT, 'frontend/public/assets/laudo-app.js'), 'utf8');
  assert.ok(src.includes("acceptedRows.forEach((row) => {"));
  assert.ok(src.includes("resultados: (documento.resultados || []).filter((r) => r.revisaoHumana.status !== 'rejeitado')"));
});
test('V15/app: JSON técnico não carrega o texto integral das páginas', () => {
  const src = fs.readFileSync(path.join(ROOT, 'frontend/public/assets/laudo-app.js'), 'utf8');
  assert.ok(src.includes('const { customerInput, ...resto } = document;'));
});
test('V15/app: canvas de visão é liberado e a página do pdf.js é limpa', () => {
  const src = fs.readFileSync(path.join(ROOT, 'frontend/public/assets/laudo-app.js'), 'utf8');
  assert.ok(src.includes('function liberarCanvas'));
  assert.ok(src.includes('page.cleanup();'));
});
test('V15/app: concordância entre passadas vem da linha, não da ausência de divergências', () => {
  const src = fs.readFileSync(path.join(ROOT, 'frontend/public/assets/laudo-app.js'), 'utf8');
  assert.ok(src.includes('concordanciaPassadas: r.consenso === true'));
});
test('V15/EF: telemetria usa status do CHECK e nunca envia paginas_total nulo', () => {
  const src = fs.readFileSync(path.join(ROOT, 'supabase/functions/laudo-vision/index.ts'), 'utf8');
  assert.equal(src.includes("p_status: codigos.has('LAUDO_SEM_RESULTADO') ? 'sem_resultado' : 'ok'"), false);
  assert.ok(src.includes("'sem_resultado'") && src.includes("'sucesso'") && src.includes("'parcial'"));
  assert.ok(src.includes('p_paginas_total: Math.max(pagina'));
});
test('V15/EF: consenso casa por linha visual e devolve o flag por resultado', () => {
  const src = fs.readFileSync(path.join(ROOT, 'supabase/functions/laudo-vision/index.ts'), 'utf8');
  assert.ok(src.includes('rb.linha === ra.linha'));
  assert.ok(src.includes('consenso: _consenso === true'));
});
test('V15/EF: releitura é cirúrgica e respeita orçamento de tempo', () => {
  const src = fs.readFileSync(path.join(ROOT, 'supabase/functions/laudo-vision/index.ts'), 'utf8');
  assert.ok(src.includes('const linhasPendentes = new Set'));
  assert.ok(src.includes('BUDGET_MS'));
  assert.equal(src.includes('resultados = amostrasRetry.map((r) => ({ ...r, _consenso: false }));'), false);
});
test('V15/EF: blur e contraste são lidos com o nome que o cliente envia', () => {
  const src = fs.readFileSync(path.join(ROOT, 'supabase/functions/laudo-vision/index.ts'), 'utf8');
  assert.ok(src.includes('?.blur_score'));
  assert.ok(src.includes('?.contrast_score'));
});
test('V15/EF: tokens das três chamadas são somados na telemetria', () => {
  const src = fs.readFileSync(path.join(ROOT, 'supabase/functions/laudo-vision/index.ts'), 'utf8');
  assert.ok(src.includes('const somaUsage'));
  assert.ok(src.includes('p_input_tokens: usageTotal.input_tokens'));
});

const summary = { passed, failed: failures.length, total: passed + failures.length, failures };
fs.mkdirSync(path.join(ROOT, '.laudo-validation'), { recursive: true });
fs.writeFileSync(path.join(ROOT, '.laudo-validation/laudo-tests.json'), JSON.stringify(summary, null, 2));
console.log(`\nLaudos V15: ${passed} OK / ${failures.length} FAIL`);
process.exitCode = failures.length ? 1 : 0;
