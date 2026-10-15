-- Independent private addon. CLI unavailable on the authoring host: this source
-- intentionally has no invented migration timestamp and is outside core0.27.
-- Apply only after the native owned-PG17 qualification. No hosted fixture data.
BEGIN;
DO $$ BEGIN
 IF current_user IN ('helpdesk_app','helpdesk_notification_worker','anon','authenticated','service_role')
  OR current_user<>(SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='helpdesk_auth.schema_version()'::regprocedure)
  OR helpdesk_auth.schema_version()<>'0.27.0' THEN RAISE EXCEPTION 'TRUSTED_CORE_027_OWNER_REQUIRED'; END IF;
 IF to_regclass('auth.users') IS NULL OR to_regclass('helpdesk_implantacao.events') IS NULL THEN RAISE EXCEPTION 'AUTH_AND_IMPLANTACAO_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='helpdesk_notification_worker' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication AND NOT rolinherit) THEN RAISE EXCEPTION 'RESTRICTED_WORKER_REQUIRED'; END IF;
END $$;
CREATE SCHEMA helpdesk_implantacao_email;
REVOKE ALL ON SCHEMA helpdesk_implantacao_email FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA helpdesk_implantacao_email TO helpdesk_app,helpdesk_notification_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA helpdesk_implantacao_email REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role,helpdesk_app,helpdesk_notification_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA helpdesk_implantacao_email REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role,helpdesk_app,helpdesk_notification_worker;

CREATE TABLE helpdesk_implantacao_email.notifications(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL,account_id uuid NOT NULL,document_id uuid NOT NULL,event_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),recipient_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),
 recipient_email text NOT NULL CHECK(length(recipient_email)<=254),kind text NOT NULL CHECK(kind IN('share','submitted','resubmitted','comment','returned','reviewed')),
 source_version integer NOT NULL CHECK(source_version>0),message text NOT NULL CHECK(length(message)<=2000),dedupe_key text NOT NULL UNIQUE,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN('pending','leased','sending','retry_wait','unknown','accepted','delivered','failed','suppressed')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 3),
 lease_id uuid,lease_until timestamptz,next_attempt_at timestamptz,envelope jsonb,provider_message_id uuid UNIQUE,provider_event_at timestamptz,
 attention boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL DEFAULT clock_timestamp()+interval '24 hours',
 FOREIGN KEY(workspace_id,account_id,document_id) REFERENCES helpdesk_implantacao.documents(workspace_id,account_id,id),
 FOREIGN KEY(workspace_id,account_id,event_id) REFERENCES helpdesk_implantacao.events(workspace_id,account_id,id),
 UNIQUE(workspace_id,account_id,event_id,recipient_id),
 CHECK((state IN('leased','sending'))=(lease_id IS NOT NULL AND lease_until IS NOT NULL)),
 CHECK((state='retry_wait')=(next_attempt_at IS NOT NULL)),CHECK(state NOT IN('accepted','delivered') OR provider_message_id IS NOT NULL)
);
CREATE INDEX notification_due ON helpdesk_implantacao_email.notifications(created_at,id) WHERE state IN('pending','retry_wait','leased','sending');
CREATE TABLE helpdesk_implantacao_email.requests(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,event_id uuid NOT NULL,fingerprint text NOT NULL,notification_ids uuid[] NOT NULL,
 PRIMARY KEY(workspace_id,account_id,event_id),FOREIGN KEY(workspace_id,account_id,event_id) REFERENCES helpdesk_implantacao.events(workspace_id,account_id,id)
);
CREATE TABLE helpdesk_implantacao_email.quotas(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,actor_id uuid NOT NULL,window_started timestamptz NOT NULL,units integer NOT NULL CHECK(units>=0),
 PRIMARY KEY(workspace_id,account_id,actor_id),FOREIGN KEY(workspace_id,account_id) REFERENCES helpdesk_core.accounts(workspace_id,id)
);
CREATE TABLE helpdesk_implantacao_email.provider_events(
 event_id text PRIMARY KEY,event_hash text NOT NULL CHECK(event_hash ~ '^[a-f0-9]{64}$'),provider_message_id uuid NOT NULL,notification_id uuid REFERENCES helpdesk_implantacao_email.notifications(id),
 occurred_at timestamptz NOT NULL,event_type text NOT NULL,disposition text NOT NULL CHECK(disposition IN('unmatched','applied','ignored','attention')),
 received_at timestamptz NOT NULL DEFAULT clock_timestamp(),CHECK((disposition='unmatched')=(notification_id IS NULL))
);
CREATE INDEX email_provider_unmatched ON helpdesk_implantacao_email.provider_events(provider_message_id,occurred_at,event_id) WHERE notification_id IS NULL;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['notifications','requests','quotas','provider_events'] LOOP
  EXECUTE format('ALTER TABLE helpdesk_implantacao_email.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE helpdesk_implantacao_email.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY private_owner ON helpdesk_implantacao_email.%I TO %I USING(true) WITH CHECK(true)',t,current_user);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA helpdesk_implantacao_email FROM PUBLIC,anon,authenticated,service_role,helpdesk_app,helpdesk_notification_worker;

CREATE FUNCTION helpdesk_implantacao_email.require_login(expected text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF session_user<>expected OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=session_user AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication AND NOT rolinherit)
  OR EXISTS(SELECT 1 FROM pg_catalog.pg_auth_members WHERE member=(SELECT oid FROM pg_catalog.pg_roles WHERE rolname=session_user)) THEN RAISE EXCEPTION 'EMAIL_LOGIN_FORBIDDEN' USING ERRCODE='42501'; END IF;
END $$;
CREATE FUNCTION helpdesk_implantacao_email.require_actor(w uuid,a uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM helpdesk_implantacao_email.require_login('helpdesk_app');
 IF w IS DISTINCT FROM helpdesk_auth.workspace_id() OR a::text IS DISTINCT FROM current_setting('helpdesk_implantacao.account_id',true)
  OR NOT coalesce(helpdesk_auth.is_operator(w,a),false) THEN RAISE EXCEPTION 'EMAIL_ACTOR_FORBIDDEN' USING ERRCODE='42501'; END IF;
 RETURN helpdesk_auth.actor_id();
END $$;
CREATE FUNCTION helpdesk_implantacao_email.live_email(w uuid,a uuid,p uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT lower(btrim(u.email)) FROM helpdesk_auth.principals h JOIN auth.users u ON u.id=h.supabase_user_id
 WHERE h.id=p AND h.kind='human' AND h.active AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
 AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp())
 AND length(u.email) BETWEEN 3 AND 254 AND u.email ~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
 AND (EXISTS(SELECT 1 FROM helpdesk_auth.account_grants g WHERE g.workspace_id=w AND g.account_id=a AND g.principal_id=h.id AND g.active AND g.role='agent')
  OR EXISTS(SELECT 1 FROM helpdesk_auth.workspace_memberships m WHERE m.workspace_id=w AND m.principal_id=h.id AND m.active AND m.role='admin'))
$$;
CREATE FUNCTION helpdesk_implantacao_email.project(ids uuid[]) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('status',CASE WHEN count(*)=0 THEN 'suppressed' WHEN bool_or(state='unknown') THEN 'unknown'
  WHEN bool_or(state IN('pending','leased','sending','retry_wait')) THEN 'queued' WHEN bool_or(state='failed') THEN 'failed'
  WHEN bool_or(state='accepted') THEN 'accepted' WHEN bool_and(state='delivered') THEN 'delivered' ELSE 'suppressed' END,
  'notifications',coalesce(jsonb_agg(jsonb_build_object('id',id,'state',CASE WHEN state IN('pending','leased','sending','retry_wait') THEN 'queued' ELSE state END,'recipient_display',left(recipient_email,1)||'***@'||left(split_part(recipient_email,'@',2),1)||'***') ORDER BY created_at,id),'[]'::jsonb))
 FROM helpdesk_implantacao_email.notifications WHERE id=ANY(ids)
$$;
CREATE FUNCTION helpdesk_implantacao_email.contract() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE enabled boolean;trusted oid;
BEGIN
 IF session_user NOT IN('helpdesk_app','helpdesk_notification_worker') THEN RAISE EXCEPTION 'EMAIL_LOGIN_FORBIDDEN' USING ERRCODE='42501'; END IF;
 PERFORM helpdesk_implantacao_email.require_login(session_user);
 SELECT proowner INTO trusted FROM pg_catalog.pg_proc WHERE oid='helpdesk_auth.schema_version()'::regprocedure;
 SELECT (SELECT count(*)=4 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='helpdesk_implantacao_email' AND c.relkind='r')
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='helpdesk_implantacao_email' AND c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR c.relowner<>trusted
  OR has_table_privilege('helpdesk_app',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') OR has_table_privilege('helpdesk_notification_worker',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')))
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname IN('anon','authenticated','service_role') AND has_schema_privilege(r.oid,'helpdesk_implantacao_email','USAGE,CREATE'))
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace n WHERE n.nspname='helpdesk_implantacao_email' AND (n.nspowner<>trusted OR has_schema_privilege('helpdesk_app',n.oid,'CREATE') OR has_schema_privilege('helpdesk_notification_worker',n.oid,'CREATE')))
  AND (SELECT count(*)=12 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='helpdesk_implantacao_email')
  AND NOT EXISTS(SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='helpdesk_implantacao_email' AND
   (p.proowner<>trusted OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=""']::text[]
    OR has_function_privilege('helpdesk_app',p.oid,'EXECUTE') IS DISTINCT FROM (p.proname IN('contract','enqueue','status'))
    OR has_function_privilege('helpdesk_notification_worker',p.oid,'EXECUTE') IS DISTINCT FROM (p.proname IN('contract','claim','begin_send','finish_send','receive_event'))
    OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.rolname IN('anon','authenticated','service_role') AND has_function_privilege(r.oid,p.oid,'EXECUTE')))) INTO enabled;
 RETURN jsonb_build_object('version','implementation-email-v1','enabled',enabled);
END $$;
CREATE FUNCTION helpdesk_implantacao_email.enqueue(w uuid,a uuid,doc uuid,event uuid,kind text,recipient text,message text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid;d helpdesk_implantacao.documents%ROWTYPE;e helpdesk_implantacao.events%ROWTYPE;r record;fingerprint text;key text;ids uuid[]='{}';audience uuid[];addresses text[];nid uuid;existing helpdesk_implantacao_email.requests%ROWTYPE;i integer;units integer;account_units integer;at timestamptz=clock_timestamp();
BEGIN
 actor:=helpdesk_implantacao_email.require_actor(w,a);
 IF kind IS NULL OR kind NOT IN('share','submitted','resubmitted','comment','returned','reviewed') THEN RAISE EXCEPTION 'EMAIL_KIND_INVALID' USING ERRCODE='22023'; END IF;
 -- One account lock serializes dedupe and both quota counters. It is local to
 -- this addon, held until the enclosing business transaction commits.
 PERFORM pg_advisory_xact_lock(hashtextextended('implementation-email:'||w::text||':'||a::text,0));
 SELECT * INTO d FROM helpdesk_implantacao.documents WHERE workspace_id=w AND account_id=a AND id=doc FOR SHARE;
 IF NOT FOUND OR d.kind NOT IN('draft','submission') THEN RAISE EXCEPTION 'EMAIL_DOCUMENT_INVALID' USING ERRCODE='22023'; END IF;
 SELECT * INTO e FROM helpdesk_implantacao.events WHERE workspace_id=w AND account_id=a AND id=event AND document_id=doc AND actor_id=actor;
 IF NOT FOUND OR e.type<>(CASE kind WHEN 'share' THEN 'email_share_requested' WHEN 'submitted' THEN 'submission_notification_requested' WHEN 'resubmitted' THEN 'submission_resubmitted' WHEN 'comment' THEN 'comment' WHEN 'returned' THEN 'submission_returned' ELSE 'review_status_changed' END) THEN RAISE EXCEPTION 'EMAIL_SOURCE_INVALID' USING ERRCODE='22023'; END IF;
 recipient:=lower(btrim(recipient));message:=coalesce(btrim(message),'');
 IF length(message)>2000 OR message ~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]' OR kind<>'share' AND (recipient IS NOT NULL OR message<>'') THEN RAISE EXCEPTION 'EMAIL_CONTENT_INVALID' USING ERRCODE='22023'; END IF;
 IF kind='share' AND (recipient IS NULL OR e.body->>'version' IS DISTINCT FROM d.version::text OR e.body->>'recipient' IS DISTINCT FROM recipient OR coalesce(e.body->>'message','')<>message) THEN RAISE EXCEPTION 'EMAIL_SHARE_SOURCE_INVALID' USING ERRCODE='22023'; END IF;
 fingerprint:=encode(sha256(convert_to(jsonb_build_array(actor,doc,kind,recipient,message)::text,'UTF8')),'hex');
 SELECT * INTO existing FROM helpdesk_implantacao_email.requests WHERE workspace_id=w AND account_id=a AND event_id=event;
 IF FOUND THEN
  IF existing.fingerprint<>fingerprint THEN RAISE EXCEPTION 'EMAIL_SOURCE_REUSED' USING ERRCODE='22023'; END IF;
  RETURN helpdesk_implantacao_email.project(existing.notification_ids);
 END IF;
 IF kind='comment' AND e.body->'internal_only' IS DISTINCT FROM 'false'::jsonb THEN
  INSERT INTO helpdesk_implantacao_email.requests VALUES(w,a,event,fingerprint,ids);RETURN helpdesk_implantacao_email.project(ids);
 END IF;
 SELECT array_agg(p.id ORDER BY p.id),array_agg(p.email ORDER BY p.id) INTO audience,addresses FROM (
  SELECT h.id,helpdesk_implantacao_email.live_email(w,a,h.id) email FROM helpdesk_auth.principals h
  WHERE (enqueue.kind='share' OR h.id<>actor) AND (enqueue.kind IN('share','submitted','resubmitted') OR enqueue.kind='comment' AND d.owner_id=actor OR h.id=d.owner_id)
 ) p WHERE p.email IS NOT NULL AND (enqueue.kind<>'share' OR p.email=recipient);
 IF coalesce(cardinality(audience),0)>20 THEN RAISE EXCEPTION 'EMAIL_AUDIENCE_LIMIT' USING ERRCODE='54000'; END IF;
 IF kind='share' AND coalesce(cardinality(audience),0)<>1 THEN RAISE EXCEPTION 'EMAIL_RECIPIENT_UNAVAILABLE' USING ERRCODE='22023'; END IF;
 FOR i IN 1..coalesce(cardinality(audience),0) LOOP
  key:=encode(sha256(convert_to(CASE WHEN kind='share' THEN jsonb_build_array('share',w,a,doc,d.version,actor,addresses[i],message)::text ELSE jsonb_build_array('event',w,a,event,audience[i])::text END,'UTF8')),'hex');
  SELECT id INTO nid FROM helpdesk_implantacao_email.notifications WHERE dedupe_key=key;
  IF NOT FOUND THEN
   SELECT coalesce(sum(q.units) FILTER(WHERE q.actor_id=actor),0),coalesce(sum(q.units),0) INTO units,account_units FROM helpdesk_implantacao_email.quotas q WHERE q.workspace_id=w AND q.account_id=a AND q.window_started=date_trunc('hour',at);
   IF units>=40 OR account_units>=200 THEN RAISE EXCEPTION 'EMAIL_QUOTA_EXCEEDED' USING ERRCODE='54000'; END IF;
   INSERT INTO helpdesk_implantacao_email.notifications(workspace_id,account_id,document_id,event_id,actor_id,recipient_id,recipient_email,kind,source_version,message,dedupe_key)
    VALUES(w,a,doc,event,actor,audience[i],addresses[i],kind,d.version,message,key) RETURNING id INTO nid;
   INSERT INTO helpdesk_implantacao_email.quotas VALUES(w,a,actor,date_trunc('hour',at),1) ON CONFLICT(workspace_id,account_id,actor_id) DO UPDATE SET window_started=excluded.window_started,units=CASE WHEN helpdesk_implantacao_email.quotas.window_started=excluded.window_started THEN helpdesk_implantacao_email.quotas.units+1 ELSE 1 END;
  END IF;
  ids:=array_append(ids,nid);
 END LOOP;
 INSERT INTO helpdesk_implantacao_email.requests VALUES(w,a,event,fingerprint,ids);
 RETURN helpdesk_implantacao_email.project(ids);
END $$;
CREATE FUNCTION helpdesk_implantacao_email.status(w uuid,a uuid,doc uuid,notification uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE ids uuid[];
BEGIN
 PERFORM helpdesk_implantacao_email.require_actor(w,a);
 IF NOT EXISTS(SELECT 1 FROM helpdesk_implantacao.documents WHERE workspace_id=w AND account_id=a AND id=doc) THEN RAISE EXCEPTION 'EMAIL_DOCUMENT_INVALID' USING ERRCODE='22023'; END IF;
 SELECT array_agg(id) INTO ids FROM (SELECT id FROM helpdesk_implantacao_email.notifications WHERE workspace_id=w AND account_id=a AND document_id=doc AND (notification IS NULL OR id=notification) ORDER BY created_at DESC,id DESC LIMIT 100) bounded;
 RETURN helpdesk_implantacao_email.project(coalesce(ids,'{}'));
END $$;
CREATE FUNCTION helpdesk_implantacao_email.claim() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n helpdesk_implantacao_email.notifications%ROWTYPE;at timestamptz=clock_timestamp();
BEGIN
 PERFORM helpdesk_implantacao_email.require_login('helpdesk_notification_worker');
 SELECT * INTO n FROM helpdesk_implantacao_email.notifications WHERE (state IN('leased','sending') AND lease_until<=at) OR (state IN('pending','retry_wait') AND (next_attempt_at IS NULL OR next_attempt_at<=at)) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF n.state='sending' THEN
  UPDATE helpdesk_implantacao_email.notifications SET state='unknown',attention=true,lease_id=NULL,lease_until=NULL,revision=revision+1 WHERE id=n.id;RETURN jsonb_build_object('attention',true);
 END IF;
 IF n.expires_at<=at OR n.attempts>=3 THEN
  UPDATE helpdesk_implantacao_email.notifications SET state='suppressed',lease_id=NULL,lease_until=NULL,next_attempt_at=NULL,revision=revision+1 WHERE id=n.id;RETURN jsonb_build_object('attention',true);
 END IF;
 UPDATE helpdesk_implantacao_email.notifications SET state='leased',lease_id=gen_random_uuid(),lease_until=at+interval '2 minutes',next_attempt_at=NULL,revision=revision+1 WHERE id=n.id RETURNING * INTO n;
 RETURN jsonb_build_object('id',n.id,'leaseId',n.lease_id,'revision',n.revision);
END $$;
CREATE FUNCTION helpdesk_implantacao_email.begin_send(id uuid,lease uuid,revision integer,sender text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n helpdesk_implantacao_email.notifications%ROWTYPE;address text;url text;body text;markup text;env jsonb;
BEGIN
 PERFORM helpdesk_implantacao_email.require_login('helpdesk_notification_worker');
 SELECT * INTO n FROM helpdesk_implantacao_email.notifications q WHERE q.id=begin_send.id FOR UPDATE;
 IF NOT FOUND OR n.state<>'leased' OR n.lease_id IS DISTINCT FROM lease OR n.revision IS DISTINCT FROM revision OR n.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'EMAIL_LEASE_LOST' USING ERRCODE='40001'; END IF;
 address:=helpdesk_implantacao_email.live_email(n.workspace_id,n.account_id,n.recipient_id);
 IF address IS NULL OR address<>n.recipient_email OR n.expires_at<=clock_timestamp()
  OR helpdesk_implantacao_email.live_email(n.workspace_id,n.account_id,n.actor_id) IS NULL THEN
  UPDATE helpdesk_implantacao_email.notifications q SET state='suppressed',lease_id=NULL,lease_until=NULL,revision=q.revision+1 WHERE q.id=n.id;RETURN NULL;
 END IF;
 IF sender IS NULL OR length(sender)>320 OR sender ~ '[\r\n]' OR sender !~ '^[^<>\r\n]+@[^<>\r\n]+$' AND sender !~ '^[^<>\r\n]+ <[^<>\r\n]+@[^<>\r\n]+>$' THEN RAISE EXCEPTION 'EMAIL_SENDER_INVALID' USING ERRCODE='22023'; END IF;
 SELECT 'https://helpdesk.consultegeo.org/?apoio=implantacao&conta='||n.account_id::text||CASE WHEN d.kind='draft' THEN '&rascunho=' ELSE '&revisao=' END||n.document_id::text INTO url
 FROM helpdesk_implantacao.documents d WHERE d.workspace_id=n.workspace_id AND d.account_id=n.account_id AND d.id=n.document_id;
 body:='Há uma atualização no Apoio Implantação. Entre com sua conta autorizada para consultar o documento.'||E'\n\n'||url;
 IF n.kind='share' AND n.message<>'' THEN body:=body||E'\n\nMensagem de compartilhamento:\n'||n.message; END IF;
 markup:='<p>'||replace(replace(replace(body,'&','&amp;'),'<','&lt;'),'>','&gt;')||'</p>';
 env:=jsonb_build_object('from',sender,'to',address,'subject','Apoio Implantação — atualização','text',body,'html',markup,'idempotencyKey',n.dedupe_key);
 IF n.envelope IS NOT NULL AND n.envelope<>env THEN
  UPDATE helpdesk_implantacao_email.notifications q SET state='suppressed',attention=true,lease_id=NULL,lease_until=NULL,revision=q.revision+1 WHERE q.id=n.id;RETURN NULL;
 END IF;
 UPDATE helpdesk_implantacao_email.notifications q SET state='sending',attempts=q.attempts+1,envelope=env,revision=q.revision+1 WHERE q.id=n.id RETURNING q.revision INTO revision;
 RETURN env||jsonb_build_object('id',n.id,'leaseId',lease,'revision',revision);
END $$;
CREATE FUNCTION helpdesk_implantacao_email.finish_send(id uuid,lease uuid,revision integer,result jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n helpdesk_implantacao_email.notifications%ROWTYPE;result_state text='unknown';provider uuid;retry boolean=false;early record;outcome text;event_disposition text;
BEGIN
 PERFORM helpdesk_implantacao_email.require_login('helpdesk_notification_worker');
 -- Serialize ACK and callback by exact provider identity before locking the
 -- notification, so an authentic callback that beats ACK cannot be lost.
 IF jsonb_typeof(result)='object' AND result->>'state'='accepted' AND result-'state'-'providerMessageId'='{}'::jsonb AND result->>'providerMessageId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN
  provider:=(result->>'providerMessageId')::uuid;PERFORM pg_advisory_xact_lock(hashtextextended('implementation-email-provider:'||provider::text,0));
 END IF;
 SELECT * INTO n FROM helpdesk_implantacao_email.notifications q WHERE q.id=finish_send.id FOR UPDATE;
 IF NOT FOUND OR n.state<>'sending' OR n.lease_id IS DISTINCT FROM lease OR n.revision IS DISTINCT FROM revision OR n.lease_until<=clock_timestamp() THEN RAISE EXCEPTION 'EMAIL_LEASE_LOST' USING ERRCODE='40001'; END IF;
 IF jsonb_typeof(result)='object' THEN
  IF result->>'state'='accepted' AND result-'state'-'providerMessageId'='{}'::jsonb AND result->>'providerMessageId' ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN
   provider:=(result->>'providerMessageId')::uuid;
   IF NOT EXISTS(SELECT 1 FROM helpdesk_implantacao_email.notifications q WHERE q.provider_message_id=provider AND q.id<>n.id) THEN result_state:='accepted';END IF;
  ELSIF result->>'state'='not_accepted' AND result-'state'-'retryable'-'reason'='{}'::jsonb AND jsonb_typeof(result->'retryable')='boolean' AND result->>'reason' IN('rate_limited','temporarily_unavailable','rejected') AND NOT (result->>'reason'='rejected' AND result->'retryable'='true'::jsonb) THEN
   retry:=(result->>'retryable')::boolean AND n.attempts<3 AND n.expires_at>clock_timestamp()+interval '1 minute';result_state:=CASE WHEN retry THEN 'retry_wait' ELSE 'failed' END;
  END IF;
 END IF;
 UPDATE helpdesk_implantacao_email.notifications q SET state=result_state,provider_message_id=CASE WHEN result_state='accepted' THEN provider ELSE NULL END,lease_id=NULL,lease_until=NULL,next_attempt_at=CASE WHEN retry THEN clock_timestamp()+interval '1 minute' ELSE NULL END,attention=result_state='unknown',revision=q.revision+1 WHERE q.id=n.id RETURNING * INTO n;
 IF result_state='accepted' THEN
  FOR early IN SELECT * FROM helpdesk_implantacao_email.provider_events p WHERE p.provider_message_id=provider AND p.notification_id IS NULL ORDER BY p.occurred_at,p.event_id FOR UPDATE LOOP
   outcome:=CASE early.event_type WHEN 'email.sent' THEN 'accepted' WHEN 'email.delivered' THEN 'delivered' WHEN 'email.failed' THEN 'failed' WHEN 'email.bounced' THEN 'failed' WHEN 'email.suppressed' THEN 'failed' ELSE NULL END;event_disposition:='ignored';
   IF outcome IS NOT NULL AND early.occurred_at>=n.created_at AND (n.provider_event_at IS NULL OR early.occurred_at>=n.provider_event_at) THEN
    IF n.state IN('delivered','failed') AND outcome<>n.state OR early.occurred_at=n.provider_event_at AND outcome<>n.state THEN event_disposition:='attention';
    ELSIF n.provider_event_at IS DISTINCT FROM early.occurred_at OR n.state<>outcome THEN event_disposition:='applied';END IF;
    IF event_disposition<>'ignored' THEN UPDATE helpdesk_implantacao_email.notifications q SET state=CASE WHEN event_disposition='applied' THEN outcome ELSE n.state END,provider_event_at=early.occurred_at,attention=q.attention OR event_disposition='attention',revision=q.revision+1 WHERE q.id=n.id RETURNING * INTO n;END IF;
   END IF;
   UPDATE helpdesk_implantacao_email.provider_events p SET notification_id=n.id,disposition=event_disposition WHERE p.event_id=early.event_id;
  END LOOP;
 END IF;
 RETURN jsonb_build_object('state',n.state,'attention',n.attention);
END $$;
CREATE FUNCTION helpdesk_implantacao_email.receive_event(event jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n helpdesk_implantacao_email.notifications%ROWTYPE;old helpdesk_implantacao_email.provider_events%ROWTYPE;eid text;hash text;provider uuid;at timestamptz;outcome text;kind text;disposition text='ignored';
BEGIN
 PERFORM helpdesk_implantacao_email.require_login('helpdesk_notification_worker');
 IF jsonb_typeof(event) IS DISTINCT FROM 'object' OR event-'eventId'-'eventHash'-'providerMessageId'-'occurredAt'-'outcome'-'eventType'<>'{}'::jsonb
  OR NOT event ?& ARRAY['eventId','eventHash','providerMessageId','occurredAt','outcome','eventType']
  OR coalesce(event->>'eventId','') !~ '^msg_[A-Za-z0-9_-]{1,156}$' OR coalesce(event->>'eventHash','') !~ '^[a-f0-9]{64}$'
  OR coalesce(event->>'providerMessageId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
  OR coalesce(event->>'occurredAt','') !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(\d{3})?Z$'
  OR coalesce(event->>'eventType','') !~ '^email\.[a-z][a-z0-9_]*$' THEN RAISE EXCEPTION 'EMAIL_EVENT_INVALID' USING ERRCODE='22023'; END IF;
 eid:=event->>'eventId';hash:=event->>'eventHash';provider:=(event->>'providerMessageId')::uuid;at:=(event->>'occurredAt')::timestamptz;outcome:=event->>'outcome';kind:=event->>'eventType';
 IF at>clock_timestamp() OR NOT isfinite(at) OR outcome IS DISTINCT FROM (CASE kind WHEN 'email.sent' THEN 'accepted' WHEN 'email.delivered' THEN 'delivered' WHEN 'email.failed' THEN 'failed' WHEN 'email.bounced' THEN 'failed' WHEN 'email.suppressed' THEN 'failed' ELSE NULL END) THEN RAISE EXCEPTION 'EMAIL_EVENT_INVALID' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('implementation-email-event:'||eid,0));
 PERFORM pg_advisory_xact_lock(hashtextextended('implementation-email-provider:'||provider::text,0));
 SELECT * INTO old FROM helpdesk_implantacao_email.provider_events WHERE event_id=eid;
 IF FOUND THEN
  IF old.event_hash<>hash OR old.provider_message_id<>provider OR old.occurred_at<>at OR old.event_type<>kind THEN RAISE EXCEPTION 'EMAIL_EVENT_COLLISION' USING ERRCODE='22023'; END IF;
  RETURN jsonb_build_object('eventId',eid,'disposition',CASE WHEN old.notification_id IS NULL THEN 'unmatched' ELSE 'ignored' END,'intentId',old.notification_id);
 END IF;
 SELECT * INTO n FROM helpdesk_implantacao_email.notifications q WHERE q.provider_message_id=provider FOR UPDATE;
 IF NOT FOUND THEN
  -- Bounded authenticated metadata only, retained for ACK ordering races.
  PERFORM pg_advisory_xact_lock(hashtextextended('implementation-email-unmatched-budget',0));
  DELETE FROM helpdesk_implantacao_email.provider_events p WHERE p.notification_id IS NULL AND p.received_at<clock_timestamp()-interval '7 days';
  IF (SELECT count(*) FROM helpdesk_implantacao_email.provider_events p WHERE p.notification_id IS NULL)>=10000 THEN RAISE EXCEPTION 'EMAIL_EVENT_CAPACITY' USING ERRCODE='54000';END IF;
  INSERT INTO helpdesk_implantacao_email.provider_events(event_id,event_hash,provider_message_id,notification_id,occurred_at,event_type,disposition) VALUES(eid,hash,provider,NULL,at,kind,'unmatched');
  RETURN jsonb_build_object('eventId',eid,'disposition','unmatched','intentId',NULL);
 END IF;
 IF outcome IS NOT NULL AND at>=n.created_at AND (n.provider_event_at IS NULL OR at>=n.provider_event_at) THEN
  IF n.state IN('delivered','failed') AND outcome<>n.state OR at=n.provider_event_at AND outcome<>n.state THEN disposition:='attention';
  ELSIF n.provider_event_at IS DISTINCT FROM at OR n.state<>outcome THEN disposition:='applied';END IF;
  IF disposition<>'ignored' THEN UPDATE helpdesk_implantacao_email.notifications q SET state=CASE WHEN disposition='applied' THEN outcome ELSE n.state END,provider_event_at=at,attention=q.attention OR disposition='attention',revision=q.revision+1 WHERE q.id=n.id;END IF;
 END IF;
 INSERT INTO helpdesk_implantacao_email.provider_events(event_id,event_hash,provider_message_id,notification_id,occurred_at,event_type,disposition) VALUES(eid,hash,provider,n.id,at,kind,disposition);
 RETURN jsonb_build_object('eventId',eid,'disposition',disposition,'intentId',n.id);
END $$;
CREATE FUNCTION helpdesk_implantacao_email.immutable_envelope() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF ROW(NEW.id,NEW.workspace_id,NEW.account_id,NEW.document_id,NEW.event_id,NEW.actor_id,NEW.recipient_id,NEW.recipient_email,NEW.kind,NEW.source_version,NEW.message,NEW.dedupe_key,NEW.created_at,NEW.expires_at)
  IS DISTINCT FROM ROW(OLD.id,OLD.workspace_id,OLD.account_id,OLD.document_id,OLD.event_id,OLD.actor_id,OLD.recipient_id,OLD.recipient_email,OLD.kind,OLD.source_version,OLD.message,OLD.dedupe_key,OLD.created_at,OLD.expires_at)
  OR OLD.envelope IS NOT NULL AND NEW.envelope IS DISTINCT FROM OLD.envelope OR OLD.provider_message_id IS NOT NULL AND NEW.provider_message_id IS DISTINCT FROM OLD.provider_message_id THEN RAISE EXCEPTION 'IMMUTABLE_EMAIL_ENVELOPE' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_envelope BEFORE UPDATE ON helpdesk_implantacao_email.notifications FOR EACH ROW EXECUTE FUNCTION helpdesk_implantacao_email.immutable_envelope();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA helpdesk_implantacao_email FROM PUBLIC,anon,authenticated,service_role,helpdesk_app,helpdesk_notification_worker;
GRANT EXECUTE ON FUNCTION helpdesk_implantacao_email.contract() TO helpdesk_app,helpdesk_notification_worker;
GRANT EXECUTE ON FUNCTION helpdesk_implantacao_email.enqueue(uuid,uuid,uuid,uuid,text,text,text),helpdesk_implantacao_email.status(uuid,uuid,uuid,uuid) TO helpdesk_app;
GRANT EXECUTE ON FUNCTION helpdesk_implantacao_email.claim(),helpdesk_implantacao_email.begin_send(uuid,uuid,integer,text),helpdesk_implantacao_email.finish_send(uuid,uuid,integer,jsonb),helpdesk_implantacao_email.receive_event(jsonb) TO helpdesk_notification_worker;
COMMIT;



