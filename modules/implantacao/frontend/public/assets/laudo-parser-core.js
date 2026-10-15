var LaudoParser = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // Fonte reconstruída a partir do bundle legado e corrigida na V13
  var parser_core_exports = {};
  __export(parser_core_exports, {
    pareceEscaneado: () => pareceEscaneado,
    parseLaudoTexto: () => parseLaudoTexto
  });
  var IDADES_D = /* @__PURE__ */ new Set([1, 2, 3, 7, 14, 21, 28, 56, 63, 90, 91]);
  var IDADES_H = /* @__PURE__ */ new Set([12, 14, 24, 36, 48, 60, 72]);
  var SNAP_D = {
    4: 3,
    5: 3,
    6: 7,
    8: 7,
    13: 14,
    15: 14,
    26: 28,
    27: 28,
    29: 28,
    30: 28,
    31: 28,
    61: 63,
    62: 63,
    64: 63,
    65: 63
  };
  var PAL_RES = ["resist", "mpa", "ruptura", "tensao", "tens\xE3o", "compress", "rc("];
  // V14 — rótulos de NF. "nota" isolado saiu da lista: fixava a coluna em
  // "Anotações"/"Nota técnica" e matava a leitura da NF no resto do laudo.
  var PAL_NF = [
    "nota fiscal",
    "nota fisc",
    "n. fiscal",
    "n.fiscal",
    "nf n\xBA",
    "nf n",
    "n.f.",
    "danfe",
    "nf-e",
    "nfe",
    "doc. fiscal",
    "documento fiscal",
    "nf"
  ];
  // Rótulo + número, tolerante a "NF: 100.417", "NFe 0100417", "Nota Fiscal nº 100 417".
  var RE_NF_ROTULO = /(?:\bnota\s*fisc\w*|\bdoc(?:umento)?\.?\s*fiscal|\bdanfe\b|\bnf-?e\b|\bn\.\s*f\.|\bnf\b)\s*(?:eletr[o\u00f4\u00f3]nica)?\s*(?:n[\u00ba\u00b0o]?\.?|num(?:ero)?\.?)?\s*[.:\-\/]?\s*(\d{1,3}(?:[.\s]\d{3})+|\d{3,12})(?!\d)/i;
  var RE_NF_ROTULO_G = new RegExp(RE_NF_ROTULO.source, "gi");
  function normalizaNf(v) {
    const d = String(v == null ? "" : v).replace(/[.\s]/g, "");
    if (!/^\d{3,12}$/.test(d)) return "";
    const semZeros = d.replace(/^0+(?=\d)/, "");
    return semZeros.length >= 3 ? semZeros : d;
  }
  // Candidato numérico "solto" (achado pela janela da coluna, sem rótulo ao lado).
  // Rejeita data, ano isolado, CEP/CNPJ e o próprio número do laudo.
  function nfCandidatoValido(tokenBruto, linha, pos, laudoNum) {
    const t = limpaTok(tokenBruto);
    if (!/^\d{4,9}$/.test(t)) return false;
    const n = parseInt(t, 10);
    if (t.length === 4 && n >= 1900 && n <= 2100) return false;
    const antes = linha.slice(Math.max(0, pos - 2), pos);
    const depois = linha.slice(pos + t.length, pos + t.length + 2);
    if (/[\/\-.,]$/.test(antes) || /^[\/\-]/.test(depois)) return false;
    if (laudoNum && normalizaNf(t) && normalizaNf(t) === normalizaNf(laudoNum)) return false;
    return true;
  }
  var BLACK_INFO = [
    "fck",
    "m\xB3",
    "m3",
    "consumo",
    "abat. espec",
    "volume total",
    "slump",
    "tra\xE7o",
    "traco",
    "fator",
    "cnpj",
    "cep",
    "fone",
    "telefone",
    "classe",
    "umidade",
    "temperatura",
    "desvio padr",
    "calibra",
    "espalhamento",
    "caracter",
    "incerteza",
    "m\xE9dia",
    "medias",
    "m\xE9dia(s)",
    "m\xE9dias",
    "media",
    "media(s)"
  ];
  var AXIS_BLACK = ["composi", "tra\xE7o", "traco", "pop ", "descart", "-----"];
  var TITLE_BLACK = ["ensaio de", "determina", "nbr ", "nbr:", "abnt"];
  var ANCORAS_FORTES = ["(mpa", "mpa)", "rc(", "fc(", "tens\xE3o", "tensao", "resist\xEAncia", "resistencia"];
  var ANCORAS_VALOR = ["(mpa", "rc(", "fc("];
  var ANCORAS_CARGA = [
    "(kn",
    "kn)",
    "(kgf",
    "kgf",
    "(n)",
    "(tf",
    "(tnf",
    "tnf)",
    "confian",
    "interval",
    "desvio",
    "c.v",
    "coef. var",
    "exp("
  ];
  var CTRL = /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;
  var RE_IDADE = /(?<![a-zà-ü])idade/g;
  function round1(v) {
    if (Number.isInteger(v * 4) && !Number.isInteger(v * 10)) {
      const f = Math.floor(v * 10);
      return (f % 2 === 0 ? f : f + 1) / 10;
    }
    return parseFloat(v.toFixed(1));
  }
  function norm(ln) {
    return ln.replace(CTRL, "");
  }
  function toks(ln) {
    const out = [];
    const re = /\S+/g;
    let m;
    while (m = re.exec(ln)) out.push([m.index, m[0]]);
    return out;
  }
  function limpaTok(t) {
    return t.replace(/^[-–—;:()*]+/, "").replace(/[-–—;:()*]+$/, "");
  }
  function decVal(t) {
    const s = limpaTok(t);
    if (/^\d{1,3},\d{1,3}$/.test(s)) return parseFloat(s.replace(",", "."));
    if (/^\d{1,3}\.\d{1,3}$/.test(s)) return parseFloat(s);
    return null;
  }
  function limpa(ln) {
    const blank = (m) => " ".repeat(m.length);
    return ln.replace(/\b\d{2,3}\s*[xX]\s*\d{2,3}\b/g, blank).replace(/\b\d{2}\/\d{2}\/\d{2,4}\b/g, blank).replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, blank).replace(/\b\d{2,3}\s*[±+]\s*-?\s*\d{1,3}\b/g, blank);
  }
  function idadeTok(t, ctx = "", permiteZero = false, permiteSnap = false, bareHora = false, permiteBruta = false) {
    var _a;
    const tl = limpaTok(t).toLowerCase();
    const m = tl.match(/^(0?\d{1,4})\s*(hrs?|hs?|horas?|dias?|d)?[.:)]?$/);
    if (!m) return null;
    const bruto = m[1];
    const v = parseInt(bruto, 10);
    const u = (_a = m[2]) != null ? _a : "";
    if (bruto.startsWith("0") && v !== 0 && !(u || permiteZero)) return null;
    if (v === 0) return null;
    const cl = ctx.toLowerCase();
    const ehHora = u.startsWith("h") || !u && /\bh(oras?|rs?|s)?\b/.test(cl);
    const ehDia = u.startsWith("d") || !u && /dia/.test(cl);
    // Unidade explícita ou contexto inequívoco: preserve a idade real, sem whitelist e sem SNAP.
    if (ehHora && v <= 720) return [v, "h"];
    if (ehDia && v <= 3650) return [v, "d"];
    if (!u && IDADES_D.has(v)) return [v, "d"];
    if (bareHora && !u && IDADES_H.has(v) && !IDADES_D.has(v)) return [v, "h"];
    // Em eixos/cabeçalhos já identificados como idade, um número fora da lista continua legítimo.
    if (permiteSnap && !u && v >= 1 && v <= 3650) return [v, "d"];
    if (permiteBruta && (u || ehDia || ehHora)) {
      const limite = ehHora || u.startsWith("h") ? 720 : 3650;
      if (v <= limite) return [v, ehHora || u.startsWith("h") ? "h" : "d"];
    }
    return null;
  }

  var RE_DATA = /\b(\d{2})\/(\d{2})\/(\d{2,4})\b/g;
  function parseDataToken(d, m, a) {
    const ano = a.length === 2 ? 2e3 + parseInt(a, 10) : parseInt(a, 10);
    const dia = parseInt(d, 10);
    const mes = parseInt(m, 10);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12 || ano < 2015 || ano > 2099) return null;
    const dt = new Date(Date.UTC(ano, mes - 1, dia));
    return dt.getUTCDate() === dia ? dt : null;
  }
  var fmtBr = (dt) => `${String(dt.getUTCDate()).padStart(2, "0")}/${String(dt.getUTCMonth() + 1).padStart(2, "0")}/${dt.getUTCFullYear()}`;
  function achaDatasEixo(regl, colsB) {
    if (colsB.length < 2) return /* @__PURE__ */ new Map();
    for (const l of regl) {
      const achadas = [];
      let m;
      RE_DATA.lastIndex = 0;
      while (m = RE_DATA.exec(l)) {
        const dt = parseDataToken(m[1], m[2], m[3]);
        if (dt) achadas.push({ pos: m.index, dt });
      }
      if (achadas.length < 2) continue;
      const mapa = /* @__PURE__ */ new Map();
      let ok = true;
      for (const { pos, dt } of achadas) {
        let melhorJ = -1;
        let melhorD = 27;
        colsB.forEach((c, j) => {
          const d = Math.abs(pos - c[0]);
          if (d < melhorD) {
            melhorD = d;
            melhorJ = j;
          }
        });
        if (melhorJ < 0) continue;
        if (mapa.has(melhorJ)) {
          ok = false;
          break;
        }
        mapa.set(melhorJ, dt);
      }
      if (ok && mapa.size >= 2) return mapa;
    }
    return /* @__PURE__ */ new Map();
  }
  function achaMoldagemEixo(regl) {
    for (const l of regl) {
      if (!/molda/i.test(l)) continue;
      const achadas = [];
      let m;
      RE_DATA.lastIndex = 0;
      while (m = RE_DATA.exec(l)) {
        const dt = parseDataToken(m[1], m[2], m[3]);
        if (dt) achadas.push(dt);
      }
      if (achadas.length === 1) return achadas[0];
    }
    return null;
  }
  function achaColDatas(regl) {
    let romp = null;
    let mold = null;
    for (const l of regl) {
      const low = l.toLowerCase();
      if (!romp) {
        const m = low.match(/romp|ruptura|ensaio/);
        if (m && m.index !== void 0) romp = [Math.max(0, m.index - 4), m.index + 24];
      }
      if (!mold) {
        const m = low.match(/molda/);
        if (m && m.index !== void 0) mold = [Math.max(0, m.index - 4), m.index + 24];
      }
    }
    return { romp, mold };
  }
  function idadeHorario(t) {
    const m = limpaTok(t).match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = parseInt(m[1], 10) + (parseInt(m[2], 10) >= 30 ? 1 : 0);
    return h >= 1 && h <= 119 ? [h, "h"] : null;
  }
  function linhaDados(ln) {
    const low = ln.toLowerCase();
    if (BLACK_INFO.some((b) => low.includes(b))) return false;
    let n = 0;
    for (const [, t] of toks(limpa(ln))) {
      const v = decVal(t);
      if (v !== null && v >= 0.9 && v <= 250) n++;
    }
    return n >= 1;
  }
  function blocosDe(dadosIdx, gap = 3) {
    if (!dadosIdx.length) return [];
    const blocos = [[dadosIdx[0]]];
    for (const i of dadosIdx.slice(1)) {
      if (i - blocos[blocos.length - 1][blocos[blocos.length - 1].length - 1] <= gap) {
        blocos[blocos.length - 1].push(i);
      } else blocos.push([i]);
    }
    return blocos;
  }
  function unidadeAbaixo(regl, li, pos) {
    for (let lj = li + 1; lj < Math.min(li + 4, regl.length); lj++) {
      const re = /(dias?|horas?|hrs?)\b/g;
      let m;
      const low = regl[lj].toLowerCase();
      while (m = re.exec(low)) {
        if (Math.abs(m.index - pos) <= 7) return m[0].startsWith("h") ? "h" : "d";
      }
    }
    return null;
  }
  function temRE(re, s) {
    re.lastIndex = 0;
    return re.test(s);
  }
  function occRE(re, s) {
    re.lastIndex = 0;
    const out = [];
    let m;
    while (m = re.exec(s)) out.push(m.index);
    return out;
  }
  function achaEixoB(regl) {
    var _a;
    let melhor = [];
    let melhorSc = -1;
    let melhorLi = -1;
    for (let li = 0; li < regl.length; li++) {
      const l = regl[li];
      const low = l.toLowerCase();
      if (AXIS_BLACK.some((b) => low.includes(b))) continue;
      if (linhaDados(l)) continue;
      const cand = [];
      for (const [pos, t] of toks(l)) {
        const tl = limpaTok(t);
        const hor = idadeHorario(t);
        if (hor) {
          const esqH = l.slice(Math.max(0, pos - 14), pos).toLowerCase();
          if (/:00$/.test(limpaTok(t)) && IDADES_H.has(hor[0]) && !/(mold|hor[aá]|emiss|sa[íi]da|cheg|coleta|\b[àa]s\b)/.test(esqH)) {
            cand.push([pos, hor[0], "h", true]);
          }
          continue;
        }
        if (!/^0?\d{1,3}([a-z]{1,5})?$/.test(tl.toLowerCase())) continue;
        const esq = l.slice(Math.max(0, pos - 6), pos).toLowerCase();
        if (esq.includes("cp") || esq.includes("n\xBA") || esq.includes("n\xB0")) continue;
        const uTextual = /\d\s*(h|d)/.test(tl.toLowerCase()) || /\b(dias?|horas?|hrs?)\b/.test(l.slice(pos, pos + 14).toLowerCase());
        let it = idadeTok(t, l.slice(Math.max(0, pos - 7), pos + 14), true, true);
        let temU = !!it && uTextual;
        if (!uTextual) {
          const u2 = unidadeAbaixo(regl, li, pos);
          if (u2) {
            const it2 = idadeTok(t + u2, "", true, true);
            if (it2) {
              it = it2;
              temU = true;
            }
          }
        }
        if (it) cand.push([pos, it[0], it[1], temU]);
      }
      if (cand.length >= 2) {
        const seg = l.slice(cand[0][0], cand[cand.length - 1][0]);
        if (seg.includes(";")) continue;
        const temDiaHora = /\b(dias?|horas?|hrs?)\b/.test(low);
        if (!(temDiaHora || cand.some((c) => c[3]))) continue;
        const horas = cand.map((c) => c[1] * (c[2] === "d" ? 24 : 1));
        let quedas = 0;
        for (let j = 1; j < horas.length; j++) if (horas[j] < horas[j - 1]) quedas++;
        const vs = cand.map((c) => c[1]);
        let sc = cand.length - 3 * quedas;
        if (low.includes("dia") || low.includes("hora") || low.includes("hr")) sc += 3;
        if (temRE(RE_IDADE, low)) sc += 2;
        const ordenado = vs.every((v, j) => j === 0 || vs[j - 1] <= v);
        if (ordenado && new Set(vs).size === vs.length) sc += 2;
        if (vs.every((v) => v >= 1 && v <= 6) && !low.includes("dia")) sc -= 4;
        if (sc > melhorSc) {
          melhorSc = sc;
          melhor = cand.map(([p, v, u]) => [p, v, u]);
          melhorLi = li;
        } else if (melhor.length && cand.length >= 2 && cand.every((c) => c[0] > melhor[melhor.length - 1][0] + 10)) {
          const novos = cand.filter((c) => melhor.every((m2) => Math.abs(c[0] - m2[0]) >= 6)).map(([p, v, u]) => [p, v, u]);
          melhor = [...melhor, ...novos].sort((a, b) => a[0] - b[0]);
        }
      }
    }
    if (melhor.length) {
      const lo = melhor[0][0];
      const hi = melhor[melhor.length - 1][0];
      for (let lj = Math.max(0, melhorLi - 2); lj < Math.min(regl.length, melhorLi + 3); lj++) {
        if (lj === melhorLi) continue;
        const l2 = regl[lj];
        const low2 = l2.toLowerCase();
        if (AXIS_BLACK.some((b) => low2.includes(b)) || linhaDados(l2)) continue;
        for (const [pos, t] of toks(l2)) {
          const tl2 = limpaTok(t);
          if (!/^0?\d{1,3}$/.test(tl2)) continue;
          if (pos > lo - 6 && pos < hi + 6) continue;
          const dep = l2.slice(pos + t.length, pos + t.length + 12).toLowerCase();
          const u2 = (_a = unidadeAbaixo(regl, lj, pos)) != null ? _a : /^\s*(horas?|hrs?)\b/.test(dep) ? "h" : /^\s*dias?\b/.test(dep) ? "d" : null;
          if (!u2) continue;
          const it = idadeTok(tl2 + u2, "", true, true);
          if (it && melhor.every((c) => Math.abs(pos - c[0]) >= 6)) melhor.push([pos, it[0], it[1]]);
        }
      }
    }
    return melhor.sort((a, b) => a[0] - b[0]);
  }
  function achaEixoInline(regl) {
    for (const l of regl) {
      const low = l.toLowerCase();
      if (AXIS_BLACK.some((b) => low.includes(b))) continue;
      if (linhaDados(l)) continue;
      const occ = occRE(RE_IDADE, low);
      if (occ.length < 2) continue;
      const cols = [];
      for (const p of occ) {
        const seg = l.slice(p, p + 28);
        for (const [pos, t] of toks(seg)) {
          const it = idadeTok(t, seg.slice(Math.max(0, pos - 3), pos + 18), true);
          if (it) {
            cols.push([p + pos, it[0], it[1]]);
            break;
          }
        }
      }
      if (cols.length >= 2) return cols.sort((a, b) => a[0] - b[0]);
    }
    return [];
  }
  function achaColIdade(regl) {
    for (const l of regl) {
      const low = l.toLowerCase();
      const m0 = occRE(RE_IDADE, low);
      if (!m0.length) {
        const m1 = low.match(/\((dias?|horas?)\)/);
        if (m1 && m1.index !== void 0) {
          const c = m1.index + 2;
          return [c - 10, c + 14, c, m1[1].startsWith("h") ? "h" : "d"];
        }
        continue;
      }
      const p = m0[0];
      if (m0.length >= 2) return null;
      let centro = p + 2;
      let uDef = null;
      for (const l2 of regl) {
        const m = l2.toLowerCase().match(/\((dias?|horas?)\)/);
        if (m && m.index !== void 0 && Math.abs(m.index - p) <= 12) {
          centro = m.index + 2;
          uDef = m[1].startsWith("h") ? "h" : "d";
          break;
        }
      }
      if (!uDef) {
        const seg = low.slice(p, p + 26);
        if (/\bhoras?\b/.test(seg)) uDef = "h";
        else if (/\bdias?\b/.test(seg)) uDef = "d";
      }
      return [centro - 10, centro + 14, centro, uDef];
    }
    return null;
  }
  function acharOcorrencias(low, pal) {
    const out = [];
    let i = low.indexOf(pal);
    while (i >= 0) {
      out.push(i);
      i = low.indexOf(pal, i + 1);
    }
    return out;
  }
  function ancorasValor(regl) {
    const pos = [];
    for (const l of regl) {
      const low = l.toLowerCase();
      for (const pal of ANCORAS_VALOR) for (const i of acharOcorrencias(low, pal)) pos.push(i + 2);
    }
    const uniq = [...new Set(pos)].sort((a, b) => a - b);
    const dedup = [];
    for (const p of uniq) if (!dedup.length || p - dedup[dedup.length - 1] > 6) dedup.push(p);
    return dedup;
  }
  function ancorasCarga(regl) {
    const pos = [];
    for (const l of regl) {
      const low = l.toLowerCase();
      for (const pal of ANCORAS_CARGA) for (const i of acharOcorrencias(low, pal)) pos.push(i + 2);
      let m;
      const r1 = /carga\s*\(/g;
      while (m = r1.exec(low)) pos.push(m.index + m[0].length + 1);
      const r2 = /carga(?!\s*\()/g;
      while (m = r2.exec(low)) pos.push(m.index + 3);
    }
    return [...new Set(pos)].sort((a, b) => a - b);
  }
  function idadeGrupo(regl) {
    const achadas = /* @__PURE__ */ new Set();
    let unica = null;
    for (const l of regl) {
      if (!temRE(RE_IDADE, l.toLowerCase()) || linhaDados(l)) continue;
      for (const [pos, t] of toks(l)) {
        const tl = limpaTok(t).toLowerCase();
        const glued = tl.match(/^0?\d{1,3}(h|hr|hrs|hs|horas?|d|dias?)$/);
        const seguinte = l.slice(pos + t.length, pos + t.length + 18).toLowerCase().match(/^\s{0,12}(dias?|horas?|hrs?|hs)\b/);
        if (glued || seguinte) {
          const u = glued && glued[1].startsWith("h") || seguinte && seguinte[1].startsWith("h") ? "h" : "d";
          const it = idadeTok(tl.replace(/[hdiasor]+$/, "") + u, "", true, true);
          if (it) {
            achadas.add(`${it[0]}${it[1]}`);
            unica = it;
          }
        }
      }
    }
    return achadas.size === 1 ? unica : null;
  }
  function spansResistencia(regl, colsB) {
    const fortes = [];
    const fracos = [];
    for (const l of regl) {
      const low = l.toLowerCase();
      if (TITLE_BLACK.some((b) => low.includes(b))) continue;
      for (const pal of ANCORAS_FORTES) {
        for (const i of acharOcorrencias(low, pal)) fortes.push([Math.max(0, i - 12), i + pal.length + 38]);
      }
      for (const pal of PAL_RES) {
        for (const i of acharOcorrencias(low, pal)) fracos.push([Math.max(0, i - 10), i + pal.length + 40]);
      }
    }
    const spans = fortes.length ? fortes : fracos;
    for (const c of colsB) spans.push([c[0] - 12, c[0] + 36]);
    return spans;
  }
  function achaColNf(regl) {
    // V14 — janela proporcional ao rótulo. A antiga [p-6, p+18] perdia a coluna
    // quando o cabeçalho era largo ("NOTA FISCAL") ou o número saía centralizado.
    for (const l of regl) {
      const low = l.toLowerCase();
      let melhor = null;
      for (const pal of PAL_NF) {
        const p = pal === "nf" ? low.search(/\bnf\b/) : low.indexOf(pal);
        if (p < 0) continue;
        if (melhor === null || p < melhor[0]) melhor = [p, pal.length];
      }
      if (melhor) {
        const [p, len] = melhor;
        return [Math.max(0, p - 8), p + Math.max(20, len + 14)];
      }
    }
    return null;
  }
  function idadeSecao(ln) {
    const tk = toks(ln);
    if (!tk.length || tk.length > 8) return null;
    const achei = [];
    for (const [pos, t] of tk) {
      const it = idadeTok(t, ln.slice(Math.max(0, pos - 3), pos + 18));
      if (it) {
        const tl = limpaTok(t).toLowerCase();
        const temU = /(h|d)/.test(tl.replace(/\d/g, "")) || /^\s*(dias?|horas?|hrs?)\b/.test(ln.slice(pos + t.length, pos + t.length + 8).toLowerCase());
        if (temU) achei.push(it);
      }
    }
    if (achei.length === 1) return achei[0];
    if (!achei.length) {
      const m = ln.toLowerCase().match(/^\s*(\d(?:\s+\d){0,2})\s+(dias?|horas?|hrs?)\s*[.:]?\s*$/);
      if (m) {
        const v = parseInt(m[1].replace(/\s+/g, ""), 10);
        const u = m[2].startsWith("h") ? "h" : "d";
        if (u === "d" && v >= 1 && v <= 3650 || u === "h" && v >= 1 && v <= 720) return [v, u];
      }
    }
    return null;
  }
  function parseLaudoTexto(texto) {
    var _a;
    const pares = /* @__PURE__ */ new Map();
    const nfs = /* @__PURE__ */ new Set();
    const remap1d12h = /ensaios?\s+de\s+1\s+dia\s+foram\s+realizados?\s+com\s+12\s+horas/i.test(texto);
    let laudoNum = null;
    const mLaudo = texto.match(
      /(?:laudo|relat[oó]rio|certificado)\s*(?:t[eé]cnico)?\s*(?:de ensaio)?\s*n?[ºo°.:]*\s*([A-Z]{0,4}[-_./]?\d[\d./-]{1,14})/i
    );
    if (mLaudo) laudoNum = mLaudo[1].replace(/^[.\-/]+|[.\-/]+$/g, "");
    // V14 — NF em escopo de página. O motor antigo só enxergava as 12 linhas acima
    // do bloco (e, a partir do 2º bloco, só o que vinha depois do bloco anterior),
    // então a NF impressa no cabeçalho do laudo sumia da 3ª linha em diante.
    const nfsPagina = /* @__PURE__ */ new Set();
    for (const lnPg of texto.split("\n")) {
      RE_NF_ROTULO_G.lastIndex = 0;
      let mPg;
      while (mPg = RE_NF_ROTULO_G.exec(lnPg)) {
        const val = normalizaNf(mPg[1]);
        if (val) {
          nfsPagina.add(val);
          nfs.add(val);
        }
      }
    }
    const nfPagina = nfsPagina.size === 1 ? [...nfsPagina][0] : "";
    let emissaoSeq = 0;
    const emite = (mpa, idade, nfInfo, datas, conf = "media") => {
      const [v, u] = idade;
      const normalizacoes = [];
      const nf = typeof nfInfo === "string" ? nfInfo : (nfInfo && nfInfo.valor) || "";
      const nfOrigem = typeof nfInfo === "string" ? (nfInfo ? "linha" : "ausente") : (nfInfo && nfInfo.origem) || "ausente";
      if (nfOrigem === "pagina") {
        normalizacoes.push({ code: "NF_HERDADA_DA_PAGINA", aplicado: true, valor: nf });
      }
      if (!(datas == null ? void 0 : datas.idadeConfiavel) && (datas == null ? void 0 : datas.mold) && datas.romp) {
        const diffH = (datas.romp.getTime() - datas.mold.getTime()) / 36e5;
        const idadeH = u === "d" ? v * 24 : v;
        if (diffH >= 1 && diffH <= 87600 && Math.abs(diffH - idadeH) > 24) {
          normalizacoes.push({
            code: "IDADE_DIVERGE_DATAS",
            aplicado: false,
            valorOriginal: { valor: v, unidade: u === "h" ? "hora" : "dia" },
            idadeCalculadaHoras: Math.round(diffH * 10) / 10
          });
          conf = "baixa";
        }
      }
      if (u === "d" && (v === 1 || v === 2)) {
        normalizacoes.push({
          code: "IDADE_1D_12H_NAO_APLICADA",
          aplicado: false,
          valorOriginal: { valor: v, unidade: "dia" }
        });
      }
      if (remap1d12h && u === "d" && v === 1) {
        normalizacoes.push({
          code: "NOTA_1D_12H_ENCONTRADA",
          aplicado: false,
          valorOriginal: { valor: v, unidade: "dia" },
          sugestao: { valor: 12, unidade: "hora" }
        });
      }
      const mpaBruto = mpa;
      const mpaR = Number.isFinite(mpa) ? Math.round((mpa + Number.EPSILON) * 10) / 10 : mpa;
      const k = `emissao:${emissaoSeq++}`;
      pares.set(k, {
        nf,
        nfOrigem,
        idade: v,
        idadeUnidade: u === "h" ? "hora" : "dia",
        idadeBruta: { valor: v, unidade: u === "h" ? "hora" : "dia" },
        mpa: mpaR,
        mpaBruto,
        confianca: conf,
        normalizacoes,
        ...(datas == null ? void 0 : datas.romp) ? { dataRompimento: fmtBr(datas.romp) } : {},
        ...(datas == null ? void 0 : datas.mold) ? { dataMoldagem: fmtBr(datas.mold) } : {}
      });
    };
    let modeloAnterior = null;
    for (const pg of texto.split("\f")) {
      const linhas = pg.split("\n").map(norm);
      const dadosIdx = linhas.map((l, i) => linhaDados(l) ? i : -1).filter((i) => i >= 0);
      if (!dadosIdx.length) continue;
      const dadosSet = new Set(dadosIdx);
      const blocos = blocosDe(dadosIdx);
      let fimBlocoAnt = -1;
      for (const bloco of blocos) {
        const d0 = bloco[0];
        const regIni = Math.max(0, d0 - 12, fimBlocoAnt + 1);
        const regl = linhas.slice(regIni, d0);
        fimBlocoAnt = bloco[bloco.length - 1];
        let colsB = achaEixoInline(regl);
        if (!colsB.length) colsB = achaEixoB(regl);
        let ancs = ancorasValor(regl);
        let ancsKn = ancorasCarga(regl);
        let colIdade = achaColIdade(regl);
        if (colIdade && colsB.length >= 2) colIdade = null;
        let spans = spansResistencia(regl, colsB);
        let colNf = achaColNf(regl);
        let herdado = false;
        if (!colsB.length && !colIdade && !spans.length && modeloAnterior) {
          [colsB, colIdade, spans, colNf, ancs, ancsKn] = modeloAnterior;
          herdado = true;
        } else if (colsB.length || colIdade || spans.length) {
          modeloAnterior = [colsB, colIdade, spans, colNf, ancs, ancsKn];
        }
        let colAnc = null;
        if (colsB.length >= 2 && ancs.length >= colsB.length) {
          const tmp = [];
          const usadas = /* @__PURE__ */ new Set();
          let ok = true;
          for (let ci = 0; ci < colsB.length; ci++) {
            const [cp, cv, cu] = colsB[ci];
            const prox = ci + 1 < colsB.length ? colsB[ci + 1][0] : 1e6;
            const cand = ancs.filter((a2) => !usadas.has(a2) && a2 >= cp - 4 && a2 < prox - 4);
            if (!cand.length) {
              ok = false;
              break;
            }
            const a = cand.reduce((x, y) => Math.abs(y - cp) < Math.abs(x - cp) ? y : x);
            usadas.add(a);
            tmp.push([a, cv, cu]);
          }
          if (ok && new Set(tmp.map((c) => c[0])).size === colsB.length) {
            tmp.sort((a, b) => a[0] - b[0]);
            const mesma = tmp.every((c, j) => c[1] === colsB[j][1] && c[2] === colsB[j][2]);
            colAnc = mesma ? tmp : null;
          }
        }
        let sec = null;
        let nfSecao = "";
        const capturaNfSecao = (ln) => {
          // Duas ou mais NFs na mesma linha de cabecalho = ambiguo. Nao herda.
          const distintas = /* @__PURE__ */ new Set();
          RE_NF_ROTULO_G.lastIndex = 0;
          let mAmb;
          while (mAmb = RE_NF_ROTULO_G.exec(ln)) {
            const v = normalizaNf(mAmb[1]);
            if (v) distintas.add(v);
          }
          if (distintas.size > 1) return;
          const m = ln.match(RE_NF_ROTULO);
          if (m) {
            const val = normalizaNf(m[1]);
            if (val) {
              nfSecao = val;
              nfs.add(val);
              return;
            }
          }
          if (colNf) {
            for (const [pos, t] of toks(ln)) {
              if (pos < colNf[0] || pos > colNf[1]) continue;
              if (!nfCandidatoValido(t, ln, pos, laudoNum)) continue;
              const val = normalizaNf(limpaTok(t));
              if (!val) continue;
              nfSecao = val;
              nfs.add(val);
              return;
            }
          }
        };
        for (let i = regIni; i < d0; i++) {
          const s = idadeSecao(linhas[i]);
          if (s) sec = s;
          capturaNfSecao(linhas[i]);
        }
        if (!sec && !colsB.length && !colIdade) sec = idadeGrupo(regl);
        const colDatas = achaColDatas(regl);
        const datasEixo = achaDatasEixo(regl, colsB);
        const moldEixo = colsB.length >= 2 ? achaMoldagemEixo(regl) : null;
        const dataPorLinha = /* @__PURE__ */ new Map();
        const idadePorLinha = /* @__PURE__ */ new Map();
        const decsPorLinha = /* @__PURE__ */ new Map();
        const foraDoSpan = /* @__PURE__ */ new Map();
        const nfPorLinha = /* @__PURE__ */ new Map();
        const nfSecaoLinha = /* @__PURE__ */ new Map();
        const linhasB = [];
        for (let i = bloco[0]; i <= bloco[bloco.length - 1]; i++) {
          const ln = linhas[i];
          if (!dadosSet.has(i)) {
            const s = idadeSecao(ln);
            if (s) sec = s;
            capturaNfSecao(ln);
            continue;
          }
          const lc = limpa(ln);
          const tk = toks(lc);
          if (nfSecao) nfSecaoLinha.set(i, nfSecao);
          {
            const achadas = [];
            let mD;
            RE_DATA.lastIndex = 0;
            while (mD = RE_DATA.exec(ln)) {
              const dt = parseDataToken(mD[1], mD[2], mD[3]);
              if (dt) achadas.push({ pos: mD.index, dt });
            }
            if (achadas.length) {
              let romp = null;
              let mold = null;
              const livres = [];
              for (const { pos, dt } of achadas) {
                if (colDatas.romp && pos >= colDatas.romp[0] && pos <= colDatas.romp[1]) {
                  if (!romp || dt > romp) romp = dt;
                } else if (colDatas.mold && pos >= colDatas.mold[0] && pos <= colDatas.mold[1]) {
                  if (!mold || dt < mold) mold = dt;
                } else livres.push(dt);
              }
              if (!romp && !mold && livres.length >= 2) {
                livres.sort((x, y) => x.getTime() - y.getTime());
                mold = livres[0];
                romp = livres[livres.length - 1];
              } else {
                if (!romp && mold && livres.length) romp = livres.reduce((x, y) => y > x ? y : x);
                if (!mold && romp && livres.length) mold = livres.reduce((x, y) => y < x ? y : x);
              }
              if (romp || mold) dataPorLinha.set(i, { mold, romp });
            }
          }
          // V14 — rotulo na propria linha tem prioridade sobre a janela de coluna.
          const mNfLin = ln.match(RE_NF_ROTULO);
          if (mNfLin) {
            const val = normalizaNf(mNfLin[1]);
            if (val) {
              nfPorLinha.set(i, val);
              nfs.add(val);
            }
          }
          if (colNf && !nfPorLinha.has(i)) {
            for (const [pos, t] of toks(ln)) {
              if (pos < colNf[0] || pos > colNf[1]) continue;
              if (!nfCandidatoValido(t, ln, pos, laudoNum)) continue;
              const val = normalizaNf(limpaTok(t));
              if (!val) continue;
              nfs.add(val);
              if (!nfPorLinha.has(i)) nfPorLinha.set(i, val);
            }
          }
          let decs = [];
          for (const [pos, t] of tk) {
            const v = decVal(t);
            if (v !== null && v >= 0.9 && v <= 250) decs.push([pos, v]);
          }
          if (ancs.length && ancsKn.length) {
            decs = decs.filter(([p]) => {
              const dV = Math.min(...ancs.map((a) => Math.abs(p - a)));
              const dK = Math.min(...ancsKn.map((a) => Math.abs(p - a)));
              return dV <= dK;
            });
          }
          if (spans.length) {
            const dentro = decs.filter(([p]) => spans.some(([a, b]) => p >= a && p <= b));
            if (decs.length && !dentro.length) foraDoSpan.set(i, decs);
            if (dentro.length || !herdado) decs = dentro;
          }
          if (decs.length) decsPorLinha.set(i, decs);
          let idadeLin = null;
          if (colIdade) {
            const [a, b, centro, uDef] = colIdade;
            const cands = [];
            for (const [pos, t] of toks(ln)) {
              if (pos >= a - 2 && pos <= b + 2) {
                const sufixoH = /^\s{0,2}h\b/.test(ln.slice(pos + t.length, pos + t.length + 4).toLowerCase());
                const hor = sufixoH ? idadeHorario(t) : null;
                const it = hor != null ? hor : idadeTok(t, ln.slice(Math.max(0, pos - 3), pos + 18), true, true, true);
                if (it) {
                  const temU = sufixoH || /(hr|hora|dia|\bd\b)/.test(ln.slice(pos, pos + 14).toLowerCase());
                  cands.push([temU ? 0 : 1, Math.abs(pos - centro), it]);
                } else if (uDef) {
                  const tl = limpaTok(t);
                  if (/^0?\d{1,3}$/.test(tl)) {
                    const v = parseInt(tl, 10);
                    if (v >= 1 && v <= (uDef === "h" ? 720 : 3650)) cands.push([2, Math.abs(pos - centro), [v, uDef]]);
                  }
                }
              }
            }
            if (cands.length) {
              cands.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
              idadeLin = cands[0][2];
            }
          }
          if (!idadeLin) {
            const expl = [];
            let explIt = null;
            for (const [pos, t] of toks(ln)) {
              const tl = limpaTok(t).toLowerCase();
              const glued = /^0?\d{1,3}(h|hr|hrs|hs|horas?|d|dias?)$/.test(tl);
              const seguinte = /^\s{0,2}(dias?|horas?|hrs?|hs)\b/.test(ln.slice(pos + t.length, pos + t.length + 8).toLowerCase());
              const sufixoH = /^\s{0,2}h\b/.test(ln.slice(pos + t.length, pos + t.length + 4).toLowerCase());
              const hor = sufixoH ? idadeHorario(t) : null;
              if (hor) {
                expl.push(`${hor[0]}${hor[1]}`);
                explIt = hor;
              } else if (glued || seguinte) {
                const it = idadeTok(t, ln.slice(Math.max(0, pos - 3), pos + 18), true, true, false, true);
                if (it) {
                  expl.push(`${it[0]}${it[1]}`);
                  explIt = it;
                }
              }
            }
            if (expl.length && new Set(expl).size === 1) idadeLin = explIt;
          }
          if (!idadeLin && colIdade && !colsB.length) {
            const centro = colIdade[2];
            const cands = [];
            for (const [pos, t] of tk) {
              if (Math.abs(pos - centro) <= 45) {
                const it = idadeTok(t, ln.slice(Math.max(0, pos - 3), pos + 18), false, true, true);
                if (it) cands.push([Math.abs(pos - centro), it]);
              }
            }
            if (cands.length) {
              cands.sort((x, y) => x[0] - y[0]);
              idadeLin = cands[0][1];
            }
          }
          if (idadeLin) idadePorLinha.set(i, idadeLin);
        }
        let decsFinais = decsPorLinha;
        if (spans.length && !herdado && !decsPorLinha.size && foraDoSpan.size) {
          decsFinais = foraDoSpan;
        }
        const nfsBloco = new Set(nfPorLinha.values());
        const nfBloco = nfsBloco.size === 1 ? [...nfsBloco][0] : "";
        // V14 — cadeia explicita com proveniencia: linha > secao > bloco > pagina.
        // A heranca de documento e aplicada depois, em parseDocumentoTexto.
        const nfDe = (i) => {
          if (nfPorLinha.has(i)) return { valor: nfPorLinha.get(i), origem: "linha" };
          if (nfSecaoLinha.has(i)) return { valor: nfSecaoLinha.get(i), origem: "secao" };
          if (nfBloco) return { valor: nfBloco, origem: "bloco" };
          if (nfPagina) return { valor: nfPagina, origem: "pagina" };
          return { valor: "", origem: "ausente" };
        };
        const dataDe = (i, idade) => {
          const d = dataPorLinha.get(i);
          if (d) return d;
          const k = `${idade[0]}${idade[1]}`;
          const viz = [...dataPorLinha.keys()].filter((j) => {
            if (Math.abs(j - i) > 2) return false;
            const ij = idadePorLinha.get(j);
            return !ij || `${ij[0]}${ij[1]}` === k;
          }).sort((a, b) => Math.abs(a - i) - Math.abs(b - i) || a - b);
          return viz.length ? dataPorLinha.get(viz[0]) : null;
        };
        const idxOrdenados = [...decsFinais.keys()].sort((a, b) => a - b);
        for (const i of idxOrdenados) {
          let idadeLin = (_a = idadePorLinha.get(i)) != null ? _a : null;
          const decs = decsFinais.get(i);
          if (!idadeLin && !colsB.length && (colIdade || sec)) {
            const viz = [...idadePorLinha.keys()].filter((j) => Math.abs(j - i) <= 2);
            if (viz.length) {
              viz.sort((a, b) => Math.abs(a - i) - Math.abs(b - i) || a - b);
              idadeLin = idadePorLinha.get(viz[0]);
            } else if (sec) idadeLin = sec;
          }
          if (!idadeLin && !colsB.length && sec) idadeLin = sec;
          if (!idadeLin && !colsB.length) {
            for (const [pos, t] of toks(limpa(linhas[i]))) {
              const it = idadeTok(t, limpa(linhas[i]).slice(Math.max(0, pos - 3), pos + 18));
              if (it) {
                idadeLin = it;
                break;
              }
            }
          }
          if (idadeLin) {
            const idadeDireta = idadePorLinha.has(i) || idadePorLinha.has(i - 1) || idadePorLinha.has(i + 1);
            const nfDireta = nfPorLinha.has(i) || nfSecaoLinha.has(i) || nfsBloco.size === 1;
            const confLin = idadeDireta && nfDireta ? "alta" : "media";
            for (const [, v] of decs) emite(v, idadeLin, nfDe(i), dataDe(i, idadeLin), confLin);
          } else if (colsB.length >= 2) {
            const letras = toks(linhas[i]).filter(([, t]) => /^[A-Z]$/.test(t)).map(([p]) => p).sort((a, b) => a - b);
            linhasB.push([i, [...decs].sort((a, b) => a[0] - b[0]), letras]);
          }
        }
        if (linhasB.length && colsB.length >= 2) {
          const k = colsB.length;
          const bounds = [];
          for (let j = 0; j < k - 1; j++) bounds.push((colsB[j][0] + colsB[j + 1][0]) / 2);
          const asgMid = (pos) => bounds.filter((b) => pos > b).length;
          const asgFloor = (pos) => {
            let j = 0;
            colsB.forEach((c, ci) => {
              if (pos >= c[0] - 2) j = ci;
            });
            return j;
          };
          const asgAnc = (pos) => {
            const a = colAnc.reduce((x, y) => Math.abs(y[0] - pos) < Math.abs(x[0] - pos) ? y : x);
            return colAnc.indexOf(a);
          };
          const estrats = [["mid", asgMid], ["floor", asgFloor]];
          if (colAnc) estrats.push(["anc", asgAnc]);
          const paresTipo = linhasB.every(([, msd, lets]) => lets.length && msd.every(([pos]) => lets.some((p) => p < pos && pos - p <= 22)));
          const mapaTipo = /* @__PURE__ */ new Map();
          const distTipo = /* @__PURE__ */ new Map();
          if (paresTipo) {
            for (const [, msd, lets] of linhasB) {
              for (const [pos] of msd) {
                const p = Math.max(...lets.filter((x) => x < pos));
                const j = asgFloor(p);
                mapaTipo.set(pos, j);
                distTipo.set(pos, Math.abs(p - colsB[j][0]));
              }
            }
            estrats.push(["tipo", (pos) => mapaTipo.get(pos)]);
          }
          let melhorNome = "";
          let melhorSc = null;
          let melhorFn = asgMid;
          estrats.forEach(([nome, fn], ordem) => {
            let viol = 0;
            const usados = /* @__PURE__ */ new Set();
            const dists = [];
            const ref = nome === "anc" ? colAnc : colsB;
            for (const [, msd] of linhasB) {
              const seq = msd.map(([pos, v]) => [fn(pos), v, pos]).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
              for (const [j, , p] of seq) {
                usados.add(j);
                dists.push(nome === "tipo" ? distTipo.get(p) : Math.abs(p - ref[j][0]));
              }
              for (let x = 1; x < seq.length; x++) {
                const [j1, v1] = seq[x - 1];
                const [j2, v2] = seq[x];
                if (j2 > j1 && v2 < v1 - 0.5) viol++;
                if (j2 === j1 && Math.abs(v2 - v1) > 12) viol++;
              }
            }
            const dmed = dists.length ? dists.reduce((a, b) => a + b, 0) / dists.length : 99;
            const sc = [
              viol,
              Math.round(dmed * 10) / 10,
              usados.has(0) ? 0 : 1,
              ordem
            ];
            const menor = !melhorSc || sc[0] < melhorSc[0] || sc[0] === melhorSc[0] && (sc[1] < melhorSc[1] || sc[1] === melhorSc[1] && (sc[2] < melhorSc[2] || sc[2] === melhorSc[2] && sc[3] < melhorSc[3]));
            if (menor) {
              melhorNome = nome;
              melhorSc = sc;
              melhorFn = fn;
            }
          });
          const cores = melhorNome === "anc" ? colAnc : colsB;
          for (const [i, msd] of linhasB) {
            const colsUsadas = new Set(msd.map(([p]) => melhorFn(p)));
            const datasB = (j) => {
              var _a2;
              return datasEixo.has(j) || moldEixo ? { mold: moldEixo, romp: (_a2 = datasEixo.get(j)) != null ? _a2 : null, idadeConfiavel: true } : null;
            };
            if (colsUsadas.size <= 1 && msd.length % k === 0 && msd.length > k) {
              const g = msd.length / k;
              msd.forEach(([, v], j) => {
                const jc = Math.min(Math.floor(j / g), k - 1);
                const c = colsB[jc];
                emite(v, [c[1], c[2]], nfDe(i), datasB(jc), "baixa");
              });
            } else {
              const nfOk = (i2) => nfPorLinha.has(i2) || nfSecaoLinha.has(i2) || nfsBloco.size === 1;
              for (const [pos, v] of msd) {
                const j = melhorFn(pos);
                const confB = Math.abs(pos - cores[j][0]) <= 14 && nfOk(i) ? "alta" : "media";
                emite(v, [cores[j][1], cores[j][2]], nfDe(i), datasB(j), confB);
              }
            }
          }
        }
      }
    }
    return {
      laudoNum,
      resultados: [...pares.values()],
      nfs: [...nfs].sort()
    };
  }
  function pareceEscaneado(textoPosicional) {
    return textoPosicional.replace(/[\s\f]/g, "").length < 400;
  }
  return __toCommonJS(parser_core_exports);
})();


/*
 * Fachada V13. O parser legado permanece encapsulado como verificador determinístico,
 * mas a saída pública preserva bruto, página, linha, estados e contexto.
 */
(function (root) {
  'use strict';
  const legacy = typeof LaudoParser !== 'undefined' ? LaudoParser : root.LaudoParser;
  const perfis = root.LaudoPerfis || (typeof require === 'function' ? (() => { try { return require('./laudo-perfis.js'); } catch { return null; } })() : null);
  const VERSION = 'laudo-parser-core-1.0.0';

  function texto(v) { return v == null ? '' : String(v).trim().replace(/\s+/g, ' '); }
  function semAcentos(v) { return texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function campo(valor, raw, estado, motivo) {
    const tem = valor !== null && valor !== undefined && valor !== '';
    return { estado: estado || (tem ? 'valor' : 'ausente'), valor: tem ? valor : null, raw: texto(raw) || null, motivo: texto(motivo) || null };
  }
  function numeroToken(v) {
    const n = Number(String(v == null ? '' : v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  function regexEscape(v) { return String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function extrairContexto(textoCompleto) {
    const t = String(textoCompleto || '');
    const linhaDe = (re) => {
      const m = t.match(re);
      return m ? texto(m[1]) : null;
    };
    const numDe = (re) => {
      const m = t.match(re);
      return m ? numeroToken(m[1]) : null;
    };
    return {
      fckProjeto: numDe(/\bf\s*ck\s*[:=]?\s*(\d{1,3}(?:[.,]\d+)?)/i),
      slump: linhaDe(/(?:slump|abatimento)\s*[:=]?\s*([^\n\r]{1,40})/i),
      traco: linhaDe(/(?:tra[cç]o|dosagem)\s*[:=]?\s*([^\n\r]{1,100})/i),
      obra: linhaDe(/(?:obra|empreendimento)\s*[:=]?\s*([^\n\r]{2,120})/i),
      localAplicacao: linhaDe(/(?:local(?:\s+de\s+aplica[cç][aã]o)?|pe[cç]a)\s*[:=]?\s*([^\n\r]{2,120})/i),
      laboratorio: linhaDe(/(?:laborat[oó]rio|emitente)\s*[:=]?\s*([^\n\r]{2,120})/i),
      mediaImpressa: numDe(/(?:m[eé]dia(?:\s+aritm[eé]tica)?|resist[eê]ncia\s+m[eé]dia)\s*[:=]?\s*(\d{1,3}(?:[.,]\d+)?)/i),
    };
  }

  // V14 — so aceita a posicao quando a linha e mesmo um CABECALHO de tabela.
  // Antes, qualquer linha de dado iniciada por "CP" virava referencia de coluna
  // e o parser preenchia a identificacao com a idade da linha (false fill).
  var RE_CABECALHO_TABELA = /(idade|resist|mpa|tens[aã]o|carga|nota\s*fiscal|\bnf\b|data|molda|romp)/i;
  function colunaCp(linhas, linhaIndex) {
    for (let i = Math.max(0, linhaIndex - 12); i < linhaIndex; i += 1) {
      const l = linhas[i];
      const m = l.match(/(?:identifica[cç][aã]o\s+(?:do\s+)?c\.?p\.?|corpo\s+de\s+prova|n[ºo°]?\s*(?:do\s+)?c\.?p\.?|\bc\.?p\.?)\b/i);
      if (!m || m.index == null) continue;
      if (!RE_CABECALHO_TABELA.test(l)) continue;
      return m.index;
    }
    return null;
  }

  function cpDaLinha(linha, linhas, linhaIndex) {
    // V14 — o token precisa estar colado no rotulo. "CP        7 dias" capturava
    // a idade como identificacao do corpo de prova.
    const explicito = linha.match(/(?:\bc\.?p\.?|corpo\s+de\s+prova)[.:]?\s{0,3}(?:n[ºo°]?[.:]?)?\s{0,2}([A-Z0-9][A-Z0-9./_-]{0,39})/i);
    if (explicito) return explicito[1];
    const pos = colunaCp(linhas, linhaIndex);
    if (pos == null) return null;
    const tokens = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(linha))) tokens.push({ pos: m.index, valor: m[0].replace(/^[-–—;:()*]+|[-–—;:()*]+$/g, '') });
    // O proprio rotulo da coluna nao e identificacao de corpo de prova.
    const ROTULO_CP = /^(?:c\.?p\.?|corpo|prova|amostra|n[ºo°]?|item)$/i;
    const cands = tokens.filter((x) => Math.abs(x.pos - pos) <= 18
      && /^[A-Z0-9][A-Z0-9./_-]{0,39}$/i.test(x.valor)
      && !ROTULO_CP.test(x.valor));
    cands.sort((a, b) => Math.abs(a.pos - pos) - Math.abs(b.pos - pos));
    return cands.length ? cands[0].valor : null;
  }

  function localizarLinha(paginaTexto, resultado, usados) {
    const linhas = String(paginaTexto || '').split('\n');
    const mpaCandidates = [resultado.mpaBruto, resultado.mpa]
      .filter((v) => Number.isFinite(v))
      .flatMap((v) => {
        const s = String(v);
        return [s, s.replace('.', ','), Number(v).toFixed(1), Number(v).toFixed(1).replace('.', ',')];
      });
    const nf = texto(resultado.nf);
    let melhor = null;
    // V14 — uma linha da tabela pode legitimamente gerar vários resultados (uma
    // coluna por idade). Marcar a linha como "usada" fazia o 2º resultado perder
    // a origem e capturar o CP de outra linha qualquer. Agora a linha inédita só
    // ganha preferência no desempate; a reutilização é permitida.
    linhas.forEach((linha, idx) => {
      let score = 0;
      for (const token of mpaCandidates) {
        if (new RegExp(`(^|\\s)${regexEscape(token)}(?=\\s|$|[;,)])`).test(linha)) score += 6;
      }
      if (nf && linha.includes(nf)) score += 3;
      if (resultado.idade != null && new RegExp(`\\b${resultado.idade}\\s*(?:d|dia|dias|h|hr|hora|horas)?\\b`, 'i').test(linha)) score += 2;
      if (score > 0 && !usados.has(idx)) score += 1;
      if (score > 0 && (!melhor || score > melhor.score)) melhor = { idx, linha, score };
    });
    if (melhor) usados.add(melhor.idx);
    return melhor ? { numero: melhor.idx + 1, texto: melhor.linha, cp: cpDaLinha(melhor.linha, linhas, melhor.idx) } : { numero: null, texto: null, cp: null };
  }

  const NF_MOTIVO = {
    linha: null,
    secao: 'NF lida no cabeçalho da seção.',
    bloco: 'NF única do bloco de resultados.',
    pagina: 'NF única da página, herdada do cabeçalho do laudo.',
    documento: 'NF única do documento, herdada do cabeçalho do laudo.',
  };
  function resultadoV1(resultado, pagina, linhaInfo, contexto, indice, fonte) {
    const nf = texto(resultado.nf);
    const nfOrigem = resultado.nfOrigem || (nf ? 'linha' : 'ausente');
    const cp = linhaInfo.cp;
    const idadeUnidade = resultado.idadeUnidade === 'hora' ? 'hora' : resultado.idadeUnidade === 'dia' ? 'dia' : null;
    return {
      id: `tmp-${pagina}-${String(indice + 1).padStart(3, '0')}`,
      cp: campo(cp, cp),
      nf: { ...campo(nf || null, nf || null, undefined, NF_MOTIVO[nfOrigem]), origem: nf ? nfOrigem : 'ausente' },
      idade: { ...campo(resultado.idade, `${resultado.idade}${idadeUnidade === 'hora' ? ' h' : ' d'}`), unidade: idadeUnidade },
      mpa: { ...campo(resultado.mpa, resultado.mpaBruto == null ? resultado.mpa : resultado.mpaBruto), valorBruto: resultado.mpaBruto == null ? resultado.mpa : resultado.mpaBruto },
      carga: campo(null, null),
      area: campo(null, null),
      dataMoldagem: campo(resultado.dataMoldagem || null, resultado.dataMoldagem || null),
      dataRompimento: campo(resultado.dataRompimento || null, resultado.dataRompimento || null),
      fckProjeto: campo(contexto.fckProjeto, contexto.fckProjeto),
      slump: campo(contexto.slump, contexto.slump),
      traco: campo(contexto.traco, contexto.traco),
      localAplicacao: campo(contexto.localAplicacao, contexto.localAplicacao),
      origem: { pagina, linha: linhaInfo.numero, coluna: null, textoLinha: linhaInfo.texto, fonte },
      confianca: {
        nivel: resultado.confianca || 'media',
        score: resultado.confianca === 'alta' ? 0.82 : resultado.confianca === 'baixa' ? 0.45 : 0.65,
        concordanciaPassadas: false,
        legibilidade: null,
      },
      revisaoHumana: { status: 'pendente', valorAnterior: null, por: null, em: null },
      candidatos: [],
      normalizacoes: Array.isArray(resultado.normalizacoes) ? resultado.normalizacoes : [],
    };
  }

  function parseTabelaExplicitaPagina(textoPagina, pagina, contexto) {
    const linhas = String(textoPagina || '').split('\n');
    const resultados = [];
    for (let h = 0; h < linhas.length; h += 1) {
      const header = linhas[h];
      const low = semAcentos(header);
      if (!/\bidade\b/.test(low) || !/(\bmpa\b|resist|tensao)/.test(low)) continue;
      const mpaPos = Math.max(low.indexOf('resist'), low.indexOf('tensao'), low.indexOf('mpa'));
      const cargaPos = low.indexOf('carga');
      const nfPos = Math.max(low.indexOf('nota fiscal'), low.search(/\bnf\b/));
      const cpPos = Math.max(low.indexOf('corpo de prova'), low.search(/\bcp\b/));
      for (let i = h + 1; i < Math.min(linhas.length, h + 120); i += 1) {
        const linha = linhas[i];
        const linhaLow = semAcentos(linha);
        if (!linha.trim()) continue;
        if (/grafico|evolucao obtida/.test(linhaLow)) break;
        if (/\b(media|medias|desvio|coeficiente|intervalo|fck estimado|caracteristica|incerteza)\b/.test(linhaLow)) continue;
        if (/\bidade\b/.test(linhaLow) && /(\bmpa\b|resist|tensao)/.test(linhaLow)) break;
        const age = linha.match(/\b(\d{1,4})\s*(h|hr|hrs|hs|hora|horas|d|dia|dias)\b/i);
        if (!age) continue;
        const idade = Number(age[1]);
        const unidade = /^h/i.test(age[2]) ? 'hora' : 'dia';
        if (!(idade > 0 && idade <= (unidade === 'hora' ? 720 : 3650))) continue;
        const decimais = [];
        const decRe = /\b\d{1,4}[.,]\d{1,3}\b/g;
        let dm;
        while ((dm = decRe.exec(linha))) {
          const valor = numeroToken(dm[0]);
          if (valor == null || valor <= 0 || valor > 250) continue;
          const dMpa = Math.abs(dm.index - mpaPos);
          const dCarga = cargaPos >= 0 ? Math.abs(dm.index - cargaPos) : Number.POSITIVE_INFINITY;
          if (cargaPos >= 0 && dCarga + 2 < dMpa) continue;
          decimais.push({ valor, raw: dm[0], pos: dm.index, distancia: dMpa });
        }
        if (!decimais.length) continue;
        decimais.sort((a, b) => a.distancia - b.distancia || b.pos - a.pos);
        const mpa = decimais[0];
        const tokenRe = /\S+/g;
        const tokens = [];
        let tm;
        while ((tm = tokenRe.exec(linha))) tokens.push({ raw: tm[0].replace(/^[-–—;:()*]+|[-–—;:()*]+$/g, ''), pos: tm.index });
        const cpCandidates = tokens.filter((t) => t.pos < age.index && /^[A-Z0-9][A-Z0-9./_-]{0,39}$/i.test(t.raw) && t.raw !== age[1]);
        cpCandidates.sort((a, b) => Math.abs(a.pos - Math.max(0, cpPos)) - Math.abs(b.pos - Math.max(0, cpPos)));
        const nfRotulada = linha.match(RE_NF_ROTULO);
        const nfCandidates = nfRotulada && normalizaNf(nfRotulada[1])
          ? [{ raw: normalizaNf(nfRotulada[1]), pos: nfRotulada.index || 0 }]
          : (nfPos >= 0
            ? tokens
              .filter((t) => Math.abs(t.pos - nfPos) <= 24 && nfCandidatoValido(t.raw, linha, t.pos, null) && normalizaNf(t.raw))
              .map((t) => ({ raw: normalizaNf(t.raw), pos: t.pos }))
            : []);
        nfCandidates.sort((a, b) => Math.abs(a.pos - nfPos) - Math.abs(b.pos - nfPos));
        const dates = [...linha.matchAll(/\b\d{2}\/\d{2}\/\d{2,4}\b/g)].map((m) => m[0]);
        resultados.push({
          id: `tmp-${pagina}-fallback-${String(resultados.length + 1).padStart(3, '0')}`,
          cp: campo(cpCandidates[0] ? cpCandidates[0].raw : null, cpCandidates[0] ? cpCandidates[0].raw : null),
          nf: campo(nfCandidates[0] ? nfCandidates[0].raw : null, nfCandidates[0] ? nfCandidates[0].raw : null),
          idade: { ...campo(idade, age[0]), unidade },
          mpa: { ...campo(mpa.valor, mpa.raw), valorBruto: mpa.valor },
          carga: campo(null, null), area: campo(null, null),
          dataMoldagem: campo(dates.length >= 2 ? dates[0] : null, dates.length >= 2 ? dates[0] : null),
          dataRompimento: campo(dates.length >= 2 ? dates[1] : null, dates.length >= 2 ? dates[1] : null),
          fckProjeto: campo(contexto.fckProjeto, contexto.fckProjeto),
          slump: campo(contexto.slump, contexto.slump), traco: campo(contexto.traco, contexto.traco),
          localAplicacao: campo(contexto.localAplicacao, contexto.localAplicacao),
          origem: { pagina, linha: i + 1, coluna: mpa.pos, textoLinha: linha, fonte: 'texto-fallback-explicito' },
          confianca: { nivel: 'media', score: 0.72, concordanciaPassadas: false, legibilidade: null },
          revisaoHumana: { status: 'pendente', valorAnterior: null, por: null, em: null },
          candidatos: [], normalizacoes: [{ code: 'PARSER_FALLBACK_TABELA_EXPLICITA', aplicado: true }],
        });
      }
      if (resultados.length) break;
    }
    return resultados;
  }

  function parsePrismaPagina(textoPagina, pagina, contexto) {
    if (!/PRISMA/i.test(textoPagina) || !/RESIST[ÊE]NCIA\s+[ÀA]\s+COMPRESS[ÃA]O/i.test(textoPagina)) return null;
    const idadeMatch = textoPagina.match(/IDADE(?:\s+DO\s+ENSAIO)?\s*[:\s]+(\d{1,4})\s*(dias?|horas?|hrs?)?/i);
    const idadeValor = idadeMatch ? Number(idadeMatch[1]) : null;
    const idadeUnidade = idadeMatch && idadeMatch[2] ? (/^h/i.test(idadeMatch[2]) ? 'hora' : 'dia') : null;
    const laudo = textoPagina.match(/RELAT[ÓO]RIO\s+DE\s+ENSAIO\s*N[ºo°:\s]+\s*([A-Z0-9.\/-]+)/i);
    const resultados = [];
    const linhas = textoPagina.split('\n');
    for (let i = 0; i < linhas.length; i += 1) {
      const tokens = linhas[i].trim().split(/\s+/);
      if (!/^\d{1,3}$/.test(tokens[0] || '') || tokens.length < 4) continue;
      const decimais = tokens.map((x) => ({ raw: x, n: numeroToken(x) })).filter((x) => x.n != null && /[.,]/.test(x.raw));
      const cand = decimais.filter((x) => x.n > 0 && x.n <= 250).at(-1);
      if (!cand) continue;
      resultados.push({
        id: `tmp-${pagina}-${String(resultados.length + 1).padStart(3, '0')}`,
        cp: campo(tokens[0], tokens[0]),
        nf: campo(null, null),
        idade: idadeValor != null && idadeUnidade ? { ...campo(idadeValor, idadeMatch[0]), unidade: idadeUnidade } : { ...campo(null, idadeMatch && idadeMatch[0], idadeMatch ? 'ilegivel' : 'ausente', idadeMatch ? 'Unidade da idade não identificada.' : 'Idade não localizada.'), unidade: null },
        mpa: { ...campo(cand.n, cand.raw), valorBruto: cand.n },
        carga: campo(null, null), area: campo(null, null),
        dataMoldagem: campo(null, null), dataRompimento: campo(null, null),
        fckProjeto: campo(contexto.fckProjeto, contexto.fckProjeto),
        slump: campo(contexto.slump, contexto.slump), traco: campo(contexto.traco, contexto.traco),
        localAplicacao: campo(contexto.localAplicacao, contexto.localAplicacao),
        origem: { pagina, linha: i + 1, coluna: null, textoLinha: linhas[i], fonte: 'prisma' },
        confianca: { nivel: 'media', score: 0.64, concordanciaPassadas: false, legibilidade: null },
        revisaoHumana: { status: 'pendente', valorAnterior: null, por: null, em: null },
        candidatos: [], normalizacoes: [],
      });
    }
    return resultados.length ? { laudoNum: laudo ? laudo[1] : null, resultados } : null;
  }

  function parseDocumentoTexto(textoCompleto, opcoes) {
    const options = opcoes || {};
    const paginasOriginais = String(textoCompleto || '').split('\f');
    const contexto = extrairContexto(textoCompleto);
    const det = perfis ? perfis.detectar(textoCompleto, options.perfil) : { perfil: { id: options.perfil || 'generico' }, origem: 'fallback', scores: {} };
    const resultados = [];
    const nfs = new Set();
    const cortes = [];
    let laudoNum = null;
    let fonte = 'texto';
    paginasOriginais.forEach((paginaTexto, pageIndex) => {
      const pagina = pageIndex + 1;
      const prep = perfis ? perfis.preprocessarPagina(paginaTexto, det.perfil.id) : { texto: paginaTexto, corte: null };
      if (prep.corte) cortes.push({ pagina, ...prep.corte });
      const prisma = det.perfil.id === 'prisma' ? parsePrismaPagina(prep.texto, pagina, contexto) : null;
      if (prisma) {
        fonte = 'prisma';
        if (!laudoNum) laudoNum = prisma.laudoNum;
        resultados.push(...prisma.resultados);
        return;
      }
      const parsed = legacy.parseLaudoTexto(prep.texto);
      if (!laudoNum && parsed.laudoNum) laudoNum = parsed.laudoNum;
      const usados = new Set();
      parsed.resultados.forEach((r, i) => {
        const linha = localizarLinha(prep.texto, r, usados);
        const novo = resultadoV1(r, pagina, linha, contexto, i, 'texto');
        resultados.push(novo);
        if (novo.nf.valor) nfs.add(novo.nf.valor);
      });
      if (!parsed.resultados.length) {
        const fallback = parseTabelaExplicitaPagina(prep.texto, pagina, contexto);
        fallback.forEach((novo) => {
          resultados.push(novo);
          if (novo.nf.valor) nfs.add(novo.nf.valor);
        });
      }
    });
    // V14 — herança de documento: se o laudo inteiro tem UMA única NF, os resultados
    // que ficaram sem NF recebem essa, com proveniência explícita e sem elevar confiança.
    // Nunca sobrescreve NF lida na linha e nunca adivinha quando há mais de uma.
    const nfsDocumento = new Set(resultados.map((r) => r.nf && r.nf.valor).filter(Boolean));
    if (nfsDocumento.size === 1) {
      const unica = [...nfsDocumento][0];
      for (const r of resultados) {
        if (r.nf && r.nf.valor) continue;
        r.nf = { estado: 'valor', valor: unica, raw: null, motivo: NF_MOTIVO.documento, origem: 'documento' };
        r.normalizacoes = [...(r.normalizacoes || []), { code: 'NF_HERDADA_DO_DOCUMENTO', aplicado: true, valor: unica }];
      }
      nfs.add(unica);
    }
    return {
      metadata: {
        schemaVersion: '1.0.0', pipelineVersion: VERSION,
        promptVersion: null, modelo: null, perfilDetectado: det.perfil.id,
        perfilOrigem: det.origem, perfilScores: det.scores, fonte,
        laudoNum, nfs: [...nfs],
      },
      diagnostico: {
        paginas: paginasOriginais.length, paginasComTexto: paginasOriginais.filter((p) => !parecePaginaEscaneada(p)).length,
        paginasEscaneadas: paginasOriginais.filter(parecePaginaEscaneada).length,
        paginasProcessadasPorIA: 0, paginasIgnoradas: 0, cortesGrafico: cortes,
        legibilidadeMedia: resultados.length ? 0.78 : 0.25,
      },
      customerInput: options.incluirCustomerInput === false ? null : { textoPosicionalPorPagina: paginasOriginais },
      contexto,
      resultados,
      validation: [],
      audit: [{ timestamp: new Date().toISOString(), actor: 'motor', action: 'leitura', entity: 'documento', before: null, after: { resultados: resultados.length }, source: fonte }],
    };
  }

  function parecePaginaEscaneada(textoPosicional) {
    const s = String(textoPosicional || '');
    const chars = s.replace(/[\s\f]/g, '').length;
    const palavras = (s.match(/[A-Za-zÀ-ÿ]{3,}/g) || []).length;
    return chars < 120 || palavras < 12;
  }

  const api = Object.freeze({
    VERSION,
    parseLaudoTexto: legacy.parseLaudoTexto,
    pareceEscaneado: legacy.pareceEscaneado,
    parecePaginaEscaneada,
    parseDocumentoTexto,
    parsePrismaPagina,
    extrairContexto,
  });
  root.LaudoParserCore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
