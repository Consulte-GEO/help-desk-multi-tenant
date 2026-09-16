// These are structural sentinels, NOT execution of SQL or proof of RLS correctness.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const base=new URL('../supabase/migrations/',import.meta.url);
const policyFile=new URL('20260915000300_m1_authorization.sql',base);
const quotaFile=new URL('20260915000400_m1_resource_limits.sql',base);
const migration=(url:URL)=>{assert.ok(existsSync(url),'M1 migration must exist');return readFileSync(url,'utf8');};
test('M1 scopes are enforced by explicit restrictive DB policies',()=>{const sql=migration(policyFile);for(const scope of ['tickets:read','tickets:write','contexts:resolve','notes:read','notes:write'])assert.ok(sql.includes(scope));assert.match(sql,/as restrictive/gi);assert.match(sql,/create function helpdesk_auth\.has_scope/);assert.match(sql,/revoke all on function helpdesk_auth\.has_scope/);});
test('scope migration guards ticket transitions and message actor type at database boundary',()=>{const sql=migration(policyFile);assert.match(sql,/guard_ticket_transition/);assert.match(sql,/actor_type/);assert.match(sql,/human_agent/);});
test('bounded quota storage is private with RLS and stable key, not a row per request',()=>{const sql=migration(quotaFile);assert.match(sql,/primary key\(policy,bucket_key\)/);assert.match(sql,/force row level security/i);assert.match(sql,/consume_rate_limits/);assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/order by policy/);assert.match(sql,/revoke all on helpdesk_auth.rate_limit_buckets from public,helpdesk_app/);});
test('response expiration retains a tombstone instead of silently replaying or recreating',()=>{const sql=migration(quotaFile);assert.match(sql,/response_expires_at/);assert.match(sql,/purge_after/);assert.match(sql,/interval '7 days'/);assert.match(sql,/interval '90 days'/);assert.match(sql,/result=null/);});
test('maintenance is opt-in, bounded, does not delete tickets or outbox, and app has no execute grant',()=>{const sql=migration(quotaFile);assert.match(sql,/dry_run boolean default true/);assert.match(sql,/batch_size>1000/);assert.match(sql,/helpdesk_maintenance/);assert.doesNotMatch(sql,/delete from helpdesk_core\./i);assert.doesNotMatch(sql,/delete from helpdesk_integration\.outbox_events/i);assert.doesNotMatch(sql,/grant execute on function helpdesk_auth\.maintain_ephemeral[^;]*to helpdesk_app/i);});
test('session quota serializes by connection and limits active sessions',()=>{const sql=migration(quotaFile);assert.match(sql,/limit_active_sessions/);assert.match(sql,/>=50/);assert.match(sql,/connection_id/);assert.match(sql,/PHD01/);});
