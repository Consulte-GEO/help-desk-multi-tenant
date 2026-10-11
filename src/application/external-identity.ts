import {types} from 'node:util';
import {performance} from 'node:perf_hooks';
import {HelpdeskError} from '../domain/errors.ts';
import {parseExternalIdentityRef,parseExternalIdentityRegistration,parseIdentityNamespace,
 parseIdentityObservation,type ExternalIdentityRef,type IdentityNamespace,type IdentityObservation} from '../domain/external-identity.ts';
import {isCanonicalInstant,zonedInstantMicros} from '../../shared/instant.js';

/** Construction-time SERVER port. Its real adapter must verify the owned login
 * flow and cryptographic identity, including issuer, audience, expiry and the
 * applicable nonce/PKCE checks. This module does NOT implement an OIDC verifier.
 * Return null for refused evidence or the normalized IdentityObservation envelope.
 * Do not pass a client-supplied callback, decoded JWT or `verified:true` as this port.
 */
export interface ExternalIdentityVerifier {
 verify(evidence:unknown,namespace:IdentityNamespace,signal:AbortSignal):Promise<unknown>;
}
/** Read the exact pair and current registration + human status atomically.
 * Return [] or one normalized ExternalIdentityRegistration. Return two rows to
 * signal ambiguity; never choose the first duplicate. No auto-registration,
 * email fallback or grant assignment. The production SQL adapter is pending C03.
 */
export interface ExternalIdentityDirectory {
 lookup(reference:ExternalIdentityRef,signal:AbortSignal):Promise<unknown>;
}
export type ExternalIdentityMatch=Readonly<{
 kind:'external_identity_match';principalId:string;identityId:string;identityRevision:string;
 reference:ExternalIdentityRef;checkedAt:string;expiresAt:string;
}>;
export type ExternalIdentityResolverOptions={
 namespace:IdentityNamespace;verifier:ExternalIdentityVerifier;directory:ExternalIdentityDirectory;
 timeoutMs:number;maxObservationAgeMicros:bigint;clock?:()=>string;
};
const messages={
 configuration_invalid:[500,'Configuração da resolução de identidade inválida.'],
 unverified:[401,'A identidade não foi confirmada para esta origem.'],
 expired:[401,'A confirmação de identidade expirou ou está fora da janela permitida.'],
 not_linked:[403,'Identidade não disponível para este vínculo.'],
 ambiguous:[403,'Não foi possível determinar um vínculo único de identidade.'],
 verifier_invalid:[503,'Resposta inválida da verificação de identidade.'],
 verifier_unavailable:[503,'Verificação de identidade temporariamente indisponível.'],
 directory_invalid:[503,'Resposta inválida do diretório de identidades.'],
 directory_unavailable:[503,'Diretório de identidades temporariamente indisponível.'],
 clock_invalid:[503,'Não foi possível validar o instante da resolução de identidade.'],
 cancelled:[409,'Resolução de identidade cancelada.'],
 timeout:[503,'Prazo de resolução da identidade excedido.'],
} as const;
function failure(code:keyof typeof messages):HelpdeskError{
 const [status,message]=messages[code];return new HelpdeskError(status,'external_identity_'+code,message);
}
function rows(input:unknown):unknown[]{
 if(!Array.isArray(input)||types.isProxy(input)||Object.getPrototypeOf(input)!==Array.prototype)throw failure('directory_invalid');
 const count=Object.getOwnPropertyDescriptor(input,'length')?.value;
 if(!Number.isSafeInteger(count)||count<0||count>2||Reflect.ownKeys(input).length!==count+1)throw failure('directory_invalid');
 const result:unknown[]=[];
 for(let i=0;i<count;i++){
  const d=Object.getOwnPropertyDescriptor(input,String(i));
  if(!d||!d.enumerable||!Object.hasOwn(d,'value'))throw failure('directory_invalid');
  result.push(d.value);
 }
 return result;
}

/** Read-only identity matching, NOT a session issuer or an authorization guard.
 * The returned data is a receipt, not a portable proof and not a Principal.
 * Runtime wiring remains forbidden until source qualification and SQL upgrade.
 */
export function createExternalIdentityResolver(options:ExternalIdentityResolverOptions){
 let namespace:IdentityNamespace,verify:ExternalIdentityVerifier['verify'],lookup:ExternalIdentityDirectory['lookup'];
 let timeoutMs:number,maxAge:bigint,clock:()=>string;
 try{
  namespace=parseIdentityNamespace(options.namespace);
  if(typeof options.verifier?.verify!=='function'||typeof options.directory?.lookup!=='function'
    ||!Number.isSafeInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>5000
    ||typeof options.maxObservationAgeMicros!=='bigint'||options.maxObservationAgeMicros<=0n
    ||options.clock!==undefined&&typeof options.clock!=='function')throw Error();
  verify=options.verifier.verify.bind(options.verifier);lookup=options.directory.lookup.bind(options.directory);
  timeoutMs=options.timeoutMs;maxAge=options.maxObservationAgeMicros;clock=options.clock??(()=>new Date().toISOString());
 }catch{throw failure('configuration_invalid');}

 async function resolve(evidence:unknown,request:{signal?:AbortSignal}={}):Promise<ExternalIdentityMatch>{
  const callerSignal=request.signal;
  if(callerSignal!==undefined&&!(callerSignal instanceof AbortSignal))throw failure('configuration_invalid');
  const deadline=performance.now()+timeoutMs;
  const control=new AbortController();let stopped:'cancelled'|'timeout'|undefined;
  let previous:bigint|undefined;
  const stop=(cause:'cancelled'|'timeout')=>{if(!stopped){stopped=cause;control.abort();}};
  const cancelled=()=>stop('cancelled');
  const assertOpen=()=>{
   // Check elapsed monotonic time as well as the timer: microtasks may finish
   // before an overdue timer gets its turn after a synchronous adapter blocks.
   if(!stopped&&performance.now()>=deadline)stop('timeout');
   if(stopped)throw failure(stopped);
  };
  const now=()=>{
   try{
    const value=clock();if(!isCanonicalInstant(value))throw Error();
    const micros=zonedInstantMicros(value)!;
    if(previous!==undefined&&micros<previous)throw Error();
    previous=micros;return {value,micros};
   }catch{throw failure('clock_invalid');}
  };
  const live=(observation:IdentityObservation,at:bigint)=>{
   const start=zonedInstantMicros(observation.asOf)!,end=zonedInstantMicros(observation.expiresAt)!;
   if(start>at||at-start>maxAge||end<=at)throw failure('expired');
  };
  async function bounded(work:()=>Promise<unknown>,stage:'verifier'|'directory'):Promise<unknown>{
   assertOpen();
   return new Promise((resolve,reject)=>{
    const abort=()=>{cleanup();reject(failure(stopped??'cancelled'));};
    const cleanup=()=>control.signal.removeEventListener('abort',abort);
    control.signal.addEventListener('abort',abort,{once:true});
    // Both continuations stay attached after cancellation: late errors are observed,
    // and late successes never start the next stage or create a session.
    Promise.resolve().then(()=>{assertOpen();return work();}).then(value=>{
     cleanup();try{assertOpen();resolve(value);}catch(error){reject(error);}
    },()=>{cleanup();reject(failure(stopped??(stage==='verifier'?'verifier_unavailable':'directory_unavailable')));});
   });
  }
  if(callerSignal?.aborted)throw failure('cancelled');
  callerSignal?.addEventListener('abort',cancelled,{once:true});
  const timer=setTimeout(()=>stop('timeout'),timeoutMs);
  try{
   assertOpen();now();
   const raw=await bounded(()=>verify(evidence,namespace,control.signal),'verifier');
   if(raw===null)throw failure('unverified');
   let observed:IdentityObservation;
   try{observed=parseIdentityObservation(raw);}catch{throw failure('verifier_invalid');}
   if(observed.issuer!==namespace.issuer||observed.clientId!==namespace.clientId)throw failure('unverified');
   live(observed,now().micros);assertOpen();
   const reference=parseExternalIdentityRef({issuer:observed.issuer,subject:observed.subject});
   const rawRows=await bounded(()=>lookup(reference,control.signal),'directory');
   let candidates:unknown[];
   try{candidates=rows(rawRows);}catch{throw failure('directory_invalid');}
   if(candidates.length>1)throw failure('ambiguous');
   if(candidates.length===0)throw failure('not_linked');
   let registration;
   try{registration=parseExternalIdentityRegistration(candidates[0]);}catch{throw failure('directory_invalid');}
   if(registration.origin.issuer!==reference.issuer||registration.origin.subject!==reference.subject)throw failure('directory_invalid');
   if(!registration.active||!registration.principalActive)throw failure('not_linked');
   const at=now();live(observed,at.micros);assertOpen();
   return Object.freeze({kind:'external_identity_match',principalId:registration.principalId,
    identityId:registration.origin.identityId,identityRevision:registration.revision,reference,
    checkedAt:at.value,expiresAt:observed.expiresAt});
  }finally{clearTimeout(timer);callerSignal?.removeEventListener('abort',cancelled);}
 }
 return Object.freeze({resolve});
}
