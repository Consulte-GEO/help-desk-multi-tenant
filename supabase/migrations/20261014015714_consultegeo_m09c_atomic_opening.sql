-- Consulte GEO M09c: atomic opening, pinned snapshot, event, email queue and receipt.
-- No provider call or external GEO write.
BEGIN;
SET LOCAL statement_timeout='120s';
SET LOCAL lock_timeout='10s';
DO $m09c$
DECLARE who oid:=current_user::regrole;
BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 OR current_user<>session_user
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=who AND (rolsuper OR rolbypassrls) AND rolcreaterole)
 OR (SELECT count(*) FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND nspowner=who)<>4
 THEN RAISE EXCEPTION 'Reviewed operator required' USING ERRCODE='HDU01'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('Consulte GEO schema upgrade',0));
 IF helpdesk_auth.schema_version() IS DISTINCT FROM '0.22.0' THEN RAISE EXCEPTION 'Exact prior schema required' USING ERRCODE='HDU02'; END IF;
 IF to_regclass('helpdesk_core.hdni_snapshots') IS NOT NULL OR to_regclass('helpdesk_audit.hdni_receipts') IS NOT NULL OR to_regclass('helpdesk_core.hdni_protocol_counters') IS NOT NULL THEN RAISE EXCEPTION 'Partial installation refused' USING ERRCODE='HDU03';END IF;
 IF EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE d.defaclrole=who
 AND (d.defaclnamespace=0 OR d.defaclnamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')))
 AND a.grantee<>who AND NOT (a.grantee=0 AND d.defaclobjtype='f' AND a.privilege_type='EXECUTE')) THEN RAISE EXCEPTION 'Unsafe defaults refused' USING ERRCODE='HDU05'; END IF;
END $m09c$;


CREATE TABLE helpdesk_core.hdni_protocol_counters(
 workspace_id uuid CONSTRAINT hdni_counter_workspace_fk REFERENCES helpdesk_core.workspaces(id),last_sequence bigint NOT NULL,
 CONSTRAINT hdni_counter_pk PRIMARY KEY(workspace_id),CONSTRAINT hdni_counter_sequence_ck CHECK(last_sequence BETWEEN 10000 AND 999999999999999999));
CREATE TABLE helpdesk_core.hdni_snapshots(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,document jsonb NOT NULL,
 CONSTRAINT hdni_snapshots_pk PRIMARY KEY(workspace_id,ticket_id),CONSTRAINT hdni_snapshots_ticket_fk FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.tickets(workspace_id,account_id,id),
 CONSTRAINT hdni_snapshots_document_ck CHECK(jsonb_typeof(document)='object' AND octet_length(document::text)<=1048576));
CREATE TABLE helpdesk_audit.hdni_receipts(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,actor_id uuid NOT NULL CONSTRAINT hdni_receipts_actor_fk REFERENCES helpdesk_auth.principals(id),intent_key text NOT NULL,intent_hash text NOT NULL,
 ticket_id uuid NOT NULL,draft_id uuid NOT NULL,draft_revision integer NOT NULL,event_id uuid NOT NULL,sequence bigint NOT NULL,scope jsonb NOT NULL,result jsonb NOT NULL,snapshot_hash text NOT NULL,transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
 CONSTRAINT hdni_receipts_pk PRIMARY KEY(workspace_id,actor_id,intent_key),CONSTRAINT hdni_receipts_ticket_uk UNIQUE(workspace_id,ticket_id),CONSTRAINT hdni_receipts_draft_uk UNIQUE(workspace_id,draft_id),CONSTRAINT hdni_receipts_sequence_uk UNIQUE(workspace_id,sequence),
 CONSTRAINT hdni_receipts_ticket_fk FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.tickets(workspace_id,account_id,id),CONSTRAINT hdni_receipts_draft_fk FOREIGN KEY(workspace_id,draft_id) REFERENCES helpdesk_core.hdni_drafts(workspace_id,id),
 CONSTRAINT hdni_receipts_intent_ck CHECK(intent_key ~ '^[A-Za-z0-9._:-]{16,128}$' AND intent_hash ~ '^[a-f0-9]{64}$'),CONSTRAINT hdni_receipts_sequence_ck CHECK(sequence BETWEEN 10001 AND 999999999999999999),CONSTRAINT hdni_receipts_revision_ck CHECK(draft_revision>0),CONSTRAINT hdni_receipts_snapshot_ck CHECK(snapshot_hash ~ '^[a-f0-9]{64}$'));
ALTER TABLE helpdesk_core.hdni_protocol_counters ENABLE ROW LEVEL SECURITY;ALTER TABLE helpdesk_core.hdni_protocol_counters FORCE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_core.hdni_snapshots ENABLE ROW LEVEL SECURITY;ALTER TABLE helpdesk_core.hdni_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_audit.hdni_receipts ENABLE ROW LEVEL SECURITY;ALTER TABLE helpdesk_audit.hdni_receipts FORCE ROW LEVEL SECURITY;

-- Current published configuration is mapped independently of the application bundle.
CREATE FUNCTION helpdesk_auth.hdni_profile_document(raw jsonb,form_id uuid) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE entry jsonb;cal jsonb:=raw->'record'->'artifacts'->'calendar';ver int:=(raw->'record'->>'version')::int;policy text:='cg-sla-'||form_id::text||'-v'||ver;
BEGIN SELECT value INTO entry FROM jsonb_array_elements(raw->'record'->'artifacts'->'entries') WHERE value->'form'->>'id'=form_id::text;
 IF entry IS NULL THEN RAISE EXCEPTION 'Published form missing' USING ERRCODE='HDI05';END IF;
 RETURN jsonb_build_object('status','published','form',entry->'form','productInstanceId',raw->'productInstanceId','serviceCode',raw->'serviceCode','profileVersionId',entry->'workflow'->'versionId','workflow',entry->'workflow','fixedPriority',entry->'priority','impactField','','priorityPolicy',NULL,'initialState','new','approvalRequired',false,'sla',jsonb_build_object('versionId',policy,'status','published','profileVersionId',entry->'workflow'->'versionId','calendar',cal,'firstResponseMicros',entry->'sla'->'firstResponseMicros','solutionMicros',entry->'sla'->'resolutionMicros','startStates',jsonb_build_array('new','triage','open'),'pausedSolutionStates',entry->'sla'->'pauseSolutionStates'));
END$$;
CREATE FUNCTION helpdesk_auth.hdni_trim(v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT btrim(v,E' \t\n\r\f'||chr(11)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279))$$;
CREATE FUNCTION helpdesk_auth.hdni_answers(form jsonb,answers jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE f jsonb;v jsonb;out jsonb:='{}';k text;visible boolean;trim_chars text:=E' \t\n\r\f'||chr(11)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279);
BEGIN
 IF NOT coalesce(helpdesk_auth.hdni_draft_values(form,answers),false) THEN RAISE EXCEPTION 'Invalid answers' USING ERRCODE='HDI04';END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(form->'fields') LOOP
  k:=f->>'key';v:=answers->k;visible:=f->'public'='true'::jsonb AND (NOT f ? 'when' OR out->(f->'when'->>'field')=f->'when'->'equals');
  IF NOT coalesce(visible,false) OR f->>'type' IN ('info','download') THEN CONTINUE;END IF;
  IF v IS NULL OR v IN ('null'::jsonb,'""'::jsonb,'[]'::jsonb) THEN IF f->'required'='true'::jsonb THEN RAISE EXCEPTION 'Required answer missing' USING ERRCODE='HDI04';END IF;CONTINUE;END IF;
  CASE f->>'type'
  WHEN 'text','textarea' THEN IF jsonb_typeof(v)<>'string' OR octet_length(helpdesk_auth.hdni_utf16(v#>>'{}'))/2>(f->'config'->>'maxLength')::int OR octet_length(helpdesk_auth.hdni_utf16(btrim(v#>>'{}',trim_chars)))/2<coalesce((f->'config'->>'minLength')::int,CASE WHEN f->'required'='true'::jsonb THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'Invalid text' USING ERRCODE='HDI04';END IF;
  WHEN 'boolean' THEN IF jsonb_typeof(v)<>'boolean' THEN RAISE EXCEPTION 'Invalid boolean' USING ERRCODE='HDI04';END IF;
  WHEN 'select' THEN IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'config'->'options') o WHERE o->'value'=v) THEN RAISE EXCEPTION 'Invalid option' USING ERRCODE='HDI04';END IF;
  WHEN 'file','lookup' THEN RAISE EXCEPTION 'Unqualified evidence denied' USING ERRCODE='HDI12';
  ELSE RAISE EXCEPTION 'Unqualified form type' USING ERRCODE='HDI04';END CASE;
  out:=out||jsonb_build_object(k,v);
 END LOOP;RETURN out;
END$$;
CREATE FUNCTION helpdesk_auth.hdni_due(cal jsonb,at_text text,budget_text text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE at_time timestamptz:=at_text::timestamptz;amount bigint:=budget_text::bigint;pair jsonb;start_time timestamptz;end_time timestamptz;available bigint;
BEGIN
 IF at_time<(cal->>'from')::timestamptz OR at_time>(cal->>'until')::timestamptz OR amount<0 THEN RAISE EXCEPTION 'Calendar horizon exceeded' USING ERRCODE='HDI08';END IF;
 IF amount=0 THEN RETURN helpdesk_auth.hdn_workflow_iso(at_time);END IF;
 FOR pair IN SELECT value FROM jsonb_array_elements(cal->'intervals') LOOP
  start_time:=(pair->>0)::timestamptz;end_time:=(pair->>1)::timestamptz;IF end_time<=at_time THEN CONTINUE;END IF;at_time:=greatest(at_time,start_time);available:=(extract(epoch FROM end_time-at_time)*1000000)::bigint;
  IF amount<=available THEN RETURN helpdesk_auth.hdn_workflow_iso(at_time+amount*interval '1 microsecond');END IF;amount:=amount-available;at_time:=end_time;
 END LOOP;RETURN NULL;
END$$;
CREATE FUNCTION helpdesk_auth.hdni_initial_clocks(profile jsonb,target uuid,w uuid,at_text text) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE policy jsonb:=profile->'sla';kind text;due text;out jsonb:=jsonb_build_object('ticketId',target,'workspaceId',w,'sourceVersion',1,'policyVersionId',policy->'versionId','calendarVersionId',policy->'calendar'->'versionId','asOf',at_text);
BEGIN FOREACH kind IN ARRAY ARRAY['firstResponse','solution'] LOOP
 due:=helpdesk_auth.hdni_due(policy->'calendar',at_text,CASE WHEN kind='firstResponse' THEN policy->>'firstResponseMicros' ELSE policy->>'solutionMicros' END);
 out:=out||jsonb_build_object(kind,jsonb_build_object('started',true,'completed',false,'cancelled',false,'dueAt',due,'consumedMicros','0','policyVersionId',policy->'versionId','violation',false,'reason',CASE WHEN due IS NULL THEN 'calendar_horizon' ELSE NULL END));END LOOP;RETURN out;
END$$;
CREATE FUNCTION helpdesk_auth.hdni_coverages(ctx jsonb,instance uuid,service text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE native_instance uuid;answer jsonb;
BEGIN PERFORM helpdesk_auth.hdni_lock_scope(ctx);SELECT c.product_instance_id INTO native_instance FROM helpdesk_auth.cg_resource_connections c WHERE (c.workspace_id,c.id)=(helpdesk_auth.workspace_id(),(ctx->'refs'->0->>'connectionId')::uuid);
 IF native_instance IS DISTINCT FROM instance THEN RAISE EXCEPTION 'Product scope denied' USING ERRCODE='HDI01';END IF;
 SELECT coalesce(jsonb_agg(value ORDER BY value->>'id'),'[]') INTO answer FROM helpdesk_auth.locked_coverages(helpdesk_auth.workspace_id(),(ctx->>'accountId')::uuid,instance,service) value;
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);RETURN answer;
END$$;
CREATE FUNCTION helpdesk_auth.hdni_receipt(ctx jsonb,key text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE r helpdesk_audit.hdni_receipts%rowtype;
BEGIN PERFORM helpdesk_auth.hdni_lock_scope(ctx);IF ctx->>'operation'<>'tickets.write' OR key IS NULL OR key !~ '^[A-Za-z0-9._:-]{16,128}$' THEN RAISE EXCEPTION 'Invalid receipt request' USING ERRCODE='HDI04';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(helpdesk_auth.workspace_id()::text||':intake-key:'||helpdesk_auth.actor_id()::text||':'||key,0));
 SELECT * INTO r FROM helpdesk_audit.hdni_receipts q WHERE (q.workspace_id,q.actor_id,q.intent_key)=(helpdesk_auth.workspace_id(),helpdesk_auth.actor_id(),key);
 IF NOT FOUND THEN RETURN NULL;END IF;IF r.account_id IS DISTINCT FROM (ctx->>'accountId')::uuid THEN RAISE EXCEPTION 'Receipt scope changed' USING ERRCODE='HDI01';END IF;
 RETURN jsonb_build_object('key',r.intent_key,'hash',r.intent_hash,'result',r.result);
END$$;
CREATE FUNCTION helpdesk_auth.hdni_authorize_receipt(ctx jsonb,target uuid) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE stored_refs jsonb;r helpdesk_audit.hdni_receipts%rowtype;
BEGIN PERFORM helpdesk_auth.hdni_lock_scope(ctx);SELECT * INTO r FROM helpdesk_audit.hdni_receipts WHERE (workspace_id,ticket_id,actor_id)=(helpdesk_auth.workspace_id(),target,helpdesk_auth.actor_id());
 IF NOT FOUND OR r.account_id IS DISTINCT FROM (ctx->>'accountId')::uuid THEN RETURN false;END IF;
 stored_refs:=helpdesk_auth.cg_lock_ticket_scope(target,'tickets.write');
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);
 RETURN coalesce(stored_refs->>'bindingId'=ctx->>'bindingId' AND helpdesk_auth.hdni_refs_key(stored_refs->'refs')=helpdesk_auth.hdni_refs_key(ctx->'refs'),false);
END$$;
-- Lock without persistent reservation. An isolated allocator call never advances the counter.
CREATE FUNCTION helpdesk_auth.hdni_allocate_protocol(ctx jsonb) RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE next_value bigint;
BEGIN PERFORM helpdesk_auth.hdni_lock_scope(ctx);IF ctx->>'operation'<>'tickets.write' THEN RAISE EXCEPTION 'Write scope denied' USING ERRCODE='HDI01';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(helpdesk_auth.workspace_id()::text||':intake-protocol',0));
 SELECT last_sequence+1 INTO next_value FROM helpdesk_core.hdni_protocol_counters WHERE workspace_id=helpdesk_auth.workspace_id() FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Legacy protocol boundary not configured' USING ERRCODE='HDI08';END IF;
 IF next_value>999999999999999999 THEN RAISE EXCEPTION 'Protocol exhausted' USING ERRCODE='HDI08';END IF;PERFORM helpdesk_auth.hdni_lock_scope(ctx);RETURN next_value::text;
END$$;
CREATE OR REPLACE FUNCTION helpdesk_auth.hdni_draft(ctx jsonb,target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE d helpdesk_core.hdni_drafts%rowtype;
BEGIN
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);
 -- Covers absent-row inserts and CAS with the same lock. No actor-specific lock key.
 PERFORM pg_advisory_xact_lock(hashtextextended(helpdesk_auth.workspace_id()::text||':draft:'||target::text,0));
 SELECT * INTO d FROM helpdesk_core.hdni_drafts WHERE workspace_id=helpdesk_auth.workspace_id() AND id=target FOR UPDATE;
 IF NOT FOUND THEN PERFORM helpdesk_auth.hdni_lock_scope(ctx);RETURN NULL;END IF;
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);
 IF d.owner_id IS DISTINCT FROM helpdesk_auth.actor_id() OR d.account_id IS DISTINCT FROM (ctx->>'accountId')::uuid OR helpdesk_auth.hdni_refs_key(d.document->'refs') IS DISTINCT FROM helpdesk_auth.hdni_refs_key(ctx->'refs') THEN RAISE EXCEPTION 'Draft denied' USING ERRCODE='HDI03';END IF;
 IF d.document->>'status'='editing' AND d.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Draft expired' USING ERRCODE='HDI06';END IF;RETURN d.document;
END$$;
CREATE OR REPLACE FUNCTION helpdesk_auth.hdni_draft_directory(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE d helpdesk_core.hdni_drafts%rowtype;ctx jsonb;
BEGIN
 SELECT * INTO d FROM helpdesk_core.hdni_drafts WHERE workspace_id=helpdesk_auth.workspace_id() AND id=target AND owner_id=helpdesk_auth.actor_id();IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT jsonb_build_object('principalId',helpdesk_auth.actor_id(),'workspaceId',d.workspace_id,'accountId',d.account_id,'bindingId',b.id,'bindingRevision',o.binding_revision,'accessRevision',o.access_revision,'manifestFingerprint',o.manifest_fingerprint,'operation','tickets.read','asOf',helpdesk_auth.hdn_workflow_iso(o.as_of),'expiresAt',helpdesk_auth.hdn_workflow_iso(o.expires_at),'refs',d.document->'refs') INTO ctx
 FROM helpdesk_auth.cg_resource_bindings b
 JOIN helpdesk_auth.cg_resource_grant_sets g ON (g.workspace_id,g.account_id,g.binding_id,g.principal_id,g.operation)=(b.workspace_id,b.account_id,b.id,d.owner_id,'tickets.read') AND g.active
 JOIN helpdesk_auth.cg_resource_observations o ON (o.workspace_id,o.account_id,o.binding_id,o.principal_id,o.operation,o.grant_revision,o.access_revision,o.as_of,o.expires_at,o.expected_count)=(g.workspace_id,g.account_id,g.binding_id,g.principal_id,g.operation,g.revision,g.source_revision,g.as_of,g.expires_at,g.expected_count)
 WHERE (b.workspace_id,b.account_id,b.connection_id,b.tenant_id)=(d.workspace_id,d.account_id,(d.document->'refs'->0->>'connectionId')::uuid,d.document->'refs'->0->>'tenantId');
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);IF d.document->>'status'='editing' AND d.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Draft expired' USING ERRCODE='HDI06';END IF;
 RETURN jsonb_build_object('accountId',d.account_id,'refs',d.document->'refs');
END$$;

CREATE OR REPLACE FUNCTION helpdesk_auth.hdni_guard_draft() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Draft deletion denied' USING ERRCODE='23514';END IF;
 IF NEW.owner_id IS DISTINCT FROM helpdesk_auth.actor_id() OR NEW.workspace_id IS DISTINCT FROM helpdesk_auth.workspace_id() OR NOT coalesce(helpdesk_auth.is_human(),false)
 OR NEW.document->>'id' IS DISTINCT FROM NEW.id::text OR NEW.document->>'ownerId' IS DISTINCT FROM NEW.owner_id::text OR NEW.document->>'workspaceId' IS DISTINCT FROM NEW.workspace_id::text OR NEW.document->>'accountId' IS DISTINCT FROM NEW.account_id::text
 OR NEW.document->'revision' IS DISTINCT FROM to_jsonb(NEW.revision) OR NEW.document->'formVersion' IS DISTINCT FROM to_jsonb(NEW.form_version) OR (NEW.document->>'expiresAt')::timestamptz IS DISTINCT FROM NEW.expires_at OR NOT ((NEW.document->>'status'='editing' AND NEW.document->'ticketId'='null'::jsonb) OR (TG_OP='UPDATE' AND OLD.document->>'status'='editing' AND NEW.document->>'status'='committed' AND EXISTS(SELECT 1 FROM helpdesk_audit.hdni_receipts r WHERE (r.workspace_id,r.draft_id,r.ticket_id,r.actor_id,r.draft_revision)=(NEW.workspace_id,NEW.id,(NEW.document->>'ticketId')::uuid,NEW.owner_id,OLD.revision) AND r.transaction_id=pg_current_xact_id()) AND NEW.document-ARRAY['status','ticketId','revision']=OLD.document-ARRAY['status','ticketId','revision'])) THEN RAISE EXCEPTION 'Draft shape denied' USING ERRCODE='23514';END IF;
 IF TG_OP='UPDATE' AND (OLD.document->>'status'<>'editing' OR (NEW.workspace_id,NEW.id,NEW.owner_id,NEW.account_id,NEW.configuration_id,NEW.form_version,NEW.expires_at) IS DISTINCT FROM (OLD.workspace_id,OLD.id,OLD.owner_id,OLD.account_id,OLD.configuration_id,OLD.form_version,OLD.expires_at) OR NEW.revision<>OLD.revision+1 OR NEW.document->'formId' IS DISTINCT FROM OLD.document->'formId' OR NEW.document->'refs' IS DISTINCT FROM OLD.document->'refs' OR NEW.document->'schemaHash' IS DISTINCT FROM OLD.document->'schemaHash') THEN RAISE EXCEPTION 'Draft identity immutable' USING ERRCODE='23514';END IF;
 IF TG_OP='INSERT' AND NEW.revision<>1 THEN RAISE EXCEPTION 'Initial revision denied' USING ERRCODE='23514';END IF;
 RETURN NEW;
END$$;

CREATE FUNCTION helpdesk_auth.hdni_opening_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Opening record immutable' USING ERRCODE='23514';END IF;
 IF NEW.workspace_id IS DISTINCT FROM helpdesk_auth.workspace_id() OR NOT coalesce(helpdesk_auth.is_human(),false) THEN RAISE EXCEPTION 'Opening record denied' USING ERRCODE='23514';END IF;
 IF TG_TABLE_NAME='hdni_receipts' THEN IF NEW.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() OR NEW.transaction_id<>pg_current_xact_id() THEN RAISE EXCEPTION 'Receipt identity denied' USING ERRCODE='23514';END IF;END IF;RETURN NEW;
END$$;
CREATE TRIGGER hdni_snapshot_immutable BEFORE INSERT OR UPDATE OR DELETE ON helpdesk_core.hdni_snapshots FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdni_opening_guard();
CREATE TRIGGER hdni_receipt_immutable BEFORE INSERT OR UPDATE OR DELETE ON helpdesk_audit.hdni_receipts FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdni_opening_guard();
CREATE FUNCTION helpdesk_auth.hdni_opening_effect() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE snap jsonb;ticket_doc jsonb;opening_request_nonce text;stamp timestamptz;draft_expiry timestamptz;
BEGIN
 PERFORM helpdesk_auth.hdni_lock_scope(NEW.scope);
 SELECT document INTO snap FROM helpdesk_core.hdni_snapshots WHERE (workspace_id,ticket_id,account_id)=(NEW.workspace_id,NEW.ticket_id,NEW.account_id);ticket_doc:=snap->'bundle'->'ticket';opening_request_nonce:=snap->'bundle'->'audit'->>'requestId';stamp:=(ticket_doc->>'createdAt')::timestamptz;
 IF snap IS NULL OR NEW.snapshot_hash IS DISTINCT FROM helpdesk_auth.hdni_digest(snap) OR NEW.result IS DISTINCT FROM snap->'receipt' OR NEW.sequence::text IS DISTINCT FROM NEW.result->>'sequence'
 OR NOT EXISTS(SELECT 1 FROM helpdesk_core.tickets t WHERE (t.workspace_id,t.account_id,t.id,t.created_by,t.product_instance_id,t.service_code,t.subject,t.description,t.coverage_id,t.contract_version_id,t.contract_snapshot,t.created_at,t.updated_at,t.version,t.status,t.priority)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.actor_id,(ticket_doc->>'productInstanceId')::uuid,ticket_doc->>'serviceCode',ticket_doc->>'subject',ticket_doc->>'description',(ticket_doc->>'coverageId')::uuid,(ticket_doc->>'contractVersionId')::uuid,ticket_doc->'contractSnapshot',stamp,stamp,1,'new',ticket_doc->>'priority') AND t.assigned_to IS NULL)
 OR NOT EXISTS(SELECT 1 FROM helpdesk_core.ticket_events e JOIN helpdesk_integration.outbox_events o ON (o.workspace_id,o.account_id,o.ticket_id,o.id,o.type)=(e.workspace_id,e.account_id,e.ticket_id,e.id,e.type) JOIN helpdesk_audit.write_effects f ON (f.workspace_id,f.event_id)=(e.workspace_id,e.id) WHERE (e.workspace_id,e.account_id,e.ticket_id,e.id,e.actor_id,e.type,e.data,e.created_at)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.event_id,NEW.actor_id,'ticket.created','{"version":1}'::jsonb,stamp) AND e.customer_visible AND f.applied AND f.transaction_id=NEW.transaction_id AND f.ticket_version=1 AND o.request_id=opening_request_nonce)
 OR NOT EXISTS(SELECT 1 FROM helpdesk_audit.audit_events a WHERE (a.workspace_id,a.id,a.principal_id,a.action,a.resource_id,a.request_id,a.created_at)=(NEW.workspace_id,NEW.event_id,NEW.actor_id,'support.created',NEW.ticket_id,opening_request_nonce,stamp))
 OR NOT EXISTS(SELECT 1 FROM helpdesk_core.hdn_workflow_state s WHERE (s.workspace_id,s.account_id,s.ticket_id,s.profile_version_id,s.approval)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.result->>'profileVersionId','not_required') AND s.last_event_at>=stamp)
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
CREATE CONSTRAINT TRIGGER hdni_opening_complete AFTER INSERT ON helpdesk_audit.hdni_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdni_opening_effect();

CREATE FUNCTION helpdesk_auth.hdni_create(ctx jsonb,bundle jsonb,expected integer,receipt jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
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
 ticket_doc:=jsonb_build_object('id',target,'workspaceId',w,'accountId',a,'productInstanceId',profile->'productInstanceId','serviceCode',profile->'serviceCode','createdBy',who,'assignedTo',NULL,'subject',intent->'subject','description',intent->'description','status','new','priority',profile->'fixedPriority','version',1,'coverageId',cover->'id','contractVersionId',cover->'contractVersionId','contractSnapshot',jsonb_build_object('contractId',cover->'contractId','version',cover->'contractVersion','policy',cover->'policy'),'createdAt',at_text,'updatedAt',at_text);
 form_doc:=jsonb_build_object('formId',d->'formId','formVersion',d->'formVersion','schemaHash',d->'schemaHash','answers',answers,'publicAnswers',answers,'evidence','[]'::jsonb);
 workflow_doc:=jsonb_build_object('profileVersionId',profile->'profileVersionId','slaPolicyVersionId',profile->'sla'->'versionId','calendarVersionId',profile->'sla'->'calendar'->'versionId','approval','not_required');
 event_doc:=jsonb_build_object('ticketId',target,'workspaceId',w,'profileVersionId',profile->'profileVersionId','sequence',1,'at',at_text,'type','created','actorId',who,'actorKind','customer','from',NULL,'to','new');clocks:=helpdesk_auth.hdni_initial_clocks(profile,target,w,at_text);
 audit_doc:=jsonb_build_object('id',event_uuid,'actorId',who,'requestId',request_uuid,'at',at_text,'action','support.created','draftId',draft_uuid,'ticketId',target);
 outbox_doc:=jsonb_build_object('id',event_uuid,'workspaceId',w,'accountId',a,'ticketId',target,'type','support.created','version',1,'requestId',request_uuid,'createdAt',at_text);
 expected_bundle:=jsonb_build_object('draftId',draft_uuid,'resourceScope',ctx,'ticket',ticket_doc,'requesterId',who,'participants','[]'::jsonb,'protocol','CG-'||seq,'sequence',seq,'form',form_doc,'workflow',workflow_doc,'event',event_doc,'delegation',NULL,'clocks',clocks,'audit',audit_doc,'outbox',outbox_doc);
 IF bundle IS DISTINCT FROM expected_bundle THEN RAISE EXCEPTION 'Opening bundle changed' USING ERRCODE='HDI04';END IF;
 PERFORM 1 FROM helpdesk_core.hdn_workflow_profiles q WHERE (q.workspace_id,q.version_id,q.document)=(w,profile->>'profileVersionId',profile->'workflow') FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Published workflow absent' USING ERRCODE='HDI05';END IF;
 UPDATE helpdesk_core.hdni_protocol_counters SET last_sequence=seq::bigint WHERE workspace_id=w AND last_sequence=seq::bigint-1;GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Counter suppressed' USING ERRCODE='HDI08';END IF;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_core.hdni_protocol_counters q WHERE (q.workspace_id,q.last_sequence)=(w,seq::bigint)) THEN RAISE EXCEPTION 'Counter changed during persistence' USING ERRCODE='HDI08';END IF;
 INSERT INTO helpdesk_core.tickets(workspace_id,account_id,id,product_instance_id,service_code,created_by,subject,description,status,priority,version,coverage_id,contract_version_id,contract_snapshot,created_at,updated_at,assigned_to) VALUES(w,a,target,(profile->>'productInstanceId')::uuid,profile->>'serviceCode',who,intent->>'subject',intent->>'description','new',profile->>'fixedPriority',1,(cover->>'id')::uuid,(cover->>'contractVersionId')::uuid,ticket_doc->'contractSnapshot',stamp,stamp,NULL);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Ticket suppressed' USING ERRCODE='HDI08';END IF;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_core.tickets t WHERE (t.workspace_id,t.account_id,t.id,t.created_by,t.product_instance_id,t.service_code,t.subject,t.description,t.coverage_id,t.contract_version_id,t.contract_snapshot,t.created_at,t.updated_at,t.version,t.status,t.priority)=(w,a,target,who,(ticket_doc->>'productInstanceId')::uuid,ticket_doc->>'serviceCode',ticket_doc->>'subject',ticket_doc->>'description',(ticket_doc->>'coverageId')::uuid,(ticket_doc->>'contractVersionId')::uuid,ticket_doc->'contractSnapshot',stamp,stamp,1,'new',ticket_doc->>'priority') AND t.assigned_to IS NULL) THEN RAISE EXCEPTION 'Ticket changed during persistence' USING ERRCODE='HDI08';END IF;
 INSERT INTO helpdesk_core.cg_ticket_resource_sets(workspace_id,account_id,ticket_id,binding_id,expected_count) VALUES(w,a,target,(ctx->>'bindingId')::uuid,jsonb_array_length(ctx->'refs'));GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Selection suppressed' USING ERRCODE='HDI08';END IF;
 INSERT INTO helpdesk_core.cg_ticket_resource_refs(workspace_id,account_id,ticket_id,resource_type,resource_id) SELECT w,a,target,value->>'type',value->>'id' FROM jsonb_array_elements(ctx->'refs');GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>jsonb_array_length(ctx->'refs') THEN RAISE EXCEPTION 'References suppressed' USING ERRCODE='HDI08';END IF;
 UPDATE helpdesk_core.cg_ticket_resource_sets SET sealed=true WHERE (workspace_id,account_id,ticket_id)=(w,a,target);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Seal suppressed' USING ERRCODE='HDI08';END IF;
 INSERT INTO helpdesk_core.hdn_workflow_state(workspace_id,account_id,ticket_id,profile_version_id,approval,last_event_at) VALUES(w,a,target,profile->>'profileVersionId','not_required',stamp);GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Workflow suppressed' USING ERRCODE='HDI08';END IF;
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
REVOKE ALL ON TABLE helpdesk_core.hdni_protocol_counters,helpdesk_core.hdni_snapshots,helpdesk_audit.hdni_receipts FROM PUBLIC,helpdesk_app,helpdesk_resource_publisher,helpdesk_notification_worker;
DO $m09c_acl$
DECLARE r text;obj record;
BEGIN
 FOR obj IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='helpdesk_auth' AND p.proname LIKE 'hdni\_%' ESCAPE '\' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,helpdesk_app,helpdesk_resource_publisher,helpdesk_notification_worker',obj.signature);
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',obj.signature,r);END IF;END LOOP;
 END LOOP;
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON TABLE helpdesk_core.hdni_drafts,helpdesk_audit.hdni_draft_commits,helpdesk_core.hdni_protocol_counters,helpdesk_core.hdni_snapshots,helpdesk_audit.hdni_receipts FROM %I',r);END IF;END LOOP;
END $m09c_acl$;
GRANT EXECUTE ON FUNCTION helpdesk_auth.hdni_lock_scope(jsonb),helpdesk_auth.hdni_profile(jsonb,uuid,integer),helpdesk_auth.hdni_catalog(jsonb,text),helpdesk_auth.hdni_draft(jsonb,uuid),helpdesk_auth.hdni_draft_directory(uuid),helpdesk_auth.hdni_save_draft(jsonb,jsonb,integer),helpdesk_auth.hdni_coverages(jsonb,uuid,text),helpdesk_auth.hdni_receipt(jsonb,text),helpdesk_auth.hdni_authorize_receipt(jsonb,uuid),helpdesk_auth.hdni_allocate_protocol(jsonb),helpdesk_auth.hdni_create(jsonb,jsonb,integer,jsonb) TO helpdesk_app;

DO $m05_final$
DECLARE role_name text;role_oid oid;role_row record;ns record;obj record;allowed boolean;
BEGIN
 IF NOT ((SELECT owner.oid FROM pg_catalog.pg_roles owner
 WHERE owner.rolcreaterole AND (owner.rolsuper OR owner.rolbypassrls)
 AND owner.rolname NOT IN ('helpdesk_app','helpdesk_resource_publisher','helpdesk_notification_worker','helpdesk_maintenance','anon','authenticated','service_role')
 AND owner.oid=(SELECT n.nspowner FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')
 GROUP BY n.nspowner HAVING count(*)=4)) IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM pg_catalog.pg_default_acl d CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
 WHERE d.defaclrole=(SELECT owner.oid FROM pg_catalog.pg_roles owner
 WHERE owner.rolcreaterole AND (owner.rolsuper OR owner.rolbypassrls)
 AND owner.rolname NOT IN ('helpdesk_app','helpdesk_resource_publisher','helpdesk_notification_worker','helpdesk_maintenance','anon','authenticated','service_role')
 AND owner.oid=(SELECT n.nspowner FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')
 GROUP BY n.nspowner HAVING count(*)=4))
 AND (d.defaclnamespace=0 OR d.defaclnamespace IN (SELECT oid FROM pg_catalog.pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')))
 AND a.grantee<>d.defaclrole AND NOT (a.grantee=0 AND d.defaclobjtype='f' AND a.privilege_type='EXECUTE'))) THEN RAISE EXCEPTION 'Unqualified schema owner or defaults' USING ERRCODE='HDU06';END IF;
 FOREACH role_name IN ARRAY ARRAY['helpdesk_resource_publisher','helpdesk_notification_worker'] LOOP
  SELECT * INTO role_row FROM pg_roles WHERE rolname=role_name;IF NOT FOUND THEN RAISE EXCEPTION 'Service boundary unavailable' USING ERRCODE='HDU06';END IF;role_oid:=role_row.oid;
  IF role_row.rolsuper OR role_row.rolbypassrls OR role_row.rolcreaterole OR role_row.rolcreatedb OR role_row.rolreplication OR role_row.rolinherit OR EXISTS(
 SELECT 1 FROM pg_catalog.pg_auth_members m WHERE m.member=role_oid
 OR (m.roleid=role_oid AND NOT ((m.member=(SELECT owner.oid FROM pg_catalog.pg_roles owner
 WHERE owner.rolcreaterole AND (owner.rolsuper OR owner.rolbypassrls)
 AND owner.rolname NOT IN ('helpdesk_app','helpdesk_resource_publisher','helpdesk_notification_worker','helpdesk_maintenance','anon','authenticated','service_role')
 AND owner.oid=(SELECT n.nspowner FROM pg_catalog.pg_namespace n WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')
 GROUP BY n.nspowner HAVING count(*)=4))
 AND m.grantor=10 AND EXISTS(SELECT 1 FROM pg_catalog.pg_roles bootstrap WHERE bootstrap.oid=10 AND bootstrap.rolsuper)
 AND m.admin_option AND NOT m.inherit_option AND NOT m.set_option) IS TRUE))) THEN RAISE EXCEPTION 'Service boundary unsafe' USING ERRCODE='HDU06';END IF;
  FOR ns IN SELECT * FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') LOOP
   allowed:=role_name='helpdesk_resource_publisher' AND ns.nspname='helpdesk_auth';
   IF ns.nspowner=role_oid OR has_schema_privilege(role_oid,ns.oid,'USAGE') IS DISTINCT FROM allowed OR has_schema_privilege(role_oid,ns.oid,'CREATE,USAGE WITH GRANT OPTION') THEN RAISE EXCEPTION 'Service schema boundary unsafe' USING ERRCODE='HDU06';END IF;
  END LOOP;
  FOR obj IN SELECT c.* FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND c.relkind='r' LOOP
   IF obj.relowner=role_oid OR has_table_privilege(role_oid,obj.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege(role_oid,obj.oid,'SELECT,INSERT,UPDATE,REFERENCES') THEN RAISE EXCEPTION 'Service table boundary unsafe' USING ERRCODE='HDU06';END IF;
  END LOOP;
  FOR obj IN SELECT p.*,n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')' AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') LOOP
   allowed:=role_name='helpdesk_resource_publisher' AND obj.signature IN ('helpdesk_auth.cg_publication_open(text, text)','helpdesk_auth.cg_publication_replace(text, text, text, text, text)','helpdesk_auth.cg_publication_append(text, text, text)');
   IF obj.proowner=role_oid OR has_function_privilege(role_oid,obj.oid,'EXECUTE') IS DISTINCT FROM allowed OR has_function_privilege(role_oid,obj.oid,'EXECUTE WITH GRANT OPTION') THEN RAISE EXCEPTION 'Service function boundary unsafe' USING ERRCODE='HDU06';END IF;
  END LOOP;
 END LOOP;
END $m05_final$;
DO $m09c_final$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='helpdesk_auth' AND p.proname LIKE 'hdni\_%' ESCAPE '\' AND (a.grantee NOT IN (p.proowner,'helpdesk_app'::regrole) OR a.is_grantable AND a.grantee<>p.proowner)) THEN RAISE EXCEPTION 'Unsafe intake ACL' USING ERRCODE='HDU06';END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('helpdesk_core','helpdesk_audit') AND c.relname IN ('hdni_drafts','hdni_draft_commits','hdni_protocol_counters','hdni_snapshots','hdni_receipts') AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR has_table_privilege('helpdesk_app',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege('helpdesk_app',c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN RAISE EXCEPTION 'Unsafe intake tables' USING ERRCODE='HDU06';END IF;
END $m09c_final$;
CREATE OR REPLACE FUNCTION helpdesk_auth.schema_version() RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT '0.23.0'::text$$;
COMMIT;
