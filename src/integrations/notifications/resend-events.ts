import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {deliveryFailure,type ProviderDeliveryEvent} from '../../domain/notification-delivery.ts';
import {uuidIdentifier} from '../../domain/input-values.ts';
import {isCanonicalInstant,zonedInstantMicros} from '../../../shared/instant.js';

const verifiedBrand:unique symbol=Symbol('verified-native-resend-event');
export type VerifiedResendEvent=Readonly<{
 [verifiedBrand]:true;eventId:string;eventHash:string;providerMessageId:string;
 occurredAt:string;outcome:ProviderDeliveryEvent['outcome']|null;
}>;
const verified=new WeakSet<object>();
const invalid=()=>deliveryFailure('delivery_signature_invalid',401);
const outcomes:Readonly<Record<string,ProviderDeliveryEvent['outcome']>>=Object.freeze({
 'email.sent':'accepted','email.delivered':'delivered','email.failed':'failed',
 'email.bounced':'failed','email.suppressed':'failed'
});
/** Server-only provenance. JSON, spread/clones and provider claims cannot forge it. */
export function requireVerifiedResendEvent(value:unknown):VerifiedResendEvent{
 if(!value||typeof value!=='object'||!verified.has(value))throw invalid();
 return value as VerifiedResendEvent;
}
function instant(value:unknown):bigint{
 if(!isCanonicalInstant(value))throw invalid();return zonedInstantMicros(value)!;
}
function key(secret:unknown):Buffer{
 if(typeof secret!=='string'||!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(secret)||secret.length>96)throw Error();
 const encoded=secret.slice(6),decoded=Buffer.from(encoded,'base64');
 // Svix secrets are not constrained to the normalized relay's 32-byte contract.
 if(decoded.length<16||decoded.length>64||decoded.toString('base64').replace(/=+$/,'')!==encoded.replace(/=+$/,'')
  ||encoded.includes('=')&&decoded.toString('base64')!==encoded)throw Error();
 return decoded;
}
/** Native Resend uses raw Svix headers/body. Verification does not authorize a
 * recipient, associate a ticket, invent provider ordering or deduplicate events.
 * The private durable worker must correlate this message ID under its own lock.
 * Signed unsupported events return outcome=null, never delivery confirmation.
 * Reference: resend.com/docs/webhooks/verify-webhooks-requests and Svix manual verification.
 */
export function createResendDeliveryEvents(config:{secrets:readonly string[];maxAgeSeconds:number;clock:()=>string}){
 let keys:Buffer[],clock:()=>string,age:bigint;
 try{
  if(!config||!Array.isArray(config.secrets)||config.secrets.length<1||config.secrets.length>3
   ||!Number.isSafeInteger(config.maxAgeSeconds)||config.maxAgeSeconds<1||config.maxAgeSeconds>900||typeof config.clock!=='function')throw Error();
  keys=config.secrets.map(key);clock=config.clock;age=BigInt(config.maxAgeSeconds)*1_000_000n;
 }catch{throw deliveryFailure('delivery_channel_configuration_required');}
 return Object.freeze({verify(headers:Headers,bytes:Uint8Array):VerifiedResendEvent{
  try{
   if(!(headers instanceof Headers)||!(bytes instanceof Uint8Array)||!bytes.length||bytes.byteLength>32768)throw Error();
   const id=headers.get('svix-id'),ts=headers.get('svix-timestamp'),signatureList=headers.get('svix-signature');
   if(!id||!/^msg_[A-Za-z0-9_-]{1,156}$/.test(id)||!ts||!/^(0|[1-9]\d{0,11})$/.test(ts)
    ||!signatureList||signatureList.length>1024||signatureList.includes(','+' '))throw Error();
   const at=instant(clock()),stamp=BigInt(ts)*1_000_000n;
   if(stamp<at-age||stamp>at+age)throw Error();
   const signatures=signatureList.split(' ').filter(v=>/^v1,[A-Za-z0-9+/]{43}=$/.test(v)).map(v=>{
    const encoded=v.slice(3),decoded=Buffer.from(encoded,'base64');return decoded.toString('base64')===encoded?decoded:Buffer.alloc(0);
   });
   let authentic=false;
   for(const secret of keys){const expected=createHmac('sha256',secret).update(id+'.'+ts+'.').update(bytes).digest();
    for(const signature of signatures)if(signature.length===expected.length&&timingSafeEqual(signature,expected))authentic=true;
   }
   if(!authentic)throw Error();
   const native=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(!native||typeof native!=='object'||Array.isArray(native)||typeof native.type!=='string'
    ||! /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/.test(native.type)||!native.data||typeof native.data!=='object'||Array.isArray(native.data))throw Error();
   const occurred=instant(native.created_at);if(occurred>at)throw Error();
   // Non-email types cannot supply a message and are deliberately not accepted
   // by this email receiver. Email telemetry also requires valid native identity.
   if(!native.type.startsWith('email.'))throw Error();
   const message=uuidIdentifier(native.data.email_id);if(message!==native.data.email_id)throw Error();
   const event=Object.freeze({eventId:id,eventHash:createHash('sha256').update(bytes).digest('hex'),providerMessageId:message,
    occurredAt:native.created_at as string,outcome:outcomes[native.type]??null}) as VerifiedResendEvent;
   verified.add(event);return event;
  }catch{throw invalid();}
 }});
}
