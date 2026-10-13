-- M04 candidate only: owned disposable PG17 after the M02 candidate.
DO $guard$ BEGIN
 IF current_database()<>'helpdesk_test' OR current_setting('app.hdn_configuration_candidate',true) IS DISTINCT FROM 'disposable-pg17'
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper)
 OR to_regprocedure('helpdesk_auth.hdn_workflow_digest(jsonb)') IS NULL THEN RAISE EXCEPTION 'Owned PG17 M02 required' USING ERRCODE='42501';END IF;
END $guard$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_object(d jsonb,keys text[],optional text[] DEFAULT '{}') RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT coalesce(jsonb_typeof(d)='object' AND d ?& keys AND d-(keys||optional)='{}'::jsonb,false)$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_text(d jsonb,maxlen int) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT coalesce(jsonb_typeof(d)='string' AND length(btrim(d#>>'{}'))>0 AND length(d#>>'{}')<=maxlen AND translate(d#>>'{}',E'\n\r\t','') !~ '[[:cntrl:]]',false)$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_int(d jsonb,lo bigint,hi bigint) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$BEGIN RETURN coalesce(jsonb_typeof(d)='number' AND d::text ~ '^(0|[1-9][0-9]*)$' AND d::text::numeric BETWEEN lo AND hi,false);EXCEPTION WHEN OTHERS THEN RETURN false;END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_date(d jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$BEGIN RETURN coalesce(jsonb_typeof(d)='string' AND d#>>'{}' ~ '^(?!0000)[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND (d#>>'{}')::date::text=d#>>'{}',false);EXCEPTION WHEN OTHERS THEN RETURN false;END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_form_id(id uuid,action text,priority text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$DECLARE h text:=encode(sha256(convert_to(id::text||':'||action||':'||priority,'UTF8')),'hex');BEGIN RETURN substr(h,1,8)||'-'||substr(h,9,4)||'-4'||substr(h,14,3)||'-8'||substr(h,18,3)||'-'||substr(h,21,12);END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_valid_form(d jsonb,registry jsonb DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE f jsonb;c jsonb;opt jsonb;w jsonb;prior jsonb;seen jsonb:='{}';code text;opts text[];kind text;
BEGIN
 IF NOT helpdesk_auth.hdn_cfg_object(d,ARRAY['id','version','status','title','fields']) OR NOT helpdesk_auth.hdn_cfg_text(d->'title',200)
 OR d->>'status' IS DISTINCT FROM 'draft' OR jsonb_typeof(d->'fields')<>'array' OR jsonb_array_length(d->'fields') NOT BETWEEN 1 AND 100 THEN RETURN false;END IF;
 FOR f IN SELECT value FROM jsonb_array_elements(d->'fields') LOOP
  IF NOT helpdesk_auth.hdn_cfg_object(f,ARRAY['key','type','label','required','public','config'],ARRAY['when']) OR NOT helpdesk_auth.hdn_cfg_text(f->'label',160)
  OR jsonb_typeof(f->'key')<>'string' OR f->>'key' !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$' OR f->>'key'=ANY(ARRAY['__proto__','constructor','prototype']) OR seen ? (f->>'key')
  OR jsonb_typeof(f->'required')<>'boolean' OR jsonb_typeof(f->'public')<>'boolean' OR jsonb_typeof(f->'type')<>'string' THEN RETURN false;END IF;
  c:=f->'config';kind:=f->>'type';
  IF kind IN ('text','textarea') THEN
   IF NOT helpdesk_auth.hdn_cfg_object(c,ARRAY['maxLength'],ARRAY['minLength']) OR NOT helpdesk_auth.hdn_cfg_int(c->'maxLength',1,12000) OR c ? 'minLength' AND NOT helpdesk_auth.hdn_cfg_int(c->'minLength',0,(c->>'maxLength')::int) THEN RETURN false;END IF;
  ELSIF kind='boolean' THEN IF c<>'{}'::jsonb THEN RETURN false;END IF;
  ELSIF kind='select' THEN
   IF NOT helpdesk_auth.hdn_cfg_object(c,ARRAY['options']) OR jsonb_typeof(c->'options')<>'array' OR jsonb_array_length(c->'options') NOT BETWEEN 1 AND 100 THEN RETURN false;END IF;opts:='{}';
   FOR opt IN SELECT value FROM jsonb_array_elements(c->'options') LOOP code:=opt->>'value';IF NOT helpdesk_auth.hdn_cfg_object(opt,ARRAY['value','label']) OR jsonb_typeof(opt->'value')<>'string' OR code !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$' OR code=ANY(ARRAY['__proto__','constructor','prototype']) OR code=ANY(opts) OR NOT helpdesk_auth.hdn_cfg_text(opt->'label',160) THEN RETURN false;END IF;opts:=array_append(opts,code);END LOOP;
  ELSIF kind IN ('lookup','download') THEN
   code:=CASE WHEN kind='lookup' THEN 'resolver' ELSE 'resource' END;
   IF NOT helpdesk_auth.hdn_cfg_object(c,ARRAY[code]) OR jsonb_typeof(c->code)<>'string' OR c->>code !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$' OR c->>code=ANY(ARRAY['__proto__','constructor','prototype']) OR kind='download' AND f->'required'<>'false'::jsonb THEN RETURN false;END IF;
  ELSIF kind='file' THEN IF NOT helpdesk_auth.hdn_cfg_object(c,ARRAY['maxItems']) OR NOT helpdesk_auth.hdn_cfg_int(c->'maxItems',1,10) THEN RETURN false;END IF;
  ELSIF kind='info' THEN IF NOT helpdesk_auth.hdn_cfg_object(c,ARRAY['text']) OR NOT helpdesk_auth.hdn_cfg_text(c->'text',4000) OR f->'required'<>'false'::jsonb THEN RETURN false;END IF;
  ELSE RETURN false;END IF;
  IF f ? 'when' THEN w:=f->'when';prior:=seen->(w->>'field');IF NOT helpdesk_auth.hdn_cfg_object(w,ARRAY['field','equals']) OR prior IS NULL OR prior ? 'when' OR prior->>'type' NOT IN ('text','select','boolean') OR f->'public'='true'::jsonb AND prior->'public'<>'true'::jsonb THEN RETURN false;END IF;
   IF prior->>'type'='boolean' THEN IF jsonb_typeof(w->'equals')<>'boolean' THEN RETURN false;END IF;ELSE IF jsonb_typeof(w->'equals')<>'string' THEN RETURN false;END IF;END IF;
   IF prior->>'type'='select' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(prior->'config'->'options') o WHERE o->'value'=w->'equals') THEN RETURN false;END IF;
  END IF;
  IF registry IS NOT NULL THEN
   IF NOT registry->'types' ? kind OR kind='lookup' AND NOT registry->'lookups' ? (c->>'resolver') OR kind='download' AND NOT registry->'downloads' ? (c->>'resource') OR kind='file' AND registry->'files'<>'true'::jsonb THEN RETURN false;END IF;
  END IF;
  seen:=seen||jsonb_build_object(f->>'key',f);
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_valid_definition(d jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE c jsonb;e jsonb;f jsonb;ch jsonb;actions text[];priorities text[];i int:=0;id text;h jsonb;holiday date;
BEGIN
 IF NOT helpdesk_auth.hdn_cfg_object(d,ARRAY['schema','product','id','version','service','title','calendar','entries']) OR d->'schema' IS DISTINCT FROM '1'::jsonb OR d->>'product' IS DISTINCT FROM 'CONSULTE_GEO' OR jsonb_typeof(d->'id') IS DISTINCT FROM 'string' OR d->>'id' IS DISTINCT FROM (d->>'id')::uuid::text OR NOT helpdesk_auth.hdn_cfg_int(d->'version',1,2147483647) OR NOT helpdesk_auth.hdn_cfg_text(d->'title',200) THEN RETURN false;END IF;
 CASE d->>'service' WHEN 'user_access' THEN actions:=ARRAY['include','change','disable','resend_access','grant_work_access'];priorities:=ARRAY['normal','normal','normal','normal','normal'];
 WHEN 'problem' THEN actions:=ARRAY['request','request','request','request'];priorities:=ARRAY['urgent','high','normal','low'];
 WHEN 'questions','backup','new_work','structure_adjustment' THEN actions:=ARRAY['request'];priorities:=ARRAY['normal'];ELSE RETURN false;END CASE;
 c:=d->'calendar';IF NOT helpdesk_auth.hdn_cfg_object(c,ARRAY['startDate','endDate','holidays']) OR NOT helpdesk_auth.hdn_cfg_date(c->'startDate') OR NOT helpdesk_auth.hdn_cfg_date(c->'endDate') OR (c->>'endDate')::date-(c->>'startDate')::date NOT BETWEEN 1 AND 366 OR jsonb_typeof(c->'holidays')<>'array' OR jsonb_array_length(c->'holidays')>366 THEN RETURN false;END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(c->'holidays'))<>(SELECT count(DISTINCT value) FROM jsonb_array_elements(c->'holidays')) THEN RETURN false;END IF;
 FOR h IN SELECT value FROM jsonb_array_elements(c->'holidays') LOOP IF NOT helpdesk_auth.hdn_cfg_date(h) THEN RETURN false;END IF;holiday:=(h#>>'{}')::date;IF holiday<(c->>'startDate')::date OR holiday>=(c->>'endDate')::date THEN RETURN false;END IF;END LOOP;
 IF jsonb_typeof(d->'entries')<>'array' OR jsonb_array_length(d->'entries')<>cardinality(actions) THEN RETURN false;END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(d->'entries') LOOP i:=i+1;
  IF NOT helpdesk_auth.hdn_cfg_object(e,ARRAY['action','priority','form','checklist','reopenDays','firstResponseHours','resolutionHours']) OR e->>'action' IS DISTINCT FROM actions[i] OR e->>'priority' IS DISTINCT FROM priorities[i] OR NOT helpdesk_auth.hdn_cfg_int(e->'reopenDays',0,30) OR NOT helpdesk_auth.hdn_cfg_int(e->'firstResponseHours',1,2000) OR NOT helpdesk_auth.hdn_cfg_int(e->'resolutionHours',1,2000) OR (e->>'firstResponseHours')::int>(e->>'resolutionHours')::int THEN RETURN false;END IF;
  f:=e->'form';ch:=e->'checklist';id:=helpdesk_auth.hdn_cfg_form_id((d->>'id')::uuid,actions[i],priorities[i]);
  IF NOT helpdesk_auth.hdn_cfg_valid_form(f) OR f->>'id' IS DISTINCT FROM id OR f->'version' IS DISTINCT FROM d->'version' OR ch->>'id' IS DISTINCT FROM 'cg-exec-'||id OR ch->'version' IS DISTINCT FROM d->'version' OR ch->>'status' IS DISTINCT FROM 'draft' OR NOT helpdesk_auth.hdn_valid_execution_template(ch||'{"status":"published"}'::jsonb) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(ch->'items') x WHERE x->'required'='true'::jsonb AND x->'evidenceRequired'='true'::jsonb) THEN RETURN false;END IF;
  IF d->>'service' IN ('new_work','structure_adjustment') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'fields') x WHERE x->>'type'='file' AND x->'required'='true'::jsonb AND x->'public'='true'::jsonb AND NOT x ? 'when') THEN RETURN false;END IF;
 END LOOP;RETURN true;
EXCEPTION WHEN OTHERS THEN RETURN false;END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_compile(d jsonb,registry jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE e jsonb;ch jsonb;entries jsonb:='[]';calendar jsonb;intervals jsonb;v text:='cg_'||replace(d->>'id','-','_')||'_'||(d->>'version');ref jsonb;start date:=(d->'calendar'->>'startDate')::date;finish date:=(d->'calendar'->>'endDate')::date;
BEGIN
 IF NOT helpdesk_auth.hdn_cfg_valid_definition(d) OR NOT helpdesk_auth.hdn_cfg_object(registry,ARRAY['types','lookups','files','downloads']) OR jsonb_typeof(registry->'types')<>'array' OR jsonb_typeof(registry->'lookups')<>'array' OR jsonb_typeof(registry->'downloads')<>'array' OR jsonb_typeof(registry->'files')<>'boolean' THEN RAISE EXCEPTION 'Configuration not publishable' USING ERRCODE='HDC05';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_array(helpdesk_auth.hdn_workflow_iso((day+time '08:00') AT TIME ZONE 'America/Sao_Paulo'),helpdesk_auth.hdn_workflow_iso((day+time '18:00') AT TIME ZONE 'America/Sao_Paulo')) ORDER BY day),'[]') INTO intervals FROM (SELECT start+n AS day FROM generate_series(0,finish-start-1) n) days WHERE extract(isodow FROM day) BETWEEN 1 AND 5 AND NOT d->'calendar'->'holidays' ? day::text;
 calendar:=jsonb_build_object('versionId',v,'timeZone','America/Sao_Paulo','from',helpdesk_auth.hdn_workflow_iso(start::timestamp AT TIME ZONE 'America/Sao_Paulo'),'until',helpdesk_auth.hdn_workflow_iso(finish::timestamp AT TIME ZONE 'America/Sao_Paulo'),'intervals',intervals);
 FOR e IN SELECT value FROM jsonb_array_elements(d->'entries') LOOP
  IF NOT helpdesk_auth.hdn_cfg_valid_form(e->'form',registry) THEN RAISE EXCEPTION 'Handler not qualified' USING ERRCODE='HDC05';END IF;
  ch:=e->'checklist'||'{"status":"published"}'::jsonb;ref:=jsonb_build_object('id',ch->'id','version',ch->'version','sha256',helpdesk_auth.hdn_workflow_digest(ch));
  entries:=entries||jsonb_build_array(jsonb_build_object('action',e->'action','priority',e->'priority','form',e->'form'||'{"status":"published"}'::jsonb,'checklist',ch,'workflow',jsonb_build_object('versionId','cg-wf-'||(e->'form'->>'id')||'-v'||(d->>'version'),'status','published','reopenWindowMicros',((e->>'reopenDays')::bigint*86400000000)::text,'executionChecklist',ref),'sla',jsonb_build_object('firstResponseMicros',((e->>'firstResponseHours')::bigint*3600000000)::text,'resolutionMicros',((e->>'resolutionHours')::bigint*3600000000)::text,'calendarVersionId',v,'pauseSolutionStates',jsonb_build_array('waiting_customer'))));
 END LOOP;
 RETURN jsonb_build_object('calendar',calendar,'entries',entries,'attachmentsPolicy',CASE WHEN d->>'service' IN ('new_work','structure_adjustment') THEN '{"extensions":[".xlsx",".csv"],"mimeTypes":["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","text/csv"],"maxBytes":15728640}'::jsonb ELSE 'null'::jsonb END);
END$$;
CREATE TABLE helpdesk_auth.hdn_cfg_capabilities(id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES helpdesk_core.workspaces(id),principal_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),capability text NOT NULL CHECK(capability IN ('forms.read','forms.write','forms.publish')),revision int NOT NULL CHECK(revision>0),reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 2000),policy_ref text NOT NULL CHECK(length(btrim(policy_ref)) BETWEEN 1 AND 160),approved_by uuid NOT NULL REFERENCES helpdesk_auth.principals(id),expires_at timestamptz,active boolean NOT NULL,UNIQUE(workspace_id,principal_id,capability),CHECK(approved_by<>principal_id));
CREATE TABLE helpdesk_auth.hdn_cfg_registries(workspace_id uuid PRIMARY KEY REFERENCES helpdesk_core.workspaces(id),revision int NOT NULL CHECK(revision>0),document jsonb NOT NULL);
CREATE TABLE helpdesk_core.hdn_cfg_catalog(workspace_id uuid PRIMARY KEY REFERENCES helpdesk_core.workspaces(id),revision int NOT NULL DEFAULT 1 CHECK(revision>0));
CREATE TABLE helpdesk_core.hdn_cfg_versions(workspace_id uuid NOT NULL REFERENCES helpdesk_core.workspaces(id),id uuid NOT NULL,version int NOT NULL CHECK(version>0),revision int NOT NULL CHECK(revision>0),status text NOT NULL CHECK(status IN ('draft','published')),definition jsonb NOT NULL CHECK(helpdesk_auth.hdn_cfg_valid_definition(definition)),content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),artifacts jsonb,created_by uuid NOT NULL REFERENCES helpdesk_auth.principals(id),created_at timestamptz NOT NULL,published_by uuid REFERENCES helpdesk_auth.principals(id),published_at timestamptz,PRIMARY KEY(workspace_id,id,version),CHECK(definition->>'id'=id::text AND definition->'version'=to_jsonb(version)),CHECK((status='draft' AND artifacts IS NULL AND published_by IS NULL AND published_at IS NULL) OR (status='published' AND artifacts IS NOT NULL AND published_by IS NOT NULL AND published_at>=created_at)),CHECK(content_hash=helpdesk_auth.hdn_workflow_digest(jsonb_build_object('definition',definition,'artifacts',artifacts))));
CREATE TABLE helpdesk_audit.hdn_cfg_commits(workspace_id uuid NOT NULL REFERENCES helpdesk_core.workspaces(id),id uuid NOT NULL,actor_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),intent_key text NOT NULL,intent_hash text NOT NULL,command jsonb NOT NULL,result jsonb NOT NULL,at timestamptz NOT NULL,transaction_id xid8 NOT NULL DEFAULT pg_current_xact_id(),PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,actor_id,intent_key));
CREATE FUNCTION helpdesk_auth.hdn_cfg_authorize(cap text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();
BEGIN
 PERFORM 1 FROM helpdesk_auth.principals WHERE id=who AND active AND kind='human' FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Publisher not authorized' USING ERRCODE='HDC01';END IF;
 PERFORM 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=who AND active AND role='admin' FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Publisher not authorized' USING ERRCODE='HDC01';END IF;
 PERFORM 1 FROM helpdesk_auth.hdn_cfg_capabilities WHERE workspace_id=w AND principal_id=who AND active AND (expires_at IS NULL OR expires_at>clock_timestamp()) AND (cap IS NULL OR capability=cap) ORDER BY capability FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Capability unavailable' USING ERRCODE='HDC01';END IF;
END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_workspace() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();grants jsonb;
BEGIN PERFORM helpdesk_auth.hdn_cfg_authorize();
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'workspaceId',workspace_id,'principalId',principal_id,'capability',capability,'revision',revision,'reason',reason,'policyRef',policy_ref,'approvedBy',approved_by,'expiresAt',CASE WHEN expires_at IS NULL THEN NULL ELSE helpdesk_auth.hdn_workflow_iso(expires_at) END,'active',active) ORDER BY capability),'[]') INTO grants FROM helpdesk_auth.hdn_cfg_capabilities WHERE workspace_id=w AND principal_id=who;
 RETURN jsonb_build_object('workspaceId',w,'revision',1,'members',jsonb_build_array(jsonb_build_object('principalId',who,'principalKind','human','role','admin','status','active','revision',1,'expiresAt',NULL)),'capabilityGrants',grants);END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_record(v helpdesk_core.hdn_cfg_versions) RETURNS jsonb LANGUAGE sql STABLE SET search_path='' AS $$SELECT jsonb_build_object('workspaceId',($1).workspace_id,'id',($1).id,'version',($1).version,'revision',($1).revision,'status',($1).status,'definition',($1).definition,'contentHash',($1).content_hash,'artifacts',($1).artifacts,'createdBy',($1).created_by,'createdAt',helpdesk_auth.hdn_workflow_iso(($1).created_at),'publishedBy',($1).published_by,'publishedAt',CASE WHEN ($1).published_at IS NULL THEN NULL ELSE helpdesk_auth.hdn_workflow_iso(($1).published_at) END)$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_state() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE w uuid:=helpdesk_auth.workspace_id();r int;records jsonb;BEGIN PERFORM helpdesk_auth.hdn_cfg_authorize();SELECT revision INTO r FROM helpdesk_core.hdn_cfg_catalog WHERE workspace_id=w FOR UPDATE;IF NOT FOUND OR (SELECT count(*) FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w)>500 THEN RAISE EXCEPTION 'Catalog unavailable' USING ERRCODE='HDC08';END IF;SELECT coalesce(jsonb_agg(helpdesk_auth.hdn_cfg_record(v) ORDER BY id,version),'[]') INTO records FROM helpdesk_core.hdn_cfg_versions v WHERE workspace_id=w;RETURN jsonb_build_object('workspaceId',w,'revision',r,'records',records);END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_registry() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE d jsonb;BEGIN PERFORM helpdesk_auth.hdn_cfg_authorize('forms.publish');SELECT document INTO d FROM helpdesk_auth.hdn_cfg_registries WHERE workspace_id=helpdesk_auth.workspace_id() FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Registry unavailable' USING ERRCODE='HDC05';END IF;RETURN d;END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_receipt(key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$DECLARE r helpdesk_audit.hdn_cfg_commits;BEGIN PERFORM helpdesk_auth.hdn_cfg_authorize();SELECT * INTO r FROM helpdesk_audit.hdn_cfg_commits WHERE workspace_id=helpdesk_auth.workspace_id() AND actor_id=helpdesk_auth.actor_id() AND intent_key=key;IF NOT FOUND THEN RETURN NULL;END IF;PERFORM helpdesk_auth.hdn_cfg_authorize(CASE WHEN r.command->>'action'='publish' THEN 'forms.publish' ELSE 'forms.write' END);RETURN jsonb_build_object('key',key,'hash',r.intent_hash,'result',r.result);END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_version_guard() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$BEGIN IF TG_OP='DELETE' OR OLD.status='published' OR (NEW.workspace_id,NEW.id,NEW.version,NEW.created_by,NEW.created_at) IS DISTINCT FROM (OLD.workspace_id,OLD.id,OLD.version,OLD.created_by,OLD.created_at) OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Configuration immutable' USING ERRCODE='23514';END IF;RETURN NEW;END$$;
CREATE TRIGGER hdn_cfg_version_guard BEFORE UPDATE OR DELETE ON helpdesk_core.hdn_cfg_versions FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_cfg_version_guard();
CREATE TRIGGER hdn_cfg_commit_immutable BEFORE UPDATE OR DELETE ON helpdesk_audit.hdn_cfg_commits FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_execution_immutable();
CREATE FUNCTION helpdesk_auth.hdn_cfg_commit(cmd jsonb,key text,hash text,supplied_artifacts jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w uuid:=helpdesk_auth.workspace_id();who uuid:=helpdesk_auth.actor_id();catalog_revision int;old helpdesk_core.hdn_cfg_versions;row helpdesk_core.hdn_cfg_versions;latest int;d jsonb;a jsonb:=NULL;r jsonb;saved helpdesk_audit.hdn_cfg_commits;event uuid:=gen_random_uuid();stamp timestamptz:=clock_timestamp();entry jsonb;action text:=cmd->>'action';target uuid;
BEGIN
 PERFORM helpdesk_auth.hdn_cfg_authorize(CASE WHEN action='publish' THEN 'forms.publish' ELSE 'forms.write' END);
 IF action NOT IN ('save','publish','restore') OR action IS NULL OR NOT helpdesk_auth.hdn_cfg_object(cmd,ARRAY['action','expectedRevision','expectedEntityRevision','reason','id','version']||CASE WHEN action='save' THEN ARRAY['definition'] ELSE ARRAY[]::text[] END) OR NOT helpdesk_auth.hdn_cfg_text(cmd->'reason',2000) OR NOT helpdesk_auth.hdn_cfg_int(cmd->'expectedRevision',1,2147483647) OR NOT helpdesk_auth.hdn_cfg_int(cmd->'expectedEntityRevision',CASE WHEN action='save' THEN 0 ELSE 1 END,2147483647) OR NOT helpdesk_auth.hdn_cfg_int(cmd->'version',1,2147483647) OR key !~ '^[A-Za-z0-9._:-]{16,128}$' OR key IS NULL OR hash IS DISTINCT FROM helpdesk_auth.hdn_workflow_digest(jsonb_build_object('workspaceId',w,'actorId',who,'command',cmd)) THEN RAISE EXCEPTION 'Invalid command' USING ERRCODE='HDC04';END IF;target:=(cmd->>'id')::uuid;
 SELECT revision INTO catalog_revision FROM helpdesk_core.hdn_cfg_catalog WHERE workspace_id=w FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Catalog unavailable' USING ERRCODE='HDC08';END IF;
 SELECT * INTO saved FROM helpdesk_audit.hdn_cfg_commits WHERE workspace_id=w AND actor_id=who AND intent_key=key;
 IF FOUND THEN IF saved.intent_hash<>hash THEN RAISE EXCEPTION 'Idempotency conflict' USING ERRCODE='HDC06';END IF;RETURN saved.result||'{"replayed":true}'::jsonb;END IF;
 IF catalog_revision<>(cmd->>'expectedRevision')::int THEN RAISE EXCEPTION 'Catalog version conflict' USING ERRCODE='HDC02';END IF;
 SELECT * INTO old FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w AND id=target AND version=(cmd->>'version')::int FOR UPDATE;
 SELECT coalesce(max(version),0) INTO latest FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w AND id=target;
 IF coalesce(old.revision,0)<>(cmd->>'expectedEntityRevision')::int THEN RAISE EXCEPTION 'Entity version conflict' USING ERRCODE='HDC02';END IF;
 IF action='save' THEN
  d:=cmd->'definition';IF NOT helpdesk_auth.hdn_cfg_valid_definition(d) OR d->>'id'<>target::text OR d->'version'<>cmd->'version' OR supplied_artifacts IS NOT NULL THEN RAISE EXCEPTION 'Invalid definition' USING ERRCODE='HDC04';END IF;
  IF old.status='published' THEN RAISE EXCEPTION 'Published configuration immutable' USING ERRCODE='HDC03';END IF;
  IF old.id IS NULL AND (cmd->>'version')::int<>latest+1 THEN RAISE EXCEPTION 'Successor required' USING ERRCODE='HDC02';END IF;
  IF EXISTS(SELECT 1 FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w AND id=target AND definition->>'service'<>d->>'service') THEN RAISE EXCEPTION 'Service identity immutable' USING ERRCODE='HDC09';END IF;
 ELSE
  IF old.id IS NULL THEN RAISE EXCEPTION 'Configuration not found' USING ERRCODE='HDC07';END IF;
  IF old.status='published' AND action='publish' THEN RAISE EXCEPTION 'Published configuration immutable' USING ERRCODE='HDC03';END IF;
  d:=old.definition;
  IF action='restore' THEN
   IF old.status<>'published' OR supplied_artifacts IS NOT NULL THEN RAISE EXCEPTION 'Published source required' USING ERRCODE='HDC05';END IF;
   d:=jsonb_set(d,'{version}',to_jsonb(latest+1));SELECT jsonb_agg(jsonb_set(jsonb_set(value,'{form,version}',to_jsonb(latest+1)),'{checklist,version}',to_jsonb(latest+1)) ORDER BY ordinal) INTO entry FROM jsonb_array_elements(d->'entries') WITH ORDINALITY x(value,ordinal);d:=jsonb_set(d,'{entries}',entry);
  ELSE
   a:=helpdesk_auth.hdn_cfg_compile(d,helpdesk_auth.hdn_cfg_registry());IF a IS DISTINCT FROM supplied_artifacts OR (a->'calendar'->>'until')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'Artifacts unqualified or stale' USING ERRCODE='HDC05';END IF;
   FOR entry IN SELECT value FROM jsonb_array_elements(a->'entries') LOOP
    INSERT INTO helpdesk_core.hdn_execution_templates(workspace_id,template_id,version,sha256,document) VALUES(w,entry->'checklist'->>'id',(d->>'version')::int,entry->'workflow'->'executionChecklist'->>'sha256',entry->'checklist');
    INSERT INTO helpdesk_core.hdn_workflow_profiles(workspace_id,version_id,document) VALUES(w,entry->'workflow'->>'versionId',entry->'workflow');
   END LOOP;
  END IF;
 END IF;
 IF old.id IS NULL OR action='restore' THEN
  IF (SELECT count(*) FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w)>=500 THEN RAISE EXCEPTION 'Catalog bound exceeded' USING ERRCODE='HDC08';END IF;
  INSERT INTO helpdesk_core.hdn_cfg_versions VALUES(w,target,(d->>'version')::int,1,'draft',d,helpdesk_auth.hdn_workflow_digest(jsonb_build_object('definition',d,'artifacts',NULL)),NULL,who,stamp,NULL,NULL) RETURNING * INTO row;
 ELSE UPDATE helpdesk_core.hdn_cfg_versions SET revision=revision+1,status=CASE WHEN action='publish' THEN 'published' ELSE 'draft' END,definition=d,artifacts=a,content_hash=helpdesk_auth.hdn_workflow_digest(jsonb_build_object('definition',d,'artifacts',a)),published_by=CASE WHEN action='publish' THEN who ELSE NULL END,published_at=CASE WHEN action='publish' THEN stamp ELSE NULL END WHERE workspace_id=w AND id=target AND version=old.version RETURNING * INTO row;END IF;
 UPDATE helpdesk_core.hdn_cfg_catalog SET revision=revision+1 WHERE workspace_id=w RETURNING revision INTO catalog_revision;
 r:=jsonb_build_object('workspaceId',w,'actorId',who,'revision',catalog_revision,'record',helpdesk_auth.hdn_cfg_record(row),'auditId',event,'replayed',false);
 INSERT INTO helpdesk_audit.hdn_cfg_commits(workspace_id,id,actor_id,intent_key,intent_hash,command,result,at) VALUES(w,event,who,key,hash,cmd,r,stamp);
 RETURN r;
END$$;
CREATE FUNCTION helpdesk_auth.hdn_cfg_final_admission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$BEGIN IF NEW.workspace_id IS DISTINCT FROM helpdesk_auth.workspace_id() OR NEW.actor_id IS DISTINCT FROM helpdesk_auth.actor_id() OR NEW.transaction_id<>pg_current_xact_id() THEN RAISE EXCEPTION 'Publication context changed' USING ERRCODE='HDC01';END IF;PERFORM helpdesk_auth.hdn_cfg_authorize(CASE WHEN NEW.command->>'action'='publish' THEN 'forms.publish' ELSE 'forms.write' END);RETURN NULL;END$$;
CREATE CONSTRAINT TRIGGER hdn_cfg_final_admission AFTER INSERT ON helpdesk_audit.hdn_cfg_commits DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_cfg_final_admission();
DO $security$ DECLARE obj text;r text;BEGIN
 FOREACH obj IN ARRAY ARRAY['helpdesk_auth.hdn_cfg_capabilities','helpdesk_auth.hdn_cfg_registries','helpdesk_core.hdn_cfg_catalog','helpdesk_core.hdn_cfg_versions','helpdesk_audit.hdn_cfg_commits'] LOOP
  EXECUTE 'ALTER TABLE '||obj||' ENABLE ROW LEVEL SECURITY';EXECUTE 'ALTER TABLE '||obj||' FORCE ROW LEVEL SECURITY';EXECUTE 'REVOKE ALL ON TABLE '||obj||' FROM PUBLIC,helpdesk_app';
  FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','authenticator'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I',obj,r);END IF;END LOOP;
 END LOOP;
 FOR obj IN SELECT p.oid::regprocedure::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='helpdesk_auth' AND p.proname LIKE 'hdn_cfg_%' LOOP
  EXECUTE 'REVOKE ALL ON FUNCTION '||obj||' FROM PUBLIC,helpdesk_app';FOREACH r IN ARRAY ARRAY['anon','authenticated','service_role','authenticator'] LOOP IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname=r) THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM %I',obj,r);END IF;END LOOP;
 END LOOP;
END $security$;
GRANT EXECUTE ON FUNCTION helpdesk_auth.hdn_cfg_workspace(),helpdesk_auth.hdn_cfg_state(),helpdesk_auth.hdn_cfg_registry(),helpdesk_auth.hdn_cfg_receipt(text),helpdesk_auth.hdn_cfg_commit(jsonb,text,text,jsonb) TO helpdesk_app;
