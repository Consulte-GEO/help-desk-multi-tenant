import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {id,input,output} from './fixtures/registration/sample.ts';
import {transactionModel} from './fixtures/registration/transaction-model.ts';
import {createRegistrationInputSnapshot} from '../src/domain/registration-contracts.ts';
import {executeRegistrationCommand} from '../src/application/registration-persistence.ts';
import {parseRegistrationScopeRequest} from '../src/domain/registration-persistence.ts';
import {createRegistrationAnalysisWorker} from '../src/application/registration-analysis-worker.ts';

for (const settlement of ['resolve','reject'] as const) test(`aborted uncooperative analyzer returns promptly, remains quarantined until ${settlement}, and never settles late output`,async()=>{
 const db=transactionModel();
 const p=parseRegistrationScopeRequest(db.scope('prepare'));
 await db.transaction(p,tx=>executeRegistrationCommand(tx,p,{type:'prepare',commandId:id(50),snapshot:createRegistrationInputSnapshot(input()),jobId:id(40),configuration:{agentVersionRef:'cli.v1',knowledgeRefs:[],policyVersion:'policy.v1'}}));
 let finish!:(r:any)=>void,fail!:(e:any)=>void,entered!:()=>void,calls=0,request:any,signal:AbortSignal|undefined;
 const entry=new Promise<void>(r=>{entered=r;});
 const eventual=new Promise<any>((resolve,reject)=>{finish=resolve;fail=reject;});
 const worker=createRegistrationAnalysisWorker({identity:{workspaceId:id(1),accountId:id(2),actorId:id(21),bindingId:id(30)},enabled:()=>true,
  transactions:{run:async(s,work,admission)=>db.transaction(s,async tx=>{admission();const v=await work(tx);admission();return v;})},
  runner:{analyze:async(r,s)=>{request=r;signal=s;calls++;entered();return eventual;}}
 });
 const abort=new AbortController(),run=worker.runOnce(id(51),abort.signal);await entry;abort.abort();
 try {
  const first=await Promise.race([run,sleep(150).then(()=>null)]);
  assert.ok(first,'caller must not be trapped by an analyzer ignoring AbortSignal');
  assert.equal(first.status,'withheld');assert.equal(signal?.aborted,true);
  assert.equal((await worker.runOnce(id(52))).status,'busy','unfinished analyzer must not overlap a new call');
  if(settlement==='resolve')finish({output:output(request.job)});else fail(new Error('PRIVATE_LATE_ERROR'));
  await sleep(0);assert.equal(db.inspect().drafts.size,0);assert.equal(calls,1);
  assert.equal(db.inspect().operations.get(id(10)).queue.status,'leased');
  assert.equal((await worker.runOnce(id(53))).status,'idle','completed quarantine is released without new analysis of leased task');
 } finally { finish({output:output(request.job)});await run; }
});
