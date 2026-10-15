import {copyJson,canonicalJson,uuid,integer,text,fail} from './canonical.ts';
import type {Authority,Repository,Transaction,Process,Revision,Artifact,Receipt,CaseEvent} from './contracts.ts';
export interface QueryResult {rows:Record<string,unknown>[];rowCount:number|null;}
export interface SqlConnection {query(sql:string,parameters?:unknown[]):Promise<QueryResult>;release(error?:Error):void;}
export interface SqlPool {connect():Promise<SqlConnection>;}
/** Private server SQL adapter. No driver dependency, DB URL or authority inferred here.
 * Contract: the supplied connection is the restricted setup_import_app role.
 * GUCs fence accidental cross-scope queries; they are NOT user authentication.
 * Source authorization remains the live server resolver, not an editable JWT claim.
 */
export function createPostgresProcessRepository(pool:SqlPool):Repository {
 if(!pool||typeof pool.connect!=='function')fail('INVALID_SQL_POOL');
 return {
  async transaction<T>(input:Authority,work:(tx:Transaction)=>Promise<T>):Promise<T> {
   const scope=copyJson(input);
   [scope.workspaceId,scope.accountId,scope.caseId,scope.actorId,scope.requesterId].forEach(uuid);
   const keys:unknown[]=[scope.workspaceId,scope.accountId,scope.caseId];
   let c:SqlConnection;
   try {c=await pool.connect();}catch{fail('PROCESS_STORAGE_UNAVAILABLE');}
   let active=false,discard:Error|undefined,begun=false,committing=false;
   const query=async(sql:string,p:unknown[]=[]):Promise<QueryResult>=>{
     if(!active)fail('TRANSACTION_CLOSED');
     try {return await c.query(sql,p);}catch{fail('PROCESS_STORAGE_UNAVAILABLE');}
   };
   const checked=<V>(raw:unknown):V=>{
     const x=copyJson(raw) as Record<string,unknown>;
     if(!x||x.workspaceId!==scope.workspaceId||x.accountId!==scope.accountId||x.caseId!==scope.caseId)fail('SQL_SCOPE_MISMATCH');
     return x as V;
   };
   const one=async<V>(table:string,extra='',args:unknown[]=[]):Promise<V|null>=>{
     const r=await query(`SELECT body FROM setup_import.${table} WHERE workspace_id=$1 AND account_id=$2 AND case_id=$3${extra}`,keys.concat(args));
     if(r.rows.length>1||r.rowCount!==r.rows.length)fail('SQL_RESULT_SHAPE');
     return r.rows.length?checked<V>(r.rows[0]!.body):null;
   };
   try {
     await c.query('BEGIN');begun=true;active=true;
     const role=await query('SELECT rolname AS name, rolsuper AS superuser, rolbypassrls AS bypass FROM pg_catalog.pg_roles WHERE rolname=current_user');
     if(role.rows.length!==1||role.rows[0]!.name!=='setup_import_app'||role.rows[0]!.superuser!==false||role.rows[0]!.bypass!==false)fail('UNSAFE_DATABASE_ROLE');
     await query("SELECT set_config('statement_timeout','10000',true), set_config('lock_timeout','5000',true), set_config('idle_in_transaction_session_timeout','15000',true)");
     await query("SELECT set_config('setup_import.workspace_id',$1,true),set_config('setup_import.account_id',$2,true),set_config('setup_import.case_id',$3,true),set_config('setup_import.actor_id',$4,true),set_config('setup_import.requester_id',$5,true)",keys.concat([scope.actorId,scope.requesterId]));
     // Includes a missing/new case. A hash collision causes only extra serialization.
     await query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[keys.join(':')]);
     const tx:Transaction={
       readProcess:()=>one<Process>('cases'),
       readRevision:(n)=>one<Revision>('revisions',' AND number=$4',[integer(n,1)]),
       readArtifact:(id)=>one<Artifact>('artifacts',' AND artifact_id=$4',[uuid(id)]),
       readReceipt:(actor,op)=>{
         if(actor!==scope.actorId)fail('SQL_SCOPE_MISMATCH');
         return one<Receipt>('receipts',' AND actor_id=$4 AND operation_id=$5',[uuid(actor),uuid(op)]);
       },
       async listArtifacts(){
         const r=await query('SELECT body FROM setup_import.artifacts WHERE workspace_id=$1 AND account_id=$2 AND case_id=$3 ORDER BY artifact_id LIMIT 1001',keys);
         if(r.rows.length>1000||r.rowCount!==r.rows.length)fail('SQL_RESULT_SHAPE');
         return r.rows.map(row=>checked<Artifact>(row.body));
       },
       async insertProcess(value){
         const v=checked<Process>(value);
         await query('INSERT INTO setup_import.cases (workspace_id,account_id,case_id,version,head_revision,head_hash,body) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)',keys.concat([v.version,v.headRevision,v.headHash,canonicalJson(v)]));
       },
       async updateProcess(value,expected){
         const v=checked<Process>(value);
         const r=await query('UPDATE setup_import.cases SET version=$4,head_revision=$5,head_hash=$6,body=$7::jsonb WHERE workspace_id=$1 AND account_id=$2 AND case_id=$3 AND version=$8',keys.concat([v.version,v.headRevision,v.headHash,canonicalJson(v),integer(expected,1)]));
         if(r.rowCount!==1)fail('VERSION_CONFLICT');
       },
       async insertRevision(value){
         const v=checked<Revision>(value);
         await query('INSERT INTO setup_import.revisions (workspace_id,account_id,case_id,number,hash,body) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',keys.concat([v.number,v.hash,canonicalJson(v)]));
       },
       async insertArtifact(value){
         const v=checked<Artifact>(value);
         await query('INSERT INTO setup_import.artifacts (workspace_id,account_id,case_id,artifact_id,status,body) VALUES ($1,$2,$3,$4,$5,$6::jsonb)',keys.concat([v.id,v.status,canonicalJson(v)]));
       },
       async updateArtifact(value){
         const v=checked<Artifact>(value);
         const r=await query("UPDATE setup_import.artifacts SET status=$5,body=$6::jsonb WHERE workspace_id=$1 AND account_id=$2 AND case_id=$3 AND artifact_id=$4 AND status='pending'",keys.concat([v.id,v.status,canonicalJson(v)]));
         if(r.rowCount!==1)fail('ARTIFACT_CHANGED');
       },
       async insertEvent(value){
         const v=checked<CaseEvent>(value);
         if(v.actorId!==scope.actorId)fail('SQL_SCOPE_MISMATCH');
         await query('INSERT INTO setup_import.events (workspace_id,account_id,case_id,version,body) VALUES ($1,$2,$3,$4,$5::jsonb)',keys.concat([v.version,canonicalJson(v)]));
       },
       async insertReceipt(value){
         const v=checked<Receipt>(value);
         if(v.actorId!==scope.actorId)fail('SQL_SCOPE_MISMATCH');
         await query('INSERT INTO setup_import.receipts (workspace_id,account_id,case_id,actor_id,operation_id,request_hash,body) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)',keys.concat([v.actorId,v.operationId,v.requestHash,canonicalJson(v)]));
       }
     };
     const result=await work(tx);
     active=false;committing=true;
     await c.query('COMMIT');begun=false;committing=false;
     return result;
   } catch(error) {
     active=false;
     if(committing)discard=new Error('COMMIT_UNCERTAIN');
     if(begun) {
       try {await c.query('ROLLBACK');}catch {discard=new Error(committing?'COMMIT_UNCERTAIN':'ROLLBACK_FAILED');}
     }
     if(discard)throw discard;
     throw error;
   } finally {active=false;c.release(discard);}
  }
 };
}
