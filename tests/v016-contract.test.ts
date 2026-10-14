/** Inventory/source checks only. Do not call these PostgreSQL execution tests. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {DATABASE_SECURITY_CONTRACT as c} from '../src/infrastructure/database-security-contract.ts';
import {DATABASE_SECURITY_QUERY} from '../src/infrastructure/database-security.ts';
import {loadMigrationBundle} from '../scripts/migration-files.ts';
const path='supabase/migrations/20260917001000_transaction_effects.sql';
const functions=['record_ticket_effect','record_conversation_effect','bind_effect_event','bind_effect_outbox','require_write_effect'];
test('write effects have a private table in the runtime inventory',()=>{
 const t=c.tables.find(x=>x.name==='helpdesk_audit.write_effects');assert.ok(t);assert.equal(t.read,false);assert.equal(t.insert,false);assert.deepEqual(t.updates,[]);assert.equal(c.schemaVersion,'0.23.0');
});
test('write effect trigger functions are never callable by the application',()=>{
 for(const name of functions){const f=c.functions.find(x=>x.signature===`helpdesk_audit.${name}()`);assert.ok(f);assert.equal(f.definer,true);assert.equal(f.execute,false);}
});
test('inventory requires the six enabled effect triggers including deferred completion',()=>{
 for(const name of ['record_ticket_effect','record_message_effect','record_note_effect','bind_write_effect_event','bind_write_effect_outbox','complete_write_effect'])assert.ok(c.triggers.some(t=>t.name===name));
 const t=c.triggers.find(t=>t.name==='complete_write_effect')!;assert.equal(t.deferred,true);assert.equal(t.type,5);
});
test('readiness requires both receipt uniqueness indexes',()=>{
 assert.match(DATABASE_SECURITY_QUERY,/write_effect_revision/);assert.match(DATABASE_SECURITY_QUERY,/write_effect_source/);
});
test('migration010 extends the nine originals without replacing their hashes',async()=>{
 const b=await loadMigrationBundle(process.cwd());assert.equal(b.schemaVersion,'0.23.0');assert.equal(b.migrations.length,16);
 const old=JSON.parse(await readFile('tests/fixtures/migration-baselines/v016.json','utf8'));
 assert.deepEqual(b.migrations.slice(0,9).map(m=>({file:m.file,sha256:m.sha256})),old.migrations);
});
test('effect SQL binds the actual top-level transaction, not caller IDs or xmin',async()=>{
 const sql=await readFile(path,'utf8');assert.match(sql,/transaction_id xid8 not null default pg_current_xact_id\(\)/i);
 assert.match(sql,/transaction_id=pg_current_xact_id\(\)/);assert.doesNotMatch(sql,/\bxmin\b|set_config\('app\.effect/i);
 assert.match(sql,/create constraint trigger complete_write_effect[\s\S]*deferrable initially deferred/i);
});
test('effect SQL never backfills historical effects or adds a runtime read policy',async()=>{
 const sql=await readFile(path,'utf8');assert.match(sql,/write_effects force row level security/i);assert.match(sql,/revoke all on helpdesk_audit.write_effects from public,helpdesk_app/i);
 assert.doesNotMatch(sql,/create policy|grant\s+(?:all|select|insert|update|delete)[^;]*on (?:table )?helpdesk_audit.write_effects/i);
 assert.match(sql,/expected_data[\s\S]*array\['body','reason','description'\]/);
});
