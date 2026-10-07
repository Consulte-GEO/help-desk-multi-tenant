import {createHash} from 'node:crypto';
import {HelpdeskError} from '../domain/errors.ts';
import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';

const fields=['workspace_id','principal_id','supabase_user_id','expected_scope_revision','request_id','reason'];
/** Private genesis only. The SQL operator authenticates separately; these UUIDs are selectors. */
export function planFirstAdminBootstrap(value:unknown){
 let p:{workspace_id:string;principal_id:string;supabase_user_id:string;expected_scope_revision:number;request_id:string;reason:string};
 try{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error();
  const v=value as Record<string,unknown>;
  if(Object.keys(v).length!==fields.length||fields.some(k=>!Object.hasOwn(v,k)))throw Error();
  if(!Number.isInteger(v.expected_scope_revision)||(v.expected_scope_revision as number)<0||(v.expected_scope_revision as number)>=2147483647)throw Error();
  if(!isPersistableText(v.reason)||v.reason.trim().length<3||v.reason.length>900)throw Error();
  p={workspace_id:uuidIdentifier(v.workspace_id),principal_id:uuidIdentifier(v.principal_id),
   supabase_user_id:uuidIdentifier(v.supabase_user_id),expected_scope_revision:v.expected_scope_revision as number,
   request_id:uuidIdentifier(v.request_id),reason:v.reason.trim()};
 }catch{throw new HelpdeskError(400,'invalid_bootstrap_plan','Plano de bootstrap inválido. Revise o alvo existente, revisão e motivo; não inclua segredos.');}
 const requestHash=createHash('sha256').update(JSON.stringify(p)).digest('hex');
 const action='workspace.first_admin_bootstrap.v1:'+requestHash;
 const literal="'"+JSON.stringify(p).replaceAll("'","''")+"'";
 const body=`
DECLARE
 c jsonb := ${literal}::jsonb;
 w uuid := (c->>'workspace_id')::uuid;
 person uuid := (c->>'principal_id')::uuid;
 auth_id uuid := (c->>'supabase_user_id')::uuid;
 request uuid := (c->>'request_id')::uuid;
 expected integer := (c->>'expected_scope_revision')::integer;
 actor helpdesk_auth.principals%rowtype;
 member helpdesk_auth.workspace_memberships%rowtype;
 receipt helpdesk_audit.audit_events%rowtype;
 ceiling text[];
 revision integer;
 affected integer;
BEGIN
 -- This is not an application request: an approved authenticated DB operator is mandatory.
 IF current_user<>session_user OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper or rolbypassrls)) THEN
  RAISE EXCEPTION 'bootstrap_operator_required' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('helpdesk:first-admin:'||w::text,0));
 PERFORM id FROM helpdesk_core.workspaces WHERE id=w FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'bootstrap_workspace_missing' USING ERRCODE='22023'; END IF;
 SELECT * INTO actor FROM helpdesk_auth.principals WHERE id=person FOR UPDATE;
 IF NOT FOUND OR actor.kind<>'human' OR NOT actor.active OR actor.supabase_user_id IS DISTINCT FROM auth_id THEN
  RAISE EXCEPTION 'bootstrap_human_binding_required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO member FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND principal_id=person FOR UPDATE;
 IF NOT FOUND OR NOT member.active THEN RAISE EXCEPTION 'bootstrap_membership_required' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('helpdesk-human-scopes:'||w::text||':'||person::text,0));
 SELECT * INTO receipt FROM helpdesk_audit.audit_events WHERE workspace_id=w AND id=request;
 IF FOUND THEN
  IF receipt.action IS DISTINCT FROM '${action}' OR receipt.principal_id IS DISTINCT FROM person
    OR receipt.resource_id IS DISTINCT FROM person OR receipt.request_id IS DISTINCT FROM request::text THEN
   RAISE EXCEPTION 'bootstrap_receipt_conflict' USING ERRCODE='40001';
  END IF;
  IF member.role<>'admin' OR NOT EXISTS(SELECT 1 FROM helpdesk_auth.human_scope_versions proof
    WHERE proof.workspace_id=w AND proof.principal_id=person AND proof.revision=expected+1 AND proof.request_id=request
    AND proof.reason='Bootstrap inicial: '||(c->>'reason')) THEN
   RAISE EXCEPTION 'bootstrap_receipt_invalid_or_revoked' USING ERRCODE='42501';
  END IF;
  RETURN; -- Original receipt, no new role write or permission revision.
 END IF;
 IF EXISTS(SELECT 1 FROM helpdesk_audit.audit_events WHERE workspace_id=w AND left(action,length('workspace.first_admin_bootstrap.v1:'))='workspace.first_admin_bootstrap.v1:')
   OR EXISTS(SELECT 1 FROM helpdesk_auth.workspace_memberships WHERE workspace_id=w AND active AND role='admin')
   OR member.role<>'agent' THEN
  RAISE EXCEPTION 'bootstrap_already_used' USING ERRCODE='40001';
 END IF;
 SELECT coalesce(max(v.revision),0) INTO revision FROM helpdesk_auth.human_scope_versions v WHERE workspace_id=w AND principal_id=person;
 IF revision IS DISTINCT FROM expected THEN RAISE EXCEPTION 'bootstrap_scope_revision_conflict' USING ERRCODE='40001'; END IF;
 ceiling:=helpdesk_auth.human_scopes(w,person);
 UPDATE helpdesk_auth.workspace_memberships SET role='admin' WHERE workspace_id=w AND principal_id=person AND active AND role='agent';
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'bootstrap_membership_acknowledgement_failed' USING ERRCODE='40001'; END IF;
 -- Same ceiling, new immutable operator/reason/correlation record. No implied scope is added.
 revision:=helpdesk_auth.set_human_scopes(w,person,ceiling,expected,'Bootstrap inicial: '||(c->>'reason'),request);
 IF revision IS DISTINCT FROM expected+1 THEN RAISE EXCEPTION 'bootstrap_scope_acknowledgement_failed' USING ERRCODE='40001'; END IF;
 INSERT INTO helpdesk_audit.audit_events(workspace_id,id,principal_id,action,resource_id,request_id)
  VALUES(w,request,person,'${action}',person,request);
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected<>1 THEN RAISE EXCEPTION 'bootstrap_audit_acknowledgement_failed' USING ERRCODE='40001'; END IF;
END
`;
 // DO bodies do not accept protocol parameters. Pick a delimiter absent from the entire escaped body.
 let tag='$helpdesk_bootstrap$',index=0;
 while(body.includes(tag))tag='$helpdesk_bootstrap_'+(++index)+'$';
 const sql=`BEGIN;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '2s';
SET LOCAL idle_in_transaction_session_timeout = '15s';
SET LOCAL standard_conforming_strings = on;
DO ${tag}${body}${tag};
SELECT jsonb_build_object('schema','helpdesk.first-admin-bootstrap.v1','workspace_id',a.workspace_id,
 'principal_id',a.principal_id,'request_id',a.request_id,'operator_role',v.changed_by,'role',m.role,
 'scope_revision',v.revision,'scopes',v.scopes,'capabilities_changed',false,'human_auth_tested',false) AS receipt
 FROM helpdesk_audit.audit_events a JOIN helpdesk_auth.human_scope_versions v
 ON v.workspace_id=a.workspace_id AND v.principal_id=a.principal_id AND v.request_id::text=a.request_id
 JOIN helpdesk_auth.workspace_memberships m ON m.workspace_id=a.workspace_id AND m.principal_id=a.principal_id
 WHERE a.workspace_id='${p.workspace_id}'::uuid AND a.id='${p.request_id}'::uuid AND a.action='${action}' AND v.revision=${p.expected_scope_revision+1};
COMMIT;`;
 return {schema:'helpdesk.first-admin-plan.v1' as const,executesDatabase:false as const,changesCapabilities:false as const,
  humanAuthTested:false as const,requestHash,sql};
}
