/** Catalogue profile only: creation provenance is enforced by M05's strict pre-admission. */
const privateSchemas="('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')";
export const QUALIFIED_SCHEMA_OWNER_SQL=`(SELECT owner.oid FROM pg_catalog.pg_roles owner
 WHERE owner.rolcreaterole AND (owner.rolsuper OR owner.rolbypassrls)
 AND owner.rolname NOT IN ('helpdesk_app','helpdesk_resource_publisher','helpdesk_notification_worker','helpdesk_maintenance','anon','authenticated','service_role')
 AND owner.oid=(SELECT n.nspowner FROM pg_catalog.pg_namespace n WHERE n.nspname IN ${privateSchemas}
 GROUP BY n.nspowner HAVING count(*)=4))`;
/** The same allowlist as all four promotion preludes, for global and private schema defaults. */
export const OWNER_DEFAULTS_OK_SQL=`(${QUALIFIED_SCHEMA_OWNER_SQL} IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
 WHERE d.defaclrole=${QUALIFIED_SCHEMA_OWNER_SQL}
 AND (d.defaclnamespace=0 OR d.defaclnamespace IN (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname IN ${privateSchemas}))
 AND a.grantee<>d.defaclrole AND NOT (a.grantee=0 AND d.defaclobjtype='f' AND a.privilege_type='EXECUTE')))`;
/** Only developer-owned identifiers are accepted; neither role names nor any-superuser grantors establish trust. */
export function unsafeServiceMembershipSql(roleOid:'role_oid'|'r.oid'):string{return `EXISTS(
 SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=${roleOid}
 OR (m.roleid=${roleOid} AND NOT ((m.member=${QUALIFIED_SCHEMA_OWNER_SQL}
 AND m.grantor=10 AND EXISTS(SELECT 1 FROM pg_catalog.pg_roles bootstrap WHERE bootstrap.oid=10 AND bootstrap.rolsuper)
 AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option) IS TRUE)))`;}
export const SERVICE_FINAL_GUARD=`DO $m05_final$
DECLARE role_name text;role_oid oid;role_row record;ns record;obj record;allowed boolean;
BEGIN
 IF NOT ${OWNER_DEFAULTS_OK_SQL} THEN RAISE EXCEPTION 'Unqualified schema owner or defaults' USING ERRCODE='HDU06';END IF;
 FOREACH role_name IN ARRAY ARRAY['helpdesk_resource_publisher','helpdesk_notification_worker'] LOOP
  SELECT * INTO role_row FROM pg_roles WHERE rolname=role_name;IF NOT FOUND THEN RAISE EXCEPTION 'Service boundary unavailable' USING ERRCODE='HDU06';END IF;role_oid:=role_row.oid;
  IF role_row.rolsuper OR role_row.rolbypassrls OR role_row.rolcreaterole OR role_row.rolcreatedb OR role_row.rolreplication OR role_row.rolinherit OR ${unsafeServiceMembershipSql('role_oid')} THEN RAISE EXCEPTION 'Service boundary unsafe' USING ERRCODE='HDU06';END IF;
  FOR ns IN SELECT * FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') LOOP
   allowed:=role_name='helpdesk_resource_publisher' AND ns.nspname='helpdesk_auth';
   IF ns.nspowner=role_oid OR has_schema_privilege(role_oid,ns.oid,'USAGE') IS DISTINCT FROM allowed OR has_schema_privilege(role_oid,ns.oid,'CREATE,USAGE WITH GRANT OPTION') THEN RAISE EXCEPTION 'Service schema boundary unsafe' USING ERRCODE='HDU06';END IF;
  END LOOP;
  FOR obj IN SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND c.relkind='r' LOOP
   IF obj.relowner=role_oid OR has_table_privilege(role_oid,obj.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege(role_oid,obj.oid,'SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'Service table boundary unsafe' USING ERRCODE='HDU06';END IF;
  END LOOP;
  FOR obj IN SELECT p.*,n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')' AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') LOOP
   allowed:=role_name='helpdesk_resource_publisher' AND obj.signature IN ('helpdesk_auth.cg_publication_open(text, text)','helpdesk_auth.cg_publication_replace(text, text, text, text, text)','helpdesk_auth.cg_publication_append(text, text, text)');
   IF obj.proowner=role_oid OR has_function_privilege(role_oid,obj.oid,'EXECUTE') IS DISTINCT FROM allowed OR has_function_privilege(role_oid,obj.oid,'EXECUTE WITH GRANT OPTION') THEN RAISE EXCEPTION 'Service function boundary unsafe' USING ERRCODE='HDU06';END IF;
  END LOOP;
 END LOOP;
END $m05_final$;`;
