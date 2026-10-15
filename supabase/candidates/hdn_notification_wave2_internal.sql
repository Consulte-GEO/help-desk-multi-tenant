-- Additive private projection. No historical event is copied or backfilled.
CREATE FUNCTION helpdesk_auth.hdn_notification_valid_members(m uuid[],maximum integer) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(maximum BETWEEN 1 AND 10 AND cardinality(m) BETWEEN 1 AND maximum
  AND array_ndims(m)=1 AND array_lower(m,1)=1 AND array_position(m,NULL) IS NULL
  AND (SELECT count(DISTINCT x) FROM unnest(m) x)=cardinality(m),false)
$$;
CREATE TABLE helpdesk_integration.hdn_notification_queue_rosters(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,revision bigint NOT NULL CHECK(revision>0),
 member_ids uuid[] NOT NULL,max_recipients integer NOT NULL,expires_at timestamptz NOT NULL,
 request_id uuid NOT NULL,reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 1000),
 recorded_by name NOT NULL DEFAULT session_user,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,account_id,revision),UNIQUE(workspace_id,request_id),
 FOREIGN KEY(workspace_id,account_id) REFERENCES helpdesk_core.accounts(workspace_id,id),
 CHECK(helpdesk_auth.hdn_notification_valid_members(member_ids,max_recipients)),
 CHECK(isfinite(expires_at) AND isfinite(recorded_at) AND expires_at>recorded_at));
CREATE TABLE helpdesk_integration.hdn_notification_private_sources(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,
 parent_event_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN ('internal.queue_created','internal.assignment_changed','support.customer_reply')),
 source_version integer NOT NULL CHECK(source_version>0),assigned_principal_id uuid REFERENCES helpdesk_auth.principals(id),
 request_id text NOT NULL,created_at timestamptz NOT NULL CHECK(isfinite(created_at)),
 UNIQUE(workspace_id,parent_event_id,kind),
 FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.tickets(workspace_id,account_id,id),
 FOREIGN KEY(workspace_id,parent_event_id) REFERENCES helpdesk_core.ticket_events(workspace_id,id),
 CHECK((kind='internal.queue_created' AND source_version=1 AND assigned_principal_id IS NULL)
 OR (kind='internal.assignment_changed' AND source_version>1 AND assigned_principal_id IS NOT NULL)
 OR (kind='support.customer_reply' AND source_version>1)));
CREATE INDEX hdn_notification_private_sources_pending ON helpdesk_integration.hdn_notification_private_sources(created_at,id);
CREATE TRIGGER hdn_notification_roster_immutable BEFORE UPDATE OR DELETE ON helpdesk_integration.hdn_notification_queue_rosters FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_notification_immutable();
CREATE TRIGGER hdn_notification_private_source_immutable BEFORE UPDATE OR DELETE ON helpdesk_integration.hdn_notification_private_sources FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_notification_immutable();
DO $private$
DECLARE obj text;role_name text;BEGIN
 FOREACH obj IN ARRAY ARRAY['helpdesk_integration.hdn_notification_queue_rosters','helpdesk_integration.hdn_notification_private_sources'] LOOP
  EXECUTE 'ALTER TABLE '||obj||' ENABLE ROW LEVEL SECURITY';EXECUTE 'ALTER TABLE '||obj||' FORCE ROW LEVEL SECURITY';
  EXECUTE 'REVOKE ALL ON TABLE '||obj||' FROM PUBLIC';
  FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
   IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I',obj,role_name);END IF;
  END LOOP;
 END LOOP;
 REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_valid_members(uuid[],integer) FROM PUBLIC;
 FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_valid_members(uuid[],integer) FROM %I',role_name);END IF;
 END LOOP;
END $private$;
