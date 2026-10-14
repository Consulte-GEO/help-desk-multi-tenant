/** Real PG17 proof in a second owned cluster. The operator is a direct non-superuser login. */
import test,{before,after} from 'node:test';import assert from 'node:assert/strict';
import {validateDatabaseTestTargets} from '../../scripts/database-target.ts';import {loadMigrationBundle} from '../../scripts/migration-files.ts';
import {assertDatabaseSecurity,DATABASE_SECURITY_QUERY} from '../../src/infrastructure/database-security.ts';import {assertSafeDatabaseRole,assertSchemaCompatibility} from '../../src/infrastructure/postgres.ts';
import {DATABASE_SECURITY_CONTRACT} from '../../src/infrastructure/database-security-contract.ts';import type {SqlPool} from '../../src/infrastructure/sql.ts';
import {withOperatorFixture} from '../../tests/helpers/operator-fixture.ts';
const targets=validateDatabaseTestTargets(process.env),operatorUrl=new URL(process.env.HELPDESK_TEST_OPERATOR_URL??'');
const adminUrl=new URL(targets.adminUrl);
if(operatorUrl.protocol!==adminUrl.protocol||operatorUrl.host!==adminUrl.host||operatorUrl.pathname!=='/helpdesk_test'||operatorUrl.username!=='helpdesk_operator'||!operatorUrl.password||operatorUrl.search||operatorUrl.hash)throw Error('A dedicated direct operator URL in the second local cluster is required.');
const bundle=await loadMigrationBundle(process.cwd());
let operator:SqlPool,control:SqlPool,app:SqlPool;
const id='71000000-0000-4000-8000-000000000001';
async function snapshot(){return {version:(await operator.query('select helpdesk_auth.schema_version() as version')).rows,
 rows:(await operator.query('select to_jsonb(w) as row from helpdesk_core.workspaces w order by id')).rows,
 objects:(await operator.query("select n.nspname,c.relname,c.relowner,c.relacl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname like 'helpdesk_%' order by n.nspname,c.relname")).rows,
 functions:(await operator.query("select n.nspname,p.proname,p.proowner,p.proacl,p.prosecdef,p.proconfig,pg_get_functiondef(p.oid) as body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname like 'helpdesk_%' order by n.nspname,p.proname,p.oid")).rows};}
async function refusesMigration(sql:string,code:string){
 const prior=await snapshot();assert.match(sql,/\bCOMMIT;\s*$/);
 // A negative probe retains the whole reviewed body but holds its final commit.
 // Even an unexpected acceptance must leave no schema marker or object behind.
 try{await assert.rejects(()=>operator.query(sql.replace(/\bCOMMIT;\s*$/,'')),{code});}
 finally{await operator.query('ROLLBACK');assert.deepEqual(await snapshot(),prior);}
}
async function assertDirectOperator(){assert.deepEqual((await operator.query('select current_user,session_user,rolsuper,rolcreaterole,rolbypassrls from pg_roles where rolname=current_user')).rows,[{current_user:'helpdesk_operator',session_user:'helpdesk_operator',rolsuper:false,rolcreaterole:true,rolbypassrls:true}]);}
async function fixtureRoleState(){return {
 roles:(await control.query("select oid,rolname,rolsuper,rolcreaterole,rolbypassrls,rolcreatedb,rolinherit,rolreplication,rolcanlogin from pg_roles where rolname in ('postgres','helpdesk_operator','helpdesk_app','helpdesk_maintenance','helpdesk_resource_publisher','helpdesk_notification_worker') or rolname like 'helpdesk_fixture_%' order by oid")).rows,
 memberships:(await control.query('select roleid,member,grantor,admin_option,inherit_option,set_option from pg_auth_members order by roleid,member,grantor')).rows,
 defaults:(await control.query('select defaclrole,defaclnamespace,defaclobjtype,defaclacl::text as acl from pg_default_acl order by defaclrole,defaclnamespace,defaclobjtype')).rows
};}
type Drift={name:string;postgresProtection?:true;apply:()=>Promise<unknown>;undo:()=>Promise<unknown>};
async function withDrift(drift:Drift,probe:()=>Promise<unknown>){await assertDirectOperator();const prior=await fixtureRoleState();await withOperatorFixture(drift,probe,async()=>{assert.deepEqual(await fixtureRoleState(),prior);await assertDirectOperator();});}
const grantFlags=(role:string,member:string,flags={admin:true,inherit:false,set:false},grantor='postgres')=>['ADMIN','INHERIT','SET'].map(flag=>`GRANT ${role} TO ${member} WITH ${flag} ${String(flags[flag.toLowerCase() as keyof typeof flags]).toUpperCase()} GRANTED BY ${grantor};`).join('\n');
const role='helpdesk_resource_publisher';
before(async()=>{const name='pg',driver=await import(name) as {Pool:new(options:Record<string,unknown>)=>SqlPool};
 operator=new driver.Pool({connectionString:operatorUrl.toString(),max:1});control=new driver.Pool({connectionString:targets.adminUrl,max:1});
 assert.deepEqual((await operator.query('select current_user,session_user,rolsuper,rolcreaterole,rolbypassrls from pg_roles where rolname=current_user')).rows,[{current_user:'helpdesk_operator',session_user:'helpdesk_operator',rolsuper:false,rolcreaterole:true,rolbypassrls:true}]);
 assert.equal((await operator.query("select count(*)::integer as n from pg_roles where rolname in ('helpdesk_app','helpdesk_resource_publisher','helpdesk_notification_worker')")).rows[0]?.n,0,'the second cluster must have no roles from the old suite');
 for(const migration of bundle.migrations.slice(0,12))await operator.query(migration.sql);
 await operator.query("insert into helpdesk_core.workspaces(id,name) values($1,'Operator preservation fixture')",[id]);
 const command=(await operator.query("select format('ALTER ROLE helpdesk_app LOGIN PASSWORD %L',$1::text) as command",[decodeURIComponent(new URL(targets.appUrl).password)])).rows[0]?.command;await operator.query(String(command));
 app=new driver.Pool({connectionString:targets.appUrl,max:1});
});
after(async()=>{await app?.end();await operator?.end();await control?.end();});
test('non-super direct login installs the twelve unchanged baseline migrations',async()=>{assert.equal((await operator.query('select helpdesk_auth.schema_version() as version')).rows[0]?.version,'0.19.0');assert.equal((await operator.query("select count(*)::integer as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname like 'helpdesk_%' and c.relkind='r'")).rows[0]?.n,25);});
test('failure after service creation rolls back roles, module objects, data and version',async()=>{
 await assertDirectOperator();
 const acceptedSql="BEGIN;INSERT INTO helpdesk_core.workspaces(id,name) VALUES('71000000-0000-4000-8000-000000000098','Unexpected success sentinel');CREATE OR REPLACE FUNCTION helpdesk_auth.schema_version() RETURNS text LANGUAGE sql IMMUTABLE SET search_path='' AS $$SELECT '0.99.0'::text$$;COMMIT;";
 await assert.rejects(()=>refusesMigration(acceptedSql,'HDU06'),{name:'AssertionError'});
 assert.equal((await operator.query('select helpdesk_auth.schema_version() as version')).rows[0]?.version,'0.19.0');assert.equal((await operator.query("select count(*)::integer as n from helpdesk_core.workspaces where id='71000000-0000-4000-8000-000000000098'")).rows[0]?.n,0);
 const sql=bundle.migrations[12]!.sql.replace('-- SOURCE cg_resource_scope.sql',`INSERT INTO helpdesk_core.workspaces(id,name) VALUES('71000000-0000-4000-8000-000000000099','Rollback sentinel');\nGRANT helpdesk_resource_publisher TO helpdesk_app WITH SET TRUE;\n-- SOURCE cg_resource_scope.sql`);
 await refusesMigration(sql,'HDU06');assert.equal((await operator.query("select count(*)::integer as n from pg_roles where rolname in ('helpdesk_resource_publisher','helpdesk_notification_worker')")).rows[0]?.n,0);
});
test('M05 still refuses preexisting service membership even with the exact bootstrap flags',async()=>{await withDrift({name:'preexisting service',apply:async()=>{await control.query('CREATE ROLE helpdesk_resource_publisher NOLOGIN NOINHERIT');await control.query(grantFlags(role,'helpdesk_operator'));},undo:()=>control.query('DROP ROLE IF EXISTS helpdesk_resource_publisher')},()=>refusesMigration(bundle.migrations[12]!.sql,'HDU04'));});
for(const scope of ['','IN SCHEMA helpdesk_core'])test('M05 refuses '+(scope?'local':'global')+' operator defaults without normalizing them',async()=>{const command=`ALTER DEFAULT PRIVILEGES FOR ROLE helpdesk_operator ${scope}`;await withDrift({name:'operator defaults',apply:()=>control.query(command+' GRANT SELECT ON TABLES TO helpdesk_app'),undo:()=>control.query(command+' REVOKE SELECT ON TABLES FROM helpdesk_app')},()=>refusesMigration(bundle.migrations[12]!.sql,'HDU05'));});
test('non-super M05 promotion adopts only the qualified bootstrap memberships',async()=>{await assertDirectOperator();const prior=(await snapshot()).rows;await operator.query(bundle.migrations[12]!.sql);assert.deepEqual((await snapshot()).rows,prior);const memberships=(await operator.query("select r.rolname as service,u.rolname as member,m.grantor,m.admin_option,m.inherit_option,m.set_option from pg_auth_members m join pg_roles r on r.oid=m.roleid join pg_roles u on u.oid=m.member where r.rolname in ('helpdesk_resource_publisher','helpdesk_notification_worker') order by r.rolname")).rows;assert.deepEqual(memberships,['helpdesk_notification_worker','helpdesk_resource_publisher'].map(service=>({service,member:'helpdesk_operator',grantor:10,admin_option:true,inherit_option:false,set_option:false})));});
const drifts:Drift[]=[
 // PG17 user.c explicitly forbids demoting BOOTSTRAP_SUPERUSERID (0A000).
 // Exercise that real protection; the emitted-query unit protects our extra defence.
 {name:'bootstrap OID10 demotion',postgresProtection:true,apply:()=>assert.rejects(()=>control.query('ALTER ROLE postgres NOSUPERUSER'),{code:'0A000'}),undo:async()=>{assert.equal((await control.query('select rolsuper from pg_roles where oid=10')).rows[0]?.rolsuper,true);}},
 {name:'SET access to service',apply:()=>control.query(grantFlags(role,'helpdesk_operator',{admin:true,inherit:false,set:true})),undo:()=>control.query(grantFlags(role,'helpdesk_operator'))},
 {name:'INHERIT access to service',apply:()=>control.query(grantFlags(role,'helpdesk_operator',{admin:true,inherit:true,set:false})),undo:()=>control.query(grantFlags(role,'helpdesk_operator'))},
 {name:'missing ADMIN flag',apply:()=>control.query(grantFlags(role,'helpdesk_operator',{admin:false,inherit:false,set:false})),undo:()=>control.query(grantFlags(role,'helpdesk_operator'))},
 {name:'additional incoming member',apply:()=>control.query(grantFlags(role,'helpdesk_app')),undo:()=>control.query('REVOKE helpdesk_resource_publisher FROM helpdesk_app')},
 {name:'service is member of another role',apply:()=>control.query('GRANT helpdesk_app TO helpdesk_notification_worker WITH INHERIT FALSE'),undo:()=>control.query('REVOKE helpdesk_app FROM helpdesk_notification_worker')},
 {name:'non-bootstrap superuser grantor',apply:async()=>{
  await control.query('CREATE ROLE helpdesk_fixture_grantor NOLOGIN SUPERUSER NOINHERIT');
  // An independent ADMIN source avoids the prohibited self/grantor cycle.
  await control.query(grantFlags(role,'helpdesk_fixture_grantor'));
  await control.query(grantFlags(role,'helpdesk_operator',{admin:true,inherit:false,set:false},'helpdesk_fixture_grantor'));
  const row=(await control.query("select m.grantor,r.rolsuper,m.admin_option,m.inherit_option,m.set_option from pg_auth_members m join pg_roles r on r.oid=m.grantor where m.roleid='helpdesk_resource_publisher'::regrole and m.member='helpdesk_operator'::regrole and r.rolname='helpdesk_fixture_grantor'")).rows[0];
  assert.ok(row?.rolsuper&&row.grantor!==10);assert.deepEqual([row?.admin_option,row?.inherit_option,row?.set_option],[true,false,false]);
 },undo:async()=>{if((await control.query("select to_regrole('helpdesk_fixture_grantor') as role")).rows[0]?.role){await control.query('REVOKE helpdesk_resource_publisher FROM helpdesk_operator GRANTED BY helpdesk_fixture_grantor');await control.query('REVOKE helpdesk_resource_publisher FROM helpdesk_fixture_grantor CASCADE');await control.query('DROP ROLE helpdesk_fixture_grantor');}}},
 {name:'unqualified schema owner',apply:()=>control.query('ALTER SCHEMA helpdesk_audit OWNER TO postgres'),undo:()=>control.query('ALTER SCHEMA helpdesk_audit OWNER TO helpdesk_operator')},
 {name:'owner missing CREATEROLE',apply:()=>control.query('ALTER ROLE helpdesk_operator NOCREATEROLE'),undo:()=>control.query('ALTER ROLE helpdesk_operator CREATEROLE')},
 {name:'owner missing BYPASSRLS or SUPERUSER',apply:()=>control.query('ALTER ROLE helpdesk_operator NOBYPASSRLS'),undo:()=>control.query('ALTER ROLE helpdesk_operator BYPASSRLS')},
 {name:'extra service column privilege',apply:()=>control.query('GRANT SELECT(name) ON helpdesk_core.workspaces TO helpdesk_resource_publisher'),undo:()=>control.query('REVOKE SELECT(name) ON helpdesk_core.workspaces FROM helpdesk_resource_publisher')},
 {name:'service flag escalation',apply:()=>control.query('ALTER ROLE helpdesk_notification_worker INHERIT'),undo:()=>control.query('ALTER ROLE helpdesk_notification_worker NOINHERIT')},
 ...['','IN SCHEMA helpdesk_core'].map(scope=>({name:(scope?'local':'global')+' defaults drift',apply:()=>control.query(`ALTER DEFAULT PRIVILEGES FOR ROLE helpdesk_operator ${scope} GRANT SELECT ON TABLES TO helpdesk_app`),undo:()=>control.query(`ALTER DEFAULT PRIVILEGES FOR ROLE helpdesk_operator ${scope} REVOKE SELECT ON TABLES FROM helpdesk_app`)}))
];
for(const index of [13,14,15]){
 for(const drift of drifts)test(drift.postgresProtection?'PG17 blocks '+drift.name+' before '+bundle.migrations[index]!.file:bundle.migrations[index]!.file+' refuses '+drift.name,async()=>{const prior=drift.postgresProtection?await snapshot():null;await withDrift(drift,async()=>{if(drift.postgresProtection){assert.deepEqual(await snapshot(),prior);return;}const code=drift.name.startsWith('owner missing')||drift.name==='unqualified schema owner'?'HDU01':drift.name.includes('defaults')?'HDU05':'HDU06';await refusesMigration(bundle.migrations[index]!.sql,code);});});
 test('direct operator promotes '+bundle.migrations[index]!.file+' preserving data',async()=>{await assertDirectOperator();const before=(await snapshot()).rows;await operator.query(bundle.migrations[index]!.sql);assert.deepEqual((await snapshot()).rows,before);});
}
test('app readiness accepts schema 0.23 and exact bootstrap flags with unchanged inventory',async()=>{await assertSafeDatabaseRole(app);await assertSchemaCompatibility(app);await assertDatabaseSecurity(app);const row=(await app.query(DATABASE_SECURITY_QUERY,[JSON.stringify(DATABASE_SECURITY_CONTRACT),[...DATABASE_SECURITY_CONTRACT.schemas]])).rows[0];assert.equal(row?.table_count,53);assert.equal(row?.reserved_roles_ok,true);assert.equal(row?.owner_defaults_ok,true);});
for(const drift of drifts)test(drift.postgresProtection?'PG17 blocks '+drift.name+' while readiness remains healthy':'app readiness refuses '+drift.name,async()=>{await withDrift(drift,async()=>{if(drift.postgresProtection){await assertDatabaseSecurity(app);return;}await assert.rejects(()=>assertDatabaseSecurity(app),{code:'unsafe_database_policies'});if(drift.name.startsWith('owner missing')||drift.name==='unqualified schema owner'){const row=(await app.query(DATABASE_SECURITY_QUERY,[JSON.stringify(DATABASE_SECURITY_CONTRACT),[...DATABASE_SECURITY_CONTRACT.schemas]])).rows[0];assert.equal(row?.reserved_roles_ok,false,'an absent qualified owner cannot make incoming membership UNKNOWN and silently safe');}});await assertDatabaseSecurity(app);});
test('request identity cannot qualify as common owner even after attributes are escalated',async()=>{const schemas=['helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit'];await withDrift({name:'request identity owner',apply:async()=>{await control.query('ALTER ROLE helpdesk_app CREATEROLE BYPASSRLS');for(const schema of schemas)await control.query(`ALTER SCHEMA ${schema} OWNER TO helpdesk_app`);},undo:async()=>{for(const schema of schemas){await control.query(`ALTER SCHEMA ${schema} OWNER TO helpdesk_operator`);await control.query(`REVOKE ALL ON SCHEMA ${schema} FROM helpdesk_app`);await control.query(`GRANT USAGE ON SCHEMA ${schema} TO helpdesk_app`);}await control.query('ALTER ROLE helpdesk_app NOCREATEROLE NOBYPASSRLS');}},async()=>{const row=(await app.query(DATABASE_SECURITY_QUERY,[JSON.stringify(DATABASE_SECURITY_CONTRACT),schemas])).rows[0];assert.equal(row?.owner_defaults_ok,false);await assert.rejects(()=>assertDatabaseSecurity(app),{code:'unsafe_database_policies'});});await assertDatabaseSecurity(app);});
