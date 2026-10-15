ALTER FUNCTION helpdesk_auth.hdn_notification_facts(uuid) RENAME TO hdn_notification_facts_wave2_team;
CREATE FUNCTION helpdesk_auth.hdn_notification_facts(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE s helpdesk_integration.hdnr_sources%rowtype;r helpdesk_audit.hdnr_receipts%rowtype;root helpdesk_audit.hdni_receipts%rowtype;c helpdesk_audit.hdn_workflow_commits%rowtype;
 i helpdesk_core.hdnr_invitations%rowtype;facts jsonb;src jsonb;expected jsonb;prior jsonb;at_text text;BEGIN
 SELECT * INTO s FROM helpdesk_integration.hdnr_sources WHERE id=target FOR SHARE;
 IF NOT FOUND THEN RETURN helpdesk_auth.hdn_notification_facts_wave2_team(target);END IF;
 SELECT * INTO STRICT r FROM helpdesk_audit.hdnr_receipts WHERE(id,workspace_id,account_id,ticket_id)=(s.receipt_id,s.workspace_id,s.account_id,s.ticket_id) FOR SHARE;
 SELECT * INTO STRICT root FROM helpdesk_audit.hdni_receipts WHERE(workspace_id,account_id,ticket_id)=(s.workspace_id,s.account_id,s.ticket_id) FOR SHARE;
 facts:=helpdesk_auth.hdn_notification_facts_v024(root.event_id);src:=r.bundle->'outbox';at_text:=src->>'createdAt';
 expected:=jsonb_build_object('id',s.id,'workspaceId',s.workspace_id,'accountId',s.account_id,'ticketId',s.ticket_id,'type',s.kind,'version',s.source_version,'requestId',s.request_id,'createdAt',at_text);
 IF r.id<>s.id OR r.request_id<>s.request_id OR r.created_at<>s.created_at OR helpdesk_auth.hdn_notification_stamp(at_text)<>s.created_at THEN RAISE EXCEPTION 'Review source receipt mismatch' USING ERRCODE='HDN05';END IF;
 IF s.kind='support.approval_requested' THEN
  SELECT * INTO STRICT i FROM helpdesk_core.hdnr_invitations WHERE(id,workspace_id,account_id,ticket_id)=(s.invitation_id,s.workspace_id,s.account_id,s.ticket_id);
  expected:=expected||jsonb_build_object('invitationId',s.invitation_id);
  IF r.action<>'invitation' OR r.invitation_id<>s.invitation_id OR i.receipt_id<>r.id OR i.document-ARRAY['status','challenge'] IS DISTINCT FROM r.bundle->'invitation'-ARRAY['status','challenge'] OR i.document->'ticketVersion'<>to_jsonb(s.source_version)
   OR NOT EXISTS(SELECT 1 FROM helpdesk_audit.audit_events e WHERE(e.workspace_id,e.id,e.principal_id,e.action,e.resource_id,e.request_id,e.created_at)=(s.workspace_id,s.id,r.actor_id,'approval.requested',s.ticket_id,s.request_id::text,s.created_at)) THEN RAISE EXCEPTION 'Review invitation source mismatch' USING ERRCODE='HDN05';END IF;
 ELSE
  SELECT * INTO STRICT c FROM helpdesk_audit.hdn_workflow_commits WHERE(workspace_id,account_id,ticket_id,event_id)=(s.workspace_id,s.account_id,s.ticket_id,s.id) FOR SHARE;
  IF s.invitation_id IS NOT NULL OR c.transaction_id<>r.transaction_id OR c.actor_id<>r.actor_id OR c.intent_key<>r.intent_key OR c.intent_hash<>r.intent_hash OR c.to_version<>s.source_version OR c.at<>s.created_at OR c.public_event IS DISTINCT FROM r.bundle->'decision'->'event' OR c.result IS DISTINCT FROM r.result OR c.audit IS DISTINCT FROM r.bundle->'audit'
   OR s.kind IS DISTINCT FROM 'support.'||(c.public_event->>'type') OR s.kind='support.form_revised' AND (r.action<>'revision' OR c.command->>'action'<>'revise_form') OR s.kind IN ('support.approval_granted','support.approval_rejected') AND (r.action<>'approval' OR c.command->>'action'<>'approval')
   OR NOT EXISTS(SELECT 1 FROM helpdesk_core.ticket_events e JOIN helpdesk_audit.write_effects f ON(f.workspace_id,f.event_id)=(e.workspace_id,e.id) WHERE(e.workspace_id,e.account_id,e.ticket_id,e.id,e.actor_id,e.type,e.created_at)=(s.workspace_id,s.account_id,s.ticket_id,s.id,r.actor_id,'ticket.status_changed',s.created_at) AND e.customer_visible AND f.applied AND f.transaction_id=r.transaction_id AND f.ticket_version=s.source_version AND e.data-'reason'=f.expected_data AND f.expected_data=jsonb_build_object('from',c.from_status,'to',c.to_status))
   OR NOT EXISTS(SELECT 1 FROM helpdesk_audit.audit_events e WHERE(e.workspace_id,e.id,e.principal_id,e.action,e.resource_id,e.request_id,e.created_at)=(s.workspace_id,s.id,r.actor_id,r.bundle->'audit'->>'action',s.ticket_id,s.request_id::text,s.created_at))
   OR NOT EXISTS(SELECT 1 FROM helpdesk_integration.outbox_events o WHERE(o.workspace_id,o.account_id,o.ticket_id,o.id,o.type,o.request_id,o.created_at)=(s.workspace_id,s.account_id,s.ticket_id,s.id,'ticket.status_changed',s.request_id::text,s.created_at)
    AND o.payload=jsonb_build_object('specversion','1.0','id',s.id,'source','helpdesk/workspaces/'||s.workspace_id::text,'type','com.helpdesk.ticket.status_changed.v1','subject','tickets/'||s.ticket_id::text,'datacontenttype','application/json','time',at_text,'data',jsonb_build_object('ticket_id',s.ticket_id,'version',s.source_version))) THEN RAISE EXCEPTION 'Review workflow source mismatch' USING ERRCODE='HDN05';END IF;
 END IF;
 IF src IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Review source header changed' USING ERRCODE='HDN05';END IF;
 SELECT document INTO prior FROM helpdesk_integration.hdn_notification_plans WHERE event_id=target;
 IF prior IS NOT NULL AND prior->>'sourceHash'<>helpdesk_auth.hdni_digest(src) THEN RAISE EXCEPTION 'Review historical source changed' USING ERRCODE='HDN05';END IF;
 RETURN jsonb_set(facts,'{source}',src,false)||jsonb_build_object('wave2Eligible',true,'sourceApproverId',CASE WHEN s.kind='support.approval_requested' THEN i.document->'approverId' ELSE 'null'::jsonb END);
EXCEPTION WHEN no_data_found OR data_exception THEN RAISE EXCEPTION 'Unqualified review source' USING ERRCODE='HDN05';END$$;

-- Dispatch authority is deliberately separate from immutable historical facts:
-- delivered callbacks remain valid after an invitation expires or is consumed.
CREATE FUNCTION helpdesk_auth.hdn_notification_approver(target uuid,person uuid) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE facts jsonb;src jsonb;w uuid;a uuid;ticket uuid;i helpdesk_core.hdnr_invitations%rowtype;t helpdesk_core.tickets%rowtype;g helpdesk_auth.hdnr_grants%rowtype;roster helpdesk_auth.hdnr_rosters%rowtype;p helpdesk_core.hdnr_profiles%rowtype;form_revision integer;ref record;BEGIN
 facts:=helpdesk_auth.hdn_notification_facts(target);src:=facts->'source';IF src->>'type'<>'support.approval_requested' OR facts->>'sourceApproverId' IS DISTINCT FROM person::text OR person::text=facts->>'requesterId' THEN RETURN false;END IF;
 w:=(src->>'workspaceId')::uuid;a:=(src->>'accountId')::uuid;ticket:=(src->>'ticketId')::uuid;PERFORM helpdesk_auth.hdnr_authority_read(w);
 SELECT * INTO STRICT t FROM helpdesk_core.tickets WHERE(workspace_id,account_id,id)=(w,a,ticket) FOR SHARE;
 SELECT * INTO STRICT i FROM helpdesk_core.hdnr_invitations WHERE(workspace_id,account_id,ticket_id,id)=(w,a,ticket,(src->>'invitationId')::uuid) FOR SHARE;
 SELECT p0.* INTO STRICT p FROM helpdesk_core.hdnr_profiles p0 JOIN helpdesk_core.hdn_workflow_state state ON(state.workspace_id,state.account_id,state.profile_version_id)=(p0.workspace_id,p0.account_id,p0.profile_version_id) WHERE(state.workspace_id,state.account_id,state.ticket_id)=(w,a,ticket);
 SELECT coalesce(max(revision),1) INTO form_revision FROM helpdesk_core.hdnr_forms WHERE(workspace_id,account_id,ticket_id)=(w,a,ticket);
 IF i.document->>'status'<>'pending' OR helpdesk_auth.hdn_notification_stamp(i.document->>'expiresAt')<=clock_timestamp() OR i.document->>'approverId'<>person::text OR i.document->'ticketVersion'<>to_jsonb(t.version) OR i.document->'formRevision'<>to_jsonb(form_revision) OR i.document->>'policyVersionId'<>p.policy_version_id OR t.status NOT IN ('new','triage') OR person=t.created_by THEN RETURN false;END IF;
 PERFORM 1 FROM helpdesk_core.hdn_workflow_state WHERE(workspace_id,account_id,ticket_id,approval)=(w,a,ticket,'pending') FOR SHARE;IF NOT FOUND THEN RETURN false;END IF;
 SELECT * INTO roster FROM helpdesk_auth.hdnr_rosters WHERE(workspace_id,account_id,profile_version_id)=(w,a,p.profile_version_id) ORDER BY revision DESC LIMIT 1 FOR SHARE;
 SELECT * INTO g FROM helpdesk_auth.hdnr_grants WHERE(workspace_id,account_id,principal_id,capability)=(w,a,person,'approvals.decide') ORDER BY revision DESC LIMIT 1 FOR SHARE;
 IF g.principal_id IS NULL OR NOT g.active OR g.expires_at<=clock_timestamp() OR roster.approver_id IS DISTINCT FROM person OR NOT roster.active OR roster.expires_at<=clock_timestamp() THEN RETURN false;END IF;
 PERFORM 1 FROM helpdesk_auth.workspace_memberships WHERE(workspace_id,principal_id,role,active)=(w,person,'admin',true) FOR SHARE;IF NOT FOUND OR NOT helpdesk_auth.hdnr_operator(w,a,ticket,person) THEN RETURN false;END IF;
 FOR ref IN SELECT resource_type,resource_id FROM helpdesk_core.cg_ticket_resource_refs WHERE(workspace_id,account_id,ticket_id)=(w,a,ticket) LOOP
  IF ref.resource_type<>'work' OR NOT ref.resource_id=ANY(g.work_ids) OR NOT ref.resource_id=ANY(roster.work_ids) THEN RETURN false;END IF;
 END LOOP;RETURN true;
EXCEPTION WHEN no_data_found OR data_exception THEN RAISE EXCEPTION 'Current approval recipient unavailable' USING ERRCODE='HDN06';END$$;


CREATE OR REPLACE FUNCTION helpdesk_auth.hdn_notification_sources(bound integer) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE row record;facts jsonb;src jsonb;ids jsonb:='[]';p jsonb;remaining integer;BEGIN
 PERFORM helpdesk_auth.hdn_notification_worker();IF bound NOT BETWEEN 1 AND 10 THEN RAISE EXCEPTION 'Bound required' USING ERRCODE='HDN02';END IF;
 FOR row IN SELECT x.id FROM helpdesk_integration.hdnr_sources x WHERE NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_plans planned WHERE planned.event_id=x.id) ORDER BY x.created_at,x.id LIMIT bound FOR UPDATE OF x SKIP LOCKED LOOP
  PERFORM helpdesk_auth.hdn_notification_facts(row.id);ids:=ids||jsonb_build_array(row.id);
 END LOOP;
 remaining:=bound-jsonb_array_length(ids);
 FOR row IN SELECT x.id FROM helpdesk_integration.hdn_notification_private_sources x WHERE NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_plans planned WHERE planned.event_id=x.id) ORDER BY x.created_at,x.id LIMIT remaining FOR UPDATE OF x SKIP LOCKED LOOP
  PERFORM helpdesk_auth.hdn_notification_facts(row.id);ids:=ids||jsonb_build_array(row.id);
 END LOOP;
 remaining:=bound-jsonb_array_length(ids);
 FOR row IN SELECT o.id FROM helpdesk_integration.outbox_events o WHERE NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdnr_sources x WHERE x.id=o.id) AND NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_private_sources x WHERE x.id=o.id) AND NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_plans planned WHERE planned.event_id=o.id) AND EXISTS(SELECT 1 FROM helpdesk_core.hdni_snapshots s WHERE (s.workspace_id,s.account_id,s.ticket_id)=(o.workspace_id,o.account_id,o.ticket_id)) ORDER BY o.created_at,o.id LIMIT remaining FOR UPDATE OF o SKIP LOCKED LOOP
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
  ELSIF route.audience='approver' THEN people:=ARRAY[(facts->>'sourceApproverId')::uuid];
  ELSIF route.audience IN ('assignee','customer_return') AND facts->>'sourceAssigneeId' IS NOT NULL THEN people:=ARRAY[(facts->>'sourceAssigneeId')::uuid];
  ELSIF route.audience IN ('queue','customer_return') THEN
   SELECT * INTO STRICT roster FROM helpdesk_integration.hdn_notification_queue_rosters WHERE workspace_id=(src->>'workspaceId')::uuid AND account_id=(src->>'accountId')::uuid ORDER BY revision DESC LIMIT 1 FOR SHARE;
   IF roster.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Published queue roster expired' USING ERRCODE='HDN05';END IF;people:=roster.member_ids;
  ELSE RAISE EXCEPTION 'Audience not yet qualified' USING ERRCODE='HDN05';END IF;
  FOREACH person IN ARRAY people LOOP
   IF (route.recipient_ids IS NULL OR person=ANY(route.recipient_ids)) AND (route.audience='requester' OR route.audience='approver' AND helpdesk_auth.hdn_notification_approver(target,person) OR route.audience IN ('queue','assignee','customer_return') AND helpdesk_auth.hdn_notification_internal_person(target,person)) THEN
    recipients:=recipients||jsonb_build_array(jsonb_build_object('principalId',person,'channelId','resend','templateId',t.id,'templateVersion',t.version,'templateHash',t.sha256));
   END IF;
  END LOOP;
 END IF;
 RETURN jsonb_build_object('eventId',target,'workspaceId',src->'workspaceId','accountId',src->'accountId','ticketId',src->'ticketId','sourceVersion',src->'version','kind',src->'type','protocol',facts->'protocol','resourceHash',facts->'resourceHash','revision','route-'||route.revision::text,'status','published','expiresAt',helpdesk_auth.hdn_workflow_iso(route.expires_at),'recipients',recipients);
EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'Published routing required' USING ERRCODE='HDN05';END$$;

CREATE OR REPLACE FUNCTION helpdesk_auth.hdn_notification_recipient(i jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=(i->>'workspaceId')::uuid;a uuid:=(i->>'accountId')::uuid;person uuid:=(i->>'recipientId')::uuid;target uuid:=(i->>'ticketId')::uuid;p helpdesk_auth.principals%rowtype;t helpdesk_core.tickets%rowtype;s helpdesk_core.cg_ticket_resource_sets%rowtype;b helpdesk_auth.cg_resource_bindings%rowtype;c helpdesk_auth.cg_resource_connections%rowtype;g helpdesk_auth.cg_resource_grant_sets%rowtype;o helpdesk_auth.cg_resource_observations%rowtype;facts jsonb;address text;verified_at timestamptz;until timestamptz;revision text;allowed boolean:=false;local_registry jsonb;local_account jsonb;local_permission jsonb;local_receipt jsonb;local_work jsonb;ref record;recipient_operation text:='tickets.read';internal_recipient boolean;current_route helpdesk_integration.hdn_notification_routes%rowtype;BEGIN
 IF i->>'kind' IN ('support.form_revised','support.approval_requested','support.approval_granted','support.approval_rejected') THEN PERFORM helpdesk_auth.hdnr_authority_read(w);END IF;
 SELECT * INTO STRICT t FROM helpdesk_core.tickets WHERE (workspace_id,account_id,id)=(w,a,target) FOR SHARE;
 facts:=helpdesk_auth.hdn_notification_facts((i->>'eventId')::uuid);internal_recipient:=i->>'kind' IN ('internal.queue_created','internal.assignment_changed','support.customer_reply','support.approval_requested');IF i->'resourceHash'<>facts->'resourceHash' OR i->'protocol'<>facts->'protocol' OR i->'kind'<>facts->'source'->'type' OR i->'sourceVersion'<>facts->'source'->'version' OR (NOT internal_recipient AND i->'recipientId'<>facts->'requesterId') OR (internal_recipient AND NOT CASE WHEN i->>'kind'='support.approval_requested' THEN i->'invitationId' IS NOT DISTINCT FROM facts->'source'->'invitationId' AND helpdesk_auth.hdn_notification_approver((i->>'eventId')::uuid,person) ELSE helpdesk_auth.hdn_notification_internal_person((i->>'eventId')::uuid,person) END) THEN RAISE EXCEPTION 'Recipient source mismatch' USING ERRCODE='HDN04';END IF;
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

CREATE OR REPLACE FUNCTION helpdesk_auth.hdn_notification_write_plan(target uuid,p jsonb,intents jsonb) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE facts jsonb;src jsonb;r jsonb;expected jsonb;i jsonb;ids jsonb:='[]';row jsonb;recipient jsonb;n integer;affected integer;BEGIN PERFORM helpdesk_auth.hdn_notification_worker();facts:=helpdesk_auth.hdn_notification_facts(target);src:=facts->'source';r:=helpdesk_auth.hdn_notification_routing(target);
 IF jsonb_typeof(intents)<>'array' OR jsonb_array_length(intents)>100 OR jsonb_array_length(intents)<>jsonb_array_length(r->'recipients') OR EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_plans WHERE event_id=target) THEN RAISE EXCEPTION 'Plan conflict' USING ERRCODE='HDN05';END IF;
 FOR i IN SELECT value FROM jsonb_array_elements(intents) LOOP
  IF NOT helpdesk_auth.hdn_notification_valid_intent(i) OR i->>'eventId'<>target::text OR i->'workspaceId'<>src->'workspaceId' OR i->'accountId'<>src->'accountId' OR i->'ticketId'<>src->'ticketId' OR i->'kind'<>src->'type' OR i->'sourceVersion'<>src->'version' OR i->'resourceHash'<>r->'resourceHash' OR i->'protocol'<>r->'protocol' OR i->'expiresAt'<>r->'expiresAt' OR i->'createdAt'<>p->'plannedAt' OR i->'invitationId' IS DISTINCT FROM coalesce(src->'invitationId','null'::jsonb) THEN RAISE EXCEPTION 'Intent mismatch' USING ERRCODE='HDN05';END IF;
  recipient:=jsonb_build_object('principalId',i->'recipientId','channelId',i->'channelId','templateId',i->'templateId','templateVersion',i->'templateVersion','templateHash',i->'templateHash');IF NOT r->'recipients' @> jsonb_build_array(recipient) OR ids @> jsonb_build_array(i->'id') THEN RAISE EXCEPTION 'Recipient mismatch' USING ERRCODE='HDN05';END IF;ids:=ids||jsonb_build_array(i->'id');
 END LOOP;
 expected:=jsonb_build_object('schema',1,'eventId',target,'sourceHash',helpdesk_auth.hdni_digest(src),'sourceVersion',src->'version','routingRevision',r->'revision','plannedAt',p->'plannedAt','state',CASE WHEN jsonb_array_length(intents)=0 THEN 'no_recipients' ELSE 'planned' END,'intentIds',ids);
 IF p IS DISTINCT FROM expected OR helpdesk_auth.hdn_notification_stamp(p->>'plannedAt')<helpdesk_auth.hdn_notification_stamp(src->>'createdAt') OR helpdesk_auth.hdn_notification_stamp(p->>'plannedAt')>clock_timestamp() THEN RAISE EXCEPTION 'Plan mismatch' USING ERRCODE='HDN05';END IF;
 INSERT INTO helpdesk_integration.hdn_notification_plans VALUES(target,(src->>'workspaceId')::uuid,(src->>'accountId')::uuid,(src->>'ticketId')::uuid,p);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Plan effect missing' USING ERRCODE='HDN05';END IF;
 FOR i IN SELECT value FROM jsonb_array_elements(intents) LOOP
  row:=jsonb_build_object('intent',i,'revision',1,'state','pending','attempts',0,'lease',NULL,'requestHash',NULL,'providerMessageId',NULL,'providerSequence',0,'providerEventAt',NULL,'nextAttemptAt',NULL,'lastReason',NULL,'attention',false,'updatedAt',p->'plannedAt');
  INSERT INTO helpdesk_integration.hdn_notification_records VALUES((i->>'id')::uuid,(i->>'workspaceId')::uuid,(i->>'accountId')::uuid,(i->>'ticketId')::uuid,target,(i->>'recipientId')::uuid,'resend',i,row);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Intent effect missing' USING ERRCODE='HDN05';END IF;
  IF NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_records WHERE id=(i->>'id')::uuid AND intent=i AND record=row) THEN RAISE EXCEPTION 'Intent effect altered' USING ERRCODE='HDN05';END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_plans WHERE event_id=target AND document=p) THEN RAISE EXCEPTION 'Plan effect altered' USING ERRCODE='HDN05';END IF;RETURN true;
END$$;

DO $private$ DECLARE role_name text;BEGIN
 REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_facts(uuid),helpdesk_auth.hdn_notification_approver(uuid,uuid) FROM PUBLIC;
 FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_facts(uuid),helpdesk_auth.hdn_notification_approver(uuid,uuid) FROM %I',role_name);END IF;
 END LOOP;
END $private$;
