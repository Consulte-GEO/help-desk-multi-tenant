import {randomUUID} from 'node:crypto';
import {requestHash} from '../domain/canonical.ts';import {uuidIdentifier} from '../domain/input-values.ts';import {instantMicros} from '../domain/business-calendar.ts';
import {freezeFormData} from '../../shared/form-rules.js';
import {notificationRecord,notificationRef,notificationDigest,createNotificationIntent,NOTIFICATION_KINDS,deliveryFailure,type NotificationIntent} from '../domain/notification-delivery.ts';
export type NotificationPlan=Readonly<{schema:1;eventId:string;sourceHash:string;sourceVersion:number;routingRevision:string;plannedAt:string;state:'planned'|'no_recipients';intentIds:readonly string[]}>;
export interface NotificationPlanTransaction {
 /** SELECT the current immutable, customer-visible source under its row lock. */
 readSource(eventId:string):Promise<unknown>;
 readPlan(eventId:string):Promise<unknown>;
 /** Private routing binds qualified recipient people, channel and immutable template.
  * Planning never substitutes dispatch's fresh recipient authorization. */
 lockRouting(eventId:string):Promise<unknown>;
 /** Atomic unique(eventId) receipt + all intents; conflicts roll back all changes. */
 writePlan(plan:NotificationPlan,intents:readonly NotificationIntent[]):Promise<void>;
}
/** Receives an owned transaction from the private worker, not arbitrary HTTP JSON.
 * No calls to providers, no content/notes copied into delivery records. */
export async function materializeNotificationIntents(tx:NotificationPlanTransaction,eventId:string,at:string):Promise<NotificationPlan>{
 uuidIdentifier(eventId);const now=instantMicros(at),raw=await tx.readSource(eventId);
 // Approval invitation IDs are references, never bearer capabilities in a URL.
 const approval=(raw as {type?:unknown}|null)?.type==='support.approval_requested';
 const s=notificationRecord(raw,['id','workspaceId','accountId','ticketId','type','version','requestId','createdAt',...(approval?['invitationId']:[])]);
 if(s.id!==eventId||!NOTIFICATION_KINDS.includes(s.type as NotificationIntent['kind'])||!Number.isSafeInteger(s.version)||Number(s.version)<1||instantMicros(s.createdAt)>now)throw deliveryFailure('invalid_notification',400);
 for(const k of ['id','workspaceId','accountId','ticketId','requestId',...(approval?['invitationId']:[])])if(uuidIdentifier(s[k])!==s[k])throw deliveryFailure('invalid_notification',400);
 const sourceHash=requestHash(s),prior=await tx.readPlan(eventId);
 if(prior!==null){const p=notificationRecord(prior,['schema','eventId','sourceHash','sourceVersion','routingRevision','plannedAt','state','intentIds']);
  if(p.schema!==1||p.eventId!==eventId||p.sourceHash!==sourceHash||p.sourceVersion!==s.version||!Array.isArray(p.intentIds)||p.intentIds.length>100||new Set(p.intentIds).size!==p.intentIds.length||p.state!==(p.intentIds.length?'planned':'no_recipients')||instantMicros(p.plannedAt)>now)throw deliveryFailure('delivery_plan_conflict',409);
  p.intentIds.forEach(uuidIdentifier);notificationRef(p.routingRevision);return freezeFormData(p) as unknown as NotificationPlan;
 }
 const r=notificationRecord(await tx.lockRouting(eventId),['eventId','workspaceId','accountId','ticketId','sourceVersion','kind','protocol','resourceHash','revision','status','expiresAt','recipients']);
 if(r.eventId!==eventId||r.workspaceId!==s.workspaceId||r.accountId!==s.accountId||r.ticketId!==s.ticketId||r.sourceVersion!==s.version||r.kind!==s.type||r.status!=='published'||instantMicros(r.expiresAt)<=now||!Array.isArray(r.recipients)||r.recipients.length>100)throw deliveryFailure('delivery_routing_unavailable');
 notificationRef(r.revision);notificationDigest(r.resourceHash);const intents:NotificationIntent[]=[],seen=new Set<string>();
 for(const row of r.recipients){const v=notificationRecord(row,['principalId','channelId','templateId','templateVersion','templateHash']);
  const intent=createNotificationIntent({id:randomUUID(),workspaceId:s.workspaceId,accountId:s.accountId,ticketId:s.ticketId,eventId,recipientId:v.principalId,channelId:v.channelId,templateId:v.templateId,templateVersion:v.templateVersion,templateHash:v.templateHash,kind:s.type,sourceVersion:s.version,resourceHash:r.resourceHash,protocol:r.protocol,invitationId:approval?s.invitationId:null,createdAt:at,expiresAt:r.expiresAt});
  // One template per recipient/channel/event; changing a template may not multiply mail.
  const identity=requestHash([intent.recipientId,intent.channelId]);if(seen.has(identity))throw deliveryFailure('invalid_notification',400);seen.add(identity);intents.push(intent);
 }
 const plan:NotificationPlan=freezeFormData({schema:1,eventId,sourceHash,sourceVersion:s.version as number,routingRevision:r.revision as string,plannedAt:at,state:intents.length?'planned':'no_recipients',intentIds:intents.map(i=>i.id)});
 await tx.writePlan(plan,freezeFormData(intents));return plan;
}
