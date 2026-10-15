-- Exact intent shape from the immutable v024 validator; only the admitted kinds extend.
CREATE OR REPLACE FUNCTION helpdesk_auth.hdn_notification_valid_intent(i jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE k text;BEGIN
 IF NOT coalesce(helpdesk_auth.hdn_cfg_object(i,ARRAY['id','workspaceId','accountId','ticketId','eventId','recipientId','channelId','templateId','templateVersion','templateHash','kind','sourceVersion','resourceHash','protocol','invitationId','createdAt','expiresAt','idempotencyKey']),false) THEN RETURN false;END IF;
 FOREACH k IN ARRAY ARRAY['id','workspaceId','accountId','ticketId','eventId','recipientId'] LOOP IF jsonb_typeof(i->k) IS DISTINCT FROM 'string' OR i->>k !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' THEN RETURN false;END IF;END LOOP;
 FOREACH k IN ARRAY ARRAY['channelId','templateId','templateHash','kind','resourceHash','protocol','createdAt','expiresAt','idempotencyKey'] LOOP IF jsonb_typeof(i->k) IS DISTINCT FROM 'string' THEN RETURN false;END IF;END LOOP;
 IF jsonb_typeof(i->'templateVersion') IS DISTINCT FROM 'number' OR jsonb_typeof(i->'sourceVersion') IS DISTINCT FROM 'number' THEN RETURN false;END IF;
 IF i->>'channelId'<>'resend' OR i->>'templateId' !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'
 OR i->>'kind' NOT IN ('support.created','support.devolutiva','support.customer_reply','support.form_revised','support.resolved','support.approval_requested','support.approval_granted','support.approval_rejected','support.transition','support.reply','support.handoff','support.closed','support.reopened','support.cancelled','internal.queue_created','internal.assignment_changed')
 OR i->>'protocol' !~ '^CG-[1-9][0-9]{4,17}$' OR i->>'templateHash' !~ '^[a-f0-9]{64}$' OR i->>'resourceHash' !~ '^[a-f0-9]{64}$'
 OR i->>'templateVersion' !~ '^[1-9][0-9]{0,15}$' OR (i->>'templateVersion')::numeric>9007199254740991 OR i->>'sourceVersion' !~ '^[1-9][0-9]{0,15}$' OR (i->>'sourceVersion')::numeric>9007199254740991
 OR (i->>'kind'='support.approval_requested')<>(i->'invitationId'<>'null'::jsonb)
 OR i->'invitationId'<>'null'::jsonb AND i->>'invitationId' !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
 OR helpdesk_auth.hdn_notification_stamp(i->>'expiresAt')<=helpdesk_auth.hdn_notification_stamp(i->>'createdAt') THEN RETURN false;END IF;
 RETURN coalesce(i->>'idempotencyKey'=helpdesk_auth.hdni_digest(jsonb_build_array('helpdesk-notification-v1',i->'workspaceId',i->'eventId',i->'recipientId',i->'channelId',i->'templateId',i->'templateVersion')),false);
EXCEPTION WHEN OTHERS THEN RETURN false;END$$;

-- Wave2 public semantics. Compose only inside the reviewed additive upgrade.
-- Existing source qualification remains intact; no historical plan is rewritten.
ALTER FUNCTION helpdesk_auth.hdn_notification_facts(uuid) RENAME TO hdn_notification_facts_v024;
CREATE FUNCTION helpdesk_auth.hdn_notification_facts(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE facts jsonb;source jsonb;legacy jsonb;prior jsonb;c helpdesk_audit.hdn_workflow_commits%rowtype;eligible boolean:=true;kind text;BEGIN
 facts:=helpdesk_auth.hdn_notification_facts_v024(target);legacy:=facts->'source';source:=legacy;
 IF legacy->>'type'<>'support.created' THEN
  SELECT * INTO STRICT c FROM helpdesk_audit.hdn_workflow_commits WHERE event_id=target FOR SHARE;
  kind:=CASE c.command->>'action'
   WHEN 'reply' THEN 'support.reply' WHEN 'request_customer' THEN 'support.devolutiva'
   WHEN 'start' THEN 'support.transition' WHEN 'triage' THEN 'support.transition'
   WHEN 'handoff' THEN 'support.handoff' WHEN 'customer_reply' THEN 'support.customer_reply'
   WHEN 'resolve' THEN 'support.resolved' WHEN 'close' THEN 'support.closed'
   WHEN 'reopen' THEN 'support.reopened' WHEN 'cancel' THEN 'support.cancelled'
   ELSE legacy->>'type' END;
  eligible:=CASE kind
   WHEN 'support.transition' THEN c.command->>'action'='start' AND c.from_status IN ('new','triage') AND c.to_status='open' AND c.public_event->>'actorKind'='human_agent'
   WHEN 'support.reply' THEN c.from_status IN ('triage','open','waiting_customer','waiting_internal','waiting_third_party') AND c.to_status=c.from_status AND c.public_event->>'actorKind'='human_agent'
   WHEN 'support.devolutiva' THEN c.from_status IN ('triage','open') AND c.to_status='waiting_customer' AND c.public_event->>'actorKind'='human_agent'
   WHEN 'support.handoff' THEN c.from_status='open' AND c.to_status IN ('waiting_internal','waiting_third_party') AND c.public_event->>'actorKind'='human_agent'
   WHEN 'support.customer_reply' THEN c.public_event->>'actorKind'='customer' AND c.from_status IN ('open','waiting_customer','waiting_internal','waiting_third_party') AND (c.to_status=c.from_status OR c.from_status='waiting_customer' AND c.to_status='open')
   WHEN 'support.resolved' THEN c.from_status IN ('triage','open','waiting_customer','waiting_internal','waiting_third_party') AND c.to_status='resolved' AND c.public_event->>'actorKind'='human_agent'
   WHEN 'support.closed' THEN c.from_status='resolved' AND c.to_status='closed' AND c.public_event->>'actorKind' IN ('customer','human_agent')
   WHEN 'support.reopened' THEN c.from_status IN ('resolved','closed') AND c.to_status='open' AND c.public_event->>'actorKind' IN ('customer','human_agent')
   WHEN 'support.cancelled' THEN c.from_status IN ('new','triage','open','waiting_customer','waiting_internal','waiting_third_party') AND c.to_status='cancelled' AND c.public_event->>'actorKind'='human_agent'
   ELSE false END;
  source:=jsonb_set(source,'{type}',to_jsonb(kind),false);
 END IF;
 SELECT document INTO prior FROM helpdesk_integration.hdn_notification_plans WHERE event_id=target;
 IF prior IS NOT NULL THEN
  IF prior->>'sourceHash'=helpdesk_auth.hdni_digest(legacy) THEN source:=legacy;
  ELSIF prior->>'sourceHash'<>helpdesk_auth.hdni_digest(source) THEN RAISE EXCEPTION 'Historical source mismatch' USING ERRCODE='HDN05';END IF;
 END IF;
 RETURN jsonb_set(facts,'{source}',source,false)||jsonb_build_object('wave2Eligible',coalesce(eligible,false));
EXCEPTION WHEN no_data_found OR data_exception THEN RAISE EXCEPTION 'Unqualified wave2 source' USING ERRCODE='HDN05';END$$;
REVOKE ALL ON FUNCTION helpdesk_auth.hdn_notification_facts(uuid) FROM PUBLIC,helpdesk_app,helpdesk_notification_worker,helpdesk_resource_publisher,helpdesk_maintenance,anon,authenticated,service_role;

ALTER TABLE helpdesk_integration.hdn_notification_routes ADD COLUMN effective_after timestamptz;
ALTER TABLE helpdesk_integration.hdn_notification_routes ADD CONSTRAINT hdn_notification_routes_effective_after_check CHECK(effective_after IS NULL OR isfinite(effective_after));
ALTER TABLE helpdesk_integration.hdn_notification_routes DROP CONSTRAINT hdn_notification_routes_check;
ALTER TABLE helpdesk_integration.hdn_notification_routes ADD CONSTRAINT hdn_notification_routes_check CHECK(
 (audience='none' AND template_id IS NULL AND template_version IS NULL)
 OR (audience='requester' AND kind IN ('support.created','support.devolutiva','support.resolved','support.transition','support.reply','support.handoff','support.closed','support.reopened','support.cancelled') AND template_id IS NOT NULL AND template_version IS NOT NULL));

CREATE OR REPLACE FUNCTION helpdesk_auth.hdn_notification_routing(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE facts jsonb;src jsonb;route helpdesk_integration.hdn_notification_routes%rowtype;t helpdesk_integration.hdn_notification_templates%rowtype;recipients jsonb:='[]';BEGIN PERFORM helpdesk_auth.hdn_notification_worker();facts:=helpdesk_auth.hdn_notification_facts(target);src:=facts->'source';
 SELECT * INTO STRICT route FROM helpdesk_integration.hdn_notification_routes WHERE workspace_id=(src->>'workspaceId')::uuid AND kind=src->>'type' ORDER BY revision DESC LIMIT 1 FOR SHARE;
 IF route.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Routing expired' USING ERRCODE='HDN05';END IF;
 IF route.audience='requester' AND facts->'wave2Eligible'='true'::jsonb
  AND (route.effective_after IS NULL OR helpdesk_auth.hdn_notification_stamp(src->>'createdAt')>=route.effective_after) THEN
  SELECT * INTO STRICT t FROM helpdesk_integration.hdn_notification_templates WHERE id=route.template_id AND version=route.template_version FOR SHARE;
  IF t.kind<>route.kind THEN RAISE EXCEPTION 'Template kind mismatch' USING ERRCODE='HDN05';END IF;
  recipients:=jsonb_build_array(jsonb_build_object('principalId',facts->'requesterId','channelId','resend','templateId',t.id,'templateVersion',t.version,'templateHash',t.sha256));
 END IF;
 RETURN jsonb_build_object('eventId',target,'workspaceId',src->'workspaceId','accountId',src->'accountId','ticketId',src->'ticketId','sourceVersion',src->'version','kind',src->'type','protocol',facts->'protocol','resourceHash',facts->'resourceHash','revision','route-'||route.revision::text,'status','published','expiresAt',helpdesk_auth.hdn_workflow_iso(route.expires_at),'recipients',recipients);
EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'Published routing required' USING ERRCODE='HDN05';END$$;
