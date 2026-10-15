/**
 * authService · v5.22.28
 *
 * Wrapper sobre Supabase Auth para o painel de gestão. Funções
 * principais:
 *   - signIn(email, password)
 *   - signOut()
 *   - getCurrentUser()  (síncrono — para guards)
 *   - restoreSession()  (assíncrono — chamado no router beforeEach)
 *   - onAuthStateChange(cb)
 *
 * Sem auth real (Supabase ausente em dev), todas as funções retornam
 * `unauthorized` sem fingir sucesso. Painel de gestão NÃO precisa de
 * fallback local — é exclusivo da equipe.
 *
 * Migração futura para .NET 8 + OpenIddict:
 *  - signIn vira `POST /api/auth/login` retornando JWT
 *  - getCurrentUser lê do localStorage o JWT
 *  - restoreSession verifica `exp` do JWT
 *  - onAuthStateChange vira event emitter próprio
 */

import { getSupabaseAsync, SUPABASE_CONFIGURED } from './supabaseClient';

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

export interface SignInResult {
  ok: boolean;
  user?: AdminUser;
  error?: string;
}

let cachedUser: AdminUser | null = null;

function toAdminUser(authUser: {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): AdminUser {
  return {
    id: authUser.id,
    email: authUser.email || '',
    displayName:
      (authUser.user_metadata?.display_name as string) ||
      (authUser.email || '').split('@')[0] ||
      'Admin',
    isAdmin: (authUser.app_metadata?.is_admin as boolean) === true,
  };
}

/** Síncrono: devolve o usuário em cache (vindo do último restoreSession). */
export function getCurrentUser(): AdminUser | null {
  return cachedUser;
}

/**
 * Faz login com email + senha. Atualiza o cache local.
 */
export async function signIn(
  email: string,
  password: string,
): Promise<SignInResult> {
  if (!SUPABASE_CONFIGURED) {
    return {
      ok: false,
      error:
        'Supabase não configurado em dev. O painel admin exige credenciais reais.',
    };
  }
  const sb = await getSupabaseAsync();
  if (!sb) return { ok: false, error: 'supabase_client_unavailable' };

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data?.user) {
      return { ok: false, error: 'sem_usuario_na_resposta' };
    }
    const u = toAdminUser(data.user);
    if (!u.isAdmin) {
      // Não é admin — desloga imediatamente para não vazar sessão
      await sb.auth.signOut();
      return { ok: false, error: 'usuario_sem_permissao_admin' };
    }
    cachedUser = u;
    return { ok: true, user: u };
  } catch (err) {
    return { ok: false, error: `exception: ${String(err).slice(0, 200)}` };
  }
}

/**
 * Desloga. Limpa cache local + sessão Supabase.
 */
export async function signOut(): Promise<void> {
  cachedUser = null;
  if (!SUPABASE_CONFIGURED) return;
  const sb = await getSupabaseAsync();
  if (!sb) return;
  try {
    await sb.auth.signOut();
  } catch {
    /* sem alerta — usuário já está deslogado do ponto de vista local */
  }
}

/**
 * Restaura sessão do storage do Supabase Auth (executado no router
 * beforeEach ou no mount do App). Devolve true se há um admin válido.
 */
export async function restoreSession(): Promise<AdminUser | null> {
  if (!SUPABASE_CONFIGURED) {
    cachedUser = null;
    return null;
  }
  const sb = await getSupabaseAsync();
  if (!sb) {
    cachedUser = null;
    return null;
  }
  try {
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) {
      cachedUser = null;
      return null;
    }
    const u = toAdminUser(data.user);
    if (!u.isAdmin) {
      // Sessão válida mas usuário não é admin — limpa
      await sb.auth.signOut();
      cachedUser = null;
      return null;
    }
    cachedUser = u;
    return u;
  } catch {
    cachedUser = null;
    return null;
  }
}

/**
 * Inscreve callback no evento de mudança de sessão. Retorna unsubscribe.
 * Usado pelo Vuex/store para reagir a logout em outra aba, expiração
 * de token, etc.
 */
export async function onAuthStateChange(
  cb: (user: AdminUser | null) => void,
): Promise<() => void> {
  if (!SUPABASE_CONFIGURED) return () => {};
  const sb = await getSupabaseAsync();
  if (!sb) return () => {};

  const { data } = sb.auth.onAuthStateChange((_event, session) => {
    if (!session?.user) {
      cachedUser = null;
      cb(null);
      return;
    }
    const u = toAdminUser(session.user);
    if (!u.isAdmin) {
      cachedUser = null;
      cb(null);
      return;
    }
    cachedUser = u;
    cb(u);
  });

  return () => {
    try {
      data.subscription.unsubscribe();
    } catch {
      /* ignore */
    }
  };
}
