/* IMP-01 R02 — ponte transitória para o Copilot 3.4.0.
 * Montagem explícita antes do BOOT; preserva validators e layout de exportação.
 * Não cria backend, autorização, protocolo, aprovação ou integração operacional.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ImportLegacyAdapter = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var installed = new WeakSet();
  var FRESH = ['Slump', 'Flow'];
  var RAW = { Slump: 'slump', Flow: 'flow' };
  var SOURCE_CODES = {
    SOURCE_UNIT_REQUIRED: 'A unidade não está documentada. Confirme cm ou mm no mapeamento.',
    SOURCE_UNIT_CONFLICT: 'A unidade da célula conflita com a unidade do cabeçalho ou da revisão.',
    SPECIFICATION_NOT_MEASUREMENT: 'Especificação preservada na origem; não foi copiada para a medição.',
    AMBIGUOUS_MEASUREMENT: 'Valor ambíguo: confira e informe uma medição escalar.',
    INVALID_MEASUREMENT: 'Medição inválida; confira o dado original.',
    INVALID_SOURCE_UNIT: 'Unidade inválida; confirme cm ou mm.'
  };
  function string(value) { return String(value == null ? '' : value); }
  function install(d) {
    var p = d && d.appState;
    if (!p || !d.integrity || d.integrity.VERSION !== '1.0.0' || !d.Similarity || d.Similarity.VERSION !== '2.0.0') {
      throw new Error('INCOMPATIBLE_IMPORT_COMPONENTS');
    }
    if (installed.has(p)) throw new Error('IMPORT_ADAPTER_ALREADY_INSTALLED');
    var C = d.Converter, A = d.Actions, V = d.Validators, X = d.Exporter, U = d.UI, S = d.Similarity, I = d.integrity;
    var ports = [[C,'prepare'],[C,'applyGroup'],[C,'sourceMark'],[C,'refreshSummary'],[C,'group'],
      [A,'editRow'],[A,'resetPreDerived'],[A,'selectSheet'],[A,'findRow'],[V,'validateAll'],[X,'downloadImport'],
      [U,'preSetup'],[U,'preMapping'],[U,'prePreview'],[U,'proposalCard'],[U,'render'],[U,'loading'],[d.Utils,'esc'],[d.Utils,'isFilled'],[d.Toast,'warn'],[d.Toast,'error']];
    if (ports.some(function (pair) { return !pair[0] || typeof pair[0][pair[1]] !== 'function'; }) ||
        !d.document || typeof d.document.addEventListener !== 'function' || !Array.isArray(d.requiredFields)) {
      throw new Error('INVALID_IMPORT_ADAPTER_PORTS');
    }
    var original = { prepare: C.prepare, applyGroup: C.applyGroup, editRow: A.editRow,
      reset: A.resetPreDerived, select: A.selectSheet, validate: V.validateAll,
      download: X.downloadImport, setup: U.preSetup, mapping: U.preMapping,
      preview: U.prePreview, proposal: U.proposalCard };

    // A cópia preparada pertence ao arquivo, à aba, ao mapeamento e às referências.
    // Identidade de objeto é deliberada: outro File com mesmo nome/tamanho não é a origem.
    var fileIds = new WeakMap(), nextFileId = 0, preparedContext = null;
    function sourceContext() {
      var state = p.pre, file = state.file, fileId = null;
      if (file && typeof file === 'object') {
        if (!fileIds.has(file)) fileIds.set(file, ++nextFileId);
        fileId = fileIds.get(file);
      }
      var policies = {};
      ['slumpSourceMeaning','canteiroPolicy','nonConcretePolicy','nfCleanup','zeroResultAsBlank']
        .forEach(function (key) { policies[key] = p.settings[key]; });
      return JSON.stringify([fileId, state.selectedSheet, state.headerStart, state.headerDepth,
        state.columns, state.mapping, state._freshUnitDecisions || {}, policies, p.insumos]);
    }
    function preparedIsCurrent() { return preparedContext !== null && preparedContext === sourceContext(); }

    function sourceColumn(field) {
      var index = p.pre.mapping && p.pre.mapping.fields && p.pre.mapping.fields[field] && p.pre.mapping.fields[field].sourceIndex;
      var col = (p.pre.columns || []).find(function (c) { return c.index === index; });
      var label = string(col && (col.rawLabel || col.label));
      return { index: index, label: label, context: JSON.stringify([p.pre.selectedSheet,index,label]) };
    }
    function sourceUnit(field) {
      var col = sourceColumn(field), match = col.label.match(/\b(?:mm|cm)\b/gi) || [];
      var units = Array.from(new Set(match.map(function (unit) { return unit.toLowerCase(); })));
      if (units.length > 1) return 'ambiguous';
      var saved = p.pre._freshUnitDecisions && p.pre._freshUnitDecisions[field];
      var chosen = saved && saved.context === col.context ? saved.unit : '';
      if (units.length && chosen && units[0] !== chosen) return 'ambiguous';
      return units[0] || chosen || '';
    }
    function sourceMeaning(field) {
      var header = sourceColumn(field).label.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      return /especific|previst|nominal|projeto/i.test(header) ? 'specification' : p.settings.slumpSourceMeaning;
    }
    function freshFindings(rows) {
      var result = [];
      rows.forEach(function (row) {
        FRESH.forEach(function (field) {
          var evidence = row._freshEvidence && row._freshEvidence[field];
          if (!evidence || !SOURCE_CODES[evidence.code]) return;
          result.push({ rowId: row._rowId, sheet: row._source && row._source.sheet || '',
            line: row._source && row._source.line || '', field: field, type: evidence.code,
            severity: evidence.code === 'SPECIFICATION_NOT_MEASUREMENT' ? 'ALERTA' : 'CRÍTICO',
            description: SOURCE_CODES[evidence.code], suggestion: 'Confira a origem. Na revisão, informe somente o valor efetivamente medido (cm).' });
        });
      });
      return result;
    }
    function correctPreparedMeasurements() {
      var state = p.pre;
      state.corrections = (state.corrections || []).filter(function (item) { return FRESH.indexOf(item.field) < 0; });
      // Remove somente diagnósticos antigos desses campos: serão recalculados da origem.
      state.issues = (state.issues || []).filter(function (item) {
        return !(item.type === 'valor_ambíguo' && FRESH.indexOf(item.field) >= 0);
      });
      (state.candidateRows || []).forEach(function (row) {
        row._freshEvidence = {};
        FRESH.forEach(function (field) {
          var raw = row._raw && row._raw[RAW[field]];
          var evidence = I.readFreshMeasurement(raw, { sourceUnit: sourceUnit(field), meaning: sourceMeaning(field) });
          row._freshEvidence[field] = evidence;
          row[field] = evidence.value;
          if (row._provenance) delete row._provenance[field];
          if (evidence.value !== '') {
            C.sourceMark(row,field,raw,evidence.value,'Medição documentada em ' + evidence.rawUnit + '; exportada em cm');
            row._provenance[field].semanticRole = 'measured';
            if (evidence.rawUnit === 'mm') state.corrections.push({ sheet: row._source.sheet, line: row._source.line,
              field: field, original: raw, normalized: evidence.value, reason: 'Unidade mm documentada; conversão para cm' });
          } else S.pending(row,field,SOURCE_CODES[evidence.code] || 'Medição ausente na origem');
        });
      });
      (state.proposals || []).forEach(function (proposal) { if (proposal.referenceOnly) proposal.status = 'reference'; });
      (state.decisionLog || []).forEach(function (entry) {
        if (entry.type === 'padrão_operacional' && /^Volume=/.test(string(entry.value))) {
          entry.action = 'nao_aplicado'; entry.reason = 'Padrão operacional não comprova volume de entrega';
        }
      });
    }
    C.prepare = function () {
      preparedContext = null;
      var result = original.prepare.apply(this,arguments);
      correctPreparedMeasurements();
      preparedContext = sourceContext();
      return result;
    };
    C.applyGroup = function (id) {
      var group = this.group(id);
      if (group && group.type === 'slump') {
        d.Toast.warn('Referência nominal não pode preencher a medição de Slump/Flow.'); return false;
      }
      return original.applyGroup.apply(this,arguments);
    };
    C.finalize = function () {
      var rows = p.pre.candidateRows.slice();
      var events = I.numberLegacyEvents(rows);
      rows.sort(function (a,b) { return events.assignments[a._rowId] - events.assignments[b._rowId] || string(a._rowId).localeCompare(string(b._rowId)); });
      rows.forEach(function (row) {
        row['Número Concretagem'] = events.assignments[row._rowId];
        var reviewed = row._importEventDecision && row._importEventDecision.context === I.eventContext(row) &&
          row._importEventDecision.number === row['Número Concretagem'];
        S.mark(row,'Número Concretagem',S.PROVENANCE.NORMALIZED,
          reviewed ? 'Evento confirmado pelo operador' : 'Evento provisório por linha; sem agrupamento automático', '',true);
        d.requiredFields.forEach(function (field) { if (!d.Utils.isFilled(row[field])) S.pending(row,field,'Campo obrigatório não resolvido antes da exportação'); });
      });
      p.pre.convertedRows = rows;
      V.validateAll(); C.refreshSummary();
    };
    V.validateAll = function () {
      var ownTypes = Object.keys(SOURCE_CODES).concat(['EVENT_GROUPING_REQUIRED','EVENT_CONTEXT_CHANGED','EVENT_CONTEXT_CONFLICT','INVALID_EVENT_NUMBER','MEASUREMENT_WITHOUT_EVIDENCE']);
      p.pre.issues = (p.pre.issues || []).filter(function (issue) { return ownTypes.indexOf(issue.type) < 0; });
      original.validate.apply(this,arguments);
      p.pre.issues = (p.pre.issues || []).concat(I.legacyFindings(p.pre.convertedRows),freshFindings(p.pre.convertedRows));
      C.refreshSummary();
      return p.pre.issues;
    };
    A.editRow = function (rowId,key,value) {
      var row = this.findRow(rowId); if (!row) return;
      if (key === 'Número Concretagem') {
        var input = string(value).trim();
        if (input && (!/^[1-9]\d{0,8}$/.test(input) || !I.validEventNumber(Number(input)))) {
          d.Toast.warn('Informe um número inteiro positivo de até nove dígitos.'); return false;
        }
        if (input) row._importEventDecision = { number: Number(input), context: I.eventContext(row) };
        else delete row._importEventDecision;
      }
      if (FRESH.indexOf(key) >= 0) {
        // O campo de edição anuncia cm. Unidade explícita digitada é preservada.
        var raw = string(value).trim();
        var measured = I.readFreshMeasurement(raw,{meaning:'measured',sourceUnit:/\b(?:cm|mm)\s*$/i.test(raw)?'':'cm'});
        if (measured.code && measured.code !== 'SOURCE_VALUE_MISSING') {
          d.Toast.warn(SOURCE_CODES[measured.code] || 'Informe a medição escalar em cm.'); return false;
        }
        var before = row[key];
        row._freshEvidence = row._freshEvidence || {}; row._freshEvidence[key] = measured;
        p.pre.decisionLog.push({sheet:row._source.sheet,line:row._source.line,type:'revisao_medicao',action:'medicao_confirmada',
          field:key,original:value,before:before,value:measured.value,unit:measured.unit});
        value = measured.value;
      }
      return original.editRow.call(this,rowId,key,value);
    };
    A.resetPreDerived = function () {
      var result = original.reset.apply(this,arguments); p.pre._freshUnitDecisions = {}; return result;
    };
    A.selectSheet = function (name) {
      var old = p.pre.selectedSheet, result = original.select.apply(this,arguments);
      if (old !== p.pre.selectedSheet) p.pre._freshUnitDecisions = {}; return result;
    };
    A.prepareInference = function () {
      // O usuário já confirmou o mapeamento. refreshMapping aqui apagava sua escolha.
      try {
        if (!p.pre.mapping || !p.pre.mapping.fields || !p.pre.columns || !p.pre.columns.length) {
          throw new Error('Confirme o mapeamento antes de preparar os dados.');
        }
        U.loading(true,'Preparando os dados com o mapeamento confirmado...');
        C.prepare(); p.activeSuggestionTab='proposal';p.step=3;U.render();
      } catch (error) { preparedContext=null;d.Toast.error('Não foi possível preparar: '+string(error && error.message)); }
      finally { U.loading(false); }
    };
    A.finalizeConversion = function () {
      // Não deixa erros em setTimeout escaparem do controle de carregamento.
      try { U.loading(true,'Validando eventos e evidências...'); C.finalize(); p.previewPage=0;p.step=4;U.render(); }
      catch (error) { d.Toast.error('Não foi possível validar: ' + string(error && error.message)); }
      finally { U.loading(false); }
    };
    X.downloadImport = function () {
      V.validateAll(); C.refreshSummary();
      // Mesmo rascunho não deve sair de uma seleção obsoleta da origem.
      if (!preparedIsCurrent()) {
        d.Toast.warn('A origem ou o mapeamento mudou. Prepare e confira os dados novamente antes de exportar.');
        return false;
      }
      return original.download.apply(this,arguments);
    };
    U.preSetup = function () {
      return original.setup.apply(this,arguments)
        .replace('id="setting-volumeDefault"','id="setting-volumeDefault" disabled')
        .replace('id="setting-volumeDefaultAuthorized"','id="setting-volumeDefaultAuthorized" disabled')
        .replace('Volume só é preenchido quando a autorização abaixo estiver marcada.','Volume ausente permanece pendente. A referência antiga abaixo está desativada para não criar um volume fictício.')
        .replace('Autorizo aplicar às linhas sem volume','Preenchimento por padrão desativado')
        .replace('Propor Slump/Flow nominal','Mostrar referência nominal (não preenche medição)');
    };
    U.preMapping = function () {
      var html = '<section class="card panel"><h3>Unidades da planilha de origem</h3><p>Use somente a unidade documentada na célula ou no cabeçalho. Quando ela não estiver escrita, confirme aqui após consultar a origem. A escolha vale apenas para esta aba e coluna.</p><div class="grid-2">';
      FRESH.forEach(function (field) {
        var col = sourceColumn(field), selected = sourceUnit(field);
        html += '<label class="label">' + field + ' — ' + d.Utils.esc(col.label || 'coluna não mapeada') +
          '<select class="field" data-import-unit-field="' + field + '"><option value="">Não confirmada</option>' +
          ['cm','mm'].map(function (unit) { return '<option value="' + unit + '"' + (selected===unit?' selected':'') + '>' + unit + '</option>'; }).join('') + '</select></label>';
      });
      return html + '</div></section>' + original.mapping.apply(this,arguments);
    };
    U.prePreview = function () {
      return '<div class="info-strip"><strong>Revisão dos eventos:</strong> edite a coluna Número Concretagem. Confirme o mesmo número apenas para caminhões do mesmo evento; números distintos mantêm eventos separados. Slump e Flow desta revisão são medições em cm, nunca valores nominais do traço.</div>' + original.preview.apply(this,arguments);
    };
    U.proposalCard = function (proposal) {
      var html = original.proposal.apply(this,arguments);
      return proposal && proposal.referenceOnly ? html.replace('data-action="accept-proposal"','disabled aria-disabled="true" data-action="accept-proposal"')
        .replace('Aceitar nesta linha','Referência — não aplicar como medição').replace('Aguardando decisão','Referência para conferência') : html;
    };
    d.document.addEventListener('change',function (event) {
      var target = event.target, field = target && target.dataset && target.dataset.importUnitField;
      if (FRESH.indexOf(field) < 0 || ['', 'cm','mm'].indexOf(target.value) < 0) return;
      p.pre._freshUnitDecisions = p.pre._freshUnitDecisions || {};
      if (target.value) p.pre._freshUnitDecisions[field] = {unit:target.value,context:sourceColumn(field).context};
      else delete p.pre._freshUnitDecisions[field];
    });
    installed.add(p);
    return {version:'1.1.0'};
  }
  return { VERSION:'1.1.0',install:install };
}));
