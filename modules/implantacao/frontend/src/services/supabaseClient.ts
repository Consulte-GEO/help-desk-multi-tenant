/**
 * Cliente Supabase para o protótipo publicado em setup.consultegeo.org. · v5.18
 *
 * Supabase é apenas a persistência do protótipo. O contrato técnico continua
 * migrável para o backend oficial .NET 8 + SQL Server.
 *
 * Variáveis esperadas (Vite, prefixo VITE_):
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   VITE_APP_ENV
 *   VITE_APP_NAME
 *
 * v5.18 — Code-split: `@supabase/supabase-js` agora é carregado via dynamic
 * import só quando algum service precisa do cliente. Antes era ~52 KB gzip
 * eager no first-load; agora é lazy. O hit acontece na 1ª chamada
 * (saveDraft, loadDraft, listDrafts, recordAudit, etc) e fica em cache
 * via memoização da Promise.
 *
 * Como `import.meta.env.VITE_*` continua sendo estático (Vite resolve em
 * build), `SUPABASE_CONFIGURED`, `APP_ENV` e `APP_NAME` permanecem como
 * exports síncronos sem depender do módulo Supabase.
 */

// Tipo importado em modo type-only — não vai pro bundle.
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Lê variáveis de ambiente tanto em build Vite (import.meta.env) quanto
 * em runtime Node/tsx (process.env). Necessário porque o smoke-pipeline
 * roda em Node puro e tropeçava em `import.meta.env` indefinido.
 *
 * Acessamos `process` via globalThis para não exigir @types/node no
 * frontend (vue-tsc ainda passa). Em build Vite, `process` é tree-shaken.
 */
function readEnv(key: string): string | undefined {
  try {
    const meta = import.meta as unknown as { env?: Record<string, unknown> };
    const v = meta.env?.[key];
    if (typeof v === 'string') return v;
  } catch {/* nada */}
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  if (proc?.env && typeof proc.env[key] === 'string') {
    return proc.env[key];
  }
  return undefined;
}

const url = readEnv('VITE_SUPABASE_URL')?.trim();
const anonKey = readEnv('VITE_SUPABASE_ANON_KEY')?.trim();

export const SUPABASE_CONFIGURED = Boolean(url && anonKey);

export const APP_ENV = (readEnv('VITE_APP_ENV') ?? 'preview').toString();
export const APP_NAME = (readEnv('VITE_APP_NAME') ?? 'Implantacao Consulte GEO').toString();

/* ------------------------------------------------------------------ */
/* Lazy loader do @supabase/supabase-js                                */
/* ------------------------------------------------------------------ */

type SupabaseModule = typeof import('@supabase/supabase-js');
let supabaseModulePromise: Promise<SupabaseModule> | null = null;

function loadSupabaseModule(): Promise<SupabaseModule> {
  if (!supabaseModulePromise) {
    supabaseModulePromise = import('@supabase/supabase-js');
  }
  return supabaseModulePromise;
}

let _client: SupabaseClient | null = null;
let _warnedOnce = false;

/**
 * Retorna o cliente Supabase (ou `null` se as env vars não estão definidas
 * — o protótipo opera em modo local-only via localStorage nesse caso).
 *
 * **API assíncrona** desde v5.18. Use `await getSupabaseAsync()` em todos
 * os services. O custo da 1ª chamada é o download do chunk lazy
 * `vendor-supabase` (~52 KB gzip); chamadas subsequentes resolvem em
 * microssegundos (cliente memoizado).
 */
export async function getSupabaseAsync(): Promise<SupabaseClient | null> {
  if (!SUPABASE_CONFIGURED) {
    if (!_warnedOnce && typeof window !== 'undefined') {
      _warnedOnce = true;
      // eslint-disable-next-line no-console
      console.warn(
        '[supabaseClient] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY ausentes. ' +
          'O protótipo está operando em modo local (sem persistência remota).',
      );
    }
    return null;
  }
  if (_client) return _client;

  const { createClient } = await loadSupabaseModule();
  _client = createClient(url!, anonKey!, {
    auth: { persistSession: false },
    global: {
      headers: {
        'x-app-name': APP_NAME,
        'x-app-env': APP_ENV,
      },
    },
  });
  return _client;
}

/**
 * Pré-carrega o módulo Supabase sem instanciar o cliente. Pode ser
 * chamado oportunisticamente (ex.: quando o usuário começa a digitar
 * na Etapa 1) para esconder latência do 1º save.
 *
 * Falha silenciosa: se a rede engasgar, o save real refaz o download.
 */
export async function preloadSupabase(): Promise<void> {
  if (!SUPABASE_CONFIGURED) return;
  await loadSupabaseModule().catch(() => undefined);
}
