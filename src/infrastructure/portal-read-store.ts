import type {SqlClient} from './sql.ts';import type {PortalReadStore} from '../application/portal-read.ts';
import {buildPortalSql,portalError} from '../domain/portal-query.ts';
/** Candidate adapter for documented core tables + CG03d private helper. No schema
 * creation or privilege changes. Does NOT invent structured-profile persistence. */
export function createPostgresPortalReadStore(client:SqlClient):PortalReadStore{
 return {
  async assertReady(){const q=await client.query(`select current_user as role,session_user as login,r.rolsuper,r.rolbypassrls,r.rolcreaterole as create_role,r.rolcreatedb as create_database,r.rolreplication as replication,
   (exists(select 1 from pg_namespace n where n.nspowner=r.oid and n.nspname like 'helpdesk_%') or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proowner=r.oid and n.nspname like 'helpdesk_%')) as owns_objects,
   exists(select 1 from pg_auth_members m where m.member=r.oid) as membership,
   exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relowner=r.oid and n.nspname like 'helpdesk_%') as owner,
   helpdesk_auth.schema_version() as version,
   to_regprocedure('helpdesk_auth.cg_ticket_resource_allowed(uuid,uuid,uuid,text)') is not null as scoped
   from pg_roles r where r.rolname=current_user`);const r=q.rows[0];if(q.command!=='SELECT'||q.rowCount!==1||!r||r.role!=='helpdesk_app'||r.login!=='helpdesk_app'||r.rolsuper!==false||r.rolbypassrls!==false||r.membership!==false||r.owner!==false||['create_role','create_database','replication','owns_objects'].some(k=>r[k]!==false)||r.version!=='0.19.0'||r.scoped!==true)throw portalError('portal_store_not_ready');},
  async query(p,filter,after,limit,asOf){const q=buildPortalSql(p,filter,after,limit,asOf),result=await client.query(q.text,q.values);if(result.command!=='SELECT'||result.rowCount!==1||result.rows.length!==1||Object.keys(result.rows[0]!).length!==1)throw portalError('invalid_portal_result');return result.rows[0]!.snapshot;}
 };
}
