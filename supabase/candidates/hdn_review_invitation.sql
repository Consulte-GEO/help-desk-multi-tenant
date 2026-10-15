CREATE FUNCTION helpdesk_auth.hdnr_context(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb;BEGIN
 IF session_user<>'helpdesk_app' OR NOT coalesce(helpdesk_auth.is_human(),false) OR NOT coalesce(helpdesk_auth.has_scope(helpdesk_auth.workspace_id(),'tickets:read'),false) OR NOT coalesce(helpdesk_auth.has_scope(helpdesk_auth.workspace_id(),'tickets:write'),false) THEN RAISE EXCEPTION 'Human review session required' USING ERRCODE='HDR01';END IF;
 ctx:=helpdesk_auth.cg_lock_ticket_scope(target,'tickets.write')-'ticketId';
 IF ctx IS NULL THEN RAISE EXCEPTION 'Current review work access required' USING ERRCODE='HDR01';END IF;
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);RETURN ctx;
END$$;
CREATE FUNCTION helpdesk_auth.hdnr_invitation_receipt(key text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE row helpdesk_audit.hdnr_receipts%rowtype;BEGIN
 IF session_user<>'helpdesk_app' OR NOT coalesce(helpdesk_auth.is_human(),false) OR key IS NULL OR key!~'^[A-Za-z0-9._:-]{16,128}$' THEN RAISE EXCEPTION 'Invalid private receipt lookup' USING ERRCODE='HDR01';END IF;
 SELECT * INTO row FROM helpdesk_audit.hdnr_receipts WHERE(workspace_id,actor_id,intent_key)=(helpdesk_auth.workspace_id(),helpdesk_auth.actor_id(),key) FOR SHARE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 PERFORM helpdesk_auth.hdnr_grant(row.ticket_id,'approvals.request',helpdesk_auth.hdnr_context(row.ticket_id));
 IF row.action<>'invitation' THEN RAISE EXCEPTION 'Review intent key belongs to another action' USING ERRCODE='HDR04';END IF;
 RETURN jsonb_build_object('key',row.intent_key,'hash',row.intent_hash,'result',row.result);
END$$;
CREATE FUNCTION helpdesk_auth.hdnr_pending_invitation(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;BEGIN
 PERFORM helpdesk_auth.hdnr_grant(target,'approvals.request',helpdesk_auth.hdnr_context(target));
 SELECT document INTO result FROM helpdesk_core.hdnr_invitations WHERE workspace_id=helpdesk_auth.workspace_id() AND ticket_id=target AND document->>'status'='pending' FOR UPDATE;RETURN result;
END$$;
CREATE FUNCTION helpdesk_auth.hdnr_invitation(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE row helpdesk_core.hdnr_invitations%rowtype;BEGIN
 IF session_user<>'helpdesk_app' OR NOT coalesce(helpdesk_auth.is_human(),false) THEN RAISE EXCEPTION 'Human approval session required' USING ERRCODE='HDR01';END IF;
 SELECT * INTO row FROM helpdesk_core.hdnr_invitations WHERE workspace_id=helpdesk_auth.workspace_id() AND id=target FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF row.document->>'approverId' IS DISTINCT FROM helpdesk_auth.actor_id()::text THEN RAISE EXCEPTION 'Invitation belongs to another person' USING ERRCODE='HDR01';END IF;
 PERFORM helpdesk_auth.hdnr_grant(row.ticket_id,'approvals.decide',helpdesk_auth.hdnr_context(row.ticket_id));RETURN row.document;
END$$;
CREATE FUNCTION helpdesk_auth.hdnr_commit_invitation(bundle jsonb,receipt jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();target uuid;ctx jsonb;a jsonb;route jsonb;i jsonb:=bundle->'invitation';audit_doc jsonb:=bundle->'audit';outbox_doc jsonb:=bundle->'outbox';result jsonb;expected_i jsonb;expected_audit jsonb;expected_outbox jsonb;
 account uuid;invitation_uuid uuid;effect_uuid uuid;request_uuid uuid;at_text text;stamp timestamptz;intent_hash text;prior helpdesk_audit.hdnr_receipts%rowtype;affected integer;BEGIN
 IF NOT coalesce(helpdesk_auth.hdn_cfg_object(bundle,ARRAY['invitation','audit','outbox']) AND helpdesk_auth.hdn_cfg_object(receipt,ARRAY['key','hash','result']),false)
  OR receipt->>'key' IS NULL OR receipt->>'key'!~'^[A-Za-z0-9._:-]{16,128}$' THEN RAISE EXCEPTION 'Invalid invitation command' USING ERRCODE='HDR03';END IF;
 target:=(receipt->'result'->>'ticketId')::uuid;ctx:=helpdesk_auth.hdnr_context(target);PERFORM helpdesk_auth.hdnr_grant(target,'approvals.request',ctx);a:=helpdesk_auth.hdnr_aggregate(target)->'aggregate';account:=(a->'ticket'->>'accountId')::uuid;
 intent_hash:=helpdesk_auth.hdni_digest(jsonb_build_object('ticketId',target,'expected',a->'ticket'->'version','actorId',who,'workspaceId',w));
 SELECT * INTO prior FROM helpdesk_audit.hdnr_receipts WHERE(workspace_id,actor_id,intent_key)=(w,who,receipt->>'key') FOR UPDATE;
 IF FOUND THEN IF prior.action<>'invitation' OR prior.intent_hash IS DISTINCT FROM receipt->>'hash' THEN RAISE EXCEPTION 'Review idempotency conflict' USING ERRCODE='HDR04';END IF;RETURN prior.result;END IF;
 IF receipt->>'hash' IS DISTINCT FROM intent_hash OR a->'ticket'->>'approval'<>'pending' OR a->'ticket'->>'status' NOT IN ('new','triage') OR a->'profile'->'approvalRequired' IS DISTINCT FROM 'true'::jsonb THEN RAISE EXCEPTION 'Invitation target changed' USING ERRCODE='HDR02';END IF;
 IF EXISTS(SELECT 1 FROM helpdesk_core.hdnr_invitations WHERE workspace_id=w AND ticket_id=target AND document->>'status'='pending') THEN RAISE EXCEPTION 'An invitation is already pending' USING ERRCODE='HDR03';END IF;
 route:=helpdesk_auth.hdnr_route(target,ctx);invitation_uuid:=(i->>'id')::uuid;effect_uuid:=(audit_doc->>'id')::uuid;request_uuid:=(audit_doc->>'requestId')::uuid;at_text:=audit_doc->>'at';stamp:=helpdesk_auth.hdn_notification_stamp(at_text);
 IF i->>'id'!~'^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$' OR effect_uuid=invitation_uuid OR stamp>clock_timestamp() OR stamp<clock_timestamp()-interval '30 seconds' OR stamp<helpdesk_auth.hdn_notification_stamp(a->'ticket'->>'lastEventAt') THEN RAISE EXCEPTION 'Invalid invitation identity or time' USING ERRCODE='HDR03';END IF;
 expected_i:=jsonb_build_object('id',invitation_uuid,'ticketId',target,'workspaceId',w,'accountId',account,'approverId',route->'principalId','policyVersionId',a->'approvalPolicy'->'versionId','ticketVersion',a->'ticket'->'version','formRevision',a->'form'->'revision','targetHash',helpdesk_auth.hdnr_target_hash(a),'status','pending','createdAt',at_text,'expiresAt',route->'expiresAt','challenge',NULL);
 expected_audit:=jsonb_build_object('id',effect_uuid,'actorId',who,'ticketId',target,'invitationId',invitation_uuid,'requestId',request_uuid,'type','approval.requested','rosterRevision',route->'revision','at',at_text);
 expected_outbox:=jsonb_build_object('id',effect_uuid,'workspaceId',w,'accountId',account,'ticketId',target,'type','support.approval_requested','invitationId',invitation_uuid,'version',a->'ticket'->'version','requestId',request_uuid,'createdAt',at_text);
 result:=jsonb_build_object('ticketId',target,'workspaceId',w,'accountId',account,'actorId',who,'invitationId',invitation_uuid,'ticketVersion',a->'ticket'->'version','formRevision',a->'form'->'revision','notification','pending','replayed',false);
 IF i IS DISTINCT FROM expected_i OR audit_doc IS DISTINCT FROM expected_audit OR outbox_doc IS DISTINCT FROM expected_outbox OR receipt->'result' IS DISTINCT FROM result THEN RAISE EXCEPTION 'Invitation bundle is not the pinned command' USING ERRCODE='HDR02';END IF;
 INSERT INTO helpdesk_audit.hdnr_receipts(id,workspace_id,account_id,ticket_id,actor_id,intent_key,intent_hash,action,invitation_id,result,bundle,scope,request_id,created_at) VALUES(effect_uuid,w,account,target,who,receipt->>'key',intent_hash,'invitation',invitation_uuid,result,bundle,ctx,request_uuid,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Invitation receipt suppressed' USING ERRCODE='HDR03';END IF;
 INSERT INTO helpdesk_core.hdnr_invitations(id,workspace_id,account_id,ticket_id,receipt_id,document) VALUES(invitation_uuid,w,account,target,effect_uuid,expected_i);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Invitation suppressed' USING ERRCODE='HDR03';END IF;
 INSERT INTO helpdesk_audit.audit_events(workspace_id,id,principal_id,action,resource_id,request_id,created_at) VALUES(w,effect_uuid,who,'approval.requested',target,request_uuid::text,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Invitation audit suppressed' USING ERRCODE='HDR03';END IF;
 INSERT INTO helpdesk_integration.hdnr_sources(id,workspace_id,account_id,ticket_id,receipt_id,kind,source_version,invitation_id,request_id,created_at) VALUES(effect_uuid,w,account,target,effect_uuid,'support.approval_requested',(a->'ticket'->>'version')::integer,invitation_uuid,request_uuid,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Invitation source suppressed' USING ERRCODE='HDR03';END IF;
 RETURN result;
EXCEPTION WHEN data_exception OR no_data_found THEN RAISE EXCEPTION 'Invalid invitation command' USING ERRCODE='HDR03';END$$;
CREATE FUNCTION helpdesk_auth.hdnr_invitation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r helpdesk_audit.hdnr_receipts%rowtype;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Invitation mutation requires a qualified later command' USING ERRCODE='HDR03';END IF;
 SELECT * INTO STRICT r FROM helpdesk_audit.hdnr_receipts WHERE(id,workspace_id,account_id,ticket_id,action,transaction_id)=(NEW.receipt_id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,'invitation',pg_current_xact_id());
 IF session_user<>'helpdesk_app' OR r.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() OR r.invitation_id<>NEW.id OR r.bundle->'invitation' IS DISTINCT FROM NEW.document OR NEW.revision<>1 THEN RAISE EXCEPTION 'Unqualified invitation insertion' USING ERRCODE='HDR03';END IF;RETURN NEW;
EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'Invitation receipt required' USING ERRCODE='HDR03';END$$;
CREATE TRIGGER hdnr_invitation_guard BEFORE INSERT OR UPDATE OR DELETE ON helpdesk_core.hdnr_invitations FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdnr_invitation_guard();
CREATE FUNCTION helpdesk_auth.hdnr_receipt_complete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source helpdesk_integration.hdnr_sources%rowtype;invitation helpdesk_core.hdnr_invitations%rowtype;BEGIN
 IF session_user<>'helpdesk_app' OR NEW.transaction_id<>pg_current_xact_id() OR NEW.workspace_id IS DISTINCT FROM helpdesk_auth.workspace_id() OR NEW.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() OR NEW.action<>'invitation' THEN RAISE EXCEPTION 'Unqualified review receipt' USING ERRCODE='HDR03';END IF;
 PERFORM helpdesk_auth.hdnr_grant(NEW.ticket_id,'approvals.request',NEW.scope);
 SELECT * INTO STRICT source FROM helpdesk_integration.hdnr_sources WHERE(id,workspace_id,account_id,ticket_id,receipt_id)=(NEW.id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id);
 SELECT * INTO STRICT invitation FROM helpdesk_core.hdnr_invitations WHERE(id,workspace_id,account_id,ticket_id,receipt_id)=(NEW.invitation_id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id);
 IF source.kind<>'support.approval_requested' OR source.invitation_id<>NEW.invitation_id OR source.created_at<>NEW.created_at OR source.request_id<>NEW.request_id
  OR source.source_version<>(NEW.result->>'ticketVersion')::integer OR invitation.document IS DISTINCT FROM NEW.bundle->'invitation'
  OR NOT EXISTS(SELECT 1 FROM helpdesk_audit.audit_events a WHERE(a.workspace_id,a.id,a.principal_id,a.action,a.resource_id,a.request_id,a.created_at)=(NEW.workspace_id,NEW.id,NEW.actor_id,'approval.requested',NEW.ticket_id,NEW.request_id::text,NEW.created_at))
 THEN RAISE EXCEPTION 'Invitation effects incomplete' USING ERRCODE='HDR03';END IF;
 RETURN NULL;
EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'Review receipt effects missing' USING ERRCODE='HDR03';END$$;
CREATE CONSTRAINT TRIGGER hdnr_receipt_complete AFTER INSERT ON helpdesk_audit.hdnr_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdnr_receipt_complete();
DO $private$ DECLARE obj text;role_name text;signature text;BEGIN
 FOREACH obj IN ARRAY ARRAY['helpdesk_core.hdnr_forms','helpdesk_core.hdnr_invitations','helpdesk_audit.hdnr_receipts','helpdesk_integration.hdnr_sources','helpdesk_audit.hdnr_challenges'] LOOP
  EXECUTE 'ALTER TABLE '||obj||' ENABLE ROW LEVEL SECURITY';EXECUTE 'ALTER TABLE '||obj||' FORCE ROW LEVEL SECURITY';
  IF obj<>'helpdesk_core.hdnr_invitations' THEN EXECUTE 'CREATE TRIGGER hdnr_history_immutable BEFORE UPDATE OR DELETE ON '||obj||' FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_notification_immutable()';END IF;
  EXECUTE 'REVOKE ALL ON TABLE '||obj||' FROM PUBLIC';
  FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
   IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I',obj,role_name);END IF;
  END LOOP;
 END LOOP;
 FOREACH signature IN ARRAY ARRAY['hdnr_operator(uuid,uuid,uuid,uuid)','hdnr_scope_hash(jsonb)','hdnr_target_hash(jsonb)','hdnr_context(uuid)','hdnr_aggregate(uuid)','hdnr_grant(uuid,text,jsonb)','hdnr_route(uuid,jsonb)','hdnr_invitation_receipt(text)','hdnr_pending_invitation(uuid)','hdnr_invitation(uuid)','hdnr_commit_invitation(jsonb,jsonb)','hdnr_invitation_guard()','hdnr_receipt_complete()'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION helpdesk_auth.'||signature||' FROM PUBLIC';
  FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
   IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.%s FROM %I',signature,role_name);END IF;
  END LOOP;
 END LOOP;
 GRANT EXECUTE ON FUNCTION helpdesk_auth.hdnr_aggregate(uuid),helpdesk_auth.hdnr_grant(uuid,text,jsonb),helpdesk_auth.hdnr_route(uuid,jsonb),helpdesk_auth.hdnr_invitation_receipt(text),helpdesk_auth.hdnr_pending_invitation(uuid),helpdesk_auth.hdnr_invitation(uuid),helpdesk_auth.hdnr_commit_invitation(jsonb,jsonb) TO helpdesk_app;
END $private$;
