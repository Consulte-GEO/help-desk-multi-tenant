import type {SupportWorkflowEvent} from '../domain/support-workflow.ts';
import type {NotificationKind} from '../domain/notification-delivery.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {instantMicros} from '../domain/business-calendar.ts';
import {statuses} from '../domain/model.ts';

/** Classification of a server-qualified immutable workflow event. This is not
 * an authorization endpoint or an invitation to copy event bodies into mail.
 * SQL must independently qualify the persisted commit and apply the same matrix.
 */
export function mapPublicWorkflowNotification(event:SupportWorkflowEvent):NotificationKind|null {
 try {
  if(!event||typeof event!=='object'||Array.isArray(event))return null;
  const required=['ticketId','workspaceId','profileVersionId','sequence','at','type','actorId','actorKind','from','to'];
  const keys=Object.keys(event);
  if(required.some(k=>!Object.hasOwn(event,k))||keys.some(k=>!required.includes(k)&&k!=='body'))return null;
  for(const id of [event.ticketId,event.workspaceId,event.actorId])if(uuidIdentifier(id)!==id)return null;
  if(!Number.isSafeInteger(event.sequence)||event.sequence<2||typeof event.profileVersionId!=='string'||!event.profileVersionId)return null;
  instantMicros(event.at);
  if(!statuses.includes(event.to)||event.from===null||!statuses.includes(event.from))return null;
  const active=['triage','open','waiting_customer','waiting_internal','waiting_third_party'];
  if(event.type==='customer_reply')return event.actorKind==='customer'&&active.includes(event.from)&&event.from!=='triage'&&(event.to===event.from||event.from==='waiting_customer'&&event.to==='open')?'support.customer_reply':null;
  if(event.actorKind!=='human_agent'&&!(event.actorKind==='customer'&&['closed','reopened'].includes(event.type)))return null;
  switch(event.type){
   case 'transition':return ['new','triage'].includes(event.from)&&event.to==='open'?'support.transition':null;
   case 'reply':return active.includes(event.from)&&event.to===event.from?'support.reply':null;
   case 'devolutiva':return ['triage','open'].includes(event.from)&&event.to==='waiting_customer'?'support.devolutiva':null;
   case 'handoff':return event.from==='open'&&['waiting_internal','waiting_third_party'].includes(event.to)?'support.handoff':null;
   case 'resolved':return active.includes(event.from)&&event.to==='resolved'?'support.resolved':null;
   case 'closed':return event.from==='resolved'&&event.to==='closed'?'support.closed':null;
   case 'reopened':return ['resolved','closed'].includes(event.from)&&event.to==='open'?'support.reopened':null;
   case 'cancelled':return ['new',...active].includes(event.from)&&event.to==='cancelled'?'support.cancelled':null;
   default:return null;
  }
 }catch{return null;}
}
