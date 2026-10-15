-- Explicit renewal of unusable invitations and dark-group planning recovery.
-- Historical receipts remain immutable; no GET writes or first-wave fallback.
CREATE OR REPLACE FUNCTION helpdesk_auth.hdn_notification_routing(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE facts jsonb;src jsonb;route helpdesk_integration.hdn_notification_routes%rowtype;t helpdesk_integration.hdn_notification_templates%rowtype;
 roster helpdesk_integration.hdn_notification_queue_rosters%rowtype;people uuid[]:='{}';person uuid;recipients jsonb:='[]';BEGIN
 PERFORM helpdesk_auth.hdn_notification_worker();facts:=helpdesk_auth.hdn_notification_facts(target);src:=facts->'source';
 SELECT * INTO route FROM helpdesk_integration.hdn_notification_routes WHERE workspace_id=(src->>'workspaceId')::uuid AND kind=src->>'type' ORDER BY revision DESC LIMIT 1 FOR SHARE;
 IF NOT FOUND THEN
  IF src->>'type' NOT IN ('support.transition','support.reply','support.handoff','support.closed','support.reopened','support.cancelled','internal.queue_created','internal.assignment_changed','support.customer_reply','support.form_revised','support.approval_requested','support.approval_granted','support.approval_rejected') THEN RAISE EXCEPTION 'Published routing required' USING ERRCODE='HDN05';END IF;
  -- A not-yet-prepared new group has no authority or recipients. Seal the
  -- historical source once, so the existing first-wave worker can continue.
  RETURN jsonb_build_object('eventId',target,'workspaceId',src->'workspaceId','accountId',src->'accountId','ticketId',src->'ticketId','sourceVersion',src->'version','kind',src->'type','protocol',facts->'protocol','resourceHash',facts->'resourceHash','revision','unprepared-wave2-v1','status','published','expiresAt',src->'createdAt','recipients','[]'::jsonb);
 END IF;

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


CREATE OR REPLACE FUNCTION helpdesk_auth.hdnr_commit_invitation(bundle jsonb,receipt jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();target uuid;ctx jsonb;a jsonb;route jsonb;i jsonb:=bundle->'invitation';audit_doc jsonb:=bundle->'audit';outbox_doc jsonb:=bundle->'outbox';result jsonb;expected_i jsonb;expected_audit jsonb;expected_outbox jsonb;
 account uuid;invitation_uuid uuid;effect_uuid uuid;request_uuid uuid;at_text text;stamp timestamptz;intent_hash text;prior helpdesk_audit.hdnr_receipts%rowtype;affected integer;old_pending jsonb;BEGIN
 IF NOT coalesce(helpdesk_auth.hdn_cfg_object(bundle,ARRAY['invitation','audit','outbox']) AND helpdesk_auth.hdn_cfg_object(receipt,ARRAY['key','hash','result']),false)
  OR receipt->>'key' IS NULL OR receipt->>'key'!~'^[A-Za-z0-9._:-]{16,128}$' THEN RAISE EXCEPTION 'Invalid invitation command' USING ERRCODE='HDR03';END IF;
 target:=(receipt->'result'->>'ticketId')::uuid;ctx:=helpdesk_auth.hdnr_context(target);PERFORM helpdesk_auth.hdnr_grant(target,'approvals.request',ctx);a:=helpdesk_auth.hdnr_aggregate(target)->'aggregate';account:=(a->'ticket'->>'accountId')::uuid;
 intent_hash:=helpdesk_auth.hdni_digest(jsonb_build_object('ticketId',target,'expected',a->'ticket'->'version','actorId',who,'workspaceId',w));
 SELECT * INTO prior FROM helpdesk_audit.hdnr_receipts WHERE(workspace_id,actor_id,intent_key)=(w,who,receipt->>'key') FOR UPDATE;
 IF FOUND THEN IF prior.action<>'invitation' OR prior.intent_hash IS DISTINCT FROM receipt->>'hash' THEN RAISE EXCEPTION 'Review idempotency conflict' USING ERRCODE='HDR04';END IF;RETURN prior.result;END IF;
 IF receipt->>'hash' IS DISTINCT FROM intent_hash OR a->'ticket'->>'approval'<>'pending' OR a->'ticket'->>'status' NOT IN ('new','triage') OR a->'profile'->'approvalRequired' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Invitation target changed' USING ERRCODE='HDR02';END IF;
 route:=helpdesk_auth.hdnr_route(target,ctx);
 SELECT document INTO old_pending FROM helpdesk_core.hdnr_invitations WHERE workspace_id=w AND account_id=account AND ticket_id=target AND document->>'status'='pending' FOR UPDATE;
 IF old_pending IS NOT NULL AND coalesce(old_pending->'ticketVersion'=a->'ticket'->'version' AND old_pending->'formRevision'=a->'form'->'revision' AND old_pending->>'targetHash'=helpdesk_auth.hdnr_target_hash(a) AND old_pending->'approverId'=route->'principalId' AND old_pending->'policyVersionId'=a->'approvalPolicy'->'versionId' AND helpdesk_auth.hdn_notification_stamp(old_pending->>'expiresAt')>clock_timestamp(),false) THEN RAISE EXCEPTION 'An invitation is already pending' USING ERRCODE='HDR03';END IF;
 route:=helpdesk_auth.hdnr_route(target,ctx);invitation_uuid:=(i->>'id')::uuid;effect_uuid:=(audit_doc->>'id')::uuid;request_uuid:=(audit_doc->>'requestId')::uuid;at_text:=audit_doc->>'at';stamp:=helpdesk_auth.hdn_notification_stamp(at_text);
 IF i->>'id'!~'^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR effect_uuid=invitation_uuid OR stamp>clock_timestamp() OR stamp<clock_timestamp()-interval '30 seconds' OR stamp<helpdesk_auth.hdn_notification_stamp(a->'ticket'->>'lastEventAt') THEN RAISE EXCEPTION 'Invalid invitation identity or time' USING ERRCODE='HDR03';END IF;
 expected_i:=jsonb_build_object('id',invitation_uuid,'ticketId',target,'workspaceId',w,'accountId',account,'approverId',route->'principalId','policyVersionId',a->'approvalPolicy'->'versionId','ticketVersion',a->'ticket'->'version','formRevision',a->'form'->'revision','targetHash',helpdesk_auth.hdnr_target_hash(a),'status','pending','createdAt',at_text,'expiresAt',route->'expiresAt','challenge',NULL);
 expected_audit:=jsonb_build_object('id',effect_uuid,'actorId',who,'ticketId',target,'invitationId',invitation_uuid,'requestId',request_uuid,'type','approval.requested','rosterRevision',route->'revision','at',at_text);
 expected_outbox:=jsonb_build_object('id',effect_uuid,'workspaceId',w,'accountId',account,'ticketId',target,'type','support.approval_requested','invitationId',invitation_uuid,'version',a->'ticket'->'version','requestId',request_uuid,'createdAt',at_text);
 result:=jsonb_build_object('ticketId',target,'workspaceId',w,'accountId',account,'actorId',who,'invitationId',invitation_uuid,'ticketVersion',a->'ticket'->'version','formRevision',a->'form'->'revision','notification','pending','replayed',false);
 IF i IS DISTINCT FROM expected_i OR audit_doc IS DISTINCT FROM expected_audit OR outbox_doc IS DISTINCT FROM expected_outbox OR receipt->'result' IS DISTINCT FROM result THEN RAISE EXCEPTION 'Invitation bundle is not the pinned command' USING ERRCODE='HDR02';END IF;
 INSERT INTO helpdesk_audit.hdnr_receipts(id,workspace_id,account_id,ticket_id,actor_id,intent_key,intent_hash,action,invitation_id,result,bundle,scope,request_id,created_at) VALUES(effect_uuid,w,account,target,who,receipt->>'key',intent_hash,'invitation',invitation_uuid,result,bundle,ctx,request_uuid,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Invitation receipt suppressed' USING ERRCODE='HDR03';END IF;

 IF old_pending IS NOT NULL THEN
  UPDATE helpdesk_core.hdnr_invitations SET document=document||jsonb_build_object('status','revoked'),revision=revision+1 WHERE workspace_id=w AND account_id=account AND ticket_id=target AND document=old_pending AND document->>'status'='pending';
  GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Replacement revocation incomplete' USING ERRCODE='HDR03';END IF;
 END IF;
 INSERT INTO helpdesk_core.hdnr_invitations(id,workspace_id,account_id,ticket_id,receipt_id,document) VALUES(invitation_uuid,w,account,target,effect_uuid,expected_i);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Invitation suppressed' USING ERRCODE='HDR03';END IF;
 INSERT INTO helpdesk_audit.audit_events(workspace_id,id,principal_id,action,resource_id,request_id,created_at) VALUES(w,effect_uuid,who,'approval.requested',target,request_uuid::text,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Invitation audit suppressed' USING ERRCODE='HDR03';END IF;
 INSERT INTO helpdesk_integration.hdnr_sources(id,workspace_id,account_id,ticket_id,receipt_id,kind,source_version,invitation_id,request_id,created_at) VALUES(effect_uuid,w,account,target,effect_uuid,'support.approval_requested',(a->'ticket'->>'version')::integer,invitation_uuid,request_uuid,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Invitation source suppressed' USING ERRCODE='HDR03';END IF;
 RETURN result;
EXCEPTION WHEN data_exception OR no_data_found THEN RAISE EXCEPTION 'Invalid invitation command' USING ERRCODE='HDR03';END$$;


CREATE OR REPLACE FUNCTION helpdesk_auth.hdnr_invitation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r helpdesk_audit.hdnr_receipts%rowtype;c helpdesk_audit.hdnr_challenges%rowtype;a jsonb;route jsonb;BEGIN
 IF session_user<>'helpdesk_app' OR NOT coalesce(helpdesk_auth.is_human(),false) OR TG_OP='DELETE' THEN RAISE EXCEPTION 'Human qualified invitation command required' USING ERRCODE='HDR03';END IF;
 IF TG_OP='INSERT' THEN
  SELECT * INTO STRICT r FROM helpdesk_audit.hdnr_receipts WHERE(id,workspace_id,account_id,ticket_id,action,transaction_id)=(NEW.receipt_id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,'invitation',pg_current_xact_id());
  IF r.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() OR r.invitation_id<>NEW.id OR r.bundle->'invitation' IS DISTINCT FROM NEW.document OR NEW.revision<>1 THEN RAISE EXCEPTION 'Unqualified invitation insertion' USING ERRCODE='HDR03';END IF;RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.receipt_id) IS NOT DISTINCT FROM (OLD.id,OLD.workspace_id,OLD.account_id,OLD.ticket_id,OLD.receipt_id)
  AND NEW.revision=OLD.revision+1 AND OLD.document->>'status'='pending' AND NEW.document=OLD.document||jsonb_build_object('status','revoked') THEN
  SELECT * INTO r FROM helpdesk_audit.hdnr_receipts WHERE(workspace_id,account_id,ticket_id,actor_id,action,transaction_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,helpdesk_auth.actor_id(),'invitation',pg_current_xact_id());
  IF FOUND THEN
   PERFORM helpdesk_auth.hdnr_grant(NEW.ticket_id,'approvals.request',r.scope);
   a:=helpdesk_auth.hdnr_aggregate(NEW.ticket_id)->'aggregate';route:=helpdesk_auth.hdnr_route(NEW.ticket_id,r.scope);
   IF r.invitation_id=OLD.id OR r.bundle->'invitation'->'id'<>to_jsonb(r.invitation_id) OR NOT coalesce((r.bundle->'invitation')->'ticketVersion'=a->'ticket'->'version' AND (r.bundle->'invitation')->'formRevision'=a->'form'->'revision' AND (r.bundle->'invitation')->>'targetHash'=helpdesk_auth.hdnr_target_hash(a) AND (r.bundle->'invitation')->'approverId'=route->'principalId' AND (r.bundle->'invitation')->'policyVersionId'=a->'approvalPolicy'->'versionId' AND helpdesk_auth.hdn_notification_stamp((r.bundle->'invitation')->>'expiresAt')>clock_timestamp(),false) OR coalesce(OLD.document->'ticketVersion'=a->'ticket'->'version' AND OLD.document->'formRevision'=a->'form'->'revision' AND OLD.document->>'targetHash'=helpdesk_auth.hdnr_target_hash(a) AND OLD.document->'approverId'=route->'principalId' AND OLD.document->'policyVersionId'=a->'approvalPolicy'->'versionId' AND helpdesk_auth.hdn_notification_stamp(OLD.document->>'expiresAt')>clock_timestamp(),false) THEN RAISE EXCEPTION 'Current explicit replacement required' USING ERRCODE='HDR02';END IF;
   RETURN NEW;
  END IF;
  SELECT * INTO STRICT r FROM helpdesk_audit.hdnr_receipts WHERE(workspace_id,account_id,ticket_id,actor_id,action,transaction_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,helpdesk_auth.actor_id(),'revision',pg_current_xact_id());
  IF NOT coalesce((r.bundle->>'expectedVersion')::integer>=(OLD.document->>'ticketVersion')::integer AND r.bundle->'expectedFormRevision'=OLD.document->'formRevision' AND r.result->'formRevision'=to_jsonb((OLD.document->>'formRevision')::integer+1),false) THEN RAISE EXCEPTION 'Revision invitation target changed' USING ERRCODE='HDR02';END IF;RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.receipt_id) IS NOT DISTINCT FROM (OLD.id,OLD.workspace_id,OLD.account_id,OLD.ticket_id,OLD.receipt_id)
  AND NEW.revision=OLD.revision+1 AND OLD.document->>'status'='pending' AND NEW.document=OLD.document||jsonb_build_object('status','used') AND OLD.document->>'approverId'=helpdesk_auth.actor_id()::text THEN
  SELECT * INTO STRICT r FROM helpdesk_audit.hdnr_receipts WHERE(workspace_id,account_id,ticket_id,invitation_id,actor_id,action,transaction_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id,helpdesk_auth.actor_id(),'approval',pg_current_xact_id());
  IF r.bundle->'decision'->'challengeGeneration' IS DISTINCT FROM OLD.document->'challenge'->'generation' OR r.result->'version' IS DISTINCT FROM to_jsonb((OLD.document->>'ticketVersion')::integer+1) OR r.result->'formRevision' IS DISTINCT FROM OLD.document->'formRevision' THEN RAISE EXCEPTION 'Approval invitation consumption changed' USING ERRCODE='HDR02';END IF;RETURN NEW;
 END IF;
 IF (NEW.id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.receipt_id) IS DISTINCT FROM (OLD.id,OLD.workspace_id,OLD.account_id,OLD.ticket_id,OLD.receipt_id) OR NEW.revision<>OLD.revision+1
  OR OLD.document->>'status'<>'pending' OR NEW.document-'challenge' IS DISTINCT FROM OLD.document-'challenge' OR NEW.document->>'approverId' IS DISTINCT FROM helpdesk_auth.actor_id()::text
 THEN RAISE EXCEPTION 'Invitation identity or command changed' USING ERRCODE='HDR02';END IF;
 SELECT * INTO STRICT c FROM helpdesk_audit.hdnr_challenges WHERE(workspace_id,account_id,ticket_id,invitation_id,generation,actor_id,transaction_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id,(NEW.document->'challenge'->>'generation')::integer,helpdesk_auth.actor_id(),pg_current_xact_id());
 IF c.generation<>coalesce((OLD.document->'challenge'->>'generation')::integer,0)+1 OR c.challenge_hash IS DISTINCT FROM NEW.document->'challenge'->>'hash'
  OR c.target_hash IS DISTINCT FROM NEW.document->>'targetHash' OR c.expires_at<>helpdesk_auth.hdn_notification_stamp(NEW.document->'challenge'->>'expiresAt') OR c.expires_at<=clock_timestamp()
 THEN RAISE EXCEPTION 'Qualified current challenge required' USING ERRCODE='HDR02';END IF;RETURN NEW;
EXCEPTION WHEN no_data_found OR data_exception THEN RAISE EXCEPTION 'Invitation proof required' USING ERRCODE='HDR03';END$$;


CREATE OR REPLACE FUNCTION helpdesk_auth.hdnr_view(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();ctx jsonb;a jsonb;ticket jsonb;definition jsonb;fields jsonb;invite helpdesk_core.hdnr_invitations%rowtype;
 decision_row helpdesk_audit.hdnr_receipts%rowtype;invitation_id uuid;request_allowed boolean;decide_allowed boolean;revise_allowed boolean;last_decision jsonb:='null';route jsonb;BEGIN
 ctx:=helpdesk_auth.hdnr_context(target);
 IF NOT EXISTS(SELECT 1 FROM helpdesk_core.hdni_snapshots s JOIN helpdesk_core.hdnr_profiles p ON(p.workspace_id,p.account_id,p.profile_version_id)=(s.workspace_id,s.account_id,s.document->'profile'->>'profileVersionId') WHERE(s.workspace_id,s.ticket_id)=(w,target)) THEN RETURN NULL;END IF;
 a:=helpdesk_auth.hdnr_aggregate(target)->'aggregate';ticket:=a->'ticket';
 SELECT jsonb_agg(field ORDER BY ordinal) INTO fields FROM jsonb_array_elements(a->'profile'->'form'->'fields') WITH ORDINALITY x(field,ordinal) WHERE field->'public'='true'::jsonb;
 definition:=a->'profile'->'form'||jsonb_build_object('fields',coalesce(fields,'[]'::jsonb));
 request_allowed:=helpdesk_auth.hdnr_view_capability(target,'approvals.request',ctx);decide_allowed:=helpdesk_auth.hdnr_view_capability(target,'approvals.decide',ctx);revise_allowed:=helpdesk_auth.hdnr_view_capability(target,'forms.revise',ctx);
 SELECT * INTO invite FROM helpdesk_core.hdnr_invitations WHERE(workspace_id,account_id,ticket_id)=(w,(ticket->>'accountId')::uuid,target) AND document->>'status'='pending' ORDER BY id LIMIT 1;
 request_allowed:=request_allowed AND ticket->>'status' IN ('new','triage') AND ticket->>'approval'='pending' AND a->'profile'->'approvalRequired'='true'::jsonb;
 IF request_allowed THEN
  BEGIN
   route:=helpdesk_auth.hdnr_route(target,ctx);
   IF invite.id IS NOT NULL AND coalesce(invite.document->'ticketVersion'=a->'ticket'->'version' AND invite.document->'formRevision'=a->'form'->'revision' AND invite.document->>'targetHash'=helpdesk_auth.hdnr_target_hash(a) AND invite.document->'approverId'=route->'principalId' AND invite.document->'policyVersionId'=a->'approvalPolicy'->'versionId' AND helpdesk_auth.hdn_notification_stamp(invite.document->>'expiresAt')>clock_timestamp(),false) THEN request_allowed:=false;END IF;
  EXCEPTION WHEN SQLSTATE 'HDR01' OR SQLSTATE 'HDR05' OR SQLSTATE 'HDR03' THEN request_allowed:=false;END;
 END IF;
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

