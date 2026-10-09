import {isIP} from 'node:net';
import {requestHash} from '../../domain/canonical.ts';
import {HelpdeskError} from '../../domain/errors.ts';
import {isPersistableText} from '../../domain/input-values.ts';

/** Proposed local envelope, NOT the Novo GEO API or an operational approval. */
export type IntegrationManifestCandidate=Readonly<{
 schemaVersion:1;status:'candidate';system:'NOVO_GEO';
 issuer:string;clientId:string;redirectUri:string;apiOrigin:string;
 hosts:readonly string[];scopes:readonly string[];schemaHash:string;
 ownerRefs:Readonly<{identity:string;api:string;support:string;security:string}>;
 accessRevision:Readonly<{strategy:'per_request'|'source_revision';contractRef:string}>;
}>;
export type ValidatedIntegrationManifestCandidate=Readonly<{
 kind:'validated_candidate';liveAdapterAllowed:false;
 candidate:IntegrationManifestCandidate;fingerprint:string;
}>;
const invalid=()=>new HelpdeskError(400,'integration_manifest_invalid',
 'Manifesto candidato de integração inválido. Nenhum adaptador foi habilitado.');
const fields=['schemaVersion','status','system','issuer','clientId','redirectUri','apiOrigin','hosts','scopes','schemaHash','ownerRefs','accessRevision'] as const;

/** Accept JSON-shaped data only. Unknown/symbol/accessor properties are not read. */
function record(input:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw invalid();
 const prototype=Object.getPrototypeOf(input);
 if(prototype!==Object.prototype&&prototype!==null)throw invalid();
 const names=Reflect.ownKeys(input);
 if(names.length!==keys.length||names.some(k=>typeof k!=='string'||!keys.includes(k)))throw invalid();
 const output:Record<string,unknown>={};
 for(const key of keys){
  const property=Object.getOwnPropertyDescriptor(input,key);
  if(!property||!Object.hasOwn(property,'value')||!property.enumerable)throw invalid();
  output[key]=property.value;
 }
 return output;
}
function list(input:unknown,max:number):unknown[]{
 if(!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype)throw invalid();
 const length=Object.getOwnPropertyDescriptor(input,'length')?.value;
 if(!Number.isInteger(length)||length<1||length>max||Reflect.ownKeys(input).length!==length+1)throw invalid();
 const result:unknown[]=[];
 for(let i=0;i<length;i++){
  const property=Object.getOwnPropertyDescriptor(input,String(i));
  if(!property||!Object.hasOwn(property,'value')||!property.enumerable)throw invalid();
  result.push(property.value);
 }
 return result;
}
function text(value:unknown,max:number,pattern:RegExp):string{
 if(!isPersistableText(value)||!value.length||value.length>max||value.trim()!==value||!pattern.test(value))throw invalid();
 return value;
}
const ref=(value:unknown)=>text(value,160,/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);

/** Lexical hygiene only: no DNS, discovery, HTTP, TLS probe or SSRF safety claim. */
function https(value:unknown,originOnly=false):{exact:string;origin:string;path:string}{
 const exact=text(value,2048,/^[\x21-\x7e]+$/);
 if(/[?#%\\]/.test(exact))throw invalid();
 const url=new URL(exact),parts=/^https:\/\/([^/]+)(\/.*)?$/.exec(exact);
 if(!parts||url.protocol!=='https:'||url.username||url.password||parts[1]!==url.host)throw invalid();
 const hostname=url.hostname;
 if(isIP(hostname)||hostname.length>253||!hostname.includes('.')||/(?:^|\.)(?:localhost|local|internal)$/.test(hostname)||hostname.endsWith('.home.arpa'))throw invalid();
 if(!hostname.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))||!/[a-z]/.test(hostname.split('.').at(-1)!))throw invalid();
 const path=parts[2]??'';
 // Refuse normalizations rather than changing an issuer or callback identity silently.
 if(exact!==url.origin+path||url.pathname!==(path||'/')||(originOnly&&path!==''))throw invalid();
 return {exact,origin:url.origin,path};
}
/** This result is intentionally NOT ApprovedIntegrationManifest. CG-01 real acceptance is still required. */
export function validateIntegrationManifest(input:unknown):ValidatedIntegrationManifestCandidate{
 try{
  const source=record(input,fields);
  if(source.schemaVersion!==1||source.status!=='candidate'||source.system!=='NOVO_GEO')throw invalid();
  const issuer=https(source.issuer),redirect=https(source.redirectUri),api=https(source.apiOrigin,true);
  if(!redirect.path||redirect.path==='/')throw invalid();
  const hosts=list(source.hosts,8).map(value=>https(value,true).exact);
  const referenced=new Set([issuer.origin,redirect.origin,api.origin]);
  if(new Set(hosts).size!==hosts.length||hosts.length!==referenced.size||hosts.some(host=>!referenced.has(host)))throw invalid();
  const scopes=list(source.scopes,32).map(value=>text(value,100,/^[\x21\x23-\x5b\x5d-\x7e]+$/));
  if(!scopes.includes('openid')||new Set(scopes).size!==scopes.length)throw invalid();
  const owners=record(source.ownerRefs,['identity','api','support','security']);
  const revision=record(source.accessRevision,['strategy','contractRef']);
  if(revision.strategy!=='per_request'&&revision.strategy!=='source_revision')throw invalid();
  const candidate:IntegrationManifestCandidate=Object.freeze({
   schemaVersion:1,status:'candidate',system:'NOVO_GEO',issuer:issuer.exact,
   clientId:text(source.clientId,200,/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
   redirectUri:redirect.exact,apiOrigin:api.exact,hosts:Object.freeze(hosts),scopes:Object.freeze(scopes),
   schemaHash:text(source.schemaHash,64,/^[a-f0-9]{64}$/),
   ownerRefs:Object.freeze({identity:ref(owners.identity),api:ref(owners.api),support:ref(owners.support),security:ref(owners.security)}),
   accessRevision:Object.freeze({strategy:revision.strategy,contractRef:ref(revision.contractRef)})
  });
  return Object.freeze({kind:'validated_candidate',liveAdapterAllowed:false,candidate,
   fingerprint:requestHash(candidate)});
 }catch{
  // Never return URL credentials, unknown field names or raw parser/proxy exceptions.
  throw invalid();
 }
}
