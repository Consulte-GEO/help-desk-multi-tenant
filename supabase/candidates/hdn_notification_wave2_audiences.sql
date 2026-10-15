-- Additive routing data, initially empty. No implicit recipient or role audience.
ALTER TABLE helpdesk_integration.hdn_notification_routes ADD COLUMN recipient_ids uuid[];
ALTER TABLE helpdesk_integration.hdn_notification_routes ADD CONSTRAINT hdn_notification_routes_cohort_check CHECK(
 (recipient_ids IS NULL OR helpdesk_auth.hdn_notification_valid_members(recipient_ids,10))
 AND (audience='none' OR kind IN ('support.created','support.devolutiva','support.resolved') OR recipient_ids IS NOT NULL AND effective_after IS NOT NULL));
ALTER TABLE helpdesk_integration.hdn_notification_routes DROP CONSTRAINT hdn_notification_routes_audience_check;
ALTER TABLE helpdesk_integration.hdn_notification_routes ADD CONSTRAINT hdn_notification_routes_audience_check CHECK(audience IN ('none','requester','queue','assignee','customer_return','approver'));
ALTER TABLE helpdesk_integration.hdn_notification_routes DROP CONSTRAINT hdn_notification_routes_check;
ALTER TABLE helpdesk_integration.hdn_notification_routes ADD CONSTRAINT hdn_notification_routes_check CHECK(
 (audience='none' AND template_id IS NULL AND template_version IS NULL)
 OR template_id IS NOT NULL AND template_version IS NOT NULL AND (
  audience='requester' AND kind IN ('support.created','support.devolutiva','support.resolved','support.transition','support.reply','support.handoff','support.closed','support.reopened','support.cancelled','support.form_revised','support.approval_granted','support.approval_rejected')
  OR audience='queue' AND kind='internal.queue_created' OR audience='assignee' AND kind='internal.assignment_changed'
  OR audience='customer_return' AND kind='support.customer_reply' OR audience='approver' AND kind='support.approval_requested'));

-- Current authority for one explicit internal candidate, never contact lookup.
-- This wave qualifies the persisted local Consulte GEO source. No external API
-- decision or generic account title is substituted when that source is absent.
CREATE FUNCTION helpdesk_auth.hdn_notification_internal_person(target uuid,person uuid) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE facts jsonb;src jsonb;w uuid;a uuid;ticket uuid;t helpdesk_core.tickets%rowtype;
 r helpdesk_auth.cg_local_registries%rowtype;l helpdesk_auth.cg_local_accounts%rowtype;
 p helpdesk_auth.cg_local_permissions%rowtype;s helpdesk_core.cg_ticket_resource_sets%rowtype;
 b helpdesk_auth.cg_resource_bindings%rowtype;connection helpdesk_auth.cg_resource_connections%rowtype;
 roster helpdesk_integration.hdn_notification_queue_rosters%rowtype;ref record;is_queue boolean;BEGIN
 facts:=helpdesk_auth.hdn_notification_facts(target);src:=facts->'source';
 IF src->>'type' NOT IN ('internal.queue_created','internal.assignment_changed','support.customer_reply') THEN RETURN false;END IF;
 w:=(src->>'workspaceId')::uuid;a:=(src->>'accountId')::uuid;ticket:=(src->>'ticketId')::uuid;
 SELECT * INTO STRICT t FROM helpdesk_core.tickets WHERE (workspace_id,account_id,id)=(w,a,ticket) FOR SHARE;
 IF t.status IN ('resolved','closed','cancelled') OR EXISTS(SELECT 1 FROM helpdesk_core.ticket_events e WHERE (e.workspace_id,e.account_id,e.ticket_id)=(w,a,ticket) AND e.type='ticket.assignment_changed' AND (e.data->>'version')::integer>(src->>'version')::integer) THEN RETURN false;END IF;
 is_queue:=src->>'type'='internal.queue_created' OR src->>'type'='support.customer_reply' AND facts->'sourceAssigneeId'='null'::jsonb;
 IF is_queue THEN
  IF t.assigned_to IS NOT NULL THEN RETURN false;END IF;
  SELECT * INTO roster FROM helpdesk_integration.hdn_notification_queue_rosters WHERE workspace_id=w AND account_id=a ORDER BY revision DESC LIMIT 1 FOR SHARE;
  IF NOT FOUND OR roster.expires_at<=clock_timestamp() OR NOT person=ANY(roster.member_ids) THEN RETURN false;END IF;
 ELSE
  IF person::text IS DISTINCT FROM facts->>'sourceAssigneeId' OR t.assigned_to IS DISTINCT FROM person THEN RETURN false;END IF;
 END IF;
 IF src->>'type'='support.customer_reply' AND person::text=facts->>'requesterId' THEN RETURN false;END IF;
 SELECT * INTO r FROM helpdesk_auth.cg_local_registries WHERE workspace_id=w FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Qualified local internal source required' USING ERRCODE='HDN06';END IF;
 SELECT * INTO l FROM helpdesk_auth.cg_local_accounts WHERE workspace_id=w AND account_id=a FOR SHARE;
 IF NOT FOUND OR NOT l.active THEN RETURN false;END IF;
 IF l.registry_revision<>r.revision OR l.product_instance_id<>t.product_instance_id OR NOT EXISTS(SELECT 1 FROM helpdesk_audit.cg_local_receipts receipt WHERE receipt.workspace_id=w AND receipt.registry_revision=r.revision AND receipt.decision_hash=r.decision_hash AND receipt.receipt->>'decisionHash'=r.decision_hash AND receipt.receipt->'revision'=to_jsonb(r.revision) AND receipt.receipt->'sourceManifest'=helpdesk_auth.cg_local_manifest()) THEN RAISE EXCEPTION 'Current local internal receipt required' USING ERRCODE='HDN06';END IF;
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('helpdesk-human-scopes:'||w::text||':'||person::text,0));
 PERFORM 1 FROM helpdesk_auth.principals WHERE id=person AND kind='human' AND active FOR SHARE;IF NOT FOUND THEN RETURN false;END IF;
 IF NOT ARRAY['tickets:read','tickets:write']<@helpdesk_auth.human_scopes(w,person) THEN RETURN false;END IF;
 PERFORM 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=person AND active AND role='admin' FOR SHARE;
 IF NOT FOUND THEN PERFORM 1 FROM helpdesk_auth.account_grants WHERE workspace_id=w AND account_id=a AND principal_id=person AND active AND role='agent' FOR SHARE;IF NOT FOUND THEN RETURN false;END IF;END IF;
 SELECT * INTO p FROM helpdesk_auth.cg_local_permissions WHERE workspace_id=w AND account_id=a AND principal_id=person AND operation='tickets.write' FOR SHARE;
 IF NOT FOUND OR NOT p.active THEN RETURN false;END IF;
 IF p.registry_revision<>r.revision THEN RAISE EXCEPTION 'Current internal write decision required' USING ERRCODE='HDN06';END IF;
 SELECT * INTO STRICT s FROM helpdesk_core.cg_ticket_resource_sets WHERE (workspace_id,account_id,ticket_id)=(w,a,ticket) AND sealed FOR SHARE;
 SELECT * INTO b FROM helpdesk_auth.cg_resource_bindings WHERE (workspace_id,account_id,id)=(w,a,s.binding_id) FOR SHARE;
 IF NOT FOUND OR NOT b.active THEN RETURN false;END IF;
 SELECT * INTO connection FROM helpdesk_auth.cg_resource_connections WHERE (workspace_id,id)=(w,b.connection_id) FOR SHARE;
 IF NOT FOUND OR NOT connection.active THEN RETURN false;END IF;
 IF l.binding_id<>s.binding_id OR l.connection_id<>connection.id OR b.tenant_id<>l.tenant_id OR connection.product_instance_id<>t.product_instance_id THEN RAISE EXCEPTION 'Internal namespace mismatch' USING ERRCODE='HDN06';END IF;
 IF (SELECT count(*) FROM helpdesk_core.cg_ticket_resource_refs x WHERE (x.workspace_id,x.account_id,x.ticket_id)=(w,a,ticket))<>s.expected_count THEN RAISE EXCEPTION 'Incomplete sealed internal resources' USING ERRCODE='HDN06';END IF;
 FOR ref IN SELECT x.resource_type,x.resource_id FROM helpdesk_core.cg_ticket_resource_refs x WHERE (x.workspace_id,x.account_id,x.ticket_id)=(w,a,ticket) ORDER BY x.resource_type,x.resource_id FOR SHARE LOOP
  IF ref.resource_type<>'work' OR NOT ref.resource_id=ANY(p.work_ids) THEN RETURN false;END IF;
  PERFORM 1 FROM helpdesk_auth.cg_local_works x WHERE x.workspace_id=w AND x.account_id=a AND x.id=ref.resource_id AND x.active AND x.registry_revision=r.revision FOR SHARE;
  IF NOT FOUND THEN RETURN false;END IF;
 END LOOP;RETURN true;
EXCEPTION WHEN no_data_found OR data_exception THEN RAISE EXCEPTION 'Internal authority unavailable' USING ERRCODE='HDN06';END$$;

CREATE OR REPLACE FUNCTION helpdesk_auth.hdn_notification_sources(bound integer) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE row record;facts jsonb;src jsonb;ids jsonb:='[]';p jsonb;remaining integer;BEGIN
 PERFORM helpdesk_auth.hdn_notification_worker();IF bound NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Bound required' USING ERRCODE='HDN02';END IF;
 FOR row IN SELECT x.id FROM helpdesk_integration.hdn_notification_private_sources x WHERE NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_plans planned WHERE planned.event_id=x.id) ORDER BY x.created_at,x.id LIMIT bound FOR UPDATE OF x SKIP LOCKED LOOP
  PERFORM helpdesk_auth.hdn_notification_facts(row.id);ids:=ids||jsonb_build_array(row.id);
 END LOOP;
 remaining:=bound-jsonb_array_length(ids);
 FOR row IN SELECT o.id FROM helpdesk_integration.outbox_events o WHERE NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_private_sources x WHERE x.id=o.id) AND NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_plans planned WHERE planned.event_id=o.id) AND EXISTS(SELECT 1 FROM helpdesk_core.hdni_snapshots s WHERE (s.workspace_id,s.account_id,s.ticket_id)=(o.workspace_id,o.account_id,o.ticket_id)) ORDER BY o.created_at,o.id LIMIT remaining FOR UPDATE OF o SKIP LOCKED LOOP
  facts:=helpdesk_auth.hdn_notification_facts(row.id);src:=facts->'source';
  IF src->>'type' NOT IN ('support.created','support.devolutiva','support.customer_reply','support.form_revised','support.resolved','support.approval_requested','support.approval_granted','support.approval_rejected','support.transition','support.reply','support.handoff','support.closed','support.reopened','support.cancelled','internal.queue_created','internal.assignment_changed') THEN
   p:=jsonb_build_object('schema',1,'eventId',row.id,'sourceHash',helpdesk_auth.hdni_digest(src),'sourceVersion',src->'version','routingRevision','unhandled-v1','plannedAt',helpdesk_auth.hdn_workflow_iso(clock_timestamp()),'state','no_recipients','intentIds','[]'::jsonb);
   INSERT INTO helpdesk_integration.hdn_notification_plans VALUES(row.id,(src->>'workspaceId')::uuid,(src->>'accountId')::uuid,(src->>'ticketId')::uuid,p);
  ELSE ids:=ids||jsonb_build_array(row.id);END IF;
 END LOOP;RETURN ids;
END$$;

CREATE OR REPLACE FUNCTION helpdesk_auth.hdn_notification_routing(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE facts jsonb;src jsonb;route helpdesk_integration.hdn_notification_routes%rowtype;t helpdesk_integration.hdn_notification_templates%rowtype;
 roster helpdesk_integration.hdn_notification_queue_rosters%rowtype;people uuid[]:='{}';person uuid;recipients jsonb:='[]';BEGIN
 PERFORM helpdesk_auth.hdn_notification_worker();facts:=helpdesk_auth.hdn_notification_facts(target);src:=facts->'source';
 SELECT * INTO STRICT route FROM helpdesk_integration.hdn_notification_routes WHERE workspace_id=(src->>'workspaceId')::uuid AND kind=src->>'type' ORDER BY revision DESC LIMIT 1 FOR SHARE;
 IF route.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Routing expired' USING ERRCODE='HDN05';END IF;
 IF route.audience<>'none' AND facts->'wave2Eligible'='true'::jsonb AND (route.effective_after IS NULL OR helpdesk_auth.hdn_notification_stamp(src->>'createdAt')>=route.effective_after) THEN
  SELECT * INTO STRICT t FROM helpdesk_integration.hdn_notification_templates WHERE id=route.template_id AND version=route.template_version FOR SHARE;
  IF t.kind<>route.kind THEN RAISE EXCEPTION 'Template kind mismatch' USING ERRCODE='HDN05';END IF;
  IF route.audience='requester' THEN people:=ARRAY[(facts->>'requesterId')::uuid];
  ELSIF route.audience IN ('assignee','customer_return') AND facts->>'sourceAssigneeId' IS NOT NULL THEN people:=ARRAY[(facts->>'sourceAssigneeId')::uuid];
  ELSIF route.audience IN ('queue','customer_return') THEN
   SELECT * INTO STRICT roster FROM helpdesk_integration.hdn_notification_queue_rosters WHERE workspace_id=(src->>'workspaceId')::uuid AND account_id=(src->>'accountId')::uuid ORDER BY revision DESC LIMIT 1 FOR SHARE;
   IF roster.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Published queue roster expired' USING ERRCODE='HDN05';END IF;people:=roster.member_ids;
  ELSE RAISE EXCEPTION 'Audience not yet qualified' USING ERRCODE='HDN05';END IF;
  FOREACH person IN ARRAY people LOOP
   IF (route.recipient_ids IS NULL OR person=ANY(route.recipient_ids)) AND (route.audience='requester' OR helpdesk_auth.hdn_notification_internal_person(target,person)) THEN
    recipients:=recipients||jsonb_build_array(jsonb_build_object('principalId',person,'channelId','resend','templateId',t.id,'templateVersion',t.version,'templateHash',t.sha256));
   END IF;
  END LOOP;
 END IF;
 RETURN jsonb_build_object('eventId',target,'workspaceId',src->'workspaceId','accountId',src->'accountId','ticketId',src->'ticketId','sourceVersion',src->'version','kind',src->'type','protocol',facts->'protocol','resourceHash',facts->'resourceHash','revision','route-'||route.revision::text,'status','published','expiresAt',helpdesk_auth.hdn_workflow_iso(route.expires_at),'recipients',recipients);
EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'Published routing required' USING ERRCODE='HDN05';END$$;

REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_internal_person(uuid,uuid) FROM PUBLIC;
DO $private$ DECLARE role_name text;BEGIN
 FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_internal_person(uuid,uuid) FROM %I',role_name);END IF;
 END LOOP;
END $private$;
