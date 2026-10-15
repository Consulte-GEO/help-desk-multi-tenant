import test from 'node:test';
import assert from 'node:assert/strict';
import {id,input} from './fixtures/registration/sample.ts';
import {createRegistrationInputSnapshot} from '../src/domain/registration-contracts.ts';
import {createRegistrationState} from '../src/domain/registration-automation.ts';
import {registrationHash} from '../src/domain/registration-canonical.ts';
function rejects(work:()=>unknown){assert.throws(work,(e:any)=>typeof e?.code==='string' && e.code.startsWith('registration_'));}
const path='../src/domain/registration-persistence.ts';
const mod:any=await import(path).catch(()=>({}));
function fn(name:string){assert.equal(typeof mod[name],'function',`${name} must be implemented`);return mod[name];}
const request=()=>({workspaceId:id(1),accountId:id(2),actorId:id(20),bindingId:id(30),permission:'prepare'});
const config=()=>({agentVersionRef:'cli.qualified.v1',knowledgeRefs:[],policyVersion:'hda.policy.v1'});
const state=()=>createRegistrationState(createRegistrationInputSnapshot(input()));
const job=()=>({schema:1,jobId:id(40),operationId:id(10),inputRevision:1,requestHash:state().snapshot.requestHash,kind:'analysis',configuration:config(),status:'queued',attempts:0,lease:null});
const locked=()=>({...request(),actorKind:'human',bindingRevision:1,targetHash:state().snapshot.targetHash,ticketId:id(11),databaseNow:'2026-10-14T12:00:00.000Z',expiresAt:'2026-10-14T13:00:00.000Z'});
test('scope parser accepts only explicit analysis permissions',()=>{assert.deepEqual(fn('parseRegistrationScopeRequest')(request()),request());});
for(const field of ['approved','kind','email','grant','actorKind'])test(`scope refuses caller field ${field}`,()=>rejects(()=>fn('parseRegistrationScopeRequest')({...request(),[field]:true})));
for(const permission of ['execute','approve','registration_execution','notifications.send',''])test(`scope refuses ${permission||'empty'} permission`,()=>rejects(()=>fn('parseRegistrationScopeRequest')({...request(),permission})));
test('locked scope is matched to every requested field',()=>{assert.deepEqual(fn('parseLockedRegistrationScope')(locked(),request()),locked());for(const field of ['workspaceId','accountId','actorId','bindingId'])rejects(()=>fn('parseLockedRegistrationScope')({...locked(),[field]:id(99)},request()));});
test('expired, invalid-calendar and backwards scope cannot be used',()=>{for(const expiresAt of ['2026-10-14T12:00:00.000Z','2026-02-30T12:00:00.000Z','2026-10-14T11:00:00.000Z'])rejects(()=>fn('parseLockedRegistrationScope')({...locked(),expiresAt},request()));});
test('human cannot acquire worker-only scope',()=>{const s={...request(),permission:'claim'};rejects(()=>fn('parseLockedRegistrationScope')({...locked(),permission:'claim'},s));});
test('analysis worker cannot receive prepare or cancel scope',()=>{for(const permission of ['prepare','cancel','revise','retry'])rejects(()=>fn('parseLockedRegistrationScope')({...locked(),permission,actorKind:'analyzer'},{...request(),permission}));});
test('queued record binds operation, revision and snapshot hash',()=>{assert.deepEqual(fn('parseRegistrationQueueEntry')(job(),state()),job());for(const change of [{operationId:id(88)},{inputRevision:2},{requestHash:'a'.repeat(64)},{kind:'execution'},{attempts:4},{status:'leased'},{lease:{}}])rejects(()=>fn('parseRegistrationQueueEntry')({...job(),...change},state()));});
test('job configuration is exact and bounded',()=>{assert.deepEqual(fn('parseRegistrationJobConfiguration')(config()),config());for(const change of [{policyVersion:''},{tools:['Bash']},{knowledgeRefs:[{id:'p',hash:'a'.repeat(64)},{id:'p',hash:'a'.repeat(64)}]}])rejects(()=>fn('parseRegistrationJobConfiguration')({...config(),...change}));});
test('receipt is metadata, never an execution capability',()=>{const r={schema:1,commandId:id(51),commandHash:'a'.repeat(64),permission:'prepare',workspaceId:id(1),accountId:id(2),actorId:id(20),bindingId:id(30),operationId:id(10),operationRevision:1,stateHash:registrationHash(state()),jobId:id(40),fence:0,status:'queued_analysis',recordedAt:'2026-10-14T12:00:00.000Z'};assert.deepEqual(fn('parseRegistrationPersistenceReceipt')(r),r);for(const change of [{approved:true},{status:'committed'},{operationRevision:0},{commandHash:'x'},{fence:-1}])rejects(()=>fn('parseRegistrationPersistenceReceipt')({...r,...change}));});
