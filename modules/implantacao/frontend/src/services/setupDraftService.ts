/**
 * Persistência de rascunhos (`setup_drafts`). · v5.22.45
 *
 * V8: quando o Supabase está configurado, toda leitura/escrita remota passa
 * por RPCs `security definer` vinculadas a um token opaco por rascunho.
 * O navegador gera o token e guarda somente a associação id → token no
 * localStorage. A tabela não é acessada diretamente pelo papel `anon`.
 *
 * O cache local continua existindo como proteção contra queda de rede e como
 * modo de funcionamento quando o Supabase não está configurado.
 */

import type { SetupSnapshot } from '../models/setup.models';
import type { TechnicalJson } from '../models/technicalMapping.models';
import { getSupabaseAsync } from './supabaseClient';

const LS_KEY = 'consulte-geo.setup.drafts.v5';
const LS_LAST_DRAFT_KEY = 'consulte-geo.setup.last-draft.v1';
const LS_DRAFT_TOKENS_KEY = 'consulte-geo.setup.draft-tokens.v1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface SetupDraftRow {
  id: string;
  status: 'rascunho' | 'enviado' | 'devolvido' | 'implantado' | 'cancelado';
  obra_codigo: string;
  obra_nome: string;
  snapshot: SetupSnapshot;
  technical_json: TechnicalJson | null;
  updated_at: string;
  created_at: string;
}

export interface LastDraftPointer {
  id: string;
  obraNome: string;
  updatedAt: string;
}

interface LocalCache {
  drafts: Record<string, SetupDraftRow>;
}

interface DraftTokenCache {
  tokens: Record<string, string>;
}

function readLocal(): LocalCache {
  if (typeof window === 'undefined') return { drafts: {} };
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (!raw) return { drafts: {} };
    const parsed = JSON.parse(raw) as Partial<LocalCache>;
    return { drafts: parsed.drafts && typeof parsed.drafts === 'object' ? parsed.drafts : {} };
  } catch {
    return { drafts: {} };
  }
}

function writeLocal(cache: LocalCache): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(cache));
  } catch {
    /* ignora quota — a chamada remota continua sendo a fonte persistente */
  }
}

function readTokenCache(): DraftTokenCache {
  if (typeof window === 'undefined') return { tokens: {} };
  try {
    const raw = window.localStorage.getItem(LS_DRAFT_TOKENS_KEY);
    if (!raw) return { tokens: {} };
    const parsed = JSON.parse(raw) as Partial<DraftTokenCache>;
    const tokens: Record<string, string> = {};
    for (const [id, token] of Object.entries(parsed.tokens ?? {})) {
      if (UUID_RE.test(id) && typeof token === 'string' && UUID_RE.test(token)) {
        tokens[id] = token;
      }
    }
    return { tokens };
  } catch {
    return { tokens: {} };
  }
}

function writeTokenCache(cache: DraftTokenCache): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_DRAFT_TOKENS_KEY, JSON.stringify(cache));
  } catch {
    throw new Error('draft_token_storage_unavailable');
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeUuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Último fallback para ambientes legados sem Web Crypto. Mantém o formato
  // UUID aceito pelo Postgres; não é usado em navegadores modernos.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const n = Math.floor(Math.random() * 16);
    return (ch === 'x' ? n : (n & 0x3) | 0x8).toString(16);
  });
}

function putLocal(row: SetupDraftRow, previousId?: string | null): void {
  const cache = readLocal();
  if (previousId && previousId !== row.id) delete cache.drafts[previousId];
  const previous = cache.drafts[row.id];
  cache.drafts[row.id] = {
    ...row,
    created_at: previous?.created_at ?? row.created_at,
  };
  writeLocal(cache);
}

function buildLocalRow(
  snapshot: SetupSnapshot,
  technicalJson: TechnicalJson | null,
  draftId: string | null,
): SetupDraftRow {
  const id = draftId ?? makeUuid();
  const previous = readLocal().drafts[id];
  return {
    id,
    status: 'rascunho',
    obra_codigo: snapshot.metadata.obraId || '',
    obra_nome: snapshot.metadata.obraNome || '',
    snapshot,
    technical_json: technicalJson,
    updated_at: nowIso(),
    created_at: previous?.created_at ?? nowIso(),
  };
}

/** Retorna o token do rascunho possuído por este navegador. */
export function getDraftAccessToken(draftId: string | null | undefined): string | null {
  if (!draftId) return null;
  return readTokenCache().tokens[draftId] ?? null;
}

function rememberDraftAccessToken(draftId: string, token: string, previousId?: string | null): void {
  if (!UUID_RE.test(draftId) || !UUID_RE.test(token)) {
    throw new Error('invalid_draft_token_pair');
  }
  const cache = readTokenCache();
  if (previousId && previousId !== draftId) delete cache.tokens[previousId];
  cache.tokens[draftId] = token;
  writeTokenCache(cache);
}

/**
 * Importa um token recebido por link compartilhado. O link usa fragmento
 * (`#draft=...&token=...`), portanto o segredo não é enviado ao servidor web
 * nem entra no header Referer.
 */
export function importDraftAccessToken(draftId: string, token: string): void {
  if (!UUID_RE.test(draftId) || !UUID_RE.test(token)) {
    throw new Error('invalid_draft_share_token');
  }
  const current = getDraftAccessToken(draftId);
  if (current && current !== token) {
    throw new Error('draft_token_conflict');
  }
  rememberDraftAccessToken(draftId, token);
}

function ownedDraftTokens(): string[] {
  return [...new Set(Object.values(readTokenCache().tokens))].slice(0, 100);
}

class DraftPersistenceError extends Error {
  readonly localRow: SetupDraftRow;

  constructor(message: string, localRow: SetupDraftRow) {
    super(message);
    this.name = 'DraftPersistenceError';
    this.localRow = localRow;
  }
}

/**
 * Migra rascunhos salvos em versões anteriores para a forma atual.
 * A migração é somente em memória; um novo save persiste a forma atual.
 */
function migrateLegacySnapshot(snap: unknown): SetupSnapshot {
  if (!snap || typeof snap !== 'object') return snap as SetupSnapshot;
  const s = snap as SetupSnapshot & {
    metadata?: {
      modeloProjetoFields?: Record<string, unknown>;
      obraObservacoes?: string;
      createdBy?: Record<string, unknown>;
    };
    pecas?: Array<Record<string, unknown>>;
  };
  const mp = s.metadata?.modeloProjetoFields as Record<string, unknown> | undefined;
  if (mp && 'superestruturaDrywall' in mp && !('estruturaDrywall' in mp)) {
    mp.estruturaDrywall = mp.superestruturaDrywall;
    delete mp.superestruturaDrywall;
  }
  if (mp) {
    delete mp.versaoRegra;
    delete mp.estruturaDrywall;
  }
  if (s.metadata) {
    if (typeof s.metadata.obraObservacoes !== 'string') s.metadata.obraObservacoes = '';
    if (
      s.metadata.createdBy &&
      typeof (s.metadata.createdBy as Record<string, unknown>).telefone !== 'string'
    ) {
      (s.metadata.createdBy as Record<string, unknown>).telefone = '';
    }
  }
  if (Array.isArray(s.pecas)) {
    s.pecas.forEach((p) => {
      if (p && p.etapa === 'Superestrutura') p.etapa = 'Estrutura';
    });
  }
  return s as SetupSnapshot;
}

function migrateRow(row: SetupDraftRow | null): SetupDraftRow | null {
  if (!row) return row;
  return { ...row, snapshot: migrateLegacySnapshot(row.snapshot) };
}

function normalizeRemoteRow(data: unknown): SetupDraftRow {
  if (!data || typeof data !== 'object') throw new Error('draft_rpc_empty_response');
  const row = data as SetupDraftRow;
  if (!row.id || !UUID_RE.test(row.id)) throw new Error('draft_rpc_invalid_response');
  return migrateRow(row) as SetupDraftRow;
}

export async function saveDraft(
  snapshot: SetupSnapshot,
  technicalJson: TechnicalJson | null,
  draftId: string | null,
): Promise<SetupDraftRow> {
  // Salva primeiro no cache local: uma falha de rede nunca perde a edição.
  let localRow = buildLocalRow(snapshot, technicalJson, draftId);
  putLocal(localRow);

  let sb: Awaited<ReturnType<typeof getSupabaseAsync>>;
  try {
    sb = await getSupabaseAsync();
  } catch (err) {
    throw new DraftPersistenceError(
      `draft_client_failed: ${err instanceof Error ? err.message : String(err)}`,
      localRow,
    );
  }
  if (!sb) return migrateRow(localRow) as SetupDraftRow;

  const existingToken = getDraftAccessToken(draftId);
  // Um id legado sem token não pode ser reivindicado com segurança. Migra a
  // edição para um novo UUID local/remoto, preservando o snapshot.
  if (draftId && !existingToken) {
    localRow = buildLocalRow(snapshot, technicalJson, null);
    putLocal(localRow, draftId);
  }

  const token = existingToken ?? makeUuid();
  try {
    // Persiste a posse ANTES da chamada remota. Assim, um timeout depois do
    // INSERT não cria rascunho remoto órfão: a mesma dupla id/token é usada
    // no retry seguinte.
    rememberDraftAccessToken(localRow.id, token, draftId);

    const params = {
      p_token: token,
      p_draft_id: localRow.id as string | null,
      p_obra_codigo: snapshot.metadata.obraId || '',
      p_obra_nome: snapshot.metadata.obraNome || '',
      p_snapshot: snapshot,
      p_technical_json: technicalJson,
    };
    let { data, error } = await sb.rpc('upsert_draft_by_token', params);
    let usedLegacyCreateFallback = false;

    // Compatibilidade transitória com a definição da RPC aplicada antes da
    // migration 022: nela, o primeiro INSERT só era aceito com p_draft_id
    // nulo. A V8 atual prefere UUID gerado no navegador, mas consegue criar o
    // rascunho remoto antigo sem fabricar sucesso nem perder a posse do token.
    const canFallbackToServerId = !existingToken;
    const compatibilityError = error?.message ?? '';
    if (
      error &&
      canFallbackToServerId &&
      /draft_token_invalid|draft_id_required/i.test(compatibilityError)
    ) {
      const fallback = await sb.rpc('upsert_draft_by_token', {
        ...params,
        p_draft_id: null,
      });
      data = fallback.data;
      error = fallback.error;
      usedLegacyCreateFallback = !fallback.error;
    }
    if (error) throw new Error(`draft_save_failed: ${error.message}`);

    const row = normalizeRemoteRow(data);
    if (row.id !== localRow.id) {
      if (!usedLegacyCreateFallback) throw new Error('draft_rpc_id_mismatch');
      rememberDraftAccessToken(row.id, token, localRow.id);
      putLocal(row, localRow.id);
    } else {
      putLocal(row, draftId);
    }
    return row;
  } catch (err) {
    throw new DraftPersistenceError(
      err instanceof Error ? err.message : String(err),
      localRow,
    );
  }
}

export async function loadDraft(id: string): Promise<SetupDraftRow | null> {
  const local = migrateRow(readLocal().drafts[id] ?? null);
  const sb = await getSupabaseAsync();
  if (!sb) return local;

  const token = getDraftAccessToken(id);
  if (!token) return local;

  const { data, error } = await sb.rpc('get_draft_by_token', { p_token: token });
  if (error) {
    if (local) return local;
    throw new Error(`draft_load_failed: ${error.message}`);
  }
  if (!data) return local;

  const row = normalizeRemoteRow(data);
  if (row.id !== id) throw new Error('draft_token_id_mismatch');
  putLocal(row);
  return row;
}

export async function listDrafts(): Promise<SetupDraftRow[]> {
  const localRows = Object.values(readLocal().drafts).map(
    (row) => migrateRow(row) as SetupDraftRow,
  );
  const sb = await getSupabaseAsync();
  if (!sb) return localRows.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));

  const tokens = ownedDraftTokens();
  let remoteRows: SetupDraftRow[] = [];
  if (tokens.length) {
    const { data, error } = await sb.rpc('list_drafts_by_tokens', { p_tokens: tokens });
    if (error) throw new Error(`draft_list_failed: ${error.message}`);
    if (Array.isArray(data)) {
      remoteRows = data.map((row) => normalizeRemoteRow(row));
      remoteRows.forEach((row) => putLocal(row));
    }
  }

  const merged = new Map<string, SetupDraftRow>();
  localRows.forEach((row) => merged.set(row.id, row));
  remoteRows.forEach((row) => merged.set(row.id, row));
  return [...merged.values()].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

export async function deleteDraft(id: string): Promise<void> {
  const cancelLocalOnly = (): void => {
    const cache = readLocal();
    if (!cache.drafts[id]) return;
    cache.drafts[id].status = 'cancelado';
    cache.drafts[id].updated_at = nowIso();
    writeLocal(cache);
  };

  const sb = await getSupabaseAsync();
  const token = getDraftAccessToken(id);
  if (!sb || !token) {
    cancelLocalOnly();
    return;
  }

  // Com Supabase ativo, confirma primeiro no servidor. Assim uma falha de
  // rede/token não deixa o cache local marcado como cancelado enquanto a
  // linha remota continua editável.
  const { data, error } = await sb.rpc('cancel_draft_by_token', {
    p_token: token,
    p_draft_id: id,
  });
  if (error) throw new Error(`draft_cancel_failed: ${error.message}`);
  const row = normalizeRemoteRow(data);
  if (row.id !== id) throw new Error('draft_rpc_id_mismatch');
  putLocal(row);
}

export function getLastDraftPointer(): LastDraftPointer | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LS_LAST_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LastDraftPointer>;
    if (!parsed || typeof parsed.id !== 'string' || !parsed.id) return null;
    return {
      id: parsed.id,
      obraNome: typeof parsed.obraNome === 'string' ? parsed.obraNome : '',
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return null;
  }
}

export function setLastDraftPointer(pointer: LastDraftPointer): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_LAST_DRAFT_KEY, JSON.stringify(pointer));
  } catch {
    /* ponteiro é nice-to-have; o rascunho já está salvo */
  }
}

export function clearLastDraftPointer(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LS_LAST_DRAFT_KEY);
  } catch {
    /* idem */
  }
}

/** Variante noexcept usada pelo autosave. O cache local já foi escrito. */
export async function saveDraftSilent(
  snapshot: SetupSnapshot,
  technicalJson: TechnicalJson | null,
  draftId: string | null,
): Promise<SetupDraftRow | null> {
  try {
    return await saveDraft(snapshot, technicalJson, draftId);
  } catch (err) {
    if (err instanceof DraftPersistenceError) {
      return migrateRow(err.localRow);
    }
    return migrateRow(readLocal().drafts[draftId ?? ''] ?? null);
  }
}
