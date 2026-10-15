/* ImportIntegrity 1.0.0 — IMP-01. Núcleo puro, compartilhado por Node e navegador.
 * Não autentica, não autoriza e não escreve no destino. Evidência de agrupamento
 * é decisão de preparação de dados; NÃO é aprovação administrativa/técnica.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ImportIntegrity = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var VERSION = '1.0.0';
  var MAX_RECORDS = 100000;
  function text(value) { return String(value == null ? '' : value).trim(); }
  function filled(value) { return value !== null && value !== undefined && text(value) !== ''; }
  function fail(code) { throw new Error(code); }
  function rowsInput(rows) {
    if (!Array.isArray(rows) || rows.length > MAX_RECORDS) fail('INVALID_RECORDS');
  }
  function id(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048 || /[\u0000-\u001f]/.test(value)) fail('INVALID_SOURCE_ID');
    return value;
  }
  function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  /** Valor escalar medido; unidade tem que estar na célula, cabeçalho ou decisão
   * explícita sourceUnit. Intervalos são especificações, nunca medições. */
  function readFreshMeasurement(raw, options) {
    options = options || {};
    var result = { raw: raw, value: '', unit: null, semanticRole: 'measured', code: null };
    if (!filled(raw)) { result.code = 'SOURCE_VALUE_MISSING'; return result; }
    if (options.meaning === 'specification') {
      result.semanticRole = 'specified'; result.code = 'SPECIFICATION_NOT_MEASUREMENT'; return result;
    }
    if (typeof raw !== 'number' && typeof raw !== 'string' || typeof raw === 'number' && !Number.isFinite(raw)) {
      result.code = 'INVALID_MEASUREMENT'; return result;
    }
    var input = text(raw);
    if (/(?:±|\+\s*\/\s*-|\+\s*-)/.test(input)) {
      result.semanticRole = 'specified'; result.code = 'SPECIFICATION_NOT_MEASUREMENT'; return result;
    }
    var m = /^(-?\d+(?:[.,]\d+)?)\s*(cm|mm)?$/i.exec(input);
    if (!m) { result.code = 'AMBIGUOUS_MEASUREMENT'; return result; }
    var cellUnit = text(m[2]).toLowerCase(), declaredUnit = text(options.sourceUnit).toLowerCase();
    if (declaredUnit && declaredUnit !== 'cm' && declaredUnit !== 'mm') {
      result.code = 'INVALID_SOURCE_UNIT'; return result;
    }
    if (cellUnit && declaredUnit && cellUnit !== declaredUnit) {
      result.code = 'SOURCE_UNIT_CONFLICT'; return result;
    }
    var unit = cellUnit || declaredUnit;
    if (!unit) { result.code = 'SOURCE_UNIT_REQUIRED'; return result; }
    var value = Number(m[1].replace(',', '.'));
    if (!Number.isFinite(value)) { result.code = 'INVALID_MEASUREMENT'; return result; }
    result.value = unit === 'mm' ? value / 10 : value;
    result.unit = 'cm'; result.rawUnit = unit;
    return result;
  }

  function eventContext(row) {
    return JSON.stringify(['Data Concretagem', 'Bloco', 'Unidade', 'Peça'].map(function (key) { return text(row[key]); }));
  }
  function validEventNumber(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= 999999999;
  }
  /** Mantém decisão explícita; sem ela, cada linha é provisoriamente um evento.
   * Linhas no mesmo contexto ficam pendentes até confirmação na revisão.
   * Não deduplica caminhões/CPs, nem trata NF como identidade universal. */
  function numberLegacyEvents(rows) {
    rowsInput(rows);
    var sourceIds = new Set(), reserved = new Set(), buckets = new Map(), declared = new Map();
    var assignments = Object.create(null), issues = [], decisions = new Map();
    var sorted = rows.slice().sort(function (a, b) { return compare(text(a && a._rowId), text(b && b._rowId)); });
    sorted.forEach(function (row) {
      var sourceId = id(row && row._rowId);
      if (sourceIds.has(sourceId)) fail('DUPLICATE_SOURCE_ID');
      sourceIds.add(sourceId);
      var context = eventContext(row), decision = row._importEventDecision;
      if (!buckets.has(context)) buckets.set(context, []);
      buckets.get(context).push(row);
      if (!decision) return;
      if (!validEventNumber(decision.number)) {
        issues.push({ code: 'INVALID_EVENT_NUMBER', rowId: sourceId }); return;
      }
      if (decision.context !== context) {
        issues.push({ code: 'EVENT_CONTEXT_CHANGED', rowId: sourceId }); return;
      }
      decisions.set(sourceId, decision.number); reserved.add(decision.number);
      if (!declared.has(decision.number)) declared.set(decision.number, []);
      declared.get(decision.number).push({ sourceId: sourceId, context: context });
    });
    declared.forEach(function (group) {
      if (new Set(group.map(function (item) { return item.context; })).size > 1) {
        group.forEach(function (item) { issues.push({ code: 'EVENT_CONTEXT_CONFLICT', rowId: item.sourceId }); });
      }
    });
    var next = 1;
    sorted.forEach(function (row) {
      if (decisions.has(row._rowId)) assignments[row._rowId] = decisions.get(row._rowId);
      else {
        while (reserved.has(next)) next++;
        assignments[row._rowId] = next; reserved.add(next++);
      }
    });
    buckets.forEach(function (group) {
      if (group.length < 2) return;
      group.forEach(function (row) {
        if (!decisions.has(row._rowId)) issues.push({ code: 'EVENT_GROUPING_REQUIRED', rowId: row._rowId });
      });
    });
    return { assignments: assignments, issues: issues };
  }

  /** Identidade determinística da linha de fonte, nunca um ID produtivo. */
  function sourceRecordId(locator) {
    var l = locator || {};
    if (typeof l.artifactHash !== 'string' || !/^[a-f0-9]{64}$/.test(l.artifactHash) ||
        typeof l.sheet !== 'string' || !l.sheet.length || l.sheet.length > 256 ||
        !Number.isSafeInteger(l.row) || l.row < 1 ||
        !Number.isSafeInteger(l.ordinal) || l.ordinal < 0 ||
        ['event','delivery','specimen','result','structure'].indexOf(l.kind) < 0) fail('INVALID_SOURCE');
    return ['src', l.artifactHash, encodeURIComponent(l.sheet), l.row, l.kind, l.ordinal].join(':');
  }

  function volumeCents(value) {
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    if (typeof value === 'number' && !Number.isFinite(value)) return null;
    var input = text(value).replace(/\s*(?:m³|m3)$/i, '').trim();
    var m = /^(\d{1,12})(?:[.,](\d{1,2}))?$/.exec(input);
    if (!m) return null;
    var cents = BigInt(m[1]) * 100n + BigInt((m[2] || '').padEnd(2, '0'));
    return cents > 0n ? cents : null;
  }
  /** Contabilidade de entregas com vínculos explicitamente documentados.
   * Preserva a quantidade de CPs, inclusive resultados iguais. Não transforma
   * este resumo em exportação de resultados ou integração homologada. */
  function summarizeDeliveries(records) {
    rowsInput(records);
    var scope = null, sources = new Set(), deliveries = new Map(), issues = [], specimenCount = 0;
    records.forEach(function (record) {
      var source = id(record && record.sourceId), recordScope = id(record.scope);
      if (scope === null) scope = recordScope;
      if (scope !== recordScope) fail('CROSS_SCOPE');
      if (sources.has(source)) fail('DUPLICATE_SOURCE_ID');
      sources.add(source);
      if (record.kind !== 'specimen' && record.kind !== 'delivery') fail('UNSUPPORTED_RECORD_KIND');
      if (record.kind === 'specimen') specimenCount++;
      if (!filled(record.deliveryRef) || ['source','reviewed'].indexOf(record.deliveryEvidence) < 0) {
        issues.push({ code: 'DELIVERY_REFERENCE_REQUIRED', sourceId: source }); return;
      }
      var deliveryId = id(record.deliveryRef), cents = volumeCents(record.volume);
      if (!deliveries.has(deliveryId)) deliveries.set(deliveryId, { cents: cents, sources: [] });
      var group = deliveries.get(deliveryId); group.sources.push(source);
      if (cents === null) issues.push({ code: 'INVALID_DELIVERY_VOLUME', sourceId: source, deliveryRef: deliveryId });
      if (group.cents !== null && cents !== null && cents !== group.cents) {
        issues.push({ code: 'DELIVERY_VOLUME_CONFLICT', sourceId: source, deliveryRef: deliveryId });
      }
    });
    var total = 0n;
    deliveries.forEach(function (d) { if (d.cents !== null) total += d.cents; });
    return { deliveryCount: deliveries.size, specimenCount: specimenCount,
      volume: issues.length ? null : String(total / 100n) + '.' + String(total % 100n).padStart(2,'0'), issues: issues };
  }

  /** Achados no formato consumido pelo painel legado. Recalculados a cada
   * validação; não se acumulam silenciosamente após edição de uma célula. */
  function legacyFindings(rows) {
    var findings = [], byId = new Map(rows.map(function (row) { return [row._rowId,row]; }));
    var messages = {
      EVENT_GROUPING_REQUIRED: 'Confirme o número do evento: existem outras linhas no mesmo local e dia.',
      EVENT_CONTEXT_CHANGED: 'O local ou a data mudou após a revisão do evento. Confirme novamente o número.',
      EVENT_CONTEXT_CONFLICT: 'O mesmo número foi atribuído a eventos com datas ou locais diferentes.',
      INVALID_EVENT_NUMBER: 'Número de concretagem inválido. Informe um inteiro positivo.'
    };
    numberLegacyEvents(rows).issues.forEach(function (issue) {
      var row = byId.get(issue.rowId);
      findings.push({ rowId: issue.rowId, sheet: row._source && row._source.sheet || '',
        line: row._source && row._source.line || '', field: 'Número Concretagem', severity: 'CRÍTICO',
        type: issue.code, description: messages[issue.code],
        suggestion: 'Na coluna Número Concretagem, confirme números iguais somente para caminhões do mesmo evento.' });
    });
    rows.forEach(function (row) {
      ['Slump','Flow','Volume'].forEach(function (field) {
        if (!filled(row[field])) return;
        var meta = row._provenance && row._provenance[field];
        if (!meta || ['DADO_ORIGINAL','NORMALIZACAO_AUTOMATICA'].indexOf(meta.provenance) < 0 ||
            meta.semanticRole === 'specified' || meta.semanticRole === 'operational_placeholder') {
          findings.push({ rowId: row._rowId, sheet: row._source && row._source.sheet || '',
            line: row._source && row._source.line || '', field: field, severity: 'CRÍTICO',
            type: 'MEASUREMENT_WITHOUT_EVIDENCE', description: 'Medição sem evidência de origem: especificação ou padrão não comprovam valor observado.',
            suggestion: 'Confira a fonte e informe o valor medido, ou mantenha a pendência.' });
        }
      });
    });
    return findings;
  }
  return { VERSION: VERSION, MAX_RECORDS: MAX_RECORDS, readFreshMeasurement: readFreshMeasurement,
    eventContext: eventContext, validEventNumber: validEventNumber, numberLegacyEvents: numberLegacyEvents,
    sourceRecordId: sourceRecordId, summarizeDeliveries: summarizeDeliveries, legacyFindings: legacyFindings };
}));
