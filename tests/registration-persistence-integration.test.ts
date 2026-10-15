/** Real service + real SQL adapter; SQL transport is the explicit reference model.
 * This checks composition only, never PostgreSQL semantics or core authentication. */
import test from 'node:test';import assert from 'node:assert/strict';
import {id,input,output} from './fixtures/registration/sample.ts';
import {transactionModel} from './fixtures/registration/transaction-model.ts';
import {executeRegistrationCommand} from '../src/application/registration-persistence.ts';
import {createPostgresRegistrationStore} from '../src/infrastructure/registration-store.ts';
import {createRegistrationInputSnapshot} from '../src/domain/registration-contracts.ts';
import {registrationHash} from '../src/domain/registration-canonical.ts';
const conf={agentVersionRef:'fixture.v1',knowledgeRefs:[],policyVersion:'policy.v1'};
const prepare=()=>({type:'prepare',commandId:id(50),snapshot:createRegistrationInputSnapshot(input()),jobId:id(40),configuration:conf});
function compose(){const m=transactionModel();const queries:string[]=[];return {m,queries,run:(permission:string,command:any,kind='human')=>m.transaction(m.scope(permission,kind),async(tx:any)=>{
 const p=m.scope(permission,kind);const native={query:async(sql:string,values:unknown[]=[])=>{queries.push(sql);const args=values.map((v,i)=>i===0||sql.includes('hda02_apply')?JSON.parse(v as string):v);let result:unknown;
 if(sql.includes('hda02_lock_scope'))result=await tx.lockScope(args[0]);else if(sql.includes('hda02_receipt'))result=await tx.readReceipt(args[1]);else if(sql.includes('hda02_operation'))result=await tx.lockOperation(args[1]);else if(sql.includes('hda02_next'))result=await tx.lockNextOperation();else if(sql.includes('hda02_apply'))result=await tx.apply(args[1]);else assert.fail('unexpected SQL helper');return {command:'SELECT',rowCount:1,rows:[{result}]};},release:()=>assert.fail('borrowed release')};
 const store=createPostgresRegistrationStore(native,{workspaceId:p.workspaceId,id:p.actorId},{assertCurrent:()=>{},reject:tx.reject});return executeRegistrationCommand(store,p as any,command);
 })};}
test('composed service and adapter prepare, claim, complete and replay the original receipt',async()=>{const f=compose();const first=await f.run('prepare',prepare());const claim=await f.run('claim',{type:'claim',commandId:id(51),leaseSeconds:60},'analyzer');assert.equal(claim.lease?.fence,1);const st=f.m.inspect().operations.get(id(10))!;const done=await f.run('complete',{type:'complete',commandId:id(52),operationId:id(10),expectedRevision:2,jobId:id(40),leaseId:id(51),fence:1,output:output(st.state.job)},'analyzer');assert.equal(done.receipt?.status,'draft_ready');const replay=await f.run('prepare',prepare());assert.deepEqual(replay.receipt,first.receipt);assert.equal(replay.lease,null);assert.equal(f.m.inspect().drafts.size,1);assert.ok(f.queries.every(s=>s.startsWith('select helpdesk_auth.hda02_')));});
test('composed store poisons the transaction when an acknowledgement is altered',async()=>{const f=compose();f.m.setBadAck((r:any)=>({...r,stateHash:'0'.repeat(64)}));await assert.rejects(f.run('prepare',prepare()));assert.equal(f.m.inspect().operations.size,0);});
// Direct adapter tests prove it does not depend on its caller validating an ACK.
for(const field of ['workspaceId','accountId','actorId','bindingId','permission','recordedAt'])test(`direct apply refuses wrong receipt ${field}`,async()=>{
 const m=transactionModel();const p=m.scope('prepare');let captured:any;
 await m.transaction(p,async(tx:any)=>{const original=tx.apply;tx.apply=async(write:any)=>{captured=write;return original(write);};return executeRegistrationCommand(tx,p as any,prepare());});
 const s={...p,actorKind:'human',bindingRevision:1,targetHash:prepare().snapshot.targetHash,ticketId:id(11),databaseNow:'2026-10-14T12:00:00.000Z',expiresAt:'2026-10-14T13:00:00.000Z'};
 const receipt={schema:1,commandId:id(50),commandHash:captured.commandHash,permission:'prepare',workspaceId:id(1),accountId:id(2),actorId:id(20),bindingId:id(30),operationId:id(10),operationRevision:1,stateHash:registrationHash(captured.next.state),jobId:id(40),fence:0,status:'queued_analysis',recordedAt:s.databaseNow,[field]:field==='permission'?'cancel':field==='recordedAt'?'2026-10-14T13:00:00.000Z':id(99)};
 const responses:any[]=[s,null,receipt];let rejected=false;
 const store=createPostgresRegistrationStore({query:async()=>({command:'SELECT',rowCount:1,rows:[{result:responses.shift()}]}),release:()=>assert.fail()},{workspaceId:p.workspaceId,id:p.actorId},{assertCurrent:()=>{},reject:(e):never=>{rejected=true;throw e;}});
 await store.lockScope(p as any);await store.lockOperation(id(10));await assert.rejects(store.apply(captured),(e:any)=>e.code==='registration_storage_unavailable');assert.equal(rejected,true);
});
