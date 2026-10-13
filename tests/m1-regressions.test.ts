import {DATABASE_SECURITY_CONTRACT} from '../src/infrastructure/database-security-contract.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {principal,coverage} from './fixtures.ts';
import type {UnitOfWork} from '../src/application/ports.ts';
import {assertSafeDatabaseRole} from '../src/infrastructure/postgres.ts';
import {validateRuntimeConfig} from '../src/infrastructure/runtime.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';

const input={accountId:'account-a',productInstanceId:'geolab-production',serviceCode:'SUPPORT',subject:'Teste M1',description:'Descrição de teste',priority:'normal' as const};
const clock=()=>new Date('2026-09-15T12:00:00Z');
const key='m1-regression-create-001';

test('creation replay reauthorizes the ticket even with a previously resolved principal',async()=>{
 const db=new MemoryUnitOfWork({coverages:[coverage()]});
 const svc=new HelpdeskService(db,clock);
 await svc.create(principal(),input,key,'req');
 const revoked:UnitOfWork={run:(p,work)=>db.run(p,s=>work({...s,getTicket:async()=>null}))};
 const staleRequest=new HelpdeskService(revoked,clock);
 await assert.rejects(()=>staleRequest.create(principal(),input,key,'req'),{code:'resource_not_found'});
 assert.equal(db.snapshot().tickets.length,1);
});

test('expired idempotency tombstone cannot replay its stored body or create a new ticket',async()=>{
 const db=new MemoryUnitOfWork({coverages:[coverage()]});
 await new HelpdeskService(db,clock).create(principal(),input,key,'req');
 const expired:UnitOfWork={run:(p,work)=>db.run(p,s=>work({...s,getIdempotency:async(op,k)=>{
  const value=await s.getIdempotency(op,k);return value?{...value,expired:true}:null;
 }}))};
 await assert.rejects(()=>new HelpdeskService(expired,clock).create(principal(),input,key,'req'),{code:'idempotency_expired'});
 assert.equal(db.snapshot().tickets.length,1);
});

const role={name:'helpdesk_app',login_name:'helpdesk_app',superuser:false,bypass_rls:false,owns_tables:false,owns_objects:false,create_role:false,create_database:false,replication:false,member_of_roles:false};
function poolFor(row:Record<string,unknown>):SqlPool{return {query:async()=>({rows:[row],rowCount:1}),connect:async()=>{throw Error('not needed');},end:async()=>{}};}
for(const property of ['create_role','create_database','replication','member_of_roles','owns_objects']){
 test(`database guard rejects ${property} privilege`,async()=>{
  await assert.rejects(()=>assertSafeDatabaseRole(poolFor({...role,[property]:true})),{code:'unsafe_database_role'});
 });
}
test('SET ROLE from an administrator is not a restricted authenticated connection',async()=>{
 await assert.rejects(()=>assertSafeDatabaseRole(poolFor({...role,login_name:'postgres'})),{code:'unsafe_database_role'});
});
const config={databaseUrl:'postgresql://helpdesk_app:example@pooler.invalid:6543/postgres',supabaseUrl:'https://xaelbntjnvztznnpcvtm.supabase.co',publishableKey:'sb_publishable_example',releaseApproved:'true',rateLimitHmacKey:'a'.repeat(43)};
for(const suffix of ['?uselibpqcompat=true','?options=-c%20row_security%3Doff','#fragment']){
 test(`connection URL rejects ambiguous override ${suffix}`,()=>{
  assert.throws(()=>validateRuntimeConfig({...config,databaseUrl:config.databaseUrl+suffix}));
 });
}
test('production requires a server-only rate-limit HMAC key',()=>{
 assert.throws(()=>validateRuntimeConfig({...config,rateLimitHmacKey:undefined}),{code:'rate_limit_configuration_required'});
});

// Runtime must not boot a v0.2 API against an earlier or partially applied schema.
test('schema compatibility rejects missing or mismatched database version',async()=>{
 const {assertSchemaCompatibility}=await import('../src/infrastructure/postgres.ts');
 assert.equal(typeof assertSchemaCompatibility,'function');
 for(const value of [undefined,'0.1.0','0.2.0','0.5.0','0.8.0','0.9.0','0.16.0','999.0.0'])await assert.rejects(()=>assertSchemaCompatibility(poolFor({version:value})),{code:'schema_version_mismatch'});
 await assertSchemaCompatibility(poolFor({version:'0.21.0'}));
});

test('cache denied by database cannot return even metadata from the old response',async()=>{
 const db=new MemoryUnitOfWork({coverages:[coverage()]});
 await new HelpdeskService(db,clock).create(principal(),input,key,'req');
 const denied:UnitOfWork={run:(p,work)=>db.run(p,s=>work({...s,getIdempotency:async(op,k)=>{const old=await s.getIdempotency(op,k);return old?{...old,denied:true}:null;}}))};
 await assert.rejects(()=>new HelpdeskService(denied,clock).create(principal(),input,key,'req'),{code:'resource_not_found'});
});
test('PostgreSQL cache lookup uses resource-aware helper, not unrestricted saved responses',async()=>{
 const {PostgresUnitOfWork}=await import('../src/infrastructure/postgres.ts');const calls:string[]=[];
 const query=async(sql:string)=>{calls.push(sql);return {command:sql.split(' ')[0]?.toUpperCase(),rows:sql.includes('lookup_idempotency')?[{record:{denied:true}}]:[],rowCount:0};};
 const pool:SqlPool={query,connect:async()=>({query,release(){}}),end:async()=>{}};
 const record=await new PostgresUnitOfWork(pool).run(principal(),s=>s.getIdempotency('tickets.create',key));
 assert.equal(record?.denied,true);assert.ok(calls.some(sql=>sql.includes('helpdesk_auth.lookup_idempotency')));
});

test('write-only scope cannot open a ticket without the read permission required by SQL',async()=>{
 const service=new HelpdeskService(new MemoryUnitOfWork({coverages:[coverage()]}),clock);
 await assert.rejects(()=>service.create(principal({scopes:['tickets:write']}),input,key,'req'),{code:'forbidden'});
});
test('runtime security readiness requires FORCE RLS and non-exposed private schemas',async()=>{
 const {assertDatabaseSecurity}=await import('../src/infrastructure/postgres.ts');assert.equal(typeof assertDatabaseSecurity,'function');
 const good={table_count:DATABASE_SECURITY_CONTRACT.tables.length,unsafe_tables:0,public_schema_access:false,client_schema_access:false,public_helper_execute:false,schema_contract_ok:true,table_contract_ok:true,table_privileges_ok:true,column_privileges_ok:true,client_object_privileges_ok:true,helper_contract_ok:true,helper_privileges_ok:true,helper_settings_ok:true,trigger_contract_ok:true,constraint_contract_ok:true,index_contract_ok:true,policy_contract_ok:true,execution_settings_ok:true,reserved_roles_ok:true};
 await assertDatabaseSecurity(poolFor(good));
 for(const change of [{table_count:22},{unsafe_tables:1},{public_schema_access:true},{client_schema_access:true},{public_helper_execute:true}])
  await assert.rejects(()=>assertDatabaseSecurity(poolFor({...good,...change})),{code:'unsafe_database_policies'});
});
