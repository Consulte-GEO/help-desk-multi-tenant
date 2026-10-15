-- Additive published approval intake. Immutable v024 migration files remain unchanged.
CREATE FUNCTION helpdesk_auth.hdni_profile_v024(ctx jsonb,form uuid,version integer) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v helpdesk_core.hdn_cfg_versions%rowtype;instance uuid;
BEGIN
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);
 SELECT c.product_instance_id INTO instance FROM helpdesk_auth.cg_resource_connections c WHERE c.workspace_id=helpdesk_auth.workspace_id() AND c.id=(ctx->'refs'->0->>'connectionId')::uuid;
 SELECT * INTO v FROM helpdesk_core.hdn_cfg_versions q WHERE q.workspace_id=helpdesk_auth.workspace_id() AND q.status='published' AND q.version=hdni_profile_v024.version
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(q.artifacts->'entries') e WHERE e->'form'->>'id'=form::text)
 AND EXISTS(SELECT 1 FROM helpdesk_core.product_instances i JOIN helpdesk_core.services s ON (s.workspace_id,s.product_id)=(i.workspace_id,i.product_id) WHERE (i.workspace_id,i.id)=(q.workspace_id,instance) AND s.code=q.definition->>'service') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Published form unavailable' USING ERRCODE='HDI05';END IF;
 PERFORM 1 FROM helpdesk_core.product_instances i JOIN helpdesk_core.services s ON (s.workspace_id,s.product_id)=(i.workspace_id,i.product_id) WHERE (i.workspace_id,i.id)=(v.workspace_id,instance) AND s.code=v.definition->>'service' FOR SHARE OF i,s;
 IF NOT FOUND THEN RAISE EXCEPTION 'Published service unavailable' USING ERRCODE='HDI05';END IF;
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);
 RETURN jsonb_build_object('record',helpdesk_auth.hdn_cfg_record(v),'productInstanceId',instance,'serviceCode',v.definition->>'service');
END$$;

CREATE FUNCTION helpdesk_auth.hdni_profile_document_v024(raw jsonb,form_id uuid) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE entry jsonb;cal jsonb:=raw->'record'->'artifacts'->'calendar';ver int:=(raw->'record'->>'version')::int;policy text:='cg-sla-'||form_id::text||'-v'||ver;
BEGIN SELECT value INTO entry FROM jsonb_array_elements(raw->'record'->'artifacts'->'entries') WHERE value->'form'->>'id'=form_id::text;
 IF entry IS NULL THEN RAISE EXCEPTION 'Published form missing' USING ERRCODE='HDI05';END IF;
 RETURN jsonb_build_object('status','published','form',entry->'form','productInstanceId',raw->'productInstanceId','serviceCode',raw->'serviceCode','profileVersionId',entry->'workflow'->'versionId','workflow',entry->'workflow','fixedPriority',entry->'priority','impactField','','priorityPolicy',NULL,'initialState','new','approvalRequired',false,'sla',jsonb_build_object('versionId',policy,'status','published','profileVersionId',entry->'workflow'->'versionId','calendar',cal,'firstResponseMicros',entry->'sla'->'firstResponseMicros','solutionMicros',entry->'sla'->'resolutionMicros','startStates',jsonb_build_array('new','triage','open'),'pausedSolutionStates',entry->'sla'->'pauseSolutionStates'));
END$$;

-- Existing app signature and ACL retained. Legacy implementation is copied
-- privately with its self-qualified argument label updated explicitly.
CREATE OR REPLACE FUNCTION helpdesk_auth.hdni_profile(ctx jsonb,form uuid,version integer) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE raw jsonb;binding helpdesk_core.hdnr_profiles%rowtype;policy helpdesk_core.hdnr_policies%rowtype;ref jsonb;BEGIN
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
CREATE OR REPLACE FUNCTION helpdesk_auth.hdni_profile_document(raw jsonb,form_id uuid) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE result jsonb;q jsonb:=raw->'review';BEGIN
 result:=helpdesk_auth.hdni_profile_document_v024(raw-'review',form_id);
 IF NOT raw ? 'review' THEN RETURN result;END IF;
 IF NOT coalesce(helpdesk_auth.hdn_cfg_object(q,ARRAY['formId','formVersion','profileVersionId','schemaHash','configurationHash','policyVersionId','policyHash','approvalRequired'])
  AND q->'formId'=to_jsonb(form_id) AND q->'formVersion'=result->'form'->'version' AND (q->>'formVersion')::integer>=2
  AND q->'profileVersionId'=result->'profileVersionId' AND q->>'schemaHash'=helpdesk_auth.hdni_digest(result->'form')
  AND q->'configurationHash'=raw->'record'->'contentHash' AND q->'approvalRequired'='true'::jsonb
  AND jsonb_typeof(q->'policyVersionId')='string' AND q->>'policyVersionId'~'^[A-Za-z0-9_-]{1,100}$'
  AND jsonb_typeof(q->'policyHash')='string' AND q->>'policyHash'~'^[a-f0-9]{64}$',false)
 THEN RAISE EXCEPTION 'Approval profile descriptor changed' USING ERRCODE='HDI05';END IF;
 RETURN result||jsonb_build_object('initialState','triage','approvalRequired',true);
EXCEPTION WHEN data_exception THEN RAISE EXCEPTION 'Invalid approval profile descriptor' USING ERRCODE='HDI05';END$$;
DO $private$ DECLARE role_name text;BEGIN
 REVOKE ALL ON FUNCTION helpdesk_auth.hdni_profile_v024(jsonb,uuid,integer),helpdesk_auth.hdni_profile_document_v024(jsonb,uuid) FROM PUBLIC;
 FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdni_profile_v024(jsonb,uuid,integer),helpdesk_auth.hdni_profile_document_v024(jsonb,uuid) FROM %I',role_name);END IF;
 END LOOP;
END $private$;


CREATE OR REPLACE FUNCTION helpdesk_auth.hdni_create(ctx jsonb,bundle jsonb,expected integer,receipt jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
<<opening>>
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();a uuid;target uuid;draft_uuid uuid;event_uuid uuid;request_uuid uuid;at_text text;stamp timestamptz;d jsonb;raw_profile jsonb;profile jsonb;answers jsonb;cover jsonb;candidates jsonb;eligible jsonb;clocks jsonb;intent jsonb;prior jsonb;seq text;result jsonb;expected_bundle jsonb;ticket_doc jsonb;form_doc jsonb;workflow_doc jsonb;event_doc jsonb;audit_doc jsonb;outbox_doc jsonb;consumed jsonb;expected_snapshot jsonb;expected_snapshot_hash text;affected int;
BEGIN
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);a:=(ctx->>'accountId')::uuid;
 IF ctx->>'operation'<>'tickets.write' OR octet_length(bundle::text)>1048576 OR NOT coalesce(helpdesk_auth.hdn_cfg_object(receipt,ARRAY['key','hash','result','input']),false) OR NOT coalesce(helpdesk_auth.hdn_cfg_object(receipt->'input',ARRAY['draftId','expectedDraftRevision','subject','description','coverageId','previewHash']),false) THEN RAISE EXCEPTION 'Invalid opening' USING ERRCODE='HDI04';END IF;
 intent:=receipt->'input';draft_uuid:=(intent->>'draftId')::uuid;
 IF intent->'expectedDraftRevision' IS DISTINCT FROM to_jsonb(expected) OR expected NOT BETWEEN 1 AND 2147483646 OR jsonb_typeof(intent->'subject') IS DISTINCT FROM 'string' OR jsonb_typeof(intent->'description') IS DISTINCT FROM 'string' OR length(helpdesk_auth.hdni_trim(intent->>'subject'))<3 OR octet_length(helpdesk_auth.hdni_utf16(helpdesk_auth.hdni_trim(intent->>'description')))/2<1 OR octet_length(helpdesk_auth.hdni_utf16(intent->>'subject'))/2>200 OR octet_length(helpdesk_auth.hdni_utf16(intent->>'description'))/2>12000 OR receipt->>'hash' IS DISTINCT FROM helpdesk_auth.hdni_digest(jsonb_build_object('workspaceId',w,'actorId',who,'input',intent)) THEN RAISE EXCEPTION 'Opening intent changed' USING ERRCODE='HDI04';END IF;
 prior:=helpdesk_auth.hdni_receipt(ctx,receipt->>'key');IF prior IS NOT NULL THEN IF prior->'hash'<>receipt->'hash' THEN RAISE EXCEPTION 'Idempotency conflict' USING ERRCODE='HDI10';END IF;IF NOT helpdesk_auth.hdni_authorize_receipt(ctx,(prior->'result'->>'ticketId')::uuid) THEN RAISE EXCEPTION 'Receipt scope denied' USING ERRCODE='HDI01';END IF;RETURN prior->'result';END IF;
 d:=helpdesk_auth.hdni_draft(ctx,draft_uuid);IF d IS NULL THEN RAISE EXCEPTION 'Draft not found' USING ERRCODE='HDI03';END IF;IF d->>'status'<>'editing' THEN RAISE EXCEPTION 'Draft consumed' USING ERRCODE='HDI07';END IF;IF d->'revision' IS DISTINCT FROM to_jsonb(expected) THEN RAISE EXCEPTION 'Draft CAS failed' USING ERRCODE='HDI02';END IF;
 raw_profile:=helpdesk_auth.hdni_profile(ctx,(d->>'formId')::uuid,(d->>'formVersion')::int);profile:=helpdesk_auth.hdni_profile_document(raw_profile,(d->>'formId')::uuid);
 IF d->>'schemaHash' IS DISTINCT FROM helpdesk_auth.hdni_digest(profile->'form') THEN RAISE EXCEPTION 'Form snapshot changed' USING ERRCODE='HDI04';END IF;
 answers:=helpdesk_auth.hdni_answers(profile->'form',d->'answers');
 candidates:=helpdesk_auth.hdni_coverages(ctx,(profile->>'productInstanceId')::uuid,profile->>'serviceCode');
 SELECT coalesce(jsonb_agg(value),'[]') INTO eligible FROM jsonb_array_elements(candidates) WHERE value->'enabled'='true'::jsonb AND value->'published'='true'::jsonb AND value->>'contractStatus'='active' AND (value->>'validFrom')::timestamptz<=clock_timestamp() AND (value->'validUntil'='null'::jsonb OR (value->>'validUntil')::timestamptz>clock_timestamp());
 IF intent->'coverageId'='null'::jsonb THEN IF jsonb_array_length(eligible)=1 THEN cover:=eligible->0;END IF;ELSE SELECT value INTO cover FROM jsonb_array_elements(eligible) WHERE value->'id'=intent->'coverageId';END IF;
 IF cover IS NULL THEN RAISE EXCEPTION 'Coverage unavailable' USING ERRCODE='HDI11';END IF;
 IF intent->>'previewHash' IS DISTINCT FROM helpdesk_auth.hdni_digest(jsonb_build_object('draftId',d->'id','draftRevision',d->'revision','answers',answers,'subject',intent->'subject','description',intent->'description','profile',profile,'coverage',cover,'evidence','[]'::jsonb)) THEN RAISE EXCEPTION 'Preview changed' USING ERRCODE='HDI09';END IF;
 target:=(receipt->'result'->>'ticketId')::uuid;event_uuid:=(bundle->'audit'->>'id')::uuid;request_uuid:=(bundle->'audit'->>'requestId')::uuid;at_text:=receipt->'result'->>'createdAt';stamp:=at_text::timestamptz;
 IF at_text !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3}(\d{3})?)?Z$' OR stamp>clock_timestamp() OR stamp<clock_timestamp()-interval '30 seconds' THEN RAISE EXCEPTION 'Opening timestamp invalid' USING ERRCODE='HDI04';END IF;
 seq:=helpdesk_auth.hdni_allocate_protocol(ctx);
 result:=jsonb_build_object('ticketId',target,'protocol','CG-'||seq,'sequence',seq,'workspaceId',w,'accountId',a,'actorId',who,'requesterId',who,'draftId',draft_uuid,'draftRevision',expected,'version',1,'profileVersionId',profile->'profileVersionId','formId',d->'formId','formVersion',d->'formVersion','priority',profile->'fixedPriority','createdAt',at_text,'notification','pending','replayed',false);
 IF receipt->'result' IS DISTINCT FROM result THEN RAISE EXCEPTION 'Receipt forged' USING ERRCODE='HDI04';END IF;
 ticket_doc:=jsonb_build_object('id',target,'workspaceId',w,'accountId',a,'productInstanceId',profile->'productInstanceId','serviceCode',profile->'serviceCode','createdBy',who,'assignedTo',NULL,'subject',intent->'subject','description',intent->'description','status',profile->'initialState','priority',profile->'fixedPriority','version',1,'coverageId',cover->'id','contractVersionId',cover->'contractVersionId','contractSnapshot',jsonb_build_object('contractId',cover->'contractId','version',cover->'contractVersion','policy',cover->'policy'),'createdAt',at_text,'updatedAt',at_text);
 form_doc:=jsonb_build_object('formId',d->'formId','formVersion',d->'formVersion','schemaHash',d->'schemaHash','answers',answers,'publicAnswers',answers,'evidence','[]'::jsonb);
 workflow_doc:=jsonb_build_object('profileVersionId',profile->'profileVersionId','slaPolicyVersionId',profile->'sla'->'versionId','calendarVersionId',profile->'sla'->'calendar'->'versionId','approval',CASE WHEN profile->'approvalRequired'='true'::jsonb THEN 'pending' ELSE 'not_required' END);
 event_doc:=jsonb_build_object('ticketId',target,'workspaceId',w,'profileVersionId',profile->'profileVersionId','sequence',1,'at',at_text,'type','created','actorId',who,'actorKind','customer','from',NULL,'to',profile->'initialState');clocks:=helpdesk_auth.hdni_initial_clocks(profile,target,w,at_text);
 audit_doc:=jsonb_build_object('id',event_uuid,'actorId',who,'requestId',request_uuid,'at',at_text,'action','support.created','draftId',draft_uuid,'ticketId',target);
 outbox_doc:=jsonb_build_object('id',event_uuid,'workspaceId',w,'accountId',a,'ticketId',target,'type','support.created','version',1,'requestId',request_uuid,'createdAt',at_text);
 expected_bundle:=jsonb_build_object('draftId',draft_uuid,'resourceScope',ctx,'ticket',ticket_doc,'requesterId',who,'participants','[]'::jsonb,'protocol','CG-'||seq,'sequence',seq,'form',form_doc,'workflow',workflow_doc,'event',event_doc,'delegation',NULL,'clocks',clocks,'audit',audit_doc,'outbox',outbox_doc);
 IF bundle IS DISTINCT FROM expected_bundle THEN RAISE EXCEPTION 'Opening bundle changed' USING ERRCODE='HDI04';END IF;
 PERFORM 1 FROM helpdesk_core.hdn_workflow_profiles q WHERE (q.workspace_id,q.version_id,q.document)=(w,profile->>'profileVersionId',profile->'workflow') FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Published workflow absent' USING ERRCODE='HDI05';END IF;
 UPDATE helpdesk_core.hdni_protocol_counters SET last_sequence=seq::bigint WHERE workspace_id=w AND last_sequence=seq::bigint-1;GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Counter suppressed' USING ERRCODE='HDI08';END IF;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_core.hdni_protocol_counters q WHERE (q.workspace_id,q.last_sequence)=(w,seq::bigint)) THEN RAISE EXCEPTION 'Counter changed during persistence' USING ERRCODE='HDI08';END IF;
 IF profile->'approvalRequired'='true'::jsonb THEN
  INSERT INTO helpdesk_audit.hdnr_openings(workspace_id,account_id,ticket_id,actor_id,profile_version_id,ticket_hash,profile_hash,snapshot_hash)
  VALUES(w,a,target,who,profile->>'profileVersionId',helpdesk_auth.hdni_digest(ticket_doc),helpdesk_auth.hdni_digest(profile),helpdesk_auth.hdni_digest(jsonb_build_object('schema',1,'bundle',bundle,'profile',profile,'coverage',cover,'draft',d,'receipt',result)));
 END IF;
 INSERT INTO helpdesk_core.tickets(workspace_id,account_id,id,product_instance_id,service_code,created_by,subject,description,status,priority,version,coverage_id,contract_version_id,contract_snapshot,created_at,updated_at,assigned_to) VALUES(w,a,target,(profile->>'productInstanceId')::uuid,profile->>'serviceCode',who,intent->>'subject',intent->>'description',profile->>'initialState',profile->>'fixedPriority',1,(cover->>'id')::uuid,(cover->>'contractVersionId')::uuid,ticket_doc->'contractSnapshot',stamp,stamp,NULL);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Ticket suppressed' USING ERRCODE='HDI08';END IF;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_core.tickets t WHERE (t.workspace_id,t.account_id,t.id,t.created_by,t.product_instance_id,t.service_code,t.subject,t.description,t.coverage_id,t.contract_version_id,t.contract_snapshot,t.created_at,t.updated_at,t.version,t.status,t.priority)=(w,a,target,who,(ticket_doc->>'productInstanceId')::uuid,ticket_doc->>'serviceCode',ticket_doc->>'subject',ticket_doc->>'description',(ticket_doc->>'coverageId')::uuid,(ticket_doc->>'contractVersionId')::uuid,ticket_doc->'contractSnapshot',stamp,stamp,1,profile->>'initialState',ticket_doc->>'priority') AND t.assigned_to IS NULL) THEN RAISE EXCEPTION 'Ticket changed during persistence' USING ERRCODE='HDI08';END IF;
 INSERT INTO helpdesk_core.cg_ticket_resource_sets(workspace_id,account_id,ticket_id,binding_id,expected_count) VALUES(w,a,target,(ctx->>'bindingId')::uuid,jsonb_array_length(ctx->'refs'));GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Selection suppressed' USING ERRCODE='HDI08';END IF;
 INSERT INTO helpdesk_core.cg_ticket_resource_refs(workspace_id,account_id,ticket_id,resource_type,resource_id) SELECT w,a,target,value->>'type',value->>'id' FROM jsonb_array_elements(ctx->'refs');GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>jsonb_array_length(ctx->'refs') THEN RAISE EXCEPTION 'References suppressed' USING ERRCODE='HDI08';END IF;
 UPDATE helpdesk_core.cg_ticket_resource_sets SET sealed=true WHERE (workspace_id,account_id,ticket_id)=(w,a,target);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Seal suppressed' USING ERRCODE='HDI08';END IF;
 INSERT INTO helpdesk_core.hdn_workflow_state(workspace_id,account_id,ticket_id,profile_version_id,approval,last_event_at) VALUES(w,a,target,profile->>'profileVersionId',CASE WHEN profile->'approvalRequired'='true'::jsonb THEN 'pending' ELSE 'not_required' END,stamp);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Workflow suppressed' USING ERRCODE='HDI08';END IF;
 expected_snapshot:=jsonb_build_object('schema',1,'bundle',bundle,'profile',profile,'coverage',cover,'draft',d,'receipt',result);expected_snapshot_hash:=helpdesk_auth.hdni_digest(expected_snapshot);
 INSERT INTO helpdesk_core.hdni_snapshots(workspace_id,account_id,ticket_id,document) VALUES(w,a,target,expected_snapshot);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Snapshot suppressed' USING ERRCODE='HDI08';END IF;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_core.hdni_snapshots q WHERE (q.workspace_id,q.account_id,q.ticket_id,q.document)=(w,a,target,expected_snapshot)) THEN RAISE EXCEPTION 'Snapshot changed during persistence' USING ERRCODE='HDI08';END IF;
 INSERT INTO helpdesk_core.ticket_events(workspace_id,account_id,ticket_id,id,actor_id,type,customer_visible,data,created_at) VALUES(w,a,target,event_uuid,who,'ticket.created',true,'{"version":1}',stamp);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Event suppressed' USING ERRCODE='HDI08';END IF;
 INSERT INTO helpdesk_audit.audit_events(workspace_id,id,principal_id,action,resource_id,request_id,created_at) VALUES(w,event_uuid,who,'support.created',target,request_uuid::text,stamp);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Audit suppressed' USING ERRCODE='HDI08';END IF;
 INSERT INTO helpdesk_integration.outbox_events(workspace_id,account_id,ticket_id,id,type,payload,request_id,created_at) VALUES(w,a,target,event_uuid,'ticket.created',jsonb_build_object('specversion','1.0','id',event_uuid,'source','helpdesk/workspaces/'||w::text,'type','com.helpdesk.ticket.created.v1','subject','tickets/'||target::text,'datacontenttype','application/json','time',at_text,'data',jsonb_build_object('ticket_id',target,'version',1)),request_uuid::text,stamp);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Email queue suppressed' USING ERRCODE='HDI08';END IF;
 INSERT INTO helpdesk_audit.hdni_receipts(workspace_id,account_id,actor_id,intent_key,intent_hash,ticket_id,draft_id,draft_revision,event_id,sequence,scope,result,snapshot_hash) VALUES(w,a,who,receipt->>'key',receipt->>'hash',target,draft_uuid,expected,event_uuid,seq::bigint,ctx,result,expected_snapshot_hash);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Receipt suppressed' USING ERRCODE='HDI08';END IF;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_audit.hdni_receipts q WHERE (q.workspace_id,q.account_id,q.actor_id,q.intent_key,q.intent_hash,q.ticket_id,q.draft_id,q.draft_revision,q.event_id,q.sequence,q.scope,q.result,q.snapshot_hash,q.transaction_id)=(w,a,who,receipt->>'key',receipt->>'hash',target,draft_uuid,expected,event_uuid,seq::bigint,ctx,opening.result,expected_snapshot_hash,pg_current_xact_id())) THEN RAISE EXCEPTION 'Receipt changed during persistence' USING ERRCODE='HDI08';END IF;
 consumed:=d||jsonb_build_object('revision',expected+1,'status','committed','ticketId',target);
 UPDATE helpdesk_core.hdni_drafts SET revision=expected+1,document=consumed WHERE (workspace_id,id,revision)=(w,draft_uuid,expected);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Draft consumption suppressed' USING ERRCODE='HDI08';END IF;
 INSERT INTO helpdesk_audit.hdni_draft_commits(workspace_id,draft_id,revision,actor_id,scope,document) VALUES(w,draft_uuid,expected+1,who,ctx,consumed);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Consumption audit suppressed' USING ERRCODE='HDI08';END IF;
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);RETURN result;
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR numeric_value_out_of_range THEN RAISE EXCEPTION 'Invalid opening' USING ERRCODE='HDI04';
END$$;

CREATE OR REPLACE FUNCTION helpdesk_auth.hdni_opening_effect() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE snap jsonb;ticket_doc jsonb;opening_request_nonce text;stamp timestamptz;draft_expiry timestamptz;
BEGIN
 PERFORM helpdesk_auth.hdni_lock_scope(NEW.scope);
 SELECT document INTO snap FROM helpdesk_core.hdni_snapshots WHERE (workspace_id,ticket_id,account_id)=(NEW.workspace_id,NEW.ticket_id,NEW.account_id);ticket_doc:=snap->'bundle'->'ticket';opening_request_nonce:=snap->'bundle'->'audit'->>'requestId';stamp:=(ticket_doc->>'createdAt')::timestamptz;
 IF snap IS NULL OR ticket_doc->'status' IS DISTINCT FROM snap->'profile'->'initialState' OR NEW.snapshot_hash IS DISTINCT FROM helpdesk_auth.hdni_digest(snap) OR NEW.result IS DISTINCT FROM snap->'receipt' OR NEW.sequence::text IS DISTINCT FROM NEW.result->>'sequence'
 OR NOT EXISTS(SELECT 1 FROM helpdesk_core.tickets t WHERE (t.workspace_id,t.account_id,t.id,t.created_by,t.product_instance_id,t.service_code,t.subject,t.description,t.coverage_id,t.contract_version_id,t.contract_snapshot,t.created_at,t.updated_at,t.version,t.status,t.priority)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.actor_id,(ticket_doc->>'productInstanceId')::uuid,ticket_doc->>'serviceCode',ticket_doc->>'subject',ticket_doc->>'description',(ticket_doc->>'coverageId')::uuid,(ticket_doc->>'contractVersionId')::uuid,ticket_doc->'contractSnapshot',stamp,stamp,1,snap->'profile'->>'initialState',ticket_doc->>'priority') AND t.assigned_to IS NULL)
 OR NOT EXISTS(SELECT 1 FROM helpdesk_core.ticket_events e JOIN helpdesk_integration.outbox_events o ON (o.workspace_id,o.account_id,o.ticket_id,o.id,o.type)=(e.workspace_id,e.account_id,e.ticket_id,e.id,e.type) JOIN helpdesk_audit.write_effects f ON (f.workspace_id,f.event_id)=(e.workspace_id,e.id) WHERE (e.workspace_id,e.account_id,e.ticket_id,e.id,e.actor_id,e.type,e.data,e.created_at)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.event_id,NEW.actor_id,'ticket.created','{"version":1}'::jsonb,stamp) AND e.customer_visible AND f.applied AND f.transaction_id=NEW.transaction_id AND f.ticket_version=1 AND o.request_id=opening_request_nonce)
 OR NOT EXISTS(SELECT 1 FROM helpdesk_audit.audit_events a WHERE (a.workspace_id,a.id,a.principal_id,a.action,a.resource_id,a.request_id,a.created_at)=(NEW.workspace_id,NEW.event_id,NEW.actor_id,'support.created',NEW.ticket_id,opening_request_nonce,stamp))
 OR NOT EXISTS(SELECT 1 FROM helpdesk_core.hdn_workflow_state s WHERE (s.workspace_id,s.account_id,s.ticket_id,s.profile_version_id,s.approval)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.result->>'profileVersionId',CASE WHEN snap->'profile'->'approvalRequired'='true'::jsonb THEN 'pending' ELSE 'not_required' END) AND s.last_event_at>=stamp)
 OR NOT EXISTS(SELECT 1 FROM helpdesk_core.cg_ticket_resource_sets s WHERE (s.workspace_id,s.account_id,s.ticket_id,s.binding_id,s.expected_count,s.sealed)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,(NEW.scope->>'bindingId')::uuid,jsonb_array_length(NEW.scope->'refs'),true))
 OR (SELECT count(*) FROM helpdesk_core.cg_ticket_resource_refs r WHERE (r.workspace_id,r.account_id,r.ticket_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id))<>jsonb_array_length(NEW.scope->'refs')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.scope->'refs') ref WHERE NOT EXISTS(SELECT 1 FROM helpdesk_core.cg_ticket_resource_refs r WHERE (r.workspace_id,r.account_id,r.ticket_id,r.resource_type,r.resource_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,ref->>'type',ref->>'id')))
 OR NOT EXISTS(SELECT 1 FROM helpdesk_core.hdni_protocol_counters c WHERE c.workspace_id=NEW.workspace_id AND c.last_sequence>=NEW.sequence)
 THEN RAISE EXCEPTION 'Opening effect incomplete' USING ERRCODE='23514';END IF;
 SELECT expires_at INTO draft_expiry FROM helpdesk_core.hdni_drafts d WHERE (d.workspace_id,d.id,d.owner_id,d.revision)=(NEW.workspace_id,NEW.draft_id,NEW.actor_id,NEW.draft_revision+1) AND d.document->>'status'='committed' AND d.document->>'ticketId'=NEW.ticket_id::text;
 IF draft_expiry IS NULL OR draft_expiry<=clock_timestamp() THEN RAISE EXCEPTION 'Draft effect missing or expired' USING ERRCODE='HDI06';END IF;
 IF snap->'coverage'->>'validUntil' IS NOT NULL AND (snap->'coverage'->>'validUntil')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'Coverage expired before commit' USING ERRCODE='HDI11';END IF;
 RETURN NULL;
END$$;
