import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {PostgresUnitOfWork} from '../src/infrastructure/postgres.ts';import type {SqlPool} from '../src/infrastructure/sql.ts';import {principal} from './fixtures.ts';
test('catalogue adapter passes selectors as SQL parameters on the transaction client',async()=>{
 const calls:{sql:string;values?:unknown[]}[]=[];const sql:SqlPool={query:async()=>{throw Error('must use checked-out client');},connect:async()=>({query:async(sql,values)=>{calls.push({sql,values});return {command:sql==='BEGIN'?'BEGIN':sql==='COMMIT'?'COMMIT':'SELECT',rowCount:0,rows:[]};},release(){}}),end:async()=>{}};
 const after={accountId:'account-a',productInstanceId:'instance-a',serviceCode:"SUPPORT' OR 1=1--"};
 await new PostgresUnitOfWork(sql).run(principal(),s=>s.supportContexts({limit:26,after,accountId:'account-a'},'2026-09-16T12:00:00Z'));
 const call=calls.find(c=>c.sql.includes('helpdesk_auth.support_contexts'));assert.ok(call);assert.deepEqual(call.values,['workspace-a','account-a','account-a','instance-a',after.serviceCode,26]);assert.ok(!call.sql.includes(after.serviceCode));assert.equal(calls[0]?.sql,'BEGIN');assert.equal(calls.at(-1)?.sql,'COMMIT');
});
test('candidate catalogue migration retains explicit private scope/account/product checks',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20260916000600_support_catalog.sql',import.meta.url),'utf8');
 for(const term of ["set search_path=''",'helpdesk_auth.has_scope','helpdesk_auth.has_account','helpdesk_auth.product_allowed',"status='active'",'statement_timestamp()',"collate \"C\"",'revoke all on function','to helpdesk_app',"select '0.5.0'::text"])
  assert.ok(sql.includes(term),'Missing sentinel: '+term);
 assert.doesNotMatch(sql,/grant\s+select\s+on/i);assert.doesNotMatch(sql,/\b(?:insert|update|delete)\s+(?:into|from)?\s*helpdesk_core/i);
});
