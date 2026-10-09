import type {SqlClient, SqlPool, SqlResult} from './sql.ts';
import {HelpdeskError} from '../domain/errors.ts';

type Identity = {workspaceId:string; id:string};
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
const unconfirmed = () => new HelpdeskError(503,'transaction_outcome_unknown',
 'Confirmação da transação indisponível. Consulte o recurso ou reenvie com a mesma chave de idempotência.');

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
 const borrowed:SqlClient={query:async(sql,values)=>{
  if(!callbackActive)throw unavailable();
  assertAdmission();
  const result=await query(sql,values);
  assertAdmission();
  return result;
 },release:()=>{throw unavailable();}};
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
  let value:T;
  callbackActive=true;
  try{value=await work(borrowed);}finally{callbackActive=false;}
  requireConnection(); // An error during application work must not dispatch COMMIT.
  assertAdmission(); // Even a swallowed precondition failure forces rollback.
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
  callbackActive=false;
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
