import {createPublicKey,verify,timingSafeEqual,createHash} from 'node:crypto';
import {types} from 'node:util';
import {HelpdeskError} from '../domain/errors.ts';
import {parseIdentityNamespace,parseIdentityObservation,type IdentityObservation} from '../domain/external-identity.ts';
import {isCanonicalInstant,zonedInstantMicros} from '../../shared/instant.js';
const invalid=()=>new HelpdeskError(401,'oidc_token_invalid','A confirmação de identidade não é válida para este fluxo.');
function object(raw:unknown):Record<string,unknown>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||types.isProxy(raw)||Object.getPrototypeOf(raw)!==Object.prototype)throw invalid();
 const out:Record<string,unknown>={};for(const key of Reflect.ownKeys(raw)){
  if(typeof key!=='string')throw invalid();const d=Object.getOwnPropertyDescriptor(raw,key);if(!d||!d.enumerable||!Object.hasOwn(d,'value'))throw invalid();Object.defineProperty(out,key,{value:d.value,enumerable:true});
 }return out;
}
function bytes(raw:unknown,max:number):Buffer{
 if(typeof raw!=='string'||!raw||raw.length>max||!/^[A-Za-z0-9_-]+$/.test(raw))throw invalid();
 const result=Buffer.from(raw,'base64url');if(result.toString('base64url')!==raw)throw invalid();return result;
}
function json(part:string,max:number):Record<string,unknown>{return object(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes(part,max))));}
function equal(a:string,b:string):boolean{return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());}
/** Restricted RS256 code-flow verifier. Cryptography is node:crypto, never a
 * decoded-claim assertion. No discovery or token-directed jku/x5u is performed.
 * JWKS MUST come from the server-configured, TLS-validated issuer endpoint.
 * This verifies an ID token; it does not prove ownership of a browser login flow.
 */
export function verifyOidcIdToken(token:unknown,jwks:unknown,expected:{issuer:string;clientId:string;nonce:string;at:string;mode?:'refresh';subject?:string}):IdentityObservation{
 try{
  const namespace=parseIdentityNamespace({issuer:expected.issuer,clientId:expected.clientId});
  if(!isCanonicalInstant(expected.at)||typeof expected.nonce!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(expected.nonce)||typeof token!=='string'||token.length>16384)throw invalid();
  const parts=token.split('.');if(parts.length!==3)throw invalid();
  const header=json(parts[0]!,2048),claims=json(parts[1]!,12288),signature=bytes(parts[2],2048);
  if(Object.keys(header).some(k=>!['alg','kid','typ'].includes(k))||header.alg!=='RS256'||header.typ!==undefined&&header.typ!=='JWT'||typeof header.kid!=='string'||!header.kid||header.kid.length>160)throw invalid();
  const set=object(jwks);if(Object.keys(set).some(k=>k!=='keys')||!Array.isArray(set.keys)||types.isProxy(set.keys)||set.keys.length<1||set.keys.length>20)throw invalid();
  const keys=set.keys.map(object),matching=keys.filter(k=>k.kid===header.kid);if(matching.length!==1)throw invalid();const key=matching[0]!;
  if(key.kty!=='RSA'||key.alg!==undefined&&key.alg!=='RS256'||key.use!==undefined&&key.use!=='sig'||['d','p','q','dp','dq','qi','oth','k'].some(k=>Object.hasOwn(key,k)))throw invalid();
  if(key.key_ops!==undefined&&(!Array.isArray(key.key_ops)||key.key_ops.length!==1||key.key_ops[0]!=='verify'))throw invalid();
  const n=bytes(key.n,1366),e=bytes(key.e,8);if(n.length<256||n.length>1024||e.length>4)throw invalid();
  const publicKey=createPublicKey({key:{kty:'RSA',n:key.n as string,e:key.e as string},format:'jwk'});
  const bits=publicKey.asymmetricKeyDetails?.modulusLength;if(!bits||bits<2048||bits>8192||signature.length!==Math.ceil(bits/8))throw invalid();
  if(!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),publicKey,signature))throw invalid();
  if(claims.iss!==namespace.issuer||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>255||!/^[\x20-\x7e]+$/.test(claims.sub))throw invalid();
  const audiences=typeof claims.aud==='string'?[claims.aud]:claims.aud;
  if(!Array.isArray(audiences)||!audiences.length||audiences.length>20||audiences.some(a=>typeof a!=='string')||new Set(audiences).size!==audiences.length||!audiences.includes(namespace.clientId))throw invalid();
  if(audiences.length>1&&claims.azp!==namespace.clientId||claims.azp!==undefined&&claims.azp!==namespace.clientId)throw invalid();
  if(expected.mode==='refresh'&&(typeof expected.subject!=='string'||claims.sub!==expected.subject))throw invalid();
  if(!(expected.mode==='refresh'&&claims.nonce===undefined)&&(typeof claims.nonce!=='string'||!equal(claims.nonce,expected.nonce)))throw invalid();
  if(!Number.isSafeInteger(claims.exp)||!Number.isSafeInteger(claims.iat))throw invalid();
  const at=zonedInstantMicros(expected.at)!,exp=BigInt(claims.exp as number)*1000000n,iat=BigInt(claims.iat as number)*1000000n;
  if(exp<=at||iat>at||exp<=iat||claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||BigInt(claims.nbf as number)*1000000n>at))throw invalid();
  return parseIdentityObservation({issuer:namespace.issuer,clientId:namespace.clientId,subject:claims.sub,asOf:expected.at,expiresAt:new Date(Number(claims.exp)*1000).toISOString()});
 }catch{throw invalid();}
}
