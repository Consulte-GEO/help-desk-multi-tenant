import {performance} from 'node:perf_hooks';
import {requestHash} from '../domain/canonical.ts';import {uuidIdentifier} from '../domain/input-values.ts';
import {instantMicros,formatMicros} from '../domain/business-calendar.ts';
import {freezeFormData} from '../../shared/form-rules.js';
import {parseDeliveryRecord,parseDeliveryPolicy,notificationRecord,notificationRef,deliveryFailure,startNotificationSend,stopUnsentNotification,finishNotificationSend,applyProviderDelivery,deliveryView,type NotificationIntent,type DeliveryRecord,type DeliveryPolicy,type ProviderDeliveryEvent} from '../domain/notification-delivery.ts';
import {renderNotification} from '../integrations/notifications/templates.ts';import type {VerifiedDeliveryEvent} from '../integrations/notifications/signed-events.ts';
export interface DeliveryTransaction {
 read():Promise<unknown>;
 /** CAS + audit must persist atomically. No raw provider payload or address in audit. */
 save(record:DeliveryRecord,expectedRevision:number,audit:{type:string;at:string;intentId:string;actorId?:string;requestId?:string}):Promise<void>;
 readEvent(eventId:string):Promise<string|null>;
 saveEvent(eventId:string,eventHash:string):Promise<void>;
}
export interface NotificationDeliveryStore {
 /** Must recover expired SENDING as UNKNOWN, never as pending; lock/CAS before return.
  * A ready row may be claimed only once across all workers and only within limit.
  * Production requires a restricted private worker role and RLS/TTL checks in SQL.
  */
 claimDelivery(input:{workerId:string;at:string;until:string;limit:number}):Promise<unknown[]>;
 locked<T>(intentId:string,work:(tx:DeliveryTransaction)=>Promise<T>):Promise<T>;
 getTemplate(id:string,version:number):Promise<unknown>;
}
export interface NotificationRecipientAuthority {
 /** Server-configured source, not caller email/headers or expired human bearer. */
 authorize(intent:NotificationIntent,signal:AbortSignal):Promise<unknown>;
}
export interface NotificationChannel {
 readonly id:string;
 /** Resolve accepted only with provider evidence. An exception means unknown, not not-accepted. */
 send(message:Readonly<{to:string;subject:string;text:string;html:string;idempotencyKey:string}>,signal:AbortSignal):Promise<unknown>;
 /** Read-only evidence lookup. Absence never authorizes a resend. */
 lookup(intent:NotificationIntent,signal:AbortSignal):Promise<ProviderDeliveryEvent|null>;
}
export type DeliveryStatus=ReturnType<typeof deliveryView>;
async function bounded<T>(ms:number,work:(signal:AbortSignal)=>Promise<T>):Promise<T>{
 const controller=new AbortController(),started=performance.now();let timer:ReturnType<typeof setTimeout>|undefined;
 const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(deliveryFailure());},ms);});
 try{const value=await Promise.race([Promise.resolve().then(()=>work(controller.signal)),timeout]);if(performance.now()-started>=ms)throw deliveryFailure();return value;}
 finally{clearTimeout(timer);controller.abort();}
}
function recipient(raw:unknown,i:NotificationIntent,at:string):{address:string;expiresAt:string}|null{
 const r=notificationRecord(raw,['intentId','workspaceId','accountId','recipientId','channelId','resourceHash','revision','decision','address','expiresAt']);
 for(const field of ['intentId','workspaceId','accountId','recipientId','channelId','resourceHash'])if(r[field]!==({intentId:i.id,...i} as Record<string,unknown>)[field])throw deliveryFailure('recipient_changed',403);
 notificationRef(r.revision);if(!['allowed','revoked'].includes(r.decision as string))throw deliveryFailure();
 if(r.decision==='revoked'||instantMicros(r.expiresAt)<=instantMicros(at))return null;
 if(typeof r.address!=='string'||r.address.length>254||! /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,63}$/.test(r.address))throw deliveryFailure('recipient_changed',403);
 return {address:r.address,expiresAt:r.expiresAt as string};
}
/** One bounded iteration. No scheduler/provisioning and no live provider is selected.
 * All methods are server-internal. HTTP operator access must add live capability/ACL.
 */
export function createOutboxDispatcher(options:{store:NotificationDeliveryStore;authority:NotificationRecipientAuthority;channel:NotificationChannel;verifier:{verify(headers:Headers,bytes:Uint8Array):VerifiedDeliveryEvent};portalOrigin:string;clock?:()=>string;policy:DeliveryPolicy}){
 const policy=parseDeliveryPolicy(options.policy),clock=options.clock??(()=>new Date().toISOString()),channelId=notificationRef(options.channel.id),store=options.store;
 const now=()=>{const at=clock();instantMicros(at);return at;};
 const unavailable=(id:string)=>freezeFormData({intentId:id,state:'unknown',attention:true,reason:'ledger_confirmation_unknown'});
 const audit=(record:DeliveryRecord,type:string,at:string)=>({intentId:record.intent.id,type,at});
 async function withRecord<T>(id:string,work:(tx:DeliveryTransaction,r:DeliveryRecord)=>Promise<T>){uuidIdentifier(id);return store.locked(id,async tx=>{const r=parseDeliveryRecord(await tx.read());if(r.intent.id!==id||r.intent.channelId!==channelId)throw deliveryFailure('delivery_receipt_mismatch',409);return work(tx,r);});}
 async function stop(r:DeliveryRecord,reason:Parameters<typeof stopUnsentNotification>[2],retry=false){
  return withRecord(r.intent.id,async(tx,current)=>{const at=now();if(current.state!=='leased'||!current.lease||current.lease.id!==r.lease?.id)throw deliveryFailure('delivery_lease_lost',409);
   const next=stopUnsentNotification(current,current.lease.id,reason,at,retry?formatMicros(instantMicros(at)+BigInt(policy.backoffMicros[0]!)):null);await tx.save(next,current.revision,audit(next,'delivery.pre_send_stopped',at));return deliveryView(next);
  });
 }
 async function dispatchNotification(claim:unknown):Promise<DeliveryStatus|ReturnType<typeof unavailable>>{
  const r=parseDeliveryRecord(claim);if(r.intent.channelId!==channelId||r.state!=='leased'||!r.lease)throw deliveryFailure('delivery_lease_lost',409);
  const id=r.intent.id;let target:{address:string;expiresAt:string}|null;
  try{
   if(instantMicros(r.lease.expiresAt)<=instantMicros(now()))throw deliveryFailure();
   let raw:unknown;try{raw=await bounded(policy.sendTimeoutMs,s=>options.authority.authorize(r.intent,s));}catch{return await stop(r,'recipient_unavailable',true);}
   try{target=recipient(raw,r.intent,now());}catch{return await stop(r,'recipient_changed');}
   if(!target)return await stop(r,'recipient_revoked');
   let rendered:ReturnType<typeof renderNotification>;
   try{rendered=renderNotification(r.intent,await bounded(policy.sendTimeoutMs,()=>store.getTemplate(r.intent.templateId,r.intent.templateVersion)),options.portalOrigin);}catch{return await stop(r,'template_unavailable');}
   const message=freezeFormData({to:target.address,...rendered,idempotencyKey:r.intent.idempotencyKey}),hash=requestHash(message);
   if(r.requestHash!==null&&r.requestHash!==hash)return await stop(r,'recipient_changed');
   const sendRecord=await withRecord(id,async(tx,current)=>{const at=now();if(current.revision!==r.revision||current.attempts>=policy.maxAttempts||instantMicros(target!.expiresAt)<=instantMicros(at))throw deliveryFailure('delivery_lease_lost',409);
    const next=startNotificationSend(current,r.lease!.id,hash,at);await tx.save(next,current.revision,audit(next,'delivery.send_started',at));return next;
   });
   // A lost COMMIT above never reaches this call. If it did persist, recovery will
   // conservatively see SENDING/UNKNOWN, not blindly retry a potentially sent message.
   let response:unknown;const at=now();
   if(instantMicros(target.expiresAt)<=instantMicros(at)||instantMicros(sendRecord.lease!.expiresAt)<=instantMicros(at)||instantMicros(r.intent.expiresAt)<=instantMicros(at))response={state:'not_accepted',retryable:false,reason:'rejected'};
   else{try{response=await bounded(policy.sendTimeoutMs,s=>options.channel.send(message,s));}catch{response=null;}}
   return await withRecord(id,async(tx,current)=>{
    // An authenticated callback may have settled this record while the send awaited ACK.
    if(current.state!=='sending'||current.lease?.id!==r.lease!.id)return deliveryView(current);
    const at=now(),next=finishNotificationSend(current,r.lease!.id,response,at,policy);await tx.save(next,current.revision,audit(next,'delivery.send_observed',at));
    // A durable store may reconcile an authenticated native callback retained
    // before ACK under this same record lock. Return that persisted state.
    const observed=parseDeliveryRecord(await tx.read());
    if(requestHash(observed.intent)!==requestHash(next.intent)||observed.revision<next.revision)throw deliveryFailure('delivery_receipt_mismatch',409);
    return deliveryView(observed);
   });
  }catch{return unavailable(id);}
 }
 async function runOnce(workerId:string,limit:number=1){notificationRef(workerId);if(!Number.isSafeInteger(limit)||limit<1||limit>10)throw deliveryFailure('invalid_notification',400);
  const at=now(),until=formatMicros(instantMicros(at)+BigInt(policy.leaseMicros)),claims=await store.claimDelivery({workerId,at,until,limit});
  if(!Array.isArray(claims)||claims.length>limit)throw deliveryFailure();
  const parsed=claims.map(parseDeliveryRecord),seen=new Set<string>();for(const r of parsed){if(r.state!=='leased'||r.lease?.workerId!==workerId||r.intent.channelId!==channelId||seen.has(r.intent.id)||instantMicros(r.lease.expiresAt)>instantMicros(until))throw deliveryFailure();seen.add(r.intent.id);}
  const results=[];for(const r of parsed)results.push(await dispatchNotification(r));return results;
 }
 async function acceptDeliveryEvent(headers:Headers,bytes:Uint8Array):Promise<DeliveryStatus>{
  const verified=options.verifier.verify(headers,bytes);
  return withRecord(verified.event.intentId,async(tx,current)=>{
   const old=await tx.readEvent(verified.eventId);if(old!==null){if(old!==verified.eventHash)throw deliveryFailure('delivery_event_conflict',409);return deliveryView(current);}
   const at=now(),next=applyProviderDelivery(current,verified.event,at);
   if(next!==current)await tx.save(next,current.revision,audit(next,'delivery.provider_event',at));
   await tx.saveEvent(verified.eventId,verified.eventHash);return deliveryView(next);
  });
 }
 async function reconcileDelivery(intentId:string,actor?:{actorId:string;requestId:string}):Promise<DeliveryStatus>{
  if(actor){uuidIdentifier(actor.actorId);uuidIdentifier(actor.requestId);}
  const intent=await withRecord(intentId,async(_tx,r)=>r.intent);let evidence:ProviderDeliveryEvent|null;
  try{evidence=await bounded(policy.sendTimeoutMs,s=>options.channel.lookup(intent,s));}catch{throw deliveryFailure();}
  return withRecord(intentId,async(tx,current)=>{if(evidence===null)return deliveryView(current);const at=now(),next=applyProviderDelivery(current,evidence,at);if(next!==current)await tx.save(next,current.revision,{...audit(next,'delivery.reconciled',at),...actor});return deliveryView(next);});
 }
 return Object.freeze({runOnce,dispatchNotification,acceptDeliveryEvent,reconcileDelivery,readDelivery:(id:string)=>withRecord(id,async(_tx,r)=>deliveryView(r))});
}
