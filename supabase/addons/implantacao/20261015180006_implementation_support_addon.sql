-- Independent addon v1. Not part of the immutable 20-file core ledger.
-- Apply as the same trusted schema owner used by the core (postgres in Supabase).
-- Never authenticate an ordinary request as that owner.
BEGIN;
DO $$ BEGIN
 IF current_user='helpdesk_app' OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='helpdesk_app' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb) THEN
  RAISE EXCEPTION 'SEPARATE_OWNER_AND_RESTRICTED_RUNTIME_REQUIRED';
 END IF;
 IF helpdesk_auth.schema_version()<>'0.26.0' THEN RAISE EXCEPTION 'CORE_026_REQUIRED'; END IF;
END $$;
CREATE SCHEMA helpdesk_implantacao;
REVOKE ALL ON SCHEMA helpdesk_implantacao FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA helpdesk_implantacao TO helpdesk_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA helpdesk_implantacao REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA helpdesk_implantacao REVOKE ALL ON FUNCTIONS FROM PUBLIC,anon,authenticated,service_role;

CREATE TABLE helpdesk_implantacao.documents(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,id uuid NOT NULL,
 owner_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),
 kind text NOT NULL CHECK(kind IN ('draft','import','laudo','submission','step_help','note','lock','priority','help_image','ai_request')),
 alias uuid,version integer NOT NULL CHECK(version>=1),body jsonb NOT NULL,
 created_at timestamptz NOT NULL,updated_at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id,account_id,id),UNIQUE(workspace_id,account_id,alias),
 FOREIGN KEY(workspace_id,account_id) REFERENCES helpdesk_core.accounts(workspace_id,id),
 CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=8388608),
 CHECK(kind='help_image' OR octet_length(body::text)<=2097152)
);
CREATE TABLE helpdesk_implantacao.events(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,id uuid NOT NULL,
 document_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),
 type text NOT NULL CHECK(length(type) BETWEEN 1 AND 80),body jsonb NOT NULL,
 created_at timestamptz NOT NULL,
 PRIMARY KEY(workspace_id,account_id,id),
 FOREIGN KEY(workspace_id,account_id,document_id) REFERENCES helpdesk_implantacao.documents(workspace_id,account_id,id),
 CHECK(jsonb_typeof(body)='object' AND octet_length(body::text)<=9437184)
);
CREATE UNIQUE INDEX unique_step_help ON helpdesk_implantacao.documents(workspace_id,account_id,(body->>'step_key')) WHERE kind='step_help';
CREATE UNIQUE INDEX unique_submission_meta ON helpdesk_implantacao.documents(workspace_id,account_id,kind,(body->>'submission_id')) WHERE kind IN('lock','priority') AND body->>'submission_id' IS NOT NULL;
CREATE UNIQUE INDEX unique_ticket_meta ON helpdesk_implantacao.documents(workspace_id,account_id,kind,(body->>'ticket_id')) WHERE kind IN('lock','priority') AND body->>'ticket_id' IS NOT NULL;
CREATE INDEX event_document ON helpdesk_implantacao.events(workspace_id,account_id,document_id,created_at,id);
CREATE UNIQUE INDEX document_versions ON helpdesk_implantacao.events(workspace_id,account_id,document_id,((body->>'version')::integer)) WHERE body ? 'snapshot';
CREATE TABLE helpdesk_implantacao.receipts(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),
 operation_id uuid NOT NULL,request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,account_id,actor_id,operation_id),
 FOREIGN KEY(workspace_id,account_id) REFERENCES helpdesk_core.accounts(workspace_id,id),
 CHECK(octet_length(result::text)<=9437184)
);
CREATE TABLE helpdesk_implantacao.quotas(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),
 window_started timestamptz NOT NULL,units integer NOT NULL CHECK(units>0),
 PRIMARY KEY(workspace_id,account_id,actor_id),
 FOREIGN KEY(workspace_id,account_id) REFERENCES helpdesk_core.accounts(workspace_id,id)
);

CREATE FUNCTION helpdesk_implantacao.guard_document() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.workspace_id IS DISTINCT FROM OLD.workspace_id OR NEW.account_id IS DISTINCT FROM OLD.account_id
  OR NEW.id IS DISTINCT FROM OLD.id OR NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.kind IS DISTINCT FROM OLD.kind
  OR NEW.alias IS DISTINCT FROM OLD.alias OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.version<>OLD.version+1) THEN
  RAISE EXCEPTION 'IMMUTABLE_DOCUMENT_IDENTITY_OR_VERSION' USING ERRCODE='23514';
 END IF;
 IF TG_OP='INSERT' AND (NEW.version<>1 OR NEW.owner_id IS DISTINCT FROM helpdesk_auth.actor_id()) THEN
  RAISE EXCEPTION 'DOCUMENT_CREATOR_MISMATCH' USING ERRCODE='23514';
 END IF;
 IF TG_OP='UPDATE' AND NEW.kind IN('note','lock','priority','step_help') AND
  (NEW.body->'submission_id' IS DISTINCT FROM OLD.body->'submission_id' OR NEW.body->'ticket_id' IS DISTINCT FROM OLD.body->'ticket_id'
   OR NEW.body->'step_key' IS DISTINCT FROM OLD.body->'step_key') THEN
  RAISE EXCEPTION 'IMMUTABLE_MODULE_TARGET' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION helpdesk_implantacao.require_version_event() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM helpdesk_implantacao.events e WHERE e.workspace_id=NEW.workspace_id AND e.account_id=NEW.account_id
  AND e.document_id=NEW.id AND e.body->>'version'=NEW.version::text AND e.body ? 'snapshot'
  AND e.actor_id=helpdesk_auth.actor_id()) THEN
  RAISE EXCEPTION 'DOCUMENT_VERSION_EVENT_REQUIRED' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION helpdesk_implantacao.reject_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'APPEND_ONLY_MODULE_RECORD' USING ERRCODE='23514'; END $$;
CREATE TRIGGER document_guard BEFORE INSERT OR UPDATE ON helpdesk_implantacao.documents FOR EACH ROW EXECUTE FUNCTION helpdesk_implantacao.guard_document();
CREATE CONSTRAINT TRIGGER document_version_evidence AFTER INSERT OR UPDATE ON helpdesk_implantacao.documents DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_implantacao.require_version_event();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['documents','events','receipts','quotas'] LOOP
  EXECUTE format('ALTER TABLE helpdesk_implantacao.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE helpdesk_implantacao.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON helpdesk_implantacao.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format($policy$CREATE POLICY live_staff_scope ON helpdesk_implantacao.%I TO helpdesk_app
   USING(workspace_id=helpdesk_auth.workspace_id() AND account_id::text=current_setting('helpdesk_implantacao.account_id',true) AND helpdesk_auth.is_operator(workspace_id,account_id))
   WITH CHECK(workspace_id=helpdesk_auth.workspace_id() AND account_id::text=current_setting('helpdesk_implantacao.account_id',true) AND helpdesk_auth.is_operator(workspace_id,account_id))$policy$,t);
  EXECUTE format('CREATE TRIGGER no_truncate BEFORE TRUNCATE ON helpdesk_implantacao.%I FOR EACH STATEMENT EXECUTE FUNCTION helpdesk_implantacao.reject_mutation()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['events','receipts'] LOOP
  EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON helpdesk_implantacao.%I FOR EACH ROW EXECUTE FUNCTION helpdesk_implantacao.reject_mutation()',t);
 END LOOP;
END $$;
CREATE POLICY event_actor ON helpdesk_implantacao.events AS RESTRICTIVE FOR INSERT TO helpdesk_app WITH CHECK(actor_id=helpdesk_auth.actor_id());
CREATE POLICY receipt_actor ON helpdesk_implantacao.receipts AS RESTRICTIVE TO helpdesk_app USING(actor_id=helpdesk_auth.actor_id()) WITH CHECK(actor_id=helpdesk_auth.actor_id());
CREATE POLICY quota_actor ON helpdesk_implantacao.quotas AS RESTRICTIVE TO helpdesk_app USING(actor_id=helpdesk_auth.actor_id()) WITH CHECK(actor_id=helpdesk_auth.actor_id());
GRANT SELECT,INSERT ON helpdesk_implantacao.documents,helpdesk_implantacao.events,helpdesk_implantacao.receipts,helpdesk_implantacao.quotas TO helpdesk_app;
GRANT UPDATE(version,body,updated_at) ON helpdesk_implantacao.documents TO helpdesk_app;
GRANT UPDATE(window_started,units) ON helpdesk_implantacao.quotas TO helpdesk_app;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA helpdesk_implantacao FROM PUBLIC,anon,authenticated,service_role;
-- Trigger routines are SECURITY INVOKER; no schema owner or service role runtime.
COMMIT;
