import test from 'node:test';
import assert from 'node:assert/strict';
import {runTransaction} from '../src/infrastructure/transaction.ts';
import {HelpdeskError} from '../src/domain/errors.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';

const denied={status:403,code:'transaction_identity_changed'};
const refused=()=>new HelpdeskError(403,'scope_no_longer_current','Synthetic scope refusal');
const identity=()=>({workspaceId:'workspace-A',id:'person-A'});
function fixture(hook?:(sql:string)=>Promise<void>|void,acquire?:()=>Promise<void>){
 const calls:{sql:string;values:unknown[]|undefined}[]=[],releases:unknown[]=[];
 const pool:SqlPool={connect:async()=>{await acquire?.();return {
  query:async(sql,values)=>{calls.push({sql,values});await hook?.(sql);return {rows:[],rowCount:0,command:sql.startsWith('select')?'SELECT':sql};},
  release:reason=>{releases.push(reason);}
 };},query:async()=>{throw Error('No pool query may bypass the owned connection');},end:async()=>{}};
 return {pool,calls,releases,commands:()=>calls.map(c=>c.sql)};
}
const guarded=runTransaction as (pool:SqlPool,p:ReturnType<typeof identity>|undefined,work:(client:any)=>Promise<any>,guard?:()=>unknown)=>Promise<any>;

test('CG03c mutation while waiting for the pool cannot retarget SQL identity',async()=>{
 const p=identity();let calls=0;
 const f=fixture(undefined,async()=>{p.workspaceId='workspace-B';p.id='person-B';});
 await assert.rejects(runTransaction(f.pool,p,async()=>{calls++;}),denied);
 assert.equal(calls,0);assert.equal(f.calls.length,0);assert.equal(f.releases.length,1);
});
test('CG03c mutation during BEGIN rolls back before setting a different identity',async()=>{
 const p=identity(),f=fixture(sql=>{if(sql==='BEGIN')p.id='person-B';});let calls=0;
 await assert.rejects(runTransaction(f.pool,p,async()=>{calls++;}),denied);
 assert.deepEqual(f.commands(),['BEGIN','ROLLBACK']);assert.equal(calls,0);
});
test('CG03c mutation while installing context cannot enter the business callback',async()=>{
 const p=identity(),f=fixture(sql=>{if(sql.startsWith('select set_config'))p.workspaceId='workspace-B';});
 await assert.rejects(runTransaction(f.pool,p,async()=>assert.fail('business callback')),denied);
 assert.deepEqual(f.calls[1]!.values,['workspace-A','person-A']);assert.equal(f.commands().at(-1),'ROLLBACK');
 assert.equal(f.commands().includes('COMMIT'),false);
});
test('CG03c changes during the callback refuse commit even without another SQL query',async()=>{
 const p=identity(),f=fixture();
 await assert.rejects(runTransaction(f.pool,p,async()=>{p.id='person-B';return 'not committed';}),denied);
 assert.equal(f.commands().at(-1),'ROLLBACK');assert.equal(f.commands().includes('COMMIT'),false);
});
test('CG03c identity accessors are refused without invoking them or acquiring a pool',async()=>{
 let reads=0,acquisitions=0;const p=identity();Object.defineProperty(p,'id',{get:()=>{reads++;return 'person-A';}});
 const f=fixture(undefined,async()=>{acquisitions++;});
 await assert.rejects(runTransaction(f.pool,p,async()=>assert.fail()),denied);
 assert.equal(reads,0);assert.equal(acquisitions,0);
});
test('CG03c guard refusal before acquisition does not borrow a connection',async()=>{
 let acquisitions=0;const f=fixture(undefined,async()=>{acquisitions++;});
 await assert.rejects(guarded(f.pool,identity(),async()=>assert.fail(),()=>{throw refused();}),{code:'scope_no_longer_current'});
 assert.equal(acquisitions,0);assert.equal(f.releases.length,0);
});
test('CG03c expired scope in pool queue releases the client without BEGIN',async()=>{
 let valid=true;const f=fixture(undefined,async()=>{valid=false;});
 await assert.rejects(guarded(f.pool,identity(),async()=>assert.fail(),()=>{if(!valid)throw refused();}),{code:'scope_no_longer_current'});
 assert.equal(f.calls.length,0);assert.equal(f.releases.length,1);
});
test('CG03c guard refusal while installing context rolls back before business work',async()=>{
 let valid=true;const f=fixture(sql=>{if(sql.startsWith('select set_config'))valid=false;});
 await assert.rejects(guarded(f.pool,identity(),async()=>assert.fail(),()=>{if(!valid)throw refused();}),{code:'scope_no_longer_current'});
 assert.equal(f.commands().at(-1),'ROLLBACK');assert.equal(f.commands().includes('COMMIT'),false);
});
test('CG03c expired guarded query never hands its late rows to the callback',async()=>{
 let valid=true,received=false;const f=fixture(sql=>{if(sql==='select private_rows')valid=false;});
 await assert.rejects(guarded(f.pool,identity(),async c=>{await c.query('select private_rows');received=true;},()=>{if(!valid)throw refused();}),{code:'scope_no_longer_current'});
 assert.equal(received,false);assert.equal(f.commands().at(-1),'ROLLBACK');
});
test('CG03c swallowed guard failure poisons the transaction and cannot revive after restore',async()=>{
 let valid=true;const f=fixture();
 await assert.rejects(guarded(f.pool,identity(),async c=>{
  valid=false;await assert.rejects(c.query('select must_not_run'),{code:'scope_no_longer_current'});
  valid=true;await assert.rejects(c.query('select still_must_not_run'),{code:'scope_no_longer_current'});
 },()=>{if(!valid)throw refused();}),{code:'scope_no_longer_current'});
 assert.equal(f.commands().some(s=>s.includes('must_not_run')),false);assert.equal(f.commands().at(-1),'ROLLBACK');
});
test('CG03c asynchronous guard is an invalid admission, never an approval',async()=>{
 const f=fixture();await assert.rejects(guarded(f.pool,identity(),async()=>assert.fail(),async()=>{}),{code:'database_unavailable'});
 assert.equal(f.calls.length,0);
});
test('CG03c arbitrary guard exceptions do not disclose private details',async()=>{
 const f=fixture();await assert.rejects(guarded(f.pool,identity(),async()=>assert.fail(),()=>{throw Error('PRIVATE-TOKEN');}),
  (e:any)=>e.code==='database_unavailable'&&!e.message.includes('PRIVATE'));
});
test('CG03c confirmed COMMIT remains success if local scope expires during acknowledgement',async()=>{
 let valid=true;const f=fixture(sql=>{if(sql==='COMMIT')valid=false;});
 assert.equal(await guarded(f.pool,identity(),async c=>{await c.query('select work');return 7;},()=>{if(!valid)throw refused();}),7);
 assert.equal(f.commands().at(-1),'COMMIT');assert.equal(f.releases.length,1);
});
test('CG03c lost COMMIT remains unknown and is never retried after scope changes',async()=>{
 let valid=true,work=0;const f=fixture(sql=>{if(sql==='COMMIT'){valid=false;throw Error('connection ended');}});
 await assert.rejects(guarded(f.pool,identity(),async()=>{work++;},()=>{if(!valid)throw refused();}),{code:'transaction_outcome_unknown'});
 assert.equal(work,1);assert.equal(f.commands().filter(x=>x==='COMMIT').length,1);assert.equal(f.commands().at(-1),'ROLLBACK');
 assert.ok(f.releases[0] instanceof Error);
});
test('CG03c ordinary transactions and empty control identity preserve existing behavior',async()=>{
 const f=fixture();const p={...identity(),extra:'unchanged domain fields'};
 assert.equal(await runTransaction(f.pool,p,async()=>5),5);assert.deepEqual(f.calls[1]!.values,['workspace-A','person-A']);
 const control=fixture();await runTransaction(control.pool,undefined,async()=>{});assert.deepEqual(control.calls[1]!.values,['','']);
});
