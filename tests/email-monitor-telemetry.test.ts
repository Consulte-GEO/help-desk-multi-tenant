import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,createHmac} from 'node:crypto';
import {createResendDeliveryEvents,requireVerifiedResendEvent} from '../src/integrations/notifications/resend-events.ts';
import {createPostgresNotificationDeliveryStore} from '../src/infrastructure/notification-delivery-store.ts';
import type {SqlPool,SqlClient,SqlResult} from '../src/infrastructure/sql.ts';

const NOW='2026-10-15T12:00:00.000000Z',OCCURRED='2026-10-15T11:59:59.999123Z';
const MESSAGE='00000000-0000-4000-8000-000000000081',KEY=Buffer.alloc(24,17);
function signed(eventType:string){
 const bytes=Buffer.from(JSON.stringify({type:eventType,created_at:OCCURRED,data:{email_id:MESSAGE,to:['private@example.invalid'],subject:'Private subject',click:{link:'https://example.invalid/?token=private'},user_agent:'private-agent',ip_address:'192.0.2.5'}}));
 const eventId='msg_monitor_fixture',ts=String(Date.parse(NOW)/1000),headers=new Headers({'svix-id':eventId,'svix-timestamp':ts,'svix-signature':'v1,'+createHmac('sha256',KEY).update(eventId+'.'+ts+'.').update(bytes).digest('base64')});
 const verifier=createResendDeliveryEvents({secrets:['whsec_'+KEY.toString('base64')],maxAgeSeconds:300,clock:()=>NOW});
 return {bytes,headers,verifier,event:verifier.verify(headers,bytes)};
}
function database(){
 const calls:{sql:string;values:unknown[]}[]=[],control:{errorCode:string|null;disposition:string;intentId:string|null}={errorCode:null,disposition:'unmatched',intentId:null};
 const client:SqlClient={async query(sql,values=[]):Promise<SqlResult>{
  calls.push({sql,values});
  if(sql.includes('pg_catalog.pg_roles'))return {command:'SELECT',rowCount:1,rows:[{sessionUser:'helpdesk_notification_worker',currentUser:'helpdesk_notification_worker',safe:true}]};
  if(sql.includes('hdn_notification_native(')){
   if(control.errorCode)throw Object.assign(Error('private provider data'),{code:control.errorCode});
   const event=values[0] as {eventId:string};return {command:'SELECT',rowCount:1,rows:[{result:{eventId:event.eventId,disposition:control.disposition,intentId:control.intentId}}]};
  }
  return {command:sql,rowCount:null,rows:[]};
 },release(){}};
 const pool:SqlPool={async connect(){return client;},async query(){throw Error('pool.query forbidden');},async end(){}};
 return {pool,calls,control};
}

for(const type of ['email.opened','email.clicked','email.new_provider_event'])test('verified native type '+type+' preserves provenance without inventing delivery',()=>{
 const f=signed(type);assert.equal(f.event.eventType,type);assert.equal(f.event.outcome,null);assert.equal(f.event.occurredAt,OCCURRED);
 assert.equal(f.event.eventHash,createHash('sha256').update(f.bytes).digest('hex'));assert.equal(requireVerifiedResendEvent(f.event),f.event);assert.ok(Object.isFrozen(f.event));
 assert.doesNotMatch(JSON.stringify(f.event),/private@example|Private subject|token=|private-agent|192\.0\.2/);
 for(const clone of [{...f.event},JSON.parse(JSON.stringify(f.event))])assert.throws(()=>requireVerifiedResendEvent(clone),{code:'delivery_signature_invalid'});
});
test('signed delivery type remains distinct from its operational outcome',()=>{
 const f=signed('email.bounced');assert.equal(f.event.eventType,'email.bounced');assert.equal(f.event.outcome,'failed');
});
test('signed native event type cannot be changed without invalidating raw-byte verification',()=>{
 const f=signed('email.opened'),changed=Buffer.from(f.bytes.toString().replace('email.opened','email.clicked'));
 assert.throws(()=>f.verifier.verify(f.headers,changed),{code:'delivery_signature_invalid'});
});
for(const type of ['email.opened','email.clicked','email.sent','email.new_provider_event'])test('schema-qualified store forwards only verified minimal '+type+' to the existing native helper',async()=>{
 const f=signed(type),db=database(),store=createPostgresNotificationDeliveryStore(db.pool,{nativeEventTypes:true});
 assert.deepEqual(await store.receiveNative(f.event,NOW),{eventId:f.event.eventId,disposition:'unmatched',intentId:null});
 const call=db.calls.find(x=>x.sql.includes('hdn_notification_native('));
 assert.equal(call?.sql,'select helpdesk_auth.hdn_notification_native($1,$2) as result');
 assert.deepEqual(call?.values,[{eventId:f.event.eventId,eventHash:f.event.eventHash,providerMessageId:MESSAGE,occurredAt:OCCURRED,outcome:f.event.outcome,eventType:type},NOW]);
 assert.doesNotMatch(JSON.stringify(db.calls),/private@example|Private subject|token=|private-agent|192\.0\.2/);assert.equal(db.calls.at(-1)?.sql,'COMMIT');
});
test('schema0.25 default and explicitly disabled stores preserve the exact old JSON helper argument',async()=>{
 for(const options of [undefined,{nativeEventTypes:false}]){const f=signed('email.opened'),db=database(),store=createPostgresNotificationDeliveryStore(db.pool,options);await store.receiveNative(f.event,NOW);
  assert.deepEqual(db.calls.find(x=>x.sql.includes('hdn_notification_native('))?.values,[{eventId:f.event.eventId,eventHash:f.event.eventHash,providerMessageId:MESSAGE,occurredAt:OCCURRED,outcome:null},NOW]);
 }
});
test('store captures its server schema option at construction',async()=>{
 const f=signed('email.clicked'),db=database(),options={nativeEventTypes:true},store=createPostgresNotificationDeliveryStore(db.pool,options);options.nativeEventTypes=false;
 await store.receiveNative(f.event,NOW);assert.equal((db.calls.find(x=>x.sql.includes('hdn_notification_native('))?.values[0] as {eventType?:string}).eventType,'email.clicked');
});
test('forged native telemetry never opens a transaction',async()=>{
 const f=signed('email.clicked'),db=database(),store=createPostgresNotificationDeliveryStore(db.pool,{nativeEventTypes:true});
 await assert.rejects(store.receiveNative({...f.event},NOW),{code:'delivery_signature_invalid'});assert.equal(db.calls.length,0);
});
test('native type identity conflict rolls back without exposing driver data',async()=>{
 const f=signed('email.clicked'),db=database();db.control.errorCode='HDN03';
 await assert.rejects(createPostgresNotificationDeliveryStore(db.pool,{nativeEventTypes:true}).receiveNative(f.event,NOW),e=>{assert.equal((e as {code:string}).code,'delivery_event_conflict');assert.doesNotMatch((e as Error).message,/private|provider data/);return true;});
 assert.equal(db.calls.at(-1)?.sql,'ROLLBACK');
});
