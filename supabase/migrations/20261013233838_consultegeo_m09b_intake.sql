-- Consulte GEO M09b: authorized published catalogue and owner-only durable drafts.
-- No protocol allocation, ticket insertion, email dispatch or external GEO writes.
BEGIN;
SET LOCAL statement_timeout='120s';
SET LOCAL lock_timeout='10s';
DO $m09b$
DECLARE who oid:=current_user::regrole;
BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999 OR current_user<>session_user
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE oid=who AND (rolsuper OR rolbypassrls) AND rolcreaterole)
 OR (SELECT count(*) FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') AND nspowner=who)<>4
 THEN RAISE EXCEPTION 'Reviewed operator required' USING ERRCODE='HDU01'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('Consulte GEO schema upgrade',0));
 IF helpdesk_auth.schema_version() IS DISTINCT FROM '0.21.0' THEN RAISE EXCEPTION 'Exact prior schema required' USING ERRCODE='HDU02'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='helpdesk_auth' AND p.proname LIKE 'hdni\_%' ESCAPE '\') OR to_regclass('helpdesk_core.hdni_drafts') IS NOT NULL THEN RAISE EXCEPTION 'Partial installation refused' USING ERRCODE='HDU03'; END IF;
 IF EXISTS(SELECT 1 FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE d.defaclrole=who
 AND (d.defaclnamespace=0 OR d.defaclnamespace IN (SELECT oid FROM pg_namespace WHERE nspname IN ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')))
 AND a.grantee<>who AND NOT (a.grantee=0 AND d.defaclobjtype='f' AND a.privilege_type='EXECUTE')) THEN RAISE EXCEPTION 'Unsafe defaults refused' USING ERRCODE='HDU05'; END IF;
END $m09b$;

-- JS Array.sort compares UTF16 units. Source IDs remain opaque, including astral Unicode.
CREATE FUNCTION helpdesk_auth.hdni_utf16(v text) RETURNS bytea LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE answer bytea:=''::bytea;n int;i int;
BEGIN FOR i IN 1..length(v) LOOP n:=ascii(substr(v,i,1));IF n<=65535 THEN answer:=answer||decode(lpad(to_hex(n),4,'0'),'hex');ELSE n:=n-65536;answer:=answer||decode(lpad(to_hex(55296+n/1024),4,'0')||lpad(to_hex(56320+n%1024),4,'0'),'hex');END IF;END LOOP;RETURN answer;END$$;
CREATE FUNCTION helpdesk_auth.hdni_resource_text(v text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$BEGIN RETURN coalesce(octet_length(helpdesk_auth.hdni_utf16(v))/2 BETWEEN 1 AND 256 AND btrim(v,E' \t\n\r\f\v'||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279))=v AND v !~ '[[:cntrl:]]' AND v !~ '[\u007f-\u009f]',false);END$$;
CREATE FUNCTION helpdesk_auth.hdni_canonical(d jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE answer text;
BEGIN
 IF jsonb_typeof(d)='object' THEN SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||helpdesk_auth.hdni_canonical(value),',' ORDER BY helpdesk_auth.hdni_utf16(key)),'')||'}' INTO answer FROM jsonb_each(d);
 ELSIF jsonb_typeof(d)='array' THEN SELECT '['||coalesce(string_agg(helpdesk_auth.hdni_canonical(value),',' ORDER BY ordinality),'')||']' INTO answer FROM jsonb_array_elements(d) WITH ORDINALITY;
 ELSE answer:=helpdesk_auth.hdn_workflow_canonical(d);END IF;RETURN answer;
END$$;
CREATE FUNCTION helpdesk_auth.hdni_digest(d jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT encode(sha256(convert_to(helpdesk_auth.hdni_canonical(d),'UTF8')),'hex')$$;
CREATE FUNCTION helpdesk_auth.hdni_refs_key(refs jsonb) RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$
SELECT helpdesk_auth.hdni_canonical(coalesce(jsonb_agg(to_jsonb(k) ORDER BY helpdesk_auth.hdni_utf16(k)),'[]')) FROM (SELECT helpdesk_auth.hdni_canonical(jsonb_build_array(value->'connectionId',value->'tenantId',value->'type',value->'id')) k FROM jsonb_array_elements(refs)) q
$$;

-- Context is compared with current native rows, never treated as a bearer credential.
-- Every RPC repeats this check, including after waits and at deferred COMMIT validation.
CREATE FUNCTION helpdesk_auth.hdni_lock_scope(ctx jsonb) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();a uuid;b uuid;conn uuid;tenant text;op text;r record;x jsonb;refs jsonb:=ctx->'refs';n int;
BEGIN
 IF NOT coalesce(helpdesk_auth.hdn_cfg_object(ctx,ARRAY['principalId','workspaceId','accountId','bindingId','bindingRevision','accessRevision','manifestFingerprint','operation','asOf','expiresAt','refs']),false)
 OR ctx->>'workspaceId' IS DISTINCT FROM w::text OR ctx->>'principalId' IS DISTINCT FROM who::text OR NOT coalesce(helpdesk_auth.is_human(),false) THEN RAISE EXCEPTION 'Scope denied' USING ERRCODE='HDI01';END IF;
 a:=(ctx->>'accountId')::uuid;b:=(ctx->>'bindingId')::uuid;op:=ctx->>'operation';
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('helpdesk-human-scopes:'||w::text||':'||who::text,0));
 PERFORM 1 FROM helpdesk_auth.principals WHERE id=who AND active AND kind='human' FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Actor denied' USING ERRCODE='HDI01';END IF;
 PERFORM 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=who FOR SHARE;
 PERFORM 1 FROM helpdesk_auth.account_grants WHERE workspace_id=w AND account_id=a AND principal_id=who FOR SHARE;
 PERFORM 1 FROM helpdesk_core.accounts WHERE workspace_id=w AND id=a FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Account denied' USING ERRCODE='HDI01';END IF;
 IF op NOT IN ('tickets.read','tickets.write') OR NOT coalesce(helpdesk_auth.has_scope(w,'tickets:read'),false) OR op='tickets.write' AND NOT coalesce(helpdesk_auth.has_scope(w,'tickets:write'),false)
 OR NOT coalesce(helpdesk_auth.has_account(w,a),false) OR jsonb_typeof(refs) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Scope denied' USING ERRCODE='HDI01';END IF;
 n:=jsonb_array_length(refs);IF n NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Scope denied' USING ERRCODE='HDI01';END IF;
 conn:=(refs->0->>'connectionId')::uuid;tenant:=refs->0->>'tenantId';
 FOR x IN SELECT value FROM jsonb_array_elements(refs) LOOP
  IF NOT coalesce(helpdesk_auth.hdn_cfg_object(x,ARRAY['connectionId','tenantId','type','id']),false) OR x->>'connectionId' IS DISTINCT FROM conn::text OR x->>'tenantId' IS DISTINCT FROM tenant
  OR jsonb_typeof(x->'type') IS DISTINCT FROM 'string' OR x->>'type' !~ '^[a-z][a-z0-9_]{0,31}$'
  OR NOT helpdesk_auth.hdni_resource_text(x->>'id') OR NOT helpdesk_auth.hdni_resource_text(x->>'tenantId') THEN RAISE EXCEPTION 'Scope denied' USING ERRCODE='HDI01';END IF;
 END LOOP;
 IF (SELECT count(DISTINCT value) FROM jsonb_array_elements(refs))<>n THEN RAISE EXCEPTION 'Duplicate selection denied' USING ERRCODE='HDI01';END IF;
 SELECT c.product_instance_id,o.binding_revision,o.access_revision,o.manifest_fingerprint,g.as_of,g.expires_at,g.expected_count INTO r
 FROM helpdesk_auth.cg_resource_connections c JOIN helpdesk_auth.cg_resource_bindings b ON (b.workspace_id,b.connection_id)=(c.workspace_id,c.id)
 JOIN helpdesk_auth.cg_resource_grant_sets g ON (g.workspace_id,g.account_id,g.binding_id,g.principal_id,g.operation)=(b.workspace_id,b.account_id,b.id,who,op)
 JOIN helpdesk_auth.cg_resource_observations o ON (o.workspace_id,o.account_id,o.binding_id,o.principal_id,o.operation,o.grant_revision,o.access_revision,o.as_of,o.expires_at,o.expected_count)=(g.workspace_id,g.account_id,g.binding_id,g.principal_id,g.operation,g.revision,g.source_revision,g.as_of,g.expires_at,g.expected_count)
 WHERE c.workspace_id=w AND c.id=conn AND b.account_id=a AND b.id=hdni_lock_scope.b AND b.tenant_id=tenant AND c.active AND b.active AND g.active FOR SHARE OF c,b,g,o;
 IF NOT FOUND OR r.as_of>clock_timestamp() OR r.expires_at<=clock_timestamp() OR ctx->>'bindingRevision' IS DISTINCT FROM r.binding_revision OR ctx->>'accessRevision' IS DISTINCT FROM r.access_revision OR ctx->>'manifestFingerprint' IS DISTINCT FROM r.manifest_fingerprint
 OR (ctx->>'asOf')::timestamptz IS DISTINCT FROM r.as_of OR (ctx->>'expiresAt')::timestamptz IS DISTINCT FROM r.expires_at
 OR NOT coalesce(helpdesk_auth.product_allowed(w,r.product_instance_id),false)
 OR (SELECT count(*) FROM helpdesk_auth.cg_resource_grant_refs g WHERE (g.workspace_id,g.account_id,g.binding_id,g.principal_id,g.operation)=(w,a,b,who,op))<>r.expected_count
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(refs) x WHERE NOT EXISTS(SELECT 1 FROM helpdesk_auth.cg_resource_grant_refs g WHERE (g.workspace_id,g.account_id,g.binding_id,g.principal_id,g.operation,g.resource_type,g.resource_id)=(w,a,b,who,op,x->>'type',x->>'id'))) THEN RAISE EXCEPTION 'Scope changed' USING ERRCODE='HDI01';END IF;
 RETURN ctx; -- only after native comparison; preserves canonical resolver timestamps/order.
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN RAISE EXCEPTION 'Scope denied' USING ERRCODE='HDI01';
END$$;

CREATE FUNCTION helpdesk_auth.hdni_profile(ctx jsonb,form uuid,version integer) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE v helpdesk_core.hdn_cfg_versions%rowtype;instance uuid;
BEGIN
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);
 SELECT c.product_instance_id INTO instance FROM helpdesk_auth.cg_resource_connections c WHERE c.workspace_id=helpdesk_auth.workspace_id() AND c.id=(ctx->'refs'->0->>'connectionId')::uuid;
 SELECT * INTO v FROM helpdesk_core.hdn_cfg_versions q WHERE q.workspace_id=helpdesk_auth.workspace_id() AND q.status='published' AND q.version=hdni_profile.version
 AND EXISTS(SELECT 1 FROM jsonb_array_elements(q.artifacts->'entries') e WHERE e->'form'->>'id'=form::text)
 AND EXISTS(SELECT 1 FROM helpdesk_core.product_instances i JOIN helpdesk_core.services s ON (s.workspace_id,s.product_id)=(i.workspace_id,i.product_id) WHERE (i.workspace_id,i.id)=(q.workspace_id,instance) AND s.code=q.definition->>'service') FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Published form unavailable' USING ERRCODE='HDI05';END IF;
 PERFORM 1 FROM helpdesk_core.product_instances i JOIN helpdesk_core.services s ON (s.workspace_id,s.product_id)=(i.workspace_id,i.product_id) WHERE (i.workspace_id,i.id)=(v.workspace_id,instance) AND s.code=v.definition->>'service' FOR SHARE OF i,s;
 IF NOT FOUND THEN RAISE EXCEPTION 'Published service unavailable' USING ERRCODE='HDI05';END IF;
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);
 RETURN jsonb_build_object('record',helpdesk_auth.hdn_cfg_record(v),'productInstanceId',instance,'serviceCode',v.definition->>'service');
END$$;
CREATE FUNCTION helpdesk_auth.hdni_catalog(ctx jsonb,service text) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE answer jsonb;instance uuid;v helpdesk_core.hdn_cfg_versions%rowtype;
BEGIN
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);
 IF NOT coalesce(helpdesk_auth.has_scope(helpdesk_auth.workspace_id(),'contexts:resolve'),false) THEN RAISE EXCEPTION 'Context discovery denied' USING ERRCODE='HDI01';END IF;
 IF service IS NULL OR service NOT IN ('user_access','questions','backup','new_work','structure_adjustment','problem') THEN RAISE EXCEPTION 'Invalid service' USING ERRCODE='HDI04';END IF;
 SELECT c.product_instance_id INTO instance FROM helpdesk_auth.cg_resource_connections c WHERE c.workspace_id=helpdesk_auth.workspace_id() AND c.id=(ctx->'refs'->0->>'connectionId')::uuid;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_core.product_instances i JOIN helpdesk_core.services s ON (s.workspace_id,s.product_id)=(i.workspace_id,i.product_id) WHERE (i.workspace_id,i.id)=(helpdesk_auth.workspace_id(),instance) AND s.code=service) THEN RETURN jsonb_build_object('records','[]'::jsonb);END IF;
 -- Bounded whole selection, no truncated authorization or stale draft adoption.
 answer:='[]';FOR v IN SELECT q.* FROM helpdesk_core.hdn_cfg_versions q WHERE q.workspace_id=helpdesk_auth.workspace_id() AND q.status='published' AND q.definition->>'service'=service AND NOT EXISTS(SELECT 1 FROM helpdesk_core.hdn_cfg_versions n WHERE (n.workspace_id,n.id)=(q.workspace_id,q.id) AND n.status='published' AND n.version>q.version) ORDER BY q.id FOR SHARE LOOP
  answer:=answer||jsonb_build_array(helpdesk_auth.hdn_cfg_record(v));IF jsonb_array_length(answer)>20 OR octet_length(answer::text)>262144 THEN RAISE EXCEPTION 'Catalogue unavailable' USING ERRCODE='HDI08';END IF;
 END LOOP;PERFORM helpdesk_auth.hdni_lock_scope(ctx);RETURN jsonb_build_object('records',answer);
END$$;

CREATE TABLE helpdesk_core.hdni_drafts(
 workspace_id uuid NOT NULL REFERENCES helpdesk_core.workspaces(id),id uuid NOT NULL,owner_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),account_id uuid NOT NULL,
 configuration_id uuid NOT NULL,form_version integer NOT NULL,revision integer NOT NULL,expires_at timestamptz NOT NULL,document jsonb NOT NULL,
 CONSTRAINT hdni_drafts_pk PRIMARY KEY(workspace_id,id),CONSTRAINT hdni_drafts_account_fk FOREIGN KEY(workspace_id,account_id) REFERENCES helpdesk_core.accounts(workspace_id,id),
 CONSTRAINT hdni_drafts_configuration_fk FOREIGN KEY(workspace_id,configuration_id,form_version) REFERENCES helpdesk_core.hdn_cfg_versions(workspace_id,id,version),
 CONSTRAINT hdni_drafts_revision_ck CHECK(revision>0),CONSTRAINT hdni_drafts_document_ck CHECK(jsonb_typeof(document)='object' AND octet_length(document::text)<=262144)
);
CREATE INDEX hdni_drafts_owner_idx ON helpdesk_core.hdni_drafts(workspace_id,owner_id,id);
CREATE TABLE helpdesk_audit.hdni_draft_commits(
 workspace_id uuid NOT NULL,draft_id uuid NOT NULL,revision integer NOT NULL,actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),scope jsonb NOT NULL,document jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 CONSTRAINT hdni_draft_commits_pk PRIMARY KEY(workspace_id,draft_id,revision),CONSTRAINT hdni_draft_commits_draft_fk FOREIGN KEY(workspace_id,draft_id) REFERENCES helpdesk_core.hdni_drafts(workspace_id,id),CONSTRAINT hdni_draft_commits_revision_ck CHECK(revision>0)
);
ALTER TABLE helpdesk_core.hdni_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_core.hdni_drafts FORCE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_audit.hdni_draft_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE helpdesk_audit.hdni_draft_commits FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE helpdesk_core.hdni_drafts,helpdesk_audit.hdni_draft_commits FROM PUBLIC,helpdesk_app,helpdesk_resource_publisher,helpdesk_notification_worker;

CREATE FUNCTION helpdesk_auth.hdni_draft(ctx jsonb,target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE d helpdesk_core.hdni_drafts%rowtype;
BEGIN
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);
 -- Covers absent-row inserts and CAS with the same lock. No actor-specific lock key.
 PERFORM pg_advisory_xact_lock(hashtextextended(helpdesk_auth.workspace_id()::text||':draft:'||target::text,0));
 SELECT * INTO d FROM helpdesk_core.hdni_drafts WHERE workspace_id=helpdesk_auth.workspace_id() AND id=target FOR UPDATE;
 IF NOT FOUND THEN PERFORM helpdesk_auth.hdni_lock_scope(ctx);RETURN NULL;END IF;
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);
 IF d.owner_id IS DISTINCT FROM helpdesk_auth.actor_id() OR d.account_id IS DISTINCT FROM (ctx->>'accountId')::uuid OR helpdesk_auth.hdni_refs_key(d.document->'refs') IS DISTINCT FROM helpdesk_auth.hdni_refs_key(ctx->'refs') THEN RAISE EXCEPTION 'Draft denied' USING ERRCODE='HDI03';END IF;
 IF d.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Draft expired' USING ERRCODE='HDI06';END IF;RETURN d.document;
END$$;
CREATE FUNCTION helpdesk_auth.hdni_draft_directory(target uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE d helpdesk_core.hdni_drafts%rowtype;ctx jsonb;
BEGIN
 SELECT * INTO d FROM helpdesk_core.hdni_drafts WHERE workspace_id=helpdesk_auth.workspace_id() AND id=target AND owner_id=helpdesk_auth.actor_id();IF NOT FOUND THEN RETURN NULL;END IF;
 SELECT jsonb_build_object('principalId',helpdesk_auth.actor_id(),'workspaceId',d.workspace_id,'accountId',d.account_id,'bindingId',b.id,'bindingRevision',o.binding_revision,'accessRevision',o.access_revision,'manifestFingerprint',o.manifest_fingerprint,'operation','tickets.read','asOf',helpdesk_auth.hdn_workflow_iso(o.as_of),'expiresAt',helpdesk_auth.hdn_workflow_iso(o.expires_at),'refs',d.document->'refs') INTO ctx
 FROM helpdesk_auth.cg_resource_bindings b JOIN helpdesk_auth.cg_resource_observations o ON (o.workspace_id,o.account_id,o.binding_id,o.principal_id,o.operation)=(b.workspace_id,b.account_id,b.id,d.owner_id,'tickets.read')
 WHERE (b.workspace_id,b.account_id,b.connection_id,b.tenant_id)=(d.workspace_id,d.account_id,(d.document->'refs'->0->>'connectionId')::uuid,d.document->'refs'->0->>'tenantId');
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);IF d.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Draft expired' USING ERRCODE='HDI06';END IF;
 RETURN jsonb_build_object('accountId',d.account_id,'refs',d.document->'refs');
END$$;

-- Published M04 forms use eight scalar types. Saving incomplete ordinary values
-- is allowed; unknown/private/conditional/info answers and unsafe JSON are refused.
CREATE FUNCTION helpdesk_auth.hdni_draft_values(form jsonb,answers jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE f jsonb;v jsonb;out jsonb:='{}';visible boolean;valid boolean;k text;
BEGIN
 IF jsonb_typeof(answers) IS DISTINCT FROM 'object' OR octet_length(answers::text)>262144 THEN RETURN false;END IF;
 FOR k IN SELECT jsonb_object_keys(answers) LOOP IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(form->'fields') x WHERE x->>'key'=k) THEN RETURN false;END IF;END LOOP;
 FOR f IN SELECT value FROM jsonb_array_elements(form->'fields') LOOP k:=f->>'key';v:=answers->k;visible:=f->'public'='true'::jsonb AND (NOT f ? 'when' OR out->(f->'when'->>'field')=f->'when'->'equals');
  IF (NOT coalesce(visible,false) OR f->>'type' IN ('info','download')) AND answers ? k THEN RETURN false;END IF;
  IF NOT coalesce(visible,false) OR v IS NULL OR v='null'::jsonb OR v='""'::jsonb OR v='[]'::jsonb THEN CONTINUE;END IF;
  valid:=false;
  CASE f->>'type'
  WHEN 'text','textarea' THEN valid:=jsonb_typeof(v)='string' AND helpdesk_auth.hdn_cfg_string(v,(f->'config'->>'maxLength')::int) AND length(btrim(v#>>'{}'))>=coalesce((f->'config'->>'minLength')::int,CASE WHEN f->'required'='true'::jsonb THEN 1 ELSE 0 END);
  WHEN 'boolean' THEN valid:=jsonb_typeof(v)='boolean';
  WHEN 'select' THEN valid:=EXISTS(SELECT 1 FROM jsonb_array_elements(f->'config'->'options') x WHERE x->'value'=v);
  WHEN 'lookup' THEN valid:=jsonb_typeof(v)='string' AND helpdesk_auth.hdni_resource_text(v#>>'{}');
  WHEN 'file' THEN valid:=jsonb_typeof(v)='array';IF valid THEN valid:=jsonb_array_length(v)<=(f->'config'->>'maxItems')::int AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(v) x WHERE jsonb_typeof(x) IS DISTINCT FROM 'string' OR x#>>'{}' !~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$') AND (SELECT count(DISTINCT value) FROM jsonb_array_elements(v))=jsonb_array_length(v);END IF;
  WHEN 'info','download' THEN valid:=false;
  ELSE RETURN false;END CASE;
  IF valid THEN out:=out||jsonb_build_object(k,v);END IF;
 END LOOP;PERFORM helpdesk_auth.hdni_canonical(answers);RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;END$$;

CREATE FUNCTION helpdesk_auth.hdni_guard_draft() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Draft deletion denied' USING ERRCODE='23514';END IF;
 IF NEW.owner_id IS DISTINCT FROM helpdesk_auth.actor_id() OR NEW.workspace_id IS DISTINCT FROM helpdesk_auth.workspace_id() OR NOT coalesce(helpdesk_auth.is_human(),false)
 OR NEW.document->>'id' IS DISTINCT FROM NEW.id::text OR NEW.document->>'ownerId' IS DISTINCT FROM NEW.owner_id::text OR NEW.document->>'workspaceId' IS DISTINCT FROM NEW.workspace_id::text OR NEW.document->>'accountId' IS DISTINCT FROM NEW.account_id::text
 OR NEW.document->'revision' IS DISTINCT FROM to_jsonb(NEW.revision) OR NEW.document->'formVersion' IS DISTINCT FROM to_jsonb(NEW.form_version) OR (NEW.document->>'expiresAt')::timestamptz IS DISTINCT FROM NEW.expires_at OR NEW.document->>'status' IS DISTINCT FROM 'editing' OR NEW.document->'ticketId' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'Draft shape denied' USING ERRCODE='23514';END IF;
 IF TG_OP='UPDATE' AND ((NEW.workspace_id,NEW.id,NEW.owner_id,NEW.account_id,NEW.configuration_id,NEW.form_version,NEW.expires_at) IS DISTINCT FROM (OLD.workspace_id,OLD.id,OLD.owner_id,OLD.account_id,OLD.configuration_id,OLD.form_version,OLD.expires_at) OR NEW.revision<>OLD.revision+1 OR NEW.document->'formId' IS DISTINCT FROM OLD.document->'formId' OR NEW.document->'refs' IS DISTINCT FROM OLD.document->'refs' OR NEW.document->'schemaHash' IS DISTINCT FROM OLD.document->'schemaHash') THEN RAISE EXCEPTION 'Draft identity immutable' USING ERRCODE='23514';END IF;
 IF TG_OP='INSERT' AND NEW.revision<>1 THEN RAISE EXCEPTION 'Initial revision denied' USING ERRCODE='23514';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER hdni_draft_identity BEFORE INSERT OR UPDATE OR DELETE ON helpdesk_core.hdni_drafts FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdni_guard_draft();
CREATE FUNCTION helpdesk_auth.hdni_guard_commit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Draft audit immutable' USING ERRCODE='23514';END IF;
 IF NEW.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() OR NEW.workspace_id IS DISTINCT FROM helpdesk_auth.workspace_id() OR NEW.scope->>'operation' IS DISTINCT FROM 'tickets.write' THEN RAISE EXCEPTION 'Draft audit denied' USING ERRCODE='23514';END IF;
 PERFORM helpdesk_auth.hdni_lock_scope(NEW.scope);
 IF NOT EXISTS(SELECT 1 FROM helpdesk_core.hdni_drafts d WHERE (d.workspace_id,d.id,d.revision,d.owner_id,d.document)=(NEW.workspace_id,NEW.draft_id,NEW.revision,NEW.actor_id,NEW.document)) THEN RAISE EXCEPTION 'Draft audit mismatch' USING ERRCODE='23514';END IF;
 RETURN NEW;
END$$;
CREATE TRIGGER hdni_commit_immutable BEFORE INSERT OR UPDATE OR DELETE ON helpdesk_audit.hdni_draft_commits FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdni_guard_commit();
CREATE FUNCTION helpdesk_auth.hdni_require_commit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c helpdesk_audit.hdni_draft_commits%rowtype;
BEGIN
 SELECT * INTO c FROM helpdesk_audit.hdni_draft_commits WHERE (workspace_id,draft_id,revision)=(NEW.workspace_id,NEW.id,NEW.revision);
 IF NOT FOUND OR c.actor_id IS DISTINCT FROM NEW.owner_id OR c.document IS DISTINCT FROM NEW.document THEN RAISE EXCEPTION 'Draft effect incomplete' USING ERRCODE='23514';END IF;
 PERFORM helpdesk_auth.hdni_lock_scope(c.scope);IF NEW.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'Draft expired before commit' USING ERRCODE='HDI06';END IF;RETURN NULL;
END$$;
CREATE CONSTRAINT TRIGGER hdni_draft_effect AFTER INSERT OR UPDATE ON helpdesk_core.hdni_drafts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdni_require_commit();

CREATE FUNCTION helpdesk_auth.hdni_save_draft(ctx jsonb,doc jsonb,expected integer) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $$
DECLARE old jsonb;profile jsonb;form jsonb;conf uuid;target uuid;source text;affected int;expires timestamptz;
BEGIN
 PERFORM helpdesk_auth.hdni_lock_scope(ctx);
 IF ctx->>'operation' IS DISTINCT FROM 'tickets.write' THEN RAISE EXCEPTION 'Write scope denied' USING ERRCODE='HDI01';END IF;
 IF NOT coalesce(helpdesk_auth.hdn_cfg_object(doc,ARRAY['id','ownerId','workspaceId','accountId','refs','formId','formVersion','schemaHash','revision','expiresAt','answers','status','ticketId','sourceHash']),false)
 OR doc->>'ownerId' IS DISTINCT FROM helpdesk_auth.actor_id()::text OR doc->>'workspaceId' IS DISTINCT FROM helpdesk_auth.workspace_id()::text OR doc->>'accountId' IS DISTINCT FROM ctx->>'accountId' OR helpdesk_auth.hdni_refs_key(doc->'refs') IS DISTINCT FROM helpdesk_auth.hdni_refs_key(ctx->'refs')
 OR doc->>'status' IS DISTINCT FROM 'editing' OR doc->'ticketId' IS DISTINCT FROM 'null'::jsonb OR NOT helpdesk_auth.hdn_cfg_int(to_jsonb(expected),0,2147483646) OR doc->'revision' IS DISTINCT FROM to_jsonb(expected+1) OR NOT helpdesk_auth.hdn_cfg_int(doc->'formVersion',1,2147483647) THEN RAISE EXCEPTION 'Invalid draft' USING ERRCODE='HDI04';END IF;
 target:=(doc->>'id')::uuid;expires:=(doc->>'expiresAt')::timestamptz;
 old:=helpdesk_auth.hdni_draft(ctx,target);
 IF old IS NOT NULL AND old->'sourceHash'=doc->'sourceHash' AND old->'revision'=doc->'revision' THEN IF old<>doc THEN RAISE EXCEPTION 'Replay shape changed' USING ERRCODE='HDI02';END IF;RETURN old;END IF;
 IF coalesce((old->>'revision')::int,0)<>expected THEN RAISE EXCEPTION 'Draft revision changed' USING ERRCODE='HDI02';END IF;
 IF expires<=clock_timestamp() OR expires>clock_timestamp()+interval '30 minutes' THEN RAISE EXCEPTION 'Draft expiry invalid' USING ERRCODE='HDI06';END IF;
 profile:=helpdesk_auth.hdni_profile(ctx,(doc->>'formId')::uuid,(doc->>'formVersion')::int);conf:=(profile->'record'->>'id')::uuid;
 SELECT e->'form' INTO form FROM jsonb_array_elements(profile->'record'->'artifacts'->'entries') e WHERE e->'form'->>'id'=doc->>'formId';
 source:=helpdesk_auth.hdni_digest(jsonb_build_object('id',doc->'id','accountId',doc->'accountId','refsKey',helpdesk_auth.hdni_refs_key(doc->'refs'),'formId',doc->'formId','formVersion',doc->'formVersion','answers',doc->'answers'));
 IF doc->>'sourceHash' IS DISTINCT FROM source OR doc->>'schemaHash' IS DISTINCT FROM helpdesk_auth.hdni_digest(form) OR NOT coalesce(helpdesk_auth.hdni_draft_values(form,doc->'answers'),false) THEN RAISE EXCEPTION 'Draft values changed' USING ERRCODE='HDI04';END IF;
 IF old IS NULL THEN INSERT INTO helpdesk_core.hdni_drafts(workspace_id,id,owner_id,account_id,configuration_id,form_version,revision,expires_at,document) VALUES(helpdesk_auth.workspace_id(),target,helpdesk_auth.actor_id(),(ctx->>'accountId')::uuid,conf,(doc->>'formVersion')::int,expected+1,expires,doc);
 ELSE UPDATE helpdesk_core.hdni_drafts SET revision=expected+1,document=doc WHERE workspace_id=helpdesk_auth.workspace_id() AND id=target AND revision=expected;END IF;
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Draft write suppressed' USING ERRCODE='HDI08';END IF;
 INSERT INTO helpdesk_audit.hdni_draft_commits(workspace_id,draft_id,revision,actor_id,scope,document) VALUES(helpdesk_auth.workspace_id(),target,expected+1,helpdesk_auth.actor_id(),ctx,doc);
 GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Draft audit suppressed' USING ERRCODE='HDI08';END IF;
 RETURN helpdesk_auth.hdni_draft(ctx,target);
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow THEN RAISE EXCEPTION 'Invalid draft' USING ERRCODE='HDI04';
END$$;

DO $m09b_acl$
DECLARE r text;obj record;
BEGIN
 FOR obj IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='helpdesk_auth' AND p.proname LIKE 'hdni\_%' ESCAPE '\' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,helpdesk_app,helpdesk_resource_publisher,helpdesk_notification_worker',obj.signature);
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',obj.signature,r);END IF;END LOOP;
 END LOOP;
 FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','helpdesk_maintenance'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON TABLE helpdesk_core.hdni_drafts,helpdesk_audit.hdni_draft_commits FROM %I',r);END IF;END LOOP;
END $m09b_acl$;
GRANT EXECUTE ON FUNCTION helpdesk_auth.hdni_lock_scope(jsonb),helpdesk_auth.hdni_profile(jsonb,uuid,integer),helpdesk_auth.hdni_catalog(jsonb,text),helpdesk_auth.hdni_draft(jsonb,uuid),helpdesk_auth.hdni_draft_directory(uuid),helpdesk_auth.hdni_save_draft(jsonb,jsonb,integer) TO helpdesk_app;

DO $m05_final$
DECLARE role_name text;role_oid oid;role_row record;ns record;obj record;allowed boolean;
BEGIN
 FOREACH role_name IN ARRAY ARRAY['helpdesk_resource_publisher','helpdesk_notification_worker'] LOOP
  SELECT * INTO role_row FROM pg_roles WHERE rolname=role_name;IF NOT FOUND THEN RAISE EXCEPTION 'Service boundary unavailable' USING ERRCODE='HDU06';END IF;role_oid:=role_row.oid;
  IF role_row.rolsuper OR role_row.rolbypassrls OR role_row.rolcreaterole OR role_row.rolcreatedb OR role_row.rolreplication OR role_row.rolinherit OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=role_oid OR roleid=role_oid) THEN RAISE EXCEPTION 'Service boundary unsafe' USING ERRCODE='HDU06';END IF;
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
DO $m09b_final$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE n.nspname='helpdesk_auth' AND p.proname LIKE 'hdni\_%' ESCAPE '\' AND (a.grantee NOT IN (p.proowner,'helpdesk_app'::regrole) OR a.is_grantable AND a.grantee<>p.proowner)) THEN RAISE EXCEPTION 'Unsafe intake ACL' USING ERRCODE='HDU06';END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('helpdesk_core','helpdesk_audit') AND c.relname IN ('hdni_drafts','hdni_draft_commits') AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR has_table_privilege('helpdesk_app',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') OR has_any_column_privilege('helpdesk_app',c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))) THEN RAISE EXCEPTION 'Unsafe intake tables' USING ERRCODE='HDU06';END IF;
END $m09b_final$;
CREATE OR REPLACE FUNCTION helpdesk_auth.schema_version() RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT '0.22.0'::text$$;
COMMIT;
