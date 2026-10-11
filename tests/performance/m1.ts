/** Bounded synthetic measurement primitives. No connection, URL, credential or mutation retry. */
import {performance} from 'node:perf_hooks';
import {createPostgresRateLimiter} from '../../src/infrastructure/rate-limit.ts';
import {withControlTransactions} from '../../src/infrastructure/transaction.ts';
import type {SqlPool} from '../../src/infrastructure/sql.ts';
export const createCapacityLimiter=(pool:SqlPool,secret:string)=>createPostgresRateLimiter(withControlTransactions(pool),secret);
const cohorts=['busy','neighbor','other_workspace'] as const;
const operations=['create','replay','read','list','quota'] as const;
const outcomes=['ok','denied','limited','error'] as const;
export type Sample={cohort:typeof cohorts[number];operation:typeof operations[number];outcome:typeof outcomes[number];duration_ms:number;queue_wait_ms:number;elapsed_ms:number};
export function validateCapacityPool(value:unknown){const s=value as {max_active_leases:number;active_leases:number;distinct_backends_observed:number};if(!s||typeof s!=='object'||Object.keys(s).length!==3||s.max_active_leases!==1||s.active_leases!==0||!Number.isSafeInteger(s.distinct_backends_observed)||s.distinct_backends_observed<1)throw Error('Invalid single-connection capacity proof.');}
type Task={cohort:Sample['cohort'];operation:Sample['operation'];run:()=>Promise<Sample['outcome']>};
const validNumber=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
function concurrency(value:unknown):asserts value is number{if(!Number.isInteger(value)||Number(value)<1||Number(value)>16)throw Error('Synthetic concurrency must be an integer from1 to16.');}
function sample(value:unknown):asserts value is Sample{
 const s=value as Sample;if(!s||typeof s!=='object'||Array.isArray(s)||Object.keys(s).length!==6||!cohorts.includes(s.cohort)||!operations.includes(s.operation)||!outcomes.includes(s.outcome)||!validNumber(s.duration_ms)||!validNumber(s.queue_wait_ms)||!validNumber(s.elapsed_ms)||Math.abs(s.elapsed_ms-s.duration_ms-s.queue_wait_ms)>1e-6)throw Error('Invalid sanitized capacity sample.');
}
function percentiles(values:number[]){
 if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),rank=(p:number)=>Number(sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]!.toFixed(3));
 return {min:rank(0),p50:rank(.5),p95:rank(.95),p99:rank(.99),max:rank(1)};
}
export function summarizeCapacity(samples:unknown,sourceSha256:unknown,profile:{concurrency:number;pool_max:number}){
 concurrency(profile.concurrency);if(profile.pool_max!==1||Object.keys(profile).length!==2||typeof sourceSha256!=='string'||!/^[a-f0-9]{64}$/.test(sourceSha256)||!Array.isArray(samples)||samples.length>256)throw Error('Invalid synthetic capacity profile.');
 for(const s of samples)sample(s);const values=samples as Sample[];
 const groups=cohorts.flatMap(cohort=>operations.flatMap(operation=>{
  const group=values.filter(s=>s.cohort===cohort&&s.operation===operation);return group.length?[{cohort,operation,samples:group.length,ok:group.filter(s=>s.outcome==='ok').length,denied:group.filter(s=>s.outcome==='denied').length,limited:group.filter(s=>s.outcome==='limited').length,errors:group.filter(s=>s.outcome==='error').length,operation_ms:percentiles(group.map(s=>s.duration_ms))!,admission_wait_ms:percentiles(group.map(s=>s.queue_wait_ms))!,end_to_end_ms:percentiles(group.map(s=>s.elapsed_ms))!}]:[];
 }));
 return {schema:1,environment:'local-disposable-postgres',platform_approved:false,source_sha256:sourceSha256,profile:{...profile},samples:values.length,errors:values.filter(s=>s.outcome==='error').length,operation_ms:percentiles(values.map(s=>s.duration_ms)),groups};
}
export async function runBoundedWorkload(input:unknown,{concurrency:parallelism,clock=()=>performance.now()}:{concurrency:number;clock?:()=>number}):Promise<Sample[]>{
 concurrency(parallelism);if(!Array.isArray(input)||!input.length||input.length>256)throw Error('Synthetic workload must contain1 to256 tasks.');
 for(const raw of input){const t=raw as Task;if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).length!==3||!cohorts.includes(t.cohort)||!operations.includes(t.operation)||typeof t.run!=='function')throw Error('Invalid synthetic task.');}
 // Shared by this workload's workers: every observed tick must be nondecreasing.
 let previousTick:number|undefined;
 const tasks=input as Task[],now=()=>{let n:unknown;try{n=clock();}catch{throw Error('Invalid monotonic measurement clock.');}if(!validNumber(n)||(previousTick!==undefined&&n<previousTick))throw Error('Invalid monotonic measurement clock.');previousTick=n;return n;};
 const admitted=now(),results:Sample[]=new Array(tasks.length);let next=0,fatal=false;
 const workers=Array.from({length:Math.min(parallelism,tasks.length)},async()=>{
  try{while(!fatal&&next<tasks.length){const index=next++,task=tasks[index]!,start=now();if(start<admitted)throw Error('Invalid monotonic measurement clock.');let outcome:Sample['outcome']='error';
   try{const value=await task.run();if(outcomes.includes(value))outcome=value;}catch{/* Raw errors can contain credentials or private content; never retain them. */}
   const finish=now();if(finish<start)throw Error('Invalid monotonic measurement clock.');results[index]={cohort:task.cohort,operation:task.operation,outcome,duration_ms:finish-start,queue_wait_ms:start-admitted,elapsed_ms:finish-admitted};
  }}catch{fatal=true;throw Error('Capacity measurement failed; no report may be approved.');}
 });
 const settled=await Promise.allSettled(workers);if(settled.some(r=>r.status==='rejected'))throw Error('Capacity measurement failed; no report may be approved.');return results;
}
