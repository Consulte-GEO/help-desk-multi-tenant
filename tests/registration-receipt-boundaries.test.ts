/** Application and adapter regressions; in-memory transport, NOT SQL proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {executeRegistrationCommand} from '../src/application/registration-persistence.ts';
import {createPostgresRegistrationStore} from '../src/infrastructure/registration-store.ts';
import {createRegistrationInputSnapshot} from '../src/domain/registration-contracts.ts';
import {transactionModel} from './fixtures/registration/transaction-model.ts';
import {id,input,output} from './fixtures/registration/sample.ts';
const config={agentVersionRef:'fixture.v1',knowledgeRefs:[],policyVersion:'policy.v1'};
const prepare=()=>({type:'prepare',commandId:id(50),snapshot:createRegistrationInputSnapshot(input()),jobId:id(40),configuration:config});
async function prepared(){
 const m=transactionModel();
 const run=(c:any,kind='human')=>m.transaction(m.scope(c.type,kind),tx=>executeRegistrationCommand(tx,m.scope(c.type,kind) as any,c));
 await run(prepare());return {m,run};
}
const claim=()=>({type:'claim',commandId:id(51),leaseSeconds:60});
for(const action of ['claim','complete','fail'] as const)for(const at of ['2026-10-14T12:01:00.000Z','2026-10-14T12:01:00.001Z']){
 test(`${action} rejects ACK recorded at/past lease deadline ${at}`,async()=>{
  const {m,run}=await prepared();let c:any=claim();
  if(action!=='claim'){
   await run(claim(),'analyzer');
   const st=m.inspect().operations.get(id(10))!.state;
   c={type:action,commandId:id(52),operationId:id(10),expectedRevision:2,jobId:id(40),leaseId:id(51),fence:1,...(action==='complete'?{output:output(st.job)}:{reason:'offline'})};
  }
  const before=m.inspect();m.setBadAck(r=>({...r,recordedAt:at}));
  await assert.rejects(run(c,'analyzer'),(e:any)=>e.code==='registration_ack_invalid');
  assert.deepEqual(m.inspect(),before,'rejected validation must roll back the staged command');
 });
}
test('ACK immediately before the lease deadline remains admissible',async()=>{
 const {m,run}=await prepared();m.setBadAck(r=>({...r,recordedAt:'2026-10-14T12:00:59.999Z'}));
 const result=await run(claim(),'analyzer');assert.equal(result.outcome,'applied');assert.equal(result.lease?.expiresAt,'2026-10-14T12:01:00.000Z');
});
test('historical claim replay after lease expiry returns metadata without a lease',async()=>{
 const {m,run}=await prepared();const first=await run(claim(),'analyzer');m.advance(61000);
 const replay=await run(claim(),'analyzer');assert.equal(replay.outcome,'replay');assert.equal(replay.lease,null);assert.deepEqual(replay.receipt,first.receipt);
});
async function receiptFixture(){
 const {run}=await prepared();const r=await run(prepare());const p={workspaceId:id(1),accountId:id(2),actorId:id(20),bindingId:id(30),permission:'prepare'} as const;
 const s={...p,actorKind:'human',bindingRevision:1,targetHash:prepare().snapshot.targetHash,ticketId:id(11),databaseNow:'2026-10-14T12:00:01.000Z',expiresAt:'2026-10-14T13:00:00.000Z'};
 return {p,s,r:r.receipt!};
}
for(const mutation of ['permission','expiry'] as const)test(`direct receipt reader rejects ${mutation} mismatch and poisons store`,async()=>{
 const {p,s,r}=await receiptFixture();let rejected=0,queries=0;
 const altered={...r,...(mutation==='permission'?{permission:'cancel'}:{recordedAt:s.expiresAt})};const rows:any[]=[s,altered];
 const store=createPostgresRegistrationStore({query:async()=>{queries++;return {command:'SELECT',rowCount:1,rows:[{result:rows.shift()}]};},release:()=>assert.fail()},
 {workspaceId:p.workspaceId,id:p.actorId},{assertCurrent:()=>{},reject:(e):never=>{rejected++;throw e;}});
 await store.lockScope(p);await assert.rejects(store.readReceipt(id(50)),(e:any)=>e.code==='registration_storage_unavailable');
 assert.equal(rejected,1);await assert.rejects(store.lockOperation(id(10)));assert.equal(queries,2);
});
test('a historical receipt predating the current scope is still a valid replay observation',async()=>{
 const {p,s,r}=await receiptFixture();const rows:any[]=[s,r];
 const store=createPostgresRegistrationStore({query:async()=>({command:'SELECT',rowCount:1,rows:[{result:rows.shift()}]}),release:()=>assert.fail()},
 {workspaceId:p.workspaceId,id:p.actorId},{assertCurrent:()=>{},reject:(e):never=>{throw e;}});
 await store.lockScope(p);assert.deepEqual(await store.readReceipt(id(50)),r);
});
for(const action of ['claim','complete','fail'] as const)test(`direct apply also refuses ${action} ACK at the lease boundary`,async()=>{
 const {m,run}=await prepared();let c:any=claim();
 if(action!=='claim'){
  await run(claim(),'analyzer');const st=m.inspect().operations.get(id(10))!.state;
  c={type:action,commandId:id(52),operationId:id(10),expectedRevision:2,jobId:id(40),leaseId:id(51),fence:1,...(action==='complete'?{output:output(st.job)}:{reason:'offline'})};
 }
 const old=m.inspect().operations.get(id(10))!;const result=await run(c,'analyzer');
 const write=m.evidence.filter(e=>e.name==='apply').at(-1)!.args;
 const p=m.scope(action,'analyzer') as any;
 const s={...p,actorKind:'analyzer',bindingRevision:1,targetHash:prepare().snapshot.targetHash,ticketId:id(11),databaseNow:'2026-10-14T12:00:00.000Z',expiresAt:'2026-10-14T13:00:00.000Z'};
 const rows:any[]=[s,{...old,databaseNow:s.databaseNow},{...result.receipt,recordedAt:'2026-10-14T12:01:00.000Z'}];let rejected=false;
 const store=createPostgresRegistrationStore({query:async()=>({command:'SELECT',rowCount:1,rows:[{result:rows.shift()}]}),release:()=>assert.fail()},
 {workspaceId:p.workspaceId,id:p.actorId},{assertCurrent:()=>{},reject:(e):never=>{rejected=true;throw e;}});
 await store.lockScope(p);await store.lockOperation(id(10));await assert.rejects(store.apply(write),(e:any)=>e.code==='registration_storage_unavailable');assert.equal(rejected,true);
});
