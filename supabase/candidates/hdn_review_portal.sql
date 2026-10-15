CREATE FUNCTION helpdesk_auth.hdnr_view_capability(target uuid,cap text,ctx jsonb) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM helpdesk_auth.hdnr_grant(target,cap,ctx);RETURN true;
EXCEPTION WHEN SQLSTATE 'HDR01' OR SQLSTATE 'HDR05' THEN RETURN false;END$$;

-- Authenticated read only. Never returns or generates a challenge, applies a
-- decision, consumes a draft, or changes an invitation. Initial CG cohort uses
-- current tickets.write scope for review; ordinary ticket reads stay separate.
CREATE FUNCTION helpdesk_auth.hdnr_view(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();ctx jsonb;a jsonb;ticket jsonb;definition jsonb;fields jsonb;invite helpdesk_core.hdnr_invitations%rowtype;
 decision_row helpdesk_audit.hdnr_receipts%rowtype;invitation_id uuid;request_allowed boolean;decide_allowed boolean;revise_allowed boolean;last_decision jsonb:='null';BEGIN
 ctx:=helpdesk_auth.hdnr_context(target);
 IF NOT EXISTS(SELECT 1 FROM helpdesk_core.hdni_snapshots s JOIN helpdesk_core.hdnr_profiles p ON(p.workspace_id,p.account_id,p.profile_version_id)=(s.workspace_id,s.account_id,s.document->'profile'->>'profileVersionId') WHERE(s.workspace_id,s.ticket_id)=(w,target)) THEN RETURN NULL;END IF;
 a:=helpdesk_auth.hdnr_aggregate(target)->'aggregate';ticket:=a->'ticket';
 SELECT jsonb_agg(field ORDER BY ordinal) INTO fields FROM jsonb_array_elements(a->'profile'->'form'->'fields') WITH ORDINALITY x(field,ordinal) WHERE field->'public'='true'::jsonb;
 definition:=a->'profile'->'form'||jsonb_build_object('fields',coalesce(fields,'[]'::jsonb));
 request_allowed:=helpdesk_auth.hdnr_view_capability(target,'approvals.request',ctx);decide_allowed:=helpdesk_auth.hdnr_view_capability(target,'approvals.decide',ctx);revise_allowed:=helpdesk_auth.hdnr_view_capability(target,'forms.revise',ctx);
 SELECT * INTO invite FROM helpdesk_core.hdnr_invitations WHERE(workspace_id,account_id,ticket_id)=(w,(ticket->>'accountId')::uuid,target) AND document->>'status'='pending' ORDER BY id LIMIT 1;
 request_allowed:=request_allowed AND invite.id IS NULL AND ticket->>'status' IN ('new','triage') AND ticket->>'approval'='pending' AND a->'profile'->'approvalRequired'='true'::jsonb;
 decide_allowed:=decide_allowed AND invite.id IS NOT NULL AND invite.document->>'approverId'=who::text AND helpdesk_auth.hdn_notification_stamp(invite.document->>'expiresAt')>clock_timestamp() AND invite.document->'ticketVersion'=ticket->'version' AND invite.document->'formRevision'=a->'form'->'revision' AND invite.document->>'targetHash'=helpdesk_auth.hdnr_target_hash(a) AND ticket->>'status' IN ('new','triage') AND ticket->>'approval'='pending';
 IF coalesce(decide_allowed,false) THEN invitation_id:=invite.id;END IF;
 revise_allowed:=revise_allowed AND ticket->>'status'='waiting_customer';
 -- Decision justification is part of this explicit customer-facing review
 -- command, never a general private note. Only the pinned new CG review profile
 -- and this currently authorized ticket projection may disclose it.
 SELECT * INTO decision_row FROM helpdesk_audit.hdnr_receipts WHERE(workspace_id,account_id,ticket_id,action)=(w,(ticket->>'accountId')::uuid,target,'approval') ORDER BY(result->>'version')::integer DESC LIMIT 1;
 IF FOUND THEN last_decision:=jsonb_build_object('decision',decision_row.result->'decision','version',decision_row.result->'version','formRevision',decision_row.result->'formRevision','at',decision_row.bundle->'audit'->'at','reason',decision_row.bundle->'decision'->'reason');END IF;
 RETURN jsonb_build_object('schema',1,'context',jsonb_build_object('principalId',who,'workspaceId',w,'accountId',ticket->'accountId','ticketId',target,'version',ticket->'version','formRevision',a->'form'->'revision','invitationId',invitation_id),'protocol',a->'protocol','status',ticket->'status','approval',ticket->'approval',
  'form',jsonb_build_object('definition',definition,'formId',a->'form'->'formId','formVersion',a->'form'->'formVersion','schemaHash',a->'form'->'schemaHash','answers',a->'form'->'publicAnswers','refs',a->'refs'),
  'capabilities',jsonb_build_object('requestApproval',coalesce(request_allowed,false),'decideApproval',coalesce(decide_allowed,false),'reviseForm',coalesce(revise_allowed,false)),'decision',last_decision);
END$$;

CREATE FUNCTION helpdesk_auth.hdnr_landing(invitation uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE row helpdesk_core.hdnr_invitations%rowtype;a jsonb;ctx jsonb;BEGIN
 IF session_user<>'helpdesk_app' OR NOT coalesce(helpdesk_auth.is_human(),false) THEN RAISE EXCEPTION 'Human invitation navigation required' USING ERRCODE='HDR01';END IF;
 SELECT * INTO row FROM helpdesk_core.hdnr_invitations WHERE(workspace_id,id)=(helpdesk_auth.workspace_id(),invitation);
 IF NOT FOUND OR row.document->>'approverId' IS DISTINCT FROM helpdesk_auth.actor_id()::text THEN RAISE EXCEPTION 'Invitation navigation denied' USING ERRCODE='HDR01';END IF;
 ctx:=helpdesk_auth.hdnr_context(row.ticket_id);PERFORM helpdesk_auth.hdnr_grant(row.ticket_id,'approvals.decide',ctx);a:=helpdesk_auth.hdnr_aggregate(row.ticket_id)->'aggregate';
 SELECT * INTO STRICT row FROM helpdesk_core.hdnr_invitations WHERE(workspace_id,id)=(helpdesk_auth.workspace_id(),invitation) FOR SHARE;
 IF row.document->>'status'<>'pending' OR helpdesk_auth.hdn_notification_stamp(row.document->>'expiresAt')<=clock_timestamp() OR row.document->'ticketVersion' IS DISTINCT FROM a->'ticket'->'version' OR row.document->'formRevision' IS DISTINCT FROM a->'form'->'revision' OR row.document->>'targetHash' IS DISTINCT FROM helpdesk_auth.hdnr_target_hash(a) OR row.document->'policyVersionId' IS DISTINCT FROM a->'approvalPolicy'->'versionId' OR a->'ticket'->>'approval'<>'pending' OR a->'ticket'->>'status' NOT IN ('new','triage') THEN RAISE EXCEPTION 'Invitation target changed' USING ERRCODE='HDR02';END IF;
 RETURN jsonb_build_object('workspaceId',row.workspace_id,'ticketId',row.ticket_id,'invitationId',row.id);
END$$;

-- Operational alert 30 uses the panel, independent of the failing SMTP channel.
-- No provider call, resend, notification producer, contact or raw provider data.
CREATE FUNCTION helpdesk_auth.hdn_notification_attention(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb;w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();a uuid;rows jsonb;BEGIN
 ctx:=helpdesk_auth.hdnr_context(target);a:=(ctx->>'accountId')::uuid;
 PERFORM 1 FROM helpdesk_auth.workspace_memberships WHERE(workspace_id,principal_id,role,active)=(w,who,'admin',true) FOR SHARE;
 IF NOT FOUND OR NOT helpdesk_auth.hdnr_operator(w,a,target,who) THEN RAISE EXCEPTION 'Current delivery operations authority required' USING ERRCODE='HDR01';END IF;
 SELECT coalesce(jsonb_agg(item ORDER BY updated_at DESC,id),'[]'::jsonb) INTO rows FROM(
  SELECT id,helpdesk_auth.hdn_notification_stamp(record->>'updatedAt') updated_at,jsonb_build_object('id',id,'kind',intent->'kind','state',record->'state','attempts',record->'attempts','attention',record->'attention','updatedAt',record->'updatedAt','nextAttemptAt',record->'nextAttemptAt','reason',record->'lastReason') item
  FROM helpdesk_integration.hdn_notification_records WHERE(workspace_id,account_id,ticket_id)=(w,a,target) ORDER BY helpdesk_auth.hdn_notification_stamp(record->>'updatedAt') DESC,id LIMIT 20) recent;
 RETURN jsonb_build_object('ticketId',target,'workspaceId',w,'accountId',a,'items',rows,'limit',20,'resendAvailable',false);
END$$;
DO $private$ DECLARE role_name text;BEGIN
 REVOKE ALL ON FUNCTION helpdesk_auth.hdnr_view_capability(uuid,text,jsonb),helpdesk_auth.hdnr_view(uuid),helpdesk_auth.hdnr_landing(uuid),helpdesk_auth.hdn_notification_attention(uuid) FROM PUBLIC;
 FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdnr_view_capability(uuid,text,jsonb),helpdesk_auth.hdnr_view(uuid),helpdesk_auth.hdnr_landing(uuid),helpdesk_auth.hdn_notification_attention(uuid) FROM %I',role_name);END IF;
 END LOOP;
 GRANT EXECUTE ON FUNCTION helpdesk_auth.hdnr_view(uuid),helpdesk_auth.hdnr_landing(uuid),helpdesk_auth.hdn_notification_attention(uuid) TO helpdesk_app;
END $private$;
