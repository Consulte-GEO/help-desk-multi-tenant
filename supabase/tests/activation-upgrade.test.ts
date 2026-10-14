/** Full append-only promotion in a third fresh owned PG17 cluster, using a direct non-superuser operator. */
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';
import {validateDatabaseTestTargets} from '../../scripts/database-target.ts';import {loadMigrationBundle} from '../../scripts/migration-files.ts';
import {verifyConsulteGeoActivation,compileActivationCatalogueGuard} from '../../scripts/consultegeo-activation-upgrade.ts';
import {assertSafeDatabaseRole,assertSchemaCompatibility,assertDatabaseSecurity} from '../../src/infrastructure/postgres.ts';
import {assertRuntimeDatabase} from '../../src/infrastructure/authentication-database.ts';
import {DATABASE_SECURITY_CONTRACT as current} from '../../src/infrastructure/database-security-contract.ts';
import {DATABASE_SECURITY_CONTRACT as prior,assertDatabaseSecurity as assertV023Security} from '../../tests/helpers/qualified-v023.ts';
import {withOperatorFixture} from '../../tests/helpers/operator-fixture.ts';import type {SqlPool} from '../../src/infrastructure/sql.ts';
import {registerRegistrationOperationSqlTests} from './registration-operation-scenarios.ts';
import {registerNotificationPublicationSqlTests} from './notification-publication-scenarios.ts';
const targets=validateDatabaseTestTargets(process.env),operatorUrl=new URL(process.env.HELPDESK_TEST_OPERATOR_URL??''),adminUrl=new URL(targets.adminUrl);
if(operatorUrl.protocol!==adminUrl.protocol||operatorUrl.host!==adminUrl.host||operatorUrl.pathname!=='/helpdesk_test'||operatorUrl.username!=='helpdesk_operator'||!operatorUrl.password||operatorUrl.search||operatorUrl.hash)throw Error('A dedicated direct operator URL in the third owned cluster is required.');
const bundle=await loadMigrationBundle(process.cwd());await verifyConsulteGeoActivation(process.cwd());
if(bundle.schemaVersion!=='0.24.0'||bundle.migrations.length!==17||(current.schemaVersion as string)!=='0.24.0')throw Error('The complete reviewed activation migration set is required.');
const sql=bundle.migrations[16]!.sql;let operator:SqlPool,control:SqlPool,app:SqlPool;
async function identity(){assert.deepEqual((await operator.query('select current_user,session_user,rolsuper,rolcreaterole,rolbypassrls from pg_roles where rolname=current_user')).rows,[{current_user:'helpdesk_operator',session_user:'helpdesk_operator',rolsuper:false,rolcreaterole:true,rolbypassrls:true}]);}
async function data(){return Promise.all(prior.tables.map(async table=>({table:table.name,rows:(await control.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as rows from ${table.name} t`)).rows[0]?.rows})));}
async function snapshot(){return {
 marker:(await control.query('select helpdesk_auth.schema_version() as version')).rows,
 data:await data(),
 schemas:(await control.query("select nspname,nspowner,nspacl from pg_namespace where nspname like 'helpdesk_%' order by nspname")).rows,
 tables:(await control.query("select n.nspname,c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname like 'helpdesk_%' order by n.nspname,c.relname")).rows,
 columns:(await control.query("select n.nspname,c.relname,a.attname,a.attacl from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname like 'helpdesk_%' and a.attnum>0 and not a.attisdropped order by n.nspname,c.relname,a.attnum")).rows,
 policies:(await control.query("select n.nspname,c.relname,p.polname,p.polroles,p.polcmd,p.polpermissive,pg_get_expr(p.polqual,p.polrelid) as qualifier,pg_get_expr(p.polwithcheck,p.polrelid) as with_check from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname like 'helpdesk_%' order by n.nspname,c.relname,p.polname")).rows,
 functions:(await control.query("select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,p.proowner,p.proacl,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) as body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname like 'helpdesk_%' order by n.nspname,p.proname,arguments")).rows,
 roles:(await control.query("select oid,rolname,rolsuper,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls,rolinherit,rolcanlogin from pg_roles where rolname like 'helpdesk_%' order by oid")).rows,
 memberships:(await control.query('select roleid,member,grantor,admin_option,inherit_option,set_option from pg_auth_members order by roleid,member,grantor')).rows,
 defaults:(await control.query('select defaclrole,defaclnamespace,defaclobjtype,defaclacl::text as acl from pg_default_acl order by defaclrole,defaclnamespace,defaclobjtype')).rows
};}
async function refuses(statement:string,code:string,pool=operator){const saved=await snapshot();assert.match(statement,/\bCOMMIT;\s*$/);try{await assert.rejects(()=>pool.query(statement.replace(/\bCOMMIT;\s*$/,'')),{code});}finally{await pool.query('ROLLBACK');assert.deepEqual(await snapshot(),saved);}}
type Drift={name:string;code:string;apply:()=>Promise<unknown>;undo:()=>Promise<unknown>};
async function withDrift(drift:Drift,probe:()=>Promise<unknown>){await identity();const saved=await snapshot();await withOperatorFixture(drift,probe,async()=>{assert.deepEqual(await snapshot(),saved);await identity();});}
const command=(name:string,apply:string,undo:string,code='HDU04'):Drift=>({name,code,apply:()=>control.query(apply),undo:()=>control.query(undo)});
const membership=(flag:'ADMIN'|'INHERIT'|'SET',bad:boolean,good:boolean)=>command('bootstrap incoming '+flag,`GRANT helpdesk_resource_publisher TO helpdesk_operator WITH ${flag} ${String(bad).toUpperCase()} GRANTED BY postgres`,`GRANT helpdesk_resource_publisher TO helpdesk_operator WITH ${flag} ${String(good).toUpperCase()} GRANTED BY postgres`);
const appDrifts:Drift[]=[
 command('application BYPASSRLS','ALTER ROLE helpdesk_app BYPASSRLS','ALTER ROLE helpdesk_app NOBYPASSRLS'),
 command('application CREATEROLE','ALTER ROLE helpdesk_app CREATEROLE','ALTER ROLE helpdesk_app NOCREATEROLE'),
 command('application non-inheriting membership','GRANT helpdesk_maintenance TO helpdesk_app WITH INHERIT FALSE GRANTED BY postgres;GRANT helpdesk_maintenance TO helpdesk_app WITH SET FALSE GRANTED BY postgres;GRANT helpdesk_maintenance TO helpdesk_app WITH ADMIN FALSE GRANTED BY postgres;','REVOKE helpdesk_maintenance FROM helpdesk_app GRANTED BY postgres')
];
const drifts:Drift[]=[
 command('operator lacks CREATEROLE','ALTER ROLE helpdesk_operator NOCREATEROLE','ALTER ROLE helpdesk_operator CREATEROLE','HDU01'),
 command('operator lacks BYPASSRLS','ALTER ROLE helpdesk_operator NOBYPASSRLS','ALTER ROLE helpdesk_operator BYPASSRLS','HDU01'),
 command('private schema proprietor changed','ALTER SCHEMA helpdesk_audit OWNER TO postgres','ALTER SCHEMA helpdesk_audit OWNER TO helpdesk_operator','HDU01'),
 command('worker column grant','GRANT SELECT(id) ON helpdesk_core.tickets TO helpdesk_notification_worker','REVOKE SELECT(id) ON helpdesk_core.tickets FROM helpdesk_notification_worker'),
 command('worker helper grant','GRANT EXECUTE ON FUNCTION helpdesk_auth.hdn_cfg_state() TO helpdesk_notification_worker','REVOKE EXECUTE ON FUNCTION helpdesk_auth.hdn_cfg_state() FROM helpdesk_notification_worker'),
 command('worker schema grant','GRANT USAGE ON SCHEMA helpdesk_auth TO helpdesk_notification_worker','REVOKE USAGE ON SCHEMA helpdesk_auth FROM helpdesk_notification_worker'),
 command('outgoing worker membership','GRANT helpdesk_app TO helpdesk_notification_worker','REVOKE helpdesk_app FROM helpdesk_notification_worker'),
 command('owner defaults','ALTER DEFAULT PRIVILEGES FOR ROLE helpdesk_operator IN SCHEMA helpdesk_auth GRANT EXECUTE ON FUNCTIONS TO helpdesk_notification_worker','ALTER DEFAULT PRIVILEGES FOR ROLE helpdesk_operator IN SCHEMA helpdesk_auth REVOKE EXECUTE ON FUNCTIONS FROM helpdesk_notification_worker','HDU05'),
 command('partial local module','CREATE TABLE helpdesk_auth.cg_local_registries(sentinel text)','DROP TABLE helpdesk_auth.cg_local_registries','HDU03'),
 membership('ADMIN',false,true),membership('INHERIT',true,false),membership('SET',true,false)
];
before(async()=>{
 const driverName='pg',driver=await import(driverName) as {Pool:new(options:Record<string,unknown>)=>SqlPool};
 operator=new driver.Pool({connectionString:operatorUrl.toString(),max:1});control=new driver.Pool({connectionString:targets.adminUrl,max:1});
 await identity();assert.equal((await control.query("select count(*)::integer as n from pg_roles where rolname in ('helpdesk_app','helpdesk_resource_publisher','helpdesk_notification_worker')")).rows[0]?.n,0,'activation requires its own cluster with no prior service roles');
 assert.equal((await control.query("select count(*)::integer as n from pg_namespace where nspname like 'helpdesk_%'")).rows[0]?.n,0);
 for(const migration of bundle.migrations.slice(0,16))await operator.query(migration.sql);
 await operator.query("insert into helpdesk_core.workspaces(id,name) values('72000000-0000-4000-8000-000000000001','Full activation preservation fixture')");
 const login=(await operator.query("select format('ALTER ROLE helpdesk_app LOGIN PASSWORD %L',$1::text) as sql",[decodeURIComponent(new URL(targets.appUrl).password)])).rows[0]?.sql;
 await operator.query(String(login));app=new driver.Pool({connectionString:targets.appUrl,max:1});await assertSafeDatabaseRole(app);await assertV023Security(app);
});
after(async()=>{await app?.end();await operator?.end();await control?.end();});
test('the full sixteen-file prefix has common owner and the exact live PG17 bootstrap membership',async()=>{
 await identity();assert.equal((await operator.query("select count(*)::integer as n from pg_namespace where nspname in ('helpdesk_auth','helpdesk_core','helpdesk_audit','helpdesk_integration') and nspowner=current_user::regrole")).rows[0]?.n,4);
 assert.deepEqual((await operator.query("select r.rolname,m.grantor,m.admin_option,m.inherit_option,m.set_option,bootstrap.rolsuper as bootstrap_superuser from pg_auth_members m join pg_roles r on r.oid=m.roleid join pg_roles bootstrap on bootstrap.oid=m.grantor where r.rolname in ('helpdesk_resource_publisher','helpdesk_notification_worker') order by r.rolname")).rows,[
  {rolname:'helpdesk_notification_worker',grantor:10,admin_option:true,inherit_option:false,set_option:false,bootstrap_superuser:true},
  {rolname:'helpdesk_resource_publisher',grantor:10,admin_option:true,inherit_option:false,set_option:false,bootstrap_superuser:true}
 ]);
});
test('the exact 0.23 prefix admits closed authentication while current business readiness refuses it',async()=>{
 const mode={authenticationOnly:true,administration:false,workflow:false,intake:false};await assertRuntimeDatabase(app,mode);
 await assert.rejects(()=>assertSchemaCompatibility(app),{code:'schema_version_mismatch'});
 for(const enabled of [{...mode,authenticationOnly:false},{...mode,administration:true},{...mode,workflow:true},{...mode,intake:true}])await assert.rejects(()=>assertRuntimeDatabase(app,enabled),{code:'schema_version_mismatch'});
});
test('activation refuses real owner, membership, ACL, defaults and partial-installation drift without data loss',async suite=>{
 await suite.test('normal application cannot promote',()=>refuses(sql,'HDU01',app));
 for(const drift of [...drifts,...appDrifts])await suite.test(drift.name,()=>withDrift(drift,()=>refuses(sql,drift.code)));
});
test('final catalogue failures roll back all new objects and preserve every original row',async()=>{
 const weakenedRls=sql.replace('FORCE ROW LEVEL SECURITY','NO FORCE ROW LEVEL SECURITY');assert.notEqual(weakenedRls,sql);await refuses(weakenedRls,'HDU06');
 const marker='-- Validate actual activation catalogue before publishing the schema marker.';
 assert.ok(sql.includes(marker));const extraWorker=sql.replace(marker,"GRANT EXECUTE ON FUNCTION helpdesk_auth.cg_local_operator() TO helpdesk_notification_worker;\n"+marker);await refuses(extraWorker,'HDU06');
});
test('a direct non-superuser executes the complete seventeen-file promotion with current restricted readiness',async()=>{
 const saved=await data();await identity();await operator.query(sql);await identity();
 await assertSafeDatabaseRole(app);await assertSchemaCompatibility(app);await assertDatabaseSecurity(app);assert.deepEqual(await data(),saved);
 assert.equal((await operator.query('select helpdesk_auth.schema_version() as version')).rows[0]?.version,'0.24.0');
 const newTables=current.tables.filter(table=>!prior.tables.some(old=>old.name===table.name));assert.equal(newTables.length,14);
 for(const table of newTables)assert.equal((await operator.query(`select count(*)::integer as n from ${table.name}`)).rows[0]?.n,0,'Promotion must not provision business data');
 const worker=current.roles.find(role=>role.name==='helpdesk_notification_worker');assert.deepEqual(worker?.schemas,['helpdesk_auth']);assert.equal(worker?.functions.length,13);
});
test('activation replay is refused and preserves the completed 0.24 installation',async()=>{await refuses(sql,'HDU02');await assertDatabaseSecurity(app);});
test('the final migration guard refuses administrative application drift even when the ordinary ACLs remain unchanged',async suite=>{
 const finalGuard='BEGIN;\n'+compileActivationCatalogueGuard('final')+'COMMIT;\n';
 for(const drift of appDrifts)await suite.test(drift.name,()=>withDrift(drift,async()=>{
  await assertDatabaseSecurity(app);
  await assert.rejects(()=>assertSafeDatabaseRole(app),{code:'unsafe_database_role'});await refuses(finalGuard,'HDU06');
 }));
 await assertSafeDatabaseRole(app);await assertDatabaseSecurity(app);
});
test('current readiness rejects additional worker authority and owner defaults after promotion',async suite=>{
 for(const drift of drifts.filter(item=>['worker column grant','worker helper grant','outgoing worker membership','owner defaults','operator lacks CREATEROLE'].includes(item.name)))
  await suite.test(drift.name,()=>withDrift(drift,()=>assert.rejects(()=>assertDatabaseSecurity(app),{code:'unsafe_database_policies'})));
 await assertDatabaseSecurity(app);
});
registerRegistrationOperationSqlTests(()=>operator,()=>control,()=>app);
registerNotificationPublicationSqlTests(()=>operator,()=>control,()=>app);
