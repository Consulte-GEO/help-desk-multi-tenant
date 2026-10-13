-- HDN-01b CANDIDATE: not a migration, not a hosted installer.
-- Requires an owned disposable PostgreSQL17 database with CG03d/e already installed.
-- The existing runner owns BEGIN/COMMIT and sets app.hdn01b_candidate locally.
DO $guard$
BEGIN
 IF current_database()<>'helpdesk_test' OR current_setting('app.hdn01b_candidate',true) IS DISTINCT FROM 'disposable-pg17'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 THEN
  RAISE EXCEPTION 'Owned disposable PG17 required' USING ERRCODE='42501';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN
  RAISE EXCEPTION 'Owned test administrator required' USING ERRCODE='42501';
 END IF;
 IF to_regprocedure('helpdesk_auth.cg_ticket_resource_allowed(uuid,uuid,uuid,text)') IS NULL THEN
  RAISE EXCEPTION 'Scoped authorization must be installed first' USING ERRCODE='42501';
 END IF;
END $guard$;

CREATE FUNCTION helpdesk_auth.hdn_valid_execution_template(d jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE item jsonb;seen text[]:='{}'::text[];has_required boolean:=false;
BEGIN
 IF d IS NULL OR jsonb_typeof(d)<>'object' THEN RETURN false;END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(d))<>5 OR NOT (d ?& ARRAY['schema','id','version','status','items'])
  OR d->'schema'<>'1'::jsonb OR d->>'status' IS DISTINCT FROM 'published'
  OR jsonb_typeof(d->'id')<>'string' OR d->>'id'!~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'
  OR jsonb_typeof(d->'version')<>'number' OR d->>'version'!~'^[1-9][0-9]{0,8}$'
  OR jsonb_typeof(d->'items')<>'array' OR jsonb_array_length(d->'items') NOT BETWEEN 1 AND 100 THEN RETURN false;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(d->'items') LOOP
  IF jsonb_typeof(item)<>'object' THEN RETURN false;END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(item))<>6 OR NOT (item ?& ARRAY['id','label','required','allowNotApplicable','evidenceRequired','risk'])
   OR jsonb_typeof(item->'id')<>'string' OR item->>'id'!~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'
   OR item->>'id'=ANY(seen) OR jsonb_typeof(item->'label')<>'string' OR length(btrim(item->>'label')) NOT BETWEEN 1 AND 300
   OR jsonb_typeof(item->'required')<>'boolean' OR jsonb_typeof(item->'allowNotApplicable')<>'boolean'
   OR jsonb_typeof(item->'evidenceRequired')<>'boolean' OR (item->>'risk') NOT IN ('ordinary','sensitive')
   OR jsonb_typeof(item->'risk')<>'string' THEN RETURN false;END IF;
  IF item->>'risk'='sensitive' AND (item->'required'<>'true'::jsonb OR item->'allowNotApplicable'<>'false'::jsonb OR item->'evidenceRequired'<>'true'::jsonb) THEN RETURN false;END IF;
  seen:=array_append(seen,item->>'id');has_required:=has_required OR item->'required'='true'::jsonb;
 END LOOP;
 RETURN has_required;
EXCEPTION WHEN data_exception THEN RETURN false;
END$$;

CREATE TABLE helpdesk_core.hdn_execution_templates(
 workspace_id uuid NOT NULL REFERENCES helpdesk_core.workspaces(id),
 template_id text COLLATE "C" NOT NULL CHECK(template_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
 version integer NOT NULL CHECK(version>0),
 sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
 document jsonb NOT NULL CHECK(helpdesk_auth.hdn_valid_execution_template(document)),
 PRIMARY KEY(workspace_id,template_id,version),
 UNIQUE(workspace_id,template_id,version,sha256),
 CHECK(document->>'status'='published' AND document->>'id'=template_id AND (document->>'version')::integer=version),
 CHECK(jsonb_typeof(document->'items')='array' AND jsonb_array_length(document->'items') BETWEEN 1 AND 100)
);
-- This binding is provisioned by a future qualified intake/profile publisher,
-- not by the caller. Do not infer it from a ticket's text or from a draft template.
CREATE TABLE helpdesk_core.hdn_execution_bindings(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,
 profile_version_id text COLLATE "C" NOT NULL CHECK(profile_version_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
 template_id text NOT NULL,template_version integer NOT NULL,template_sha256 text NOT NULL,
 PRIMARY KEY(workspace_id,account_id,ticket_id),
 FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.tickets(workspace_id,account_id,id),
 FOREIGN KEY(workspace_id,template_id,template_version,template_sha256) REFERENCES helpdesk_core.hdn_execution_templates(workspace_id,template_id,version,sha256)
);
CREATE TABLE helpdesk_core.hdn_execution_snapshots(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,ticket_version integer NOT NULL CHECK(ticket_version>0),
 revision bigint NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740990),document jsonb NOT NULL,
 PRIMARY KEY(workspace_id,account_id,ticket_id,ticket_version),
 FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.hdn_execution_bindings(workspace_id,account_id,ticket_id),
 CHECK(jsonb_typeof(document)='object' AND document ?& ARRAY['workspaceId','accountId','ticketId','ticketVersion','profileVersionId','reference','revision','entries']
  AND (document->>'workspaceId')::uuid=workspace_id AND (document->>'accountId')::uuid=account_id AND (document->>'ticketId')::uuid=ticket_id
  AND (document->>'ticketVersion')::integer=ticket_version AND (document->>'revision')::bigint=revision
  AND jsonb_typeof(document->'entries')='array' AND jsonb_array_length(document->'entries')<=100)
);
CREATE TABLE helpdesk_core.hdn_execution_audit(
 id uuid PRIMARY KEY,workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,ticket_version integer NOT NULL,
 checklist_revision bigint NOT NULL,actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),request_id uuid NOT NULL,
 at timestamptz NOT NULL,reason text,before_document jsonb,after_document jsonb NOT NULL,
 UNIQUE(workspace_id,account_id,ticket_id,ticket_version,checklist_revision),
 FOREIGN KEY(workspace_id,account_id,ticket_id,ticket_version) REFERENCES helpdesk_core.hdn_execution_snapshots(workspace_id,account_id,ticket_id,ticket_version)
);
CREATE TABLE helpdesk_core.hdn_execution_receipts(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),
 key text NOT NULL CHECK(key ~ '^[A-Za-z0-9._:-]{16,128}$'),intent_hash text NOT NULL CHECK(intent_hash ~ '^[a-f0-9]{64}$'),
 command jsonb NOT NULL,audit_id uuid NOT NULL REFERENCES helpdesk_core.hdn_execution_audit(id),result jsonb NOT NULL,
 PRIMARY KEY(workspace_id,account_id,ticket_id,actor_id,key),
 FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.hdn_execution_bindings(workspace_id,account_id,ticket_id)
);
CREATE FUNCTION helpdesk_auth.hdn_execution_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Published records are immutable' USING ERRCODE='23514'; END$$;
CREATE TRIGGER hdn_template_immutable BEFORE UPDATE OR DELETE ON helpdesk_core.hdn_execution_templates FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_execution_immutable();
CREATE TRIGGER hdn_binding_immutable BEFORE UPDATE OR DELETE ON helpdesk_core.hdn_execution_bindings FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_execution_immutable();
CREATE TRIGGER hdn_audit_immutable BEFORE UPDATE OR DELETE ON helpdesk_core.hdn_execution_audit FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_execution_immutable();
CREATE TRIGGER hdn_receipt_immutable BEFORE UPDATE OR DELETE ON helpdesk_core.hdn_execution_receipts FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_execution_immutable();

CREATE FUNCTION helpdesk_auth.hdn_checklist_contract() RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT 'hdn-checklist-candidate-1'::text$$;
-- Definer functions are restricted entrypoints for otherwise unreadable private
-- rows. They expose no arbitrary SQL and reauthorize the CURRENT server actor.
-- No client/Data API role receives access. The application login remains restricted.
CREATE FUNCTION helpdesk_auth.hdn_checklist_ticket(target uuid,writing boolean)
RETURNS helpdesk_core.tickets LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype; w uuid:=helpdesk_auth.workspace_id(); a uuid:=helpdesk_auth.actor_id();
BEGIN
 IF session_user<>'helpdesk_app' OR NOT coalesce(helpdesk_auth.is_human(),false) THEN RAISE EXCEPTION 'Denied' USING ERRCODE='HD001'; END IF;
 SELECT * INTO t FROM helpdesk_core.tickets WHERE workspace_id=w AND id=target FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(helpdesk_auth.is_operator(w,t.account_id),false)
  OR NOT coalesce(helpdesk_auth.has_scope(w,'notes:read'),false)
  OR NOT coalesce(helpdesk_auth.can_read_ticket(w,t.account_id,t.product_instance_id,t.created_by),false)
  OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,t.account_id,target,'notes.read'),false) THEN
  RAISE EXCEPTION 'Denied' USING ERRCODE='HD001';
 END IF;
 IF writing AND (t.assigned_to IS DISTINCT FROM a OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:write'),false)
  OR NOT coalesce(helpdesk_auth.has_scope(w,'notes:write'),false)
  OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,t.account_id,target,'tickets.write'),false)
  OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,t.account_id,target,'notes.write'),false)) THEN
  RAISE EXCEPTION 'Denied' USING ERRCODE='HD001';
 END IF;
 RETURN t;
END$$;
CREATE FUNCTION helpdesk_auth.hdn_lock_execution_checklist(target uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;b helpdesk_core.hdn_execution_bindings%rowtype;
 d jsonb;s jsonb;r jsonb;c jsonb;
BEGIN
 t:=helpdesk_auth.hdn_checklist_ticket(target,false);
 SELECT * INTO b FROM helpdesk_core.hdn_execution_bindings WHERE workspace_id=t.workspace_id AND account_id=t.account_id AND ticket_id=t.id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Required binding unavailable' USING ERRCODE='HD007'; END IF;
 SELECT document INTO d FROM helpdesk_core.hdn_execution_templates WHERE workspace_id=b.workspace_id AND template_id=b.template_id AND version=b.template_version AND sha256=b.template_sha256 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Required template unavailable' USING ERRCODE='HD007'; END IF;
 r:=jsonb_build_object('id',b.template_id,'version',b.template_version,'sha256',b.template_sha256);
 c:=jsonb_build_object('workspaceId',t.workspace_id,'accountId',t.account_id,'ticketId',t.id,'ticketVersion',t.version,'profileVersionId',b.profile_version_id,'reference',r);
 SELECT document INTO s FROM helpdesk_core.hdn_execution_snapshots WHERE workspace_id=t.workspace_id AND account_id=t.account_id AND ticket_id=t.id AND ticket_version=t.version FOR UPDATE;
 RETURN jsonb_build_object('context',c,'template',d,'snapshot',s,'ticketStatus',t.status,'assignedTo',t.assigned_to,
  'readAt',to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'));
END$$;
CREATE FUNCTION helpdesk_auth.hdn_checklist_receipt(target uuid,intent_key text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;r helpdesk_core.hdn_execution_receipts%rowtype;
BEGIN
 t:=helpdesk_auth.hdn_checklist_ticket(target,false);
 SELECT * INTO r FROM helpdesk_core.hdn_execution_receipts WHERE workspace_id=t.workspace_id AND account_id=t.account_id AND ticket_id=target AND actor_id=helpdesk_auth.actor_id() AND key=intent_key;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('key',r.key,'hash',r.intent_hash,'command',r.command,'result',r.result);
END$$;
CREATE FUNCTION helpdesk_auth.hdn_checklist_evidence(target uuid,selectors text[]) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;selector text;n helpdesk_core.internal_notes%rowtype;result jsonb:='[]'::jsonb;
BEGIN
 t:=helpdesk_auth.hdn_checklist_ticket(target,false);
 IF selectors IS NULL OR coalesce(array_ndims(selectors),1)<>1 OR cardinality(selectors)>20
  OR (SELECT count(DISTINCT x) FROM unnest(selectors) x)<>cardinality(selectors) THEN RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';END IF;
 FOREACH selector IN ARRAY selectors LOOP
  IF selector IS NULL OR selector!~'^note:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';END IF;
  SELECT * INTO n FROM helpdesk_core.internal_notes WHERE workspace_id=t.workspace_id AND account_id=t.account_id AND ticket_id=target AND id=substring(selector FROM 6)::uuid FOR SHARE;
  IF NOT FOUND OR n.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() OR n.created_at>clock_timestamp() THEN RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';END IF;
  result:=result||jsonb_build_array(jsonb_build_object('reference',selector,'workspaceId',n.workspace_id,'accountId',n.account_id,'ticketId',n.ticket_id,'actorId',n.actor_id,'at',to_char(n.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')));
 END LOOP;
 RETURN result;
END$$;

-- A resolution snapshot must still have its referenced notes. UI/read and receipt
-- reads remain separate so an operator can repair an incomplete checklist and
-- inspect historical receipts without pretending to repeat a resolution.
CREATE FUNCTION helpdesk_auth.hdn_lock_execution_checklist_resolution(target uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_record jsonb;v_snapshot jsonb;v_entry jsonb;v_selector jsonb;v_request jsonb;
 v_requests jsonb:='[]'::jsonb;v_note_ids uuid[]:='{}'::uuid[];v_unique integer;
 v_note record;v_evidence jsonb:='[]'::jsonb;v_reference text;
BEGIN
 -- Reuses the current actor/resource checks and ticket/template/snapshot locks.
 v_record:=helpdesk_auth.hdn_lock_execution_checklist(target);
 v_snapshot:=nullif(v_record->'snapshot','null'::jsonb);
 IF v_snapshot IS NULL THEN
  RETURN jsonb_build_object('record',v_record,'evidence',v_evidence);
 END IF;
 IF jsonb_typeof(v_snapshot->'entries') IS DISTINCT FROM 'array'
  OR jsonb_array_length(v_snapshot->'entries')>100 THEN
  RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';
 END IF;
 FOR v_entry IN SELECT value FROM jsonb_array_elements(v_snapshot->'entries') LOOP
  IF jsonb_typeof(v_entry->'evidenceRefs') IS DISTINCT FROM 'array'
   OR jsonb_array_length(v_entry->'evidenceRefs')>20 THEN
   RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';
  END IF;
  FOR v_selector IN SELECT value FROM jsonb_array_elements(v_entry->'evidenceRefs') LOOP
   v_reference:=v_selector#>>'{}';
   IF jsonb_typeof(v_selector) IS DISTINCT FROM 'string'
    OR v_reference IS NULL OR v_reference!~'^note:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    OR v_entry->>'status' IS DISTINCT FROM 'done'
    OR jsonb_typeof(v_entry->'actorId') IS DISTINCT FROM 'string'
    OR jsonb_typeof(v_entry->'at') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';
   END IF;
   -- Bind each reference to EVERY marking using it, not only to one final item.
   v_requests:=v_requests||jsonb_build_array(jsonb_build_object('reference',v_reference,'actorId',v_entry->>'actorId','at',v_entry->>'at'));
   v_note_ids:=array_append(v_note_ids,substring(v_reference FROM 6)::uuid);
  END LOOP;
 END LOOP;
 SELECT count(DISTINCT n)::integer INTO v_unique FROM unnest(v_note_ids) n;
 -- One lock/read per distinct note, deterministic order, no note body projected.
 -- SHARE is required here because the evidence must not change or be removed
 -- before the transaction that resolves the ticket reaches COMMIT.
 FOR v_note IN
  SELECT n.id,n.workspace_id,n.account_id,n.ticket_id,n.actor_id,n.created_at
  FROM helpdesk_core.internal_notes n
  WHERE n.workspace_id=(v_record->'context'->>'workspaceId')::uuid
   AND n.account_id=(v_record->'context'->>'accountId')::uuid
   AND n.ticket_id=target AND n.id=ANY(v_note_ids)
  ORDER BY n.id FOR SHARE OF n
 LOOP
  v_reference:='note:'||v_note.id::text;
  FOR v_request IN SELECT value FROM jsonb_array_elements(v_requests) q WHERE q.value->>'reference'=v_reference LOOP
   IF (v_request->>'actorId')::uuid IS DISTINCT FROM v_note.actor_id
    OR v_note.created_at>(v_request->>'at')::timestamptz
    OR v_note.created_at>(v_record->>'readAt')::timestamptz THEN
    RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';
   END IF;
  END LOOP;
  v_evidence:=v_evidence||jsonb_build_array(jsonb_build_object('reference',v_reference,
   'workspaceId',v_note.workspace_id,'accountId',v_note.account_id,'ticketId',v_note.ticket_id,
   'actorId',v_note.actor_id,'at',to_char(v_note.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')));
 END LOOP;
 IF jsonb_array_length(v_evidence)<>v_unique THEN
  RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';
 END IF;
 -- No old authorization is a fallback after a blocked/read operation.
 PERFORM helpdesk_auth.hdn_checklist_ticket(target,false);
 v_record:=jsonb_set(v_record,'{readAt}',to_jsonb(to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')));
 RETURN jsonb_build_object('record',v_record,'evidence',v_evidence);
EXCEPTION WHEN data_exception THEN
 RAISE EXCEPTION 'Evidence denied' USING ERRCODE='HD004';
END$$;

CREATE FUNCTION helpdesk_auth.hdn_mark_execution_checklist(target uuid,cmd jsonb,intent_hash text,intent_key text,request_id uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;view jsonb;prior jsonb;old_doc jsonb;next_doc jsonb;
 tv integer;cv bigint;current_rev bigint;item jsonb;entry jsonb;entries jsonb;selectors text[];ev jsonb;
 item_id text;state text;reason text;ack boolean;now_text text;stamp timestamptz;audit_id uuid:=gen_random_uuid();receipt jsonb;result jsonb;
BEGIN
 -- Validate JSON *types* as well as text, before any casting/reading. No actor/time fields.
 IF cmd IS NULL OR jsonb_typeof(cmd)<>'object' THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='HD006';END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(cmd))<>8
  OR NOT cmd ?& ARRAY['action','itemId','status','expectedTicketVersion','expectedChecklistRevision','evidenceRefs','reason','acknowledgeRisk']
  OR cmd->>'action' IS DISTINCT FROM 'mark' OR jsonb_typeof(cmd->'itemId')<>'string' OR jsonb_typeof(cmd->'status')<>'string'
  OR (cmd->>'status') NOT IN ('pending','done','not_applicable')
  OR jsonb_typeof(cmd->'expectedTicketVersion')<>'number' OR (cmd->>'expectedTicketVersion')!~'^[1-9][0-9]{0,8}$'
  OR jsonb_typeof(cmd->'expectedChecklistRevision')<>'number' OR (cmd->>'expectedChecklistRevision')!~'^(0|[1-9][0-9]{0,15})$'
  OR jsonb_typeof(cmd->'acknowledgeRisk')<>'boolean'
  OR jsonb_typeof(cmd->'evidenceRefs')<>'array'
  OR jsonb_array_length(cmd->'evidenceRefs')>20
  OR jsonb_typeof(cmd->'reason') NOT IN ('string','null')
  OR request_id IS NULL OR intent_key IS NULL OR intent_key!~'^[A-Za-z0-9._:-]{16,128}$'
  OR intent_hash IS NULL OR intent_hash!~'^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='HD006';END IF;
 item_id:=cmd->>'itemId';state:=cmd->>'status';reason:=cmd->>'reason';ack:=(cmd->>'acknowledgeRisk')::boolean;
 tv:=(cmd->>'expectedTicketVersion')::integer;cv:=(cmd->>'expectedChecklistRevision')::bigint;
 IF cv>=9007199254740991 OR item_id!~'^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'
  OR reason IS NOT NULL AND (length(btrim(reason))=0 OR length(reason)>2000 OR reason~'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]') THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='HD006';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(cmd->'evidenceRefs') x WHERE jsonb_typeof(x)<>'string') THEN RAISE EXCEPTION 'Invalid evidence' USING ERRCODE='HD006';END IF;
 SELECT coalesce(array_agg(x),'{}'::text[]) INTO selectors FROM jsonb_array_elements_text(cmd->'evidenceRefs') x;
 IF state<>'done' AND (reason IS NULL OR cardinality(selectors)>0 OR ack) THEN RAISE EXCEPTION 'Invalid reset or waiver' USING ERRCODE='HD006';END IF;
 -- Own receipt is read under CURRENT read authorization. Historical replay does
 -- not need the old ticket state/assignee to be restored and cannot publish again.
 t:=helpdesk_auth.hdn_checklist_ticket(target,false);
 prior:=helpdesk_auth.hdn_checklist_receipt(target,intent_key);
 IF prior IS NOT NULL THEN
  IF prior->>'hash' IS DISTINCT FROM intent_hash OR prior->'command' IS DISTINCT FROM cmd THEN RAISE EXCEPTION 'Intent conflict' USING ERRCODE='HD005';END IF;
  RETURN jsonb_build_object('receipt',prior->'result','record',NULL);
 END IF;
 t:=helpdesk_auth.hdn_checklist_ticket(target,true);
 IF t.status NOT IN ('triage','open','waiting_internal','waiting_third_party') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HD003';END IF;
 view:=helpdesk_auth.hdn_lock_execution_checklist(target);old_doc:=nullif(view->'snapshot','null'::jsonb);
 current_rev:=coalesce((old_doc->>'revision')::bigint,0);
 IF t.version<>tv OR current_rev<>cv THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='HD002';END IF;
 SELECT x INTO item FROM jsonb_array_elements(view->'template'->'items') x WHERE x->>'id'=item_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown item' USING ERRCODE='HD006';END IF;
 IF state='not_applicable' AND (item->>'allowNotApplicable' IS DISTINCT FROM 'true' OR item->>'risk'='sensitive')
  OR ack AND item->>'risk' IS DISTINCT FROM 'sensitive' THEN RAISE EXCEPTION 'Invalid mark' USING ERRCODE='HD006';END IF;
 IF state='done' AND (item->>'evidenceRequired'='true' AND cardinality(selectors)=0
  OR item->>'risk'='sensitive' AND (NOT ack OR cardinality(selectors)=0)) THEN RAISE EXCEPTION 'Evidence and acknowledgement required' USING ERRCODE='HD004';END IF;
 ev:=helpdesk_auth.hdn_checklist_evidence(target,selectors);
 stamp:=clock_timestamp();now_text:=to_char(stamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"');
 entry:=jsonb_build_object('itemId',item_id,'status',state,'actorId',CASE WHEN state='pending' THEN NULL ELSE helpdesk_auth.actor_id() END,
  'at',CASE WHEN state='pending' THEN NULL ELSE now_text END,'evidenceRefs',cmd->'evidenceRefs',
  'reason',CASE WHEN state='pending' THEN NULL ELSE reason END,
  'riskAcknowledgement',CASE WHEN ack THEN jsonb_build_object('actorId',helpdesk_auth.actor_id(),'at',now_text,'statement','Reconheço o risco descrito e registrei a conferência da execução. Esta marcação não autoriza ação no sistema de origem.') ELSE NULL END);
 SELECT coalesce(jsonb_agg(CASE WHEN it.value->>'id'=item_id THEN entry ELSE prior_entry.value END ORDER BY it.ordinality),'[]'::jsonb) INTO entries
  FROM jsonb_array_elements(view->'template'->'items') WITH ORDINALITY it(value,ordinality)
  LEFT JOIN LATERAL (SELECT x.value FROM jsonb_array_elements(coalesce(old_doc->'entries','[]'::jsonb)) x(value) WHERE x.value->>'itemId'=it.value->>'id') prior_entry ON true
  WHERE it.value->>'id'=item_id OR prior_entry.value IS NOT NULL;
 next_doc:=(view->'context')||jsonb_build_object('revision',cv+1,'entries',entries);
 INSERT INTO helpdesk_core.hdn_execution_snapshots(workspace_id,account_id,ticket_id,ticket_version,revision,document)
  VALUES(t.workspace_id,t.account_id,t.id,t.version,cv+1,next_doc)
  ON CONFLICT(workspace_id,account_id,ticket_id,ticket_version) DO UPDATE SET revision=EXCLUDED.revision,document=EXCLUDED.document
  WHERE helpdesk_core.hdn_execution_snapshots.revision=cv;
 IF NOT FOUND THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='HD002';END IF;
 INSERT INTO helpdesk_core.hdn_execution_audit(id,workspace_id,account_id,ticket_id,ticket_version,checklist_revision,actor_id,request_id,at,reason,before_document,after_document)
  VALUES(audit_id,t.workspace_id,t.account_id,t.id,t.version,cv+1,helpdesk_auth.actor_id(),request_id,stamp,reason,old_doc,next_doc);
 receipt:=jsonb_build_object('ticketId',t.id,'workspaceId',t.workspace_id,'accountId',t.account_id,'actorId',helpdesk_auth.actor_id(),
  'itemId',item_id,'status',state,'ticketVersion',t.version,'checklistRevision',cv+1,'auditId',audit_id,'at',now_text,'replayed',false);
 INSERT INTO helpdesk_core.hdn_execution_receipts(workspace_id,account_id,ticket_id,actor_id,key,intent_hash,command,audit_id,result)
  VALUES(t.workspace_id,t.account_id,t.id,helpdesk_auth.actor_id(),intent_key,intent_hash,cmd,audit_id,receipt);
 result:=helpdesk_auth.hdn_lock_execution_checklist(target);
 RETURN jsonb_build_object('receipt',receipt,'record',result);
END$$;

-- HDN-01g: rejection boundary used by the ORIGINAL PostgresStore.
-- This is not a resolver or a token authorizing the structured workflow. It
-- refuses a status-changing completion on a ticket with a required checklist.
-- Legacy tickets and same-state message version bumps keep their old behavior.
CREATE FUNCTION helpdesk_auth.hdn_legacy_terminal_update(w uuid,a uuid,target uuid,next_status text,expected_version integer)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;
BEGIN
 IF session_user<>'helpdesk_app' OR w IS DISTINCT FROM helpdesk_auth.workspace_id()
  OR a IS NULL OR target IS NULL OR next_status IS NULL OR next_status NOT IN ('resolved','closed')
  OR expected_version IS NULL OR expected_version<1
  OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:read'),false)
  OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:write'),false) THEN
  RAISE EXCEPTION 'Denied' USING ERRCODE='HD001';
 END IF;
 -- Same parent-first lock order as the marking/reading helpers. No private note
 -- permission is requested for an unbound legacy ticket or same-state message.
 SELECT * INTO t FROM helpdesk_core.tickets
  WHERE workspace_id=w AND account_id=a AND id=target FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:read'),false)
  OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:write'),false)
  OR NOT coalesce(helpdesk_auth.can_read_ticket(w,a,t.product_instance_id,t.created_by),false)
  OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,a,target,'tickets.write'),false) THEN
  RAISE EXCEPTION 'Denied' USING ERRCODE='HD001';
 END IF;
 IF t.version<>expected_version THEN
  RAISE EXCEPTION 'Version conflict' USING ERRCODE='HD002';
 END IF;
 IF t.status=next_status THEN RETURN 'legacy_allowed'; END IF;
 PERFORM 1 FROM helpdesk_core.hdn_execution_bindings
  WHERE workspace_id=w AND account_id=a AND ticket_id=target FOR SHARE;
 IF FOUND THEN
  -- A database error also marks the transaction failed if an internal caller
  -- accidentally catches it. Never return a permissive default after refusal.
  RAISE EXCEPTION 'Structured workflow required' USING ERRCODE='HD008';
 END IF;
 RETURN 'legacy_allowed';
END$$;

DO $privileges$
DECLARE obj text;role_name text;
BEGIN
 FOREACH obj IN ARRAY ARRAY['helpdesk_core.hdn_execution_templates','helpdesk_core.hdn_execution_bindings','helpdesk_core.hdn_execution_snapshots','helpdesk_core.hdn_execution_audit','helpdesk_core.hdn_execution_receipts'] LOOP
  EXECUTE 'ALTER TABLE '||obj||' ENABLE ROW LEVEL SECURITY';EXECUTE 'ALTER TABLE '||obj||' FORCE ROW LEVEL SECURITY';
  EXECUTE 'REVOKE ALL ON TABLE '||obj||' FROM PUBLIC,helpdesk_app';
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I',obj,role_name);END IF;
  END LOOP;
 END LOOP;
 FOREACH obj IN ARRAY ARRAY['helpdesk_auth.hdn_legacy_terminal_update(uuid,uuid,uuid,text,integer)','helpdesk_auth.hdn_valid_execution_template(jsonb)','helpdesk_auth.hdn_execution_immutable()','helpdesk_auth.hdn_checklist_contract()','helpdesk_auth.hdn_lock_execution_checklist_resolution(uuid)','helpdesk_auth.hdn_checklist_ticket(uuid,boolean)','helpdesk_auth.hdn_lock_execution_checklist(uuid)','helpdesk_auth.hdn_checklist_receipt(uuid,text)','helpdesk_auth.hdn_checklist_evidence(uuid,text[])','helpdesk_auth.hdn_mark_execution_checklist(uuid,jsonb,text,text,uuid)'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||obj||' FROM PUBLIC,helpdesk_app';
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',obj,role_name);END IF;
  END LOOP;
 END LOOP;
END $privileges$;
GRANT EXECUTE ON FUNCTION helpdesk_auth.hdn_legacy_terminal_update(uuid,uuid,uuid,text,integer),helpdesk_auth.hdn_checklist_contract(),helpdesk_auth.hdn_lock_execution_checklist_resolution(uuid),helpdesk_auth.hdn_lock_execution_checklist(uuid),helpdesk_auth.hdn_checklist_receipt(uuid,text),helpdesk_auth.hdn_checklist_evidence(uuid,text[]),helpdesk_auth.hdn_mark_execution_checklist(uuid,jsonb,text,text,uuid) TO helpdesk_app;
