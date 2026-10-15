-- Current role, scope, registry receipt and COMPLETE sealed work coverage;
-- copied from the natively qualified internal recipient checks, without queue semantics.
CREATE FUNCTION helpdesk_auth.hdnr_operator(w uuid,a uuid,ticket uuid,person uuid) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;r helpdesk_auth.cg_local_registries%rowtype;l helpdesk_auth.cg_local_accounts%rowtype;
 p helpdesk_auth.cg_local_permissions%rowtype;s helpdesk_core.cg_ticket_resource_sets%rowtype;b helpdesk_auth.cg_resource_bindings%rowtype;connection helpdesk_auth.cg_resource_connections%rowtype;ref record;BEGIN
 SELECT * INTO STRICT t FROM helpdesk_core.tickets WHERE(workspace_id,account_id,id)=(w,a,ticket) FOR SHARE;
 SELECT * INTO r FROM helpdesk_auth.cg_local_registries WHERE workspace_id=w FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Qualified local internal source required' USING ERRCODE='HDN06';END IF;
 SELECT * INTO l FROM helpdesk_auth.cg_local_accounts WHERE workspace_id=w AND account_id=a FOR SHARE;
 IF NOT FOUND OR NOT l.active THEN RETURN false;END IF;
 IF l.registry_revision<>r.revision OR l.product_instance_id<>t.product_instance_id OR NOT EXISTS(SELECT 1 FROM helpdesk_audit.cg_local_receipts receipt WHERE receipt.workspace_id=w AND receipt.registry_revision=r.revision AND receipt.decision_hash=r.decision_hash AND receipt.receipt->>'decisionHash'=r.decision_hash AND receipt.receipt->'revision'=to_jsonb(r.revision) AND receipt.receipt->'sourceManifest'=helpdesk_auth.cg_local_manifest()) THEN RAISE EXCEPTION 'Current local internal receipt required' USING ERRCODE='HDN06';END IF;
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('helpdesk-human-scopes:'||w::text||':'||person::text,0));
 PERFORM 1 FROM helpdesk_auth.principals WHERE id=person AND kind='human' AND active FOR SHARE;IF NOT FOUND THEN RETURN false;END IF;
 IF NOT ARRAY['tickets:read','tickets:write']<@helpdesk_auth.human_scopes(w,person) THEN RETURN false;END IF;
 PERFORM 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=person AND active AND role='admin' FOR SHARE;
 IF NOT FOUND THEN PERFORM 1 FROM helpdesk_auth.account_grants WHERE workspace_id=w AND account_id=a AND principal_id=person AND active AND role='agent' FOR SHARE;IF NOT FOUND THEN RETURN false;END IF;END IF;
 SELECT * INTO p FROM helpdesk_auth.cg_local_permissions WHERE workspace_id=w AND account_id=a AND principal_id=person AND operation='tickets.write' FOR SHARE;
 IF NOT FOUND OR NOT p.active THEN RETURN false;END IF;
 IF p.registry_revision<>r.revision THEN RAISE EXCEPTION 'Current internal write decision required' USING ERRCODE='HDN06';END IF;
 SELECT * INTO STRICT s FROM helpdesk_core.cg_ticket_resource_sets WHERE (workspace_id,account_id,ticket_id)=(w,a,ticket) AND sealed FOR SHARE;
 SELECT * INTO b FROM helpdesk_auth.cg_resource_bindings WHERE (workspace_id,account_id,id)=(w,a,s.binding_id) FOR SHARE;
 IF NOT FOUND OR NOT b.active THEN RETURN false;END IF;
 SELECT * INTO connection FROM helpdesk_auth.cg_resource_connections WHERE (workspace_id,id)=(w,b.connection_id) FOR SHARE;
 IF NOT FOUND OR NOT connection.active THEN RETURN false;END IF;
 IF l.binding_id<>s.binding_id OR l.connection_id<>connection.id OR b.tenant_id<>l.tenant_id OR connection.product_instance_id<>t.product_instance_id THEN RAISE EXCEPTION 'Internal namespace mismatch' USING ERRCODE='HDN06';END IF;
 IF (SELECT count(*) FROM helpdesk_core.cg_ticket_resource_refs x WHERE (x.workspace_id,x.account_id,x.ticket_id)=(w,a,ticket))<>s.expected_count THEN RAISE EXCEPTION 'Incomplete sealed internal resources' USING ERRCODE='HDN06';END IF;
 FOR ref IN SELECT x.resource_type,x.resource_id FROM helpdesk_core.cg_ticket_resource_refs x WHERE (x.workspace_id,x.account_id,x.ticket_id)=(w,a,ticket) ORDER BY x.resource_type,x.resource_id FOR SHARE LOOP
  IF ref.resource_type<>'work' OR NOT ref.resource_id=ANY(p.work_ids) THEN RETURN false;END IF;
  PERFORM 1 FROM helpdesk_auth.cg_local_works x WHERE x.workspace_id=w AND x.account_id=a AND x.id=ref.resource_id AND x.active AND x.registry_revision=r.revision FOR SHARE;
  IF NOT FOUND THEN RETURN false;END IF;
 END LOOP;RETURN true;
EXCEPTION WHEN no_data_found OR data_exception THEN RAISE EXCEPTION 'Internal authority unavailable' USING ERRCODE='HDN06';END$$;

-- Private review state. Only qualified request RPCs may produce rows.
CREATE TABLE helpdesk_core.hdnr_forms(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>1),source_version integer NOT NULL CHECK(source_version>1),
 document jsonb NOT NULL,sha256 text NOT NULL CHECK(sha256=helpdesk_auth.hdni_digest(document)),receipt_id uuid NOT NULL,
 PRIMARY KEY(workspace_id,account_id,ticket_id,revision),UNIQUE(workspace_id,account_id,ticket_id,source_version),
 FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.tickets(workspace_id,account_id,id),
 CHECK(helpdesk_auth.hdn_cfg_object(document,ARRAY['formId','formVersion','schemaHash','revision','answers','publicAnswers','evidence','draftId','draftRevision']) AND document->'revision'=to_jsonb(revision)));
CREATE TABLE helpdesk_core.hdnr_invitations(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,receipt_id uuid NOT NULL,document jsonb NOT NULL,revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 UNIQUE(workspace_id,account_id,ticket_id,id),FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.tickets(workspace_id,account_id,id),
 CHECK(helpdesk_auth.hdn_cfg_object(document,ARRAY['id','ticketId','workspaceId','accountId','approverId','policyVersionId','ticketVersion','formRevision','targetHash','status','createdAt','expiresAt','challenge'])
  AND document->>'id'=id::text AND document->>'ticketId'=ticket_id::text AND document->>'workspaceId'=workspace_id::text AND document->>'accountId'=account_id::text
  AND document->>'status' IN ('pending','used','revoked') AND document->>'targetHash'~'^[a-f0-9]{64}$'));
CREATE UNIQUE INDEX hdnr_one_pending_invitation ON helpdesk_core.hdnr_invitations(workspace_id,account_id,ticket_id) WHERE document->>'status'='pending';
CREATE TABLE helpdesk_audit.hdnr_receipts(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),
 intent_key text NOT NULL CHECK(intent_key~'^[A-Za-z0-9._:-]{16,128}$'),intent_hash text NOT NULL CHECK(intent_hash~'^[a-f0-9]{64}$'),action text NOT NULL CHECK(action IN ('invitation','approval','revision')),
 invitation_id uuid,result jsonb NOT NULL,bundle jsonb NOT NULL,scope jsonb NOT NULL,request_id uuid NOT NULL,created_at timestamptz NOT NULL CHECK(isfinite(created_at)),transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
 UNIQUE(workspace_id,actor_id,intent_key),UNIQUE(workspace_id,account_id,ticket_id,id),FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.tickets(workspace_id,account_id,id));
CREATE TABLE helpdesk_integration.hdnr_sources(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,receipt_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('support.approval_requested','support.approval_granted','support.approval_rejected','support.form_revised')),
 source_version integer NOT NULL CHECK(source_version>0),invitation_id uuid,request_id uuid NOT NULL,created_at timestamptz NOT NULL CHECK(isfinite(created_at)),
 UNIQUE(workspace_id,receipt_id),FOREIGN KEY(workspace_id,account_id,ticket_id,receipt_id) REFERENCES helpdesk_audit.hdnr_receipts(workspace_id,account_id,ticket_id,id),
 CHECK((kind='support.approval_requested')=(invitation_id IS NOT NULL)));
ALTER TABLE helpdesk_core.hdnr_forms ADD FOREIGN KEY(workspace_id,account_id,ticket_id,receipt_id) REFERENCES helpdesk_audit.hdnr_receipts(workspace_id,account_id,ticket_id,id);
ALTER TABLE helpdesk_core.hdnr_invitations ADD FOREIGN KEY(workspace_id,account_id,ticket_id,receipt_id) REFERENCES helpdesk_audit.hdnr_receipts(workspace_id,account_id,ticket_id,id);
CREATE TABLE helpdesk_audit.hdnr_challenges(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,invitation_id uuid NOT NULL,generation integer NOT NULL CHECK(generation>0),
 actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),challenge_hash text NOT NULL CHECK(challenge_hash~'^[a-f0-9]{64}$'),expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL,
 target_hash text NOT NULL CHECK(target_hash~'^[a-f0-9]{64}$'),transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(workspace_id,invitation_id,generation),FOREIGN KEY(workspace_id,account_id,ticket_id,invitation_id) REFERENCES helpdesk_core.hdnr_invitations(workspace_id,account_id,ticket_id,id),
 CHECK(isfinite(created_at) AND isfinite(expires_at) AND expires_at>created_at));

CREATE FUNCTION helpdesk_auth.hdnr_scope_hash(ctx jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT helpdesk_auth.hdni_digest(jsonb_build_object('principalId',ctx->'principalId','workspaceId',ctx->'workspaceId','accountId',ctx->'accountId','bindingId',ctx->'bindingId','bindingRevision',ctx->'bindingRevision','accessRevision',ctx->'accessRevision','manifestFingerprint',ctx->'manifestFingerprint','refs',helpdesk_auth.hdni_refs_key(ctx->'refs')))
$$;
CREATE FUNCTION helpdesk_auth.hdnr_target_hash(a jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT helpdesk_auth.hdni_digest(jsonb_build_object('workspaceId',a->'ticket'->'workspaceId','accountId',a->'ticket'->'accountId','ticketId',a->'ticket'->'id','ticketVersion',a->'ticket'->'version','profileVersionId',a->'ticket'->'profileVersionId','requesterId',a->'requesterId','formRevision',a->'form'->'revision','formHash',helpdesk_auth.hdni_digest(jsonb_build_object('formId',a->'form'->'formId','formVersion',a->'form'->'formVersion','schemaHash',a->'form'->'schemaHash','answers',a->'form'->'answers','evidence',a->'form'->'evidence')),'refsHash',helpdesk_auth.hdni_digest(to_jsonb(helpdesk_auth.hdni_refs_key(a->'refs')))))
$$;
CREATE FUNCTION helpdesk_auth.hdnr_aggregate(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE current_doc jsonb;s helpdesk_core.hdni_snapshots%rowtype;r helpdesk_audit.hdni_receipts%rowtype;p helpdesk_core.hdnr_profiles%rowtype;policy helpdesk_core.hdnr_policies%rowtype;
 f helpdesk_core.hdnr_forms%rowtype;form_doc jsonb;events jsonb;event_count integer;distinct_count integer;w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();BEGIN
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
CREATE FUNCTION helpdesk_auth.hdnr_grant(target uuid,cap text,ctx jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE aggregate_doc jsonb;g helpdesk_auth.hdnr_grants%rowtype;ref jsonb;w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();a uuid;BEGIN
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
 RETURN jsonb_build_object('principalId',who,'workspaceId',w,'accountId',a,'capability',cap,'scopeHash',helpdesk_auth.hdnr_scope_hash(ctx),'active',true,'revision','review-grant-'||g.revision::text,'expiresAt',helpdesk_auth.hdn_workflow_iso(g.expires_at));
END$$;
CREATE FUNCTION helpdesk_auth.hdnr_route(target uuid,ctx jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE doc jsonb;roster helpdesk_auth.hdnr_rosters%rowtype;g helpdesk_auth.hdnr_grants%rowtype;ref jsonb;w uuid:=helpdesk_auth.workspace_id();a uuid;BEGIN
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

