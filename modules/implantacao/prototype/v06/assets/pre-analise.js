/* ============================================================================
 * Pré-análise de Recebimento — camada de página (glue)
 * Fluxo em 2 passos: Upload → Resultado. Processamento 100% local (browser).
 * Motor: IntakeAuditor (assets/intake-auditor.js) · Testes: intake-selftest.js
 * ========================================================================== */
(function () {
  'use strict';
  var state = { file: null, buffer: null, result: null, sheet: '', msgMode: 'whatsapp' };
  var $ = function (id) { return document.getElementById(id); };
  var CAT_PILL = {
    BLOQUEADOR: 'danger',
    NECESSITA_DEFINICAO: 'brand',
    ALTERNATIVA_DISPONIVEL: 'info',
    ALERTA: 'warning',
    INFORMATIVO: 'neutral'
  };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };

  /* ── toast ── */
  var toastT;
  function toast(msg) { var t = $('toast'); $('toastMsg').textContent = msg; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(function () { t.style.display = 'none'; }, 2800); }
  window.toast = toast;

  /* ── upload ── */
  function bindUpload() {
    var dz = $('dropzone'), inp = $('fileInput');
    dz.addEventListener('click', function () { inp.click(); });
    dz.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
    inp.addEventListener('change', function () { if (inp.files && inp.files[0]) loadFile(inp.files[0]); });
    ['dragover', 'dragenter'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('drag'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('drag'); }); });
    dz.addEventListener('drop', function (e) { var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) loadFile(f); });
  }
  function loadFile(f) {
    state.file = f;
    $('fileName').textContent = f.name + ' · ' + (f.size / 1024 < 1024 ? Math.round(f.size / 1024) + ' KB' : (f.size / 1048576).toFixed(1) + ' MB');
    $('fileChip').classList.remove('hidden');
    $('btnAnalyze').disabled = false;
    var rd = new FileReader();
    rd.onload = function () { state.buffer = rd.result; };
    rd.readAsArrayBuffer(f);
  }

  /* ── análise ── */
  function analyze() {
    if (!state.buffer) { toast('Selecione uma planilha primeiro.'); return; }
    $('btnAnalyze').disabled = true; $('btnAnalyze').textContent = 'Analisando…';
    setTimeout(function () {
      try {
        var opts = {};
        if (state.sheet) opts.sheet = state.sheet;
        state.result = IntakeAuditor.analyze(new Uint8Array(state.buffer), opts);
        window.IntakeBridge = { file: state.file, diagnosis: state.result }; // handoff p/ Pré-importação
        renderResult(state.result);
        $('step1').classList.add('hidden');
        $('step2').classList.remove('hidden');
        document.getElementById('main').scrollTop = 0;
      } catch (e) {
        toast('Falha ao analisar: ' + (e && e.message ? e.message : e));
      } finally {
        $('btnAnalyze').disabled = false;
        $('btnAnalyze').innerHTML = ICON_PLAY + ' Analisar planilha';
      }
    }, 30);
  }
  function reset() {
    $('step2').classList.add('hidden');
    $('step1').classList.remove('hidden');
    state.sheet = '';
  }

  var ICON_PLAY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>';

  /* ── render ── */
  function pill(cat) {
    var tone = CAT_PILL[cat] || 'neutral';
    return '<span class="pill ' + tone + '"><span class="dot"></span>' + esc(IntakeAuditor.CAT_LABEL[cat] || cat) + '</span>';
  }
  function mark(m) {
    if (m === 'ok') return '<span style="color:var(--success-600);font-weight:700">✓</span>';
    if (m === 'warn') return '<span style="color:var(--warning-600);font-weight:700">⚠</span>';
    return '<span style="color:var(--danger-600);font-weight:700">✕</span>';
  }

  function renderResult(r) {
    /* status */
    var stTone = r.summary.counts.BLOQUEADOR || r.summary.counts.NECESSITA_DEFINICAO ? 'warning' : (r.summary.counts.ALTERNATIVA_DISPONIVEL ? 'info' : 'success');
    $('statusBanner').className = 'alert ' + stTone;
    $('statusBanner').innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' +
      '<div><div class="t">' + esc(r.summary.status) + '</div>' +
      esc(r.records.count) + ' registro(s) de concreto identificados · ' + esc(r.records.ignored.length) + ' linha(s) ignoradas como cabeçalho/total/resumo · Granularidade provável: <b>' + esc(r.granularity.label) + '</b>' + (r.granularity.confidence ? ' (confiança ' + r.granularity.confidence + '%)' : '') + '</div>';

    /* stats */
    $('stReg').textContent = r.records.count;
    $('stBloq').textContent = r.summary.counts.BLOQUEADOR + r.summary.counts.NECESSITA_DEFINICAO;
    $('stAlt').textContent = r.summary.counts.ALTERNATIVA_DISPONIVEL;
    $('stAlerta').textContent = r.summary.counts.ALERTA;

    /* diagnóstico */
    $('diagBody').innerHTML =
      row('Aba analisada', esc(r.workbook.chosen) + sheetSelector(r)) +
      row('Cabeçalho', 'linha ' + r.header.start + ' · ' + r.header.depth + ' nível(is)') +
      row('Granularidade', esc(r.granularity.label) + ' · confiança ' + r.granularity.confidence + '%') +
      row('Evidências', esc((r.granularity.evidence || []).join(' ')) || '—') +
      row('Idades de controle', r.ages.length ? r.ages.map(function (a) { return '<span class="tag">' + esc(a.idade) + ' · ' + a.pct + '%</span>'; }).join(' ') : 'não detectadas') +
      row('Linhas ignoradas', r.records.ignored.length ? r.records.ignored.slice(0, 6).map(function (o) { return 'L' + o.row + ' (' + esc(o.reason) + ')'; }).join(' · ') + (r.records.ignored.length > 6 ? ' · +' + (r.records.ignored.length - 6) : '') : 'nenhuma');
    function row(k, v) { return '<div class="row" style="align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border-subtle)"><div class="label" style="width:170px;flex-shrink:0;padding-top:2px">' + k + '</div><div class="text-sm" style="flex:1">' + v + '</div></div>'; }
    function sheetSelector(r2) {
      if (r2.workbook.sheetNames.length < 2) return '';
      var opts = r2.workbook.sheetNames.map(function (n) { return '<option ' + (n === r2.workbook.chosen ? 'selected' : '') + '>' + esc(n) + '</option>'; }).join('');
      return ' &nbsp; <select id="sheetSel" class="select" style="display:inline-block;width:auto;height:30px;padding:0 30px 0 10px;font-size:12px">' + opts + '</select>';
    }

    /* essenciais */
    $('essentials').innerHTML = r.summary && buildEssentialsHtml(r);
    function buildEssentialsHtml(r3) {
      var es = essentialsFromResult(r3);
      return es.map(function (e) { return '<div class="row" style="gap:8px;padding:6px 0;border-bottom:1px solid var(--border-subtle)">' + mark(e.mark) + '<b style="width:190px;font-size:13px">' + esc(e.label) + '</b><span class="text-sm muted">' + esc(e.text) + '</span></div>'; }).join('');
    }

    /* inventário */
    var invRows = r.inventory.filter(function (s) { return s && s.label; }).map(function (s) {
      var situ = !s.found ? '<span class="pill danger"><span class="dot"></span>Não identificado</span>'
        : (s.invalid ? '<span class="pill warning"><span class="dot"></span>' + s.invalid + ' inválido(s)</span>'
          : (s.empty ? '<span class="pill warning"><span class="dot"></span>' + s.empty + ' vazio(s)</span>' : '<span class="pill success"><span class="dot"></span>OK</span>'));
      return '<tr><td><b style="font-size:13px">' + esc(s.label) + '</b></td>' +
        '<td class="text-sm">' + (s.found ? esc(s.header) : '<span class="muted">—</span>') + '</td>' +
        '<td class="num mono text-sm">' + (s.found ? s.confidence + '%' : '—') + '</td>' +
        '<td class="num mono text-sm">' + (s.found ? s.filled + (s.filledByMerge ? ' <span class="muted" title="preenchidos via célula mesclada">(' + s.filledByMerge + ' mescl.)</span>' : '') : '—') + '</td>' +
        '<td class="num mono text-sm">' + (s.found ? s.empty : '—') + '</td>' +
        '<td class="num mono text-sm">' + (s.found ? s.invalid : '—') + '</td>' +
        '<td>' + situ + '</td></tr>';
    }).join('');
    var ageRows = r.ages.map(function (a) {
      return '<tr><td><b style="font-size:13px">Rompimento ' + esc(a.idade) + '</b></td><td class="text-sm">' + esc(a.coluna) + '</td><td class="num mono text-sm">—</td><td class="num mono text-sm">' + a.preenchidos + '</td><td class="num mono text-sm">' + a.vazios + '</td><td class="num mono text-sm">' + a.invalidos + '</td><td><span class="pill neutral"><span class="dot"></span>' + a.pct + '% preenchido</span></td></tr>';
    }).join('');
    $('invBody').innerHTML = invRows + ageRows;

    /* problemas */
    var probs = r.issues.filter(function (i) { return i.category !== 'INFORMATIVO' || i.provenance === 'NORMALIZACAO_AUTOMATICA'; });
    $('probList').innerHTML = probs.length ? probs.map(function (i, idx) {
      var samples = (i.samples || []).length ? ('<div style="overflow-x:auto;margin-top:10px"><table class="table"><thead><tr>' + Object.keys(i.samples[0]).map(function (k) { return '<th>' + esc(k) + '</th>'; }).join('') + '</tr></thead><tbody>' + i.samples.map(function (s) { return '<tr>' + Object.keys(i.samples[0]).map(function (k) { return '<td class="text-sm">' + esc(s[k]) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>') : '';
      return '<details class="val-row ' + ({ BLOQUEADOR: 'error', NECESSITA_DEFINICAO: 'error', ALTERNATIVA_DISPONIVEL: 'info', ALERTA: 'warning', INFORMATIVO: 'info' }[i.category]) + '" style="display:block">' +
        '<summary style="display:flex;gap:12px;align-items:flex-start;cursor:pointer;list-style:none">' +
        '<div class="vmsg"><div class="vt">' + esc(i.title) + (i.count ? ' <span class="badge">' + i.count + '</span>' : '') + '</div>' +
        '<div class="vp">' + esc(i.code) + (i.detail ? ' — ' + esc(i.detail) : '') + '</div></div>' +
        '<span style="margin-left:auto;flex-shrink:0">' + pill(i.category) + '</span></summary>' +
        (i.alternative ? '<div class="alert info" style="margin-top:10px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg><div><b>Alternativa:</b> ' + esc(i.alternative) + '</div></div>' : '') +
        samples + '</details>';
    }).join('') : '<div class="alert success"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="9 12 11.5 14.5 16 9.5"/></svg><div>Nenhum problema identificado.</div></div>';

    /* interno × cliente */
    $('internalList').innerHTML = r.internal.length ? r.internal.map(function (i) {
      return '<div class="row" style="gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--border-subtle)"><span style="color:var(--success-600);font-weight:700">✓</span><div class="text-sm"><b>' + esc(i.title) + '</b>' + (i.alternative ? '<div class="muted" style="margin-top:2px">' + esc(i.alternative) + '</div>' : '') + '</div></div>';
    }).join('') : '<div class="text-sm muted">Nada a tratar internamente.</div>';
    $('clientList').innerHTML = r.needClient.length ? r.needClient.map(function (i) {
      return '<div class="row" style="gap:8px;align-items:flex-start;padding:7px 0;border-bottom:1px solid var(--border-subtle)"><span style="color:var(--danger-600);font-weight:700">✕</span><div class="text-sm"><b>' + esc(i.title) + (i.count ? ' (' + i.count + ')' : '') + '</b></div></div>';
    }).join('') : '<div class="text-sm muted">Nenhuma pendência depende do cliente.</div>';

    /* mensagem */
    setMsgMode(state.msgMode);

    /* listeners pós-render */
    var sel = $('sheetSel');
    if (sel) sel.addEventListener('change', function () { state.sheet = sel.value; analyzeAgain(); });
  }
  function analyzeAgain() {
    try {
      state.result = IntakeAuditor.analyze(new Uint8Array(state.buffer), state.sheet ? { sheet: state.sheet } : {});
      window.IntakeBridge = { file: state.file, diagnosis: state.result };
      renderResult(state.result);
      toast('Reanalisado na aba ' + state.result.workbook.chosen + '.');
    } catch (e) { toast('Falha: ' + e.message); }
  }

  function essentialsFromResult(r) {
    // espelha a lista essencial do resumo (motor já calcula inventário; aqui montamos a visão)
    function get(label) { for (var i = 0; i < r.inventory.length; i++) if (r.inventory[i] && r.inventory[i].label.indexOf(label) === 0) return r.inventory[i]; return null; }
    function line(st, mand, name) {
      if (!st || !st.found) return { label: name, mark: mand ? 'x' : 'warn', text: 'campo não identificado' };
      var tot = st.filled + st.empty;
      var m = (st.empty === 0 && st.invalid === 0) ? 'ok' : 'warn';
      return { label: name, mark: m, text: st.filled + '/' + tot + (st.invalid ? ' · ' + st.invalid + ' inválido(s)' : '') + (st.filledByMerge ? ' · ' + st.filledByMerge + ' via mesclagem' : '') };
    }
    var noLoc = r.location.rowsSemLocal.length;
    return [
      line(get('Data'), true, 'Data'),
      line(get('Nota Fiscal'), true, 'NF'),
      line(get('Volume'), true, 'Volume'),
      { label: 'Local de aplicação', mark: noLoc ? 'warn' : 'ok', text: noLoc ? noLoc + ' registro(s) sem informação suficiente' : 'presente' },
      line(get('FCK'), false, 'FCK'),
      line(get('Traço'), false, 'Traço'),
      line(get('Usina'), false, 'Usina'),
      line(get('Laboratório'), false, 'Laboratório')
    ];
  }

  /* ── mensagens ── */
  function setMsgMode(mode) {
    state.msgMode = mode;
    $('segWhats').classList.toggle('on', mode === 'whatsapp');
    $('segEmail').classList.toggle('on', mode === 'email');
    $('msgBox').value = state.result ? state.result.messages[mode] : '';
  }
  function copyMsg() {
    var txt = $('msgBox').value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () { toast('Mensagem copiada.'); }, function () { fallbackCopy(txt); });
    } else fallbackCopy(txt);
  }
  function fallbackCopy(txt) {
    var ta = $('msgBox'); ta.focus(); ta.select();
    try { document.execCommand('copy'); toast('Mensagem copiada.'); } catch (e) { toast('Selecione e copie manualmente (Ctrl+C).'); }
  }

  /* ── export ── */
  function downloadReport() {
    if (!state.result) return;
    var wb = IntakeAuditor.buildReportWorkbook(state.result);
    XLSX.writeFile(wb, 'Relatorio_Pre_Analise_Consulte_GEO.xlsx');
    toast('Relatório de pré-análise exportado.');
  }

  /* ── continuidade ── */
  function continueToPre() {
    if (window.IntakeBridge && typeof window.IntakeBridge.onContinue === 'function') {
      window.IntakeBridge.onContinue(window.IntakeBridge); return;
    }
    toast('Arquivo e diagnóstico preservados em IntakeBridge. No pacote v5.22.42, este botão abre a Pré-importação no passo "Insumos" com o mesmo arquivo (ver docs/INTEGRACAO-IMPORTA.md).');
  }

  /* ── self-test ── */
  function runSelfTest() {
    var out = IntakeSelfTest.run(IntakeAuditor, XLSX);
    var html = '<div class="row between" style="margin-bottom:10px"><b>' + out.passed + '/' + out.total + ' testes verdes</b>' + (out.failed ? '<span class="pill danger"><span class="dot"></span>' + out.failed + ' falha(s)</span>' : '<span class="pill success"><span class="dot"></span>Tudo certo</span>') + '</div>' +
      '<div style="overflow-x:auto"><table class="table"><thead><tr><th>Caso</th><th>Descrição</th><th>Resultado</th></tr></thead><tbody>' +
      out.results.map(function (r) { return '<tr><td class="mono text-sm">' + esc(r.id) + '</td><td class="text-sm">' + esc(r.name) + '</td><td class="text-sm">' + (r.pass ? '<span style="color:var(--success-600);font-weight:700">✓</span> ' : '<span style="color:var(--danger-600);font-weight:700">✕</span> ') + esc(r.info) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
    $('selftestOut').innerHTML = html;
    $('selftestOut').classList.remove('hidden');
    toast(out.passed + '/' + out.total + ' testes verdes.');
  }

  /* ── tema ── */
  function toggleTheme() { document.documentElement.classList.toggle('dark'); }

  /* ── init ── */
  document.addEventListener('DOMContentLoaded', function () {
    bindUpload();
    $('btnAnalyze').addEventListener('click', analyze);
    $('btnReset').addEventListener('click', reset);
    $('btnReset2').addEventListener('click', reset);
    $('segWhats').addEventListener('click', function () { setMsgMode('whatsapp'); });
    $('segEmail').addEventListener('click', function () { setMsgMode('email'); });
    $('btnCopyMsg').addEventListener('click', copyMsg);
    $('btnReport').addEventListener('click', downloadReport);
    $('btnContinue').addEventListener('click', continueToPre);
    $('btnSelfTest').addEventListener('click', runSelfTest);
    $('btnTheme').addEventListener('click', toggleTheme);
    var v = document.getElementById('appVersion');
    if (v) v.textContent = 'v' + IntakeAuditor.APP_VERSION + ' · motor ' + IntakeAuditor.VERSION;
  });
})();
