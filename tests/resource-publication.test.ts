import test from 'node:test';
import assert from 'node:assert/strict';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const now='2026-10-09T12:00:10.123000Z',start='2026-10-09T12:00:00.123000Z',end='2026-10-09T12:01:00.123000Z';
const target=()=>({principalId:id(1),workspaceId:id(2),accountId:id(3),bindingId:id(4),connectionId:id(5),tenantId:'Tenant-A',operation:'tickets.read'});
const ref=(value:string)=>({connectionId:id(5),tenantId:'Tenant-A',type:'work',id:value});
const snapshot=()=>({target:target(),manifestFingerprint:'a'.repeat(64),bindingRevision:'binding-v1',accessRevision:'source-v1',asOf:start,expiresAt:end,state:'active',complete:true,resources:[ref('A'),ref('B')]});
const invalid={code:'resource_publication_invalid'},conflict={code:'resource_publication_conflict'},stale={code:'resource_publication_stale'};
async function api(){
 const path='../src/domain/resource-publication.ts';
 const result=await import(path).catch((e:unknown)=>{if((e as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof result.planResourcePublication,'function','CG03f publication planner is missing');return result;
}
async function plan(value:any=snapshot(),state:any={revision:'0',snapshot:null},expected='0',time=now,maxAge=60_000_000n){
 return (await api()).planResourcePublication(state,value,expected,time,maxAge);
}
test('CG03f plans complete coverage rather than a ticket selection, without writing or granting',async()=>{
 const result=await plan();assert.equal(result.expectedRevision,'0');assert.equal(result.snapshot.complete,true);
 assert.deepEqual(result.snapshot.resources,[ref('A'),ref('B')]);assert.match(result.snapshotHash,/^[0-9a-f]{64}$/);
 assert.equal(Object.hasOwn(result,'approved'),false);assert.equal(Object.hasOwn(result,'nextRevision'),false);
});
test('CG03f full coverage supports 1000 resources without the 100-ticket-selection truncation',async()=>{
 const input=snapshot();input.resources=Array.from({length:1000},(_,i)=>ref(String(i).padStart(4,'0')));
 assert.equal((await plan(input)).snapshot.resources.length,1000);
});
test('CG03f explicit empty coverage grants nothing, never global access',async()=>{
 const input=snapshot();input.resources=[];assert.deepEqual((await plan(input)).snapshot.resources,[]);
 input.state='revoked';assert.equal((await plan(input)).snapshot.state,'revoked');
});
test('CG03f revocation with residual resources is rejected rather than partially adopted',async()=>{
 const input=snapshot();input.state='revoked';await assert.rejects(plan(input),invalid);
});
test('CG03f candidate and current inputs are detached and recursively immutable in the plan',async()=>{
 const input=snapshot(),result=await plan(input);const before=JSON.stringify(result);
 input.resources[0]!.id='C';input.target.accountId=id(99);assert.equal(JSON.stringify(result),before);
 for(const v of [result,result.target,result.snapshot,result.snapshot.target,result.snapshot.resources,result.snapshot.resources[0]])assert.equal(Object.isFrozen(v),true);
});
test('CG03f resource order and equivalent UTC representations do not change the content hash',async()=>{
 const a=snapshot(),b=snapshot();b.resources.reverse();b.asOf=b.asOf.replace('123000','123');b.expiresAt=b.expiresAt.replace('123000','123');
 assert.equal((await plan(a)).snapshotHash,(await plan(b)).snapshotHash);
});
test('CG03f precise timestamps bind the plan hash without rounding one microsecond',async()=>{
 const a=snapshot(),b=snapshot();b.asOf=b.asOf.replace('123000','123001');
 assert.notEqual((await plan(a)).snapshotHash,(await plan(b)).snapshotHash);
});
test('CG03f local revision uses exact decimal bigint beyond Number safe precision',async()=>{
 const state={revision:'9007199254740993',snapshot:snapshot()};
 assert.equal((await plan(snapshot(),state,state.revision)).expectedRevision,state.revision);
 await assert.rejects(plan(snapshot(),state,'9007199254740992'),conflict);
});
for(const revision of ['01','-1','1.0','1e3','9223372036854775808',1,null])test('CG03f rejects malformed local revision '+String(revision),async()=>{
 await assert.rejects(plan(snapshot(),{revision:'0',snapshot:null},revision as any),invalid);
});
test('CG03f outdated expected revision rejects a late publisher without silently rebasing',async()=>{
 await assert.rejects(plan(snapshot(),{revision:'2',snapshot:snapshot()},'1'),conflict);
});
test('CG03f revision zero and absent snapshot must agree',async()=>{
 await assert.rejects(plan(snapshot(),{revision:'0',snapshot:snapshot()}),invalid);
 await assert.rejects(plan(snapshot(),{revision:'1',snapshot:null},'1'),invalid);
});
test('CG03f cannot publish at the exhausted PostgreSQL bigint revision',async()=>{
 await assert.rejects(plan(snapshot(),{revision:'9223372036854775807',snapshot:snapshot()},'9223372036854775807'),conflict);
});
test('CG03f an older observation cannot overwrite a later state even with the expected local revision',async()=>{
 const current=snapshot();current.asOf=current.asOf.replace('123000','123001');
 await assert.rejects(plan(snapshot(),{revision:'3',snapshot:current},'3'),stale);
});
test('CG03f same source revisions cannot describe different complete resources',async()=>{
 const newer=snapshot();newer.asOf='2026-10-09T12:00:01.123000Z';newer.resources=[ref('A')];
 await assert.rejects(plan(newer,{revision:'3',snapshot:snapshot()},'3'),conflict);
});
test('CG03f same source revisions cannot change active state to revoked',async()=>{
 const newer=snapshot();newer.asOf='2026-10-09T12:00:01.123000Z';newer.resources=[];newer.state='revoked';
 await assert.rejects(plan(newer,{revision:'3',snapshot:snapshot()},'3'),conflict);
});
test('CG03f changed opaque revision with later asOf accepts narrowed coverage',async()=>{
 const newer=snapshot();newer.asOf='2026-10-09T12:00:01.123000Z';newer.accessRevision='000-source';newer.resources=[ref('A')];
 assert.equal((await plan(newer,{revision:'3',snapshot:snapshot()},'3')).snapshot.accessRevision,'000-source');
});
test('CG03f same timestamp with different revision is ambiguous and refused',async()=>{
 const input=snapshot();input.accessRevision='source-v2';await assert.rejects(plan(input,{revision:'3',snapshot:snapshot()},'3'),conflict);
});
test('CG03f unchanged coverage with a fresh later observation may renew validity',async()=>{
 const input=snapshot();input.asOf='2026-10-09T12:00:01.123000Z';input.expiresAt='2026-10-09T12:02:00.123000Z';
 assert.equal((await plan(input,{revision:'3',snapshot:snapshot()},'3')).snapshot.expiresAt,'2026-10-09T12:02:00.123Z');
});
for(const field of ['principalId','workspaceId','accountId','bindingId','connectionId','tenantId','operation'])test('CG03f cannot retarget a stored state through '+field,async()=>{
 const current=snapshot();(current.target as any)[field]=field.endsWith('Id')?id(99):field==='operation'?'tickets.write':'Other';
 if(field==='connectionId'||field==='tenantId')for(const r of current.resources)(r as any)[field]=(current.target as any)[field];
 await assert.rejects(plan(snapshot(),{revision:'3',snapshot:current},'3'),conflict);
});
for(const mutate of [(x:any)=>{delete x.complete;},(x:any)=>{x.complete=false;},(x:any)=>{x.resources.push(ref('A'));},(x:any)=>{x.resources.push({...ref('C'),tenantId:'Other'});},(x:any)=>{x.resources=Array(1001).fill(ref('A'));},(x:any)=>{delete x.resources[0];},(x:any)=>{x.clientSecret='do not accept';}])test('CG03f refuses incomplete, partial, duplicate, mixed or extra payload '+String(mutate),async()=>{
 const value=snapshot();mutate(value);await assert.rejects(plan(value),invalid);
});
for(const [field,value] of [['asOf','2026-10-09T12:00:11.123000Z'],['expiresAt',now],['asOf','2026-10-09T11:58:00.123000Z']])test('CG03f observation freshness '+field+' '+value,async()=>{
 const input=snapshot();(input as any)[field!]=value;await assert.rejects(plan(input),stale);
});
test('CG03f accessors and hidden fields are rejected without executing them',async()=>{
 const input=snapshot();let reads=0;Object.defineProperty(input,'accessRevision',{get:()=>{reads++;return 'source-v1';}});
 await assert.rejects(plan(input),invalid);assert.equal(reads,0);
 const second=snapshot();Object.defineProperty(second.resources[0],'toJSON',{value:()=>{reads++;return ref('A');}});
 await assert.rejects(plan(second),invalid);assert.equal(reads,0);
});
test('CG03f same-size replacement does not let revoked resource names be reused silently',async()=>{
 const input=snapshot();input.resources=[ref('A'),ref('C')];input.asOf='2026-10-09T12:00:01.123000Z';
 await assert.rejects(plan(input,{revision:'3',snapshot:snapshot()},'3'),conflict);
});
