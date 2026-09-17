/** Destructive fixture SETUP is allowed ONLY on an explicitly opted-in fresh local test database. */
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {HelpdeskService} from '../../src/application/helpdesk.ts';import {PostgresUnitOfWork,assertSafeDatabaseRole} from '../../src/infrastructure/postgres.ts';import {createAuthentication} from '../../src/infrastructure/authentication.ts';import {secretHash} from '../../src/domain/canonical.ts';import type {Principal} from '../../src/domain/model.ts';import type {SqlPool,SqlClient} from '../../src/infrastructure/sql.ts';
import {validateDatabaseTestTargets} from '../../scripts/database-target.ts';
import {loadMigrationBundle} from '../../scripts/migration-files.ts';
const {adminUrl,appUrl}=validateDatabaseTestTargets(process.env);
const migrationBundle=await loadMigrationBundle(process.cwd());
const id=(n:number)=>'00000000-0000-4000-8000-'+n.toString().padStart(12,'0');
let admin:SqlPool,app:SqlPool,service:HelpdeskService,ticketId:string;
const p=(who:number,account:number,role:'requester'|'agent'='requester',workspace=1):Principal=>({id:id(who),workspaceId:id(workspace),kind:'human',workspaceRole:null,grants:[{accountId:id(account),role}],scopes:['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write']});
const alice=p(11,101),bob=p(12,102),agent=p(13,101,'agent'),outsider=p(14,201,'requester',2);
const input={accountId:id(101),productInstanceId:id(401),serviceCode:'SUPPORT',subject:'Database integration ticket',description:'Local disposable fixture',priority:'normal' as const};
async function sqlAs(person:Principal,sql:string,values:unknown[]=[]){const c=await app.connect();try{await c.query('BEGIN');await c.query("select set_config('app.workspace_id',$1,true),set_config('app.principal_id',$2,true)",[person.workspaceId,person.id]);const r=await c.query(sql,values);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
before(async()=>{const moduleName='pg';const driver=await import(moduleName) as {Pool:new(options:Record<string,unknown>)=>SqlPool};admin=new driver.Pool({connectionString:adminUrl,max:2});
 const version=Number((await admin.query("select current_setting('server_version_num') as version")).rows[0]?.version);if(version<170000||version>=180000)throw Error('This suite requires PostgreSQL 17.');
 const existing=await admin.query("select 1 from pg_namespace where nspname like 'helpdesk_%'");if(existing.rows.length)throw Error('Use a FRESH helpdesk_test database. This test never drops existing schemas.');
 for(const migration of migrationBundle.migrations)await admin.query(migration.sql);
 const password=decodeURIComponent(new URL(appUrl).password);const command=(await admin.query("select format('alter role helpdesk_app login password %L',$1) as command",[password])).rows[0]!.command;await admin.query(String(command));
 await admin.query(`insert into helpdesk_core.workspaces(id,name) values($1,'Workspace A'),($2,'Workspace B')`,[id(1),id(2)]);
 for(const who of [11,12,13,14])await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[id(who),id(1000+who)]);
 await admin.query("insert into helpdesk_auth.principals(id,kind) values($1,'integration')",[id(15)]);
 for(const [w,a] of [[1,101],[1,102],[2,201]])await admin.query('insert into helpdesk_core.accounts(workspace_id,id,name) values($1,$2,$3)',[id(w!),id(a!),'Account '+a]);
 for(const who of [alice,bob,agent,outsider])await admin.query('insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,$4)',[who.workspaceId,who.grants[0]!.accountId,who.id,who.grants[0]!.role]);
 // New humans require explicit provisioning after migration009. This is test setup, not a request grant.
 for(const who of [alice,bob,agent,outsider])await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,0,$4,$5)',[who.workspaceId,who.id,who.scopes,'Synthetic baseline provisioning',randomUUID()]);
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
test('committed ticket requires initial event and outbox even for an admin insert',async()=>{await assert.rejects(()=>admin.query('insert into helpdesk_core.tickets(workspace_id,account_id,id,product_instance_id,service_code,coverage_id,contract_version_id,created_by,subject,description,status,priority,version,contract_snapshot,created_at,updated_at) select workspace_id,account_id,$1,product_instance_id,service_code,coverage_id,contract_version_id,created_by,subject,description,status,priority,version,contract_snapshot,created_at,updated_at from helpdesk_core.tickets where id=$2',[randomUUID(),ticketId]),e=>(e as {code:string}).code==='23514');});
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
test('composite FK rejects a ticket referencing a sibling account coverage',async()=>{await assert.rejects(()=>admin.query('insert into helpdesk_core.tickets(workspace_id,account_id,id,product_instance_id,service_code,coverage_id,contract_version_id,created_by,subject,description,status,priority,version,contract_snapshot,created_at,updated_at) select workspace_id,$1,$2,product_instance_id,service_code,coverage_id,contract_version_id,created_by,subject,description,status,priority,version,contract_snapshot,created_at,updated_at from helpdesk_core.tickets where id=$3',[id(102),randomUUID(),ticketId]),{code:'23503'});});
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

// M1c: definitions for real PostgreSQL, NOT executed by the in-memory npm test suite.
import {runTransaction,withControlTransactions} from '../../src/infrastructure/transaction.ts';
async function lifecycleFixture(workspace=1,account=101,instance=401){
 const principalId=randomUUID(),connectionId=randomUUID(),credentialId=randomUUID();
 const key='hd_key_'+secretHash(randomUUID());
 await admin.query("insert into helpdesk_auth.principals(id,kind) values($1,'integration')",[principalId]);
 await admin.query('insert into helpdesk_auth.integration_connections(workspace_id,id,product_instance_id,principal_id) values($1,$2,$3,$4)',[id(workspace),connectionId,id(instance),principalId]);
 await admin.query('insert into helpdesk_auth.source_scope_bindings(workspace_id,connection_id,account_id,external_account_ref) values($1,$2,$3,$4)',[id(workspace),connectionId,id(account),randomUUID()]);
 await admin.query('insert into helpdesk_auth.integration_credentials(id,workspace_id,connection_id,key_hash) values($1,$2,$3,$4)',[credentialId,id(workspace),connectionId,secretHash(key)]);
 const auth=createAuthentication(withControlTransactions(app),{supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_test'});
 const request=(token:string)=>new Request('https://hd.test/v1/me',{headers:{authorization:'Bearer '+token,'x-workspace-id':id(workspace)}});
 return {auth,key,credentialId,connectionId,principalId,request};
}
test('M1c actual PostgreSQL COMMIT after a swallowed SQL error is not business success',async()=>{
 const messageId=randomUUID();
 await assert.rejects(()=>runTransaction(app,agent,async client=>{
  await client.query("insert into helpdesk_core.ticket_messages(workspace_id,account_id,ticket_id,id,actor_id,actor_type,body,created_at) values($1,$2,$3,$4,$5,'human_agent','Uncommitted probe',now())",[id(1),id(101),ticketId,messageId,agent.id]);
  // Deliberately swallow a server-side statement failure to reproduce an aborted transaction.
  try{await client.query('select 1/0');}catch(error){assert.equal((error as {code:string}).code,'22012');}
  return {mustNotReturn:true};
 }),{status:503,code:'transaction_outcome_unknown'});
 assert.equal((await admin.query('select id from helpdesk_core.ticket_messages where id=$1',[messageId])).rows.length,0);
});
test('M1c control statements see the real server timeouts and empty identity selectors',async()=>{
 const result=await withControlTransactions(app).query("select current_setting('statement_timeout') as statement,current_setting('lock_timeout') as lock,current_setting('idle_in_transaction_session_timeout') as idle,current_setting('transaction_timeout') as transaction,current_setting('app.workspace_id') as workspace,current_setting('app.principal_id') as actor");
 assert.deepEqual(result.rows[0],{statement:'8s',lock:'2s',idle:'10s',transaction:'15s',workspace:'',actor:''});
});
test('M1c control failure resets timeouts and context on the same single-connection pool',async()=>{
 const moduleName='pg',driver=await import(moduleName) as {Pool:new(options:Record<string,unknown>)=>SqlPool};
 const one=new driver.Pool({connectionString:appUrl,max:1});
 try{
  const read="select current_setting('transaction_timeout') as timeout,nullif(current_setting('app.principal_id',true),'') as actor,nullif(current_setting('app.workspace_id',true),'') as workspace";
  const baseline=await one.query(read);
  await assert.rejects(()=>withControlTransactions(one).query('select 1/0'),{code:'22012'});
  assert.deepEqual((await one.query(read)).rows,baseline.rows);
 }finally{await one.end();}
});
test('M1c self-revocation denies the revoked bearer and preserves its peer and credential',async()=>{
 const f=await lifecycleFixture(),first=await f.auth.exchangeToken(f.key),peer=await f.auth.exchangeToken(f.key);
 await f.auth.revokeSession(first.access_token);
 await assert.rejects(()=>f.auth.authenticate(f.request(first.access_token)),{status:403});
 assert.equal((await f.auth.authenticate(f.request(peer.access_token))).id,f.principalId);
 assert.equal((await admin.query('select revoked_at from helpdesk_auth.integration_credentials where id=$1',[f.credentialId])).rows[0]?.revoked_at,null);
 assert.ok((await f.auth.exchangeToken(f.key)).access_token);
});
test('M1c terminating workspace A session cannot terminate workspace B session',async()=>{
 const a=await lifecycleFixture(),b=await lifecycleFixture(2,201,402),sa=await a.auth.exchangeToken(a.key),sb=await b.auth.exchangeToken(b.key);
 await a.auth.revokeSession(sa.access_token);
 assert.equal((await b.auth.authenticate(b.request(sb.access_token))).workspaceId,id(2));
 assert.equal((await admin.query('select token_hash from helpdesk_auth.integration_sessions where token_hash=$1',[secretHash(sb.access_token)])).rows.length,1);
});
test('M1c repeated and nonexistent session digests receive the same SQL acknowledgement',async()=>{
 const f=await lifecycleFixture(),session=await f.auth.exchangeToken(f.key),hash=secretHash(session.access_token);
 const results=[];for(const value of [hash,hash,secretHash(randomUUID())])results.push((await withControlTransactions(app).query('select helpdesk_auth.revoke_session($1) as result',[value])).rows[0]?.result);
 assert.deepEqual(results,[true,true,true]);
});
test('M1c an expired session can be terminated even after connection access is disabled',async()=>{
 const f=await lifecycleFixture(),session=await f.auth.exchangeToken(f.key);
 await admin.query("update helpdesk_auth.integration_sessions set expires_at=now()-interval '1 second' where token_hash=$1",[secretHash(session.access_token)]);
 await admin.query('update helpdesk_auth.integration_connections set active=false where id=$1',[f.connectionId]);
 await f.auth.revokeSession(session.access_token);
 assert.equal((await admin.query('select token_hash from helpdesk_auth.integration_sessions where token_hash=$1',[secretHash(session.access_token)])).rows.length,0);
});
test('M1c the runtime role cannot delete session-table rows directly',async()=>{
 await assert.rejects(()=>app.query('delete from helpdesk_auth.integration_sessions where token_hash=$1',[secretHash(randomUUID())]),{code:'42501'});
});
test('M1c the revocation helper is private, search-path hardened and excluded from maintenance',async()=>{
 const result=await admin.query("select p.prosecdef,p.proconfig,has_function_privilege('helpdesk_app',p.oid,'EXECUTE') as app,has_function_privilege('helpdesk_maintenance',p.oid,'EXECUTE') as maintenance from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='helpdesk_auth' and p.proname='revoke_session'");
 assert.equal(result.rows.length,1);const row=result.rows[0]!;
 assert.equal(row.prosecdef,true);assert.equal(row.app,true);assert.equal(row.maintenance,false);
 assert.ok((row.proconfig as string[]).some(value=>value==='search_path=""'||value==='search_path='));
 await assertSchemaCompatibility(withControlTransactions(app));
});
test('M1c the revocation helper rejects malformed hashes without accepting another selector',async()=>{
 for(const hash of [null,'','short','A'.repeat(64),'x'.repeat(200)])await assert.rejects(()=>withControlTransactions(app).query('select helpdesk_auth.revoke_session($1)',[hash]),{code:'22023'});
});
test('M1c concurrent termination is idempotent and does not affect peer sessions',async()=>{
 const f=await lifecycleFixture(),session=await f.auth.exchangeToken(f.key),peer=await f.auth.exchangeToken(f.key);
 await Promise.all(Array.from({length:8},()=>f.auth.revokeSession(session.access_token)));
 await assert.rejects(()=>f.auth.authenticate(f.request(session.access_token)),{status:403});
 assert.equal((await f.auth.authenticate(f.request(peer.access_token))).kind,'integration');
});

// M1d: written database scenarios, run ONLY in a fresh local PostgreSQL 17.
const catalogSQL='select item from helpdesk_auth.support_contexts($1,$2,$3,$4,$5,$6) as result(item)';
const catalogArgs=(workspace=1):unknown[]=>[id(workspace),null,null,null,null,51];
test('M1d real catalog returns only authorized account labels in each workspace',async()=>{
 for(const [actor,account,workspace] of [[alice,101,1],[bob,102,1],[outsider,201,2]] as const){
  const page=await service.supportContexts(actor,{limit:50});assert.equal(page.items.length,1);
  assert.deepEqual(page.items[0],{workspaceId:id(workspace),accountId:id(account),accountName:'Account '+account,productInstanceId:id(400+workspace),productName:'Product',environment:'staging',serviceCode:'SUPPORT',serviceName:'Support'});
 }
});
test('M1d forbidden account filters are denied in both service and private helper',async()=>{
 await assert.rejects(()=>service.supportContexts(alice,{limit:50,accountId:id(102)}),{status:404});
 await assert.rejects(()=>sqlAs(alice,catalogSQL,[id(1),id(102),null,null,null,51]),{code:'42501'});
});
test('M1d a selected foreign workspace cannot override the transaction workspace',async()=>{
 await assert.rejects(()=>sqlAs(alice,catalogSQL,catalogArgs(2)),{code:'42501'});
 await assert.rejects(()=>sqlAs(alice,catalogSQL,[null,null,null,null,null,51]),{code:'42501'});
});
test('M1d revoking a live account grant clears catalog despite a cached principal',async()=>{
 await admin.query('update helpdesk_auth.account_grants set active=false where principal_id=$1',[alice.id]);
 try{assert.equal((await service.supportContexts(alice,{limit:50})).items.length,0);}
 finally{await admin.query('update helpdesk_auth.account_grants set active=true where principal_id=$1',[alice.id]);}
});
test('M1d machine discovery respects its live account binding and product instance',async()=>{
 const page=await service.supportContexts(machine,{limit:100});assert.equal(page.items.length,1);assert.equal(page.items[0]?.accountId,id(101));assert.equal(page.items[0]?.productInstanceId,id(401));
 await admin.query('update helpdesk_auth.source_scope_bindings set active=false where connection_id=$1',[id(802)]);
 try{assert.equal((await service.supportContexts(machine,{limit:100})).items.length,0);}
 finally{await admin.query('update helpdesk_auth.source_scope_bindings set active=true where connection_id=$1',[id(802)]);}
});
test('M1d removing contexts scope denies SQL discovery even with old principal scopes',async()=>{
 await admin.query("update helpdesk_auth.integration_connections set scopes=array['tickets:read'] where id=$1",[id(802)]);
 try{await assert.rejects(()=>sqlAs(machine,catalogSQL,catalogArgs()),{code:'42501'});}
 finally{await admin.query('update helpdesk_auth.integration_connections set scopes=$1 where id=$2',[machine.scopes,id(802)]);}
});
test('M1d disabled coverage disappears from real catalog',async()=>{
 await admin.query('update helpdesk_core.coverages set enabled=false where id=$1',[id(701)]);
 try{assert.equal((await service.supportContexts(alice,{limit:50})).items.length,0);}
 finally{await admin.query('update helpdesk_core.coverages set enabled=true where id=$1',[id(701)]);}
});
test('M1d suspension after catalog selection still blocks the actual creation',async()=>{
 assert.equal((await service.supportContexts(alice,{limit:50})).items.length,1);
 await admin.query("update helpdesk_core.support_contracts set status='suspended' where id=$1",[id(501)]);
 try{assert.equal((await service.supportContexts(alice,{limit:50})).items.length,0);await assert.rejects(()=>service.create(alice,input,'m1d-selected-then-suspended','db-test'),{status:422});}
 finally{await admin.query("update helpdesk_core.support_contracts set status='active' where id=$1",[id(501)]);}
});
test('M1d duplicate eligible coverages remain one option but resolution stays ambiguous',async()=>{
 const duplicate=randomUUID();await admin.query('insert into helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) select workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,$1 from helpdesk_core.coverages where id=$2',[duplicate,id(701)]);
 try{assert.equal((await service.supportContexts(alice,{limit:50})).items.length,1);assert.equal((await service.resolve(alice,input)).status,'ambiguous');}
 finally{await admin.query('delete from helpdesk_core.coverages where id=$1',[duplicate]);}
});
test('M1d real composite cursor follows UTF-8 C order without duplicates',async()=>{
 const codes=['AA','ZETA','ÁUDIO'],coverageIds:string[]=[];
 try{
  for(const code of codes){await admin.query('insert into helpdesk_core.services(workspace_id,product_id,code,name) values($1,$2,$3,$4)',[id(1),id(301),code,'Service '+code]);const cid=randomUUID();coverageIds.push(cid);await admin.query('insert into helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) values($1,$2,$3,$4,$5,$6,$7)',[id(1),id(101),id(301),id(401),code,id(601),cid]);}
  const seen:string[]=[];let cursor:string|undefined;
  do{const page=await service.supportContexts(alice,{limit:1,...(cursor?{cursor}:{})});seen.push(...page.items.map(c=>c.serviceCode));cursor=page.nextCursor??undefined;assert.ok(seen.length<=4);}while(cursor);
  assert.deepEqual(seen,[...codes,'SUPPORT'].sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b))));
 }finally{await admin.query('delete from helpdesk_core.coverages where id=any($1::uuid[])',[coverageIds]);await admin.query('delete from helpdesk_core.services where workspace_id=$1 and product_id=$2 and code=any($3::text[])',[id(1),id(301),codes]);}
});
test('M1d private catalog rejects partial cursor tuples and invalid page bounds',async()=>{
 for(const args of [[id(1),null,id(101),null,null,51],[id(1),null,null,null,null,0],[id(1),null,null,null,null,102],[id(1),null,null,null,null,null]])await assert.rejects(()=>sqlAs(alice,catalogSQL,args),{code:'22023'});
});
test('M1d catalog helper is private and gives no new direct catalogue table grants',async()=>{
 const signature='helpdesk_auth.support_contexts(uuid,uuid,uuid,uuid,text,integer)';
 const r=await admin.query("select p.prosecdef,p.proconfig,has_function_privilege('helpdesk_app',p.oid,'EXECUTE') as app,has_function_privilege('helpdesk_maintenance',p.oid,'EXECUTE') as maintenance from pg_proc p where p.oid=$1::regprocedure",[signature]);
 assert.equal(r.rows[0]?.prosecdef,true);assert.equal(r.rows[0]?.app,true);assert.equal(r.rows[0]?.maintenance,false);
 assert.ok((r.rows[0]?.proconfig as string[]).some(v=>v==='search_path=""'||v==='search_path='));
 const grants=await admin.query("select grantee from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid=$1::regprocedure and a.grantee=0 and a.privilege_type='EXECUTE'",[signature]);assert.equal(grants.rows.length,0);
 await assert.rejects(()=>sqlAs(alice,'select * from helpdesk_core.products'),{code:'42501'});
});
test('M1d catalog truncates Unicode labels by characters, not UTF-16 units',async()=>{
 await admin.query('update helpdesk_core.accounts set name=$1 where id=$2',['😀'.repeat(180),id(101)]);
 try{const page=await service.supportContexts(alice,{limit:50});assert.equal(page.items[0]?.accountName,'😀'.repeat(160));}
 finally{await admin.query("update helpdesk_core.accounts set name='Account 101' where id=$1",[id(101)]);}
});
test('M1d discovery does not create tickets, events or outbox side effects',async()=>{
 const counts="select (select count(*) from helpdesk_core.tickets) as tickets,(select count(*) from helpdesk_core.ticket_events) as events,(select count(*) from helpdesk_integration.outbox_events) as outbox";
 const before=(await admin.query(counts)).rows;await service.supportContexts(alice,{limit:50});assert.deepEqual((await admin.query(counts)).rows,before);
});

// v0.7: real PostgreSQL tests, NOT executed by npm test or replaced with memory fixtures.
test('SQL busca filtra antes do limite e encontra chamado antigo entre 31 criações',async()=>{
 const marker=await service.create(alice,{...input,subject:'M1F agulha remota'},'m1f-sql-old-marker','db-test');
 for(let i=0;i<30;i++)await service.create(alice,{...input,subject:'M1F recentes '+i},'m1f-sql-recent-'+String(i).padStart(3,'0'),'db-test');
 const first=await service.list(alice,{limit:25,q:'M1F'});assert.equal(first.items.length,25);assert.ok(!first.items.some(t=>t.id===marker.ticket.id));
 const match=await service.list(alice,{limit:25,q:'M1F agulha'});assert.deepEqual(match.items.map(t=>t.id),[marker.ticket.id]);
 let cursor:string|undefined;const ids:string[]=[];do{const r=await service.list(alice,{limit:7,q:'M1F recentes',...(cursor?{cursor}:{})});ids.push(...r.items.map(t=>t.id));cursor=r.nextCursor??undefined;}while(cursor);
 assert.equal(ids.length,30);assert.equal(new Set(ids).size,30);
});
test('SQL busca mantém autorização de conta/workspace mesmo conhecendo UUID',async()=>{
 const t=await service.create(alice,{...input,subject:'M1F isolamento busca'},'m1f-sql-isolation-key','db-test');
 for(const actor of [bob,outsider])assert.deepEqual(await service.list(actor,{limit:25,q:t.ticket.id}),{items:[],nextCursor:null});
 assert.equal((await service.list(alice,{limit:25,q:t.ticket.id.toUpperCase()})).items[0]?.id,t.ticket.id);
});
test('SQL busca não encontra nota interna, mensagem ou descrição',async()=>{
 const t=await service.create(alice,{...input,subject:'M1F conteúdo não indexado',description:'M1FONLYBODY-7391'},'m1f-sql-body-exclusion','db-test');
 await service.addNote(agent,t.ticket.id,'M1FONLYNOTE-7391','m1f-sql-note-exclusion','db-test');
 await service.addMessage(alice,t.ticket.id,'M1FONLYMESSAGE-7391','m1f-sql-message-exclusion','db-test');
 for(const q of ['M1FONLYBODY-7391','M1FONLYNOTE-7391','M1FONLYMESSAGE-7391'])assert.equal((await service.list(alice,{limit:25,q})).items.length,0);
});
test('SQL busca perde acesso imediatamente na próxima consulta após revogação',async()=>{
 const t=await service.create(alice,{...input,subject:'M1F revogação real'},'m1f-sql-live-revocation','db-test');
 await admin.query('update helpdesk_auth.account_grants set active=false where principal_id=$1',[alice.id]);
 try{assert.deepEqual(await service.list(alice,{limit:25,q:t.ticket.id}),{items:[],nextCursor:null});}
 finally{await admin.query('update helpdesk_auth.account_grants set active=true where principal_id=$1',[alice.id]);}
});
test('SQL filtros públicos agregam espera interna sem expor seletor privado',async()=>{
 const t=await service.create(alice,{...input,subject:'M1F estado agregado'},'m1f-sql-state-filter','db-test');
 await service.transition(agent,t.ticket.id,'open',1,'Análise','m1f-sql-open-state','db-test');
 await service.transition(agent,t.ticket.id,'waiting_internal',2,'Aguardar equipe','m1f-sql-waiting-state','db-test');
 assert.equal((await service.list(alice,{limit:25,q:'M1F estado agregado',status:'in_progress'})).items[0]?.id,t.ticket.id);
 assert.equal((await service.list(alice,{limit:25,q:'M1F estado agregado',status:'waiting_for_you'})).items.length,0);
});
test('SQL trata curingas e aspas literalmente sem ampliar escopo',async()=>{
 const t=await service.create(alice,{...input,subject:"M1F literal 100%_ ' OR TRUE --"},'m1f-sql-literal-query','db-test');
 assert.equal((await service.list(alice,{limit:25,q:"100%_ ' OR TRUE --"})).items[0]?.id,t.ticket.id);
 assert.equal((await service.list(alice,{limit:25,q:'100__'})).items.length,0);
});
test('SQL e memória concordam na busca latina sem depender da locale do banco',async()=>{
 const t=await service.create(alice,{...input,subject:'M1F RELATÓRIO ÇÃO ÄÖÜ'},'m1f-sql-latin-case','db-test');
 assert.equal((await service.list(alice,{limit:25,q:'m1f relatório ção äöü'})).items[0]?.id,t.ticket.id);
 assert.equal((await service.list(alice,{limit:25,q:'m1f relatorio cao aou'})).items.length,0);
});
test('SQL prioridade e assunto são aplicados em conjunto no escopo da integração',async()=>{
 const t=await service.create(machine,{...input,subject:'M1F máquina busca',priority:'urgent'},'m1f-sql-machine-filter','db-test');
 assert.equal((await service.list(machine,{limit:25,q:'M1F máquina',priority:'urgent',status:'received'})).items[0]?.id,t.ticket.id);
 assert.equal((await service.list(alice,{limit:25,q:'M1F máquina',priority:'urgent'})).items.length,0);
 assert.equal((await service.list(machine,{limit:25,q:'M1F máquina',priority:'normal'})).items.length,0);
});

// v0.8: candidate PostgreSQL scenarios. They are NOT counted as passed by npm test.
const priorityTicket=async(suffix:string)=>(await service.create(alice,{...input,subject:'M1G priority '+suffix},'m1g-priority-create-'+suffix,'db-test')).ticket;
test('SQL priority mutation records one versioned event and minimal outbox with immutable contract',async()=>{
 const t=await priorityTicket('atomic');const r=await service.changePriority(agent,t.id,'urgent',1,'INTERNAL PRIORITY EXPLANATION','m1g-priority-change-atomic','db-test');
 assert.equal(r.ticket.version,2);assert.equal(r.ticket.priority,'urgent');assert.deepEqual(r.ticket.contractSnapshot,t.contractSnapshot);assert.equal(r.ticket.status,t.status);
 const rows=await admin.query("select e.data,o.payload from helpdesk_core.ticket_events e join helpdesk_integration.outbox_events o on (o.workspace_id,o.id)=(e.workspace_id,e.id) where e.ticket_id=$1 and e.type='ticket.priority_changed'",[t.id]);assert.equal(rows.rows.length,1);assert.equal((rows.rows[0]!.data as {reason:string}).reason,'INTERNAL PRIORITY EXPLANATION');assert.doesNotMatch(JSON.stringify(rows.rows[0]!.payload),/INTERNAL PRIORITY EXPLANATION|reason/);
});
test('SQL requester cannot write priority even by bypassing the application',async()=>{const t=await priorityTicket('requester');await assert.rejects(()=>sqlAs(alice,"update helpdesk_core.tickets set priority='urgent',version=2 where id=$1",[t.id]),{code:'42501'});assert.equal((await service.get(alice,t.id)).priority,'normal');});
test('SQL integration cannot write its own ticket priority',async()=>{const t=(await service.create(machine,{...input,subject:'M1G machine'},'m1g-machine-priority-create','db-test')).ticket;await assert.rejects(()=>sqlAs(machine,"update helpdesk_core.tickets set priority='urgent',version=2 where id=$1",[t.id]),{code:'42501'});});
test('SQL operator mutation without event and outbox cannot commit',async()=>{const t=await priorityTicket('missing-intent');await assert.rejects(()=>sqlAs(agent,"update helpdesk_core.tickets set priority='high',version=2 where id=$1",[t.id]),{code:'23514'});assert.equal((await service.get(alice,t.id)).version,1);});
test('SQL operator event without matching outbox cannot commit',async()=>{
 const t=await priorityTicket('missing-outbox');const db=new PostgresUnitOfWork(app);await assert.rejects(()=>db.run(agent,async s=>{await s.updatePriority({...t,priority:'high',version:2},1);await s.addEvent({id:randomUUID(),workspaceId:t.workspaceId,accountId:t.accountId,ticketId:t.id,actorId:agent.id,type:'ticket.priority_changed',data:{from:'normal',to:'high',version:2,reason:'Expected rollback'},customerVisible:true,createdAt:new Date().toISOString()});}),{code:'transaction_outcome_unknown'});assert.equal((await service.get(alice,t.id)).priority,'normal');
});
test('SQL repeated priority request returns original version without another event',async()=>{const t=await priorityTicket('replay');await service.changePriority(agent,t.id,'high',1,'Internal reason','m1g-priority-repeat-key','db-test');await service.addMessage(agent,t.id,'Later response','m1g-priority-after-message','db-test');const r=await service.changePriority(agent,t.id,'high',1,'Internal reason','m1g-priority-repeat-key','db-test');assert.equal(r.replayed,true);assert.equal(r.ticket.version,2);assert.equal((await service.get(alice,t.id)).version,3);assert.equal((await admin.query("select id from helpdesk_core.ticket_events where ticket_id=$1 and type='ticket.priority_changed'",[t.id])).rows.length,1);});
test('SQL same-priority no-op records cache but not event/outbox or new version',async()=>{const t=await priorityTicket('noop');const r=await service.changePriority(agent,t.id,'normal',1,'Reviewed and kept','m1g-priority-noop-key','db-test');assert.equal(r.ticket.version,1);assert.equal((await admin.query("select id from helpdesk_core.ticket_events where ticket_id=$1 and type='ticket.priority_changed'",[t.id])).rows.length,0);assert.equal((await service.changePriority(agent,t.id,'normal',1,'Reviewed and kept','m1g-priority-noop-key','db-test')).replayed,true);});
test('SQL two concurrent priority updates cannot silently overwrite a version',async()=>{const t=await priorityTicket('concurrent');const outcomes=await Promise.allSettled([service.changePriority(agent,t.id,'high',1,'First','m1g-priority-concurrent-one','db-test'),service.changePriority(agent,t.id,'urgent',1,'Second','m1g-priority-concurrent-two','db-test')]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);const failed=outcomes.find(x=>x.status==='rejected') as PromiseRejectedResult;assert.equal(failed.reason.status,412);assert.equal((await service.get(alice,t.id)).version,2);});
test('SQL priority cache denies a former operator who can still read the account',async()=>{
 const t=await priorityTicket('downgrade');await service.changePriority(agent,t.id,'high',1,'Private justification','m1g-priority-downgrade-key','db-test');await admin.query("update helpdesk_auth.account_grants set role='account_manager' where principal_id=$1 and account_id=$2",[agent.id,id(101)]);
 try{const r=await sqlAs(agent,'select helpdesk_auth.lookup_idempotency($1,$2) as value',['priority.change:'+t.id,'m1g-priority-downgrade-key']);assert.deepEqual(r.rows[0]?.value,{denied:true});await assert.rejects(()=>service.changePriority(agent,t.id,'high',1,'Private justification','m1g-priority-downgrade-key','db-test'),{status:404});}
 finally{await admin.query("update helpdesk_auth.account_grants set role='agent' where principal_id=$1 and account_id=$2",[agent.id,id(101)]);}
});
test('SQL sibling account cannot insert a priority event into a known ticket',async()=>{const t=await priorityTicket('sibling');await assert.rejects(()=>sqlAs(bob,"insert into helpdesk_core.ticket_events(workspace_id,account_id,ticket_id,id,actor_id,type,customer_visible,data,created_at) values($1,$2,$3,$4,$5,'ticket.priority_changed',true,$6,now())",[id(1),id(101),t.id,randomUUID(),bob.id,JSON.stringify({from:'normal',to:'high',version:2,reason:'Unauthorized'})]),{code:'42501'});});
test('SQL priority event shape denies reason-less and extra-private payloads',async()=>{const t=await priorityTicket('shape');for(const data of [{from:'normal',to:'high',version:2},{from:'normal',to:'high',version:2,reason:'Valid',debug:'Extra'}])await assert.rejects(()=>sqlAs(agent,"insert into helpdesk_core.ticket_events(workspace_id,account_id,ticket_id,id,actor_id,type,customer_visible,data,created_at) values($1,$2,$3,$4,$5,'ticket.priority_changed',true,$6,now())",[id(1),id(101),t.id,randomUUID(),agent.id,JSON.stringify(data)]),{code:'23514'});});
test('SQL priority outbox forbids accidental internal reason propagation',async()=>{const t=await priorityTicket('outbox-shape'),eid=randomUUID(),payload={specversion:'1.0',id:eid,source:'helpdesk/workspaces/'+t.workspaceId,type:'com.helpdesk.ticket.priority_changed.v1',subject:'tickets/'+t.id,time:new Date().toISOString(),datacontenttype:'application/json',data:{ticket_id:t.id,version:2,reason:'DO NOT SEND'}};await assert.rejects(()=>sqlAs(agent,"insert into helpdesk_integration.outbox_events(workspace_id,account_id,ticket_id,id,type,payload,request_id,created_at) values($1,$2,$3,$4,'ticket.priority_changed',$5,'test',now())",[t.workspaceId,t.accountId,t.id,eid,JSON.stringify(payload)]),{code:'23514'});});
test('SQL terminal status blocks operator priority update independently of UI',async()=>{const t=await priorityTicket('terminal');await service.transition(agent,t.id,'cancelled',1,'Cancelled','m1g-priority-cancelled-key','db-test');await assert.rejects(()=>sqlAs(agent,"update helpdesk_core.tickets set priority='high',version=3 where id=$1",[t.id]),{code:'23514'});});
test('SQL column grant and private trigger privileges remain least privilege',async()=>{
 const r=await admin.query("select has_column_privilege('helpdesk_app','helpdesk_core.tickets','priority','UPDATE') as priority,has_table_privilege('helpdesk_app','helpdesk_core.tickets','UPDATE') as broad,has_column_privilege('helpdesk_app','helpdesk_core.tickets','contract_snapshot','UPDATE') as snapshot,has_function_privilege('helpdesk_app','helpdesk_core.require_priority_outbox()','EXECUTE') as trigger_execute");assert.deepEqual(r.rows[0],{priority:true,broad:false,snapshot:false,trigger_execute:false});
});

// v0.9 responsibility: candidate real-database tests, excluded from local npm test counts.
const assignmentAgent=p(91,101,'agent');
const assignmentAdmin:Principal={...p(92,101,'agent'),workspaceRole:'admin',grants:[]};
before(async()=>{
 for(const who of [91,92])await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[id(who),id(1000+who)]);
 await admin.query("insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,'agent')",[id(1),id(101),assignmentAgent.id]);
 await admin.query("insert into helpdesk_auth.workspace_memberships(workspace_id,principal_id,role) values($1,$2,'admin')",[id(1),assignmentAdmin.id]);
 for(const who of [assignmentAgent,assignmentAdmin])await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,0,$4,$5)',[who.workspaceId,who.id,who.scopes,'Synthetic assignment provisioning',randomUUID()]);
});
const assignmentTicket=async(suffix:string)=>(await service.create(alice,{...input,subject:'M1H responsibility '+suffix},'m1h-create-'+suffix+'-key','db-test')).ticket;
const claim=async(t:{id:string;version:number},actor=agent,key='m1h-claim-key-0001')=>service.changeAssignment(actor,t.id,'claim',t.version,'Assumir a análise',key,'db-test');
test('SQL claim persists assignee, private event and no outbound event',async()=>{const t=await assignmentTicket('atomic'),r=await claim(t);assert.equal(r.ticket.assignedTo,agent.id);assert.equal(r.ticket.version,2);assert.deepEqual(r.ticket.contractSnapshot,t.contractSnapshot);const es=await admin.query("select customer_visible,data from helpdesk_core.ticket_events where ticket_id=$1 and type='ticket.assignment_changed'",[t.id]);assert.equal(es.rows.length,1);assert.equal(es.rows[0]?.customer_visible,false);assert.equal((await admin.query("select id from helpdesk_integration.outbox_events where ticket_id=$1 and type='ticket.assignment_changed'",[t.id])).rows.length,0);});
test('SQL assigned ownership is invisible in requester timeline',async()=>{const t=await assignmentTicket('private');await claim(t);assert.equal((await service.timeline(alice,t.id)).some(e=>e.type==='ticket.assignment_changed'),false);assert.equal((await sqlAs(alice,"select id from helpdesk_core.ticket_events where ticket_id=$1 and type='ticket.assignment_changed'",[t.id])).rows.length,0);});
test('SQL release by owner removes assignment with a second event',async()=>{const t=await assignmentTicket('release');await claim(t);const r=await service.changeAssignment(agent,t.id,'release',2,'Retornar à triagem','m1h-release-own-0001','db-test');assert.equal(r.ticket.assignedTo,null);assert.equal(r.ticket.version,3);});
test('SQL occupied claim and release by another agent are denied',async()=>{const t=await assignmentTicket('occupied');await claim(t);await assert.rejects(()=>claim({...t,version:2},assignmentAgent),{code:'assignment_conflict'});await assert.rejects(()=>service.changeAssignment(assignmentAgent,t.id,'release',2,'Outro agente','m1h-release-other-0001','db-test'),{code:'assignment_release_forbidden'});});
test('SQL administrator may release but not steal occupied ticket',async()=>{const t=await assignmentTicket('admin');await claim(t);await assert.rejects(()=>claim({...t,version:2},assignmentAdmin),{code:'assignment_conflict'});const r=await service.changeAssignment(assignmentAdmin,t.id,'release',2,'Redistribuir atendimento','m1h-admin-release-0001','db-test');assert.equal(r.ticket.assignedTo,null);});
test('SQL requester cannot bypass API to claim',async()=>{const t=await assignmentTicket('requester');await assert.rejects(()=>sqlAs(alice,'update helpdesk_core.tickets set assigned_to=$1,version=2 where id=$2',[alice.id,t.id]),{code:'42501'});});
test('SQL M2M cannot bypass API to assign even its own ticket',async()=>{const t=(await service.create(machine,{...input,subject:'M1H machine'},'m1h-machine-create-0001','db-test')).ticket;await assert.rejects(()=>sqlAs(machine,'update helpdesk_core.tickets set assigned_to=$1,version=2 where id=$2',[machine.id,t.id]),{code:'42501'});});
test('SQL cross-account principal assignment target is refused',async()=>{const t=await assignmentTicket('target');await assert.rejects(()=>sqlAs(agent,'update helpdesk_core.tickets set assigned_to=$1,version=2 where id=$2',[bob.id,t.id]),{code:'42501'});});
test('SQL assignment cannot commit without its private event',async()=>{const t=await assignmentTicket('missing-event');await assert.rejects(()=>sqlAs(agent,'update helpdesk_core.tickets set assigned_to=$1,version=2 where id=$2',[agent.id,t.id]),{code:'23514'});assert.equal((await service.get(agent,t.id)).assignedTo,null);});
test('SQL two agents racing a version yield one successful assignment',async()=>{const t=await assignmentTicket('race'),r=await Promise.allSettled([claim(t),claim(t,assignmentAgent)]);assert.equal(r.filter(x=>x.status==='fulfilled').length,1);const failed=r.find(x=>x.status==='rejected') as PromiseRejectedResult;assert.equal(failed.reason.status,412);assert.equal((await service.get(agent,t.id)).version,2);});
test('SQL identical concurrent claim returns a replay without another event',async()=>{const t=await assignmentTicket('idem-race'),r=await Promise.all([claim(t),claim(t)]);assert.equal(r.filter(x=>x.replayed).length,1);assert.equal((await admin.query("select id from helpdesk_core.ticket_events where ticket_id=$1 and type='ticket.assignment_changed'",[t.id])).rows.length,1);});
test('SQL replay remains the old assignment snapshot after release',async()=>{const t=await assignmentTicket('replay');await claim(t);await service.changeAssignment(agent,t.id,'release',2,'Liberar','m1h-replay-release-001','db-test');const r=await claim(t);assert.equal(r.replayed,true);assert.equal(r.ticket.assignedTo,agent.id);assert.equal(r.ticket.version,2);assert.equal((await service.get(agent,t.id)).assignedTo,null);});
test('SQL no-op keeps version and writes no assignment event',async()=>{const t=await assignmentTicket('noop');const r=await service.changeAssignment(agent,t.id,'release',1,'Manter desocupado','m1h-noop-key-0001','db-test');assert.equal(r.ticket.version,1);assert.equal((await admin.query("select id from helpdesk_core.ticket_events where ticket_id=$1 and type='ticket.assignment_changed'",[t.id])).rows.length,0);});
test('SQL assignee whose grant is revoked cannot read or use assignment cache',async()=>{const t=await assignmentTicket('revoke');await claim(t,assignmentAgent);await admin.query('update helpdesk_auth.account_grants set active=false where principal_id=$1',[assignmentAgent.id]);try{assert.equal((await sqlAs(assignmentAgent,'select id from helpdesk_core.tickets where id=$1',[t.id])).rows.length,0);const cached=await sqlAs(assignmentAgent,'select helpdesk_auth.lookup_idempotency($1,$2) as value',['assignments.change:'+t.id,'m1h-claim-key-0001']);assert.deepEqual(cached.rows[0]?.value,{denied:true});await assert.rejects(()=>service.get(assignmentAgent,t.id),{status:404});const r=await service.changeAssignment(assignmentAdmin,t.id,'release',2,'Responsável perdeu acesso','m1h-admin-orphan-0001','db-test');assert.equal(r.ticket.assignedTo,null);}finally{await admin.query('update helpdesk_auth.account_grants set active=true where principal_id=$1',[assignmentAgent.id]);}});
test('SQL terminal and combined status-assignment updates are refused',async()=>{const t=await assignmentTicket('terminal');await assert.rejects(()=>sqlAs(agent,"update helpdesk_core.tickets set assigned_to=$1,status='open',version=2 where id=$2",[agent.id,t.id]),{code:'23514'});await service.transition(agent,t.id,'cancelled',1,'Encerrar','m1h-terminal-close-001','db-test');await assert.rejects(()=>sqlAs(agent,'update helpdesk_core.tickets set assigned_to=$1,version=3 where id=$2',[agent.id,t.id]),{code:'23514'});});
test('SQL internal assignment cannot enter outbox',async()=>{const t=await assignmentTicket('outbox');await assert.rejects(()=>sqlAs(agent,"insert into helpdesk_integration.outbox_events(workspace_id,account_id,ticket_id,id,type,payload,request_id,created_at) values($1,$2,$3,$4,'ticket.assignment_changed','{}','test',now())",[t.workspaceId,t.accountId,t.id,randomUUID()]),{code:'23514'});});
test('SQL assignment event requires exact shape and private visibility',async()=>{const t=await assignmentTicket('shape');for(const [visible,data] of [[true,{action:'claim',from:null,to:agent.id,reason:'Motivo',version:2}],[false,{action:'claim',from:null,to:agent.id,version:2}],[false,{action:'claim',from:null,to:agent.id,reason:'Motivo',version:2,debug:'private'}]] as const)await assert.rejects(()=>sqlAs(agent,'insert into helpdesk_core.ticket_events(workspace_id,account_id,ticket_id,id,actor_id,type,customer_visible,data,created_at) values($1,$2,$3,$4,$5,\'ticket.assignment_changed\',$6,$7,now())',[t.workspaceId,t.accountId,t.id,randomUUID(),agent.id,visible,JSON.stringify(data)]),{code:'23514'});});
test('SQL assignment grants remain narrow and trigger functions inaccessible',async()=>{const r=await admin.query("select has_column_privilege('helpdesk_app','helpdesk_core.tickets','assigned_to','UPDATE') as assignment,has_table_privilege('helpdesk_app','helpdesk_core.tickets','UPDATE') as broad,has_function_privilege('helpdesk_app','helpdesk_core.guard_ticket_assignment()','EXECUTE') as guard,has_function_privilege('helpdesk_app','helpdesk_core.require_assignment_event()','EXECUTE') as trigger");assert.deepEqual(r.rows[0],{assignment:true,broad:false,guard:false,trigger:false});});

// Metadata drift tests require actual PostgreSQL, run serially and restore each intentional change.
// They are NOT counted as locally approved when the database prerequisite is absent.
async function rejectsDrift(change:string,restore:string){
 await assertDatabaseSecurity(app);
 try{await admin.query(change);await assert.rejects(()=>assertDatabaseSecurity(app),{code:'unsafe_database_policies'});}
 finally{await admin.query(restore);}
 await assertDatabaseSecurity(app);
}
test('startup refuses extra table-level credential access',()=>rejectsDrift(
 'grant select on helpdesk_auth.integration_credentials to helpdesk_app',
 'revoke select on helpdesk_auth.integration_credentials from helpdesk_app'));
test('startup refuses extra credential-column access without a table grant',()=>rejectsDrift(
 'grant select(key_hash) on helpdesk_auth.integration_credentials to helpdesk_app',
 'revoke select(key_hash) on helpdesk_auth.integration_credentials from helpdesk_app'));
test('startup refuses extra update permission on ticket identity',()=>rejectsDrift(
 'grant update(account_id) on helpdesk_core.tickets to helpdesk_app',
 'revoke update(account_id) on helpdesk_core.tickets from helpdesk_app'));
test('startup refuses grant option while ordinary SELECT remains required',()=>rejectsDrift(
 'grant select on helpdesk_core.tickets to helpdesk_app with grant option',
 'revoke grant option for select on helpdesk_core.tickets from helpdesk_app'));
test('startup refuses disabled deferred creation invariant',()=>rejectsDrift(
 'alter table helpdesk_core.tickets disable trigger ticket_initial_outbox',
 'alter table helpdesk_core.tickets enable trigger ticket_initial_outbox'));
test('startup refuses disabled deferred assignment invariant',()=>rejectsDrift(
 'alter table helpdesk_core.tickets disable trigger ticket_assignment_event',
 'alter table helpdesk_core.tickets enable trigger ticket_assignment_event'));
test('startup refuses an additional permissive policy',()=>rejectsDrift(
 'create policy m1i_unexpected_policy on helpdesk_core.tickets for select to helpdesk_app using(true)',
 'drop policy m1i_unexpected_policy on helpdesk_core.tickets'));
test('startup refuses exposing the maintenance function to the HTTP role',()=>rejectsDrift(
 'grant execute on function helpdesk_auth.maintain_ephemeral(boolean,integer) to helpdesk_app',
 'revoke execute on function helpdesk_auth.maintain_ephemeral(boolean,integer) from helpdesk_app'));
test('startup refuses a private helper search_path change',()=>rejectsDrift(
 'alter function helpdesk_auth.resolve_human(uuid,uuid) set search_path=public',
 "alter function helpdesk_auth.resolve_human(uuid,uuid) set search_path=''"));
test('startup refuses missing required public-conversation SELECT',()=>rejectsDrift(
 'revoke select on helpdesk_core.ticket_messages from helpdesk_app',
 'grant select on helpdesk_core.ticket_messages to helpdesk_app'));
test('startup refuses app CREATE inside a private schema',()=>rejectsDrift(
 'grant create on schema helpdesk_auth to helpdesk_app',
 'revoke create on schema helpdesk_auth from helpdesk_app'));

// v0.11 review: these exercise the real SQL adapter when this suite is run on PostgreSQL.
async function reviewOwnedTicket(){
 const r=await service.create(alice,{...input,subject:'Review assignment '+randomUUID()},randomUUID(),'db-review');
 await service.changeAssignment(agent,r.ticket.id,'claim',r.ticket.version,'Review ownership',randomUUID(),'db-review');
 return r.ticket.id;
}
test('SQL mine filter returns the assigned ticket before pagination',async()=>{
 const mine=await reviewOwnedTicket();const r=await service.list(agent,{limit:1,assignment:'mine',q:mine});
 assert.deepEqual(r.items.map(t=>t.id),[mine]);assert.equal(r.nextCursor,null);
});
test('SQL unassigned filter omits an assigned ticket visible without the filter',async()=>{
 const mine=await reviewOwnedTicket();assert.equal((await service.list(agent,{limit:25,q:mine})).items.length,1);
 assert.equal((await service.list(agent,{limit:25,q:mine,assignment:'unassigned'})).items.length,0);
});
test('SQL release returns the ticket to the unassigned view',async()=>{
 const mine=await reviewOwnedTicket(),t=await service.get(agent,mine);
 await service.changeAssignment(agent,mine,'release',t.version,'Return to pool',randomUUID(),'db-review');
 assert.deepEqual((await service.list(agent,{limit:25,q:mine,assignment:'unassigned'})).items.map(t=>t.id),[mine]);
 assert.equal((await service.list(agent,{limit:25,q:mine,assignment:'mine'})).items.length,0);
});
test('SQL assignment filter observes a live operator downgrade',async()=>{
 const mine=await reviewOwnedTicket();
 await admin.query("update helpdesk_auth.account_grants set role='requester' where principal_id=$1 and account_id=$2",[agent.id,input.accountId]);
 try{assert.equal((await service.list(agent,{limit:25,q:mine,assignment:'mine'})).items.length,0);}
 finally{await admin.query("update helpdesk_auth.account_grants set role='agent' where principal_id=$1 and account_id=$2",[agent.id,input.accountId]);}
});
test('SQL requester cannot use operator assignment selection',async()=>{
 const mine=await reviewOwnedTicket();await assert.rejects(()=>service.list(alice,{limit:25,q:mine,assignment:'mine'}),{status:403});
 const r=await sqlAs(alice,'select id from helpdesk_core.tickets where id=$1 and helpdesk_auth.is_operator(workspace_id,account_id)',[mine]);assert.equal(r.rows.length,0);
});
test('SQL a different workspace sees no result for a known assigned ticket',async()=>{
 const mine=await reviewOwnedTicket();const otherOperator={...outsider,grants:[{accountId:id(201),role:'agent' as const}]};
 assert.equal((await service.list(otherOperator,{limit:25,q:mine,assignment:'mine'})).items.length,0);
});

// v0.15: executable only on a real disposable PostgreSQL17, not counted by npm test.
import {SCOPES} from '../../src/domain/scopes.ts';
import {ticketActions} from '../../src/application/ticket-actions.ts';
async function scopeSubject(capabilities:readonly string[]|null,workspace=1,account=101){
 const person=randomUUID(),authId=randomUUID();
 await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[person,authId]);
 await admin.query("insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,'agent')",[id(workspace),id(account),person]);
 const set=(list:unknown,expected:number,reason='Synthetic scope change',request=randomUUID())=>admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3::text[],$4,$5,$6) as revision',[id(workspace),person,list,expected,reason,request]);
 if(capabilities!==null)await set([...capabilities],0);
 const authentication=createAuthentication(withControlTransactions(app),{supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_test'},async()=>Response.json({id:authId}));
 const current=()=>authentication.authenticate(new Request('https://hd.test/v1/me',{headers:{authorization:'Bearer synthetic-human','x-workspace-id':id(workspace)}}));
 const history=()=>admin.query('select revision,scopes,reason,request_id,changed_by::text,created_at from helpdesk_auth.human_scope_versions where workspace_id=$1 and principal_id=$2 order by revision',[id(workspace),person]);
 return {person,authId,set,current,history};
}
test('v015 membership without a capability revision has no implicit scope',async()=>{
 const f=await scopeSubject(null),who=await f.current();assert.deepEqual(who.scopes,[]);assert.equal(who.id,f.person);assert.notEqual(who.id,f.authId);
 assert.equal((await f.history()).rows.length,0);await assert.rejects(()=>service.get(who,ticketId),{status:403});
 assert.equal((await sqlAs(who,'select id from helpdesk_core.tickets where id=$1',[ticketId])).rows.length,0);
});
test('v015 explicit read-only operator can read but not mutate or create',async()=>{
 const f=await scopeSubject(['contexts:resolve','tickets:read']),who=await f.current(),t=await service.get(who,ticketId);
 assert.equal((await service.resolve(who,input)).status,'resolved');const actions=ticketActions(who,t);
 assert.equal(actions.reply,false);assert.equal(actions.add_note,false);assert.equal(actions.change_priority,false);assert.deepEqual(actions.transitions,[]);
 await assert.rejects(()=>service.create(who,input,randomUUID(),'v015'),{status:403});
 await assert.rejects(()=>sqlAs(who,"update helpdesk_core.tickets set priority='high',version=version+1,updated_at=now() where id=$1",[ticketId]),{code:'42501'});
});
test('v015 stale application scopes cannot bypass the current DB capability ceiling',async()=>{
 const f=await scopeSubject(SCOPES),stale=await f.current();await f.set(['tickets:read'],1);
 await assert.rejects(()=>service.addMessage(stale,ticketId,'Should not persist',randomUUID(),'v015'),{code:'42501'});
 assert.deepEqual((await f.current()).scopes,['tickets:read']);
});
test('v015 write-only notes yield an author receipt and replay without collection read',async()=>{
 const f=await scopeSubject(['tickets:read','notes:write']),who=await f.current(),key=randomUUID();
 const first=await service.addNote(who,ticketId,'Private synthetic receipt',key,'v015');
 const replay=await service.addNote(who,ticketId,'Private synthetic receipt',key,'v015');assert.equal(replay.replayed,true);assert.deepEqual(replay.note,first.note);
 await assert.rejects(()=>service.notes(who,ticketId),{status:403});
 assert.equal((await sqlAs(who,'select id from helpdesk_core.internal_notes where ticket_id=$1',[ticketId])).rows.length,0);
 const saved=await sqlAs(who,'select helpdesk_auth.lookup_idempotency($1,$2) as result',['notes.create:'+ticketId,key]);
 assert.equal((saved.rows[0]?.result as {result:{id:string}}).result.id,first.note.id);
});
test('v015 a note receipt is not shared with another write-only operator',async()=>{
 const a=await scopeSubject(['tickets:read','notes:write']),b=await scopeSubject(['tickets:read','notes:write']),key=randomUUID();
 await service.addNote(await a.current(),ticketId,'Only the original author receipt',key,'v015');
 const result=await sqlAs(await b.current(),'select helpdesk_auth.lookup_idempotency($1,$2) as result',['notes.create:'+ticketId,key]);assert.equal(result.rows[0]?.result,null);
});
test('v015 revoking note write denies receipt even when collection read remains',async()=>{
 const f=await scopeSubject(SCOPES),who=await f.current(),key=randomUUID();await service.addNote(who,ticketId,'Receipt before revocation',key,'v015');
 await f.set(['tickets:read','notes:read'],1);const result=await sqlAs(who,'select helpdesk_auth.lookup_idempotency($1,$2) as result',['notes.create:'+ticketId,key]);
 assert.deepEqual(result.rows[0]?.result,{denied:true});await assert.rejects(async()=>service.addNote(await f.current(),ticketId,'Receipt before revocation',key,'v015'),{status:403});
});
test('v015 revoking note collection read preserves write receipt for author',async()=>{
 const f=await scopeSubject(SCOPES),who=await f.current(),key=randomUUID();const first=await service.addNote(who,ticketId,'Receipt survives read removal',key,'v015');
 await f.set(['tickets:read','notes:write'],1);const again=await service.addNote(await f.current(),ticketId,'Receipt survives read removal',key,'v015');assert.deepEqual(again.note,first.note);
});
test('v015 empty scope revision denies previous ticket access without changing the ticket',async()=>{
 const f=await scopeSubject(SCOPES),who=await f.current(),prior=await service.get(who,ticketId);await f.set([],1);
 await assert.rejects(()=>service.get(who,ticketId),{status:404});assert.deepEqual((await f.current()).scopes,[]);assert.equal((await service.get(agent,ticketId)).version,prior.version);
});
test('v015 workspace administrator still requires explicitly granted capabilities',async()=>{
 const f=await scopeSubject(['tickets:read']);await admin.query("insert into helpdesk_auth.workspace_memberships(workspace_id,principal_id,role) values($1,$2,'admin')",[id(1),f.person]);
 const who=await f.current();assert.equal(who.workspaceRole,'admin');assert.deepEqual(who.scopes,['tickets:read']);assert.equal(ticketActions(who,await service.get(who,ticketId)).change_priority,false);
});
test('v015 HTTP login cannot read, append or update the scope history',async()=>{
 const f=await scopeSubject(SCOPES);
 for(const q of ['select * from helpdesk_auth.human_scope_versions','delete from helpdesk_auth.human_scope_versions','update helpdesk_auth.human_scope_versions set scopes=array[]::text[]'])await assert.rejects(()=>app.query(q),{code:'42501'});
 await assert.rejects(()=>app.query('select helpdesk_auth.set_human_scopes($1,$2,$3::text[],1,$4,$5)',[id(1),f.person,[], 'Unauthorized scope update',randomUUID()]),{code:'42501'});
 assert.equal((await f.history()).rows.length,1);
});
test('v015 scope getter and guard are not callable by HTTP or maintenance roles',async()=>{
 for(const signature of ['helpdesk_auth.human_scopes(uuid,uuid)','helpdesk_auth.guard_human_scope_version()','helpdesk_auth.set_human_scopes(uuid,uuid,text[],integer,text,uuid)']){
  const r=await admin.query("select has_function_privilege('helpdesk_app',$1,'EXECUTE') as app,has_function_privilege('helpdesk_maintenance',$1,'EXECUTE') as maintenance",[signature]);assert.deepEqual(r.rows[0],{app:false,maintenance:false});
 }
});
test('v015 stale expected revision fails without altering existing audit history',async()=>{
 const f=await scopeSubject(SCOPES),before=await f.history();await assert.rejects(()=>f.set(['tickets:read'],0),{code:'40001'});assert.deepEqual((await f.history()).rows,before.rows);
});
test('v015 concurrent provisioning of the same revision has exactly one winner',async()=>{
 const f=await scopeSubject(SCOPES),r=await Promise.allSettled([f.set(['tickets:read'],1),f.set([],1)]);
 assert.equal(r.filter(x=>x.status==='fulfilled').length,1);const rejected=r.find(x=>x.status==='rejected') as PromiseRejectedResult;assert.equal(rejected.reason.code,'40001');
 assert.deepEqual((await f.history()).rows.map(x=>x.revision),[1,2]);
});
test('v015 history stores the real SQL session identity, reason and correlation',async()=>{
 const f=await scopeSubject(null),request=randomUUID();await f.set(['notes:write','tickets:read'],0,'Reviewed synthetic note-only ceiling',request);
 const row=(await f.history()).rows[0]!,login=(await admin.query('select session_user::text as name')).rows[0]?.name;
 assert.deepEqual(row.scopes,['tickets:read','notes:write']);assert.equal(row.request_id,request);assert.equal(row.changed_by,login);assert.equal(row.reason,'Reviewed synthetic note-only ceiling');assert.ok(row.created_at);
});
test('v015 existing capability revisions are append-only even for ordinary owner DML',async()=>{
 const f=await scopeSubject(SCOPES),before=await f.history();
 await assert.rejects(()=>admin.query('update helpdesk_auth.human_scope_versions set reason=$1 where principal_id=$2',['Rewritten history',f.person]),{code:'23514'});
 await assert.rejects(()=>admin.query('delete from helpdesk_auth.human_scope_versions where principal_id=$1',[f.person]),{code:'23514'});assert.deepEqual((await f.history()).rows,before.rows);
});
test('v015 malformed capabilities never produce an audit revision',async()=>{
 const f=await scopeSubject(null);for(const list of [null,['unknown'],['tickets:read','tickets:read'],[null],['tickets:read',null]])await assert.rejects(()=>f.set(list,0),{code:'22023'});assert.equal((await f.history()).rows.length,0);
});
test('v015 capability revisions do not grant access to another workspace',async()=>{
 const f=await scopeSubject(SCOPES),who=await f.current();
 assert.equal((await sqlAs(who,'select helpdesk_auth.has_scope($1,$2) as allowed',[id(2),'tickets:read'])).rows[0]?.allowed,false);
 await assert.rejects(()=>admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,0,$4,$5)',[id(2),f.person,[...SCOPES],'Invalid workspace mapping',randomUUID()]),{code:'42501'});
});
test('v015 suspended membership can be revoked without restoring access',async()=>{
 const f=await scopeSubject(SCOPES),who=await f.current();await admin.query('update helpdesk_auth.account_grants set active=false where principal_id=$1',[f.person]);await f.set([],1);
 await assert.rejects(()=>f.current(),{code:'membership_required'});assert.equal((await sqlAs(who,'select id from helpdesk_core.tickets where id=$1',[ticketId])).rows.length,0);
});
test('v015 an integration principal cannot receive a human scope revision',async()=>{
 await assert.rejects(()=>admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,0,$4,$5)',[machine.workspaceId,machine.id,['tickets:read'],'Invalid principal type',randomUUID()]),{code:'42501'});
});

// v0.16 / R14-06: actual PostgreSQL ONLY. These are written scenarios, not npm-test approvals.
import type {Store} from '../../src/application/ports.ts';
import type {Ticket} from '../../src/domain/model.ts';
const effectTicket=async(label:string)=>(await service.create(alice,{...input,subject:'Effects '+label},randomUUID(),'db-test')).ticket;
const corruptEffects=(alter:(s:Store)=>Store)=>new HelpdeskService({run:(p,f)=>new PostgresUnitOfWork(app).run(p,s=>f(alter(s)))});
async function captureEffectRows(tid:string){
 const result:Record<string,unknown[]>={};
 for(const [table,where] of [
  ['helpdesk_core.tickets','id'],['helpdesk_core.ticket_messages','ticket_id'],['helpdesk_core.internal_notes','ticket_id'],
  ['helpdesk_core.ticket_events','ticket_id'],['helpdesk_integration.outbox_events','ticket_id'],['helpdesk_audit.write_effects','ticket_id']])
  result[table!]=(await admin.query(`select to_jsonb(r) as value from ${table} r where ${where}=$1 order by to_jsonb(r)::text`,[tid])).rows;
 return result;
}
const effectCommands={
 message:(s:HelpdeskService,t:Ticket,key:string)=>s.addMessage(agent,t.id,'Synthetic public reply',key,'db-test'),
 note:(s:HelpdeskService,t:Ticket,key:string)=>s.addNote(agent,t.id,'Synthetic internal note',key,'db-test'),
 status:(s:HelpdeskService,t:Ticket,key:string)=>s.transition(agent,t.id,'open',t.version,'',key,'db-test'),
 priority:(s:HelpdeskService,t:Ticket,key:string)=>s.changePriority(agent,t.id,'high',t.version,'Synthetic priority',key,'db-test'),
 assignment:(s:HelpdeskService,t:Ticket,key:string)=>s.changeAssignment(agent,t.id,'claim',t.version,'Synthetic assignment',key,'db-test'),
};
for(const [kind,command] of Object.entries(effectCommands))test(`SQL016 omitted ${kind} event rejects and preserves all prior rows`,async()=>{
 const t=await effectTicket('missing-event-'+kind),before=await captureEffectRows(t.id),key=randomUUID();
 const broken=corruptEffects(s=>({...s,addEvent:async()=>{}}));await assert.rejects(()=>command(broken,t,key));
 assert.deepEqual(await captureEffectRows(t.id),before);
 assert.equal((await admin.query('select key from helpdesk_integration.api_idempotency_keys where key=$1',[key])).rows.length,0);
});
for(const kind of ['message','status','priority'] as const)test(`SQL016 omitted ${kind} outbox rejects even with a correct event`,async()=>{
 const t=await effectTicket('missing-outbox-'+kind),before=await captureEffectRows(t.id);
 await assert.rejects(()=>effectCommands[kind](corruptEffects(s=>({...s,enqueue:async()=>{}})),t,randomUUID()));
 assert.deepEqual(await captureEffectRows(t.id),before);
});
test('SQL016 creation cannot commit if the application silently omits its event',async()=>{
 const key=randomUUID(),count=(await admin.query('select count(*)::integer as n from helpdesk_core.tickets')).rows[0]?.n;
 await assert.rejects(()=>corruptEffects(s=>({...s,addEvent:async()=>{}})).create(alice,input,key,'db-test'));
 assert.equal((await admin.query('select count(*)::integer as n from helpdesk_core.tickets')).rows[0]?.n,count);
 assert.equal((await admin.query('select key from helpdesk_integration.api_idempotency_keys where key=$1',[key])).rows.length,0);
});
test('SQL016 direct status change fails at COMMIT without a corresponding new event/outbox',async()=>{
 const t=await effectTicket('raw-status');await assert.rejects(()=>sqlAs(agent,"update helpdesk_core.tickets set status='open',version=version+1,updated_at=now() where id=$1",[t.id]),{code:'23514'});
 assert.equal((await service.get(agent,t.id)).status,'new');
});
test('SQL016 direct note insert fails at COMMIT without its private functional event',async()=>{
 const t=await effectTicket('raw-note'),nid=randomUUID();
 await assert.rejects(()=>sqlAs(agent,'insert into helpdesk_core.internal_notes(workspace_id,account_id,ticket_id,id,actor_id,body,created_at) values($1,$2,$3,$4,$5,$6,now())',[t.workspaceId,t.accountId,t.id,nid,agent.id,'No event']),{code:'23514'});
 assert.equal((await admin.query('select id from helpdesk_core.internal_notes where id=$1',[nid])).rows.length,0);
});
test('SQL016 message with no parent-version advance cannot commit',async()=>{
 const t=await effectTicket('missing-version'),before=await captureEffectRows(t.id);
 await assert.rejects(()=>effectCommands.message(corruptEffects(s=>({...s,updateTicket:async()=>{}})),t,randomUUID()));
 assert.deepEqual(await captureEffectRows(t.id),before);
});
test('SQL016 an empty version bump cannot commit without a newly inserted public message',async()=>{
 const t=await effectTicket('empty-bump');await assert.rejects(()=>sqlAs(agent,'update helpdesk_core.tickets set version=version+1 where id=$1',[t.id]),{code:'23514'});
 assert.equal((await service.get(agent,t.id)).version,1);
});
test('SQL016 an event from an earlier committed write cannot stand in for a new message event',async()=>{
 const t=await effectTicket('old-message');await service.addMessage(agent,t.id,'Previous',randomUUID(),'db-test');const before=await captureEffectRows(t.id);
 await assert.rejects(()=>effectCommands.message(corruptEffects(s=>({...s,addEvent:async()=>{}})),t,randomUUID()));
 assert.deepEqual(await captureEffectRows(t.id),before);
});
for(const field of ['actor','data','duplicate'] as const)test(`SQL016 event ${field} corruption rolls back the new public message`,async()=>{
 const t=await effectTicket('event-'+field),before=await captureEffectRows(t.id);
 const broken=corruptEffects(s=>({...s,addEvent:async e=>{
  if(field==='duplicate')await s.addEvent(e);
  await s.addEvent({...e,...(field==='actor'?{actorId:alice.id}:{}),...(field==='data'?{data:{...e.data,secret:'Must not be sent'}}:{})});
 }}));await assert.rejects(()=>effectCommands.message(broken,t,randomUUID()));assert.deepEqual(await captureEffectRows(t.id),before);
});
for(const field of ['version','extra','duplicate','time'] as const)test(`SQL016 outbox ${field} corruption is not a valid counterpart`,async()=>{
 const t=await effectTicket('outbox-'+field),before=await captureEffectRows(t.id);
 const broken=corruptEffects(s=>({...s,enqueue:async e=>{
  if(field==='duplicate')await s.enqueue(e);
  await s.enqueue({...e,payload:{...e.payload,...(field==='version'?{data:{ticket_id:t.id,version:999}}:{}),...(field==='extra'?{reason:'PRIVATE'}:{}),...(field==='time'?{time:'2020-01-01T00:00:00Z'}:{})}});
 }}));await assert.rejects(()=>effectCommands.message(broken,t,randomUUID()));assert.deepEqual(await captureEffectRows(t.id),before);
});
test('SQL016 private note cannot generate an external outbox record',async()=>{
 const t=await effectTicket('private-external'),before=await captureEffectRows(t.id);
 const broken=corruptEffects(s=>({...s,addEvent:async e=>{await s.addEvent(e);await s.enqueue({id:e.id,workspaceId:e.workspaceId,accountId:e.accountId,ticketId:e.ticketId,type:e.type,payload:{},createdAt:e.createdAt,requestId:'db-test'});}}));
 await assert.rejects(()=>effectCommands.note(broken,t,randomUUID()));assert.deepEqual(await captureEffectRows(t.id),before);
});
test('SQL016 app cannot read or modify private effect receipts',async()=>{
 for(const statement of ['select * from helpdesk_audit.write_effects','update helpdesk_audit.write_effects set applied=true','delete from helpdesk_audit.write_effects'])await assert.rejects(()=>app.query(statement),{code:'42501'});
});
test('SQL016 client and maintenance roles cannot invoke receipt functions',async()=>{
 const r=await admin.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join pg_roles r where n.nspname='helpdesk_audit' and p.proname in ('record_ticket_effect','record_conversation_effect','bind_effect_event','bind_effect_outbox','require_write_effect') and r.rolname in ('helpdesk_app','anon','authenticated','service_role','helpdesk_maintenance') and has_function_privilege(r.oid,p.oid,'EXECUTE')");assert.equal(r.rows.length,0);
});
test('SQL016 a committed message has one complete receipt joined to one matching event/outbox',async()=>{
 const t=await effectTicket('complete');await effectCommands.message(service,t,randomUUID());
 const r=await admin.query("select r.applied,r.expected_data,e.type as event_type,o.type as outbox_type from helpdesk_audit.write_effects r join helpdesk_core.ticket_events e on(e.workspace_id,e.id)=(r.workspace_id,r.event_id) join helpdesk_integration.outbox_events o on(o.workspace_id,o.id)=(r.workspace_id,r.event_id) where r.ticket_id=$1 and r.kind='message.created'",[t.id]);
 assert.equal(r.rows.length,1);assert.equal(r.rows[0]?.applied,true);assert.equal(r.rows[0]?.event_type,'message.created');assert.equal(r.rows[0]?.outbox_type,'message.created');assert.doesNotMatch(JSON.stringify(r.rows),/Synthetic public reply|body|reason/);
});
test('SQL016 no-op and idempotent replay add no receipt',async()=>{
 const t=await effectTicket('no-op'),key=randomUUID(),before=await captureEffectRows(t.id);
 await service.changePriority(agent,t.id,'normal',1,'No change',key,'db-test');
 const replay=await service.changePriority(agent,t.id,'normal',1,'No change',key,'db-test');assert.equal(replay.replayed,true);
 assert.deepEqual(await captureEffectRows(t.id),before);
});
test('SQL016 multiple application commands in one transaction bind distinct receipts and versions',async()=>{
 const t=await effectTicket('multiple');await new PostgresUnitOfWork(app).run(agent,async store=>{
  const s=new HelpdeskService({run:async(_p,f)=>f(store)});
  await s.addMessage(agent,t.id,'Batch message',randomUUID(),'db-test');
  await s.transition(agent,t.id,'open',2,'',randomUUID(),'db-test');
  await s.addNote(agent,t.id,'Batch note',randomUUID(),'db-test');
 });
 assert.equal((await service.get(agent,t.id)).version,3);
 const rows=(await admin.query('select kind,ticket_version,applied from helpdesk_audit.write_effects where ticket_id=$1 order by created_at,id',[t.id])).rows;
 assert.equal(rows.length,4);assert.ok(rows.every(r=>r.applied===true));
});
test('SQL016 savepoint rollback removes its pending receipt before a valid note is committed',async()=>{
 const t=await effectTicket('savepoint'),c=await app.connect(),nid=randomUUID(),eid=randomUUID();
 try{
  await c.query('BEGIN');await c.query("select set_config('app.workspace_id',$1,true),set_config('app.principal_id',$2,true)",[agent.workspaceId,agent.id]);await c.query('SAVEPOINT ignored_write');
  const insert='insert into helpdesk_core.internal_notes(workspace_id,account_id,ticket_id,id,actor_id,body,created_at) values($1,$2,$3,$4,$5,$6,now())';
  await c.query(insert,[t.workspaceId,t.accountId,t.id,randomUUID(),agent.id,'Rolled back']);await c.query('ROLLBACK TO ignored_write');
  await c.query(insert,[t.workspaceId,t.accountId,t.id,nid,agent.id,'Kept']);
  await c.query("insert into helpdesk_core.ticket_events(workspace_id,account_id,ticket_id,id,actor_id,type,customer_visible,data,created_at) values($1,$2,$3,$4,$5,'note.created',false,$6,now())",[t.workspaceId,t.accountId,t.id,eid,agent.id,JSON.stringify({noteId:nid})]);
  assert.equal((await c.query('COMMIT')).command,'COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 assert.equal((await admin.query("select id from helpdesk_audit.write_effects where ticket_id=$1 and kind='note.created'",[t.id])).rows.length,1);
});
test('SQL016 disabled completion trigger is refused by runtime readiness',async()=>{
 await admin.query('alter table helpdesk_audit.write_effects disable trigger complete_write_effect');
 try{await assert.rejects(()=>assertDatabaseSecurity(app),{code:'unsafe_database_policies'});}
 finally{await admin.query('alter table helpdesk_audit.write_effects enable trigger complete_write_effect');}
 await assertDatabaseSecurity(app);
});
