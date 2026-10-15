-- Expired finite authority seals an empty plan; it cannot stall the shared queue.
CREATE OR REPLACE FUNCTION helpdesk_auth.hdn_notification_routing(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE facts jsonb;src jsonb;route helpdesk_integration.hdn_notification_routes%rowtype;t helpdesk_integration.hdn_notification_templates%rowtype;
 roster helpdesk_integration.hdn_notification_queue_rosters%rowtype;people uuid[]:='{}';person uuid;recipients jsonb:='[]';BEGIN
 PERFORM helpdesk_auth.hdn_notification_worker();facts:=helpdesk_auth.hdn_notification_facts(target);src:=facts->'source';
 SELECT * INTO STRICT route FROM helpdesk_integration.hdn_notification_routes WHERE workspace_id=(src->>'workspaceId')::uuid AND kind=src->>'type' ORDER BY revision DESC LIMIT 1 FOR SHARE;

 IF route.expires_at>clock_timestamp() AND route.audience<>'none' AND facts->'wave2Eligible'='true'::jsonb AND (route.effective_after IS NULL OR helpdesk_auth.hdn_notification_stamp(src->>'createdAt')>=route.effective_after) THEN
  SELECT * INTO STRICT t FROM helpdesk_integration.hdn_notification_templates WHERE id=route.template_id AND version=route.template_version FOR SHARE;
  IF t.kind<>route.kind THEN RAISE EXCEPTION 'Template kind mismatch' USING ERRCODE='HDN05';END IF;
  IF route.audience='requester' THEN people:=ARRAY[(facts->>'requesterId')::uuid];
  ELSIF route.audience='approver' THEN people:=ARRAY[(facts->>'sourceApproverId')::uuid];
  ELSIF route.audience IN ('assignee','customer_return') AND facts->>'sourceAssigneeId' IS NOT NULL THEN people:=ARRAY[(facts->>'sourceAssigneeId')::uuid];
  ELSIF route.audience IN ('queue','customer_return') THEN
   SELECT * INTO STRICT roster FROM helpdesk_integration.hdn_notification_queue_rosters WHERE workspace_id=(src->>'workspaceId')::uuid AND account_id=(src->>'accountId')::uuid ORDER BY revision DESC LIMIT 1 FOR SHARE;
   IF roster.expires_at>clock_timestamp() THEN people:=roster.member_ids;END IF;
  ELSE RAISE EXCEPTION 'Audience not yet qualified' USING ERRCODE='HDN05';END IF;
  FOREACH person IN ARRAY people LOOP
   IF (route.recipient_ids IS NULL OR person=ANY(route.recipient_ids)) AND (route.audience='requester' OR route.audience='approver' AND helpdesk_auth.hdn_notification_approver(target,person) OR route.audience IN ('queue','assignee','customer_return') AND helpdesk_auth.hdn_notification_internal_person(target,person)) THEN
    recipients:=recipients||jsonb_build_array(jsonb_build_object('principalId',person,'channelId','resend','templateId',t.id,'templateVersion',t.version,'templateHash',t.sha256));
   END IF;
  END LOOP;
 END IF;
 RETURN jsonb_build_object('eventId',target,'workspaceId',src->'workspaceId','accountId',src->'accountId','ticketId',src->'ticketId','sourceVersion',src->'version','kind',src->'type','protocol',facts->'protocol','resourceHash',facts->'resourceHash','revision','route-'||route.revision::text,'status','published','expiresAt',helpdesk_auth.hdn_workflow_iso(route.expires_at),'recipients',recipients);
EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'Published routing required' USING ERRCODE='HDN05';END$$;

