import type {SqlPool} from './sql.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {DATABASE_SECURITY_CONTRACT} from './database-security-contract.ts';

/** One read-only catalogue query; no ticket, credential, token, or message values. */
export const DATABASE_SECURITY_QUERY = `with
 contract as (select $1::jsonb as doc),
 expected_tables as (select * from pg_catalog.jsonb_to_recordset((select doc->'tables' from contract)) as x(name text,read boolean,"insert" boolean,updates text[])),
 expected_functions as (select * from pg_catalog.jsonb_to_recordset((select doc->'functions' from contract)) as x(signature text,definer boolean,execute boolean)),
 expected_triggers as (select * from pg_catalog.jsonb_to_recordset((select doc->'triggers' from contract)) as x("table" text,name text,"function" text,type integer,deferred boolean)),
 expected_constraints as (select * from pg_catalog.jsonb_to_recordset((select doc->'constraints' from contract)) as x("table" text,name text,type text)),
 expected_policies as (select * from pg_catalog.jsonb_to_recordset((select doc->'policies' from contract)) as x("table" text,name text,permissive boolean,command text)),
 schemas as (select * from pg_catalog.pg_namespace where nspname=any($2::text[])),
 tables as (select c.*,n.nspname||'.'||c.relname as full_name from pg_catalog.pg_class c join schemas n on n.oid=c.relnamespace where c.relkind in ('r','p','v','m','f','S')),
 functions as (select p.*,r.rolsuper,r.rolbypassrls,r.rolname as owner_name,
  n.nspname||'.'||p.proname||'('||pg_catalog.oidvectortypes(p.proargtypes)||')' as signature
  from pg_catalog.pg_proc p join schemas n on n.oid=p.pronamespace join pg_catalog.pg_roles r on r.oid=p.proowner),
 app as (select oid from pg_catalog.pg_roles where rolname='helpdesk_app'),
 clients as (select oid from pg_catalog.pg_roles where rolname in ('anon','authenticated','service_role'))
 select
 (select count(*)::integer from tables where relkind='r') as table_count,
 (select count(*)::integer from tables where not relrowsecurity or not relforcerowsecurity) as unsafe_tables,
 exists(select 1 from schemas n cross join lateral pg_catalog.aclexplode(coalesce(n.nspacl,pg_catalog.acldefault('n',n.nspowner))) a where a.grantee=0) as public_schema_access,
 exists(select 1 from schemas n cross join clients r where pg_catalog.has_schema_privilege(r.oid,n.oid,'USAGE,CREATE')) as client_schema_access,
 exists(select 1 from functions p cross join lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') as public_helper_execute,
 ((select count(*) from schemas)=4 and not exists(select 1 from schemas n
  where not pg_catalog.has_schema_privilege(current_user,n.oid,'USAGE')
   or pg_catalog.has_schema_privilege(current_user,n.oid,'CREATE,USAGE WITH GRANT OPTION'))) as schema_contract_ok,
 (not exists(select 1 from expected_tables e full join tables t on t.full_name=e.name
  where e.name is null or t.oid is null or t.relkind<>'r')) as table_contract_ok,
 (not exists(select 1 from tables t join expected_tables e on e.name=t.full_name where
  pg_catalog.has_table_privilege(current_user,t.oid,'SELECT') is distinct from e.read
  or pg_catalog.has_table_privilege(current_user,t.oid,'INSERT') is distinct from e."insert"
  or pg_catalog.has_table_privilege(current_user,t.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
  or pg_catalog.has_table_privilege(current_user,t.oid,'SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION'))
  ) as table_privileges_ok,
 (not exists(select 1 from tables t join expected_tables e on e.name=t.full_name
  join pg_catalog.pg_attribute a on a.attrelid=t.oid and a.attnum>0 and not a.attisdropped where
  pg_catalog.has_column_privilege(current_user,t.oid,a.attnum,'SELECT') is distinct from e.read
  or pg_catalog.has_column_privilege(current_user,t.oid,a.attnum,'INSERT') is distinct from e."insert"
  or pg_catalog.has_column_privilege(current_user,t.oid,a.attnum,'UPDATE') is distinct from (a.attname=any(e.updates))
  or pg_catalog.has_column_privilege(current_user,t.oid,a.attnum,'REFERENCES,SELECT WITH GRANT OPTION,INSERT WITH GRANT OPTION,UPDATE WITH GRANT OPTION'))
  ) as column_privileges_ok,
 (not exists(select 1 from tables t cross join clients r where
   pg_catalog.has_table_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
   or pg_catalog.has_any_column_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,REFERENCES'))
  and not exists(select 1 from functions p cross join clients r where pg_catalog.has_function_privilege(r.oid,p.oid,'EXECUTE'))
  and not exists(select 1 from tables t cross join lateral pg_catalog.aclexplode(coalesce(t.relacl,pg_catalog.acldefault('r',t.relowner))) a where a.grantee=0)
  and not exists(select 1 from tables t join pg_catalog.pg_attribute c on c.attrelid=t.oid
   cross join lateral pg_catalog.aclexplode(c.attacl) a where a.grantee=0)) as client_object_privileges_ok,
 (not exists(select 1 from expected_functions e full join functions p on p.signature=e.signature
  where e.signature is null or p.oid is null or p.prokind<>'f' or p.prosecdef is distinct from e.definer)) as helper_contract_ok,
 (not exists(select 1 from functions p join expected_functions e on e.signature=p.signature
  where pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE') is distinct from e.execute
   or pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE WITH GRANT OPTION'))) as helper_privileges_ok,
 (not exists(select 1 from functions p where p.owner_name='helpdesk_app'
  or not coalesce(p.proconfig @> array['search_path=""'] or p.proconfig @> array['search_path='],false)
  or (p.prosecdef and not (p.rolsuper or p.rolbypassrls)))) as helper_settings_ok,
 (not exists(select 1 from expected_triggers e left join tables t on t.full_name=e."table"
  left join pg_catalog.pg_trigger g on g.tgrelid=t.oid and g.tgname=e.name
  left join functions p on p.oid=g.tgfoid where g.oid is null or g.tgenabled not in ('O','A')
   or g.tgisinternal or g.tgtype<>e.type or g.tgdeferrable is distinct from e.deferred
   or g.tginitdeferred is distinct from e.deferred or p.signature is distinct from e."function")
  and not exists(select 1 from pg_catalog.pg_trigger g join tables t on t.oid=g.tgrelid where g.tgenabled not in ('O','A'))) as trigger_contract_ok,
 (not exists(select 1 from expected_constraints e left join tables t on t.full_name=e."table"
  left join pg_catalog.pg_constraint c on c.conrelid=t.oid and c.conname=e.name
  where c.oid is null or c.contype::text<>e.type or not c.convalidated)
  and not exists(select 1 from pg_catalog.pg_constraint c join tables t on t.oid=c.conrelid where not c.convalidated)) as constraint_contract_ok,
 (not exists(select 1 from pg_catalog.pg_index i join tables t on t.oid=i.indrelid where not i.indisvalid or not i.indisready)
  and exists(select 1 from pg_catalog.pg_index i join pg_catalog.pg_class x on x.oid=i.indexrelid
   join tables t on t.oid=i.indrelid where t.full_name='helpdesk_core.ticket_events' and x.relname='assignment_event_version'
    and i.indisunique and i.indisvalid and i.indisready)) as index_contract_ok,
 ((select count(*) from pg_catalog.pg_policy p join tables t on t.oid=p.polrelid)=(select count(*) from expected_policies)
  and not exists(select 1 from expected_policies e left join tables t on t.full_name=e."table"
   left join pg_catalog.pg_policy p on p.polrelid=t.oid and p.polname=e.name where p.oid is null
    or p.polpermissive is distinct from e.permissive or p.polcmd::text<>e.command
    or p.polroles is distinct from array[(select oid from app)]::oid[])) as policy_contract_ok,
 (pg_catalog.current_setting('server_version_num')::integer between 170000 and 179999
  and pg_catalog.current_setting('row_security')='on'
  and pg_catalog.current_setting('session_replication_role')='origin') as execution_settings_ok`;

export const READINESS_FLAGS = Object.freeze([
 'schema_contract_ok','table_contract_ok','table_privileges_ok','column_privileges_ok',
 'client_object_privileges_ok','helper_contract_ok','helper_privileges_ok','helper_settings_ok',
 'trigger_contract_ok','constraint_contract_ok','index_contract_ok','policy_contract_ok','execution_settings_ok'
] as const);

export async function assertDatabaseSecurity(pool:SqlPool):Promise<void>{
 const result=await pool.query(DATABASE_SECURITY_QUERY,[JSON.stringify(DATABASE_SECURITY_CONTRACT),[...DATABASE_SECURITY_CONTRACT.schemas]]);
 const row=result.rows[0];
 if(result.rows.length!==1||!row||row.table_count!==23||row.unsafe_tables!==0
  ||row.public_schema_access!==false||row.client_schema_access!==false||row.public_helper_execute!==false
  ||READINESS_FLAGS.some(key=>row[key]!==true))
  throw new HelpdeskError(503,'unsafe_database_policies','Estrutura ou proteções do banco não correspondem à versão homologável.');
}
