/** Destructive fixture SETUP is allowed ONLY on an explicitly opted-in fresh local test database. */
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {randomUUID} from 'node:crypto';import {HelpdeskService} from '../../src/application/helpdesk.ts';import {PostgresUnitOfWork,assertSafeDatabaseRole} from '../../src/infrastructure/postgres.ts';import {createAuthentication} from '../../src/infrastructure/authentication.ts';import {secretHash} from '../../src/domain/canonical.ts';import type {Principal} from '../../src/domain/model.ts';import type {SqlPool,SqlClient} from '../../src/infrastructure/sql.ts';
import {validateDatabaseTestTargets} from '../../scripts/database-target.ts';
const {adminUrl,appUrl}=validateDatabaseTestTargets(process.env);
const id=(n:number)=>'00000000-0000-4000-8000-'+n.toString().padStart(12,'0');
let admin:SqlPool,app:SqlPool,service:HelpdeskService,ticketId:string;
const p=(who:number,account:number,role:'requester'|'agent'='requester',workspace=1):Principal=>({id:id(who),workspaceId:id(workspace),kind:'human',workspaceRole:null,grants:[{accountId:id(account),role}],scopes:['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write']});
const alice=p(11,101),bob=p(12,102),agent=p(13,101,'agent'),outsider=p(14,201,'requester',2);
const input={accountId:id(101),productInstanceId:id(401),serviceCode:'SUPPORT',subject:'Database integration ticket',description:'Local disposable fixture',priority:'normal' as const};
async function sqlAs(person:Principal,sql:string,values:unknown[]=[]){const c=await app.connect();try{await c.query('BEGIN');await c.query("select set_config('app.workspace_id',$1,true),set_config('app.principal_id',$2,true)",[person.workspaceId,person.id]);const r=await c.query(sql,values);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
before(async()=>{const moduleName='pg';const driver=await import(moduleName) as {Pool:new(options:Record<string,unknown>)=>SqlPool};admin=new driver.Pool({connectionString:adminUrl,max:2});
 const version=Number((await admin.query("select current_setting('server_version_num') as version")).rows[0]?.version);if(version<170000||version>=180000)throw Error('This suite requires PostgreSQL 17.');
 const existing=await admin.query("select 1 from pg_namespace where nspname like 'helpdesk_%'");if(existing.rows.length)throw Error('Use a FRESH helpdesk_test database. This test never drops existing schemas.');
 const migrations=new URL('../migrations/',import.meta.url);for(const file of (await readdir(migrations)).filter(x=>x.endsWith('.sql')).sort())await admin.query(await readFile(new URL(file,migrations),'utf8'));
 const password=decodeURIComponent(new URL(appUrl).password);const command=(await admin.query("select format('alter role helpdesk_app login password %L',$1) as command",[password])).rows[0]!.command;await admin.query(String(command));
 await admin.query(`insert into helpdesk_core.workspaces(id,name) values($1,'Workspace A'),($2,'Workspace B')`,[id(1),id(2)]);
 for(const who of [11,12,13,14])await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[id(who),id(1000+who)]);
 await admin.query("insert into helpdesk_auth.principals(id,kind) values($1,'integration')",[id(15)]);
 for(const [w,a] of [[1,101],[1,102],[2,201]])await admin.query('insert into helpdesk_core.accounts(workspace_id,id,name) values($1,$2,$3)',[id(w!),id(a!),'Account '+a]);
 for(const who of [alice,bob,agent,outsider])await admin.query('insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,$4)',[who.workspaceId,who.grants[0]!.accountId,who.id,who.grants[0]!.role]);
 for(const w of [1,2]){await admin.query("insert into helpdesk_core.products(workspace_id,id,code,name) values($1,$2,'TEST','Product')",[id(w),id(300+w)]);await admin.query("insert into helpdesk_core.product_instances(workspace_id,product_id,id,environment) values($1,$2,$3,'staging')",[id(w),id(300+w),id(400+w)]);await admin.query("insert into helpdesk_core.services(workspace_id,product_id,code,name) values($1,$2,'SUPPORT','Support')",[id(w),id(300+w)]);await admin.query("insert into helpdesk_core.support_contracts(workspace_id,id,name) values($1,$2,'Contract')",[id(w),id(500+w)]);await admin.query("insert into helpdesk_core.contract_versions(workspace_id,contract_id,id,version,published,valid_from,policy) values($1,$2,$3,1,true,'2020-01-01','{}')",[id(w),id(500+w),id(600+w)]);}
 for(const [w,a,c] of [[1,101,701],[1,102,702],[2,201,703]])await admin.query("insert into helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) values($1,$2,$3,$4,'SUPPORT',$5,$6)",[id(w!),id(a!),id(300+w!),id(400+w!),id(600+w!),id(c!)]);
 app=new driver.Pool({connectionString:appUrl,max:12});await assertSafeDatabaseRole(app);service=new HelpdeskService(new PostgresUnitOfWork(app));ticketId=(await service.create(alice,input,'database-seed-create','db-test')).ticket.id;
 await service.addNote(agent,ticketId,'INTERNAL DATABASE NOTE','database-seed-note','db-test');
});
after(async()=>{await app?.end();await admin?.end();});
test('actual request login has no BYPASSRLS or table ownership',async()=>{await assertSafeDatabaseRole(app);});
test('all domain and authentication tables have ENABLE plus FORCE RLS',async()=>{const r=await admin.query("select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') and c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity)");assert.equal(r.rows.length,0);});
test('PUBLIC cannot execute private helpers',async()=>{const r=await admin.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname like 'helpdesk_%' and a.grantee=0 and a.privilege_type='EXECUTE'");assert.equal(r.rows.length,0);});
test('known ticket UUID cannot be read from another workspace',async()=>{const r=await sqlAs(outsider,'select id from helpdesk_core.tickets where id=$1',[ticketId]);assert.equal(r.rows.length,0);});
test('known ticket UUID cannot be read by sibling account',async()=>{const r=await sqlAs(bob,'select id from helpdesk_core.tickets where id=$1',[ticketId]);assert.equal(r.rows.length,0);});
test('requester cannot read notes with direct SQL, authorized agent can',async()=>{assert.equal((await sqlAs(alice,'select id from helpdesk_core.internal_notes where ticket_id=$1',[ticketId])).rows.length,0);assert.equal((await sqlAs(agent,'select id from helpdesk_core.internal_notes where ticket_id=$1',[ticketId])).rows.length,1);});
test('credential table denies direct app access',async()=>{await assert.rejects(()=>sqlAs(alice,'select * from helpdesk_auth.integration_credentials'),e=>(e as {code:string}).code==='42501');});
test('context is cleared between reused pooled connections',async()=>{await service.get(alice,ticketId);const r=await app.query("select nullif(current_setting('app.principal_id',true),'') as actor");assert.equal(r.rows[0]!.actor,null);});
test('concurrent PostgreSQL retries create one ticket and one creation outbox event',async()=>{const results=await Promise.all(Array.from({length:8},()=>service.create(alice,{...input,subject:'Concurrent database ticket'},'database-concurrent-key','db-test')));assert.equal(new Set(results.map(r=>r.ticket.id)).size,1);const r=await admin.query("select id from helpdesk_integration.outbox_events where ticket_id=$1 and type='ticket.created'",[results[0]!.ticket.id]);assert.equal(r.rows.length,1);});
test('same idempotency key with different body yields conflict',async()=>{await assert.rejects(()=>service.create(alice,{...input,subject:'Changed'},'database-seed-create','db-test'),e=>(e as {status:number}).status===409);});
test('published policy cannot be edited in place',async()=>{await assert.rejects(()=>admin.query("update helpdesk_core.contract_versions set policy='{\"changed\":true}' where id=$1",[id(601)]),e=>(e as {code:string}).code==='23514');});
test('committed ticket requires initial event and outbox even for an admin insert',async()=>{await assert.rejects(()=>admin.query('insert into helpdesk_core.tickets select workspace_id,account_id,$1,product_instance_id,service_code,coverage_id,contract_version_id,created_by,subject,description,status,priority,version,contract_snapshot,created_at,updated_at from helpdesk_core.tickets where id=$2',[randomUUID(),ticketId]),e=>(e as {code:string}).code==='23514');});
test('contract suspension after resolution blocks creation',async()=>{assert.equal((await service.resolve(alice,input)).status,'resolved');await admin.query("update helpdesk_core.support_contracts set status='suspended' where id=$1",[id(501)]);try{await assert.rejects(()=>service.create(alice,input,'database-suspension-key','db-test'),e=>(e as {status:number}).status===422);}finally{await admin.query("update helpdesk_core.support_contracts set status='active' where id=$1",[id(501)]);}});
test('revoked account grant takes effect despite previously resolved principal',async()=>{await admin.query('update helpdesk_auth.account_grants set active=false where principal_id=$1',[alice.id]);try{await assert.rejects(()=>service.get(alice,ticketId),e=>(e as {status:number}).status===404);}finally{await admin.query('update helpdesk_auth.account_grants set active=true where principal_id=$1',[alice.id]);}});
test('integration credential revocation invalidates a previously minted session',async()=>{const key='hd_key_'+'t'.repeat(43);await admin.query('insert into helpdesk_auth.integration_connections(workspace_id,id,product_instance_id,principal_id) values($1,$2,$3,$4)',[id(1),id(801),id(401),id(15)]);await admin.query("insert into helpdesk_auth.source_scope_bindings(workspace_id,connection_id,account_id,external_account_ref) values($1,$2,$3,'origin-account')",[id(1),id(801),id(101)]);await admin.query('insert into helpdesk_auth.integration_credentials(id,workspace_id,connection_id,key_hash) values($1,$2,$3,$4)',[id(901),id(1),id(801),secretHash(key)]);const auth=createAuthentication(app,{supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_test'}),session=await auth.exchangeToken(key);const req=new Request('https://hd.test',{headers:{authorization:'Bearer '+session.access_token,'x-workspace-id':id(1)}});assert.equal((await auth.authenticate(req)).kind,'integration');await admin.query('update helpdesk_auth.integration_credentials set revoked_at=now() where id=$1',[id(901)]);await assert.rejects(()=>auth.authenticate(req));});

// M1: these cases run only after the same fresh-database guard and real driver setup.
import {assertSchemaCompatibility,assertDatabaseSecurity} from '../../src/infrastructure/postgres.ts';
import {createPostgresRateLimiter} from '../../src/infrastructure/rate-limit.ts';
const machine:Principal={id:id(16),kind:'integration',workspaceId:id(1),workspaceRole:null,grants:[{accountId:id(101),role:'requester'}],scopes:['contexts:resolve','tickets:read','tickets:write'],connectionId:id(802),productInstanceIds:[id(401)]};
const machineKey='hd_key_'+'u'.repeat(43);
let machineTicket:string;
before(async()=>{
 // Separate from v0.1's deliberately revoked integration credential fixture.
 await admin.query("insert into helpdesk_auth.principals(id,kind) values($1,'integration')",[id(16)]);
 await admin.query('insert into helpdesk_auth.integration_connections(workspace_id,id,product_instance_id,principal_id) values($1,$2,$3,$4)',[id(1),id(802),id(401),id(16)]);
 await admin.query("insert into helpdesk_auth.source_scope_bindings(workspace_id,connection_id,account_id,external_account_ref) values($1,$2,$3,'m1-account')",[id(1),id(802),id(101)]);
 await admin.query('insert into helpdesk_auth.integration_credentials(id,workspace_id,connection_id,key_hash) values($1,$2,$3,$4)',[id(902),id(1),id(802),secretHash(machineKey)]);
 machineTicket=(await service.create(machine,input,'m1-machine-create-key','db-test')).ticket.id;
});
test('M1 schema readiness is checked with the real request login',async()=>{await assertSchemaCompatibility(app);await assertDatabaseSecurity(app);});
test('runtime role cannot read cached JSON directly, even for its current actor',async()=>{await assert.rejects(()=>sqlAs(alice,'select result from helpdesk_integration.api_idempotency_keys'),{code:'42501'});});
test('creation replay loses access after grant revocation, with no cached payload returned',async()=>{
 await admin.query('update helpdesk_auth.account_grants set active=false where principal_id=$1',[alice.id]);
 try{await assert.rejects(()=>service.create(alice,input,'database-seed-create','db-test'),{code:'resource_not_found'});const r=await sqlAs(alice,"select helpdesk_auth.lookup_idempotency('tickets.create','database-seed-create') as record");assert.deepEqual(r.rows[0]?.record,{denied:true});}
 finally{await admin.query('update helpdesk_auth.account_grants set active=true where principal_id=$1',[alice.id]);}
});
test('former agent cannot retrieve an internal note from the cache',async()=>{
 await admin.query("update helpdesk_auth.account_grants set role='requester' where principal_id=$1",[agent.id]);
 try{const r=await sqlAs(agent,"select helpdesk_auth.lookup_idempotency($1,'database-seed-note') as record",['notes.create:'+ticketId]);assert.deepEqual(r.rows[0]?.record,{denied:true});}
 finally{await admin.query("update helpdesk_auth.account_grants set role='agent' where principal_id=$1",[agent.id]);}
});
test('revoked integration read scope removes direct SQL visibility and cached access',async()=>{
 await admin.query("update helpdesk_auth.integration_connections set scopes=array['contexts:resolve'] where id=$1",[id(802)]);
 try{assert.equal((await sqlAs(machine,'select id from helpdesk_core.tickets where id=$1',[machineTicket])).rows.length,0);const r=await sqlAs(machine,"select helpdesk_auth.lookup_idempotency('tickets.create','m1-machine-create-key') as record");assert.deepEqual(r.rows[0]?.record,{denied:true});}
 finally{await admin.query('update helpdesk_auth.integration_connections set scopes=$1 where id=$2',[machine.scopes,id(802)]);}
});
test('read-only machine cannot bypass HTTP and insert a public message by SQL',async()=>{
 await admin.query("update helpdesk_auth.integration_connections set scopes=array['tickets:read'] where id=$1",[id(802)]);
 try{await assert.rejects(()=>sqlAs(machine,"insert into helpdesk_core.ticket_messages(workspace_id,account_id,ticket_id,id,actor_id,actor_type,body,created_at) values($1,$2,$3,$4,$5,'integration','must fail',now())",[id(1),id(101),machineTicket,randomUUID(),machine.id]),{code:'42501'});}
 finally{await admin.query('update helpdesk_auth.integration_connections set scopes=$1 where id=$2',[machine.scopes,id(802)]);}
});
test('integration cannot forge a human-agent author type',async()=>{await assert.rejects(()=>sqlAs(machine,"insert into helpdesk_core.ticket_messages(workspace_id,account_id,ticket_id,id,actor_id,actor_type,body,created_at) values($1,$2,$3,$4,$5,'human_agent','forged',now())",[id(1),id(101),machineTicket,randomUUID(),machine.id]),{code:'42501'});});
test('requester cannot use direct SQL to force a forbidden status change',async()=>{await assert.rejects(()=>sqlAs(alice,"update helpdesk_core.tickets set status='closed',version=version+1,updated_at=now() where id=$1",[ticketId]),{code:'42501'});});
test('composite FK rejects a ticket referencing a sibling account coverage',async()=>{await assert.rejects(()=>admin.query('insert into helpdesk_core.tickets select workspace_id,$1,$2,product_instance_id,service_code,coverage_id,contract_version_id,created_by,subject,description,status,priority,version,contract_snapshot,created_at,updated_at from helpdesk_core.tickets where id=$3',[id(102),randomUUID(),ticketId]),{code:'23503'});});
test('cross-account public-message insertion is denied by SQL',async()=>{await assert.rejects(()=>sqlAs(bob,"insert into helpdesk_core.ticket_messages(workspace_id,account_id,ticket_id,id,actor_id,actor_type,body,created_at) values($1,$2,$3,$4,$5,'customer','forged',now())",[id(1),id(101),ticketId,randomUUID(),bob.id]),{code:'42501'});});
test('integration cannot read notes through table or operation helper',async()=>{assert.equal((await sqlAs(machine,'select id from helpdesk_core.internal_notes')).rows.length,0);});
test('concurrent updates with the same ETag produce exactly one transition',async()=>{
 const fresh=await service.create(alice,input,'m1-concurrent-transitions','db-test');
 const results=await Promise.allSettled(['a','b'].map(k=>service.transition(agent,fresh.ticket.id,'open',1,'Testing lock','m1-transition-'+k+'-key','db-test')));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const failed=results.find(r=>r.status==='rejected');assert.equal(failed?.status==='rejected'&&(failed.reason as {status:number}).status,412);
});
test('transaction rollback clears context on the exact same single-connection pool',async()=>{
 const moduleName='pg',driver=await import(moduleName) as {Pool:new(options:Record<string,unknown>)=>SqlPool};const one=new driver.Pool({connectionString:appUrl,max:1});
 try{await assert.rejects(()=>new PostgresUnitOfWork(one).run(alice,async()=>{throw Error('injected');}));const r=await one.query("select nullif(current_setting('app.principal_id',true),'') as actor,nullif(current_setting('app.workspace_id',true),'') as workspace");assert.equal(r.rows[0]?.actor,null);assert.equal(r.rows[0]?.workspace,null);}
 finally{await one.end();}
});
test('expired replay returns conflict, preserves ticket and does not disclose old response',async()=>{
 const key='m1-expired-response-key';const created=await service.create(alice,input,key,'db-test');
 await admin.query("update helpdesk_integration.api_idempotency_keys set created_at=now()-interval '10 days',response_expires_at=now()-interval '1 day',purge_after=now()+interval '80 days' where key=$1",[key]);
 const r=await sqlAs(alice,'select helpdesk_auth.lookup_idempotency($1,$2) as record',['tickets.create',key]);assert.deepEqual(r.rows[0]?.record,{expired:true});
 await assert.rejects(()=>service.create(alice,input,key,'db-test'),{code:'idempotency_expired'});assert.equal((await service.get(alice,created.ticket.id)).id,created.ticket.id);
});
test('SQL limiter rejects malformed budgets and caller-chosen thresholds',async()=>{
 for(const b of [[],[{policy:'unknown',key:'a'.repeat(64)}],[{policy:'ingress',key:'bad'}],[{policy:'ingress',key:'a'.repeat(64),limit:999999}]])await assert.rejects(()=>app.query('select helpdesk_auth.consume_rate_limits($1::jsonb)',[JSON.stringify(b)]),{code:'22023'});
});
test('multiple HTTP instances share the token-exchange budget and denial consumes no other budget',async()=>{
 // Start away from a fixed-window boundary to avoid legitimate rollover during this test.
 const seconds=Number((await admin.query('select extract(second from clock_timestamp()) as seconds')).rows[0]?.seconds);
 if(seconds>50)await new Promise(r=>setTimeout(r,(61-seconds)*1000));
 const key=secretHash(randomUUID()),other=secretHash(randomUUID());
 const budget=JSON.stringify([{policy:'token_exchange',key}]);
 const results=await Promise.all(Array.from({length:15},()=>app.query('select helpdesk_auth.consume_rate_limits($1::jsonb) as decision',[budget])));
 assert.equal(results.filter(r=>(r.rows[0]?.decision as {allowed:boolean}).allowed).length,10);
 const denied=await app.query('select helpdesk_auth.consume_rate_limits($1::jsonb) as decision',[JSON.stringify([{policy:'token_exchange',key},{policy:'workspace',key:other}])]);assert.equal((denied.rows[0]?.decision as {allowed:boolean}).allowed,false);
 assert.equal((await admin.query('select used from helpdesk_auth.rate_limit_buckets where bucket_key=$1',[other])).rows.length,0);
});
test('HTTP limiter adapter consumes real SQL budgets with pseudonymous keys',async()=>{await createPostgresRateLimiter(app,'q'.repeat(43)).afterAuthentication(alice);});
test('app cannot access rate bucket rows or invoke technical cleanup',async()=>{
 await assert.rejects(()=>app.query('select * from helpdesk_auth.rate_limit_buckets'),{code:'42501'});
 await assert.rejects(()=>app.query('select helpdesk_auth.maintain_ephemeral(false,10)'),{code:'42501'});
});
test('connection-wide active-session quota serializes concurrent token exchanges',async()=>{
 const auth=createAuthentication(app,{supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_test'});
 const results=await Promise.allSettled(Array.from({length:55},()=>auth.exchangeToken(machineKey)));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,50);
 for(const r of results)if(r.status==='rejected')assert.equal((r.reason as {code:string}).code,'PHD01');
});
test('technical cleanup defaults to simulation and never deletes tickets or pending outbox',async()=>{
 const key=secretHash(randomUUID());await admin.query("insert into helpdesk_auth.rate_limit_buckets(policy,bucket_key,window_start,used) values('ingress',$1,now()-interval '2 days',1)",[key]);
 const beforeTickets=(await admin.query('select count(*) as n from helpdesk_core.tickets')).rows[0]?.n,beforeOutbox=(await admin.query('select count(*) as n from helpdesk_integration.outbox_events')).rows[0]?.n;
 const preview=(await admin.query('select helpdesk_auth.maintain_ephemeral() as result')).rows[0]?.result as {dry_run:boolean};assert.equal(preview.dry_run,true);assert.equal((await admin.query('select 1 from helpdesk_auth.rate_limit_buckets where bucket_key=$1',[key])).rows.length,1);
 await admin.query('select helpdesk_auth.maintain_ephemeral(false,1000)');
 assert.equal((await admin.query('select count(*) as n from helpdesk_core.tickets')).rows[0]?.n,beforeTickets);assert.equal((await admin.query('select count(*) as n from helpdesk_integration.outbox_events')).rows[0]?.n,beforeOutbox);
 assert.equal((await admin.query('select 1 from helpdesk_auth.rate_limit_buckets where bucket_key=$1',[key])).rows.length,0);
});
