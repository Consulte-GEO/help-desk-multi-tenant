/** Explicit qualified guard-only revision. No historical fixture is rewritten. */
import {createHash} from 'node:crypto';import {SERVICE_FINAL_GUARD} from './consultegeo-service-membership.ts';
const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const LEGACY_FINAL_GUARD="DO $m05_final$\nDECLARE role_name text;role_oid oid;role_row record;ns record;obj record;allowed boolean;\nBEGIN\n FOREACH role_name IN ARRAY ARRAY['helpdesk_resource_publisher','helpdesk_notification_worker'] LOOP\n  SELECT * INTO role_row FROM pg_roles WHERE rolname=role_name;IF NOT FOUND THEN RAISE EXCEPTION 'Service boundary unavailable' USING ERRCODE='HDU06';END IF;role_oid:=role_row.oid;\n  IF role_row.rolsuper OR role_row.rolbypassrls OR role_row.rolcreaterole OR role_row.rolcreatedb OR role_row.rolreplication OR role_row.rolinherit OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_oid OR roleid=role_oid) THEN RAISE EXCEPTION 'Service boundary unsafe' USING ERRCODE='HDU06';END IF;\n  FOR ns IN SELECT * FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') LOOP\n   allowed:=role_name='helpdesk_resource_publisher' AND ns.nspname='helpdesk_auth';\n   IF ns.nspowner=role_oid OR has_schema_privilege(role_oid,ns.oid,'USAGE') IS DISTINCT FROM allowed OR has_schema_privilege(role_oid,ns.oid,'CREATE,USAGE WITH GRANT OPTION') THEN RAISE EXCEPTION 'Service schema boundary unsafe' USING ERRCODE='HDU06';END IF;\n  END LOOP;\n  FOR obj IN SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND c.relkind='r' LOOP\n   IF obj.relowner=role_oid OR has_table_privilege(role_oid,obj.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege(role_oid,obj.oid,'SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'Service table boundary unsafe' USING ERRCODE='HDU06';END IF;\n  END LOOP;\n  FOR obj IN SELECT p.*,n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')' AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') LOOP\n   allowed:=role_name='helpdesk_resource_publisher' AND obj.signature IN ('helpdesk_auth.cg_publication_open(text, text)','helpdesk_auth.cg_publication_replace(text, text, text, text, text)','helpdesk_auth.cg_publication_append(text, text, text)');\n   IF obj.proowner=role_oid OR has_function_privilege(role_oid,obj.oid,'EXECUTE') IS DISTINCT FROM allowed OR has_function_privilege(role_oid,obj.oid,'EXECUTE WITH GRANT OPTION') THEN RAISE EXCEPTION 'Service function boundary unsafe' USING ERRCODE='HDU06';END IF;\n  END LOOP;\n END LOOP;\nEND $m05_final$;";
export const GUARD_REVISIONS=Object.freeze([
  {
    "file": "20261013181408_consultegeo_m05_upgrade.sql",
    "oldSha256": "23aae798d34cf5c4d6e96478761dfb2e5208dc071fd886f2ab56d78e12d83b1a",
    "newSha256": "ddb84087f1a48367fb8546947d818d0b45578dac2a2c184f382e8a4e84426ecc",
    "operation": "replace-final-service-guard"
  },
  {
    "file": "20261013195704_consultegeo_m06_public_conversation.sql",
    "oldSha256": "10a397bd74b6ba2c81bd115c63ad205bc2aeac157686812e7d040ffcf353f09b",
    "newSha256": "2e3b9e098e72a1afc05fbd32ce9adf3cee730ddd779cb1435bb13e3e59fc413a",
    "operation": "replace-final-service-guard"
  },
  {
    "file": "20261013233838_consultegeo_m09b_intake.sql",
    "oldSha256": "4c54493c8d46b7c3f86e77666be0f618df8fd6512dd5cae3f279d31248e1be7a",
    "newSha256": "3c4a515745a3c6152c73c1e9f684a3f0ec3699a4fbd589cfbdf67510d94cb8af",
    "operation": "replace-final-service-guard"
  },
  {
    "file": "20261014015714_consultegeo_m09c_atomic_opening.sql",
    "oldSha256": "5da69e1865d63c94f9ee61ce86d3a16b1103b557cc9a04bdaaa8af5bad4b0e93",
    "newSha256": "10847387946f06cfb292fc849e97917a48cdd0e18ad07ba49a7bc34340b003bd",
    "operation": "replace-final-service-guard"
  }
].map(x=>Object.freeze(x)));
export const GUARD_REVISION_MANIFEST=Object.freeze({format:1,revision:'pg17-bootstrap-owner-v1',oldGuardSha256:digest(LEGACY_FINAL_GUARD),newGuardSha256:digest(SERVICE_FINAL_GUARD),migrations:GUARD_REVISIONS});
export function restoreQualifiedGuard(file:string,sql:string):string{
 const revision=GUARD_REVISIONS.find(x=>x.file===file);if(!revision)return sql;
 if(digest(sql)!==revision.newSha256||sql.split(SERVICE_FINAL_GUARD).length!==2)throw Error('Unqualified guard revision');
 const old=sql.replace(SERVICE_FINAL_GUARD,LEGACY_FINAL_GUARD);
 if(digest(old)!==revision.oldSha256)throw Error('Functional migration body changed');return old;
}
