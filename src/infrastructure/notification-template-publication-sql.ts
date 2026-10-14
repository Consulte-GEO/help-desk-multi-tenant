import {canonicalJson,requestHash} from '../domain/canonical.ts';
import {planNotificationTemplatePublication} from '../application/notification-template-publication.ts';
const literal=(v:string)=>"E'"+v.replaceAll('\\','\\\\').replaceAll("'","''")+"'";
/** Operator-only, append-only data recipe. No schema/ACL/Auth modification. */
export function buildNotificationTemplatePublicationSql(plan:ReturnType<typeof planNotificationTemplatePublication>){
 let c:any,json:string,hash:string;
 try{
  if(!plan||plan.executesDatabase!==false||Object.keys(plan).sort().join(',')!=='executesDatabase,values'||!Array.isArray(plan.values)||plan.values.length!==2)throw Error();
  [json,hash]=plan.values;c=JSON.parse(json);
  const rebuilt=planNotificationTemplatePublication({workspaceId:c.workspaceId,administratorId:c.administratorId,administratorEmail:c.administratorEmail,operatorName:c.operatorName,requestId:c.requestId,reason:c.reason,expectedRoutes:c.expectedRoutes});
  if(rebuilt.values[0]!==json||rebuilt.values[1]!==hash||canonicalJson(c)!==json||requestHash(c)!==hash)throw Error();
 }catch{throw Error('Invalid notification publication plan');}
 let tag='$notification_publication_'+hash!.slice(0,16)+'$';while(json!.includes(tag))tag=tag.slice(0,-1)+'_$';
 return `BEGIN;
SET LOCAL lock_timeout='10s';SET LOCAL statement_timeout='60s';SET LOCAL idle_in_transaction_session_timeout='30s';
SELECT helpdesk_auth.cg_local_operator();
DO ${tag}
DECLARE c jsonb:=${literal(json!)}::jsonb;w uuid:=(c->>'workspaceId')::uuid;sponsor uuid:=(c->>'administratorId')::uuid;request uuid:=(c->>'requestId')::uuid;digest text:=${literal(hash!)};e jsonb;t jsonb;r helpdesk_integration.hdn_notification_routes%rowtype;receipt helpdesk_audit.audit_events%rowtype;n int;replay boolean;
BEGIN
 IF helpdesk_auth.schema_version()<>'0.24.0' OR session_user::text IS DISTINCT FROM c->>'operatorName' OR digest IS DISTINCT FROM helpdesk_auth.hdni_digest(c) THEN RAISE EXCEPTION 'Qualified notification operator plan required' USING ERRCODE='HNP01';END IF;
 PERFORM 1 FROM helpdesk_audit.cg_initial_receipts WHERE workspace_id=w AND document->>'assurance'='operator-delegation' AND document->>'sponsorId'=sponsor::text FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Initial delegation required' USING ERRCODE='HNP01';END IF;
 PERFORM 1 FROM helpdesk_auth.principals p JOIN helpdesk_auth.workspace_memberships m ON m.principal_id=p.id JOIN auth.users u ON u.id=p.supabase_user_id WHERE p.id=sponsor AND p.active AND p.kind='human' AND m.workspace_id=w AND m.active AND m.role='admin' AND lower(u.email)=c->>'administratorEmail' AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()) FOR SHARE OF p,m;
 IF NOT FOUND THEN RAISE EXCEPTION 'Verified delegating administrator required' USING ERRCODE='HNP01';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('notification-wave1:'||w::text,0));
 SELECT * INTO receipt FROM helpdesk_audit.audit_events WHERE workspace_id=w AND id=request;
 replay:=FOUND;
 IF replay AND (receipt.action IS DISTINCT FROM 'notification.templates_published' OR receipt.principal_id IS DISTINCT FROM sponsor OR receipt.resource_id IS DISTINCT FROM w OR receipt.request_id IS DISTINCT FROM (c->>'operatorName')||':'||digest) THEN RAISE EXCEPTION 'Notification publication replay mismatch' USING ERRCODE='HNP02';END IF;
 FOR e IN SELECT value FROM jsonb_array_elements(c->'expectedRoutes') LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('notification-template:'||(e->>'templateId'),0));
  SELECT * INTO r FROM helpdesk_integration.hdn_notification_routes WHERE workspace_id=w AND kind=e->>'kind' AND revision=(e->>'revision')::bigint FOR SHARE;
  IF NOT FOUND OR r.audience<>'requester' OR r.template_id IS DISTINCT FROM e->>'templateId' OR r.template_version<>(e->>'templateVersion')::int
  OR NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_templates WHERE id=r.template_id AND version=r.template_version AND kind=r.kind AND sha256=e->>'templateHash') THEN RAISE EXCEPTION 'Notification predecessor changed' USING ERRCODE='HNP03';END IF;
  IF NOT replay AND (r.expires_at<=clock_timestamp() OR r.revision<>(SELECT max(revision) FROM helpdesk_integration.hdn_notification_routes WHERE workspace_id=w AND kind=r.kind)) THEN RAISE EXCEPTION 'Notification route revision changed or expired' USING ERRCODE='HNP03';END IF;
  SELECT value INTO STRICT t FROM jsonb_array_elements(c->'templates') WHERE value->'document'->>'id'=r.template_id AND value->'document'->>'kind'=r.kind;
  IF t->>'sha256' IS DISTINCT FROM helpdesk_auth.hdni_digest(t->'document') THEN RAISE EXCEPTION 'Notification template hash mismatch' USING ERRCODE='HNP01';END IF;
  IF NOT replay AND NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_templates WHERE id=r.template_id AND version=2) THEN
   INSERT INTO helpdesk_integration.hdn_notification_templates(id,version,kind,document,sha256) VALUES(r.template_id,2,r.kind,t->'document',t->>'sha256');GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Notification template not persisted' USING ERRCODE='HNP04';END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_templates WHERE id=r.template_id AND version=2 AND kind=r.kind AND document=t->'document' AND sha256=t->>'sha256') THEN RAISE EXCEPTION 'Notification immutable version conflict' USING ERRCODE='HNP04';END IF;
  IF NOT replay THEN
   INSERT INTO helpdesk_integration.hdn_notification_routes(workspace_id,kind,revision,audience,template_id,template_version,expires_at) VALUES(w,r.kind,r.revision+1,'requester',r.template_id,2,r.expires_at);GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Notification route not persisted' USING ERRCODE='HNP04';END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_routes WHERE workspace_id=w AND kind=r.kind AND revision=r.revision+1 AND audience='requester' AND template_id=r.template_id AND template_version=2 AND expires_at=r.expires_at) THEN RAISE EXCEPTION 'Notification publication incomplete' USING ERRCODE='HNP04';END IF;
 END LOOP;
 IF NOT replay THEN
  INSERT INTO helpdesk_audit.audit_events(workspace_id,id,principal_id,action,resource_id,request_id,created_at) VALUES(w,request,sponsor,'notification.templates_published',w,(c->>'operatorName')||':'||digest,clock_timestamp());GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Notification publication receipt not persisted' USING ERRCODE='HNP04';END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_audit.audit_events WHERE workspace_id=w AND id=request AND principal_id=sponsor AND action='notification.templates_published' AND resource_id=w AND request_id=(c->>'operatorName')||':'||digest) THEN RAISE EXCEPTION 'Notification publication receipt incomplete' USING ERRCODE='HNP04';END IF;
END ${tag};
COMMIT;
SELECT 'operator-delegation' AS assurance,${literal(c.operatorName)} AS recorded_by,id AS request_id,request_id AS operator_command_hash,created_at FROM helpdesk_audit.audit_events WHERE workspace_id=${literal(c.workspaceId)}::uuid AND id=${literal(c.requestId)}::uuid;
`;
}
