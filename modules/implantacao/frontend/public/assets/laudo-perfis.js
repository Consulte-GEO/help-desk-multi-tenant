/*
 * laudo-perfis.js · Implantação Consulte GEO · V14
 *
 * Perfis de dialeto de laudo, DECLARATIVOS. Antes da V14 as particularidades de
 * cada emissor viviam como `if` espalhado na página (corte do gráfico da
 * Concrelab, fallback de prisma). Aqui elas viram dados: sinais de detecção,
 * regras de corte e rótulos de coluna. Perfil novo = entrada nova nesta lista,
 * sem tocar no motor.
 *
 * API:
 *   LaudoPerfis.listar()                       -> [{id, rotulo, descricao}]
 *   LaudoPerfis.detectar(texto, override?)     -> {perfil, origem, scores}
 *   LaudoPerfis.preprocessarPagina(txt, id)    -> {texto, corte|null}
 *   LaudoPerfis.rotulosNf(id)                  -> [string]
 *
 * Determinístico, sem DOM, carregável em Node (gate) e no browser.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LaudoPerfis = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 'laudo-perfis-1.0.0';

  /**
   * peso: quanto o sinal vale na detecção. Um nome de emissor vale mais que
   * um título de relatório, que pode aparecer em qualquer laboratório.
   */
  const PERFIS = [
    {
      id: 'generico',
      rotulo: 'Genérico',
      descricao: 'Sem dialeto conhecido. Só as regras comuns a laudos NBR 5739.',
      sinais: [],
      cortes: [],
      rotulosNf: [],
    },
    {
      id: 'polimix',
      rotulo: 'POLIMIX',
      descricao: 'Laudos POLIMIX: tabela por idade em colunas e gráfico de evolução ao final.',
      sinais: [
        { re: /\bpolimix\b/i, peso: 4 },
        { re: /\bpolimix\s+concreto/i, peso: 5 },
        { re: /evolu[çc][ãa]o\s+obtida\s+aos/i, peso: 2 },
      ],
      cortes: [
        { re: /^\s*GR[ÁA]FICO\s*$/i, motivo: 'grafico' },
        { re: /Evolu[çc][ãa]o\s+Obtida\s+aos/i, motivo: 'grafico' },
      ],
      rotulosNf: ['nota fiscal', 'nf'],
    },
    {
      id: 'concrelab',
      rotulo: 'Concrelab',
      descricao: 'Relatório de ensaio de compressão da Concrelab, com gráfico cujo eixo Y vira falso resultado.',
      sinais: [
        { re: /\bconcrelab\b/i, peso: 5 },
        { re: /RELAT[ÓO]RIO\s+DE\s+ENSAIO\s+DE\s+COMPRESS[ÃA]O/i, peso: 2 },
      ],
      cortes: [
        { re: /^\s*GR[ÁA]FICO\s*$/i, motivo: 'grafico' },
        { re: /Evolu[çc][ãa]o\s+Obtida\s+aos/i, motivo: 'grafico' },
      ],
      rotulosNf: ['nota fiscal', 'nf', 'danfe'],
    },
    {
      id: 'prisma',
      rotulo: 'Prisma de bloco (NBR 16868)',
      descricao: 'Ensaio de prisma de alvenaria: tabela CP/dimensões/carga/MPa, sem nota fiscal.',
      sinais: [
        { re: /\bPRISMA\b/i, peso: 3 },
        { re: /RESIST[ÊE]NCIA\s+[ÀA]\s+COMPRESS[ÃA]O/i, peso: 1 },
        { re: /NBR\s*16868/i, peso: 3 },
      ],
      cortes: [],
      rotulosNf: [],
    },
  ];

  const PORID = new Map(PERFIS.map((p) => [p.id, p]));
  const GENERICO = PORID.get('generico');

  function listar() {
    return PERFIS.map((p) => ({ id: p.id, rotulo: p.rotulo, descricao: p.descricao }));
  }

  /**
   * Detecção por soma de pesos. Empate ou zero cai em `generico` — o motor
   * genérico nunca é pior que um perfil errado.
   */
  function detectar(texto, override) {
    const t = String(texto || '');
    if (override && PORID.has(String(override))) {
      return { perfil: PORID.get(String(override)), origem: 'override', scores: {} };
    }
    const scores = {};
    let melhor = null;
    for (const perfil of PERFIS) {
      if (!perfil.sinais.length) continue;
      let score = 0;
      for (const sinal of perfil.sinais) if (sinal.re.test(t)) score += sinal.peso;
      scores[perfil.id] = score;
      if (score > 0 && (!melhor || score > melhor.score)) melhor = { perfil, score };
      else if (melhor && score === melhor.score && score > 0 && perfil.id < melhor.perfil.id) melhor = { perfil, score };
    }
    if (!melhor) return { perfil: GENERICO, origem: 'fallback', scores };
    return { perfil: melhor.perfil, origem: 'deteccao', scores };
  }

  /**
   * Corta a página a partir da primeira linha que casa com uma regra do perfil.
   * Devolve o texto cortado e a marca do corte — nada é descartado em silêncio.
   */
  function preprocessarPagina(textoPagina, perfilId) {
    const perfil = PORID.get(String(perfilId)) || GENERICO;
    const texto = String(textoPagina == null ? '' : textoPagina);
    if (!perfil.cortes.length) return { texto, corte: null };
    const linhas = texto.split('\n');
    for (let i = 0; i < linhas.length; i += 1) {
      for (const regra of perfil.cortes) {
        if (!regra.re.test(linhas[i])) continue;
        return {
          texto: linhas.slice(0, i).join('\n'),
          corte: { linha: i + 1, motivo: regra.motivo, perfil: perfil.id, trecho: linhas[i].trim().slice(0, 80) },
        };
      }
    }
    return { texto, corte: null };
  }

  function rotulosNf(perfilId) {
    const perfil = PORID.get(String(perfilId)) || GENERICO;
    return perfil.rotulosNf.slice();
  }

  return Object.freeze({ VERSION, PERFIS, listar, detectar, preprocessarPagina, rotulosNf });
});
