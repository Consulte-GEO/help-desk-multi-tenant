-- Authority changes are rare; one workspace latch prevents append-only history
-- from overtaking a qualified command without introducing cross-key deadlocks.
CREATE FUNCTION helpdesk_auth.hdnr_authority_read(w uuid) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF w IS NULL THEN RAISE EXCEPTION 'Review workspace required' USING ERRCODE='HDR01';END IF;
 IF session_user='helpdesk_notification_worker' THEN PERFORM helpdesk_auth.hdn_notification_worker();
 ELSIF session_user<>'helpdesk_app' OR w IS DISTINCT FROM helpdesk_auth.workspace_id() OR NOT coalesce(helpdesk_auth.is_human(),false) THEN RAISE EXCEPTION 'Qualified review session required' USING ERRCODE='HDR01';END IF;
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('helpdesk-review-authority:'||w::text,0));
END$$;
CREATE FUNCTION helpdesk_auth.hdnr_authority_publish() RETURNS trigger LANGUAGE plpgsql VOLATILE SET search_path='' AS $$
DECLARE prior_revision bigint;BEGIN
 PERFORM helpdesk_auth.cg_local_operator();PERFORM pg_advisory_xact_lock(hashtextextended('helpdesk-review-authority:'||NEW.workspace_id::text,0));
 IF TG_TABLE_NAME='hdnr_grants' THEN
  SELECT coalesce(max(revision),0) INTO prior_revision FROM helpdesk_auth.hdnr_grants WHERE(workspace_id,account_id,principal_id,capability)=(NEW.workspace_id,NEW.account_id,NEW.principal_id,NEW.capability);
  IF NEW.revision<>prior_revision+1 THEN RAISE EXCEPTION 'Review capability revision changed' USING ERRCODE='HDR02';END IF;
 ELSIF TG_TABLE_NAME='hdnr_rosters' THEN
  SELECT coalesce(max(revision),0) INTO prior_revision FROM helpdesk_auth.hdnr_rosters WHERE(workspace_id,account_id,profile_version_id)=(NEW.workspace_id,NEW.account_id,NEW.profile_version_id);
  IF NEW.revision<>prior_revision+1 THEN RAISE EXCEPTION 'Approver roster revision changed' USING ERRCODE='HDR02';END IF;
 END IF;RETURN NEW;
END$$;
CREATE TRIGGER hdnr_authority_publication BEFORE INSERT ON helpdesk_core.hdnr_policies FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdnr_authority_publish();
CREATE TRIGGER hdnr_authority_publication BEFORE INSERT ON helpdesk_core.hdnr_profiles FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdnr_authority_publish();
CREATE TRIGGER hdnr_authority_publication BEFORE INSERT ON helpdesk_auth.hdnr_grants FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdnr_authority_publish();
CREATE TRIGGER hdnr_authority_publication BEFORE INSERT ON helpdesk_auth.hdnr_rosters FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdnr_authority_publish();
DO $private$ DECLARE role_name text;BEGIN
 REVOKE ALL ON FUNCTION helpdesk_auth.hdnr_authority_read(uuid),helpdesk_auth.hdnr_authority_publish() FROM PUBLIC;
 FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdnr_authority_read(uuid),helpdesk_auth.hdnr_authority_publish() FROM %I',role_name);END IF;
 END LOOP;
END $private$;


CREATE OR REPLACE FUNCTION helpdesk_auth.hdnr_aggregate(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE current_doc jsonb;s helpdesk_core.hdni_snapshots%rowtype;r helpdesk_audit.hdni_receipts%rowtype;p helpdesk_core.hdnr_profiles%rowtype;policy helpdesk_core.hdnr_policies%rowtype;
 f helpdesk_core.hdnr_forms%rowtype;form_doc jsonb;events jsonb;event_count integer;distinct_count integer;w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();BEGIN
 PERFORM helpdesk_auth.hdnr_authority_read(helpdesk_auth.workspace_id());
 current_doc:=helpdesk_auth.hdn_read_support_workflow(target);
 IF current_doc IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO STRICT s FROM helpdesk_core.hdni_snapshots WHERE(workspace_id,account_id,ticket_id)=(w,(current_doc->'ticket'->>'accountId')::uuid,target) FOR SHARE;
 SELECT * INTO STRICT r FROM helpdesk_audit.hdni_receipts WHERE(workspace_id,account_id,ticket_id)=(s.workspace_id,s.account_id,target) FOR SHARE;
 IF r.snapshot_hash<>helpdesk_auth.hdni_digest(s.document) OR r.result IS DISTINCT FROM s.document->'receipt' THEN RAISE EXCEPTION 'Original review snapshot changed' USING ERRCODE='HDR03';END IF;
 SELECT * INTO STRICT p FROM helpdesk_core.hdnr_profiles WHERE(workspace_id,account_id,profile_version_id)=(w,s.account_id,current_doc->'ticket'->>'profileVersionId') FOR SHARE;
 IF s.document->'profile'->>'profileVersionId'<>p.profile_version_id OR s.document->'bundle'->'form'->>'schemaHash'<>p.schema_hash OR helpdesk_auth.hdni_digest(s.document->'profile'->'form')<>p.schema_hash
  OR s.document->'profile'->'approvalRequired'='true'::jsonb AND NOT (s.document->'bundle'->>'requesterId')::uuid=ANY(p.required_for)
 THEN RAISE EXCEPTION 'Pinned review profile changed' USING ERRCODE='HDR03';END IF;
 SELECT * INTO STRICT policy FROM helpdesk_core.hdnr_policies WHERE(workspace_id,account_id,version_id)=(w,s.account_id,p.policy_version_id) FOR SHARE;
 form_doc:=s.document->'bundle'->'form'||jsonb_build_object('revision',1,'draftId',s.document->'bundle'->'draftId','draftRevision',s.document->'draft'->'revision');
 SELECT * INTO f FROM helpdesk_core.hdnr_forms WHERE(workspace_id,account_id,ticket_id)=(w,s.account_id,target) ORDER BY revision DESC LIMIT 1 FOR SHARE;
 IF FOUND THEN
  IF f.sha256<>helpdesk_auth.hdni_digest(f.document) OR f.source_version>(current_doc->'ticket'->>'version')::integer OR (SELECT count(*) FROM helpdesk_core.hdnr_forms WHERE(workspace_id,account_id,ticket_id)=(w,s.account_id,target))<>f.revision-1 THEN RAISE EXCEPTION 'Review form history incomplete' USING ERRCODE='HDR03';END IF;
  form_doc:=f.document;
 END IF;
 IF form_doc->>'schemaHash'<>p.schema_hash OR form_doc->>'formId'<>p.form_id::text OR form_doc->'formVersion'<>to_jsonb(p.form_version) THEN RAISE EXCEPTION 'Review form pin changed' USING ERRCODE='HDR03';END IF;
 SELECT jsonb_agg(value ORDER BY (value->>'sequence')::integer),count(*),count(DISTINCT(value->>'sequence')::integer) INTO events,event_count,distinct_count FROM (
  SELECT s.document->'bundle'->'event' value UNION ALL SELECT public_event FROM helpdesk_audit.hdn_workflow_commits WHERE(workspace_id,account_id,ticket_id)=(w,s.account_id,target)) stream;
 IF event_count<>(current_doc->'ticket'->>'version')::integer OR distinct_count<>event_count OR EXISTS(SELECT 1 FROM jsonb_array_elements(events) e WHERE e->>'profileVersionId'<>p.profile_version_id OR e->>'ticketId'<>target::text OR e->>'workspaceId'<>w::text OR (e->>'sequence')::integer NOT BETWEEN 1 AND event_count) THEN RAISE EXCEPTION 'Review workflow history incomplete' USING ERRCODE='HDR03';END IF;
 RETURN jsonb_build_object('principalId',who,'aggregate',jsonb_build_object('ticket',current_doc->'ticket','requesterId',s.document->'bundle'->'requesterId','protocol',s.document->'bundle'->'protocol','refs',s.document->'bundle'->'resourceScope'->'refs','form',form_doc,'profile',s.document->'profile','approvalPolicy',policy.document,'events',events));
EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'Pinned review aggregate unavailable' USING ERRCODE='HDR03';WHEN SQLSTATE 'HDW01' THEN RAISE EXCEPTION 'Review ticket access denied' USING ERRCODE='HDR01';END$$;

CREATE OR REPLACE FUNCTION helpdesk_auth.hdnr_grant(target uuid,cap text,ctx jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE aggregate_doc jsonb;g helpdesk_auth.hdnr_grants%rowtype;roster helpdesk_auth.hdnr_rosters%rowtype;ref jsonb;w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();a uuid;BEGIN
 PERFORM helpdesk_auth.hdnr_authority_read(helpdesk_auth.workspace_id());
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);
 IF session_user<>'helpdesk_app' OR ctx->>'operation'<>'tickets.write' OR cap NOT IN ('forms.revise','approvals.request','approvals.decide') THEN RAISE EXCEPTION 'Review write capability required' USING ERRCODE='HDR05';END IF;
 aggregate_doc:=helpdesk_auth.hdnr_aggregate(target)->'aggregate';a:=(aggregate_doc->'ticket'->>'accountId')::uuid;
 IF a::text IS DISTINCT FROM ctx->>'accountId' OR helpdesk_auth.hdni_refs_key(aggregate_doc->'refs') IS DISTINCT FROM helpdesk_auth.hdni_refs_key(ctx->'refs') THEN RAISE EXCEPTION 'Review resource scope changed' USING ERRCODE='HDR01';END IF;
 SELECT * INTO g FROM helpdesk_auth.hdnr_grants WHERE(workspace_id,account_id,principal_id,capability)=(w,a,who,cap) ORDER BY revision DESC LIMIT 1 FOR SHARE;
 IF NOT FOUND OR NOT g.active OR g.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Current review capability required' USING ERRCODE='HDR05';END IF;
 FOR ref IN SELECT value FROM jsonb_array_elements(ctx->'refs') LOOP
  IF ref->>'type'<>'work' OR NOT (ref->>'id')=ANY(g.work_ids) THEN RAISE EXCEPTION 'Review capability does not cover exact work' USING ERRCODE='HDR05';END IF;
 END LOOP;
 IF cap<>'forms.revise' THEN
  PERFORM 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=who AND active AND role='admin' FOR SHARE;
  IF NOT FOUND OR NOT helpdesk_auth.hdnr_operator(w,a,target,who) THEN RAISE EXCEPTION 'Initial approval requires current administrator authority' USING ERRCODE='HDR05';END IF;
 END IF;
 IF cap='approvals.decide' THEN
  SELECT * INTO roster FROM helpdesk_auth.hdnr_rosters WHERE(workspace_id,account_id,profile_version_id)=(w,a,aggregate_doc->'ticket'->>'profileVersionId') ORDER BY revision DESC LIMIT 1 FOR SHARE;
  IF NOT FOUND OR NOT roster.active OR roster.expires_at<=clock_timestamp() OR roster.approver_id<>who THEN RAISE EXCEPTION 'Current approver delegation revoked' USING ERRCODE='HDR05';END IF;
  FOR ref IN SELECT value FROM jsonb_array_elements(ctx->'refs') LOOP
   IF ref->>'type'<>'work' OR NOT(ref->>'id')=ANY(roster.work_ids) THEN RAISE EXCEPTION 'Current approver work delegation revoked' USING ERRCODE='HDR05';END IF;
  END LOOP;
 END IF;
 RETURN jsonb_build_object('principalId',who,'workspaceId',w,'accountId',a,'capability',cap,'scopeHash',helpdesk_auth.hdnr_scope_hash(ctx),'active',true,'revision','review-grant-'||g.revision::text,'expiresAt',helpdesk_auth.hdn_workflow_iso(least(g.expires_at,coalesce(roster.expires_at,g.expires_at))));
END$$;

CREATE OR REPLACE FUNCTION helpdesk_auth.hdnr_route(target uuid,ctx jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE doc jsonb;roster helpdesk_auth.hdnr_rosters%rowtype;g helpdesk_auth.hdnr_grants%rowtype;ref jsonb;w uuid:=helpdesk_auth.workspace_id();a uuid;BEGIN
 PERFORM helpdesk_auth.hdnr_authority_read(helpdesk_auth.workspace_id());
 PERFORM helpdesk_auth.hdnr_grant(target,'approvals.request',ctx);doc:=helpdesk_auth.hdnr_aggregate(target)->'aggregate';a:=(doc->'ticket'->>'accountId')::uuid;
 SELECT * INTO roster FROM helpdesk_auth.hdnr_rosters WHERE(workspace_id,account_id,profile_version_id)=(w,a,doc->'ticket'->>'profileVersionId') ORDER BY revision DESC LIMIT 1 FOR SHARE;
 IF NOT FOUND OR NOT roster.active OR roster.expires_at<=clock_timestamp() OR roster.approver_id::text IN (doc->>'requesterId',doc->'ticket'->>'createdBy') OR NOT helpdesk_auth.hdnr_operator(w,a,target,roster.approver_id) THEN RAISE EXCEPTION 'Exact current approver required' USING ERRCODE='HDR01';END IF;
 PERFORM 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=roster.approver_id AND active AND role='admin' FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Initial approver assurance policy requires administrator' USING ERRCODE='HDR01';END IF;
 SELECT * INTO g FROM helpdesk_auth.hdnr_grants WHERE(workspace_id,account_id,principal_id,capability)=(w,a,roster.approver_id,'approvals.decide') ORDER BY revision DESC LIMIT 1 FOR SHARE;
 IF NOT FOUND OR NOT g.active OR g.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Approver capability revoked' USING ERRCODE='HDR01';END IF;
 FOR ref IN SELECT value FROM jsonb_array_elements(ctx->'refs') LOOP
  IF ref->>'type'<>'work' OR NOT (ref->>'id')=ANY(g.work_ids) OR NOT (ref->>'id')=ANY(roster.work_ids) THEN RAISE EXCEPTION 'Approver work coverage revoked' USING ERRCODE='HDR01';END IF;
 END LOOP;
 RETURN jsonb_build_object('principalId',roster.approver_id,'principalKind','human','workspaceId',w,'accountId',a,'ticketId',target,'policyVersionId',doc->'approvalPolicy'->'versionId','resourceHash',helpdesk_auth.hdni_digest(to_jsonb(helpdesk_auth.hdni_refs_key(ctx->'refs'))),'revision','review-roster-'||roster.revision::text,'active',true,'expiresAt',helpdesk_auth.hdn_workflow_iso(least(roster.expires_at,g.expires_at)));
END$$;

CREATE OR REPLACE FUNCTION helpdesk_auth.hdnr_context(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb;BEGIN
 PERFORM helpdesk_auth.hdnr_authority_read(helpdesk_auth.workspace_id());
 IF session_user<>'helpdesk_app' OR NOT coalesce(helpdesk_auth.is_human(),false) OR NOT coalesce(helpdesk_auth.has_scope(helpdesk_auth.workspace_id(),'tickets:read'),false) OR NOT coalesce(helpdesk_auth.has_scope(helpdesk_auth.workspace_id(),'tickets:write'),false) THEN RAISE EXCEPTION 'Human review session required' USING ERRCODE='HDR01';END IF;
 ctx:=helpdesk_auth.cg_lock_ticket_scope(target,'tickets.write')-'ticketId';
 IF ctx IS NULL THEN RAISE EXCEPTION 'Current review work access required' USING ERRCODE='HDR01';END IF;
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);RETURN ctx;
END$$;

CREATE OR REPLACE FUNCTION helpdesk_auth.hdni_profile(ctx jsonb,form uuid,version integer) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE raw jsonb;binding helpdesk_core.hdnr_profiles%rowtype;policy helpdesk_core.hdnr_policies%rowtype;ref jsonb;BEGIN
 PERFORM helpdesk_auth.hdnr_authority_read(helpdesk_auth.workspace_id());
 raw:=helpdesk_auth.hdni_profile_v024(ctx,form,version);
 SELECT * INTO binding FROM helpdesk_core.hdnr_profiles q WHERE (q.workspace_id,q.account_id,q.form_id,q.form_version)=(helpdesk_auth.workspace_id(),(ctx->>'accountId')::uuid,hdni_profile.form,hdni_profile.version) FOR SHARE;
 IF NOT FOUND OR NOT helpdesk_auth.actor_id()=ANY(binding.required_for) THEN RETURN raw;END IF;
 IF (raw->'record'->>'id')::uuid<>binding.configuration_id OR (raw->'record'->>'version')::integer<>binding.configuration_version OR raw->'record'->>'contentHash'<>binding.configuration_hash THEN RAISE EXCEPTION 'Review configuration changed' USING ERRCODE='HDI05';END IF;
 FOR ref IN SELECT value FROM jsonb_array_elements(ctx->'refs') LOOP
  IF ref->>'type'<>'work' OR NOT (ref->>'id')=ANY(binding.work_ids) THEN RAISE EXCEPTION 'Approval form outside published work scope' USING ERRCODE='HDI01';END IF;
 END LOOP;
 SELECT * INTO STRICT policy FROM helpdesk_core.hdnr_policies WHERE (workspace_id,account_id,version_id)=(binding.workspace_id,binding.account_id,binding.policy_version_id) FOR SHARE;
 RETURN raw||jsonb_build_object('review',jsonb_build_object('formId',binding.form_id,'formVersion',binding.form_version,'profileVersionId',binding.profile_version_id,'schemaHash',binding.schema_hash,'configurationHash',binding.configuration_hash,'policyVersionId',binding.policy_version_id,'policyHash',policy.sha256,'approvalRequired',true));
EXCEPTION WHEN no_data_found THEN RAISE EXCEPTION 'Published approval policy unavailable' USING ERRCODE='HDI05';END$$;
