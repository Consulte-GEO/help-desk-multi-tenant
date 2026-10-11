import {HelpdeskError} from './errors.ts';
import {isPersistableText, uuidIdentifier} from './input-values.ts';

/** Generic source selector, NOT a permission, identity, binding or VerifiedRequestScope. */
export type ExternalResourceRef = Readonly<{
  connectionId: string;
  tenantId: string;
  type: string;
  id: string;
}>;

// Technical bounds for this local contract, not approved source API limits or quotas.
const REQUEST_LIMIT = 100;
const COVERAGE_LIMIT = 1000;
const FIELDS = ['connectionId', 'tenantId', 'type', 'id'] as const;
const invalid = () => new HelpdeskError(400, 'invalid_resource_selection',
  'Seleção de recursos inválida. Informe referências completas e um único contexto.');
const denied = () => new HelpdeskError(403, 'resource_scope_denied',
  'A seleção completa de recursos não está coberta pelo contexto consultado.');
const unavailable = () => new HelpdeskError(503, 'resource_scope_unavailable',
  'Não foi possível validar a cobertura dos recursos. Nenhum acesso foi concedido.');

/** Read exact own data fields, never execute a field getter or a toJSON method. */
function readFields(value: unknown): Record<typeof FIELDS[number], unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw invalid();
  const keys = Reflect.ownKeys(value);
  if (keys.length !== FIELDS.length || keys.some(key =>
    typeof key !== 'string' || !FIELDS.includes(key as typeof FIELDS[number]))) throw invalid();
  const result = {} as Record<typeof FIELDS[number], unknown>;
  for (const key of FIELDS) {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (!field || !Object.hasOwn(field, 'value') || !field.enumerable) throw invalid();
    result[key] = field.value;
  }
  return result;
}

function opaque(value: unknown): string {
  if (!isPersistableText(value) || !value.length || value.length > 256 ||
      value.trim() !== value || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) throw invalid();
  // Preserve case, leading zeroes, punctuation and Unicode composition EXACTLY.
  return value;
}

function readRef(value: unknown): ExternalResourceRef {
  const data = readFields(value);
  if (typeof data.type !== 'string' || !/^[a-z][a-z0-9_]{0,31}$/.test(data.type)) throw invalid();
  return Object.freeze({
    connectionId: uuidIdentifier(data.connectionId),
    tenantId: opaque(data.tenantId),
    type: data.type,
    id: opaque(data.id),
  });
}

function key(ref: ExternalResourceRef): string {
  return JSON.stringify([ref.connectionId, ref.tenantId, ref.type, ref.id]);
}

/** No concatenation with ambiguous delimiters, numeric coercion or source ID normalization. */
export function parseExternalResourceRef(value: unknown): ExternalResourceRef {
  try { return readRef(value); } catch { throw invalid(); }
}
export function externalResourceKey(value: unknown): string {
  return key(parseExternalResourceRef(value));
}

function readSelection(value: unknown, maximum: number, allowEmpty: boolean): readonly ExternalResourceRef[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) throw invalid();
  const length: unknown = Object.getOwnPropertyDescriptor(value, 'length')?.value;
  if (typeof length !== 'number' || !Number.isSafeInteger(length) ||
      length < (allowEmpty ? 0 : 1) || length > maximum ||
      Reflect.ownKeys(value).length !== length + 1) throw invalid();
  const refs: ExternalResourceRef[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) throw invalid();
    const ref = readRef(descriptor.value);
    const first = refs[0];
    if (first && (first.connectionId !== ref.connectionId || first.tenantId !== ref.tenantId)) throw invalid();
    const identity = key(ref);
    if (seen.has(identity)) throw invalid();
    seen.add(identity);
    refs.push(ref);
  }
  return Object.freeze(refs);
}

/** No empty/global default, mixed namespace, implicit deduplication or silent truncation. */
export function parseExternalResourceSelection(value: unknown): readonly ExternalResourceRef[] {
  try { return readSelection(value, REQUEST_LIMIT, false); } catch { throw invalid(); }
}

/** Canonical local set identity. Do not expose this key in URLs/logs or use it as authorization. */
export function externalResourceSelectionKey(value: unknown): string {
  return JSON.stringify(parseExternalResourceSelection(value).map(key).sort());
}

/**
 * Local all-or-nothing set check ONLY. `coverage` must eventually come from the
 * qualified, current backend source; matching arbitrary caller JSON proves NOTHING.
 * The full resolver still must authenticate the person, revalidate grants/binding/
 * operation/revision, and enforce SQL ACL before LIMIT, cursor, aggregate and replay.
 * No VerifiedRequestScope is issued, and no existing endpoint calls this helper.
 */
export function requireCompleteResourceCoverage(requested: unknown, coverage: unknown): readonly ExternalResourceRef[] {
  const selection = parseExternalResourceSelection(requested);
  let available: readonly ExternalResourceRef[];
  try { available = readSelection(coverage, COVERAGE_LIMIT, true); }
  catch { throw unavailable(); }
  // Validate the entire response before testing coverage, including rows not selected.
  // An empty valid response is no access; a corrupt response is not an empty grant.
  const keys = new Set(available.map(key));
  if (selection.some(ref => !keys.has(key(ref)))) throw denied();
  return selection;
}

/** Complete source coverage, including an explicit empty set. Never a ticket selection
 * or a source-authentication proof. Parsing preserves all entries; no truncation. */
export function parseExternalResourceCoverage(value: unknown): readonly ExternalResourceRef[] {
  try { return readSelection(value, COVERAGE_LIMIT, true); } catch { throw unavailable(); }
}
