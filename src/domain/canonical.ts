import {createHash} from 'node:crypto';
/** Canonicalization for this API's JSON-only payloads; not a general RFC 8785 implementation. */
export function canonicalJson(value:unknown):string{
  if(value===null)return 'null';
  if(typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(canonicalJson).join(',')+']';
  if(typeof value==='object'&&Object.getPrototypeOf(value)===Object.prototype){
    const object=value as Record<string,unknown>;
    return '{'+Object.keys(object).sort().map(key=>JSON.stringify(key)+':'+canonicalJson(object[key])).join(',')+'}';
  }
  throw new TypeError('Somente valores JSON finitos são permitidos.');
}
export function requestHash(value:unknown):string{return createHash('sha256').update(canonicalJson(value)).digest('hex');}
export function secretHash(value:string):string{return createHash('sha256').update(value,'utf8').digest('hex');}
