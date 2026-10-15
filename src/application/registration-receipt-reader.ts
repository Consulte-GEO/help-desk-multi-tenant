import type {RegistrationAnalysisTransactions} from './registration-analysis-ports.ts';
import {parseRegistrationScopeRequest,parseLockedRegistrationScope,parseRegistrationPersistenceReceipt,HDA_ANALYSIS_PERMISSIONS,type RegistrationScopeRequest,type RegistrationPersistenceReceipt} from '../domain/registration-persistence.ts';
import {registrationRecord,registrationUuid,registrationDigest,registrationHash,registrationFailure} from '../domain/registration-canonical.ts';
import {safeRegistrationTransactionError} from '../domain/registration-transaction-errors.ts';

export type RegistrationReceiptQuery=Readonly<{
 commandId:string;permission:Exclude<RegistrationScopeRequest['permission'],'read'>;
 expectedCommandHash:string|null;expectedOperationId:string|null;
}>;
export type RegistrationReceiptObservation=Readonly<{
 schema:1;outcome:'recorded'|'not_observed';commandId:string;receipt:RegistrationPersistenceReceipt|null;
 dispatchAllowed:false;automaticRetryAllowed:false;ticketMutation:'none';originMutation:'none';
}>;
const conflict=()=>registrationFailure('registration_receipt_conflict',409);
function parseQuery(raw:unknown):RegistrationReceiptQuery {
 const r=registrationRecord(raw,['commandId','permission','expectedCommandHash','expectedOperationId']);
 if(r.permission==='read'||!HDA_ANALYSIS_PERMISSIONS.includes(r.permission as RegistrationScopeRequest['permission']))throw registrationFailure('registration_receipt_query_invalid',400);
 return Object.freeze({commandId:registrationUuid(r.commandId),permission:r.permission as RegistrationReceiptQuery['permission'],
  expectedCommandHash:r.expectedCommandHash===null?null:registrationDigest(r.expectedCommandHash),
  expectedOperationId:r.expectedOperationId===null?null:registrationUuid(r.expectedOperationId)});
}
/** SERVER-only observation of the ORIGINAL command. No command is sent, no key is
 * replaced, no lease is returned and the model/origin/email are never invoked.
 * `enabled` controls observation separately from the analysis execution gate.
 * This is NOT an authorization override: revoked/expired native grants still deny
 * the same-purpose lookup. Additional lifecycle permissions require future SQL.
 */
export function createRegistrationReceiptReader(options:Readonly<{
 identity:Omit<RegistrationScopeRequest,'permission'>;transactions:RegistrationAnalysisTransactions;enabled:()=>boolean;
}>) {
 let identity:Omit<RegistrationScopeRequest,'permission'>;
 try {
  const r=registrationRecord(options.identity,['workspaceId','accountId','actorId','bindingId']);
  const {permission:_,...p}=parseRegistrationScopeRequest({...r,permission:'read'});identity=Object.freeze(p);
  if(!options.transactions||typeof options.transactions.run!=='function'||typeof options.enabled!=='function')throw registrationFailure('registration_recovery_unavailable',503);
 }catch(error){throw safeRegistrationTransactionError(error);}
 const transactions=options.transactions,enabled=options.enabled;
 return Object.freeze({async readReceipt(raw:unknown,signal?:AbortSignal):Promise<RegistrationReceiptObservation>{
  try {
   const q=parseQuery(raw),fingerprint=registrationHash(q);
   const admission=()=>{
    if(signal?.aborted)throw registrationFailure('registration_recovery_aborted',409);
    try {if(registrationHash(parseQuery(raw))!==fingerprint)throw conflict();}
    catch {throw registrationFailure('registration_receipt_query_changed',409);}
    let permitted:unknown;
    try {permitted=enabled();}catch {permitted=false;}
    if(permitted!==true){if(permitted instanceof Promise)void permitted.catch(()=>{});throw registrationFailure('registration_recovery_disabled',503);}
   };
   admission();
   const scope=parseRegistrationScopeRequest({...identity,permission:q.permission});
   return await transactions.run(scope,async tx=>{
    try {
     const locked=parseLockedRegistrationScope(await tx.lockScope(scope),scope);
     const rawReceipt=await tx.readReceipt(q.commandId);
     let receipt:RegistrationPersistenceReceipt|null=null;
     if(rawReceipt!==null){
      receipt=parseRegistrationPersistenceReceipt(rawReceipt);
      for(const field of ['workspaceId','accountId','actorId','bindingId','permission'] as const)if(receipt[field]!==locked[field])throw conflict();
      if(receipt.commandId!==q.commandId||receipt.recordedAt>=locked.expiresAt||
       (q.expectedCommandHash!==null&&receipt.commandHash!==q.expectedCommandHash)||
       (q.expectedOperationId!==null&&receipt.operationId!==q.expectedOperationId))throw conflict();
     }
     // All values are immutable parsed metadata. An absent row is NOT evidence
     // that a preceding COMMIT or external effect did not occur.
     return Object.freeze({schema:1,outcome:receipt===null?'not_observed':'recorded',commandId:q.commandId,receipt,
      dispatchAllowed:false,automaticRetryAllowed:false,ticketMutation:'none',originMutation:'none'});
    }catch(error){return tx.reject(safeRegistrationTransactionError(error));}
   },admission);
  }catch(error){throw safeRegistrationTransactionError(error);}
 }});
}
