/* ============================================================================
 * SimilarityEngine — Pré-importação Consulte GEO
 * APP_VERSION 5.0.22-52 · engine 2.0.0
 *
 * Motor determinístico de propostas para campos ausentes. Nunca sobrescreve
 * valores presentes e mantém proveniência por campo. UMD: browser + Node.
 * ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SimilarityEngine = factory();
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '2.0.0';
  var APP_VERSION = '5.0.22-52';
  var PROVENANCE = {
    ORIGINAL: 'DADO_ORIGINAL',
    NORMALIZED: 'NORMALIZACAO_AUTOMATICA',
    INFERRED: 'INFERIDO_POR_SIMILARIDADE',
    OPERATIONAL: 'PADRAO_OPERACIONAL',
    PENDING: 'PENDENTE_CLIENTE'
  };

  function norm(value) {
    return String(value == null ? '' : value)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[º°]/g, '')
      .replace(/[^a-z0-9.,+\-/\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  function isFilled(value) {
    return !(value === null || value === undefined || String(value).trim() === '');
  }
  function toNumber(value) {
    if (typeof value === 'number') return isFinite(value) ? value : null;
    var text = String(value == null ? '' : value).trim();
    if (!text) return null;
    var cleaned = text.replace(/\s+/g, '');
    if (cleaned.indexOf(',') >= 0) cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    var match = cleaned.match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    var parsed = Number(match[0]);
    return isFinite(parsed) ? parsed : null;
  }
  function fallbackExtractFcks(text) {
    var s = String(text == null ? '' : text);
    var out = [], re = /\bF\s*C\s*K\s*[:=\-]?\s*(\d{1,3}(?:[.,]\d+)?)\s*(?:MPA)?\b/gi, m;
    while ((m = re.exec(s))) {
      var n = Number(m[1].replace(',', '.'));
      if (n >= 5 && n <= 100 && out.indexOf(n) < 0) out.push(n);
    }
    return out;
  }
  function getFcks(text, extractor) {
    try {
      var fn = typeof extractor === 'function' ? extractor : fallbackExtractFcks;
      return (fn(text) || []).map(Number).filter(function (n) { return isFinite(n) && n >= 5 && n <= 100; });
    } catch (_) {
      return fallbackExtractFcks(text);
    }
  }
  /**
   * V16 / IMP-01: interpretação de ESPECIFICAÇÃO, nunca de medição.
   * Só uma unidade escrita na expressão permite normalizar para centímetros.
   * A unidade após a tolerância pode qualificar a expressão inteira (12±2 CM).
   * Sem unidade, o número bruto continua consultável, mas nominal fica null.
   */
  function parseFresh(text) {
    var raw = String(text == null ? '' : text);
    var selfCompacting = /\b(auto\s*adensavel|autoadensavel|auto compact|scc)\b/.test(norm(raw));
    var expressions = [
      { family: 'FLOW', regex: /(?:FLOW|ESPALHAMENTO)\s*[:=\-]?\s*(\d+(?:[.,]\d+)?)\s*(CM\b|MM\b)?\s*(?:(?:±|\+\s*\/\s*-|\+\s*-)\s*(\d+(?:[.,]\d+)?)\s*(CM\b|MM\b)?)?/i },
      { family: 'SLUMP', regex: /(?:SLUMP|ABATIMENTO)\s*[:=\-]?\s*(\d+(?:[.,]\d+)?)\s*(CM\b|MM\b)?\s*(?:(?:±|\+\s*\/\s*-|\+\s*-)\s*(\d+(?:[.,]\d+)?)\s*(CM\b|MM\b)?)?/i }
    ];
    for (var i = 0; i < expressions.length; i++) {
      if (expressions[i].family === 'SLUMP' && selfCompacting) break;
      var match = expressions[i].regex.exec(raw);
      if (!match) continue;
      var rawNominal = Number(match[1].replace(',', '.'));
      var rawTolerance = match[3] ? Number(match[3].replace(',', '.')) : null;
      var nominalUnit = (match[2] || match[4] || '').toUpperCase();
      var toleranceUnit = (match[4] || match[2] || '').toUpperCase();
      var hasUnit = nominalUnit === 'CM' || nominalUnit === 'MM';
      return {
        family: expressions[i].family,
        nominal: hasUnit ? rawNominal / (nominalUnit === 'MM' ? 10 : 1) : null,
        tolerance: hasUnit && rawTolerance !== null ? rawTolerance / (toleranceUnit === 'MM' ? 10 : 1) : null,
        rawNominal: rawNominal, rawTolerance: rawTolerance,
        rawUnit: nominalUnit || null, unit: hasUnit ? 'cm' : null,
        requiresUnitConfirmation: !hasUnit,
        convertedFromMm: hasUnit && (nominalUnit === 'MM' || (rawTolerance !== null && toleranceUnit === 'MM')),
        source: raw, selfCompacting: expressions[i].family === 'FLOW'
      };
    }
    return { family: selfCompacting ? 'FLOW' : '', nominal: null, tolerance: null,
      rawNominal: null, rawTolerance: null, rawUnit: null, unit: null,
      requiresUnitConfirmation: false, convertedFromMm: false, source: raw, selfCompacting: selfCompacting };
  }
  function proposalBase(row, field, value, provenance, rule, source, extra) {
    var rowId = row && (row._rowId || row.rowId || row.id) || '';
    return Object.assign({
      id: [rowId, field, rule].join(':'), rowId: rowId, field: field,
      value: value, provenance: provenance, rule: rule, source: source || '',
      status: 'pending', candidates: [], requiresHuman: false
    }, extra || {});
  }
  function freshProposals(row, traceText) {
    if (!row) return [];
    var parsed = parseFresh(traceText);
    var field = parsed.family === 'FLOW' ? 'Flow' : parsed.family === 'SLUMP' ? 'Slump' : '';
    if (!field || parsed.rawNominal === null || isFilled(row[field])) return [];
    // value é referência para consulta. apply recusa os campos medidos,
    // inclusive em lotes e em propostas antigas sem metadados semânticos.
    return [proposalBase(row, field, parsed.nominal !== null ? parsed.nominal : parsed.rawNominal,
      PROVENANCE.INFERRED, parsed.family + '_FROM_TRACE',
      'Valor especificado no traço, não medido no caminhão: ' + traceText +
        (parsed.requiresUnitConfirmation ? ' (unidade não confirmada).' : '.'),
      { semanticRole: 'specified', targetSemanticRole: 'measured', referenceOnly: true,
        requiresHuman: true, unit: parsed.unit, rawValue: parsed.rawNominal,
        rawUnit: parsed.rawUnit, requiresUnitConfirmation: parsed.requiresUnitConfirmation })];
  }
  function tokens(text) {
    var ignored = { de:1, da:1, do:1, das:1, dos:1, e:1, em:1, para:1, com:1, fck:1, concreto:1, traco:1 };
    return norm(text).split(/\s+/).filter(function (x) { return x.length > 2 && !ignored[x]; });
  }
  function applicationScore(a, b) {
    var aa = tokens(a), bb = tokens(b);
    if (!aa.length || !bb.length) return 0;
    var hit = aa.filter(function (x) { return bb.indexOf(x) >= 0; }).length;
    return hit / Math.max(aa.length, bb.length);
  }
  function traceCandidates(input, traces, extractor) {
    input = input || {};
    traces = traces || [];
    var dedicated = toNumber(input.fck);
    var textual = getFcks([input.traceText, input.observation, input.application].filter(Boolean).join(' | '), extractor);
    var conflicts = [];
    if (dedicated !== null) {
      textual.forEach(function (x) { if (Number(x) !== Number(dedicated) && conflicts.indexOf(x) < 0) conflicts.push(x); });
    }
    if (conflicts.length) {
      return { conflict: true, fck: dedicated, textualFcks: textual, candidates: [] };
    }
    var fck = dedicated !== null ? dedicated : (textual.length === 1 ? textual[0] : null);
    var app = [input.application, input.location, input.observation].filter(Boolean).join(' ');
    var list = traces.map(function (trace, index) {
      var label = trace.nome || trace.name || trace.descricao || trace.description || String(trace);
      var traceFcks = trace.fck != null ? [Number(trace.fck)] : getFcks(label, extractor);
      if (fck !== null && traceFcks.indexOf(Number(fck)) < 0) return null;
      var traceApp = trace.aplicacao || trace.application || label;
      // v5.22.46: sem FCK conhecido não há evidência de compatibilidade.
      // O candidato entra apenas como sugestão para escolha humana (score 0).
      var score = fck !== null ? 70 : 0;
      var appScore = applicationScore(app, traceApp);
      if (appScore > 0) score += Math.round(appScore * 30);
      return { id: trace.id || ('trace-' + index), label: label, value: trace, score: score, applicationScore: appScore };
    }).filter(Boolean);
    if (app && list.some(function (x) { return x.applicationScore > 0; })) {
      list = list.filter(function (x) { return x.applicationScore > 0; });
    }
    list.sort(function (a, b) { return b.score - a.score || a.label.localeCompare(b.label); });
    return { conflict: false, fck: fck, textualFcks: textual, candidates: list };
  }
  function traceProposal(row, input, traces, extractor) {
    if (!row) return null;
    if (isFilled(row.Concreto)) return null;
    var result = traceCandidates(input, traces, extractor);
    if (result.conflict) {
      return proposalBase(row, 'Concreto', '', PROVENANCE.PENDING, 'FCK_CONFLICT',
        'FCK dedicado ' + result.fck + ' conflita com texto ' + result.textualFcks.join(', '),
        { conflict: true, requiresHuman: true });
    }
    if (!result.candidates.length) return null;
    // v5.22.46 (correção): só propõe automaticamente quando existe FCK conhecido
    // (dedicado ou único no texto). Sem FCK, qualquer "compatibilidade" seria
    // inventada — então exige escolha humana, mesmo com um só candidato.
    if (result.fck === null) {
      return proposalBase(row, 'Concreto', '', PROVENANCE.PENDING,
        'TRACE_SEM_FCK',
        'Sem FCK identificado na linha: ' + result.candidates.length +
        ' traço(s) apenas como sugestão; escolha humana obrigatória',
        { candidates: result.candidates, requiresHuman: true });
    }
    if (result.candidates.length === 1) {
      return proposalBase(row, 'Concreto', result.candidates[0].label, PROVENANCE.INFERRED,
        'TRACE_FROM_FCK_APPLICATION', 'Único traço compatível com FCK ' + result.fck + ' e aplicação',
        { candidates: result.candidates });
    }
    return proposalBase(row, 'Concreto', '', PROVENANCE.PENDING,
      'TRACE_AMBIGUOUS', result.candidates.length + ' traços compatíveis; escolha humana obrigatória',
      { candidates: result.candidates, requiresHuman: true });
  }
  function uniqueValues(rows, field) {
    var map = new Map();
    (rows || []).forEach(function (row) {
      var value = row[field];
      if (!isFilled(value)) return;
      var key = norm(value);
      if (!map.has(key)) map.set(key, value);
    });
    return Array.from(map.values());
  }
  function uniqueFieldProposals(rows, field, rule) {
    var values = uniqueValues(rows, field);
    if (values.length !== 1) return [];
    return (rows || []).filter(function (row) { return !isFilled(row[field]); }).map(function (row) {
      return proposalBase(row, field, values[0], PROVENANCE.INFERRED, rule,
        'Valor único observado nas demais linhas: ' + values[0]);
    });
  }
  function operationalProposals(row, options) {
    if (!row) return [];
    options = options || {};
    var out = [];
    if (!isFilled(row.Placa)) out.push(proposalBase(row, 'Placa', 'IMPORT', PROVENANCE.OPERATIONAL,
      'PLATE_IMPORT', 'Padrão operacional Consulte GEO'));
    if (!isFilled(row.Volume) && options.volumeDefaultAuthorized && toNumber(options.volumeDefault) !== null) {
      out.push(proposalBase(row, 'Volume', toNumber(options.volumeDefault), PROVENANCE.OPERATIONAL,
        'AUTHORIZED_DEFAULT_VOLUME', 'Volume padrão proposto; não comprova o volume entregue',
        { semanticRole: 'operational_placeholder', targetSemanticRole: 'measured', referenceOnly: true, requiresHuman: true }));
    }
    return out;
  }
  function ensureProvenance(row) {
    if (!row._provenance || typeof row._provenance !== 'object') row._provenance = {};
    return row._provenance;
  }
  function mark(row, field, provenance, detail, original, accepted) {
    var p = ensureProvenance(row);
    p[field] = {
      provenance: provenance,
      detail: detail || '',
      original: original === undefined ? null : original,
      accepted: accepted !== false,
      at: new Date().toISOString()
    };
    return p[field];
  }
  function seed(row, field, value, detail) {
    if (isFilled(value) && !ensureProvenance(row)[field]) mark(row, field, PROVENANCE.ORIGINAL, detail || 'Valor presente na planilha', value, true);
  }
  function apply(row, proposal, selectedValue) {
    if (!row || !proposal || typeof proposal.field !== 'string') return false;
    var measured = ['Slump', 'Flow', 'Volume'];
    var associations = ['Bloco', 'Unidade', 'Peça', 'Concreto', 'Usina', 'Laboratorio', 'Placa'];
    if (measured.indexOf(proposal.field) < 0 && associations.indexOf(proposal.field) < 0) {
      proposal.status = 'blocked-field';
      return false;
    }
    if (isFilled(row[proposal.field])) {
      proposal.status = 'ignored-original';
      return false;
    }
    if (measured.indexOf(proposal.field) >= 0 || proposal.referenceOnly === true) {
      proposal.status = 'blocked-measurement';
      pending(row, proposal.field, 'Medição ausente. Especificação e padrão operacional não substituem a informação da origem.');
      return false;
    }
    var value = selectedValue;
    if (value === undefined) value = proposal.value;
    if (!isFilled(value) && proposal.candidates && proposal.candidates.length === 1) value = proposal.candidates[0].label;
    if (!isFilled(value)) return false;
    row[proposal.field] = value;
    proposal.status = 'accepted';
    proposal.acceptedValue = value;
    mark(row, proposal.field, proposal.provenance, proposal.source || proposal.rule, null, true);
    return true;
  }
  function reject(row, proposal) {
    if (!proposal) return false;
    proposal.status = 'rejected';
    // v5.22.46 (correção): se o campo já tem valor (digitado pelo operador ou
    // vindo da planilha), rejeitar a proposta NÃO pode degradar a proveniência
    // de DADO_ORIGINAL para PENDENTE_CLIENTE.
    if (row && isFilled(row[proposal.field])) {
      seed(row, proposal.field, row[proposal.field], 'Valor presente; proposta rejeitada');
      return true;
    }
    if (row) mark(row, proposal.field, PROVENANCE.PENDING,
      'Proposta rejeitada: ' + (proposal.source || proposal.rule), row[proposal.field], false);
    return true;
  }
  function pending(row, field, detail) {
    if (!isFilled(row[field])) mark(row, field, PROVENANCE.PENDING, detail || 'Valor não resolvido', null, false);
  }
  function auditRows(rows, fields) {
    var out = [];
    (rows || []).forEach(function (row) {
      var p = row._provenance || {};
      Object.keys(p).forEach(function (field) {
        if (fields && fields.indexOf(field) < 0) return;
        var meta = p[field] || {};
        out.push({
          rowId: row._rowId || row.rowId || row.id || '',
          sheet: row._source && row._source.sheet || '',
          line: row._source && row._source.line || '',
          field: field,
          value: row[field] == null ? '' : row[field],
          provenance: meta.provenance || PROVENANCE.PENDING,
          detail: meta.detail || '',
          original: meta.original == null ? '' : meta.original,
          accepted: meta.accepted !== false
        });
      });
    });
    return out;
  }

  return {
    VERSION: VERSION, APP_VERSION: APP_VERSION, PROVENANCE: PROVENANCE,
    norm: norm, isFilled: isFilled, toNumber: toNumber,
    extractFcksFromText: fallbackExtractFcks, parseFresh: parseFresh,
    freshProposals: freshProposals, traceCandidates: traceCandidates,
    traceProposal: traceProposal, uniqueFieldProposals: uniqueFieldProposals,
    operationalProposals: operationalProposals, ensureProvenance: ensureProvenance,
    seed: seed, mark: mark, apply: apply, reject: reject, pending: pending,
    auditRows: auditRows
  };
}));
