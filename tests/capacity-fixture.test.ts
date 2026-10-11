import test from 'node:test';
import assert from 'node:assert/strict';
import {withCapacityFixture} from './performance/fixture.ts';

const source='a'.repeat(64);

test('CG02 fingerprint rejection never acquires a capacity fixture or pool',async()=>{
 let acquired=0,active=0,ran=0;
 const failure=Error('synthetic fingerprint failure');
 await assert.rejects(withCapacityFixture(async()=>{throw failure;},async()=>{
  acquired++;active++;
  return {pool:{end:async()=>{active--;}}};
 },async()=>{ran++;}),error=>error===failure);
 assert.equal(active,0);assert.equal(acquired,0);assert.equal(ran,0);
});

test('CG02 synchronous fingerprint failure cannot leave an owned pool behind',async()=>{
 let acquired=0;
 await assert.rejects(withCapacityFixture(()=>{throw Error('fingerprint unavailable');},async()=>{
  acquired++;return {pool:{end:async()=>{}}};
 },async()=>assert.fail('scenario must not run')),/fingerprint unavailable/);
 assert.equal(acquired,0);
});

test('CG02 scenario result is returned only after its owned pool has closed once',async()=>{
 const events:string[]=[];let release!:()=>void;
 const close=new Promise<void>(resolve=>{release=resolve;});
 const result={samples:3};
 const pending=withCapacityFixture(async()=>{events.push('fingerprint');return source;},async()=>{
  events.push('fixture');return {pool:{end:async()=>{events.push('close-start');await close;events.push('close-done');}}};
 },async(f,actualSource)=>{events.push('run');assert.equal(actualSource,source);assert.ok(f.pool);return result;});
 let settled=false;void pending.then(()=>{settled=true;},()=>{settled=true;});
 try{
  await new Promise<void>(resolve=>setImmediate(resolve));
  assert.equal(settled,false);
  assert.deepEqual(events,['fingerprint','fixture','run','close-start']);
 }finally{release();}
 assert.equal(await pending,result);
 assert.deepEqual(events,['fingerprint','fixture','run','close-start','close-done']);
});

test('CG02 scenario failure still closes its fixture exactly once',async()=>{
 const failure=Error('scenario refused');let ended=0;
 await assert.rejects(withCapacityFixture(async()=>source,async()=>({pool:{end:async()=>{ended++;}}}),async()=>{throw failure;}),error=>error===failure);
 assert.equal(ended,1);
});

test('CG02 acquisition failure is not retried and never runs the scenario',async()=>{
 const events:string[]=[];
 await assert.rejects(withCapacityFixture(async()=>{events.push('fingerprint');return source;},async()=>{
  events.push('fixture');throw Error('factory owns partial setup cleanup');
 },async()=>{events.push('run');}),/factory owns partial setup cleanup/);
 assert.deepEqual(events,['fingerprint','fixture']);
});

test('CG02 cleanup failure cannot turn into successful capacity evidence or an automatic retry',async()=>{
 let runs=0,ends=0;
 await assert.rejects(withCapacityFixture(async()=>source,async()=>({pool:{end:async()=>{ends++;throw Error('cleanup failed');}}}),async()=>{runs++;return {passed:true};}),/cleanup failed/);
 assert.equal(runs,1);assert.equal(ends,1);
});
