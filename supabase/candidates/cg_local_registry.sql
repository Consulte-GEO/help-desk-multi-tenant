-- PRIVATE LOCAL REGISTRY CANDIDATE. Root promotes only after owned native PG17 qualification.
-- No customers, users, scope ceilings, contracts, coverage, MFA, protocol or external API setup.
DO $candidate$
BEGIN
 IF current_setting('app.cg_local_candidate',true) IS DISTINCT FROM 'disposable-pg17'
 OR current_database()<>'helpdesk_test' OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR helpdesk_auth.schema_version() IS DISTINCT FROM '0.23.0' OR current_user<>session_user
 OR (SELECT count(*) FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_audit','helpdesk_integration') AND nspowner=current_user::regrole)<>4
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls) AND rolcreaterole)
 THEN RAISE EXCEPTION 'Owned disposable PG17 operator required' USING ERRCODE='42501';END IF;
END $candidate$;

CREATE TABLE helpdesk_auth.cg_local_registries(workspace_id uuid PRIMARY KEY REFERENCES helpdesk_core.workspaces(id),revision int NOT NULL CHECK(revision>0),decision_hash text NOT NULL CHECK(decision_hash ~ '^[a-f0-9]{64}$'),as_of timestamptz NOT NULL,expires_at timestamptz NOT NULL,CHECK(isfinite(as_of) AND isfinite(expires_at) AND expires_at>as_of));
CREATE TABLE helpdesk_auth.cg_local_accounts(workspace_id uuid NOT NULL,account_id uuid NOT NULL,binding_id uuid NOT NULL,connection_id uuid NOT NULL,product_instance_id uuid NOT NULL,tenant_id text COLLATE "C" NOT NULL,name text NOT NULL,active boolean NOT NULL,registry_revision int NOT NULL,
 PRIMARY KEY(workspace_id,account_id),UNIQUE(workspace_id,binding_id),FOREIGN KEY(workspace_id,account_id,binding_id) REFERENCES helpdesk_auth.cg_resource_bindings(workspace_id,account_id,id),FOREIGN KEY(workspace_id) REFERENCES helpdesk_auth.cg_local_registries(workspace_id));
CREATE TABLE helpdesk_auth.cg_local_works(workspace_id uuid NOT NULL,account_id uuid NOT NULL,id text COLLATE "C" NOT NULL,name text NOT NULL,active boolean NOT NULL,registry_revision int NOT NULL,
 PRIMARY KEY(workspace_id,account_id,id),FOREIGN KEY(workspace_id,account_id) REFERENCES helpdesk_auth.cg_local_accounts(workspace_id,account_id),CHECK(helpdesk_auth.hdni_resource_text(id)));
CREATE TABLE helpdesk_auth.cg_local_permissions(workspace_id uuid NOT NULL,account_id uuid NOT NULL,principal_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),operation text NOT NULL CHECK(operation IN ('tickets.read','tickets.write','notes.read','notes.write')),role text NOT NULL CHECK(role IN ('requester','account_manager','agent')),active boolean NOT NULL,work_ids text[] NOT NULL,registry_revision int NOT NULL,
 PRIMARY KEY(workspace_id,account_id,principal_id,operation),FOREIGN KEY(workspace_id,account_id) REFERENCES helpdesk_auth.cg_local_accounts(workspace_id,account_id),CHECK(cardinality(work_ids)<=1000));
CREATE TABLE helpdesk_audit.cg_local_receipts(workspace_id uuid NOT NULL REFERENCES helpdesk_core.workspaces(id),request_id uuid NOT NULL,registry_revision int NOT NULL,command_hash text NOT NULL CHECK(command_hash ~ '^[a-f0-9]{64}$'),decision_hash text NOT NULL CHECK(decision_hash ~ '^[a-f0-9]{64}$'),reason text NOT NULL,receipt jsonb NOT NULL,recorded_by name NOT NULL DEFAULT session_user,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),publication_xid xid8 NOT NULL DEFAULT pg_current_xact_id(),
 PRIMARY KEY(workspace_id,request_id),UNIQUE(workspace_id,registry_revision));

CREATE FUNCTION helpdesk_auth.cg_local_manifest() RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT '{"authority":"persisted-local-registry","complete":true,"externalApiQualified":false,"resourceType":"work","source":"helpdesk-local","version":1}'::jsonb
$$;
CREATE FUNCTION helpdesk_auth.cg_local_operator() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF current_user<>session_user OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND (rolsuper OR rolbypassrls) AND rolcreaterole)
 OR (SELECT count(*) FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_audit','helpdesk_integration') AND nspowner=session_user::regrole)<>4
 THEN RAISE EXCEPTION 'Private authenticated operator required' USING ERRCODE='42501';END IF;
END$$;
CREATE FUNCTION helpdesk_auth.cg_local_immutable_receipt() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Local receipt immutable' USING ERRCODE='23514';END IF;
 NEW.recorded_by:=session_user;NEW.recorded_at:=clock_timestamp();NEW.publication_xid:=pg_current_xact_id();RETURN NEW;
END$$;
CREATE TRIGGER cg_local_receipt_immutable BEFORE INSERT OR UPDATE OR DELETE ON helpdesk_audit.cg_local_receipts FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.cg_local_immutable_receipt();
CREATE FUNCTION helpdesk_auth.cg_local_require_receipt() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE rev int;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Local metadata cannot be deleted' USING ERRCODE='23514';END IF;
 rev:=CASE WHEN TG_TABLE_NAME='cg_local_registries' THEN (to_jsonb(NEW)->>'revision')::int ELSE (to_jsonb(NEW)->>'registry_revision')::int END;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_audit.cg_local_receipts r JOIN helpdesk_auth.cg_local_registries g USING(workspace_id)
 WHERE r.workspace_id=NEW.workspace_id AND r.registry_revision=rev AND g.revision=rev AND r.decision_hash=g.decision_hash AND r.publication_xid=pg_current_xact_id())
 THEN RAISE EXCEPTION 'Local metadata requires atomic decision receipt' USING ERRCODE='23514';END IF;RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER cg_local_registry_receipt AFTER INSERT OR UPDATE OR DELETE ON helpdesk_auth.cg_local_registries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.cg_local_require_receipt();
CREATE CONSTRAINT TRIGGER cg_local_account_receipt AFTER INSERT OR UPDATE OR DELETE ON helpdesk_auth.cg_local_accounts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.cg_local_require_receipt();
CREATE CONSTRAINT TRIGGER cg_local_work_receipt AFTER INSERT OR UPDATE OR DELETE ON helpdesk_auth.cg_local_works DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.cg_local_require_receipt();
CREATE CONSTRAINT TRIGGER cg_local_permission_receipt AFTER INSERT OR UPDATE OR DELETE ON helpdesk_auth.cg_local_permissions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.cg_local_require_receipt();

-- Runs under the actual operator, no SECURITY DEFINER role escalation or caller GUC.
CREATE FUNCTION helpdesk_auth.cg_local_provision(command_text text,command_hash text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path='' AS $$
DECLARE v jsonb;w uuid;request uuid;expected int;revision int;old helpdesk_auth.cg_local_registries%rowtype;row_value jsonb;k text;person uuid;account uuid;scope_list text[];required text[];
 a helpdesk_auth.cg_local_accounts%rowtype;p helpdesk_auth.cg_local_permissions%rowtype;g helpdesk_auth.cg_resource_grant_sets%rowtype;s helpdesk_auth.cg_resource_publication_states%rowtype;
 instant timestamptz;expires timestamptz;as_text text;expires_text text;decision_hash text;prior bigint;next bigint;refs jsonb;target jsonb;snapshot jsonb;snapshot_hash text;target_hash text;publication_hash text;publication_receipt jsonb;result jsonb;saved record;is_active boolean;
BEGIN
 PERFORM helpdesk_auth.cg_local_operator();
 IF command_text IS NULL OR octet_length(command_text)>16384 OR command_hash IS NULL OR command_hash !~ '^[a-f0-9]{64}$'
 OR encode(sha256(convert_to(command_text,'UTF8')),'hex')<>command_hash THEN RAISE EXCEPTION 'Invalid local command' USING ERRCODE='PGL01';END IF;
 v:=command_text::jsonb;
 IF NOT coalesce(helpdesk_auth.hdn_cfg_object(v,ARRAY['workspaceId','expectedRegistryRevision','requestId','reason','sourceManifest','manifestFingerprint','accounts','works','permissions']),false)
 OR helpdesk_auth.hdni_canonical(v)<>command_text OR v->'sourceManifest'<>helpdesk_auth.cg_local_manifest()
 OR v->>'manifestFingerprint'<>'758a3d3bae9d46117696747b78f45358896ef6c371be918d15031beab7eea5d8'
 OR NOT coalesce(helpdesk_auth.hdn_cfg_int(v->'expectedRegistryRevision',0,2147483646),false)
 OR NOT coalesce(helpdesk_auth.hdn_cfg_singleline(v->'reason',1000),false) OR length(v->>'reason')<3
 OR jsonb_typeof(v->'accounts') IS DISTINCT FROM 'array' OR jsonb_typeof(v->'works') IS DISTINCT FROM 'array' OR jsonb_typeof(v->'permissions') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'Invalid local declaration' USING ERRCODE='PGL01';END IF;
 w:=(v->>'workspaceId')::uuid;request:=(v->>'requestId')::uuid;expected:=(v->>'expectedRegistryRevision')::int;
 IF jsonb_array_length(v->'accounts')>50 OR jsonb_array_length(v->'works')>1000 OR jsonb_array_length(v->'permissions')>1000 THEN RAISE EXCEPTION 'Local declaration too large' USING ERRCODE='PGL01';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('cg-local-registry:'||w::text,0));
 SELECT * INTO saved FROM helpdesk_audit.cg_local_receipts WHERE workspace_id=w AND request_id=request;
 IF FOUND THEN IF saved.command_hash<>command_hash THEN RAISE EXCEPTION 'Local request changed' USING ERRCODE='PGL02';END IF;RETURN saved.receipt;END IF;
 SELECT * INTO old FROM helpdesk_auth.cg_local_registries WHERE workspace_id=w FOR UPDATE;
 IF coalesce(old.revision,0)<>expected THEN RAISE EXCEPTION 'Local registry revision changed' USING ERRCODE='PGL02';END IF;
 PERFORM 1 FROM helpdesk_core.workspaces WHERE id=w FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Workspace absent' USING ERRCODE='PGL01';END IF;
 -- Lock scopes and current humans before admitting any new relationship or effect.
 FOR row_value IN SELECT value FROM jsonb_array_elements(v->'permissions') LOOP
  IF NOT coalesce(helpdesk_auth.hdn_cfg_object(row_value,ARRAY['accountId','principalId','role','operation','active','workIds']),false)
  OR row_value->>'role' NOT IN ('requester','account_manager','agent') OR row_value->>'operation' NOT IN ('tickets.read','tickets.write','notes.read','notes.write')
  OR jsonb_typeof(row_value->'active') IS DISTINCT FROM 'boolean' OR jsonb_typeof(row_value->'workIds') IS DISTINCT FROM 'array'
  OR jsonb_array_length(row_value->'workIds')>1000 THEN RAISE EXCEPTION 'Invalid local permission' USING ERRCODE='PGL01';END IF;
  person:=(row_value->>'principalId')::uuid;account:=(row_value->>'accountId')::uuid;
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('helpdesk-human-scopes:'||w::text||':'||person::text,0));
  PERFORM 1 FROM helpdesk_auth.principals WHERE id=person AND active AND kind='human' FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Existing active human required' USING ERRCODE='PGL01';END IF;
  scope_list:=helpdesk_auth.human_scopes(w,person);required:=ARRAY['tickets:read'];
  IF row_value->>'operation'='tickets.write' THEN required:=required||'tickets:write'::text;END IF;
  IF row_value->>'operation' IN ('notes.read','notes.write') THEN required:=required||replace(row_value->>'operation','.',':');IF row_value->>'role'<>'agent' AND NOT EXISTS(SELECT 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=person AND active AND role='admin') THEN RAISE EXCEPTION 'Notes require existing operator ceiling' USING ERRCODE='PGL01';END IF;END IF;
  IF NOT required <@ scope_list THEN RAISE EXCEPTION 'Existing scope ceiling insufficient' USING ERRCODE='PGL01';END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v->'accounts') x WHERE x->>'accountId'=account::text)
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(row_value->'workIds') x WHERE jsonb_typeof(x)<>'string' OR NOT helpdesk_auth.hdni_resource_text(x#>>'{}') OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v->'works') y WHERE y->>'accountId'=account::text AND y->'id'=x))
  OR (SELECT count(DISTINCT value) FROM jsonb_array_elements(row_value->'workIds'))<>jsonb_array_length(row_value->'workIds')
  OR EXISTS(SELECT 1 FROM jsonb_array_elements(v->'permissions') x WHERE x->>'accountId'=account::text AND x->>'principalId'=person::text AND x->>'role'<>row_value->>'role') THEN RAISE EXCEPTION 'Invalid local permission coverage' USING ERRCODE='PGL01';END IF;
 END LOOP;
 IF (SELECT count(DISTINCT value->>'accountId') FROM jsonb_array_elements(v->'accounts'))<>jsonb_array_length(v->'accounts')
 OR (SELECT count(DISTINCT jsonb_build_array(value->'accountId',value->'id')) FROM jsonb_array_elements(v->'works'))<>jsonb_array_length(v->'works')
 OR (SELECT count(DISTINCT jsonb_build_array(value->'accountId',value->'principalId',value->'operation')) FROM jsonb_array_elements(v->'permissions'))<>jsonb_array_length(v->'permissions') THEN RAISE EXCEPTION 'Duplicate local identity' USING ERRCODE='PGL01';END IF;
 revision:=expected+1;instant:=clock_timestamp();expires:=instant+interval '10 minutes';as_text:=helpdesk_auth.hdn_workflow_iso(instant);expires_text:=helpdesk_auth.hdn_workflow_iso(expires);
 decision_hash:=helpdesk_auth.hdni_digest(jsonb_build_object('accounts',v->'accounts','works',v->'works','permissions',v->'permissions','sourceManifest',v->'sourceManifest'));
 INSERT INTO helpdesk_auth.cg_local_registries VALUES(w,revision,decision_hash,instant,expires) ON CONFLICT(workspace_id) DO UPDATE SET revision=excluded.revision,decision_hash=excluded.decision_hash,as_of=excluded.as_of,expires_at=excluded.expires_at;
 -- Full desired snapshot: omission deactivates old local decisions, never deletes history.
 UPDATE helpdesk_auth.cg_local_accounts SET active=false,registry_revision=revision WHERE workspace_id=w;
 UPDATE helpdesk_auth.cg_local_works SET active=false,registry_revision=revision WHERE workspace_id=w;
 UPDATE helpdesk_auth.cg_local_permissions SET active=false,registry_revision=revision WHERE workspace_id=w;
 FOR row_value IN SELECT value FROM jsonb_array_elements(v->'accounts') LOOP
  IF NOT coalesce(helpdesk_auth.hdn_cfg_object(row_value,ARRAY['accountId','name','productInstanceId','connectionId','bindingId','tenantId','active']),false)
  OR NOT coalesce(helpdesk_auth.hdn_cfg_singleline(row_value->'name',160),false) OR NOT helpdesk_auth.hdni_resource_text(row_value->>'tenantId')
  OR jsonb_typeof(row_value->'active') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid local account' USING ERRCODE='PGL01';END IF;
  account:=(row_value->>'accountId')::uuid;
  PERFORM 1 FROM helpdesk_core.product_instances WHERE workspace_id=w AND id=(row_value->>'productInstanceId')::uuid FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Existing product instance required' USING ERRCODE='PGL01';END IF;
  SELECT * INTO a FROM helpdesk_auth.cg_local_accounts WHERE workspace_id=w AND account_id=account;
  IF FOUND AND (a.binding_id,a.connection_id,a.product_instance_id,a.tenant_id) IS DISTINCT FROM ((row_value->>'bindingId')::uuid,(row_value->>'connectionId')::uuid,(row_value->>'productInstanceId')::uuid,row_value->>'tenantId') THEN RAISE EXCEPTION 'Local namespace immutable' USING ERRCODE='PGL01';END IF;
  INSERT INTO helpdesk_core.accounts(workspace_id,id,name) VALUES(w,account,row_value->>'name') ON CONFLICT(workspace_id,id) DO UPDATE SET name=excluded.name;
  INSERT INTO helpdesk_auth.cg_resource_connections(workspace_id,id,product_instance_id) VALUES(w,(row_value->>'connectionId')::uuid,(row_value->>'productInstanceId')::uuid) ON CONFLICT(workspace_id,id) DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM helpdesk_auth.cg_resource_connections WHERE workspace_id=w AND id=(row_value->>'connectionId')::uuid AND product_instance_id=(row_value->>'productInstanceId')::uuid AND active) THEN RAISE EXCEPTION 'Connection mismatch' USING ERRCODE='PGL01';END IF;
  INSERT INTO helpdesk_auth.cg_resource_bindings(workspace_id,account_id,id,connection_id,tenant_id) VALUES(w,account,(row_value->>'bindingId')::uuid,(row_value->>'connectionId')::uuid,row_value->>'tenantId') ON CONFLICT(workspace_id,account_id,id) DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM helpdesk_auth.cg_resource_bindings WHERE workspace_id=w AND account_id=account AND id=(row_value->>'bindingId')::uuid AND connection_id=(row_value->>'connectionId')::uuid AND tenant_id=row_value->>'tenantId') THEN RAISE EXCEPTION 'Binding mismatch' USING ERRCODE='PGL01';END IF;
  INSERT INTO helpdesk_auth.cg_resource_publishers(workspace_id,connection_id,manifest_fingerprint,active) VALUES(w,(row_value->>'connectionId')::uuid,v->>'manifestFingerprint',true) ON CONFLICT(workspace_id,connection_id) DO NOTHING;
  IF NOT EXISTS(SELECT 1 FROM helpdesk_auth.cg_resource_publishers WHERE workspace_id=w AND connection_id=(row_value->>'connectionId')::uuid AND manifest_fingerprint=v->>'manifestFingerprint' AND active) THEN RAISE EXCEPTION 'Local provenance mapping required' USING ERRCODE='PGL01';END IF;
  INSERT INTO helpdesk_auth.cg_local_accounts VALUES(w,account,(row_value->>'bindingId')::uuid,(row_value->>'connectionId')::uuid,(row_value->>'productInstanceId')::uuid,row_value->>'tenantId',row_value->>'name',(row_value->>'active')::boolean,revision)
  ON CONFLICT(workspace_id,account_id) DO UPDATE SET name=excluded.name,active=excluded.active,registry_revision=excluded.registry_revision;
 END LOOP;
 FOR row_value IN SELECT value FROM jsonb_array_elements(v->'works') LOOP
  IF NOT coalesce(helpdesk_auth.hdn_cfg_object(row_value,ARRAY['accountId','id','name','active']),false) OR NOT helpdesk_auth.hdni_resource_text(row_value->>'id') OR NOT coalesce(helpdesk_auth.hdn_cfg_singleline(row_value->'name',160),false) OR jsonb_typeof(row_value->'active') IS DISTINCT FROM 'boolean'
  OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v->'accounts') x WHERE x->>'accountId'=row_value->>'accountId') THEN RAISE EXCEPTION 'Invalid local work' USING ERRCODE='PGL01';END IF;
  INSERT INTO helpdesk_auth.cg_local_works VALUES(w,(row_value->>'accountId')::uuid,row_value->>'id',row_value->>'name',(row_value->>'active')::boolean,revision) ON CONFLICT(workspace_id,account_id,id) DO UPDATE SET name=excluded.name,active=excluded.active,registry_revision=excluded.registry_revision;
 END LOOP;
 FOR row_value IN SELECT value FROM jsonb_array_elements(v->'permissions') LOOP
  account:=(row_value->>'accountId')::uuid;person:=(row_value->>'principalId')::uuid;
  -- Relationship creation/change is explicit operator input; scopes are untouched.
  INSERT INTO helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role,active) VALUES(w,account,person,row_value->>'role',EXISTS(SELECT 1 FROM jsonb_array_elements(v->'permissions') q WHERE q->>'accountId'=account::text AND q->>'principalId'=person::text AND q->'active'='true'::jsonb)) ON CONFLICT(workspace_id,account_id,principal_id) DO UPDATE SET role=excluded.role,active=excluded.active;
  INSERT INTO helpdesk_auth.cg_local_permissions VALUES(w,account,person,row_value->>'operation',row_value->>'role',(row_value->>'active')::boolean,ARRAY(SELECT jsonb_array_elements_text(row_value->'workIds')),revision)
  ON CONFLICT(workspace_id,account_id,principal_id,operation) DO UPDATE SET role=excluded.role,active=excluded.active,work_ids=excluded.work_ids,registry_revision=excluded.registry_revision;
 END LOOP;
 IF (SELECT count(*) FROM helpdesk_auth.cg_local_accounts WHERE workspace_id=w)>50 OR (SELECT count(*) FROM helpdesk_auth.cg_local_works WHERE workspace_id=w)>1000 OR (SELECT count(*) FROM helpdesk_auth.cg_local_permissions WHERE workspace_id=w)>1000 THEN RAISE EXCEPTION 'Local registry capacity exceeded' USING ERRCODE='PGL01';END IF;
 -- Rebuild every local target atomically, including targets revoked by omission.
 FOR p IN SELECT * FROM helpdesk_auth.cg_local_permissions WHERE workspace_id=w ORDER BY account_id,principal_id,operation LOOP
  SELECT * INTO a FROM helpdesk_auth.cg_local_accounts WHERE workspace_id=w AND account_id=p.account_id;
  SELECT * INTO g FROM helpdesk_auth.cg_resource_grant_sets WHERE workspace_id=w AND account_id=p.account_id AND binding_id=a.binding_id AND principal_id=p.principal_id AND operation=p.operation FOR UPDATE;prior:=coalesce(g.revision,0);
  IF prior>0 THEN
   SELECT * INTO s FROM helpdesk_auth.cg_resource_publication_states WHERE workspace_id=w AND account_id=p.account_id AND binding_id=a.binding_id AND principal_id=p.principal_id AND operation=p.operation;
   IF NOT FOUND OR s.grant_revision<>prior OR (s.snapshot->>'state'='active')<>g.active OR (s.snapshot->>'asOf')::timestamptz<>g.as_of OR (s.snapshot->>'expiresAt')::timestamptz<>g.expires_at OR s.snapshot->>'accessRevision'<>g.source_revision OR jsonb_array_length(s.snapshot->'resources')<>g.expected_count
   OR g.as_of>instant OR g.source_revision<>'local:'||expected::text OR s.snapshot->>'bindingRevision'<>'local-binding:'||expected::text OR s.snapshot->>'manifestFingerprint'<>v->>'manifestFingerprint'
   OR (SELECT count(*) FROM helpdesk_auth.cg_resource_grant_refs WHERE workspace_id=w AND account_id=p.account_id AND binding_id=a.binding_id AND principal_id=p.principal_id AND operation=p.operation)<>g.expected_count
   OR EXISTS(SELECT 1 FROM helpdesk_auth.cg_resource_grant_refs z WHERE z.workspace_id=w AND z.account_id=p.account_id AND z.binding_id=a.binding_id AND z.principal_id=p.principal_id AND z.operation=p.operation AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.snapshot->'resources') f WHERE f->>'type'=z.resource_type AND f->>'id'=z.resource_id)) THEN RAISE EXCEPTION 'Publication requires explicit reconciliation' USING ERRCODE='PGL02';END IF;
  END IF;
  is_active:=a.active AND p.active;
  SELECT coalesce(jsonb_agg(jsonb_build_object('connectionId',a.connection_id,'tenantId',a.tenant_id,'type','work','id',x.id) ORDER BY helpdesk_auth.hdni_utf16(x.id)),'[]') INTO refs FROM helpdesk_auth.cg_local_works x WHERE x.workspace_id=w AND x.account_id=p.account_id AND x.active AND x.id=ANY(p.work_ids) AND is_active;
  target:=jsonb_build_object('workspaceId',w,'accountId',p.account_id,'bindingId',a.binding_id,'principalId',p.principal_id,'operation',p.operation,'connectionId',a.connection_id,'tenantId',a.tenant_id);
  snapshot:=jsonb_build_object('target',target,'manifestFingerprint',v->>'manifestFingerprint','bindingRevision','local-binding:'||revision::text,'accessRevision','local:'||revision::text,'asOf',as_text,'expiresAt',expires_text,'state',CASE WHEN is_active THEN 'active' ELSE 'revoked' END,'complete',true,'resources',refs);
  snapshot_hash:=helpdesk_auth.hdni_digest(snapshot);target_hash:=helpdesk_auth.hdni_digest(target);publication_hash:=helpdesk_auth.hdni_digest(jsonb_build_object('target',target,'expectedRevision',prior::text));
  IF prior=0 THEN INSERT INTO helpdesk_auth.cg_resource_grant_sets(workspace_id,account_id,binding_id,principal_id,operation,source_revision,as_of,expires_at,expected_count,active) VALUES(w,p.account_id,a.binding_id,p.principal_id,p.operation,'local:'||revision::text,instant,expires,0,false);END IF;
  DELETE FROM helpdesk_auth.cg_resource_grant_refs WHERE workspace_id=w AND account_id=p.account_id AND binding_id=a.binding_id AND principal_id=p.principal_id AND operation=p.operation;
  INSERT INTO helpdesk_auth.cg_resource_grant_refs(workspace_id,account_id,binding_id,principal_id,operation,resource_type,resource_id) SELECT w,p.account_id,a.binding_id,p.principal_id,p.operation,'work',value->>'id' FROM jsonb_array_elements(refs);
  UPDATE helpdesk_auth.cg_resource_grant_sets x SET revision=x.revision+1,source_revision='local:'||revision::text,as_of=instant,expires_at=expires,expected_count=jsonb_array_length(refs),active=is_active WHERE workspace_id=w AND account_id=p.account_id AND binding_id=a.binding_id AND principal_id=p.principal_id AND operation=p.operation RETURNING x.revision INTO next;
  IF is_active THEN INSERT INTO helpdesk_auth.cg_resource_observations(workspace_id,account_id,binding_id,principal_id,operation,grant_revision,binding_revision,access_revision,manifest_fingerprint,as_of,expires_at,expected_count) VALUES(w,p.account_id,a.binding_id,p.principal_id,p.operation,next,'local-binding:'||revision::text,'local:'||revision::text,v->>'manifestFingerprint',instant,expires,jsonb_array_length(refs));END IF;
  INSERT INTO helpdesk_auth.cg_resource_publication_states VALUES(w,p.account_id,a.binding_id,p.principal_id,p.operation,next,prior,snapshot,snapshot_hash,request::text,publication_hash,target_hash,pg_current_xact_id()) ON CONFLICT(workspace_id,account_id,binding_id,principal_id,operation) DO UPDATE SET grant_revision=excluded.grant_revision,previous_revision=excluded.previous_revision,snapshot=excluded.snapshot,snapshot_hash=excluded.snapshot_hash,publication_key=excluded.publication_key,command_hash=excluded.command_hash,target_hash=excluded.target_hash,publication_xid=excluded.publication_xid;
  publication_receipt:=jsonb_build_object('key',request::text,'commandHash',publication_hash,'targetHash',target_hash,'previousRevision',prior::text,'revision',next::text,'snapshotHash',snapshot_hash,'state',snapshot->>'state','resourceCount',jsonb_array_length(refs),'asOf',as_text,'expiresAt',expires_text);
  INSERT INTO helpdesk_auth.cg_resource_publication_ledger(workspace_id,account_id,binding_id,principal_id,operation,publication_key,receipt) VALUES(w,p.account_id,a.binding_id,p.principal_id,p.operation,request::text,publication_receipt);
 END LOOP;
 result:=jsonb_build_object('workspaceId',w,'requestId',request,'revision',revision,'commandHash',command_hash,'decisionHash',decision_hash,'sourceManifest',helpdesk_auth.cg_local_manifest(),'asOf',as_text,'expiresAt',expires_text,'recordedBy',session_user::text);
 INSERT INTO helpdesk_audit.cg_local_receipts(workspace_id,request_id,registry_revision,command_hash,decision_hash,reason,receipt) VALUES(w,request,revision,command_hash,decision_hash,v->>'reason',result);RETURN result;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR datetime_field_overflow THEN RAISE EXCEPTION 'Invalid local declaration' USING ERRCODE='PGL01';
END$$;

-- Only additional local predicates. Historical external-source bindings preserve existing checks.
CREATE FUNCTION helpdesk_auth.cg_local_assert_current(ctx jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE a helpdesk_auth.cg_local_accounts%rowtype;r helpdesk_auth.cg_local_registries%rowtype;p helpdesk_auth.cg_local_permissions%rowtype;x jsonb;
BEGIN
 SELECT * INTO r FROM helpdesk_auth.cg_local_registries WHERE workspace_id=(ctx->>'workspaceId')::uuid FOR SHARE;
 SELECT * INTO a FROM helpdesk_auth.cg_local_accounts WHERE workspace_id=(ctx->>'workspaceId')::uuid AND account_id=(ctx->>'accountId')::uuid AND binding_id=(ctx->>'bindingId')::uuid FOR SHARE;
 IF NOT FOUND THEN RETURN ctx;END IF;
 SELECT * INTO p FROM helpdesk_auth.cg_local_permissions WHERE workspace_id=a.workspace_id AND account_id=a.account_id AND principal_id=(ctx->>'principalId')::uuid AND operation=ctx->>'operation' FOR SHARE;
 IF NOT FOUND OR NOT a.active OR NOT p.active OR a.registry_revision<>r.revision OR p.registry_revision<>r.revision OR ctx->>'workspaceId' IS DISTINCT FROM helpdesk_auth.workspace_id()::text OR ctx->>'principalId' IS DISTINCT FROM helpdesk_auth.actor_id()::text
 OR ctx->>'manifestFingerprint' IS DISTINCT FROM '758a3d3bae9d46117696747b78f45358896ef6c371be918d15031beab7eea5d8' OR ctx->>'accessRevision' IS DISTINCT FROM 'local:'||r.revision::text OR ctx->>'bindingRevision' IS DISTINCT FROM 'local-binding:'||r.revision::text
 OR NOT isfinite((ctx->>'asOf')::timestamptz) OR NOT isfinite((ctx->>'expiresAt')::timestamptz) OR (ctx->>'asOf')::timestamptz>clock_timestamp() OR (ctx->>'expiresAt')::timestamptz<=clock_timestamp()
 THEN RAISE EXCEPTION 'Local decision changed' USING ERRCODE='HDI01';END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(ctx->'refs') LOOP
  IF x->>'connectionId' IS DISTINCT FROM a.connection_id::text OR x->>'tenantId' IS DISTINCT FROM a.tenant_id OR x->>'type' IS DISTINCT FROM 'work' OR NOT (x->>'id'=ANY(p.work_ids)) THEN RAISE EXCEPTION 'Local work denied' USING ERRCODE='HDI01';END IF;
  PERFORM 1 FROM helpdesk_auth.cg_local_works WHERE workspace_id=a.workspace_id AND account_id=a.account_id AND id=x->>'id' AND active AND registry_revision=r.revision FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Local work inactive' USING ERRCODE='HDI01';END IF;
 END LOOP;RETURN ctx;
END$$;

-- Private bases preserve the exact historical body; no application bypass remains.
ALTER FUNCTION helpdesk_auth.hdni_lock_scope(jsonb) RENAME TO cg_local_base_intake_scope;
CREATE FUNCTION helpdesk_auth.hdni_lock_scope(ctx jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$BEGIN PERFORM helpdesk_auth.cg_local_assert_current(ctx);PERFORM helpdesk_auth.cg_local_base_intake_scope(ctx);RETURN helpdesk_auth.cg_local_assert_current(ctx);END$$;
ALTER FUNCTION helpdesk_auth.cg_ticket_resource_allowed(uuid,uuid,uuid,text) RENAME TO cg_local_base_ticket_allowed;
CREATE FUNCTION helpdesk_auth.cg_ticket_resource_allowed(w uuid,a uuid,ticket uuid,op text) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb;r record;
BEGIN
 SELECT l.* INTO r FROM helpdesk_auth.cg_local_accounts l JOIN helpdesk_core.cg_ticket_resource_sets s ON (s.workspace_id,s.account_id,s.binding_id)=(l.workspace_id,l.account_id,l.binding_id) WHERE s.workspace_id=w AND s.account_id=a AND s.ticket_id=ticket;
 IF FOUND THEN
  SELECT jsonb_build_object('principalId',helpdesk_auth.actor_id(),'workspaceId',w,'accountId',a,'bindingId',r.binding_id,'bindingRevision',o.binding_revision,'accessRevision',o.access_revision,'manifestFingerprint',o.manifest_fingerprint,'operation',op,'asOf',helpdesk_auth.hdn_workflow_iso(g.as_of),'expiresAt',helpdesk_auth.hdn_workflow_iso(g.expires_at),'refs',(SELECT coalesce(jsonb_agg(jsonb_build_object('connectionId',r.connection_id,'tenantId',r.tenant_id,'type',x.resource_type,'id',x.resource_id)),'[]') FROM helpdesk_core.cg_ticket_resource_refs x WHERE x.workspace_id=w AND x.account_id=a AND x.ticket_id=ticket)) INTO ctx FROM helpdesk_auth.cg_resource_grant_sets g JOIN helpdesk_auth.cg_resource_observations o ON (o.workspace_id,o.account_id,o.binding_id,o.principal_id,o.operation,o.grant_revision)=(g.workspace_id,g.account_id,g.binding_id,g.principal_id,g.operation,g.revision) WHERE g.workspace_id=w AND g.account_id=a AND g.binding_id=r.binding_id AND g.principal_id=helpdesk_auth.actor_id() AND g.operation=op AND g.active;
  IF ctx IS NULL THEN RETURN false;END IF;PERFORM helpdesk_auth.cg_local_assert_current(ctx);
 END IF;RETURN helpdesk_auth.cg_local_base_ticket_allowed(w,a,ticket,op);
EXCEPTION WHEN SQLSTATE 'HDI01' THEN RETURN false;
END$$;

-- Narrow true republication from an unchanged current local decision. This helper
-- is private to owner functions; the request role cannot call or select its target.
CREATE FUNCTION helpdesk_auth.cg_local_refresh(connection uuid,tenant text,op text) RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();a helpdesk_auth.cg_local_accounts%rowtype;r helpdesk_auth.cg_local_registries%rowtype;p helpdesk_auth.cg_local_permissions%rowtype;g helpdesk_auth.cg_resource_grant_sets%rowtype;s helpdesk_auth.cg_resource_publication_states%rowtype;refs jsonb;snapshot jsonb;intent text;instant timestamptz;expires timestamptz;next bigint;receipt jsonb;x record;
BEGIN
 SELECT * INTO r FROM helpdesk_auth.cg_local_registries WHERE workspace_id=w FOR SHARE;
 SELECT * INTO a FROM helpdesk_auth.cg_local_accounts WHERE workspace_id=w AND connection_id=connection AND tenant_id=tenant AND active FOR SHARE;IF NOT FOUND THEN RETURN;END IF;
 SELECT * INTO p FROM helpdesk_auth.cg_local_permissions WHERE workspace_id=w AND account_id=a.account_id AND principal_id=who AND operation=op AND active FOR SHARE;
 IF NOT FOUND OR a.registry_revision<>r.revision OR p.registry_revision<>r.revision THEN RETURN;END IF;
 -- Full set is locked, including inactive decision rows, before comparison.
 FOR x IN SELECT id FROM helpdesk_auth.cg_local_works WHERE workspace_id=w AND account_id=a.account_id ORDER BY id FOR SHARE LOOP NULL;END LOOP;
 SELECT * INTO g FROM helpdesk_auth.cg_resource_grant_sets WHERE workspace_id=w AND account_id=a.account_id AND binding_id=a.binding_id AND principal_id=who AND operation=op AND active FOR UPDATE;
 IF NOT FOUND OR g.source_revision<>'local:'||r.revision::text THEN RETURN;END IF;
 SELECT * INTO s FROM helpdesk_auth.cg_resource_publication_states WHERE workspace_id=w AND account_id=a.account_id AND binding_id=a.binding_id AND principal_id=who AND operation=op FOR UPDATE;
 IF NOT FOUND OR s.grant_revision<>g.revision OR s.snapshot->>'manifestFingerprint'<>'758a3d3bae9d46117696747b78f45358896ef6c371be918d15031beab7eea5d8'
 OR s.snapshot->>'bindingRevision'<>'local-binding:'||r.revision::text OR s.snapshot->>'accessRevision'<>g.source_revision OR s.snapshot->>'state'<>'active'
 OR (s.snapshot->>'asOf')::timestamptz<>g.as_of OR (s.snapshot->>'expiresAt')::timestamptz<>g.expires_at OR jsonb_array_length(s.snapshot->'resources')<>g.expected_count
 THEN RAISE EXCEPTION 'Local publication inconsistent' USING ERRCODE='HDI01';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('connectionId',connection,'tenantId',tenant,'type','work','id',id) ORDER BY helpdesk_auth.hdni_utf16(id)),'[]') INTO refs FROM helpdesk_auth.cg_local_works WHERE workspace_id=w AND account_id=a.account_id AND active AND registry_revision=r.revision AND id=ANY(p.work_ids);
 IF refs<>s.snapshot->'resources' OR (SELECT count(*) FROM helpdesk_auth.cg_resource_grant_refs WHERE workspace_id=w AND account_id=a.account_id AND binding_id=a.binding_id AND principal_id=who AND operation=op)<>g.expected_count
 OR EXISTS(SELECT 1 FROM helpdesk_auth.cg_resource_grant_refs z WHERE z.workspace_id=w AND z.account_id=a.account_id AND z.binding_id=a.binding_id AND z.principal_id=who AND z.operation=op AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(refs) f WHERE f->>'type'=z.resource_type AND f->>'id'=z.resource_id))
 OR NOT EXISTS(SELECT 1 FROM helpdesk_auth.cg_resource_observations o WHERE (o.workspace_id,o.account_id,o.binding_id,o.principal_id,o.operation,o.grant_revision,o.binding_revision,o.access_revision,o.manifest_fingerprint,o.as_of,o.expires_at,o.expected_count)=(w,a.account_id,a.binding_id,who,op,g.revision,s.snapshot->>'bindingRevision',g.source_revision,s.snapshot->>'manifestFingerprint',g.as_of,g.expires_at,g.expected_count))
 THEN RAISE EXCEPTION 'Local complete coverage changed' USING ERRCODE='HDI01';END IF;
 -- Reads within this cadence pass through the existing persisted observation.
 instant:=clock_timestamp();IF g.as_of>instant THEN RAISE EXCEPTION 'Future local observation denied' USING ERRCODE='HDI01';END IF;
 IF instant-g.as_of<interval '30 seconds' AND g.expires_at>instant THEN RETURN;END IF;
 expires:=instant+interval '10 minutes';intent:='local-refresh:'||gen_random_uuid()::text;
 snapshot:=s.snapshot||jsonb_build_object('asOf',helpdesk_auth.hdn_workflow_iso(instant),'expiresAt',helpdesk_auth.hdn_workflow_iso(expires));
 UPDATE helpdesk_auth.cg_resource_grant_sets z SET revision=z.revision+1,as_of=instant,expires_at=expires WHERE workspace_id=w AND account_id=a.account_id AND binding_id=a.binding_id AND principal_id=who AND operation=op RETURNING z.revision INTO next;
 INSERT INTO helpdesk_auth.cg_resource_observations(workspace_id,account_id,binding_id,principal_id,operation,grant_revision,binding_revision,access_revision,manifest_fingerprint,as_of,expires_at,expected_count) VALUES(w,a.account_id,a.binding_id,who,op,next,snapshot->>'bindingRevision',g.source_revision,snapshot->>'manifestFingerprint',instant,expires,g.expected_count);
 UPDATE helpdesk_auth.cg_resource_publication_states SET grant_revision=next,previous_revision=g.revision,snapshot=cg_local_refresh.snapshot,snapshot_hash=helpdesk_auth.hdni_digest(cg_local_refresh.snapshot),publication_key=intent,command_hash=helpdesk_auth.hdni_digest(jsonb_build_object('target',s.snapshot->'target','expectedRevision',g.revision::text)),publication_xid=pg_current_xact_id() WHERE workspace_id=w AND account_id=a.account_id AND binding_id=a.binding_id AND principal_id=who AND operation=op RETURNING * INTO s;
 receipt:=jsonb_build_object('key',intent,'commandHash',s.command_hash,'targetHash',s.target_hash,'previousRevision',g.revision::text,'revision',next::text,'snapshotHash',s.snapshot_hash,'state','active','resourceCount',g.expected_count,'asOf',snapshot->>'asOf','expiresAt',snapshot->>'expiresAt');
 INSERT INTO helpdesk_auth.cg_resource_publication_ledger(workspace_id,account_id,binding_id,principal_id,operation,publication_key,receipt) VALUES(w,a.account_id,a.binding_id,who,op,intent,receipt);
END$$;

CREATE FUNCTION helpdesk_auth.cg_local_read_access(connection uuid,tenant text,op text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();a helpdesk_auth.cg_local_accounts%rowtype;g helpdesk_auth.cg_resource_grant_sets%rowtype;o helpdesk_auth.cg_resource_observations%rowtype;refs jsonb;ctx jsonb;principal jsonb;
BEGIN
 PERFORM 1 FROM helpdesk_auth.cg_local_registries WHERE workspace_id=w FOR SHARE;
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('helpdesk-human-scopes:'||w::text||':'||who::text,0));
 PERFORM 1 FROM helpdesk_auth.principals WHERE id=who AND active AND kind='human' FOR SHARE;IF NOT FOUND THEN RETURN NULL;END IF;
 PERFORM 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=who FOR SHARE;
 PERFORM 1 FROM helpdesk_auth.account_grants WHERE workspace_id=w AND principal_id=who FOR SHARE;
 IF NOT coalesce(helpdesk_auth.is_human(),false) OR op NOT IN ('tickets.read','tickets.write','notes.read','notes.write') OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:read'),false)
 OR op='tickets.write' AND NOT coalesce(helpdesk_auth.has_scope(w,'tickets:write'),false) OR op IN ('notes.read','notes.write') AND NOT coalesce(helpdesk_auth.has_scope(w,replace(op,'.',':')),false) THEN RETURN NULL;END IF;
 SELECT * INTO a FROM helpdesk_auth.cg_local_accounts WHERE workspace_id=w AND connection_id=connection AND tenant_id=tenant AND active FOR SHARE;
 IF NOT FOUND OR NOT coalesce(helpdesk_auth.has_account(w,a.account_id),false) OR NOT coalesce(helpdesk_auth.product_allowed(w,a.product_instance_id),false) OR op IN ('notes.read','notes.write') AND NOT coalesce(helpdesk_auth.is_operator(w,a.account_id),false) THEN RETURN NULL;END IF;
 PERFORM 1 FROM helpdesk_auth.cg_resource_connections WHERE workspace_id=w AND id=connection AND active FOR SHARE;IF NOT FOUND THEN RETURN NULL;END IF;
 PERFORM 1 FROM helpdesk_auth.cg_resource_bindings WHERE workspace_id=w AND account_id=a.account_id AND id=a.binding_id AND active FOR SHARE;IF NOT FOUND THEN RETURN NULL;END IF;
 PERFORM helpdesk_auth.cg_local_refresh(connection,tenant,op);
 SELECT * INTO g FROM helpdesk_auth.cg_resource_grant_sets WHERE workspace_id=w AND account_id=a.account_id AND binding_id=a.binding_id AND principal_id=who AND operation=op AND active FOR SHARE;IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT * INTO o FROM helpdesk_auth.cg_resource_observations WHERE workspace_id=w AND account_id=a.account_id AND binding_id=a.binding_id AND principal_id=who AND operation=op AND grant_revision=g.revision AND access_revision=g.source_revision AND as_of=g.as_of AND expires_at=g.expires_at AND expected_count=g.expected_count FOR SHARE;IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('connectionId',connection,'tenantId',tenant,'type',resource_type,'id',resource_id) ORDER BY helpdesk_auth.hdni_utf16(resource_id)),'[]') INTO refs FROM helpdesk_auth.cg_resource_grant_refs WHERE workspace_id=w AND account_id=a.account_id AND binding_id=a.binding_id AND principal_id=who AND operation=op;
 IF jsonb_array_length(refs)<>g.expected_count THEN RETURN NULL;END IF;
 ctx:=jsonb_build_object('principalId',who,'workspaceId',w,'accountId',a.account_id,'bindingId',a.binding_id,'bindingRevision',o.binding_revision,'accessRevision',o.access_revision,'manifestFingerprint',o.manifest_fingerprint,'operation',op,'asOf',helpdesk_auth.hdn_workflow_iso(g.as_of),'expiresAt',helpdesk_auth.hdn_workflow_iso(g.expires_at),'refs',refs);PERFORM helpdesk_auth.cg_local_assert_current(ctx);
 SELECT jsonb_build_object('id',who,'workspaceId',w,'kind','human','workspaceRole',(SELECT role FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=who AND active),'grants',coalesce((SELECT jsonb_agg(jsonb_build_object('accountId',account_id,'role',role) ORDER BY account_id) FROM helpdesk_auth.account_grants WHERE workspace_id=w AND principal_id=who AND active),'[]'),'scopes',to_jsonb(helpdesk_auth.human_scopes(w,who))) INTO principal;
 RETURN jsonb_build_object('principal',principal,'binding',jsonb_build_object('id',a.binding_id,'workspaceId',w,'accountId',a.account_id,'connectionId',connection,'tenantId',tenant,'revision',o.binding_revision,'active',true),'operation',op,'manifestFingerprint',o.manifest_fingerprint,'accessRevision',o.access_revision,'asOf',ctx->>'asOf','expiresAt',ctx->>'expiresAt','resources',refs);
EXCEPTION WHEN SQLSTATE 'HDI01' THEN RETURN NULL;
END$$;
CREATE FUNCTION helpdesk_auth.cg_local_ticket_directory(ticket uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE ctx jsonb;r record;
BEGIN
 SELECT l.connection_id,l.tenant_id INTO r FROM helpdesk_core.tickets t JOIN helpdesk_core.cg_ticket_resource_sets s ON (s.workspace_id,s.account_id,s.ticket_id)=(t.workspace_id,t.account_id,t.id) JOIN helpdesk_auth.cg_local_accounts l ON (l.workspace_id,l.account_id,l.binding_id)=(s.workspace_id,s.account_id,s.binding_id)
 WHERE t.workspace_id=helpdesk_auth.workspace_id() AND t.id=ticket AND coalesce(helpdesk_auth.has_scope(t.workspace_id,'tickets:read'),false) AND coalesce(helpdesk_auth.can_read_ticket(t.workspace_id,t.account_id,t.product_instance_id,t.created_by),false);
 IF FOUND THEN PERFORM helpdesk_auth.cg_local_read_access(r.connection_id,r.tenant_id,'tickets.read');END IF;
 ctx:=helpdesk_auth.cg_lock_ticket_scope(ticket,'tickets.read');IF ctx IS NULL THEN RETURN NULL;END IF;PERFORM helpdesk_auth.cg_local_assert_current(ctx);
 RETURN jsonb_build_object('ticketId',ticket,'workspaceId',ctx->'workspaceId','accountId',ctx->'accountId','refs',ctx->'refs');
EXCEPTION WHEN SQLSTATE 'HDI01' THEN RETURN NULL;
END$$;
CREATE FUNCTION helpdesk_auth.cg_local_request_contexts() RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE a helpdesk_auth.cg_local_accounts%rowtype;access jsonb;works jsonb;result jsonb:='[]';
BEGIN
 IF NOT coalesce(helpdesk_auth.is_human(),false) OR NOT coalesce(helpdesk_auth.has_scope(helpdesk_auth.workspace_id(),'contexts:resolve'),false) THEN RETURN result;END IF;
 FOR a IN SELECT * FROM helpdesk_auth.cg_local_accounts WHERE workspace_id=helpdesk_auth.workspace_id() AND active ORDER BY account_id LOOP
  access:=helpdesk_auth.cg_local_read_access(a.connection_id,a.tenant_id,'tickets.read');IF access IS NULL OR jsonb_array_length(access->'resources')=0 THEN CONTINUE;END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'ref',r.value) ORDER BY helpdesk_auth.hdni_utf16(x.id)),'[]') INTO works FROM jsonb_array_elements(access->'resources') r JOIN helpdesk_auth.cg_local_works x ON x.workspace_id=a.workspace_id AND x.account_id=a.account_id AND x.id=r.value->>'id' AND x.active;
  result:=result||jsonb_build_array(jsonb_build_object('accountId',a.account_id,'accountName',a.name,'productInstanceId',a.product_instance_id,'connectionId',a.connection_id,'tenantId',a.tenant_id,'works',works));
 END LOOP;RETURN result;
END$$;

-- RLS expressions store function OIDs. Rebind them to the new public wrappers;
-- the renamed historical bases have no application EXECUTE privilege.
ALTER POLICY cg_ticket_resource_read ON helpdesk_core.tickets USING(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,id,'tickets.read'));
ALTER POLICY cg_ticket_resource_update ON helpdesk_core.tickets USING(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,id,'tickets.write')) WITH CHECK(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,id,'tickets.write'));
ALTER POLICY cg_message_resource_read ON helpdesk_core.ticket_messages USING(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,ticket_id,'tickets.read'));
ALTER POLICY cg_message_resource_insert ON helpdesk_core.ticket_messages WITH CHECK(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,ticket_id,'tickets.write'));
ALTER POLICY cg_note_resource_read ON helpdesk_core.internal_notes USING(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,ticket_id,'notes.read'));
ALTER POLICY cg_note_resource_insert ON helpdesk_core.internal_notes WITH CHECK(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,ticket_id,'notes.write'));
ALTER POLICY cg_event_resource_read ON helpdesk_core.ticket_events USING(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,ticket_id,CASE WHEN type='note.created' THEN 'notes.read' ELSE 'tickets.read' END));
ALTER POLICY cg_event_resource_insert ON helpdesk_core.ticket_events WITH CHECK(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,ticket_id,CASE WHEN type='note.created' THEN 'notes.write' ELSE 'tickets.write' END));
ALTER POLICY cg_outbox_resource_insert ON helpdesk_integration.outbox_events WITH CHECK(helpdesk_auth.cg_ticket_resource_allowed(workspace_id,account_id,ticket_id,'tickets.write'));

DO $local_acl$ DECLARE obj record;r text;
BEGIN
 FOR obj IN SELECT c.oid::regclass AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('helpdesk_auth','helpdesk_audit') AND c.relname LIKE 'cg_local_%' AND c.relkind='r' LOOP
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',obj.name);EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY',obj.name);
  EXECUTE format('REVOKE ALL ON TABLE %s FROM PUBLIC,helpdesk_app,helpdesk_resource_publisher,helpdesk_notification_worker',obj.name);
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I',obj.name,r);END IF;END LOOP;
 END LOOP;
 FOR obj IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='helpdesk_auth' AND (p.proname LIKE 'cg_local_%' OR p.proname IN ('hdni_lock_scope','cg_ticket_resource_allowed')) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,helpdesk_app,helpdesk_resource_publisher,helpdesk_notification_worker',obj.signature);
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',obj.signature,r);END IF;END LOOP;
 END LOOP;
END $local_acl$;
GRANT EXECUTE ON FUNCTION helpdesk_auth.hdni_lock_scope(jsonb),helpdesk_auth.cg_ticket_resource_allowed(uuid,uuid,uuid,text),helpdesk_auth.cg_local_read_access(uuid,text,text),helpdesk_auth.cg_local_ticket_directory(uuid),helpdesk_auth.cg_local_request_contexts() TO helpdesk_app;
