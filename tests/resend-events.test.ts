import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
import {createResendDeliveryEvents,requireVerifiedResendEvent} from '../src/integrations/notifications/resend-events.ts';

const NOW='2026-10-14T12:00:00.000Z',TS=String(Date.parse(NOW)/1000),ID='msg_consultegeo_fixture',EMAIL='00000000-0000-4000-8000-000000000abc';
const KEY=Buffer.alloc(24,17),SECRET='whsec_'+KEY.toString('base64');
const verifier=()=>createResendDeliveryEvents({secrets:[SECRET],maxAgeSeconds:300,clock:()=>NOW});
function body(type='email.delivered',overrides:Record<string,unknown>={}){return Buffer.from(JSON.stringify({type,created_at:'2026-10-14T11:59:59.500Z',data:{email_id:EMAIL,from:'Private <sender@example.invalid>',to:['private@example.invalid'],subject:'Private body',tags:{intent_id:'untrusted'},...overrides}}));}
function headers(bytes:Uint8Array,key=KEY,ts=TS,id=ID){return new Headers({'svix-id':id,'svix-timestamp':ts,'svix-signature':'v1,'+createHmac('sha256',key).update(id+'.'+ts+'.').update(bytes).digest('base64')});}
const invalid=(work:()=>unknown)=>assert.throws(work,(e:any)=>e.code==='delivery_signature_invalid'&&e.status===401&&!String(e.message).includes('private@example.invalid'));

for(const [type,outcome] of [['email.sent','accepted'],['email.delivered','delivered'],['email.bounced','failed'],['email.failed','failed'],['email.suppressed','failed']] as const)test('native Resend '+type+' verifies minimal event',()=>{
 const bytes=body(type),event=verifier().verify(headers(bytes),bytes);
 assert.deepEqual(event,{eventId:ID,eventHash:createHash('sha256').update(bytes).digest('hex'),providerMessageId:EMAIL,occurredAt:'2026-10-14T11:59:59.500Z',outcome});
 assert.equal(requireVerifiedResendEvent(event),event);assert.ok(Object.isFrozen(event));
 const text=JSON.stringify(event);for(const sensitive of ['private@example.invalid','sender@example.invalid','Private body','intent_id','untrusted'])assert.equal(text.includes(sensitive),false);
});
for(const type of ['email.opened','email.clicked','email.complained','email.delivery_delayed'])test('signed '+type+' never asserts delivery',()=>{
 const bytes=body(type);assert.equal(verifier().verify(headers(bytes),bytes).outcome,null);
});
test('non-email signed event refuses the email receiver',()=>{const bytes=body('domain.updated');invalid(()=>verifier().verify(headers(bytes),bytes));});
test('raw bytes alteration and reserialization fail signature',()=>{
 const bytes=body(),h=headers(bytes);invalid(()=>verifier().verify(h,Buffer.from(bytes.toString().replace('Private body','changed'))));
 invalid(()=>verifier().verify(h,Buffer.from(JSON.stringify(JSON.parse(bytes.toString()),null,2))));
});
test('missing and duplicated security headers fail',()=>{const bytes=body();for(const key of ['svix-id','svix-timestamp','svix-signature']){
 const missing=headers(bytes);missing.delete(key);invalid(()=>verifier().verify(missing,bytes));
 const duplicate=headers(bytes);duplicate.append(key,duplicate.get(key)!);invalid(()=>verifier().verify(duplicate,bytes));
}});
test('relay headers and relay JSON cannot pass native contract',()=>{
 const bytes=body(),h=headers(bytes);h.set('webhook-id',ID);h.delete('svix-id');invalid(()=>verifier().verify(h,bytes));
 const relay=Buffer.from(JSON.stringify({schema:1,data:{intentId:EMAIL,outcome:'delivered'}}));invalid(()=>verifier().verify(headers(relay),relay));
});
test('signature timestamp replay window and noncanonical timestamp fail',()=>{const bytes=body();for(const ts of [String(Number(TS)-301),String(Number(TS)+301),'0'+TS,TS+'.0',TS+', '+TS])invalid(()=>verifier().verify(headers(bytes,KEY,ts),bytes));});
test('timestamp boundary exactly 300 seconds is accepted',()=>{const bytes=body();for(const ts of [String(Number(TS)-300),String(Number(TS)+300)])assert.equal(verifier().verify(headers(bytes,KEY,ts),bytes).outcome,'delivered');});
test('key rotation, version list and canonical base64 verification',()=>{
 const bytes=body(),other=Buffer.alloc(18,29),secret='whsec_'+other.toString('base64').replace(/=+$/,'');
 const rotated=createResendDeliveryEvents({secrets:[secret,SECRET],maxAgeSeconds:300,clock:()=>NOW});
 assert.equal(rotated.verify(headers(bytes,other),bytes).outcome,'delivered');assert.equal(rotated.verify(headers(bytes),bytes).outcome,'delivered');
 const h=headers(bytes);h.set('svix-signature','v2,ignored '+h.get('svix-signature'));assert.equal(rotated.verify(h,bytes).outcome,'delivered');
 h.set('svix-signature',headers(bytes).get('svix-signature')!.replace(/=$/,''));invalid(()=>rotated.verify(h,bytes));
});
test('body byte limit, UTF8 and JSON shape fail safely',()=>{
 for(const bytes of [new Uint8Array(),new Uint8Array(32769),Buffer.from([0xff]),Buffer.from('null'),Buffer.from('[]')])invalid(()=>verifier().verify(headers(bytes),bytes));
});
test('email id must be native lowercase UUID',()=>{for(const id of [null,'unsafe/key',EMAIL.toUpperCase(),'id-from-browser','',123]){const bytes=body('email.delivered',{email_id:id});invalid(()=>verifier().verify(headers(bytes),bytes));}});
test('native created_at must be valid and no later than now',()=>{for(const at of ['bad','2026-02-30T00:00:00Z','2026-10-14T12:00:01Z','2026-10-14']){const bytes=Buffer.from(JSON.stringify({type:'email.delivered',created_at:at,data:{email_id:EMAIL}}));invalid(()=>verifier().verify(headers(bytes),bytes));}});
test('unrecognized signed types retain no address and cannot become proof of delivery',()=>{const bytes=body('email.new_provider_event');assert.equal(verifier().verify(headers(bytes),bytes).outcome,null);});
test('invalid channel configuration refuses before body is processed',()=>{
 for(const secrets of [[],['secret'],['whsec_AAAA'],['whsec_'+Buffer.alloc(65).toString('base64')],Array(4).fill(SECRET)])assert.throws(()=>createResendDeliveryEvents({secrets,maxAgeSeconds:300,clock:()=>NOW}),(e:any)=>e.code==='delivery_channel_configuration_required');
 for(const age of [0,901,1.5])assert.throws(()=>createResendDeliveryEvents({secrets:[SECRET],maxAgeSeconds:age,clock:()=>NOW}));
});
test('verified brand cannot be forged or cloned',()=>{const bytes=body(),event=verifier().verify(headers(bytes),bytes);for(const forged of [JSON.parse(JSON.stringify(event)),{...event},null,{}])assert.throws(()=>requireVerifiedResendEvent(forged),(e:any)=>e.code==='delivery_signature_invalid');});
test('official Svix interoperability vector, including unpadded secret',()=>{
 const bytes=Buffer.from('{"event_type":"ping","data":{"success":true}}'),clock=()=>new Date(1731705121*1000).toISOString();
 const v=createResendDeliveryEvents({secrets:['whsec_plJ3nmyCDGBKInavdOK15jsl'],maxAgeSeconds:300,clock});
 const h=new Headers({'svix-id':'msg_loFOjxBNrRLzqYUf','svix-timestamp':'1731705121','svix-signature':'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0='});
 // The official non-Resend sample proves HMAC interoperability, then fails native shape.
 invalid(()=>v.verify(h,bytes));
 assert.equal(createHmac('sha256',Buffer.from('plJ3nmyCDGBKInavdOK15jsl','base64')).update('msg_loFOjxBNrRLzqYUf.1731705121.').update(bytes).digest('base64'),'rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=');
});
