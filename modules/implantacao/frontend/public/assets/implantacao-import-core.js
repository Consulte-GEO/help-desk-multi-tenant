/* ============================================================================
 * ImplantacaoImportCore — importador de planilha de implantação · v5.22.47
 *
 * Lê DOIS formatos de planilha e devolve dados prontos para hidratar o wizard
 * (metadata parcial, grupos+peças, concretos, usuários, fornecedores):
 *
 *   1. MODELO NOVO (R02, tabular) — abas: Obra, Estruturas, Concretos, Peças,
 *      Usuários, Fornecedores. Gerado por nós; 1 linha por registro.
 *   2. MODELO LEGADO (R00/R01) — abas: 'Dados Obra l Acessos', 'Estrutura'
 *      (seções em 2 colunas lado a lado), 'Concreto', 'Usina', 'Laboratório'.
 *      Parse best-effort com avisos.
 *
 * Padrão do projeto (como intake-auditor/similarity-engine): módulo UMD
 * determinístico, sem dependência de DOM, recebe a lib XLSX por parâmetro —
 * roda no browser (window.ImplantacaoImportCore) e no Node (gate em tools/).
 *
 * Regras:
 *   - nunca inventar dado: campo não encontrado fica vazio e vira aviso;
 *   - texto original preservado (FCK "FCK 30" → fck=30, descrição mantida);
 *   - volume com >2 casas é arredondado para 2 COM aviso (máscara do wizard);
 *   - ids sempre gerados aqui (nunca vindos da planilha).
 * ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); }
  else { root.ImplantacaoImportCore = factory(); }
}(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  /* ── helpers ──────────────────────────────────────────────────────────── */
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, ' ').trim();
  }
  function clean(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); }
  function isBlank(v) { return v == null || String(v).trim() === ''; }
  var seq = 0;
  function uid(prefix) {
    seq += 1;
    var rnd = Math.random().toString(36).slice(2, 8);
    return prefix + '-imp-' + rnd + '-' + seq;
  }
  function extractFck(text) {
    var t = norm(text);
    var m = t.match(/fck\s*[:=]?\s*(\d{1,3})(?:[.,](\d))?/);
    if (!m) m = t.match(/^\s*(\d{2})\s*(?:mpa)?\s*$/);
    if (!m) return null;
    var v = parseFloat(m[1] + (m[2] ? '.' + m[2] : ''));
    return (v >= 5 && v <= 100) ? v : null;
  }
  function parseVolume(v) {
    if (isBlank(v)) return { value: '', rounded: false };
    if (typeof v === 'number' && isFinite(v)) {
      var r = Math.round(v * 100) / 100;
      return { value: String(r).replace('.', ','), rounded: Math.abs(r - v) > 1e-9 };
    }
    var s = clean(v).replace(/m³|m3/gi, '').trim();
    if (!/\d/.test(s)) return { value: '', rounded: false };
    if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
    var n = parseFloat(s);
    if (!isFinite(n)) return { value: '', rounded: false };
    var r2 = Math.round(n * 100) / 100;
    return { value: String(r2).replace('.', ','), rounded: Math.abs(r2 - n) > 1e-9 };
  }
  /* matriz com mescladas expandidas (mesma abordagem do intake-auditor) */
  function sheetMatrix(ws, X) {
    var matrix = X.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    var merges = ws['!merges'] || [];
    for (var k = 0; k < merges.length; k++) {
      var mg = merges[k];
      var top = (matrix[mg.s.r] || [])[mg.s.c];
      for (var r = mg.s.r; r <= mg.e.r; r++) {
        if (!matrix[r]) matrix[r] = [];
        for (var c = mg.s.c; c <= mg.e.c; c++) {
          if (r === mg.s.r && c === mg.s.c) continue;
          if (isBlank(matrix[r][c])) matrix[r][c] = top;
        }
      }
    }
    return matrix;
  }
  function findSheet(wb, names) {
    for (var i = 0; i < wb.SheetNames.length; i++) {
      var n = norm(wb.SheetNames[i]);
      for (var j = 0; j < names.length; j++) {
        if (n === norm(names[j]) || n.indexOf(norm(names[j])) === 0) return wb.SheetNames[i];
      }
    }
    return null;
  }

  /* ── vocabulários do wizard ───────────────────────────────────────────── */
  var TIPOS_ESTRUTURA = ['Bloco', 'Torre', 'Contenção', 'Área Externa', 'Anexos', 'Apoio'];
  function mapTipoEstrutura(text) {
    var t = norm(text);
    if (/torre/.test(t)) return 'Torre';
    if (/bloco/.test(t)) return 'Bloco';
    if (/conten/.test(t)) return 'Contenção';
    if (/area externa|área externa|externa/.test(t)) return 'Área Externa';
    if (/anexo/.test(t)) return 'Anexos';
    if (/apoio/.test(t)) return 'Apoio';
    return null;
  }
  function mapPerfil(text) {
    var t = norm(text);
    if (/engenheir/.test(t)) return 'engenheiro';
    if (/operador|campo/.test(t)) return 'operador_campo';
    if (/qualidade/.test(t)) return 'qualidade';
    if (/laborat/.test(t)) return 'laboratorio';
    if (/analista|gestor|diretor|coorden/.test(t)) return 'analista_gestor';
    return '';
  }
  /* Etapa por heurística de nome da peça / seção */
  function mapEtapa(peca, tipoSecao) {
    var t = norm(peca);
    if (/estaca|bloco de coroamento|baldrame|radier|tubul|sapata|funda/.test(t)) return 'Fundação';
    if (/conten|arrimo|diafragma|cortina/.test(t) || tipoSecao === 'Contenção') return 'Contenção';
    if (tipoSecao === 'Área Externa' || tipoSecao === 'Anexos' || /passeio|guarita|gourmet|calcada|calçada|externa/.test(t)) return 'Anexos';
    return 'Estrutura';
  }

  /* ── factories no shape do wizard ─────────────────────────────────────── */
  function novoGrupoImp(seed) {
    return {
      id: uid('grp'), nome: seed.nome || '', edificacoesInput: seed.edificacoesInput || '',
      edificacoesExpanded: [], tipoEdificacao: seed.tipoEdificacao || 'Bloco',
      projetista: seed.projetista || '', observacoes: seed.observacoes || '', pecas: seed.pecas || []
    };
  }
  function novaPecaImp(seed, ordem) {
    return {
      id: uid('pec'), local: seed.local || '', etapa: seed.etapa || 'Estrutura',
      fck: seed.fck != null ? seed.fck : '', volume: seed.volume || '',
      concretoId: seed.concretoId || '', observacoes: seed.observacoes || '', ordem: ordem
    };
  }
  function novoConcretoImp(seed) {
    return {
      id: uid('con'), descricao: seed.descricao || '', aplicacao: seed.aplicacao || '',
      fck: seed.fck != null ? seed.fck : '', moldagem: seed.moldagem || '', padroesMoldagem: []
    };
  }

  /* ════════════════════════════════════════════════════════════════════════
   * FORMATO NOVO (R02) — abas tabulares
   * ══════════════════════════════════════════════════════════════════════ */
  function isFormatoNovo(wb) {
    return !!(findSheet(wb, ['Estruturas']) && findSheet(wb, ['Peças', 'Pecas']));
  }
  function headerIndex(row) {
    var map = {};
    for (var c = 0; c < row.length; c++) { if (!isBlank(row[c])) map[norm(row[c])] = c; }
    return map;
  }
  function col(map, candidates) {
    for (var i = 0; i < candidates.length; i++) {
      var key = norm(candidates[i]);
      if (map[key] != null) return map[key];
      for (var k in map) { if (k.indexOf(key) === 0) return map[k]; }
    }
    return null;
  }
  function tableRows(matrix, avisos, abaLabel) {
    /* localiza a linha de cabeçalho (primeira com ≥2 células de texto) */
    for (var r = 0; r < Math.min(matrix.length, 12); r++) {
      var txt = 0;
      for (var c = 0; c < (matrix[r] || []).length; c++) if (!isBlank(matrix[r][c]) && typeof matrix[r][c] !== 'number') txt++;
      if (txt >= 2) {
        return { headerRow: r, map: headerIndex(matrix[r]), rows: matrix.slice(r + 1) };
      }
    }
    avisos.push('Aba ' + abaLabel + ': cabeçalho não localizado.');
    return { headerRow: -1, map: {}, rows: [] };
  }

  function parseNovo(wb, X) {
    var avisos = [];
    var out = { formato: 'novo', metadata: {}, grupos: [], concretos: [], usuariosObra: [], fornecedores: [], avisos: avisos };

    /* Obra: rótulo/valor em duas colunas */
    var sObra = findSheet(wb, ['Obra']);
    if (sObra) {
      var m = sheetMatrix(wb.Sheets[sObra], X);
      var mapa = {};
      for (var r = 0; r < m.length; r++) {
        var row = m[r] || [];
        for (var c = 0; c < row.length - 1; c++) {
          if (!isBlank(row[c]) && !isBlank(row[c + 1])) {
            mapa[norm(row[c]).replace(/[:*]/g, '').trim()] = clean(row[c + 1]);
          }
        }
      }
      function pick(cands) {
        for (var i = 0; i < cands.length; i++) {
          for (var k in mapa) { if (k.indexOf(norm(cands[i])) === 0) return mapa[k]; }
        }
        return '';
      }
      out.metadata.clienteNome = pick(['empresa', 'contratante', 'empresa/contratante']);
      out.metadata.obraNome = pick(['nome da obra', 'obra']);
      var endereco = pick(['endereco completo', 'endereco']);
      var cidade = pick(['cidade', 'regional']);
      out.metadata.obraEndereco = endereco + (cidade && endereco.indexOf(cidade) < 0 ? ' — ' + cidade : '');
      out.metadata.obraCEP = pick(['cep']);
      var obsExtra = [];
      var qtd = pick(['quantidade de blocos', 'quantidade']);
      var unidades = pick(['numero de unidades', 'nº de unidades', 'unidades']);
      var eng = pick(['engenheiro']);
      var cnpj = pick(['cnpj']);
      if (cnpj) obsExtra.push('CNPJ: ' + cnpj);
      if (qtd) obsExtra.push('Blocos/torres: ' + qtd);
      if (unidades) obsExtra.push('Unidades: ' + unidades);
      if (eng) obsExtra.push('Engenheiro da obra: ' + eng);
      out.metadata.obraObservacoes = obsExtra.join(' · ');
    } else avisos.push('Aba Obra não encontrada — dados da obra não importados.');

    /* Concretos primeiro (para casar concreto das peças por descrição) */
    var sCon = findSheet(wb, ['Concretos', 'Concreto']);
    var concretoPorDescricao = {};
    if (sCon) {
      var t = tableRows(sheetMatrix(wb.Sheets[sCon], X), avisos, 'Concretos');
      var cDesc = col(t.map, ['descricao completa', 'concreto padrao', 'descricao']);
      var cFck = col(t.map, ['fck']);
      var cApl = col(t.map, ['aplicacao']);
      var cMold = col(t.map, ['padrao de moldagem', 'moldagem']);
      for (var i = 0; i < t.rows.length; i++) {
        var rw = t.rows[i] || [];
        var desc = cDesc != null ? clean(rw[cDesc]) : '';
        if (!desc) continue;
        var conc = novoConcretoImp({
          descricao: desc,
          aplicacao: cApl != null ? clean(rw[cApl]) : '',
          fck: (cFck != null && !isBlank(rw[cFck])) ? (extractFck(rw[cFck]) != null ? extractFck(rw[cFck]) : clean(rw[cFck])) : (extractFck(desc) != null ? extractFck(desc) : ''),
          moldagem: cMold != null ? clean(rw[cMold]) : ''
        });
        out.concretos.push(conc);
        concretoPorDescricao[norm(desc)] = conc.id;
      }
    }

    /* Estruturas (grupos) */
    var sEst = findSheet(wb, ['Estruturas']);
    var grupoPorChave = {};
    var gruposPorTipo = {};   /* tipo -> [grupos] (fallback de casamento das peças) */
    if (sEst) {
      var te = tableRows(sheetMatrix(wb.Sheets[sEst], X), avisos, 'Estruturas');
      var eTipo = col(te.map, ['tipo de estrutura', 'tipo']);
      var eNum = col(te.map, ['numero da estrutura', 'numero']);
      var eNome = col(te.map, ['nomenclatura no sistema', 'nomenclatura', 'descricao']);
      var eProj = col(te.map, ['projetista']);
      var eObs = col(te.map, ['observacoes', 'observacao']);
      for (var i2 = 0; i2 < te.rows.length; i2++) {
        var rw2 = te.rows[i2] || [];
        var tipoRaw = eTipo != null ? clean(rw2[eTipo]) : '';
        var numRaw = eNum != null ? clean(rw2[eNum]) : '';
        var nomeRaw = eNome != null ? clean(rw2[eNome]) : '';
        if (!tipoRaw && !numRaw && !nomeRaw) continue;
        var tipo = mapTipoEstrutura(tipoRaw) || 'Bloco';
        if (tipoRaw && !mapTipoEstrutura(tipoRaw)) avisos.push('Estruturas linha ' + (te.headerRow + i2 + 2) + ': tipo "' + tipoRaw + '" fora da lista — assumido Bloco. Revise.');
        var g = novoGrupoImp({
          tipoEdificacao: tipo, edificacoesInput: numRaw, nome: nomeRaw,
          projetista: eProj != null ? clean(rw2[eProj]) : '',
          observacoes: eObs != null ? clean(rw2[eObs]) : ''
        });
        out.grupos.push(g);
        grupoPorChave[norm(tipo + ' ' + numRaw)] = g;
        if (nomeRaw) grupoPorChave[norm(nomeRaw)] = g;
        /* '-' significa "estrutura única sem numeração": NÃO serve de chave
         * (toda estrutura sem número colidiria na mesma entrada e a primeira
         * venceria, roubando as peças das demais). */
        if (numRaw && numRaw !== '-') grupoPorChave[norm(numRaw)] = g;
        (gruposPorTipo[tipo] = gruposPorTipo[tipo] || []).push(g);
      }
    }

    /* Peças */
    var sPec = findSheet(wb, ['Peças', 'Pecas']);
    if (sPec) {
      var tp = tableRows(sheetMatrix(wb.Sheets[sPec], X), avisos, 'Peças');
      var pEst = col(tp.map, ['estrutura']);
      var pLocal = col(tp.map, ['peca/pavimento', 'peça/pavimento', 'peca', 'unidade/peca', 'pavimento']);
      var pEtapa = col(tp.map, ['etapa']);
      var pFck = col(tp.map, ['fck']);
      var pVol = col(tp.map, ['volume']);
      var pConc = col(tp.map, ['concreto aplicado', 'concreto']);
      var pObs = col(tp.map, ['observacoes', 'observacao']);
      var volAjustados = 0, concNaoCasados = 0, casadosPorTipo = 0;
      for (var i3 = 0; i3 < tp.rows.length; i3++) {
        var rw3 = tp.rows[i3] || [];
        var local = pLocal != null ? clean(rw3[pLocal]) : '';
        if (!local) continue;
        var estRef = pEst != null ? clean(rw3[pEst]) : '';
        var g2 = grupoPorChave[norm(estRef)] || null;
        if (!g2) {
          /* Fallback: o cliente escreveu o TIPO ("Contenção") em vez da
           * nomenclatura exata ("Contenções"). Casa por tipo apenas quando
           * existe UMA estrutura daquele tipo — ambíguo continua virando
           * aviso, nunca chute. */
          var tipoRef = mapTipoEstrutura(estRef);
          if (tipoRef && gruposPorTipo[tipoRef] && gruposPorTipo[tipoRef].length === 1) {
            g2 = gruposPorTipo[tipoRef][0];
            casadosPorTipo++;
          }
        }
        if (!g2) {
          if (out.grupos.length === 1) g2 = out.grupos[0];
          else { avisos.push('Peças linha ' + (tp.headerRow + i3 + 2) + ': estrutura "' + estRef + '" não encontrada — peça ignorada.'); continue; }
        }
        var vol = parseVolume(pVol != null ? rw3[pVol] : '');
        if (vol.rounded) volAjustados++;
        var concretoId = '';
        if (pConc != null && !isBlank(rw3[pConc])) {
          concretoId = concretoPorDescricao[norm(clean(rw3[pConc]))] || '';
          if (!concretoId) concNaoCasados++;
        }
        var fckRaw = pFck != null ? rw3[pFck] : '';
        var fckVal = extractFck(fckRaw);
        var etapaRaw = pEtapa != null ? clean(rw3[pEtapa]) : '';
        g2.pecas.push(novaPecaImp({
          local: local,
          etapa: etapaRaw || mapEtapa(local, g2.tipoEdificacao),
          fck: fckVal != null ? fckVal : clean(fckRaw),
          volume: vol.value, concretoId: concretoId,
          observacoes: pObs != null ? clean(rw3[pObs]) : ''
        }, g2.pecas.length));
      }
      if (volAjustados) avisos.push(volAjustados + ' volume(s) com mais de 2 casas decimais foram arredondados para 2 casas.');
      if (concNaoCasados) avisos.push(concNaoCasados + ' peça(s) com "Concreto aplicado" sem correspondência na aba Concretos — associe manualmente.');
      if (casadosPorTipo) avisos.push(casadosPorTipo + ' peça(s) referenciavam a estrutura pelo tipo em vez da nomenclatura exata — associadas pela única estrutura daquele tipo. Confira na Etapa 4.');
    }

    /* Usuários */
    var sUsu = findSheet(wb, ['Usuários', 'Usuarios']);
    if (sUsu) {
      var tu = tableRows(sheetMatrix(wb.Sheets[sUsu], X), avisos, 'Usuários');
      var uNome = col(tu.map, ['nome']);
      var uEmail = col(tu.map, ['email', 'e-mail']);
      var uCargo = col(tu.map, ['cargo']);
      var uTel = col(tu.map, ['telefone']);
      var uPerf = col(tu.map, ['perfil']);
      for (var i4 = 0; i4 < tu.rows.length; i4++) {
        var rw4 = tu.rows[i4] || [];
        var nome = uNome != null ? clean(rw4[uNome]) : '';
        if (!nome) continue;
        out.usuariosObra.push({
          id: uid('usr'), nome: nome,
          email: uEmail != null ? clean(rw4[uEmail]) : '',
          cargo: uCargo != null ? clean(rw4[uCargo]) : '',
          telefone: uTel != null ? clean(rw4[uTel]) : '',
          perfil: uPerf != null ? mapPerfil(rw4[uPerf]) : ''
        });
      }
    }

    /* Fornecedores (Tipo: Usina/Laboratório) */
    var sFor = findSheet(wb, ['Fornecedores']);
    if (sFor) {
      var tf = tableRows(sheetMatrix(wb.Sheets[sFor], X), avisos, 'Fornecedores');
      var fTipo = col(tf.map, ['tipo']);
      var fNome = col(tf.map, ['nome']);
      var fCnpj = col(tf.map, ['cnpj']);
      var fEnd = col(tf.map, ['endereco']);
      var fResp = col(tf.map, ['responsavel']);
      var fEmail = col(tf.map, ['emails de programacao', 'email']);
      var fTel = col(tf.map, ['telefone']);
      var fObs = col(tf.map, ['observacoes']);
      for (var i5 = 0; i5 < tf.rows.length; i5++) {
        var rw5 = tf.rows[i5] || [];
        var nomeF = fNome != null ? clean(rw5[fNome]) : '';
        if (!nomeF) continue;
        var tipoF = /lab/.test(norm(fTipo != null ? rw5[fTipo] : '')) ? 'laboratorio' : 'usina';
        var emails = fEmail != null ? clean(rw5[fEmail]).split(/[;,\n]/).map(clean).filter(Boolean).slice(0, 3) : [];
        out.fornecedores.push({
          id: uid('for'), tipo: tipoF, nome: nomeF,
          cnpj: fCnpj != null ? clean(rw5[fCnpj]) : '',
          endereco: fEnd != null ? clean(rw5[fEnd]) : '',
          responsavel: fResp != null ? clean(rw5[fResp]) : '',
          emailsProgramacao: emails,
          telefone: fTel != null ? clean(rw5[fTel]) : '',
          observacoes: fObs != null ? clean(rw5[fObs]) : ''
        });
      }
    }
    return out;
  }

  /* ════════════════════════════════════════════════════════════════════════
   * FORMATO LEGADO (R00/R01) — abas do modelo antigo do Consulte GEO
   * ══════════════════════════════════════════════════════════════════════ */
  function isFormatoLegado(wb) {
    return !!(findSheet(wb, ['Dados Obra']) && findSheet(wb, ['Estrutura']));
  }

  function parseLegado(wb, X) {
    var avisos = [];
    var out = { formato: 'legado', metadata: {}, grupos: [], concretos: [], usuariosObra: [], fornecedores: [], avisos: avisos };
    avisos.push('Planilha no modelo antigo (R00/R01): sem Projetista e sem concreto por peça — complete no wizard. Prefira o novo modelo para as próximas obras.');

    /* — Dados da Obra + usuários — */
    var sObra = findSheet(wb, ['Dados Obra']);
    if (sObra) {
      var m = sheetMatrix(wb.Sheets[sObra], X);
      var kv = {};
      for (var r = 0; r < m.length; r++) {
        var row = m[r] || [];
        for (var c = 0; c < row.length - 1; c++) {
          var label = norm(row[c]).replace(/[:*]/g, '').trim();
          if (label && !isBlank(row[c + 1]) && label.length > 2) { if (kv[label] == null) kv[label] = clean(row[c + 1]); }
        }
      }
      function pick(cands) {
        for (var i = 0; i < cands.length; i++) { for (var k in kv) { if (k.indexOf(norm(cands[i])) === 0) return kv[k]; } }
        return '';
      }
      out.metadata.clienteNome = pick(['empresa/contratante', 'empresa']);
      out.metadata.obraNome = pick(['nome da obra']);
      var end = pick(['endereco completo da obra', 'endereco']);
      var reg = pick(['regional']);
      out.metadata.obraEndereco = end + (reg && end.indexOf(reg) < 0 ? ' — ' + reg : '');
      out.metadata.obraCEP = pick(['cep']);
      var extra = [];
      var cnpj = pick(['cnpj']); if (cnpj) extra.push('CNPJ: ' + cnpj);
      var qtd = pick(['quantidade de blocos/torres', 'quantidade de blocos']); if (qtd) extra.push('Blocos/torres: ' + qtd);
      var unid = pick(['numero de unidades']); if (unid) extra.push('Unidades: ' + unid);
      var eng = pick(['engenheiro da obra']); if (eng) extra.push('Engenheiro da obra: ' + eng);
      out.metadata.obraObservacoes = extra.join(' · ');

      /* usuários: blocos "USUÁRIO N" com rótulos nas linhas seguintes */
      for (var r2 = 0; r2 < m.length; r2++) {
        var row2 = m[r2] || [];
        for (var c2 = 0; c2 < row2.length; c2++) {
          if (/^usuario\s*\d+/.test(norm(row2[c2]))) {
            var u = { id: uid('usr'), nome: '', email: '', cargo: '', telefone: '', perfil: '' };
            for (var rr = r2 + 1; rr <= r2 + 6 && rr < m.length; rr++) {
              var lab = norm((m[rr] || [])[c2]);
              var val = clean((m[rr] || [])[c2 + 1]);
              if (!val) continue;
              if (lab.indexOf('nome') === 0) u.nome = val;
              else if (lab.indexOf('email') === 0) u.email = val.split(/\s|\n/)[0];
              else if (lab.indexOf('cargo') === 0) u.cargo = val;
              else if (lab.indexOf('telefone') === 0) u.telefone = val;
              else if (lab.indexOf('perfil') === 0) u.perfil = mapPerfil(val);
            }
            if (u.nome) out.usuariosObra.push(u);
          }
        }
      }
    }

    /* — Concretos — */
    var sCon = findSheet(wb, ['Concreto']);
    if (sCon) {
      var mc = sheetMatrix(wb.Sheets[sCon], X);
      /* cabeçalho: linha com "Concreto Padrão" */
      var hRow = -1, cDesc = -1, cApl = -1, cMold = -1;
      for (var r3 = 0; r3 < Math.min(mc.length, 10); r3++) {
        var rowc = mc[r3] || [];
        for (var c3 = 0; c3 < rowc.length; c3++) {
          var n3 = norm(rowc[c3]);
          if (n3.indexOf('concreto padrao') === 0) { hRow = r3; cDesc = c3; }
          if (hRow === r3 && n3.indexOf('aplicacao') === 0) cApl = c3;
          if (hRow === r3 && n3.indexOf('padrao de moldagem') === 0) cMold = c3;
        }
        if (hRow >= 0) break;
      }
      if (hRow >= 0) {
        for (var r4 = hRow + 1; r4 < mc.length; r4++) {
          var desc = clean((mc[r4] || [])[cDesc]);
          if (!desc || norm(desc).indexOf('curva') === 0) continue;
          out.concretos.push(novoConcretoImp({
            descricao: desc,
            aplicacao: cApl >= 0 ? clean((mc[r4] || [])[cApl]) : '',
            fck: extractFck(desc) != null ? extractFck(desc) : '',
            moldagem: cMold >= 0 ? clean((mc[r4] || [])[cMold]) : ''
          }));
        }
      } else avisos.push('Aba Concreto: cabeçalho "Concreto Padrão" não localizado.');
    }

    /* — Estrutura: seções em DUAS colunas lado a lado —
     * Padrão real: título da seção ("TORRE: 1", "BLOCO/TORRE: ___", "ÁREA
     * EXTERNA", "CONTENÇÕES") numa linha; na linha seguinte o cabeçalho
     * "Unidade/Peça *"; abaixo, as peças até esvaziar. Metade esquerda começa
     * na coluna do título; a metade direita repete o padrão ~4 colunas depois. */
    var sEst = findSheet(wb, ['Estrutura']);
    if (sEst) {
      var me = sheetMatrix(wb.Sheets[sEst], X);
      var sections = [];
      for (var r5 = 0; r5 < me.length; r5++) {
        var rowe = me[r5] || [];
        for (var c5 = 0; c5 < rowe.length; c5++) {
          if (norm(rowe[c5]).indexOf('unidade/peca') === 0) {
            /* título = célula não vazia na linha anterior, mesma coluna (ou à esquerda) */
            var title = '';
            var prev = me[r5 - 1] || [];
            for (var cc = c5; cc >= Math.max(0, c5 - 1); cc--) { if (!isBlank(prev[cc])) { title = clean(prev[cc]); break; } }
            sections.push({ headerRow: r5, col: c5, title: title });
          }
        }
      }
      var volAj = 0;
      for (var s6 = 0; s6 < sections.length; s6++) {
        var sec = sections[s6];
        var tituloNorm = norm(sec.title);
        var tipo = mapTipoEstrutura(sec.title) || (/(bloco|torre)/.test(tituloNorm) ? 'Torre' : 'Bloco');
        /* número: "TORRE: 1" → "1"; "BLOCO / TORRE: ___" → '' */
        var num = '';
        var mNum = sec.title.match(/:\s*([A-Za-z0-9º°\s,e\-]+)\s*$/);
        if (mNum && clean(mNum[1]).replace(/_/g, '') !== '') num = clean(mNum[1]);
        var g = novoGrupoImp({ tipoEdificacao: tipo, edificacoesInput: num, nome: sec.title && !mapTipoEstrutura(sec.title) ? sec.title : (mapTipoEstrutura(sec.title) === tipo && !num ? sec.title : '') });
        if (mapTipoEstrutura(sec.title) && !num) g.nome = '';
        var added = 0;
        for (var r7 = sec.headerRow + 1; r7 < me.length; r7++) {
          var cell = (me[r7] || [])[sec.col];
          if (isBlank(cell)) break;
          var nomePeca = clean(cell);
          if (norm(nomePeca).indexOf('unidade/peca') === 0) break;
          var fckRaw2 = (me[r7] || [])[sec.col + 1];
          var volRaw = (me[r7] || [])[sec.col + 2];
          var vol2 = parseVolume(volRaw);
          if (vol2.rounded) volAj++;
          var fck2 = extractFck(fckRaw2);
          g.pecas.push(novaPecaImp({
            local: nomePeca,
            etapa: mapEtapa(nomePeca, tipo),
            fck: fck2 != null ? fck2 : clean(fckRaw2),
            volume: vol2.value
          }, g.pecas.length));
          added++;
        }
        if (added > 0) out.grupos.push(g);
      }
      if (volAj) avisos.push(volAj + ' volume(s) arredondados para 2 casas decimais.');
      if (!sections.length) avisos.push('Aba Estrutura: nenhuma seção "Unidade/Peça" localizada.');

      /* Dedupe de seção-template: o modelo antigo repete a mesma seção nas
       * duas colunas (ex.: CONTENÇÕES preenchida à esquerda e o template em
       * branco à direita). Se um grupo tem TODAS as peças sem FCK e sem
       * volume, e existe outro grupo do MESMO tipo com o MESMO conjunto de
       * nomes de peças e pelo menos um valor preenchido, o vazio é descartado
       * (com aviso). Determinístico; nunca descarta dado preenchido. */
      (function dedupeTemplates() {
        function chavePecas(g) {
          var nomes = [];
          for (var i = 0; i < g.pecas.length; i++) nomes.push(norm(g.pecas[i].local));
          nomes.sort();
          return g.tipoEdificacao + '::' + nomes.join('|');
        }
        function temDado(g) {
          for (var i = 0; i < g.pecas.length; i++) {
            if (g.pecas[i].fck !== '' || g.pecas[i].volume !== '') return true;
          }
          return false;
        }
        var mantidos = [];
        var descartados = 0;
        for (var a = 0; a < out.grupos.length; a++) {
          var ga = out.grupos[a];
          var descartar = false;
          if (!temDado(ga)) {
            for (var b = 0; b < out.grupos.length; b++) {
              if (a === b) continue;
              var gb = out.grupos[b];
              if (chavePecas(gb) === chavePecas(ga) && temDado(gb)) { descartar = true; break; }
            }
          }
          if (descartar) descartados++;
          else mantidos.push(ga);
        }
        if (descartados) {
          out.grupos = mantidos;
          avisos.push(descartados + ' seção(ões) de template em branco (duplicadas de seção preenchida) foram ignoradas.');
        }
      })();
    }

    /* — Usinas e Laboratórios: blocos rótulo/valor — */
    function parseFornecedorBlocos(sheetName, tipo, labelNome) {
      var s = findSheet(wb, [sheetName]);
      if (!s) return;
      var mf = sheetMatrix(wb.Sheets[s], X);
      for (var r8 = 0; r8 < mf.length; r8++) {
        var rowf = mf[r8] || [];
        for (var c8 = 0; c8 < rowf.length; c8++) {
          if (norm(rowf[c8]).indexOf(norm(labelNome)) === 0) {
            var val = clean(rowf[c8 + 1]);
            if (!val) continue;
            var f = { id: uid('for'), tipo: tipo, nome: val, cnpj: '', endereco: '', responsavel: '', emailsProgramacao: [], telefone: '', observacoes: '' };
            for (var r9 = r8 + 1; r9 <= r8 + 6 && r9 < mf.length; r9++) {
              var lab2 = norm((mf[r9] || [])[c8]);
              var v2 = clean((mf[r9] || [])[c8 + 1]);
              if (!v2) continue;
              if (lab2.indexOf('cnpj') === 0) f.cnpj = v2;
              else if (lab2.indexOf('endereco') === 0) f.endereco = v2;
              else if (lab2.indexOf('responsavel') === 0 || lab2.indexOf('nome do responsavel') === 0) f.responsavel = v2;
              else if (lab2.indexOf('email') === 0) f.emailsProgramacao = v2.split(/[;,\s\n]+/).filter(function (x) { return x.indexOf('@') > 0; }).slice(0, 3);
              else if (lab2.indexOf('telefone') === 0) f.telefone = v2;
            }
            out.fornecedores.push(f);
          }
        }
      }
    }
    parseFornecedorBlocos('Usina', 'usina', 'nome da usina');
    parseFornecedorBlocos('Laborat', 'laboratorio', 'nome do laborat');
    return out;
  }

  /* ── API ──────────────────────────────────────────────────────────────── */
  function parseWorkbook(wb, X) {
    if (!wb || !wb.SheetNames || !wb.SheetNames.length) throw new Error('Arquivo sem abas legíveis.');
    var out;
    if (isFormatoNovo(wb)) out = parseNovo(wb, X);
    else if (isFormatoLegado(wb)) out = parseLegado(wb, X);
    else throw new Error('Formato não reconhecido: esperado o modelo de implantação Consulte GEO (novo ou antigo). Abas encontradas: ' + wb.SheetNames.join(', '));
    var totalPecas = 0;
    for (var i = 0; i < out.grupos.length; i++) totalPecas += out.grupos[i].pecas.length;
    out.resumo = {
      formato: out.formato,
      estruturas: out.grupos.length,
      pecas: totalPecas,
      concretos: out.concretos.length,
      usuarios: out.usuariosObra.length,
      fornecedores: out.fornecedores.length,
      avisos: out.avisos.length
    };
    return out;
  }
  function parse(data, X) {
    var wb = X.read(data, { type: (typeof data === 'string') ? 'binary' : 'array', cellDates: false });
    return parseWorkbook(wb, X);
  }

  return {
    VERSION: VERSION,
    parse: parse,
    parseWorkbook: parseWorkbook,
    _internals: { extractFck: extractFck, parseVolume: parseVolume, mapTipoEstrutura: mapTipoEstrutura, mapPerfil: mapPerfil, mapEtapa: mapEtapa, TIPOS_ESTRUTURA: TIPOS_ESTRUTURA }
  };
}));
