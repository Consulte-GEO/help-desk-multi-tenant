-- Consulte GEO M06: selective public workflow projection; no backfill or grants to consumers.
BEGIN;
SET LOCAL statement_timeout='120s';
SET LOCAL lock_timeout='10s';
DO $m06$
DECLARE who oid:=current_user::regrole;
BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 OR current_user<>session_user
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=who AND (rolsuper OR rolbypassrls) AND rolcreaterole)
 OR (SELECT count(*) FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND nspowner=who)<>4
 THEN RAISE EXCEPTION 'Reviewed operator required' USING ERRCODE='HDU01'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('Consulte GEO schema upgrade',0));
 IF helpdesk_auth.schema_version() IS DISTINCT FROM '0.20.0' THEN RAISE EXCEPTION 'Exact prior schema required' USING ERRCODE='HDU02'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='helpdesk_auth' AND p.proname IN ('hdn_ticket_directory','hdn_public_messages','hdn_public_events')) THEN RAISE EXCEPTION 'Partial installation refused' USING ERRCODE='HDU03'; END IF;
 IF EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE d.defaclrole=who
 AND (d.defaclnamespace=0 OR d.defaclnamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')))
 AND a.grantee<>who AND NOT (a.grantee=0 AND d.defaclobjtype='f' AND a.privilege_type='EXECUTE')) THEN RAISE EXCEPTION 'Unsafe defaults refused' USING ERRCODE='HDU05'; END IF;
END $m06$;
CREATE FUNCTION helpdesk_auth.hdn_ticket_directory(target uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;answer jsonb;expected integer;
BEGIN
 SELECT * INTO t FROM helpdesk_core.tickets WHERE workspace_id=helpdesk_auth.workspace_id() AND id=target;
 IF NOT FOUND OR NOT coalesce(helpdesk_auth.is_human(),false) OR NOT coalesce(helpdesk_auth.has_scope(t.workspace_id,'tickets:read'),false)
 OR NOT coalesce(helpdesk_auth.can_read_ticket(t.workspace_id,t.account_id,t.product_instance_id,t.created_by),false)
 OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(t.workspace_id,t.account_id,t.id,'tickets.read'),false) THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('ticketId',t.id,'workspaceId',t.workspace_id,'accountId',t.account_id,'refs',
 (SELECT coalesce(jsonb_agg(jsonb_build_object('connectionId',c.id,'tenantId',b.tenant_id,'type',r.resource_type,'id',r.resource_id) ORDER BY r.resource_type COLLATE "C",r.resource_id COLLATE "C"),'[]'::jsonb)
 FROM helpdesk_core.cg_ticket_resource_refs r WHERE r.workspace_id=t.workspace_id AND r.account_id=t.account_id AND r.ticket_id=t.id)),s.expected_count
 INTO answer,expected FROM helpdesk_core.cg_ticket_resource_sets s JOIN helpdesk_auth.cg_resource_bindings b ON (b.workspace_id,b.account_id,b.id)=(s.workspace_id,s.account_id,s.binding_id)
 JOIN helpdesk_auth.cg_resource_connections c ON (c.workspace_id,c.id)=(b.workspace_id,b.connection_id) AND c.product_instance_id=t.product_instance_id
 WHERE (s.workspace_id,s.account_id,s.ticket_id)=(t.workspace_id,t.account_id,t.id) AND s.sealed AND b.active AND c.active FOR SHARE OF s,b,c;
 IF answer IS NULL OR jsonb_array_length(answer->'refs') IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Directory unavailable' USING ERRCODE='HDW07'; END IF;
 RETURN answer;
END $$;
CREATE FUNCTION helpdesk_auth.hdn_public_messages(target uuid,after_at timestamptz,after_id uuid,page_limit integer) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;answer jsonb;
BEGIN

 SELECT * INTO t FROM helpdesk_core.tickets WHERE workspace_id=helpdesk_auth.workspace_id() AND id=target;
 IF NOT FOUND OR NOT coalesce(helpdesk_auth.has_scope(t.workspace_id,'tickets:read'),false)
 OR NOT coalesce(helpdesk_auth.can_read_ticket(t.workspace_id,t.account_id,t.product_instance_id,t.created_by),false)
 OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(t.workspace_id,t.account_id,t.id,'tickets.read'),false) THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
 IF page_limit IS NULL OR page_limit NOT BETWEEN 1 AND 101 OR (after_at IS NULL)<>(after_id IS NULL)
 OR (after_at IS NOT NULL AND (NOT isfinite(after_at) OR after_at<'0001-01-01'::timestamptz OR after_at>='10000-01-01'::timestamptz)) THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
 WITH projected AS (SELECT c.event_id,c.actor_id,c.public_event->>'actorKind' AS actor_type,c.public_event->>'body' AS body,c.at,
 jsonb_build_object('action',c.command->>'action','body',c.public_event->>'body','version',c.to_version) AS interaction
 FROM helpdesk_audit.hdn_workflow_commits c JOIN helpdesk_core.ticket_events e
 ON (e.workspace_id,e.account_id,e.ticket_id,e.id,e.actor_id,e.type,e.created_at)=(c.workspace_id,c.account_id,c.ticket_id,c.event_id,c.actor_id,c.core_type,c.at)
 WHERE (c.workspace_id,c.account_id,c.ticket_id)=(t.workspace_id,t.account_id,t.id)
 AND e.customer_visible AND c.core_type='ticket.status_changed' AND c.to_version=c.from_version+1 AND c.from_status<>c.to_status
 AND c.command->>'action' IN ('request_customer','customer_reply','resolve')
 AND ((c.command->>'action'='request_customer' AND c.to_status='waiting_customer') OR (c.command->>'action'='customer_reply' AND c.from_status='waiting_customer' AND c.to_status='open') OR (c.command->>'action'='resolve' AND c.to_status='resolved'))
 AND c.public_event->>'ticketId'=t.id::text AND c.public_event->>'workspaceId'=t.workspace_id::text
 AND c.public_event->>'actorId'=c.actor_id::text AND c.public_event->>'profileVersionId'=c.profile_version_id
 AND c.public_event->'sequence'=to_jsonb(c.to_version) AND c.command->'expectedVersion'=to_jsonb(c.from_version)
 AND c.public_event->>'from'=c.from_status AND c.public_event->>'to'=c.to_status
 AND e.data->>'from'=c.from_status AND e.data->>'to'=c.to_status
 AND pg_input_is_valid(c.public_event->>'at','timestamptz') AND (c.public_event->>'at')::timestamptz=c.at
 AND c.public_event->>'actorKind' IN ('human_agent','customer') AND jsonb_typeof(c.public_event->'body')='string'
 AND c.public_event->'body'=c.command->'body' AND length(btrim(c.public_event->>'body'))>0
 AND length(c.public_event->>'body')<=12000), items AS (
 SELECT m.id,m.actor_id,m.actor_type,m.body,m.created_at FROM helpdesk_core.ticket_messages m WHERE (m.workspace_id,m.account_id,m.ticket_id)=(t.workspace_id,t.account_id,t.id)
 UNION ALL SELECT c.event_id,c.actor_id,c.actor_type,c.body,c.at FROM projected c WHERE NOT EXISTS(SELECT 1 FROM helpdesk_core.ticket_messages m WHERE (m.workspace_id,m.account_id,m.ticket_id,m.id)=(t.workspace_id,t.account_id,t.id,c.event_id))
 ), limited AS (SELECT * FROM items WHERE after_at IS NULL OR (created_at,id)<(after_at,after_id) ORDER BY created_at DESC,id DESC LIMIT page_limit)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'workspaceId',t.workspace_id,'accountId',t.account_id,'ticketId',t.id,'actorId',actor_id,'actorType',actor_type,'body',body,'createdAt',helpdesk_auth.hdn_workflow_iso(created_at)) ORDER BY created_at DESC,id DESC),'[]'::jsonb) INTO answer FROM limited;
 RETURN answer;
END $$;
CREATE FUNCTION helpdesk_auth.hdn_public_events(target uuid,include_internal boolean,after_at timestamptz,after_id uuid,page_limit integer) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;answer jsonb;
BEGIN

 SELECT * INTO t FROM helpdesk_core.tickets WHERE workspace_id=helpdesk_auth.workspace_id() AND id=target;
 IF NOT FOUND OR NOT coalesce(helpdesk_auth.has_scope(t.workspace_id,'tickets:read'),false)
 OR NOT coalesce(helpdesk_auth.can_read_ticket(t.workspace_id,t.account_id,t.product_instance_id,t.created_by),false)
 OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(t.workspace_id,t.account_id,t.id,'tickets.read'),false) THEN RAISE EXCEPTION 'Denied' USING ERRCODE='42501'; END IF;
 IF page_limit IS NULL OR page_limit NOT BETWEEN 1 AND 101 OR (after_at IS NULL)<>(after_id IS NULL)
 OR (after_at IS NOT NULL AND (NOT isfinite(after_at) OR after_at<'0001-01-01'::timestamptz OR after_at>='10000-01-01'::timestamptz)) THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;

 IF include_internal IS NULL OR (include_internal AND (NOT coalesce(helpdesk_auth.is_operator(t.workspace_id,t.account_id),false) OR NOT coalesce(helpdesk_auth.has_scope(t.workspace_id,'notes:read'),false) OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(t.workspace_id,t.account_id,t.id,'notes.read'),false))) THEN RAISE EXCEPTION 'Internal history denied' USING ERRCODE='42501'; END IF;
 WITH projected AS (SELECT c.event_id,c.actor_id,c.public_event->>'actorKind' AS actor_type,c.public_event->>'body' AS body,c.at,
 jsonb_build_object('action',c.command->>'action','body',c.public_event->>'body','version',c.to_version) AS interaction
 FROM helpdesk_audit.hdn_workflow_commits c JOIN helpdesk_core.ticket_events e
 ON (e.workspace_id,e.account_id,e.ticket_id,e.id,e.actor_id,e.type,e.created_at)=(c.workspace_id,c.account_id,c.ticket_id,c.event_id,c.actor_id,c.core_type,c.at)
 WHERE (c.workspace_id,c.account_id,c.ticket_id)=(t.workspace_id,t.account_id,t.id)
 AND e.customer_visible AND c.core_type='ticket.status_changed' AND c.to_version=c.from_version+1 AND c.from_status<>c.to_status
 AND c.command->>'action' IN ('request_customer','customer_reply','resolve')
 AND ((c.command->>'action'='request_customer' AND c.to_status='waiting_customer') OR (c.command->>'action'='customer_reply' AND c.from_status='waiting_customer' AND c.to_status='open') OR (c.command->>'action'='resolve' AND c.to_status='resolved'))
 AND c.public_event->>'ticketId'=t.id::text AND c.public_event->>'workspaceId'=t.workspace_id::text
 AND c.public_event->>'actorId'=c.actor_id::text AND c.public_event->>'profileVersionId'=c.profile_version_id
 AND c.public_event->'sequence'=to_jsonb(c.to_version) AND c.command->'expectedVersion'=to_jsonb(c.from_version)
 AND c.public_event->>'from'=c.from_status AND c.public_event->>'to'=c.to_status
 AND e.data->>'from'=c.from_status AND e.data->>'to'=c.to_status
 AND pg_input_is_valid(c.public_event->>'at','timestamptz') AND (c.public_event->>'at')::timestamptz=c.at
 AND c.public_event->>'actorKind' IN ('human_agent','customer') AND jsonb_typeof(c.public_event->'body')='string'
 AND c.public_event->'body'=c.command->'body' AND length(btrim(c.public_event->>'body'))>0
 AND length(c.public_event->>'body')<=12000), limited AS (
 SELECT e.*,c.interaction FROM helpdesk_core.ticket_events e LEFT JOIN projected c ON c.event_id=e.id
 WHERE (e.workspace_id,e.account_id,e.ticket_id)=(t.workspace_id,t.account_id,t.id) AND (include_internal OR e.customer_visible)
 AND (after_at IS NULL OR (e.created_at,e.id)<(after_at,after_id)) ORDER BY e.created_at DESC,e.id DESC LIMIT page_limit)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'workspaceId',t.workspace_id,'accountId',t.account_id,'ticketId',t.id,'actorId',actor_id,'type',type,'customerVisible',customer_visible,
 'data',(CASE WHEN helpdesk_auth.is_operator(t.workspace_id,t.account_id) THEN data WHEN type='ticket.status_changed' THEN jsonb_build_object('to',data->'to') WHEN type='ticket.priority_changed' THEN jsonb_build_object('from',data->'from','to',data->'to','version',data->'version') ELSE '{}'::jsonb END)||CASE WHEN interaction IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('public_interaction',interaction) END,'createdAt',helpdesk_auth.hdn_workflow_iso(created_at)) ORDER BY created_at DESC,id DESC),'[]'::jsonb) INTO answer FROM limited;
 RETURN answer;
END $$;
REVOKE ALL ON FUNCTION helpdesk_auth.hdn_ticket_directory(uuid),helpdesk_auth.hdn_public_messages(uuid,timestamptz,uuid,integer),helpdesk_auth.hdn_public_events(uuid,boolean,timestamptz,uuid,integer) FROM PUBLIC,helpdesk_resource_publisher,helpdesk_notification_worker;
DO $m06_clients$
DECLARE r text;signature text;
BEGIN
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP
  IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN
   FOREACH signature IN ARRAY ARRAY['hdn_ticket_directory(uuid)','hdn_public_messages(uuid,timestamptz,uuid,integer)','hdn_public_events(uuid,boolean,timestamptz,uuid,integer)'] LOOP EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.%s FROM %I',signature,r);END LOOP;
  END IF;
 END LOOP;
END $m06_clients$;
GRANT EXECUTE ON FUNCTION helpdesk_auth.hdn_ticket_directory(uuid),helpdesk_auth.hdn_public_messages(uuid,timestamptz,uuid,integer),helpdesk_auth.hdn_public_events(uuid,boolean,timestamptz,uuid,integer) TO helpdesk_app;
DO $m05_final$
DECLARE role_name text;role_oid oid;role_row record;ns record;obj record;allowed boolean;
BEGIN
 IF NOT ((SELECT owner.oid FROM pg_catalog.pg_roles owner
 WHERE owner.rolcreaterole AND (owner.rolsuper OR owner.rolbypassrls)
 AND owner.rolname NOT IN ('helpdesk_app','helpdesk_resource_publisher','helpdesk_notification_worker','helpdesk_maintenance','anon','authenticated','service_role')
 AND owner.oid=(SELECT n.nspowner FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')
 GROUP BY n.nspowner HAVING count(*)=4)) IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
 WHERE d.defaclrole=(SELECT owner.oid FROM pg_catalog.pg_roles owner
 WHERE owner.rolcreaterole AND (owner.rolsuper OR owner.rolbypassrls)
 AND owner.rolname NOT IN ('helpdesk_app','helpdesk_resource_publisher','helpdesk_notification_worker','helpdesk_maintenance','anon','authenticated','service_role')
 AND owner.oid=(SELECT n.nspowner FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')
 GROUP BY n.nspowner HAVING count(*)=4))
 AND (d.defaclnamespace=0 OR d.defaclnamespace IN (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')))
 AND a.grantee<>d.defaclrole AND NOT (a.grantee=0 AND d.defaclobjtype='f' AND a.privilege_type='EXECUTE'))) THEN RAISE EXCEPTION 'Unqualified schema owner or defaults' USING ERRCODE='HDU06';END IF;
 FOREACH role_name IN ARRAY ARRAY['helpdesk_resource_publisher','helpdesk_notification_worker'] LOOP
  SELECT * INTO role_row FROM pg_roles WHERE rolname=role_name;IF NOT FOUND THEN RAISE EXCEPTION 'Service boundary unavailable' USING ERRCODE='HDU06';END IF;role_oid:=role_row.oid;
  IF role_row.rolsuper OR role_row.rolbypassrls OR role_row.rolcreaterole OR role_row.rolcreatedb OR role_row.rolreplication OR role_row.rolinherit OR EXISTS(
 SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=role_oid
 OR (m.roleid=role_oid AND NOT ((m.member=(SELECT owner.oid FROM pg_catalog.pg_roles owner
 WHERE owner.rolcreaterole AND (owner.rolsuper OR owner.rolbypassrls)
 AND owner.rolname NOT IN ('helpdesk_app','helpdesk_resource_publisher','helpdesk_notification_worker','helpdesk_maintenance','anon','authenticated','service_role')
 AND owner.oid=(SELECT n.nspowner FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')
 GROUP BY n.nspowner HAVING count(*)=4))
 AND m.grantor=10 AND EXISTS(SELECT 1 FROM pg_catalog.pg_roles bootstrap WHERE bootstrap.oid=10 AND bootstrap.rolsuper)
 AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option) IS TRUE))) THEN RAISE EXCEPTION 'Service boundary unsafe' USING ERRCODE='HDU06';END IF;
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
END $m05_final$;
DO $m06_final$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE n.nspname='helpdesk_auth' AND p.proname IN ('hdn_ticket_directory','hdn_public_messages','hdn_public_events') AND (a.grantee NOT IN (p.proowner,'helpdesk_app'::regrole) OR a.is_grantable AND a.grantee<>p.proowner)) THEN RAISE EXCEPTION 'Unsafe projection ACL' USING ERRCODE='HDU06'; END IF;
END $m06_final$;
CREATE OR REPLACE FUNCTION helpdesk_auth.schema_version() RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT '0.21.0'::text$$;
COMMIT;
