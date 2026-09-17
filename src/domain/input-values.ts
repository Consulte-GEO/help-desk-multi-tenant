import {HelpdeskError} from './errors.ts';

/** Persisted identifiers use canonical UUIDs; pure domain/demo fixtures may use aliases. */
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function uuidIdentifier(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new HelpdeskError(400, 'invalid_identifier', 'Informe um UUID no formato padrão.');
  }
  return value.toLowerCase();
}

/** PostgreSQL text cannot represent NUL. Lone UTF-16 surrogates are not Unicode scalars. */
export function isPersistableText(value: unknown): value is string {
  return typeof value === 'string' && !/[\u0000\p{Cs}]/u.test(value);
}
