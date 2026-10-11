import {types} from 'node:util';
import {requestHash} from './canonical.ts';
import {HelpdeskError} from './errors.ts';
import {uuidIdentifier} from './input-values.ts';
import {compareInstants,isCanonicalInstant} from '../../shared/instant.js';

/** Identity coordinates, not authentication or permission. Never normalize issuer/sub. */
export type ExternalIdentityRef=Readonly<{issuer:string;subject:string}>;
export type IdentityNamespace=Readonly<{issuer:string;clientId:string}>;
export type ExternalIdentityOrigin=Readonly<ExternalIdentityRef&{kind:'external';identityId:string}>;
export type HumanIdentityOrigin=Readonly<{kind:'supabase';userId:string}>|ExternalIdentityOrigin;
export type ExternalIdentityRegistration=Readonly<{
 principalId:string;principalKind:'human';revision:string;active:boolean;principalActive:boolean;origin:ExternalIdentityOrigin;
}>;
/** Normalized output of a TRUSTED verifier port. Parsing this does not verify a token. */
export type IdentityObservation=Readonly<ExternalIdentityRef&{
 clientId:string;asOf:string;expiresAt:string;
}>;
const invalid=()=>new HelpdeskError(400,'external_identity_data_invalid',
 'Dados de identidade externa inválidos. Nenhum vínculo foi criado.');

function data(input:unknown):Record<string,unknown>{
 if(!input||typeof input!=='object'||types.isProxy(input)||Array.isArray(input))throw invalid();
 const proto=Object.getPrototypeOf(input);
 if(proto!==Object.prototype&&proto!==null)throw invalid();
 const output:Record<string,unknown>=Object.create(null);
 for(const key of Reflect.ownKeys(input)){
  if(typeof key!=='string')throw invalid();
  const d=Object.getOwnPropertyDescriptor(input,key)!;
  if(!d.enumerable||!Object.hasOwn(d,'value'))throw invalid();
  output[key]=d.value;
 }
 return output;
}
function fields(input:unknown,keys:readonly string[]):Record<string,unknown>{
 const result=data(input),names=Object.keys(result);
 if(names.length!==keys.length||names.some(k=>!keys.includes(k)))throw invalid();
 return result;
}
function issuer(value:unknown):string{
 if(typeof value!=='string'||value.length>2048||!/^https:\/\/[^/?#]+(?:\/[^?#]*)?$/.test(value)
   ||/[^\x21-\x7e]|\\/.test(value))throw invalid();
 const url=new URL(value);
 if(url.protocol!=='https:'||!url.hostname||url.username||url.password)throw invalid();
 // Deliberately return the original representation. No discovery, DNS or HTTP here.
 return value;
}
function subject(value:unknown):string{
 if(typeof value!=='string'||value.length>255||!/^[\x20-\x7e]+$/.test(value))throw invalid();
 return value;
}
function clientId(value:unknown):string{
 if(typeof value!=='string'||value.length>200||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value))throw invalid();
 return value;
}
function parse<T>(work:()=>T):T{try{return work();}catch{throw invalid();}}
export function parseExternalIdentityRef(input:unknown):ExternalIdentityRef{
 return parse(()=>{const v=fields(input,['issuer','subject']);return Object.freeze({issuer:issuer(v.issuer),subject:subject(v.subject)});});
}
/** Domain-separated key for exact storage lookup, NOT a secret, signature or bearer. */
export function externalIdentityKey(input:unknown):string{
 const v=parseExternalIdentityRef(input);return requestHash(['helpdesk-external-identity-v1',v.issuer,v.subject]);
}
export function parseIdentityNamespace(input:unknown):IdentityNamespace{
 return parse(()=>{const v=fields(input,['issuer','clientId']);return Object.freeze({issuer:issuer(v.issuer),clientId:clientId(v.clientId)});});
}
export function parseHumanIdentityOrigin(input:unknown):HumanIdentityOrigin{
 return parse(()=>{
  const v=data(input);
  if(v.kind==='supabase'){
   fields(v,['kind','userId']);return Object.freeze({kind:'supabase',userId:uuidIdentifier(v.userId)});
  }
  if(v.kind==='external'){
   fields(v,['kind','identityId','issuer','subject']);
   return Object.freeze({kind:'external',identityId:uuidIdentifier(v.identityId),issuer:issuer(v.issuer),subject:subject(v.subject)});
  }
  throw invalid();
 });
}
export function parseExternalIdentityRegistration(input:unknown):ExternalIdentityRegistration{
 return parse(()=>{
  const v=fields(input,['principalId','principalKind','revision','active','principalActive','origin']);
  const origin=parseHumanIdentityOrigin(v.origin);
  if(v.principalKind!=='human'||origin.kind!=='external'||typeof v.active!=='boolean'||typeof v.principalActive!=='boolean'
    ||typeof v.revision!=='string'||!/^[1-9][0-9]{0,15}$/.test(v.revision)
    ||!Number.isSafeInteger(Number(v.revision)))throw invalid();
  return Object.freeze({principalId:uuidIdentifier(v.principalId),principalKind:'human',revision:v.revision,
   active:v.active,principalActive:v.principalActive,origin});
 });
}
export function parseIdentityObservation(input:unknown):IdentityObservation{
 return parse(()=>{
  const v=fields(input,['issuer','subject','clientId','asOf','expiresAt']);
  if(!isCanonicalInstant(v.asOf)||!isCanonicalInstant(v.expiresAt)||compareInstants(v.asOf,v.expiresAt)>=0)throw invalid();
  return Object.freeze({issuer:issuer(v.issuer),subject:subject(v.subject),clientId:clientId(v.clientId),
   asOf:v.asOf,expiresAt:v.expiresAt});
 });
}
