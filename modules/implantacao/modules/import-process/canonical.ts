/** Portable, dependency-free contracts. No auth, storage or operational approval. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export class ProcessError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = 'ProcessError'; this.code = code; }
}
export function fail(code: string): never { throw new ProcessError(code); }
export const MAX_JSON_BYTES = 1024 * 1024;
const encode = new TextEncoder();
function validText(s: string): boolean {
  if (s.includes('\0')) return false;
  for (let i = 0; i < s.length; i++) {
    const n = s.charCodeAt(i);
    if (n >= 0xd800 && n <= 0xdbff) {
      const next = s.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
    } else if (n >= 0xdc00 && n <= 0xdfff) return false;
  }
  return true;
}
/** Rejects lossy JSON, getters, prototypes, sparse arrays and excessive depth/size. */
export function canonicalJson(value: unknown, maxBytes = MAX_JSON_BYTES): string {
  if (!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>16*MAX_JSON_BYTES) fail('JSON_LIMIT');
  const seen = new Set<object>(); let nodes = 0, stringBytes = 0;
  const walk = (v: unknown, depth: number): Json => {
    if (++nodes > 100000 || depth > 32) fail('JSON_LIMIT');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') { if (!Number.isFinite(v)) fail('INVALID_JSON'); return Object.is(v,-0) ? 0 : v; }
    if (typeof v === 'string') {
      if (!validText(v)) fail('INVALID_JSON');
      stringBytes += encode.encode(v).length;
      if (stringBytes > maxBytes) fail('JSON_LIMIT');
      return v;
    }
    if (typeof v !== 'object') fail('INVALID_JSON');
    if (seen.has(v)) fail('INVALID_JSON_CYCLE');
    seen.add(v);
    try {
      const desc = Object.getOwnPropertyDescriptors(v);
      if (Object.getOwnPropertySymbols(v).length) fail('INVALID_JSON');
      if (Array.isArray(v)) {
        if (v.length > 20000 || Object.keys(desc).length !== v.length + 1) fail('JSON_LIMIT');
        const out: Json[] = [];
        for (let i=0;i<v.length;i++) {
          const d=desc[String(i)];
          if (!d || !('value' in d) || !d.enumerable) fail('INVALID_JSON');
          out.push(walk(d.value,depth+1));
        }
        return out;
      }
      if (![Object.prototype,null].includes(Object.getPrototypeOf(v))) fail('INVALID_JSON');
      const out: { [key:string]:Json }=Object.create(null);
      for (const key of Object.keys(desc).sort()) {
        const d=desc[key]!;
        if (!('value' in d) || !d.enumerable || !validText(key)) fail('INVALID_JSON');
        stringBytes += encode.encode(key).length;
        if (stringBytes > maxBytes) fail('JSON_LIMIT');
        out[key]=walk(d.value,depth+1);
      }
      return out;
    } finally { seen.delete(v); }
  };
  const text=JSON.stringify(walk(value,0));
  if (encode.encode(text).length > maxBytes) fail('JSON_LIMIT');
  return text;
}
export function copyJson<T>(value: T, maxBytes = MAX_JSON_BYTES): T { return JSON.parse(canonicalJson(value,maxBytes)) as T; }
export async function contentHash(value: unknown): Promise<string> {
  const hash=await globalThis.crypto.subtle.digest('SHA-256',encode.encode(canonicalJson(value)));
  return Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
}
export function record(value: unknown, keys: readonly string[]): Record<string,unknown> {
  if (!value || typeof value!=='object' || Array.isArray(value) ||
      Object.keys(value).length!==keys.length || keys.some(k=>!Object.hasOwn(value,k))) fail('INVALID_SHAPE');
  return value as Record<string,unknown>;
}
export function text(value:unknown,min=1,max=256): string {
  if (typeof value!=='string' || value.length<min || value.length>max || !validText(value)) fail('INVALID_TEXT');
  return value;
}
export function uuid(value:unknown):string {
  const s=text(value,36,36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(s)) fail('INVALID_UUID');
  return s;
}
export function sha(value:unknown):string {
  const s=text(value,64,64);if(!/^[a-f0-9]{64}$/.test(s)) fail('INVALID_HASH');return s;
}
export function integer(value:unknown,min=0,max=2147483646):number {
  if (typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max) fail('INVALID_INTEGER');return value;
}
export function enumValue<T extends string>(value:unknown,values:readonly T[]):T {
  if (typeof value!=='string'||!values.includes(value as T)) fail('INVALID_ENUM');return value as T;
}
export interface Locator { artifactId:string; sheet?:string; row?:number; page?:number; }
export interface CanonicalField {
  rawValue:null|string|number|boolean; rawUnit:string|null;
  value:null|string|number|boolean; unit:string|null;
  presence:'present'|'absent'|'illegible'|'not_applicable';
  provenance:'source'|'normalized'|'proposed'|'customer_confirmed'|'operator_corrected'|'operational';
  semanticRole:'measured'|'specified'|'calculated'|'identifier'|'operational_placeholder';
  locations:Locator[];
}
function scalar(v:unknown): v is CanonicalField['value'] {return v===null||['string','number','boolean'].includes(typeof v);}
export function parseField(input:unknown):CanonicalField {
  const f=record(copyJson(input),['rawValue','rawUnit','value','unit','presence','provenance','semanticRole','locations']);
  if(!scalar(f.rawValue)||!scalar(f.value)) fail('INVALID_SCALAR');
  if(f.rawUnit!==null) text(f.rawUnit,0,32);if(f.unit!==null)text(f.unit,0,32);
  enumValue(f.presence,['present','absent','illegible','not_applicable']);
  enumValue(f.provenance,['source','normalized','proposed','customer_confirmed','operator_corrected','operational']);
  enumValue(f.semanticRole,['measured','specified','calculated','identifier','operational_placeholder']);
  if(f.presence!=='present' && f.value!==null || f.presence==='present' && f.value===null) fail('PRESENCE_VALUE_CONFLICT');
  if(f.value!==null && f.semanticRole==='measured' && ['proposed','operational'].includes(f.provenance as string)) fail('SEMANTIC_MEASUREMENT_CONFLICT');
  if(!Array.isArray(f.locations)||f.locations.length>100) fail('INVALID_LOCATIONS');
  for(const l of f.locations) {
    if(!l || typeof l!=='object'||Array.isArray(l)) fail('INVALID_LOCATOR');
    const keys=Object.keys(l);
    if(keys.some(k=>!['artifactId','sheet','row','page'].includes(k))) fail('INVALID_LOCATOR');
    uuid(l.artifactId);
    const tab=Object.hasOwn(l,'sheet')||Object.hasOwn(l,'row');
    if(tab) {text(l.sheet,1,256);integer(l.row,1,1048576);if(Object.hasOwn(l,'page'))fail('INVALID_LOCATOR');}
    else integer(l.page,1,100000);
  }
  if(f.value!==null && ['source','normalized'].includes(f.provenance as string) && !f.locations.length) fail('SOURCE_LOCATION_REQUIRED');
  return f as unknown as CanonicalField;
}
export interface CanonicalRecord {
  id:string;kind:'event'|'delivery'|'sample'|'specimen'|'result'|'structure';
  fields:Record<string,CanonicalField>;links:Record<string,string>;
}
export interface Snapshot {
  schemaVersion:'1';records:CanonicalRecord[];decisions:Json[];findings:Json[];artifactIds:string[];
}
/** Only a draft snapshot; decision contents do not grant access or approve an import. */
export function parseSnapshot(input:unknown):Snapshot {
  const s=record(copyJson(input),['schemaVersion','records','decisions','findings','artifactIds']);
  if(s.schemaVersion!=='1')fail('INVALID_SCHEMA');
  for(const k of ['records','decisions','findings','artifactIds'])if(!Array.isArray(s[k])||(s[k] as unknown[]).length>10000)fail('INVALID_ARRAY');
  const artifacts=(s.artifactIds as unknown[]).map(uuid);
  if(new Set(artifacts).size!==artifacts.length)fail('DUPLICATE_ARTIFACT');
  const records=(s.records as unknown[]).map(x=>{
    const r=record(x,['id','kind','fields','links']);text(r.id,1,2048);
    enumValue(r.kind,['event','delivery','sample','specimen','result','structure']);
    for(const key of ['fields','links'])if(!r[key]||typeof r[key]!=='object'||Array.isArray(r[key]))fail('INVALID_RECORD');
    for(const [name,v] of Object.entries(r.fields as Record<string,unknown>)) {
      text(name,1,100);const f=parseField(v);
      if(f.locations.some(l=>!artifacts.includes(l.artifactId)))fail('ARTIFACT_NOT_DECLARED');
      (r.fields as Record<string,CanonicalField>)[name]=f;
    }
    for(const [name,v] of Object.entries(r.links as Record<string,unknown>)){text(name,1,100);text(v,1,2048);}
    return r as unknown as CanonicalRecord;
  });
  const ids=new Set(records.map(r=>r.id));if(ids.size!==records.length)fail('DUPLICATE_SOURCE_ID');
  for(const r of records)for(const ref of Object.values(r.links))if(!ids.has(ref))fail('RECORD_REFERENCE_NOT_FOUND');
  return {...s,records,artifactIds:artifacts} as unknown as Snapshot;
}
