-- Qualify the immutable parent independently of the private projection plan.
-- Same instant may have distinct public/private JSON timestamp representations.
CREATE OR REPLACE FUNCTION helpdesk_auth.hdn_notification_facts_wave2_team(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
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
  IF p.kind='support.customer_reply' THEN
   -- v024 validates actual event/outbox/effect/snapshot/receipt/resource history.
   -- The private source below owns the plan hash; the public projection must not
   -- reinterpret that plan when its UUID is shared with the parent event.
   PERFORM helpdesk_auth.hdn_notification_facts_v024(p.parent_event_id);
   IF c.from_status NOT IN ('open','waiting_customer','waiting_internal','waiting_third_party')
    OR NOT (c.to_status=c.from_status OR c.from_status='waiting_customer' AND c.to_status='open')
   THEN RAISE EXCEPTION 'Private customer return semantics changed' USING ERRCODE='HDN05';END IF;
  END IF;
 END IF;
 source:=jsonb_build_object('id',p.id,'workspaceId',p.workspace_id,'accountId',p.account_id,'ticketId',p.ticket_id,'type',p.kind,'version',p.source_version,'requestId',p.request_id,'createdAt',helpdesk_auth.hdn_workflow_iso(p.created_at));
 SELECT document INTO prior FROM helpdesk_integration.hdn_notification_plans WHERE event_id=target;
 IF prior IS NOT NULL AND prior->>'sourceHash'<>helpdesk_auth.hdni_digest(source) THEN RAISE EXCEPTION 'Private historical source mismatch' USING ERRCODE='HDN05';END IF;
 RETURN jsonb_set(facts,'{source}',source,false)||jsonb_build_object('wave2Eligible',true,'sourceAssigneeId',p.assigned_principal_id,'parentEventId',p.parent_event_id);
EXCEPTION WHEN no_data_found OR data_exception THEN RAISE EXCEPTION 'Unqualified private source' USING ERRCODE='HDN05';END$$;
