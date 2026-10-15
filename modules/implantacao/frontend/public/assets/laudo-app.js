import * as pdfjsLib from '/vendor/pdf.mjs';
import * as XlsxStyleLite from '/assets/xlsx-style-lite.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.mjs';

const APP_VERSION = '5.0.22-51';
const PIPELINE_VERSION = 'laudo-ocr-1.0.0';
const VISION_ENDPOINT = 'https://yglcnirbnbwjqpvalqif.supabase.co/functions/v1/laudo-vision';
const MAX_FILE_BYTES = 60 * 1024 * 1024;
const MAX_DOCUMENT_PAGES = 200;
const MAX_VISION_PAGES = 40;
const MAX_IMAGE_BYTES = 1_600_000;
const VISION_KEYWORDS = /(?:mpa|resist[êe]ncia|ruptura|compress[ãa]o|corpo de prova|prisma|c\.p\.)/i;
const CRITICAL_CODES = new Set([
  'MPA_FORA_DE_FAIXA', 'MPA_PARECE_CARGA', 'IDADE_FORA_DA_LISTA',
  'IDADE_DIVERGE_DATAS', 'ROMPIMENTO_ANTES_DA_MOLDAGEM',
  'DIVERGENCIA_ENTRE_PASSADAS', 'ALIAS_GENERICO_DETECTADO',
  'CAMPO_ILEGIVEL', 'LAUDO_SEM_RESULTADO',
]);
const FIELD_NAMES = ['cp', 'nf', 'idade', 'mpa', 'carga', 'area', 'dataMoldagem', 'dataRompimento', 'fckProjeto', 'slump', 'traco', 'localAplicacao'];

const $ = (selector) => document.querySelector(selector);
const parser = window.LaudoParserCore;
const invariants = window.LaudoInvariantes;
const profiles = window.LaudoPerfis;

if (!parser || !invariants || !profiles) {
  throw new Error('Os módulos do OCR de laudos não foram carregados.');
}

const state = {
  entries: new Map(),
  documents: new Map(),
  rows: [],
  busy: false,
  cancelled: false,
  abortControllers: new Set(),
  openDetails: new Set(),
  sessionId: getSessionId(),
  batchStartedAt: null,
};

function getSessionId() {
  const key = 'laudo_ocr_session_id';
  try {
    const existing = sessionStorage.getItem(key);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char]));
}
function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function formatNumber(value, digits = 1) {
  return Number.isFinite(Number(value))
    ? Number(value).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '';
}
function valueOf(field) {
  return field && field.estado === 'valor' ? field.valor : null;
}
function rawOf(field) {
  return field && field.raw != null ? String(field.raw) : '';
}
function normalizeComparable(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Math.round(value * 1000) / 1000;
  return String(value).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
}
function sameValue(a, b) {
  return normalizeComparable(a) === normalizeComparable(b);
}
function toast(message, tone = 'info', timeout = 5200) {
  const region = $('#toast-region');
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => el.remove(), timeout);
}
function setGlobalStatus(text, busy = state.busy) {
  $('#global-status').textContent = text;
  $('#busy-spinner').classList.toggle('hidden', !busy);
}
function uniqueId(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
function dateTimeIso() { return new Date().toISOString(); }

async function sha256Blob(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function median(values) {
  if (!values.length) return 5;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

async function positionalText(page) {
  const content = await page.getTextContent({ includeMarkedContent: false });
  const items = [];
  for (const item of content.items || []) {
    const str = item && typeof item.str === 'string' ? item.str : '';
    const transform = item && item.transform;
    if (!str.trim() || !Array.isArray(transform)) continue;
    items.push({ str, x: Number(transform[4]) || 0, y: Number(transform[5]) || 0, width: Number(item.width) || 0 });
  }
  const charWidths = items
    .filter((item) => item.str.trim().length >= 2 && item.width > 0)
    .map((item) => item.width / item.str.length)
    .filter((value) => value > 0.2 && value < 50);
  const charWidth = median(charWidths);
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const item of items) {
    const previous = lines.at(-1);
    if (previous && Math.abs(previous[0].y - item.y) <= 2) previous.push(item);
    else lines.push([item]);
  }
  return lines.map((line) => {
    line.sort((a, b) => a.x - b.x);
    let output = '';
    for (const item of line) {
      const column = Math.max(0, Math.round(item.x / charWidth));
      if (column > output.length) output += ' '.repeat(column - output.length);
      else if (output.length && !output.endsWith(' ')) output += ' ';
      output += item.str;
    }
    return output.replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '');
  }).join('\n');
}

async function loadPdf(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data: bytes, useWorkerFetch: true, isEvalSupported: false });
  // V15 — PDF corrompido ou protegido rejeitava aqui e deixava task e worker
  // vivos até o fim da sessão.
  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (error) {
    await loadingTask.destroy().catch(() => undefined);
    throw error;
  }
  if (doc.numPages > MAX_DOCUMENT_PAGES) {
    await loadingTask.destroy();
    throw new Error(`PDF com ${doc.numPages} páginas; o limite de segurança é ${MAX_DOCUMENT_PAGES}.`);
  }
  return { doc, loadingTask };
}

async function extractTextPages(pdfDoc, entry) {
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber += 1) {
    if (state.cancelled) throw new DOMException('Cancelado', 'AbortError');
    const page = await pdfDoc.getPage(pageNumber);
    const text = await positionalText(page);
    pages.push(text);
    entry.progress = Math.round(5 + pageNumber / pdfDoc.numPages * 22);
    entry.message = `Lendo texto · página ${pageNumber}/${pdfDoc.numPages}`;
    renderFiles();
  }
  return pages;
}

function trimWhiteMargins(source) {
  const ctx = source.getContext('2d', { willReadFrequently: true });
  if (!ctx || source.width < 40 || source.height < 40) return { canvas: source, trimmed: false };
  const step = Math.max(2, Math.floor(Math.max(source.width, source.height) / 900));
  const data = ctx.getImageData(0, 0, source.width, source.height).data;
  let minX = source.width; let minY = source.height; let maxX = 0; let maxY = 0; let found = false;
  for (let y = 0; y < source.height; y += step) {
    for (let x = 0; x < source.width; x += step) {
      const i = (y * source.width + x) * 4;
      const dark = Math.min(data[i], data[i + 1], data[i + 2]) < 242 && data[i + 3] > 12;
      if (!dark) continue;
      found = true;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  }
  if (!found) return { canvas: source, trimmed: false };
  const pad = Math.max(18, Math.round(Math.min(source.width, source.height) * 0.012));
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(source.width - 1, maxX + pad); maxY = Math.min(source.height - 1, maxY + pad);
  const width = maxX - minX + 1; const height = maxY - minY + 1;
  if (width > source.width * 0.96 && height > source.height * 0.96) return { canvas: source, trimmed: false };
  const target = document.createElement('canvas'); target.width = width; target.height = height;
  target.getContext('2d').drawImage(source, minX, minY, width, height, 0, 0, width, height);
  return { canvas: target, trimmed: true, crop: { x: minX, y: minY, width, height } };
}

function diagnoseCanvas(canvas) {
  const longSide = 320;
  const scale = Math.min(1, longSide / Math.max(canvas.width, canvas.height));
  const sample = document.createElement('canvas');
  sample.width = Math.max(1, Math.round(canvas.width * scale));
  sample.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = sample.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, sample.width, sample.height);
  const rgba = ctx.getImageData(0, 0, sample.width, sample.height).data;
  const gray = new Float32Array(sample.width * sample.height);
  let sum = 0;
  for (let i = 0, p = 0; i < rgba.length; i += 4, p += 1) {
    const value = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
    gray[p] = value; sum += value;
  }
  const mean = sum / Math.max(1, gray.length);
  let variance = 0; let edgeSum = 0; let edgeSq = 0; let edgeCount = 0;
  for (let y = 1; y < sample.height - 1; y += 1) {
    for (let x = 1; x < sample.width - 1; x += 1) {
      const i = y * sample.width + x;
      const d = gray[i] - mean; variance += d * d;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - sample.width] - gray[i + sample.width];
      edgeSum += lap; edgeSq += lap * lap; edgeCount += 1;
    }
  }
  const contrast = Math.sqrt(variance / Math.max(1, gray.length));
  const edgeMean = edgeSum / Math.max(1, edgeCount);
  const edgeVariance = edgeSq / Math.max(1, edgeCount) - edgeMean * edgeMean;
  const blurScore = Math.max(0, Math.min(1, edgeVariance / 700));
  const contrastScore = Math.max(0, Math.min(1, contrast / 65));
  const warnings = [];
  if (Math.max(canvas.width, canvas.height) < 1800) warnings.push('baixa_resolucao');
  if (blurScore < 0.24) warnings.push('possivel_desfoque');
  if (contrastScore < 0.28) warnings.push('baixo_contraste');
  return {
    width: canvas.width, height: canvas.height,
    blur_score: Math.round(blurScore * 100) / 100,
    contrast_score: Math.round(contrastScore * 100) / 100,
    warnings,
  };
}

function dataUrlBytes(dataUrl) {
  const b64 = dataUrl.split(',')[1] || '';
  const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return Math.floor(b64.length * 3 / 4) - padding;
}

async function renderPageForVision(pdfDoc, pageNumber) {
  const page = await pdfDoc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const targetLongSide = 3000;
  let scale = Math.min(4.2, Math.max(1.6, targetLongSide / Math.max(base.width, base.height)));
  let canvas = document.createElement('canvas');
  let viewport = page.getViewport({ scale });
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  let ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const trimmed = trimWhiteMargins(canvas);
  canvas = trimmed.canvas;
  const diagnostics = { ...diagnoseCanvas(canvas), trimmed: trimmed.trimmed, crop: trimmed.crop || null };
  let quality = 0.9;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrlBytes(dataUrl) > MAX_IMAGE_BYTES && quality > 0.64) {
    quality -= 0.06;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  while (dataUrlBytes(dataUrl) > MAX_IMAGE_BYTES && Math.max(canvas.width, canvas.height) > 1800) {
    scale *= 0.84;
    const smaller = document.createElement('canvas');
    smaller.width = Math.max(1, Math.round(canvas.width * 0.84));
    smaller.height = Math.max(1, Math.round(canvas.height * 0.84));
    smaller.getContext('2d').drawImage(canvas, 0, 0, smaller.width, smaller.height);
    canvas = smaller;
    quality = 0.82;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrlBytes(dataUrl) > MAX_IMAGE_BYTES) {
    liberarCanvas(canvas);
    page.cleanup();
    throw new Error(`Página ${pageNumber}: imagem não coube no limite seguro de upload.`);
  }
  diagnostics.width = canvas.width; diagnostics.height = canvas.height;
  diagnostics.bytes = dataUrlBytes(dataUrl); diagnostics.jpeg_quality = Math.round(quality * 100) / 100;
  const saida = { base64: dataUrl.split(',')[1], mime: 'image/jpeg', diagnostics };
  // V15 — sem liberar, o orçamento de canvas do Safari/iOS estourava por volta
  // da 20ª página e toDataURL passava a devolver imagem vazia, sem erro.
  liberarCanvas(canvas);
  page.cleanup();
  return saida;
}

/** Zera o canvas para devolver a memória de imagem antes do GC. */
function liberarCanvas(canvas) {
  try { canvas.width = 0; canvas.height = 0; } catch (_) { /* ignora */ }
}

function localPageErrors(document, page) {
  return (document.validation || []).filter((finding) => {
    if (!CRITICAL_CODES.has(finding.code)) return false;
    const result = document.resultados.find((r) => r.id === finding.entityTemporaryId);
    return result && Number(result.origem && result.origem.pagina) === page;
  });
}

function pageLooksLikeResultTable(text, previousText, nextText) {
  if (VISION_KEYWORDS.test(text)) return true;
  const lines = String(text || '').split(/\r?\n/).filter((line) => line.trim());
  const numericRows = lines.filter((line) => {
    const numbers = line.match(/\d+(?:[.,]\d+)?/g) || [];
    return numbers.length >= 3 && /\d+[.,]\d+/.test(line);
  }).length;
  const neighborHasHeader = VISION_KEYWORDS.test(previousText || '') || VISION_KEYWORDS.test(nextText || '');
  return numericRows >= 2 && (neighborHasHeader || lines.length >= 8);
}
function chooseVisionPages(textPages, localDocument) {
  const candidates = [];
  const notProcessed = [];
  textPages.forEach((text, index) => {
    const page = index + 1;
    const localRows = localDocument.resultados.filter((result) => Number(result.origem && result.origem.pagina) === page);
    const scanned = parser.parecePaginaEscaneada(text);
    const looksLikeResults = pageLooksLikeResultTable(text, textPages[index - 1], textPages[index + 1]);
    const hasCriticalError = localPageErrors(localDocument, page).length > 0;
    if ((scanned && (!localRows.length || hasCriticalError)) || (looksLikeResults && (!localRows.length || hasCriticalError))) {
      candidates.push({ page, reason: scanned ? 'pagina_escaneada' : !localRows.length ? 'sem_resultado_local' : 'validacao_critica' });
    }
  });
  if (candidates.length > MAX_VISION_PAGES) {
    notProcessed.push(...candidates.slice(MAX_VISION_PAGES).map((item) => item.page));
    candidates.length = MAX_VISION_PAGES;
  }
  return { candidates, notProcessed };
}

async function callVision(payload) {
  const controller = new AbortController();
  state.abortControllers.add(controller);
  const timer = setTimeout(() => controller.abort(), 75_000);
  try {
    const response = await fetch(VISION_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok !== true) {
      const reason = body.error || `HTTP ${response.status}`;
      throw new Error(`Visão: ${reason}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
    state.abortControllers.delete(controller);
  }
}

function visionField(field, type = 'text') {
  const f = field && typeof field === 'object' ? field : { estado: 'ausente', valor: null, raw: null, motivo: null };
  let value = f.valor;
  if (type === 'number') {
    const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
    value = Number.isFinite(n) ? n : null;
  } else value = value == null ? null : String(value).trim() || null;
  const status = ['valor', 'ausente', 'ilegivel'].includes(f.estado) ? f.estado : value == null ? 'ilegivel' : 'valor';
  return { estado: status === 'valor' && value == null ? 'ilegivel' : status, valor: status === 'valor' ? value : null, raw: f.raw == null ? null : String(f.raw), motivo: f.motivo == null ? null : String(f.motivo) };
}

function visionResultsToContract(response, fileEntry) {
  const page = response.page;
  const source = response.diagnostics && response.diagnostics.used_retry ? 'visao-retry' : 'visao-consenso';
  const results = (page.resultados || []).map((r, index) => ({
    id: `tmp-${fileEntry.hash.slice(0, 8)}-${page.pagina}-${String(index + 1).padStart(3, '0')}`,
    cp: visionField(r.cp), nf: visionField(r.nf),
    idade: { ...visionField(r.idade, 'number'), unidade: r.idade && (r.idade.unidade === 'dia' || r.idade.unidade === 'hora') ? r.idade.unidade : null },
    mpa: { ...visionField(r.mpa, 'number'), valorBruto: r.mpa && typeof r.mpa.valor === 'number' ? r.mpa.valor : null },
    carga: visionField(r.carga, 'number'), area: visionField(r.area, 'number'),
    dataMoldagem: visionField(r.data_moldagem), dataRompimento: visionField(r.data_rompimento),
    fckProjeto: visionField(r.fck_projeto, 'number'), slump: visionField(r.slump),
    traco: visionField(r.traco), localAplicacao: visionField(r.local_aplicacao),
    origem: { pagina: page.pagina, linha: Number.isInteger(r.linha) ? r.linha : null, coluna: null, textoLinha: null, fonte: source },
    confianca: {
      nivel: page.legibilidade >= 0.86 ? 'alta' : page.legibilidade >= 0.62 ? 'media' : 'baixa',
      score: page.legibilidade ?? null,
      // V15 — a Edge Function marca `consenso` por linha. Deduzir concordância da
      // ausência de divergências dava `true` também na passada única e na
      // releitura, e a linha ganhava bônus de confiança sem ter sido conferida.
      concordanciaPassadas: r.consenso === true,
      legibilidade: page.legibilidade ?? null,
    },
    revisaoHumana: { status: 'pendente', valorAnterior: null, por: null, em: null },
    candidatos: (response.divergences || []).filter((d) => d.resultIndex === index),
    _visionResultIndex: index,
  }));
  return {
    page: page.pagina,
    source,
    results,
    laudoNumero: valueOf(visionField(page.laudo_numero)),
    laboratory: valueOf(visionField(page.laboratorio)),
    work: valueOf(visionField(page.obra)),
    warnings: page.avisos || [],
    validationCodes: response.validation_codes || [],
    diagnostics: response.diagnostics || {},
    readingToken: response.reading_token || null,
  };
}

function mergeLocalAndVision(localResults, visionResults, page) {
  if (!localResults.length) return visionResults;
  // V15 — o recompute reescreve `nivel`/`score` a partir de legibilidade e
  // concordância, então rebaixar só esses dois campos era código morto: a linha
  // voltava a aparecer como "alta" na tela.
  if (!visionResults.length) {
    return localResults.map((r) => ({
      ...r,
      confianca: {
        ...r.confianca,
        nivel: 'baixa',
        score: Math.min(r.confianca.score || 0.5, 0.45),
        concordanciaPassadas: false,
        legibilidade: Math.min(r.confianca.legibilidade == null ? 0.45 : r.confianca.legibilidade, 0.45),
      },
    }));
  }
  const merged = invariants.consenso(localResults, visionResults, { pagina: page, fonte: 'misto' });
  // V15 — o pareamento do consenso não é posicional; reatribuir o id por índice
  // fazia a proveniência apontar para outra linha da página.
  return merged.resultados.map((result) => ({
    ...result,
    origem: { ...(result.origem || {}), pagina: page, fonte: 'misto' },
  }));
}

async function parallelMap(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, async () => {
    while (true) {
      const current = next; next += 1;
      if (current >= items.length) return;
      if (state.cancelled) return; // V15 — parar sem lançar: quem cancelou já sabe
      results[current] = await worker(items[current], current);
    }
  });
  // V15 — allSettled em vez de all: com `all`, o primeiro runner a rejeitar
  // devolvia o controle enquanto os outros seguiam vivos. O lote era declarado
  // encerrado, o botão Limpar reabria e um documento ainda em voo ressuscitava
  // depois numa tabela supostamente vazia.
  const settled = await Promise.allSettled(runners);
  const erro = settled.find((r) => r.status === 'rejected');
  if (erro && !(erro.reason && erro.reason.name === 'AbortError')) throw erro.reason;
  return results;
}

function appendExternalValidation(document, code, severity, message, path = null, metadata = null) {
  document.validation = document.validation || [];
  document.validation.push({ code, severity, message, path, entityTemporaryId: null, suggestedFix: null, metadata, _external: true });
}

function recomputeDocument(document) {
  const external = (document.validation || []).filter((finding) => finding._external === true);
  const validated = invariants.validarDocumento({ ...document, validation: [] });
  // V15 — validarDocumento REGERA PAGINA_NAO_PROCESSADA/PAGINA_ILEGIVEL a partir
  // do diagnóstico. Reanexar sem deduplicar somava N achados fantasma a cada
  // recomputação (uma por edição de célula), inflando o painel e a aba
  // Validações do Excel sem limite.
  const chave = (f) => `${f.code}|${f.path || ''}|${f.metadata && f.metadata.page || ''}`;
  const jaGerados = new Set(validated.validation.map(chave));
  for (const finding of external) {
    if (jaGerados.has(chave(finding))) continue;
    jaGerados.add(chave(finding));
    validated.validation.push(finding);
  }
  return validated;
}

async function processFile(entry) {
  entry.status = 'processing'; entry.message = 'Calculando hash…'; entry.progress = 2; renderFiles();
  entry.hash = await sha256Blob(entry.file);
  const { doc, loadingTask } = await loadPdf(entry.file);
  entry.pages = doc.numPages;
  try {
    const textPages = await extractTextPages(doc, entry);
    const joinedText = textPages.join('\f');
    const profile = $('#profile-select').value;
    let document = parser.parseDocumentoTexto(joinedText, { perfil: profile === 'auto' ? null : profile, incluirCustomerInput: true });
    document.metadata = {
      ...document.metadata,
      schemaVersion: '1.0.0', pipelineVersion: PIPELINE_VERSION,
      geradoEm: dateTimeIso(), modelo: null,
      arquivo: { nome: entry.file.name, sha256: entry.hash, paginas: doc.numPages, bytes: entry.file.size },
    };
    document.diagnostico = {
      ...document.diagnostico,
      paginasComTexto: textPages.filter((pageText) => !parser.parecePaginaEscaneada(pageText)).length,
      paginasEscaneadas: textPages.filter((pageText) => parser.parecePaginaEscaneada(pageText)).length,
      paginasProcessadasPorIA: 0, paginasIgnoradas: 0, qualidade: [], readingTokens: {},
    };
    document._fileId = entry.id;
    document._fileName = entry.file.name;
    document = recomputeDocument(document);

    const selection = chooseVisionPages(textPages, document);
    if (selection.notProcessed.length) {
      document.diagnostico.paginasIgnoradas += selection.notProcessed.length;
      document.diagnostico.paginasNaoProcessadas = selection.notProcessed;
      selection.notProcessed.forEach((page) => appendExternalValidation(document, 'PAGINA_NAO_PROCESSADA', 'error', `Página ${page} excedeu o teto de ${MAX_VISION_PAGES} páginas enviadas à visão por PDF.`, 'diagnostico.paginasIgnoradas', { page }));
    }

    const visionEnabled = $('#vision-enabled').checked;
    const consent = $('#vision-consent').checked;
    if (selection.candidates.length && !visionEnabled) {
      selection.candidates.forEach(({ page }) => appendExternalValidation(document, 'PAGINA_NAO_PROCESSADA', 'warning', `Página ${page} precisa de visão, mas o recurso foi desativado.`, 'diagnostico.paginasProcessadasPorIA', { page }));
      entry.message = `${document.resultados.length} resultado(s) local(is) · visão desativada`;
    } else if (selection.candidates.length && visionEnabled && !consent) {
      selection.candidates.forEach(({ page }) => appendExternalValidation(document, 'PAGINA_NAO_PROCESSADA', 'warning', `Página ${page} precisa de visão, mas o consentimento não foi concedido.`, 'diagnostico.paginasProcessadasPorIA', { page }));
      entry.message = `${document.resultados.length} resultado(s) local(is) · IA não autorizada`;
    } else if (selection.candidates.length && visionEnabled && consent) {
      const pageConcurrency = Number($('#page-concurrency').value) || 2;
      let completedVisionPages = 0;
      const visionPages = await parallelMap(selection.candidates, pageConcurrency, async (candidate) => {
        entry.message = `Visão · página ${candidate.page}/${doc.numPages}`;
        renderFiles();
        try {
          const image = await renderPageForVision(doc, candidate.page);
          const response = await callVision({
            consent: true,
            session_id: state.sessionId,
            file_hash: entry.hash,
            file_name: entry.file.name,
            page: candidate.page,
            page_count: doc.numPages,
            profile,
            image_base64: image.base64,
            mime: image.mime,
            image_diagnostics: image.diagnostics,
          });
          const converted = visionResultsToContract(response, entry);
          converted.imageDiagnostics = image.diagnostics;
          return { ok: true, value: converted };
        } catch (error) {
          return { ok: false, page: candidate.page, error: error instanceof Error ? error.message : String(error) };
        } finally {
          completedVisionPages += 1;
          entry.progress = Math.round(30 + (completedVisionPages / Math.max(1, selection.candidates.length)) * 58);
          renderFiles();
        }
      });

      for (const outcome of visionPages) {
        if (!outcome.ok) {
          document.diagnostico.paginasIgnoradas += 1;
          document.diagnostico.qualidade.push({ pagina: outcome.page, erro: outcome.error, provider: null });
          appendExternalValidation(document, 'PAGINA_NAO_PROCESSADA', 'warning', `A visão da página ${outcome.page} falhou. Os resultados locais das demais páginas foram preservados.`, `pagina[${outcome.page}]`, { page: outcome.page, reason: outcome.error });
          continue;
        }
        const visionPage = outcome.value;
        const page = visionPage.page;
        const local = document.resultados.filter((r) => Number(r.origem && r.origem.pagina) === page);
        const untouched = document.resultados.filter((r) => Number(r.origem && r.origem.pagina) !== page);
        document.resultados = [...untouched, ...mergeLocalAndVision(local, visionPage.results, page)]
          .sort((a, b) => Number(a.origem && a.origem.pagina || 0) - Number(b.origem && b.origem.pagina || 0) || Number(a.origem && a.origem.linha || 0) - Number(b.origem && b.origem.linha || 0));
        document.diagnostico.paginasProcessadasPorIA += 1;
        document.diagnostico.qualidade.push({ pagina: page, ...visionPage.imageDiagnostics, provider: visionPage.diagnostics });
        if (visionPage.readingToken) document.diagnostico.readingTokens[page] = visionPage.readingToken;
        for (const code of visionPage.validationCodes) {
          const severidade = invariants.severidadeDoCodigo ? invariants.severidadeDoCodigo(code, 'warning') : 'warning';
          appendExternalValidation(document, code, severidade, `Validação do proxy na página ${page}: ${code}.`, `pagina[${page}]`, { page, source: 'laudo-vision' });
        }
        if (!document.metadata.laudoNum && visionPage.laudoNumero) document.metadata.laudoNum = visionPage.laudoNumero;
        if (!document.contexto.laboratorio && visionPage.laboratory) document.contexto.laboratorio = visionPage.laboratory;
        if (!document.contexto.obra && visionPage.work) document.contexto.obra = visionPage.work;
      }
      document.metadata.modelo = 'gpt-5.6-luna → gpt-5.6-terra sob condição';
      document.metadata.promptVersion = 'laudo-vision-1.0.0';
      const sources = new Set(document.resultados.map((r) => r.origem && r.origem.fonte));
      document.metadata.fonte = sources.size > 1 ? 'misto' : [...sources][0] || document.metadata.fonte;
    }

    // V15 — se o lote foi cancelado enquanto este arquivo terminava, o
    // documento NÃO entra no estado: antes ele ressuscitava numa tabela já
    // limpa pelo usuário, com um entry que não existia mais.
    if (state.cancelled) throw new DOMException('Cancelado', 'AbortError');
    document = recomputeDocument(document);
    document.resultados.forEach((result) => {
      result._ocrSnapshot = snapshotResult(result);
      result._fileId = entry.id;
      result._fileName = entry.file.name;
    });
    state.documents.set(entry.id, document);
    entry.status = document.resultados.length ? 'done' : 'warning';
    entry.progress = 100;
    entry.message = document.resultados.length
      ? `${document.resultados.length} resultado(s) · ${document.validation.filter((v) => v.severity === 'error').length} erro(s)`
      : 'Nenhum resultado reconhecido';
    rebuildRows();
  } finally {
    await loadingTask.destroy().catch(() => undefined);
  }
}

function snapshotResult(result) {
  const age = valueOf(result.idade);
  return {
    cp: valueOf(result.cp), nf: valueOf(result.nf),
    idade: age == null ? null : `${age}|${result.idade && result.idade.unidade || ''}`,
    mpa: valueOf(result.mpa), carga: valueOf(result.carga), area: valueOf(result.area),
    dataMoldagem: valueOf(result.dataMoldagem), dataRompimento: valueOf(result.dataRompimento),
    fckProjeto: valueOf(result.fckProjeto), slump: valueOf(result.slump),
    traco: valueOf(result.traco), localAplicacao: valueOf(result.localAplicacao),
  };
}

function rebuildRows() {
  state.rows = [];
  for (const [fileId, document] of state.documents) {
    document.resultados.forEach((result, index) => {
      state.rows.push({ fileId, document, result, resultIndex: index, fileName: document._fileName });
    });
  }
  renderResults();
}

function validationsForRow(row) {
  return (row.document.validation || []).filter((finding) => finding.entityTemporaryId === row.result.id);
}
function severityForRow(row) {
  const findings = validationsForRow(row);
  if (findings.some((f) => f.severity === 'error')) return 'error';
  if (findings.some((f) => f.severity === 'warning')) return 'warning';
  if (findings.some((f) => f.severity === 'info')) return 'info';
  return '';
}
function fieldStateAttr(field) { return field && field.estado || 'ausente'; }
function inputValue(field) { return valueOf(field) == null ? '' : String(valueOf(field)); }
function isCorrected(result, field) { return result._editedFields && result._editedFields.has(field); }
function ageLabel(result) {
  const value = valueOf(result.idade);
  if (value == null) return '';
  return `${value} ${result.idade.unidade === 'hora' ? (Number(value) === 1 ? 'hora' : 'horas') : (Number(value) === 1 ? 'dia' : 'dias')}`;
}

function filteredRows() {
  const query = $('#search-input').value.trim().toLowerCase();
  const status = $('#status-filter').value;
  const severity = $('#severity-filter').value;
  return state.rows.filter((row) => {
    const result = row.result;
    const haystack = [row.fileName, row.document.metadata.laudoNum, inputValue(result.nf), inputValue(result.cp), ageLabel(result), inputValue(result.mpa)].join(' ').toLowerCase();
    if (query && !haystack.includes(query)) return false;
    if (status && result.revisaoHumana.status !== status) return false;
    if (severity && severityForRow(row) !== severity) return false;
    return true;
  });
}

/**
 * V15 — os ids do caminho de texto são `tmp-<pagina>-<indice>`, iguais entre
 * arquivos diferentes. Sem o arquivo na chave, abrir os detalhes de uma linha
 * abria a linha equivalente de todos os outros laudos do lote.
 */
function detailKey(row) {
  return `${row.fileId}::${row.result.id}`;
}

function renderResults() {
  const section = $('#result-section');
  section.classList.toggle('hidden', !state.documents.size);
  // V15 — repintar a tabela inteira enquanto o operador digita destruía o
  // <input> em foco: o `change` nunca disparava e a digitação sumia. Durante o
  // lote, se o foco está dentro da tabela, só as estatísticas são atualizadas.
  const focado = typeof document !== 'undefined' ? document.activeElement : null;
  if (state.busy && focado && focado.closest && focado.closest('#results-body')) {
    renderStats();
    return;
  }
  const rows = filteredRows();
  const body = $('#results-body');
  body.innerHTML = '';
  $('#empty-results').classList.toggle('hidden', rows.length > 0);
  // V15 — indexOf dentro do forEach era O(n²); com 800 linhas a tela travava.
  const indiceDe = new Map(state.rows.map((r, i) => [r, i]));

  rows.forEach((row) => {
    const result = row.result;
    const globalIndex = indiceDe.get(row);
    const findings = validationsForRow(row);
    const severity = severityForRow(row);
    const tr = document.createElement('tr');
    tr.dataset.index = String(globalIndex);
    tr.dataset.state = result.revisaoHumana.status;
    tr.dataset.severity = severity;
    const corrected = (field) => isCorrected(result, field) ? ' is-corrected' : '';
    const stateHint = (field) => field && field.estado !== 'valor' ? `<span class="cell-flag">${escapeHtml(field.estado)}${field.motivo ? ` · ${escapeHtml(field.motivo)}` : ''}</span>` : '';
    tr.innerHTML = `
      <td class="num">${globalIndex + 1}</td>
      <td><span class="badge ${result.revisaoHumana.status === 'aceito' ? 'success' : result.revisaoHumana.status === 'corrigido' ? 'brand' : result.revisaoHumana.status === 'rejeitado' ? 'danger' : 'warning'}">${escapeHtml(result.revisaoHumana.status)}</span></td>
      <td class="wide" title="${escapeHtml(row.fileName)}">${escapeHtml(row.fileName)}</td>
      <td class="num">${escapeHtml(result.origem && result.origem.pagina || '')}</td>
      <td>${escapeHtml(row.document.metadata.laudoNum || '')}</td>
      <td><div class="cell-wrap" data-state="${escapeHtml(fieldStateAttr(result.cp))}"><input class="row-input${corrected('cp')}" data-field="cp" value="${escapeHtml(inputValue(result.cp))}" aria-label="Identificação do CP">${stateHint(result.cp)}</div></td>
      <td><div class="cell-wrap" data-state="${escapeHtml(fieldStateAttr(result.nf))}"><input class="row-input${corrected('nf')}" data-field="nf" value="${escapeHtml(inputValue(result.nf))}" aria-label="Nota fiscal">${stateHint(result.nf)}</div></td>
      <td><div class="cell-wrap" data-state="${escapeHtml(fieldStateAttr(result.idade))}"><input class="row-input mono-number${corrected('idade')}" data-field="idade" inputmode="decimal" value="${escapeHtml(inputValue(result.idade))}" aria-label="Idade">${stateHint(result.idade)}</div></td>
      <td><select class="row-select${corrected('idadeUnidade')}" data-field="idadeUnidade" aria-label="Unidade da idade"><option value="" ${!result.idade.unidade ? 'selected' : ''}>—</option><option value="dia" ${result.idade.unidade === 'dia' ? 'selected' : ''}>dias</option><option value="hora" ${result.idade.unidade === 'hora' ? 'selected' : ''}>horas</option></select></td>
      <td><div class="cell-wrap" data-state="${escapeHtml(fieldStateAttr(result.mpa))}"><input class="row-input mono-number${corrected('mpa')}" data-field="mpa" inputmode="decimal" value="${escapeHtml(inputValue(result.mpa))}" aria-label="Resistência em MPa">${stateHint(result.mpa)}</div></td>
      <td><div class="cell-wrap" data-state="${escapeHtml(fieldStateAttr(result.dataMoldagem))}"><input class="row-input${corrected('dataMoldagem')}" data-field="dataMoldagem" value="${escapeHtml(inputValue(result.dataMoldagem))}" aria-label="Data de moldagem"></div></td>
      <td><div class="cell-wrap" data-state="${escapeHtml(fieldStateAttr(result.dataRompimento))}"><input class="row-input${corrected('dataRompimento')}" data-field="dataRompimento" value="${escapeHtml(inputValue(result.dataRompimento))}" aria-label="Data de rompimento"></div></td>
      <td><span class="badge ${result.confianca.nivel === 'alta' ? 'success' : result.confianca.nivel === 'media' ? 'warning' : 'danger'}">${escapeHtml(result.confianca.nivel)}${result.confianca.score != null ? ` · ${Math.round(result.confianca.score * 100)}%` : ''}</span></td>
      <td><span class="badge info">${escapeHtml(result.origem && result.origem.fonte || '')}</span></td>
      <td class="actions"><div class="row-actions"><button class="icon-button accept" type="button" data-action="accept" aria-label="Aceitar linha" title="Aceitar">✓</button><button class="icon-button reject" type="button" data-action="reject" aria-label="Rejeitar linha" title="Rejeitar">×</button><button class="icon-button details" type="button" data-action="details" aria-label="Ver proveniência e achados" title="Detalhes">i</button><span class="badge ${severity === 'error' ? 'danger' : severity === 'warning' ? 'warning' : severity === 'info' ? 'info' : 'success'}">${findings.length} achado(s)</span></div></td>`;
    body.appendChild(tr);

    if (state.openDetails.has(detailKey(row))) {
      const details = document.createElement('tr');
      details.className = 'details-row';
      details.innerHTML = `<td colspan="15"><div class="details-panel"><div><h4>Proveniência e bruto preservado</h4><pre>${escapeHtml(JSON.stringify({ origem: result.origem, raw: { cp: rawOf(result.cp), nf: rawOf(result.nf), idade: rawOf(result.idade), mpa: rawOf(result.mpa), datas: [rawOf(result.dataMoldagem), rawOf(result.dataRompimento)] }, candidatos: result.candidatos || [], normalizacoes: result.normalizacoes || [] }, null, 2))}</pre></div><div><h4>Validações</h4><ul class="finding-list">${findings.length ? findings.map((finding) => `<li class="finding ${escapeHtml(finding.severity)}"><strong>${escapeHtml(finding.code)}</strong><span>${escapeHtml(finding.message)}</span>${finding.suggestedFix ? `<span>Sugestão: ${escapeHtml(finding.suggestedFix)}</span>` : ''}</li>`).join('') : '<li class="finding info"><span>Nenhum achado para esta linha.</span></li>'}</ul></div></div></td>`;
      body.appendChild(details);
    }
  });
  renderStats();
}

function renderStats() {
  const allFindings = [...state.documents.values()].flatMap((document) => document.validation || []);
  const accepted = state.rows.filter((row) => ['aceito', 'corrigido'].includes(row.result.revisaoHumana.status)).length;
  const pending = state.rows.filter((row) => row.result.revisaoHumana.status === 'pendente').length;
  const viaVision = state.rows.filter((row) => /visao/.test(row.result.origem && row.result.origem.fonte || '') || row.result.origem && row.result.origem.fonte === 'misto').length;
  const high = state.rows.filter((row) => row.result.confianca.nivel === 'alta').length;
  const stats = [
    [state.documents.size, 'laudos'], [state.rows.length, 'resultados'], [high, 'conf. alta'],
    [pending, 'pendentes'], [accepted, 'confirmados'], [viaVision, 'via visão/misto'],
  ];
  $('#stats-grid').innerHTML = stats.map(([value, label]) => `<div class="stat-card"><strong>${value}</strong><span>${label}</span></div>`).join('');
  $('#result-count-badge').textContent = `${filteredRows().length} de ${state.rows.length} linhas`;
  const counts = { error: 0, warning: 0, info: 0 };
  allFindings.forEach((finding) => { if (finding.severity in counts) counts[finding.severity] += 1; });
  $('#validation-summary').innerHTML = `<span class="validation-chip error">${counts.error} erro(s)</span><span class="validation-chip warning">${counts.warning} alerta(s)</span><span class="validation-chip info">${counts.info} informação(ões)</span>`;
}

function updateField(row, fieldName, rawValue) {
  const result = row.result;
  const before = snapshotResult(result);
  if (!result._editedFields) result._editedFields = new Set();
  result._editedFields.add(fieldName);
  if (fieldName === 'idadeUnidade') {
    result.idade.unidade = rawValue === 'dia' || rawValue === 'hora' ? rawValue : null;
    if (valueOf(result.idade) != null && !result.idade.unidade) {
      result.idade.estado = 'ilegivel'; result.idade.valor = null; result.idade.motivo = 'Unidade removida na revisão.';
    }
  } else {
    const target = result[fieldName];
    const numeric = fieldName === 'idade' || fieldName === 'mpa';
    let value = String(rawValue).trim();
    if (numeric) {
      const parsed = Number(value.replace(',', '.'));
      value = value === '' || !Number.isFinite(parsed) ? null : parsed;
    } else value = value || null;
    target.valor = value;
    target.estado = value == null ? 'ausente' : 'valor';
    target.motivo = null;
    if (fieldName === 'mpa') target.valorBruto = value;
  }
  result.revisaoHumana.status = 'corrigido';
  result.revisaoHumana.valorAnterior = before;
  result.revisaoHumana.em = dateTimeIso();
  row.document.audit.push({ timestamp: dateTimeIso(), actor: 'cliente', action: 'correcao', entity: `${result.id}.${fieldName}`, before, after: snapshotResult(result), source: 'revisao-humana' });
  const revalidated = recomputeDocument(row.document);
  state.documents.set(row.fileId, revalidated);
  revalidated.resultados.forEach((item) => { item._fileId = row.fileId; item._fileName = row.fileName; });
  rebuildRows();
}

function setReview(row, status, repintar = true) {
  row.result.revisaoHumana.status = status;
  row.result.revisaoHumana.em = dateTimeIso();
  row.document.audit.push({ timestamp: dateTimeIso(), actor: 'cliente', action: status, entity: row.result.id, before: null, after: snapshotResult(row.result), source: 'revisao-humana' });
  // V15 — repintar dentro do laço de "Aceitar visíveis" custava uma repintura
  // completa por linha (601 repinturas em 600 linhas).
  if (repintar) renderResults();
}

function renderFiles() {
  const list = $('#file-list');
  const wrap = $('#file-list-wrap');
  wrap.classList.toggle('hidden', state.entries.size === 0);
  list.innerHTML = '';
  for (const entry of state.entries.values()) {
    const tone = entry.status === 'done' ? 'success' : entry.status === 'error' ? 'danger' : entry.status === 'warning' ? 'warning' : 'info';
    const li = document.createElement('li');
    li.className = 'file-item';
    li.innerHTML = `<div><div class="file-item__name">${escapeHtml(entry.file.name)}</div><div class="file-item__meta"><span>${formatBytes(entry.file.size)}</span>${entry.pages ? `<span>${entry.pages} página(s)</span>` : ''}<span>${escapeHtml(entry.message || '')}</span></div><div class="progress-track" aria-label="Progresso"><span style="--progress:${Math.max(0, Math.min(100, entry.progress || 0))}%"></span></div></div><span class="badge ${tone} file-item__status">${entry.status === 'queued' ? 'fila' : entry.status === 'processing' ? 'lendo' : entry.status === 'done' ? 'concluído' : entry.status === 'warning' ? 'revisar' : 'erro'}</span>`;
    list.appendChild(li);
  }
  $('#clear-button').disabled = state.busy || state.entries.size === 0;
}

async function handleFiles(fileList) {
  const files = [...fileList].filter((file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
  if (!files.length) { toast('Selecione arquivos PDF.', 'warning'); return; }
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) { toast(`${file.name}: arquivo acima de ${formatBytes(MAX_FILE_BYTES)}.`, 'error'); continue; }
    const id = uniqueId(file);
    if (state.entries.has(id)) { toast(`${file.name} já está neste lote.`, 'info'); continue; }
    state.entries.set(id, { id, file, hash: null, pages: null, status: 'queued', message: 'Aguardando', progress: 0 });
  }
  renderFiles();
  if (!state.busy) await processQueue();
}

async function processQueue() {
  if (state.busy) return; // V15 — reentrância: a fila é drenada por um dono só
  const queued = [...state.entries.values()].filter((entry) => entry.status === 'queued');
  if (!queued.length) return;
  state.busy = true; state.cancelled = false; state.batchStartedAt = dateTimeIso();
  $('#cancel-button').disabled = false; $('#clear-button').disabled = true;
  setGlobalStatus(`Processando ${queued.length} arquivo(s)…`, true);
  const concurrency = Number($('#file-concurrency').value) || 2;
  try {
    await parallelMap(queued, concurrency, async (entry) => {
      try { await processFile(entry); }
      catch (error) {
        entry.status = error && error.name === 'AbortError' ? 'warning' : 'error';
        entry.progress = 100;
        entry.message = error && error.name === 'AbortError' ? 'Cancelado' : (error && error.message || 'Falha ao processar');
        renderFiles();
      }
    });
  } catch (error) {
    // AbortError é o caminho normal do cancelamento; qualquer outro erro vira
    // aviso na tela em vez de unhandled rejection no console.
    if (!(error && error.name === 'AbortError')) {
      toast(`Falha no lote: ${error && error.message || error}`, 'error', 7000);
    }
  } finally {
    state.busy = false;
    $('#cancel-button').disabled = true;
    $('#clear-button').disabled = state.entries.size === 0;
    const errors = [...state.entries.values()].filter((entry) => entry.status === 'error').length;
    setGlobalStatus(state.cancelled ? 'Processamento cancelado.' : `Lote concluído · ${state.documents.size} laudo(s) · ${errors} falha(s).`, false);
    renderFiles(); rebuildRows();
  }
  // V15 — arquivos soltos DURANTE o lote ficavam presos em "fila" para sempre,
  // porque handleFiles só chamava processQueue quando não havia lote em curso.
  if (!state.cancelled && [...state.entries.values()].some((entry) => entry.status === 'queued')) {
    await processQueue();
  }
}

function cancelProcessing() {
  state.cancelled = true;
  for (const controller of state.abortControllers) controller.abort();
  state.abortControllers.clear();
  setGlobalStatus('Cancelando as tarefas em execução…', true);
}
function clearAll() {
  if (state.busy) return;
  state.entries.clear(); state.documents.clear(); state.rows = []; state.openDetails.clear();
  $('#file-input').value = ''; renderFiles(); renderResults(); setGlobalStatus('Nenhum arquivo selecionado.', false);
}

function headerStyle() {
  return { font: { bold: true }, alignment: { vertical: 'center', wrapText: true }, border: { bottom: { style: 'thin' } } };
}
function styleSheet(sheet, widths) {
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  sheet['!freeze'] = { ySplit: 1 };
  const ref = String(sheet['!ref'] || 'A1:A1');
  const endColumn = ((ref.split(':')[1] || 'A1').match(/[A-Z]+/) || ['A'])[0];
  sheet['!autofilter'] = { ref: `A1:${endColumn}1` };
  for (let c = 0; c < widths.length; c += 1) {
    const address = `${XlsxStyleLite.utils.encode_col(c)}1`;
    if (sheet[address]) sheet[address].s = headerStyle();
  }
}

function exportExcel() {
  if (!state.rows.length) { toast('Não há resultados para exportar.', 'warning'); return; }
  const strict = $('#strict-review').checked;
  const blocking = state.rows.filter((row) => row.result.revisaoHumana.status === 'pendente' && validationsForRow(row).some((v) => v.severity === 'error'));
  if (strict && blocking.length) {
    toast(`Há ${blocking.length} linha(s) com erro ainda pendentes. Aceite, corrija ou rejeite antes da exportação definitiva.`, 'error', 7600);
    return;
  }
  const X = XlsxStyleLite;
  if (!X || !X.utils || !X.writeFile) { toast('O gravador XLSX do projeto não foi carregado.', 'error'); return; }
  const acceptedRows = state.rows.filter((row) => row.result.revisaoHumana.status !== 'rejeitado');
  const workbook = X.utils.book_new();
  workbook.Props = { Title: 'OCR de Laudos de Rompimento', Subject: 'Resultados revisáveis', Author: 'Consulte GEO', Company: 'Consulte GEO', CreatedDate: new Date() };

  const findings = [...state.documents.values()].flatMap((document) => (document.validation || []).map((v) => ({ document, v })));
  const summaryRows = [
    ['Indicador', 'Valor'],
    ['Versão do aplicativo', APP_VERSION], ['Versão do pipeline', PIPELINE_VERSION],
    ['Gerado em', dateTimeIso()], ['Arquivos processados', state.documents.size],
    ['Resultados totais', state.rows.length], ['Resultados exportados', acceptedRows.length],
    ['Resultados rejeitados', state.rows.length - acceptedRows.length],
    ['Pendentes', state.rows.filter((r) => r.result.revisaoHumana.status === 'pendente').length],
    ['Erros de validação', findings.filter((x) => x.v.severity === 'error').length],
    ['Alertas', findings.filter((x) => x.v.severity === 'warning').length],
    ['Observação', 'Valores brutos e proveniência estão nas abas correspondentes.'],
  ];
  const summarySheet = X.utils.aoa_to_sheet(summaryRows); styleSheet(summarySheet, [32, 72]); X.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

  const resultRows = [[
    '#', 'Arquivo', 'Página', 'Laudo nº', 'CP', 'NF', 'Idade', 'Unidade', 'MPa',
    'Moldagem', 'Rompimento', 'fck projeto', 'Slump', 'Traço', 'Local de aplicação',
    'Confiança', 'Score', 'Fonte', 'Revisão', 'Erros', 'Alertas',
  ]];
  acceptedRows.forEach((row, index) => {
    const result = row.result; const rowFindings = validationsForRow(row);
    resultRows.push([
      index + 1, row.fileName, result.origem && result.origem.pagina, row.document.metadata.laudoNum || '',
      valueOf(result.cp) || '', valueOf(result.nf) || '', valueOf(result.idade) || '', result.idade.unidade || '',
      valueOf(result.mpa) == null ? '' : valueOf(result.mpa), valueOf(result.dataMoldagem) || '', valueOf(result.dataRompimento) || '',
      valueOf(result.fckProjeto) == null ? '' : valueOf(result.fckProjeto), valueOf(result.slump) || '', valueOf(result.traco) || '',
      valueOf(result.localAplicacao) || '', result.confianca.nivel, result.confianca.score == null ? '' : result.confianca.score,
      result.origem && result.origem.fonte || '', result.revisaoHumana.status,
      rowFindings.filter((v) => v.severity === 'error').length, rowFindings.filter((v) => v.severity === 'warning').length,
    ]);
  });
  const resultsSheet = X.utils.aoa_to_sheet(resultRows); styleSheet(resultsSheet, [5,28,8,14,16,14,8,10,10,13,13,12,16,24,28,11,9,16,12,8,8]); X.utils.book_append_sheet(workbook, resultsSheet, 'Resultados');

  const provenanceRows = [['Arquivo','Resultado','Campo','Estado','Valor normalizado','Raw preservado','Motivo','Página','Linha','Fonte','Candidatos']];
  // V15 — antes só a aba Resultados respeitava a rejeição: a Proveniência e o
  // JSON técnico entregavam de volta a linha que o revisor tinha rejeitado.
  acceptedRows.forEach((row) => {
    const r = row.result;
    const fields = ['cp','nf','idade','mpa','carga','area','dataMoldagem','dataRompimento','fckProjeto','slump','traco','localAplicacao'];
    fields.forEach((fieldName) => {
      const field = r[fieldName];
      provenanceRows.push([row.fileName,r.id,fieldName,field && field.estado || '',valueOf(field) ?? '',rawOf(field),field && field.motivo || '',r.origem && r.origem.pagina || '',r.origem && r.origem.linha || '',r.origem && r.origem.fonte || '',JSON.stringify((r.candidatos || []).filter((c) => c.campo === fieldName))]);
    });
  });
  const provenanceSheet = X.utils.aoa_to_sheet(provenanceRows); styleSheet(provenanceSheet,[28,20,20,12,20,32,42,8,8,16,48]); X.utils.book_append_sheet(workbook, provenanceSheet, 'Proveniência');

  const validationRows = [['Arquivo','Resultado','Código','Severidade','Mensagem','Caminho','Correção sugerida','Metadados']];
  findings.forEach(({ document, v }) => validationRows.push([document._fileName,v.entityTemporaryId || '',v.code,v.severity,v.message,v.path || '',v.suggestedFix || '',v.metadata ? JSON.stringify(v.metadata) : '']));
  const validationSheet = X.utils.aoa_to_sheet(validationRows); styleSheet(validationSheet,[28,20,30,12,62,34,52,40]); X.utils.book_append_sheet(workbook, validationSheet, 'Validações');

  const diagnosticRows = [['Arquivo','SHA-256','Páginas','Com texto','Escaneadas','Processadas por IA','Ignoradas','Perfil','Fonte','Modelo','Detalhes']];
  for (const document of state.documents.values()) diagnosticRows.push([document._fileName,document.metadata.arquivo.sha256,document.metadata.arquivo.paginas,document.diagnostico.paginasComTexto,document.diagnostico.paginasEscaneadas,document.diagnostico.paginasProcessadasPorIA,document.diagnostico.paginasIgnoradas,document.metadata.perfilDetectado,document.metadata.fonte,document.metadata.modelo || '',JSON.stringify({ qualidade: document.diagnostico.qualidade, cortesGrafico: document.diagnostico.cortesGrafico })]);
  const diagnosticSheet = X.utils.aoa_to_sheet(diagnosticRows); styleSheet(diagnosticSheet,[28,66,8,10,10,16,10,14,18,28,70]); X.utils.book_append_sheet(workbook, diagnosticSheet, 'Diagnóstico');

  const technicalJson = JSON.stringify({
    schemaVersion: '1.0.0', appVersion: APP_VERSION, generatedAt: dateTimeIso(),
    documents: [...state.documents.values()].map((documento) => cleanForExport({
      ...documento,
      resultados: (documento.resultados || []).filter((r) => r.revisaoHumana.status !== 'rejeitado'),
    })),
  }, null, 2);
  const chunks = technicalJson.match(/[\s\S]{1,30000}/g) || ['{}'];
  const jsonRows = [['Parte','JSON Técnico'], ...chunks.map((chunk, index) => [index + 1, chunk])];
  const jsonSheet = X.utils.aoa_to_sheet(jsonRows); styleSheet(jsonSheet,[8,120]); X.utils.book_append_sheet(workbook, jsonSheet, 'JSON Técnico');

  X.writeFile(workbook, `ocr_laudos_${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast('Excel gerado com seis abas e proveniência completa.', 'success');
}

function cleanForExport(document) {
  // V15 — `customerInput` guarda o texto posicional INTEGRAL de todas as páginas.
  // Ele ia inteiro para a aba "JSON Técnico" (fatiado em blocos de 30 000
  // caracteres, em ZIP sem compressão): 8 laudos de 25 páginas geravam megabytes
  // e travavam a aba na hora de baixar. O bruto por campo continua na aba
  // Proveniência, que é onde o revisor confere.
  const { customerInput, ...resto } = document;
  return JSON.parse(JSON.stringify(resto, (key, value) => {
    if (key.startsWith('_')) return undefined;
    if (value instanceof Set) return [...value];
    return value;
  }));
}

async function registerReview() {
  const calls = [];
  for (const document of state.documents.values()) {
    const tokens = document.diagnostico && document.diagnostico.readingTokens || {};
    for (const [pageText, token] of Object.entries(tokens)) {
      const page = Number(pageText);
      const rows = document.resultados.filter((result) => Number(result.origem && result.origem.pagina) === page && Number.isInteger(result._visionResultIndex));
      const fields = [];
      rows.forEach((result) => {
        const original = result._ocrSnapshot || {};
        const current = snapshotResult(result);
        const mappings = [
          ['cp','cp'], ['nf','nf'], ['idade','idade'], ['mpa','mpa'], ['carga','carga'], ['area','area'],
          ['dataMoldagem','data_moldagem'], ['dataRompimento','data_rompimento'],
          ['fckProjeto','fck_projeto'], ['slump','slump'], ['traco','traco'], ['localAplicacao','local_aplicacao'],
        ];
        mappings.forEach(([snapshotKey, field]) => {
          const before = original[snapshotKey]; const after = current[snapshotKey];
          let verdict = sameValue(before, after) ? 'acertou' : before == null && after != null ? 'faltou' : before != null && after == null ? 'sobrou' : 'corrigiu';
          if (result.revisaoHumana.status === 'rejeitado') verdict = 'rejeitou';
          fields.push({ result_index: result._visionResultIndex, field, verdict, ocr_value: before, final_value: after });
        });
      });
      if (fields.length) calls.push(callVision({ action: 'confirm', reading_token: token, fields }));
    }
  }
  if (!calls.length) { toast('Este lote não possui leituras de visão revisáveis com token de telemetria.', 'info'); return; }
  try {
    await Promise.all(calls);
    toast('Revisão registrada sem persistir o conteúdo dos campos.', 'success');
  } catch (error) {
    toast(`Não foi possível registrar a revisão: ${error.message}`, 'error');
  }
}

function acceptVisible() {
  const rows = filteredRows();
  let accepted = 0;
  rows.forEach((row) => {
    if (row.result.revisaoHumana.status !== 'pendente') return;
    if (validationsForRow(row).some((v) => v.severity === 'error')) return;
    setReview(row, 'aceito', false); accepted += 1;
  });
  if (!accepted) toast('Nenhuma linha visível sem erro estava pendente.', 'info');
  else toast(`${accepted} linha(s) aceita(s).`, 'success');
  renderResults();
}

function toggleTheme() {
  const dark = document.documentElement.classList.toggle('dark');
  try { localStorage.setItem('consulte_geo_theme', dark ? 'dark' : 'light'); } catch { /* noop */ }
  $('#theme-toggle').textContent = dark ? 'Tema claro' : 'Tema escuro';
}
function initTheme() {
  let saved = '';
  try { saved = localStorage.getItem('consulte_geo_theme') || ''; } catch { /* noop */ }
  const dark = saved ? saved === 'dark' : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
  $('#theme-toggle').textContent = dark ? 'Tema claro' : 'Tema escuro';
}

function bindEvents() {
  const drop = $('#drop-zone'); const input = $('#file-input');
  drop.addEventListener('click', () => input.click());
  drop.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); input.click(); } });
  // V15 — sem zerar o value, reescolher o mesmo arquivo não dispara `change`.
  input.addEventListener('change', () => {
    const escolhidos = input.files;
    handleFiles(escolhidos).finally(() => { input.value = ''; });
  });
  ['dragenter','dragover'].forEach((name) => drop.addEventListener(name, (event) => { event.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave','drop'].forEach((name) => drop.addEventListener(name, (event) => { event.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (event) => handleFiles(event.dataTransfer.files));
  $('#cancel-button').addEventListener('click', cancelProcessing);
  $('#clear-button').addEventListener('click', clearAll);
  $('#search-input').addEventListener('input', renderResults);
  $('#status-filter').addEventListener('change', renderResults);
  $('#severity-filter').addEventListener('change', renderResults);
  $('#export-button').addEventListener('click', exportExcel);
  $('#register-review').addEventListener('click', registerReview);
  $('#accept-visible').addEventListener('click', acceptVisible);
  $('#theme-toggle').addEventListener('click', toggleTheme);
  $('#vision-consent').addEventListener('change', () => {
    if ($('#vision-consent').checked) toast('Consentimento registrado para este navegador e lote. Nenhum upload ocorre antes da seleção de um PDF.', 'info');
  });
  $('#results-body').addEventListener('change', (event) => {
    const target = event.target.closest('[data-field]');
    if (!target) return;
    const rowElement = target.closest('tr[data-index]');
    const row = state.rows[Number(rowElement.dataset.index)];
    // V15 — sem o adiamento, updateField repintava a tabela no blur e o clique
    // no ✓/× da mesma linha era engolido: o operador precisava clicar duas vezes.
    if (row) {
      const campo = target.dataset.field;
      const valor = target.value;
      setTimeout(() => updateField(row, campo, valor), 0);
    }
  });
  $('#results-body').addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const rowElement = button.closest('tr[data-index]');
    const row = state.rows[Number(rowElement.dataset.index)];
    if (!row) return;
    if (button.dataset.action === 'accept') setReview(row, 'aceito');
    if (button.dataset.action === 'reject') setReview(row, 'rejeitado');
    if (button.dataset.action === 'details') {
      const chaveDetalhe = detailKey(row);
      if (state.openDetails.has(chaveDetalhe)) state.openDetails.delete(chaveDetalhe); else state.openDetails.add(chaveDetalhe);
      renderResults();
    }
  });
}

initTheme();
bindEvents();
renderFiles();
renderResults();
setGlobalStatus('Nenhum arquivo selecionado.', false);
