export function isCanonicalInstant(value: unknown): value is string;
export function canonicalInstant(value: unknown): string;
export function compareInstants(a: string, b: string): -1 | 0 | 1;
export function zonedInstantMicros(value: unknown): bigint | undefined;
