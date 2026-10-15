/**
 * Exportação técnica em planilha Excel real (.xlsx). · v5.5
 *
 * Redesenho completo:
 *   - 13 abas: cadastro, mapeamento, validações e JSON técnico
 *   - Estilos via writer XLSX local (`src/vendor/xlsxStyleLite.ts`)
 *   - Cabeçalhos com bg navy + texto branco
 *   - Cores semânticas em "Validações" (bloqueante/alerta/sugestão/pendência)
 *   - Larguras de coluna calibradas por aba
 *   - Freeze panes na linha de header
 *   - AutoFilter onde aplicável
 *   - FCK e Volume como números reais (não strings)
 *   - Bug fix: "Estruturas" agora exibe TODAS as estruturas expandidas
 *     (puxa de `technicalMapping.unidadeGrupos`)
 *   - "Mapeamento Banco" reorganizado em 4 sub-tabelas verticais
 *     com headers próprios em vez de 1 tabela de 20 colunas
 *   - "JSON Técnico" em 1 célula de coluna larga (não 6656 linhas)
 *
 * Importação dinâmica para preservar lazy-load (não pesa no bundle inicial).
 */

import type * as XLSXType from '../vendor/xlsxStyleLite';
import type { TechnicalJson } from '../models/technicalMapping.models';
import { parseFck, parseVolume } from './normalizationService';

/* ------------------------------------------------------------------ */
/* Lazy loader                                                         */
/* ------------------------------------------------------------------ */

let xlsxPromise: Promise<typeof XLSXType> | null = null;
async function loadXlsx(): Promise<typeof XLSXType> {
  if (!xlsxPromise) {
    xlsxPromise = import('../vendor/xlsxStyleLite').then((mod) => {
      return mod;
    });
  }
  return xlsxPromise;
}

export async function preloadXlsx(): Promise<void> {
  await loadXlsx();
}

/* ------------------------------------------------------------------ */
/* Estilos reutilizáveis                                               */
/* ------------------------------------------------------------------ */

const COLOR = {
  navy:        '182863',
  navyDeep:    '0E1B40',
  purple:      '3E2D71',
  magenta:     'C5117E',
  cream:       'F7F6F2',
  border:      'D7D0C2',
  text:        '121A36',
  textMuted:   '6D6A62',
  white:       'FFFFFF',
  /* semantic */
  bloqueanteB: 'FFF0EE', bloqueanteT: 'B42318',
  alertaB:     'FFF6DF', alertaT:     'A36500',
  sugestaoB:   'EBF4FF', sugestaoT:   '2368A2',
  pendenciaB:  'F0F4FF', pendenciaT:  '3E2D71',
  okB:         'E8F7EE', okT:         '1F7A4A',
} as const;

const STYLE = {
  /** Linha 1: faixa branding (merged) */
  bannerNavy: {
    fill: { fgColor: { rgb: COLOR.navy } },
    font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: COLOR.white } },
    alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
  },
  bannerMeta: {
    fill: { fgColor: { rgb: COLOR.navyDeep } },
    font: { name: 'Calibri', sz: 9, color: { rgb: COLOR.white }, italic: true },
    alignment: { horizontal: 'right', vertical: 'center', indent: 1 },
  },
  /** Cabeçalho de tabela (header row) */
  tableHeader: {
    fill: { fgColor: { rgb: COLOR.navy } },
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: COLOR.white } },
    alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
    border: {
      top:    { style: 'thin', color: { rgb: COLOR.border } },
      bottom: { style: 'medium', color: { rgb: COLOR.navy } },
      left:   { style: 'thin', color: { rgb: COLOR.border } },
      right:  { style: 'thin', color: { rgb: COLOR.border } },
    },
  },
  /** Título de sub-seção dentro de aba (ex.: 4 tabelas em "Mapeamento Banco") */
  sectionTitle: {
    fill: { fgColor: { rgb: COLOR.magenta } },
    font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: COLOR.white } },
    alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
  },
  /** Linha de dados padrão */
  dataCell: {
    font: { name: 'Calibri', sz: 11, color: { rgb: COLOR.text } },
    alignment: { vertical: 'center', wrapText: true },
    border: {
      bottom: { style: 'thin', color: { rgb: COLOR.border } },
    },
  },
  dataCellRight: {
    font: { name: 'Calibri', sz: 11, color: { rgb: COLOR.text } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: { bottom: { style: 'thin', color: { rgb: COLOR.border } } },
    numFmt: '#,##0.00',
  },
  dataCellInt: {
    font: { name: 'Calibri', sz: 11, color: { rgb: COLOR.text } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: { bottom: { style: 'thin', color: { rgb: COLOR.border } } },
    numFmt: '#,##0',
  },
  /** Label cinza claro (para a aba Resumo) */
  labelCell: {
    fill: { fgColor: { rgb: COLOR.cream } },
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: COLOR.text } },
    alignment: { horizontal: 'left', vertical: 'center', indent: 1 },
    border: { bottom: { style: 'thin', color: { rgb: COLOR.border } } },
  },
  /** Linha de total (footer de tabela) */
  totalRow: {
    fill: { fgColor: { rgb: COLOR.cream } },
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: COLOR.text } },
    alignment: { vertical: 'center' },
    border: {
      top:    { style: 'medium', color: { rgb: COLOR.navy } },
      bottom: { style: 'medium', color: { rgb: COLOR.navy } },
    },
  },
  totalRowRight: {
    fill: { fgColor: { rgb: COLOR.cream } },
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: COLOR.text } },
    alignment: { horizontal: 'right', vertical: 'center' },
    border: {
      top:    { style: 'medium', color: { rgb: COLOR.navy } },
      bottom: { style: 'medium', color: { rgb: COLOR.navy } },
    },
    numFmt: '#,##0.00',
  },
  /** Caixa de aviso/instrução (Instruções, JSON) */
  noteBox: {
    fill: { fgColor: { rgb: COLOR.cream } },
    font: { name: 'Calibri', sz: 11, color: { rgb: COLOR.text } },
    alignment: { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 },
    border: { left: { style: 'thick', color: { rgb: COLOR.magenta } } },
  },
  /** Cell de validação por bucket */
  validBloqueante: {
    fill: { fgColor: { rgb: COLOR.bloqueanteB } },
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: COLOR.bloqueanteT } },
    alignment: { vertical: 'center', wrapText: true },
  },
  validAlerta: {
    fill: { fgColor: { rgb: COLOR.alertaB } },
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: COLOR.alertaT } },
    alignment: { vertical: 'center', wrapText: true },
  },
  validSugestao: {
    fill: { fgColor: { rgb: COLOR.sugestaoB } },
    font: { name: 'Calibri', sz: 11, color: { rgb: COLOR.sugestaoT } },
    alignment: { vertical: 'center', wrapText: true },
  },
  validPendencia: {
    fill: { fgColor: { rgb: COLOR.pendenciaB } },
    font: { name: 'Calibri', sz: 11, color: { rgb: COLOR.pendenciaT } },
    alignment: { vertical: 'center', wrapText: true },
  },
  validOk: {
    fill: { fgColor: { rgb: COLOR.okB } },
    font: { name: 'Calibri', sz: 11, color: { rgb: COLOR.okT } },
    alignment: { vertical: 'center' },
  },
  /** Hint pequeno (tagline, instrução discreta) */
  hint: {
    font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: COLOR.textMuted } },
    alignment: { vertical: 'center' },
  },
} as const;

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

interface Cell {
  v: string | number | boolean | null;
  t?: 's' | 'n' | 'b';
  s?: Record<string, unknown>;
  z?: string;
}

function txt(value: unknown, style?: Record<string, unknown>): Cell {
  const v = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return { v, t: 's', s: style };
}

function num(value: number | null | undefined, style?: Record<string, unknown>): Cell {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return { v: '', t: 's', s: style };
  }
  return { v: value, t: 'n', s: style };
}

function fmtTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    now.getFullYear() +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    '-' +
    pad(now.getHours()) +
    pad(now.getMinutes())
  );
}

function fmtDateTimeBR(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export function buildWorkbookFilename(payload: TechnicalJson): string {
  const codigo = (
    payload.customerInput.dadosBasicos.obraNome ||
    payload.customerInput.dadosBasicos.obraId ||
    'sem-codigo'
  )
    .toString()
    .trim()
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .slice(0, 40);
  return `implantacao-consulte-geo-${codigo}-${fmtTimestamp()}.xlsx`;
}

/* ------------------------------------------------------------------ */
/* Sheet builder helpers                                               */
/* ------------------------------------------------------------------ */

interface SheetBuildContext {
  payload: TechnicalJson;
  XLSX: typeof XLSXType;
}

/** Constrói uma worksheet a partir de matriz de Cell e aplica metadados. */
function writeSheet(
  XLSX: typeof XLSXType,
  rows: Cell[][],
  options: {
    colWidths?: number[];
    freezeRow?: number;
    autofilter?: { startRow: number; endRow: number; cols: number };
    merges?: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>;
  } = {},
): XLSXType.WorkSheet {
  // Converte Cell[][] em formato AOA com objetos de célula
  const aoa: unknown[][] = rows.map((row) => row.map((cell) => ({ ...cell })));
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Aplica metadados
  if (options.colWidths?.length) {
    ws['!cols'] = options.colWidths.map((wch) => ({ wch }));
  }
  if (options.freezeRow != null) {
    (ws as unknown as { '!freeze'?: unknown })['!freeze'] = { ySplit: options.freezeRow };
    ws['!views'] = [{ state: 'frozen', xSplit: 0, ySplit: options.freezeRow, topLeftCell: `A${options.freezeRow + 1}` }];
  }
  if (options.autofilter) {
    const { startRow, endRow, cols } = options.autofilter;
    ws['!autofilter'] = {
      ref: `A${startRow}:${XLSX.utils.encode_col(cols - 1)}${endRow}`,
    };
  }
  if (options.merges?.length) {
    ws['!merges'] = options.merges;
  }
  return ws;
}

/** Cabeçalho de banda (linha 1: navy banner com nome do projeto + obra). */
function bannerRow(payload: TechnicalJson, cols: number): { row: Cell[]; merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> } {
  const obra = payload.customerInput.dadosBasicos.obraNome || '—';
  const cli = payload.customerInput.dadosBasicos.clienteNome;
  const label = `Implantação Consulte GEO · ${obra}${cli ? ' · ' + cli : ''}`;
  const row: Cell[] = [{ v: label, t: 's', s: STYLE.bannerNavy }];
  for (let i = 1; i < cols; i++) row.push({ v: '', t: 's', s: STYLE.bannerNavy });
  return { row, merges: [{ s: { r: 0, c: 0 }, e: { r: 0, c: cols - 1 } }] };
}

function metaRow(payload: TechnicalJson, cols: number): { row: Cell[]; merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> } {
  const meta = `Gerado em ${fmtDateTimeBR(payload.metadata.generatedAt)} · Schema ${payload.metadata.schemaVersion} · Status ${payload.customerInput.dadosBasicos.status}`;
  const row: Cell[] = [{ v: meta, t: 's', s: STYLE.bannerMeta }];
  for (let i = 1; i < cols; i++) row.push({ v: '', t: 's', s: STYLE.bannerMeta });
  return { row, merges: [{ s: { r: 1, c: 0 }, e: { r: 1, c: cols - 1 } }] };
}

/* ================================================================== */
/* ABA 1: Instruções                                                   */
/* ================================================================== */

function buildSheetInstrucoes(ctx: SheetBuildContext): XLSXType.WorkSheet {
  const { XLSX, payload } = ctx;
  const cols = 4;
  const banner = bannerRow(payload, cols);
  const meta = metaRow(payload, cols);
  const merges = [...banner.merges, ...meta.merges];

  const rows: Cell[][] = [
    banner.row,
    meta.row,
    [], // linha em branco
    [{ v: 'Como ler este arquivo', t: 's', s: STYLE.sectionTitle }, txt('', STYLE.sectionTitle), txt('', STYLE.sectionTitle), txt('', STYLE.sectionTitle)],
  ];
  merges.push({ s: { r: 3, c: 0 }, e: { r: 3, c: cols - 1 } });

  const helpText =
    'Esta planilha contém o cadastro simplificado da implantação da estrutura desta obra, ' +
    'gerado pelo cliente em Cadastro Simplificado da Estrutura da Obra (https://setup.consultegeo.org).\n\n' +
    'A equipe Consulte GEO usa as abas seguintes para validar o cadastro e gerar os registros internos no produto Consulte GEO Concreto.\n\n' +
    'ATENÇÃO:\n' +
    '• A aba "Validações" lista pendências, alertas e bloqueios. Resolva-os antes de implantar.\n' +
    '• A aba "Mapeamento Banco" mostra como cada item vira registro nas tabelas Ges_*, Pro_*, etc.\n' +
    '• A aba "JSON Técnico" é a fonte de verdade — não edite manualmente.';
  rows.push([{ v: helpText, t: 's', s: STYLE.noteBox }, txt('', STYLE.noteBox), txt('', STYLE.noteBox), txt('', STYLE.noteBox)]);
  merges.push({ s: { r: 4, c: 0 }, e: { r: 4, c: cols - 1 } });

  rows.push([]);
  rows.push([{ v: 'Conteúdo de cada aba', t: 's', s: STYLE.sectionTitle }, txt('', STYLE.sectionTitle), txt('', STYLE.sectionTitle), txt('', STYLE.sectionTitle)]);
  merges.push({ s: { r: 6, c: 0 }, e: { r: 6, c: cols - 1 } });

  const sheetDocs: Array<[string, string]> = [
    ['Resumo',           'Visão executiva: dados da obra, contagens e status de validação.'],
    ['Estatísticas',     'Agregados — volume total, distribuição por etapa, FCK e top unidades.'],
    ['Estruturas',       'Lista expandida das estruturas (blocos, torres, etc) com projetista.'],
    ['Peças (cadastro)', 'Peças cadastradas pelo cliente, na granularidade do input original.'],
    ['Unidades geradas', 'Expansão completa: cada estrutura × cada peça = uma unidade técnica.'],
    ['Concretos',        'Catálogo de traços cadastrados pelo cliente.'],
    ['Mapeamento Banco', 'Como o cadastro vira registros em Ges_UnidadeGrupo, Ges_UnidadeTipo, Ges_Unidade, Vinculo_Concreto.'],
    ['Validações',       'Bloqueantes (vermelho), alertas (amarelo), sugestões (azul), pendências internas (roxo).'],
    ['JSON Técnico',     'Fonte de verdade. Idêntica ao JSON que o frontend envia para a API .NET.'],
  ];
  rows.push([
    { v: 'Aba', t: 's', s: STYLE.tableHeader },
    { v: 'Conteúdo', t: 's', s: STYLE.tableHeader },
    txt('', STYLE.tableHeader),
    txt('', STYLE.tableHeader),
  ]);
  sheetDocs.forEach(([aba, desc], i) => {
    rows.push([
      { v: aba, t: 's', s: STYLE.labelCell },
      { v: desc, t: 's', s: STYLE.dataCell },
      txt('', STYLE.dataCell),
      txt('', STYLE.dataCell),
    ]);
    merges.push({ s: { r: 8 + i, c: 1 }, e: { r: 8 + i, c: cols - 1 } });
  });

  rows.push([]);
  const glossR = rows.length;
  rows.push([{ v: 'Glossário rápido', t: 's', s: STYLE.sectionTitle }, txt('', STYLE.sectionTitle), txt('', STYLE.sectionTitle), txt('', STYLE.sectionTitle)]);
  merges.push({ s: { r: glossR, c: 0 }, e: { r: glossR, c: cols - 1 } });

  const glossary: Array<[string, string]> = [
    ['FCK',          'Resistência característica do concreto à compressão (MPa). Aceita 10–100.'],
    ['Volume',       'Volume previsto por unidade, em m³. Pode ser "—" se não aplicável.'],
    ['Estrutura',    'Bloco, torre, contenção, área externa, anexo ou apoio.'],
    ['Grupo',        'Conjunto de estruturas idênticas (mesmas peças, mesmos FCKs).'],
    ['Peça',         'Elemento estrutural concretado (sapata, pavimento, cortina, etc).'],
    ['Etapa',        'Fundação, Infraestrutura, Contenção, Anexos, Estrutura.'],
    ['Unidade',      'Cada estrutura concretada individualmente (Bloco 1, Bloco 2, ...).'],
    ['UnidadeTipo',  'Padrão técnico deduplicado (ex.: "Radier FCK 25 170m³").'],
    ['Protocolo',    'Código único do envio para validação (CGE-{ano}-{hash}).'],
  ];
  rows.push([
    { v: 'Termo', t: 's', s: STYLE.tableHeader },
    { v: 'Significado', t: 's', s: STYLE.tableHeader },
    txt('', STYLE.tableHeader),
    txt('', STYLE.tableHeader),
  ]);
  const glossHeaderR = rows.length - 1;
  glossary.forEach(([k, v], i) => {
    rows.push([
      { v: k, t: 's', s: STYLE.labelCell },
      { v: v, t: 's', s: STYLE.dataCell },
      txt('', STYLE.dataCell),
      txt('', STYLE.dataCell),
    ]);
    merges.push({ s: { r: glossHeaderR + 1 + i, c: 1 }, e: { r: glossHeaderR + 1 + i, c: cols - 1 } });
  });

  rows.push([]);
  rows.push([
    { v: 'Em caso de dúvidas, contate a equipe Consulte GEO.', t: 's', s: STYLE.hint },
  ]);

  return writeSheet(XLSX, rows, {
    colWidths: [22, 34, 22, 22],
    merges,
  });
}

/* ================================================================== */
/* ABA 2: Resumo                                                       */
/* ================================================================== */

function buildSheetResumo(ctx: SheetBuildContext): XLSXType.WorkSheet {
  const { XLSX, payload } = ctx;
  const cols = 3;
  const obra = payload.customerInput.dadosBasicos;
  const mapping = payload.technicalMapping;
  const summary = payload.validation.summary;

  const banner = bannerRow(payload, cols);
  const meta = metaRow(payload, cols);
  const merges = [...banner.merges, ...meta.merges];
  const rows: Cell[][] = [banner.row, meta.row, []];

  const addSection = (title: string) => {
    rows.push([{ v: title, t: 's', s: STYLE.sectionTitle }, txt('', STYLE.sectionTitle), txt('', STYLE.sectionTitle)]);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: cols - 1 } });
  };
  const addRow = (label: string, value: unknown) => {
    rows.push([
      { v: label, t: 's', s: STYLE.labelCell },
      typeof value === 'number'
        ? { v: value, t: 'n', s: STYLE.dataCellInt }
        : { v: String(value ?? ''), t: 's', s: STYLE.dataCell },
      txt('', STYLE.dataCell),
    ]);
    merges.push({ s: { r: rows.length - 1, c: 1 }, e: { r: rows.length - 1, c: cols - 1 } });
  };

  addSection('Identificação da obra');
  addRow('Nome da obra',          obra.obraNome || '—');
  addRow('Cliente / construtora', obra.clienteNome || '—');
  addRow('Endereço',              obra.obraEndereco || '—');
  addRow('CEP',                   obra.obraCEP || '—');
  addRow('Responsável',           obra.createdBy.nome || '—');
  addRow('E-mail',                obra.createdBy.email || '—');
  addRow('Status',                obra.status);
  addRow('Protocolo de envio',    obra.protocoloEnvio || 'Ainda não enviado');
  addRow('Modelo de preenchimento', obra.modeloPreenchimento);
  addRow('Tipo de estrutura',     payload.customerInput.tipoEstrutura);

  rows.push([]);
  addSection('Volumetria cadastrada');

  // Calcula volumes
  let volumeTotal = 0;
  let unidadesComVolume = 0;
  const volPorEtapa: Record<string, number> = {};
  const volPorFck: Record<string, number> = {};
  payload.customerInput.grupos.forEach((g) => {
    const expanded = mapping.unidadeGrupos.filter((ug) => ug.customerInputRef === g.id).length || 1;
    g.pecas.forEach((p) => {
      const v = parseVolume(p.volume);
      const fck = parseFck(p.fck);
      if (v != null) {
        const total = v * expanded;
        volumeTotal += total;
        unidadesComVolume++;
        const etapa = String(p.etapa);
        volPorEtapa[etapa] = (volPorEtapa[etapa] || 0) + total;
        if (fck) {
          const key = `FCK ${fck}`;
          volPorFck[key] = (volPorFck[key] || 0) + total;
        }
      }
    });
  });

  addRow('Estruturas (expandidas)',  mapping.unidadeGrupos.length);
  addRow('Padrões estruturais (tipos)', mapping.unidadeTipos.length);
  addRow('Unidades técnicas geradas', mapping.unidades.length);
  addRow('Peças cadastradas (input)', payload.customerInput.grupos.reduce((acc, g) => acc + g.pecas.length, 0));
  addRow('Concretos cadastrados', payload.customerInput.concretos.length);

  // Volume total em uma linha destacada
  rows.push([
    { v: 'Volume total previsto (m³)', t: 's', s: STYLE.totalRow },
    { v: volumeTotal, t: 'n', s: STYLE.totalRowRight },
    txt('', STYLE.totalRow),
  ]);
  merges.push({ s: { r: rows.length - 1, c: 1 }, e: { r: rows.length - 1, c: cols - 1 } });

  rows.push([]);
  addSection('Validação do envio');
  addRow('Bloqueantes (erros)', summary.errorCount);
  addRow('Alertas (warning)', summary.warningCount);
  addRow('Sugestões (info)', summary.infoCount);
  addRow('Pendências internas (revisão Consulte GEO)', summary.pendingCount);
  addRow('Envio bloqueado?', summary.blocking ? 'SIM — corrigir bloqueantes' : 'Não');

  return writeSheet(XLSX, rows, {
    colWidths: [38, 28, 12],
    merges,
  });
}

/* ================================================================== */
/* ABA 3: Estatísticas                                                 */
/* ================================================================== */

function buildSheetEstatisticas(ctx: SheetBuildContext): XLSXType.WorkSheet {
  const { XLSX, payload } = ctx;
  const cols = 4;
  const mapping = payload.technicalMapping;

  const banner = bannerRow(payload, cols);
  const meta = metaRow(payload, cols);
  const merges = [...banner.merges, ...meta.merges];
  const rows: Cell[][] = [banner.row, meta.row, []];

  const addSection = (title: string) => {
    rows.push([{ v: title, t: 's', s: STYLE.sectionTitle }, ...new Array(cols - 1).fill(0).map(() => txt('', STYLE.sectionTitle))]);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: cols - 1 } });
  };

  // Calcula agregados a partir das unidades + tipos
  const volPorEtapa: Record<string, { vol: number; cnt: number }> = {};
  const volPorFck: Record<string, { vol: number; cnt: number }> = {};
  const volPorGrupo: Record<string, { vol: number; cnt: number; nome: string }> = {};
  const etapasIdToNome: Record<number, string> = {
    1: 'Fundação', 2: 'Infraestrutura', 3: 'Estrutura',
    4: 'Contenção', 5: 'Anexos', 6: 'Estrutura',
  };

  mapping.unidades.forEach((u) => {
    const tipo = mapping.unidadeTipos.find((t) => t.tempId === u.unidadeTipoTempId);
    const grupo = mapping.unidadeGrupos.find((g) => g.tempId === u.unidadeGrupoTempId);
    if (!tipo) return;
    const v = tipo.volumeProjeto ?? 0;
    const etapa = etapasIdToNome[tipo.classificacaoId] || 'Estrutura';
    volPorEtapa[etapa] ||= { vol: 0, cnt: 0 };
    volPorEtapa[etapa].vol += v;
    volPorEtapa[etapa].cnt += 1;
    if (tipo.fckProjeto) {
      const k = `FCK ${tipo.fckProjeto}`;
      volPorFck[k] ||= { vol: 0, cnt: 0 };
      volPorFck[k].vol += v;
      volPorFck[k].cnt += 1;
    }
    if (grupo) {
      volPorGrupo[grupo.tempId] ||= { vol: 0, cnt: 0, nome: grupo.nome };
      volPorGrupo[grupo.tempId].vol += v;
      volPorGrupo[grupo.tempId].cnt += 1;
    }
  });

  // --- Volume por etapa ---
  addSection('Volume por etapa construtiva');
  rows.push([
    { v: 'Etapa', t: 's', s: STYLE.tableHeader },
    { v: 'Unidades', t: 's', s: STYLE.tableHeader },
    { v: 'Volume total (m³)', t: 's', s: STYLE.tableHeader },
    { v: 'Volume médio (m³/un)', t: 's', s: STYLE.tableHeader },
  ]);
  const etapasOrder = ['Fundação', 'Infraestrutura', 'Estrutura', 'Contenção', 'Anexos'];
  let totalEtapa = 0, cntEtapa = 0;
  etapasOrder.forEach((e) => {
    if (!volPorEtapa[e]) return;
    const { vol, cnt } = volPorEtapa[e];
    totalEtapa += vol; cntEtapa += cnt;
    rows.push([
      { v: e, t: 's', s: STYLE.dataCell },
      { v: cnt, t: 'n', s: STYLE.dataCellInt },
      { v: vol, t: 'n', s: STYLE.dataCellRight },
      { v: cnt > 0 ? vol / cnt : 0, t: 'n', s: STYLE.dataCellRight },
    ]);
  });
  rows.push([
    { v: 'Total', t: 's', s: STYLE.totalRow },
    { v: cntEtapa, t: 'n', s: { ...STYLE.totalRowRight, numFmt: '#,##0' } },
    { v: totalEtapa, t: 'n', s: STYLE.totalRowRight },
    { v: cntEtapa > 0 ? totalEtapa / cntEtapa : 0, t: 'n', s: STYLE.totalRowRight },
  ]);

  rows.push([]);

  // --- Volume por FCK ---
  addSection('Volume por classe de resistência (FCK)');
  rows.push([
    { v: 'Classe', t: 's', s: STYLE.tableHeader },
    { v: 'Unidades', t: 's', s: STYLE.tableHeader },
    { v: 'Volume total (m³)', t: 's', s: STYLE.tableHeader },
    { v: '% do total', t: 's', s: STYLE.tableHeader },
  ]);
  const fckKeys = Object.keys(volPorFck).sort((a, b) => {
    const na = Number(a.replace(/[^0-9]/g, ''));
    const nb = Number(b.replace(/[^0-9]/g, ''));
    return na - nb;
  });
  let totalFck = 0;
  fckKeys.forEach((k) => totalFck += volPorFck[k].vol);
  fckKeys.forEach((k) => {
    const { vol, cnt } = volPorFck[k];
    rows.push([
      { v: k, t: 's', s: STYLE.dataCell },
      { v: cnt, t: 'n', s: STYLE.dataCellInt },
      { v: vol, t: 'n', s: STYLE.dataCellRight },
      { v: totalFck > 0 ? vol / totalFck : 0, t: 'n', s: { ...STYLE.dataCellRight, numFmt: '0.0%' } },
    ]);
  });

  rows.push([]);

  // --- Top grupos por volume ---
  addSection('Estruturas por volume previsto');
  rows.push([
    { v: 'Estrutura', t: 's', s: STYLE.tableHeader },
    { v: 'Unidades técnicas', t: 's', s: STYLE.tableHeader },
    { v: 'Volume total (m³)', t: 's', s: STYLE.tableHeader },
    { v: 'Volume médio (m³/un)', t: 's', s: STYLE.tableHeader },
  ]);
  const gruposSorted = Object.values(volPorGrupo).sort((a, b) => b.vol - a.vol);
  // Limita aos top 15 para não inflar; se houver mais, mostra contagem
  gruposSorted.slice(0, 15).forEach((g) => {
    rows.push([
      { v: g.nome, t: 's', s: STYLE.dataCell },
      { v: g.cnt, t: 'n', s: STYLE.dataCellInt },
      { v: g.vol, t: 'n', s: STYLE.dataCellRight },
      { v: g.cnt > 0 ? g.vol / g.cnt : 0, t: 'n', s: STYLE.dataCellRight },
    ]);
  });
  if (gruposSorted.length > 15) {
    rows.push([
      { v: `... e mais ${gruposSorted.length - 15} estruturas. Ver aba "Estruturas".`, t: 's', s: STYLE.hint },
      txt('', STYLE.hint), txt('', STYLE.hint), txt('', STYLE.hint),
    ]);
  }

  return writeSheet(XLSX, rows, {
    colWidths: [28, 16, 22, 22],
    merges,
  });
}

/* ================================================================== */
/* ABA 4: Estruturas                                                   */
/* ================================================================== */

function buildSheetEstruturas(ctx: SheetBuildContext): XLSXType.WorkSheet {
  const { XLSX, payload } = ctx;
  const cols = 6;
  const banner = bannerRow(payload, cols);
  const meta = metaRow(payload, cols);
  const merges = [...banner.merges, ...meta.merges];
  const rows: Cell[][] = [banner.row, meta.row, []];

  // BUG FIX v5.5: usar mapping.unidadeGrupos (já expandido) em vez de
  // customerInput.grupos[].edificacoesExpanded (que ficava vazio porque
  // a expansão era only-in-runtime).
  rows.push([
    { v: 'Ordem', t: 's', s: STYLE.tableHeader },
    { v: 'Nome da estrutura', t: 's', s: STYLE.tableHeader },
    { v: 'Tipo', t: 's', s: STYLE.tableHeader },
    { v: 'Projetista', t: 's', s: STYLE.tableHeader },
    { v: 'Grupo de origem', t: 's', s: STYLE.tableHeader },
    { v: 'TempId (referência técnica)', t: 's', s: STYLE.tableHeader },
  ]);
  const headerRow = rows.length;

  payload.technicalMapping.unidadeGrupos.forEach((g) => {
    const grupoOrigem = payload.customerInput.grupos.find((cg) => cg.id === g.customerInputRef);
    rows.push([
      { v: g.ordem, t: 'n', s: STYLE.dataCellInt },
      { v: g.nome, t: 's', s: STYLE.dataCell },
      { v: g.tipoEdificacao, t: 's', s: STYLE.dataCell },
      { v: g.projetista || '—', t: 's', s: STYLE.dataCell },
      { v: grupoOrigem?.nome || '—', t: 's', s: STYLE.dataCell },
      { v: g.tempId, t: 's', s: { ...STYLE.dataCell, font: { ...STYLE.dataCell.font, sz: 9, color: { rgb: COLOR.textMuted } } } },
    ]);
  });

  const totalRow = rows.length + 1;
  rows.push([
    { v: 'Total de estruturas', t: 's', s: STYLE.totalRow },
    { v: payload.technicalMapping.unidadeGrupos.length, t: 'n', s: { ...STYLE.totalRowRight, numFmt: '#,##0' } },
    txt('', STYLE.totalRow), txt('', STYLE.totalRow), txt('', STYLE.totalRow), txt('', STYLE.totalRow),
  ]);
  merges.push({ s: { r: totalRow - 1, c: 0 }, e: { r: totalRow - 1, c: 1 } });

  return writeSheet(XLSX, rows, {
    colWidths: [8, 28, 16, 28, 22, 30],
    freezeRow: headerRow,
    autofilter: { startRow: headerRow, endRow: rows.length - 1, cols },
    merges,
  });
}

/* ================================================================== */
/* ABA 5: Peças (cadastro do cliente)                                  */
/* ================================================================== */

function buildSheetPecas(ctx: SheetBuildContext): XLSXType.WorkSheet {
  const { XLSX, payload } = ctx;
  const cols = 9;
  const banner = bannerRow(payload, cols);
  const meta = metaRow(payload, cols);
  const merges = [...banner.merges, ...meta.merges];
  const rows: Cell[][] = [banner.row, meta.row, []];

  rows.push([
    { v: 'Grupo', t: 's', s: STYLE.tableHeader },
    { v: 'Peça / Pavimento', t: 's', s: STYLE.tableHeader },
    { v: 'Etapa', t: 's', s: STYLE.tableHeader },
    { v: 'FCK (MPa)', t: 's', s: STYLE.tableHeader },
    { v: 'Volume por unidade (m³)', t: 's', s: STYLE.tableHeader },
    { v: 'Estruturas no grupo', t: 's', s: STYLE.tableHeader },
    { v: 'Volume total no grupo (m³)', t: 's', s: STYLE.tableHeader },
    { v: 'Concreto', t: 's', s: STYLE.tableHeader },
    { v: 'Observações', t: 's', s: STYLE.tableHeader },
  ]);
  const headerRow = rows.length;

  let totalGrupoVolume = 0;
  payload.customerInput.grupos.forEach((g) => {
    const qtdEstruturas = payload.technicalMapping.unidadeGrupos.filter((ug) => ug.customerInputRef === g.id).length || 1;
    g.pecas.forEach((p) => {
      const fckN = parseFck(p.fck);
      const volN = parseVolume(p.volume);
      const volTotal = volN != null ? volN * qtdEstruturas : null;
      if (volTotal != null) totalGrupoVolume += volTotal;
      const concretoNome = p.concretoId
        ? payload.customerInput.concretos.find((c) => c.id === p.concretoId)?.descricao || `[${p.concretoId}]`
        : '—';
      rows.push([
        { v: g.nome || '—', t: 's', s: STYLE.dataCell },
        { v: p.local || '—', t: 's', s: STYLE.dataCell },
        { v: String(p.etapa), t: 's', s: STYLE.dataCell },
        fckN != null ? { v: fckN, t: 'n', s: STYLE.dataCellInt } : txt(String(p.fck || '—'), STYLE.dataCell),
        volN != null ? { v: volN, t: 'n', s: STYLE.dataCellRight } : txt(String(p.volume || '—'), STYLE.dataCell),
        { v: qtdEstruturas, t: 'n', s: STYLE.dataCellInt },
        volTotal != null ? { v: volTotal, t: 'n', s: STYLE.dataCellRight } : txt('—', STYLE.dataCell),
        { v: concretoNome, t: 's', s: STYLE.dataCell },
        { v: p.observacoes || '', t: 's', s: STYLE.dataCell },
      ]);
    });
  });

  rows.push([
    { v: 'Volume total previsto (m³)', t: 's', s: STYLE.totalRow },
    txt('', STYLE.totalRow), txt('', STYLE.totalRow), txt('', STYLE.totalRow), txt('', STYLE.totalRow), txt('', STYLE.totalRow),
    { v: totalGrupoVolume, t: 'n', s: STYLE.totalRowRight },
    txt('', STYLE.totalRow), txt('', STYLE.totalRow),
  ]);
  merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 5 } });

  return writeSheet(XLSX, rows, {
    colWidths: [22, 30, 16, 11, 14, 13, 18, 32, 30],
    freezeRow: headerRow,
    autofilter: { startRow: headerRow, endRow: rows.length - 1, cols },
    merges,
  });
}

/* ================================================================== */
/* ABA 6: Unidades geradas                                             */
/* ================================================================== */

function buildSheetUnidades(ctx: SheetBuildContext): XLSXType.WorkSheet {
  const { XLSX, payload } = ctx;
  const cols = 7;
  const banner = bannerRow(payload, cols);
  const meta = metaRow(payload, cols);
  const merges = [...banner.merges, ...meta.merges];
  const rows: Cell[][] = [banner.row, meta.row, []];

  rows.push([
    { v: 'Estrutura', t: 's', s: STYLE.tableHeader },
    { v: 'Peça', t: 's', s: STYLE.tableHeader },
    { v: 'Etapa', t: 's', s: STYLE.tableHeader },
    { v: 'FCK (MPa)', t: 's', s: STYLE.tableHeader },
    { v: 'Volume (m³)', t: 's', s: STYLE.tableHeader },
    { v: 'Concreto vinculado', t: 's', s: STYLE.tableHeader },
    { v: 'Padrão técnico (UnidadeTipo)', t: 's', s: STYLE.tableHeader },
  ]);
  const headerRow = rows.length;
  const etapasMap: Record<number, string> = {
    1: 'Fundação', 2: 'Infraestrutura', 3: 'Estrutura',
    4: 'Contenção', 5: 'Anexos', 6: 'Estrutura',
  };

  let totalVol = 0;
  payload.technicalMapping.unidades.forEach((u) => {
    const grupo = payload.technicalMapping.unidadeGrupos.find((g) => g.tempId === u.unidadeGrupoTempId);
    const tipo = payload.technicalMapping.unidadeTipos.find((t) => t.tempId === u.unidadeTipoTempId);
    const concreto = tipo?.concretoId
      ? payload.customerInput.concretos[Number(tipo.concretoId) - 1]?.descricao || `[ID ${tipo.concretoId}]`
      : '—';
    if (tipo?.volumeProjeto) totalVol += tipo.volumeProjeto;
    rows.push([
      { v: grupo?.nome || '—', t: 's', s: STYLE.dataCell },
      { v: u.descricao, t: 's', s: STYLE.dataCell },
      { v: tipo ? (etapasMap[tipo.classificacaoId] || 'Estrutura') : '—', t: 's', s: STYLE.dataCell },
      tipo?.fckProjeto != null ? { v: tipo.fckProjeto, t: 'n', s: STYLE.dataCellInt } : txt('—', STYLE.dataCell),
      tipo?.volumeProjeto != null ? { v: tipo.volumeProjeto, t: 'n', s: STYLE.dataCellRight } : txt('—', STYLE.dataCell),
      { v: concreto, t: 's', s: STYLE.dataCell },
      { v: tipo?.descricao || '—', t: 's', s: STYLE.dataCell },
    ]);
  });

  rows.push([
    { v: 'Total', t: 's', s: STYLE.totalRow },
    { v: `${payload.technicalMapping.unidades.length} unidades`, t: 's', s: STYLE.totalRow },
    txt('', STYLE.totalRow),
    txt('', STYLE.totalRow),
    { v: totalVol, t: 'n', s: STYLE.totalRowRight },
    txt('', STYLE.totalRow),
    txt('', STYLE.totalRow),
  ]);

  return writeSheet(XLSX, rows, {
    colWidths: [22, 28, 16, 11, 13, 32, 28],
    freezeRow: headerRow,
    autofilter: { startRow: headerRow, endRow: rows.length - 1, cols },
    merges,
  });
}

/* ================================================================== */
/* ABA 7: Concretos                                                    */
/* ================================================================== */

function buildSheetConcretos(ctx: SheetBuildContext): XLSXType.WorkSheet {
  const { XLSX, payload } = ctx;
  const cols = 5;
  const banner = bannerRow(payload, cols);
  const meta = metaRow(payload, cols);
  const merges = [...banner.merges, ...meta.merges];
  const rows: Cell[][] = [banner.row, meta.row, []];

  rows.push([
    { v: 'ID', t: 's', s: STYLE.tableHeader },
    { v: 'Descrição do traço', t: 's', s: STYLE.tableHeader },
    { v: 'Aplicação', t: 's', s: STYLE.tableHeader },
    { v: 'FCK (MPa)', t: 's', s: STYLE.tableHeader },
    { v: 'Padrão de moldagem', t: 's', s: STYLE.tableHeader },
  ]);
  const headerRow = rows.length;

  payload.customerInput.concretos.forEach((c) => {
    const fckN = parseFck(c.fck);
    rows.push([
      { v: c.id, t: 's', s: { ...STYLE.dataCell, font: { ...STYLE.dataCell.font, sz: 9, color: { rgb: COLOR.textMuted } } } },
      { v: c.descricao || '—', t: 's', s: STYLE.dataCell },
      { v: c.aplicacao || '—', t: 's', s: STYLE.dataCell },
      fckN != null ? { v: fckN, t: 'n', s: STYLE.dataCellInt } : txt(String(c.fck || '—'), STYLE.dataCell),
      { v: c.moldagem || '—', t: 's', s: STYLE.dataCell },
    ]);
  });

  rows.push([
    { v: 'Total', t: 's', s: STYLE.totalRow },
    { v: `${payload.customerInput.concretos.length} traços cadastrados`, t: 's', s: STYLE.totalRow },
    txt('', STYLE.totalRow), txt('', STYLE.totalRow), txt('', STYLE.totalRow),
  ]);
  merges.push({ s: { r: rows.length - 1, c: 1 }, e: { r: rows.length - 1, c: 4 } });

  return writeSheet(XLSX, rows, {
    colWidths: [22, 38, 28, 11, 38],
    freezeRow: headerRow,
    merges,
  });
}

/* ================================================================== */
/* ABA 8: Padrões de Moldagem (filhos de Concreto · CTe_PadraoMoldagem) */
/* ================================================================== */

function buildSheetPadroesMoldagem(ctx: SheetBuildContext): XLSXType.WorkSheet {
  const { XLSX, payload } = ctx;
  const cols = 8;
  const banner = bannerRow(payload, cols);
  const meta = metaRow(payload, cols);
  const merges = [...banner.merges, ...meta.merges];
  const rows: Cell[][] = [banner.row, meta.row, []];

  rows.push([
    { v: 'Concreto', t: 's', s: STYLE.tableHeader },
    { v: 'Idade', t: 's', s: STYLE.tableHeader },
    { v: 'Unidade', t: 's', s: STYLE.tableHeader },
    { v: 'Tipo de Ensaio', t: 's', s: STYLE.tableHeader },
    { v: 'Valor Esperado', t: 's', s: STYLE.tableHeader },
    { v: 'Crescimento %', t: 's', s: STYLE.tableHeader },
    { v: 'Qtd CPs', t: 's', s: STYLE.tableHeader },
    { v: 'FCK do concreto (MPa)', t: 's', s: STYLE.tableHeader },
  ]);
  const headerRow = rows.length;

  const tipoEnsaioLabel: Record<string, string> = {
    compressao: 'Resistência a Compressão',
    elasticidade: 'Módulo Elasticidade',
    tracao_flexao: 'Resistência a Tração na Flexão',
  };
  const unidadeLabel: Record<string, string> = {
    dias: 'Dias',
    horas: 'Horas',
  };

  let totalLinhas = 0;
  let totalCps = 0;
  payload.customerInput.concretos.forEach((c) => {
    const fckNum = Number(String(c.fck || '').replace(/[^\d]/g, '')) || null;
    if (!c.padroesMoldagem || c.padroesMoldagem.length === 0) {
      rows.push([
        { v: c.descricao || '—', t: 's', s: STYLE.dataCell },
        { v: '—', t: 's', s: STYLE.dataCell },
        { v: '—', t: 's', s: STYLE.dataCell },
        { v: 'Sem padrões cadastrados', t: 's', s: STYLE.dataCell },
        { v: '—', t: 's', s: STYLE.dataCell },
        { v: '—', t: 's', s: STYLE.dataCell },
        { v: '—', t: 's', s: STYLE.dataCell },
        fckNum != null ? { v: fckNum, t: 'n', s: STYLE.dataCellInt } : txt('—', STYLE.dataCell),
      ]);
      return;
    }
    c.padroesMoldagem.forEach((pm) => {
      const idadeN = typeof pm.idadeControle === 'number' ? pm.idadeControle : Number(pm.idadeControle) || null;
      const valorN = typeof pm.valorEsperado === 'number' ? pm.valorEsperado : Number(pm.valorEsperado) || null;
      const qtdN = typeof pm.quantidadeCp === 'number' ? pm.quantidadeCp : Number(pm.quantidadeCp) || null;
      totalLinhas += 1;
      if (qtdN) totalCps += qtdN;
      rows.push([
        { v: c.descricao || '—', t: 's', s: STYLE.dataCell },
        idadeN != null ? { v: idadeN, t: 'n', s: STYLE.dataCellInt } : txt('—', STYLE.dataCell),
        { v: unidadeLabel[pm.unidadeIdade] || pm.unidadeIdade || '—', t: 's', s: STYLE.dataCell },
        { v: tipoEnsaioLabel[pm.tipoEnsaio] || pm.tipoEnsaio || '—', t: 's', s: STYLE.dataCell },
        valorN != null ? { v: valorN, t: 'n', s: STYLE.dataCellRight } : txt('—', STYLE.dataCell),
        { v: pm.crescimentoPct, t: 'n', s: { ...STYLE.dataCellInt, numFmt: '0"%"' } },
        qtdN != null ? { v: qtdN, t: 'n', s: STYLE.dataCellInt } : txt('—', STYLE.dataCell),
        fckNum != null ? { v: fckNum, t: 'n', s: STYLE.dataCellInt } : txt('—', STYLE.dataCell),
      ]);
    });
  });

  rows.push([
    { v: 'Total', t: 's', s: STYLE.totalRow },
    txt('', STYLE.totalRow), txt('', STYLE.totalRow),
    { v: `${totalLinhas} linha(s)`, t: 's', s: STYLE.totalRow },
    txt('', STYLE.totalRow), txt('', STYLE.totalRow),
    { v: totalCps, t: 'n', s: { ...STYLE.totalRowRight, numFmt: '#,##0' } },
    txt('', STYLE.totalRow),
  ]);
  merges.push({ s: { r: rows.length - 1, c: 1 }, e: { r: rows.length - 1, c: 2 } });
  merges.push({ s: { r: rows.length - 1, c: 4 }, e: { r: rows.length - 1, c: 5 } });

  return writeSheet(XLSX, rows, {
    colWidths: [38, 10, 12, 32, 16, 14, 12, 18],
    freezeRow: headerRow,
    autofilter: { startRow: headerRow, endRow: rows.length - 1, cols },
    merges,
  });
}

/* ================================================================== */
/* v5.22.8 — ABA: Usuários da obra                                    */
/* (cadastro feito pelo cliente na Etapa 6; cada perfil tem semântica  */
/*  específica no Consulte GEO Concreto)                               */
/* ================================================================== */

function buildSheetUsuariosObra(ctx: SheetBuildContext): XLSXType.WorkSheet {
  const { XLSX, payload } = ctx;
  const cols = 6;
  const banner = bannerRow(payload, cols);
  const meta = metaRow(payload, cols);
  const merges = [...banner.merges, ...meta.merges];
  const rows: Cell[][] = [banner.row, meta.row, []];

  rows.push([
    { v: 'Nome', t: 's', s: STYLE.tableHeader },
    { v: 'E-mail', t: 's', s: STYLE.tableHeader },
    { v: 'Cargo', t: 's', s: STYLE.tableHeader },
    { v: 'Telefone', t: 's', s: STYLE.tableHeader },
    { v: 'Perfil de acesso', t: 's', s: STYLE.tableHeader },
    { v: 'Observações', t: 's', s: STYLE.tableHeader },
  ]);
  const headerRow = rows.length;

  const perfisInfo: Record<string, { label: string }> = {
    operador_campo: { label: 'Operador de Campo' },
    engenheiro: { label: 'Engenheiro' },
    qualidade: { label: 'Qualidade' },
    laboratorio: { label: 'Laboratório' },
    analista_gestor: { label: 'Analista / Gestor' },
  };

  const usuarios = ((payload.customerInput as unknown) as Record<string, unknown>).usuariosObra as
    | Array<{ nome: string; email: string; cargo: string; telefone: string; perfil: string; observacoes: string }>
    | undefined;

  if (!usuarios || usuarios.length === 0) {
    rows.push([
      { v: '(Nenhum usuário cadastrado)', t: 's', s: { ...STYLE.dataCell, font: { ...STYLE.dataCell.font, italic: true, color: { rgb: COLOR.textMuted } } } },
      txt(''), txt(''), txt(''), txt(''), txt(''),
    ]);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: cols - 1 } });
  } else {
    usuarios.forEach((u) => {
      rows.push([
        { v: u.nome || '—', t: 's', s: STYLE.dataCell },
        { v: u.email || '—', t: 's', s: STYLE.dataCell },
        { v: u.cargo || '—', t: 's', s: STYLE.dataCell },
        { v: u.telefone || '—', t: 's', s: STYLE.dataCell },
        { v: perfisInfo[u.perfil]?.label ?? (u.perfil || '—'), t: 's', s: STYLE.dataCell },
        { v: u.observacoes || '', t: 's', s: STYLE.dataCell },
      ]);
    });

    rows.push([
      { v: 'Total', t: 's', s: STYLE.totalRow },
      { v: `${usuarios.length} usuário(s) cadastrado(s)`, t: 's', s: STYLE.totalRow },
      txt('', STYLE.totalRow), txt('', STYLE.totalRow), txt('', STYLE.totalRow), txt('', STYLE.totalRow),
    ]);
    merges.push({ s: { r: rows.length - 1, c: 1 }, e: { r: rows.length - 1, c: cols - 1 } });
  }

  return writeSheet(XLSX, rows, {
    colWidths: [26, 32, 22, 18, 22, 32],
    freezeRow: headerRow,
    merges,
  });
}

/* ================================================================== */
/* v5.22.8 — ABA: Fornecedores                                        */
/* (cadastro feito pelo cliente na Etapa 7; cada fornecedor é Usina    */
/*  Concreteira OU Laboratório, com até 3 e-mails de programação)      */
/* ================================================================== */

function buildSheetFornecedores(ctx: SheetBuildContext): XLSXType.WorkSheet {
  const { XLSX, payload } = ctx;
  const cols = 9;
  const banner = bannerRow(payload, cols);
  const meta = metaRow(payload, cols);
  const merges = [...banner.merges, ...meta.merges];
  const rows: Cell[][] = [banner.row, meta.row, []];

  rows.push([
    { v: 'Tipo', t: 's', s: STYLE.tableHeader },
    { v: 'Nome', t: 's', s: STYLE.tableHeader },
    { v: 'CNPJ', t: 's', s: STYLE.tableHeader },
    { v: 'Endereço', t: 's', s: STYLE.tableHeader },
    { v: 'Responsável', t: 's', s: STYLE.tableHeader },
    { v: 'Telefone', t: 's', s: STYLE.tableHeader },
    { v: 'E-mail programação 1', t: 's', s: STYLE.tableHeader },
    { v: 'E-mail programação 2', t: 's', s: STYLE.tableHeader },
    { v: 'E-mail programação 3', t: 's', s: STYLE.tableHeader },
  ]);
  const headerRow = rows.length;

  const fornecedores = ((payload.customerInput as unknown) as Record<string, unknown>).fornecedores as
    | Array<{ tipo: string; nome: string; cnpj: string; endereco: string; responsavel: string; emailsProgramacao: string[]; telefone: string }>
    | undefined;

  if (!fornecedores || fornecedores.length === 0) {
    rows.push([
      { v: '(Nenhum fornecedor cadastrado)', t: 's', s: { ...STYLE.dataCell, font: { ...STYLE.dataCell.font, italic: true, color: { rgb: COLOR.textMuted } } } },
      txt(''), txt(''), txt(''), txt(''), txt(''), txt(''), txt(''), txt(''),
    ]);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: cols - 1 } });
  } else {
    fornecedores.forEach((f) => {
      const tipoLabel = f.tipo === 'usina' ? 'Usina Concreteira' : f.tipo === 'laboratorio' ? 'Laboratório' : f.tipo || '—';
      const emails = Array.isArray(f.emailsProgramacao) ? f.emailsProgramacao : [];
      rows.push([
        { v: tipoLabel, t: 's', s: { ...STYLE.dataCell, font: { ...STYLE.dataCell.font, bold: true } } },
        { v: f.nome || '—', t: 's', s: STYLE.dataCell },
        { v: f.cnpj || '—', t: 's', s: STYLE.dataCell },
        { v: f.endereco || '—', t: 's', s: STYLE.dataCell },
        { v: f.responsavel || '—', t: 's', s: STYLE.dataCell },
        { v: f.telefone || '—', t: 's', s: STYLE.dataCell },
        { v: emails[0] || '', t: 's', s: STYLE.dataCell },
        { v: emails[1] || '', t: 's', s: STYLE.dataCell },
        { v: emails[2] || '', t: 's', s: STYLE.dataCell },
      ]);
    });

    const usinas = fornecedores.filter((f) => f.tipo === 'usina').length;
    const labs = fornecedores.filter((f) => f.tipo === 'laboratorio').length;
    rows.push([
      { v: 'Total', t: 's', s: STYLE.totalRow },
      { v: `${fornecedores.length} fornecedor(es) — ${usinas} usina(s) e ${labs} laboratório(s)`, t: 's', s: STYLE.totalRow },
      txt('', STYLE.totalRow), txt('', STYLE.totalRow), txt('', STYLE.totalRow), txt('', STYLE.totalRow),
      txt('', STYLE.totalRow), txt('', STYLE.totalRow), txt('', STYLE.totalRow),
    ]);
    merges.push({ s: { r: rows.length - 1, c: 1 }, e: { r: rows.length - 1, c: cols - 1 } });
  }

  return writeSheet(XLSX, rows, {
    colWidths: [18, 32, 20, 38, 26, 18, 28, 28, 28],
    freezeRow: headerRow,
    merges,
  });
}

/* ================================================================== */
/* ABA 9: Mapeamento Banco (4 sub-tabelas verticais)                   */
/* ================================================================== */

function buildSheetMapeamento(ctx: SheetBuildContext): XLSXType.WorkSheet {
  const { XLSX, payload } = ctx;
  const cols = 7;
  const banner = bannerRow(payload, cols);
  const meta = metaRow(payload, cols);
  const merges = [...banner.merges, ...meta.merges];
  const rows: Cell[][] = [banner.row, meta.row, []];

  const addSection = (title: string) => {
    rows.push([
      { v: title, t: 's', s: STYLE.sectionTitle },
      ...new Array(cols - 1).fill(0).map(() => txt('', STYLE.sectionTitle)),
    ]);
    merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: cols - 1 } });
  };

  const addHeader = (labels: string[]) => {
    while (labels.length < cols) labels.push('');
    rows.push(labels.map((l) => ({ v: l, t: 's', s: STYLE.tableHeader } as Cell)));
  };

  // 1. Ges_UnidadeGrupo
  addSection('Ges_UnidadeGrupo · grupos de unidade (estruturas)');
  addHeader(['TempId', 'Nome', 'Tipo', 'Projetista', 'Ordem', 'Ref. customer input', '']);
  payload.technicalMapping.unidadeGrupos.forEach((g) => {
    rows.push([
      { v: g.tempId, t: 's', s: STYLE.dataCell },
      { v: g.nome, t: 's', s: STYLE.dataCell },
      { v: g.tipoEdificacao, t: 's', s: STYLE.dataCell },
      { v: g.projetista || '—', t: 's', s: STYLE.dataCell },
      { v: g.ordem, t: 'n', s: STYLE.dataCellInt },
      { v: g.customerInputRef, t: 's', s: STYLE.dataCell },
      txt('', STYLE.dataCell),
    ]);
  });

  rows.push([]);
  // 2. Ges_UnidadeTipo
  addSection('Ges_UnidadeTipo · padrões técnicos deduplicados');
  addHeader(['TempId', 'Descrição', 'FCK projeto', 'Volume projeto (m³)', 'Classificação Id', 'Concreto Id', 'Flags']);
  payload.technicalMapping.unidadeTipos.forEach((t) => {
    const flags: string[] = [];
    if (t.croquiObrigatorio) flags.push('croqui');
    if (t.formaObrigatorio) flags.push('forma');
    if (t.apareceNoDashboard) flags.push('dashboard');
    if (t.permiteUnidadeAdicional) flags.push('un. adicional');
    if (t.mostrarLegendaMapa) flags.push('legenda mapa');
    rows.push([
      { v: t.tempId, t: 's', s: STYLE.dataCell },
      { v: t.descricao, t: 's', s: STYLE.dataCell },
      t.fckProjeto != null ? { v: t.fckProjeto, t: 'n', s: STYLE.dataCellInt } : txt('—', STYLE.dataCell),
      t.volumeProjeto != null ? { v: t.volumeProjeto, t: 'n', s: STYLE.dataCellRight } : txt('—', STYLE.dataCell),
      { v: t.classificacaoId, t: 'n', s: STYLE.dataCellInt },
      t.concretoId != null ? { v: t.concretoId, t: 'n', s: STYLE.dataCellInt } : txt('—', STYLE.dataCell),
      { v: flags.join(', ') || '—', t: 's', s: STYLE.dataCell },
    ]);
  });

  rows.push([]);
  // 3. Ges_Unidade
  addSection('Ges_Unidade · unidades técnicas (cada estrutura × cada peça)');
  addHeader(['TempId', 'Descrição', 'Ordem', 'Grupo tempId', 'Tipo tempId', '', '']);
  payload.technicalMapping.unidades.forEach((u) => {
    rows.push([
      { v: u.tempId, t: 's', s: STYLE.dataCell },
      { v: u.descricao, t: 's', s: STYLE.dataCell },
      { v: u.ordem, t: 'n', s: STYLE.dataCellInt },
      { v: u.unidadeGrupoTempId, t: 's', s: STYLE.dataCell },
      { v: u.unidadeTipoTempId, t: 's', s: STYLE.dataCell },
      txt('', STYLE.dataCell), txt('', STYLE.dataCell),
    ]);
  });

  rows.push([]);
  // 4. Vínculo Concreto
  addSection('Vinculo_Concreto · associação UnidadeTipo ↔ Concreto');
  addHeader(['UnidadeTipo tempId', 'Concreto Id', 'Aplicação', '', '', '', '']);
  payload.technicalMapping.vinculosConcreto.forEach((v) => {
    rows.push([
      { v: v.unidadeTipoTempId, t: 's', s: STYLE.dataCell },
      { v: v.concretoId, t: 'n', s: STYLE.dataCellInt },
      { v: v.aplicacao, t: 's', s: STYLE.dataCell },
      txt('', STYLE.dataCell), txt('', STYLE.dataCell), txt('', STYLE.dataCell), txt('', STYLE.dataCell),
    ]);
  });

  return writeSheet(XLSX, rows, {
    colWidths: [26, 32, 16, 26, 26, 22, 22],
    freezeRow: 3,
    merges,
  });
}

/* ================================================================== */
/* ABA 9: Validações                                                   */
/* ================================================================== */

function buildSheetValidacoes(ctx: SheetBuildContext): XLSXType.WorkSheet {
  const { XLSX, payload } = ctx;
  const cols = 6;
  const banner = bannerRow(payload, cols);
  const meta = metaRow(payload, cols);
  const merges = [...banner.merges, ...meta.merges];
  const rows: Cell[][] = [banner.row, meta.row, []];

  // Resumo rápido
  const s = payload.validation.summary;
  rows.push([
    { v: `${s.errorCount} bloqueante(s)`, t: 's', s: s.errorCount > 0 ? STYLE.validBloqueante : STYLE.validOk },
    { v: `${s.warningCount} alerta(s)`, t: 's', s: s.warningCount > 0 ? STYLE.validAlerta : STYLE.validOk },
    { v: `${s.infoCount} sugestão(ões)`, t: 's', s: STYLE.validSugestao },
    { v: `${s.pendingCount} pendência(s)`, t: 's', s: STYLE.validPendencia },
    { v: s.blocking ? 'ENVIO BLOQUEADO' : 'Pronto para implantação', t: 's', s: s.blocking ? STYLE.validBloqueante : STYLE.validOk },
    txt('', STYLE.dataCell),
  ]);
  rows.push([]);

  rows.push([
    { v: 'Bucket', t: 's', s: STYLE.tableHeader },
    { v: 'Código', t: 's', s: STYLE.tableHeader },
    { v: 'Localização', t: 's', s: STYLE.tableHeader },
    { v: 'Campo', t: 's', s: STYLE.tableHeader },
    { v: 'Mensagem', t: 's', s: STYLE.tableHeader },
    { v: 'Sugestão de correção', t: 's', s: STYLE.tableHeader },
  ]);
  const headerRow = rows.length;

  const bucketStyle = {
    bloqueante: STYLE.validBloqueante,
    alerta: STYLE.validAlerta,
    sugestao: STYLE.validSugestao,
    pendenciaInterna: STYLE.validPendencia,
  };
  const bucketLabel = {
    bloqueante: '🛑 Bloqueante',
    alerta: '⚠ Alerta',
    sugestao: 'ℹ Sugestão',
    pendenciaInterna: '🔧 Pendência interna',
  };

  if (payload.validation.issues.length === 0) {
    rows.push([
      { v: '✓ OK', t: 's', s: STYLE.validOk },
      { v: '—', t: 's', s: STYLE.validOk },
      { v: '—', t: 's', s: STYLE.validOk },
      { v: '—', t: 's', s: STYLE.validOk },
      { v: 'Nenhuma validação detectada — cadastro pronto.', t: 's', s: STYLE.validOk },
      txt('', STYLE.validOk),
    ]);
  } else {
    payload.validation.issues.forEach((i) => {
      const style = bucketStyle[i.bucket];
      const label = bucketLabel[i.bucket];
      rows.push([
        { v: label, t: 's', s: style },
        { v: i.code, t: 's', s: style },
        { v: i.localizacao || '—', t: 's', s: style },
        { v: i.campo || '—', t: 's', s: style },
        { v: i.message, t: 's', s: style },
        { v: i.suggestedFix || '—', t: 's', s: style },
      ]);
    });
  }

  return writeSheet(XLSX, rows, {
    colWidths: [22, 16, 24, 16, 50, 28],
    freezeRow: headerRow,
    autofilter: { startRow: headerRow, endRow: rows.length - 1, cols },
    merges,
  });
}

/* ================================================================== */
/* ABA 13: JSON Técnico                                                */
/* ================================================================== */

function buildSheetJsonTecnico(ctx: SheetBuildContext): XLSXType.WorkSheet {
  const { XLSX, payload } = ctx;
  const cols = 1;
  const banner = bannerRow(payload, cols);
  const meta = metaRow(payload, cols);
  const merges = [...banner.merges, ...meta.merges];
  const rows: Cell[][] = [banner.row, meta.row, []];

  rows.push([
    {
      v: 'Conteúdo técnico para auditoria. Não editar — este JSON é a fonte de verdade que o frontend envia para a API .NET.',
      t: 's',
      s: STYLE.noteBox,
    },
  ]);
  rows.push([]);

  const jsonStr = JSON.stringify(payload, null, 2);
  // Excel suporta até 32.767 chars por célula. Chunk se passar.
  const MAX = 32000;
  if (jsonStr.length <= MAX) {
    rows.push([{ v: jsonStr, t: 's', s: { font: { name: 'Consolas', sz: 9, color: { rgb: COLOR.text } }, alignment: { vertical: 'top', horizontal: 'left', wrapText: false } } }]);
  } else {
    rows.push([{ v: `[JSON dividido em chunks de ${MAX} caracteres — total ${jsonStr.length} chars]`, t: 's', s: STYLE.hint }]);
    for (let i = 0; i < jsonStr.length; i += MAX) {
      rows.push([{
        v: jsonStr.slice(i, i + MAX),
        t: 's',
        s: { font: { name: 'Consolas', sz: 9, color: { rgb: COLOR.text } }, alignment: { vertical: 'top', horizontal: 'left', wrapText: false } },
      }]);
    }
  }

  const ws = writeSheet(XLSX, rows, {
    colWidths: [180],
    merges,
  });
  // Altura grande pra mostrar várias linhas do JSON sem rolar (cap em ~600)
  ws['!rows'] = [
    { hpt: 24 }, { hpt: 18 }, { hpt: 8 }, { hpt: 30 }, { hpt: 8 },
    ...rows.slice(5).map(() => ({ hpt: 600 })),
  ];
  return ws;
}

/* ================================================================== */
/* Workbook builder principal                                          */
/* ================================================================== */

export async function buildWorkbook(
  payload: TechnicalJson,
): Promise<XLSXType.WorkBook> {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  const ctx: SheetBuildContext = { payload, XLSX };

  XLSX.utils.book_append_sheet(wb, buildSheetInstrucoes(ctx),       'Instruções');
  XLSX.utils.book_append_sheet(wb, buildSheetResumo(ctx),           'Resumo');
  XLSX.utils.book_append_sheet(wb, buildSheetEstatisticas(ctx),     'Estatísticas');
  XLSX.utils.book_append_sheet(wb, buildSheetEstruturas(ctx),       'Estruturas');
  XLSX.utils.book_append_sheet(wb, buildSheetPecas(ctx),            'Peças (cadastro)');
  XLSX.utils.book_append_sheet(wb, buildSheetUnidades(ctx),         'Unidades geradas');
  XLSX.utils.book_append_sheet(wb, buildSheetConcretos(ctx),        'Concretos');
  XLSX.utils.book_append_sheet(wb, buildSheetPadroesMoldagem(ctx),  'Padrões de Moldagem');
  // v5.22.8: 2 abas novas
  XLSX.utils.book_append_sheet(wb, buildSheetUsuariosObra(ctx),     'Usuários da obra');
  XLSX.utils.book_append_sheet(wb, buildSheetFornecedores(ctx),     'Fornecedores');
  XLSX.utils.book_append_sheet(wb, buildSheetMapeamento(ctx),       'Mapeamento Banco');
  XLSX.utils.book_append_sheet(wb, buildSheetValidacoes(ctx),       'Validações');
  XLSX.utils.book_append_sheet(wb, buildSheetJsonTecnico(ctx),      'JSON Técnico');

  // Define a Resumo como aba ativa inicial
  (wb as unknown as { Workbook?: { Views?: Array<{ activeTab: number }> } }).Workbook = {
    Views: [{ activeTab: 1 }],
  };

  return wb;
}

/**
 * Exporta a planilha gatilhando download no navegador.
 *
 * Não usa `XLSX.writeFile` para manter controle explícito sobre o Blob e o
 * ciclo do link de download no browser. Aqui montamos
 * explicitamente o Blob e disparamos o download via `<a download>` — mesmo
 * caminho usado em apps em produção.
 */
export async function exportTechnicalWorkbook(payload: TechnicalJson): Promise<string> {
  const XLSX = await loadXlsx();
  const wb = await buildWorkbook(payload);
  const filename = buildWorkbookFilename(payload);

  // Gera o binário como Uint8Array (compatível com browser)
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as Uint8Array;
  // Cópia para um ArrayBuffer concreto (TS strict não aceita SharedArrayBuffer)
  const buffer = new Uint8Array(out).buffer;
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  // Cleanup assíncrono (alguns browsers exigem o link visível por 1 tick)
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
  return filename;
}
