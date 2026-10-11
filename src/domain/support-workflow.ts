import type {Principal,Ticket,TicketStatus} from './model.ts';
import {statuses} from './model.ts';
import {canReadTicket,isOperator} from './policy.ts';
import {uuidIdentifier} from './input-values.ts';
import {HelpdeskError} from './errors.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {instantMicros} from './business-calendar.ts';
export type SupportTicket=Ticket&{profileVersionId:string;lastEventAt:string;closedAt:string|null;resolution:string|null;approval:'not_required'|'pending'|'approved'};
export type SupportWorkflowProfile=Readonly<{versionId:string;status:'published';reopenWindowMicros:string}>;
export type SupportWorkflowEvent=Readonly<{ticketId:string;workspaceId:string;profileVersionId:string;sequence:number;at:string;type:string;actorId:string;actorKind:'human_agent'|'customer'|'integration'|'automation';from:TicketStatus|null;to:TicketStatus;body?:string}>;
export type WorkflowDecision=Readonly<{after:SupportTicket;event:SupportWorkflowEvent;requirements:readonly {kind:'assignee';principalId:string}[];audit:Readonly<{action:string;reason:string|null}>}>;
const fail=(code:string,status=400)=>new HelpdeskError(status,code,'Transição de atendimento não autorizada ou incompatível.');
const active=['triage','open','waiting_customer','waiting_internal','waiting_third_party'];
const text=(v:unknown)=>{if(typeof v!=='string'||!v.trim()||v.length>12000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\p{Cs}]/u.test(v))throw fail('invalid_workflow_command');return v;};
/** Pure decision, NOT resource authorization or a side effect. Caller must hold
 * the original scoped transaction, locked profile/ticket, then fulfill requirements
 * and persist CAS + immutable event/audit/outbox using the SAME client.
 */
export function decideSupportTransition(p:Principal,rawTicket:SupportTicket,rawProfile:SupportWorkflowProfile,rawCommand:unknown,at:string):WorkflowDecision{
 let t:SupportTicket,profile:SupportWorkflowProfile,c:Record<string,unknown>;
 try{t=copyFormData(rawTicket) as SupportTicket;profile=copyFormData(rawProfile) as SupportWorkflowProfile;c=copyFormData(rawCommand) as Record<string,unknown>;}catch{throw fail('invalid_workflow_command');}
 if(!t||!c||Array.isArray(c)||!statuses.includes(t.status)||!Number.isSafeInteger(t.version)||t.version<1||t.version===Number.MAX_SAFE_INTEGER||!['not_required','pending','approved'].includes(t.approval))throw fail('invalid_workflow_command');
 if(p.kind!=='human'||!p.scopes.includes('tickets:write')||!canReadTicket(p,t))throw fail('workflow_forbidden',403);
 if(!profile||profile.status!=='published'||profile.versionId!==t.profileVersionId||typeof profile.reopenWindowMicros!=='string'||! /^(0|[1-9]\d{0,17})$/.test(profile.reopenWindowMicros))throw fail('workflow_profile_mismatch',409);
 if(!Number.isSafeInteger(c.expectedVersion)||c.expectedVersion!==t.version)throw fail('workflow_version_conflict',412);
 if(instantMicros(at)<instantMicros(t.lastEventAt)||t.closedAt!==null&&(instantMicros(t.closedAt)>instantMicros(at)||instantMicros(t.closedAt)>instantMicros(t.lastEventAt)))throw fail('workflow_time_conflict',409);
 const allowed:Record<string,string[]>={start:[],triage:[],reply:['body'],customer_reply:['body'],request_customer:['body'],handoff:['target','reason'],resolve:['body'],close:[],reopen:['reason'],cancel:['reason'],transfer:['targetPrincipalId','reason']};
 const action=c.action;if(typeof action!=='string'||!Object.hasOwn(allowed,action)||Object.keys(c).length!==2+allowed[action]!.length||!['action','expectedVersion',...allowed[action]!].every(k=>Object.hasOwn(c,k)))throw fail('invalid_workflow_command');
 const operator=isOperator(p,t.workspaceId,t.accountId);if(!operator&&!['customer_reply','close','reopen'].includes(action))throw fail('workflow_forbidden',403);
 if(t.approval==='pending'&&action!=='cancel')throw fail('workflow_approval_required',409);
 const next={...t,version:t.version+1,lastEventAt:at,updatedAt:at},requirements:{kind:'assignee';principalId:string}[]=[];let kind=action,body:string|undefined,reason:string|null=null;
 const requireState=(values:string[])=>{if(!values.includes(t.status))throw fail('workflow_transition_forbidden',409);};
 if(action==='start'){requireState(['new','triage']);next.status='open';kind='transition';}
 else if(action==='triage'){requireState(['new']);next.status='triage';kind='transition';}
 else if(action==='reply'){requireState(active);body=text(c.body);}
 else if(action==='customer_reply'){requireState(['open','waiting_customer','waiting_internal','waiting_third_party']);body=text(c.body);if(t.status==='waiting_customer')next.status='open';}
 else if(action==='request_customer'){requireState(['triage','open']);body=text(c.body);next.status='waiting_customer';kind='devolutiva';}
 else if(action==='handoff'){requireState(['open']);reason=text(c.reason);if(c.target!=='internal'&&c.target!=='third_party')throw fail('invalid_workflow_command');next.status=c.target==='internal'?'waiting_internal':'waiting_third_party';}
 else if(action==='resolve'){requireState(['open','waiting_customer','waiting_internal','waiting_third_party']);body=text(c.body);next.resolution=body;next.status='resolved';kind='resolved';}
 else if(action==='close'){requireState(['resolved']);if(!t.resolution?.trim())throw fail('workflow_resolution_required',409);next.status='closed';next.closedAt=at;kind='closed';}
 else if(action==='reopen'){requireState(['resolved','closed']);reason=text(c.reason);if(t.status==='closed'&&(!t.closedAt||instantMicros(at)-instantMicros(t.closedAt)>BigInt(profile.reopenWindowMicros)))throw fail('workflow_reopen_window_expired',409);next.status='open';next.closedAt=null;kind='reopened';}
 else if(action==='cancel'){requireState(['new',...active]);reason=text(c.reason);next.status='cancelled';kind='cancelled';}
 else if(action==='transfer'){requireState(active);reason=text(c.reason);const principalId=uuidIdentifier(c.targetPrincipalId);next.assignedTo=principalId;requirements.push({kind:'assignee',principalId});kind='assigned';}
 const event:SupportWorkflowEvent={ticketId:t.id,workspaceId:t.workspaceId,profileVersionId:t.profileVersionId,sequence:next.version,at,type:kind,actorId:p.id,actorKind:operator?'human_agent':'customer',from:t.status,to:next.status,...(body!==undefined?{body}:{})};
 return freezeFormData({after:next,event,requirements,audit:{action,reason}});
}
