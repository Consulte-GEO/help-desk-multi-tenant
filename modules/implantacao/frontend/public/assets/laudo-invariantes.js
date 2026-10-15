/*
 * laudo-invariantes.js · Implantação Consulte GEO V13
 * Normalização, consenso e validação determinística para laudos de rompimento.
 * O modelo propõe; este módulo decide o que pode ser aceito sem adivinhação.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LaudoInvariantes = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 'laudo-invariantes-1.0.0';
  // V15 — catálogo único. Inclui os códigos emitidos pela Edge Function, que o
  // cliente injeta como achados externos; sem isso a severidade era genérica.
  const VALIDATION_CODES = Object.freeze([
    'MPA_FORA_DE_FAIXA', 'MPA_PARECE_CARGA', 'IDADE_FORA_DA_LISTA',
    'IDADE_DIVERGE_DATAS', 'DATA_INVALIDA', 'ROMPIMENTO_ANTES_DA_MOLDAGEM',
    'NF_AUSENTE', 'CP_DUPLICADO', 'RESULTADO_DUPLICADO_SUSPEITO',
    'RESISTENCIA_DECRESCENTE_COM_IDADE', 'MEDIA_NAO_CONFERE',
    'QUANTIDADE_CP_INESPERADA', 'PAGINA_NAO_PROCESSADA', 'PAGINA_ILEGIVEL',
    'DIVERGENCIA_ENTRE_PASSADAS', 'ALIAS_GENERICO_DETECTADO', 'LAUDO_SEM_RESULTADO',
    'CARGA_SEM_AREA', 'MPA_DIVERGE_CARGA_AREA', 'CAMPO_ILEGIVEL',
    'CAMPO_AUSENTE', 'VALOR_NORMALIZADO', 'IDADE_1D_12H_NAO_APLICADA',
    'SEPARADOR_AMBIGUO', 'QUANTIDADE_LINHAS_DIVERGE',
    // emitidos pela Edge Function laudo-vision
    'PASSADA_UNICA_SEM_CONSENSO', 'RELEITURA_APLICADA', 'CAMPO_CRITICO_PENDENTE',
    'RELEITURA_NAO_EXECUTADA_POR_QUOTA', 'RELEITURA_FALHOU',
  ]);

  /** Severidade por código — usada pelo cliente ao injetar achados da Edge Function. */
  const SEVERIDADE_POR_CODIGO = Object.freeze({
    LAUDO_SEM_RESULTADO: 'error',
    PASSADA_UNICA_SEM_CONSENSO: 'error',
    CAMPO_CRITICO_PENDENTE: 'error',
    DIVERGENCIA_ENTRE_PASSADAS: 'warning',
    QUANTIDADE_LINHAS_DIVERGE: 'warning',
    RELEITURA_FALHOU: 'warning',
    RELEITURA_NAO_EXECUTADA_POR_QUOTA: 'warning',
    PAGINA_NAO_PROCESSADA: 'warning',
    PAGINA_ILEGIVEL: 'warning',
    RELEITURA_APLICADA: 'info',
    SEPARADOR_AMBIGUO: 'info',
  });
  function severidadeDoCodigo(code, padrao) {
    return SEVERIDADE_POR_CODIGO[String(code)] || padrao || 'warning';
  }

  const ALIASES_GENERICOS = new Set([
    'resistencia', 'resistência', 'mpa', 'tensao', 'tensão', 'resultado',
    '28 dias', 'idade', 'nota fiscal', 'nf', 'corpo de prova', 'cp',
  ]);

  function texto(v) {
    return v == null ? '' : String(v).trim().replace(/\s+/g, ' ');
  }

  function semAcentos(v) {
    return texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /**
   * V15 — devolve também se a leitura foi AMBÍGUA. Um único ponto seguido de
   * exatamente três dígitos (`7.854`) pode ser separador decimal ou de milhar;
   * antes o código escolhia decimal em silêncio e corrompia área/carga.
   */
  function numeroPtBrDetalhado(v) {
    if (typeof v === 'number') return { valor: Number.isFinite(v) ? v : null, ambiguo: false };
    const s = texto(v).replace(/[^0-9,.-]/g, '');
    if (!s || s === '-' || (s.match(/-/g) || []).length > 1 || (s.includes('-') && !s.startsWith('-'))) {
      return { valor: null, ambiguo: false };
    }
    const pontos = (s.match(/\./g) || []).length;
    const virgulas = (s.match(/,/g) || []).length;
    let canon = s;
    let ambiguo = false;
    if (pontos && virgulas) {
      const pos = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
      canon = s.slice(0, pos).replace(/[.,]/g, '') + '.' + s.slice(pos + 1).replace(/[.,]/g, '');
    } else if (virgulas === 1) {
      canon = s.replace(',', '.');
    } else if (virgulas > 1 || pontos > 1) {
      return { valor: null, ambiguo: false };
    } else if (pontos === 1 && /\.\d{3}$/.test(s)) {
      // pt-BR: ponto com três dígitos depois é milhar muito mais vezes que decimal.
      ambiguo = true;
    }
    if (!/^-?\d+(\.\d+)?$/.test(canon)) return { valor: null, ambiguo: false };
    const n = Number(canon);
    return { valor: Number.isFinite(n) ? n : null, ambiguo, alternativa: ambiguo ? Number(canon.replace('.', '')) : null };
  }
  function numeroPtBr(v) {
    return numeroPtBrDetalhado(v).valor;
  }

  function dataBr(v) {
    const s = texto(v);
    const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
    if (!m) return null;
    const dia = Number(m[1]);
    const mes = Number(m[2]);
    const ano = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    if (ano < 2000 || ano > 2099 || mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
    const d = new Date(Date.UTC(ano, mes - 1, dia));
    if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
    return { date: d, valor: `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}` };
  }

  function estadoCampo(campo, tipo) {
    const base = campo && typeof campo === 'object' && !Array.isArray(campo) ? campo : { valor: campo };
    const estadoInformado = ['valor', 'ausente', 'ilegivel'].includes(base.estado) ? base.estado : null;
    const raw = texto(base.raw ?? base.valorBruto ?? base.valor);
    let valor = base.valor;
    if (tipo === 'numero') valor = numeroPtBr(valor);
    if (tipo === 'data') {
      const p = dataBr(valor);
      valor = p ? p.valor : null;
    }
    if (tipo === 'texto') valor = texto(valor) || null;
    let estado = estadoInformado;
    if (!estado) estado = valor == null || valor === '' ? 'ausente' : 'valor';
    if (estado === 'valor' && (valor == null || valor === '')) estado = raw ? 'ilegivel' : 'ausente';
    if (estado !== 'valor') valor = null;
    return {
      estado,
      valor,
      raw: raw || null,
      motivo: texto(base.motivo) || null,
    };
  }

  function normalizarUnidadeIdade(v) {
    const s = semAcentos(v);
    if (/^(h|hr|hrs|hora|horas)$/.test(s)) return 'hora';
    if (/^(d|dia|dias)$/.test(s)) return 'dia';
    return null;
  }

  function normalizarResultado(input, contexto) {
    const src = input && typeof input === 'object' ? input : {};
    const ctx = contexto || {};
    const idadeSrc = src.idade && typeof src.idade === 'object' ? src.idade : {
      valor: src.idade,
      unidade: src.idadeUnidade || src.idade_unidade,
      raw: src.idadeRaw,
      estado: src.idade == null ? 'ausente' : 'valor',
    };
    const idadeCampo = estadoCampo(idadeSrc, 'numero');
    const idadeUnidade = idadeCampo.estado === 'valor' ? normalizarUnidadeIdade(idadeSrc.unidade) : null;
    const mpaCampo = estadoCampo(src.mpa && typeof src.mpa === 'object' ? src.mpa : {
      valor: src.mpa,
      raw: src.mpaRaw || src.mpaBruto || src.mpa,
      estado: src.mpa == null ? 'ausente' : 'valor',
    }, 'numero');
    const cargaCampo = estadoCampo(src.carga, 'numero');
    const areaCampo = estadoCampo(src.area, 'numero');
    // V15 — "7.854" pode ser 7,854 ou 7854. O valor lido continua valendo, mas a
    // ambiguidade fica visível em vez de virar erro silencioso de área/carga.
    const ambiguidades = [];
    for (const [nome, campoNum] of [['mpa', src.mpa], ['carga', src.carga], ['area', src.area]]) {
      const bruto = campoNum && typeof campoNum === 'object' ? (campoNum.raw ?? campoNum.valor) : campoNum;
      const det = numeroPtBrDetalhado(bruto);
      if (det.ambiguo) {
        ambiguidades.push({
          code: 'SEPARADOR_AMBIGUO', campo: nome, aplicado: false, raw: texto(bruto),
          leituras: [det.valor, det.alternativa],
        });
      }
    }
    const nfCampo = estadoCampo(src.nf, 'texto');
    // V15 — saneamento da NF não pode devolver {estado:'valor', valor:null}:
    // isso apagava o valor E matava o aviso NF_AUSENTE. Agora vira ilegível
    // (com motivo) e a limpeza que muda o texto fica registrada.
    const nfNormalizacoes = [];
    if (nfCampo.valor) {
      const limpo = String(nfCampo.valor).replace(/[^0-9A-Za-z./-]/g, '').slice(0, 80);
      if (!limpo) {
        nfCampo.estado = 'ilegivel';
        nfCampo.valor = null;
        nfCampo.motivo = nfCampo.motivo || 'Nota fiscal sem caracteres aproveitáveis.';
      } else if (limpo !== nfCampo.valor) {
        nfNormalizacoes.push({ code: 'VALOR_NORMALIZADO', campo: 'nf', aplicado: true, de: nfCampo.valor, para: limpo });
        nfCampo.valor = limpo;
      }
    }
    const cpCampo = estadoCampo(src.cp, 'texto');
    const dataMoldagem = estadoCampo(src.dataMoldagem || src.data_moldagem, 'data');
    const dataRompimento = estadoCampo(src.dataRompimento || src.data_rompimento, 'data');
    const id = texto(src.id) || `tmp-${String(ctx.indice || 1).padStart(4, '0')}`;
    return {
      id,
      cp: cpCampo,
      nf: nfCampo,
      idade: { ...idadeCampo, unidade: idadeUnidade },
      mpa: {
        ...mpaCampo,
        valorBruto: numeroPtBr(src.mpa && typeof src.mpa === 'object'
          ? (src.mpa.valorBruto ?? src.mpa.raw ?? src.mpa.valor)
          : (src.mpaBruto ?? src.mpaRaw ?? mpaCampo.valor)),
      },
      carga: cargaCampo,
      area: areaCampo,
      dataMoldagem,
      dataRompimento,
      fckProjeto: estadoCampo(src.fckProjeto || src.fck_projeto, 'numero'),
      slump: estadoCampo(src.slump, 'texto'),
      traco: estadoCampo(src.traco || src.traço, 'texto'),
      localAplicacao: estadoCampo(src.localAplicacao || src.local_aplicacao, 'texto'),
      origem: {
        pagina: Number(src.origem && src.origem.pagina || ctx.pagina || 0) || null,
        linha: Number(src.origem && src.origem.linha || src.linha || 0) || null,
        coluna: Number(src.origem && src.origem.coluna || src.coluna || 0) || null,
        textoLinha: texto(src.origem && src.origem.textoLinha || src.rawLinha) || null,
        fonte: texto(src.origem && src.origem.fonte || src.fonte || ctx.fonte || 'texto') || 'texto',
      },
      confianca: {
        nivel: ['alta', 'media', 'baixa'].includes(src.confianca && src.confianca.nivel)
          ? src.confianca.nivel
          : ['alta', 'media', 'baixa'].includes(src.confianca) ? src.confianca : 'media',
        score: typeof (src.confianca && src.confianca.score) === 'number' ? src.confianca.score : null,
        concordanciaPassadas: Boolean(src.confianca && src.confianca.concordanciaPassadas),
        legibilidade: typeof (src.confianca && src.confianca.legibilidade) === 'number'
          ? src.confianca.legibilidade : null,
      },
      revisaoHumana: {
        status: ['pendente', 'aceito', 'corrigido', 'rejeitado'].includes(src.revisaoHumana && src.revisaoHumana.status)
          ? src.revisaoHumana.status : 'pendente',
        valorAnterior: src.revisaoHumana && src.revisaoHumana.valorAnterior || null,
        por: src.revisaoHumana && src.revisaoHumana.por || null,
        em: src.revisaoHumana && src.revisaoHumana.em || null,
      },
      candidatos: Array.isArray(src.candidatos) ? src.candidatos.slice(0, 8) : [],
      normalizacoes: [
        ...(Array.isArray(src.normalizacoes) ? src.normalizacoes : []),
        ...nfNormalizacoes,
        ...ambiguidades,
      ].slice(0, 40),
      // Metadados de revisão pertencem à camada de aplicação. São preservados aqui para que uma
      // revalidação determinística não apague o snapshot original nem o histórico de edição.
      _ocrSnapshot: src._ocrSnapshot && typeof src._ocrSnapshot === 'object' ? { ...src._ocrSnapshot } : null,
      _fileId: texto(src._fileId) || null,
      _fileName: texto(src._fileName) || null,
      _visionResultIndex: Number.isInteger(src._visionResultIndex) && src._visionResultIndex >= 0 ? src._visionResultIndex : null,
      _editedFields: src._editedFields && typeof src._editedFields[Symbol.iterator] === 'function'
        ? new Set([...src._editedFields])
        : new Set(Array.isArray(src._editedFields) ? src._editedFields : []),
      _rawOriginal: src._rawOriginal && typeof src._rawOriginal === 'object' ? src._rawOriginal : src,
    };
  }

  function validation(code, severity, message, path, id, suggestedFix, metadata) {
    return {
      code,
      severity,
      message,
      path: path || null,
      entityTemporaryId: id || null,
      suggestedFix: suggestedFix || null,
      metadata: metadata || null,
    };
  }

  function diferencaDias(a, b) {
    const da = dataBr(a);
    const db = dataBr(b);
    if (!da || !db) return null;
    return Math.round((db.date.getTime() - da.date.getTime()) / 86400000);
  }

  function valorComparavel(campo) {
    if (!campo || campo.estado !== 'valor') return null;
    if (typeof campo.valor === 'number') return Math.round(campo.valor * 1000) / 1000;
    return semAcentos(campo.valor).replace(/[^a-z0-9./-]/g, '');
  }

  function mesmoCampo(a, b, tolerancia) {
    const va = valorComparavel(a);
    const vb = valorComparavel(b);
    if (a && b && a.estado === b.estado && a.estado !== 'valor') return true;
    if (va == null || vb == null) return false;
    if (typeof va === 'number' && typeof vb === 'number') return Math.abs(va - vb) <= (tolerancia || 0);
    return va === vb;
  }

  function chaveAproximacao(r, indice) {
    const cp = valorComparavel(r.cp);
    const nf = valorComparavel(r.nf);
    const idade = valorComparavel(r.idade);
    const unidade = r.idade && r.idade.unidade || '';
    const linha = r.origem && r.origem.linha;
    return cp ? `cp:${cp}|i:${idade}${unidade}`
      : nf ? `nf:${nf}|i:${idade}${unidade}|l:${linha || indice}`
        : `pos:${r.origem && r.origem.pagina || 0}:${linha || indice}`;
  }

  function casarResultados(a, b) {
    const usados = new Set();
    return a.map((ra, ia) => {
      const key = chaveAproximacao(ra, ia);
      let idx = b.findIndex((rb, ib) => !usados.has(ib) && chaveAproximacao(rb, ib) === key);
      if (idx < 0 && ra.origem && ra.origem.linha) {
        idx = b.findIndex((rb, ib) => !usados.has(ib) && rb.origem && rb.origem.linha === ra.origem.linha);
      }
      // V15 — o fallback "casa com qualquer sobra" fundia corpos de prova
      // diferentes numa linha só (e sumia com os outros). Sobra sem par
      // continua sendo uma linha própria, marcada como sem consenso.
      if (idx >= 0) usados.add(idx);
      return { a: ra, b: idx >= 0 ? b[idx] : null, ia, ib: idx };
    }).concat(b.map((rb, ib) => usados.has(ib) ? null : ({ a: null, b: rb, ia: -1, ib })).filter(Boolean));
  }

  function consenso(passadaA, passadaB, contexto) {
    const a = (passadaA || []).map((r, i) => normalizarResultado(r, { ...contexto, indice: i + 1 }));
    const b = (passadaB || []).map((r, i) => normalizarResultado(r, { ...contexto, indice: i + 1 }));
    const divergencias = [];
    const campos = ['cp', 'nf', 'idade', 'mpa', 'carga', 'area', 'dataMoldagem', 'dataRompimento', 'fckProjeto', 'slump', 'traco', 'localAplicacao'];
    const pares = casarResultados(a, b);
    const resultados = pares.map((par, idx) => {
      const base = par.a || par.b;
      if (!par.a || !par.b) {
        divergencias.push({ resultado: idx, campo: '*', a: Boolean(par.a), b: Boolean(par.b), motivo: 'linha ausente em uma das passadas' });
        return {
          ...base,
          confianca: { nivel: 'baixa', score: 0.35, concordanciaPassadas: false, legibilidade: base.confianca.legibilidade },
          candidatos: [{ passada: par.a ? 'A' : 'B', valor: base }],
        };
      }
      const out = { ...base, candidatos: [], _visionResultIndex: par.a._visionResultIndex ?? par.b._visionResultIndex ?? null };
      let acordos = 0;
      let avaliados = 0;
      for (const campo of campos) {
        const ca = par.a[campo];
        const cb = par.b[campo];
        if (!ca || !cb) continue;
        // V15 — dois campos vazios "concordando" não são acordo: inflavam o
        // score e escondiam a divergência do único campo que importava.
        const contaNoScore = ca.estado === 'valor' || cb.estado === 'valor';
        if (contaNoScore) avaliados += 1;
        const tol = campo === 'mpa' ? 0.05 : 0;
        if (mesmoCampo(ca, cb, tol) && (campo !== 'idade' || par.a.idade.unidade === par.b.idade.unidade)) {
          if (contaNoScore) acordos += 1;
          out[campo] = ca.estado === 'valor' ? ca : cb;
        } else if (ca.estado === 'valor' && cb.estado !== 'valor') {
          out[campo] = { ...ca, motivo: `Somente a passada A leu este campo; passada B: ${cb.estado}.` };
          out.candidatos.push({ campo, passadaA: ca, passadaB: cb });
          divergencias.push({ resultado: idx, campo, a: ca, b: cb, motivo: 'uma passada não encontrou valor' });
        } else if (cb.estado === 'valor' && ca.estado !== 'valor') {
          out[campo] = { ...cb, motivo: `Somente a passada B leu este campo; passada A: ${ca.estado}.` };
          out.candidatos.push({ campo, passadaA: ca, passadaB: cb });
          divergencias.push({ resultado: idx, campo, a: ca, b: cb, motivo: 'uma passada não encontrou valor' });
        } else {
          out[campo] = {
            estado: 'ilegivel', valor: null,
            raw: ca.raw || cb.raw || null,
            motivo: `Passadas divergentes: ${texto(ca.valor || ca.estado)} × ${texto(cb.valor || cb.estado)}.`,
            ...(campo === 'idade' ? { unidade: null } : {}),
          };
          out.candidatos.push({ campo, passadaA: ca, passadaB: cb });
          divergencias.push({ resultado: idx, campo, a: ca, b: cb, motivo: 'valores diferentes' });
        }
      }
      const proporcao = avaliados ? acordos / avaliados : 0;
      let score = Math.max(0, Math.min(1, 0.35 + 0.65 * proporcao));
      // Divergência em MPa ou idade derruba a linha, por mais que o resto bata.
      const criticoDivergente = ['mpa', 'idade'].some((campo) => out[campo] && out[campo].estado === 'ilegivel');
      if (criticoDivergente) score = Math.min(score, 0.45);
      out.confianca = {
        nivel: score >= 0.86 ? 'alta' : score >= 0.62 ? 'media' : 'baixa',
        score: Math.round(score * 100) / 100,
        concordanciaPassadas: divergencias.every((d) => d.resultado !== idx),
        legibilidade: Math.min(par.a.confianca.legibilidade || 1, par.b.confianca.legibilidade || 1),
      };
      return out;
    });
    return { resultados, divergencias, linhasDivergem: a.length !== b.length };
  }

  function validarResultado(r, indice, contexto) {
    const v = [];
    const id = r.id;
    const path = (campo) => `resultados[${indice}].${campo}`;
    if (r.mpa.estado === 'valor') {
      if (!(r.mpa.valor > 0 && r.mpa.valor <= 250)) {
        v.push(validation('MPA_FORA_DE_FAIXA', 'error', `Resistência ${r.mpa.valor} MPa fora da faixa de parse (0, 250].`, path('mpa'), id, 'Conferir se o número é carga em kN/kgf/tf.'));
      } else if (r.mpa.valor > 120) {
        v.push(validation('MPA_FORA_DE_FAIXA', 'warning', `Resistência ${r.mpa.valor} MPa é excepcionalmente alta.`, path('mpa'), id, 'Confirmar unidade e coluna no laudo.'));
      }
    } else {
      v.push(validation(r.mpa.estado === 'ilegivel' ? 'CAMPO_ILEGIVEL' : 'CAMPO_AUSENTE', 'error', 'A resistência em MPa não foi confirmada.', path('mpa'), id, 'Revisar a página do laudo.'));
    }
    if (r.carga.estado === 'valor' && r.mpa.estado !== 'valor') {
      v.push(validation('MPA_PARECE_CARGA', 'error', `Foi lida carga (${r.carga.valor}), mas não resistência em MPa.`, path('mpa'), id, 'Não exportar a carga como resistência.'));
    }
    if (r.mpa.estado === 'valor' && r.mpa.valor >= 200 && r.carga.estado !== 'valor') {
      v.push(validation('MPA_PARECE_CARGA', 'error', `${r.mpa.valor} é compatível com carga e improvável como MPa.`, path('mpa'), id, 'Conferir cabeçalho da coluna.'));
    }
    if (r.carga.estado === 'valor' && r.area.estado === 'valor' && r.mpa.estado === 'valor') {
      const cargaN = r.carga.valor < 10000 ? r.carga.valor * 1000 : r.carga.valor;
      const calculado = cargaN / r.area.valor;
      if (Number.isFinite(calculado) && Math.abs(calculado - r.mpa.valor) > Math.max(1, r.mpa.valor * 0.08)) {
        v.push(validation('MPA_DIVERGE_CARGA_AREA', 'warning', `MPa informado (${r.mpa.valor}) diverge do cálculo carga/área (${calculado.toFixed(1)}).`, path('mpa'), id, 'Confirmar unidade da carga e área do corpo de prova.'));
      }
    } else if (r.carga.estado === 'valor' && r.area.estado !== 'valor') {
      v.push(validation('CARGA_SEM_AREA', 'info', 'A carga foi lida, mas a área não está disponível para conferência cruzada.', path('area'), id));
    }
    if (r.idade.estado === 'valor') {
      if (!r.idade.unidade) {
        v.push(validation('IDADE_FORA_DA_LISTA', 'error', 'A idade tem valor, mas a unidade (dia/hora) não está confirmada.', path('idade'), id, 'Não presumir dias.'));
      } else {
        const max = r.idade.unidade === 'hora' ? 720 : 3650;
        if (!(r.idade.valor > 0 && r.idade.valor <= max)) {
          v.push(validation('IDADE_FORA_DA_LISTA', 'error', `Idade ${r.idade.valor} ${r.idade.unidade} fora da faixa aceita.`, path('idade'), id));
        }
        if (r.idade.unidade === 'dia' && (r.idade.valor === 1 || r.idade.valor === 2)) {
          v.push(validation('IDADE_1D_12H_NAO_APLICADA', 'info', `${r.idade.valor} dia(s) foi preservado; não convertido automaticamente para 12 horas.`, path('idade'), id));
        }
      }
    } else {
      v.push(validation(r.idade.estado === 'ilegivel' ? 'CAMPO_ILEGIVEL' : 'CAMPO_AUSENTE', 'error', 'A idade do rompimento não foi confirmada.', path('idade'), id, 'Revisar a página do laudo.'));
    }
    const dm = r.dataMoldagem.estado === 'valor' ? dataBr(r.dataMoldagem.valor) : null;
    const dr = r.dataRompimento.estado === 'valor' ? dataBr(r.dataRompimento.valor) : null;
    if (r.dataMoldagem.estado === 'valor' && !dm) v.push(validation('DATA_INVALIDA', 'error', 'Data de moldagem inválida.', path('dataMoldagem'), id));
    if (r.dataRompimento.estado === 'valor' && !dr) v.push(validation('DATA_INVALIDA', 'error', 'Data de rompimento inválida.', path('dataRompimento'), id));
    if (dm && dr) {
      const dias = diferencaDias(dm.valor, dr.valor);
      if (dias < 0) v.push(validation('ROMPIMENTO_ANTES_DA_MOLDAGEM', 'error', 'A data de rompimento é anterior à moldagem.', path('dataRompimento'), id));
      if (dias >= 0 && r.idade.estado === 'valor' && r.idade.unidade) {
        const esperada = r.idade.unidade === 'hora' ? r.idade.valor / 24 : r.idade.valor;
        // Tolerância proporcional: 12 h impressas contra 1 dia de intervalo é
        // normal; 28 dias contra 40 não é. Em horas, meio dia já é divergência.
        if (Math.abs(dias - esperada) > (r.idade.unidade === 'hora' ? 0.5 : 1)) {
          v.push(validation('IDADE_DIVERGE_DATAS', 'warning', `Idade lida (${r.idade.valor} ${r.idade.unidade}) diverge do intervalo entre as datas (${dias} dias).`, path('idade'), id, 'Preservar o valor original e confirmar no PDF.', { idadeCalculadaDias: dias }));
        }
      }
    }
    if (r.nf.estado !== 'valor') v.push(validation('NF_AUSENTE', 'warning', 'Nota fiscal não localizada ou ilegível.', path('nf'), id, 'A amarração com a concretagem poderá exigir revisão manual.'));
    for (const [campo, obj] of Object.entries(r)) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !('estado' in obj)) continue;
      // V15 — mpa e idade já foram avaliados acima; sem este guard cada um
      // gerava DOIS CAMPO_ILEGIVEL e a confiança era penalizada em dobro.
      if (campo === 'mpa' || campo === 'idade') continue;
      if (obj.estado === 'ilegivel') v.push(validation('CAMPO_ILEGIVEL', 'warning', `${campo} está visível, mas ilegível ou conflitante.`, path(campo), id, obj.motivo || 'Conferir no documento.'));
    }
    const aliasEntrada = [['cp', r.cp], ['nf', r.nf], ['mpa', r.mpa], ['idade', r.idade]]
      .find(([, c]) => c && c.raw && ALIASES_GENERICOS.has(semAcentos(c.raw)));
    if (aliasEntrada) {
      v.push(validation('ALIAS_GENERICO_DETECTADO', 'error', `Um rótulo genérico foi devolvido como valor de ${aliasEntrada[0]}: “${aliasEntrada[1].raw}”.`, path(aliasEntrada[0]), id, 'Reprocessar a página com foco na célula.'));
    }
    if (Array.isArray(r.candidatos) && r.candidatos.length) {
      v.push(validation('DIVERGENCIA_ENTRE_PASSADAS', 'error', `${r.candidatos.length} campo(s) divergiram entre as passadas.`, path('candidatos'), id, 'Escolher o valor correto na revisão humana.'));
    }
    return v;
  }

  function validarCruzado(resultados, contexto) {
    const v = [];
    const porCp = new Map();
    const exatos = new Map();
    resultados.forEach((r, i) => {
      const cp = valorComparavel(r.cp);
      const nf = valorComparavel(r.nf);
      const idade = valorComparavel(r.idade);
      const mpa = valorComparavel(r.mpa);
      if (cp) {
        const key = `${cp}|${idade || ''}|${r.idade.unidade || ''}`;
        if (porCp.has(key)) v.push(validation('CP_DUPLICADO', 'warning', `CP “${r.cp.valor}” aparece mais de uma vez na mesma idade.`, `resultados[${i}].cp`, r.id, 'Confirmar se são exemplares distintos com a mesma identificação.'));
        porCp.set(key, i);
      }
      const dup = `${nf || ''}|${idade || ''}|${r.idade.unidade || ''}|${mpa || ''}`;
      if (nf && idade != null && mpa != null) {
        if (exatos.has(dup)) v.push(validation('RESULTADO_DUPLICADO_SUSPEITO', 'warning', 'Resultado idêntico a outra linha. A linha foi preservada, não deduplicada.', `resultados[${i}]`, r.id, 'Confirmar se são CPs distintos.', { outroIndice: exatos.get(dup) }));
        else exatos.set(dup, i);
      }
    });
    // V15 — o mesmo corpo de prova é identificado pelo PAR nota fiscal + CP.
    // Agrupar por um OU outro juntava exemplares distintos do mesmo caminhão
    // (sem coluna de CP) e CPs homônimos de notas diferentes; a dispersão
    // normal entre gêmeos virava alerta de resistência decrescente.
    const grupos = new Map();
    resultados.forEach((r, i) => {
      const cp = valorComparavel(r.cp);
      if (!cp) return; // sem identificação do exemplar não há série temporal a comparar
      const key = `${valorComparavel(r.nf) || ''}#${cp}`;
      if (r.mpa.estado !== 'valor' || r.idade.estado !== 'valor' || !r.idade.unidade) return;
      const horas = r.idade.valor * (r.idade.unidade === 'dia' ? 24 : 1);
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push({ i, horas, mpa: r.mpa.valor, r });
    });
    for (const grupo of grupos.values()) {
      grupo.sort((a, b) => a.horas - b.horas);
      for (let i = 1; i < grupo.length; i += 1) {
        // Só é "decrescente com a idade" se a idade realmente aumentou.
        if (grupo[i].horas <= grupo[i - 1].horas) continue;
        if (grupo[i].mpa + Math.max(1.5, grupo[i - 1].mpa * 0.08) < grupo[i - 1].mpa) {
          v.push(validation('RESISTENCIA_DECRESCENTE_COM_IDADE', 'warning', `A resistência caiu de ${grupo[i - 1].mpa} para ${grupo[i].mpa} MPa com o aumento da idade.`, `resultados[${grupo[i].i}].mpa`, grupo[i].r.id, 'Confirmar CP, idade e valor; variação real entre exemplares também é possível.'));
        }
      }
    }
    if (contexto && Array.isArray(contexto.paginasNaoProcessadas)) {
      for (const p of contexto.paginasNaoProcessadas) v.push(validation('PAGINA_NAO_PROCESSADA', 'error', `Página ${p} não foi processada.`, 'diagnostico.paginasIgnoradas', null, 'Processar a página ou registrar exclusão consciente.'));
    }
    if (contexto && Array.isArray(contexto.paginasIlegiveis)) {
      for (const p of contexto.paginasIlegiveis) v.push(validation('PAGINA_ILEGIVEL', 'warning', `Página ${p} está abaixo do limiar de legibilidade.`, 'diagnostico.qualidade', null, 'Gerar PDF/foto com maior resolução.'));
    }
    return v;
  }

  function calcularConfiancaResultado(resultado, validacoes, opcoes) {
    const erros = validacoes.filter((x) => x.entityTemporaryId === resultado.id && x.severity === 'error').length;
    const avisos = validacoes.filter((x) => x.entityTemporaryId === resultado.id && x.severity === 'warning').length;
    const criticos = [resultado.mpa, resultado.idade];
    const presentes = criticos.filter((c) => c && c.estado === 'valor').length;
    const leg = typeof (opcoes && opcoes.legibilidade) === 'number' ? opcoes.legibilidade : 0.82;
    const acordo = resultado.confianca.concordanciaPassadas ? 0.16 : 0;
    const score = Math.max(0, Math.min(1, 0.24 + presentes * 0.22 + leg * 0.28 + acordo - erros * 0.25 - avisos * 0.06));
    return {
      nivel: score >= 0.85 ? 'alta' : score >= 0.6 ? 'media' : 'baixa',
      score: Math.round(score * 100) / 100,
      concordanciaPassadas: Boolean(resultado.confianca.concordanciaPassadas),
      legibilidade: Math.round(leg * 100) / 100,
    };
  }

  function validarDocumento(documento) {
    const resultados = (documento.resultados || []).map((r, i) => normalizarResultado(r, { indice: i + 1, fonte: documento.metadata && documento.metadata.fonte }));
    let validacoes = [];
    resultados.forEach((r, i) => { validacoes.push(...validarResultado(r, i, documento)); });
    validacoes.push(...validarCruzado(resultados, documento.diagnostico || {}));
    if (!resultados.length) validacoes.push(validation('LAUDO_SEM_RESULTADO', 'error', 'Nenhum resultado de rompimento foi identificado.', 'resultados', null, 'Conferir se o arquivo é um laudo suportado ou melhorar a qualidade do PDF.'));
    resultados.forEach((r) => {
      r.confianca = calcularConfiancaResultado(r, validacoes, {
        legibilidade: r.confianca.legibilidade == null ? documento.diagnostico && documento.diagnostico.legibilidadeMedia : r.confianca.legibilidade,
      });
    });
    return { ...documento, resultados, validation: validacoes };
  }

  function scoreDocumento(documento) {
    const d = validarDocumento(documento);
    const total = Math.max(1, d.resultados.length);
    const erros = d.validation.filter((x) => x.severity === 'error').length;
    const avisos = d.validation.filter((x) => x.severity === 'warning').length;
    const media = d.resultados.length ? d.resultados.reduce((s, r) => s + (r.confianca.score || 0), 0) / d.resultados.length : 0;
    const score = Math.max(0, Math.min(1, media - erros / total * 0.18 - avisos / total * 0.04));
    return { score: Math.round(score * 100) / 100, nivel: score >= 0.85 ? 'alta' : score >= 0.6 ? 'media' : 'baixa', erros, avisos };
  }

  return Object.freeze({
    VERSION, VALIDATION_CODES, SEVERIDADE_POR_CODIGO, severidadeDoCodigo,
    numeroPtBr, numeroPtBrDetalhado, dataBr, estadoCampo, normalizarResultado,
    consenso, validarResultado, validarCruzado, validarDocumento, scoreDocumento,
    calcularConfiancaResultado, validation, semAcentos,
  });
});
