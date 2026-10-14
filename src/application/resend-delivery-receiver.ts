import {deliveryFailure,notificationRecord} from '../domain/notification-delivery.ts';
import {instantMicros} from '../domain/business-calendar.ts';import {uuidIdentifier} from '../domain/input-values.ts';
import {requireVerifiedResendEvent,type VerifiedResendEvent} from '../integrations/notifications/resend-events.ts';
export type NativeResendReceipt=Readonly<{eventId:string;disposition:'unmatched'|'applied'|'ignored'|'attention';intentId:string|null}>;
export interface NativeResendDeliveryStore{receiveNative(event:VerifiedResendEvent,at:string):Promise<unknown>;}
/** This is a LOCAL chronological projection of the native occurrence timestamp,
 * not a Resend sequence. Equal microseconds remain equal and can flag conflict;
 * receipt arrival order is never authority. SQL uses exactly the same bound. */
export function nativeResendTimestampSequence(at:string):number{try{const value=instantMicros(at);if(value<1n||value>BigInt(Number.MAX_SAFE_INTEGER))throw Error();return Number(value);}catch{throw deliveryFailure('delivery_receipt_mismatch',409);}}
export function parseNativeResendReceipt(raw:unknown,eventId:string):NativeResendReceipt{
 try{const r=notificationRecord(raw,['eventId','disposition','intentId']);if(r.eventId!==eventId||!['unmatched','applied','ignored','attention'].includes(r.disposition as string))throw Error();if(r.intentId!==null)uuidIdentifier(r.intentId);if(r.disposition==='unmatched'&&r.intentId!==null||['applied','attention'].includes(r.disposition as string)&&r.intentId===null)throw Error();return Object.freeze(r) as NativeResendReceipt;}catch{throw deliveryFailure();}
}
/** Server-only native entrypoint. Correlation, dedup, receipt and state update
 * are one durable store transaction. No payload/tag supplies intent identity. */
export function createResendDeliveryReceiver(options:{store:NativeResendDeliveryStore;verifier?:{verify(headers:Headers,bytes:Uint8Array):VerifiedResendEvent};clock?:()=>string}){
 const clock=options.clock??(()=>new Date().toISOString());
 async function acceptVerified(raw:unknown):Promise<NativeResendReceipt>{const event=requireVerifiedResendEvent(raw),at=clock();if(instantMicros(event.occurredAt)>instantMicros(at))throw deliveryFailure('delivery_receipt_mismatch',409);nativeResendTimestampSequence(event.occurredAt);return parseNativeResendReceipt(await options.store.receiveNative(event,at),event.eventId);}
 return Object.freeze({acceptVerified,async accept(headers:Headers,bytes:Uint8Array){if(!options.verifier)throw deliveryFailure('delivery_channel_configuration_required');return acceptVerified(options.verifier.verify(headers,bytes));}});
}
