import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PostgresUnitOfWork,assertSchemaCompatibility} from '../src/infrastructure/postgres.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';
import {principal,ticket} from './fixtures.ts';
const migration=new URL('../supabase/migrations/20260916000700_ticket_priority.sql',import.meta.url);
async function sql(){const s=await readFile(migration,'utf8').catch(()=>null);assert.ok(s,'New priority migration required');return s;}
test('priority grant is column-specific; no broad UPDATE/table ownership grant',async()=>{const s=await sql();assert.match(s,/grant update\s*\(priority\) on helpdesk_core\.tickets to helpdesk_app/i);assert.doesNotMatch(s,/grant\s+update\s+on/i);});
test('priority event and outbox invariant is checked on commit',async()=>{const s=await sql();assert.match(s,/create constraint trigger ticket_priority_outbox[\s\S]+deferrable initially deferred/i);assert.match(s,/e\.data->>'version'/);assert.match(s,/o\.payload->'data'->>'version'/);assert.match(s,/e\.data->>'reason'/);});
test('priority event shape rejects hidden extra fields and supports public projection',async()=>{const s=await sql();assert.match(s,/priority_event_shape/);assert.match(s,/event_visibility_kind/);assert.match(s,/priority_event_operator/);assert.match(s,/ticket\.priority_changed/);});
test('idempotency binding and cached priority reads revalidate the operator',async()=>{const s=await sql();assert.match(s,/create or replace function helpdesk_auth\.lookup_idempotency/);assert.match(s,/create or replace function helpdesk_auth\.limit_idempotency_records/);assert.ok((s.match(/priority\.change:%/g)??[]).length>=2);assert.match(s,/tickets:write/);assert.match(s,/is_operator/);});
test('trigger helpers keep private paths and schema changes for a real reason',async()=>{const s=await sql();assert.match(s,/set search_path=''/);assert.match(s,/select '0\.8\.0'::text/);assert.match(s,/revoke all on function helpdesk_core\.require_priority_outbox\(\) from public/);});
test('dedicated SQL update changes only priority/version/time with a composite resource predicate',async()=>{
 const calls:{sql:string;params:unknown[]}[]=[];
 const query=async(s:string,params:unknown[]=[])=>{calls.push({sql:s,params});return {command:s.split(' ')[0]?.toUpperCase(),rows:[],rowCount:s.startsWith('update')?1:0};};
 const pool:SqlPool={query,connect:async()=>({query,release(){}}),end:async()=>{}};
 const t={...ticket(),priority:'high' as const,version:2};await new PostgresUnitOfWork(pool).run(principal(),s=>s.updatePriority(t,1));
 const update=calls.find(c=>c.sql.startsWith('update'));assert.ok(update);assert.match(update.sql,/set priority=\$1,version=\$2,updated_at=\$3/);assert.match(update.sql,/workspace_id=\$4 and account_id=\$5 and id=\$6 and version=\$7/);assert.deepEqual(update.params,[t.priority,t.version,t.updatedAt,t.workspaceId,t.accountId,t.id,1]);assert.doesNotMatch(update.sql,/set (status|account_id|contract)/);
});
test('priority optimistic update with zero affected rows returns 412',async()=>{const query=async(s:string)=>({command:s.split(' ')[0]?.toUpperCase(),rows:[],rowCount:0});const pool:SqlPool={query,connect:async()=>({query,release(){}}),end:async()=>{}};await assert.rejects(()=>new PostgresUnitOfWork(pool).run(principal(),s=>s.updatePriority({...ticket(),priority:'high',version:2},1)),{status:412});});
test('runtime rejects pre-priority schema and accepts 0.23.0 candidate',async()=>{const pool=(v:string):SqlPool=>({query:async()=>({rows:[{version:v}],rowCount:1}),connect:async()=>{throw Error('unused');},end:async()=>{}});await assert.rejects(()=>assertSchemaCompatibility(pool('0.5.0')),{code:'schema_version_mismatch'});await assertSchemaCompatibility(pool('0.23.0'));});
test('SQL JSON extraction is grouped before JSON key subtraction',async()=>{const s=await sql();assert.match(s,/\(\(payload->'data'\)\s*-\s*array\['ticket_id','version'\]\)/);});
