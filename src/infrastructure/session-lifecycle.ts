import {HelpdeskError} from '../domain/errors.ts';

export const SHORT_SESSION_PATTERN = /^hd_session_[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Require an explicit timezone; Date.parse alone also accepts ambiguous local dates.
const INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_SESSION_LIFETIME_MS = 10 * 60 * 1000;
export const invalidSessionResult = () => new HelpdeskError(503, 'invalid_session_result',
  'Resposta inválida do serviço de sessão. Nenhum acesso foi concedido.');

/** Validate the private SQL boundary instead of asserting a TypeScript cast. */
export function sessionResult(value: unknown, now: Date): {workspaceId: string; expiresAt: string} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidSessionResult();
  const {workspaceId, expiresAt} = value as Record<string, unknown>;
  if (typeof workspaceId !== 'string' || !UUID_PATTERN.test(workspaceId) ||
      typeof expiresAt !== 'string' || !INSTANT_PATTERN.test(expiresAt)) throw invalidSessionResult();
  const expiry = Date.parse(expiresAt), current = now.getTime();
  if (!Number.isFinite(current) || !Number.isFinite(expiry) ||
      expiry <= current || expiry - current > MAX_SESSION_LIFETIME_MS) throw invalidSessionResult();
  // Only project the public contract; never spread a private database record.
  return {workspaceId: workspaceId.toLowerCase(), expiresAt: new Date(expiry).toISOString()};
}
