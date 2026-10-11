import {HelpdeskError} from './errors.ts';
import {statuses,type TicketStatus} from './model.ts';
import type {SupportWorkflowEvent} from './support-workflow.ts';
import {createBusinessCalendar,instantMicros,type BusinessCalendarVersion} from './business-calendar.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {requestHash} from './canonical.ts';
export type PublishedSlaPolicy=Readonly<{versionId:string;status:'published';profileVersionId:string;calendar:BusinessCalendarVersion;firstResponseMicros:string;solutionMicros:string;startStates:readonly TicketStatus[];pausedSolutionStates:readonly TicketStatus[]}>;
export type ClockProjection=Readonly<{started:boolean;completed:boolean;cancelled:boolean;dueAt:string|null;consumedMicros:string;policyVersionId:string;violation:boolean;reason:'not_started'|'paused'|'cancelled'|'calendar_horizon'|null}>;
export type SlaTicket=Readonly<{id:string;workspaceId:string;profileVersionId:string;slaPolicyVersionId:string;version:number;status:TicketStatus}>;
const invalid=()=>new HelpdeskError(400,'invalid_sla_projection','Histórico ou política insuficientes para calcular os prazos.');
const terminal=['resolved','closed','cancelled'];
const kinds=['created','transition','reply','customer_reply','devolutiva','handoff','resolved','closed','reopened','cancelled','assigned','note','automation','approval_granted','approval_rejected','form_revised'];
const ref=(v:unknown)=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
/** Qualified interval versions + COMPLETE, already authorized event stream only.
 * It is not an event authenticator, query/ACL implementation or commercial policy.
 * Policies remain pinned by id. Inactive periods never erase historical violations.
 */
export function projectClocks(rawTicket:SlaTicket,rawEvents:readonly SupportWorkflowEvent[],rawPolicy:PublishedSlaPolicy,at:string){
 let t:SlaTicket,events:SupportWorkflowEvent[],p:PublishedSlaPolicy;let calendar:ReturnType<typeof createBusinessCalendar>;
 try{
  t=copyFormData(rawTicket) as SlaTicket;events=copyFormData(rawEvents) as SupportWorkflowEvent[];p=copyFormData(rawPolicy) as PublishedSlaPolicy;
  if(!t||!p||!Array.isArray(events)||!events.length||events.length>2000||!ref(t.id)||!ref(t.workspaceId)||!ref(p.versionId)||!ref(p.profileVersionId)||p.status!=='published'||p.versionId!==t.slaPolicyVersionId||p.profileVersionId!==t.profileVersionId||!Number.isSafeInteger(t.version)||events.length!==t.version||!statuses.includes(t.status))throw invalid();
  for(const n of [p.firstResponseMicros,p.solutionMicros])if(typeof n!=='string'||! /^(0|[1-9]\d{0,17})$/.test(n))throw invalid();
  for(const list of [p.startStates,p.pausedSolutionStates])if(!Array.isArray(list)||list.length>statuses.length||new Set(list).size!==list.length||list.some(s=>!statuses.includes(s)||terminal.includes(s)))throw invalid();
  if(!p.startStates.length)throw invalid();
  calendar=createBusinessCalendar(p.calendar);calendar.between(events[0]!.at,at);
  let state:TicketStatus|null=null,previous=instantMicros(events[0]!.at);const end=instantMicros(at);
  for(let i=0;i<events.length;i++){
   const e=events[i]!;const tick=instantMicros(e.at);
   if(e.ticketId!==t.id||e.workspaceId!==t.workspaceId||e.profileVersionId!==t.profileVersionId||e.sequence!==i+1||!kinds.includes(e.type)||!['human_agent','customer','integration','automation'].includes(e.actorKind)||!ref(e.actorId)||e.from!==state||!statuses.includes(e.to)||tick<previous||tick>end||(i===0?(e.type!=='created'||terminal.includes(e.to)):e.type==='created'))throw invalid();
   if(state==='cancelled'||state==='closed'&&e.type!=='reopened'||state==='resolved'&&!['closed','reopened'].includes(e.type))throw invalid();
   const hasBody=typeof e.body==='string'&&!!e.body.trim()&&e.body.length<=12000;
   if(['reply','customer_reply','devolutiva','resolved'].includes(e.type)&&!hasBody)throw invalid();
   if(['approval_granted','approval_rejected','form_revised'].includes(e.type)&&!['customer','human_agent'].includes(e.actorKind))throw invalid();
   if(e.type==='approval_granted'&&(!['new','triage'].includes(e.from??'')||!['triage','open'].includes(e.to)))throw invalid();
   if(e.type==='approval_rejected'&&(!['new','triage'].includes(e.from??'')||e.to!=='waiting_customer'))throw invalid();
   if(e.type==='form_revised'&&(e.from!=='waiting_customer'||!['open','triage'].includes(e.to)))throw invalid();
   if(e.type==='resolved'&&(e.to!=='resolved'||e.actorKind!=='human_agent'))throw invalid();
   if(e.type==='closed'&&(state!=='resolved'||e.to!=='closed'))throw invalid();
   if(e.type==='cancelled'&&e.to!=='cancelled')throw invalid();
   if(e.type==='reopened'&&(!['closed','resolved'].includes(state??'')||e.to!=='open'))throw invalid();
   if(['reply','assigned','note','automation'].includes(e.type)&&e.from!==e.to)throw invalid();
   if(e.type==='devolutiva'&&(e.actorKind!=='human_agent'||e.to!=='waiting_customer'))throw invalid();
   if(i&&terminal.includes(e.to)&&!['resolved','closed','cancelled'].includes(e.type))throw invalid();
   state=e.to;previous=tick;
  }
  if(state!==t.status)throw invalid();
 }catch(e){if(e instanceof HelpdeskError&&e.code==='calendar_horizon_exceeded')throw e;throw invalid();}
 const budgetFirst=BigInt(p.firstResponseMicros),budgetSolution=BigInt(p.solutionMicros);
 let started=false,cancelled=false,firstDone=false,solutionDone=false,firstAt:string|undefined,solutionAt:string|undefined;
 let first=0n,solution=0n,firstDeadline:string|null=null,solutionDeadline:string|null=null,firstViolated=false,solutionViolated=false;
 let state=events[0]!.to,last=events[0]!.at;
 if(p.startStates.includes(state))started=true;
 const accrue=(end:string)=>{
  if(started&&!cancelled){
   const delta=calendar.between(last,end);
   if(!firstDone){if(firstDeadline===null&&first<=budgetFirst&&first+delta>=budgetFirst)firstDeadline=calendar.dueAfter(last,budgetFirst-first);first+=delta;firstViolated ||= first>budgetFirst;}
   if(!solutionDone&&!p.pausedSolutionStates.includes(state)){if(solutionDeadline===null&&solution<=budgetSolution&&solution+delta>=budgetSolution)solutionDeadline=calendar.dueAfter(last,budgetSolution-solution);solution+=delta;solutionViolated ||= solution>budgetSolution;}
  }
  last=end;
 };
 for(const e of events.slice(1)){
  accrue(e.at);state=e.to;if(!started&&p.startStates.includes(state))started=true;
  if(started&&!cancelled&&!firstDone&&e.actorKind==='human_agent'&&['reply','devolutiva','resolved'].includes(e.type)){firstDone=true;firstAt=e.at;}
  if(e.type==='resolved'){solutionDone=true;solutionAt=e.at;}
  if(e.type==='reopened'){solutionDone=false;solutionAt=undefined;}
  if(e.type==='cancelled')cancelled=true;
 }
 accrue(at);
 const finish=(spent:bigint,budget:bigint,completed:boolean,completedAt:string|undefined,deadline:string|null,violated:boolean,paused:boolean):ClockProjection=>{
  let due=deadline,reason:ClockProjection['reason']=null;
  if(!started){due=null;reason='not_started';}
  else if(cancelled&&!completed){due=null;reason='cancelled';}
  else if(paused&&!completed&&!due)reason='paused';
  else if(!due){due=calendar.dueAfter(completedAt??at,budget>spent?budget-spent:0n);if(due===null)reason='calendar_horizon';}
  return Object.freeze({started,completed,cancelled,dueAt:due,consumedMicros:String(spent),policyVersionId:p.versionId,violation:violated,reason});
 };
 return freezeFormData({ticketId:t.id,workspaceId:t.workspaceId,sourceVersion:t.version,policyVersionId:p.versionId,calendarVersionId:p.calendar.versionId,asOf:at,
  firstResponse:finish(first,budgetFirst,firstDone,firstAt,firstDeadline,firstViolated,false),
  solution:finish(solution,budgetSolution,solutionDone,solutionAt,solutionDeadline,solutionViolated,p.pausedSolutionStates.includes(state))});
}
/** Input code must already have passed the versioned form/impact validation. */
export function derivePriority(impact:unknown,raw:unknown):'urgent'|'high'|'normal'|'low'{
 try{const v=copyFormData(raw) as {id:string;status:string;priorities:Record<string,string>};if(!v||!ref(v.id)||v.status!=='published'||!v.priorities||typeof v.priorities!=='object'||Array.isArray(v.priorities)||Object.keys(v.priorities).length>100||typeof impact!=='string'||!Object.hasOwn(v.priorities,impact))throw invalid();const map={P1:'urgent',P2:'high',P3:'normal',P4:'low'} as const;if(Object.values(v.priorities).some(s=>!Object.hasOwn(map,s)))throw invalid();return map[v.priorities[impact] as keyof typeof map];}catch{throw new HelpdeskError(400,'invalid_priority_policy','Impacto sem classificação publicada válida.');}
}
/** Pure deterministic proposals, NOT a delivery worker or distributed lease.
 * No auto-cancel/close operation exists. A dispatcher must reauthorize recipients
 * and persist its existing delivery ledger before any provider call.
 */
export function planClockReminders(t:SlaTicket,r:ReturnType<typeof projectClocks>,options:{enabled:boolean;channelApproved:boolean}){
 if(options.enabled!==true||options.channelApproved!==true)return [];
 if(r.ticketId!==t.id||r.workspaceId!==t.workspaceId||r.sourceVersion!==t.version||r.policyVersionId!==t.slaPolicyVersionId)throw invalid();
 return (['firstResponse','solution'] as const).filter(k=>r[k].violation&&!r[k].completed&&!r[k].cancelled).map(clock=>Object.freeze({kind:'reminder_proposal',intentKey:requestHash([t.workspaceId,t.id,t.slaPolicyVersionId,clock,'violated']),ticketId:t.id,policyVersionId:t.slaPolicyVersionId,sourceVersion:t.version,clock,deliveryState:'not_requested'}));
}
