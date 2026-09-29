import test from 'node:test';
import assert from 'node:assert/strict';
import {waitForPostgresConnection} from '../scripts/postgres-readiness.mjs';

test('database runner retries an early lost host connection before starting destructive SQL tests',async()=>{
 const attempts:string[]=[];
 await waitForPostgresConnection(async()=>{
  attempts.push('host-query');
  if(attempts.length===1)throw Error('Connection terminated unexpectedly');
  return {version:170006,database:'helpdesk_test'};
 },{attempts:3,sleep:async()=>{attempts.push('wait');}});
 assert.deepEqual(attempts,['host-query','wait','host-query']);
});

test('database runner rejects a reachable but incompatible local server',async()=>{
 await assert.rejects(()=>waitForPostgresConnection(async()=>({version:160000,database:'helpdesk_test'}),
  {attempts:3,sleep:async()=>{throw Error('should not retry wrong server');}}),/PostgreSQL 17/);
});
