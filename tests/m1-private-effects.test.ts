import test from 'node:test';
import assert from 'node:assert/strict';
const modulePath='./fixtures/postgres-acceptance-effects.ts';
const collections=['tickets','messages','notes','events','outbox','receipts','audit','effects'] as const;
const workspace='00000000-0000-4000-8000-000000000001';
const snapshot=()=>Object.fromEntries(collections.map((name,i)=>[name,[{workspace_id:workspace,id:`row-${i}`,body:'SYNTHETIC_PRIVATE_MARKER'}]]));
for(const collection of collections)test(`private effects refuses persistent changes in ${collection} without exposing values`,async()=>{
 const {assertNoWorkspaceEffects}=await import(modulePath);
 const before=snapshot(),after=structuredClone(before);after[collection]![0]!.body='UNEXPECTED_PRIVATE_VALUE';
 assert.throws(()=>assertNoWorkspaceEffects(before,after),error=>error instanceof Error&&error.message==='Unexpected persistent workspace effects.'&&!error.message.includes('PRIVATE'));
});
test('private effects accepts identical snapshots despite JSON field and row order',async()=>{
 const {assertNoWorkspaceEffects}=await import(modulePath);const before=snapshot();
 before.tickets!.push({workspace_id:workspace,id:'another',body:'other'});
 const after=Object.fromEntries(Object.entries(before).reverse().map(([k,rows])=>[k,rows.slice().reverse().map(row=>Object.fromEntries(Object.entries(row).reverse()))]));
 assert.doesNotThrow(()=>assertNoWorkspaceEffects(before,after));
});
for(const corruption of ['missing','additional','duplicate'] as const)test(`private effects refuses equally ${corruption} collections`,async()=>{
 const {assertNoWorkspaceEffects}=await import(modulePath);const data:Record<string,unknown>=snapshot();
 if(corruption==='missing')delete data.notes;
 if(corruption==='additional')data.unexpected=[];
 if(corruption==='duplicate')(data.messages as unknown[]).push((data.messages as unknown[])[0]);
 assert.throws(()=>assertNoWorkspaceEffects(data,data),/Invalid private effect snapshot/);
});
test('private snapshot uses one parameterized SELECT and refuses malformed results',async()=>{
 const {readWorkspaceEffects}=await import(modulePath);const calls:{sql:string;values:unknown[]|undefined}[]=[];
 const query=async(sql:string,values?:unknown[])=>{calls.push({sql,values});return {command:'SELECT',rowCount:1,rows:[{snapshot:snapshot()}]};};
 const actual=await readWorkspaceEffects({query},workspace);
 assert.equal(calls.length,1);assert.deepEqual(calls[0]!.values,[workspace]);
 assert.ok(/^SELECT jsonb_build_object\(/.test(calls[0]!.sql));
 assert.equal((calls[0]!.sql.match(/workspace_id=\$1::uuid/g)??[]).length,8);
 assert.equal(Object.keys(actual).length,8);
 await assert.rejects(()=>readWorkspaceEffects({query:async()=>({command:'SELECT',rowCount:1,rows:[{snapshot:{}}]})},workspace),/Invalid private effect snapshot/);
});
test('private snapshot rejects an invalid workspace before querying and hides provider errors',async()=>{
 const {readWorkspaceEffects}=await import(modulePath);let calls=0;
 const query=async()=>{calls++;throw Error('PRIVATE_PROVIDER_DETAILS');};
 await assert.rejects(()=>readWorkspaceEffects({query},'not-a-uuid'),/Invalid test workspace/);assert.equal(calls,0);
 await assert.rejects(()=>readWorkspaceEffects({query},workspace),error=>error instanceof Error&&error.message==='Private effect observation failed.');
});
