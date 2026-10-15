-- R02 / IMP-02a: DDL CANDIDATO, NÃO EXECUTADO EM POSTGRESQL NESTA SESSÃO.
-- FORA de supabase/migrations de propósito. Nunca aplicar por copiar este arquivo.
-- Requer revisão, migration oficial via CLI e ensaio PostgreSQL 17 descartável.
-- Não cria bucket, credencial, usuário, role, policy de storage nem endpoint.
-- Papel setup_import_app deve ser provisionado/revisado pelo fluxo administrativo
-- existente, sem SUPERUSER/BYPASSRLS/CREATEROLE e sem propriedade do schema/tabelas.
-- Só o servidor confiável pode usá-lo. GUC de escopo NÃO é autenticação.
-- Para ensaio explicitamente autorizado: SET setup_import.candidate_install='r02-reviewed';
BEGIN;
DO $$
BEGIN
  IF current_setting('setup_import.candidate_install',true) IS DISTINCT FROM 'r02-reviewed' THEN
    RAISE EXCEPTION 'CANDIDATE_REQUIRES_QUALIFICATION';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='setup_import_app'
      AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole) THEN
    RAISE EXCEPTION 'RESTRICTED_APPLICATION_ROLE_REQUIRED';
  END IF;
  IF current_user='setup_import_app' THEN RAISE EXCEPTION 'SEPARATE_SCHEMA_OWNER_REQUIRED'; END IF;
END $$;
CREATE SCHEMA setup_import;
REVOKE ALL ON SCHEMA setup_import FROM PUBLIC;
GRANT USAGE ON SCHEMA setup_import TO setup_import_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA setup_import REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

CREATE TABLE setup_import.cases (
 workspace_id uuid NOT NULL, account_id uuid NOT NULL, case_id uuid NOT NULL,
 version integer NOT NULL CHECK(version>=1),
 head_revision integer NOT NULL CHECK(head_revision>=1 AND head_revision<=version),
 head_hash text NOT NULL CHECK(head_hash ~ '^[a-f0-9]{64}$'),
 body jsonb NOT NULL,
 PRIMARY KEY(workspace_id,account_id,case_id),
 CHECK(COALESCE(jsonb_typeof(body)='object' AND octet_length(body::text)<=2097152
   AND body->>'workspaceId'=workspace_id::text AND body->>'accountId'=account_id::text
   AND body->>'caseId'=case_id::text AND body->>'version'=version::text
   AND body->>'headRevision'=head_revision::text AND body->>'headHash'=head_hash
   AND body->>'status' IN ('draft','cancelled') AND body->>'linkState'='awaiting_ticket'
   AND body ?& ARRAY['requesterId','createdBy','purpose','target','workRef','createdAt','updatedAt'],false))
);
CREATE TABLE setup_import.revisions (
 workspace_id uuid NOT NULL, account_id uuid NOT NULL, case_id uuid NOT NULL,
 number integer NOT NULL CHECK(number>=1), hash text NOT NULL CHECK(hash ~ '^[a-f0-9]{64}$'),body jsonb NOT NULL,
 PRIMARY KEY(workspace_id,account_id,case_id,number),
 UNIQUE(workspace_id,account_id,case_id,number,hash),
 FOREIGN KEY(workspace_id,account_id,case_id) REFERENCES setup_import.cases,
 CHECK(COALESCE(body->>'workspaceId'=workspace_id::text AND body->>'accountId'=account_id::text
   AND body->>'caseId'=case_id::text AND body->>'number'=number::text AND body->>'hash'=hash
   AND jsonb_typeof(body->'snapshot')='object' AND body->'snapshot'->>'schemaVersion'='1'
   AND body ?& ARRAY['parentHash','actorId','reason','createdAt'] AND octet_length(body::text)<=2097152,false))
);
ALTER TABLE setup_import.cases ADD CONSTRAINT case_head_exists
 FOREIGN KEY(workspace_id,account_id,case_id,head_revision,head_hash)
 REFERENCES setup_import.revisions(workspace_id,account_id,case_id,number,hash)
 DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE setup_import.artifacts (
 workspace_id uuid NOT NULL, account_id uuid NOT NULL, case_id uuid NOT NULL,artifact_id uuid NOT NULL,
 status text NOT NULL CHECK(status IN ('pending','ready','rejected')),body jsonb NOT NULL,
 PRIMARY KEY(workspace_id,account_id,case_id,artifact_id),
 FOREIGN KEY(workspace_id,account_id,case_id) REFERENCES setup_import.cases,
 CHECK(COALESCE(body->>'workspaceId'=workspace_id::text AND body->>'accountId'=account_id::text
   AND body->>'caseId'=case_id::text AND body->>'id'=artifact_id::text AND body->>'status'=status
   AND body->>'objectKey'=concat_ws('/',workspace_id,account_id,case_id,artifact_id)
   AND (body->>'bytes')::bigint BETWEEN 1 AND 62914560 AND body->>'sha256' ~ '^[a-f0-9]{64}$'
   AND body ?& ARRAY['name','mime','createdBy','createdAt','verifiedAt','objectVersion','retainUntil','rejectionCode']
   AND octet_length(body::text)<=8192,false)),
 CHECK(COALESCE(
   (status='pending' AND body->'objectVersion'='null'::jsonb AND body->'verifiedAt'='null'::jsonb AND body->'rejectionCode'='null'::jsonb)
   OR (status='ready' AND length(body->>'objectVersion')>0 AND length(body->>'verifiedAt')>0 AND body->'rejectionCode'='null'::jsonb)
   OR (status='rejected' AND length(body->>'objectVersion')>0 AND length(body->>'verifiedAt')>0 AND length(body->>'rejectionCode')>0),false))
);
CREATE TABLE setup_import.events (
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,case_id uuid NOT NULL,version integer NOT NULL,body jsonb NOT NULL,
 PRIMARY KEY(workspace_id,account_id,case_id,version),
 FOREIGN KEY(workspace_id,account_id,case_id) REFERENCES setup_import.cases,
 CHECK(COALESCE(body->>'workspaceId'=workspace_id::text AND body->>'accountId'=account_id::text
   AND body->>'caseId'=case_id::text AND body->>'version'=version::text
   AND body ?& ARRAY['actorId','operation','at','revision','hash','reason'],false))
);
CREATE TABLE setup_import.receipts (
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,case_id uuid NOT NULL,
 actor_id uuid NOT NULL,operation_id uuid NOT NULL,request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),body jsonb NOT NULL,
 event_version integer GENERATED ALWAYS AS ((body->'result'->>'version')::integer) STORED,
 PRIMARY KEY(workspace_id,account_id,case_id,actor_id,operation_id),
 FOREIGN KEY(workspace_id,account_id,case_id,event_version) REFERENCES setup_import.events,
 CHECK(COALESCE(body->>'workspaceId'=workspace_id::text AND body->>'accountId'=account_id::text
   AND body->>'caseId'=case_id::text AND body->>'actorId'=actor_id::text
   AND body->>'operationId'=operation_id::text AND body->>'requestHash'=request_hash
   AND body->'result'->>'caseId'=case_id::text AND body->'result'->>'operationId'=operation_id::text
   AND body->'result'->'replayed'='false'::jsonb AND event_version>=1,false))
);

CREATE FUNCTION setup_import.reject_mutation() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog AS $$ BEGIN RAISE EXCEPTION 'APPEND_ONLY'; END $$;
REVOKE ALL ON FUNCTION setup_import.reject_mutation() FROM PUBLIC;
CREATE FUNCTION setup_import.case_update_guard() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog AS $$
BEGIN
 IF OLD.body->>'status'<>'draft' OR NEW.version<>OLD.version+1
   OR (NEW.body-ARRAY['version','headRevision','headHash','status','updatedAt'])
     IS DISTINCT FROM (OLD.body-ARRAY['version','headRevision','headHash','status','updatedAt'])
   OR NOT ((NEW.head_revision=OLD.head_revision AND NEW.head_hash=OLD.head_hash)
       OR NEW.head_revision=OLD.head_revision+1) THEN RAISE EXCEPTION 'CASE_IMMUTABILITY_OR_VERSION'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION setup_import.revision_insert_guard() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog AS $$
DECLARE previous text; current_head integer;
BEGIN
 SELECT head_revision INTO current_head FROM setup_import.cases
   WHERE workspace_id=NEW.workspace_id AND account_id=NEW.account_id AND case_id=NEW.case_id;
 IF NEW.body->>'actorId' IS DISTINCT FROM current_setting('setup_import.actor_id',true) THEN RAISE EXCEPTION 'ACTOR_MISMATCH'; END IF;
 IF NEW.number=1 THEN
   IF NEW.body->'parentHash' IS DISTINCT FROM 'null'::jsonb OR current_head<>1 THEN RAISE EXCEPTION 'INVALID_FIRST_REVISION'; END IF;
 ELSE
   SELECT hash INTO previous FROM setup_import.revisions WHERE workspace_id=NEW.workspace_id
     AND account_id=NEW.account_id AND case_id=NEW.case_id AND number=NEW.number-1;
   IF previous IS NULL OR NEW.body->>'parentHash' IS DISTINCT FROM previous OR NEW.number<>current_head+1 THEN
     RAISE EXCEPTION 'REVISION_CHAIN'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION setup_import.artifact_update_guard() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog AS $$
BEGIN
 IF OLD.status<>'pending' OR NEW.status NOT IN ('ready','rejected')
   OR (OLD.body-ARRAY['status','rejectionCode','objectVersion','verifiedAt'])
       IS DISTINCT FROM (NEW.body-ARRAY['status','rejectionCode','objectVersion','verifiedAt']) THEN
   RAISE EXCEPTION 'ARTIFACT_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION setup_import.require_commit_evidence() RETURNS trigger LANGUAGE plpgsql
 SET search_path=pg_catalog AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM setup_import.events WHERE workspace_id=NEW.workspace_id AND account_id=NEW.account_id
     AND case_id=NEW.case_id AND version=NEW.version)
   OR NOT EXISTS (SELECT 1 FROM setup_import.receipts WHERE workspace_id=NEW.workspace_id AND account_id=NEW.account_id
     AND case_id=NEW.case_id AND event_version=NEW.version) THEN RAISE EXCEPTION 'MISSING_TRANSACTION_EVIDENCE'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA setup_import FROM PUBLIC;
CREATE TRIGGER guard_case BEFORE UPDATE ON setup_import.cases FOR EACH ROW EXECUTE FUNCTION setup_import.case_update_guard();
CREATE CONSTRAINT TRIGGER require_evidence AFTER INSERT OR UPDATE ON setup_import.cases
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION setup_import.require_commit_evidence();
CREATE TRIGGER guard_revision BEFORE INSERT ON setup_import.revisions FOR EACH ROW EXECUTE FUNCTION setup_import.revision_insert_guard();
CREATE TRIGGER guard_artifact BEFORE UPDATE ON setup_import.artifacts FOR EACH ROW EXECUTE FUNCTION setup_import.artifact_update_guard();
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['revisions','events','receipts'] LOOP
   EXECUTE format('CREATE TRIGGER append_only BEFORE UPDATE OR DELETE ON setup_import.%I FOR EACH ROW EXECUTE FUNCTION setup_import.reject_mutation()',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['cases','revisions','artifacts','events','receipts'] LOOP
   EXECUTE format('CREATE TRIGGER no_truncate BEFORE TRUNCATE ON setup_import.%I FOR EACH STATEMENT EXECUTE FUNCTION setup_import.reject_mutation()',t);
   EXECUTE format('ALTER TABLE setup_import.%I ENABLE ROW LEVEL SECURITY',t);
   EXECUTE format('ALTER TABLE setup_import.%I FORCE ROW LEVEL SECURITY',t);
   EXECUTE format('REVOKE ALL ON setup_import.%I FROM PUBLIC',t);
   EXECUTE format($policy$CREATE POLICY private_scope ON setup_import.%I TO setup_import_app
     USING (workspace_id::text=current_setting('setup_import.workspace_id',true)
       AND account_id::text=current_setting('setup_import.account_id',true)
       AND case_id::text=current_setting('setup_import.case_id',true))
     WITH CHECK (workspace_id::text=current_setting('setup_import.workspace_id',true)
       AND account_id::text=current_setting('setup_import.account_id',true)
       AND case_id::text=current_setting('setup_import.case_id',true))$policy$,t);
 END LOOP;
END $$;
CREATE POLICY requester_guard ON setup_import.cases AS RESTRICTIVE TO setup_import_app
 USING (body->>'requesterId'=current_setting('setup_import.requester_id',true))
 WITH CHECK (body->>'requesterId'=current_setting('setup_import.requester_id',true));
CREATE POLICY receipt_actor ON setup_import.receipts AS RESTRICTIVE TO setup_import_app
 USING (actor_id::text=current_setting('setup_import.actor_id',true))
 WITH CHECK (actor_id::text=current_setting('setup_import.actor_id',true));
CREATE POLICY event_actor ON setup_import.events AS RESTRICTIVE FOR INSERT TO setup_import_app
 WITH CHECK(body->>'actorId'=current_setting('setup_import.actor_id',true));
GRANT SELECT,INSERT,UPDATE ON setup_import.cases,setup_import.artifacts TO setup_import_app;
GRANT SELECT,INSERT ON setup_import.revisions,setup_import.events,setup_import.receipts TO setup_import_app;
-- No DELETE, TRUNCATE, schema CREATE, public function, anon/authenticated grant.
-- Storage upload must be immutable/upsert=false; reader URLs/retention purge are NOT implemented here.
COMMIT;
