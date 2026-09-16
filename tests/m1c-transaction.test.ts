import test from 'node:test';
import assert from 'node:assert/strict';
import * as postgres from '../src/infrastructure/postgres.ts';
import type {SqlPool, SqlClient, SqlResult} from '../src/infrastructure/sql.ts';
import {principal} from './fixtures.ts';

type Reply = SqlResult & {command?:string};
function harness(change:(sql:string)=>Reply|undefined=()=>undefined) {
 const calls:{sql:string;values:unknown[]}[]=[],releases:(Error|undefined)[]=[];
 const client:SqlClient={query:async(sql,values=[])=>{
  calls.push({sql,values});return change(sql)??{rows:[],rowCount:null,command:sql.split(' ')[0]!.toUpperCase()};
 },release:error=>{releases.push(error);}};
 const raw:SqlPool={connect:async()=>client,query:async()=>{throw Error('Do not use raw pool.query for a transaction');},end:async()=>{}};
 return {raw,calls,releases,client};
}
for(const command of ['ROLLBACK','SELECT',undefined]) test(`domain result is not successful when COMMIT command is ${String(command)}`,async()=>{
 const h=harness(sql=>sql==='COMMIT'?{rows:[],rowCount:null,command}:undefined);
 await assert.rejects(()=>new postgres.PostgresUnitOfWork(h.raw).run(principal(),async()=>({created:true})),{status:503});
 assert.ok(h.releases[0] instanceof Error);
 assert.equal(h.calls.filter(c=>c.sql==='COMMIT').length,1);
});
test('lost commit acknowledgement discards the connection even if rollback later succeeds',async()=>{
 const h=harness(sql=>{if(sql==='COMMIT')throw Object.assign(Error('password at internal-host'),{code:'ECONNRESET'});return undefined;});
 let writes=0;
 await assert.rejects(()=>new postgres.PostgresUnitOfWork(h.raw).run(principal(),async()=>{writes++;return 1;}),{status:503,code:'transaction_outcome_unknown'});
 assert.equal(writes,1);assert.ok(h.releases[0] instanceof Error);assert.doesNotMatch(h.releases[0]!.message,/password|internal-host/);
});
test('a rollback tag is required before reusing a connection after callback failure',async()=>{
 const h=harness(sql=>sql==='ROLLBACK'?{rows:[],rowCount:null,command:'SELECT'}:undefined);
 const failure=Error('application rejected');
 await assert.rejects(()=>new postgres.PostgresUnitOfWork(h.raw).run(principal(),async()=>{throw failure;}),e=>e===failure);
 assert.ok(h.releases[0] instanceof Error);
});
test('confirmed commit returns its value, once, after the commit is received',async()=>{
 const h=harness();const value=await new postgres.PostgresUnitOfWork(h.raw).run(principal(),async()=>17);
 assert.equal(value,17);assert.equal(h.calls.at(-1)?.sql,'COMMIT');assert.deepEqual(h.releases,[undefined]);
});
test('confirmed rollback preserves the original failure and never commits',async()=>{
 const h=harness();const failure=Error('domain rejected');
 await assert.rejects(()=>new postgres.PostgresUnitOfWork(h.raw).run(principal(),async()=>{throw failure;}),e=>e===failure);
 assert.equal(h.calls.at(-1)?.sql,'ROLLBACK');assert.equal(h.calls.some(c=>c.sql==='COMMIT'),false);assert.deepEqual(h.releases,[undefined]);
});
function control(raw:SqlPool):SqlPool {
 const make=(postgres as unknown as Record<string,unknown>).withControlTransactions;
 assert.equal(typeof make,'function','control SQL queries require a bounded same-connection transaction');
 return (make as (pool:SqlPool)=>SqlPool)(raw);
}
test('control query uses the same connection and empties both context selectors locally',async()=>{
 const h=harness(sql=>sql==='select private_helper($1)'?{rows:[{answer:42}],rowCount:1,command:'SELECT'}:undefined);
 const r=await control(h.raw).query('select private_helper($1)',['payload']);
 assert.equal(r.rows[0]?.answer,42);assert.equal(h.calls[0]?.sql,'BEGIN');assert.equal(h.calls.at(-1)?.sql,'COMMIT');
 const settings=h.calls.find(c=>c.sql.includes('statement_timeout'));assert.ok(settings);
 assert.deepEqual(settings.values,['','']);assert.match(settings.sql,/set_config\('app\.workspace_id',\$1,true\)/);
 assert.match(settings.sql,/set_config\('app\.principal_id',\$2,true\)/);assert.match(settings.sql,/set_config\('transaction_timeout','15000',true\)/);
 assert.equal(h.calls.filter(c=>c.sql==='select private_helper($1)').length,1);
});
test('control query timeout rolls back and returns the database failure for safe HTTP mapping',async()=>{
 const failure=Object.assign(Error('raw SQL query'),{code:'57014'});const h=harness(sql=>{if(sql==='select pg_sleep(99)')throw failure;return undefined;});
 await assert.rejects(()=>control(h.raw).query('select pg_sleep(99)'),e=>e===failure);
 assert.equal(h.calls.at(-1)?.sql,'ROLLBACK');assert.deepEqual(h.releases,[undefined]);
});
test('wrapping control queries does not start nested domain transactions',async()=>{
 const h=harness();await new postgres.PostgresUnitOfWork(control(h.raw)).run(principal(),async()=>1);
 assert.equal(h.calls.filter(c=>c.sql==='BEGIN').length,1);
});
test('failed control query connection acquisition does not run business work',async()=>{
 let queried=false;const pool:SqlPool={query:async()=>{queried=true;return {rows:[],rowCount:0};},connect:async()=>{throw Error('secret');},end:async()=>{}};
 await assert.rejects(()=>control(pool).query('select 1'),{status:503,code:'database_unavailable'});assert.equal(queried,false);
});
