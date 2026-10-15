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

-- Deferred projection binds the source to the real request transaction. The
-- existing receipt/write-effect guards remain responsible for complete commits.
CREATE FUNCTION helpdesk_auth.hdn_notification_project_internal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c helpdesk_audit.hdn_workflow_commits%rowtype;r helpdesk_audit.hdni_receipts%rowtype;
 f helpdesk_audit.write_effects%rowtype;t helpdesk_core.tickets%rowtype;o helpdesk_integration.outbox_events%rowtype;
 kind text;version integer;person uuid;correlation text;source_id uuid:=gen_random_uuid();BEGIN
 IF session_user<>'helpdesk_app' OR current_setting('role') NOT IN ('none','helpdesk_app') THEN RETURN NULL;END IF;
 SELECT * INTO f FROM helpdesk_audit.write_effects WHERE (workspace_id,account_id,ticket_id,event_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id);
 IF NOT FOUND OR f.transaction_id<>pg_current_xact_id() OR NOT f.applied OR f.actor_id<>NEW.actor_id OR f.kind<>NEW.type THEN RETURN NULL;END IF;
 IF NEW.type='ticket.created' THEN
  SELECT * INTO r FROM helpdesk_audit.hdni_receipts WHERE (workspace_id,account_id,ticket_id,event_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id);
  IF NOT FOUND OR r.transaction_id<>pg_current_xact_id() OR r.actor_id<>NEW.actor_id OR f.ticket_version<>1 OR NOT NEW.customer_visible THEN RETURN NULL;END IF;
  SELECT * INTO STRICT o FROM helpdesk_integration.outbox_events WHERE (workspace_id,account_id,ticket_id,id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id);
  kind:='internal.queue_created';version:=1;person:=NULL;correlation:=o.request_id;
 ELSE
  SELECT * INTO c FROM helpdesk_audit.hdn_workflow_commits WHERE (workspace_id,account_id,ticket_id,event_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id);
  IF NOT FOUND OR c.transaction_id<>pg_current_xact_id() OR c.actor_id<>NEW.actor_id OR c.core_type<>NEW.type OR c.at<>NEW.created_at OR c.to_version<>f.ticket_version THEN RETURN NULL;END IF;
  IF c.command->>'action'='transfer' AND NEW.type='ticket.assignment_changed' AND NOT NEW.customer_visible THEN
   kind:='internal.assignment_changed';person:=(c.command->>'targetPrincipalId')::uuid;
  ELSIF c.command->>'action'='customer_reply' AND c.public_event->>'actorKind'='customer' AND NEW.customer_visible THEN
   kind:='support.customer_reply';source_id:=NEW.id;
   SELECT * INTO STRICT t FROM helpdesk_core.tickets WHERE (workspace_id,account_id,id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id) FOR SHARE;
   IF t.version<>c.to_version THEN RAISE EXCEPTION 'Customer return assignment snapshot changed' USING ERRCODE='HDN05';END IF;
   person:=t.assigned_to;
  ELSE RETURN NULL;END IF;
  version:=c.to_version;correlation:=c.audit->>'requestId';
 END IF;
 INSERT INTO helpdesk_integration.hdn_notification_private_sources(id,workspace_id,account_id,ticket_id,parent_event_id,kind,source_version,assigned_principal_id,request_id,created_at)
 VALUES(source_id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id,kind,version,person,correlation,NEW.created_at);
 RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER hdn_notification_project_internal AFTER INSERT ON helpdesk_core.ticket_events
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_notification_project_internal();

ALTER FUNCTION helpdesk_auth.hdn_notification_facts(uuid) RENAME TO hdn_notification_facts_wave2_public;
CREATE FUNCTION helpdesk_auth.hdn_notification_facts(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE p helpdesk_integration.hdn_notification_private_sources%rowtype;root helpdesk_audit.hdni_receipts%rowtype;
 e helpdesk_core.ticket_events%rowtype;f helpdesk_audit.write_effects%rowtype;c helpdesk_audit.hdn_workflow_commits%rowtype;
 facts jsonb;source jsonb;prior jsonb;BEGIN
 SELECT * INTO p FROM helpdesk_integration.hdn_notification_private_sources WHERE id=target FOR SHARE;
 IF NOT FOUND THEN RETURN helpdesk_auth.hdn_notification_facts_wave2_public(target);END IF;
 SELECT * INTO STRICT root FROM helpdesk_audit.hdni_receipts WHERE (workspace_id,account_id,ticket_id)=(p.workspace_id,p.account_id,p.ticket_id) FOR SHARE;
 facts:=helpdesk_auth.hdn_notification_facts_v024(root.event_id);
 IF facts->'source'->>'type'<>'support.created' THEN RAISE EXCEPTION 'Private root source mismatch' USING ERRCODE='HDN05';END IF;
 SELECT * INTO STRICT e FROM helpdesk_core.ticket_events WHERE (workspace_id,account_id,ticket_id,id)=(p.workspace_id,p.account_id,p.ticket_id,p.parent_event_id) FOR SHARE;
 SELECT * INTO STRICT f FROM helpdesk_audit.write_effects WHERE (workspace_id,account_id,ticket_id,event_id)=(p.workspace_id,p.account_id,p.ticket_id,p.parent_event_id) FOR SHARE;
 IF NOT f.applied OR f.actor_id<>e.actor_id OR f.kind<>e.type OR f.ticket_version<>p.source_version OR e.created_at<>p.created_at
 OR (e.data-CASE WHEN e.type IN ('ticket.status_changed','ticket.assignment_changed') THEN 'reason' ELSE '__absent__' END)<>f.expected_data THEN RAISE EXCEPTION 'Private parent mismatch' USING ERRCODE='HDN05';END IF;
 IF p.kind='internal.queue_created' THEN
  IF p.parent_event_id<>root.event_id OR e.type<>'ticket.created' OR NOT e.customer_visible OR f.transaction_id<>root.transaction_id OR p.request_id<>facts->'source'->>'requestId' THEN RAISE EXCEPTION 'Private opening mismatch' USING ERRCODE='HDN05';END IF;
 ELSE
  SELECT * INTO STRICT c FROM helpdesk_audit.hdn_workflow_commits WHERE (workspace_id,account_id,ticket_id,event_id)=(p.workspace_id,p.account_id,p.ticket_id,p.parent_event_id) FOR SHARE;
  IF c.transaction_id<>f.transaction_id OR c.actor_id<>e.actor_id OR c.core_type<>e.type OR c.to_version<>p.source_version OR c.at<>p.created_at OR c.audit->>'requestId'<>p.request_id
  OR p.kind='internal.assignment_changed' AND (c.command->>'action'<>'transfer' OR e.type<>'ticket.assignment_changed' OR e.customer_visible OR c.command->>'targetPrincipalId' IS DISTINCT FROM p.assigned_principal_id::text)
  OR p.kind='support.customer_reply' AND (c.command->>'action'<>'customer_reply' OR c.public_event->>'actorKind'<>'customer' OR NOT e.customer_visible) THEN RAISE EXCEPTION 'Private workflow mismatch' USING ERRCODE='HDN05';END IF;
  IF p.kind='support.customer_reply' THEN PERFORM helpdesk_auth.hdn_notification_facts_wave2_public(p.parent_event_id);END IF;
 END IF;
 source:=jsonb_build_object('id',p.id,'workspaceId',p.workspace_id,'accountId',p.account_id,'ticketId',p.ticket_id,'type',p.kind,'version',p.source_version,'requestId',p.request_id,'createdAt',helpdesk_auth.hdn_workflow_iso(p.created_at));
 SELECT document INTO prior FROM helpdesk_integration.hdn_notification_plans WHERE event_id=target;
 IF prior IS NOT NULL AND prior->>'sourceHash'<>helpdesk_auth.hdni_digest(source) THEN RAISE EXCEPTION 'Private historical source mismatch' USING ERRCODE='HDN05';END IF;
 RETURN jsonb_set(facts,'{source}',source,false)||jsonb_build_object('wave2Eligible',true,'sourceAssigneeId',p.assigned_principal_id,'parentEventId',p.parent_event_id);
EXCEPTION WHEN no_data_found OR data_exception THEN RAISE EXCEPTION 'Unqualified private source' USING ERRCODE='HDN05';END$$;
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
 REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_project_internal(),helpdesk_auth.hdn_notification_facts(uuid) FROM PUBLIC;
 FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_valid_members(uuid[],integer) FROM %I',role_name);END IF;
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN
   EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_project_internal(),helpdesk_auth.hdn_notification_facts(uuid) FROM %I',role_name);
  END IF;
 END LOOP;
END $private$;
