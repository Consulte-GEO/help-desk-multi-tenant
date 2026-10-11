import {createHmac,createHash,timingSafeEqual} from 'node:crypto';
import {freezeFormData} from '../../../shared/form-rules.js';import {uuidIdentifier} from '../../domain/input-values.ts';
import {instantMicros} from '../../domain/business-calendar.ts';
import {notificationRecord,notificationRef,notificationDigest,deliveryFailure,type ProviderDeliveryEvent} from '../../domain/notification-delivery.ts';
export type VerifiedDeliveryEvent=Readonly<{eventId:string;eventHash:string;event:ProviderDeliveryEvent}>;
const invalid=()=>deliveryFailure('delivery_signature_invalid',401);
/** Standard Webhooks v1 HMAC envelope; the JSON schema is this application's
 * NORMALIZED relay contract, not a claim about a chosen mail provider's payload.
 * A matching signature is not deduplication: event ID/hash must also be persisted.
 */
export function createSignedDeliveryEvents(config:{channelId:string;secrets:readonly string[];maxAgeSeconds:number;clock:()=>string}){
 let keys:Buffer[];const channelId=notificationRef(config.channelId);
 try{
  if(!Array.isArray(config.secrets)||config.secrets.length<1||config.secrets.length>3||!Number.isSafeInteger(config.maxAgeSeconds)||config.maxAgeSeconds<1||config.maxAgeSeconds>900)throw Error();
  keys=config.secrets.map(s=>{if(typeof s!=='string'||!/^whsec_[A-Za-z0-9+/]{43}=$/.test(s))throw Error();const b=Buffer.from(s.slice(6),'base64');if(b.length!==32||b.toString('base64')!==s.slice(6))throw Error();return b;});
 }catch{throw deliveryFailure('delivery_channel_configuration_required');}
 return Object.freeze({verify(headers:Headers,bytes:Uint8Array):VerifiedDeliveryEvent{
  try{
   if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.byteLength>32768)throw Error();
   const id=headers.get('webhook-id'),ts=headers.get('webhook-timestamp'),signatures=headers.get('webhook-signature');
   notificationRef(id,160);if(!ts||!/^(0|[1-9]\d{0,11})$/.test(ts)||!signatures||signatures.length>1024)throw Error();
   const stamp=BigInt(ts)*1000000n,now=instantMicros(config.clock()),age=BigInt(config.maxAgeSeconds)*1000000n;
   if(stamp>now+age||stamp<now-age)throw Error();
   const candidates=signatures.split(' ').filter(s=>/^v1,[A-Za-z0-9+/]{43}=$/.test(s)).map(s=>Buffer.from(s.slice(3),'base64'));
   let valid=false;
   for(const key of keys){const expected=createHmac('sha256',key).update(id+'.'+ts+'.').update(bytes).digest();for(const signature of candidates)if(signature.length===expected.length&&timingSafeEqual(signature,expected))valid=true;}
   if(!valid)throw Error();
   const envelope=notificationRecord(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),['schema','data']);if(envelope.schema!==1)throw Error();
   const e=notificationRecord(envelope.data,['intentId','channelId','idempotencyKey','recipientId','providerMessageId','sequence','outcome','occurredAt']);
   for(const field of ['intentId','recipientId'])if(uuidIdentifier(e[field])!==e[field])throw Error();
   if(e.channelId!==channelId||!Number.isSafeInteger(e.sequence)||Number(e.sequence)<1||!['accepted','delivered','failed'].includes(e.outcome as string))throw Error();
   notificationDigest(e.idempotencyKey);notificationRef(e.providerMessageId);instantMicros(e.occurredAt);
   return freezeFormData({eventId:id as string,eventHash:createHash('sha256').update(bytes).digest('hex'),event:e as unknown as ProviderDeliveryEvent});
  }catch{throw invalid();}
 }});
}
