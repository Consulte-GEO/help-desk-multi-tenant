import test from 'node:test';import assert from 'node:assert/strict';
import {assertRuntimeDatabase} from '../src/infrastructure/authentication-database.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';
const closed={authenticationOnly:true,administration:false,workflow:false,intake:false};
function fixture(version='0.19.0',unsafe=false){let catalogs=0;const pool:SqlPool={async connect(){throw Error('unexpected connection');},async end(){},async query(sql,values){
 if(sql.includes('login_name'))return {rows:[{name:'helpdesk_app',login_name:unsafe?'postgres':'helpdesk_app',superuser:false,bypass_rls:false,create_role:false,create_database:false,replication:false,member_of_roles:false,owns_tables:false,owns_objects:false}],command:'SELECT',rowCount:1} as any;
 if(sql.includes('schema_version()'))return {rows:[{version}],command:'SELECT',rowCount:1} as any;
 const contract=JSON.parse(String(values?.[0]));catalogs++;assert.equal(contract.schemaVersion,version);assert.equal(contract.tables.length,version==='0.19.0'?25:53);
 const row:Record<string,unknown>={table_count:contract.tables.length,unsafe_tables:0,public_schema_access:false,client_schema_access:false,public_helper_execute:false};for(const key of ['schema_contract_ok','table_contract_ok','table_privileges_ok','column_privileges_ok','client_object_privileges_ok','helper_contract_ok','helper_privileges_ok','helper_settings_ok','trigger_contract_ok','constraint_contract_ok','index_contract_ok','policy_contract_ok','execution_settings_ok','reserved_roles_ok'])row[key]=true;
 return {rows:[row],command:'SELECT',rowCount:1} as any;
 }};return {pool,catalogs:()=>catalogs};}
test('closed hosted authentication accepts the complete qualified 0.19 database',async()=>{const f=fixture();await assertRuntimeDatabase(f.pool,closed);assert.equal(f.catalogs(),1);});
for(const mode of [{...closed,authenticationOnly:false},{...closed,administration:true},{...closed,workflow:true},{...closed,intake:true}])test('legacy database cannot serve enabled operation '+JSON.stringify(mode),async()=>{const f=fixture();await assert.rejects(()=>assertRuntimeDatabase(f.pool,mode),{code:'schema_version_mismatch'});assert.equal(f.catalogs(),0);});
test('legacy authentication still refuses a privileged or impersonated database identity',async()=>{const f=fixture('0.19.0',true);await assert.rejects(()=>assertRuntimeDatabase(f.pool,closed),{code:'unsafe_database_role'});assert.equal(f.catalogs(),0);});
test('current 0.23 database keeps the complete current security contract',async()=>{const f=fixture('0.23.0');await assertRuntimeDatabase(f.pool,closed);assert.equal(f.catalogs(),1);});
test('unrecognized database schema is never adopted for authentication',async()=>{const f=fixture('0.18.0');await assert.rejects(()=>assertRuntimeDatabase(f.pool,closed),{code:'schema_version_mismatch'});assert.equal(f.catalogs(),0);});
