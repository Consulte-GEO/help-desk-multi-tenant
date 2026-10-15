import test from 'node:test';import assert from 'node:assert/strict';
import {parseOriginPreviewCandidate,createUnavailableRegistrationSourceReadPort} from '../src/connectors/novo-geo/registration-read.ts';
import {createRegistrationInputSnapshot,createRegistrationDraft} from '../src/domain/registration-contracts.ts';
import {createAgentAnalysisJob,parseAgentAnalysis} from '../src/connectors/dev-agent/contract.ts';
import {getRegistrationAction} from '../src/domain/registration-action-catalog.ts';
import {id,input,output} from './fixtures/registration/sample.ts';
const now='2026-10-14T20:00:00.000Z';
function setup(){
 const s=createRegistrationInputSnapshot(input()),j=createAgentAnalysisJob(s,{jobId:id(20),fence:1,agentVersionRef:'synthetic-agent-v1',knowledgeRefs:[]});
 const d=createRegistrationDraft(s,parseAgentAnalysis(output(j),j,getRegistrationAction(s.actionKey)),1,'policy-v1');
 const expected={draft:d,sourceContractVersion:'synthetic-origin-v1',at:now,policy:{maxAgeMs:300000,maxTtlMs:300000}};
 const raw={schema:1,operationId:d.operationId,draftRevision:1,previewRef:'preview-1',sourceContractVersion:'synthetic-origin-v1',actionSchemaHash:d.actionSchemaHash,targetHash:d.targetHash,payloadHash:d.payloadHash,effectsHash:d.effectsHash,originAccessRevision:null,status:'valid',validationIssues:[],dependencies:[{kind:'user',key:d.target.sourceBeneficiaryKey,state:'satisfied'},{kind:'work',key:d.target.sourceWorkKey,state:'satisfied'}],observedAt:now,expiresAt:'2026-10-14T20:05:00.000Z',effectsExecuted:false};
 return {raw,expected};
}
test('HDA05 preview parsing returns candidate, never an approved live adapter',()=>{
 const {raw,expected}=setup();const candidate=parseOriginPreviewCandidate(raw,expected);assert.equal(candidate.kind,'validated_preview_candidate');assert.equal(candidate.liveAdapterAllowed,false);assert.equal(candidate.executionAllowed,false);assert.equal(candidate.preview.status,'valid');assert.ok(Object.isFrozen(candidate.preview.dependencies));
 assert.deepEqual(parseOriginPreviewCandidate(raw,expected),candidate);
});
test('S01/S02 preview cannot change scope, payload, effects, schema, contract or draft',()=>{
 const {raw,expected}=setup();for(const change of [{operationId:id(88)},{draftRevision:2},{sourceContractVersion:'different'},{actionSchemaHash:'0'.repeat(64)},{targetHash:'0'.repeat(64)},{payloadHash:'0'.repeat(64)},{effectsHash:'0'.repeat(64)},{originAccessRevision:'rev-new'}])assert.throws(()=>parseOriginPreviewCandidate({...raw,...change},expected));
});
test('O01 effectful response, free SQL, generic true and HTTP ACK are refused',()=>{
 const {raw,expected}=setup();for(const x of [{...raw,effectsExecuted:true},{...raw,sql:'private-secret'},{valid:true},{status:202},{...raw,status:'committed'}])assert.throws(()=>parseOriginPreviewCandidate(x,expected));
});
test('O02 preview expiry is end-exclusive and does not normalize invalid dates',()=>{
 const {raw,expected}=setup();assert.throws(()=>parseOriginPreviewCandidate(raw,{...expected,at:raw.expiresAt}));
 for(const change of [{observedAt:'2026-10-14T20:00:01.000Z'},{expiresAt:now},{observedAt:'2026-02-30T20:00:00.000Z'},{observedAt:'2026-10-14T17:00:00-03:00'},{expiresAt:'2026-10-15T20:00:00.000Z'}])assert.throws(()=>parseOriginPreviewCandidate({...raw,...change},expected));
});
test('preview freshness and TTL use explicit bounded server policy',()=>{
 const {raw,expected}=setup();assert.throws(()=>parseOriginPreviewCandidate({...raw,observedAt:'2026-10-14T19:50:00.000Z'},expected));
 for(const policy of [{maxAgeMs:0,maxTtlMs:300000},{maxAgeMs:300000,maxTtlMs:Infinity},{maxAgeMs:300000},{maxAgeMs:300000,maxTtlMs:300000,allow:true}])assert.throws(()=>parseOriginPreviewCandidate(raw,{...expected,policy} as any));
});
test('S01 preview needs one exact user and one exact work dependency',()=>{
 const {raw,expected}=setup();for(const deps of [[],[raw.dependencies[0]],Array(2).fill(raw.dependencies[0]),[raw.dependencies[0],{kind:'work',key:'other-work',state:'satisfied'}],[raw.dependencies[0],{kind:'admin',key:'x',state:'satisfied'}]])assert.throws(()=>parseOriginPreviewCandidate({...raw,dependencies:deps},expected));
});
test('inactive or denied references cannot coexist with a valid preview',()=>{
 const {raw,expected}=setup();for(const state of ['inactive','missing','denied'])assert.throws(()=>parseOriginPreviewCandidate({...raw,dependencies:[{...raw.dependencies[0],state},raw.dependencies[1]]},expected));
});
test('known invalid preview remains informational and no raw error text leaks',()=>{
 const {raw,expected}=setup();const x={...raw,status:'invalid',validationIssues:[{code:'beneficiary_inactive',field:'sourceBeneficiaryKey'}],dependencies:[{...raw.dependencies[0],state:'inactive'},raw.dependencies[1]]};
 assert.equal(parseOriginPreviewCandidate(x,expected).preview.status,'invalid');
 assert.throws(()=>parseOriginPreviewCandidate({...x,validationIssues:[{code:'secret',field:'password',message:'private-secret'}]},expected),(e:any)=>!e.message.includes('private-secret'));
});
test('O03 visible conflict is not converted into create or execution authority',()=>{
 const {raw,expected}=setup();const x=parseOriginPreviewCandidate({...raw,status:'conflict',validationIssues:[{code:'link_exists',field:'target'}]},expected);
 assert.equal(x.executionAllowed,false);assert.equal(x.preview.status,'conflict');
});
test('conflict/invalid statuses must explain the known validation issue',()=>{
 const {raw,expected}=setup();for(const status of ['conflict','invalid'])assert.throws(()=>parseOriginPreviewCandidate({...raw,status},expected));
 assert.throws(()=>parseOriginPreviewCandidate({...raw,validationIssues:[{code:'scope_denied',field:'target'}]},expected));
});
test('unqualified read port has no execute method and never silently simulates origin',async()=>{
 const port=createUnavailableRegistrationSourceReadPort();assert.equal(port.liveAdapterAllowed,false);assert.equal('execute' in port,false);
 for(const method of [port.readContext,port.preview])await assert.rejects(()=>method({} as any,new AbortController().signal),(e:any)=>e.status===503&&e.code==='registration_source_unqualified');
});
