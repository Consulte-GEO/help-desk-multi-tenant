import type {SqlClient, SqlPool} from './sql.ts';
import {HelpdeskError} from '../domain/errors.ts';

type Identity = {workspaceId:string; id:string};
const discardReason = () => new Error('Transaction state unconfirmed; discard connection');
const unconfirmed = () => new HelpdeskError(503,'transaction_outcome_unknown',
 'Confirmação da transação indisponível. Consulte o recurso ou reenvie com a mesma chave de idempotência.');

/**
 * All statements use ONE checked-out connection, including control/auth queries.
 * A COMMIT request is not proof of a commit. pg exposes the server command tag.
 * No mutation is retried here: a lost acknowledgement may follow a real commit.
 */
export async function runTransaction<T>(pool:SqlPool, identity:Identity|undefined,
 work:(client:SqlClient)=>Promise<T>):Promise<T> {
 let client:SqlClient;
 try { client=await pool.connect(); }
 catch { throw new HelpdeskError(503,'database_unavailable','Conexão ao banco temporariamente indisponível.'); }
 let broken:Error|undefined;
 let commitRequested=false;
 try {
  const begun=await client.query('BEGIN');
  if(begun.command!=='BEGIN') { broken=discardReason();throw unconfirmed(); }
  // Empty identity for auth/bootstrap queries. Never inherit previous app.* values.
  await client.query("select set_config('app.workspace_id',$1,true),set_config('app.principal_id',$2,true),set_config('statement_timeout','8000',true),set_config('lock_timeout','2000',true),set_config('idle_in_transaction_session_timeout','10000',true),set_config('transaction_timeout','15000',true)",
   [identity?.workspaceId??'',identity?.id??'']);
  const value=await work(client);
  commitRequested=true;
  const committed=await client.query('COMMIT');
  if(committed.command!=='COMMIT') { broken=discardReason();throw unconfirmed(); }
  return value;
 } catch(error) {
  // Even a later successful ROLLBACK cannot prove that a lost COMMIT did not commit.
  if(commitRequested) broken=discardReason();
  try {
   const rolledBack=await client.query('ROLLBACK');
   if(rolledBack.command!=='ROLLBACK') broken=discardReason();
  } catch { broken=discardReason(); }
  if(commitRequested) throw unconfirmed();
  throw error;
 } finally { client.release(broken); }
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
