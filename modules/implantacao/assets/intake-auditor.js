/* ============================================================================
 * IntakeAuditor — Pré-análise de Recebimento (Triagem da Planilha)
 * Consulte GEO · Implantação · APP_VERSION 5.23.0 · engine 1.0.0
 *
 * Motor DETERMINÍSTICO e independente. Analisa uma planilha de controle
 * tecnológico recebida da construtora ANTES da configuração da obra e ANTES
 * da conversão (Pré-importação). Não converte, não altera a planilha, não
 * envia dados para IA. Roda no browser (window.IntakeAuditor) e no Node
 * (module.exports) — o mesmo código executa os self-tests C1–C20 como gate.
 *
 * Proveniência de todo dado tratado:
 *   DADO_ORIGINAL · NORMALIZACAO_AUTOMATICA · ALTERNATIVA_OPERACIONAL · NECESSITA_CLIENTE
 * ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.IntakeAuditor = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ENGINE_VERSION = '1.0.0';
  var APP_VERSION = '5.23.0';

  /* ── Categorias funcionais (seção 6 da especificação) ─────────────────── */
  var CAT = {
    BLOQUEADOR: 'BLOQUEADOR',
    NECESSITA_DEFINICAO: 'NECESSITA_DEFINICAO',
    ALTERNATIVA: 'ALTERNATIVA_DISPONIVEL',
    ALERTA: 'ALERTA',
    INFO: 'INFORMATIVO'
  };
  var CAT_LABEL = {
    BLOQUEADOR: 'Bloqueador',
    NECESSITA_DEFINICAO: 'Necessita definição',
    ALTERNATIVA_DISPONIVEL: 'Alternativa disponível',
    ALERTA: 'Alerta',
    INFORMATIVO: 'Informativo'
  };
  var CAT_ORDER = { BLOQUEADOR: 0, NECESSITA_DEFINICAO: 1, ALTERNATIVA_DISPONIVEL: 2, ALERTA: 3, INFORMATIVO: 4 };

  /* ── Utilidades ───────────────────────────────────────────────────────── */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[_]+/g, ' ')
      .replace(/[^a-z0-9%³º.,()\/\s-]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function isBlank(v) { return v == null || String(v).trim() === ''; }
  function isDashNA(v) {
    var t = String(v == null ? '' : v).trim().toLowerCase();
    return t === '-' || t === '--' || t === 'n/a' || t === 'na' || t === 's/n';
  }
  function hasDigit(v) { return /\d/.test(String(v == null ? '' : v)); }

  /* Números pt-BR com unidade: "8 m³", "7m3", "8,0 m³", "35 MPa", "1.234,5" */
  function parseNumber(v) {
    if (typeof v === 'number' && isFinite(v)) return { value: v, normalized: false, raw: v };
    if (isBlank(v)) return { value: null, normalized: false, raw: v };
    var raw = String(v).trim();
    if (isDashNA(raw)) return { value: null, normalized: false, raw: raw, na: true };
    if (!hasDigit(raw)) return { value: null, normalized: false, raw: raw, nonNumericText: true };
    var s = raw.replace(/m³|m3|mpa|kn|cm|mm|kg\/m3|kg|un\b|l\b/gi, '').replace(/\s+/g, '');
    if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
    var m = s.match(/-?\d+(\.\d+)?/);
    if (!m) return { value: null, normalized: false, raw: raw, nonNumericText: true };
    var val = parseFloat(m[0]);
    if (!isFinite(val)) return { value: null, normalized: false, raw: raw, nonNumericText: true };
    var plain = (String(val) === raw) || (raw.replace(',', '.') === String(val));
    return { value: val, normalized: !plain, raw: raw };
  }

  /* Datas: serial Excel ou string pt-BR/ISO */
  function parseDateVal(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number' && isFinite(v)) {
      if (v > 20000 && v < 80000) { // serial Excel (1900 system)
        var ms = Math.round((v - 25569) * 86400 * 1000);
        var d = new Date(ms);
        return isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
      }
      return null;
    }
    var t = String(v).trim();
    var m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m) {
      var dd = +m[1], mm = +m[2], yy = +m[3]; if (yy < 100) yy += 2000;
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        var d1 = new Date(Date.UTC(yy, mm - 1, dd));
        if (d1.getUTCDate() === dd && d1.getUTCMonth() === mm - 1) return d1;
      }
      return null;
    }
    m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      var d2 = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      return isNaN(d2.getTime()) ? null : d2;
    }
    return null;
  }
  function fmtDate(d) {
    if (!d) return '';
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return p(d.getUTCDate()) + '/' + p(d.getUTCMonth() + 1) + '/' + d.getUTCFullYear();
  }
  function median(arr) {
    if (!arr.length) return null;
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  /* FCK dentro de texto: "CONCRETO FCK 30", "FCK30 BRITA 1", "utilizado fck 25" */
  function extractFcksFromText(v) {
    var out = [];
    if (isBlank(v)) return out;
    var t = norm(v);
    var re = /fck\s*[:=.]?\s*(\d{1,3})(?:[.,](\d))?/g, m;
    while ((m = re.exec(t))) {
      var val = parseFloat(m[1] + (m[2] ? '.' + m[2] : ''));
      if (val >= 5 && val <= 100) out.push(val);
    }
    return out;
  }

  /* ── Definição dos campos canônicos (sinônimos + validador de conteúdo) ── */
  var FIELDS = {
    data: {
      label: 'Data da concretagem',
      syn: ['data', 'data concretagem', 'data da concretagem', 'data moldagem', 'data de moldagem', 'moldagem', 'data lancamento', 'data de lancamento', 'dia'],
      penal: ['rompimento', 'ruptura', 'ensaio', 'previsao', 'prevista', 'saida', 'chegada'],
      content: function (vals) { return ratio(vals, function (v) { return parseDateVal(v) != null; }); }
    },
    nf: {
      label: 'Nota Fiscal / Remessa',
      syn: ['nf', 'n.f.', 'no nf', 'nº nf', 'num nf', 'nota fiscal', 'danfe', 'no danfe', 'nº danfe', 'no remessa', 'nº remessa', 'remessa', 'simples remessa', 'ticket', 'nfe', 'nf-e'],
      exactOnly: ['nota'],
      penal: ['anexar', 'obs'],
      content: function (vals) { return ratio(vals, function (v) { return hasDigit(v) && String(v).trim().length <= 20; }); }
    },
    volume: {
      label: 'Volume por caminhão/NF',
      syn: ['volume', 'volume m3', 'volume m³', 'vol', 'vol.', 'qtd', 'quantidade', 'qtd m3', 'qtd m³', 'm3', 'm³', 'volume real', 'volume caminhao', 'volume nf'],
      penal: ['aproveitamento', 'descartado', 'nao pago', 'não pago', 'nao descarregado', 'programado', 'projeto', 'total', 'acumulado'],
      content: function (vals) { return ratio(vals, function (v) { var p = parseNumber(v); return p.value != null && p.value > 0 && p.value <= 60; }); }
    },
    fck: {
      label: 'FCK',
      syn: ['fck', 'fck projeto', 'resistencia projeto', 'resistencia proj', 'resistencia proj. (mpa)', 'resistencia caracteristica', 'fck (mpa)', 'mpa projeto'],
      penal: ['rompimento', 'resultado', 'ruptura', 'obtida', 'real'],
      content: function (vals) {
        return ratio(vals, function (v) {
          var p = parseNumber(v);
          if (p.value != null) return p.value >= 5 && p.value <= 100;
          return extractFcksFromText(v).length > 0;
        });
      }
    },
    traco: {
      label: 'Traço / Concreto',
      syn: ['traco', 'traço', 'concreto', 'codigo do traco', 'cod traco', 'especificacao', 'especificacao do concreto', 'descricao do concreto', 'tipo de concreto'],
      penal: ['fck projeto', 'resistencia'],
      content: function (vals) { return ratio(vals, function (v) { return !isBlank(v) && String(v).trim().length >= 3; }); }
    },
    torre: { label: 'Torre', syn: ['torre'], content: textContent },
    bloco: { label: 'Bloco / Lado', syn: ['bloco', 'lado', 'bloco/lado', 'quadra'], content: textContent },
    pavimento: { label: 'Pavimento / Local', syn: ['pavimento', 'pav', 'pav.', 'andar', 'nivel', 'local', 'local de aplicacao', 'trecho'], penal: ['laboratorio'], content: textContent },
    elemento: { label: 'Elemento / Peça', syn: ['elemento', 'elemento concretado', 'peca', 'peça', 'peca concretada', 'peça concretada', 'estrutura', 'servico', 'serviço', 'frente', 'descricao das pecas'], content: textContent },
    descricao: { label: 'Descrição (apoio)', syn: ['descricao', 'descrição', 'descricao do servico'], content: textContent },
    usina: {
      label: 'Usina / Concreteira',
      syn: ['usina', 'concreteira', 'fornecedor', 'fornecedor de concreto', 'empresa fornecedora', 'fornecedora'],
      content: textContent
    },
    laboratorio: { label: 'Laboratório', syn: ['laboratorio', 'laboratório', 'lab', 'lab.', 'laboratorio responsavel'], content: textContent },
    slump: {
      label: 'Slump',
      syn: ['slump', 'abatimento', 'abat', 'abat.', 'slump test', 'slump (cm)', 'slump (mm)', 'abatimento (cm)', 'abatimento (mm)'],
      content: function (vals) { return ratio(vals, function (v) { var p = parseNumber(v); return p.value != null && p.value > 0 && p.value <= 300; }); }
    },
    flow: {
      label: 'Flow / Espalhamento',
      syn: ['flow', 'espalhamento', 'flow (cm)', 'flow test'],
      content: function (vals) { return ratio(vals, function (v) { var p = parseNumber(v); return p.value != null && p.value > 0 && p.value <= 900; }); }
    },
    placa: { label: 'Placa / Betoneira', syn: ['placa', 'betoneira', 'veiculo', 'veículo', 'caminhao', 'caminhão', 'identificacao betoneira'], content: textContent },
    cp: { label: 'Corpo de prova (Nº CP)', syn: ['cp', 'no cp', 'nº cp', 'num cp', 'corpo de prova', 'corpos de prova', 'molde', 'exemplar', 'identificacao cp', 'cp1', 'serie'], content: null },
    idade: { label: 'Idade (por linha)', syn: ['idade', 'idade (dias)', 'idade rompimento', 'idade de rompimento', 'idade (h)'], content: null },
    obs: { label: 'Observações', syn: ['obs', 'obs.', 'observacao', 'observação', 'observacoes', 'observações', 'comentario', 'comentário', 'comentarios'], content: null },
    horaCarga: { label: 'Hora carregamento', syn: ['hora carregamento', 'hr carregamento', 'hora carga', 'saida usina'], content: null },
    horaChegada: { label: 'Hora chegada', syn: ['hora chegada', 'hr chegada', 'chegada obra'], content: null },
    horaInicio: { label: 'Hora início descarga', syn: ['hora inicio', 'hora início', 'inicio descarga', 'hr inicio'], content: null },
    horaFim: { label: 'Hora final descarga', syn: ['hora final', 'hora fim', 'fim descarga', 'hr final', 'termino descarga'], content: null }
  };
  function textContent(vals) { return ratio(vals, function (v) { return !isBlank(v); }); }
  function ratio(vals, fn) {
    var ok = 0, n = 0;
    for (var i = 0; i < vals.length; i++) { if (isBlank(vals[i])) continue; n++; if (fn(vals[i])) ok++; }
    return n === 0 ? 0 : ok / n;
  }

  /* ── Leitura de workbook ──────────────────────────────────────────────── */
  function getXLSX(opts) {
    if (opts && opts.XLSX) return opts.XLSX;
    if (typeof XLSX !== 'undefined') return XLSX;
    if (typeof require === 'function') { try { return require('xlsx'); } catch (e) { } }
    throw new Error('Biblioteca XLSX não disponível.');
  }

  /* safeMatrix: expande mescladas; registra o que foi preenchido VIA mesclagem.
   * A planilha original nunca é alterada — a expansão é apenas para análise. */
  function safeMatrix(ws, X) {
    var matrix = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    var mergedFlag = [];
    var merges = ws['!merges'] || [];
    for (var k = 0; k < merges.length; k++) {
      var mg = merges[k];
      var top = (matrix[mg.s.r] || [])[mg.s.c];
      for (var r = mg.s.r; r <= mg.e.r; r++) {
        if (!matrix[r]) matrix[r] = [];
        if (!mergedFlag[r]) mergedFlag[r] = [];
        for (var c = mg.s.c; c <= mg.e.c; c++) {
          if (r === mg.s.r && c === mg.s.c) continue;
          if (isBlank(matrix[r][c])) { matrix[r][c] = top; mergedFlag[r][c] = true; }
        }
      }
    }
    return { matrix: matrix, mergedFlag: mergedFlag };
  }

  /* Escolha da aba mais provável (C15) */
  function scoreSheets(wb, X) {
    var out = [];
    for (var i = 0; i < wb.SheetNames.length; i++) {
      var name = wb.SheetNames[i];
      var ws = wb.Sheets[name];
      var mat = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
      var cells = 0, rows = mat.length;
      for (var r = 0; r < mat.length; r++) for (var c = 0; c < (mat[r] || []).length; c++) if (!isBlank(mat[r][c])) cells++;
      var n = norm(name), score = cells + rows;
      if (/instru|orienta|leia|ajuda|manual/.test(n)) score -= 100000;
      if (/dashboard|grafic|resumo|capa|legenda|config|param|indice|índice/.test(n)) score -= 50000;
      if (/controle|lancament|concret|romp|dados|registro|diario|mapa/.test(n)) score += 5000;
      out.push({ name: name, cells: cells, rows: rows, score: score });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out;
  }

  /* Cabeçalho multi-nível (1–3), após expansão de mescladas (C16) */
  function cellMatchesAnySynonym(v) {
    var h = norm(v);
    if (!h) return false;
    for (var f in FIELDS) {
      var syn = FIELDS[f].syn;
      for (var s = 0; s < syn.length; s++) {
        if (h === syn[s] || (syn[s].length > 3 && h.indexOf(syn[s]) > -1)) return true;
      }
    }
    return false;
  }
  function synonymHits(row) {
    /* Conta por VALOR ÚNICO (título mesclado expandido não pode contar 13×)
     * e ignora textos longos (títulos de planilha não são cabeçalho de coluna). */
    var seen = {}, hits = 0;
    for (var c = 0; c < row.length; c++) {
      var v = row[c];
      if (isBlank(v)) continue;
      var key = String(v).trim();
      if (key.length > 48) continue;
      if (seen[key]) continue;
      seen[key] = 1;
      if (cellMatchesAnySynonym(v)) hits++;
    }
    return hits;
  }
  function rowIsHeaderish(row) {
    var nonEmpty = 0, numeric = 0, dateish = 0, uniq = {}, uc = 0;
    for (var c = 0; c < row.length; c++) {
      if (isBlank(row[c])) continue;
      nonEmpty++;
      var key = String(row[c]).trim();
      if (!uniq[key]) { uniq[key] = 1; uc++; }
      if (typeof row[c] === 'number') { numeric++; if (row[c] > 20000 && row[c] < 80000) dateish++; }
      else if (parseDateVal(row[c])) dateish++;
    }
    if (nonEmpty >= 4 && uc === 1) return false; // linha de título mesclada
    return nonEmpty >= 1 && dateish === 0 && (numeric / Math.max(1, nonEmpty)) < 0.4;
  }
  function detectHeader(matrix) {
    var best = -1, bestHits = 0;
    var lim = Math.min(matrix.length, 20);
    for (var r = 0; r < lim; r++) {
      var h = synonymHits(matrix[r] || []);
      if (h >= 2 && h > bestHits) { best = r; bestHits = h; }
    }
    if (best < 0) { // fallback: primeira linha com ≥3 células de texto
      for (var r2 = 0; r2 < lim; r2++) {
        var row = matrix[r2] || [], txt = 0;
        for (var c = 0; c < row.length; c++) if (!isBlank(row[c]) && typeof row[c] !== 'number') txt++;
        if (txt >= 3) { best = r2; break; }
      }
      if (best < 0) best = 0;
    }
    var start = best;
    // sobe: linhas esparsas de texto acima (grupos como "Rompimentos") entram na composição
    while (start > 0 && rowIsHeaderish(matrix[start - 1] || []) && (matrix[start - 1] || []).some(function (v) { return !isBlank(v); }) && (best - (start - 1)) < 2) start--;
    // desce: subcabeçalhos
    var end = best;
    while (end + 1 < matrix.length && (end - start + 1) < 3 && rowIsHeaderish(matrix[end + 1] || []) && synonymHits(matrix[end + 1]) + ageTokens(matrix[end + 1]) >= 2) end++;
    var depth = end - start + 1;
    var width = 0;
    for (var r3 = start; r3 <= end; r3++) width = Math.max(width, (matrix[r3] || []).length);
    var headers = [];
    for (var c2 = 0; c2 < width; c2++) {
      var parts = [];
      for (var r4 = start; r4 <= end; r4++) {
        var v = (matrix[r4] || [])[c2];
        if (!isBlank(v)) { var t = String(v).trim(); if (parts.indexOf(t) === -1) parts.push(t); }
      }
      headers.push(parts.join(' / '));
    }
    return { start: start, depth: depth, end: end, headers: headers, dataStart: end + 1 };
  }
  function ageTokens(row) {
    var n = 0;
    for (var c = 0; c < row.length; c++) { if (!isBlank(row[c]) && parseAgeFromHeader(String(row[c])) != null) n++; }
    return n;
  }

  /* Idades de rompimento a partir do cabeçalho composto (dinâmico, seção 5.14) */
  function parseAgeFromHeader(h) {
    var t = norm(h);
    var mh = t.match(/(\d+)\s*h(?:oras?)?\b/);
    var md = t.match(/(\d+)\s*d(?:ias?)?\b/);
    if (mh) return +mh[1];
    if (md) return +md[1] * 24;
    return null;
  }
  function ageLabel(hours) {
    if (hours < 24) return hours + ' horas';
    var d = hours / 24;
    return (d === 1 ? '1 dia' : (Math.round(d * 10) / 10) + ' dias');
  }
  var ROMP_CTX = /romp|resist|ruptur|resultado|ensaio|mpa|\bres\b|res\.|\bcp\b/;

  /* ── Mapeamento de campos por nome + conteúdo ─────────────────────────── */
  function nameScore(header, field) {
    var h = norm(header);
    if (!h) return 0;
    var best = 0, def = FIELDS[field];
    var lists = [{ arr: def.syn, exact: false }];
    if (def.exactOnly) lists.push({ arr: def.exactOnly, exact: true });
    for (var L = 0; L < lists.length; L++) {
      for (var i = 0; i < lists[L].arr.length; i++) {
        var s = lists[L].arr[i];
        if (h === s) { best = Math.max(best, 1); continue; }
        if (lists[L].exact) continue;
        if (s.length >= 3 && (h.indexOf(s) === 0 || h.indexOf(' ' + s) > -1 || h.indexOf('/' + s) > -1)) best = Math.max(best, 0.85);
        else if (s.length >= 4 && h.indexOf(s) > -1) best = Math.max(best, 0.7);
      }
    }
    if (best > 0 && def.penal) {
      for (var p = 0; p < def.penal.length; p++) if (h.indexOf(def.penal[p]) > -1) best -= 0.6;
    }
    return Math.max(0, best);
  }
  function columnValues(matrix, dataStart, col, recordIdx) {
    var out = [];
    var rows = recordIdx || null;
    if (rows) { for (var i = 0; i < rows.length; i++) out.push((matrix[rows[i]] || [])[col]); }
    else { for (var r = dataStart; r < matrix.length; r++) out.push((matrix[r] || [])[col]); }
    return out;
  }

  /* ── Núcleo: análise ──────────────────────────────────────────────────── */
  function analyzeWorkbook(wb, opts) {
    opts = opts || {};
    var X = getXLSX(opts);
    var today = opts.today ? (opts.today instanceof Date ? opts.today : parseDateVal(opts.today)) : new Date();
    var todayUTC = new Date(Date.UTC(today.getUTCFullYear ? today.getUTCFullYear() : today.getFullYear(),
      today.getUTCFullYear ? today.getUTCMonth() : today.getMonth(),
      today.getUTCFullYear ? today.getUTCDate() : today.getDate()));

    var sheets = scoreSheets(wb, X);
    var chosen = opts.sheet || (sheets[0] && sheets[0].name);
    var ws = wb.Sheets[chosen];
    if (!ws) throw new Error('Aba não encontrada: ' + chosen);

    var sm = safeMatrix(ws, X);
    var matrix = sm.matrix, mergedFlag = sm.mergedFlag;
    var header = detectHeader(matrix);

    /* — mapeamento preliminar por nome+conteúdo — */
    var width = header.headers.length;
    var mapping = {};      // field -> {col, header, confidence, nameScore, contentScore}
    var usedCols = {};
    var fieldOrder = ['data', 'nf', 'volume', 'fck', 'traco', 'torre', 'bloco', 'pavimento', 'elemento', 'descricao', 'usina', 'laboratorio', 'slump', 'flow', 'placa', 'cp', 'idade', 'obs', 'horaCarga', 'horaChegada', 'horaInicio', 'horaFim'];
    // idades primeiro (para não roubarem colunas de outros campos e vice-versa)
    var ages = [];
    var ageCols = {};
    for (var c = 0; c < width; c++) {
      var h = header.headers[c];
      var hours = parseAgeFromHeader(h);
      if (hours == null) continue;
      var ctx = ROMP_CTX.test(norm(h));
      var vals = columnValues(matrix, header.dataStart, c);
      var numRatio = ratio(vals, function (v) { var p = parseNumber(v); return p.value != null && p.value > 0 && p.value <= 200; });
      if (ctx || numRatio >= 0.5) {
        ages.push({ hours: hours, label: ageLabel(hours), col: c, header: h });
        ageCols[c] = true;
      }
    }
    ages.sort(function (a, b) { return a.hours - b.hours; });

    for (var f = 0; f < fieldOrder.length; f++) {
      var field = fieldOrder[f];
      var bestCol = -1, bestScore = 0, bestName = 0, bestContent = 0;
      for (var c2 = 0; c2 < width; c2++) {
        if (usedCols[c2] || ageCols[c2]) continue;
        var ns = nameScore(header.headers[c2], field);
        if (ns <= 0) continue;
        var cs = 0.5;
        if (FIELDS[field].content) cs = FIELDS[field].content(columnValues(matrix, header.dataStart, c2));
        var score = 0.6 * ns + 0.4 * cs;
        if (score > bestScore) { bestScore = score; bestCol = c2; bestName = ns; bestContent = cs; }
      }
      if (bestCol >= 0 && bestScore >= 0.35) {
        mapping[field] = { col: bestCol, header: header.headers[bestCol], confidence: Math.round(bestScore * 100), nameScore: bestName, contentScore: Math.round(bestContent * 100) };
        usedCols[bestCol] = true;
      }
    }
    // FCK derivado de texto do traço quando não há coluna dedicada
    if (!mapping.fck && mapping.traco) {
      var tvals = columnValues(matrix, header.dataStart, mapping.traco.col);
      var fr = ratio(tvals, function (v) { return extractFcksFromText(v).length > 0; });
      if (fr >= 0.5) mapping.fck = { col: mapping.traco.col, header: mapping.traco.header, confidence: Math.round(fr * 70), derivedFromText: true };
    }

    /* — detecção de linhas de registro reais (seção 15) — */
    var records = [], ignored = [];
    var totRe = /^(total|sub\s*total|subtotal|soma|media|média|resumo|legenda|obs\b|observa|instru|assinatura|aprovado por|elaborado)/;
    for (var r = header.dataStart; r < matrix.length; r++) {
      var row = matrix[r] || [];
      var filled = 0, firstTxt = null;
      for (var cc = 0; cc < row.length; cc++) { if (!isBlank(row[cc])) { filled++; if (firstTxt == null) firstTxt = row[cc]; } }
      if (filled === 0) { ignored.push({ row: r + 1, reason: 'linha vazia' }); continue; }
      if (firstTxt != null && totRe.test(norm(firstTxt))) { ignored.push({ row: r + 1, reason: 'total/resumo/legenda' }); continue; }
      var hasDate = mapping.data && parseDateVal(row[mapping.data.col]) != null;
      var hasNF = mapping.nf && !isBlank(row[mapping.nf.col]) && !isDashNA(row[mapping.nf.col]);
      var hasFck = mapping.fck && (parseNumber(row[mapping.fck.col]).value != null || extractFcksFromText(row[mapping.fck.col]).length > 0);
      var hasLoc = ['torre', 'bloco', 'pavimento', 'elemento'].some(function (lf) { return mapping[lf] && !isBlank(row[mapping[lf].col]); });
      var signal = (hasNF && hasDate) || (hasNF && hasFck) || (hasDate && hasLoc && hasFck) || (hasDate && hasFck) || (hasNF && filled >= 3) || (hasDate && filled >= 3);
      if (!signal && filled < 2) { ignored.push({ row: r + 1, reason: 'texto solto / sem sinais de registro' }); continue; }
      if (!signal && !(hasDate || hasNF || hasFck)) { ignored.push({ row: r + 1, reason: 'sem sinais de registro (NF/Data/FCK)' }); continue; }
      records.push(r);
    }

    /* — helpers de acesso — */
    function val(rIdx, field) { return mapping[field] ? (matrix[rIdx] || [])[mapping[field].col] : undefined; }
    function isMergedFill(rIdx, field) { return !!(mapping[field] && mergedFlag[rIdx] && mergedFlag[rIdx][mapping[field].col]); }

    var issues = [];
    function addIssue(o) { o.count = o.count != null ? o.count : (o.rows ? o.rows.length : 0); issues.push(o); }
    function sampleRows(list, extra) {
      return list.slice(0, 8).map(function (r) {
        var s = { linha: r + 1, data: fmtDate(parseDateVal(val(r, 'data'))) || String(val(r, 'data') == null ? '' : val(r, 'data')), nf: val(r, 'nf') == null ? '' : String(val(r, 'nf')) };
        if (extra) { var e = extra(r); for (var k in e) s[k] = e[k]; }
        return s;
      });
    }

    /* — inventário por campo — */
    function fieldStats(field, validator) {
      var m = mapping[field];
      var st = { field: field, label: FIELDS[field].label, found: !!m, header: m ? m.header : null, confidence: m ? m.confidence : 0, filled: 0, filledByMerge: 0, empty: 0, invalid: 0, normalized: 0, uniques: {}, samples: [], invalidRows: [], emptyRows: [], normalizedSamples: [] };
      if (!m) return st;
      for (var i = 0; i < records.length; i++) {
        var r = records[i], v = val(r, field);
        if (isBlank(v) || isDashNA(v)) {
          if (isDashNA(v)) { st.filled++; } else { st.empty++; st.emptyRows.push(r); }
          continue;
        }
        st.filled++;
        if (isMergedFill(r, field)) st.filledByMerge++;
        var key = String(v).trim();
        st.uniques[key] = (st.uniques[key] || 0) + 1;
        if (st.samples.length < 5 && st.samples.indexOf(key) === -1) st.samples.push(key);
        if (validator) {
          var res = validator(v, r);
          if (res && res.invalid) { st.invalid++; st.invalidRows.push({ row: r, value: key, why: res.why }); }
          if (res && res.normalized) { st.normalized++; if (st.normalizedSamples.length < 5) st.normalizedSamples.push({ original: key, interpretado: res.value }); }
        }
      }
      st.uniqueCount = Object.keys(st.uniques).length;
      return st;
    }

    var inventory = [];

    /* ── 5.1 DATA ── */
    var dateVals = [], dateInvalid = [], dateFuture = [], dateOld = [], minD = null, maxD = null;
    var stData = fieldStats('data', function (v, r) {
      var d = parseDateVal(v);
      if (!d) { dateInvalid.push(r); return { invalid: true, why: 'data inválida' }; }
      dateVals.push({ r: r, d: d });
      if (!minD || d < minD) minD = d;
      if (!maxD || d > maxD) maxD = d;
      if (d > todayUTC) dateFuture.push(r);
      var threeYears = new Date(Date.UTC(todayUTC.getUTCFullYear() - 3, todayUTC.getUTCMonth(), todayUTC.getUTCDate()));
      if (d < threeYears) dateOld.push(r);
      return null;
    });
    stData.min = fmtDate(minD); stData.max = fmtDate(maxD);
    inventory.push(stData);
    if (!mapping.data) {
      addIssue({ code: 'DATA_CAMPO_AUSENTE', category: CAT.BLOQUEADOR, field: 'data', title: 'Coluna de Data da concretagem não identificada', detail: 'Nenhuma coluna com datas de concretagem/moldagem foi localizada.', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Precisamos da data de concretagem de cada registro. É possível complementar a planilha com essa informação?' });
    } else {
      if (stData.emptyRows.length) addIssue({ code: 'DATA_VAZIA', category: CAT.BLOQUEADOR, field: 'data', title: 'Registros sem Data', rows: stData.emptyRows, samples: sampleRows(stData.emptyRows), detail: stData.emptyRows.length + ' registro(s) sem data de concretagem (mescladas já consideradas).', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Identificamos ' + stData.emptyRows.length + ' registro(s) sem a data da concretagem. Poderiam nos informar as datas desses lançamentos?' });
      if (dateInvalid.length) addIssue({ code: 'DATA_INVALIDA', category: CAT.BLOQUEADOR, field: 'data', title: 'Datas inválidas', rows: dateInvalid, samples: sampleRows(dateInvalid, function (r) { return { valor: String(val(r, 'data')) }; }), detail: dateInvalid.length + ' registro(s) com valor de data que não pôde ser interpretado.', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Alguns registros possuem datas que não conseguimos interpretar. Poderiam validar essas datas?' });
      if (dateFuture.length) addIssue({ code: 'DATA_FUTURA', category: CAT.BLOQUEADOR, field: 'data', title: 'Datas futuras', rows: dateFuture, samples: sampleRows(dateFuture), detail: dateFuture.length + ' registro(s) com data posterior a hoje (' + fmtDate(todayUTC) + ').', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Identificamos concretagens com data futura. Precisamos validar essas datas.' });
      if (dateOld.length) addIssue({ code: 'DATA_ANTIGA', category: CAT.ALERTA, field: 'data', title: 'Datas com mais de 3 anos', rows: dateOld, samples: sampleRows(dateOld), detail: dateOld.length + ' registro(s) anteriores a ' + fmtDate(new Date(Date.UTC(todayUTC.getUTCFullYear() - 3, todayUTC.getUTCMonth(), todayUTC.getUTCDate()))) + '.', provenance: 'DADO_ORIGINAL' });
      /* outlier temporal adaptativo (mediana + desvio absoluto mediano) */
      if (dateVals.length >= 4) {
        var ts = dateVals.map(function (o) { return o.d.getTime(); });
        var med = median(ts);
        var absdev = ts.map(function (t) { return Math.abs(t - med); });
        var madv = median(absdev) || 0;
        var DAY = 86400000;
        var lim = Math.max(540 * DAY, 6 * madv); // ≥ ~18 meses OU 6×MAD
        var outliers = dateVals.filter(function (o) { return Math.abs(o.d.getTime() - med) > lim; }).map(function (o) { return o.r; });
        if (outliers.length && outliers.length <= Math.ceil(dateVals.length * 0.2)) {
          addIssue({ code: 'DATA_OUTLIER', category: CAT.ALERTA, field: 'data', title: 'Data muito diferente do restante da base', rows: outliers, samples: sampleRows(outliers), detail: 'Detecção adaptativa (mediana da base ' + fmtDate(new Date(med)) + '). Ex.: um registro isolado de ano muito distante.', provenance: 'DADO_ORIGINAL', clientAsk: 'Um ou mais registros possuem data muito distante do período das demais concretagens. Poderiam confirmar se a data está correta?' });
        }
      }
    }

    /* ── 5.2 NF ── */
    var stNF = fieldStats('nf');
    inventory.push(stNF);
    if (!mapping.nf) {
      addIssue({ code: 'NF_CAMPO_AUSENTE', category: CAT.BLOQUEADOR, field: 'nf', title: 'Coluna de Nota Fiscal não identificada', detail: 'Nenhuma coluna de NF/DANFE/Remessa foi localizada.', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Não localizamos a Nota Fiscal (ou remessa) de cada entrega. Essa informação é necessária para a rastreabilidade. É possível incluí-la?' });
    } else if (stNF.emptyRows.length) {
      addIssue({ code: 'NF_VAZIA', category: CAT.BLOQUEADOR, field: 'nf', title: 'Registros sem NF', rows: stNF.emptyRows, samples: sampleRows(stNF.emptyRows), detail: stNF.emptyRows.length + ' registro(s) sem número de NF/remessa.', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Identificamos ' + stNF.emptyRows.length + ' registro(s) sem número de NF/remessa. Poderiam complementar?' });
    }

    /* ── granularidade (seção 4) — antes do juízo de NF duplicada ── */
    var granularity = detectGranularity();
    function detectGranularity() {
      var ev = [];
      if (!mapping.nf) return { type: 'unknown', label: 'Não identificada com segurança', confidence: 0, evidence: ['Sem coluna de NF para avaliar repetição.'] };
      var groups = {}, withNF = 0;
      for (var i = 0; i < records.length; i++) {
        var v = val(records[i], 'nf');
        if (isBlank(v) || isDashNA(v)) continue;
        withNF++;
        var k = String(v).trim();
        (groups[k] = groups[k] || []).push(records[i]);
      }
      var uniq = Object.keys(groups).length;
      if (!withNF) return { type: 'unknown', label: 'Não identificada com segurança', confidence: 0, evidence: ['Coluna de NF vazia.'] };
      var dupRows = 0, dupGroups = 0;
      for (var k2 in groups) { if (groups[k2].length > 1) { dupGroups++; dupRows += groups[k2].length; } }
      var uniqueRatio = uniq / withNF;
      var hasCP = !!mapping.cp, hasIdade = !!mapping.idade;
      if (uniqueRatio >= 0.95) {
        ev.push(Math.round(uniqueRatio * 100) + '% das NFs são únicas (1 linha por NF).');
        if (mapping.volume) ev.push('Coluna de volume por linha presente.');
        return { type: 'truck', label: 'Caminhão / NF', confidence: mapping.volume ? 0.9 : 0.8, evidence: ev, groups: groups };
      }
      if (hasCP) {
        ev.push('Coluna de corpo de prova detectada (' + mapping.cp.header + ').');
        ev.push('NFs repetem em ' + dupGroups + ' grupo(s) — padrão compatível com 1 linha por CP.');
        return { type: 'cp', label: 'Corpo de prova', confidence: 0.8, evidence: ev, groups: groups };
      }
      if (hasIdade) {
        ev.push('Coluna de idade por linha detectada (' + mapping.idade.header + ').');
        return { type: 'age', label: 'Idade de rompimento', confidence: 0.75, evidence: ev, groups: groups };
      }
      if (dupRows / withNF < 0.3) {
        ev.push('Maioria das NFs é única; ' + dupGroups + ' grupo(s) repetido(s) — provável duplicidade pontual.');
        return { type: 'truck', label: 'Caminhão / NF', confidence: 0.75, evidence: ev, groups: groups };
      }
      ev.push('NFs repetem com frequência (' + Math.round((dupRows / withNF) * 100) + '% das linhas) sem coluna de CP/idade identificada.');
      return { type: 'mixed', label: 'Estrutura mista / não identificada com segurança', confidence: 0.5, evidence: ev, groups: groups };
    }

    /* NF duplicada condicionada à granularidade */
    if (mapping.nf && granularity.groups) {
      var dupRowsAll = [], dupPairsSameUsina = [], dupNoUsina = [];
      for (var gk in granularity.groups) {
        var g = granularity.groups[gk];
        if (g.length <= 1) continue;
        dupRowsAll = dupRowsAll.concat(g);
        if (mapping.usina) {
          var usinas = {};
          for (var gi = 0; gi < g.length; gi++) { var u = norm(val(g[gi], 'usina')); usinas[u] = (usinas[u] || 0) + 1; }
          var same = Object.keys(usinas).some(function (u2) { return u2 !== '' && usinas[u2] > 1; });
          if (same) dupPairsSameUsina = dupPairsSameUsina.concat(g);
        } else dupNoUsina = dupNoUsina.concat(g);
      }
      if (dupRowsAll.length) {
        if (granularity.type === 'truck') {
          if (mapping.usina && dupPairsSameUsina.length) {
            addIssue({ code: 'NF_DUPLICADA', category: CAT.BLOQUEADOR, field: 'nf', title: 'Possível NF duplicada (mesma NF + mesma concreteira)', rows: dupPairsSameUsina, samples: sampleRows(dupPairsSameUsina, function (r) { return { usina: String(val(r, 'usina') || '') }; }), detail: 'A planilha aparenta ter 1 linha por caminhão; a repetição indica possível lançamento duplicado.', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Identificamos NFs repetidas para a mesma concreteira. Poderiam confirmar se são lançamentos duplicados ou entregas distintas?' });
          } else if (!mapping.usina) {
            addIssue({ code: 'NF_REPETIDA_SEM_USINA', category: CAT.ALERTA, field: 'nf', title: 'NF repetida — duplicidade não confirmável', rows: dupNoUsina.length ? dupNoUsina : dupRowsAll, samples: sampleRows(dupNoUsina.length ? dupNoUsina : dupRowsAll), detail: 'Não é possível confirmar duplicidade porque a concreteira não foi identificada.', provenance: 'DADO_ORIGINAL', clientAsk: 'Algumas NFs aparecem repetidas e a planilha não informa a concreteira. Poderiam confirmar se são entregas distintas?' });
          } else {
            addIssue({ code: 'NF_REPETIDA_USINAS_DIFERENTES', category: CAT.INFO, field: 'nf', title: 'NF repetida entre concreteiras diferentes', rows: dupRowsAll, samples: sampleRows(dupRowsAll), detail: 'Mesma numeração em fornecedores distintos — normalmente não é duplicidade.', provenance: 'DADO_ORIGINAL' });
          }
        } else if (granularity.type === 'cp' || granularity.type === 'age') {
          addIssue({ code: 'NF_REPETIDA_CP', category: CAT.INFO, field: 'nf', title: 'NF repetida — compatível com múltiplos corpos de prova', rows: dupRowsAll, samples: sampleRows(dupRowsAll), detail: 'A granularidade provável é "' + granularity.label + '": a repetição de NF tende a decorrer de vários CPs/idades da mesma entrega, não de caminhões duplicados.', provenance: 'DADO_ORIGINAL' });
        } else {
          addIssue({ code: 'NF_REPETIDA_GRANULARIDADE_INCERTA', category: CAT.ALERTA, field: 'nf', title: 'NF repetida — granularidade não identificada', rows: dupRowsAll, samples: sampleRows(dupRowsAll), detail: 'Não foi possível determinar com segurança se cada linha representa um caminhão. Revisão manual recomendada.', provenance: 'DADO_ORIGINAL' });
        }
      }
    }

    /* ── 5.3 VOLUME ── */
    var volZero = [], volHigh = [], volNonNum = [];
    var stVol = fieldStats('volume', function (v, r) {
      var p = parseNumber(v);
      if (p.nonNumericText) { volNonNum.push({ r: r, v: v }); return { invalid: true, why: 'não numérico' }; }
      if (p.value == null) return null;
      var out = null;
      if (p.value <= 0) { volZero.push(r); out = { invalid: true, why: '≤ 0' }; }
      else if (p.value > 16) { volHigh.push(r); out = { invalid: true, why: '> 16 m³' }; }
      if (p.normalized) { out = out || {}; out.normalized = true; out.value = p.value; }
      return out;
    });
    inventory.push(stVol);
    if (!mapping.volume) {
      addIssue({ code: 'VOLUME_CAMPO_AUSENTE', category: CAT.NECESSITA_DEFINICAO, field: 'volume', title: 'Volume por caminhão/NF não identificado', detail: 'Nenhuma coluna de volume por entrega foi localizada (colunas de volume total/aproveitamento são ignoradas nesta triagem).', provenance: 'NECESSITA_CLIENTE', alternative: 'Definir volume padrão por caminhão (ex.: 7 m³ ou 8 m³) mediante autorização do cliente.', clientAsk: 'Não identificamos o volume de concreto por caminhão/Nota Fiscal. Caso essa informação não esteja disponível, podemos adotar um volume padrão para os caminhões. É possível fornecer o volume de cada caminhão? Caso não seja possível, qual volume padrão devemos considerar (por exemplo, 7 m³ ou 8 m³)?' });
    } else {
      if (stVol.emptyRows.length) addIssue({ code: 'VOLUME_VAZIO', category: CAT.NECESSITA_DEFINICAO, field: 'volume', title: 'Registros sem volume', rows: stVol.emptyRows, samples: sampleRows(stVol.emptyRows), detail: stVol.emptyRows.length + ' registro(s) sem volume informado.', provenance: 'NECESSITA_CLIENTE', alternative: 'Adotar volume padrão apenas para as linhas vazias, mediante autorização.', clientAsk: 'Alguns caminhões estão sem volume informado (' + stVol.emptyRows.length + ' registro(s)). Podem completar, ou devemos adotar um volume padrão para esses casos?' });
      if (volZero.length) addIssue({ code: 'VOLUME_INVALIDO', category: CAT.BLOQUEADOR, field: 'volume', title: 'Volume menor ou igual a zero', rows: volZero, samples: sampleRows(volZero, function (r) { return { valor: String(val(r, 'volume')) }; }), detail: volZero.length + ' registro(s) com volume ≤ 0.', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Alguns registros possuem volume igual ou inferior a zero. Poderiam validar esses valores?' });
      if (volHigh.length) addIssue({ code: 'VOLUME_FORA_LIMITE', category: CAT.BLOQUEADOR, field: 'volume', title: 'Volume acima de 16 m³ por caminhão', rows: volHigh, samples: sampleRows(volHigh, function (r) { return { valor: String(val(r, 'volume')) }; }), detail: volHigh.length + ' registro(s) acima do limite físico usual de um caminhão betoneira.', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Identificamos volumes acima de 16 m³ em um único caminhão. Poderiam confirmar se são somas de entregas ou erros de digitação?' });
      if (volNonNum.length) addIssue({ code: 'VOLUME_NAO_NUMERICO', category: CAT.BLOQUEADOR, field: 'volume', title: 'Volume com texto não numérico', rows: volNonNum.map(function (o) { return o.r; }), samples: volNonNum.slice(0, 8).map(function (o) { return { linha: o.r + 1, valor: String(o.v) }; }), detail: 'Valores como texto por extenso não podem ser interpretados com segurança.', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Alguns volumes estão descritos como texto e não conseguimos interpretá-los. Poderiam informar o valor numérico?' });
      if (stVol.normalized) addIssue({ code: 'VOLUME_NORMALIZAVEL', category: CAT.INFO, field: 'volume', title: 'Volumes com unidade no texto — correção automática possível', count: stVol.normalized, samples: stVol.normalizedSamples.map(function (s) { return { original: s.original, interpretado: s.interpretado }; }), detail: 'Ex.: "8 m³" será interpretado como 8. O dado original é preservado.', provenance: 'NORMALIZACAO_AUTOMATICA' });
    }

    /* ── 5.4 FCK e TRAÇO (conceitos separados) ── */
    var stFck = fieldStats('fck', function (v) {
      var p = parseNumber(v);
      var vv = p.value != null ? p.value : (extractFcksFromText(v)[0] || null);
      if (vv == null) return { invalid: true, why: 'FCK não interpretável' };
      if (vv < 5 || vv > 100) return { invalid: true, why: 'fora da faixa 5–100 MPa' };
      if (p.normalized || p.value == null) return { normalized: true, value: vv };
      return null;
    });
    if (mapping.fck && mapping.fck.derivedFromText) stFck.label += ' (extraído do texto do traço)';
    inventory.push(stFck);
    var stTraco = fieldStats('traco');
    inventory.push(stTraco);
    var tracoDedicated = mapping.traco && (!mapping.fck || mapping.traco.col !== mapping.fck.col || !mapping.fck.derivedFromText);
    if (!mapping.fck && !mapping.traco) {
      addIssue({ code: 'CONCRETO_NAO_IDENTIFICADO', category: CAT.BLOQUEADOR, field: 'fck', title: 'Nem FCK nem Traço identificados', detail: 'Não localizamos coluna de FCK nem de especificação do concreto.', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Não localizamos a resistência (FCK) nem a especificação do concreto na planilha. Poderiam informar o FCK de projeto de cada concretagem?' });
    } else if (mapping.fck && !tracoDedicated) {
      addIssue({ code: 'TRACO_AUSENTE_FCK_PRESENTE', category: CAT.ALTERNATIVA, field: 'traco', title: 'FCK presente, traço/especificação ausente', detail: 'A planilha possui FCK, porém não possui a especificação completa do traço.', provenance: 'ALTERNATIVA_OPERACIONAL', alternative: 'Correlacionar posteriormente FCK + local de aplicação com os traços cadastrados no Consulte GEO de mesmo FCK; quando houver mais de um traço compatível, validar a aplicação antes da importação. Nenhum traço é atribuído automaticamente nesta etapa.', clientAsk: 'A planilha possui o FCK de projeto, mas não possui a especificação completa do concreto (traço). Caso vocês não tenham o traço utilizado, podemos avaliar a associação aos traços já cadastrados no Consulte GEO que possuam o mesmo FCK e aplicação compatível. Podemos proceder dessa maneira?' });
    } else if (!mapping.fck && tracoDedicated) {
      addIssue({ code: 'FCK_VIA_TRACO', category: CAT.INFO, field: 'fck', title: 'FCK não dedicado — poderá derivar do traço', detail: 'Há coluna de traço/especificação; o FCK poderá ser obtido dela na conversão.', provenance: 'ALTERNATIVA_OPERACIONAL' });
    }
    if (mapping.fck && stFck.emptyRows.length) {
      addIssue({ code: 'FCK_VAZIO', category: CAT.ALERTA, field: 'fck', title: 'Registros sem FCK', rows: stFck.emptyRows, samples: sampleRows(stFck.emptyRows), detail: stFck.emptyRows.length + ' registro(s) sem FCK informado.', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Alguns registros estão sem o FCK informado. Poderiam complementar?' });
    }

    /* ── 5.5 CONFLITO DE FCK (colunas auxiliares) ── */
    if (mapping.fck) {
      var conflictRows = [];
      var auxFields = ['obs', 'traco', 'elemento', 'descricao', 'pavimento'];
      for (var ri = 0; ri < records.length; ri++) {
        var r5 = records[ri];
        var mainRaw = val(r5, 'fck');
        var pMain = parseNumber(mainRaw);
        var mainF = pMain.value != null && pMain.value >= 5 && pMain.value <= 100 ? pMain.value : (extractFcksFromText(mainRaw)[0] || null);
        if (mainF == null) continue;
        var others = [];
        for (var a = 0; a < auxFields.length; a++) {
          var af = auxFields[a];
          if (!mapping[af]) continue;
          if (mapping.fck && mapping[af].col === mapping.fck.col) continue;
          var fs = extractFcksFromText(val(r5, af));
          for (var fi = 0; fi < fs.length; fi++) if (Math.abs(fs[fi] - mainF) > 0.01) others.push({ field: af, value: fs[fi], text: String(val(r5, af)) });
        }
        if (others.length) conflictRows.push({ r: r5, main: mainF, others: others });
      }
      if (conflictRows.length) {
        addIssue({
          code: 'FCK_CONFLITANTE', category: CAT.BLOQUEADOR, field: 'fck', title: 'FCK conflitante entre campo de projeto e observações/descrições',
          rows: conflictRows.map(function (o) { return o.r; }),
          samples: conflictRows.slice(0, 8).map(function (o) { return { linha: o.r + 1, fckProjeto: o.main, fckTexto: o.others[0].value, onde: FIELDS[o.others[0].field].label, texto: o.others[0].text.slice(0, 60) }; }),
          detail: conflictRows.length + ' registro(s) com FCK divergente entre o campo principal e textos auxiliares. Os dois valores são exibidos; nenhum é escolhido automaticamente.',
          provenance: 'NECESSITA_CLIENTE',
          clientAsk: 'Identificamos registros nos quais o FCK informado no campo de projeto é diferente do FCK descrito nas observações. Precisamos confirmar qual foi o concreto efetivamente fornecido para essas concretagens.'
        });
      }
    }

    /* ── 5.6/5.7 LOCAL DE APLICAÇÃO ── */
    var locFieldsStructured = ['torre', 'bloco', 'pavimento'];
    var locFieldsAll = ['torre', 'bloco', 'pavimento', 'elemento', 'descricao'];
    var locStats = {};
    for (var lf = 0; lf < locFieldsAll.length; lf++) {
      var fdef = locFieldsAll[lf];
      var stl = fieldStats(fdef);
      locStats[fdef] = stl;
      inventory.push(stl);
    }
    var anyLocMapped = locFieldsAll.some(function (f2) { return !!mapping[f2]; });
    var rowsNoLoc = [], rowsPartial = [];
    if (anyLocMapped) {
      for (var ri2 = 0; ri2 < records.length; ri2++) {
        var r6 = records[ri2];
        var structured = locFieldsStructured.some(function (f3) { return mapping[f3] && !isBlank(val(r6, f3)); });
        var textual = ['elemento', 'descricao'].some(function (f4) { return mapping[f4] && !isBlank(val(r6, f4)); });
        if (!structured && !textual) rowsNoLoc.push(r6);
        else if (!structured && textual) rowsPartial.push(r6);
      }
      if (rowsNoLoc.length) addIssue({ code: 'LOCAL_SEM_INFORMACAO', category: CAT.BLOQUEADOR, field: 'local', title: 'Registros sem nenhuma informação de local', rows: rowsNoLoc, samples: sampleRows(rowsNoLoc), detail: 'Torre, Bloco/Lado, Pavimento/Local e descrição de peça estão vazios simultaneamente em ' + rowsNoLoc.length + ' registro(s).', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Em ' + rowsNoLoc.length + ' registro(s) não há nenhuma informação de localização (Torre, Bloco, Pavimento ou descrição da peça). Precisaremos que o local seja informado ou que seja definida uma regra geral aplicável à obra.' });
      if (rowsPartial.length) addIssue({ code: 'LOCAL_PARCIAL', category: CAT.ALERTA, field: 'local', title: 'Local parcial — apenas texto de peça/descrição', rows: rowsPartial, samples: sampleRows(rowsPartial, function (r) { return { peca: String((mapping.elemento && val(r, 'elemento')) || (mapping.descricao && val(r, 'descricao')) || '').slice(0, 50) }; }), detail: rowsPartial.length + ' registro(s) sem Torre/Bloco/Pavimento, porém com texto utilizável de peça/descrição — poderá apoiar a associação à estrutura, sem resolver automaticamente.', provenance: 'DADO_ORIGINAL', clientAsk: 'Em alguns registros as informações de localização estão incompletas. Quando existir descrição suficiente da peça, podemos utilizá-la como apoio para associação à estrutura do sistema. Podemos proceder assim para os casos com descrição?' });
    } else {
      addIssue({ code: 'LOCAL_CAMPO_AUSENTE', category: CAT.BLOQUEADOR, field: 'local', title: 'Nenhuma coluna de localização identificada', detail: 'Não localizamos Torre, Bloco, Pavimento, Peça ou descrição equivalente.', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Não localizamos informações de local de aplicação (Torre, Bloco, Pavimento, Peça). Precisaremos dessas informações ou de uma regra geral aplicável à obra.' });
    }

    /* ── 5.8 USINA ── */
    var suspRe = /^(anexar|verificar|a definir|definir|pendente|xx+|\?+|-)/;
    function supplierBlock(field, code, label, singularMsg) {
      var st = fieldStats(field, function (v) {
        if (suspRe.test(norm(v))) return { invalid: true, why: 'valor suspeito' };
        return null;
      });
      inventory.push(st);
      if (!mapping[field]) {
        addIssue({ code: code + '_CAMPO_AUSENTE', category: CAT.ALTERNATIVA, field: field, title: label + ' não identificado(a) na planilha', detail: 'Campo inexistente.', provenance: 'ALTERNATIVA_OPERACIONAL', alternative: singularMsg, clientAsk: 'Não identificamos ' + label.toLowerCase() + ' nos registros. ' + singularMsg });
      } else {
        if (st.emptyRows.length) addIssue({ code: code + '_INCOMPLETO', category: CAT.ALTERNATIVA, field: field, title: label + ' vazio(a) em parte dos registros', rows: st.emptyRows, samples: sampleRows(st.emptyRows), detail: st.emptyRows.length + ' registro(s) sem ' + label.toLowerCase() + '.', provenance: 'ALTERNATIVA_OPERACIONAL', alternative: singularMsg, clientAsk: 'Não identificamos ' + label.toLowerCase() + ' em todos os registros (' + st.emptyRows.length + ' vazio(s)). ' + singularMsg });
        if (st.invalidRows.length) addIssue({ code: code + '_SUSPEITO', category: CAT.ALERTA, field: field, title: 'Valores suspeitos na coluna de ' + label.toLowerCase(), rows: st.invalidRows.map(function (o) { return o.row; }), samples: st.invalidRows.slice(0, 8).map(function (o) { return { linha: o.row + 1, valor: o.value }; }), detail: 'Textos como "Anexar NF", "verificar" ou "-" não identificam um fornecedor real.', provenance: 'DADO_ORIGINAL', clientAsk: 'Alguns registros trazem textos como "' + (st.invalidRows[0] ? st.invalidRows[0].value : '') + '" no campo de ' + label.toLowerCase() + '. Poderiam informar o fornecedor correto desses casos?' });
      }
      return st;
    }
    var stUsina = supplierBlock('usina', 'USINA', 'Usina / Concreteira', 'Caso a obra possua apenas uma usina/concreteira cadastrada no Consulte GEO, podemos utilizá-la como padrão. Caso existam duas ou mais, precisaremos identificar o fornecedor correspondente a cada entrega.');
    var stLab = supplierBlock('laboratorio', 'LAB', 'Laboratório', 'Caso a obra possua apenas um laboratório cadastrado no Consulte GEO, podemos utilizá-lo como padrão para os registros sem informação. Havendo mais de um, precisaremos da indicação por registro.');

    /* ── 5.10 SLUMP ── */
    var slumpHeaderMM = mapping.slump && /\bmm\b|\(mm\)/.test(norm(mapping.slump.header));
    var slumpOut = [], slumpMM = [];
    var stSlump = fieldStats('slump', function (v, r) {
      var p = parseNumber(v);
      if (p.value == null) return p.nonNumericText ? { invalid: true, why: 'não numérico' } : null;
      var cm = p.value;
      if (slumpHeaderMM && cm > 30) { cm = p.value / 10; slumpMM.push({ r: r, de: p.value, para: cm }); return (cm > 0 && cm <= 30) ? { normalized: true, value: cm } : { invalid: true, why: 'fora do limite mesmo em cm', normalized: true, value: cm }; }
      if (cm <= 0 || cm > 30) { slumpOut.push({ r: r, v: p.value }); return { invalid: true, why: 'fora de 0–30 cm' }; }
      if (p.normalized) return { normalized: true, value: cm };
      return null;
    });
    inventory.push(stSlump);
    if (!mapping.slump) {
      addIssue({ code: 'SLUMP_AUSENTE', category: CAT.ALTERNATIVA, field: 'slump', title: 'Slump não identificado', detail: 'Campo inexistente na planilha.', provenance: 'ALTERNATIVA_OPERACIONAL', alternative: 'Após definirmos o traço correspondente, utilizar o valor nominal de Slump cadastrado no traço, desconsiderando a tolerância (ex.: FCK 30 | BRITA 1 | SLUMP 12±2 CM → Slump considerado = 12 cm).', clientAsk: 'Não identificamos o Slump na planilha. Após definirmos o traço correspondente, podemos utilizar como referência o valor nominal de Slump cadastrado no próprio traço (ex.: 12±2 cm → 12 cm). Podemos proceder desta maneira?' });
    } else {
      if (slumpOut.length) addIssue({ code: 'SLUMP_FORA_LIMITE', category: CAT.ALERTA, field: 'slump', title: 'Slump fora do limite (0–30 cm)', rows: slumpOut.map(function (o) { return o.r; }), samples: slumpOut.slice(0, 8).map(function (o) { return { linha: o.r + 1, valor: o.v }; }), detail: 'Sem evidência de unidade mm no cabeçalho, valores acima de 30 cm são tratados como fora do limite (nenhuma conversão silenciosa é aplicada).', provenance: 'DADO_ORIGINAL', clientAsk: 'Alguns valores de Slump estão fora da faixa usual (0–30 cm). Poderiam confirmar a unidade utilizada e os valores?' });
      if (slumpMM.length) addIssue({ code: 'SLUMP_MM_CONVERSIVEL', category: CAT.INFO, field: 'slump', title: 'Slump em milímetros — correção automática possível', count: slumpMM.length, samples: slumpMM.slice(0, 8).map(function (o) { return { linha: o.r + 1, original: o.de + ' mm', interpretado: o.para + ' cm' }; }), detail: 'O cabeçalho indica mm; para análise, 240 mm → 24 cm. Registrado como normalização, nunca silencioso.', provenance: 'NORMALIZACAO_AUTOMATICA' });
    }

    /* ── 5.11 FLOW ── */
    var flowOut = [];
    var stFlow = fieldStats('flow', function (v, r) {
      var p = parseNumber(v);
      if (p.value == null) return null;
      if (p.value <= 0 || p.value > 70) { flowOut.push({ r: r, v: p.value }); return { invalid: true, why: 'fora de 0–70 cm' }; }
      if (p.normalized) return { normalized: true, value: p.value };
      return null;
    });
    inventory.push(stFlow);
    if (mapping.flow && flowOut.length) {
      addIssue({ code: 'FLOW_FORA_LIMITE', category: CAT.ALERTA, field: 'flow', title: 'Flow fora do limite (0–70 cm)', rows: flowOut.map(function (o) { return o.r; }), samples: flowOut.slice(0, 8).map(function (o) { return { linha: o.r + 1, valor: o.v }; }), detail: flowOut.length + ' registro(s) com espalhamento fora da faixa.', provenance: 'DADO_ORIGINAL', clientAsk: 'Alguns valores de Flow/espalhamento estão fora da faixa usual (0–70 cm). Poderiam confirmar esses valores?' });
    }
    /* Flow ausente: não é erro (pode derivar do traço FLOW futuramente). */

    /* ── 5.12 PLACA ── */
    var stPlaca = fieldStats('placa');
    inventory.push(stPlaca);
    if (!mapping.placa) {
      addIssue({ code: 'PLACA_AUSENTE', category: CAT.ALTERNATIVA, field: 'placa', title: 'Placa/betoneira não informada', detail: 'Na importação poderá ser utilizado o valor padrão IMPORT. Não é bloqueador e não será solicitada ao cliente.', provenance: 'ALTERNATIVA_OPERACIONAL', alternative: 'Usar valor padrão IMPORT na importação.' });
    }

    /* ── 5.13 HORÁRIOS (informativos) ── */
    var horas = ['horaCarga', 'horaChegada', 'horaInicio', 'horaFim'].filter(function (hf) { return !!mapping[hf]; });
    addIssue({ code: 'HORARIOS_INFO', category: CAT.INFO, field: 'horarios', title: 'Horários de carregamento/descarga', count: horas.length, detail: horas.length ? ('Detectados: ' + horas.map(function (hf) { return mapping[hf].header; }).join(' · ') + '. Opcionais nesta etapa.') : 'Nenhuma coluna de horário detectada. Horários são opcionais na triagem e não geram pendência para o cliente.', provenance: 'DADO_ORIGINAL' });

    /* ── 5.14 ROMPIMENTOS ── */
    var agesInv = [];
    var resHigh = [], resBad = [];
    for (var ai = 0; ai < ages.length; ai++) {
      var A = ages[ai];
      var filled = 0, empty = 0, invalid = 0, normalizedN = 0;
      for (var ri3 = 0; ri3 < records.length; ri3++) {
        var rv = (matrix[records[ri3]] || [])[A.col];
        if (isBlank(rv) || isDashNA(rv)) { empty++; continue; }
        filled++;
        var pr = parseNumber(rv);
        if (pr.value == null) { invalid++; resBad.push({ r: records[ri3], v: rv, age: A.label }); continue; }
        if (pr.normalized) normalizedN++;
        if (pr.value <= 0) { invalid++; resBad.push({ r: records[ri3], v: rv, age: A.label }); }
        else if (pr.value > 150) { resHigh.push({ r: records[ri3], v: pr.value, age: A.label }); }
      }
      agesInv.push({ idade: A.label, hours: A.hours, coluna: A.header, preenchidos: filled, vazios: empty, invalidos: invalid, normalizados: normalizedN, pct: (filled + empty) ? Math.round(100 * filled / (filled + empty)) : 0 });
    }
    if (resHigh.length) addIssue({ code: 'RESISTENCIA_FORA_LIMITE', category: CAT.BLOQUEADOR, field: 'rompimentos', title: 'Resistência acima de 150 MPa', rows: resHigh.map(function (o) { return o.r; }), samples: resHigh.slice(0, 8).map(function (o) { return { linha: o.r + 1, idade: o.age, valor: o.v + ' MPa' }; }), detail: 'Valores fisicamente implausíveis para controle usual.', provenance: 'NECESSITA_CLIENTE', clientAsk: 'Identificamos resultados de rompimento acima de 150 MPa. Poderiam confirmar se houve erro de digitação ou de unidade nesses registros?' });
    if (resBad.length) addIssue({ code: 'RESISTENCIA_INVALIDA', category: CAT.ALERTA, field: 'rompimentos', title: 'Resultados de rompimento não numéricos ou ≤ 0', rows: resBad.map(function (o) { return o.r; }), samples: resBad.slice(0, 8).map(function (o) { return { linha: o.r + 1, idade: o.age, valor: String(o.v) }; }), detail: resBad.length + ' valor(es) que não puderam ser interpretados como MPa.', provenance: 'DADO_ORIGINAL' });
    addIssue({ code: 'IDADES_INVENTARIO', category: CAT.INFO, field: 'rompimentos', title: agesInv.length ? ('Idades de controle detectadas: ' + agesInv.map(function (a2) { return a2.idade; }).join(' · ')) : 'Nenhuma coluna de rompimento detectada', count: agesInv.length, detail: agesInv.length ? 'A construtora controla ' + agesInv.length + ' idade(s). Não é exigido nesta etapa que todas as idades existam.' : 'Resultados de rompimento não localizados — informativo; podem estar em outra aba ou documento.', provenance: 'DADO_ORIGINAL' });

    /* — organização final — */
    issues.sort(function (a, b) { return (CAT_ORDER[a.category] - CAT_ORDER[b.category]) || ((b.count || 0) - (a.count || 0)); });
    var internal = issues.filter(function (i) { return i.category === CAT.ALTERNATIVA || (i.category === CAT.INFO && i.provenance === 'NORMALIZACAO_AUTOMATICA'); });
    var needClient = issues.filter(function (i) { return (i.category === CAT.BLOQUEADOR || i.category === CAT.NECESSITA_DEFINICAO) && i.clientAsk; });

    var counts = { BLOQUEADOR: 0, NECESSITA_DEFINICAO: 0, ALTERNATIVA_DISPONIVEL: 0, ALERTA: 0, INFORMATIVO: 0 };
    for (var ii = 0; ii < issues.length; ii++) counts[issues[ii].category]++;
    var status = counts.BLOQUEADOR || counts.NECESSITA_DEFINICAO ? 'NECESSITA COMPLEMENTAÇÃO DO CLIENTE'
      : (counts.ALTERNATIVA_DISPONIVEL ? 'PRONTA PARA TRATAMENTO INTERNO' : 'APTA PARA PRÉ-IMPORTAÇÃO');

    var essentials = buildEssentials();
    function buildEssentials() {
      function line(st2, mand) {
        if (!st2 || !st2.found) return { label: st2 ? st2.label : '', mark: mand ? 'x' : 'warn', text: 'campo não identificado' };
        var tot = st2.filled + st2.empty;
        var mark = st2.empty === 0 && st2.invalid === 0 ? 'ok' : (st2.empty + st2.invalid > 0 && (mand || st2.invalid) ? 'warn' : 'ok');
        if (mand && (st2.empty > 0 || st2.invalid > 0)) mark = 'warn';
        return { label: st2.label, mark: mark, text: st2.filled + '/' + tot + (st2.invalid ? (' · ' + st2.invalid + ' inválido(s)') : '') };
      }
      var loc = anyLocMapped ? { label: 'Local de aplicação', mark: rowsNoLoc.length ? 'warn' : 'ok', text: rowsNoLoc.length ? rowsNoLoc.length + ' registro(s) sem informação suficiente' : 'presente' } : { label: 'Local de aplicação', mark: 'x', text: 'não identificado' };
      return [
        line(stData, true), line(stNF, true),
        mapping.volume ? line(stVol, true) : { label: 'Volume', mark: 'x', text: 'campo não identificado' },
        loc,
        mapping.fck ? line(stFck, false) : { label: 'FCK', mark: 'x', text: 'não identificado' },
        tracoDedicated ? line(stTraco, false) : { label: 'Traço / Concreto', mark: 'x', text: 'não identificado' },
        mapping.usina ? line(stUsina, false) : { label: 'Usina / Concreteira', mark: 'warn', text: 'não identificada' },
        mapping.laboratorio ? line(stLab, false) : { label: 'Laboratório', mark: 'warn', text: 'não identificado' }
      ];
    }

    var result = {
      engineVersion: ENGINE_VERSION, appVersion: APP_VERSION,
      today: fmtDate(todayUTC),
      workbook: { sheetNames: wb.SheetNames.slice(), chosen: chosen, scores: sheets },
      header: { start: header.start + 1, depth: header.depth, headers: header.headers },
      records: { count: records.length, indices: records, ignored: ignored },
      granularity: { type: granularity.type, label: granularity.label, confidence: Math.round((granularity.confidence || 0) * 100), evidence: granularity.evidence },
      mapping: mapping,
      inventory: inventory.filter(function (s) { return !!s; }),
      ages: agesInv,
      location: {
        perField: {
          torre: pf('torre'), bloco: pf('bloco'), pavimento: pf('pavimento'), elemento: pf('elemento')
        },
        rowsSemLocal: rowsNoLoc.map(function (r7) { return r7 + 1; }),
        rowsParciais: rowsPartial.length
      },
      issues: issues, internal: internal, needClient: needClient,
      summary: { status: status, counts: counts, registros: records.length, ignoradas: ignored.length }
    };
    function pf(f6) { var s2 = locStats[f6]; return s2 && s2.found ? { preenchidos: s2.filled, vazios: s2.empty } : null; }

    result.messages = {
      whatsapp: buildClientMessage(result, 'whatsapp'),
      email: buildClientMessage(result, 'email')
    };
    return result;
  }

  /* ── Mensagens ao cliente (seção 9) — somente problemas reais ─────────── */
  function buildClientMessage(res, mode) {
    var asks = res.issues.filter(function (i) { return !!i.clientAsk; });
    // BLOQUEADOR e NECESSITA_DEFINICAO primeiro; depois alternativas que pedem autorização
    asks.sort(function (a, b) { return CAT_ORDER[a.category] - CAT_ORDER[b.category]; });
    if (!asks.length) {
      return mode === 'whatsapp'
        ? 'Olá! Analisamos a planilha de controle tecnológico e não identificamos pendências que dependam de vocês. Seguiremos com o tratamento interno e a preparação da importação no Consulte GEO. Qualquer ponto, retornamos.'
        : 'Olá,\n\nAnalisamos a planilha de controle tecnológico encaminhada e não identificamos pendências que dependam de complementação de vocês. Seguiremos com o tratamento interno dos dados e a preparação da importação no Consulte GEO.\n\nQualquer ponto adicional, retornamos.\n\nAtenciosamente,\nEquipe Consulte GEO';
    }
    if (mode === 'whatsapp') {
      var lines = ['Olá! Analisamos a planilha de controle tecnológico e precisamos validar alguns pontos antes de preparar a importação no Consulte GEO:', ''];
      var n = 0;
      for (var i = 0; i < asks.length; i++) {
        n++;
        var short = asks[i].clientAsk;
        if (short.length > 220) short = short.slice(0, 217).replace(/\s+\S*$/, '') + '…';
        lines.push(n + '. *' + asks[i].title + '*' + (asks[i].count ? ' (' + asks[i].count + ' registro' + (asks[i].count > 1 ? 's' : '') + ')' : ''));
        lines.push(short);
        lines.push('');
      }
      lines.push('Podem nos retornar sobre esses pontos? Obrigado!');
      return lines.join('\n');
    }
    var out = ['Olá,', '', 'Analisamos a planilha de controle tecnológico encaminhada e identificamos algumas informações que precisamos validar ou complementar para conseguirmos tratar os dados e preparar a importação no Consulte GEO.', '', 'Aproveitando a revisão, detalhamos abaixo os principais pontos:', ''];
    for (var j = 0; j < asks.length; j++) {
      var it = asks[j];
      out.push((j + 1) + '. ' + it.title + (it.count ? ' — ' + it.count + ' registro(s)' : ''));
      if (it.detail) out.push('O que identificamos: ' + it.detail);
      out.push(it.clientAsk);
      if (it.alternative && it.clientAsk.indexOf(it.alternative.slice(0, 40)) === -1) out.push('Alternativa disponível: ' + it.alternative);
      out.push('');
    }
    out.push('Ficamos à disposição para esclarecer qualquer ponto.');
    out.push('');
    out.push('Atenciosamente,');
    out.push('Equipe Consulte GEO');
    return out.join('\n');
  }

  /* ── Relatório XLSX (seção 10) — 4 abas ───────────────────────────────── */
  function buildReportWorkbook(res, opts) {
    var X = getXLSX(opts);
    var wb = X.utils.book_new();
    var S = function (name, aoa) { X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(aoa), name); };
    var resumo = [
      ['Relatório de Pré-análise · Consulte GEO', ''],
      ['Versão do app', res.appVersion], ['Motor', res.engineVersion], ['Data da análise', res.today],
      ['Aba analisada', res.workbook.chosen],
      ['Cabeçalho (linha inicial / níveis)', res.header.start + ' / ' + res.header.depth],
      ['Registros analisados', res.summary.registros],
      ['Linhas ignoradas (cabeçalho/total/resumo)', res.summary.ignoradas],
      ['Granularidade provável', res.granularity.label + ' (' + res.granularity.confidence + '%)'],
      ['Status', res.summary.status],
      ['', ''],
      ['Ocorrências por categoria', ''],
      ['Bloqueador', res.summary.counts.BLOQUEADOR],
      ['Necessita definição', res.summary.counts.NECESSITA_DEFINICAO],
      ['Alternativa disponível', res.summary.counts.ALTERNATIVA_DISPONIVEL],
      ['Alerta', res.summary.counts.ALERTA],
      ['Informativo', res.summary.counts.INFORMATIVO]
    ];
    S('Resumo', resumo);
    var inv = [['Campo Consulte GEO', 'Campo encontrado', 'Confiança (%)', 'Preenchidos', 'Via mesclagem', 'Vazios', 'Inválidos', 'Normalizáveis', 'Únicos', 'Amostras']];
    for (var i = 0; i < res.inventory.length; i++) {
      var s = res.inventory[i];
      inv.push([s.label, s.found ? s.header : 'NÃO IDENTIFICADO', s.confidence || '', s.found ? s.filled : '', s.found ? s.filledByMerge : '', s.found ? s.empty : '', s.found ? s.invalid : '', s.found ? s.normalized : '', s.found ? s.uniqueCount : '', (s.samples || []).join(' | ')]);
    }
    for (var a = 0; a < res.ages.length; a++) {
      var ag = res.ages[a];
      inv.push(['Rompimento ' + ag.idade, ag.coluna, '', ag.preenchidos, '', ag.vazios, ag.invalidos, ag.normalizados, '', ag.pct + '% preenchido']);
    }
    S('Inventário de Campos', inv);
    var pend = [['Categoria', 'Código', 'Título', 'Campo', 'Registros', 'Detalhe', 'Alternativa', 'Pergunta ao cliente', 'Proveniência']];
    for (var j = 0; j < res.issues.length; j++) {
      var it = res.issues[j];
      pend.push([CAT_LABEL[it.category], it.code, it.title, it.field || '', it.count || 0, it.detail || '', it.alternative || '', it.clientAsk || '', it.provenance || '']);
    }
    S('Pendências', pend);
    var am = [['Código', 'Linha', 'Data', 'NF', 'Demais valores']];
    for (var j2 = 0; j2 < res.issues.length; j2++) {
      var iss = res.issues[j2];
      if (!iss.samples) continue;
      for (var k = 0; k < Math.min(iss.samples.length, 10); k++) {
        var sm = iss.samples[k], extra = [];
        for (var key in sm) { if (key !== 'linha' && key !== 'data' && key !== 'nf') extra.push(key + ': ' + sm[key]); }
        am.push([iss.code, sm.linha || '', sm.data || '', sm.nf || '', extra.join(' · ')]);
      }
    }
    S('Amostras', am);
    return wb;
  }

  function analyze(data, opts) {
    var X = getXLSX(opts);
    var wb = X.read(data, { type: (typeof data === 'string') ? 'binary' : 'array', cellDates: false });
    return analyzeWorkbook(wb, opts);
  }

  return {
    VERSION: ENGINE_VERSION, APP_VERSION: APP_VERSION,
    CAT: CAT, CAT_LABEL: CAT_LABEL,
    analyze: analyze, analyzeWorkbook: analyzeWorkbook,
    buildClientMessage: buildClientMessage, buildReportWorkbook: buildReportWorkbook,
    _internals: { norm: norm, parseNumber: parseNumber, parseDateVal: parseDateVal, extractFcksFromText: extractFcksFromText, parseAgeFromHeader: parseAgeFromHeader, detectHeader: detectHeader, safeMatrix: safeMatrix, scoreSheets: scoreSheets }
  };
}));
