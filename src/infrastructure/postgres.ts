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
 if(version!=='0.8.0')throw new HelpdeskError(503,'schema_version_mismatch','Banco incompatível com esta versão da API.');
}
/** Startup guard for accidental exposure/disabled RLS; not a proof of policy semantics. */
export async function assertDatabaseSecurity(pool:SqlPool):Promise<void>{
 const row=(await pool.query(`with schemas as (
  select * from pg_catalog.pg_namespace where nspname in ('helpdesk_core','helpdesk_auth','helpdesk_integration','helpdesk_audit')
 ), tables as (select c.* from pg_catalog.pg_class c join schemas n on n.oid=c.relnamespace where c.relkind='r')
 select (select count(*)::integer from tables) as table_count,
 (select count(*)::integer from tables where not relrowsecurity or not relforcerowsecurity) as unsafe_tables,
 exists(select 1 from schemas n cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a where a.grantee=0) as public_schema_access,
 exists(select 1 from schemas n cross join pg_catalog.pg_roles r where r.rolname in ('anon','authenticated','service_role')
  and pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE')) as client_schema_access,
 exists(select 1 from pg_catalog.pg_proc p join schemas n on n.oid=p.pronamespace
  cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
  where a.grantee=0 and a.privilege_type='EXECUTE') as public_helper_execute`)).rows[0];
 if(!row||row.table_count!==23||row.unsafe_tables!==0||row.public_schema_access!==false||row.client_schema_access!==false||row.public_helper_execute!==false)
  throw new HelpdeskError(503,'unsafe_database_policies','Estrutura ou proteções do banco não correspondem à versão homologável.');
}
export function observePoolErrors(pool:SqlPool,observe:(event:{component:string;event:string})=>void):void{
 pool.on?.('error',()=>{try{observe({component:'helpdesk.database',event:'idle_connection_error'});}catch{/* No raw connection errors or throwing telemetry callbacks. */}});
}
export class PostgresUnitOfWork implements UnitOfWork{
 readonly pool:SqlPool;constructor(pool:SqlPool){this.pool=pool;}
 async run<T>(p:Principal,work:(s:Store)=>Promise<T>):Promise<T>{
  return runTransaction(this.pool,p,client=>work(new PostgresStore(client,p)));
 }
}
type Row=Record<string,unknown>;const str=(r:Row,k:string)=>String(r[k]);const iso=(v:unknown)=>new Date(v as string|Date).toISOString();
function ticket(r:Row):Ticket{return {id:str(r,'id'),workspaceId:str(r,'workspace_id'),accountId:str(r,'account_id'),productInstanceId:str(r,'product_instance_id'),serviceCode:str(r,'service_code'),createdBy:str(r,'created_by'),subject:str(r,'subject'),description:str(r,'description'),status:r.status as Ticket['status'],priority:r.priority as Ticket['priority'],version:Number(r.version),coverageId:str(r,'coverage_id'),contractVersionId:str(r,'contract_version_id'),contractSnapshot:r.contract_snapshot as Ticket['contractSnapshot'],createdAt:iso(r.created_at),updatedAt:iso(r.updated_at)};}
function message(r:Row):PublicMessage{return {id:str(r,'id'),workspaceId:str(r,'workspace_id'),accountId:str(r,'account_id'),ticketId:str(r,'ticket_id'),actorId:str(r,'actor_id'),actorType:r.actor_type as PublicMessage['actorType'],body:str(r,'body'),createdAt:iso(r.created_at)};}
function note(r:Row):InternalNote{return {id:str(r,'id'),workspaceId:str(r,'workspace_id'),accountId:str(r,'account_id'),ticketId:str(r,'ticket_id'),actorId:str(r,'actor_id'),body:str(r,'body'),createdAt:iso(r.created_at)};}
const ticketColumns='id,workspace_id,account_id,product_instance_id,service_code,created_by,subject,description,status,priority,version,coverage_id,contract_version_id,contract_snapshot,created_at,updated_at';
class PostgresStore implements Store{
 readonly c:SqlClient;readonly p:Principal;constructor(c:SqlClient,p:Principal){this.c=c;this.p=p;}
 // Table and column names in this helper are developer-owned constants, never request values.
 private async insert(table:string,columns:string[],values:unknown[]):Promise<void>{await this.c.query(`insert into ${table} (${columns.join(',')}) values (${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);}
 async supportContexts(window:CatalogWindow,_at:string):Promise<SupportCatalogEntry[]>{
  const rows=(await this.c.query('select item from helpdesk_auth.support_contexts($1,$2,$3,$4,$5,$6) as result(item)',
   [this.p.workspaceId,window.accountId??null,window.after?.accountId??null,window.after?.productInstanceId??null,window.after?.serviceCode??null,window.limit])).rows;
  return rows.map(r=>r.item as SupportCatalogEntry);
 }
 async coverages(context:SupportContext):Promise<Coverage[]>{const rows=(await this.c.query('select item from helpdesk_auth.locked_coverages($1,$2,$3,$4) as result(item)',[this.p.workspaceId,context.accountId,context.productInstanceId,context.serviceCode])).rows;return rows.map(r=>r.item as Coverage);}
 async getTicket(id:string,lock=false):Promise<Ticket|null>{const r=(await this.c.query(`select ${ticketColumns} from helpdesk_core.tickets where workspace_id=$1 and id=$2${lock?' for update':''}`,[this.p.workspaceId,id])).rows[0];return r?ticket(r):null;}
 async listTickets(limit:number,cursor:Cursor|null,accountId?:string,filters:TicketSearchFilters={}):Promise<Ticket[]>{
  // No interpolation of search text, no private-note/message joins. RLS stays in effect.
  return (await this.c.query(`select ${ticketColumns} from helpdesk_core.tickets
   where workspace_id=$1 and ($2::uuid is null or account_id=$2)
    and ($3::timestamptz is null or (created_at,id)<($3::timestamptz,$4::uuid))
    and ($6::text is null or strpos(translate(subject,$7::text,$8::text),$6)>0 or id::text=$6)
    and ($9::text[] is null or status=any($9::text[]))
    and ($10::text is null or priority=$10)
   order by created_at desc,id desc limit $5`,
   [this.p.workspaceId,accountId??null,cursor?.at??null,cursor?.id??null,limit,
    filters.q??null,SEARCH_UPPER,SEARCH_LOWER,statusesForSearch(filters),filters.priority??null])).rows.map(ticket);
 }
 async insertTicket(t:Ticket):Promise<void>{await this.insert('helpdesk_core.tickets',ticketColumns.split(','),[t.id,t.workspaceId,t.accountId,t.productInstanceId,t.serviceCode,t.createdBy,t.subject,t.description,t.status,t.priority,t.version,t.coverageId,t.contractVersionId,JSON.stringify(t.contractSnapshot),t.createdAt,t.updatedAt]);}
 async updatePriority(t:Ticket,expectedVersion:number):Promise<void>{
  const r=await this.c.query('update helpdesk_core.tickets set priority=$1,version=$2,updated_at=$3 where workspace_id=$4 and account_id=$5 and id=$6 and version=$7',[t.priority,t.version,t.updatedAt,t.workspaceId,t.accountId,t.id,expectedVersion]);
  if(r.rowCount!==1)throw new HelpdeskError(412,'version_conflict','O chamado foi alterado ou deixou de estar acessível.');
 }
 async updateTicket(t:Ticket,expectedVersion:number):Promise<void>{const r=await this.c.query('update helpdesk_core.tickets set status=$1,version=$2,updated_at=$3 where workspace_id=$4 and id=$5 and version=$6',[t.status,t.version,t.updatedAt,t.workspaceId,t.id,expectedVersion]);if(r.rowCount!==1)throw new HelpdeskError(412,'version_conflict','O chamado foi alterado ou deixou de estar acessível.');}
 async lockIdempotency(operation:string,key:string):Promise<void>{await this.c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[JSON.stringify([this.p.workspaceId,this.p.id,operation,key])]);}
 async getIdempotency(operation:string,key:string):Promise<StoredResult|null>{
  const value=(await this.c.query('select helpdesk_auth.lookup_idempotency($1,$2) as record',[operation,key])).rows[0]?.record as {hash?:string;result?:unknown;expired?:boolean;denied?:boolean}|null;
  return value?{workspaceId:this.p.workspaceId,principalId:this.p.id,operation,key,hash:value.hash??'',result:value.result,expired:value.expired===true,denied:value.denied===true}:null;
 }
 async saveIdempotency(r:StoredResult):Promise<void>{await this.insert('helpdesk_integration.api_idempotency_keys',['workspace_id','principal_id','operation','key','request_hash','result'],[r.workspaceId,r.principalId,r.operation,r.key,r.hash,JSON.stringify(r.result)]);}
 async addMessage(m:PublicMessage):Promise<void>{await this.insert('helpdesk_core.ticket_messages',['id','workspace_id','account_id','ticket_id','actor_id','actor_type','body','created_at'],[m.id,m.workspaceId,m.accountId,m.ticketId,m.actorId,m.actorType,m.body,m.createdAt]);}
 async addNote(n:InternalNote):Promise<void>{await this.insert('helpdesk_core.internal_notes',['id','workspace_id','account_id','ticket_id','actor_id','body','created_at'],[n.id,n.workspaceId,n.accountId,n.ticketId,n.actorId,n.body,n.createdAt]);}
 async messages(id:string,w:PageWindow={limit:100,cursor:null}):Promise<PublicMessage[]>{return (await this.c.query('select id,workspace_id,account_id,ticket_id,actor_id,actor_type,body,created_at from helpdesk_core.ticket_messages where workspace_id=$1 and ticket_id=$2 and ($3::timestamptz is null or (created_at,id)<($3::timestamptz,$4::uuid)) order by created_at desc,id desc limit $5',[this.p.workspaceId,id,w.cursor?.at??null,w.cursor?.id??null,w.limit])).rows.map(message);}
 async notes(id:string,w:PageWindow={limit:100,cursor:null}):Promise<InternalNote[]>{return (await this.c.query('select id,workspace_id,account_id,ticket_id,actor_id,body,created_at from helpdesk_core.internal_notes where workspace_id=$1 and ticket_id=$2 and ($3::timestamptz is null or (created_at,id)<($3::timestamptz,$4::uuid)) order by created_at desc,id desc limit $5',[this.p.workspaceId,id,w.cursor?.at??null,w.cursor?.id??null,w.limit])).rows.map(note);}
 async addEvent(e:TicketEvent):Promise<void>{await this.insert('helpdesk_core.ticket_events',['id','workspace_id','account_id','ticket_id','actor_id','type','customer_visible','data','created_at'],[e.id,e.workspaceId,e.accountId,e.ticketId,e.actorId,e.type,e.customerVisible,JSON.stringify(e.data),e.createdAt]);}
 async events(id:string,includeInternal:boolean,w:PageWindow={limit:100,cursor:null}):Promise<TicketEvent[]>{return (await this.c.query('select id,workspace_id,account_id,ticket_id,actor_id,type,customer_visible,data,created_at from helpdesk_core.ticket_events where workspace_id=$1 and ticket_id=$2 and ($3::boolean or customer_visible) and ($4::timestamptz is null or (created_at,id)<($4::timestamptz,$5::uuid)) order by created_at desc,id desc limit $6',[this.p.workspaceId,id,includeInternal,w.cursor?.at??null,w.cursor?.id??null,w.limit])).rows.map(r=>({id:str(r,'id'),workspaceId:str(r,'workspace_id'),accountId:str(r,'account_id'),ticketId:str(r,'ticket_id'),actorId:str(r,'actor_id'),type:str(r,'type'),customerVisible:r.customer_visible===true,data:r.data as Record<string,unknown>,createdAt:iso(r.created_at)}));}
 async enqueue(e:Parameters<Store['enqueue']>[0]):Promise<void>{await this.insert('helpdesk_integration.outbox_events',['id','workspace_id','account_id','ticket_id','type','payload','request_id','created_at'],[e.id,e.workspaceId,e.accountId,e.ticketId,e.type,JSON.stringify(e.payload),e.requestId,e.createdAt]);}
}
