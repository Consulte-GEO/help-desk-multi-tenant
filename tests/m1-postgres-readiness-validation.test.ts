import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForPostgresConnection} from '../scripts/postgres-readiness.mjs';

// Probe inputs are synthetic. None of these assertions is a PostgreSQL approval.
const invoke=waitForPostgresConnection as (probe:unknown,options?:unknown)=>Promise<void>;
const ready={version:170006,database:'helpdesk_test'};
const noWait=async()=>{};
const secret='SYNTHETIC_PROVIDER_DETAIL_DO_NOT_LOG';

test('R13 missing or coerced server versions never allow the SQL suite to start',async()=>{
 for(const version of [undefined,NaN,null,'170006','not-a-version',170006.5,true,170006n]){
  let calls=0,started=false,waits=0;
  await assert.rejects(()=>invoke(async()=>{calls++;return {version,database:'helpdesk_test'};},
   {attempts:3,sleep:async()=>{waits++;}}).then(()=>{started=true;}),/PostgreSQL 17/);
  assert.equal(started,false);assert.equal(calls,1);assert.equal(waits,0);
 }
});
test('R13 malformed probe rows fail without trying another connection',async()=>{
 for(const row of [null,undefined,[],Object.assign([],{...ready}),{}, {version:170006}, {version:170006,database:17}]){
  let calls=0;
  await assert.rejects(()=>invoke(async()=>{calls++;return row;},{attempts:3,sleep:()=>{throw Error('must not wait');}}),/PostgreSQL 17/);
  assert.equal(calls,1);
 }
});
test('R13 invalid attempt counts fail before invoking even a passing probe',async()=>{
 for(const attempts of [0,-1,1.5,NaN,Infinity,'2',null,Number.MAX_SAFE_INTEGER+1]){
  let calls=0;
  await assert.rejects(()=>invoke(async()=>{calls++;return ready;},{attempts,sleep:noWait}),/readiness options/);
  assert.equal(calls,0);
 }
});
test('R13 invalid probe or wait functions fail before any external work',async()=>{
 let calls=0;
 await assert.rejects(()=>invoke(null,{attempts:1,sleep:noWait}),/readiness options/);
 await assert.rejects(()=>invoke(async()=>{calls++;return ready;},{attempts:1,sleep:null}),/readiness options/);
 await assert.rejects(()=>invoke(async()=>{calls++;return ready;},null),/readiness options/);
 assert.equal(calls,0);
});
test('R13 provider exceptions cannot impersonate internal wrong-server errors',async()=>{
 const provider=Object.assign(Error(secret),{wrongServer:true});
 await assert.rejects(()=>invoke(async()=>{throw provider;},{attempts:1,sleep:noWait}),error=>{
  assert.ok(error instanceof Error);assert.notEqual(error,provider);assert.doesNotMatch(error.message,new RegExp(secret));
  assert.match(error.message,/did not become ready/);return true;
 });
});
test('R13 arbitrary thrown values are not inspected or serialized',async()=>{
 let inspected=0;
 const thrown=Object.defineProperty({},'wrongServer',{get(){inspected++;throw Error(secret);}});
 await assert.rejects(()=>invoke(async()=>{throw thrown;},{attempts:1,sleep:noWait}),error=>{
  assert.ok(error instanceof Error);assert.doesNotMatch(error.message,new RegExp(secret));return true;
 });
 assert.equal(inspected,0);
});
test('R13 broken probe metadata produces a safe wrong-server error',async()=>{
 const row=Object.defineProperty({database:'helpdesk_test'},'version',{get(){throw Error(secret);}});
 let waits=0;
 await assert.rejects(()=>invoke(async()=>row,{attempts:3,sleep:async()=>{waits++;}}),error=>{
  assert.ok(error instanceof Error);assert.match(error.message,/PostgreSQL 17/);assert.doesNotMatch(error.message,new RegExp(secret));return true;
 });
 assert.equal(waits,0);
});
test('R13 a broken readiness delay aborts safely without another probe',async()=>{
 let calls=0;
 await assert.rejects(()=>invoke(async()=>{calls++;throw Error(secret);},{attempts:3,sleep:async()=>{throw Error(secret);}}),error=>{
  assert.ok(error instanceof Error);assert.doesNotMatch(error.message,new RegExp(secret));assert.match(error.message,/readiness wait/);return true;
 });
 assert.equal(calls,1);
});
test('R13 PostgreSQL 17 integer boundaries and exact test database stay accepted',async()=>{
 for(const version of [170000,170006,179999]){
  let calls=0;
  await invoke(async()=>{calls++;return {version,database:'helpdesk_test'};},{attempts:1,sleep:noWait});
  assert.equal(calls,1);
 }
 for(const row of [{version:169999,database:'helpdesk_test'},{version:180000,database:'helpdesk_test'},
   {version:170006,database:'postgres'},{version:170006,database:'helpdesk_test '}]){
  await assert.rejects(()=>invoke(async()=>row,{attempts:1,sleep:noWait}),/PostgreSQL 17/);
 }
});
test('R13 default forty-attempt policy stays finite with no final delay',async()=>{
 let calls=0,waits=0;
 await assert.rejects(()=>invoke(async()=>{calls++;throw Error(secret);},{sleep:async()=>{waits++;}}),/did not become ready/);
 assert.equal(calls,40);assert.equal(waits,39);
});
test('R13 the last permitted successful query is accepted once',async()=>{
 let calls=0,waits=0;
 await invoke(async()=>{calls++;if(calls<3)throw Error(secret);return ready;},{attempts:3,sleep:async()=>{waits++;}});
 assert.equal(calls,3);assert.equal(waits,2);
});
test('R13 invalid metadata following a transient loss stops retries immediately',async()=>{
 let calls=0,waits=0;
 await assert.rejects(()=>invoke(async()=>{calls++;if(calls===1)throw Error(secret);return {database:'helpdesk_test'};},
  {attempts:5,sleep:async()=>{waits++;}}),/PostgreSQL 17/);
 assert.equal(calls,2);assert.equal(waits,1);
});
test('R13 validated server metadata is sampled once without repeated property evaluation',async()=>{
 let versionReads=0,databaseReads=0;
 const row={get version(){versionReads++;return 170006;},get database(){databaseReads++;return 'helpdesk_test';}};
 await invoke(async()=>row,{attempts:1,sleep:noWait});
 assert.equal(versionReads,1);assert.equal(databaseReads,1);
});
