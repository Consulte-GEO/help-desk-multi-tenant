-- M02 CANDIDATE, NOT A MIGRATION OR A HOSTED INSTALLER.
-- Install after D/E/G + hdn_execution_checklist in the existing owned PG17 runner.
-- No original migration, trigger or grant is removed. The application never owns
-- these tables; a private helper executes a bounded command and reauthorizes it.
DO $guard$
BEGIN
 IF current_database()<>'helpdesk_test'
  OR current_setting('app.hdn_workflow_candidate',true) IS DISTINCT FROM 'disposable-pg17'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper)
  OR to_regprocedure('helpdesk_auth.hdn_lock_execution_checklist_resolution(uuid)') IS NULL THEN
  RAISE EXCEPTION 'Owned disposable PG17 and existing HDN required' USING ERRCODE='42501';
 END IF;
END $guard$;

CREATE TABLE helpdesk_core.hdn_workflow_profiles(
 workspace_id uuid NOT NULL REFERENCES helpdesk_core.workspaces(id),
 version_id text COLLATE "C" NOT NULL CHECK(version_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$'),
 document jsonb NOT NULL,
 PRIMARY KEY(workspace_id,version_id),
 CHECK(coalesce(jsonb_typeof(document)='object' AND document ?& ARRAY['versionId','status','reopenWindowMicros']
  AND (document-ARRAY['versionId','status','reopenWindowMicros','executionChecklist'])='{}'::jsonb
  AND jsonb_typeof(document->'versionId')='string' AND document->>'versionId'=version_id
  AND jsonb_typeof(document->'status')='string' AND document->>'status'='published'
  AND jsonb_typeof(document->'reopenWindowMicros')='string'
  AND document->>'reopenWindowMicros' ~ '^(0|[1-9][0-9]{0,17})$',false))
);
CREATE TABLE helpdesk_core.hdn_workflow_state(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,
 profile_version_id text NOT NULL,approval text NOT NULL CHECK(approval IN ('not_required','pending','approved')),
 last_event_at timestamptz NOT NULL,closed_at timestamptz,resolution text,
 PRIMARY KEY(workspace_id,account_id,ticket_id),
 FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.tickets(workspace_id,account_id,id),
 FOREIGN KEY(workspace_id,profile_version_id) REFERENCES helpdesk_core.hdn_workflow_profiles(workspace_id,version_id),
 CHECK(resolution IS NULL OR (length(btrim(resolution))>0 AND length(resolution)<=12000))
);
-- One private ledger is both immutable audit and receipt; core functional events
-- and outbox stay in their EXISTING tables and formats. No second sender is added.
CREATE TABLE helpdesk_audit.hdn_workflow_commits(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,ticket_id uuid NOT NULL,event_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),profile_version_id text NOT NULL,
 from_version integer NOT NULL CHECK(from_version>0),to_version integer NOT NULL CHECK(to_version=from_version+1),
 from_status text NOT NULL,to_status text NOT NULL,core_type text NOT NULL CHECK(core_type IN ('ticket.status_changed','message.created','ticket.assignment_changed')),
 transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),
 intent_key text NOT NULL CHECK(intent_key ~ '^[A-Za-z0-9._:-]{16,128}$'),intent_hash text NOT NULL CHECK(intent_hash ~ '^[a-f0-9]{64}$'),
 command jsonb NOT NULL,public_event jsonb NOT NULL,audit jsonb NOT NULL,result jsonb NOT NULL,at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id,event_id),
 UNIQUE(workspace_id,account_id,ticket_id,actor_id,intent_key),
 UNIQUE(workspace_id,account_id,ticket_id,to_version),
 FOREIGN KEY(workspace_id,account_id,ticket_id) REFERENCES helpdesk_core.tickets(workspace_id,account_id,id),
 FOREIGN KEY(workspace_id,profile_version_id) REFERENCES helpdesk_core.hdn_workflow_profiles(workspace_id,version_id)
);
CREATE TRIGGER hdn_workflow_profile_immutable BEFORE UPDATE OR DELETE ON helpdesk_core.hdn_workflow_profiles
 FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_execution_immutable();
CREATE TRIGGER hdn_workflow_commit_immutable BEFORE UPDATE OR DELETE ON helpdesk_audit.hdn_workflow_commits
 FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_execution_immutable();

-- Profile binding and audience cannot be silently reassigned by a later publisher.
CREATE FUNCTION helpdesk_auth.hdn_guard_workflow_state() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Workflow history is retained' USING ERRCODE='23514';END IF;
 IF (NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.profile_version_id) IS DISTINCT FROM
    (OLD.workspace_id,OLD.account_id,OLD.ticket_id,OLD.profile_version_id)
  OR NEW.last_event_at<OLD.last_event_at THEN
  RAISE EXCEPTION 'Pinned workflow identity/history cannot change' USING ERRCODE='23514';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER hdn_workflow_state_identity BEFORE UPDATE OR DELETE ON helpdesk_core.hdn_workflow_state
 FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_guard_workflow_state();

-- Canonical subset used by the fixed workflow/checklist documents: ASCII keys,
-- JSON strings/bools/null, arrays, SAFE INTEGERS. Not advertised as RFC8785.
CREATE FUNCTION helpdesk_auth.hdn_workflow_canonical(d jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE answer text;n numeric;
BEGIN
 CASE jsonb_typeof(d)
 WHEN 'object' THEN
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(d) k WHERE k !~ '^[A-Za-z0-9_]+$') THEN RAISE EXCEPTION 'Unsupported key' USING ERRCODE='HDW06';END IF;
  SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||helpdesk_auth.hdn_workflow_canonical(value),',' ORDER BY key COLLATE "C"),'')||'}' INTO answer FROM jsonb_each(d);
 WHEN 'array' THEN
  SELECT '['||coalesce(string_agg(helpdesk_auth.hdn_workflow_canonical(value),',' ORDER BY ordinality),'')||']' INTO answer FROM jsonb_array_elements(d) WITH ORDINALITY;
 WHEN 'number' THEN
  n:=(d#>>'{}')::numeric;IF n<>trunc(n) OR abs(n)>9007199254740991 THEN RAISE EXCEPTION 'Unsafe number' USING ERRCODE='HDW06';END IF;
  answer:=n::bigint::text;
 WHEN 'string' THEN answer:=d::text;
 WHEN 'boolean' THEN answer:=d::text;
 WHEN 'null' THEN answer:=d::text;
 ELSE RAISE EXCEPTION 'Invalid JSON' USING ERRCODE='HDW06';
 END CASE;
 RETURN answer;
END$$;
CREATE FUNCTION helpdesk_auth.hdn_workflow_digest(d jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT encode(sha256(convert_to(helpdesk_auth.hdn_workflow_canonical(d),'UTF8')),'hex')
$$;
CREATE FUNCTION helpdesk_auth.hdn_workflow_iso(t timestamptz) RETURNS text LANGUAGE sql STABLE SET search_path='' AS $$
 SELECT to_char(t AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
$$;

CREATE FUNCTION helpdesk_auth.hdn_read_support_workflow(target uuid) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE t helpdesk_core.tickets%rowtype;s helpdesk_core.hdn_workflow_state%rowtype;profile jsonb;scope jsonb;who uuid:=helpdesk_auth.actor_id();
BEGIN
 IF session_user<>'helpdesk_app' OR NOT coalesce(helpdesk_auth.is_human(),false)
  OR NOT coalesce(helpdesk_auth.has_scope(helpdesk_auth.workspace_id(),'tickets:read'),false)
  OR NOT coalesce(helpdesk_auth.has_scope(helpdesk_auth.workspace_id(),'tickets:write'),false) THEN
  RAISE EXCEPTION 'Denied' USING ERRCODE='HDW01';
 END IF;
 -- Same source/ACL helper and same locks as the existing resource transaction.
 scope:=helpdesk_auth.cg_lock_ticket_scope(target,'tickets.write');
 IF scope IS NULL THEN RAISE EXCEPTION 'Denied' USING ERRCODE='HDW01';END IF;
 SELECT * INTO t FROM helpdesk_core.tickets WHERE workspace_id=helpdesk_auth.workspace_id() AND id=target FOR UPDATE;
 IF NOT FOUND OR NOT coalesce(helpdesk_auth.can_read_ticket(t.workspace_id,t.account_id,t.product_instance_id,t.created_by),false) THEN
  RAISE EXCEPTION 'Denied' USING ERRCODE='HDW01';
 END IF;
 SELECT * INTO s FROM helpdesk_core.hdn_workflow_state WHERE workspace_id=t.workspace_id AND account_id=t.account_id AND ticket_id=t.id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pinned workflow required' USING ERRCODE='HDW07';END IF;
 SELECT document INTO profile FROM helpdesk_core.hdn_workflow_profiles WHERE workspace_id=t.workspace_id AND version_id=s.profile_version_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Pinned profile required' USING ERRCODE='HDW07';END IF;
 RETURN jsonb_build_object('principalId',who,'profile',profile,'ticket',jsonb_build_object(
  'id',t.id,'workspaceId',t.workspace_id,'accountId',t.account_id,'productInstanceId',t.product_instance_id,'serviceCode',t.service_code,
  'createdBy',t.created_by,'assignedTo',t.assigned_to,'subject',t.subject,'description',t.description,'status',t.status,'priority',t.priority,
  'version',t.version,'coverageId',t.coverage_id,'contractVersionId',t.contract_version_id,'contractSnapshot',t.contract_snapshot,
  'createdAt',helpdesk_auth.hdn_workflow_iso(t.created_at),'updatedAt',helpdesk_auth.hdn_workflow_iso(t.updated_at),
  'profileVersionId',s.profile_version_id,'lastEventAt',helpdesk_auth.hdn_workflow_iso(greatest(t.updated_at,s.last_event_at)),
  'closedAt',CASE WHEN s.closed_at IS NULL THEN NULL ELSE helpdesk_auth.hdn_workflow_iso(s.closed_at) END,'resolution',s.resolution,'approval',s.approval));
END$$;
CREATE FUNCTION helpdesk_auth.hdn_support_workflow_receipt(target uuid,k text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;r helpdesk_audit.hdn_workflow_commits%rowtype;
BEGIN
 v:=helpdesk_auth.hdn_read_support_workflow(target);
 SELECT * INTO r FROM helpdesk_audit.hdn_workflow_commits WHERE workspace_id=helpdesk_auth.workspace_id()
  AND account_id=(v->'ticket'->>'accountId')::uuid AND ticket_id=target AND actor_id=helpdesk_auth.actor_id() AND intent_key=k;
 IF NOT FOUND THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('key',r.intent_key,'hash',r.intent_hash,'result',r.result);
END$$;

CREATE FUNCTION helpdesk_auth.hdn_workflow_completion(target uuid,profile_id text,reference jsonb,decision_at timestamptz) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE r jsonb;d jsonb;s jsonb;i jsonb;e jsonb;done_count integer:=0;waived_count integer:=0;pending_count integer:=0;
BEGIN
 -- Existing helper locks and validates every referenced note, its author/time and
 -- the entire resource set. This function additionally checks REQUIRED items.
 IF decision_at IS NULL OR NOT isfinite(decision_at) OR decision_at>clock_timestamp() THEN RAISE EXCEPTION 'Decision time required' USING ERRCODE='HDW08';END IF;
 r:=helpdesk_auth.hdn_lock_execution_checklist_resolution(target);d:=r->'record'->'template';s:=r->'record'->'snapshot';
 IF s IS NULL OR s='null'::jsonb OR r->'record'->'context'->>'profileVersionId' IS DISTINCT FROM profile_id
  OR r->'record'->'context'->'reference' IS DISTINCT FROM reference OR d->>'status' IS DISTINCT FROM 'published'
  OR helpdesk_auth.hdn_workflow_digest(d) IS DISTINCT FROM reference->>'sha256' THEN
  RAISE EXCEPTION 'Checklist required' USING ERRCODE='HDW04';
 END IF;
 FOR i IN SELECT value FROM jsonb_array_elements(d->'items') LOOP
  SELECT value INTO e FROM jsonb_array_elements(s->'entries') q WHERE q.value->>'itemId'=i->>'id';
  IF FOUND AND e->>'status'<>'pending' AND (e->>'at' IS NULL OR (e->>'at')::timestamptz>decision_at
   OR e->>'actorId' IS NULL OR jsonb_typeof(e->'evidenceRefs') IS DISTINCT FROM 'array') THEN
   RAISE EXCEPTION 'Mark time incompatible' USING ERRCODE='HDW04';END IF;
  IF e IS NULL OR e->>'status'='pending' THEN
   IF i->'required'='true'::jsonb THEN RAISE EXCEPTION 'Checklist incomplete' USING ERRCODE='HDW04';END IF;
   pending_count:=pending_count+1;
  ELSIF e->>'status'='not_applicable' THEN
   IF i->'allowNotApplicable' IS DISTINCT FROM 'true'::jsonb OR i->>'risk'='sensitive' OR length(btrim(coalesce(e->>'reason','')))=0
    OR e->'riskAcknowledgement' IS DISTINCT FROM 'null'::jsonb OR e->'evidenceRefs' IS DISTINCT FROM '[]'::jsonb THEN
    RAISE EXCEPTION 'Checklist waiver denied' USING ERRCODE='HDW04';END IF;
   waived_count:=waived_count+1;
  ELSIF e->>'status'='done' THEN
   IF i->'evidenceRequired'='true'::jsonb AND jsonb_array_length(e->'evidenceRefs')=0 THEN RAISE EXCEPTION 'Evidence required' USING ERRCODE='HDW04';END IF;
   IF i->>'risk'='sensitive' AND (e->'riskAcknowledgement'->>'actorId' IS DISTINCT FROM e->>'actorId'
    OR (e->'riskAcknowledgement'->>'at')::timestamptz IS NULL
    OR (e->'riskAcknowledgement'->>'at')::timestamptz<(e->>'at')::timestamptz
    OR length(btrim(coalesce(e->'riskAcknowledgement'->>'statement','')))=0
    OR (e->'riskAcknowledgement'->>'at')::timestamptz>decision_at) THEN RAISE EXCEPTION 'Acknowledgement required' USING ERRCODE='HDW04';END IF;
   IF i->>'risk'='ordinary' AND e->'riskAcknowledgement' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Unexpected acknowledgement' USING ERRCODE='HDW04';END IF;
   done_count:=done_count+1;
  ELSE RAISE EXCEPTION 'Invalid checklist' USING ERRCODE='HDW04';END IF;
 END LOOP;
 RETURN jsonb_build_object('templateId',reference->>'id','templateVersion',reference->'version','templateSha256',reference->>'sha256',
  'snapshotRevision',s->'revision','snapshotSha256',helpdesk_auth.hdn_workflow_digest(s),'doneCount',done_count,'waivedCount',waived_count,'optionalPendingCount',pending_count);
END$$;

-- A private, transaction-bound ledger row must precede a structured status change.
-- It cannot be manufactured by SET_CONFIG, raw UPDATE or a public "approved" flag.
CREATE FUNCTION helpdesk_auth.hdn_guard_workflow_transition() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 -- Every version/assignment/status update of a bound ticket needs its private command, including same-state replies.
 IF EXISTS(SELECT 1 FROM helpdesk_core.hdn_workflow_state WHERE (workspace_id,account_id,ticket_id)=(OLD.workspace_id,OLD.account_id,OLD.id)) THEN
  IF NOT EXISTS(SELECT 1 FROM helpdesk_audit.hdn_workflow_commits c WHERE
   (c.workspace_id,c.account_id,c.ticket_id,c.actor_id,c.from_version,c.to_version,c.from_status,c.to_status)=
   (OLD.workspace_id,OLD.account_id,OLD.id,helpdesk_auth.actor_id(),OLD.version,NEW.version,OLD.status,NEW.status)
   AND c.transaction_id=pg_current_xact_id()
   AND (NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to OR (c.command->>'action'='transfer' AND c.command->>'targetPrincipalId'=NEW.assigned_to::text))) THEN RAISE EXCEPTION 'Structured writer required' USING ERRCODE='HDW03';END IF;
 ELSIF NEW.status IN ('resolved','closed') AND EXISTS(SELECT 1 FROM helpdesk_core.hdn_execution_bindings WHERE
  (workspace_id,account_id,ticket_id)=(OLD.workspace_id,OLD.account_id,OLD.id)) THEN
  RAISE EXCEPTION 'Workflow binding required' USING ERRCODE='HDW07';
 END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER hdn_guard_workflow_transition BEFORE UPDATE ON helpdesk_core.tickets
 FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_guard_workflow_transition();
CREATE FUNCTION helpdesk_auth.hdn_require_workflow_commit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM helpdesk_core.ticket_events e LEFT JOIN helpdesk_integration.outbox_events o
  ON (o.workspace_id,o.account_id,o.ticket_id,o.id,o.type)=(e.workspace_id,e.account_id,e.ticket_id,e.id,e.type)
  JOIN helpdesk_audit.write_effects f ON (f.workspace_id,f.event_id)=(e.workspace_id,e.id)
  WHERE (e.workspace_id,e.account_id,e.ticket_id,e.id,e.actor_id,e.type)=
   (NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.event_id,NEW.actor_id,NEW.core_type)
   AND f.transaction_id=NEW.transaction_id AND f.ticket_version=NEW.to_version AND f.applied
   AND ((NEW.core_type='ticket.assignment_changed' AND o.id IS NULL) OR (NEW.core_type<>'ticket.assignment_changed' AND o.id IS NOT NULL)))
  OR NOT EXISTS(SELECT 1 FROM helpdesk_core.hdn_workflow_state s JOIN helpdesk_core.tickets t
    ON (t.workspace_id,t.account_id,t.id)=(s.workspace_id,s.account_id,s.ticket_id)
    WHERE (s.workspace_id,s.account_id,s.ticket_id,s.profile_version_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.profile_version_id)
     AND t.version>=NEW.to_version AND s.last_event_at>=NEW.at) THEN
  RAISE EXCEPTION 'Incomplete structured commit' USING ERRCODE='23514';
 END IF;
 IF NEW.command->>'action'='transfer' THEN PERFORM helpdesk_auth.hdn_verify_workflow_assignee(NEW.ticket_id,(NEW.command->>'targetPrincipalId')::uuid,NULL);END IF;
 RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER hdn_complete_workflow_commit AFTER INSERT ON helpdesk_audit.hdn_workflow_commits
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_require_workflow_commit();

CREATE FUNCTION helpdesk_auth.hdn_commit_support_workflow(target uuid,payload jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;t jsonb;profile jsonb;cmd jsonb;result jsonb;ev jsonb;aud jsonb;proof jsonb;
 old_receipt helpdesk_audit.hdn_workflow_commits%rowtype;
 who uuid:=helpdesk_auth.actor_id();w uuid:=helpdesk_auth.workspace_id();a uuid;event_id uuid;request_id uuid;
 expected integer;next_version integer;action text;prior_status text;next_status text;kind text;core_type text;
 body text;reason text;at_text text;stamp timestamptz;operator boolean;message_id uuid;count_rows integer;
BEGIN
 IF payload IS NULL OR jsonb_typeof(payload)<>'object' OR octet_length(payload::text)>98304
  OR (SELECT count(*) FROM jsonb_object_keys(payload))<>10
  OR NOT payload ?& ARRAY['schema','profileVersionId','command','at','requestId','eventId','key','hash','audit','receipt']
  OR payload->'schema' IS DISTINCT FROM '1'::jsonb THEN RAISE EXCEPTION 'Invalid submission' USING ERRCODE='HDW06';END IF;
 v:=helpdesk_auth.hdn_read_support_workflow(target);t:=v->'ticket';profile:=v->'profile';a:=(t->>'accountId')::uuid;
 cmd:=payload->'command';
 IF jsonb_typeof(cmd) IS DISTINCT FROM 'object' OR jsonb_typeof(cmd->'action') IS DISTINCT FROM 'string'
  OR jsonb_typeof(cmd->'expectedVersion') IS DISTINCT FROM 'number' OR cmd->>'expectedVersion' !~ '^[1-9][0-9]{0,8}$'
  OR jsonb_typeof(payload->'key') IS DISTINCT FROM 'string' OR payload->>'key' !~ '^[A-Za-z0-9._:-]{16,128}$'
  OR jsonb_typeof(payload->'hash') IS DISTINCT FROM 'string' OR payload->>'hash' !~ '^[a-f0-9]{64}$'
  OR payload->>'profileVersionId' IS DISTINCT FROM profile->>'versionId' THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='HDW06';END IF;
 action:=cmd->>'action';
 IF action IN ('reply','customer_reply','request_customer','resolve') THEN
  IF (SELECT count(*) FROM jsonb_object_keys(cmd))<>3 OR NOT cmd ?& ARRAY['action','expectedVersion','body']
   OR jsonb_typeof(cmd->'body') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Body required' USING ERRCODE='HDW06';END IF;
  body:=cmd->>'body';IF body !~ '[^[:space:]]' OR length(btrim(body))=0 OR length(body)>12000 OR body~'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' THEN RAISE EXCEPTION 'Invalid body' USING ERRCODE='HDW06';END IF;
 ELSIF action IN ('reopen','cancel','handoff','transfer') THEN
  IF (SELECT count(*) FROM jsonb_object_keys(cmd))<>(CASE WHEN action IN ('handoff','transfer') THEN 4 ELSE 3 END)
   OR NOT cmd ?& ARRAY['action','expectedVersion','reason'] OR jsonb_typeof(cmd->'reason') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Reason required' USING ERRCODE='HDW06';END IF;
  IF action='transfer' AND (NOT cmd ? 'targetPrincipalId' OR jsonb_typeof(cmd->'targetPrincipalId') IS DISTINCT FROM 'string' OR NOT pg_input_is_valid(cmd->>'targetPrincipalId','uuid')) THEN RAISE EXCEPTION 'Target required' USING ERRCODE='HDW06';END IF;
  reason:=cmd->>'reason';IF reason !~ '[^[:space:]]' OR length(btrim(reason))=0 OR length(reason)>12000 OR reason~'[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]' THEN RAISE EXCEPTION 'Invalid reason' USING ERRCODE='HDW06';END IF;
 ELSIF action NOT IN ('start','triage','close') OR (SELECT count(*) FROM jsonb_object_keys(cmd))<>2 OR NOT cmd ?& ARRAY['action','expectedVersion'] THEN
  RAISE EXCEPTION 'Unsupported command' USING ERRCODE='HDW03';
 END IF;
 IF payload->>'hash' IS DISTINCT FROM helpdesk_auth.hdn_workflow_digest(jsonb_build_object('workspaceId',w,'actorId',who,'ticketId',target,'command',cmd)) THEN
  RAISE EXCEPTION 'Intent differs' USING ERRCODE='HDW05';END IF;
 SELECT * INTO old_receipt FROM helpdesk_audit.hdn_workflow_commits WHERE workspace_id=w AND account_id=a AND ticket_id=target AND actor_id=who AND intent_key=payload->>'key';
 IF FOUND THEN
  IF old_receipt.command IS DISTINCT FROM cmd OR old_receipt.intent_hash IS DISTINCT FROM payload->>'hash' THEN RAISE EXCEPTION 'Intent conflict' USING ERRCODE='HDW05';END IF;
  RETURN old_receipt.result;
 END IF;
 expected:=(cmd->>'expectedVersion')::integer;next_version:=expected+1;
 IF expected<>(t->>'version')::integer THEN RAISE EXCEPTION 'Version conflict' USING ERRCODE='HDW02';END IF;
 action:=cmd->>'action';prior_status:=t->>'status';next_status:=prior_status;kind:=action;
 operator:=coalesce(helpdesk_auth.is_operator(w,a),false);
 IF NOT operator AND action NOT IN ('customer_reply','close','reopen') THEN RAISE EXCEPTION 'Denied' USING ERRCODE='HDW01';END IF;
 IF t->>'approval'='pending' AND action<>'cancel' THEN RAISE EXCEPTION 'Approval pending' USING ERRCODE='HDW03';END IF;
 at_text:=payload->>'at';
 IF jsonb_typeof(payload->'at') IS DISTINCT FROM 'string' OR at_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}([0-9]{3})?Z$'
  OR NOT pg_input_is_valid(at_text,'timestamptz') THEN RAISE EXCEPTION 'Invalid time' USING ERRCODE='HDW08';END IF;
 stamp:=at_text::timestamptz;
 IF stamp<(t->>'lastEventAt')::timestamptz OR stamp>clock_timestamp() THEN RAISE EXCEPTION 'Time conflict' USING ERRCODE='HDW08';END IF;
 event_id:=(payload->>'eventId')::uuid;request_id:=(payload->>'requestId')::uuid;
 IF event_id IS NULL OR request_id IS NULL THEN RAISE EXCEPTION 'Identifiers required' USING ERRCODE='HDW06';END IF;

 CASE action
 WHEN 'start' THEN IF prior_status NOT IN ('new','triage') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;next_status:='open';kind:='transition';
 WHEN 'triage' THEN IF prior_status<>'new' THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;next_status:='triage';kind:='transition';
 WHEN 'reply' THEN IF prior_status NOT IN ('triage','open','waiting_customer','waiting_internal','waiting_third_party') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;
 WHEN 'customer_reply' THEN
  IF prior_status NOT IN ('open','waiting_customer','waiting_internal','waiting_third_party') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;
  IF prior_status='waiting_customer' THEN
   next_status:='open';
  END IF;
 WHEN 'request_customer' THEN IF prior_status NOT IN ('triage','open') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;next_status:='waiting_customer';kind:='devolutiva';
 WHEN 'handoff' THEN IF prior_status<>'open' OR cmd->>'target' NOT IN ('internal','third_party') OR jsonb_typeof(cmd->'target') IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;next_status:=CASE WHEN cmd->>'target'='internal' THEN 'waiting_internal' ELSE 'waiting_third_party' END;
 WHEN 'resolve' THEN
  IF prior_status NOT IN ('open','waiting_customer','waiting_internal','waiting_third_party') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;
  next_status:='resolved';kind:='resolved';
  IF profile ? 'executionChecklist' THEN proof:=helpdesk_auth.hdn_workflow_completion(target,profile->>'versionId',profile->'executionChecklist',stamp);END IF;
 WHEN 'close' THEN IF prior_status<>'resolved' OR length(btrim(coalesce(t->>'resolution','')))=0 THEN RAISE EXCEPTION 'Resolution required' USING ERRCODE='HDW03';END IF;next_status:='closed';kind:='closed';
 WHEN 'reopen' THEN
  IF prior_status NOT IN ('resolved','closed') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;
  IF extract(epoch FROM clock_timestamp()-coalesce((t->>'closedAt')::timestamptz,(t->>'lastEventAt')::timestamptz))*1000000 > (profile->>'reopenWindowMicros')::numeric THEN RAISE EXCEPTION 'Reopening window expired' USING ERRCODE='HDW10';END IF;
  next_status:='open';kind:='reopened';
 WHEN 'transfer' THEN
  IF prior_status NOT IN ('triage','open','waiting_customer','waiting_internal','waiting_third_party') OR length(reason)>2000 OR reason~'[[:cntrl:]]' OR cmd->>'targetPrincipalId' IS NOT DISTINCT FROM t->>'assignedTo' THEN RAISE EXCEPTION 'Transfer conflict' USING ERRCODE='HDW03';END IF;
  PERFORM helpdesk_auth.hdn_verify_workflow_assignee(target,(cmd->>'targetPrincipalId')::uuid,NULL);kind:='assigned';
 WHEN 'cancel' THEN IF prior_status NOT IN ('new','triage','open','waiting_customer','waiting_internal','waiting_third_party') THEN RAISE EXCEPTION 'State conflict' USING ERRCODE='HDW03';END IF;next_status:='cancelled';kind:='cancelled';
 ELSE RAISE EXCEPTION 'Unsupported command' USING ERRCODE='HDW03';
 END CASE;
 result:=jsonb_build_object('ticketId',target,'workspaceId',w,'accountId',a,'actorId',who,'profileVersionId',profile->>'versionId','version',next_version,'status',next_status,'eventId',event_id,'replayed',false);
 aud:=jsonb_build_object('id',event_id,'workspaceId',w,'ticketId',target,'actorId',who,'requestId',request_id,'at',at_text,'action',action,'reason',reason,'from',prior_status,'to',next_status,'version',next_version);
 IF proof IS NOT NULL THEN aud:=aud||jsonb_build_object('executionChecklist',proof);END IF;
 IF payload->'audit' IS DISTINCT FROM aud OR payload->'receipt' IS DISTINCT FROM result THEN RAISE EXCEPTION 'Decision mismatch' USING ERRCODE='HDW06';END IF;
 ev:=jsonb_build_object('ticketId',target,'workspaceId',w,'profileVersionId',profile->>'versionId','sequence',next_version,'at',at_text,'type',kind,'actorId',who,'actorKind',CASE WHEN operator THEN 'human_agent' ELSE 'customer' END,'from',prior_status,'to',next_status);
 IF body IS NOT NULL THEN ev:=ev||jsonb_build_object('body',body);END IF;
 core_type:=CASE WHEN action='transfer' THEN 'ticket.assignment_changed' WHEN next_status<>prior_status THEN 'ticket.status_changed' ELSE 'message.created' END;
 INSERT INTO helpdesk_audit.hdn_workflow_commits(workspace_id,account_id,ticket_id,event_id,actor_id,profile_version_id,from_version,to_version,from_status,to_status,core_type,intent_key,intent_hash,command,public_event,audit,result,at)
 VALUES(w,a,target,event_id,who,profile->>'versionId',expected,next_version,prior_status,next_status,core_type,payload->>'key',payload->>'hash',cmd,ev,aud,result,stamp);
 GET DIAGNOSTICS count_rows=ROW_COUNT;IF count_rows<>1 THEN RAISE EXCEPTION 'Commit record missing' USING ERRCODE='23514';END IF;
 IF core_type='message.created' THEN
  message_id:=event_id;IF body IS NULL THEN RAISE EXCEPTION 'Message required' USING ERRCODE='HDW06';END IF;
  INSERT INTO helpdesk_core.ticket_messages(id,workspace_id,account_id,ticket_id,actor_id,actor_type,body,created_at)
   VALUES(message_id,w,a,target,who,CASE WHEN operator THEN 'human_agent' ELSE 'customer' END,body,stamp);
  GET DIAGNOSTICS count_rows=ROW_COUNT;IF count_rows<>1 THEN RAISE EXCEPTION 'Message missing' USING ERRCODE='23514';END IF;
 END IF;
 UPDATE helpdesk_core.tickets SET status=next_status,assigned_to=CASE WHEN action='transfer' THEN (cmd->>'targetPrincipalId')::uuid ELSE assigned_to END,version=next_version,updated_at=stamp WHERE workspace_id=w AND account_id=a AND id=target AND version=expected;
 GET DIAGNOSTICS count_rows=ROW_COUNT;IF count_rows<>1 THEN RAISE EXCEPTION 'CAS conflict' USING ERRCODE='HDW02';END IF;
 UPDATE helpdesk_core.hdn_workflow_state SET last_event_at=stamp,
  resolution=CASE WHEN action='resolve' THEN body ELSE resolution END,
  closed_at=CASE WHEN action='close' THEN stamp WHEN action='reopen' THEN NULL ELSE closed_at END
  WHERE workspace_id=w AND account_id=a AND ticket_id=target;
 GET DIAGNOSTICS count_rows=ROW_COUNT;IF count_rows<>1 THEN RAISE EXCEPTION 'Metadata missing' USING ERRCODE='HDW07';END IF;
 -- Never put private handoff/cancel reasons in the public core event. The body
 -- and semantic event live in the selectively readable workflow ledger.
 INSERT INTO helpdesk_core.ticket_events(id,workspace_id,account_id,ticket_id,actor_id,type,customer_visible,data,created_at)
 VALUES(event_id,w,a,target,who,core_type,core_type<>'ticket.assignment_changed',
  CASE WHEN core_type='ticket.assignment_changed' THEN jsonb_build_object('action','transfer','from',t->'assignedTo','to',cmd->'targetPrincipalId','reason',reason,'version',next_version)
  WHEN core_type='message.created' THEN jsonb_build_object('messageId',message_id,'actorType',CASE WHEN operator THEN 'human_agent' ELSE 'customer' END)
  ELSE jsonb_build_object('from',prior_status,'to',next_status,'reason','Atendimento atualizado pelo fluxo estruturado.') END,stamp);
 GET DIAGNOSTICS count_rows=ROW_COUNT;IF count_rows<>1 THEN RAISE EXCEPTION 'Event missing' USING ERRCODE='23514';END IF;
 IF core_type<>'ticket.assignment_changed' THEN
 INSERT INTO helpdesk_integration.outbox_events(id,workspace_id,account_id,ticket_id,type,payload,request_id,created_at)
 VALUES(event_id,w,a,target,core_type,jsonb_build_object('specversion','1.0','id',event_id,'source','helpdesk/workspaces/'||w::text,
  'type','com.helpdesk.'||core_type||'.v1','subject','tickets/'||target::text,'datacontenttype','application/json','time',at_text,
  'data',jsonb_build_object('ticket_id',target,'version',next_version)),request_id,stamp);
 GET DIAGNOSTICS count_rows=ROW_COUNT;IF count_rows<>1 THEN RAISE EXCEPTION 'Outbox missing' USING ERRCODE='23514';END IF;
 END IF;
 RETURN result;
EXCEPTION WHEN data_exception THEN RAISE EXCEPTION 'Invalid workflow data' USING ERRCODE='HDW06';
END$$;

-- Qualified compatibility: a private same-transaction decision is the authority;
-- raw caller/GUC values cannot manufacture the Boolean used by original guards.
CREATE FUNCTION helpdesk_auth.hdn_scoped_workflow_commit(w uuid,a uuid,target uuid,before_version integer,after_version integer,prior text,next_status text,destination uuid) RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF session_user<>'helpdesk_app' OR w IS DISTINCT FROM helpdesk_auth.workspace_id() OR NOT coalesce(helpdesk_auth.is_human(),false)
 OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:read') AND helpdesk_auth.has_scope(w,'tickets:write'),false)
 OR NOT coalesce(helpdesk_auth.cg_ticket_resource_allowed(w,a,target,'tickets.write'),false) THEN RETURN false;END IF;
 RETURN EXISTS(SELECT 1 FROM helpdesk_audit.hdn_workflow_commits c WHERE
 (c.workspace_id,c.account_id,c.ticket_id,c.actor_id,c.from_version,c.to_version,c.from_status,c.to_status)=
 (w,a,target,helpdesk_auth.actor_id(),before_version,after_version,prior,next_status)
 AND c.transaction_id=pg_current_xact_id() AND
 ((c.command->>'action'='customer_reply' AND prior='waiting_customer' AND next_status='open')
 OR (c.command->>'action'='reopen' AND prior='closed' AND next_status='open')
 OR (c.command->>'action'='transfer' AND prior=next_status AND c.command->>'targetPrincipalId'=destination::text)));
END$$;

CREATE FUNCTION helpdesk_auth.hdn_verify_workflow_assignee(target uuid,candidate uuid,expected_scope text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v jsonb;s jsonb;key text;w uuid:=helpdesk_auth.workspace_id();a uuid;op text;r record;role_ok boolean;
BEGIN
 v:=helpdesk_auth.hdn_read_support_workflow(target);a:=(v->'ticket'->>'accountId')::uuid;
 IF NOT coalesce(helpdesk_auth.is_operator(w,a),false) OR candidate IS NULL THEN RAISE EXCEPTION 'Assignee denied' USING ERRCODE='HDW09';END IF;
 s:=helpdesk_auth.cg_lock_ticket_scope(target,'tickets.write');
 key:=helpdesk_auth.hdn_workflow_digest(jsonb_build_object('workspaceId',s->'workspaceId','accountId',s->'accountId','bindingId',s->'bindingId','bindingRevision',s->'bindingRevision','accessRevision',s->'accessRevision','refs',s->'refs'));
 IF s IS NULL OR (expected_scope IS NOT NULL AND expected_scope IS DISTINCT FROM key) THEN RAISE EXCEPTION 'Scope differs' USING ERRCODE='HDW09';END IF;
 PERFORM 1 FROM helpdesk_auth.principals WHERE id=candidate AND active AND kind='human' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inactive assignee' USING ERRCODE='HDW09';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('helpdesk-human-scopes:'||w::text||':'||candidate::text,0));
 IF NOT ARRAY['tickets:read','tickets:write']::text[] <@ helpdesk_auth.human_scopes(w,candidate) THEN RAISE EXCEPTION 'Assignee scopes denied' USING ERRCODE='HDW09';END IF;
 PERFORM 1 FROM helpdesk_auth.account_grants WHERE workspace_id=w AND account_id=a AND principal_id=candidate AND active AND role='agent' FOR SHARE;
 role_ok:=FOUND;
 IF NOT role_ok THEN PERFORM 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=candidate AND active AND role='admin' FOR SHARE;role_ok:=FOUND;END IF;
 IF NOT role_ok THEN RAISE EXCEPTION 'Assignee role denied' USING ERRCODE='HDW09';END IF;
 FOREACH op IN ARRAY ARRAY['tickets.read','tickets.write'] LOOP
  SELECT g.expected_count,g.as_of,g.expires_at INTO r FROM helpdesk_auth.cg_resource_grant_sets g
  JOIN helpdesk_auth.cg_resource_observations o ON (o.workspace_id,o.account_id,o.binding_id,o.principal_id,o.operation,o.grant_revision)=
   (g.workspace_id,g.account_id,g.binding_id,g.principal_id,g.operation,g.revision)
  AND o.access_revision=g.source_revision AND o.as_of=g.as_of AND o.expires_at=g.expires_at AND o.expected_count=g.expected_count
  AND o.binding_revision=s->>'bindingRevision' AND o.manifest_fingerprint=s->>'manifestFingerprint'
  WHERE g.workspace_id=w AND g.account_id=a AND g.binding_id=(s->>'bindingId')::uuid AND g.principal_id=candidate AND g.operation=op AND g.active
  FOR SHARE OF g,o;
  IF NOT FOUND OR r.as_of>clock_timestamp() OR r.expires_at<=clock_timestamp()
   OR (SELECT count(*) FROM helpdesk_auth.cg_resource_grant_refs g WHERE g.workspace_id=w AND g.account_id=a AND g.binding_id=(s->>'bindingId')::uuid AND g.principal_id=candidate AND g.operation=op)<>r.expected_count
   OR EXISTS(SELECT 1 FROM helpdesk_core.cg_ticket_resource_refs x WHERE x.workspace_id=w AND x.account_id=a AND x.ticket_id=target AND NOT EXISTS(
    SELECT 1 FROM helpdesk_auth.cg_resource_grant_refs g WHERE g.workspace_id=w AND g.account_id=a AND g.binding_id=(s->>'bindingId')::uuid AND g.principal_id=candidate AND g.operation=op AND g.resource_type=x.resource_type AND g.resource_id=x.resource_id))
  THEN RAISE EXCEPTION 'Assignee resource coverage denied' USING ERRCODE='HDW09';END IF;
 END LOOP;
 RETURN jsonb_build_object('principalId',candidate,'workspaceId',w,'accountId',a,'scopeKey',key,'active',true,'operator',true);
END$$;

CREATE FUNCTION helpdesk_auth.hdn_guard_workflow_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM helpdesk_core.hdn_workflow_state s WHERE (s.workspace_id,s.account_id,s.ticket_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id))
 AND NOT EXISTS(SELECT 1 FROM helpdesk_audit.hdn_workflow_commits c WHERE
 (c.workspace_id,c.account_id,c.ticket_id,c.actor_id,c.event_id)=(NEW.workspace_id,NEW.account_id,NEW.ticket_id,NEW.actor_id,NEW.id)
 AND c.transaction_id=pg_current_xact_id() AND c.core_type='message.created' AND c.command->>'body'=NEW.body)
 THEN RAISE EXCEPTION 'Structured conversation required' USING ERRCODE='HDW03';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER hdn_guard_structured_message BEFORE INSERT ON helpdesk_core.ticket_messages FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_guard_workflow_message();

create or replace function helpdesk_core.guard_ticket_transition() returns trigger
language plpgsql set search_path='' as $$
declare allowed text[];
begin
 if new.status=old.status then return new; end if;
 if ((old.status='waiting_customer' and new.status='open') or (old.status='closed' and new.status='open')) and helpdesk_auth.hdn_scoped_workflow_commit(old.workspace_id,old.account_id,old.id,old.version,new.version,old.status,new.status,new.assigned_to) then return new;end if;
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
create or replace function helpdesk_core.guard_ticket_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.assigned_to is not null then raise exception 'Initial assignment not allowed' using errcode='23514'; end if;
  return new;
 end if;
 if new.assigned_to is not distinct from old.assigned_to then return new; end if;
 if helpdesk_auth.hdn_scoped_workflow_commit(old.workspace_id,old.account_id,old.id,old.version,new.version,old.status,new.status,new.assigned_to) then return new;end if;
 if not coalesce(helpdesk_auth.is_operator(old.workspace_id,old.account_id)
   and helpdesk_auth.has_scope(old.workspace_id,'tickets:read')
   and helpdesk_auth.has_scope(old.workspace_id,'tickets:write'),false) then
  raise exception 'Assignment not authorized' using errcode='42501';
 end if;
 if old.status in ('closed','cancelled') or new.status is distinct from old.status
    or new.priority is distinct from old.priority then
  raise exception 'Assignment must be an isolated nonterminal change' using errcode='23514';
 end if;
 if new.assigned_to is not null then
  if old.assigned_to is not null or new.assigned_to is distinct from helpdesk_auth.actor_id() then
   raise exception 'Only an unassigned ticket may be claimed by self' using errcode='42501';
  end if;
 elsif old.assigned_to is distinct from helpdesk_auth.actor_id() and not exists(
  select 1 from helpdesk_auth.workspace_memberships m
   where m.workspace_id=old.workspace_id and m.principal_id=helpdesk_auth.actor_id() and m.active and m.role='admin'
 ) then
  raise exception 'Only owner or workspace administrator may release' using errcode='42501';
 end if;
 return new;
end$$;
create or replace function helpdesk_audit.record_ticket_effect() returns trigger
language plpgsql security definer set search_path='' as $$
declare k text; d jsonb; matched uuid; changes integer;
begin
 if new.workspace_id is distinct from helpdesk_auth.workspace_id() or helpdesk_auth.actor_id() is null then
  raise exception 'Ticket write requires authenticated transaction context' using errcode='23514';
 end if;
 if tg_op='INSERT' then
  if new.created_by is distinct from helpdesk_auth.actor_id() or new.version<>1 or new.status<>'new' or new.assigned_to is not null then
   raise exception 'Invalid initial ticket effect' using errcode='23514';
  end if;
  k:='ticket.created';d:=jsonb_build_object('version',1);
 else
  -- Existing immutable, version, authorization and workflow guards still execute.
  changes:=(new.status is distinct from old.status)::integer+(new.priority is distinct from old.priority)::integer+
   (new.assigned_to is distinct from old.assigned_to)::integer;
  if changes>1 then raise exception 'One ticket operation per version required' using errcode='23514';end if;
  if new.subject is distinct from old.subject or new.description is distinct from old.description then
   raise exception 'Unsupported ticket field mutation' using errcode='23514';end if;
  if new.status is distinct from old.status then
   k:='ticket.status_changed';d:=jsonb_build_object('from',old.status,'to',new.status);
  elsif new.priority is distinct from old.priority then
   k:='ticket.priority_changed';d:=jsonb_build_object('from',old.priority,'to',new.priority,'version',new.version);
  elsif new.assigned_to is distinct from old.assigned_to then
   k:='ticket.assignment_changed';d:=jsonb_build_object('action',case when exists(select 1 from helpdesk_audit.hdn_workflow_commits c where c.workspace_id=new.workspace_id and c.account_id=new.account_id and c.ticket_id=new.id and c.actor_id=helpdesk_auth.actor_id() and c.transaction_id=pg_current_xact_id() and c.to_version=new.version and c.command->>'action'='transfer') then 'transfer' when new.assigned_to is null then 'release' else 'claim' end,
    'from',old.assigned_to,'to',new.assigned_to,'version',new.version);
  else
   -- A public message is inserted BEFORE its parent version advances. No empty version bumps.
   update helpdesk_audit.write_effects set applied=true
    where workspace_id=new.workspace_id and account_id=new.account_id and ticket_id=new.id
      and ticket_version=new.version and kind='message.created' and actor_id=helpdesk_auth.actor_id()
      and transaction_id=pg_current_xact_id() and not applied returning id into matched;
   if not found then raise exception 'Version bump requires a new matching message' using errcode='23514';end if;
   return null;
  end if;
 end if;
 insert into helpdesk_audit.write_effects(workspace_id,account_id,ticket_id,actor_id,kind,ticket_version,expected_data,applied)
  values(new.workspace_id,new.account_id,new.id,helpdesk_auth.actor_id(),k,new.version,d,true);
 return null;
end$$;
create or replace function helpdesk_core.require_assignment_event() returns trigger
language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from helpdesk_core.ticket_events e
  where (e.workspace_id,e.account_id,e.ticket_id)=(new.workspace_id,new.account_id,new.id)
   and e.type='ticket.assignment_changed' and not e.customer_visible
   and e.actor_id=helpdesk_auth.actor_id() and e.data->>'version'=new.version::text
   and (e.data->>'from') is not distinct from old.assigned_to::text
   and (e.data->>'to') is not distinct from new.assigned_to::text
   and e.data->>'action'=case when helpdesk_auth.hdn_scoped_workflow_commit(old.workspace_id,old.account_id,old.id,old.version,new.version,old.status,new.status,new.assigned_to) then 'transfer' when new.assigned_to is null then 'release' else 'claim' end
 ) then raise exception 'Assignment update requires matching private event' using errcode='23514'; end if;
 return null;
end$$;
alter table helpdesk_core.ticket_events drop constraint assignment_event_shape;
alter table helpdesk_core.ticket_events add constraint assignment_event_shape check(
 type<>'ticket.assignment_changed' or coalesce(
  jsonb_typeof(data)='object' and (data-array['action','from','to','reason','version'])='{}'::jsonb
  and data ?& array['action','from','to','reason','version']
  and jsonb_typeof(data->'reason')='string' and length(btrim(data->>'reason')) between 1 and 2000
  and length(data->>'reason')<=2000 and (data->>'reason') !~ '[[:cntrl:]]'
  and ((data->>'action'='claim' and data->'from'='null'::jsonb and jsonb_typeof(data->'to')='string'
      and data->>'to'=actor_id::text)
   or (data->>'action'='release' and data->'to'='null'::jsonb and jsonb_typeof(data->'from')='string'
      and (data->>'from') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
   or (data->>'action'='transfer' and (data->'from'='null'::jsonb or (data->>'from') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') and (data->>'to') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' and data->'from' is distinct from data->'to'))
  and case when jsonb_typeof(data->'version')='number' then
   (data->>'version')::numeric between 2 and 9007199254740991
    and (data->>'version')::numeric=trunc((data->>'version')::numeric) else false end,false));


DO $privileges$
DECLARE obj text;r text;
BEGIN
 FOREACH obj IN ARRAY ARRAY['helpdesk_core.hdn_workflow_profiles','helpdesk_core.hdn_workflow_state','helpdesk_audit.hdn_workflow_commits'] LOOP
  EXECUTE 'ALTER TABLE '||obj||' ENABLE ROW LEVEL SECURITY';EXECUTE 'ALTER TABLE '||obj||' FORCE ROW LEVEL SECURITY';
  EXECUTE 'REVOKE ALL ON TABLE '||obj||' FROM PUBLIC,helpdesk_app';
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I',obj,r);END IF;
  END LOOP;
 END LOOP;
 FOREACH obj IN ARRAY ARRAY['hdn_workflow_canonical(jsonb)','hdn_workflow_digest(jsonb)','hdn_workflow_iso(timestamptz)',
  'hdn_read_support_workflow(uuid)','hdn_support_workflow_receipt(uuid,text)','hdn_workflow_completion(uuid,text,jsonb,timestamptz)',
  'hdn_guard_workflow_state()','hdn_guard_workflow_transition()','hdn_require_workflow_commit()','hdn_commit_support_workflow(uuid,jsonb)',
  'hdn_verify_workflow_assignee(uuid,uuid,text)','hdn_scoped_workflow_commit(uuid,uuid,uuid,integer,integer,text,text,uuid)','hdn_guard_workflow_message()'] LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION helpdesk_auth.'||obj||' FROM PUBLIC,helpdesk_app';
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP
   IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.%s FROM %I',obj,r);END IF;
  END LOOP;
 END LOOP;
END $privileges$;
GRANT EXECUTE ON FUNCTION helpdesk_auth.hdn_read_support_workflow(uuid),helpdesk_auth.hdn_support_workflow_receipt(uuid,text),helpdesk_auth.hdn_commit_support_workflow(uuid,jsonb) TO helpdesk_app;

GRANT EXECUTE ON FUNCTION helpdesk_auth.hdn_verify_workflow_assignee(uuid,uuid,text),helpdesk_auth.hdn_scoped_workflow_commit(uuid,uuid,uuid,integer,integer,text,text,uuid) TO helpdesk_app;
