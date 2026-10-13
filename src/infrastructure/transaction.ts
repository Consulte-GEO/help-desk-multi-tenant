import type {SqlClient, SqlPool, SqlResult} from './sql.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {copyFormData} from '../../shared/form-rules.js';

type Identity = {workspaceId:string; id:string};
function completeIdentity(value:Identity|undefined):string{try{return value===undefined?'':JSON.stringify(copyFormData(value));}catch{throw identityChanged();}}
/** Optional SERVER precondition, checked synchronously; never a client assertion. */
export type TransactionAdmission = () => void;
const identityChanged = () => new HelpdeskError(403,'transaction_identity_changed',
 'O contexto da transação foi alterado. Nenhuma confirmação foi enviada.');
function identitySnapshot(value:Identity|undefined):Identity|undefined {
 if(value===undefined)return undefined;
 try {
  if(!value||typeof value!=='object')throw identityChanged();
  const workspace=Object.getOwnPropertyDescriptor(value,'workspaceId');
  const person=Object.getOwnPropertyDescriptor(value,'id');
  if(!workspace||!person||!Object.hasOwn(workspace,'value')||!Object.hasOwn(person,'value')
    ||typeof workspace.value!=='string'||typeof person.value!=='string')throw identityChanged();
  return {workspaceId:workspace.value,id:person.value};
 }catch{throw identityChanged();}
}
const discardReason = () => new Error('Transaction state unconfirmed; discard connection');
const unavailable = () => new HelpdeskError(503,'database_unavailable','Conexão ao banco temporariamente indisponível.');
const incomplete = () => new HelpdeskError(503,'transaction_work_incomplete',
 'A operação terminou sem aguardar todas as consultas. Nenhuma confirmação foi enviada.');
const statementRejected = () => new HelpdeskError(503,'transaction_statement_failed',
 'Uma consulta falhou durante a operação. Nenhuma confirmação foi enviada.');
const validationRejected = () => new HelpdeskError(503,'transaction_validation_failed',
 'Uma validação obrigatória falhou durante a operação. Nenhuma confirmação foi enviada.');
const unconfirmed = () => new HelpdeskError(503,'transaction_outcome_unknown',
 'Confirmação da transação indisponível. Consulte o recurso ou reenvie com a mesma chave de idempotência.');

/** Only the exact borrowed client from an active callback can invalidate its
 * transaction. No error payload, public flag, database GUC or physical connection
 * is used as authority. This API can only reject; it cannot authorize or reset.
 */
type ValidationState={active:boolean;rejected:boolean;identity:string};
const transactionValidations=new WeakMap<SqlClient,ValidationState>();
export function assertBorrowedTransactionIdentity(client:SqlClient,identity:Identity):void{
 const state=transactionValidations.get(client);
 if(!state?.active||state.identity!==completeIdentity(identity))rejectTransactionValidation(client,identityChanged());
}
/** Mark a MANDATORY server validation as failed, then propagate the same error.
 * Catching the error in work must not let earlier staged writes commit. The runner
 * emits a safe local failure if work swallows it. An unowned/expired client still
 * throws but cannot affect another callback or a COMMIT already dispatched.
 * Pass the exact borrowed client; spreading/proxying it loses this association.
 */
export function rejectTransactionValidation(client:SqlClient,error:unknown):never{
 const state=transactionValidations.get(client);
 if(state?.active)state.rejected=true;
 throw error;
}

type CommitState='not_requested'|'unknown'|'confirmed';
/** Cleanup is not a transaction result. Only a closed, best-effort diagnostic is emitted. */
function reportReleaseFailure(commitState:CommitState):void {
 try {
  const pending:unknown=console.warn(JSON.stringify({component:'helpdesk.database',event:'connection_release_failed',commit_state:commitState}));
  if(pending&&typeof (pending as PromiseLike<unknown>).then==='function')void Promise.resolve(pending).catch(()=>{});
 } catch { /* No recursive logging or effect on the acknowledged outcome. */ }
}

type ClientHealth={failed:boolean};
const observedClients=new WeakMap<SqlClient,ClientHealth>();
/** One guard per physical client, including the release/idle transition. No request data retained.
 * A pg pool handles errors of idle clients, not those currently leased by a transaction.
 * Never remove another owner's listener or accumulate a listener for every request.
 */
function observeClient(client:SqlClient):ClientHealth{
 let health=observedClients.get(client);
 if(!health){
  health={failed:false};observedClients.set(client,health);
  const state=health;
  client.on?.('error',()=>{state.failed=true;});
 }
 return health;
}

/**
 * All statements use ONE checked-out connection, including control/auth queries.
 * A COMMIT request is not proof of a commit. pg exposes the server command tag.
 * No mutation is retried here: a lost acknowledgement may follow a real commit.
 */
export async function runTransaction<T>(pool:SqlPool, identity:Identity|undefined,
 work:(client:SqlClient)=>Promise<T>, admission?:TransactionAdmission):Promise<T> {
 // Capture before waiting for the pool. A mutable caller cannot retarget app.*.
 const identityAtStart=identitySnapshot(identity);
 const identityRecord=completeIdentity(identity); // No hooks/getters and no acquired client yet.
 let admissionFailure:{error:unknown}|undefined;
 const assertAdmission=()=>{
  if(admissionFailure)throw admissionFailure.error;
  try {
   const current=identitySnapshot(identity);
   if(current?.workspaceId!==identityAtStart?.workspaceId||current?.id!==identityAtStart?.id)throw identityChanged();
   if(admission!==undefined&&typeof admission!=='function')throw unavailable();
   const result:unknown=admission?.();
   if(result!==undefined){
    // An async function is assignable to () => void in TS, but cannot authorize a dispatch.
    if(result instanceof Promise)void result.catch(()=>{});
    throw unavailable();
   }
  }catch(error){
   const safe=error instanceof HelpdeskError?error:unavailable();
   admissionFailure={error:safe};throw safe;
  }
 };
 assertAdmission();
 let client:SqlClient;
 try { client=await pool.connect(); }
 catch { throw unavailable(); }
 let broken:Error|undefined,health:ClientHealth|undefined;
 let beginRequested=false,commitRequested=false,callbackActive=false,commitConfirmed=false;
 const requireConnection=()=>{
  if(health?.failed){broken=discardReason();throw commitRequested?unconfirmed():unavailable();}
 };
 const query=async(sql:string,values?:unknown[]):Promise<SqlResult>=>{
  requireConnection();
  try{const result=await client.query(sql,values);requireConnection();return result;}
  catch(error){requireConnection();throw error;}
 };
 // Stores may retain this object, but never get ownership of the pooled physical client.
 const pendingQueries=new Set<Promise<SqlResult>>();
 // A driver-side failure may leave PostgreSQL's transaction usable. Remember
 // failures after promises settle, even if work catches them or uses allSettled.
 // Recovery through SAVEPOINT is not part of this unit-of-work contract.
 const validation:ValidationState={active:false,rejected:false,identity:identityRecord};
 const requireValidation=()=>{if(validation.rejected)throw validationRejected();};
 let statementFailed=false;
 const requireStatements=()=>{if(statementFailed)throw statementRejected();};
 const borrowed:SqlClient={query:(sql,values)=>{
  const operation=(async()=>{
   if(!callbackActive)throw unavailable();
   assertAdmission();requireStatements();requireValidation();
   let result:SqlResult;
   try{result=await query(sql,values);}catch(error){statementFailed=true;throw error;}
   assertAdmission();
   return result;
  })();
  pendingQueries.add(operation);
  // Observe rejections even if application code discarded the returned Promise.
  // This observer does not convert the operation into success for its caller.
  void operation.then(()=>pendingQueries.delete(operation),()=>pendingQueries.delete(operation));
  return operation;
 },release:()=>{throw unavailable();}};
 transactionValidations.set(borrowed,validation);
 try {
  health=observeClient(client);
  assertAdmission(); // Includes the time spent waiting for the owned connection.
  beginRequested=true;
  const begun=await query('BEGIN');
  if(begun.command!=='BEGIN') { broken=discardReason();throw unconfirmed(); }
  assertAdmission();
  // Empty identity for auth/bootstrap queries. Never inherit previous app.* values.
  await query("select set_config('app.workspace_id',$1,true),set_config('app.principal_id',$2,true),set_config('statement_timeout','8000',true),set_config('lock_timeout','2000',true),set_config('idle_in_transaction_session_timeout','10000',true),set_config('transaction_timeout','15000',true)",
   [identityAtStart?.workspaceId??'',identityAtStart?.id??'']);
  assertAdmission();
  let value!:T,workFailed=false,workError:unknown,unfinished=false;
  callbackActive=true;validation.active=true;
  try{value=await work(borrowed);}
  catch(error){workFailed=true;workError=error;}
  finally{
   callbackActive=false;validation.active=false;
   // All statements, including their post-response admission checks, must settle
   // before COMMIT or cleanup is dispatched. Do not queue a COMMIT behind a
   // discarded query and assume driver FIFO also orders application validation.
   unfinished=pendingQueries.size>0;
   if(unfinished)await Promise.allSettled([...pendingQueries]);
  }
  if(workFailed)throw workError;
  if(unfinished)throw incomplete();
  requireConnection(); // An error during application work must not dispatch COMMIT.
  assertAdmission(); // Even a swallowed precondition failure forces rollback.
  requireStatements(); // Settled does not imply successful: never commit a failed batch.
  requireValidation(); // A successful SQL response is not a successful mandatory validation.
  // Once dispatched, preserve confirmed/unknown COMMIT semantics, not a late refusal.
  commitRequested=true;
  const committed=await query('COMMIT');
  if(committed.command!=='COMMIT') { broken=discardReason();throw unconfirmed(); }
  commitConfirmed=true;
  return value;
 } catch(error) {
  callbackActive=false;
  // Even a later successful ROLLBACK cannot prove that a lost COMMIT did not commit.
  if(commitRequested||health?.failed) broken=discardReason();
  if(beginRequested&&!health?.failed){
   try {
    const rolledBack=await query('ROLLBACK');
    if(rolledBack.command!=='ROLLBACK') broken=discardReason();
   } catch { broken=discardReason(); }
  }
  if(commitRequested) throw unconfirmed();
  if(health?.failed) throw unavailable();
  throw error;
 } finally {
  callbackActive=false;validation.active=false;transactionValidations.delete(borrowed);
  if(broken&&health)health.failed=true;
  // A later idle error does not undo a COMMIT already acknowledged above.
  // Keep the client's stable listener installed so asynchronous disposal cannot crash Node.
  try { client.release(broken); }
  catch {
   // release may have thrown before OR after returning the physical connection.
   // Never retry release, mutate the decided result, or claim physical disposal.
   const state=health??observedClients.get(client);if(state)state.failed=true;
   reportReleaseFailure(commitConfirmed?'confirmed':commitRequested?'unknown':'not_requested');
  }
 }
}

/** query() for control operations is bounded; connect() remains raw for an existing UoW. */
export function withControlTransactions(pool:SqlPool):SqlPool {
 return {
  query:(sql,values)=>runTransaction(pool,undefined,client=>client.query(sql,values)),
  connect:()=>pool.connect(),
  end:()=>pool.end(),
  ...(pool.on?{on:(event:'error',listener:(error:Error)=>void)=>pool.on!(event,listener)}:{})
 };
}
