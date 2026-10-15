/**
 * adminQueriesService · v5.22.28
 *
 * Queries para o painel de gestão. Lê da view consolidada
 * `admin_dashboard_items` (vide migration 011) + ações de gestão:
 * notas internas, locks "em análise por mim", prioridades.
 *
 * Todas as queries dependem de RLS — sem JWT admin válido, devolvem
 * vazio sem erro explícito (Supabase RLS funciona assim).
 */

import { getSupabaseAsync, SUPABASE_CONFIGURED } from './supabaseClient';
import { getCurrentUser } from './authService';

export interface DashboardItem {
  id: string;
  kind: 'submission' | 'ticket';
  identifier: string;
  title: string;
  subtitle: string;
  cliente: string;
  status: string;
  created_at: string;
  updated_at: string;
  priority: 'baixa' | 'media' | 'alta' | 'urgente' | null;
  locked_by: string | null;
  lock_expires_at: string | null;
  note_count: number;
  /** v5.22.29 — comentários públicos (visíveis ao cliente em /s/:token) */
  public_comment_count: number;
}

export interface AdminNote {
  id: string;
  body: string;
  created_by_email: string;
  created_at: string;
  deleted_at: string | null;
}

export interface DashboardFilters {
  status?: string[];
  kind?: 'submission' | 'ticket';
  search?: string;     // procura em identifier, title, cliente
  priority?: string[];
  /** ISO date inclusive */
  fromDate?: string;
  /** ISO date inclusive */
  toDate?: string;
}

export interface DashboardStats {
  total: number;
  byStatus: Record<string, number>;
  byKind: Record<string, number>;
  byPriority: Record<string, number>;
  thisWeek: number;
  locked: number;
}

function emptyStats(): DashboardStats {
  return {
    total: 0,
    byStatus: {},
    byKind: {},
    byPriority: {},
    thisWeek: 0,
    locked: 0,
  };
}

/**
 * Lista itens do dashboard com filtros opcionais. Retorna ordenado
 * por updated_at desc (mais recentes primeiro).
 */
export async function listDashboardItems(
  filters: DashboardFilters = {},
): Promise<DashboardItem[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = await getSupabaseAsync();
  if (!sb) return [];

  let query = sb.from('admin_dashboard_items').select('*');

  if (filters.kind) query = query.eq('kind', filters.kind);
  if (filters.status && filters.status.length > 0) {
    query = query.in('status', filters.status);
  }
  if (filters.priority && filters.priority.length > 0) {
    query = query.in('priority', filters.priority);
  }
  if (filters.fromDate) query = query.gte('updated_at', filters.fromDate);
  if (filters.toDate) query = query.lte('updated_at', filters.toDate);
  if (filters.search && filters.search.trim()) {
    const term = filters.search.trim();
    // Busca em identifier, title, cliente — OR via ilike
    query = query.or(
      `identifier.ilike.%${term}%,title.ilike.%${term}%,cliente.ilike.%${term}%`,
    );
  }

  query = query.order('updated_at', { ascending: false }).limit(500);

  const { data, error } = await query;
  if (error) {
    console.error('[listDashboardItems] erro:', error);
    return [];
  }
  return (data as DashboardItem[]) || [];
}

/**
 * Calcula stats no client a partir da lista. Mantém simples:
 * para volume grande, vale criar RPC no Postgres depois.
 */
export function computeStats(items: DashboardItem[]): DashboardStats {
  const stats = emptyStats();
  stats.total = items.length;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekIso = weekAgo.toISOString();

  for (const it of items) {
    stats.byStatus[it.status] = (stats.byStatus[it.status] || 0) + 1;
    stats.byKind[it.kind] = (stats.byKind[it.kind] || 0) + 1;
    if (it.priority) {
      stats.byPriority[it.priority] = (stats.byPriority[it.priority] || 0) + 1;
    }
    if (it.updated_at >= weekIso) stats.thisWeek++;
    if (it.locked_by) stats.locked++;
  }
  return stats;
}

/* ============================================================ Notes */

export async function listNotes(
  target: { submissionId?: string; ticketId?: string },
): Promise<AdminNote[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = await getSupabaseAsync();
  if (!sb) return [];

  let query = sb
    .from('setup_admin_notes')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (target.submissionId) query = query.eq('submission_id', target.submissionId);
  else if (target.ticketId) query = query.eq('ticket_id', target.ticketId);
  else return [];

  const { data, error } = await query;
  if (error) {
    console.error('[listNotes] erro:', error);
    return [];
  }
  return (data as AdminNote[]) || [];
}

export async function addNote(
  target: { submissionId?: string; ticketId?: string },
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'supabase_off' };
  const sb = await getSupabaseAsync();
  if (!sb) return { ok: false, error: 'no_client' };
  const user = getCurrentUser();
  if (!user) return { ok: false, error: 'not_authenticated' };
  if (!body || !body.trim()) return { ok: false, error: 'body_required' };

  const payload = {
    submission_id: target.submissionId || null,
    ticket_id: target.ticketId || null,
    body: body.trim().slice(0, 5000),
    created_by_email: user.email,
  };
  const { error } = await sb.from('setup_admin_notes').insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function softDeleteNote(noteId: string): Promise<boolean> {
  if (!SUPABASE_CONFIGURED) return false;
  const sb = await getSupabaseAsync();
  if (!sb) return false;
  const { error } = await sb
    .from('setup_admin_notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId);
  return !error;
}

/* ============================================================ Locks */

export async function takeLock(submissionId: string): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'supabase_off' };
  const sb = await getSupabaseAsync();
  if (!sb) return { ok: false, error: 'no_client' };
  const user = getCurrentUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  const now = new Date();
  const expires = new Date(now.getTime() + 4 * 60 * 60 * 1000);

  const { error } = await sb.from('setup_admin_locks').upsert({
    submission_id: submissionId,
    locked_by_email: user.email,
    locked_at: now.toISOString(),
    expires_at: expires.toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function releaseLock(submissionId: string): Promise<boolean> {
  if (!SUPABASE_CONFIGURED) return false;
  const sb = await getSupabaseAsync();
  if (!sb) return false;
  const { error } = await sb
    .from('setup_admin_locks')
    .delete()
    .eq('submission_id', submissionId);
  return !error;
}

/* ============================================================ Audit (v5.22.29) */

export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  before: unknown;
  after: unknown;
  source: string;
}

/**
 * Lista eventos de auditoria de uma submission. Cobre histórico tanto
 * de submissions quanto de tickets (tickets têm `submission_id` no
 * audit via JOIN no client OR mesmo backend; setup_tickets.submission_id
 * existe).
 *
 * Para um ticket: passa o `submission_id` do ticket (não o `ticket.id`).
 * Quem chama precisa fazer essa resolução antes.
 */
export async function listAuditEventsBySubmission(
  submissionId: string,
  limit = 100,
): Promise<AuditEvent[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = await getSupabaseAsync();
  if (!sb) return [];

  const { data, error } = await sb
    .from('setup_audit_events')
    .select('id, timestamp, actor, action, entity, before, after, source')
    .eq('submission_id', submissionId)
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[listAuditEventsBySubmission]', error);
    return [];
  }
  return (data as AuditEvent[]) || [];
}

/**
 * v5.22.29 — para tickets, resolve submission_id via setup_tickets
 * primeiro e depois delega para listAuditEventsBySubmission.
 *
 * Cache não necessário aqui — chamado uma vez ao abrir o drill-down.
 */
export async function listAuditEventsByTicket(ticketId: string): Promise<AuditEvent[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = await getSupabaseAsync();
  if (!sb) return [];

  // 1) Resolve submission_id do ticket. setup_tickets tem RLS aberta
  //    apenas para admin (vide migration 011), então isso requer JWT
  //    válido — exatamente o que o painel admin tem.
  const { data: ticket, error: tErr } = await sb
    .from('setup_tickets')
    .select('submission_id')
    .eq('id', ticketId)
    .single();
  if (tErr || !ticket) return [];
  return listAuditEventsBySubmission((ticket as { submission_id: string }).submission_id);
}

/**
 * Registra um evento de auditoria do admin. Usado pelo dashboard para
 * marcar lock_taken, note_added, priority_set, comment_visible_added.
 */
export async function logAdminAudit(params: {
  submissionId?: string;
  action: string;
  entity: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  if (!SUPABASE_CONFIGURED) return;
  const sb = await getSupabaseAsync();
  if (!sb) return;
  const user = getCurrentUser();
  if (!user) return;

  const payload = {
    submission_id: params.submissionId || null,
    timestamp: new Date().toISOString(),
    actor: user.email,
    action: params.action,
    entity: params.entity,
    before: (params.before as object) ?? null,
    after: (params.after as object) ?? null,
    source: 'admin_panel',
  };
  const { error } = await sb.from('setup_audit_events').insert(payload);
  if (error) console.error('[logAdminAudit]', error);
}

/* ============================================================ Review comments (v5.22.29) */

export interface ReviewComment {
  id: string;
  author: string;
  body: string;
  created_at: string;
}

/**
 * Lista comentários públicos (visíveis ao cliente em /s/:token) de uma
 * submission. Admin lê direto via RLS — cliente usa RPC com token.
 */
export async function listReviewCommentsBySubmission(
  submissionId: string,
): Promise<ReviewComment[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = await getSupabaseAsync();
  if (!sb) return [];

  // RLS de setup_review_comments era 'anon block + RPC only'. Na
  // migration 012 (v5.22.29) adicionamos policy `admin_read` que libera
  // SELECT para is_admin().
  const { data, error } = await sb
    .from('setup_review_comments')
    .select('id, author, body, created_at')
    .eq('submission_id', submissionId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[listReviewCommentsBySubmission]', error);
    return [];
  }
  return (data as ReviewComment[]) || [];
}

/**
 * Adiciona um comentário público (vai aparecer para o cliente em
 * /s/:token) a partir do painel admin. Não usa o token de equipe
 * (`/r/:token`) — usa JWT de auth admin.
 *
 * A nova RPC (migration 012) faz o check de `is_admin()` server-side
 * e popula `author` com o email do admin logado.
 */
export async function addReviewCommentAsAdmin(
  submissionId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'supabase_off' };
  const sb = await getSupabaseAsync();
  if (!sb) return { ok: false, error: 'no_client' };
  const user = getCurrentUser();
  if (!user) return { ok: false, error: 'not_authenticated' };
  const trimmed = (body || '').trim();
  if (!trimmed) return { ok: false, error: 'body_required' };
  if (trimmed.length > 5000) return { ok: false, error: 'body_too_long' };

  // Usa RPC `add_review_comment_as_admin` (criada na migration 012).
  // RPC bypassa policy `anon_block` e re-valida is_admin() no servidor.
  const { error } = await sb.rpc('add_review_comment_as_admin', {
    p_submission_id: submissionId,
    p_body: trimmed,
  });
  if (error) return { ok: false, error: error.message };

  // Audit local (e também o backend registra via trigger se houver)
  await logAdminAudit({
    submissionId,
    action: 'review_comment_added_by_admin',
    entity: 'setup_review_comments',
    after: { body: trimmed },
  });

  // v5.22.34: notifica cliente fire-and-forget. Admin sempre envia
  // comentário PÚBLICO via este caminho (internal_only=false na RPC),
  // então sempre notifica. O author é obtido do JWT atual pela
  // própria Edge Function via service role, mas passamos email pro
  // logging do "team_author" no email.
  void sb.functions
    .invoke('notify-team-comment', {
      body: {
        submission_id: submissionId,
        comment_body: trimmed.slice(0, 600),
        team_author: user.email || '',
      },
    })
    .catch((err) => {
      // Comentário JÁ está persistido. Email é nice-to-have.
      console.warn('[notify-team-comment] falhou:', err);
    });

  return { ok: true };
}



export async function setPriority(
  target: { submissionId?: string; ticketId?: string },
  priority: 'baixa' | 'media' | 'alta' | 'urgente',
): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'supabase_off' };
  const sb = await getSupabaseAsync();
  if (!sb) return { ok: false, error: 'no_client' };
  const user = getCurrentUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  const payload: Record<string, unknown> = {
    priority,
    set_by_email: user.email,
    set_at: new Date().toISOString(),
  };
  if (target.submissionId) {
    payload.submission_id = target.submissionId;
    const { error } = await sb
      .from('setup_admin_priorities')
      .upsert(payload, { onConflict: 'submission_id' });
    if (error) return { ok: false, error: error.message };
  } else if (target.ticketId) {
    payload.ticket_id = target.ticketId;
    const { error } = await sb
      .from('setup_admin_priorities')
      .upsert(payload, { onConflict: 'ticket_id' });
    if (error) return { ok: false, error: error.message };
  } else {
    return { ok: false, error: 'no_target' };
  }
  return { ok: true };
}

/** Remove a prioridade do alvo. DELETE é autorizado somente pela policy admin_all. */
export async function clearPriority(
  target: { submissionId?: string; ticketId?: string },
): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'supabase_off' };
  const sb = await getSupabaseAsync();
  if (!sb) return { ok: false, error: 'no_client' };
  const user = getCurrentUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  let query = sb.from('setup_admin_priorities').delete();
  if (target.submissionId) query = query.eq('submission_id', target.submissionId);
  else if (target.ticketId) query = query.eq('ticket_id', target.ticketId);
  else return { ok: false, error: 'no_target' };

  const { error } = await query;
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
