/** Real PostgreSQL ONLY. Creates an additional fresh local database; never drops an existing one.
 * Executed serially after rls.test.ts inside the same disposable cluster.
 * No pg mock: if prerequisites fail, this suite must fail, not skip or claim upgrade approval.
 */
import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {validateDatabaseTestTargets} from '../../scripts/database-target.ts';
import {loadMigrationBundle} from '../../scripts/migration-files.ts';
import {PostgresUnitOfWork,assertSafeDatabaseRole,assertDatabaseSecurity,assertSchemaCompatibility} from '../../src/infrastructure/postgres.ts';
import {HelpdeskService} from '../../src/application/helpdesk.ts';
import {requestHash} from '../../src/domain/canonical.ts';
import type {SqlPool} from '../../src/infrastructure/sql.ts';
import type {Principal} from '../../src/domain/model.ts';

const targets=validateDatabaseTestTargets(process.env);
const bundle=await loadMigrationBundle(process.cwd());
if(bundle.schemaVersion!=='0.15.0'||bundle.migrations.length!==9||bundle.migrations[8]?.file!=='20260917000900_human_scope_versions.sql'||bundle.migrations[7]?.file!=='20260916000800_ticket_assignment.sql')
 throw Error('Review the upgrade scenario before changing the candidate migration set.');
const upgradeUrl=(base:string)=>{const url=new URL(base);url.pathname='/helpdesk_upgrade_test';return url.toString();};
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const requester:Principal={id:id(11),workspaceId:id(1),kind:'human',workspaceRole:null,grants:[{accountId:id(101),role:'requester'}],scopes:['contexts:resolve','tickets:read','tickets:write']};
const agent:Principal={...requester,id:id(13),grants:[{accountId:id(101),role:'agent'}],scopes:[...requester.scopes,'notes:read','notes:write']};
const input={accountId:id(101),productInstanceId:id(401),serviceCode:'SUPPORT',subject:'Legacy upgrade fixture',description:'Synthetic pre-assignment ticket',priority:'normal' as const};
const key='upgrade-legacy-create-key';
let control:SqlPool,admin:SqlPool,app:SqlPool,service:HelpdeskService;
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
 const login=(await admin.query('select format(\'alter role helpdesk_app login password %L\',$1) as command',[decodeURIComponent(new URL(targets.appUrl).password)])).rows[0]?.command;
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
 afterRows=await captureRows();
 app=new driver.Pool({connectionString:upgradeUrl(targets.appUrl),max:3});
 service=new HelpdeskService(new PostgresUnitOfWork(app));
});
after(async()=>{await app?.end();await admin?.end();await control?.end();});
test('upgrade 001–007 through 008 and 009 preserves every seeded row and technical lifecycle date',()=>{assert.deepEqual(afterRows,beforeRows);});
test('upgrade exposes schema 0.15.0 to a restricted real request login',async()=>{await assertSafeDatabaseRole(app);await assertSchemaCompatibility(app);await assertDatabaseSecurity(app);});
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
