import test from 'node:test';
import assert from 'node:assert/strict';
import {assertRegistrationWorkerDatabase,createRegistrationRuntime,REGISTRATION_WORKER_QUERY} from '../src/infrastructure/registration-runtime.ts';
import {REGISTRATION_SECURITY_CONTRACT,REGISTRATION_SECURITY_QUERY} from '../src/infrastructure/registration-security-contract.ts';
import {EMAIL_MONITOR_SECURITY_CONTRACT,EMAIL_MONITOR_SECURITY_QUERY} from '../src/infrastructure/email-monitor-security-contract.ts';
import {READINESS_FLAGS} from '../src/infrastructure/database-security.ts';
import type {SqlPool,SqlResult} from '../src/infrastructure/sql.ts';

const worker={actor:'helpdesk_registration_worker',login:'helpdesk_registration_worker',role:true,schemas:true,tables:true,helpers:true,auth:true,tls:true,storage:true};
const core=(tables:number)=>({table_count:tables,unsafe_tables:0,public_schema_access:false,client_schema_access:false,public_helper_execute:false,...Object.fromEntries(READINESS_FLAGS.map(k=>[k,true]))});
function database(version:'0.26.0'|'0.27.0'){
 const calls:{sql:string;values:unknown[]}[]=[],controls:{core:Record<string,unknown>;worker:Record<string,unknown>;firstResult:SqlResult|null;firstError:Error|null;ended:number}={core:{},worker:{},firstResult:null,firstError:null,ended:0};
 const pool:SqlPool={async query(sql,values=[]){
  calls.push({sql,values});
  if(sql===REGISTRATION_WORKER_QUERY)return {command:'SELECT',rowCount:1,rows:[{...worker,...controls.worker}]};
  if(sql==='select helpdesk_auth.hda02_worker_target() as target')return {command:'SELECT',rowCount:1,rows:[{target:null}]};
  const contract=JSON.parse(String(values[0]));
  if(contract.schemaVersion==='0.26.0'&&controls.firstError)throw controls.firstError;
  if(contract.schemaVersion==='0.26.0'&&controls.firstResult)return controls.firstResult;
  const expected=version==='0.26.0'?REGISTRATION_SECURITY_CONTRACT:EMAIL_MONITOR_SECURITY_CONTRACT;
  return {command:'SELECT',rowCount:1,rows:[contract.schemaVersion===version?{...core(expected.tables.length),...controls.core}:{...core(expected.tables.length),schema_contract_ok:false}]};
 },async connect(){throw Error('readiness does not acquire arbitrary transactions');},async end(){controls.ended++;}};
 return {pool,calls,controls,versions:()=>calls.filter(c=>c.values.length===2).map(c=>JSON.parse(String(c.values[0])).schemaVersion)};
}
test('HDA keeps its exact qualified schema0.26 path without probing monitor0.27',async()=>{
 const f=database('0.26.0');await assertRegistrationWorkerDatabase(f.pool);assert.deepEqual(f.versions(),['0.26.0']);assert.equal(f.calls.length,2);
});
test('HDA accepts complete monitor0.27 only after the fixed0.26 catalogue fails',async()=>{
 const f=database('0.27.0');await assertRegistrationWorkerDatabase(f.pool);assert.deepEqual(f.versions(),['0.26.0','0.27.0']);assert.equal(f.calls.length,3);
 const monitor=f.calls[1]!;assert.equal(monitor.sql,EMAIL_MONITOR_SECURITY_QUERY.replaceAll('current_user',"'helpdesk_app'"));
 assert.deepEqual(monitor.values,[JSON.stringify(EMAIL_MONITOR_SECURITY_CONTRACT),[...EMAIL_MONITOR_SECURITY_CONTRACT.schemas]]);
 assert.equal(f.calls[0]?.sql,REGISTRATION_SECURITY_QUERY.replaceAll('current_user',"'helpdesk_app'"));
});
test('HDA monitor qualification retains the same seven worker helpers and exact effective ACL query',async()=>{
 const f=database('0.27.0');await assertRegistrationWorkerDatabase(f.pool);
 const original=REGISTRATION_SECURITY_CONTRACT.roles.find(r=>r.name==='helpdesk_registration_worker')!;
 const monitor=EMAIL_MONITOR_SECURITY_CONTRACT.roles.find(r=>r.name==='helpdesk_registration_worker')!;
 assert.equal(original.functions.length,7);assert.deepEqual(monitor,original);
 assert.deepEqual(f.calls.at(-1),{sql:REGISTRATION_WORKER_QUERY,values:[[...original.functions]]});
});
for(const flag of READINESS_FLAGS)test('HDA rejects monitor0.27 catalogue drift: '+flag,async()=>{
 const f=database('0.27.0');f.controls.core[flag]=false;await assert.rejects(assertRegistrationWorkerDatabase(f.pool),{code:'registration_worker_unavailable'});
 assert.equal(f.calls.some(c=>c.sql===REGISTRATION_WORKER_QUERY),false);
});
for(const patch of [{table_count:86},{unsafe_tables:1},{public_schema_access:true},{client_schema_access:true},{public_helper_execute:true}])test('HDA rejects monitor0.27 inventory/exposure drift '+Object.keys(patch)[0],async()=>{
 const f=database('0.27.0');Object.assign(f.controls.core,patch);await assert.rejects(assertRegistrationWorkerDatabase(f.pool),{code:'registration_worker_unavailable'});
 assert.equal(f.calls.some(c=>c.sql===REGISTRATION_WORKER_QUERY),false);
});
for(const patch of [{actor:'helpdesk_app'},{login:'postgres'},...['role','schemas','tables','helpers','auth','tls','storage'].map(k=>({[k]:false}))])test('HDA rejects monitor0.27 worker drift '+Object.keys(patch)[0],async()=>{
 const f=database('0.27.0');Object.assign(f.controls.worker,patch);await assert.rejects(assertRegistrationWorkerDatabase(f.pool),{code:'registration_worker_unavailable'});
 assert.deepEqual(f.versions(),['0.26.0','0.27.0']);
});
test('HDA does not mask malformed catalogue transport with a second-version fallback',async()=>{
 for(const result of [{command:'UPDATE',rowCount:1,rows:[core(86)]},{command:'SELECT',rowCount:0,rows:[]},{command:'SELECT',rowCount:1,rows:[core(86),core(86)]}]){
  const f=database('0.27.0');f.controls.firstResult=result;await assert.rejects(assertRegistrationWorkerDatabase(f.pool),{code:'registration_worker_unavailable'});assert.deepEqual(f.versions(),['0.26.0']);
 }
});
test('HDA catalogue query exceptions stay closed without using remote error text as a version',async()=>{
 const f=database('0.27.0');f.controls.firstError=Error('private schema0.27 credentials');
 await assert.rejects(assertRegistrationWorkerDatabase(f.pool),e=>{assert.equal((e as {code:string}).code,'registration_worker_unavailable');assert.doesNotMatch((e as Error).message,/private|credentials/);return true;});assert.deepEqual(f.versions(),['0.26.0']);
});
test('monitor0.27 keeps HDA runtime idle and requalifies before queue access',async()=>{
 const f=database('0.27.0'),runtime=await createRegistrationRuntime({enabled:'true',releaseApproved:'true',mode:'manual_review',databaseUrl:'postgresql://helpdesk_registration_worker:synthetic@db.example.invalid/db'},{poolFactory:()=>f.pool});
 await runtime.runOnce();assert.deepEqual(f.versions(),['0.26.0','0.27.0','0.26.0','0.27.0']);
 assert.equal(f.calls.filter(c=>c.sql.includes('hda02_worker_target() as target')).length,1);
 f.controls.core.unsafe_tables=1;await assert.rejects(runtime.runOnce(),{code:'registration_worker_unavailable'});
 assert.equal(f.calls.filter(c=>c.sql.includes('hda02_worker_target() as target')).length,1);await runtime.close();assert.equal(f.controls.ended,1);
});
