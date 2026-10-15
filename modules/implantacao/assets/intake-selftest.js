/* ============================================================================
 * Self-test da Pré-análise (Triagem) — casos obrigatórios C1–C20 + extras
 * Executável no browser (window.IntakeSelfTest.run) e no Node (gate de CI).
 * Constrói workbooks sintéticos em memória e valida o IntakeAuditor.
 * ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.IntakeSelfTest = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TODAY = '07/08/2026';
  var H = ['Data', 'NF', 'Volume', 'FCK Projeto', 'Torre', 'Bloco', 'Pavimento', 'Peça', 'Usina', 'Laboratório', 'Slump', 'Obs', 'Res. 7 dias', 'Res. 28 dias'];
  function baseRows() {
    return [
      ['10/05/2026', '1001', 8, 30, 'T1', 'B1', '2º Pav', 'Pilar P1', 'Concreto Forte', 'LabTec', 12, '', 22.1, 31.5],
      ['11/05/2026', '1002', 8, 30, 'T1', 'B1', '2º Pav', 'Pilar P2', 'Concreto Forte', 'LabTec', 12, '', 23.4, 32.0],
      ['12/05/2026', '1003', 7, 30, 'T1', 'B2', '3º Pav', 'Laje L1', 'Concreto Forte', 'LabTec', 12, '', 21.8, 30.9],
      ['13/05/2026', '1004', 8, 25, 'T2', 'B1', '1º Pav', 'Viga V1', 'Supermix', 'LabTec', 10, '', 18.2, 27.4],
      ['14/05/2026', '1005', 8, 25, 'T2', 'B1', '1º Pav', 'Viga V2', 'Supermix', 'LabTec', 10, '', 18.9, 26.8],
      ['15/05/2026', '1006', 7.5, 30, 'T2', 'B2', 'Térreo', 'Pilar P9', 'Concreto Forte', 'LabTec', 12, '', 22.0, 31.1],
      ['16/05/2026', '1007', 8, 30, 'T3', 'B1', 'Térreo', 'Radier R1', 'Concreto Forte', 'LabTec', 12, '', 24.1, 33.3],
      ['17/05/2026', '1008', 8, 30, 'T3', 'B2', '4º Pav', 'Laje L7', 'Supermix', 'LabTec', 12, '', 23.2, 32.6]
    ];
  }
  function mkWB(X, aoa, merges, name) {
    var wb = X.utils.book_new();
    var ws = X.utils.aoa_to_sheet(aoa);
    if (merges) ws['!merges'] = merges;
    X.utils.book_append_sheet(wb, ws, name || 'Controle');
    return wb;
  }
  function dropCol(headers, rows, colName) {
    var i = headers.indexOf(colName);
    var h2 = headers.slice(); h2.splice(i, 1);
    var r2 = rows.map(function (r) { var c = r.slice(); c.splice(i, 1); return c; });
    return { h: h2, rows: r2 };
  }
  function col(name) { return H.indexOf(name); }
  function findIssue(res, code) { for (var i = 0; i < res.issues.length; i++) if (res.issues[i].code === code) return res.issues[i]; return null; }
  function inv(res, label) { for (var i = 0; i < res.inventory.length; i++) if (res.inventory[i].label.indexOf(label) === 0) return res.inventory[i]; return null; }

  function run(IA, X) {
    var results = [];
    var opts = { today: TODAY, XLSX: X };
    function t(id, name, fn) {
      try {
        var info = fn();
        results.push({ id: id, name: name, pass: true, info: info || 'ok' });
      } catch (e) {
        results.push({ id: id, name: name, pass: false, info: String(e && e.message || e) });
      }
    }
    function assert(cond, msg) { if (!cond) throw new Error(msg); }

    t('C1', 'Planilha sem Volume → alternativa de volume padrão', function () {
      var d = dropCol(H, baseRows(), 'Volume');
      var res = IA.analyzeWorkbook(mkWB(X, [d.h].concat(d.rows)), opts);
      var iss = findIssue(res, 'VOLUME_CAMPO_AUSENTE');
      assert(iss, 'issue VOLUME_CAMPO_AUSENTE ausente');
      assert(iss.category === IA.CAT.NECESSITA_DEFINICAO, 'categoria=' + iss.category);
      assert(/padrão|padrao/i.test(iss.alternative || ''), 'alternativa sem "volume padrão"');
      return 'categoria ' + iss.category;
    });

    t('C2', 'FCK presente + traço ausente → associar por FCK + aplicação', function () {
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(baseRows())), opts);
      var iss = findIssue(res, 'TRACO_AUSENTE_FCK_PRESENTE');
      assert(iss, 'issue TRACO_AUSENTE_FCK_PRESENTE ausente');
      assert(iss.category === IA.CAT.ALTERNATIVA, 'categoria=' + iss.category);
      assert(/fck/i.test(iss.alternative || '') && /aplica/i.test(iss.alternative || ''), 'alternativa não menciona FCK+aplicação');
      return 'ok';
    });

    t('C3', 'Slump ausente → usar nominal do traço', function () {
      var d = dropCol(H, baseRows(), 'Slump');
      var res = IA.analyzeWorkbook(mkWB(X, [d.h].concat(d.rows)), opts);
      var iss = findIssue(res, 'SLUMP_AUSENTE');
      assert(iss && iss.category === IA.CAT.ALTERNATIVA, 'SLUMP_AUSENTE/ALTERNATIVA ausente');
      assert(/nominal/i.test(iss.alternative || ''), 'alternativa sem "nominal"');
      return 'ok';
    });

    t('C4', 'Local parcial → contagens corretas por campo', function () {
      var rows = baseRows();
      rows[2][col('Torre')] = ''; rows[5][col('Torre')] = ''; rows[7][col('Torre')] = '';
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      var st = inv(res, 'Torre');
      assert(st && st.filled === 5 && st.empty === 3, 'torre filled=' + (st && st.filled) + ' empty=' + (st && st.empty));
      return 'Torre 5 preenchidos / 3 vazios';
    });

    t('C5', 'Data mesclada sobre 5 NFs → 0 falsos vazios', function () {
      var rows = baseRows();
      for (var i = 1; i <= 4; i++) rows[i][col('Data')] = null; // valor só na 1ª linha do bloco
      var merges = [{ s: { r: 1, c: col('Data') }, e: { r: 5, c: col('Data') } }];
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows), merges), opts);
      var st = inv(res, 'Data');
      assert(st.empty === 0, 'vazios=' + st.empty + ' (esperado 0)');
      assert(st.filledByMerge === 4, 'filledByMerge=' + st.filledByMerge + ' (esperado 4)');
      assert(!findIssue(res, 'DATA_VAZIA'), 'não deveria haver DATA_VAZIA');
      return '0 vazios · 4 via mesclagem';
    });

    t('C6', 'Usina/Laboratório parcialmente vazios → contagens corretas', function () {
      var rows = baseRows();
      rows[2][col('Usina')] = ''; rows[3][col('Usina')] = '';
      rows[2][col('Laboratório')] = ''; rows[3][col('Laboratório')] = ''; rows[4][col('Laboratório')] = '';
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      var u = findIssue(res, 'USINA_INCOMPLETO'), l = findIssue(res, 'LAB_INCOMPLETO');
      assert(u && u.count === 2, 'usina count=' + (u && u.count));
      assert(l && l.count === 3, 'lab count=' + (l && l.count));
      return 'usina 2 · lab 3';
    });

    t('C7', 'Volume "8 m³" → interpretar 8 + registrar normalização', function () {
      var rows = baseRows();
      rows[0][col('Volume')] = '8 m³'; rows[1][col('Volume')] = '7m3'; rows[2][col('Volume')] = '8,0 m³';
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      var iss = findIssue(res, 'VOLUME_NORMALIZAVEL');
      assert(iss, 'VOLUME_NORMALIZAVEL ausente');
      assert(iss.count === 3, 'count=' + iss.count);
      assert(iss.samples.some(function (s) { return s.original === '8 m³' && s.interpretado === 8; }), 'amostra 8 m³→8 ausente');
      var st = inv(res, 'Volume');
      assert(st.invalid === 0, 'não deveria haver inválidos');
      assert(!findIssue(res, 'VOLUME_NAO_NUMERICO'), 'não é texto não numérico');
      return '3 normalizações · "8 m³" → 8';
    });

    t('C8', 'Volume 18 m³ → BLOQUEADOR', function () {
      var rows = baseRows(); rows[3][col('Volume')] = 18;
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      var iss = findIssue(res, 'VOLUME_FORA_LIMITE');
      assert(iss && iss.category === IA.CAT.BLOQUEADOR, 'esperado BLOQUEADOR');
      assert(iss.count === 1, 'count=' + iss.count);
      return 'ok';
    });

    t('C9', 'Data futura → BLOQUEADOR', function () {
      var rows = baseRows(); rows[6][col('Data')] = '10/09/2026';
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      var iss = findIssue(res, 'DATA_FUTURA');
      assert(iss && iss.category === IA.CAT.BLOQUEADOR, 'esperado BLOQUEADOR');
      return 'ok';
    });

    t('C10', 'Data antiga isolada (2012 entre 2026) → ALERTA de outlier', function () {
      var rows = baseRows(); rows[3][col('Data')] = '13/05/2012';
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      var iss = findIssue(res, 'DATA_OUTLIER');
      assert(iss && iss.category === IA.CAT.ALERTA, 'DATA_OUTLIER/ALERTA ausente');
      assert(iss.count === 1, 'count=' + iss.count);
      return 'detecção adaptativa ok';
    });

    t('C11', 'FCK Projeto 40 + Obs "Utilizado FCK 30" → BLOQUEADOR conflitante', function () {
      var rows = baseRows();
      rows[1][col('FCK Projeto')] = 40; rows[1][col('Obs')] = 'Utilizado FCK 30';
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      var iss = findIssue(res, 'FCK_CONFLITANTE');
      assert(iss && iss.category === IA.CAT.BLOQUEADOR, 'esperado BLOQUEADOR');
      var s = iss.samples[0];
      assert(s.fckProjeto === 40 && s.fckTexto === 30, 'valores ' + s.fckProjeto + '/' + s.fckTexto);
      return 'mostra 40 e 30, sem escolher';
    });

    t('C12', 'Resistência 235 MPa → BLOQUEADOR', function () {
      var rows = baseRows(); rows[2][col('Res. 28 dias')] = 235;
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      var iss = findIssue(res, 'RESISTENCIA_FORA_LIMITE');
      assert(iss && iss.category === IA.CAT.BLOQUEADOR, 'esperado BLOQUEADOR');
      return 'ok';
    });

    t('C13', 'Mesma NF por CP → granularidade CP, sem duplicidade automática', function () {
      var h = H.slice(); h.splice(2, 0, 'Nº CP');
      var rows = [];
      var b = baseRows();
      for (var i = 0; i < 8; i++) {
        var r = b[i].slice(); r.splice(2, 0, (i % 4) + 1);
        r[1] = i < 4 ? '2001' : '2002'; // 2 NFs × 4 CPs
        rows.push(r);
      }
      var res = IA.analyzeWorkbook(mkWB(X, [h].concat(rows)), opts);
      assert(res.granularity.type === 'cp', 'granularidade=' + res.granularity.type);
      assert(!findIssue(res, 'NF_DUPLICADA'), 'não deveria marcar NF_DUPLICADA');
      var info = findIssue(res, 'NF_REPETIDA_CP');
      assert(info && info.category === IA.CAT.INFO, 'esperado informativo NF_REPETIDA_CP');
      return 'cp · ' + res.granularity.confidence + '%';
    });

    t('C14', 'Mesma NF em 2 linhas de caminhão + mesma usina → possível duplicidade', function () {
      var rows = baseRows();
      var dup = rows[4].slice(); // NF 1005, Supermix
      rows.push(dup);
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      assert(res.granularity.type === 'truck', 'granularidade=' + res.granularity.type);
      var iss = findIssue(res, 'NF_DUPLICADA');
      assert(iss && iss.category === IA.CAT.BLOQUEADOR, 'esperado NF_DUPLICADA/BLOQUEADOR');
      assert(/dupli/i.test(iss.title), 'título sem "duplicada"');
      return 'ok';
    });

    t('C15', 'Workbook Instruções + Dashboard + Controle → seleciona Controle', function () {
      var wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Leia atentamente'], ['Este arquivo contém instruções de preenchimento.']]), 'Instruções');
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Resumo mensal'], [10, 20], [30, 40]]), 'Dashboard');
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([H].concat(baseRows())), 'Controle');
      var res = IA.analyzeWorkbook(wb, opts);
      assert(res.workbook.chosen === 'Controle', 'escolhida=' + res.workbook.chosen);
      return 'Controle';
    });

    t('C16', 'Cabeçalho em 2 níveis (grupo Rompimentos mesclado) → detecção correta', function () {
      var aoa = [
        ['', '', '', 'Rompimentos', null, null],
        ['Data', 'NF', 'FCK', '3 dias', '7 dias', '28 dias'],
        ['10/05/2026', '3001', 30, 14.2, 22.1, 31.0],
        ['11/05/2026', '3002', 30, 15.0, 23.0, 32.1],
        ['12/05/2026', '3003', 25, 12.1, 18.9, 27.0]
      ];
      var merges = [{ s: { r: 0, c: 3 }, e: { r: 0, c: 5 } }];
      var res = IA.analyzeWorkbook(mkWB(X, aoa, merges), opts);
      assert(res.header.depth >= 2, 'depth=' + res.header.depth);
      assert(res.ages.length === 3, 'idades=' + res.ages.length);
      assert(res.ages.map(function (a) { return a.idade; }).join(',') === '3 dias,7 dias,28 dias', 'idades=' + res.ages.map(function (a) { return a.idade; }).join(','));
      return 'depth ' + res.header.depth + ' · 3 idades';
    });

    t('C17', 'Linha com todos os campos de localização vazios → BLOQUEADOR', function () {
      var rows = baseRows();
      rows[5][col('Torre')] = ''; rows[5][col('Bloco')] = ''; rows[5][col('Pavimento')] = ''; rows[5][col('Peça')] = '';
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      var iss = findIssue(res, 'LOCAL_SEM_INFORMACAO');
      assert(iss && iss.category === IA.CAT.BLOQUEADOR, 'esperado BLOQUEADOR');
      assert(iss.count === 1, 'count=' + iss.count);
      return 'ok';
    });

    t('C18', 'Flow 75 → fora do limite', function () {
      var h = H.concat(['Flow']);
      var rows = baseRows().map(function (r) { return r.concat([55]); });
      rows[2][h.indexOf('Flow')] = 75;
      var res = IA.analyzeWorkbook(mkWB(X, [h].concat(rows)), opts);
      var iss = findIssue(res, 'FLOW_FORA_LIMITE');
      assert(iss && iss.count === 1, 'FLOW_FORA_LIMITE count=' + (iss && iss.count));
      return 'ok';
    });

    t('C19', 'Slump 35 (sem evidência de mm) → fora do limite, sem conversão', function () {
      var rows = baseRows(); rows[1][col('Slump')] = 35;
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      var iss = findIssue(res, 'SLUMP_FORA_LIMITE');
      assert(iss && iss.count === 1, 'SLUMP_FORA_LIMITE ausente');
      assert(!findIssue(res, 'SLUMP_MM_CONVERSIVEL'), 'não deveria converter sem evidência de mm');
      return 'ok';
    });

    t('C20', '"Anexar NF" na coluna de fornecedor → ALERTA de valor suspeito', function () {
      var rows = baseRows(); rows[4][col('Usina')] = 'Anexar NF';
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      var iss = findIssue(res, 'USINA_SUSPEITO');
      assert(iss && iss.category === IA.CAT.ALERTA, 'esperado ALERTA');
      assert(iss.samples[0].valor === 'Anexar NF', 'amostra=' + iss.samples[0].valor);
      return 'ok';
    });

    /* ── Extras (melhorias além do mínimo) ── */
    t('T21', 'Slump em mm com evidência no cabeçalho → 240 mm → 24 cm registrado', function () {
      var h = H.slice(); h[col('Slump')] = 'Slump (mm)';
      var rows = baseRows().map(function (r) { var c = r.slice(); c[col('Slump')] = 240; return c; });
      var res = IA.analyzeWorkbook(mkWB(X, [h].concat(rows)), opts);
      var iss = findIssue(res, 'SLUMP_MM_CONVERSIVEL');
      assert(iss, 'SLUMP_MM_CONVERSIVEL ausente');
      assert(iss.samples[0].interpretado === '24 cm', 'interpretado=' + iss.samples[0].interpretado);
      assert(!findIssue(res, 'SLUMP_FORA_LIMITE'), 'não deveria acusar fora do limite');
      return '240 mm → 24 cm';
    });

    t('T22', 'Sem coluna de NF → BLOQUEADOR', function () {
      var d = dropCol(H, baseRows(), 'NF');
      var res = IA.analyzeWorkbook(mkWB(X, [d.h].concat(d.rows)), opts);
      var iss = findIssue(res, 'NF_CAMPO_AUSENTE');
      assert(iss && iss.category === IA.CAT.BLOQUEADOR, 'esperado BLOQUEADOR');
      return 'ok';
    });

    t('T23', 'NF vazia em 2 linhas → contagem correta', function () {
      var rows = baseRows(); rows[1][col('NF')] = ''; rows[6][col('NF')] = '';
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      var iss = findIssue(res, 'NF_VAZIA');
      assert(iss && iss.count === 2, 'count=' + (iss && iss.count));
      return 'ok';
    });

    t('T24', 'Mensagens: só problemas reais; WhatsApp mais curta que e-mail', function () {
      var rows = baseRows(); rows[3][col('Volume')] = 18; // gera 1 bloqueador
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      assert(res.messages.email.indexOf('Analisamos a planilha') > -1, 'abertura padrão ausente');
      assert(!/placa/i.test(res.messages.email), 'placa não deve ir na mensagem');
      assert(!/hor[aá]rio/i.test(res.messages.email), 'horários não devem ir na mensagem');
      assert(res.messages.whatsapp.length < res.messages.email.length, 'whatsapp deveria ser mais curta');
      assert(/acusa|errad[ao]/i.test(res.messages.email) === false, 'tom não colaborativo');
      return 'ok';
    });

    t('T25', 'Linhas TOTAL/legenda ignoradas com transparência', function () {
      var rows = baseRows();
      rows.push(['', '', '', '', '', '', '', '', '', '', '', '', '', '']);
      rows.push(['TOTAL', '', 62.5, '', '', '', '', '', '', '', '', '', '', '']);
      rows.push(['Legenda: valores em MPa', '', '', '', '', '', '', '', '', '', '', '', '', '']);
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(rows)), opts);
      assert(res.records.count === 8, 'registros=' + res.records.count);
      assert(res.records.ignored.length >= 3, 'ignoradas=' + res.records.ignored.length);
      return '8 registros · ' + res.records.ignored.length + ' ignoradas';
    });

    t('T26', 'Relatório XLSX de pré-análise com 4 abas', function () {
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(baseRows())), opts);
      var wb = IA.buildReportWorkbook(res, opts);
      var names = wb.SheetNames.join(',');
      assert(names === 'Resumo,Inventário de Campos,Pendências,Amostras', 'abas=' + names);
      return names;
    });

    t('T27', 'Base íntegra → status sem pendência de cliente', function () {
      var res = IA.analyzeWorkbook(mkWB(X, [H].concat(baseRows())), opts);
      assert(res.summary.counts.BLOQUEADOR === 0, 'bloqueadores=' + res.summary.counts.BLOQUEADOR);
      assert(res.summary.status !== 'NECESSITA COMPLEMENTAÇÃO DO CLIENTE', 'status=' + res.summary.status);
      return res.summary.status;
    });

    var passed = results.filter(function (r) { return r.pass; }).length;
    return { results: results, passed: passed, failed: results.length - passed, total: results.length };
  }

  return { run: run, TODAY: TODAY };
}));
