import {SCOPES,parseScopeList} from '../domain/scopes.ts';
import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';
import {HelpdeskError} from '../domain/errors.ts';
const FIELDS=['workspace_id','principal_id','scopes','expected_revision','reason','request_id'];
/** Offline provisioning plan only. No credential, connection, or implicit network execution. */
export function planHumanScopeChange(value:unknown){
 try{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error();
  const p=value as Record<string,unknown>;
  if(Object.keys(p).length!==FIELDS.length||FIELDS.some(k=>!Object.hasOwn(p,k)))throw Error();
  const workspace=uuidIdentifier(p.workspace_id),person=uuidIdentifier(p.principal_id),request=uuidIdentifier(p.request_id);
  const scopes=parseScopeList(p.scopes);
  if(!Number.isInteger(p.expected_revision)||(p.expected_revision as number)<0||(p.expected_revision as number)>=2147483647)throw Error();
  if(!isPersistableText(p.reason)||p.reason.trim().length<3||p.reason.length>1000)throw Error();
  return {
   executesDatabase:false as const,
   sql:'select helpdesk_auth.set_human_scopes($1::uuid,$2::uuid,$3::text[],$4::integer,$5::text,$6::uuid) as revision',
   values:[workspace,person,SCOPES.filter(s=>scopes.includes(s)),p.expected_revision,p.reason,request] as const
  };
 }catch{throw new HelpdeskError(400,'invalid_scope_change','Plano de permissões inválido. Revise pessoa, workspace, capacidades, versão e motivo.');}
}
