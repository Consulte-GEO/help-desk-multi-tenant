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

-- Preserve the qualified v024 contact/coverage checks; extend only current audience and required operation.
CREATE OR REPLACE FUNCTION helpdesk_auth.hdn_notification_recipient(i jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=(i->>'workspaceId')::uuid;a uuid:=(i->>'accountId')::uuid;person uuid:=(i->>'recipientId')::uuid;target uuid:=(i->>'ticketId')::uuid;p helpdesk_auth.principals%rowtype;t helpdesk_core.tickets%rowtype;s helpdesk_core.cg_ticket_resource_sets%rowtype;b helpdesk_auth.cg_resource_bindings%rowtype;c helpdesk_auth.cg_resource_connections%rowtype;g helpdesk_auth.cg_resource_grant_sets%rowtype;o helpdesk_auth.cg_resource_observations%rowtype;facts jsonb;address text;verified_at timestamptz;until timestamptz;revision text;allowed boolean:=false;local_registry jsonb;local_account jsonb;local_permission jsonb;local_receipt jsonb;local_work jsonb;ref record;recipient_operation text:='tickets.read';internal_recipient boolean;current_route helpdesk_integration.hdn_notification_routes%rowtype;BEGIN
 SELECT * INTO STRICT t FROM helpdesk_core.tickets WHERE (workspace_id,account_id,id)=(w,a,target) FOR SHARE;
 facts:=helpdesk_auth.hdn_notification_facts((i->>'eventId')::uuid);internal_recipient:=i->>'kind' IN ('internal.queue_created','internal.assignment_changed','support.customer_reply');IF i->'resourceHash'<>facts->'resourceHash' OR i->'protocol'<>facts->'protocol' OR i->'kind'<>facts->'source'->'type' OR i->'sourceVersion'<>facts->'source'->'version' OR (NOT internal_recipient AND i->'recipientId'<>facts->'requesterId') OR (internal_recipient AND NOT helpdesk_auth.hdn_notification_internal_person((i->>'eventId')::uuid,person)) THEN RAISE EXCEPTION 'Recipient source mismatch' USING ERRCODE='HDN04';END IF;
 IF internal_recipient THEN recipient_operation:='tickets.write';END IF;
 IF i->>'kind' NOT IN ('support.created','support.devolutiva','support.resolved') THEN
  SELECT * INTO STRICT current_route FROM helpdesk_integration.hdn_notification_routes WHERE workspace_id=w AND kind=i->>'kind' ORDER BY revision DESC LIMIT 1 FOR SHARE;
  IF current_route.audience='none' OR current_route.expires_at<=clock_timestamp() OR current_route.recipient_ids IS NULL OR NOT person=ANY(current_route.recipient_ids) OR current_route.effective_after IS NULL OR helpdesk_auth.hdn_notification_stamp(facts->'source'->>'createdAt')<current_route.effective_after THEN RAISE EXCEPTION 'Wave2 recipient route revoked' USING ERRCODE='HDN04';END IF;
 END IF;
 -- Candidate installation precedes the local registry. These fixed queries
 -- become available after promotion; no identifier or actor comes from a caller.
 -- Lock registry before scopes/ACL, matching the local operator's lock order.
 IF to_regclass('helpdesk_auth.cg_local_registries') IS NOT NULL THEN
  EXECUTE 'select to_jsonb(r) from helpdesk_auth.cg_local_registries r where workspace_id=$1 for share' INTO local_registry USING w;
  EXECUTE 'select to_jsonb(a) from helpdesk_auth.cg_local_accounts a where workspace_id=$1 and account_id=$2 for share' INTO local_account USING w,a;
 END IF;
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('helpdesk-human-scopes:'||w::text||':'||person::text,0));
 SELECT * INTO p FROM helpdesk_auth.principals WHERE id=person FOR SHARE;IF NOT FOUND OR NOT p.active OR p.kind<>'human' THEN RAISE EXCEPTION 'Recipient human revoked' USING ERRCODE='HDN04';END IF;
 IF NOT 'tickets:read'=ANY(helpdesk_auth.human_scopes(w,person)) OR internal_recipient AND NOT 'tickets:write'=ANY(helpdesk_auth.human_scopes(w,person)) THEN RAISE EXCEPTION 'Recipient scopes revoked' USING ERRCODE='HDN04';END IF;
 PERFORM 1 FROM helpdesk_auth.account_grants WHERE workspace_id=w AND account_id=a AND principal_id=person AND active AND (role IN ('account_manager','agent') OR role='requester' AND t.created_by=person) FOR SHARE;allowed:=FOUND;
 IF NOT allowed THEN PERFORM 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=person AND active AND role='admin' FOR SHARE;allowed:=FOUND;END IF;IF NOT allowed THEN RAISE EXCEPTION 'Recipient ticket access revoked' USING ERRCODE='HDN04';END IF;
 SELECT * INTO STRICT s FROM helpdesk_core.cg_ticket_resource_sets WHERE (workspace_id,account_id,ticket_id)=(w,a,target) AND sealed FOR SHARE;
 SELECT * INTO b FROM helpdesk_auth.cg_resource_bindings WHERE (workspace_id,account_id,id)=(w,a,s.binding_id) FOR SHARE;IF NOT FOUND OR NOT b.active THEN RAISE EXCEPTION 'Recipient binding revoked' USING ERRCODE='HDN04';END IF;
 SELECT * INTO c FROM helpdesk_auth.cg_resource_connections WHERE (workspace_id,id)=(w,b.connection_id) FOR SHARE;IF NOT FOUND OR NOT c.active OR c.product_instance_id<>t.product_instance_id THEN RAISE EXCEPTION 'Recipient connection revoked' USING ERRCODE='HDN04';END IF;
 IF (SELECT count(*) FROM helpdesk_core.cg_ticket_resource_refs x WHERE (x.workspace_id,x.account_id,x.ticket_id)=(w,a,target))<>s.expected_count THEN RAISE EXCEPTION 'Recipient sealed resources unavailable' USING ERRCODE='HDN06';END IF;
 IF local_account IS NOT NULL THEN
  IF local_account->'active'='false'::jsonb THEN RAISE EXCEPTION 'Recipient local account revoked' USING ERRCODE='HDN04';END IF;
  IF local_registry IS NULL OR local_account->'active' IS DISTINCT FROM 'true'::jsonb OR local_account->'registry_revision' IS DISTINCT FROM local_registry->'revision'
  OR local_account->>'binding_id' IS DISTINCT FROM b.id::text OR local_account->>'connection_id' IS DISTINCT FROM c.id::text OR local_account->>'product_instance_id' IS DISTINCT FROM t.product_instance_id::text OR local_account->>'tenant_id' IS DISTINCT FROM b.tenant_id THEN RAISE EXCEPTION 'Recipient local account unavailable' USING ERRCODE='HDN06';END IF;
  EXECUTE 'select to_jsonb(r) from helpdesk_audit.cg_local_receipts r where workspace_id=$1 and registry_revision=$2 for share' INTO local_receipt USING w,(local_registry->>'revision')::integer;
  IF local_receipt IS NULL OR local_receipt->'decision_hash' IS DISTINCT FROM local_registry->'decision_hash' OR local_receipt->'receipt'->'decisionHash' IS DISTINCT FROM local_registry->'decision_hash' OR local_receipt->'receipt'->'revision' IS DISTINCT FROM local_registry->'revision'
  OR local_receipt->'receipt'->>'workspaceId' IS DISTINCT FROM w::text OR local_receipt->'receipt'->'requestId' IS DISTINCT FROM local_receipt->'request_id' OR local_receipt->'receipt'->'commandHash' IS DISTINCT FROM local_receipt->'command_hash'
  OR local_receipt->'receipt'->'sourceManifest' IS DISTINCT FROM '{"authority":"persisted-local-registry","complete":true,"externalApiQualified":false,"resourceType":"work","source":"helpdesk-local","version":1}'::jsonb
  OR NOT coalesce(isfinite((local_registry->>'as_of')::timestamptz),false) OR (local_registry->>'as_of')::timestamptz>clock_timestamp() OR (local_receipt->'receipt'->>'asOf')::timestamptz IS DISTINCT FROM (local_registry->>'as_of')::timestamptz
  THEN RAISE EXCEPTION 'Recipient local receipt unavailable' USING ERRCODE='HDN06';END IF;
  EXECUTE 'select to_jsonb(p) from helpdesk_auth.cg_local_permissions p where workspace_id=$1 and account_id=$2 and principal_id=$3 and operation=$4 for share' INTO local_permission USING w,a,person,recipient_operation;
  IF local_permission IS NOT NULL AND local_permission->'active'='false'::jsonb THEN RAISE EXCEPTION 'Recipient local permission revoked' USING ERRCODE='HDN04';END IF;
  IF local_permission IS NULL OR local_permission->'active' IS DISTINCT FROM 'true'::jsonb OR local_permission->'registry_revision' IS DISTINCT FROM local_registry->'revision' OR jsonb_typeof(local_permission->'work_ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Recipient local permission unavailable' USING ERRCODE='HDN06';END IF;
  FOR ref IN SELECT resource_type,resource_id FROM helpdesk_core.cg_ticket_resource_refs x WHERE (x.workspace_id,x.account_id,x.ticket_id)=(w,a,target) ORDER BY resource_type,resource_id FOR SHARE LOOP
   IF ref.resource_type<>'work' OR NOT local_permission->'work_ids' @> jsonb_build_array(ref.resource_id) THEN RAISE EXCEPTION 'Recipient local work permission revoked' USING ERRCODE='HDN04';END IF;
   EXECUTE 'select to_jsonb(x) from helpdesk_auth.cg_local_works x where workspace_id=$1 and account_id=$2 and id=$3 for share' INTO local_work USING w,a,ref.resource_id;
   IF local_work IS NOT NULL AND local_work->'active'='false'::jsonb THEN RAISE EXCEPTION 'Recipient local work revoked' USING ERRCODE='HDN04';END IF;
   IF local_work IS NULL OR local_work->'active' IS DISTINCT FROM 'true'::jsonb OR local_work->'registry_revision' IS DISTINCT FROM local_registry->'revision' THEN RAISE EXCEPTION 'Recipient local work unavailable' USING ERRCODE='HDN06';END IF;
  END LOOP;
  -- This is a new observation of the current immutable local decision, not an
  -- extension of an old CG envelope. Save(sending) repeats all checks and locks.
  until:=least(helpdesk_auth.hdn_notification_stamp(i->>'expiresAt'),clock_timestamp()+interval '30 seconds');revision:='local-'||(local_registry->>'revision');
 ELSE
  SELECT * INTO STRICT g FROM helpdesk_auth.cg_resource_grant_sets WHERE (workspace_id,account_id,binding_id,principal_id,operation)=(w,a,b.id,person,recipient_operation) FOR SHARE;IF NOT g.active THEN RAISE EXCEPTION 'Recipient resource grant revoked' USING ERRCODE='HDN04';END IF;
  IF g.source_revision LIKE 'local:%' THEN RAISE EXCEPTION 'Recipient local source unavailable' USING ERRCODE='HDN06';END IF;
  SELECT * INTO STRICT o FROM helpdesk_auth.cg_resource_observations WHERE (workspace_id,account_id,binding_id,principal_id,operation,grant_revision)=(w,a,b.id,person,recipient_operation,g.revision) FOR SHARE;
  IF g.as_of>clock_timestamp() OR g.expires_at<=clock_timestamp() OR o.access_revision<>g.source_revision OR o.as_of<>g.as_of OR o.expires_at<>g.expires_at OR o.expected_count<>g.expected_count
  THEN RAISE EXCEPTION 'Recipient observation unavailable' USING ERRCODE='HDN06';END IF;
  IF (SELECT count(*) FROM helpdesk_auth.cg_resource_grant_refs x WHERE (x.workspace_id,x.account_id,x.binding_id,x.principal_id,x.operation)=(w,a,b.id,person,recipient_operation))<>g.expected_count THEN RAISE EXCEPTION 'Recipient grant coverage unavailable' USING ERRCODE='HDN06';END IF;
  IF EXISTS(SELECT 1 FROM helpdesk_core.cg_ticket_resource_refs x WHERE (x.workspace_id,x.account_id,x.ticket_id)=(w,a,target) AND NOT EXISTS(SELECT 1 FROM helpdesk_auth.cg_resource_grant_refs y WHERE (y.workspace_id,y.account_id,y.binding_id,y.principal_id,y.operation,y.resource_type,y.resource_id)=(w,a,b.id,person,recipient_operation,x.resource_type,x.resource_id))) THEN RAISE EXCEPTION 'Recipient resources revoked' USING ERRCODE='HDN04';END IF;
  until:=least(g.expires_at,helpdesk_auth.hdn_notification_stamp(i->>'expiresAt'),clock_timestamp()+interval '30 seconds');revision:='grant-'||g.revision::text;
 END IF;
 -- Dynamic query is fixed here solely so fresh test DBs can provision synthetic
 -- auth.users independently. Identifier and recipient parameter are fixed.
 EXECUTE 'select email,email_confirmed_at from auth.users where id=$1 and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) for share' INTO address,verified_at USING p.supabase_user_id;
 IF address IS NULL OR verified_at>clock_timestamp() OR length(address)>254 OR address !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,63}$' THEN RAISE EXCEPTION 'Verified recipient contact required' USING ERRCODE='HDN06';END IF;
 RETURN jsonb_build_object('intentId',i->'id','workspaceId',i->'workspaceId','accountId',i->'accountId','recipientId',i->'recipientId','channelId','resend','resourceHash',i->'resourceHash','revision',revision,'decision','allowed','address',address,'expiresAt',helpdesk_auth.hdn_workflow_iso(until));
EXCEPTION WHEN no_data_found OR data_exception THEN RAISE EXCEPTION 'Recipient unavailable' USING ERRCODE='HDN06';END$$;
