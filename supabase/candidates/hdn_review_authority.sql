-- Private immutable policy histories. No normal request can publish authority.
CREATE FUNCTION helpdesk_auth.hdnr_valid_policy(d jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT coalesce(helpdesk_auth.hdn_cfg_object(d,ARRAY['versionId','status','selfApprovalAllowed','sensitive','onApproved','onRejected','challengeTtlSeconds'])
  AND jsonb_typeof(d->'versionId')='string' AND d->>'versionId'~'^[A-Za-z0-9_-]{1,100}$'
  AND d->>'status'='published' AND d->'selfApprovalAllowed'='false'::jsonb AND d->'sensitive'='true'::jsonb
  AND d->>'onApproved'='open' AND d->>'onRejected'='waiting_customer' AND d->'challengeTtlSeconds'='300'::jsonb,false)
$$;
CREATE TABLE helpdesk_core.hdnr_policies(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,version_id text NOT NULL,document jsonb NOT NULL,
 sha256 text NOT NULL CHECK(sha256~'^[a-f0-9]{64}$'),request_id uuid NOT NULL,reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 1000),
 recorded_by name NOT NULL DEFAULT session_user,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,account_id,version_id),UNIQUE(workspace_id,request_id),
 FOREIGN KEY(workspace_id,account_id) REFERENCES helpdesk_core.accounts(workspace_id,id),
 CHECK(helpdesk_auth.hdnr_valid_policy(document) AND document->>'versionId'=version_id AND sha256=helpdesk_auth.hdni_digest(document)),CHECK(isfinite(recorded_at)));
CREATE TABLE helpdesk_core.hdnr_profiles(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,profile_version_id text NOT NULL,
 configuration_id uuid NOT NULL,configuration_version integer NOT NULL CHECK(configuration_version>=2),configuration_hash text NOT NULL CHECK(configuration_hash~'^[a-f0-9]{64}$'),
 form_id uuid NOT NULL,form_version integer NOT NULL CHECK(form_version=configuration_version),schema_hash text NOT NULL CHECK(schema_hash~'^[a-f0-9]{64}$'),
 policy_version_id text NOT NULL,required_for uuid[] NOT NULL,work_ids text[] NOT NULL,
 request_id uuid NOT NULL,reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 1000),recorded_by name NOT NULL DEFAULT session_user,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,account_id,profile_version_id),UNIQUE(workspace_id,account_id,form_id,form_version),UNIQUE(workspace_id,request_id),
 FOREIGN KEY(workspace_id,account_id,policy_version_id) REFERENCES helpdesk_core.hdnr_policies(workspace_id,account_id,version_id),
 FOREIGN KEY(workspace_id,configuration_id,configuration_version) REFERENCES helpdesk_core.hdn_cfg_versions(workspace_id,id,version),
 CHECK(helpdesk_auth.hdn_notification_valid_members(required_for,10)),
 CHECK(cardinality(work_ids) BETWEEN 1 AND 1000 AND array_ndims(work_ids)=1 AND array_lower(work_ids,1)=1 AND array_position(work_ids,NULL) IS NULL),CHECK(isfinite(recorded_at)));
CREATE TABLE helpdesk_auth.hdnr_grants(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,principal_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),
 capability text NOT NULL CHECK(capability IN ('forms.revise','approvals.request','approvals.decide')),revision bigint NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
 active boolean NOT NULL,work_ids text[] NOT NULL,expires_at timestamptz NOT NULL,
 request_id uuid NOT NULL,reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 1000),recorded_by name NOT NULL DEFAULT session_user,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,account_id,principal_id,capability,revision),UNIQUE(workspace_id,request_id),
 FOREIGN KEY(workspace_id,account_id) REFERENCES helpdesk_core.accounts(workspace_id,id),
 CHECK(cardinality(work_ids) BETWEEN 1 AND 1000 AND array_ndims(work_ids)=1 AND array_lower(work_ids,1)=1 AND array_position(work_ids,NULL) IS NULL),
 CHECK(isfinite(expires_at) AND isfinite(recorded_at) AND expires_at>recorded_at));
CREATE TABLE helpdesk_auth.hdnr_rosters(
 workspace_id uuid NOT NULL,account_id uuid NOT NULL,profile_version_id text NOT NULL,revision bigint NOT NULL CHECK(revision BETWEEN 1 AND 9007199254740991),
 approver_id uuid NOT NULL REFERENCES helpdesk_auth.principals(id),active boolean NOT NULL,work_ids text[] NOT NULL,expires_at timestamptz NOT NULL,
 request_id uuid NOT NULL,reason text NOT NULL CHECK(length(reason) BETWEEN 3 AND 1000),recorded_by name NOT NULL DEFAULT session_user,recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(workspace_id,account_id,profile_version_id,revision),UNIQUE(workspace_id,request_id),
 FOREIGN KEY(workspace_id,account_id,profile_version_id) REFERENCES helpdesk_core.hdnr_profiles(workspace_id,account_id,profile_version_id),
 CHECK(cardinality(work_ids) BETWEEN 1 AND 1000 AND array_ndims(work_ids)=1 AND array_lower(work_ids,1)=1 AND array_position(work_ids,NULL) IS NULL),
 CHECK(isfinite(expires_at) AND isfinite(recorded_at) AND expires_at>recorded_at));

-- An operator cannot silently reinterpret a profile already used by a ticket.
CREATE FUNCTION helpdesk_auth.hdnr_profile_pin() RETURNS trigger LANGUAGE plpgsql VOLATILE SET search_path='' AS $$
DECLARE cfg helpdesk_core.hdn_cfg_versions%rowtype;entry jsonb;BEGIN
 PERFORM helpdesk_auth.cg_local_operator();
 SELECT * INTO STRICT cfg FROM helpdesk_core.hdn_cfg_versions WHERE (workspace_id,id,version)=(NEW.workspace_id,NEW.configuration_id,NEW.configuration_version) FOR SHARE;
 IF cfg.status<>'published' OR cfg.content_hash<>NEW.configuration_hash THEN RAISE EXCEPTION 'Published review configuration changed' USING ERRCODE='HDR02';END IF;
 SELECT e INTO STRICT entry FROM jsonb_array_elements(cfg.artifacts->'entries') e WHERE e->'form'->>'id'=NEW.form_id::text AND e->'form'->'version'=to_jsonb(NEW.form_version);
 IF entry->'workflow'->>'versionId'<>NEW.profile_version_id OR helpdesk_auth.hdni_digest(entry->'form')<>NEW.schema_hash
  OR EXISTS(SELECT 1 FROM helpdesk_core.hdn_workflow_state WHERE workspace_id=NEW.workspace_id AND account_id=NEW.account_id AND profile_version_id=NEW.profile_version_id)
 THEN RAISE EXCEPTION 'New review profile must precede its first ticket' USING ERRCODE='HDR02';END IF;
 RETURN NEW;
EXCEPTION WHEN no_data_found OR too_many_rows THEN RAISE EXCEPTION 'Published review form unavailable' USING ERRCODE='HDR03';END$$;
CREATE TRIGGER hdnr_profile_pin BEFORE INSERT ON helpdesk_core.hdnr_profiles FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdnr_profile_pin();
DO $private$ DECLARE obj text;role_name text;BEGIN
 FOREACH obj IN ARRAY ARRAY['helpdesk_core.hdnr_policies','helpdesk_core.hdnr_profiles','helpdesk_auth.hdnr_grants','helpdesk_auth.hdnr_rosters'] LOOP
  EXECUTE 'ALTER TABLE '||obj||' ENABLE ROW LEVEL SECURITY';EXECUTE 'ALTER TABLE '||obj||' FORCE ROW LEVEL SECURITY';
  EXECUTE 'CREATE TRIGGER hdnr_history_immutable BEFORE UPDATE OR DELETE ON '||obj||' FOR EACH ROW EXECUTE FUNCTION helpdesk_auth.hdn_notification_immutable()';
  EXECUTE 'REVOKE ALL ON TABLE '||obj||' FROM PUBLIC';
  FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
   IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON TABLE %s FROM %I',obj,role_name);END IF;
  END LOOP;
 END LOOP;
 REVOKE ALL ON FUNCTION helpdesk_auth.hdnr_valid_policy(jsonb),helpdesk_auth.hdnr_profile_pin() FROM PUBLIC;
 FOREACH role_name IN ARRAY ARRAY['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'] LOOP
  IF EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=role_name) THEN EXECUTE format('REVOKE ALL ON FUNCTION helpdesk_auth.hdnr_valid_policy(jsonb),helpdesk_auth.hdnr_profile_pin() FROM %I',role_name);END IF;
 END LOOP;
END $private$;
