import type {SqlPool} from './sql.ts';
import {performance} from 'node:perf_hooks';
import {runTransaction,assertBorrowedTransactionIdentity,rejectTransactionValidation} from './transaction.ts';
import {createPostgresRegistrationStore} from './registration-store.ts';
import type {RegistrationAnalysisTransactions} from '../application/registration-analysis-ports.ts';
import type {RegistrationJobTransaction,RegistrationPersistenceWrite} from '../application/registration-job-store.ts';
import {parseRegistrationScopeRequest,parseLockedRegistrationScope,parseLockedRegistration,parseStoredRegistration,type RegistrationScopeRequest,type LockedRegistrationScope} from '../domain/registration-persistence.ts';
import {registrationRecord,registrationHash,registrationFailure} from '../domain/registration-canonical.ts';
import {safeRegistrationTransactionError} from '../domain/registration-transaction-errors.ts';

const identityFields=['workspaceId','accountId','actorId','bindingId'] as const;
const unavailable=()=>registrationFailure('registration_storage_unavailable',503);
const changed=()=>registrationFailure('registration_scope_changed',403);

/** Concrete SERVER-only transaction owner for analysis and receipt observation.
 * Supply an already-qualified dedicated pool and server-resolved binding. This
 * factory creates no pool/credential, grants no authorization and is not mounted
 * automatically. The candidate SQL independently reauthorizes every operation.
 *
 * Admission is mandatory PER CALL: execution and read-only recovery can have
 * separate gates, while both still require current database authorization.
 */
export function createPostgresRegistrationTransactions(options:Readonly<{
 pool:SqlPool;identity:Omit<RegistrationScopeRequest,'permission'>;
}>):RegistrationAnalysisTransactions {
 let pinned:Omit<RegistrationScopeRequest,'permission'>;
 try {
  if(!options.pool||typeof options.pool.connect!=='function')throw unavailable();
  const parsed=parseRegistrationScopeRequest({...registrationRecord(options.identity,identityFields),permission:'read'});
  const {permission:_,...identity}=parsed;pinned=Object.freeze(identity);
 }catch(error){throw safeRegistrationTransactionError(error);}
 // Capture the server dependency, not a mutable property subsequently replaced.
 const pool=options.pool;
 return Object.freeze({async run<T>(rawScope:RegistrationScopeRequest,work:(tx:RegistrationJobTransaction)=>Promise<T>,admission:()=>void):Promise<T>{
  try {
   if(typeof work!=='function'||typeof admission!=='function')throw unavailable();
   const scope=parseRegistrationScopeRequest(rawScope);
   if(identityFields.some(field=>scope[field]!==pinned[field]))throw changed();
   const scopeHash=registrationHash(scope),identity=Object.freeze({workspaceId:pinned.workspaceId,id:pinned.actorId});
   let authorizationDeadline=Infinity,leaseDeadline=Infinity;
   const assertAdmission=()=>{
    const now=performance.now();
    if(now>=authorizationDeadline)throw registrationFailure('registration_scope_expired',409);
    if(now>=leaseDeadline)throw registrationFailure('registration_stale_analysis',409);
    // The original caller cannot change account, binding or purpose during a wait.
    try {if(registrationHash(parseRegistrationScopeRequest(rawScope))!==scopeHash)throw changed();}
    catch {throw changed();}
    const result:unknown=admission();
    if(result!==undefined){if(result instanceof Promise)void result.catch(()=>{});throw unavailable();}
   };
   return await runTransaction(pool,identity,async client=>{
    const reject=(error:unknown):never=>rejectTransactionValidation(client,safeRegistrationTransactionError(error));
    const concrete=createPostgresRegistrationStore(client,identity,{
     assertCurrent:()=>{assertBorrowedTransactionIdentity(client,identity);assertAdmission();},reject
    });
    let accepting=true;
    let locked:LockedRegistrationScope|undefined;
    let observation:{databaseNow:string;started:number}|undefined;
    // Relative DB durations + a monotonic local start BEFORE the query. Network/
    // callback waits consume time; they never extend authority. These checks are
    // additional to (not substitutes for) SQL reauthorization/deferred admission.
    const budget=(until:string,databaseNow:string,started:number)=>started+Date.parse(until)-Date.parse(databaseNow);
    const rememberOperation=(raw:unknown,started:number):unknown=>{
     if(raw!==null){
      if(!locked)throw unavailable();
      const current=parseLockedRegistration(raw,locked);
      observation={databaseNow:current.databaseNow,started};
      authorizationDeadline=Math.min(authorizationDeadline,budget(locked.expiresAt,current.databaseNow,started));
      if((scope.permission==='complete'||scope.permission==='fail')&&current.queue.lease)
       leaseDeadline=Math.min(leaseDeadline,budget(current.queue.lease.expiresAt,current.databaseNow,started));
     }
     assertAdmission();return raw;
    };
    const pending=new Set<Promise<unknown>>();
    // Core tracks SQL promises. Also track the COMPLETE store operation, including
    // validation after the SQL answer, before permitting a transaction to end.
    const track=<R>(action:()=>Promise<R>):Promise<R>=>{
     const promise=(async()=>{
      try {if(!accepting)throw registrationFailure('registration_transaction_closed',409);return await action();}
      catch(error){return reject(error);}
     })();
     pending.add(promise);
     void promise.then(()=>pending.delete(promise),()=>pending.delete(promise));
     return promise;
    };
    const store:RegistrationJobTransaction=Object.freeze({
     lockScope:(request:RegistrationScopeRequest)=>track(async()=>{
      if(registrationHash(parseRegistrationScopeRequest(request))!==scopeHash)throw changed();
      const started=performance.now();
      locked=parseLockedRegistrationScope(await concrete.lockScope(scope),scope);
      authorizationDeadline=Math.min(authorizationDeadline,budget(locked.expiresAt,locked.databaseNow,started));
      assertAdmission();return locked;
     }),
     readReceipt:(commandId:string)=>track(()=>concrete.readReceipt(commandId)),
     lockOperation:(operationId:string)=>track(async()=>{const started=performance.now();return rememberOperation(await concrete.lockOperation(operationId),started);}),
     lockNextOperation:()=>track(async()=>{const started=performance.now();return rememberOperation(await concrete.lockNextOperation(),started);}),
     apply:(write:RegistrationPersistenceWrite)=>track(async()=>{
      if(scope.permission==='claim'){
       const next=parseStoredRegistration(write.next);
       if(next.queue.lease){
        if(!observation)throw unavailable();
        leaseDeadline=Math.min(leaseDeadline,budget(next.queue.lease.expiresAt,observation.databaseNow,observation.started));
       }
      }
      assertAdmission();return concrete.apply(write);
     }),
     reject
    });
    let value!:T,failed=false,failure:unknown;
    try {value=await work(store);}catch(error){failed=true;failure=error;}
    finally {accepting=false;}
    const unfinished=pending.size>0;
    if(unfinished)await Promise.allSettled([...pending]);
    if(failed)return reject(failure);
    if(unfinished)return reject(registrationFailure('transaction_work_incomplete',503));
    return value;
   },assertAdmission);
   // No post-COMMIT admission test: confirmed success is not undone by a later
   // cancellation. Unknown acknowledgments are preserved by the core owner.
  }catch(error){throw safeRegistrationTransactionError(error);}
 }});
}
