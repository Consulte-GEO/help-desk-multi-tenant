/**
 * Persistência de eventos de auditoria (`setup_audit_events`). · v5.22.45
 *
 * V8: o cliente grava e lê eventos remotos somente por RPC vinculada ao
 * token do rascunho. A tabela é append-only e não oferece SELECT/UPDATE/
 * DELETE ao papel anon. Eventos sem rascunho/token permanecem locais.
 */

import { getDraftAccessToken } from './setupDraftService';
import { getSupabaseAsync } from './supabaseClient';

const LS_KEY = 'consulte-geo.setup.audit.v5';

export interface AuditEventInput {
  actor: string;
  action: string;
  entity: string;
  before?: unknown;
  after?: unknown;
  source?: string;
  timestamp?: string;
}

export interface AuditEventRow {
  id: string;
  draft_id: string | null;
  submission_id: string | null;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  before?: unknown;
  after?: unknown;
  source: string;
}

interface LocalCache {
  events: AuditEventRow[];
}

function readLocal(): LocalCache {
  if (typeof window === 'undefined') return { events: [] };
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { events: [] };
    const parsed = JSON.parse(raw) as Partial<LocalCache>;
    return { events: Array.isArray(parsed.events) ? parsed.events : [] };
  } catch {
    return { events: [] };
  }
}

function writeLocal(cache: LocalCache): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    /* auditoria local é best-effort */
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'aud-' + Math.random().toString(36).slice(2) + Date.now();
}

function appendLocal(row: AuditEventRow): void {
  const cache = readLocal();
  const previous = cache.events.findIndex((item) => item.id === row.id);
  if (previous >= 0) cache.events[previous] = row;
  else cache.events.push(row);
  if (cache.events.length > 200) cache.events = cache.events.slice(-200);
  writeLocal(cache);
}

export async function recordAudit(
  event: AuditEventInput,
  refs: { draftId?: string | null; submissionId?: string | null } = {},
): Promise<AuditEventRow> {
  const localRow: AuditEventRow = {
    id: makeId(),
    draft_id: refs.draftId ?? null,
    submission_id: refs.submissionId ?? null,
    timestamp: event.timestamp ?? new Date().toISOString(),
    actor: event.actor,
    action: event.action,
    entity: event.entity,
    before: event.before,
    after: event.after,
    source: event.source ?? 'frontend',
  };

  const draftId = refs.draftId ?? null;
  const token = getDraftAccessToken(draftId);
  const sb = await getSupabaseAsync();
  if (!sb || !draftId || !token) {
    appendLocal(localRow);
    return localRow;
  }

  const { data, error } = await sb.rpc('record_audit_by_token', {
    p_token: token,
    p_draft_id: draftId,
    p_submission_id: refs.submissionId ?? null,
    p_actor: event.actor,
    p_action: event.action,
    p_entity: event.entity,
    p_before: event.before ?? null,
    p_after: event.after ?? null,
    p_source: event.source ?? 'frontend',
    p_timestamp: event.timestamp ?? null,
  });
  if (error) {
    appendLocal(localRow);
    throw new Error(`audit_record_failed: ${error.message}`);
  }
  if (!data || typeof data !== 'object') throw new Error('audit_rpc_empty_response');
  const row = data as unknown as AuditEventRow;
  appendLocal(row);
  return row;
}

export async function listAudit(
  filter: { draftId?: string | null; submissionId?: string | null } = {},
): Promise<AuditEventRow[]> {
  const local = readLocal().events
    .filter((row) => (filter.draftId ? row.draft_id === filter.draftId : true))
    .filter((row) => (filter.submissionId ? row.submission_id === filter.submissionId : true));

  const draftId = filter.draftId ?? null;
  const token = getDraftAccessToken(draftId);
  const sb = await getSupabaseAsync();
  let remote: AuditEventRow[] = [];
  if (sb && draftId && token) {
    const { data, error } = await sb.rpc('list_audit_by_token', {
      p_token: token,
      p_draft_id: draftId,
      p_limit: 200,
    });
    if (error) throw new Error(`audit_list_failed: ${error.message}`);
    if (Array.isArray(data)) remote = data as unknown as AuditEventRow[];
  }

  const merged = new Map<string, AuditEventRow>();
  local.forEach((row) => merged.set(row.id, row));
  remote
    .filter((row) => (filter.submissionId ? row.submission_id === filter.submissionId : true))
    .forEach((row) => merged.set(row.id, row));
  return [...merged.values()].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}
