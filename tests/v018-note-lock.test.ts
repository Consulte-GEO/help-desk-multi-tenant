import test from 'node:test';import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {PostgresUnitOfWork} from '../src/infrastructure/postgres.ts';
import {noteDriver,noteWriter} from './helpers/v018-driver.ts';
import {ticketActions} from '../src/application/ticket-actions.ts';
import {loadMigrationBundle} from '../scripts/migration-files.ts';
const clock=()=>new Date('2026-09-17T18:00:00.000Z');
test('note-only operator creates and replays without requesting the ticket UPDATE policy',async()=>{
 const f=noteDriver(),s=new HelpdeskService(new PostgresUnitOfWork(f.pool),clock),key='v018-note-only-key';
 assert.equal(ticketActions(f.p,f.t).add_note,true);
 const first=await s.addNote(f.p,f.t.id,'Internal synthetic note',key,'v018-request');
 const replay=await s.addNote(f.p,f.t.id,'Internal synthetic note',key,'v018-request');
 assert.equal(first.replayed,false);assert.equal(replay.replayed,true);assert.deepEqual(replay.note,first.note);
 assert.equal(f.snapshot().notes.length,1);assert.equal(f.snapshot().events.length,1);assert.equal(f.snapshot().cache.size,1);
 assert.equal(f.t.version,1);
 assert.ok(f.calls.some(c=>c.sql.includes('from helpdesk_core.tickets')));
 assert.ok(!f.calls.some(c=>/for update|insert.*outbox|update helpdesk_core.tickets|select.*from helpdesk_core.internal_notes/is.test(c.sql)));
 await assert.rejects(()=>s.notes(f.p,f.t.id),{status:403});
 await assert.rejects(()=>s.addMessage(f.p,f.t.id,'No public write','v018-message-key-01','r'),{status:403});
});
test('operator with broad scopes uses the same non-updating note path',async()=>{
 const p={...noteWriter(),scopes:['tickets:read','tickets:write','notes:read','notes:write']},f=noteDriver(p);
 await new HelpdeskService(new PostgresUnitOfWork(f.pool),clock).addNote(p,f.t.id,'Internal note','v018-note-broad-01','r');
 assert.ok(!f.calls.some(c=>/for update/i.test(c.sql)));assert.equal(f.snapshot().notes.length,1);
});
test('note write still denies read-only, requester and missing ticket-read identities before insertion',async()=>{
 for(const p of [{...noteWriter(),scopes:['tickets:read']},{...noteWriter(),grants:[{accountId:noteWriter().grants[0]!.accountId,role:'requester' as const}]},{...noteWriter(),scopes:['notes:write']}]){
  const f=noteDriver(p),s=new HelpdeskService(new PostgresUnitOfWork(f.pool),clock);
  await assert.rejects(()=>s.addNote(p,f.t.id,'Unauthorized','v018-note-deny-01','r'));
  assert.equal(f.snapshot().notes.length,0);assert.ok(!f.calls.some(c=>c.sql.startsWith('insert')));
 }
});
test('revoking note write prevents replay without granting collection read',async()=>{
 const f=noteDriver(),s=new HelpdeskService(new PostgresUnitOfWork(f.pool),clock),key='v018-note-revoke-01';
 await s.addNote(f.p,f.t.id,'Original receipt',key,'r');
 await assert.rejects(()=>s.addNote({...f.p,scopes:['tickets:read','notes:read']},f.t.id,'Original receipt',key,'r'),{status:403});
 assert.equal(f.snapshot().notes.length,1);assert.equal(f.snapshot().cache.size,1);
});
test('new migration narrows the internal conversation lock without changing application grants',async()=>{
 const b=await loadMigrationBundle(process.cwd()),m=b.migrations.find(m=>m.file.includes('conversation_lock'));
 assert.ok(m,'An append-only migration is required for the trigger lock change');
 assert.match(m.sql,/create or replace function helpdesk_audit\.record_conversation_effect\(\)/i);
 assert.match(m.sql,/for no key update/i);assert.doesNotMatch(m.sql,/grant\s+(?:select|update|insert|delete)|create policy|alter policy/i);
 assert.equal(b.schemaVersion,'0.23.0');
});
