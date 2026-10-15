/**
 * adminExportService · v5.22.29
 *
 * Geração de planilha Excel a partir do listing do dashboard admin.
 * Útil para reuniões de gestão / relatórios externos.
 *
 * Estrutura do arquivo (4 abas):
 *   - Resumo:       contadores agregados (stats)
 *   - Itens:        listing completo na ordem atual
 *   - Notas:        todas as notas internas dos itens listados
 *   - Histórico:    audit events dos últimos 90 dias relacionados
 *
 * Biblioteca: writer XLSX local compartilhado com `excelExportService`.
 * Sem dependência externa de planilha no bundle Vue.
 *
 * Performance: para listings grandes (>500 itens), as queries de
 * notas+histórico são feitas em lotes via `Promise.allSettled` para
 * não falhar tudo se uma der erro.
 */

import type * as XLSXType from '../vendor/xlsxStyleLite';
import { getSupabaseAsync, SUPABASE_CONFIGURED } from './supabaseClient';
import type { DashboardItem, DashboardStats, AdminNote } from './adminQueriesService';

// Lazy load para não pesar no bundle inicial (mesmo padrão do
// excelExportService do fluxo cliente).
let xlsxPromise: Promise<typeof XLSXType> | null = null;
async function loadXlsx(): Promise<typeof XLSXType> {
  if (!xlsxPromise) {
    xlsxPromise = import('../vendor/xlsxStyleLite').then((mod) => {
      return mod;
    });
  }
  return xlsxPromise;
}

const SHEET_LIMITS = {
  /** Máximo de itens para incluir no Excel. Excel handle muito mais, mas
   *  o fetch de notas/histórico explode com mais que isso. */
  maxItems: 1000,
  /** Janela de audit_events. 90 dias cobre 99% dos casos. */
  auditWindowDays: 90,
};

export interface ExportResult {
  ok: boolean;
  filename?: string;
  bytes?: number;
  error?: string;
}

/* ============================================================ helpers */

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return String(iso);
  }
}

function buildFilename(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  return `painel-gestao-${yyyy}${mm}${dd}-${hh}${mi}.xlsx`;
}

/* ============================================================ aba 1: Resumo */

function sheetResumo(XLSX: typeof XLSXType, stats: DashboardStats, itemCount: number): XLSXType.WorkSheet {
  const rows: (string | number)[][] = [
    ['Painel de gestão Consulte GEO'],
    [`Exportado em ${new Date().toLocaleString('pt-BR')}`],
    [],
    ['Indicador', 'Valor'],
    ['Total de itens exibidos', itemCount],
    ['Atualizações na última semana', stats.thisWeek],
    ['Em análise (com lock)', stats.locked],
    [],
    ['Por tipo', ''],
  ];
  for (const [k, v] of Object.entries(stats.byKind)) {
    rows.push([`  ${k === 'submission' ? 'Submissões' : 'Chamados'}`, v]);
  }
  rows.push([]);
  rows.push(['Por status', '']);
  for (const [k, v] of Object.entries(stats.byStatus)) {
    rows.push([`  ${k}`, v]);
  }
  rows.push([]);
  rows.push(['Por prioridade', '']);
  // Ordem fixa: urgente → alta → media → baixa
  const priOrder = ['urgente', 'alta', 'media', 'baixa'];
  for (const p of priOrder) {
    if (stats.byPriority[p] !== undefined) {
      rows.push([`  ${p}`, stats.byPriority[p]]);
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 36 }, { wch: 16 }];
  return ws;
}

/* ============================================================ aba 2: Itens */

function sheetItens(XLSX: typeof XLSXType, items: DashboardItem[]): XLSXType.WorkSheet {
  const header = [
    'Tipo',
    'Identificador',
    'Obra',
    'Subtítulo',
    'Cliente',
    'Status',
    'Prioridade',
    'Em análise por',
    'Lock expira',
    'Notas',
    'Criado em',
    'Atualizado em',
    'ID interno',
  ];
  const rows = items.map((it) => [
    it.kind === 'submission' ? 'Submissão' : 'Chamado',
    it.identifier,
    it.title || '',
    it.subtitle || '',
    it.cliente || '',
    it.status,
    it.priority || '',
    it.locked_by || '',
    formatDate(it.lock_expires_at),
    it.note_count,
    formatDate(it.created_at),
    formatDate(it.updated_at),
    it.id,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  // Larguras razoáveis
  ws['!cols'] = [
    { wch: 10 },   // tipo
    { wch: 22 },   // identificador
    { wch: 32 },   // obra
    { wch: 24 },   // subtítulo
    { wch: 24 },   // cliente
    { wch: 14 },   // status
    { wch: 10 },   // prioridade
    { wch: 28 },   // em análise por
    { wch: 18 },   // lock expira
    { wch: 6 },    // notas
    { wch: 18 },   // criado
    { wch: 18 },   // atualizado
    { wch: 38 },   // id interno
  ];
  return ws;
}

/* ============================================================ aba 3: Notas */

interface NoteWithContext extends AdminNote {
  itemIdentifier: string;
  itemTitle: string;
}

async function fetchAllNotes(items: DashboardItem[]): Promise<NoteWithContext[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = await getSupabaseAsync();
  if (!sb) return [];

  const submissionIds = items
    .filter((i) => i.kind === 'submission')
    .map((i) => i.id);
  const ticketIds = items
    .filter((i) => i.kind === 'ticket')
    .map((i) => i.id);

  // Map para enriquecer (identifier + title) sem query extra
  const itemLookup = new Map<string, { identifier: string; title: string }>();
  for (const it of items) {
    itemLookup.set(`${it.kind}:${it.id}`, {
      identifier: it.identifier,
      title: it.title || '',
    });
  }

  const result: NoteWithContext[] = [];

  if (submissionIds.length > 0) {
    const { data, error } = await sb
      .from('setup_admin_notes')
      .select('*')
      .in('submission_id', submissionIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (!error && data) {
      for (const n of data as (AdminNote & { submission_id: string })[]) {
        const ctx = itemLookup.get(`submission:${n.submission_id}`);
        result.push({
          ...n,
          itemIdentifier: ctx?.identifier || '',
          itemTitle: ctx?.title || '',
        });
      }
    }
  }
  if (ticketIds.length > 0) {
    const { data, error } = await sb
      .from('setup_admin_notes')
      .select('*')
      .in('ticket_id', ticketIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (!error && data) {
      for (const n of data as (AdminNote & { ticket_id: string })[]) {
        const ctx = itemLookup.get(`ticket:${n.ticket_id}`);
        result.push({
          ...n,
          itemIdentifier: ctx?.identifier || '',
          itemTitle: ctx?.title || '',
        });
      }
    }
  }

  return result;
}

function sheetNotas(XLSX: typeof XLSXType, notes: NoteWithContext[]): XLSXType.WorkSheet {
  const header = ['Identificador', 'Obra', 'Autor', 'Data', 'Nota'];
  const rows = notes.map((n) => [
    n.itemIdentifier,
    n.itemTitle,
    n.created_by_email,
    formatDate(n.created_at),
    n.body,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws['!cols'] = [
    { wch: 22 }, // identificador
    { wch: 32 }, // obra
    { wch: 30 }, // autor
    { wch: 18 }, // data
    { wch: 80 }, // nota (texto longo)
  ];
  return ws;
}

/* ============================================================ aba 4: Histórico */

interface AuditRow {
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  source: string;
  itemIdentifier: string;
  itemTitle: string;
}

async function fetchAuditEvents(items: DashboardItem[]): Promise<AuditRow[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = await getSupabaseAsync();
  if (!sb) return [];

  const submissionIds: string[] = [];
  const submissionLookup = new Map<string, { identifier: string; title: string }>();
  for (const it of items) {
    if (it.kind === 'submission') {
      submissionIds.push(it.id);
      submissionLookup.set(it.id, {
        identifier: it.identifier,
        title: it.title || '',
      });
    }
    // Tickets via submission_id seria ideal mas exigiria fetch extra;
    // ficamos só com submissions na primeira versão.
  }
  if (submissionIds.length === 0) return [];

  const from = new Date();
  from.setDate(from.getDate() - SHEET_LIMITS.auditWindowDays);

  const { data, error } = await sb
    .from('setup_audit_events')
    .select('submission_id, timestamp, actor, action, entity, source')
    .in('submission_id', submissionIds)
    .gte('timestamp', from.toISOString())
    .order('timestamp', { ascending: false });
  if (error || !data) return [];

  return (data as Array<{
    submission_id: string;
    timestamp: string;
    actor: string;
    action: string;
    entity: string;
    source: string;
  }>).map((e) => {
    const ctx = submissionLookup.get(e.submission_id);
    return {
      timestamp: e.timestamp,
      actor: e.actor,
      action: e.action,
      entity: e.entity,
      source: e.source,
      itemIdentifier: ctx?.identifier || '',
      itemTitle: ctx?.title || '',
    };
  });
}

function sheetHistorico(XLSX: typeof XLSXType, rows: AuditRow[]): XLSXType.WorkSheet {
  const header = ['Identificador', 'Obra', 'Quando', 'Quem', 'Ação', 'Entidade', 'Origem'];
  const data = rows.map((r) => [
    r.itemIdentifier,
    r.itemTitle,
    formatDate(r.timestamp),
    r.actor,
    r.action,
    r.entity,
    r.source,
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...data]);
  ws['!cols'] = [
    { wch: 22 }, { wch: 32 }, { wch: 18 }, { wch: 30 }, { wch: 28 }, { wch: 16 }, { wch: 12 },
  ];
  return ws;
}

/* ============================================================ entrada */

export async function exportDashboardToExcel(
  items: DashboardItem[],
  stats: DashboardStats,
): Promise<ExportResult> {
  try {
    const limited = items.slice(0, SHEET_LIMITS.maxItems);

    // Coleta notas + histórico em paralelo. Se uma falhar, outras
    // continuam.
    const [notesRes, auditRes, XLSX] = await Promise.all([
      fetchAllNotes(limited).catch((): NoteWithContext[] => []),
      fetchAuditEvents(limited).catch((): AuditRow[] => []),
      loadXlsx(),
    ]);
    const notes = notesRes;
    const audit = auditRes;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheetResumo(XLSX, stats, limited.length), 'Resumo');
    XLSX.utils.book_append_sheet(wb, sheetItens(XLSX, limited), 'Itens');
    XLSX.utils.book_append_sheet(wb, sheetNotas(XLSX, notes), 'Notas');
    XLSX.utils.book_append_sheet(wb, sheetHistorico(XLSX, audit), 'Histórico');

    const filename = buildFilename();
    XLSX.writeFile(wb, filename);

    return { ok: true, filename };
  } catch (err) {
    return {
      ok: false,
      error: `excel_export_failed: ${String(err).slice(0, 200)}`,
    };
  }
}
