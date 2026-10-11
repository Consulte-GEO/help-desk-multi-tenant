import {HelpdeskError} from '../domain/errors.ts';
import {requestHash} from '../domain/canonical.ts';
import {parseResourceGrantTarget,resourceGrantRevision,normalizeResourceGrantSnapshot,normalizeResourceGrantState,planResourcePublication,
 assertResourceGrantFresh,type ResourceGrantTarget,type ResourceGrantSnapshot,type ResourcePublicationPlan} from '../domain/resource-publication.ts';
import {isCanonicalInstant,zonedInstantMicros} from '../../shared/instant.js';

/** SERVER-only source. Must qualify identity, binding, full coverage and current revision.
 * NEVER construct from a browser callback, client-approved JSON or a selection-only lease.
 * null means no trustworthy mapping: it is NOT an empty/revoked grant snapshot.
 */
export interface ResourceGrantPublicationSource {
 readCompleteCoverage(target:ResourceGrantTarget,signal:AbortSignal):Promise<unknown>;
}
export type ResourcePublicationReceipt=Readonly<{
 key:string;commandHash:string;targetHash:string;previousRevision:string;revision:string;
 snapshotHash:string;state:'active'|'revoked';resourceCount:number;asOf:string;expiresAt:string;
}>;
export type ResourcePublicationResult=Readonly<{receipt:ResourcePublicationReceipt;replayed:boolean}>;
export interface ResourceGrantPublicationTransaction {
 /** Literal null only for an absent intent. Anything malformed must fail, not create. */
 findReceipt():Promise<unknown>;
 /** Return {revision:'0',snapshot:null} ONLY for a new, locked target. */
 readState():Promise<unknown>;
 /** Replace full refs and matching observation under CAS; return {revision,snapshotHash}.
  * This acknowledges staging, NOT COMMIT. Child triggers can advance revision by >1. */
 replaceGrant(plan:ResourcePublicationPlan):Promise<unknown>;
 /** Append the immutable receipt/audit in the SAME transaction, return literal true. */
 appendReceipt(receipt:ResourcePublicationReceipt):Promise<unknown>;
}
/** No production adapter is provided here. Contract for the reviewed private SQL publisher:
 * - one connection; serialize target + intent even when the target row does not yet exist;
 * - check qualified publisher/binding/revisions under that lock; no request-role DML grants;
 * - callback once, no retry, staged replacement+observation+receipt+audit commit atomically;
 * - call admit around waits and just before COMMIT, not AFTER acknowledged COMMIT;
 * - rollback callback failures; preserve transaction_outcome_unknown if COMMIT ack is lost.
 * Implement with the existing runTransaction, not a second transaction framework.
 */
export interface ResourceGrantPublicationStore {
 runPublication<T>(target:ResourceGrantTarget,key:string,admit:()=>void,
  work:(transaction:ResourceGrantPublicationTransaction)=>Promise<T>):Promise<T>;
}
type Options={source:ResourceGrantPublicationSource;store:ResourceGrantPublicationStore;
 manifestFingerprint:string;maxAgeMicros:bigint;timeoutMs:number;clock?:()=>string};
const failure=(code:string,status=503)=>new HelpdeskError(status,code,{
 resource_publication_invalid:'Comando de publicação de cobertura inválido.',
 resource_publication_source_invalid:'A fonte não forneceu uma cobertura completa e compatível.',
 resource_publication_source_unavailable:'Não foi possível consultar a fonte de permissões.',
 resource_publication_source_denied:'A fonte não confirmou o vínculo de acesso.',
 resource_publication_store_invalid:'A persistência não confirmou dados consistentes da publicação.',
 resource_publication_publisher_denied:'A conexão privada não está autorizada a publicar esta cobertura.',
 resource_publication_clock_invalid:'O relógio de validação da cobertura é inválido.',
 resource_publication_cancelled:'Publicação de cobertura cancelada antes da confirmação.',
 resource_publication_conflict:'O comando ou a revisão da cobertura já mudou.',
 resource_publication_outcome_unknown:'O resultado da publicação é desconhecido. Consulte o recibo usando a mesma intenção; não gere outra automaticamente.',
 transaction_outcome_unknown:'A confirmação da transação está indisponível. Reconcilie a mesma intenção antes de tentar outra.',
}[code]??'Não foi possível concluir a publicação de cobertura.');
/** Closed error vocabulary from the server-owned store. Never trust a transported
 * status, message or accessor. This classifies refusal, it does not grant access.
 * Once a callback has returned a staged receipt, only an acknowledged transaction
 * outcome can settle publication; a later denial-shaped error remains unknown.
 */
function errorCode(error:unknown):unknown{
 try{return error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined;}
 catch{return undefined;}
}
function storeRefusal(error:unknown):HelpdeskError|undefined{
 const code=errorCode(error);
 if(code==='resource_publication_publisher_denied')return failure(code,403);
 if(code==='resource_publication_conflict')return failure(code,409);
 if(code==='resource_publication_store_invalid'||code==='database_unavailable'||code==='transaction_work_incomplete'||code==='transaction_statement_failed')
  return failure('resource_publication_store_invalid');
 return undefined;
}
function record(input:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw failure('resource_publication_store_invalid');
 const proto=Object.getPrototypeOf(input),own=Reflect.ownKeys(input);
 if((proto!==Object.prototype&&proto!==null)||own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)))throw failure('resource_publication_store_invalid');
 const result:Record<string,unknown>={};for(const key of keys){const d=Object.getOwnPropertyDescriptor(input,key);
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw failure('resource_publication_store_invalid');result[key]=d.value;}
 return result;
}
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const receiptFields=['key','commandHash','targetHash','previousRevision','revision','snapshotHash','state','resourceCount','asOf','expiresAt'] as const;
function receipt(raw:unknown,key:string,commandHash:string,targetHash:string,expected:string):ResourcePublicationReceipt{
 const r=record(raw,receiptFields);
 if(r.key!==key||r.commandHash!==commandHash||r.targetHash!==targetHash||r.previousRevision!==expected)throw failure('resource_publication_conflict',409);
 try{
  if(BigInt(resourceGrantRevision(r.revision))<=BigInt(expected)||!hash(r.snapshotHash)||!['active','revoked'].includes(r.state as string)
   ||!Number.isSafeInteger(r.resourceCount)||Number(r.resourceCount)<0||Number(r.resourceCount)>1000
   ||r.state==='revoked'&&r.resourceCount!==0||!isCanonicalInstant(r.asOf)||!isCanonicalInstant(r.expiresAt)
   ||zonedInstantMicros(r.expiresAt as string)!<=zonedInstantMicros(r.asOf as string)!)throw failure('resource_publication_store_invalid');
  return Object.freeze(r) as ResourcePublicationReceipt;
 }catch{throw failure('resource_publication_store_invalid');}
}
/** Synchronize an already mapped target through source/store ports owned by the server.
 * No HTTP endpoint, SQL credential, source adapter or production factory invocation is added.
 * A historical replay receipt describes the original command; it NEVER grants current access.
 */
export function createResourceGrantPublisher(options:Options){
 if(!options||typeof options.source?.readCompleteCoverage!=='function'||typeof options.store?.runPublication!=='function'
  ||!hash(options.manifestFingerprint)||typeof options.maxAgeMicros!=='bigint'||options.maxAgeMicros<=0n
  ||!Number.isInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>10_000
  ||options.clock!==undefined&&typeof options.clock!=='function')throw failure('resource_publication_invalid',400);
 const read=options.source.readCompleteCoverage.bind(options.source),run=options.store.runPublication.bind(options.store);
 const manifest=options.manifestFingerprint,maxAge=options.maxAgeMicros,timeout=options.timeoutMs,clock=options.clock??(()=>new Date().toISOString());
 async function source(target:ResourceGrantTarget,signal?:AbortSignal):Promise<unknown>{
  const deadline=performance.now()+timeout;
  const owned=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;let cancel=()=>{};
  const stopped=new Promise<never>((_resolve,reject)=>{
   cancel=()=>{owned.abort();reject(failure('resource_publication_source_unavailable'));};
   timer=setTimeout(cancel,timeout);signal?.addEventListener('abort',cancel,{once:true});
  });
  try{
   const value=await Promise.race([Promise.resolve().then(()=>{
    if(owned.signal.aborted||signal?.aborted||performance.now()>=deadline){owned.abort();throw failure('resource_publication_source_unavailable');}
    return read(target,owned.signal);
   }),stopped]);
   // Microtasks may beat an overdue timer after a synchronous source blocks.
   if(owned.signal.aborted||signal?.aborted||performance.now()>=deadline){owned.abort();throw failure('resource_publication_source_unavailable');}return value;
  }catch{
   if(signal?.aborted)throw failure('resource_publication_cancelled',409);
   throw failure('resource_publication_source_unavailable');
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }
 async function publish(input:unknown,expectedRevision:unknown,key:unknown,signal?:AbortSignal):Promise<ResourcePublicationResult>{
  const target=parseResourceGrantTarget(input),expected=resourceGrantRevision(expectedRevision);
  if(typeof key!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw failure('resource_publication_invalid',400);
  const commandHash=requestHash({target,expectedRevision:expected}),targetHash=requestHash(target);
  let snapshot:ResourceGrantSnapshot|undefined,last:bigint|undefined,lastText:string|undefined,latched:unknown;
  function admit():void{
   if(latched)throw latched;
   try{
    if(signal?.aborted)throw failure('resource_publication_cancelled',409);
    let value:unknown;try{value=clock();}catch{throw failure('resource_publication_clock_invalid');}
    if(!isCanonicalInstant(value))throw failure('resource_publication_clock_invalid');
    const tick=zonedInstantMicros(value as string)!;
    if(last!==undefined&&tick<last)throw failure('resource_publication_clock_invalid');last=tick;lastText=value as string;
    if(snapshot)assertResourceGrantFresh(snapshot,value,maxAge);
   }catch(error){latched=error;throw error;}
  }
  admit();const observed=await source(target,signal);admit();
  if(observed===null)throw failure('resource_publication_source_denied',403);
  try{
   snapshot=normalizeResourceGrantSnapshot(observed);
   if(snapshot.manifestFingerprint!==manifest||requestHash(snapshot.target)!==targetHash)throw failure('resource_publication_source_invalid');
  }catch{throw failure('resource_publication_source_invalid');}
  admit();const candidate=snapshot;
  async function exchange(work:()=>Promise<unknown>):Promise<unknown>{
   admit();let value:unknown;
   try{value=await work();}catch(error){if(error===latched)throw error;throw storeRefusal(error)??failure('resource_publication_store_invalid');}
   admit();return value;
  }
  let callbacks=0,issued:ResourcePublicationResult|undefined,callbackError:unknown;
  try{
   const result=await run(target,key,admit,async tx=>{
    try{
     if(++callbacks!==1)throw failure('resource_publication_store_invalid');admit();
     const previous=await exchange(()=>tx.findReceipt());
     if(previous!==null){issued=Object.freeze({receipt:receipt(previous,key,commandHash,targetHash,expected),replayed:true});return issued;}
     let current;try{current=normalizeResourceGrantState(await exchange(()=>tx.readState()));}
     catch(error){if(error===latched)throw error;throw failure('resource_publication_store_invalid');}
     const plan=planResourcePublication(current,candidate,expected,lastText!,maxAge);admit();
     const staged=record(await exchange(()=>tx.replaceGrant(plan)),['revision','snapshotHash']);
     try{if(BigInt(resourceGrantRevision(staged.revision))<=BigInt(expected)||staged.snapshotHash!==plan.snapshotHash)throw failure('resource_publication_store_invalid');}
     catch{throw failure('resource_publication_store_invalid');}
     const proposed=receipt({key,commandHash,targetHash,previousRevision:expected,revision:staged.revision,snapshotHash:plan.snapshotHash,
      state:plan.snapshot.state,resourceCount:plan.snapshot.resources.length,asOf:plan.snapshot.asOf,expiresAt:plan.snapshot.expiresAt},key,commandHash,targetHash,expected);
     if(await exchange(()=>tx.appendReceipt(proposed))!==true)throw failure('resource_publication_store_invalid');admit();
     issued=Object.freeze({receipt:proposed,replayed:false});return issued;
    }catch(error){
     callbackError=error instanceof HelpdeskError?error:failure('resource_publication_store_invalid');throw callbackError;
    }
   });
   // No time check after commit: a late clock change cannot undo an acknowledged publication.
   if(!issued||result!==issued||callbacks!==1)throw failure('resource_publication_outcome_unknown');
   return issued;
  }catch(error){
   if(error===latched||error===callbackError)throw error;
   const code=errorCode(error);
   if(code==='transaction_outcome_unknown')throw failure('transaction_outcome_unknown');
   if(!issued){const refused=storeRefusal(error);if(refused)throw refused;}
   throw failure('resource_publication_outcome_unknown');
  }
 }
 return Object.freeze({publish});
}
