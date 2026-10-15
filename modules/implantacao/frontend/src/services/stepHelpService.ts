// services/stepHelpService.ts · v5.22.37
// CRUD da ajuda contextual por etapa + upload no Storage.
// v5.22.37: até 5 imagens por etapa (image_paths[]).

import { getSupabaseAsync, SUPABASE_CONFIGURED } from './supabaseClient';
import { extractYoutubeVideoId } from './youtubeService';

const BUCKET = 'step-help-images';

/** v5.22.37: limite de imagens por etapa. */
export const MAX_IMAGES_PER_STEP = 5;

export const STEP_KEYS = [
  'dados-basicos', 'estruturas', 'concretos', 'pecas',
  'usuarios', 'fornecedores', 'revisao',
] as const;

export type StepKey = (typeof STEP_KEYS)[number];

export const STEP_KEY_BY_ID: Record<number, StepKey> = {
  1: 'dados-basicos', 2: 'estruturas', 3: 'concretos', 4: 'pecas',
  5: 'usuarios', 6: 'fornecedores', 7: 'revisao',
};

export const STEP_LABELS: Record<StepKey, string> = {
  'dados-basicos': 'Etapa 1 · Dados básicos',
  'estruturas':    'Etapa 2 · Blocos e torres',
  'concretos':     'Etapa 3 · Concretos',
  'pecas':         'Etapa 4 · Pavimentos e peças',
  'usuarios':      'Etapa 5 · Usuários da obra',
  'fornecedores':  'Etapa 6 · Fornecedores',
  'revisao':       'Etapa 7 · Revisão e envio',
};

export interface StepHelp {
  id: string;
  step_key: string;
  youtube_url: string | null;
  youtube_video_id: string | null;
  /** v5.22.37: array de até 5 paths. Substitui image_path (deprecado). */
  image_paths: string[];
  /** @deprecated v5.22.37 — use image_paths. Mantido para leitura de dados antigos. */
  image_path: string | null;
  help_title: string | null;
  help_description: string | null;
  enabled: boolean;
  updated_by: string | null;
  updated_at: string;
}

/**
 * Normaliza o retorno do banco para sempre ter image_paths como array.
 * Cobre dados antigos que só tinham image_path (pré-migração 015).
 */
function normalizeRow(raw: Record<string, unknown>): StepHelp {
  let paths: string[] = Array.isArray(raw.image_paths)
    ? (raw.image_paths as string[]).filter((p) => !!p)
    : [];
  // Fallback: se array vazio mas há image_path antigo, usa ele
  if (paths.length === 0 && typeof raw.image_path === 'string' && raw.image_path) {
    paths = [raw.image_path];
  }
  return {
    id: String(raw.id ?? ''),
    step_key: String(raw.step_key ?? ''),
    youtube_url: (raw.youtube_url as string) ?? null,
    youtube_video_id: (raw.youtube_video_id as string) ?? null,
    image_paths: paths,
    image_path: (raw.image_path as string) ?? null,
    help_title: (raw.help_title as string) ?? null,
    help_description: (raw.help_description as string) ?? null,
    enabled: raw.enabled !== false,
    updated_by: (raw.updated_by as string) ?? null,
    updated_at: String(raw.updated_at ?? ''),
  };
}

/** Resolve a URL pública de um path. null se vazio. */
export async function resolveImageUrl(imagePath: string | null): Promise<string | null> {
  if (!imagePath) return null;
  const sb = await getSupabaseAsync();
  if (!sb) return null;
  const { data } = sb.storage.from(BUCKET).getPublicUrl(imagePath);
  return data?.publicUrl ?? null;
}

/**
 * v5.22.37: resolve URLs públicas de um array de paths, na ordem.
 * Paths que falharem são omitidos (não viram null no meio do array).
 */
export async function resolveImageUrls(imagePaths: string[]): Promise<string[]> {
  if (!imagePaths || imagePaths.length === 0) return [];
  const sb = await getSupabaseAsync();
  if (!sb) return [];
  const urls: string[] = [];
  for (const p of imagePaths) {
    if (!p) continue;
    const { data } = sb.storage.from(BUCKET).getPublicUrl(p);
    if (data?.publicUrl) urls.push(data.publicUrl);
  }
  return urls;
}

export async function listAllStepHelp(): Promise<StepHelp[]> {
  if (!SUPABASE_CONFIGURED) return [];
  const sb = await getSupabaseAsync();
  if (!sb) return [];
  const { data, error } = await sb.from('setup_step_help').select('*').order('step_key');
  if (error) throw new Error(`list_step_help_failed: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(normalizeRow);
}

export async function getStepHelp(stepKey: string): Promise<StepHelp | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const sb = await getSupabaseAsync();
  if (!sb) return null;
  const { data, error } = await sb.from('setup_step_help').select('*')
    .eq('step_key', stepKey).eq('enabled', true).maybeSingle();
  if (error) {
    console.warn('[stepHelp] getStepHelp falhou:', error.message);
    return null;
  }
  return data ? normalizeRow(data as Record<string, unknown>) : null;
}

export interface SaveStepHelpInput {
  step_key: string;
  youtube_url?: string | null;
  /** v5.22.37: array de paths (até 5). */
  image_paths?: string[];
  help_title?: string | null;
  help_description?: string | null;
  enabled?: boolean;
}

export async function saveStepHelp(input: SaveStepHelpInput): Promise<{ ok: boolean; error?: string }> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'supabase_off' };
  const sb = await getSupabaseAsync();
  if (!sb) return { ok: false, error: 'no_client' };
  const youtubeUrl = (input.youtube_url || '').trim() || null;
  const videoId = youtubeUrl ? extractYoutubeVideoId(youtubeUrl) : null;
  if (youtubeUrl && !videoId) return { ok: false, error: 'youtube_url_invalida' };

  const imagePaths = (input.image_paths ?? []).filter((p) => !!p).slice(0, MAX_IMAGES_PER_STEP);

  const payload = {
    step_key: input.step_key,
    youtube_url: youtubeUrl,
    youtube_video_id: videoId,
    image_paths: imagePaths,
    // Mantém image_path sincronizado com a 1ª imagem (compat leitura antiga)
    image_path: imagePaths[0] ?? null,
    help_title: (input.help_title || '').trim() || null,
    help_description: (input.help_description || '').trim() || null,
    enabled: input.enabled ?? true,
  };
  const { error } = await sb.from('setup_step_help').upsert(payload, { onConflict: 'step_key' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function uploadStepHelpImage(stepKey: string, file: File): Promise<{ ok: boolean; path?: string; error?: string }> {
  if (!SUPABASE_CONFIGURED) return { ok: false, error: 'supabase_off' };
  const sb = await getSupabaseAsync();
  if (!sb) return { ok: false, error: 'no_client' };
  if (!file.type.startsWith('image/')) return { ok: false, error: 'arquivo_nao_e_imagem' };
  if (file.size > 5 * 1024 * 1024) return { ok: false, error: 'imagem_maior_que_5mb' };
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.\-_]/g, '-').replace(/-+/g, '-').slice(-80);
  const path = `${stepKey}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

export async function deleteStepHelpImage(imagePath: string): Promise<void> {
  if (!imagePath) return;
  const sb = await getSupabaseAsync();
  if (!sb) return;
  await sb.storage.from(BUCKET).remove([imagePath]).catch(() => {});
}
