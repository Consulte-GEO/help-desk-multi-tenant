import type {SqlClient,SqlResult} from './sql.ts';
import {rejectTransactionValidation} from './transaction.ts';
import {parseEvidenceQuery,readEvidencePage,CHECKLIST_EVIDENCE_PAGE_SIZE,type ChecklistEvidenceContext,type ChecklistEvidenceQuery,type ChecklistEvidencePage} from '../../shared/checklist-evidence.js';
import {uuidIdentifier} from '../domain/input-values.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {checklistError,parseChecklistMark,parseChecklistRecord,assertChecklistResolutionEvidence,type ChecklistMark,type ChecklistRecord} from '../domain/execution-checklist-mark.ts';
const codes:Record<string,readonly [string,number]>={HD001:['checklist_forbidden',403],HD002:['checklist_version_conflict',412],HD003:['checklist_state_conflict',409],HD004:['checklist_evidence_denied',403],HD005:['checklist_intent_conflict',409],HD006:['invalid_checklist_mark',400],HD007:['checklist_binding_required',409]};
export interface ExecutionChecklistStore {
 assertReady():Promise<void>;
 queryEvidence(context:ChecklistEvidenceContext,query:ChecklistEvidenceQuery):Promise<ChecklistEvidencePage>;
 read(ticketId:string):Promise<ChecklistRecord>;
 readReceipt(ticketId:string,key:string):Promise<unknown>;
 readEvidence(ticketId:string,refs:readonly string[]):Promise<unknown>;
 mark(ticketId:string,command:ChecklistMark,intentHash:string,key:string,requestId:string):Promise<unknown>;
 readExecutionChecklist(ticketId:string):Promise<unknown>;
}
/** Uses a borrowed transaction client only. No pool, BEGIN/COMMIT, network to GEO,
 * schema installation or fallback. Private functions must be installed/tested first.
 * SQL independently authorizes the actor and builds snapshot/audit/receipt atomically.
 */
export function createPostgresExecutionChecklistStore(client:SqlClient):ExecutionChecklistStore{
 async function executeSql(sql:string,values:unknown[]=[]):Promise<SqlResult>{
  let response:SqlResult;
  try{response=await client.query(sql,values);}catch(e){
   let code:unknown;try{code=e&&typeof e==='object'?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;}catch{/* no details */}
   const mapped=typeof code==='string'&&Object.hasOwn(codes,code)?codes[code]:undefined;
   if(mapped)throw checklistError(mapped[0],mapped[1]);
   if(code==='release_gate_closed')throw checklistError(code,503);
   if(code==='request_cancelled')throw checklistError(code,409);
   // Let the existing transaction runner own known admission/COMMIT semantics.
   if(typeof code==='string'&&['transaction_validation_failed','transaction_identity_changed','transaction_statement_failed','transaction_work_incomplete','transaction_outcome_unknown','resource_scope_denied','resource_scope_unavailable'].includes(code))throw checklistError(code,code==='transaction_identity_changed'||code==='resource_scope_denied'?403:503);
   throw checklistError('checklist_store_unavailable');
  }
  return response;
 }
 async function query(sql:string,values:unknown[]=[]):Promise<unknown>{
  const response=await executeSql(sql,values);
  try{const r=response as {command?:string;rowCount?:number;rows?:unknown[]};
   if(r?.command!=='SELECT'||r.rowCount!==1||!Array.isArray(r.rows)||r.rows.length!==1)throw Error();
   const row=copyFormData(r.rows[0]) as Record<string,unknown>;
   if(!row||Array.isArray(row)||Object.keys(row).length!==1||!Object.hasOwn(row,'result'))throw Error();
   return freezeFormData(copyFormData(row.result));
  }catch{throw checklistError();}
 }
 async function read(ticketId:string){return parseChecklistRecord(await query('select helpdesk_auth.hdn_lock_execution_checklist($1) as result',[uuidIdentifier(ticketId)]));}
 const store:ExecutionChecklistStore={
  async assertReady(){
   const r=await query(`select jsonb_build_object('role',current_user,'login',session_user,
    'superuser',r.rolsuper,'bypass',r.rolbypassrls,'createRole',r.rolcreaterole,'createDatabase',r.rolcreatedb,'replication',r.rolreplication,
    'member',exists(select 1 from pg_auth_members m where m.member=r.oid),
    'owner',exists(select 1 from pg_namespace n where n.nspname like 'helpdesk_%' and n.nspowner=r.oid)
      or exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname like 'helpdesk_%' and c.relowner=r.oid)
      or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname like 'helpdesk_%' and p.proowner=r.oid),
    'contract',helpdesk_auth.hdn_checklist_contract()) as result from pg_roles r where r.rolname=current_user`) as Record<string,unknown>;
   const flags=['superuser','bypass','createRole','createDatabase','replication','member','owner'];
   if(!r||Object.keys(r).length!==10||r.role!=='helpdesk_app'||r.login!=='helpdesk_app'||r.contract!=='hdn-checklist-candidate-1'||flags.some(k=>r[k]!==false))throw checklistError();
  },read,
  async queryEvidence(rawContext:ChecklistEvidenceContext,rawQuery:ChecklistEvidenceQuery){
   const context=freezeFormData(copyFormData(rawContext)) as ChecklistEvidenceContext,q=parseEvidenceQuery(rawQuery);
   // Validate context/query before SQL. A cursor is never authorization.
   try{readEvidencePage({...context,items:[],next:null},context,q);}catch{throw checklistError();}
   const response=await executeSql(`SELECT n.id::text as id,
    to_char(n.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at
    FROM helpdesk_core.internal_notes n
    WHERE n.workspace_id=$1 AND n.account_id=$2 AND n.ticket_id=$3 AND n.actor_id=$4
     AND n.created_at<=$5::timestamptz
     AND ($6::timestamptz IS NULL OR (n.created_at,n.id)<($6::timestamptz,$7::uuid))
    ORDER BY n.created_at DESC,n.id DESC LIMIT $8`,
    [context.workspaceId,context.accountId,context.ticketId,context.principalId,context.readAt,q.before?.at??null,q.before?.id??null,CHECKLIST_EVIDENCE_PAGE_SIZE+1]);
   try{
    const rows=copyFormData(response.rows) as {id:string;at:string}[];
    if(response.command!=='SELECT'||!Array.isArray(rows)||response.rowCount!==rows.length||rows.length>CHECKLIST_EVIDENCE_PAGE_SIZE+1||new Set(rows.map(v=>v.id)).size!==rows.length)throw Error();
    const items=rows.slice(0,CHECKLIST_EVIDENCE_PAGE_SIZE),next=rows.length>CHECKLIST_EVIDENCE_PAGE_SIZE?items.at(-1)!:null;
    const page=readEvidencePage({...context,items,next},context,q);
    // The extra row proves only that another page exists. Validate it too: do
    // not hide corrupt/private/unordered data just because it is the sentinel.
    if(next)readEvidencePage({...context,items:[rows[CHECKLIST_EVIDENCE_PAGE_SIZE]],next:null},context,{...q,before:next});
    return page;
   }catch{throw checklistError();}
  },
  readReceipt:(ticketId:string,key:string)=>query('select helpdesk_auth.hdn_checklist_receipt($1,$2) as result',[uuidIdentifier(ticketId),key]),
  readEvidence:(ticketId:string,refs:readonly string[])=>query('select helpdesk_auth.hdn_checklist_evidence($1,$2) as result',[uuidIdentifier(ticketId),[...refs]]),
  mark:(ticketId:string,command:ChecklistMark,intentHash:string,key:string,requestId:string)=>query('select helpdesk_auth.hdn_mark_execution_checklist($1,$2,$3,$4,$5) as result',[uuidIdentifier(ticketId),parseChecklistMark(command),intentHash,key,uuidIdentifier(requestId)]),
  async readExecutionChecklist(ticketId:string){
   // Do not fall back to the old snapshot-only read if the qualified helper is
   // missing. It locks current evidence before the caller may resolve/COMMIT.
   const envelope=await query('select helpdesk_auth.hdn_lock_execution_checklist_resolution($1) as result',[uuidIdentifier(ticketId)]) as Record<string,unknown>;
   if(!envelope||Array.isArray(envelope)||Object.keys(envelope).length!==2||!Object.hasOwn(envelope,'record')||!Object.hasOwn(envelope,'evidence'))throw checklistError();
   const r=parseChecklistRecord(envelope.record);if(r.context.ticketId!==uuidIdentifier(ticketId))throw checklistError();assertChecklistResolutionEvidence(r,envelope.evidence);
   return freezeFormData({template:r.template,snapshot:r.snapshot});
  }
 };
 // Every method below validates mandatory input, transport, or persisted data.
 // A SQL statement can succeed while this validation fails. Merely throwing is
 // insufficient if an enclosing workflow catches it and tries to commit earlier
 // writes. Use the existing runner's exact borrowed-client rejection state; this
 // never authorizes, retries, opens another transaction, or exposes a reset flag.
 // Outside a runner-owned callback the error still propagates, but no claim of
 // rollback is made. Callers must await the operation on that SAME borrowed client.
 function required<A extends unknown[],R>(operation:(...args:A)=>Promise<R>){
  return async(...args:A):Promise<R>=>{
   try{return await operation(...args);}
   catch(error){return rejectTransactionValidation(client,error);}
  };
 }
 return Object.freeze({
  assertReady:required(store.assertReady),read:required(store.read),
  queryEvidence:required(store.queryEvidence),readReceipt:required(store.readReceipt),
  readEvidence:required(store.readEvidence),mark:required(store.mark),
  readExecutionChecklist:required(store.readExecutionChecklist),
 });
}
