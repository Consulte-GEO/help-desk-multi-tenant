/** STATIC regression checks. No PostgreSQL parser/server is executed here. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const sql=readFileSync(new URL('../supabase/candidates/hda02_analysis_persistence.sql',import.meta.url),'utf8');
const body=(name:string)=>{const start=sql.indexOf(`create function helpdesk_auth.${name}(`);assert.notEqual(start,-1);return sql.slice(start,sql.indexOf('end $$;',start)+7);};
const auth=body('hda02_authorize');
test('static: HDA enforces current resource scope before returning private state',()=>{
 assert.match(auth,/cg_ticket_resource_allowed\(w,a,b.ticket_id,'tickets.read'\)/);
 assert.match(auth,/cg_lock_ticket_scope\(b.ticket_id,'tickets.read'\)/);
 assert.match(auth,/cg_lock_ticket_scope\(b.ticket_id,'tickets.write'\)/);
 assert.match(auth,/least\(b.valid_until,g.valid_until,resource_until\)/);
});
test('static: native authorization includes the core read capability',()=>assert.match(auth,/coalesce\(helpdesk_auth\.has_scope\(w,'tickets:read'\),false\)/));
test('static: human writes require the core write capability',()=>assert.match(auth,/permission<>'read' and not coalesce\(helpdesk_auth\.has_scope\(w,'tickets:write'\),false\)/));
test('static: human capability publication and HDA authorization share the exact advisory namespace',()=>assert.match(auth,/pg_advisory_xact_lock\(hashtextextended\('helpdesk-human-scopes:'\|\|w::text\|\|':'\|\|actor::text,0\)\)/));
for(const fn of ['can_read_ticket','has_account','product_allowed'])test(`static: ${fn} must be explicitly true, not NULL`,()=>assert.match(auth,new RegExp(`not coalesce\\(helpdesk_auth\\.${fn}\\([^\\n;]*?\\),false\\)`)));
test('static: operation persists an independent queue hash',()=>{assert.match(sql,/queue_hash text not null/);assert.match(body('hda02_apply'),/queue_hash=helpdesk_auth\.hda02_hash\(q\)/);assert.match(body('hda02_assert_operation'),/o\.queue_hash is distinct from helpdesk_auth\.hda02_hash\(q\.document\)/);});
test('static: job-only writes must run deferred integrity admission',()=>{assert.match(sql,/create constraint trigger hda02_job_complete after insert or update or delete on helpdesk_integration\.hda02_jobs deferrable initially deferred/);assert.match(body('hda02_job_admission'),/hda02_assert_operation/);});
test('static: JSON CHECK predicates for jobs fail closed on missing values',()=>{const t=sql.slice(sql.indexOf('create table helpdesk_integration.hda02_jobs('),sql.indexOf('create index hda02_claimable'));assert.match(t,/coalesce\(document->>'kind'='analysis',false\)/);assert.match(t,/coalesce\(document->>'status'=status,false\)/);assert.match(t,/document->>'jobId'=id::text/);});
test('static: job lease column must equal the JSON lease timestamp',()=>assert.match(sql,/coalesce\(case when status='leased' then \(document->'lease'->>'expiresAt'\)::timestamptz=lease_until/));
