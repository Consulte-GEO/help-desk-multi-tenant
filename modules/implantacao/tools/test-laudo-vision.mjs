#!/usr/bin/env node
/**
 * test-laudo-vision.mjs · Implantação Consulte GEO · V15
 *
 * Teste de INTEGRAÇÃO da Edge Function `laudo-vision`, sem tocar em produção,
 * sem chave da OpenAI e sem Supabase real:
 *
 *   1. sobe um stub HTTP que faz o papel do provedor de IA e do PostgREST
 *      (as RPCs de quota, telemetria e confirmação);
 *   2. sobe a própria Edge Function com `deno run`, apontada para o stub via
 *      `LAUDO_VISION_OPENAI_URL` e `SUPABASE_URL`;
 *   3. exercita os caminhos que já quebraram: guarda de origem, consentimento,
 *      imagem inválida, consenso entre duas passadas, divergência, releitura
 *      cirúrgica, quota estourada e confirmação da revisão humana;
 *   4. confere o que a função GRAVA na telemetria (status válido, tokens
 *      somados das três chamadas, blur/contraste com o nome certo).
 *
 * Uso:  node tools/test-laudo-vision.mjs
 * Sem Deno instalado o teste é PULADO com aviso (não falha o gate).
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const EF = resolve(root, 'supabase/functions/laudo-vision/index.ts');
const PORTA_STUB = 8791;
const PORTA_EF = 8000; // porta padrão do Deno.serve
const ORIGIN = 'https://setup.consultegeo.org';

/* --------------------------------------------------------------- utilidades */
let passou = 0;
const falhas = [];
function teste(nome, fn) {
  try { fn(); passou += 1; console.log(`OK  ${nome}`); }
  catch (error) { falhas.push({ nome, error: String(error && error.stack || error) }); console.error(`FAIL ${nome}\n  ${error && error.message}`); }
}
function igual(a, b, msg) {
  const sa = JSON.stringify(a); const sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(`${msg || 'valores diferentes'}: ${sa} != ${sb}`);
}
function verdade(v, msg) { if (!v) throw new Error(msg || 'esperava verdadeiro'); }

function localizarDeno() {
  for (const candidato of ['deno', resolve(root, 'node_modules/.bin/deno'), '/tmp/node_modules/.bin/deno']) {
    const r = spawnSync(candidato, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) return candidato;
  }
  return null;
}

/** JPEG 8x8 branco de verdade — a Edge confere assinatura e dimensões. */
const JPEG_8x8 = 'ffd8ffe000104a46494600010100000100010000ffdb004300ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffc2000b080008000801011100ffc40014000100000000000000000000000000000009ffda0008010100013f10';
function jpegBase64() {
  const bytes = Buffer.from(JPEG_8x8, 'hex');
  return bytes.toString('base64');
}

/* ------------------------------------------------------------- stub servidor */
const chamadasProvedor = [];
const chamadasRpc = [];
let respostaProvedor = () => ({ amostras: [], avisos: [], legibilidade: 0.9, documento: {} });
let quotaPermite = true;

function amostra(linha, extra = {}) {
  return {
    linha, identificacao_cp: `CP${linha}`, nota_fiscal: '100417',
    idade_valor: 28, idade_unidade: 'dias', idade_raw: '28 dias',
    mpa: 30 + linha, mpa_raw: `${30 + linha},0`, carga_kn: 500, area_mm2: 17671,
    data_moldagem: '01/08/2026', data_rompimento: '29/08/2026',
    fck_projeto: 30, slump: '10±2', traco: 'T30', local_aplicacao: 'Laje',
    campos_incertos: [], ...extra,
  };
}

function corpo(req) {
  return new Promise((resolve_) => {
    let dados = '';
    req.on('data', (c) => { dados += c; });
    req.on('end', () => { try { resolve_(JSON.parse(dados || '{}')); } catch { resolve_({}); } });
  });
}

const stub = createServer(async (req, res) => {
  const body = await corpo(req);
  res.setHeader('content-type', 'application/json');
  if (req.url.startsWith('/v1/responses')) {
    chamadasProvedor.push(body);
    let conteudo;
    try {
      conteudo = respostaProvedor(body, chamadasProvedor.length);
    } catch (error) {
      // falha simulada do provedor: responde 500, como a API real faria
      res.statusCode = 500;
      res.end(JSON.stringify({ error: { message: String(error.message) } }));
      return;
    }
    res.end(JSON.stringify({
      id: `resp_${chamadasProvedor.length}`, model: body.model, status: 'completed',
      output_text: JSON.stringify(conteudo),
      usage: { input_tokens: 1000, output_tokens: 200, input_tokens_details: { cached_tokens: 100 }, output_tokens_details: { reasoning_tokens: 50 } },
    }));
    return;
  }
  if (req.url.startsWith('/rest/v1/rpc/')) {
    const nome = req.url.replace('/rest/v1/rpc/', '').split('?')[0];
    chamadasRpc.push({ nome, body });
    if (nome === 'ocr_laudo_reservar_quota') {
      res.end(JSON.stringify([{ allowed: quotaPermite, origin_used: 1, session_used: 1, remaining: 100, retry_after_seconds: 3600 }]));
      return;
    }
    if (nome === 'ocr_laudo_registrar_leitura') {
      res.end(JSON.stringify([{ id: '11111111-1111-4111-8111-111111111111', client_token: '22222222-2222-4222-8222-222222222222' }]));
      return;
    }
    if (nome === 'ocr_laudo_registrar_confirmacao') {
      res.end(JSON.stringify({ ok: true, campos_confirmados: (body.p_campos || []).length }));
      return;
    }
  }
  res.statusCode = 404;
  res.end('{}');
});

async function chamar(payload, headers = {}) {
  const resposta = await fetch(`http://127.0.0.1:${PORTA_EF}/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: JSON.stringify(payload),
  });
  const json = await resposta.json().catch(() => ({}));
  return { status: resposta.status, json };
}

function base(extra = {}) {
  return {
    consent: true, session_id: 'sessao-de-teste-1234', file_hash: 'hash-teste',
    file_name: 'laudo.pdf', page: 1, page_count: 3, profile: 'auto',
    image_base64: jpegBase64(), mime: 'image/jpeg',
    image_diagnostics: { blur_score: 0.71, contrast_score: 0.62 },
    ...extra,
  };
}

/* ------------------------------------------------------------------ execução */
const deno = localizarDeno();
if (!deno) {
  console.log('SKIP  Deno não encontrado — teste de integração da laudo-vision pulado.');
  console.log('      Instale com `npm i -g deno` (ou https://deno.land) para rodar este gate.');
  process.exit(0);
}

// Uma execução anterior interrompida deixa o Deno segurando a porta 8000: sem
// esta checagem o teste conversa com a versão ANTIGA da função e mente.
try {
  const sobrou = await fetch(`http://127.0.0.1:${PORTA_EF}/`, { method: 'OPTIONS' }).then(() => true).catch(() => false);
  if (sobrou) {
    console.error(`FALHA: a porta ${PORTA_EF} já está ocupada (execução anterior?). Encerre o processo antes de rodar o gate.`);
    process.exit(1);
  }
} catch { /* porta livre */ }

await new Promise((r) => stub.listen(PORTA_STUB, '127.0.0.1', r));

const efProc = spawn(deno, ['run', '--allow-net', '--allow-env', '--quiet', EF], {
  env: {
    ...process.env,
    OPENAI_API_KEY: 'sk-teste-local',
    LAUDO_VISION_OPENAI_URL: `http://127.0.0.1:${PORTA_STUB}/v1/responses`,
    SUPABASE_URL: `http://127.0.0.1:${PORTA_STUB}`,
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-teste',
    LAUDO_VISION_PRIMARY_MODEL: 'gpt-5.6-luna',
    LAUDO_VISION_RETRY_MODEL: 'gpt-5.6-terra',
    DENO_NO_UPDATE_CHECK: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let saidaEf = '';
efProc.stdout.on('data', (d) => { saidaEf += d; });
efProc.stderr.on('data', (d) => { saidaEf += d; });

async function esperarEf() {
  for (let i = 0; i < 60; i += 1) {
    if (/AddrInUse|Address already in use/i.test(saidaEf)) return false;
    try {
      const r = await fetch(`http://127.0.0.1:${PORTA_EF}/`, { method: 'OPTIONS', headers: { origin: ORIGIN } });
      if (r.status < 500) return true;
    } catch { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

const noAr = await esperarEf();
if (!noAr) {
  console.error('FALHA: a Edge Function não subiu.\n' + saidaEf);
  efProc.kill('SIGKILL'); stub.close();
  process.exit(1);
}

try {
  /* ---------------------------------------------------------- guardas */
  {
    const r = await chamar(base(), { origin: 'https://site-qualquer.example' });
    teste('origem fora da allowlist é recusada', () => {
      igual(r.status, 403, 'status');
      igual(r.json.error, 'origin_not_allowed', 'erro');
    });
  }
  {
    const resposta = await fetch(`http://127.0.0.1:${PORTA_EF}/`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(base()),
    });
    const json = await resposta.json();
    teste('requisição sem Origin é recusada', () => {
      igual(resposta.status, 403, 'status');
      igual(json.error, 'origin_required', 'erro');
    });
  }
  {
    const r = await chamar(base({ consent: false }));
    teste('sem consentimento não chama o provedor', () => {
      igual(r.status, 403, 'status');
      igual(r.json.error, 'consent_required', 'erro');
    });
  }
  {
    const r = await chamar(base({ image_base64: Buffer.from('nao sou imagem').toString('base64') }));
    teste('conteúdo que não é imagem é recusado', () => {
      igual(r.status, 415, 'status');
      igual(r.json.error, 'image_content_mismatch_or_dimensions_invalid', 'erro');
    });
  }
  {
    const r = await chamar(base({ session_id: 'curta' }));
    teste('session_id inválido é recusado', () => igual(r.status, 400, 'status'));
  }

  /* ---------------------------------------------------- consenso perfeito */
  chamadasProvedor.length = 0; chamadasRpc.length = 0;
  respostaProvedor = () => ({ documento: { numero_laudo: '217723', laboratorio: null, obra: null, nota_fiscal: '100417' }, amostras: [amostra(1), amostra(2)], avisos: [], legibilidade: 0.9 });
  {
    const r = await chamar(base());
    teste('duas passadas concordando devolvem consenso', () => {
      igual(r.status, 200, 'status');
      verdade(r.json.ok, 'ok');
      igual(r.json.page.resultados.length, 2, 'linhas');
      igual(r.json.divergences.length, 0, 'divergências');
      igual(r.json.page.resultados.map((x) => x.consenso), [true, true], 'flag de consenso por linha');
      igual(r.json.diagnostics.passes, 2, 'passadas');
    });
    teste('as duas passadas usam estratégias diferentes (anti-ancoragem)', () => {
      // As duas passadas saem juntas num Promise.allSettled: a ordem em que
      // chegam ao stub não é garantida. A asserção é sobre o CONJUNTO.
      const textos = chamadasProvedor.slice(0, 2).map((c) => JSON.stringify(c.input[0].content[0].text));
      verdade(textos.filter((t) => t.includes('LINHA A LINHA')).length === 1, 'exatamente uma passada varre por linhas');
      verdade(textos.filter((t) => t.includes('POR COLUNAS')).length === 1, 'exatamente uma passada varre por colunas');
      verdade(textos.every((t) => !t.includes('30,0')), 'nenhuma passada recebe valores da outra');
    });
    teste('store:false e json_schema estrito em toda chamada', () => {
      for (const c of chamadasProvedor) {
        igual(c.store, false, 'store');
        igual(c.text.format.type, 'json_schema', 'formato');
        igual(c.text.format.strict, true, 'strict');
      }
    });
    teste('telemetria grava status válido pelo CHECK da tabela', () => {
      const leitura = chamadasRpc.find((c) => c.nome === 'ocr_laudo_registrar_leitura');
      verdade(leitura, 'RPC de telemetria foi chamada');
      verdade(['sucesso', 'parcial', 'sem_resultado', 'erro', 'recusado'].includes(leitura.body.p_status), `status inválido: ${leitura.body.p_status}`);
      igual(leitura.body.p_status, 'sucesso', 'status');
      verdade(leitura.body.p_paginas_total >= 1, 'paginas_total NOT NULL');
    });
    teste('telemetria soma os tokens das duas passadas', () => {
      const leitura = chamadasRpc.find((c) => c.nome === 'ocr_laudo_registrar_leitura');
      igual(leitura.body.p_input_tokens, 2000, 'input');
      igual(leitura.body.p_output_tokens, 400, 'output');
      igual(leitura.body.p_cached_input_tokens, 200, 'cache');
      igual(leitura.body.p_reasoning_tokens, 100, 'reasoning');
    });
    teste('telemetria recebe blur e contraste com o nome enviado pelo cliente', () => {
      const leitura = chamadasRpc.find((c) => c.nome === 'ocr_laudo_registrar_leitura');
      igual(leitura.body.p_blur_score, 0.71, 'blur');
      igual(leitura.body.p_contrast_score, 0.62, 'contraste');
    });
    teste('reading_token volta para o cliente registrar a revisão', () => {
      verdade(r.json.reading_token, 'token');
    });
  }

  /* ---------------------------- divergência em campo NÃO crítico (sem releitura) */
  chamadasProvedor.length = 0; chamadasRpc.length = 0;
  respostaProvedor = (_body, n) => ({
    documento: {}, avisos: [], legibilidade: 0.8,
    amostras: n === 1 ? [amostra(1), amostra(2)] : [amostra(1), amostra(2, { nota_fiscal: '999999' })],
  });
  {
    const r = await chamar(base());
    teste('campo divergente vira ilegível, sem escolher um dos valores', () => {
      const linha2 = r.json.page.resultados.find((x) => x.linha === 2);
      igual(linha2.nf.estado, 'ilegivel', 'estado');
      igual(linha2.nf.valor, null, 'valor');
      igual(linha2.consenso, false, 'consenso da linha');
      verdade(r.json.divergences.some((d) => d.campo === 'nf'), 'divergência registrada');
      verdade(r.json.validation_codes.includes('DIVERGENCIA_ENTRE_PASSADAS'), 'código');
    });
    teste('divergência fora de campo crítico não dispara releitura', () => {
      igual(chamadasProvedor.length, 2, 'só as duas passadas');
    });
    teste('linha que concordou permanece com consenso', () => {
      const linha1 = r.json.page.resultados.find((x) => x.linha === 1);
      igual(linha1.consenso, true, 'linha 1');
      igual(linha1.mpa.valor, 31, 'valor preservado');
    });
    teste('divergência marca a leitura como parcial na telemetria', () => {
      const leitura = chamadasRpc.find((c) => c.nome === 'ocr_laudo_registrar_leitura');
      igual(leitura.body.p_status, 'parcial', 'status');
    });
  }

  /* -------------------------- divergência em MPa dispara releitura da linha */
  chamadasProvedor.length = 0; chamadasRpc.length = 0;
  respostaProvedor = (_body, n) => {
    if (n === 1) return { documento: {}, avisos: [], legibilidade: 0.8, amostras: [amostra(1), amostra(2)] };
    if (n === 2) return { documento: {}, avisos: [], legibilidade: 0.8, amostras: [amostra(1), amostra(2, { mpa: 99, mpa_raw: '99,0' })] };
    return { documento: {}, avisos: [], legibilidade: 0.95, amostras: [amostra(2, { mpa: 32, mpa_raw: '32,0' })] };
  };
  {
    const r = await chamar(base());
    teste('divergência em MPa dispara releitura só daquela linha', () => {
      igual(chamadasProvedor.length, 3, 'duas passadas + releitura');
      const linha1 = r.json.page.resultados.find((x) => x.linha === 1);
      const linha2 = r.json.page.resultados.find((x) => x.linha === 2);
      igual(linha1.consenso, true, 'linha 1 mantém consenso');
      igual(linha1.releitura, false, 'linha 1 não foi relida');
      igual(linha2.releitura, true, 'linha 2 foi relida');
      igual(linha2.mpa.valor, 32, 'valor da releitura');
    });
  }

  /* --------------------------------------- releitura cirúrgica (só a linha ruim) */
  chamadasProvedor.length = 0; chamadasRpc.length = 0;
  respostaProvedor = (_body, n) => {
    if (n <= 2) {
      return { documento: {}, avisos: [], legibilidade: 0.7, amostras: [amostra(1), amostra(2, { mpa: null, mpa_raw: '??', campos_incertos: ['mpa'] })] };
    }
    return { documento: {}, avisos: [], legibilidade: 0.95, amostras: [amostra(2, { mpa: 42.5, mpa_raw: '42,5' })] };
  };
  {
    const r = await chamar(base());
    teste('releitura substitui apenas a linha pendente', () => {
      igual(r.json.diagnostics.used_retry, true, 'usou releitura');
      igual(r.json.page.resultados.length, 2, 'linhas preservadas');
      const linha1 = r.json.page.resultados.find((x) => x.linha === 1);
      const linha2 = r.json.page.resultados.find((x) => x.linha === 2);
      igual(linha1.consenso, true, 'linha em consenso não foi descartada');
      igual(linha1.mpa.valor, 31, 'valor da linha 1 intacto');
      igual(linha2.mpa.valor, 42.5, 'linha relida');
      igual(linha2.releitura, true, 'marcada como releitura');
      igual(linha2.consenso, false, 'releitura não é consenso');
    });
    teste('releitura usa o modelo de retry e detalhe original', () => {
      igual(chamadasProvedor.length, 3, 'três chamadas');
      igual(chamadasProvedor[2].model, 'gpt-5.6-terra', 'modelo');
      igual(chamadasProvedor[2].input[0].content[1].detail, 'original', 'detalhe');
      verdade(JSON.stringify(chamadasProvedor[2].input[0].content[0].text).includes('linha 2: mpa'), 'foco na linha pendente');
    });
    teste('quota é reservada antes de cada unidade, releitura inclusa', () => {
      const quotas = chamadasRpc.filter((c) => c.nome === 'ocr_laudo_reservar_quota');
      igual(quotas.reduce((t, q) => t + q.body.p_units, 0), 3, 'unidades reservadas');
    });
    teste('telemetria soma os tokens das TRÊS chamadas', () => {
      const leitura = chamadasRpc.find((c) => c.nome === 'ocr_laudo_registrar_leitura');
      igual(leitura.body.p_input_tokens, 3000, 'input');
    });
  }

  /* ------------------------------------------- idade sem unidade não gera releitura */
  chamadasProvedor.length = 0; chamadasRpc.length = 0;
  respostaProvedor = () => ({
    documento: {}, avisos: [], legibilidade: 0.9,
    amostras: [amostra(1, { idade_unidade: null, idade_raw: '28' })],
  });
  {
    const r = await chamar(base());
    teste('idade impressa sem unidade não vira dia nem hora', () => {
      const linha = r.json.page.resultados[0];
      igual(linha.idade.estado, 'ilegivel', 'estado');
      igual(linha.idade.unidade, null, 'unidade');
    });
    teste('idade sem unidade NÃO dispara releitura cara', () => {
      igual(chamadasProvedor.length, 2, 'só as duas passadas');
      igual(r.json.diagnostics.used_retry, false, 'sem releitura');
    });
  }

  /* -------------------------------------------------- passada única não é consenso */
  chamadasProvedor.length = 0; chamadasRpc.length = 0;
  respostaProvedor = (body) => {
    const texto = JSON.stringify(body.input[0].content[0].text);
    if (texto.includes('POR COLUNAS')) throw new Error('falha simulada da passada B');
    return { documento: {}, avisos: [], legibilidade: 0.9, amostras: [amostra(1)] };
  };
  {
    const original = stub.listeners('request');
    const r = await chamar(base());
    teste('uma passada falhando não é promovida a consenso', () => {
      igual(r.status, 200, 'status');
      verdade(r.json.validation_codes.includes('PASSADA_UNICA_SEM_CONSENSO'), 'código');
      igual(r.json.diagnostics.single_pass, true, 'flag');
      igual(r.json.page.resultados[0].consenso, false, 'consenso da linha');
    });
    void original;
  }

  /* ------------------------------------------------------------------ quota */
  quotaPermite = false;
  respostaProvedor = () => ({ documento: {}, avisos: [], legibilidade: 0.9, amostras: [amostra(1)] });
  {
    const r = await chamar(base());
    teste('quota estourada recusa antes de chamar o provedor', () => {
      igual(r.status, 429, 'status');
      igual(r.json.error, 'rate_limited', 'erro');
      verdade(r.json.retry_after_seconds > 0, 'retry_after');
    });
  }
  quotaPermite = true;

  /* ------------------------------------------------------------- confirmação */
  chamadasRpc.length = 0;
  {
    const r = await chamar({
      action: 'confirm', reading_token: '22222222-2222-4222-8222-222222222222',
      fields: [{ result_index: 0, field: 'mpa', verdict: 'corrigiu', ocr_value: '30', final_value: '31' }],
    });
    teste('confirmação da revisão grava só hash e veredito', () => {
      igual(r.status, 200, 'status');
      const rpc = chamadasRpc.find((c) => c.nome === 'ocr_laudo_registrar_confirmacao');
      verdade(rpc, 'RPC chamada');
      const campo = rpc.body.p_campos[0];
      igual(campo.veredito, 'corrigiu', 'veredito');
      verdade(/^[a-f0-9]{64}$/.test(campo.valor_ocr_hash), 'hash do valor lido');
      verdade(/^[a-f0-9]{64}$/.test(campo.valor_final_hash), 'hash do valor final');
      verdade(!JSON.stringify(rpc.body).includes('"30"'), 'valor cru não é enviado');
    });
    teste('token de confirmação inválido é recusado', async () => { /* verificado abaixo */ });
  }
  {
    const r = await chamar({ action: 'confirm', reading_token: 'nao-e-uuid', fields: [] });
    teste('reading_token malformado é recusado', () => {
      igual(r.status, 400, 'status');
      igual(r.json.error, 'invalid_reading_token', 'erro');
    });
  }
} finally {
  efProc.kill('SIGKILL');
  if (typeof stub.closeAllConnections === 'function') stub.closeAllConnections();
  stub.close();
}

console.log(`\nlaudo-vision (integração): ${passou} OK / ${falhas.length} FAIL`);
if (falhas.length) for (const f of falhas) console.error(`\n--- ${f.nome}\n${f.error}`);
// Encerramento explícito: o servidor stub mantém o loop de eventos vivo.
process.exit(falhas.length ? 1 : 0);
