import {test} from 'node:test';import assert from 'node:assert/strict';
import {deliveryIo} from './helpers/delivery-fixture.ts';
import {createOutboxDispatcher} from '../src/application/outbox-dispatch.ts';
import {applyProviderDelivery} from '../src/domain/notification-delivery.ts';
test('send acknowledgement reports delivery reconciled atomically from earlier native callback',async()=>{
 const f=deliveryIo(),lock=f.store.locked;
 f.store.locked=(id:string,work:any)=>lock(id,(tx:any)=>work({...tx,save:async(record:any,expected:number,audit:any)=>{
  await tx.save(record,expected,audit);
  if(record.state==='accepted'){
   const reconciled=applyProviderDelivery(record,f.event(1,'delivered') as any,f.clock());
   await tx.save(reconciled,record.revision,{type:'delivery.provider_event',at:f.clock(),intentId:f.intent.id});
  }
 }}));
 const service=createOutboxDispatcher({store:f.store,authority:f.authority,channel:f.channel,verifier:{verify(){throw Error('not invoked');}},portalOrigin:'https://support.example.invalid',clock:f.clock,policy:{maxAttempts:3,backoffMicros:['1000000'],leaseMicros:'30000000',sendTimeoutMs:30}});
 const results=await service.runOnce('worker1',1);
 assert.equal(f.get().state,'delivered');assert.equal(results[0]!.state,'delivered');assert.equal(f.counters.send,1);
});
