import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {uuidIdentifier} from './input-values.ts';import {requestHash} from './canonical.ts';
import {instantMicros,formatMicros} from './business-calendar.ts';import {HelpdeskError} from './errors.ts';
export const NOTIFICATION_KINDS=['support.created','support.devolutiva','support.customer_reply','support.form_revised','support.resolved','support.approval_requested','support.approval_granted','support.approval_rejected'] as const;
export type NotificationKind=typeof NOTIFICATION_KINDS[number];
export type NotificationIntent=Readonly<{id:string;workspaceId:string;accountId:string;ticketId:string;eventId:string;recipientId:string;channelId:string;templateId:string;templateVersion:number;templateHash:string;kind:NotificationKind;sourceVersion:number;resourceHash:string;protocol:string;invitationId:string|null;createdAt:string;expiresAt:string;idempotencyKey:string}>;
export type DeliveryState='pending'|'retry_wait'|'leased'|'sending'|'unknown'|'accepted'|'delivered'|'failed'|'suppressed';
export type DeliveryRecord=Readonly<{intent:NotificationIntent;revision:number;state:DeliveryState;attempts:number;lease:Readonly<{id:string;workerId:string;expiresAt:string}>|null;requestHash:string|null;providerMessageId:string|null;providerSequence:number;providerEventAt:string|null;nextAttemptAt:string|null;lastReason:string|null;attention:boolean;updatedAt:string}>;
export type DeliveryPolicy=Readonly<{maxAttempts:number;backoffMicros:readonly string[];leaseMicros:string;sendTimeoutMs:number}>;
export type ProviderDeliveryEvent=Readonly<{intentId:string;channelId:string;idempotencyKey:string;recipientId:string;providerMessageId:string;sequence:number;outcome:'accepted'|'delivered'|'failed';occurredAt:string}>;
export const deliveryFailure=(code='delivery_unavailable',status=503)=>new HelpdeskError(status,code,'Não foi possível confirmar o estado da notificação. Consulte o registro antes de tentar outra ação.');
export function notificationRecord(raw:unknown,keys:readonly string[]):Record<string,unknown>{try{const r=copyFormData(raw) as Record<string,unknown>;if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==keys.length||keys.some(k=>!Object.hasOwn(r,k)))throw Error();return r;}catch{throw deliveryFailure('invalid_notification',400);}}
export function notificationRef(v:unknown,max=160):string{if(typeof v!=='string'||v.length>max||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v))throw deliveryFailure('invalid_notification',400);return v;}
export function notificationDigest(v:unknown):string{if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))throw deliveryFailure('invalid_notification',400);return v;}
function integer(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER){if(!Number.isSafeInteger(v)||Number(v)<min||Number(v)>max)throw deliveryFailure('invalid_notification',400);return v as number;}
const inputKeys=['id','workspaceId','accountId','ticketId','eventId','recipientId','channelId','templateId','templateVersion','templateHash','kind','sourceVersion','resourceHash','protocol','invitationId','createdAt','expiresAt'];
/** Call only from the private outbox materializer with pinned recipient and template.
 * No body, form answers, internal notes, tokens, URLs or email addresses are allowed. */
export function createNotificationIntent(raw:unknown):NotificationIntent{
 const r=notificationRecord(raw,inputKeys);
 for(const k of ['id','workspaceId','accountId','ticketId','eventId','recipientId'])r[k]=uuidIdentifier(r[k]);
 for(const k of ['channelId','templateId'])notificationRef(r[k]);integer(r.templateVersion,1);integer(r.sourceVersion,1);notificationDigest(r.resourceHash);notificationDigest(r.templateHash);
 if(!NOTIFICATION_KINDS.includes(r.kind as NotificationKind)||typeof r.protocol!=='string'||!/^CG-[1-9]\d{4,17}$/.test(r.protocol)||instantMicros(r.expiresAt)<=instantMicros(r.createdAt))throw deliveryFailure('invalid_notification',400);
 if(r.invitationId!==null)r.invitationId=uuidIdentifier(r.invitationId);
 if((r.kind==='support.approval_requested')!==(r.invitationId!==null))throw deliveryFailure('invalid_notification',400);
 const key=requestHash(['helpdesk-notification-v1',r.workspaceId,r.eventId,r.recipientId,r.channelId,r.templateId,r.templateVersion]);
 return freezeFormData({...r,idempotencyKey:key}) as unknown as NotificationIntent;
}
export function parseNotificationIntent(raw:unknown):NotificationIntent{const r=notificationRecord(raw,[...inputKeys,'idempotencyKey']);const {idempotencyKey,...input}=r;const i=createNotificationIntent(input);if(idempotencyKey!==i.idempotencyKey)throw deliveryFailure('invalid_notification',400);return i;}
export function parseDeliveryPolicy(raw:unknown):DeliveryPolicy{
 const p=notificationRecord(raw,['maxAttempts','backoffMicros','leaseMicros','sendTimeoutMs']);integer(p.maxAttempts,1,10);integer(p.sendTimeoutMs,1,120000);
 const micros=(v:unknown)=>{if(typeof v!=='string'||!/^[1-9]\d{0,11}$/.test(v))throw deliveryFailure('invalid_notification',400);return BigInt(v);};
 if(!Array.isArray(p.backoffMicros)||!p.backoffMicros.length||p.backoffMicros.length>10||p.backoffMicros.some(v=>micros(v)>86400000000n)||micros(p.leaseMicros)>300000000n||BigInt(p.sendTimeoutMs as number)*1000n>=micros(p.leaseMicros))throw deliveryFailure('invalid_notification',400);
 return freezeFormData(p) as unknown as DeliveryPolicy;
}
export function newDeliveryRecord(raw:NotificationIntent,at:string):DeliveryRecord{
 const intent=parseNotificationIntent(raw);if(instantMicros(at)<instantMicros(intent.createdAt))throw deliveryFailure('delivery_time_conflict',409);
 return freezeFormData({intent,revision:1,state:'pending',attempts:0,lease:null,requestHash:null,providerMessageId:null,providerSequence:0,providerEventAt:null,nextAttemptAt:null,lastReason:null,attention:false,updatedAt:at});
}
export function parseDeliveryRecord(raw:unknown):DeliveryRecord{
 const r=notificationRecord(raw,['intent','revision','state','attempts','lease','requestHash','providerMessageId','providerSequence','providerEventAt','nextAttemptAt','lastReason','attention','updatedAt']);r.intent=parseNotificationIntent(r.intent);integer(r.revision,1);integer(r.attempts,0,10);integer(r.providerSequence,0);instantMicros(r.updatedAt);
 if(!['pending','retry_wait','leased','sending','unknown','accepted','delivered','failed','suppressed'].includes(r.state as string)||typeof r.attention!=='boolean')throw deliveryFailure('invalid_notification',400);
 if(r.lease!==null){const l=notificationRecord(r.lease,['id','workerId','expiresAt']);uuidIdentifier(l.id);notificationRef(l.workerId);instantMicros(l.expiresAt);r.lease=l;}
 if(['leased','sending'].includes(r.state as string)!==(r.lease!==null)||r.state==='retry_wait'&&r.nextAttemptAt===null)throw deliveryFailure('invalid_notification',400);
 if(r.requestHash!==null)notificationDigest(r.requestHash);if(r.providerMessageId!==null)notificationRef(r.providerMessageId);
 for(const k of ['providerEventAt','nextAttemptAt'])if(r[k]!==null)instantMicros(r[k]);if(r.lastReason!==null)notificationRef(r.lastReason,80);
 if((r.attempts===0)!==(r.requestHash===null)||r.attempts===0&&(r.providerMessageId!==null||r.providerSequence!==0||['sending','unknown','accepted','delivered','failed'].includes(r.state as string))
  ||(r.providerSequence===0)!==(r.providerEventAt===null)||Number(r.providerSequence)>0&&r.providerMessageId===null
  ||['accepted','delivered'].includes(r.state as string)&&r.providerMessageId===null||r.state==='delivered'&&r.providerSequence===0
  ||r.state!=='retry_wait'&&r.nextAttemptAt!==null||instantMicros(r.updatedAt)<instantMicros((r.intent as NotificationIntent).createdAt))throw deliveryFailure('invalid_notification',400);
 return freezeFormData(r) as unknown as DeliveryRecord;
}
function checked(raw:DeliveryRecord,at:string):DeliveryRecord{const r=parseDeliveryRecord(raw);if(instantMicros(at)<instantMicros(r.updatedAt))throw deliveryFailure('delivery_time_conflict',409);return r;}
function changed(r:DeliveryRecord,at:string,values:Partial<DeliveryRecord>):DeliveryRecord{if(r.revision===Number.MAX_SAFE_INTEGER)throw deliveryFailure('delivery_state_conflict',409);return freezeFormData({...r,...values,revision:r.revision+1,updatedAt:at});}
function lease(r:DeliveryRecord,id:string,at:string){if(!r.lease||r.lease.id!==id||instantMicros(r.lease.expiresAt)<=instantMicros(at))throw deliveryFailure('delivery_lease_lost',409);}
/** Application/store must persist every returned revision with CAS and their lease
 * under a transaction. Pure transitions do not provide a distributed lock. */
export function recoverDeliveryLease(raw:DeliveryRecord,at:string):DeliveryRecord{
 const r=checked(raw,at),now=instantMicros(at);
 if(r.state==='sending'&&r.lease&&instantMicros(r.lease.expiresAt)<=now)return changed(r,at,{state:'unknown',lease:null,nextAttemptAt:null,lastReason:'send_confirmation_unknown',attention:true});
 if(['pending','retry_wait','leased'].includes(r.state)&&instantMicros(r.intent.expiresAt)<=now)return changed(r,at,{state:'suppressed',lease:null,nextAttemptAt:null,lastReason:'intent_expired'});
 if(r.state==='leased'&&r.lease&&instantMicros(r.lease.expiresAt)<=now)return changed(r,at,{state:'pending',lease:null,nextAttemptAt:null,lastReason:'unsent_lease_expired'});
 return r;
}
export function claimNotification(raw:DeliveryRecord,workerId:string,leaseId:string,until:string,at:string):DeliveryRecord{
 const r=checked(raw,at),now=instantMicros(at);notificationRef(workerId);uuidIdentifier(leaseId);
 if(!['pending','retry_wait'].includes(r.state)||r.nextAttemptAt!==null&&instantMicros(r.nextAttemptAt)>now||instantMicros(r.intent.expiresAt)<=now||instantMicros(until)<=now||instantMicros(until)-now>300000000n)throw deliveryFailure('delivery_state_conflict',409);
 return changed(r,at,{state:'leased',lease:{id:leaseId,workerId,expiresAt:until},nextAttemptAt:null,lastReason:null});
}
export function startNotificationSend(raw:DeliveryRecord,id:string,payloadHash:string,at:string):DeliveryRecord{
 const r=checked(raw,at);lease(r,id,at);notificationDigest(payloadHash);
 if(r.state!=='leased'||instantMicros(r.intent.expiresAt)<=instantMicros(at)||r.attempts>=10)throw deliveryFailure('delivery_state_conflict',409);
 if(r.requestHash!==null&&r.requestHash!==payloadHash)throw deliveryFailure('delivery_payload_changed',409);
 return changed(r,at,{state:'sending',attempts:r.attempts+1,requestHash:payloadHash,lastReason:null});
}
/** Suppression/retry before send cannot describe an unknown remote side effect. */
export function stopUnsentNotification(raw:DeliveryRecord,id:string,reason:'recipient_revoked'|'recipient_changed'|'template_unavailable'|'intent_expired'|'recipient_unavailable',at:string,retryAt:string|null=null):DeliveryRecord{
 const r=checked(raw,at);lease(r,id,at);if(r.state!=='leased')throw deliveryFailure('delivery_state_conflict',409);
 const retry=reason==='recipient_unavailable'&&retryAt!==null&&instantMicros(retryAt)>instantMicros(at)&&instantMicros(retryAt)<instantMicros(r.intent.expiresAt);
 return changed(r,at,{state:retry?'retry_wait':'suppressed',lease:null,nextAttemptAt:retry?retryAt:null,lastReason:reason});
}
/** Malformed or absent acknowledgements are UNKNOWN. Only an explicit adapter
 * attestation of non-acceptance may schedule retry; a generic exception cannot. */
export function finishNotificationSend(raw:DeliveryRecord,id:string,response:unknown,at:string,rawPolicy:DeliveryPolicy):DeliveryRecord{
 const r=checked(raw,at);lease(r,id,at);if(r.state!=='sending')throw deliveryFailure('delivery_state_conflict',409);const p=parseDeliveryPolicy(rawPolicy);
 let x:Record<string,unknown>|null=null;
 try{const v=copyFormData(response) as Record<string,unknown>;if(v?.state==='accepted'){x=notificationRecord(v,['state','providerMessageId']);notificationRef(x.providerMessageId);}else if(v?.state==='not_accepted'){x=notificationRecord(v,['state','retryable','reason']);if(typeof x.retryable!=='boolean'||!['rate_limited','temporarily_unavailable','rejected'].includes(x.reason as string)||x.retryable===true&&x.reason==='rejected')throw Error();}}catch{x=null;}
 if(x?.state==='accepted')return changed(r,at,{state:'accepted',providerMessageId:x.providerMessageId as string,lease:null,nextAttemptAt:null,lastReason:null});
 if(x?.state==='not_accepted'){
  const backoff=p.backoffMicros[Math.min(r.attempts-1,p.backoffMicros.length-1)]!,next=formatMicros(instantMicros(at)+BigInt(backoff));
  const retry=x.retryable===true&&r.attempts<p.maxAttempts&&instantMicros(next)<instantMicros(r.intent.expiresAt);
  return changed(r,at,{state:retry?'retry_wait':'failed',lease:null,nextAttemptAt:retry?next:null,lastReason:x.reason as string});
 }
 return changed(r,at,{state:'unknown',lease:null,nextAttemptAt:null,lastReason:'send_confirmation_unknown',attention:true});
}
/** Only qualified, authenticated provider evidence may reach this pure reducer.
 * The caller must deduplicate event IDs/hash under the SAME record lock. */
export function applyProviderDelivery(raw:DeliveryRecord,event:ProviderDeliveryEvent,at:string):DeliveryRecord{
 const r=checked(raw,at);let e:ProviderDeliveryEvent;
 try{e=notificationRecord(event,['intentId','channelId','idempotencyKey','recipientId','providerMessageId','sequence','outcome','occurredAt']) as unknown as ProviderDeliveryEvent;notificationRef(e.providerMessageId);integer(e.sequence,1);
  if(e.intentId!==r.intent.id||e.channelId!==r.intent.channelId||e.idempotencyKey!==r.intent.idempotencyKey||e.recipientId!==r.intent.recipientId||r.providerMessageId!==null&&e.providerMessageId!==r.providerMessageId||!['accepted','delivered','failed'].includes(e.outcome)||instantMicros(e.occurredAt)>instantMicros(at)||instantMicros(e.occurredAt)<instantMicros(r.intent.createdAt))throw Error();
 }catch{throw deliveryFailure('delivery_receipt_mismatch',409);}
 if(r.attempts<1||!['pending','leased','retry_wait','sending','unknown','accepted','delivered','failed','suppressed'].includes(r.state))throw deliveryFailure('delivery_state_conflict',409);
 if(e.sequence<r.providerSequence)return r;
 if(e.sequence===r.providerSequence){if(e.outcome===r.state&&e.occurredAt===r.providerEventAt)return r;return changed(r,at,{attention:true,lastReason:'contradictory_provider_event'});}
 if(r.providerEventAt!==null&&instantMicros(e.occurredAt)<instantMicros(r.providerEventAt))throw deliveryFailure('delivery_receipt_mismatch',409);
 const terminal=['delivered','failed'].includes(r.state),contradiction=terminal&&e.outcome!==r.state||['pending','leased','retry_wait','suppressed'].includes(r.state);
 return changed(r,at,{state:terminal?r.state:e.outcome,providerMessageId:e.providerMessageId,providerSequence:e.sequence,providerEventAt:e.occurredAt,lease:null,nextAttemptAt:null,attention:contradiction||r.attention&&terminal,lastReason:contradiction?'contradictory_provider_event':null});
}
/** Public operational projection deliberately omits recipient, secret/provider key,
 * addresses, raw payloads and request hashes. Caller still needs scoped capability. */
export function deliveryView(raw:DeliveryRecord){const r=parseDeliveryRecord(raw);return freezeFormData({intentId:r.intent.id,ticketId:r.intent.ticketId,eventId:r.intent.eventId,version:r.revision,state:r.state,attempts:r.attempts,templateId:r.intent.templateId,templateVersion:r.intent.templateVersion,nextAttemptAt:r.nextAttemptAt,attention:r.attention,reason:r.lastReason,updatedAt:r.updatedAt});}
