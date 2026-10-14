import {canonicalJson,requestHash} from '../domain/canonical.ts';
import type {planConsulteGeoRegistrationOperation} from '../application/consultegeo-registration-operation.ts';
const literal=(v:string)=>"'"+v.replaceAll("'","''")+"'";
/** Private genuine-operator recipe. It creates configuration DATA only, never a
 * helper, ACL, schema marker, human session, MFA claim or new client permission. */
export function buildConsulteGeoRegistrationSql(plan:ReturnType<typeof planConsulteGeoRegistrationOperation>){
 const [json,hash]=plan.values,c=JSON.parse(json);if(canonicalJson(c)!==json||requestHash(c)!==hash||c.purpose!=='consultegeo-registration'||c.assurance!=='operator-delegation')throw Error('Invalid registration plan');
 return `BEGIN;
SET LOCAL lock_timeout='10s';SET LOCAL statement_timeout='60s';SET LOCAL idle_in_transaction_session_timeout='30s';
SELECT helpdesk_auth.cg_local_operator();
DO $registration$ DECLARE c jsonb:=${literal(json)}::jsonb;w uuid:=(c->>'workspaceId')::uuid;sponsor uuid:=(c->>'administratorId')::uuid;cfg jsonb:=c->'configuration';artifact jsonb;entry jsonb;stamp timestamptz;recorded helpdesk_audit.cg_local_receipts%rowtype;initial helpdesk_audit.cg_initial_receipts%rowtype;n int;BEGIN
 IF helpdesk_auth.schema_version()<>'0.24.0' OR c->>'localHash' IS DISTINCT FROM helpdesk_auth.hdni_digest(c->'local') OR cfg->>'contentHash' IS DISTINCT FROM helpdesk_auth.hdn_workflow_digest(jsonb_build_object('definition',cfg->'definition','artifacts',cfg->'artifacts')) OR cfg->'definition'->>'service'<>'user_access' OR cfg->'definition'->>'id' IS DISTINCT FROM c->>'configurationId' OR cfg->>'coverageId' IS DISTINCT FROM c->>'coverageId' OR cfg->'definition'->'version'<>'1'::jsonb OR c->'local'->>'workspaceId' IS DISTINCT FROM w::text OR c->'local'->>'requestId' IS DISTINCT FROM c->>'requestId' OR c->'local'->'expectedRegistryRevision'<>'1'::jsonb THEN RAISE EXCEPTION 'Exact registration plan required' USING ERRCODE='CGR01';END IF;
 IF c->>'approvalHash' IS DISTINCT FROM helpdesk_auth.hdni_digest(c-ARRAY['approvalHash','local','localHash'])
 OR c->'local'->>'reason' IS DISTINCT FROM (c->>'reason')||' Configuração '||(c->>'configurationId')||'/v1 SHA256 '||(cfg->>'contentHash')||' aprovação '||(c->>'approvalHash')
 OR c->'local'->'accounts' IS DISTINCT FROM jsonb_build_array(jsonb_build_object('accountId',c->'accountId','name',c->'accountName','productInstanceId',c->'productInstanceId','connectionId',c->'connectionId','bindingId',c->'bindingId','tenantId',c->'accountId','active',true))
 OR c->'local'->'works' IS DISTINCT FROM jsonb_build_array(jsonb_build_object('accountId',c->'accountId','id',c->'workId','name',c->'workName','active',true))
 OR c->'local'->'permissions' IS DISTINCT FROM (SELECT jsonb_agg(jsonb_build_object('accountId',c->'accountId','principalId',c->'administratorId','role','agent','operation',op,'active',true,'workIds',jsonb_build_array(c->'workId')) ORDER BY ordinal) FROM unnest(ARRAY['tickets.read','tickets.write','notes.read','notes.write']) WITH ORDINALITY q(op,ordinal)) THEN RAISE EXCEPTION 'Publication approval or scope mismatch' USING ERRCODE='CGR01';END IF;
 SELECT * INTO initial FROM helpdesk_audit.cg_initial_receipts WHERE workspace_id=w FOR SHARE;
 IF NOT FOUND OR initial.document->>'assurance'<>'operator-delegation' OR initial.document->>'sponsorId' IS DISTINCT FROM sponsor::text THEN RAISE EXCEPTION 'Initial delegation required' USING ERRCODE='CGR01';END IF;
 PERFORM 1 FROM helpdesk_auth.principals p JOIN helpdesk_auth.workspace_memberships m ON m.principal_id=p.id JOIN auth.users u ON u.id=p.supabase_user_id WHERE p.id=sponsor AND p.active AND p.kind='human' AND m.workspace_id=w AND m.active AND m.role='admin' AND lower(u.email)=c->>'administratorEmail' AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()) FOR SHARE OF p,m;
 IF NOT FOUND THEN RAISE EXCEPTION 'Verified delegating administrator required' USING ERRCODE='CGR01';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('consultegeo-registration:'||w::text,0));
 PERFORM 1 FROM helpdesk_core.hdn_cfg_catalog WHERE workspace_id=w FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Published catalogue required' USING ERRCODE='CGR01';END IF;
 PERFORM 1 FROM helpdesk_auth.hdn_cfg_registries WHERE workspace_id=w AND document=c->'registry' FOR SHARE;IF NOT FOUND THEN RAISE EXCEPTION 'Exact scalar registry required' USING ERRCODE='CGR01';END IF;
 artifact:=helpdesk_auth.hdn_cfg_compile(cfg->'definition',c->'registry');IF artifact IS DISTINCT FROM cfg->'artifacts' THEN RAISE EXCEPTION 'Native compilation mismatch' USING ERRCODE='CGR01';END IF;
 SELECT * INTO recorded FROM helpdesk_audit.cg_local_receipts WHERE workspace_id=w AND request_id=(c->>'requestId')::uuid;
 IF FOUND THEN
  IF recorded.command_hash IS DISTINCT FROM c->>'localHash' OR recorded.reason IS DISTINCT FROM c->'local'->>'reason' OR NOT EXISTS(SELECT 1 FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w AND id=(c->>'configurationId')::uuid AND version=1 AND status='published' AND definition=cfg->'definition' AND artifacts=artifact AND content_hash=cfg->>'contentHash') THEN RAISE EXCEPTION 'Registration replay mismatch' USING ERRCODE='CGR02';END IF;
 ELSE
  PERFORM 1 FROM helpdesk_auth.cg_local_registries WHERE workspace_id=w AND revision=1 FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Initial local revision changed' USING ERRCODE='CGR03';END IF;
  IF (SELECT count(*) FROM helpdesk_auth.cg_local_accounts WHERE workspace_id=w)<>1 OR NOT EXISTS(SELECT 1 FROM helpdesk_auth.cg_local_accounts WHERE workspace_id=w AND account_id=(c->>'accountId')::uuid AND product_instance_id=(c->>'productInstanceId')::uuid AND connection_id=(c->>'connectionId')::uuid AND binding_id=(c->>'bindingId')::uuid AND tenant_id=c->>'accountId' AND name=c->>'accountName' AND active)
  OR (SELECT count(*) FROM helpdesk_auth.cg_local_works WHERE workspace_id=w)<>1 OR NOT EXISTS(SELECT 1 FROM helpdesk_auth.cg_local_works WHERE workspace_id=w AND account_id=(c->>'accountId')::uuid AND id=c->>'workId' AND name=c->>'workName' AND active)
  OR (SELECT count(*) FROM helpdesk_auth.cg_local_permissions WHERE workspace_id=w)<>4 OR (SELECT count(*) FROM helpdesk_auth.cg_local_permissions WHERE workspace_id=w AND account_id=(c->>'accountId')::uuid AND principal_id=sponsor AND role='agent' AND active AND work_ids=ARRAY[c->>'workId'] AND operation IN ('tickets.read','tickets.write','notes.read','notes.write'))<>4
  OR EXISTS(SELECT 1 FROM helpdesk_core.services WHERE workspace_id=w AND code='user_access') OR EXISTS(SELECT 1 FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w AND definition->>'service'='user_access')
  OR NOT EXISTS(SELECT 1 FROM helpdesk_core.contract_versions WHERE workspace_id=w AND id=(c->>'contractVersionId')::uuid AND contract_id=(c->>'contractId')::uuid AND published)
  THEN RAISE EXCEPTION 'Existing target or permissions changed' USING ERRCODE='CGR03';END IF;
  stamp:=clock_timestamp();IF (artifact->'calendar'->>'until')::timestamptz<=stamp THEN RAISE EXCEPTION 'Current calendar required' USING ERRCODE='CGR01';END IF;
  INSERT INTO helpdesk_core.services(workspace_id,product_id,code,name) VALUES(w,(c->>'productId')::uuid,'user_access','Cadastros e acessos');
  INSERT INTO helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) VALUES(w,(c->>'accountId')::uuid,(c->>'productId')::uuid,(c->>'productInstanceId')::uuid,'user_access',(c->>'contractVersionId')::uuid,(c->>'coverageId')::uuid);
  FOR entry IN SELECT value FROM jsonb_array_elements(artifact->'entries') LOOP
   INSERT INTO helpdesk_core.hdn_execution_templates(workspace_id,template_id,version,sha256,document) VALUES(w,entry->'checklist'->>'id',1,entry->'workflow'->'executionChecklist'->>'sha256',entry->'checklist');
   INSERT INTO helpdesk_core.hdn_workflow_profiles(workspace_id,version_id,document) VALUES(w,entry->'workflow'->>'versionId',entry->'workflow');
  END LOOP;
  INSERT INTO helpdesk_core.hdn_cfg_versions VALUES(w,(c->>'configurationId')::uuid,1,1,'published',cfg->'definition',cfg->>'contentHash',artifact,sponsor,stamp,sponsor,stamp);
  UPDATE helpdesk_core.hdn_cfg_catalog SET revision=revision+1 WHERE workspace_id=w;GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Catalogue persistence incomplete' USING ERRCODE='CGR04';END IF;
  -- This receipt records the genuine session_user and the approved configuration
  -- hash in its immutable reason, in the SAME transaction as publication.
  PERFORM helpdesk_auth.cg_local_provision(helpdesk_auth.hdni_canonical(c->'local'),c->>'localHash');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_core.coverages WHERE workspace_id=w AND id=(c->>'coverageId')::uuid AND account_id=(c->>'accountId')::uuid AND product_id=(c->>'productId')::uuid AND product_instance_id=(c->>'productInstanceId')::uuid AND service_code='user_access' AND contract_version_id=(c->>'contractVersionId')::uuid AND enabled)
 OR (SELECT count(*) FROM helpdesk_core.hdn_workflow_profiles WHERE workspace_id=w AND version_id IN (SELECT value->'workflow'->>'versionId' FROM jsonb_array_elements(artifact->'entries')))<>5
 OR (SELECT count(*) FROM helpdesk_core.hdn_execution_templates WHERE workspace_id=w AND template_id IN (SELECT value->'checklist'->>'id' FROM jsonb_array_elements(artifact->'entries')))<>5
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(artifact->'entries') e JOIN helpdesk_core.hdn_workflow_profiles p ON p.workspace_id=w AND p.version_id=e.value->'workflow'->>'versionId' WHERE p.document IS DISTINCT FROM e.value->'workflow')
 OR EXISTS(SELECT 1 FROM jsonb_array_elements(artifact->'entries') e JOIN helpdesk_core.hdn_execution_templates t ON t.workspace_id=w AND t.template_id=e.value->'checklist'->>'id' WHERE t.version<>1 OR t.document IS DISTINCT FROM e.value->'checklist' OR t.sha256 IS DISTINCT FROM e.value->'workflow'->'executionChecklist'->>'sha256')
 OR NOT EXISTS(SELECT 1 FROM helpdesk_audit.cg_local_receipts WHERE workspace_id=w AND request_id=(c->>'requestId')::uuid AND command_hash=c->>'localHash' AND reason=c->'local'->>'reason') THEN RAISE EXCEPTION 'Published registration incomplete' USING ERRCODE='CGR04';END IF;
END $registration$;
COMMIT;
SELECT 'operator-delegation' AS assurance,recorded_by,request_id,command_hash,registry_revision,recorded_at FROM helpdesk_audit.cg_local_receipts WHERE workspace_id=${literal(c.workspaceId)}::uuid AND request_id=${literal(c.requestId)}::uuid;
`;
}
