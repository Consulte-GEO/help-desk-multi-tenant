import type {Principal,Ticket} from '../domain/model.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {hasScope,isOperator} from '../domain/policy.ts';

export type AssignmentAction='claim'|'release';
export function assignmentChangeInput(action:unknown,reason:unknown,version:unknown):{
 action:AssignmentAction;reason:string;expectedVersion:number
}{
 if(!Number.isSafeInteger(version)||Number(version)<1)
  throw new HelpdeskError(428,'precondition_required','Informe a versão atual em If-Match.');
 if(action!=='claim'&&action!=='release')throw new HelpdeskError(400,'invalid_input','Ação de responsabilidade inválida.');
 if(typeof reason!=='string'||!reason.trim()||[...reason.trim()].length>2000||/[\p{Cc}\p{Cs}]/u.test(reason))
  throw new HelpdeskError(400,'invalid_input','Informe um motivo interno de 1 a 2000 caracteres, sem caracteres de controle.');
 return {action,reason:reason.trim(),expectedVersion:Number(version)};
}
/** Presentation only. Assigned ownership is NEVER a grant of access. */
export function assignmentView(p:Principal,t:Ticket){
 // Pre-assignment idempotency snapshots intentionally represent unassigned at that time.
 const assignedTo=t.assignedTo??null;
 const state=assignedTo===null?'unassigned':assignedTo===p.id?'mine':'other';
 const allowed=isOperator(p,t.workspaceId,t.accountId)&&hasScope(p,'tickets:read')&&hasScope(p,'tickets:write')
  &&t.status!=='closed'&&t.status!=='cancelled';
 return {state,can_claim:allowed&&state==='unassigned',can_release:allowed&&state!=='unassigned'&&(state==='mine'||p.workspaceRole==='admin')};
}
