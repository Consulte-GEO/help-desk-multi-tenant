import test from 'node:test';
import assert from 'node:assert/strict';
import {runBoundedWorkload} from './performance/m1.ts';

const task=(run:()=>Promise<'ok'>)=>({cohort:'busy' as const,operation:'read' as const,run});
const failed=/Capacity measurement failed; no report may be approved\./;

test('CG02 backwards clock between tasks rejects before admitting another task',async()=>{
 const ticks=[0,10,20,15,25];let calls=0;
 const work=task(async()=>{calls++;return 'ok';});
 await assert.rejects(runBoundedWorkload([work,work],{concurrency:1,clock:()=>ticks.shift()!}),failed);
 assert.equal(calls,1);
});

test('CG02 interleaved workers compare every clock reading with the preceding reading',async()=>{
 const ticks=[0,10,20,15,30,40,50];let calls=0;
 const work=task(async()=>{calls++;return 'ok';});
 await assert.rejects(runBoundedWorkload([work,work,work],{concurrency:2,clock:()=>ticks.shift()!}),failed);
 assert.equal(calls,2);
});

test('CG02 invalid clock before admission never starts work',async()=>{
 for(const invalid of [NaN,Infinity,-Infinity,-1]){
  let calls=0;
  await assert.rejects(runBoundedWorkload([task(async()=>{calls++;return 'ok';})],{concurrency:1,clock:()=>invalid}),/Invalid monotonic measurement clock/);
  assert.equal(calls,0);
 }
});

test('CG02 nonfinite clock between tasks aborts without any additional work',async()=>{
 for(const invalid of [NaN,Infinity,-Infinity]){
  const ticks=[0,10,20,invalid,30];let calls=0;
  const work=task(async()=>{calls++;return 'ok';});
  await assert.rejects(runBoundedWorkload([work,work],{concurrency:1,clock:()=>ticks.shift()!}),failed);
  assert.equal(calls,1);
 }
});

test('CG02 nonfinite finish cannot return partial measurement evidence',async()=>{
 const ticks=[0,10,NaN];let calls=0;
 const work=task(async()=>{calls++;return 'ok';});
 await assert.rejects(runBoundedWorkload([work,work],{concurrency:1,clock:()=>ticks.shift()!}),failed);
 assert.equal(calls,1);
});

test('CG02 throwing clock is sanitized and never retries the completed operation',async()=>{
 let calls=0,readings=0;
 const work=task(async()=>{calls++;return 'ok';});
 await assert.rejects(runBoundedWorkload([work,work],{concurrency:1,clock:()=>{
  if(++readings===4)throw Error('private measurement detail');
  return readings;
 }}),(error:unknown)=>error instanceof Error&&failed.test(error.message)&&!/private/.test(error.message));
 assert.equal(calls,1);
});

test('CG02 equal readings are allowed and clock history is local to each workload',async()=>{
 const work=task(async()=> 'ok');
 const a=await runBoundedWorkload([work,work],{concurrency:2,clock:()=>100});
 const b=await runBoundedWorkload([work],{concurrency:1,clock:()=>0});
 for(const result of [...a,...b]){
  assert.equal(result.duration_ms,0);assert.equal(result.queue_wait_ms,0);assert.equal(result.elapsed_ms,0);
 }
});

test('CG02 fatal measurement drains already admitted work before rejecting',async()=>{
 let releaseFirst!:()=>void,releaseSecond!:()=>void,calls=0,settled=false,finished=0;
 const first=new Promise<void>(resolve=>{releaseFirst=resolve;});
 const second=new Promise<void>(resolve=>{releaseSecond=resolve;});
 const ticks=[0,10,20,5,30];
 const tasks=[first,second,Promise.resolve()].map(gate=>task(async()=>{calls++;await gate;finished++;return 'ok';}));
 const running=runBoundedWorkload(tasks,{concurrency:2,clock:()=>ticks.shift()!});
 const rejection=assert.rejects(running,failed);
 void running.then(()=>{settled=true;},()=>{settled=true;});
 releaseFirst();
 try{
  await new Promise<void>(resolve=>setImmediate(resolve));
  assert.equal(calls,2);assert.equal(finished,1);assert.equal(settled,false);
 }finally{releaseSecond();}
 await rejection;
 assert.equal(calls,2);assert.equal(finished,2);assert.equal(settled,true);
});
