CREATE FUNCTION helpdesk_auth.hdnr_diff(before_doc jsonb,after_doc jsonb,path_value text,has_before boolean,has_after boolean,depth integer) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE result jsonb:='[]';key text;part jsonb;BEGIN
 IF depth>12 THEN RAISE EXCEPTION 'Review diff depth exceeded' USING ERRCODE='HDR03';END IF;
 IF has_before AND has_after AND before_doc IS NOT DISTINCT FROM after_doc THEN RETURN result;END IF;
 IF has_before AND has_after AND jsonb_typeof(before_doc)='object' AND jsonb_typeof(after_doc)='object' THEN
  FOR key IN SELECT name FROM(SELECT jsonb_object_keys(before_doc) name UNION SELECT jsonb_object_keys(after_doc)) keys ORDER BY helpdesk_auth.hdni_utf16(name) LOOP
   IF jsonb_array_length(result)>=1000 THEN RAISE EXCEPTION 'Review diff bound exceeded' USING ERRCODE='HDR03';END IF;
   part:=helpdesk_auth.hdnr_diff(before_doc->key,after_doc->key,CASE WHEN path_value='' THEN key ELSE path_value||'.'||key END,before_doc ? key,after_doc ? key,depth+1);result:=result||part;
   IF jsonb_array_length(result)>1000 THEN RAISE EXCEPTION 'Review diff bound exceeded' USING ERRCODE='HDR03';END IF;
  END LOOP;RETURN result;
 END IF;
 RETURN jsonb_build_array(jsonb_build_object('path',path_value,'beforePresent',has_before,'afterPresent',has_after,'before',CASE WHEN has_before THEN before_doc ELSE 'null'::jsonb END,'after',CASE WHEN has_after THEN after_doc ELSE 'null'::jsonb END));
END$$;
CREATE FUNCTION helpdesk_auth.hdnr_scoped_revision(w uuid,a uuid,target uuid,before_version integer,after_version integer,prior text,next_status text,destination uuid) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF session_user<>'helpdesk_app' OR w IS DISTINCT FROM helpdesk_auth.workspace_id() OR NOT coalesce(helpdesk_auth.is_human(),false) OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,a,target,'tickets.write'),false) THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM helpdesk_audit.hdnr_receipts r JOIN helpdesk_audit.hdn_workflow_commits c ON(c.workspace_id,c.account_id,c.ticket_id,c.event_id,c.actor_id,c.transaction_id)=(r.workspace_id,r.account_id,r.ticket_id,r.id,r.actor_id,r.transaction_id)
  WHERE(r.workspace_id,r.account_id,r.ticket_id,r.actor_id,r.action,r.transaction_id)=(w,a,target,helpdesk_auth.actor_id(),'revision',pg_current_xact_id())
   AND prior='waiting_customer' AND next_status IN ('open','triage') AND c.from_version=before_version AND c.to_version=after_version AND c.from_status=prior AND c.to_status=next_status
   AND c.command->>'action'='revise_form' AND r.bundle->'expectedVersion'=to_jsonb(before_version) AND r.result->'version'=to_jsonb(after_version)
   AND r.bundle->'decision'->'after'->>'status'=next_status AND r.bundle->'decision'->'after'->'assignedTo' IS NOT DISTINCT FROM coalesce(to_jsonb(destination),'null'::jsonb)
   AND c.public_event=r.bundle->'decision'->'event' AND c.result=r.result);
END$$;


CREATE OR REPLACE FUNCTION helpdesk_auth.hdn_scoped_workflow_commit(w uuid,a uuid,target uuid,before_version integer,after_version integer,prior text,next_status text,destination uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF session_user<>'helpdesk_app' OR w IS DISTINCT FROM helpdesk_auth.workspace_id() OR NOT coalesce(helpdesk_auth.is_human(),false)
 OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:read') AND helpdesk_auth.has_scope(w,'tickets:write'),false)
 OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,a,target,'tickets.write'),false) THEN RETURN false;END IF;
 IF helpdesk_auth.hdnr_scoped_revision(w,a,target,before_version,after_version,prior,next_status,destination) THEN RETURN true;END IF;
 RETURN EXISTS(SELECT 1 FROM helpdesk_audit.hdn_workflow_commits c WHERE
 (c.workspace_id,c.account_id,c.ticket_id,c.actor_id,c.from_version,c.to_version,c.from_status,c.to_status)=
 (w,a,target,helpdesk_auth.actor_id(),before_version,after_version,prior,next_status)
 AND c.transaction_id=pg_current_xact_id() AND
 ((c.command->>'action'='customer_reply' AND prior='waiting_customer' AND next_status='open')
 OR (c.command->>'action'='reopen' AND prior='closed' AND next_status='open')
 OR (c.command->>'action'='transfer' AND prior=next_status AND c.command->>'targetPrincipalId'=destination::text)));
END$$;

create or replace function helpdesk_core.guard_ticket_transition() returns trigger
language plpgsql set search_path='' as $$
declare allowed text[];
begin
 if new.status=old.status then return new; end if;
 if ((old.status='waiting_customer' and new.status in ('open','triage')) or (old.status='closed' and new.status='open')) and helpdesk_auth.hdn_scoped_workflow_commit(old.workspace_id,old.account_id,old.id,old.version,new.version,old.status,new.status,new.assigned_to) then return new;end if;
 if not helpdesk_auth.is_operator(old.workspace_id,old.account_id) then
  if old.status<>'resolved' or new.status not in ('open','closed') then
   raise exception 'Transition not authorized' using errcode='42501';
  end if;
 else
  allowed:=case old.status
   when 'new' then array['triage','open','cancelled']
   when 'triage' then array['open','waiting_customer','cancelled']
   when 'open' then array['waiting_customer','waiting_internal','waiting_third_party','resolved','cancelled']
   when 'waiting_customer' then array['open','resolved','cancelled']
   when 'waiting_internal' then array['open','resolved','cancelled']
   when 'waiting_third_party' then array['open','resolved','cancelled']
   when 'resolved' then array['open','closed'] else array[]::text[] end;
  if not(new.status=any(allowed)) then raise exception 'Invalid transition' using errcode='23514'; end if;
 end if;
 return new;
end$$;

CREATE OR REPLACE FUNCTION helpdesk_auth.hdni_guard_draft() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Draft deletion denied' USING ERRCODE='23514';END IF;
 IF NEW.owner_id IS DISTINCT FROM helpdesk_auth.actor_id() OR NEW.workspace_id IS DISTINCT FROM helpdesk_auth.workspace_id() OR NOT coalesce(helpdesk_auth.is_human(),false)
 OR NEW.document->>'id' IS DISTINCT FROM NEW.id::text OR NEW.document->>'ownerId' IS DISTINCT FROM NEW.owner_id::text OR NEW.document->>'workspaceId' IS DISTINCT FROM NEW.workspace_id::text OR NEW.document->>'accountId' IS DISTINCT FROM NEW.account_id::text
 OR NEW.document->'revision' IS DISTINCT FROM to_jsonb(NEW.revision) OR NEW.document->'formVersion' IS DISTINCT FROM to_jsonb(NEW.form_version) OR (NEW.document->>'expiresAt')::timestamptz IS DISTINCT FROM NEW.expires_at OR NOT ((NEW.document->>'status'='editing' AND NEW.document->'ticketId'='null'::jsonb) OR (TG_OP='UPDATE' AND OLD.document->>'status'='editing' AND NEW.document->>'status'='committed' AND (EXISTS(SELECT 1 FROM helpdesk_audit.hdni_receipts r WHERE (r.workspace_id,r.draft_id,r.ticket_id,r.actor_id,r.draft_revision)=(NEW.workspace_id,NEW.id,(NEW.document->>'ticketId')::uuid,NEW.owner_id,OLD.revision) AND r.transaction_id=pg_current_xact_id()) OR EXISTS(SELECT 1 FROM helpdesk_audit.hdnr_receipts r WHERE (r.workspace_id,r.account_id,r.ticket_id,r.actor_id,r.action,r.transaction_id)=(NEW.workspace_id,NEW.account_id,(NEW.document->>'ticketId')::uuid,NEW.owner_id,'revision',pg_current_xact_id()) AND r.bundle->>'draftId'=NEW.id::text AND r.bundle->'expectedDraftRevision'=to_jsonb(OLD.revision))) AND NEW.document-ARRAY['status','ticketId','revision']=OLD.document-ARRAY['status','ticketId','revision'])) THEN RAISE EXCEPTION 'Draft shape denied' USING ERRCODE='23514';END IF;
 IF TG_OP='UPDATE' AND (OLD.document->>'status'<>'editing' OR (NEW.workspace_id,NEW.id,NEW.owner_id,NEW.account_id,NEW.configuration_id,NEW.form_version,NEW.expires_at) IS DISTINCT FROM (OLD.workspace_id,OLD.id,OLD.owner_id,OLD.account_id,OLD.configuration_id,OLD.form_version,OLD.expires_at) OR NEW.revision<>OLD.revision+1 OR NEW.document->'formId' IS DISTINCT FROM OLD.document->'formId' OR NEW.document->'refs' IS DISTINCT FROM OLD.document->'refs' OR NEW.document->'schemaHash' IS DISTINCT FROM OLD.document->'schemaHash') THEN RAISE EXCEPTION 'Draft identity immutable' USING ERRCODE='23514';END IF;
 IF TG_OP='INSERT' AND NEW.revision<>1 THEN RAISE EXCEPTION 'Initial revision denied' USING ERRCODE='23514';END IF;
 RETURN NEW;
END$$;


CREATE OR REPLACE FUNCTION helpdesk_auth.hdnr_invitation_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r helpdesk_audit.hdnr_receipts%rowtype;c helpdesk_audit.hdnr_challenges%rowtype;BEGIN
 IF session_user<>'helpdesk_app' OR NOT coalesce(helpdesk_auth.is_human(),false) OR TG_OP='DELETE' THEN RAISE EXCEPTION 'Human qualified invitation command required' USING ERRCODE='HDR03';END IF;
 IF TG_OP='INSERT' THEN
  SELECT * INTO STRICT r FROM helpdesk_audit.hdnr_receipts WHERE(id,workspace_id,account_id,ticket_id,action,transaction_id)=(NEW.receipt_id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,'invitation',pg_current_xact_id());
  IF r.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() OR r.invitation_id<>NEW.id OR r.bundle->'invitation' IS DISTINCT FROM NEW.document OR NEW.revision<>1 THEN RAISE EXCEPTION 'Unqualified invitation insertion' USING ERRCODE='HDR03';END IF;RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.receipt_id) IS NOT DISTINCT FROM (OLD.id,OLD.workspace_id,OLD.account_id,OLD.ticket_id,OLD.receipt_id)
  AND NEW.revision=OLD.revision+1 AND OLD.document->>'status'='pending' AND NEW.document=OLD.document||jsonb_build_object('status','revoked') THEN
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

CREATE FUNCTION helpdesk_auth.hdnr_commit_revision(bundle jsonb,receipt jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();target uuid;account uuid;ctx jsonb;a jsonb;t jsonb;d jsonb;answers jsonb;form_doc jsonb;delta jsonb;preview_hash text;intent_hash text;
 decision jsonb:=bundle->'decision';audit_doc jsonb:=bundle->'audit';outbox_doc jsonb:=bundle->'outbox';expected_decision jsonb;after_doc jsonb;event_doc jsonb;expected_audit jsonb;expected_outbox jsonb;result jsonb;consumed jsonb;command_doc jsonb;
 effect_uuid uuid;request_uuid uuid;draft_uuid uuid;at_text text;stamp timestamptz;comment_value text;next_status text;next_approval text;actor_kind text;expected_version integer;next_version integer;form_revision integer;draft_revision integer;prior helpdesk_audit.hdnr_receipts%rowtype;affected integer;BEGIN
 IF NOT coalesce(helpdesk_auth.hdn_cfg_object(bundle,ARRAY['expectedVersion','expectedFormRevision','draftId','expectedDraftRevision','decision','form','clocks','audit','outbox']) AND helpdesk_auth.hdn_cfg_object(receipt,ARRAY['key','hash','result']),false) OR receipt->>'key' IS NULL OR receipt->>'key'!~'^[A-Za-z0-9._:-]{16,128}$' THEN RAISE EXCEPTION 'Invalid form revision command' USING ERRCODE='HDR03';END IF;
 target:=(receipt->'result'->>'ticketId')::uuid;ctx:=helpdesk_auth.hdnr_context(target);PERFORM helpdesk_auth.hdnr_grant(target,'forms.revise',ctx);a:=helpdesk_auth.hdnr_aggregate(target)->'aggregate';t:=a->'ticket';account:=(t->>'accountId')::uuid;
 SELECT * INTO prior FROM helpdesk_audit.hdnr_receipts WHERE(workspace_id,actor_id,intent_key)=(w,who,receipt->>'key') FOR UPDATE;
 IF FOUND THEN IF prior.action<>'revision' OR prior.intent_hash IS DISTINCT FROM receipt->>'hash' OR prior.result IS DISTINCT FROM receipt->'result' OR prior.ticket_id<>target THEN RAISE EXCEPTION 'Review idempotency conflict' USING ERRCODE='HDR04';END IF;RETURN prior.result;END IF;
 expected_version:=(t->>'version')::integer;next_version:=expected_version+1;form_revision:=(a->'form'->>'revision')::integer;draft_uuid:=(bundle->>'draftId')::uuid;draft_revision:=(bundle->>'expectedDraftRevision')::integer;
 IF t->>'status'<>'waiting_customer' OR bundle->'expectedVersion' IS DISTINCT FROM t->'version' OR bundle->'expectedFormRevision' IS DISTINCT FROM a->'form'->'revision' THEN RAISE EXCEPTION 'Form target changed' USING ERRCODE='HDR02';END IF;
 d:=helpdesk_auth.hdni_draft(ctx,draft_uuid);
 IF d IS NULL OR d->>'status'<>'editing' OR d->'revision' IS DISTINCT FROM to_jsonb(draft_revision) OR d->'formId' IS DISTINCT FROM a->'form'->'formId' OR d->'formVersion' IS DISTINCT FROM a->'form'->'formVersion' OR d->'schemaHash' IS DISTINCT FROM a->'form'->'schemaHash' OR helpdesk_auth.hdni_refs_key(d->'refs') IS DISTINCT FROM helpdesk_auth.hdni_refs_key(ctx->'refs') THEN RAISE EXCEPTION 'Current owned form draft required' USING ERRCODE='HDR06';END IF;
 answers:=helpdesk_auth.hdni_answers(a->'profile'->'form',d->'answers');delta:=helpdesk_auth.hdnr_diff(a->'form'->'answers',answers,'',true,true,0);
 IF jsonb_array_length(delta)=0 THEN RAISE EXCEPTION 'Form revision has no changes' USING ERRCODE='HDR03';END IF;
 form_doc:=jsonb_build_object('formId',d->'formId','formVersion',d->'formVersion','schemaHash',d->'schemaHash','revision',form_revision+1,'answers',answers,'publicAnswers',answers,'evidence','[]'::jsonb,'draftId',draft_uuid,'draftRevision',draft_revision);
 comment_value:=decision->>'comment';at_text:=audit_doc->>'at';stamp:=helpdesk_auth.hdn_notification_stamp(at_text);
 IF jsonb_typeof(decision->'comment') IS DISTINCT FROM 'string' OR comment_value IS DISTINCT FROM helpdesk_auth.hdni_trim(comment_value) OR octet_length(helpdesk_auth.hdni_utf16(comment_value))/2>12000 OR translate(comment_value,E'\t\n\r','')~'[\u0001-\u001f\u007f]' OR stamp>clock_timestamp() OR stamp<clock_timestamp()-interval '30 seconds' OR stamp<helpdesk_auth.hdn_notification_stamp(t->>'lastEventAt') THEN RAISE EXCEPTION 'Invalid revision comment or time' USING ERRCODE='HDR03';END IF;
 preview_hash:=helpdesk_auth.hdni_digest(jsonb_build_object('ticketId',target,'expectedVersion',expected_version,'expectedFormRevision',form_revision,'draftId',draft_uuid,'draftRevision',draft_revision,'form',form_doc,'profile',a->'profile','approvalPolicy',a->'approvalPolicy','comment',comment_value,'refs',helpdesk_auth.hdni_refs_key(ctx->'refs')));
 intent_hash:=helpdesk_auth.hdni_digest(jsonb_build_object('actorId',who,'workspaceId',w,'command',jsonb_build_object('ticketId',target,'expectedVersion',expected_version,'expectedFormRevision',form_revision,'draftId',draft_uuid,'expectedDraftRevision',draft_revision,'comment',comment_value,'previewHash',preview_hash)));
 IF receipt->>'hash' IS DISTINCT FROM intent_hash THEN RAISE EXCEPTION 'Form preview or intent changed' USING ERRCODE='HDR07';END IF;
 effect_uuid:=(audit_doc->>'id')::uuid;request_uuid:=(audit_doc->>'requestId')::uuid;next_status:=CASE WHEN a->'profile'->'approvalRequired'='true'::jsonb THEN 'triage' ELSE 'open' END;next_approval:=CASE WHEN a->'profile'->'approvalRequired'='true'::jsonb THEN 'pending' ELSE 'not_required' END;
 -- Initial Consulte GEO profiles publish a fixed priority. Do not silently
 -- accept a different native priority algorithm for a future generic profile.
 IF a->'profile'->>'fixedPriority' IS DISTINCT FROM t->>'priority' THEN RAISE EXCEPTION 'Unqualified revised priority profile' USING ERRCODE='HDR03';END IF;
 actor_kind:=CASE WHEN coalesce(helpdesk_auth.is_operator(w,account),false) THEN 'human_agent' ELSE 'customer' END;
 after_doc:=t||jsonb_build_object('approval',next_approval,'status',next_status,'version',next_version,'updatedAt',at_text,'lastEventAt',at_text);
 event_doc:=jsonb_build_object('ticketId',target,'workspaceId',w,'profileVersionId',t->'profileVersionId','sequence',next_version,'at',at_text,'type','form_revised','actorId',who,'actorKind',actor_kind,'from',t->'status','to',next_status);
 expected_decision:=jsonb_build_object('after',after_doc,'event',event_doc,'formRevision',form_revision+1,'answers',answers,'diff',delta,'comment',comment_value,'invalidateInvitations',true);
 expected_audit:=jsonb_build_object('id',effect_uuid,'actorId',who,'workspaceId',w,'ticketId',target,'requestId',request_uuid,'at',at_text,'action','form.revised','fromRevision',form_revision,'toRevision',form_revision+1,'diff',delta,'comment',comment_value);
 expected_outbox:=jsonb_build_object('id',effect_uuid,'workspaceId',w,'accountId',account,'ticketId',target,'type','support.form_revised','version',next_version,'requestId',request_uuid,'createdAt',at_text);
 result:=jsonb_build_object('ticketId',target,'workspaceId',w,'accountId',account,'actorId',who,'eventId',effect_uuid,'version',next_version,'formRevision',form_revision+1,'action','revision','invitationId',NULL,'decision',NULL,'notification','pending','replayed',false);
 IF decision IS DISTINCT FROM expected_decision OR bundle->'form' IS DISTINCT FROM form_doc OR audit_doc IS DISTINCT FROM expected_audit OR outbox_doc IS DISTINCT FROM expected_outbox OR receipt->'result' IS DISTINCT FROM result
 OR NOT coalesce(helpdesk_auth.hdn_cfg_object(bundle->'clocks',ARRAY['ticketId','workspaceId','sourceVersion','policyVersionId','calendarVersionId','asOf','firstResponse','solution']),false)
 OR bundle->'clocks'->>'ticketId'<>target::text OR bundle->'clocks'->>'workspaceId'<>w::text OR bundle->'clocks'->'sourceVersion'<>to_jsonb(next_version) OR bundle->'clocks'->>'asOf'<>at_text OR bundle->'clocks'->'policyVersionId'<>a->'profile'->'sla'->'versionId' OR bundle->'clocks'->'calendarVersionId'<>a->'profile'->'sla'->'calendar'->'versionId' THEN RAISE EXCEPTION 'Form revision bundle changed' USING ERRCODE='HDR02';END IF;
 INSERT INTO helpdesk_audit.hdnr_receipts(id,workspace_id,account_id,ticket_id,actor_id,intent_key,intent_hash,action,invitation_id,result,bundle,scope,request_id,created_at) VALUES(effect_uuid,w,account,target,who,receipt->>'key',intent_hash,'revision',NULL,result,bundle,ctx,request_uuid,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Revision receipt suppressed' USING ERRCODE='HDR03';END IF;
 command_doc:=jsonb_build_object('action','revise_form','expectedVersion',expected_version,'expectedFormRevision',form_revision,'draftId',draft_uuid,'expectedDraftRevision',draft_revision);
 INSERT INTO helpdesk_audit.hdn_workflow_commits(workspace_id,account_id,ticket_id,event_id,actor_id,profile_version_id,from_version,to_version,from_status,to_status,core_type,intent_key,intent_hash,command,public_event,audit,result,at) VALUES(w,account,target,effect_uuid,who,t->>'profileVersionId',expected_version,next_version,t->>'status',next_status,'ticket.status_changed',receipt->>'key',intent_hash,command_doc,event_doc,expected_audit,result,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Revision workflow proof suppressed' USING ERRCODE='HDR03';END IF;
 UPDATE helpdesk_core.tickets SET status=next_status,version=next_version,updated_at=stamp WHERE(workspace_id,account_id,id,version)=(w,account,target,expected_version);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Revision ticket changed' USING ERRCODE='HDR02';END IF;
 UPDATE helpdesk_core.hdn_workflow_state SET approval=next_approval,last_event_at=stamp WHERE(workspace_id,account_id,ticket_id)=(w,account,target);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Revision metadata suppressed' USING ERRCODE='HDR03';END IF;
 INSERT INTO helpdesk_core.hdnr_forms(workspace_id,account_id,ticket_id,revision,source_version,document,sha256,receipt_id) VALUES(w,account,target,form_revision+1,next_version,form_doc,helpdesk_auth.hdni_digest(form_doc),effect_uuid);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Revision form suppressed' USING ERRCODE='HDR03';END IF;
 consumed:=d||jsonb_build_object('revision',draft_revision+1,'status','committed','ticketId',target);
 UPDATE helpdesk_core.hdni_drafts SET revision=draft_revision+1,document=consumed WHERE(workspace_id,id,revision)=(w,draft_uuid,draft_revision);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Revision draft changed' USING ERRCODE='HDR06';END IF;
 INSERT INTO helpdesk_audit.hdni_draft_commits(workspace_id,draft_id,revision,actor_id,scope,document) VALUES(w,draft_uuid,draft_revision+1,who,ctx,consumed);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Revision draft audit suppressed' USING ERRCODE='HDR03';END IF;
 UPDATE helpdesk_core.hdnr_invitations SET document=jsonb_set(document,'{status}','"revoked"'),revision=revision+1 WHERE(workspace_id,account_id,ticket_id)=(w,account,target) AND document->>'status'='pending';
 INSERT INTO helpdesk_core.ticket_events(id,workspace_id,account_id,ticket_id,actor_id,type,customer_visible,data,created_at) VALUES(effect_uuid,w,account,target,who,'ticket.status_changed',true,jsonb_build_object('from',t->'status','to',next_status,'reason','Formulário revisado no Help Desk.'),stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Revision core event suppressed' USING ERRCODE='HDR03';END IF;
 INSERT INTO helpdesk_audit.audit_events(workspace_id,id,principal_id,action,resource_id,request_id,created_at) VALUES(w,effect_uuid,who,'form.revised',target,request_uuid::text,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Revision audit suppressed' USING ERRCODE='HDR03';END IF;
 INSERT INTO helpdesk_integration.outbox_events(id,workspace_id,account_id,ticket_id,type,payload,request_id,created_at) VALUES(effect_uuid,w,account,target,'ticket.status_changed',jsonb_build_object('specversion','1.0','id',effect_uuid,'source','helpdesk/workspaces/'||w::text,'type','com.helpdesk.ticket.status_changed.v1','subject','tickets/'||target::text,'datacontenttype','application/json','time',at_text,'data',jsonb_build_object('ticket_id',target,'version',next_version)),request_uuid::text,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Revision external header suppressed' USING ERRCODE='HDR03';END IF;
 INSERT INTO helpdesk_integration.hdnr_sources(id,workspace_id,account_id,ticket_id,receipt_id,kind,source_version,invitation_id,request_id,created_at) VALUES(effect_uuid,w,account,target,effect_uuid,'support.form_revised',next_version,NULL,request_uuid,stamp);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Revision notification source suppressed' USING ERRCODE='HDR03';END IF;
 RETURN result;
EXCEPTION WHEN data_exception OR no_data_found THEN RAISE EXCEPTION 'Invalid private form revision' USING ERRCODE='HDR03';END$$;


CREATE OR REPLACE FUNCTION helpdesk_auth.hdnr_receipt_complete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE source helpdesk_integration.hdnr_sources%rowtype;invitation helpdesk_core.hdnr_invitations%rowtype;c helpdesk_audit.hdn_workflow_commits%rowtype;
 a jsonb;actual_ticket jsonb;before_target jsonb;d jsonb:=NEW.bundle->'decision';expected_payload jsonb;BEGIN
 IF session_user<>'helpdesk_app' OR NEW.transaction_id<>pg_current_xact_id() OR NEW.workspace_id IS DISTINCT FROM helpdesk_auth.workspace_id() OR NEW.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() THEN RAISE EXCEPTION 'Unqualified review receipt' USING ERRCODE='HDR03';END IF;
 SELECT * INTO STRICT source FROM helpdesk_integration.hdnr_sources WHERE(id,workspace_id,account_id,ticket_id,receipt_id)=(NEW.id,NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id);
 IF NEW.action IN ('invitation','approval') THEN
 SELECT * INTO STRICT invitation FROM helpdesk_core.hdnr_invitations WHERE(id,workspace_id,account_id,ticket_id)=(NEW.invitation_id,NEW.workspace_id,NEW.account_id,NEW.ticket_id);
 END IF;
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
 ELSIF NEW.action='revision' THEN
  PERFORM helpdesk_auth.hdnr_grant(NEW.ticket_id,'forms.revise',NEW.scope);a:=helpdesk_auth.hdnr_aggregate(NEW.ticket_id)->'aggregate';actual_ticket:=a->'ticket';
  IF source.kind<>'support.form_revised' OR source.invitation_id IS NOT NULL OR NEW.invitation_id IS NOT NULL OR source.source_version<>(NEW.result->>'version')::integer
   OR actual_ticket->'version' IS DISTINCT FROM NEW.result->'version' OR a->'form'->'revision' IS DISTINCT FROM NEW.result->'formRevision'
   OR a->'form' IS DISTINCT FROM NEW.bundle->'form' OR (actual_ticket||jsonb_build_object('updatedAt',d->'after'->'updatedAt','lastEventAt',d->'after'->'lastEventAt')) IS DISTINCT FROM d->'after'
   OR helpdesk_auth.hdn_notification_stamp(actual_ticket->>'updatedAt')<>NEW.created_at OR helpdesk_auth.hdn_notification_stamp(actual_ticket->>'lastEventAt')<>NEW.created_at
   OR EXISTS(SELECT 1 FROM helpdesk_core.hdnr_invitations i WHERE(i.workspace_id,i.account_id,i.ticket_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id) AND i.document->>'status'='pending')
   OR NOT EXISTS(SELECT 1 FROM helpdesk_core.hdnr_forms f WHERE(f.workspace_id,f.account_id,f.ticket_id,f.revision,f.source_version,f.receipt_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,(NEW.result->>'formRevision')::integer,source.source_version,NEW.id) AND f.document=NEW.bundle->'form' AND f.sha256=helpdesk_auth.hdni_digest(f.document))
  THEN RAISE EXCEPTION 'Revision state form or invitations incomplete' USING ERRCODE='HDR03';END IF;
  SELECT * INTO STRICT c FROM helpdesk_audit.hdn_workflow_commits WHERE(workspace_id,account_id,ticket_id,event_id,actor_id,transaction_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id,NEW.actor_id,NEW.transaction_id);
  IF c.intent_key<>NEW.intent_key OR c.intent_hash<>NEW.intent_hash OR c.result IS DISTINCT FROM NEW.result OR c.public_event IS DISTINCT FROM d->'event' OR c.audit IS DISTINCT FROM NEW.bundle->'audit'
   OR c.core_type<>'ticket.status_changed' OR c.from_version<>source.source_version-1 OR c.to_version<>source.source_version OR c.from_status<>'waiting_customer' OR c.to_status<>d->'event'->>'to' OR c.at<>NEW.created_at
   OR c.command IS DISTINCT FROM jsonb_build_object('action','revise_form','expectedVersion',NEW.bundle->'expectedVersion','expectedFormRevision',NEW.bundle->'expectedFormRevision','draftId',NEW.bundle->'draftId','expectedDraftRevision',NEW.bundle->'expectedDraftRevision')
   OR NOT EXISTS(SELECT 1 FROM helpdesk_core.ticket_events e JOIN helpdesk_audit.write_effects f ON(f.workspace_id,f.event_id)=(e.workspace_id,e.id)
    WHERE(e.workspace_id,e.account_id,e.ticket_id,e.id,e.actor_id,e.type,e.created_at)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id,NEW.actor_id,'ticket.status_changed',NEW.created_at)
     AND e.customer_visible AND f.applied AND f.transaction_id=NEW.transaction_id AND f.ticket_version=c.to_version AND f.kind=e.type AND e.data-'reason'=f.expected_data AND f.expected_data=jsonb_build_object('from',c.from_status,'to',c.to_status))
   OR NOT EXISTS(SELECT 1 FROM helpdesk_audit.audit_events e WHERE(e.workspace_id,e.id,e.principal_id,e.action,e.resource_id,e.request_id,e.created_at)=(NEW.workspace_id,NEW.id,NEW.actor_id,'form.revised',NEW.ticket_id,NEW.request_id::text,NEW.created_at))
   OR NOT EXISTS(SELECT 1 FROM helpdesk_core.hdni_drafts draft JOIN helpdesk_audit.hdni_draft_commits dc ON(dc.workspace_id,dc.draft_id,dc.revision)=(draft.workspace_id,draft.id,draft.revision)
    WHERE(draft.workspace_id,draft.account_id,draft.id,draft.owner_id,draft.revision)=(NEW.workspace_id,NEW.account_id,(NEW.bundle->>'draftId')::uuid,NEW.actor_id,(NEW.bundle->>'expectedDraftRevision')::integer+1)
     AND draft.document->>'status'='committed' AND draft.document->>'ticketId'=NEW.ticket_id::text AND helpdesk_auth.hdni_answers(a->'profile'->'form',draft.document->'answers')=NEW.bundle->'form'->'answers' AND draft.document->'formId'=NEW.bundle->'form'->'formId'
     AND draft.document->'formVersion'=NEW.bundle->'form'->'formVersion' AND draft.document->'schemaHash'=NEW.bundle->'form'->'schemaHash' AND helpdesk_auth.hdni_refs_key(draft.document->'refs')=helpdesk_auth.hdni_refs_key(NEW.scope->'refs')
     AND draft.expires_at>clock_timestamp() AND dc.actor_id=NEW.actor_id AND dc.scope=NEW.scope AND dc.document=draft.document)
  THEN RAISE EXCEPTION 'Revision functional event draft or audit incomplete' USING ERRCODE='HDR03';END IF;
  expected_payload:=jsonb_build_object('specversion','1.0','id',NEW.id,'source','helpdesk/workspaces/'||NEW.workspace_id::text,'type','com.helpdesk.ticket.status_changed.v1','subject','tickets/'||NEW.ticket_id::text,'datacontenttype','application/json','time',NEW.bundle->'outbox'->'createdAt','data',jsonb_build_object('ticket_id',NEW.ticket_id,'version',source.source_version));
  IF NOT EXISTS(SELECT 1 FROM helpdesk_integration.outbox_events e WHERE(e.workspace_id,e.account_id,e.ticket_id,e.id,e.type,e.request_id,e.created_at)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.id,'ticket.status_changed',NEW.request_id::text,NEW.created_at) AND e.payload=expected_payload) THEN RAISE EXCEPTION 'Revision external header incomplete' USING ERRCODE='HDR03';END IF;
 ELSE RAISE EXCEPTION 'Review receipt action not yet qualified' USING ERRCODE='HDR03';END IF;
 RETURN NULL;
EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'Review receipt effects missing' USING ERRCODE='HDR03';END$$;

DO $private$ DECLARE role_name text;BEGIN
 REVOKE ALL ON FUNCTION helpdesk_auth.hdnr_diff(jsonb,jsonb,text,boolean,boolean,integer),helpdesk_auth.hdnr_scoped_revision(uuid,uuid,uuid,integer,integer,text,text,uuid),helpdesk_auth.hdnr_commit_revision(jsonb,jsonb) FROM PUBLIC;
 FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdnr_diff(jsonb,jsonb,text,boolean,boolean,integer),helpdesk_auth.hdnr_scoped_revision(uuid,uuid,uuid,integer,integer,text,text,uuid),helpdesk_auth.hdnr_commit_revision(jsonb,jsonb) FROM %I',role_name);END IF;
 END LOOP;
 GRANT EXECUTE ON FUNCTION helpdesk_auth.hdnr_commit_revision(jsonb,jsonb) TO helpdesk_app;
END $private$;
