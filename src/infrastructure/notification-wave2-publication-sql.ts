import {copyFormData} from '../../shared/form-rules.js';import {canonicalJson,requestHash} from '../domain/canonical.ts';
import {planNotificationWave2Publication} from '../application/notification-wave2-publication.ts';
const literal=(v:string)=>"E'"+v.replaceAll('\\','\\\\').replaceAll("'","''")+"'";
/** Private operator data recipe. Must qualify in genuine PostgreSQL after the
 * additive v025 catalogue; never run against the existing v024 installation. */
export function buildNotificationWave2PublicationSql(input:ReturnType<typeof planNotificationWave2Publication>){
 let c:any,json:string,hash:string;
 try{
  const p=copyFormData(input) as ReturnType<typeof planNotificationWave2Publication>;
  if(!p||p.executesDatabase!==false||Object.keys(p).sort().join(',')!=='executesDatabase,values'||!Array.isArray(p.values)||p.values.length!==2)throw Error();
  [json,hash]=p.values;c=JSON.parse(json);
  const rebuilt=planNotificationWave2Publication(Object.fromEntries(['workspaceId','administratorId','administratorEmail','operatorName','requestId','reason','group','phase','recipientIds','expiresAt','expectedRoutes'].map(k=>[k,c[k]])));
  if(rebuilt.values[0]!==json||rebuilt.values[1]!==hash||canonicalJson(c)!==json||requestHash(c)!==hash)throw Error();
 }catch{throw Error('Invalid wave2 publication plan');}
 let tag='$wave2_publication_'+hash.slice(0,16)+'$';while(json.includes(tag))tag=tag.slice(0,-1)+'_$';
 return `BEGIN;
SET LOCAL lock_timeout='10s';SET LOCAL statement_timeout='60s';SET LOCAL idle_in_transaction_session_timeout='30s';
SELECT helpdesk_auth.cg_local_operator();
DO ${tag}
DECLARE c jsonb:=${literal(json)}::jsonb;w uuid:=(c->>'workspaceId')::uuid;sponsor uuid:=(c->>'administratorId')::uuid;request uuid:=(c->>'requestId')::uuid;digest text:=${literal(hash)};
 e jsonb;t jsonb;r helpdesk_integration.hdn_notification_routes%rowtype;receipt helpdesk_audit.audit_events%rowtype;person uuid;n int;replay boolean;stamp timestamptz;until_time timestamptz;members uuid[];audit_action text;next_audience text;
BEGIN
 IF helpdesk_auth.schema_version()<>'0.25.0' OR session_user::text IS DISTINCT FROM c->>'operatorName' OR digest IS DISTINCT FROM helpdesk_auth.hdni_digest(c) THEN RAISE EXCEPTION 'Qualified wave2 operator required' USING ERRCODE='HNP01';END IF;
 PERFORM 1 FROM helpdesk_audit.cg_initial_receipts WHERE workspace_id=w AND document->>'assurance'='operator-delegation' AND document->>'sponsorId'=sponsor::text FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Initial delegation required' USING ERRCODE='HNP01';END IF;
 PERFORM 1 FROM helpdesk_auth.principals p JOIN helpdesk_auth.workspace_memberships m ON m.principal_id=p.id JOIN auth.users u ON u.id=p.supabase_user_id WHERE p.id=sponsor AND p.active AND p.kind='human' AND m.workspace_id=w AND m.active AND m.role='admin' AND lower(u.email)=c->>'administratorEmail' AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()) FOR SHARE OF p,m;
 IF NOT FOUND THEN RAISE EXCEPTION 'Verified sponsor required' USING ERRCODE='HNP01';END IF;
 members:=ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(c->'recipientIds'));
 FOREACH person IN ARRAY members LOOP
  PERFORM pg_advisory_xact_lock_shared(hashtextextended('helpdesk-human-scopes:'||w::text||':'||person::text,0));
  PERFORM 1 FROM helpdesk_auth.principals p JOIN auth.users u ON u.id=p.supabase_user_id WHERE p.id=person AND p.active AND p.kind='human' AND u.email_confirmed_at IS NOT NULL AND u.deleted_at IS NULL AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp()) FOR SHARE OF p;
  IF NOT FOUND OR NOT 'tickets:read'=ANY(helpdesk_auth.human_scopes(w,person))
  OR NOT (EXISTS(SELECT 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=person AND active) OR EXISTS(SELECT 1 FROM helpdesk_auth.account_grants WHERE workspace_id=w AND principal_id=person AND active)) THEN RAISE EXCEPTION 'Current verified cohort required' USING ERRCODE='HNP01';END IF;
 END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended('notification-wave2:'||w::text,0));
 audit_action:='notification.wave2.'||(c->>'group')||'.'||(c->>'phase');
 SELECT * INTO receipt FROM helpdesk_audit.audit_events WHERE workspace_id=w AND id=request;replay:=FOUND;
 IF replay AND (receipt.action IS DISTINCT FROM audit_action OR receipt.principal_id IS DISTINCT FROM sponsor OR receipt.resource_id IS DISTINCT FROM w OR receipt.request_id IS DISTINCT FROM (c->>'operatorName')||':'||digest) THEN RAISE EXCEPTION 'Wave2 replay mismatch' USING ERRCODE='HNP02';END IF;
 stamp:=CASE WHEN replay THEN receipt.created_at ELSE clock_timestamp() END;until_time:=helpdesk_auth.hdn_notification_stamp(c->>'expiresAt');
 IF NOT replay AND (until_time<=stamp OR until_time>stamp+interval '366 days') THEN RAISE EXCEPTION 'Finite publication window required' USING ERRCODE='HNP01';END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(c->'templates') LOOP
  PERFORM pg_advisory_xact_lock(hashtextextended('notification-template:'||(t->'document'->>'id'),0));
  IF t->>'sha256' IS DISTINCT FROM helpdesk_auth.hdni_digest(t->'document') THEN RAISE EXCEPTION 'Template hash mismatch' USING ERRCODE='HNP01';END IF;
  SELECT value INTO STRICT e FROM jsonb_array_elements(c->'expectedRoutes') WHERE value->>'kind'=t->'document'->>'kind';
  IF (e->>'revision')::bigint=0 THEN
   IF NOT replay AND EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_routes WHERE workspace_id=w AND kind=e->>'kind') THEN RAISE EXCEPTION 'New route appeared concurrently' USING ERRCODE='HNP03';END IF;
  ELSE
   SELECT * INTO r FROM helpdesk_integration.hdn_notification_routes WHERE workspace_id=w AND kind=e->>'kind' AND revision=(e->>'revision')::bigint FOR SHARE;
   IF NOT FOUND OR r.audience IS DISTINCT FROM e->>'audience' OR r.template_id IS DISTINCT FROM e->>'templateId' OR r.template_version IS DISTINCT FROM (e->>'templateVersion')::int
   OR r.effective_after IS DISTINCT FROM CASE WHEN e->>'effectiveAfter' IS NULL THEN NULL ELSE helpdesk_auth.hdn_notification_stamp(e->>'effectiveAfter') END
   OR coalesce(to_jsonb(r.recipient_ids),'null'::jsonb) IS DISTINCT FROM e->'recipientIds'
   OR r.template_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_templates WHERE id=r.template_id AND version=r.template_version AND kind=r.kind AND sha256=e->>'templateHash') THEN RAISE EXCEPTION 'Observed route changed' USING ERRCODE='HNP03';END IF;
   IF NOT replay AND r.revision<>(SELECT max(revision) FROM helpdesk_integration.hdn_notification_routes WHERE workspace_id=w AND kind=r.kind) THEN RAISE EXCEPTION 'Route revision changed' USING ERRCODE='HNP03';END IF;
  END IF;
  IF NOT replay AND NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_templates WHERE id=t->'document'->>'id' AND version=(t->'document'->>'version')::int) THEN
   INSERT INTO helpdesk_integration.hdn_notification_templates(id,version,kind,document,sha256) VALUES(t->'document'->>'id',(t->'document'->>'version')::int,t->'document'->>'kind',t->'document',t->>'sha256');GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Template suppressed' USING ERRCODE='HNP04';END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_templates WHERE id=t->'document'->>'id' AND version=(t->'document'->>'version')::int AND kind=t->'document'->>'kind' AND document=t->'document' AND sha256=t->>'sha256') THEN RAISE EXCEPTION 'Immutable template conflict' USING ERRCODE='HNP04';END IF;
  next_audience:=CASE WHEN c->>'phase'='activate' THEN t->>'audience' ELSE 'none' END;
  IF NOT replay THEN
   INSERT INTO helpdesk_integration.hdn_notification_routes(workspace_id,kind,revision,audience,template_id,template_version,expires_at,effective_after,recipient_ids)
   VALUES(w,t->'document'->>'kind',(e->>'revision')::bigint+1,next_audience,CASE WHEN next_audience='none' THEN NULL ELSE t->'document'->>'id' END,CASE WHEN next_audience='none' THEN NULL ELSE (t->'document'->>'version')::int END,until_time,stamp,members);
   GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Route suppressed' USING ERRCODE='HNP04';END IF;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM helpdesk_integration.hdn_notification_routes WHERE workspace_id=w AND kind=t->'document'->>'kind' AND revision=(e->>'revision')::bigint+1 AND hdn_notification_routes.audience=next_audience AND template_id IS NOT DISTINCT FROM CASE WHEN next_audience='none' THEN NULL ELSE t->'document'->>'id' END AND template_version IS NOT DISTINCT FROM CASE WHEN next_audience='none' THEN NULL ELSE (t->'document'->>'version')::int END AND expires_at=until_time AND effective_after=stamp AND recipient_ids=members) THEN RAISE EXCEPTION 'Wave2 publication incomplete' USING ERRCODE='HNP04';END IF;
 END LOOP;
 IF NOT replay THEN
  INSERT INTO helpdesk_audit.audit_events(workspace_id,id,principal_id,action,resource_id,request_id,created_at) VALUES(w,request,sponsor,audit_action,w,(c->>'operatorName')||':'||digest,stamp);GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'Receipt suppressed' USING ERRCODE='HNP04';END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM helpdesk_audit.audit_events WHERE workspace_id=w AND id=request AND principal_id=sponsor AND audit_events.action=audit_action AND resource_id=w AND request_id=(c->>'operatorName')||':'||digest AND created_at=stamp) THEN RAISE EXCEPTION 'Receipt incomplete' USING ERRCODE='HNP04';END IF;
END ${tag};
COMMIT;
SELECT id AS request_id,action,request_id AS operator_command_hash,created_at FROM helpdesk_audit.audit_events WHERE workspace_id=${literal(c.workspaceId)}::uuid AND id=${literal(c.requestId)}::uuid;
`;
}
