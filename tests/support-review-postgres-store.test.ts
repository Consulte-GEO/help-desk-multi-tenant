import test from 'node:test';import assert from 'node:assert/strict';
import {runTransaction} from '../src/infrastructure/transaction.ts';
import type {SqlClient,SqlPool,SqlResult} from '../src/infrastructure/sql.ts';
import type {Principal} from '../src/domain/model.ts';
import type {ReviewTransaction} from '../src/application/support-review.ts';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const p:Principal={id:id(2),workspaceId:id(1),kind:'human',workspaceRole:null,grants:[{accountId:id(3),role:'agent'}],scopes:['tickets:read','tickets:write']};
async function factory(){const path='../src/infrastructure/support-review-store.ts';const m=await import(path).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});assert.equal(typeof m.createPostgresSupportReviewStore,'function','durable review store missing');return m.createPostgresSupportReviewStore as (c:SqlClient,p:Principal)=>ReviewTransaction;}
function fixture(response:SqlResult={command:'SELECT',rowCount:1,rows:[{result:null}]}){
 const calls:{sql:string;values:unknown[]}[]=[];
 const client:SqlClient={async query(sql,values=[]){calls.push({sql,values});if(sql.startsWith('select helpdesk_auth.hdnr_'))return response;return {command:sql==='BEGIN'?'BEGIN':sql==='COMMIT'?'COMMIT':sql==='ROLLBACK'?'ROLLBACK':'SELECT',rowCount:0,rows:[]};},release(){}};
 const pool:SqlPool={connect:async()=>client,query:async()=>{throw Error('no pool escape');},end:async()=>{}};
 return {client,pool,calls,async read(){const create=await factory();return runTransaction(pool,p,c=>create(c,p).readAggregate(id(20)));}};
}
test('review store cannot use a client outside its owning identity transaction',async()=>{const f=fixture(),create=await factory();await assert.rejects(()=>create(f.client,p).readAggregate(id(20)),{code:'transaction_identity_changed'});assert.equal(f.calls.length,0);});
test('review store represents genuine absence without inventing a policy or ticket',async()=>{const f=fixture();assert.equal(await f.read(),null);assert.ok(f.calls.some(c=>c.sql==='COMMIT'));});
for(const response of [{command:'SELECT',rowCount:0,rows:[]},{command:'SELECT',rowCount:2,rows:[{result:null},{result:null}]},{command:'SELECT',rowCount:1,rows:[{result:null,body:'private'}]},{command:'UPDATE',rowCount:1,rows:[{result:null}]}])test('review store malformed native result aborts the borrowed transaction '+JSON.stringify(response),async()=>{const f=fixture(response);await assert.rejects(f.read());assert.ok(f.calls.some(c=>c.sql==='ROLLBACK'));assert.ok(!f.calls.some(c=>c.sql==='COMMIT'));});
test('review store rejects a native envelope for a different principal',async()=>{const f=fixture({command:'SELECT',rowCount:1,rows:[{result:{principalId:id(99),aggregate:{}}}]});await assert.rejects(f.read());assert.ok(f.calls.some(c=>c.sql==='ROLLBACK'));});
test('review store maps native refusal without leaking SQL or credentials',async()=>{const f=fixture();const original=f.client.query;f.client.query=async(sql,values)=>{if(sql.startsWith('select helpdesk_auth.hdnr_'))throw Object.assign(Error('postgres://private:password@internal'),{code:'HDR01'});return original(sql,values);};await assert.rejects(f.read(),(e:any)=>e.code==='approval_forbidden'&&!String(e).includes('password'));assert.ok(f.calls.some(c=>c.sql==='ROLLBACK'));});
