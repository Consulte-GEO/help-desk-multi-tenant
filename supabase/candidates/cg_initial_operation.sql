-- Private initial operation candidate. Qualification precedes hosted promotion.
DO $candidate$ BEGIN
 IF current_database()<>'helpdesk_test' OR current_setting('app.cg_initial_candidate',true) IS DISTINCT FROM 'disposable-pg17'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR to_regprocedure('helpdesk_auth.cg_local_provision(text,text)') IS NULL
 OR to_regclass('helpdesk_integration.hdn_notification_routes') IS NULL THEN RAISE EXCEPTION 'Owned candidate qualification required' USING ERRCODE='42501';END IF;
 PERFORM helpdesk_auth.cg_local_operator();
END $candidate$;
CREATE TABLE helpdesk_audit.cg_initial_receipts(workspace_id uuid PRIMARY KEY REFERENCES helpdesk_core.workspaces(id),request_id uuid NOT NULL UNIQUE,command_hash text NOT NULL CHECK(command_hash ~ '^[a-f0-9]{64}$'),document jsonb NOT NULL,recorded_by name NOT NULL DEFAULT session_user,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id());
ALTER TABLE helpdesk_audit.cg_initial_receipts ENABLE ROW LEVEL SECURITY;ALTER TABLE helpdesk_audit.cg_initial_receipts FORCE ROW LEVEL SECURITY;
CREATE FUNCTION helpdesk_auth.cg_initial_receipt_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Initial decision immutable' USING ERRCODE='23514';END IF;
 NEW.recorded_by:=session_user;NEW.recorded_at:=clock_timestamp();NEW.transaction_id:=pg_current_xact_id();RETURN NEW;
END$$;
CREATE TRIGGER cg_initial_receipt_immutable BEFORE INSERT OR UPDATE OR DELETE ON helpdesk_audit.cg_initial_receipts FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.cg_initial_receipt_immutable();

-- SECURITY INVOKER: only the actual authenticated schema owner can bootstrap.
-- The sponsor is the existing human who requested activation; this is explicitly
-- operator delegation, never an AAL2 request or a configuration-admin receipt.
CREATE FUNCTION helpdesk_auth.cg_initial_operation(command_text text,command_hash text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb;w uuid;sponsor uuid;request uuid;old helpdesk_audit.cg_initial_receipts%rowtype;stamp timestamptz;local_receipt jsonb;entry jsonb;artifact jsonb;cfg jsonb;t jsonb;r jsonb;definitions jsonb:='[]';receipt jsonb;until_time timestamptz;n int;services text[]:=ARRAY['questions','backup','problem'];i int:=0;
BEGIN
 PERFORM helpdesk_auth.cg_local_operator();
 IF command_text IS NULL OR octet_length(command_text)>163840 OR command_hash IS NULL OR command_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Initial plan invalid' USING ERRCODE='CGI01';END IF;c:=command_text::jsonb;
 IF command_text IS DISTINCT FROM helpdesk_auth.hdni_canonical(c) OR command_hash IS DISTINCT FROM helpdesk_auth.hdni_digest(c)
 OR NOT coalesce(helpdesk_auth.hdn_cfg_object(c,ARRAY['schema','product','workspaceId','administratorId','requestId','accountId','productId','productInstanceId','connectionId','bindingId','contractId','contractVersionId','administratorEmail','accountName','workId','workName','reason','registry','configurations','local','localHash','coveragePolicy','protocolPolicy','templates','routes']),false)
 OR c->'schema' IS DISTINCT FROM '1'::jsonb OR c->>'product' IS DISTINCT FROM 'CONSULTE_GEO'
 OR c->'registry' IS DISTINCT FROM '{"types":["text","textarea","boolean","select","info"],"lookups":[],"files":false,"downloads":[]}'::jsonb
 OR c->'protocolPolicy' IS DISTINCT FROM '{"namespace":"CONSULTE_GEO_HELPDESK","prefix":"CG-","lastSequence":"10000","legacyImport":"separate_external_identity"}'::jsonb
 OR c->'coveragePolicy' IS DISTINCT FROM jsonb_build_object('kind','local_operational_policy','externalContractQualified',false,'approvedBy',c->'administratorId','policyVersion',1)
 OR NOT helpdesk_auth.hdn_cfg_singleline(c->'reason',1000) OR NOT helpdesk_auth.hdn_cfg_singleline(c->'accountName',160) OR NOT helpdesk_auth.hdn_cfg_singleline(c->'workName',160)
 OR jsonb_typeof(c->'configurations') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'configurations')<>3
 OR jsonb_typeof(c->'templates') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'templates')<>3
 OR jsonb_typeof(c->'routes') IS DISTINCT FROM 'array' OR jsonb_array_length(c->'routes')<>8
 THEN RAISE EXCEPTION 'Initial plan invalid' USING ERRCODE='CGI01';END IF;
 w:=(c->>'workspaceId')::uuid;sponsor:=(c->>'administratorId')::uuid;request:=(c->>'requestId')::uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended('consultegeo-initial-operation:'||w::text,0));
 SELECT * INTO old FROM helpdesk_audit.cg_initial_receipts WHERE workspace_id=w;
 IF FOUND THEN IF (old.request_id,old.command_hash) IS DISTINCT FROM (request,command_hash) THEN RAISE EXCEPTION 'Initial decision already recorded' USING ERRCODE='CGI02';END IF;RETURN old.document;END IF;
 PERFORM 1 FROM helpdesk_core.workspaces WHERE id=w FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Workspace missing' USING ERRCODE='CGI01';END IF;
 PERFORM 1 FROM helpdesk_auth.principals p JOIN helpdesk_auth.workspace_memberships m ON m.principal_id=p.id JOIN auth.users u ON u.id=p.supabase_user_id
 WHERE p.id=sponsor AND p.active AND p.kind='human' AND m.workspace_id=w AND m.active AND m.role='admin' AND lower(u.email)=c->>'administratorEmail' AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()) FOR SHARE OF p,m;
 IF NOT FOUND THEN RAISE EXCEPTION 'Existing verified administrator required' USING ERRCODE='CGI03';END IF;
 IF EXISTS(SELECT 1 FROM helpdesk_core.accounts WHERE workspace_id=w) OR EXISTS(SELECT 1 FROM helpdesk_core.products WHERE workspace_id=w)
 OR EXISTS(SELECT 1 FROM helpdesk_core.support_contracts WHERE workspace_id=w) OR EXISTS(SELECT 1 FROM helpdesk_core.tickets WHERE workspace_id=w)
 OR EXISTS(SELECT 1 FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w) OR EXISTS(SELECT 1 FROM helpdesk_core.hdni_protocol_counters WHERE workspace_id=w)
 OR EXISTS(SELECT 1 FROM helpdesk_audit.hdni_receipts WHERE workspace_id=w) OR EXISTS(SELECT 1 FROM helpdesk_auth.cg_local_registries WHERE workspace_id=w)
 THEN RAISE EXCEPTION 'Initial workspace must be empty' USING ERRCODE='CGI04';END IF;
 IF c->>'localHash' IS DISTINCT FROM helpdesk_auth.hdni_digest(c->'local') OR c->'local'->>'workspaceId' IS DISTINCT FROM w::text
 OR c->'local'->>'requestId' IS DISTINCT FROM request::text OR c->'local'->'expectedRegistryRevision' IS DISTINCT FROM '0'::jsonb
 OR c->'local'->'accounts' IS DISTINCT FROM jsonb_build_array(jsonb_build_object('accountId',c->'accountId','name',c->'accountName','productInstanceId',c->'productInstanceId','connectionId',c->'connectionId','bindingId',c->'bindingId','tenantId',c->'accountId','active',true))
 OR c->'local'->'works' IS DISTINCT FROM jsonb_build_array(jsonb_build_object('accountId',c->'accountId','id',c->'workId','name',c->'workName','active',true))
 OR c->'local'->'permissions' IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object('accountId',c->'accountId','principalId',c->'administratorId','role','agent','operation',op,'active',true,'workIds',jsonb_build_array(c->'workId')) ORDER BY ordinal) FROM unnest(ARRAY['tickets.read','tickets.write','notes.read','notes.write']) WITH ORDINALITY q(op,ordinal))
 THEN RAISE EXCEPTION 'Declaration mismatch' USING ERRCODE='CGI01';END IF;
 stamp:=clock_timestamp();
 INSERT INTO helpdesk_core.products(workspace_id,id,code,name) VALUES(w,(c->>'productId')::uuid,'CONSULTE_GEO','Consulte GEO');
 INSERT INTO helpdesk_core.product_instances(workspace_id,product_id,id,environment) VALUES(w,(c->>'productId')::uuid,(c->>'productInstanceId')::uuid,'production');
 local_receipt:=helpdesk_auth.cg_local_provision(helpdesk_auth.hdni_canonical(c->'local'),c->>'localHash');
 INSERT INTO helpdesk_core.support_contracts(workspace_id,id,name,status) VALUES(w,(c->>'contractId')::uuid,'Política operacional inicial Consulte GEO','active');
 INSERT INTO helpdesk_core.contract_versions(workspace_id,contract_id,id,version,published,valid_from,policy) VALUES(w,(c->>'contractId')::uuid,(c->>'contractVersionId')::uuid,1,true,stamp,c->'coveragePolicy');
 INSERT INTO helpdesk_auth.hdn_cfg_registries(workspace_id,revision,document) VALUES(w,1,c->'registry');
 INSERT INTO helpdesk_core.hdn_cfg_catalog(workspace_id,revision) VALUES(w,1);
 FOR cfg IN SELECT value FROM jsonb_array_elements(c->'configurations') LOOP
  i:=i+1;IF NOT helpdesk_auth.hdn_cfg_object(cfg,ARRAY['definition','artifacts','contentHash','coverageId']) OR cfg->'definition'->>'service' IS DISTINCT FROM services[i] OR cfg->'definition'->'version' IS DISTINCT FROM '1'::jsonb THEN RAISE EXCEPTION 'Initial profile invalid' USING ERRCODE='CGI01';END IF;
  artifact:=helpdesk_auth.hdn_cfg_compile(cfg->'definition',c->'registry');until_time:=(artifact->'calendar'->>'until')::timestamptz;
  IF artifact IS DISTINCT FROM cfg->'artifacts' OR cfg->>'contentHash' IS DISTINCT FROM helpdesk_auth.hdn_workflow_digest(jsonb_build_object('definition',cfg->'definition','artifacts',artifact)) OR until_time<=stamp THEN RAISE EXCEPTION 'Initial artifacts invalid' USING ERRCODE='CGI01';END IF;
  INSERT INTO helpdesk_core.services(workspace_id,product_id,code,name) VALUES(w,(c->>'productId')::uuid,services[i],cfg->'definition'->>'title');
  INSERT INTO helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) VALUES(w,(c->>'accountId')::uuid,(c->>'productId')::uuid,(c->>'productInstanceId')::uuid,services[i],(c->>'contractVersionId')::uuid,(cfg->>'coverageId')::uuid);
  FOR entry IN SELECT value FROM jsonb_array_elements(artifact->'entries') LOOP
   INSERT INTO helpdesk_core.hdn_execution_templates(workspace_id,template_id,version,sha256,document) VALUES(w,entry->'checklist'->>'id',1,entry->'workflow'->'executionChecklist'->>'sha256',entry->'checklist');
   INSERT INTO helpdesk_core.hdn_workflow_profiles(workspace_id,version_id,document) VALUES(w,entry->'workflow'->>'versionId',entry->'workflow');
  END LOOP;
  INSERT INTO helpdesk_core.hdn_cfg_versions VALUES(w,(cfg->'definition'->>'id')::uuid,1,1,'published',cfg->'definition',cfg->>'contentHash',artifact,sponsor,stamp,sponsor,stamp);
  definitions:=definitions||jsonb_build_array(jsonb_build_object('id',cfg->'definition'->'id','version',1,'contentHash',cfg->'contentHash','service',services[i]));
 END LOOP;
 FOR t IN SELECT value FROM jsonb_array_elements(c->'templates') LOOP
  IF NOT helpdesk_auth.hdn_cfg_object(t,ARRAY['document','sha256']) OR t->>'sha256' IS DISTINCT FROM helpdesk_auth.hdni_digest(t->'document') THEN RAISE EXCEPTION 'Template invalid' USING ERRCODE='CGI01';END IF;
  INSERT INTO helpdesk_integration.hdn_notification_templates(id,version,kind,document,sha256) VALUES(t->'document'->>'id',1,t->'document'->>'kind',t->'document',t->>'sha256') ON CONFLICT(id,version) DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_templates x WHERE (x.id,x.version,x.document,x.sha256)=(t->'document'->>'id',1,t->'document',t->>'sha256')) THEN RAISE EXCEPTION 'Template conflict' USING ERRCODE='CGI01';END IF;
 END LOOP;
 FOR r IN SELECT value FROM jsonb_array_elements(c->'routes') LOOP
  IF NOT helpdesk_auth.hdn_cfg_object(r,ARRAY['kind','revision','audience','templateId','templateVersion']) OR r->'revision' IS DISTINCT FROM '1'::jsonb THEN RAISE EXCEPTION 'Route invalid' USING ERRCODE='CGI01';END IF;
  INSERT INTO helpdesk_integration.hdn_notification_routes(workspace_id,kind,revision,audience,template_id,template_version,expires_at) VALUES(w,r->>'kind',1,r->>'audience',r->>'templateId',(r->>'templateVersion')::int,until_time);
 END LOOP;
 INSERT INTO helpdesk_core.hdni_protocol_counters(workspace_id,last_sequence) VALUES(w,10000);
 IF (SELECT count(*) FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w AND status='published')<>3
 OR (SELECT count(*) FROM helpdesk_core.hdn_workflow_profiles WHERE workspace_id=w)<>6
 OR (SELECT count(*) FROM helpdesk_core.hdn_execution_templates WHERE workspace_id=w)<>6
 OR (SELECT count(*) FROM helpdesk_core.coverages WHERE workspace_id=w)<>3
 OR (SELECT count(*) FROM helpdesk_integration.hdn_notification_routes WHERE workspace_id=w)<>8
 OR NOT EXISTS(SELECT 1 FROM helpdesk_core.hdni_protocol_counters WHERE workspace_id=w AND last_sequence=10000)
 THEN RAISE EXCEPTION 'Initial persistence incomplete' USING ERRCODE='CGI05';END IF;
 receipt:=jsonb_build_object('workspaceId',w,'requestId',request,'commandHash',command_hash,'sponsorId',sponsor,'recordedBy',session_user,'assurance','operator-delegation','protocolPolicy',c->'protocolPolicy','coveragePolicy',c->'coveragePolicy','configurations',definitions,'localReceipt',local_receipt,'emailDelivery','not-tested');
 INSERT INTO helpdesk_audit.cg_initial_receipts(workspace_id,request_id,command_hash,document) VALUES(w,request,command_hash,receipt);GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Initial receipt incomplete' USING ERRCODE='CGI05';END IF;
 RETURN receipt;
END$$;

-- The original M09c receipt pins a published workflow but does not bind its
-- execution checklist. For the real local Consulte GEO source, create that
-- binding in the SAME opening transaction from the immutable native snapshot.
-- No caller supplies a template or gains direct binding-table privileges.
CREATE FUNCTION helpdesk_auth.cg_initial_bind_checklist() RETURNS trigger LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE local_account helpdesk_auth.cg_local_accounts%rowtype;snapshot_doc jsonb;profile_doc jsonb;template_doc jsonb;reference_doc jsonb;pinned text;affected int;
BEGIN
 SELECT * INTO local_account FROM helpdesk_auth.cg_local_accounts a WHERE a.workspace_id=NEW.workspace_id AND a.account_id=NEW.account_id FOR SHARE;
 IF NOT FOUND THEN RETURN NEW;END IF;
 IF NOT local_account.active OR local_account.binding_id IS DISTINCT FROM (NEW.scope->>'bindingId')::uuid
 OR NEW.transaction_id IS DISTINCT FROM pg_current_xact_id() OR NEW.actor_id IS DISTINCT FROM helpdesk_auth.actor_id()
 OR NEW.workspace_id IS DISTINCT FROM helpdesk_auth.workspace_id() THEN RAISE EXCEPTION 'Local opening checklist identity invalid' USING ERRCODE='HDI08';END IF;
 SELECT document INTO snapshot_doc FROM helpdesk_core.hdni_snapshots s WHERE (s.workspace_id,s.account_id,s.ticket_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id) FOR SHARE;
 IF NOT FOUND OR snapshot_doc->'receipt' IS DISTINCT FROM NEW.result OR helpdesk_auth.hdni_digest(snapshot_doc) IS DISTINCT FROM NEW.snapshot_hash
 OR snapshot_doc->'bundle'->'resourceScope' IS DISTINCT FROM NEW.scope THEN RAISE EXCEPTION 'Local opening checklist snapshot invalid' USING ERRCODE='HDI08';END IF;
 pinned:=NEW.result->>'profileVersionId';
 PERFORM 1 FROM helpdesk_core.hdn_workflow_state s WHERE (s.workspace_id,s.account_id,s.ticket_id,s.profile_version_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,pinned) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Local opening workflow missing' USING ERRCODE='HDI08';END IF;
 SELECT document INTO profile_doc FROM helpdesk_core.hdn_workflow_profiles p WHERE p.workspace_id=NEW.workspace_id AND p.version_id=pinned FOR SHARE;
 IF NOT FOUND OR profile_doc->>'status' IS DISTINCT FROM 'published' OR profile_doc IS DISTINCT FROM snapshot_doc->'profile'->'workflow'
 THEN RAISE EXCEPTION 'Local opening published workflow invalid' USING ERRCODE='HDI08';END IF;
 reference_doc:=profile_doc->'executionChecklist';
 IF NOT coalesce(helpdesk_auth.hdn_cfg_object(reference_doc,ARRAY['id','version','sha256']),false)
 OR NOT coalesce(helpdesk_auth.hdn_cfg_int(reference_doc->'version',1,2147483647),false)
 OR jsonb_typeof(reference_doc->'id') IS DISTINCT FROM 'string' OR reference_doc->>'id' !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'
 OR jsonb_typeof(reference_doc->'sha256') IS DISTINCT FROM 'string' OR reference_doc->>'sha256' !~ '^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'Local opening checklist reference invalid' USING ERRCODE='HDI08';END IF;
 SELECT document INTO template_doc FROM helpdesk_core.hdn_execution_templates t WHERE (t.workspace_id,t.template_id,t.version,t.sha256)=(NEW.workspace_id,reference_doc->>'id',(reference_doc->>'version')::int,reference_doc->>'sha256') FOR SHARE;
 IF NOT FOUND OR template_doc->>'status' IS DISTINCT FROM 'published' OR helpdesk_auth.hdn_workflow_digest(template_doc) IS DISTINCT FROM reference_doc->>'sha256'
 THEN RAISE EXCEPTION 'Local opening published checklist invalid' USING ERRCODE='HDI08';END IF;
 INSERT INTO helpdesk_core.hdn_execution_bindings(workspace_id,account_id,ticket_id,profile_version_id,template_id,template_version,template_sha256) VALUES(NEW.workspace_id,NEW.account_id,NEW.ticket_id,pinned,reference_doc->>'id',(reference_doc->>'version')::int,reference_doc->>'sha256');
 GET DIAGNOSTICS affected=ROW_COUNT;
 IF affected<>1 OR NOT EXISTS(SELECT 1 FROM helpdesk_core.hdn_execution_bindings b WHERE (b.workspace_id,b.account_id,b.ticket_id,b.profile_version_id,b.template_id,b.template_version,b.template_sha256)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,pinned,reference_doc->>'id',(reference_doc->>'version')::int,reference_doc->>'sha256'))
 THEN RAISE EXCEPTION 'Local opening checklist binding suppressed or changed' USING ERRCODE='HDI08';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER cg_initial_bind_checklist AFTER INSERT ON helpdesk_audit.hdni_receipts FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.cg_initial_bind_checklist();

-- Minimal current-authorized presentation, never a public receipt/snapshot dump.
CREATE FUNCTION helpdesk_auth.cg_local_ticket_summary(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE metadata jsonb;r helpdesk_audit.hdni_receipts%rowtype;profile text;BEGIN
 metadata:=helpdesk_auth.cg_local_ticket_directory(target);IF metadata IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO r FROM helpdesk_audit.hdni_receipts WHERE workspace_id=helpdesk_auth.workspace_id() AND ticket_id=target;
 IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT profile_version_id INTO profile FROM helpdesk_core.hdn_workflow_state WHERE workspace_id=r.workspace_id AND account_id=r.account_id AND ticket_id=target;
 IF profile IS NULL OR r.result->>'profileVersionId' IS DISTINCT FROM profile OR r.result->>'protocol' IS DISTINCT FROM 'CG-'||r.sequence::text THEN RAISE EXCEPTION 'Pinned summary unavailable' USING ERRCODE='CGI05';END IF;
 RETURN jsonb_build_object('protocol',r.result->'protocol','profileVersionId',profile,'workflow',true,'requesterId',r.result->'requesterId');
END$$;
REVOKE ALL ON TABLE helpdesk_audit.cg_initial_receipts FROM PUBLIC,helpdesk_app,helpdesk_resource_publisher,helpdesk_notification_worker;
REVOKE ALL ON FUNCTION helpdesk_auth.cg_initial_receipt_immutable(),helpdesk_auth.cg_initial_operation(text,text),helpdesk_auth.cg_initial_bind_checklist(),helpdesk_auth.cg_local_ticket_summary(uuid) FROM PUBLIC,helpdesk_app,helpdesk_resource_publisher,helpdesk_notification_worker;
DO $clients$ DECLARE role_name text;signature text;BEGIN
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
  EXECUTE format('REVOKE ALL ON TABLE helpdesk_audit.cg_initial_receipts FROM %I',role_name);
  FOREACH signature IN ARRAY ARRAY['cg_initial_receipt_immutable()','cg_initial_operation(text,text)','cg_initial_bind_checklist()','cg_local_ticket_summary(uuid)'] LOOP EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.%s FROM %I',signature,role_name);END LOOP;
 END IF;END LOOP;
END $clients$;
GRANT EXECUTE ON FUNCTION helpdesk_auth.cg_local_ticket_summary(uuid) TO helpdesk_app;
