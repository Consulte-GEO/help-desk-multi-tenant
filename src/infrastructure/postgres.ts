import {createPostgresPublicWorkflowReader} from './public-workflow-read.ts';
import {assertBorrowedTransactionIdentity} from './transaction.ts';
import {assertLegacyTerminalUpdateAllowed} from './legacy-transition-guard.ts';
import {DATABASE_SECURITY_CONTRACT} from './database-security-contract.ts';
import {assertSingleWrite} from './write-result.ts';
import {canonicalInstant} from '../../shared/instant.js';
import {decodeIdempotencyLookup} from './idempotency-lookup.ts';
import {UUID_PATTERN,uuidIdentifier} from '../domain/input-values.ts';
import {SEARCH_UPPER,SEARCH_LOWER,statusesForSearch} from '../application/ticket-search.ts';
import type {TicketSearchFilters} from '../application/ticket-search.ts';
import type {CatalogWindow,SupportCatalogEntry} from '../application/support-catalog.ts';
import {runTransaction} from './transaction.ts';
export {withControlTransactions} from './transaction.ts';
import type {PageWindow} from '../application/pagination.ts';
import type {SqlPool,SqlClient} from './sql.ts';import type {Principal,Ticket,Coverage,PublicMessage,InternalNote,TicketEvent} from '../domain/model.ts';import type {Store,UnitOfWork,SupportContext,Cursor,StoredResult} from '../application/ports.ts';import {HelpdeskError} from '../domain/errors.ts';
export async function assertSafeDatabaseRole(pool:SqlPool):Promise<void>{
 const row=(await pool.query(`select current_user as name,session_user as login_name,
 r.rolsuper as superuser,r.rolbypassrls as bypass_rls,r.rolcreaterole as create_role,
 r.rolcreatedb as create_database,r.rolreplication as replication,
 exists(select 1 from pg_auth_members m where m.member=r.oid) as member_of_roles,
 exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where c.relowner=r.oid and n.nspname like 'helpdesk_%') as owns_tables,
 (exists(select 1 from pg_namespace n where n.nspowner=r.oid and n.nspname like 'helpdesk_%')
  or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where p.proowner=r.oid and n.nspname like 'helpdesk_%')) as owns_objects
 from pg_roles r where r.rolname=current_user`)).rows[0];
 const unsafe=['superuser','bypass_rls','create_role','create_database','replication','member_of_roles','owns_tables','owns_objects'];
 if(!row||row.name!=='helpdesk_app'||row.login_name!=='helpdesk_app'||unsafe.some(k=>row[k]!==false))
  throw new HelpdeskError(503,'unsafe_database_role','O backend exige conexão autenticada com papel restrito, sem propriedade ou privilégios administrativos.');
}
export async function assertSchemaCompatibility(pool:SqlPool):Promise<void>{
 let version:unknown;
 try{version=(await pool.query('select helpdesk_auth.schema_version() as version')).rows[0]?.version;}
 catch{throw new HelpdeskError(503,'schema_version_mismatch','Banco incompatível com esta versão da API.');}
 if(version!==DATABASE_SECURITY_CONTRACT.schemaVersion)throw new HelpdeskError(503,'schema_version_mismatch','Banco incompatível com esta versão da API.');
}
export {assertDatabaseSecurity} from './database-security.ts';
export function observePoolErrors(pool:SqlPool,observe:(event:{component:string;event:string})=>void):void{
 pool.on?.('error',()=>{try{observe({component:'helpdesk.database',event:'idle_connection_error'});}catch{/* No raw connection errors or throwing telemetry callbacks. */}});
}
export class PostgresUnitOfWork implements UnitOfWork{
 readonly pool:SqlPool;constructor(pool:SqlPool){this.pool=pool;}
 async run<T>(p:Principal,work:(s:Store)=>Promise<T>):Promise<T>{
  return runTransaction(this.pool,p,client=>work(new PostgresStore(client,p)));
 }
}
type Row=Record<string,unknown>;const str=(r:Row,k:string)=>String(r[k]);const iso=(v:unknown):string=>{try{return canonicalInstant(v);}catch{throw new HelpdeskError(503,'invalid_database_result','Resposta do banco incompatível. Tente atualizar o chamado.');}};
function consulteGeoSummary(value:unknown){
 const invalid=()=>new HelpdeskError(503,'invalid_database_result','Resumo Consulte GEO indisponível.');
 if(value===null)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==4)throw invalid();
 const fields:Record<string,unknown>={};for(const key of ['protocol','profileVersionId','workflow','requesterId']){const field=Object.getOwnPropertyDescriptor(value,key);if(!field||!Object.hasOwn(field,'value')||!field.enumerable)throw invalid();fields[key]=field.value;}
 if(typeof fields.protocol!=='string'||!/^CG-[1-9][0-9]{0,18}$/.test(fields.protocol)||BigInt(fields.protocol.slice(3))>9223372036854775807n||fields.workflow!==true)throw invalid();
 try{return {protocol:fields.protocol,profileVersionId:uuidIdentifier(fields.profileVersionId),workflow:true as const,requesterId:uuidIdentifier(fields.requesterId)};}catch{throw invalid();}
}
function ticket(r:Row,local=false):Ticket{const summary=local?consulteGeoSummary(r.consultegeo_summary):undefined;return {id:str(r,'id'),workspaceId:str(r,'workspace_id'),accountId:str(r,'account_id'),productInstanceId:str(r,'product_instance_id'),serviceCode:str(r,'service_code'),createdBy:str(r,'created_by'),assignedTo:r.assigned_to==null?null:str(r,'assigned_to'),subject:str(r,'subject'),description:str(r,'description'),status:r.status as Ticket['status'],priority:r.priority as Ticket['priority'],version:Number(r.version),coverageId:str(r,'coverage_id'),contractVersionId:str(r,'contract_version_id'),contractSnapshot:r.contract_snapshot as Ticket['contractSnapshot'],createdAt:iso(r.created_at),updatedAt:iso(r.updated_at),...(summary?{consulteGeo:summary}:{})};}
function message(r:Row):PublicMessage{return {id:str(r,'id'),workspaceId:str(r,'workspace_id'),accountId:str(r,'account_id'),ticketId:str(r,'ticket_id'),actorId:str(r,'actor_id'),actorType:r.actor_type as PublicMessage['actorType'],body:str(r,'body'),createdAt:iso(r.created_at)};}
function note(r:Row):InternalNote{return {id:str(r,'id'),workspaceId:str(r,'workspace_id'),accountId:str(r,'account_id'),ticketId:str(r,'ticket_id'),actorId:str(r,'actor_id'),body:str(r,'body'),createdAt:iso(r.created_at)};}
const ticketColumns='id,workspace_id,account_id,product_instance_id,service_code,created_by,subject,description,status,priority,version,coverage_id,contract_version_id,contract_snapshot,created_at,updated_at,assigned_to';
// Developer-owned columns only. The driver otherwise truncates timestamptz to Date milliseconds.
const timeColumn=(column:'created_at'|'updated_at')=>
 `case when ${column} >= '0001-01-01 00:00:00+00'::timestamptz and ${column} < '10000-01-01 00:00:00+00'::timestamptz
  then to_char(${column} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') end as ${column}`;
const ticketReadColumns=ticketColumns.split(',').map(c=>c==='created_at'||c==='updated_at'?timeColumn(c):c).join(',');
class PostgresStore implements Store{
 readonly c:SqlClient;readonly p:Principal;readonly localCollection:boolean;readonly consulteGeoLocal:boolean;constructor(c:SqlClient,p:Principal,localCollection=false,consulteGeoLocal=false){this.c=c;this.p=p;this.localCollection=localCollection;this.consulteGeoLocal=consulteGeoLocal;}
 // Table and column names in this helper are developer-owned constants, never request values.
 private async insert(table:string,columns:string[],values:unknown[]):Promise<void>{const result=await this.c.query(`insert into ${table} (${columns.join(',')}) values (${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);assertSingleWrite(result,'INSERT');}
 async supportContexts(window:CatalogWindow,_at:string):Promise<SupportCatalogEntry[]>{
  if(window.accountId!==undefined)uuidIdentifier(window.accountId);
  if(window.after){try{uuidIdentifier(window.after.accountId);uuidIdentifier(window.after.productInstanceId);}catch{throw new HelpdeskError(400,'invalid_cursor','Cursor inválido para este contexto.');}}
  const rows=(await this.c.query('select item from helpdesk_auth.support_contexts($1,$2,$3,$4,$5,$6) as result(item)',
   [this.p.workspaceId,window.accountId??null,window.after?.accountId??null,window.after?.productInstanceId??null,window.after?.serviceCode??null,window.limit])).rows;
  return rows.map(r=>r.item as SupportCatalogEntry);
 }
 async coverages(context:SupportContext):Promise<Coverage[]>{uuidIdentifier(context.accountId);uuidIdentifier(context.productInstanceId);const rows=(await this.c.query('select item from helpdesk_auth.locked_coverages($1,$2,$3,$4) as result(item)',[this.p.workspaceId,context.accountId,context.productInstanceId,context.serviceCode])).rows;return rows.map(r=>r.item as Coverage);}
 async getTicket(id:string,lock=false):Promise<Ticket|null>{if(!UUID_PATTERN.test(id))return null;const r=(await this.c.query(`select ${ticketReadColumns}${this.consulteGeoLocal?',helpdesk_auth.cg_local_ticket_summary(tickets.id) as consultegeo_summary':''} from helpdesk_core.tickets where workspace_id=$1 and id=$2${lock?' for update':''}`,[this.p.workspaceId,id])).rows[0];return r?ticket(r,this.consulteGeoLocal):null;}
 async listTickets(limit:number,cursor:Cursor|null,accountId?:string,filters:TicketSearchFilters={}):Promise<Ticket[]>{
  if(accountId!==undefined)uuidIdentifier(accountId);
  if(cursor){try{uuidIdentifier(cursor.id);}catch{throw new HelpdeskError(400,'invalid_cursor','Cursor inválido para este contexto.');}}
  let localContexts:string|undefined;
  if(this.localCollection){
   // Real current-actor refresh, on THIS borrowed transaction, before any page.
   const result=await this.c.query('select helpdesk_auth.cg_local_prepare_ticket_collection() as source');
   if(result.command!=='SELECT'||result.rowCount!==1||result.rows.length!==1)throw new HelpdeskError(503,'invalid_database_result','Coleção local indisponível.');
   const data=result.rows[0]!.source,seen=new Set<string>();
   if(!Array.isArray(data)||data.length>50)throw new HelpdeskError(503,'invalid_database_result','Coleção local indisponível.');
   for(const value of data){
    if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==4)throw new HelpdeskError(503,'invalid_database_result','Coleção local indisponível.');
    const fields:Record<string,unknown>={};for(const key of ['accountId','productInstanceId','connectionId','tenantId']){const field=Object.getOwnPropertyDescriptor(value,key);if(!field||!Object.hasOwn(field,'value')||!field.enumerable)throw new HelpdeskError(503,'invalid_database_result','Coleção local indisponível.');fields[key]=field.value;}
    try{uuidIdentifier(fields.accountId);uuidIdentifier(fields.productInstanceId);uuidIdentifier(fields.connectionId);}catch{throw new HelpdeskError(503,'invalid_database_result','Coleção local indisponível.');}
    if(typeof fields.tenantId!=='string'||fields.tenantId.length<1||fields.tenantId.length>256||fields.tenantId.trim()!==fields.tenantId||/[\u0000-\u001f\u007f-\u009f]/u.test(fields.tenantId)||seen.has(String(fields.accountId)))throw new HelpdeskError(503,'invalid_database_result','Coleção local indisponível.');seen.add(String(fields.accountId));
   }
   localContexts=JSON.stringify(data);
  }
  // This server-controlled predicate precedes cursor/search/LIMIT. Metadata only
  // narrows namespaces; directory and ordinary RLS recheck the full current works.
  const localPredicate=this.localCollection?`and exists(select 1 from jsonb_array_elements($13::jsonb) local_context
    where local_context->>'accountId'=tickets.account_id::text and local_context->>'productInstanceId'=tickets.product_instance_id::text
     and local_context->>'connectionId'=helpdesk_auth.cg_local_ticket_directory(tickets.id)->'refs'->0->>'connectionId'
     and local_context->>'tenantId'=helpdesk_auth.cg_local_ticket_directory(tickets.id)->'refs'->0->>'tenantId')`:'';
  // No interpolation of caller search text or private-note/message joins. RLS stays in effect.
  return (await this.c.query(`select ${ticketReadColumns}${this.consulteGeoLocal?',helpdesk_auth.cg_local_ticket_summary(tickets.id) as consultegeo_summary':''} from helpdesk_core.tickets
   where workspace_id=$1 and ($2::uuid is null or account_id=$2)
    ${localPredicate}
    and ($3::timestamptz is null or (created_at,id)<($3::timestamptz,$4::uuid))
    and ($6::text is null or strpos(translate(subject,$7::text,$8::text),$6)>0 or id::text=$6)
    and ($9::text[] is null or status=any($9::text[]))
    and ($10::text is null or priority=$10)
    and ($11::text is null or (helpdesk_auth.is_operator(workspace_id,account_id)
     and (($11='mine' and assigned_to=$12::uuid) or ($11='unassigned' and assigned_to is null))))
   order by tickets.created_at desc,id desc limit $5`,
   [this.p.workspaceId,accountId??null,cursor?.at??null,cursor?.id??null,limit,
    filters.q??null,SEARCH_UPPER,SEARCH_LOWER,statusesForSearch(filters),filters.priority??null,filters.assignment??null,this.p.id,...(this.localCollection?[localContexts]:[])])).rows.map(row=>ticket(row,this.consulteGeoLocal));
 }
 async insertTicket(t:Ticket):Promise<void>{await this.insert('helpdesk_core.tickets',ticketColumns.split(','),[t.id,t.workspaceId,t.accountId,t.productInstanceId,t.serviceCode,t.createdBy,t.subject,t.description,t.status,t.priority,t.version,t.coverageId,t.contractVersionId,JSON.stringify(t.contractSnapshot),t.createdAt,t.updatedAt,t.assignedTo]);}
 async updateAssignment(t:Ticket,expectedVersion:number):Promise<void>{
  const r=await this.c.query('update helpdesk_core.tickets set assigned_to=$1,version=$2,updated_at=$3 where workspace_id=$4 and account_id=$5 and id=$6 and version=$7',[t.assignedTo,t.version,t.updatedAt,t.workspaceId,t.accountId,t.id,expectedVersion]);
  assertSingleWrite(r,'UPDATE');
 }
 async updatePriority(t:Ticket,expectedVersion:number):Promise<void>{
  const r=await this.c.query('update helpdesk_core.tickets set priority=$1,version=$2,updated_at=$3 where workspace_id=$4 and account_id=$5 and id=$6 and version=$7',[t.priority,t.version,t.updatedAt,t.workspaceId,t.accountId,t.id,expectedVersion]);
  assertSingleWrite(r,'UPDATE');
 }
 async updateTicket(t:Ticket,expectedVersion:number):Promise<void>{
  // Capture once before the optional HDN check waits. The checked target must
  // be the same target written afterwards, even if an internal caller mutates t.
  const change=Object.freeze({id:t.id,workspaceId:t.workspaceId,accountId:t.accountId,status:t.status,version:t.version,updatedAt:t.updatedAt});
  await assertLegacyTerminalUpdateAllowed(this.c,this.p,change,expectedVersion);
  const r=await this.c.query('update helpdesk_core.tickets set status=$1,version=$2,updated_at=$3 where workspace_id=$4 and id=$5 and version=$6',[change.status,change.version,change.updatedAt,change.workspaceId,change.id,expectedVersion]);
  assertSingleWrite(r,'UPDATE');
 }
 async lockIdempotency(operation:string,key:string):Promise<void>{await this.c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify([this.p.workspaceId,this.p.id,operation,key])]);}
 async getIdempotency(operation:string,key:string):Promise<StoredResult|null>{
  const rows=(await this.c.query('select helpdesk_auth.lookup_idempotency($1,$2) as record',[operation,key])).rows;
  return decodeIdempotencyLookup(rows,this.p,operation,key);
 }
 async saveIdempotency(r:StoredResult):Promise<void>{await this.insert('helpdesk_integration.api_idempotency_keys',['workspace_id','principal_id','operation','key','request_hash','result'],[r.workspaceId,r.principalId,r.operation,r.key,r.hash,JSON.stringify(r.result)]);}
 async addMessage(m:PublicMessage):Promise<void>{await this.insert('helpdesk_core.ticket_messages',['id','workspace_id','account_id','ticket_id','actor_id','actor_type','body','created_at'],[m.id,m.workspaceId,m.accountId,m.ticketId,m.actorId,m.actorType,m.body,m.createdAt]);}
 async addNote(n:InternalNote):Promise<void>{await this.insert('helpdesk_core.internal_notes',['id','workspace_id','account_id','ticket_id','actor_id','body','created_at'],[n.id,n.workspaceId,n.accountId,n.ticketId,n.actorId,n.body,n.createdAt]);}
 async messages(id:string,w:PageWindow={limit:100,cursor:null}):Promise<PublicMessage[]>{return createPostgresPublicWorkflowReader(this.c,this.p).messages(id,w);}
 async notes(id:string,w:PageWindow={limit:100,cursor:null}):Promise<InternalNote[]>{return (await this.c.query(`select id,workspace_id,account_id,ticket_id,actor_id,body,${timeColumn('created_at')} from helpdesk_core.internal_notes where workspace_id=$1 and ticket_id=$2 and ($3::timestamptz is null or (created_at,id)<($3::timestamptz,$4::uuid)) order by internal_notes.created_at desc,id desc limit $5`,[this.p.workspaceId,id,w.cursor?.at??null,w.cursor?.id??null,w.limit])).rows.map(note);}
 async addEvent(e:TicketEvent):Promise<void>{await this.insert('helpdesk_core.ticket_events',['id','workspace_id','account_id','ticket_id','actor_id','type','customer_visible','data','created_at'],[e.id,e.workspaceId,e.accountId,e.ticketId,e.actorId,e.type,e.customerVisible,JSON.stringify(e.data),e.createdAt]);}
 async events(id:string,includeInternal:boolean,w:PageWindow={limit:100,cursor:null}):Promise<TicketEvent[]>{return createPostgresPublicWorkflowReader(this.c,this.p).events(id,includeInternal,w);}
 async enqueue(e:Parameters<Store['enqueue']>[0]):Promise<void>{await this.insert('helpdesk_integration.outbox_events',['id','workspace_id','account_id','ticket_id','type','payload','request_id','created_at'],[e.id,e.workspaceId,e.accountId,e.ticketId,e.type,JSON.stringify(e.payload),e.requestId,e.createdAt]);}
}

/** Scoped route adapter: no pool acquisition, nested transaction or identity substitution. */
export function createBorrowedPostgresUnitOfWork(client:SqlClient,p:Principal,options:{localCollection?:boolean;consulteGeoLocal?:boolean}={}):UnitOfWork{const localCollection=options.localCollection===true,consulteGeoLocal=options.consulteGeoLocal===true;return {async run(actor,work){assertBorrowedTransactionIdentity(client,p);if(JSON.stringify(actor)!==JSON.stringify(p))throw new HelpdeskError(403,'transaction_identity_changed','Contexto alterado.');return work(new PostgresStore(client,p,localCollection,consulteGeoLocal));}};}
