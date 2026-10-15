import {canonicalJson,requestHash} from '../domain/canonical.ts';
import {planSupportReviewPublication} from '../application/support-review-publication.ts';
const literal=(v:string)=>"E'"+v.replaceAll('\\','\\\\').replaceAll("'","''")+"'";
/** Offline, delegated operator recipe. No Auth, account role or GEO access write.
 * Publication remains separate from activating any notification audience. */
export function buildSupportReviewPublicationSql(input:ReturnType<typeof planSupportReviewPublication>){
 let c:any,json:string,hash:string;
 try{
  if(!input||Object.getPrototypeOf(input)!==Object.prototype)throw Error();
  const d=Object.getOwnPropertyDescriptors(input);if(Reflect.ownKeys(input).length!==2||d.executesDatabase?.value!==false||!Object.hasOwn(d.values??{},'value'))throw Error();
  const values=d.values!.value;if(!Array.isArray(values)||Object.getPrototypeOf(values)!==Array.prototype||Reflect.ownKeys(values).length!==3)throw Error();
  const v=Object.getOwnPropertyDescriptors(values),rawJson=v[0]?.value,rawHash=v[1]?.value;
  if(typeof rawJson!=='string'||Buffer.byteLength(rawJson)>256*1024||typeof rawHash!=='string'||!/^[a-f0-9]{64}$/.test(rawHash))throw Error();json=rawJson;hash=rawHash;c=JSON.parse(json);
  const raw=Object.fromEntries(['workspaceId','accountId','administratorId','administratorEmail','operatorName','requestId','reason','requesterId','requesterEmail','approverId','approverEmail','expiresAt'].map(k=>[k,c[k]]));
  Object.assign(raw,{workIds:c.profile.workIds,formId:c.profile.formId,configuration:c.source.configuration,registry:c.source.registry.document,registryRevision:c.source.registry.revision,expectedCatalogRevision:c.expected.catalogRevision,expectedLocalRevision:c.expected.localRevision,expectedQueueRevision:c.queue.expectedRevision,expectedGrantRevisions:Object.fromEntries(c.grants.map((g:any)=>[g.key,g.expectedRevision]))});
  const rebuilt=planSupportReviewPublication(raw);if(rebuilt.values[0]!==json||rebuilt.values[1]!==hash||canonicalJson(c)!==json||requestHash(c)!==hash)throw Error();
 }catch{throw Error('Invalid review operations publication plan');}
 let tag='$review_publication_'+hash.slice(0,16)+'$';while(json.includes(tag))tag=tag.slice(0,-1)+'_$';
 return `BEGIN;
SET LOCAL lock_timeout='10s';SET LOCAL statement_timeout='60s';SET LOCAL idle_in_transaction_session_timeout='30s';
SELECT helpdesk_auth.cg_local_operator();
DO ${tag}
DECLARE c jsonb:=${literal(json)}::jsonb;digest text:=${literal(hash)};w uuid:=(c->>'workspaceId')::uuid;a uuid:=(c->>'accountId')::uuid;sponsor uuid:=(c->>'administratorId')::uuid;requester uuid:=(c->>'requesterId')::uuid;request uuid:=(c->>'requestId')::uuid;
 prior helpdesk_core.hdn_cfg_versions%rowtype;published helpdesk_core.hdn_cfg_versions%rowtype;receipt helpdesk_audit.audit_events%rowtype;local_registry helpdesk_auth.cg_local_registries%rowtype;local_receipt helpdesk_audit.cg_local_receipts%rowtype;local_account helpdesk_auth.cg_local_accounts%rowtype;grant_row helpdesk_auth.hdnr_grants%rowtype;
 registry helpdesk_auth.hdn_cfg_registries%rowtype;catalog_revision int;selected_works text[];person uuid;operation_name text;item jsonb;entry jsonb;definition jsonb;artifact jsonb;key text;cap_revision bigint;queue_revision bigint;stamp timestamptz;until_time timestamptz;replay boolean;affected int;cfg_id uuid:=(c->'configuration'->>'id')::uuid;cfg_version int:=(c->'configuration'->'definition'->>'version')::int;policy_id text:=c->'policy'->'document'->>'versionId';profile_id text:=c->'profile'->>'profileVersionId';
BEGIN
 IF helpdesk_auth.schema_version()<>'0.25.0' OR session_user::text IS DISTINCT FROM c->>'operatorName' OR current_user<>session_user OR digest IS DISTINCT FROM helpdesk_auth.hdni_digest(c) THEN RAISE EXCEPTION 'Qualified delegated operator required' USING ERRCODE='HRP01';END IF;
 -- Same order as delivery admission: ledger, review authority, then metadata.
 PERFORM pg_advisory_xact_lock(hashtextextended('helpdesk-notification-ledger-v1',0));
 PERFORM pg_advisory_xact_lock(hashtextextended('helpdesk-review-authority:'||w::text,0));
 PERFORM 1 FROM helpdesk_audit.cg_initial_receipts WHERE workspace_id=w AND document->>'assurance'='operator-delegation' AND document->>'sponsorId'=sponsor::text FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Initial delegation required' USING ERRCODE='HRP01';END IF;
 SELECT * INTO STRICT local_registry FROM helpdesk_auth.cg_local_registries WHERE workspace_id=w FOR SHARE;
 SELECT * INTO STRICT local_receipt FROM helpdesk_audit.cg_local_receipts WHERE workspace_id=w AND registry_revision=local_registry.revision FOR SHARE;
 SELECT * INTO STRICT local_account FROM helpdesk_auth.cg_local_accounts WHERE workspace_id=w AND account_id=a AND active FOR SHARE;
 IF local_registry.revision<>(c->'expected'->>'localRevision')::int OR local_account.registry_revision<>local_registry.revision OR local_receipt.decision_hash<>local_registry.decision_hash OR local_receipt.receipt->>'decisionHash'<>local_registry.decision_hash OR local_receipt.receipt->'revision'<>to_jsonb(local_registry.revision) OR local_receipt.receipt->>'workspaceId'<>w::text OR local_receipt.receipt->>'requestId'<>local_receipt.request_id::text OR local_receipt.receipt->>'commandHash'<>local_receipt.command_hash OR local_receipt.receipt->'sourceManifest' IS DISTINCT FROM '{"authority":"persisted-local-registry","complete":true,"externalApiQualified":false,"resourceType":"work","source":"helpdesk-local","version":1}'::jsonb THEN RAISE EXCEPTION 'Current local publication required' USING ERRCODE='HRP03';END IF;
 selected_works:=ARRAY(SELECT value FROM jsonb_array_elements_text(c->'profile'->'workIds'));
 IF EXISTS(SELECT 1 FROM unnest(selected_works) ref WHERE NOT EXISTS(SELECT 1 FROM helpdesk_auth.cg_local_works WHERE workspace_id=w AND account_id=a AND id=ref AND active AND registry_revision=local_registry.revision)) THEN RAISE EXCEPTION 'Current complete work scope required' USING ERRCODE='HRP01';END IF;
 FOREACH person IN ARRAY ARRAY[sponsor,requester] LOOP
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('helpdesk-human-scopes:'||w::text||':'||person::text,0));
  PERFORM 1 FROM helpdesk_auth.principals p JOIN auth.users u ON u.id=p.supabase_user_id WHERE p.id=person AND p.active AND p.kind='human' AND lower(u.email)=CASE WHEN person=sponsor THEN c->>'administratorEmail' ELSE c->>'requesterEmail' END AND u.email_confirmed_at IS NOT NULL AND u.email_confirmed_at<=clock_timestamp() AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()) FOR SHARE OF p,u;
  IF NOT FOUND OR NOT 'tickets:read'=ANY(helpdesk_auth.human_scopes(w,person)) OR NOT 'tickets:write'=ANY(helpdesk_auth.human_scopes(w,person)) THEN RAISE EXCEPTION 'Verified current participant required' USING ERRCODE='HRP01';END IF;
  FOREACH operation_name IN ARRAY ARRAY['tickets.read','tickets.write'] LOOP
   PERFORM 1 FROM helpdesk_auth.cg_local_permissions p WHERE p.workspace_id=w AND p.account_id=a AND p.principal_id=person AND p.operation=operation_name AND p.active AND p.registry_revision=local_registry.revision AND p.work_ids @> to_jsonb(selected_works) FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Participant work permission required' USING ERRCODE='HRP01';END IF;
  END LOOP;
 END LOOP;
 PERFORM 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=sponsor AND active AND role='admin' FOR SHARE;
 IF NOT FOUND OR sponsor=requester OR sponsor::text IS DISTINCT FROM c->>'approverId' OR c->>'approverEmail' IS DISTINCT FROM c->>'administratorEmail' THEN RAISE EXCEPTION 'Separate administrator approver required' USING ERRCODE='HRP01';END IF;
 PERFORM 1 FROM helpdesk_auth.account_grants WHERE workspace_id=w AND account_id=a AND principal_id=requester AND active AND role='requester' FOR SHARE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=requester AND active) OR EXISTS(SELECT 1 FROM helpdesk_auth.account_grants WHERE workspace_id=w AND account_id=a AND principal_id=requester AND active AND role<>'requester') THEN RAISE EXCEPTION 'Explicit requester required' USING ERRCODE='HRP01';END IF;
 SELECT * INTO receipt FROM helpdesk_audit.audit_events WHERE workspace_id=w AND id=request;replay:=FOUND;
 IF replay AND (receipt.action IS DISTINCT FROM 'review.wave2.operations' OR receipt.principal_id IS DISTINCT FROM sponsor OR receipt.resource_id IS DISTINCT FROM cfg_id OR receipt.request_id IS DISTINCT FROM (c->>'operatorName')||':'||digest) THEN RAISE EXCEPTION 'Review publication replay mismatch' USING ERRCODE='HRP02';END IF;
 stamp:=CASE WHEN replay THEN receipt.created_at ELSE clock_timestamp() END;until_time:=helpdesk_auth.hdn_notification_stamp(c->>'expiresAt');
 IF NOT replay AND (until_time<=stamp OR until_time>stamp+interval '366 days') THEN RAISE EXCEPTION 'Finite review authority required' USING ERRCODE='HRP01';END IF;
 SELECT revision INTO STRICT catalog_revision FROM helpdesk_core.hdn_cfg_catalog WHERE workspace_id=w FOR UPDATE;
 SELECT * INTO STRICT prior FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w AND id=cfg_id AND version=(c->'configuration'->>'fromVersion')::int FOR SHARE;
 SELECT * INTO STRICT registry FROM helpdesk_auth.hdn_cfg_registries WHERE workspace_id=w FOR SHARE;
 IF helpdesk_auth.hdn_cfg_record(prior) IS DISTINCT FROM c->'source'->'configuration' OR prior.status<>'published' OR prior.content_hash IS DISTINCT FROM c->'configuration'->>'fromContentHash' OR registry.revision IS DISTINCT FROM (c->'source'->'registry'->>'revision')::int OR registry.document IS DISTINCT FROM c->'source'->'registry'->'document' OR helpdesk_auth.hdni_digest(registry.document) IS DISTINCT FROM c->'source'->'registry'->>'sha256' THEN RAISE EXCEPTION 'Observed configuration changed' USING ERRCODE='HRP03';END IF;
 definition:=jsonb_set(prior.definition,'{version}',to_jsonb(cfg_version));
 definition:=jsonb_set(definition,'{entries}',(SELECT jsonb_agg(jsonb_set(jsonb_set(e.value,'{form}',e.value->'form'||jsonb_build_object('version',cfg_version,'status','draft')),'{checklist}',e.value->'checklist'||jsonb_build_object('version',cfg_version,'status','draft')) ORDER BY e.ordinality) FROM jsonb_array_elements(prior.definition->'entries') WITH ORDINALITY e));
 artifact:=helpdesk_auth.hdn_cfg_compile(definition,registry.document);
 IF cfg_version<>prior.version+1 OR definition IS DISTINCT FROM c->'configuration'->'definition' OR artifact IS DISTINCT FROM c->'configuration'->'artifacts' OR helpdesk_auth.hdni_digest(jsonb_build_object('definition',definition,'artifacts',artifact)) IS DISTINCT FROM c->'configuration'->>'contentHash' OR NOT helpdesk_auth.hdnr_valid_policy(c->'policy'->'document') OR helpdesk_auth.hdni_digest(c->'policy'->'document') IS DISTINCT FROM c->'policy'->>'sha256' THEN RAISE EXCEPTION 'Independent review compilation required' USING ERRCODE='HRP01';END IF;
 FOR key IN SELECT jsonb_object_keys(c->'childIds') LOOP
  IF c->'childIds'->>key IS DISTINCT FROM helpdesk_auth.hdn_cfg_form_id(request,'wave2-operations',key)::text THEN RAISE EXCEPTION 'Child receipt mismatch' USING ERRCODE='HRP01';END IF;
 END LOOP;
 IF NOT replay THEN
  IF catalog_revision<>(c->'expected'->>'catalogRevision')::int OR EXISTS(SELECT 1 FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w AND id=cfg_id AND version>prior.version) OR EXISTS(SELECT 1 FROM helpdesk_auth.hdnr_rosters WHERE workspace_id=w AND account_id=a AND profile_version_id=profile_id) THEN RAISE EXCEPTION 'Publication revision changed' USING ERRCODE='HRP03';END IF;
  IF (artifact->'calendar'->>'until')::timestamptz<=stamp THEN RAISE EXCEPTION 'Published calendar expired' USING ERRCODE='HRP01';END IF;
  SELECT coalesce(max(revision),0) INTO queue_revision FROM helpdesk_integration.hdn_notification_queue_rosters WHERE workspace_id=w AND account_id=a;
  IF queue_revision<>(c->'queue'->>'expectedRevision')::bigint THEN RAISE EXCEPTION 'Queue revision changed' USING ERRCODE='HRP03';END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(c->'grants') LOOP
   SELECT * INTO grant_row FROM helpdesk_auth.hdnr_grants WHERE workspace_id=w AND account_id=a AND principal_id=(item->>'principalId')::uuid AND capability=item->>'capability' ORDER BY revision DESC LIMIT 1 FOR SHARE;
   cap_revision:=CASE WHEN FOUND THEN grant_row.revision ELSE 0 END;
   IF cap_revision<>(item->>'expectedRevision')::bigint OR cap_revision>0 AND (NOT grant_row.active OR grant_row.work_ids IS DISTINCT FROM selected_works) THEN RAISE EXCEPTION 'Existing authority changed' USING ERRCODE='HRP03';END IF;
  END LOOP;
  INSERT INTO helpdesk_core.hdn_cfg_versions VALUES(w,cfg_id,cfg_version,1,'published',definition,c->'configuration'->>'contentHash',artifact,sponsor,stamp,sponsor,stamp);
  FOR entry IN SELECT value FROM jsonb_array_elements(artifact->'entries') LOOP
   INSERT INTO helpdesk_core.hdn_execution_templates(workspace_id,template_id,version,sha256,document) VALUES(w,entry->'checklist'->>'id',cfg_version,entry->'workflow'->'executionChecklist'->>'sha256',entry->'checklist');
   INSERT INTO helpdesk_core.hdn_workflow_profiles(workspace_id,version_id,document) VALUES(w,entry->'workflow'->>'versionId',entry->'workflow');
  END LOOP;
  UPDATE helpdesk_core.hdn_cfg_catalog SET revision=revision+1 WHERE workspace_id=w AND revision=catalog_revision;GET DIAGNOSTICS affected=ROW_COUNT;IF affected<>1 THEN RAISE EXCEPTION 'Catalog effect missing' USING ERRCODE='HRP04';END IF;
  INSERT INTO helpdesk_core.hdnr_policies(workspace_id,account_id,version_id,document,sha256,request_id,reason) VALUES(w,a,policy_id,c->'policy'->'document',c->'policy'->>'sha256',(c->'childIds'->>'policy')::uuid,c->>'reason');
  INSERT INTO helpdesk_core.hdnr_profiles(workspace_id,account_id,profile_version_id,configuration_id,configuration_version,configuration_hash,form_id,form_version,schema_hash,policy_version_id,required_for,work_ids,request_id,reason)
   VALUES(w,a,profile_id,cfg_id,cfg_version,c->'configuration'->>'contentHash',(c->'profile'->>'formId')::uuid,cfg_version,c->'profile'->>'schemaHash',policy_id,ARRAY[requester],selected_works,(c->'childIds'->>'profile')::uuid,c->>'reason');
  FOR item IN SELECT value FROM jsonb_array_elements(c->'grants') LOOP
   INSERT INTO helpdesk_auth.hdnr_grants(workspace_id,account_id,principal_id,capability,revision,active,work_ids,expires_at,request_id,reason) VALUES(w,a,(item->>'principalId')::uuid,item->>'capability',(item->>'expectedRevision')::bigint+1,true,selected_works,until_time,(c->'childIds'->>(item->>'key'))::uuid,c->>'reason');
  END LOOP;
  INSERT INTO helpdesk_auth.hdnr_rosters(workspace_id,account_id,profile_version_id,revision,approver_id,active,work_ids,expires_at,request_id,reason) VALUES(w,a,profile_id,1,sponsor,true,selected_works,until_time,(c->'childIds'->>'approver')::uuid,c->>'reason');
  INSERT INTO helpdesk_integration.hdn_notification_queue_rosters(workspace_id,account_id,revision,member_ids,max_recipients,expires_at,request_id,reason) VALUES(w,a,queue_revision+1,ARRAY[sponsor],1,until_time,(c->'childIds'->>'queue')::uuid,c->>'reason');
  INSERT INTO helpdesk_audit.audit_events(workspace_id,id,principal_id,action,resource_id,request_id,created_at) VALUES(w,request,sponsor,'review.wave2.operations',cfg_id,(c->>'operatorName')||':'||digest,stamp);
 END IF;
 -- Every historical effect is checked, including replay. Replaying never renews
 -- authority, replaces a roster or reactivates a route.
 SELECT * INTO STRICT published FROM helpdesk_core.hdn_cfg_versions WHERE workspace_id=w AND id=cfg_id AND version=cfg_version;
 IF published.status<>'published' OR published.definition IS DISTINCT FROM definition OR published.artifacts IS DISTINCT FROM artifact OR published.content_hash IS DISTINCT FROM c->'configuration'->>'contentHash' OR published.created_by<>sponsor OR published.published_by<>sponsor OR published.created_at<>stamp OR published.published_at<>stamp OR published.revision<>1 OR catalog_revision<(c->'expected'->>'catalogRevision')::int THEN RAISE EXCEPTION 'Configuration publication incomplete' USING ERRCODE='HRP04';END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(artifact->'entries') LOOP
  IF NOT EXISTS(SELECT 1 FROM helpdesk_core.hdn_execution_templates WHERE workspace_id=w AND template_id=entry->'checklist'->>'id' AND version=cfg_version AND sha256=entry->'workflow'->'executionChecklist'->>'sha256' AND document=entry->'checklist') OR NOT EXISTS(SELECT 1 FROM helpdesk_core.hdn_workflow_profiles WHERE workspace_id=w AND version_id=entry->'workflow'->>'versionId' AND document=entry->'workflow') THEN RAISE EXCEPTION 'Workflow publication incomplete' USING ERRCODE='HRP04';END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_core.hdnr_policies WHERE workspace_id=w AND account_id=a AND version_id=policy_id AND document=c->'policy'->'document' AND sha256=c->'policy'->>'sha256' AND request_id=(c->'childIds'->>'policy')::uuid AND reason=c->>'reason' AND recorded_by=session_user) OR NOT EXISTS(SELECT 1 FROM helpdesk_core.hdnr_profiles WHERE workspace_id=w AND account_id=a AND profile_version_id=profile_id AND configuration_id=cfg_id AND configuration_version=cfg_version AND configuration_hash=published.content_hash AND form_id=(c->'profile'->>'formId')::uuid AND form_version=cfg_version AND schema_hash=c->'profile'->>'schemaHash' AND policy_version_id=policy_id AND required_for=ARRAY[requester] AND hdnr_profiles.work_ids=selected_works AND request_id=(c->'childIds'->>'profile')::uuid AND reason=c->>'reason' AND recorded_by=session_user) THEN RAISE EXCEPTION 'Policy publication incomplete' USING ERRCODE='HRP04';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(c->'grants') LOOP
  IF NOT EXISTS(SELECT 1 FROM helpdesk_auth.hdnr_grants g WHERE workspace_id=w AND account_id=a AND principal_id=(item->>'principalId')::uuid AND capability=item->>'capability' AND revision=(item->>'expectedRevision')::bigint+1 AND active AND g.work_ids=selected_works AND expires_at=until_time AND request_id=(c->'childIds'->>(item->>'key'))::uuid AND reason=c->>'reason' AND recorded_by=session_user) THEN RAISE EXCEPTION 'Grant publication incomplete' USING ERRCODE='HRP04';END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_auth.hdnr_rosters r WHERE workspace_id=w AND account_id=a AND profile_version_id=profile_id AND revision=1 AND approver_id=sponsor AND active AND r.work_ids=selected_works AND expires_at=until_time AND request_id=(c->'childIds'->>'approver')::uuid AND reason=c->>'reason' AND recorded_by=session_user) OR NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_queue_rosters WHERE workspace_id=w AND account_id=a AND revision=(c->'queue'->>'expectedRevision')::bigint+1 AND member_ids=ARRAY[sponsor] AND max_recipients=1 AND expires_at=until_time AND request_id=(c->'childIds'->>'queue')::uuid AND reason=c->>'reason' AND recorded_by=session_user) OR NOT EXISTS(SELECT 1 FROM helpdesk_audit.audit_events WHERE workspace_id=w AND id=request AND principal_id=sponsor AND action='review.wave2.operations' AND resource_id=cfg_id AND request_id=(c->>'operatorName')||':'||digest AND created_at=stamp) THEN RAISE EXCEPTION 'Review publication incomplete' USING ERRCODE='HRP04';END IF;
END ${tag};
COMMIT;
SELECT id AS request_id,action,request_id AS operator_command_hash,created_at FROM helpdesk_audit.audit_events WHERE workspace_id=${literal(c.workspaceId)}::uuid AND id=${literal(c.requestId)}::uuid;
`;
}
