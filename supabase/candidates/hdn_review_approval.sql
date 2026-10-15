CREATE OR REPLACE FUNCTION helpdesk_auth.hdnr_invitation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r helpdesk_audit.hdnr_receipts%rowtype;c helpdesk_audit.hdnr_challenges%rowtype;BEGIN
 IF session_user<>'helpdesk_app' OR NOT coalesce(helpdesk_auth.is_human(),false) OR TG_OP='DELETE' THEN RAISE EXCEPTION 'Human qualified invitation command required' USING ERRCODE='HDR03';END IF;
 IF TG_OP='INSERT' THEN
  SELECT * INTO STRICT r FROM helpdesk_audit.hdnr_receipts WHERE(id,workspace_id,account_id,ticket_id,action,transaction_id)=(NEW.receipt_id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,'invitation',pg_current_xact_id());
  IF r.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() OR r.invitation_id<>NEW.id OR r.bundle->'invitation' IS DISTINCT FROM NEW.document OR NEW.revision<>1 THEN RAISE EXCEPTION 'Unqualified invitation insertion' USING ERRCODE='HDR03';END IF;RETURN NEW;
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

CREATE FUNCTION helpdesk_auth.hdnr_receipt(key text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE row helpdesk_audit.hdnr_receipts%rowtype;BEGIN
 IF session_user<>'helpdesk_app' OR NOT coalesce(helpdesk_auth.is_human(),false) OR key IS NULL OR key!~'^[A-Za-z0-9._:-]{16,128}$' THEN RAISE EXCEPTION 'Invalid private receipt lookup' USING ERRCODE='HDR01';END IF;
 SELECT * INTO row FROM helpdesk_audit.hdnr_receipts WHERE(workspace_id,actor_id,intent_key)=(helpdesk_auth.workspace_id(),helpdesk_auth.actor_id(),key) FOR SHARE;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF row.action NOT IN ('approval','revision') THEN RAISE EXCEPTION 'Review intent belongs to another action' USING ERRCODE='HDR04';END IF;
 PERFORM helpdesk_auth.hdnr_grant(row.ticket_id,CASE WHEN row.action='approval' THEN 'approvals.decide' ELSE 'forms.revise' END,helpdesk_auth.hdnr_context(row.ticket_id));
 RETURN jsonb_build_object('key',row.intent_key,'hash',row.intent_hash,'result',row.result);
END$$;
CREATE FUNCTION helpdesk_auth.hdnr_commit_approval(bundle jsonb,receipt jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();target uuid;account uuid;ctx jsonb;a jsonb;t jsonb;i jsonb;decision jsonb:=bundle->'decision';audit_doc jsonb:=bundle->'audit';outbox_doc jsonb:=bundle->'outbox';expected_decision jsonb;after_doc jsonb;event_doc jsonb;expected_audit jsonb;expected_outbox jsonb;result jsonb;
 invitation_uuid uuid;effect_uuid uuid;request_uuid uuid;at_text text;stamp timestamptz;choice text;reason text;kind text;next_status text;next_approval text;expected_version integer;next_version integer;intent_hash text;command_doc jsonb;prior helpdesk_audit.hdnr_receipts%rowtype;affected integer;BEGIN
 IF NOT coalesce(helpdesk_auth.hdn_cfg_object(bundle,ARRAY['expectedVersion','invitationId','decision','clocks','audit','outbox']) AND helpdesk_auth.hdn_cfg_object(receipt,ARRAY['key','hash','result']),false) OR receipt->>'key' IS NULL OR receipt->>'key'!~'^[A-Za-z0-9._:-]{16,128}$' THEN RAISE EXCEPTION 'Invalid approval command' USING ERRCODE='HDR03';END IF;
 target:=(receipt->'result'->>'ticketId')::uuid;ctx:=helpdesk_auth.hdnr_context(target);PERFORM helpdesk_auth.hdnr_grant(target,'approvals.decide',ctx);a:=helpdesk_auth.hdnr_aggregate(target)->'aggregate';t:=a->'ticket';account:=(t->>'accountId')::uuid;
 invitation_uuid:=(bundle->>'invitationId')::uuid;i:=helpdesk_auth.hdnr_invitation(invitation_uuid);
 SELECT * INTO prior FROM helpdesk_audit.hdnr_receipts WHERE(workspace_id,actor_id,intent_key)=(w,who,receipt->>'key') FOR UPDATE;
 IF FOUND THEN IF prior.action<>'approval' OR prior.intent_hash IS DISTINCT FROM receipt->>'hash' OR prior.result IS DISTINCT FROM receipt->'result' OR prior.ticket_id<>target OR prior.invitation_id<>invitation_uuid THEN RAISE EXCEPTION 'Review idempotency conflict' USING ERRCODE='HDR04';END IF;RETURN prior.result;END IF;
 expected_version:=(t->>'version')::integer;next_version:=expected_version+1;choice:=decision->>'decision';reason:=decision->>'reason';at_text:=audit_doc->>'at';stamp:=helpdesk_auth.hdn_notification_stamp(at_text);
 IF i IS NULL OR i->>'approverId'<>who::text OR i->>'ticketId'<>target::text OR i->>'status'<>'pending' OR i->'ticketVersion' IS DISTINCT FROM t->'version' OR i->'formRevision' IS DISTINCT FROM a->'form'->'revision'
  OR i->>'targetHash' IS DISTINCT FROM helpdesk_auth.hdnr_target_hash(a) OR i->'policyVersionId' IS DISTINCT FROM a->'approvalPolicy'->'versionId' OR who::text IN (a->>'requesterId',t->>'createdBy')
  OR t->>'approval'<>'pending' OR t->>'status' NOT IN ('new','triage') OR bundle->'expectedVersion' IS DISTINCT FROM t->'version' OR i->'challenge'='null'::jsonb
  OR decision->'challengeGeneration' IS DISTINCT FROM i->'challenge'->'generation' OR helpdesk_auth.hdn_notification_stamp(i->>'expiresAt')<=clock_timestamp() OR helpdesk_auth.hdn_notification_stamp(i->'challenge'->>'expiresAt')<=clock_timestamp()
 THEN RAISE EXCEPTION 'Approval target or challenge changed' USING ERRCODE='HDR02';END IF;
 IF choice IS NULL OR choice NOT IN ('approve','reject') OR jsonb_typeof(decision->'reason') IS DISTINCT FROM 'string' OR length(helpdesk_auth.hdni_trim(reason))=0 OR octet_length(helpdesk_auth.hdni_utf16(reason))/2>12000
  OR translate(reason,E'\t\n\r','')~'[\u0001-\u001f\u007f]' OR stamp>clock_timestamp() OR stamp<clock_timestamp()-interval '30 seconds' OR stamp<helpdesk_auth.hdn_notification_stamp(t->>'lastEventAt')
 THEN RAISE EXCEPTION 'Invalid approval decision or time' USING ERRCODE='HDR03';END IF;
 intent_hash:=helpdesk_auth.hdni_digest(jsonb_build_object('actorId',who,'workspaceId',w,'command',jsonb_build_object('ticketId',target,'invitationId',invitation_uuid,'expectedVersion',expected_version,'expectedFormRevision',a->'form'->'revision','token',i->'challenge'->'hash','decision',choice,'reason',reason)));
 IF receipt->>'hash' IS DISTINCT FROM intent_hash THEN RAISE EXCEPTION 'Approval challenge receipt mismatch' USING ERRCODE='HDR04';END IF;
 effect_uuid:=(audit_doc->>'id')::uuid;request_uuid:=(audit_doc->>'requestId')::uuid;
 next_status:=CASE WHEN choice='approve' THEN a->'approvalPolicy'->>'onApproved' ELSE a->'approvalPolicy'->>'onRejected' END;next_approval:=CASE WHEN choice='approve' THEN 'approved' ELSE 'pending' END;kind:=CASE WHEN choice='approve' THEN 'approval_granted' ELSE 'approval_rejected' END;
 after_doc:=t||jsonb_build_object('approval',next_approval,'status',next_status,'version',next_version,'updatedAt',at_text,'lastEventAt',at_text);
 event_doc:=jsonb_build_object('ticketId',target,'workspaceId',w,'profileVersionId',t->'profileVersionId','sequence',next_version,'at',at_text,'type',kind,'actorId',who,'actorKind','human_agent','from',t->'status','to',next_status);
 expected_decision:=jsonb_build_object('after',after_doc,'event',event_doc,'invitationId',invitation_uuid,'challengeGeneration',i->'challenge'->'generation','reason',reason,'decision',choice,'originPermissionGranted',false,'originExecution',CASE WHEN choice='approve' THEN 'pending_manual_action' ELSE 'not_requested' END);
 expected_audit:=jsonb_build_object('id',effect_uuid,'actorId',who,'workspaceId',w,'ticketId',target,'requestId',request_uuid,'at',at_text,'action','approval.'||choice,'invitationId',invitation_uuid,'formRevision',a->'form'->'revision','reason',reason,'capability','approvals.decide','originPermissionGranted',false);
 expected_outbox:=jsonb_build_object('id',effect_uuid,'workspaceId',w,'accountId',account,'ticketId',target,'type','support.'||kind,'version',next_version,'requestId',request_uuid,'createdAt',at_text);
 result:=jsonb_build_object('ticketId',target,'workspaceId',w,'accountId',account,'actorId',who,'eventId',effect_uuid,'version',next_version,'formRevision',a->'form'->'revision','action','approval','invitationId',invitation_uuid,'decision',choice,'notification','pending','replayed',false);
 IF decision IS DISTINCT FROM expected_decision OR audit_doc IS DISTINCT FROM expected_audit OR outbox_doc IS DISTINCT FROM expected_outbox OR receipt->'result' IS DISTINCT FROM result
  OR NOT coalesce(helpdesk_auth.hdn_cfg_object(bundle->'clocks',ARRAY['ticketId','workspaceId','sourceVersion','policyVersionId','calendarVersionId','asOf','firstResponse','solution']),false)
  OR bundle->'clocks'->>'ticketId'<>target::text OR bundle->'clocks'->>'workspaceId'<>w::text OR bundle->'clocks'->'sourceVersion'<>to_jsonb(next_version) OR bundle->'clocks'->>'asOf'<>at_text
  OR bundle->'clocks'->'policyVersionId'<>a->'profile'->'sla'->'versionId' OR bundle->'clocks'->'calendarVersionId'<>a->'profile'->'sla'->'calendar'->'versionId'
 THEN RAISE EXCEPTION 'Approval bundle changed' USING ERRCODE='HDR02';END IF;
 INSERT INTO helpdesk_audit.hdnr_receipts(id,workspace_id,account_id,ticket_id,actor_id,intent_key,intent_hash,action,invitation_id,result,bundle,scope,request_id,created_at) VALUES(effect_uuid,w,account,target,who,receipt->>'key',intent_hash,'approval',invitation_uuid,result,bundle,ctx,request_uuid,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Approval receipt suppressed' USING ERRCODE='HDR03';END IF;
 command_doc:=jsonb_build_object('action','approval','expectedVersion',expected_version,'invitationId',invitation_uuid,'expectedFormRevision',a->'form'->'revision','decision',choice,'challengeGeneration',i->'challenge'->'generation');
 INSERT INTO helpdesk_audit.hdn_workflow_commits(workspace_id,account_id,ticket_id,event_id,actor_id,profile_version_id,from_version,to_version,from_status,to_status,core_type,intent_key,intent_hash,command,public_event,audit,result,at)
 VALUES(w,account,target,effect_uuid,who,t->>'profileVersionId',expected_version,next_version,t->>'status',next_status,'ticket.status_changed',receipt->>'key',intent_hash,command_doc,event_doc,expected_audit,result,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Approval workflow proof suppressed' USING ERRCODE='HDR03';END IF;
 UPDATE helpdesk_core.tickets SET status=next_status,version=next_version,updated_at=stamp WHERE(workspace_id,account_id,id,version)=(w,account,target,expected_version);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Approval ticket revision changed' USING ERRCODE='HDR02';END IF;
 UPDATE helpdesk_core.hdn_workflow_state SET approval=next_approval,last_event_at=stamp WHERE(workspace_id,account_id,ticket_id)=(w,account,target);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Approval metadata suppressed' USING ERRCODE='HDR03';END IF;
 INSERT INTO helpdesk_core.ticket_events(id,workspace_id,account_id,ticket_id,actor_id,type,customer_visible,data,created_at) VALUES(effect_uuid,w,account,target,who,'ticket.status_changed',true,jsonb_build_object('from',t->'status','to',next_status,'reason','Aprovação registrada no Help Desk.'),stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Approval core event suppressed' USING ERRCODE='HDR03';END IF;
 INSERT INTO helpdesk_audit.audit_events(workspace_id,id,principal_id,action,resource_id,request_id,created_at) VALUES(w,effect_uuid,who,'approval.'||choice,target,request_uuid::text,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Approval audit suppressed' USING ERRCODE='HDR03';END IF;
 INSERT INTO helpdesk_integration.outbox_events(id,workspace_id,account_id,ticket_id,type,payload,request_id,created_at) VALUES(effect_uuid,w,account,target,'ticket.status_changed',jsonb_build_object('specversion','1.0','id',effect_uuid,'source','helpdesk/workspaces/'||w::text,'type','com.helpdesk.ticket.status_changed.v1','subject','tickets/'||target::text,'datacontenttype','application/json','time',at_text,'data',jsonb_build_object('ticket_id',target,'version',next_version)),request_uuid::text,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Approval external header suppressed' USING ERRCODE='HDR03';END IF;
 UPDATE helpdesk_core.hdnr_invitations SET document=jsonb_set(document,'{status}','"used"'),revision=revision+1 WHERE id=invitation_uuid AND workspace_id=w AND document=i;
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Approval invitation changed' USING ERRCODE='HDR02';END IF;
 INSERT INTO helpdesk_integration.hdnr_sources(id,workspace_id,account_id,ticket_id,receipt_id,kind,source_version,invitation_id,request_id,created_at) VALUES(effect_uuid,w,account,target,effect_uuid,'support.'||kind,next_version,NULL,request_uuid,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Approval notification source suppressed' USING ERRCODE='HDR03';END IF;
 RETURN result;
EXCEPTION WHEN data_exception OR no_data_found THEN RAISE EXCEPTION 'Invalid private approval command' USING ERRCODE='HDR03';END$$;

-- The invitation guard extension and complete effect validator are composed
-- separately below before this candidate can be qualified or activated.

CREATE OR REPLACE FUNCTION helpdesk_auth.hdnr_receipt_complete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source helpdesk_integration.hdnr_sources%rowtype;invitation helpdesk_core.hdnr_invitations%rowtype;c helpdesk_audit.hdn_workflow_commits%rowtype;
 a jsonb;actual_ticket jsonb;before_target jsonb;d jsonb:=NEW.bundle->'decision';expected_payload jsonb;BEGIN
 IF session_user<>'helpdesk_app' OR NEW.transaction_id<>pg_current_xact_id() OR NEW.workspace_id IS DISTINCT FROM helpdesk_auth.workspace_id() OR NEW.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() THEN RAISE EXCEPTION 'Unqualified review receipt' USING ERRCODE='HDR03';END IF;
 SELECT * INTO STRICT source FROM helpdesk_integration.hdnr_sources WHERE(id,workspace_id,account_id,ticket_id,receipt_id)=(NEW.id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id);
 SELECT * INTO STRICT invitation FROM helpdesk_core.hdnr_invitations WHERE(id,workspace_id,account_id,ticket_id)=(NEW.invitation_id,NEW.workspace_id,NEW.account_id,NEW.ticket_id);
 IF source.created_at<>NEW.created_at OR source.request_id<>NEW.request_id THEN RAISE EXCEPTION 'Review source correlation changed' USING ERRCODE='HDR03';END IF;
 IF NEW.action='invitation' THEN
  PERFORM helpdesk_auth.hdnr_grant(NEW.ticket_id,'approvals.request',NEW.scope);
  IF source.kind<>'support.approval_requested' OR source.invitation_id<>NEW.invitation_id OR source.source_version<>(NEW.result->>'ticketVersion')::integer
   OR invitation.receipt_id<>NEW.id OR invitation.document IS DISTINCT FROM NEW.bundle->'invitation'
   OR NOT EXISTS(SELECT 1 FROM helpdesk_audit.audit_events e WHERE(e.workspace_id,e.id,e.principal_id,e.action,e.resource_id,e.request_id,e.created_at)=(NEW.workspace_id,NEW.id,NEW.actor_id,'approval.requested',NEW.ticket_id,NEW.request_id::text,NEW.created_at))
  THEN RAISE EXCEPTION 'Invitation effects incomplete' USING ERRCODE='HDR03';END IF;
 ELSIF NEW.action='approval' THEN
  PERFORM helpdesk_auth.hdnr_grant(NEW.ticket_id,'approvals.decide',NEW.scope);a:=helpdesk_auth.hdnr_aggregate(NEW.ticket_id)->'aggregate';actual_ticket:=a->'ticket';
  IF source.kind IS DISTINCT FROM 'support.'||(d->'event'->>'type') OR source.invitation_id IS NOT NULL OR source.source_version<>(NEW.result->>'version')::integer
   OR invitation.document->>'status'<>'used' OR invitation.document->>'approverId'<>NEW.actor_id::text OR invitation.document->'ticketVersion'<>to_jsonb(source.source_version-1)
   OR invitation.document->'formRevision'<>NEW.result->'formRevision' OR invitation.document->'challenge'->'generation'<>d->'challengeGeneration'
   OR helpdesk_auth.hdn_notification_stamp(invitation.document->'challenge'->>'expiresAt')<=clock_timestamp()
   OR actual_ticket->'version'<>NEW.result->'version' OR a->'form'->'revision'<>NEW.result->'formRevision'
   OR (actual_ticket||jsonb_build_object('updatedAt',d->'after'->'updatedAt','lastEventAt',d->'after'->'lastEventAt')) IS DISTINCT FROM d->'after'
   OR helpdesk_auth.hdn_notification_stamp(actual_ticket->>'updatedAt')<>NEW.created_at OR helpdesk_auth.hdn_notification_stamp(actual_ticket->>'lastEventAt')<>NEW.created_at
  THEN RAISE EXCEPTION 'Approval state or invitation effect incomplete' USING ERRCODE='HDR03';END IF;
  before_target:=a||jsonb_build_object('ticket',actual_ticket||jsonb_build_object('version',source.source_version-1));
  IF invitation.document->>'targetHash'<>helpdesk_auth.hdnr_target_hash(before_target) THEN RAISE EXCEPTION 'Approval target pin changed' USING ERRCODE='HDR03';END IF;
  SELECT * INTO STRICT c FROM helpdesk_audit.hdn_workflow_commits WHERE(workspace_id,account_id,ticket_id,event_id,actor_id,transaction_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id,NEW.actor_id,NEW.transaction_id);
  IF c.intent_key<>NEW.intent_key OR c.intent_hash<>NEW.intent_hash OR c.result IS DISTINCT FROM NEW.result OR c.public_event IS DISTINCT FROM d->'event' OR c.audit IS DISTINCT FROM NEW.bundle->'audit'
   OR c.core_type<>'ticket.status_changed' OR c.from_version<>source.source_version-1 OR c.to_version<>source.source_version OR c.from_status<>d->'event'->>'from' OR c.to_status<>d->'event'->>'to' OR c.at<>NEW.created_at
   OR c.command IS DISTINCT FROM jsonb_build_object('action','approval','expectedVersion',c.from_version,'invitationId',NEW.invitation_id,'expectedFormRevision',NEW.result->'formRevision','decision',d->'decision','challengeGeneration',d->'challengeGeneration')
   OR NOT EXISTS(SELECT 1 FROM helpdesk_core.ticket_events e JOIN helpdesk_audit.write_effects f ON(f.workspace_id,f.event_id)=(e.workspace_id,e.id)
    WHERE(e.workspace_id,e.account_id,e.ticket_id,e.id,e.actor_id,e.type,e.created_at)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id,NEW.actor_id,'ticket.status_changed',NEW.created_at)
     AND e.customer_visible AND f.applied AND f.transaction_id=NEW.transaction_id AND f.ticket_version=c.to_version AND f.kind=e.type
     AND e.data-'reason'=f.expected_data AND f.expected_data=jsonb_build_object('from',c.from_status,'to',c.to_status))
   OR NOT EXISTS(SELECT 1 FROM helpdesk_audit.audit_events e WHERE(e.workspace_id,e.id,e.principal_id,e.action,e.resource_id,e.request_id,e.created_at)=(NEW.workspace_id,NEW.id,NEW.actor_id,NEW.bundle->'audit'->>'action',NEW.ticket_id,NEW.request_id::text,NEW.created_at))
  THEN RAISE EXCEPTION 'Approval functional event or audit incomplete' USING ERRCODE='HDR03';END IF;
  expected_payload:=jsonb_build_object('specversion','1.0','id',NEW.id,'source','helpdesk/workspaces/'||NEW.workspace_id::text,'type','com.helpdesk.ticket.status_changed.v1','subject','tickets/'||NEW.ticket_id::text,'datacontenttype','application/json','time',NEW.bundle->'outbox'->'createdAt','data',jsonb_build_object('ticket_id',NEW.ticket_id,'version',source.source_version));
  IF NOT EXISTS(SELECT 1 FROM helpdesk_integration.outbox_events e WHERE(e.workspace_id,e.account_id,e.ticket_id,e.id,e.type,e.request_id,e.created_at)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id,'ticket.status_changed',NEW.request_id::text,NEW.created_at) AND e.payload=expected_payload) THEN RAISE EXCEPTION 'Approval external header incomplete' USING ERRCODE='HDR03';END IF;
 ELSE RAISE EXCEPTION 'Review receipt action not yet qualified' USING ERRCODE='HDR03';END IF;
 RETURN NULL;
EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'Review receipt effects missing' USING ERRCODE='HDR03';END$$;
DO $private$ DECLARE role_name text;BEGIN
 REVOKE ALL ON FUNCTION helpdesk_auth.hdnr_receipt(text),helpdesk_auth.hdnr_commit_approval(jsonb,jsonb) FROM PUBLIC;
 FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdnr_receipt(text),helpdesk_auth.hdnr_commit_approval(jsonb,jsonb) FROM %I',role_name);END IF;
 END LOOP;
 GRANT EXECUTE ON FUNCTION helpdesk_auth.hdnr_receipt(text),helpdesk_auth.hdnr_commit_approval(jsonb,jsonb) TO helpdesk_app;
END $private$;

