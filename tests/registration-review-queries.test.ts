import test from 'node:test';import assert from 'node:assert/strict';
import {id,input} from './fixtures/registration/sample.ts';
import {createResourceAccessResolver} from '../src/application/resource-access.ts';
import {createRegistrationInputSnapshot} from '../src/domain/registration-contracts.ts';
import {createRegistrationState} from '../src/domain/registration-automation.ts';
import type {Principal} from '../src/domain/model.ts';import type {SqlPool} from '../src/infrastructure/sql.ts';
const path='../src/infrastructure/registration-review.ts',m:any=await import(path).catch(()=>({}));
const at='2026-10-15T12:00:00.000Z',until='2026-10-15T12:01:00.000Z';
function fixture(grantCount=0){
 assert.equal(typeof m.createPostgresRegistrationReviewQueries,'function','concrete scoped reader is required');
 const p:Principal={id:id(20),workspaceId:id(1),kind:'human',workspaceRole:'admin',grants:Array.from({length:grantCount},(_,i)=>({accountId:id(1000+i),role:'account_manager' as const})),scopes:['tickets:read']};
 const refs=[{connectionId:id(3),tenantId:'tenant-A',type:'work',id:'0007'}];
 const resolver=createResourceAccessResolver({manifestFingerprint:'a'.repeat(64),maxAgeMicros:60_000_000n,timeoutMs:1000,clock:()=>at,authority:{readAccess:async()=>({principal:structuredClone(p),operation:'tickets.read',binding:{id:id(5),workspaceId:id(1),accountId:id(2),connectionId:id(3),tenantId:'tenant-A',active:true,revision:'binding-1'},accessRevision:'access-1',manifestFingerprint:'a'.repeat(64),asOf:at,expiresAt:until,resources:refs})}});
 const resource={ticketId:id(11),principalId:p.id,workspaceId:p.workspaceId,accountId:id(2),bindingId:id(5),bindingRevision:'binding-1',accessRevision:'access-1',manifestFingerprint:'a'.repeat(64),operation:'tickets.read',asOf:at,expiresAt:until,refs};
 const snapshot=createRegistrationInputSnapshot(input()),scope={workspaceId:p.workspaceId,accountId:id(2),actorId:p.id,bindingId:id(30),permission:'read',actorKind:'human',bindingRevision:1,targetHash:snapshot.targetHash,ticketId:id(11),databaseNow:at,expiresAt:until};
 const operation={state:createRegistrationState(snapshot),queue:{schema:1,jobId:id(40),operationId:id(10),inputRevision:1,requestHash:snapshot.requestHash,kind:'analysis',configuration:{agentVersionRef:'v1',knowledgeRefs:[],policyVersion:'v1'},status:'queued',attempts:0,lease:null},databaseNow:at};
 let target:any={workspaceId:p.workspaceId,accountId:id(2),ticketId:id(11),bindingId:id(30),operationId:id(10)},sqlError=false,enabled=true,missing=false;const statements:string[]=[];let hook:(sql:string)=>void=()=>{};
 const pool:SqlPool={query:async()=>{throw Error('outside transaction');},end:async()=>{},connect:async()=>({release:()=>{},query:async(sql,values)=>{statements.push(sql);hook(sql);if(sql.includes('cg_lock_ticket_scope'))return {command:'SELECT',rowCount:1,rows:[{scope:resource}]};let result:any;if(sql.includes('hda06_review_target')){if(sqlError)throw Error('postgres://PRIVATE_SECRET');result=target;}else if(sql.includes('hda02_lock_scope')||sql.includes('hda02_reauthorize'))result=scope;else if(sql.includes('hda02_operation'))result=missing?null:operation;else return {command:sql,rowCount:0,rows:[]};return {command:'SELECT',rowCount:1,rows:[{result}]};}})};
 const queries=m.createPostgresRegistrationReviewQueries({pool,resolver,directory:{locateTicket:async()=>({accountId:id(2),refs})},enabled:()=>enabled});
 return {p,queries,statements,resource,scope,operation,target:(x:any)=>{target=x;},missing:()=>{missing=true;},breakSQL:()=>{sqlError=true;},disable:()=>{enabled=false;},hook:(fn:typeof hook)=>{hook=fn;}};
}
test('real resource resolver, transaction, store and projection compose without exposing persisted state',async()=>{
 const f=fixture(),v=await f.queries.readReview(f.p,id(11),'customer');assert.equal(v.status,'queued_analysis');assert.equal(v.detail,null);assert.equal(v.audience,'customer');assert.equal(f.statements.at(-1),'COMMIT');
 const text=JSON.stringify(v);for(const privateKey of ['sourceConnectionId','sourceWorkKey','configuration','snapshot','queue','lastEvent'])assert.ok(!text.includes('"'+privateKey+'":'));
 assert.ok(f.statements.findIndex(x=>x.includes('cg_lock_ticket_scope'))<f.statements.findIndex(x=>x.includes('hda06_review_target')));
});
test('internal audience is prechecked against operator and current SQL still receives fixed internal intent',async()=>{const f=fixture();f.p.workspaceRole=null;await assert.rejects(f.queries.readReview(f.p,id(11),'internal'),{code:'registration_scope_denied'});assert.ok(!f.statements.some(x=>x.includes('hda06_review_target')));});
for(const field of ['workspaceId','accountId','ticketId'])test('foreign server resolution '+field+' rolls back',async()=>{const f=fixture();f.target({workspaceId:id(1),accountId:id(2),ticketId:id(11),bindingId:id(30),operationId:id(10),[field]:id(99)});await assert.rejects(f.queries.readReview(f.p,id(11),'customer'));assert.equal(f.statements.at(-1),'ROLLBACK');});
test('missing operation returns explicit absence and never manufactures a draft',async()=>{const f=fixture();f.missing();await assert.rejects(f.queries.readReview(f.p,id(11),'customer'),{code:'registration_review_not_found'});});
test('absent installation or unknown SQL exception is sanitized',async()=>{const f=fixture();f.breakSQL();await assert.rejects(f.queries.readReview(f.p,id(11),'customer'),(e:any)=>e.code==='registration_review_unavailable'&&!e.message.includes('PRIVATE_SECRET'));assert.equal(f.statements.at(-1),'ROLLBACK');});
test('disabled read path never touches persistence',async()=>{const f=fixture();f.disable();await assert.rejects(f.queries.readReview(f.p,id(11),'customer'),{code:'release_gate_closed'});assert.equal(f.statements.length,0);});
for(const count of [257,1000])test('core-authorized human with '+count+' account grants can read the persisted customer projection',async()=>{
 const f=fixture(count),v=await f.queries.readReview(f.p,id(11),'customer');assert.equal(v.status,'queued_analysis');assert.equal(v.detail,null);assert.equal(f.statements.at(-1),'COMMIT');
});
for(const field of ['last grant','scopes','workspace role'])test('full identity guard refuses late mutation of '+field+' with 1000 legitimate grants',async()=>{
 const f=fixture(1000);f.hook(sql=>{if(sql.includes('hda06_review_target')){if(field==='last grant')f.p.grants[999]!.role='agent';else if(field==='scopes')f.p.scopes=[];else f.p.workspaceRole=null;}});
 // The core resource lease and HDA admission both pin the identity. Either may
 // detect the changed principal first; the visible contract is denial + rollback.
 await assert.rejects(f.queries.readReview(f.p,id(11),'customer'),{status:403});assert.equal(f.statements.at(-1),'ROLLBACK');assert.ok(!f.statements.includes('COMMIT'));
});
test('core identity fingerprint never evaluates getters in a large grant collection',async()=>{
 const f=fixture(1000);let getters=0;Object.defineProperty(f.p.grants[999],'role',{enumerable:true,get(){getters++;return 'agent';}});
 await assert.rejects(f.queries.readReview(f.p,id(11),'customer'));assert.equal(getters,0);assert.equal(f.statements.length,0);
});
