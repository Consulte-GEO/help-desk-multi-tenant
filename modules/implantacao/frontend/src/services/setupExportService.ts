/**
 * Persistência de exports gerados (`setup_exports`). · v5.22.45
 *
 * V8: o navegador não acessa mais a tabela diretamente. Registro e listagem
 * remotos usam RPCs vinculadas ao token do rascunho. Sem token, o evento fica
 * no cache local — nunca é enviado como operação anônima sem escopo.
 */

import { getDraftAccessToken } from './setupDraftService';
import { getSupabaseAsync } from './supabaseClient';

const LS_KEY = 'consulte-geo.setup.exports.v5';

export interface SetupExportRow {
  id: string;
  draft_id: string | null;
  submission_id: string | null;
  kind: 'json' | 'excel';
  filename: string;
  size_bytes: number | null;
  hash: string | null;
  created_at: string;
}

interface LocalCache {
  exports: SetupExportRow[];
}

function readLocal(): LocalCache {
  if (typeof window === 'undefined') return { exports: [] };
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { exports: [] };
    const parsed = JSON.parse(raw) as Partial<LocalCache>;
    return { exports: Array.isArray(parsed.exports) ? parsed.exports : [] };
  } catch {
    return { exports: [] };
  }
}

function writeLocal(cache: LocalCache): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    /* log local é best-effort */
  }
}

function makeId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'exp-' + Math.random().toString(36).slice(2) + Date.now();
}

function appendLocal(row: SetupExportRow): void {
  const cache = readLocal();
  const previous = cache.exports.findIndex((item) => item.id === row.id);
  if (previous >= 0) cache.exports[previous] = row;
  else cache.exports.push(row);
  if (cache.exports.length > 200) cache.exports = cache.exports.slice(-200);
  writeLocal(cache);
}

export async function recordExport(input: {
  draftId: string | null;
  submissionId: string | null;
  kind: 'json' | 'excel';
  filename: string;
  sizeBytes?: number | null;
  hash?: string | null;
}): Promise<SetupExportRow> {
  const localRow: SetupExportRow = {
    id: makeId(),
    draft_id: input.draftId,
    submission_id: input.submissionId,
    kind: input.kind,
    filename: input.filename,
    size_bytes: input.sizeBytes ?? null,
    hash: input.hash ?? null,
    created_at: new Date().toISOString(),
  };

  const token = getDraftAccessToken(input.draftId);
  const sb = await getSupabaseAsync();
  if (!sb || !input.draftId || !token) {
    appendLocal(localRow);
    return localRow;
  }

  const { data, error } = await sb.rpc('record_export_by_token', {
    p_token: token,
    p_draft_id: input.draftId,
    p_submission_id: input.submissionId,
    p_kind: input.kind,
    p_filename: input.filename,
    p_size_bytes: input.sizeBytes ?? null,
    p_hash: input.hash ?? null,
  });
  if (error) {
    appendLocal(localRow);
    throw new Error(`export_audit_failed: ${error.message}`);
  }
  if (!data || typeof data !== 'object') throw new Error('export_rpc_empty_response');
  const row = data as unknown as SetupExportRow;
  appendLocal(row);
  return row;
}

export async function listExports(
  filter: { draftId?: string | null; submissionId?: string | null } = {},
): Promise<SetupExportRow[]> {
  const local = readLocal().exports
    .filter((row) => (filter.draftId ? row.draft_id === filter.draftId : true))
    .filter((row) => (filter.submissionId ? row.submission_id === filter.submissionId : true));

  const draftId = filter.draftId ?? null;
  const token = getDraftAccessToken(draftId);
  const sb = await getSupabaseAsync();
  let remote: SetupExportRow[] = [];
  if (sb && draftId && token) {
    const { data, error } = await sb.rpc('list_exports_by_token', {
      p_token: token,
      p_draft_id: draftId,
      p_limit: 100,
    });
    if (error) throw new Error(`export_list_failed: ${error.message}`);
    if (Array.isArray(data)) remote = data as unknown as SetupExportRow[];
  }

  const merged = new Map<string, SetupExportRow>();
  local.forEach((row) => merged.set(row.id, row));
  remote
    .filter((row) => (filter.submissionId ? row.submission_id === filter.submissionId : true))
    .forEach((row) => merged.set(row.id, row));
  return [...merged.values()].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
