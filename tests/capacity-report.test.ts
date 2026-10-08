import test from 'node:test';import assert from 'node:assert/strict';
const load=()=>import('./performance/m1.ts');
const source='a'.repeat(64);
test('single-connection proof permits sequential idle backend replacement but refuses simultaneous leases or leaked work',async()=>{
 const {validateCapacityPool}=await load();validateCapacityPool({max_active_leases:1,active_leases:0,distinct_backends_observed:2});
 for(const bad of [{max_active_leases:2,active_leases:0,distinct_backends_observed:2},{max_active_leases:1,active_leases:1,distinct_backends_observed:1},{max_active_leases:1,active_leases:0,distinct_backends_observed:0}])assert.throws(()=>validateCapacityPool(bad));
});
test('capacity quota measurement includes runtime transaction, empty identity, timeouts and confirmed commit',async()=>{
 const {createCapacityLimiter}=await load();const calls:{sql:string;values:unknown[]|undefined}[]=[];let releases=0,directQueries=0;
 const client={query:async(sql:string,values?:unknown[])=>{calls.push({sql,values});return {command:sql==='BEGIN'?'BEGIN':sql==='COMMIT'?'COMMIT':'SELECT',rows:sql.includes('consume_rate_limits')?[{decision:{allowed:true,retry_after:0}}]:[],rowCount:1};},release:()=>{releases++;}};
 const pool={connect:async()=>client,query:async()=>{directQueries++;return {command:'SELECT',rows:[{decision:{allowed:true,retry_after:0}}],rowCount:1};},end:async()=>{}};
 await createCapacityLimiter(pool,'Q'.repeat(43)).beforeAuthentication(new Request('https://synthetic.test/v1/tickets'),{clientIp:'192.0.2.40'});
 assert.equal(directQueries,0);assert.equal(calls[0]!.sql,'BEGIN');assert.deepEqual(calls[1]!.values,['','']);assert.match(calls[1]!.sql,/statement_timeout/);assert.match(calls[2]!.sql,/consume_rate_limits/);assert.equal(calls[3]!.sql,'COMMIT');assert.equal(releases,1);
});
test('capacity quota query failure rolls back the owned client and keeps private driver error out of the result',async()=>{
 const {createCapacityLimiter}=await load();const calls:string[]=[];let releases=0;
 const client={query:async(sql:string)=>{calls.push(sql);if(sql.includes('consume_rate_limits'))throw Error('private:password@foreign');return {command:['BEGIN','ROLLBACK'].includes(sql)?sql:'SELECT',rows:[],rowCount:1};},release:()=>{releases++;}};
 const pool={connect:async()=>client,query:async()=>{throw Error('Wrong direct path');},end:async()=>{}};
 await assert.rejects(createCapacityLimiter(pool,'Q'.repeat(43)).beforeAuthentication(new Request('https://synthetic.test/v1/tickets'),{clientIp:'192.0.2.40'}),(e:any)=>e.code==='rate_limit_unavailable'&&!/private|password|foreign/.test(e.message));assert.equal(calls[0],'BEGIN');assert.equal(calls.at(-1),'ROLLBACK');assert.ok(!calls.includes('COMMIT'));assert.equal(releases,1);
});
test('capacity summaries use nearest-rank percentiles and count each outcome without hiding errors',async()=>{
 const {summarizeCapacity}=await load();const samples=[1,2,3,4,100].map((duration_ms,i)=>({cohort:'busy' as const,operation:'create' as const,outcome:i===4?'error' as const:'ok' as const,duration_ms,queue_wait_ms:2,elapsed_ms:duration_ms+2}));
 const r=summarizeCapacity(samples,source,{concurrency:8,pool_max:1});assert.equal(r.platform_approved,false);assert.equal(r.environment,'local-disposable-postgres');assert.equal(r.samples,5);assert.equal(r.groups[0]!.errors,1);assert.equal(r.groups[0]!.operation_ms.p50,3);assert.equal(r.groups[0]!.operation_ms.p95,100);assert.equal(r.groups[0]!.end_to_end_ms.p50,5);
});
test('empty measurement reports unavailable latency rather than zero capacity',async()=>{
 const {summarizeCapacity}=await load();const r=summarizeCapacity([],source,{concurrency:8,pool_max:1});assert.equal(r.samples,0);assert.equal(r.operation_ms,null);assert.deepEqual(r.groups,[]);
});
test('invalid timings, unknown labels and foreign fields cannot become capacity evidence',async()=>{
 const {summarizeCapacity}=await load(),s={cohort:'busy',operation:'read',outcome:'ok',duration_ms:1,queue_wait_ms:2,elapsed_ms:3};
 for(const bad of [{...s,duration_ms:NaN},{...s,duration_ms:-1},{...s,elapsed_ms:0},{...s,cohort:'private@example.test'},{...s,outcome:'confirmed_anyway'},{...s,access_token:'secret'}])assert.throws(()=>summarizeCapacity([bad],source,{concurrency:8,pool_max:1}));
 assert.throws(()=>summarizeCapacity([s],'invalid',{concurrency:8,pool_max:1}));
});
test('bounded workload admits all tasks once, waits for queue and never exceeds concurrency',async()=>{
 const {runBoundedWorkload}=await load();let active=0,max=0,calls=0,tick=0;
 const tasks=Array.from({length:12},()=>({cohort:'neighbor' as const,operation:'read' as const,run:async()=>{active++;max=Math.max(max,active);calls++;await new Promise(r=>setTimeout(r,3));active--;return 'ok' as const;}}));
 const samples=await runBoundedWorkload(tasks,{concurrency:3,clock:()=>++tick});assert.equal(calls,12);assert.equal(samples.length,12);assert.equal(max,3);assert.ok(samples.every(s=>s.queue_wait_ms>=0&&s.elapsed_ms>=s.duration_ms));
});
test('exceptions produce sanitized error outcomes, never a retry or a leaked error body',async()=>{
 const {runBoundedWorkload}=await load();let calls=0;const samples=await runBoundedWorkload([{cohort:'busy',operation:'create',run:async()=>{calls++;throw Error('postgres://private:secret@foreign/body');}}],{concurrency:1});assert.equal(calls,1);assert.equal(samples[0]!.outcome,'error');assert.doesNotMatch(JSON.stringify(samples),/postgres|private|secret|foreign/);
});
test('workload validation happens before any task runs and refuses excessive profile sizes',async()=>{
 const {runBoundedWorkload}=await load();let calls=0;const good={cohort:'busy',operation:'read',run:async()=>{calls++;return 'ok';}};
 for(const tasks of [[good,{...good,cohort:'foreign'}],Array(257).fill(good)])await assert.rejects(runBoundedWorkload(tasks,{concurrency:8}));
 for(const concurrency of [0,17,1.5])await assert.rejects(runBoundedWorkload([good],{concurrency}));assert.equal(calls,0);
});
test('a clock moving backwards before task start cannot manufacture valid latency measurements',async()=>{
 const {runBoundedWorkload}=await load();let ticks=[2,1,3];await assert.rejects(runBoundedWorkload([{cohort:'busy',operation:'read',run:async()=> 'ok'}],{concurrency:1,clock:()=>ticks.shift()!}));
});
