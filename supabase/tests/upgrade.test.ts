/** Real PostgreSQL ONLY. Creates an additional fresh local database; never drops an existing one.
 * Executed serially after rls.test.ts inside the same disposable cluster.
 * No pg mock: if prerequisites fail, this suite must fail, not skip or claim upgrade approval.
 */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {validateDatabaseTestTargets} from '../../scripts/database-target.ts';
import {loadQualifiedV023Bundle as loadMigrationBundle,assertSchemaCompatibility,assertDatabaseSecurity} from '../../tests/helpers/qualified-v023.ts';
import {PostgresUnitOfWork,assertSafeDatabaseRole} from '../../src/infrastructure/postgres.ts';
import {HelpdeskService} from '../../src/application/helpdesk.ts';
import {requestHash} from '../../src/domain/canonical.ts';
import type {SqlPool} from '../../src/infrastructure/sql.ts';
import type {Principal} from '../../src/domain/model.ts';

const targets=validateDatabaseTestTargets(process.env);
const bundle=await loadMigrationBundle(process.cwd());
if(bundle.schemaVersion!=='0.23.0'||bundle.migrations.length!==16||bundle.migrations[15]?.file!=='20261014015714_consultegeo_m09c_atomic_opening.sql'||bundle.migrations[14]?.file!=='20261013233838_consultegeo_m09b_intake.sql'||bundle.migrations[13]?.file!=='20261013195704_consultegeo_m06_public_conversation.sql'||bundle.migrations[12]?.file!=='20261013181408_consultegeo_m05_upgrade.sql'||bundle.migrations[11]?.file!=='20261007001200_workspace_discovery.sql'||bundle.migrations[10]?.file!=='20260917001100_conversation_lock.sql'||bundle.migrations[9]?.file!=='20260917001000_transaction_effects.sql'||bundle.migrations[8]?.file!=='20260917000900_human_scope_versions.sql'||bundle.migrations[7]?.file!=='20260916000800_ticket_assignment.sql')
 throw Error('Review the upgrade scenario before changing the candidate migration set.');
const upgradeUrl=(base:string)=>{const url=new URL(base);url.pathname='/helpdesk_upgrade_test';return url.toString();};
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const requester:Principal={id:id(11),workspaceId:id(1),kind:'human',workspaceRole:null,grants:[{accountId:id(101),role:'requester'}],scopes:['contexts:resolve','tickets:read','tickets:write']};
const agent:Principal={...requester,id:id(13),grants:[{accountId:id(101),role:'agent'}],scopes:[...requester.scopes,'notes:read','notes:write']};
const input={accountId:id(101),productInstanceId:id(401),serviceCode:'SUPPORT',subject:'Legacy upgrade fixture',description:'Synthetic pre-assignment ticket',priority:'normal' as const};
const key='upgrade-legacy-create-key';
let control:SqlPool,admin:SqlPool,app:SqlPool,service:HelpdeskService;
let initialEffectRows:unknown[];
let beforeLockRows:Record<string,unknown[]>,afterLockRows:Record<string,unknown[]>;
let beforeLockMeta:unknown[],afterLockMeta:unknown[];
let original:Record<string,unknown>,beforeRows:Record<string,unknown[]>,afterRows:Record<string,unknown[]>;
const snapshotTables=['helpdesk_core.tickets','helpdesk_core.contract_versions','helpdesk_core.coverages','helpdesk_core.ticket_messages','helpdesk_core.internal_notes','helpdesk_core.ticket_events','helpdesk_integration.outbox_events','helpdesk_integration.api_idempotency_keys'];
async function captureRows(){
 const result:Record<string,unknown[]>={};
 // Identifiers are exclusively developer-owned literals above, never request input.
 for(const table of snapshotTables){const expression=table==='helpdesk_core.tickets'?"to_jsonb(t)-'assigned_to'":'to_jsonb(t)';
  result[table]=(await admin.query(`select ${expression} as row from ${table} t order by (${expression})::text`)).rows.map(r=>r.row);}
 return result;
}
before(async()=>{
 const moduleName='pg';const driver=await import(moduleName) as {Pool:new(options:Record<string,unknown>)=>SqlPool};
 control=new driver.Pool({connectionString:targets.adminUrl,max:1});
 const version=Number((await control.query("select current_setting('server_version_num') as version")).rows[0]?.version);
 if(version<170000||version>=180000)throw Error('Upgrade suite requires PostgreSQL 17.');
 if((await control.query("select 1 from pg_database where datname='helpdesk_upgrade_test'")).rows.length)
  throw Error('Use a new disposable cluster: existing upgrade database is never removed by this suite.');
 await control.query('CREATE DATABASE helpdesk_upgrade_test');
 admin=new driver.Pool({connectionString:upgradeUrl(targets.adminUrl),max:2});
 for(const migration of bundle.migrations.slice(0,7))await admin.query(migration.sql);
 assert.equal((await admin.query('select helpdesk_auth.schema_version() as version')).rows[0]?.version,'0.8.0');
 assert.equal((await admin.query("select 1 from information_schema.columns where table_schema='helpdesk_core' and table_name='tickets' and column_name='assigned_to'")).rows.length,0);
 const login=(await admin.query('select format(\'alter role helpdesk_app login password %L\',$1::text) as command',[decodeURIComponent(new URL(targets.appUrl).password)])).rows[0]?.command;
 await admin.query(String(login));
 const createdAt=new Date().toISOString(),snapshot={contractId:id(501),version:1,policy:{marker:'historic-policy'}};
 original={id:id(901),workspaceId:id(1),accountId:id(101),productInstanceId:id(401),serviceCode:'SUPPORT',createdBy:id(11),...{subject:input.subject,description:input.description},status:'new',priority:'normal',version:1,coverageId:id(701),contractVersionId:id(601),contractSnapshot:snapshot,createdAt,updatedAt:createdAt};
 const client=await admin.connect();
 try{
  await client.query('BEGIN');
  await client.query("insert into helpdesk_core.workspaces(id,name) values($1,'Synthetic upgrade workspace')",[id(1)]);
  for(const who of [11,13])await client.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[id(who),id(who+1000)]);
  await client.query("insert into helpdesk_core.accounts(workspace_id,id,name) values($1,$2,'Synthetic account')",[id(1),id(101)]);
  for(const who of [requester,agent])await client.query('insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,$4)',[id(1),id(101),who.id,who.grants[0]!.role]);
  await client.query("insert into helpdesk_core.products(workspace_id,id,code,name) values($1,$2,'UPGRADE','Synthetic product')",[id(1),id(301)]);
  await client.query("insert into helpdesk_core.product_instances(workspace_id,product_id,id,environment) values($1,$2,$3,'staging')",[id(1),id(301),id(401)]);
  await client.query("insert into helpdesk_core.services(workspace_id,product_id,code,name) values($1,$2,'SUPPORT','Support')",[id(1),id(301)]);
  await client.query("insert into helpdesk_core.support_contracts(workspace_id,id,name) values($1,$2,'Legacy synthetic contract')",[id(1),id(501)]);
  await client.query("insert into helpdesk_core.contract_versions(workspace_id,contract_id,id,version,published,valid_from,policy) values($1,$2,$3,1,true,'2020-01-01',$4::jsonb)",[id(1),id(501),id(601),JSON.stringify(snapshot.policy)]);
  await client.query("insert into helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) values($1,$2,$3,$4,'SUPPORT',$5,$6)",[id(1),id(101),id(301),id(401),id(601),id(701)]);
  await client.query("insert into helpdesk_core.tickets(workspace_id,account_id,id,product_instance_id,service_code,coverage_id,contract_version_id,created_by,subject,description,status,priority,version,contract_snapshot,created_at,updated_at) values($1,$2,$3,$4,'SUPPORT',$5,$6,$7,$8,$9,'new','normal',2,$10::jsonb,$11,$11)",[id(1),id(101),id(901),id(401),id(701),id(601),id(11),input.subject,input.description,JSON.stringify(snapshot),createdAt]);
  await client.query("insert into helpdesk_core.ticket_messages(workspace_id,account_id,ticket_id,id,actor_id,actor_type,body,created_at) values($1,$2,$3,$4,$5,'customer','Synthetic public message',$6)",[id(1),id(101),id(901),id(911),id(11),createdAt]);
  await client.query("insert into helpdesk_core.internal_notes(workspace_id,account_id,ticket_id,id,actor_id,body,created_at) values($1,$2,$3,$4,$5,'Synthetic internal note',$6)",[id(1),id(101),id(901),id(912),id(13),createdAt]);
  for(const [number,type,data,visible,actor] of [
   [921,'ticket.created',{version:1},true,11],
   [922,'message.created',{messageId:id(911),actorType:'customer'},true,11],
   [923,'note.created',{noteId:id(912)},false,13]
  ] as const){
   await client.query('insert into helpdesk_core.ticket_events(workspace_id,account_id,ticket_id,id,actor_id,type,customer_visible,data,created_at) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)',[id(1),id(101),id(901),id(number),id(actor),type,visible,JSON.stringify(data),createdAt]);
   if(visible)await client.query('insert into helpdesk_integration.outbox_events(workspace_id,account_id,ticket_id,id,type,payload,request_id,created_at) values($1,$2,$3,$4,$5,$6::jsonb,$7,$8)',[id(1),id(101),id(901),id(number),type,JSON.stringify({specversion:'1.0',id:id(number),source:'helpdesk/workspaces/'+id(1),type:'com.helpdesk.'+type+'.v1',subject:'tickets/'+id(901),time:createdAt,datacontenttype:'application/json',data:{ticket_id:id(901),version:number===921?1:2}}),'synthetic-upgrade',createdAt]);
  }
  await client.query("insert into helpdesk_integration.api_idempotency_keys(workspace_id,principal_id,operation,key,request_hash,result) values($1,$2,'tickets.create',$3,$4,$5::jsonb)",[id(1),id(11),key,requestHash(input),JSON.stringify(original)]);
  assert.equal((await client.query('COMMIT')).command,'COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 beforeRows=await captureRows();
 await admin.query(bundle.migrations[7]!.sql);
 assert.deepEqual(await captureRows(),beforeRows); // preserve the previous upgrade boundary too
 assert.equal((await admin.query('select helpdesk_auth.schema_version() as version')).rows[0]?.version,'0.9.0');
 await admin.query(bundle.migrations[8]!.sql);
 assert.deepEqual(await captureRows(),beforeRows);
 assert.equal((await admin.query('select helpdesk_auth.schema_version() as version')).rows[0]?.version,'0.15.0');
 await admin.query(bundle.migrations[9]!.sql);
 initialEffectRows=(await admin.query('select id from helpdesk_audit.write_effects')).rows;
 afterRows=await captureRows();
 assert.equal((await admin.query('select helpdesk_auth.schema_version() as version')).rows[0]?.version,'0.16.0');
 beforeLockRows=await captureRows();
 const metadataSql="select proowner,proacl,prosecdef,proconfig from pg_proc where oid='helpdesk_audit.record_conversation_effect()'::regprocedure";
 beforeLockMeta=(await admin.query(metadataSql)).rows;
 await admin.query(bundle.migrations[10]!.sql);
 afterLockMeta=(await admin.query(metadataSql)).rows;
 afterLockRows=await captureRows();
 assert.equal((await admin.query('select id from helpdesk_audit.write_effects')).rowCount,0);
 const discoveryBefore=await captureRows();
 const accessSql="select jsonb_build_object('memberships',(select coalesce(jsonb_agg(to_jsonb(m) order by workspace_id,principal_id),'[]'::jsonb) from helpdesk_auth.workspace_memberships m),'grants',(select coalesce(jsonb_agg(to_jsonb(g) order by workspace_id,account_id,principal_id),'[]'::jsonb) from helpdesk_auth.account_grants g),'scopes',(select coalesce(jsonb_agg(to_jsonb(s) order by workspace_id,principal_id,revision),'[]'::jsonb) from helpdesk_auth.human_scope_versions s)) as state";
 const accessBefore=(await admin.query(accessSql)).rows;
 await admin.query(bundle.migrations[11]!.sql);
 assert.deepEqual(await captureRows(),discoveryBefore);
 assert.deepEqual((await admin.query(accessSql)).rows,accessBefore);
 const beforeM05=await captureRows();
 await admin.query(bundle.migrations[12]!.sql);
 assert.deepEqual(await captureRows(),beforeM05);
 assert.deepEqual((await admin.query(accessSql)).rows,accessBefore);
 await admin.query(bundle.migrations[13]!.sql);
 const beforeM09b=await captureRows();await admin.query(bundle.migrations[14]!.sql);assert.deepEqual(await captureRows(),beforeM09b);assert.deepEqual((await admin.query(accessSql)).rows,accessBefore);
 const beforeM09c=await captureRows();await admin.query(bundle.migrations[15]!.sql);assert.deepEqual(await captureRows(),beforeM09c);assert.deepEqual((await admin.query(accessSql)).rows,accessBefore);
 app=new driver.Pool({connectionString:upgradeUrl(targets.appUrl),max:3});
 service=new HelpdeskService(new PostgresUnitOfWork(app));
});
after(async()=>{await app?.end();await admin?.end();await control?.end();});
test('upgrade 001–007 through 008, 009 and 010 preserves every seeded row and technical lifecycle date',()=>{assert.deepEqual(afterRows,beforeRows);});
test('upgrade exposes schema 0.23.0 to a restricted real request login',async()=>{await assertSafeDatabaseRole(app);await assertSchemaCompatibility(app);await assertDatabaseSecurity(app);});
test('upgraded grant-only human discovers its legacy workspace through the restricted login',async()=>{
 assert.deepEqual((await app.query('select helpdesk_auth.list_human_workspaces($1) as result',[id(1011)])).rows[0]?.result,[{id:id(1),name:'Synthetic upgrade workspace'}]);
});
test('legacy ticket receives null assignment without changing its version or policy',async()=>{const ticket=await service.get(requester,id(901));assert.equal(ticket.assignedTo,null);assert.equal(ticket.version,2);assert.deepEqual(ticket.contractSnapshot,original.contractSnapshot);});
test('legacy idempotency replay retains its old snapshot without synthesizing assignment',async()=>{const result=await service.create(requester,input,key,'synthetic-upgrade');assert.equal(result.replayed,true);assert.deepEqual(result.ticket,original);assert.equal(Object.hasOwn(result.ticket,'assignedTo'),false);});
test('public conversation remains readable while old internal note is denied to customer',async()=>{assert.equal((await service.messages(requester,id(901)))[0]?.body,'Synthetic public message');await assert.rejects(()=>service.notes(requester,id(901)),{status:403});assert.equal((await service.notes(agent,id(901)))[0]?.body,'Synthetic internal note');});
test('live revocation still denies old replay after schema upgrade',async()=>{
 await admin.query('update helpdesk_auth.account_grants set active=false where principal_id=$1',[requester.id]);
 try{await assert.rejects(()=>service.create(requester,input,key,'synthetic-upgrade'),{status:404});}
 finally{await admin.query('update helpdesk_auth.account_grants set active=true where principal_id=$1',[requester.id]);}
});
test('new assignment works on a legacy ticket without rewriting its policy or publishing an event',async()=>{
 const priorOutbox=(await admin.query('select count(*)::integer as n from helpdesk_integration.outbox_events')).rows[0]?.n;
 const assigned=await service.changeAssignment(agent,id(901),'claim',2,'Synthetic upgrade claim','upgrade-assignment-key','synthetic-upgrade');
 assert.equal(assigned.ticket.assignedTo,agent.id);assert.equal(assigned.ticket.version,3);assert.deepEqual(assigned.ticket.contractSnapshot,original.contractSnapshot);
 assert.equal((await admin.query('select count(*)::integer as n from helpdesk_integration.outbox_events')).rows[0]?.n,priorOutbox);
 assert.equal((await service.timeline(requester,id(901))).some(e=>e.type==='ticket.assignment_changed'),false);
 assert.equal((await service.timeline(agent,id(901))).some(e=>e.type==='ticket.assignment_changed'),true);
});
test('creation replay after assignment is still the original response, not a second mutation',async()=>{const result=await service.create(requester,input,key,'synthetic-upgrade');assert.deepEqual(result.ticket,original);assert.equal((await service.get(agent,id(901))).version,3);});

// The one-time compatibility backfill must not silently revoke existing human workflows.
test('upgrade009 backfills exactly the previously active human workspace relationships',async()=>{
 const rows=(await admin.query('select principal_id,revision,scopes,reason from helpdesk_auth.human_scope_versions order by principal_id')).rows;
 assert.equal(rows.length,2);assert.deepEqual(rows.map(r=>r.principal_id),[id(11),id(13)]);
 for(const r of rows){assert.equal(r.revision,1);assert.deepEqual(r.scopes,['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write']);assert.match(String(r.reason),/^Migration 009:/);}
});
test('upgrade009 resolves the same existing user while obtaining scopes from its first revision',async()=>{
 const r=(await app.query('select helpdesk_auth.resolve_human($1,$2) as principal',[id(1013),id(1)])).rows[0]?.principal as {id:string;scopes:string[]};
 assert.equal(r.id,agent.id);assert.deepEqual(r.scopes,['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write']);
});

// Effect receipts intentionally certify ONLY writes made after the migration.
test('upgrade010 creates no synthetic receipts for historical messages/events',()=>{assert.deepEqual(initialEffectRows,[]);});
test('upgrade010 records the new assignment on a legacy ticket without public outbox',async()=>{
 const r=(await admin.query('select kind,applied,ticket_version from helpdesk_audit.write_effects where ticket_id=$1',[id(901)])).rows;
 assert.deepEqual(r,[{kind:'ticket.assignment_changed',applied:true,ticket_version:3}]);
});
test('upgrade010 replay of legacy creation does not create a retrospective receipt',async()=>{
 const before=(await admin.query('select to_jsonb(r) as data from helpdesk_audit.write_effects r order by id')).rows;
 assert.deepEqual((await service.create(requester,input,key,'synthetic-upgrade')).ticket,original);
 assert.deepEqual((await admin.query('select to_jsonb(r) as data from helpdesk_audit.write_effects r order by id')).rows,before);
});
test('upgrade010 new public response on an old ticket has matched event and outbox',async()=>{
 const result=await service.addMessage(agent,id(901),'Post-upgrade response','upgrade-new-message-010','synthetic-upgrade');
 const rows=(await admin.query("select e.type as event_type,o.type as outbox_type,r.applied from helpdesk_audit.write_effects r join helpdesk_core.ticket_events e on(e.workspace_id,e.id)=(r.workspace_id,r.event_id) join helpdesk_integration.outbox_events o on(o.workspace_id,o.id)=(r.workspace_id,r.event_id) where r.source_id=$1",[result.message.id])).rows;
 assert.deepEqual(rows,[{event_type:'message.created',outbox_type:'message.created',applied:true}]);
 assert.deepEqual((await service.get(agent,id(901))).contractSnapshot,original.contractSnapshot);
});


// The final upgrade changes only the existing hook lock and schema version.
test('upgrade011 preserves stored rows, owner, ACL and private trigger configuration',()=>{
 assert.deepEqual(afterLockRows,beforeLockRows);assert.deepEqual(afterLockMeta,beforeLockMeta);
});
test('upgrade011 note-only operator writes and replays on the legacy ticket without public write or collection read',async()=>{
 await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3::text[],1,$4,$5)',[agent.workspaceId,agent.id,['tickets:read','notes:write'],'Synthetic upgrade note-only profile',id(999)]);
 const who:Principal={...agent,scopes:['tickets:read','notes:write']};const prior=await service.get(who,id(901));
 const outbox=(await admin.query('select id from helpdesk_integration.outbox_events order by id')).rows;
 const first=await service.addNote(who,id(901),'Note-only legacy receipt','upgrade011-note-key','synthetic-upgrade');
 const repeated=await service.addNote(who,id(901),'Note-only legacy receipt','upgrade011-note-key','synthetic-upgrade');
 assert.equal(repeated.replayed,true);assert.deepEqual(repeated.note,first.note);
 await assert.rejects(()=>service.notes(who,id(901)),{status:403});await assert.rejects(()=>service.addMessage(who,id(901),'Denied public write','upgrade011-message-key','synthetic-upgrade'),{status:403});
 const current=await service.get(who,id(901));assert.equal(current.version,prior.version);assert.deepEqual(current.contractSnapshot,prior.contractSnapshot);
 assert.deepEqual((await admin.query('select id from helpdesk_integration.outbox_events order by id')).rows,outbox);
 assert.deepEqual((await service.create(requester,input,key,'synthetic-upgrade')).ticket,original);
});
