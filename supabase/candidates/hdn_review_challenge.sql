CREATE OR REPLACE FUNCTION helpdesk_auth.hdnr_invitation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r helpdesk_audit.hdnr_receipts%rowtype;c helpdesk_audit.hdnr_challenges%rowtype;BEGIN
 IF session_user<>'helpdesk_app' OR NOT coalesce(helpdesk_auth.is_human(),false) OR TG_OP='DELETE' THEN RAISE EXCEPTION 'Human qualified invitation command required' USING ERRCODE='HDR03';END IF;
 IF TG_OP='INSERT' THEN
  SELECT * INTO STRICT r FROM helpdesk_audit.hdnr_receipts WHERE(id,workspace_id,account_id,ticket_id,action,transaction_id)=(NEW.receipt_id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,'invitation',pg_current_xact_id());
  IF r.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() OR r.invitation_id<>NEW.id OR r.bundle->'invitation' IS DISTINCT FROM NEW.document OR NEW.revision<>1 THEN RAISE EXCEPTION 'Unqualified invitation insertion' USING ERRCODE='HDR03';END IF;RETURN NEW;
 END IF;
 IF (NEW.id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.receipt_id) IS DISTINCT FROM (OLD.id,OLD.workspace_id,OLD.account_id,OLD.ticket_id,OLD.receipt_id) OR NEW.revision<>OLD.revision+1
  OR OLD.document->>'status'<>'pending' OR NEW.document-'challenge' IS DISTINCT FROM OLD.document-'challenge' OR NEW.document->>'approverId' IS DISTINCT FROM helpdesk_auth.actor_id()::text
 THEN RAISE EXCEPTION 'Invitation identity or command changed' USING ERRCODE='HDR02';END IF;
 SELECT * INTO STRICT c FROM helpdesk_audit.hdnr_challenges WHERE(workspace_id,account_id,ticket_id,invitation_id,generation,actor_id,transaction_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id,(NEW.document->'challenge'->>'generation')::integer,helpdesk_auth.actor_id(),pg_current_xact_id());
 IF c.generation<>coalesce((OLD.document->'challenge'->>'generation')::integer,0)+1 OR c.challenge_hash IS DISTINCT FROM NEW.document->'challenge'->>'hash'
  OR c.target_hash IS DISTINCT FROM NEW.document->>'targetHash' OR c.expires_at<>helpdesk_auth.hdn_notification_stamp(NEW.document->'challenge'->>'expiresAt') OR c.expires_at<=clock_timestamp()
 THEN RAISE EXCEPTION 'Qualified current challenge required' USING ERRCODE='HDR02';END IF;RETURN NEW;
EXCEPTION WHEN no_data_found OR data_exception THEN RAISE EXCEPTION 'Invitation proof required' USING ERRCODE='HDR03';END$$;
CREATE FUNCTION helpdesk_auth.hdnr_challenge(proposed jsonb,expected integer) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE row helpdesk_core.hdnr_invitations%rowtype;a jsonb;q jsonb:=proposed->'challenge';ctx jsonb;now_stamp timestamptz:=clock_timestamp();until_stamp timestamptz;affected integer;BEGIN
 SELECT * INTO row FROM helpdesk_core.hdnr_invitations WHERE workspace_id=helpdesk_auth.workspace_id() AND id=(proposed->>'id')::uuid FOR UPDATE;
 IF NOT FOUND OR row.document->>'approverId' IS DISTINCT FROM helpdesk_auth.actor_id()::text THEN RAISE EXCEPTION 'Invitation belongs to another person' USING ERRCODE='HDR01';END IF;
 ctx:=helpdesk_auth.hdnr_context(row.ticket_id);PERFORM helpdesk_auth.hdnr_grant(row.ticket_id,'approvals.decide',ctx);a:=helpdesk_auth.hdnr_aggregate(row.ticket_id)->'aggregate';
 IF row.document->>'status'<>'pending' OR a->'ticket'->>'approval'<>'pending' OR a->'ticket'->>'status' NOT IN ('new','triage') OR row.document->'ticketVersion' IS DISTINCT FROM a->'ticket'->'version'
  OR row.document->'formRevision' IS DISTINCT FROM a->'form'->'revision' OR row.document->>'targetHash' IS DISTINCT FROM helpdesk_auth.hdnr_target_hash(a)
  OR row.document->'policyVersionId' IS DISTINCT FROM a->'approvalPolicy'->'versionId' OR row.document->>'approverId' IN (a->>'requesterId',a->'ticket'->>'createdBy')
  OR helpdesk_auth.hdn_notification_stamp(row.document->>'createdAt')>now_stamp OR helpdesk_auth.hdn_notification_stamp(row.document->>'expiresAt')<=now_stamp
 THEN RAISE EXCEPTION 'Invitation target changed or expired' USING ERRCODE='HDR02';END IF;
 IF expected IS NULL OR expected NOT BETWEEN 0 AND 2147483646 OR expected<>coalesce((row.document->'challenge'->>'generation')::integer,0)
  OR proposed-'challenge' IS DISTINCT FROM row.document-'challenge' OR NOT coalesce(helpdesk_auth.hdn_cfg_object(q,ARRAY['hash','generation','expiresAt']),false)
  OR jsonb_typeof(q->'hash') IS DISTINCT FROM 'string' OR q->>'hash'!~'^[a-f0-9]{64}$' OR q->'generation' IS DISTINCT FROM to_jsonb(expected+1)
 THEN RAISE EXCEPTION 'Challenge generation changed' USING ERRCODE='HDR02';END IF;
 until_stamp:=helpdesk_auth.hdn_notification_stamp(q->>'expiresAt');
 IF until_stamp<=now_stamp OR until_stamp>least(helpdesk_auth.hdn_notification_stamp(row.document->>'expiresAt'),now_stamp+interval '300 seconds') THEN RAISE EXCEPTION 'Challenge expiry invalid' USING ERRCODE='HDR02';END IF;
 INSERT INTO helpdesk_audit.hdnr_challenges(workspace_id,account_id,ticket_id,invitation_id,generation,actor_id,challenge_hash,expires_at,created_at,target_hash) VALUES(row.workspace_id,row.account_id,row.ticket_id,row.id,expected+1,helpdesk_auth.actor_id(),q->>'hash',until_stamp,now_stamp,row.document->>'targetHash');
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Challenge proof suppressed' USING ERRCODE='HDR03';END IF;
 UPDATE helpdesk_core.hdnr_invitations SET document=proposed,revision=revision+1 WHERE id=row.id AND workspace_id=row.workspace_id AND revision=row.revision;
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Challenge update suppressed' USING ERRCODE='HDR02';END IF;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_core.hdnr_invitations WHERE id=row.id AND document=proposed AND revision=row.revision+1) THEN RAISE EXCEPTION 'Challenge persistence changed' USING ERRCODE='HDR03';END IF;
 RETURN proposed;
EXCEPTION WHEN data_exception THEN RAISE EXCEPTION 'Invalid private challenge' USING ERRCODE='HDR03';END$$;
CREATE FUNCTION helpdesk_auth.hdnr_challenge_complete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE row helpdesk_core.hdnr_invitations%rowtype;a jsonb;BEGIN
 IF session_user<>'helpdesk_app' OR NEW.transaction_id<>pg_current_xact_id() OR NEW.workspace_id IS DISTINCT FROM helpdesk_auth.workspace_id() OR NEW.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() OR NEW.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Current challenge command required' USING ERRCODE='HDR03';END IF;
 PERFORM helpdesk_auth.hdnr_grant(NEW.ticket_id,'approvals.decide',helpdesk_auth.hdnr_context(NEW.ticket_id));
 SELECT * INTO STRICT row FROM helpdesk_core.hdnr_invitations WHERE(workspace_id,account_id,ticket_id,id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.invitation_id);
 a:=helpdesk_auth.hdnr_aggregate(NEW.ticket_id)->'aggregate';
 IF row.document->>'status'<>'pending' OR row.document->>'approverId'<>NEW.actor_id::text OR row.document->>'targetHash'<>NEW.target_hash OR NEW.target_hash<>helpdesk_auth.hdnr_target_hash(a)
  OR row.document->'challenge' IS DISTINCT FROM jsonb_build_object('hash',NEW.challenge_hash,'generation',NEW.generation,'expiresAt',row.document->'challenge'->'expiresAt')
  OR helpdesk_auth.hdn_notification_stamp(row.document->'challenge'->>'expiresAt')<>NEW.expires_at THEN RAISE EXCEPTION 'Challenge effects incomplete' USING ERRCODE='HDR03';END IF;RETURN NULL;
EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'Challenge invitation missing' USING ERRCODE='HDR03';END$$;
CREATE CONSTRAINT TRIGGER hdnr_challenge_complete AFTER INSERT ON helpdesk_audit.hdnr_challenges DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdnr_challenge_complete();
DO $private$ DECLARE role_name text;BEGIN
 REVOKE ALL ON FUNCTION helpdesk_auth.hdnr_challenge(jsonb,integer),helpdesk_auth.hdnr_challenge_complete() FROM PUBLIC;
 FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdnr_challenge(jsonb,integer),helpdesk_auth.hdnr_challenge_complete() FROM %I',role_name);END IF;
 END LOOP;
 GRANT EXECUTE ON FUNCTION helpdesk_auth.hdnr_challenge(jsonb,integer) TO helpdesk_app;
END $private$;
