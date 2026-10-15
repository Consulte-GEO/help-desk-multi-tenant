import {createHash} from 'node:crypto';
import {HelpdeskError} from './errors.ts';

/** A bounded JSON profile, NOT a claim of full RFC 8785 or .NET qualification. */
export const HDA_CANONICAL_PROFILE = 'hda-cjson-v1' as const;
export const HDA_JSON_LIMITS = Object.freeze({bytes:65536,stringBytes:16384,depth:16,nodes:4096,keys:128,items:256});
export type RegistrationJson = null | boolean | number | string | readonly RegistrationJson[] | {readonly [key:string]:RegistrationJson};
export const registrationFailure = (code='registration_invalid_data',status=400) => new HelpdeskError(status,code,'Dados ou estado da operação cadastral incompatíveis.');
const bad = ():never => {throw registrationFailure();};
const forbiddenKeys = new Set(['__proto__','prototype','constructor']);
const validKey = (key:string) => /^[\x20-\x7e]{1,100}$/.test(key) && !forbiddenKeys.has(key);
function validString(value:string):boolean {
  if(value.includes('\0') || Buffer.byteLength(value,'utf8')>HDA_JSON_LIMITS.stringBytes) return false;
  for(let i=0;i<value.length;i++) {
    const code=value.charCodeAt(i);
    if(code>=0xd800&&code<=0xdbff) {const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))return false;}
    else if(code>=0xdc00&&code<=0xdfff) return false;
  }
  return true;
}
/** JSON-like input only. Never invoke accessors, silently drop fields or normalize IDs. */
export function copyRegistrationValue(raw:unknown):RegistrationJson {
  let nodes=0,bytes=0;const ancestors=new Set<object>();
  const spend=(amount:number)=>{bytes+=amount;if(bytes>HDA_JSON_LIMITS.bytes)bad();};
  const visit=(value:unknown,depth:number):RegistrationJson=>{
    if(++nodes>HDA_JSON_LIMITS.nodes||depth>HDA_JSON_LIMITS.depth)bad();
    if(value===null||typeof value==='boolean'){spend(value===null?4:value?4:5);return value;}
    if(typeof value==='string'){if(!validString(value))return bad();spend(Buffer.byteLength(JSON.stringify(value),'utf8'));return value;}
    if(typeof value==='number'){if(!Number.isSafeInteger(value)||Object.is(value,-0))return bad();spend(String(value).length);return value;}
    if(typeof value!=='object'||value===null||ancestors.has(value))bad();
    const obj=value as object;ancestors.add(obj);
    try {
      if(Array.isArray(obj)) {
        if(Object.getPrototypeOf(obj)!==Array.prototype||obj.length>HDA_JSON_LIMITS.items||Reflect.ownKeys(obj).length!==obj.length+1)bad();
        spend(2+Math.max(0,obj.length-1));const output:RegistrationJson[]=[];
        for(let i=0;i<obj.length;i++) {
          const p=Object.getOwnPropertyDescriptor(obj,String(i));
          if(!p||!p.enumerable||!Object.hasOwn(p,'value'))bad();
          output.push(visit(p!.value,depth+1));
        }
        return Object.freeze(output);
      }
      const proto=Object.getPrototypeOf(obj);if(proto!==Object.prototype&&proto!==null)bad();
      const keys=Reflect.ownKeys(obj);if(keys.length>HDA_JSON_LIMITS.keys)bad();spend(2+Math.max(0,keys.length-1));
      const output:Record<string,RegistrationJson>={};
      for(const key of keys) {
        if(typeof key!=='string'||!validKey(key))bad();
        const p=Object.getOwnPropertyDescriptor(obj,key);
        if(!p||!p.enumerable||!Object.hasOwn(p,'value'))bad();
        spend(Buffer.byteLength(JSON.stringify(key),'utf8')+1);output[key as string]=visit(p!.value,depth+1);
      }
      return Object.freeze(output);
    } finally {ancestors.delete(obj);}
  };
  try {const result=visit(raw,0);if(Buffer.byteLength(serialize(result),'utf8')>HDA_JSON_LIMITS.bytes)bad();return result;}
  catch {return bad();}
}
function serialize(value:RegistrationJson):string {
  if(value===null||typeof value!=='object')return JSON.stringify(value);
  if(Array.isArray(value))return '['+value.map(serialize).join(',')+']';
  const object=value as Readonly<Record<string,RegistrationJson>>;
  return '{'+Object.keys(object).sort().map(key=>JSON.stringify(key)+':'+serialize(object[key]!)).join(',')+'}';
}
export function canonicalRegistrationJson(raw:unknown):string {return serialize(copyRegistrationValue(raw));}
export function registrationHash(raw:unknown):string {return createHash('sha256').update(canonicalRegistrationJson(raw),'utf8').digest('hex');}

/** Strict, bounded parser: duplicate member names and ambiguous numeric forms are rejected.
 * Do not replace with JSON.parse followed by a reviver: a reviver cannot detect duplicates.
 */
export function parseRegistrationJson(raw:string|Uint8Array):RegistrationJson {
  try {
    let text:string;
    if(typeof raw==='string')text=raw;
    else if(raw instanceof Uint8Array) {
      if(raw.byteLength>HDA_JSON_LIMITS.bytes||raw[0]===0xef&&raw[1]===0xbb&&raw[2]===0xbf)bad();
      text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(raw);
    } else return bad();
    if(Buffer.byteLength(text,'utf8')>HDA_JSON_LIMITS.bytes)bad();
    let at=0,nodes=0;
    const whitespace=()=>{while(/[ \t\n\r]/.test(text[at]??'X'))at++;};
    const string=():string=>{
      const start=at;if(text[at++]!=='"')return bad();
      while(at<text.length) {
        const c=text[at++];
        if(c==='"') {const value=JSON.parse(text.slice(start,at));return typeof value==='string'&&validString(value)?value:bad();}
        if(c==='\\')at++;
      }
      return bad();
    };
    const value=(depth:number):RegistrationJson=>{
      whitespace();if(depth>HDA_JSON_LIMITS.depth||++nodes>HDA_JSON_LIMITS.nodes)bad();
      const c=text[at];
      if(c==='"')return string();
      if(c==='{') {
        at++;whitespace();const output:Record<string,RegistrationJson>={},seen=new Set<string>();
        if(text[at]==='}') {at++;return output;}
        for(;;) {
          whitespace();const key=string();if(!validKey(key)||seen.has(key)||seen.size>=HDA_JSON_LIMITS.keys)bad();seen.add(key);
          whitespace();if(text[at++]!==':')bad();output[key]=value(depth+1);whitespace();
          const end=text[at++];if(end==='}')return output;if(end!==',')return bad();
        }
      }
      if(c==='[') {
        at++;whitespace();const output:RegistrationJson[]=[];
        if(text[at]===']') {at++;return output;}
        for(;;) {
          if(output.length>=HDA_JSON_LIMITS.items)bad();output.push(value(depth+1));whitespace();
          const end=text[at++];if(end===']')return output;if(end!==',')return bad();
        }
      }
      for(const [literal,result] of [['true',true],['false',false],['null',null]] as const)if(text.startsWith(literal,at)){at+=literal.length;return result;}
      const match=/^-?(?:0|[1-9][0-9]*)/.exec(text.slice(at));if(!match)return bad();
      at+=match[0].length;const number=Number(match[0]);if(!Number.isSafeInteger(number)||Object.is(number,-0))bad();return number;
    };
    const result=value(0);whitespace();if(at!==text.length)bad();return copyRegistrationValue(result);
  }catch {return bad();}
}

export function registrationRecord(raw:unknown,keys:readonly string[]):Readonly<Record<string,RegistrationJson>> {
  const value=copyRegistrationValue(raw);
  if(!value||typeof value!=='object'||Array.isArray(value))return bad();
  const record=value as Readonly<Record<string,RegistrationJson>>;
  if(Object.keys(record).length!==keys.length||keys.some(key=>!Object.hasOwn(record,key)))return bad();
  return record;
}
export function registrationUuid(raw:unknown):string {
  if(typeof raw!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(raw))return bad();return raw;
}
export function registrationRef(raw:unknown):string {
  if(typeof raw!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(raw))return bad();return raw;
}
export function registrationRevision(raw:unknown,min=1):number {
  if(typeof raw!=='number'||!Number.isSafeInteger(raw)||raw<min||Object.is(raw,-0))return bad();return raw;
}
export function registrationDigest(raw:unknown):string {
  if(typeof raw!=='string'||!/^[a-f0-9]{64}$/.test(raw))return bad();return raw;
}
export function registrationText(raw:unknown,max=2000):string {
  if(typeof raw!=='string'||!raw.trim()||raw.length>max||!validString(raw)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw))return bad();return raw;
}
/** Canonical UTC instants (milliseconds). Never normalize invalid calendar dates. */
export function registrationInstant(raw:unknown):string {
  if(typeof raw!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(raw))return bad();
  const time=Date.parse(raw);if(!Number.isFinite(time)||new Date(time).toISOString()!==raw)return bad();return raw;
}
