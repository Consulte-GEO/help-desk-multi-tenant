import test from 'node:test';import assert from 'node:assert/strict';
import {parseRegistrationTarget,createRegistrationInputSnapshot,parseRegistrationInputSnapshot,createRegistrationDraft,parseRegistrationDraft} from '../src/domain/registration-contracts.ts';
import {createAgentAnalysisJob,parseAgentAnalysis,parseClaudeStructuredOutput} from '../src/connectors/dev-agent/contract.ts';
import {getRegistrationAction} from '../src/domain/registration-action-catalog.ts';
import {registrationHash} from '../src/domain/registration-canonical.ts';
import {id,target,input,output} from './fixtures/registration/sample.ts';
const action=getRegistrationAction('geo.user.grant_work.v1');
const snapshot=()=>createRegistrationInputSnapshot(input());
const job=()=>createAgentAnalysisJob(snapshot(),{jobId:id(20),fence:1,agentVersionRef:'synthetic-agent-v1',knowledgeRefs:[{id:'wiki.operation',hash:'a'.repeat(64)}]});
const bad=(work:()=>unknown)=>assert.throws(work,(e:any)=>e.name==='HelpdeskError'&&!e.message.includes('private-secret'));
test('S01 full target preserves opaque IDs and all tenancy dimensions',()=>{
 const a=parseRegistrationTarget(target());assert.equal(a.sourceContractCode,'0001');assert.equal(a.sourceWorkKey,'0007');
 const dimensions=['workspaceId','accountId','sourceConnectionId','sourceInstanceId','sourceTenantKey','sourceContractCode','sourceWorkKey','sourceBeneficiaryKey'] as const;
 for(const field of dimensions){const b={...target(),[field]:field.endsWith('Id')&&field!=='sourceInstanceId'?id(99):'different'};assert.notEqual(registrationHash(a),registrationHash(parseRegistrationTarget(b)));}
});
test('S02/S04 target rejects missing, forged, temporary, zero and ambiguous refs',()=>{
 for(const key of Object.keys(target())){const x:any=target();delete x[key];bad(()=>parseRegistrationTarget(x));}
 for(const key of ['sourceWorkKey','sourceBeneficiaryKey'])for(const value of ['',null,-1,'-1','0','0000','../env','a@example.invalid',' a '])bad(()=>parseRegistrationTarget({...target(),[key]:value}));
 bad(()=>parseRegistrationTarget({...target(),system:'GEOLAB'}));bad(()=>parseRegistrationTarget({...target(),role:'Admin'}));
});
test('A03 snapshot pins answers, refs, form and scope and never authorizes execution',()=>{
 const raw=input();raw.answers.note='ação';const s=snapshot();
 assert.equal(s.inputRevision,1);assert.ok(Object.isFrozen(s.answers));assert.equal(s.targetHash,registrationHash(s.target));
 assert.deepEqual(parseRegistrationInputSnapshot(s),s);
 assert.notEqual(createRegistrationInputSnapshot({...raw,answers:{a:false,b:0,c:null}}).requestHash,createRegistrationInputSnapshot({...raw,answers:{a:false,b:0}}).requestHash);
});
test('snapshot rejects hash, revision, action and attachment tampering',()=>{
 const s=snapshot();for(const changed of [{requestHash:'0'.repeat(64)},{targetHash:'0'.repeat(64)},{actionSchemaHash:'0'.repeat(64)},{inputRevision:0},{actionKey:'create_anything'}])bad(()=>parseRegistrationInputSnapshot({...s,...changed}));
 bad(()=>createRegistrationInputSnapshot({...input(),attachmentRefs:[{id:id(70),hash:'f'.repeat(64),url:'private-secret'}]}));
});
test('job binds snapshot hashes, fence and server-pinned agent version',()=>{
 const j=job();assert.equal(j.actionSchemaHash,action.schemaHash);assert.equal(j.requestHash,snapshot().requestHash);assert.equal(j.targetHash,snapshot().targetHash);assert.ok(Object.isFrozen(j.knowledgeRefs));
});
test('A01 parser creates validated analysis data without authority',()=>{
 const j=job();const raw=output(j);const a=parseAgentAnalysis(raw,j,action);assert.equal(a.disposition,'proposal');assert.equal(a.executionAllowed,false);assert.equal(a.agentVersionRef,j.agentVersionRef);
 raw.proposedFields={};assert.deepEqual(a.proposedFields,{kind:'add_work_link',preserveExistingLinks:true});assert.ok(Object.isFrozen(a.proposedFields));
});
for(const disposition of ['needs_information','manual_review','unsupported'])test('A02/A05 parser preserves '+disposition,()=>{
 const j=job(),a=parseAgentAnalysis(output(j,disposition),j,action);assert.equal(a.disposition,disposition);assert.deepEqual(a.proposedFields,{});assert.equal(a.executionAllowed,false);
});
test('A02 missing information cannot be disguised as an executable proposal',()=>{
 const j=job();bad(()=>parseAgentAnalysis({...output(j),missingFields:['sourceBeneficiaryKey']},j,action));
 bad(()=>parseAgentAnalysis({...output(j,'needs_information'),missingFields:[]},j,action));
 bad(()=>parseAgentAnalysis({...output(j,'manual_review'),proposedFields:{kind:'add_work_link',preserveExistingLinks:true}},j,action));
});
test('S02 returned action scope and permissions cannot be supplied by the model',()=>{
 const j=job();for(const field of ['target','actor','approval','sourceToken','sql','endpoint','toolCall','executeAllowed','actionKey'])bad(()=>parseAgentAnalysis({...output(j),[field]:'private-secret'},j,action));
 bad(()=>parseAgentAnalysis({...output(j),proposedFields:{kind:'add_work_link',preserveExistingLinks:true,sourceWorkKey:'other'}},j,action));
});
test('A01/F01 model done created approved or success are never valid dispositions',()=>{
 const j=job();for(const d of ['done','created','committed','approved','success'])bad(()=>parseAgentAnalysis(output(j,d),j,action));
});
test('stale jobs, inputs and tampered action definition are refused',()=>{
 const j=job();for(const change of [{operationId:id(98)},{jobId:id(97)},{inputRevision:2},{schema:2}])bad(()=>parseAgentAnalysis({...output(j),...change},j,action));
 bad(()=>parseAgentAnalysis(output(j),{...j,actionSchemaHash:'0'.repeat(64)},action));
 bad(()=>parseAgentAnalysis(output(j),j,{...action,liveExecutionAllowed:true} as any));
});
test('X05 knowledge refs must belong to the exact allowed ID/hash set',()=>{
 const j=job();assert.equal(parseAgentAnalysis({...output(j),knowledgeRefs:j.knowledgeRefs},j,action).knowledgeRefs.length,1);
 for(const refs of [[{id:'private-doc',hash:'a'.repeat(64)}],[{id:'wiki.operation',hash:'b'.repeat(64)}],[...j.knowledgeRefs,...j.knowledgeRefs]])bad(()=>parseAgentAnalysis({...output(j),knowledgeRefs:refs},j,action));
});
test('A01 CLI envelope requires real structured_output; text result and success flag do not suffice',()=>{
 const j=job();assert.equal(parseClaudeStructuredOutput({type:'result',subtype:'success',is_error:false,structured_output:output(j),total_cost_usd:0.025},j,action).disposition,'proposal');
 for(const envelope of [null,{result:output(j)},{type:'result',subtype:'success',is_error:false},{type:'result',subtype:'error_max_turns',is_error:true,structured_output:output(j)},{type:'result',subtype:'success',is_error:false,structured_output:'private-secret'}])bad(()=>parseClaudeStructuredOutput(envelope,j,action));
});
test('CLI envelope getter is never evaluated and metadata never retained',()=>{
 const j=job();let calls=0;const envelope:any={type:'result',subtype:'success',is_error:false};Object.defineProperty(envelope,'structured_output',{enumerable:true,get(){calls++;return output(j);}});
 bad(()=>parseClaudeStructuredOutput(envelope,j,action));assert.equal(calls,0);
 const a=parseClaudeStructuredOutput({type:'result',subtype:'success',is_error:false,structured_output:output(j),secret:'private-secret'},j,action);assert.ok(!JSON.stringify(a).includes('private-secret'));
});
test('analysis bounds lists, unknown missing fields, controls and extra fields',()=>{
 const j=job();for(const change of [{warnings:Array(21).fill('x')},{warnings:['x'.repeat(2001)]},{warnings:['\0']},{missingFields:['password']},{proposedFields:[]},{knowledgeRefs:null}])bad(()=>parseAgentAnalysis({...output(j),...change},j,action));
});
test('draft revision binds scope, proposal and effects and remains non-executable',()=>{
 const s=snapshot(),j=job(),a=parseAgentAnalysis(output(j),j,action);const d=createRegistrationDraft(s,a,1,'policy-v1');
 assert.equal(d.status,'draft');assert.equal(d.executionAllowed,false);assert.equal(d.previewRef,null);assert.equal(d.payloadHash,registrationHash(d.payload));assert.deepEqual(parseRegistrationDraft(d),d);
 for(const change of [{payload:{kind:'replace',preserveExistingLinks:true}},{target:{...target(),sourceTenantKey:'other'}},{effects:{...d.effects,changeProfile:true}},{policyVersion:'other'},{draftRevision:2},{contentHash:'0'.repeat(64)},{status:'approved'},{executionAllowed:true}])bad(()=>parseRegistrationDraft({...d,...change}));
});
test('draft cannot be built from wrong snapshot or non-proposal analysis',()=>{
 const s=snapshot(),j=job();bad(()=>createRegistrationDraft(s,parseAgentAnalysis(output(j,'manual_review'),j,action),1,'policy-v1'));
 const a=parseAgentAnalysis(output(j),j,action);bad(()=>createRegistrationDraft(createRegistrationInputSnapshot({...input(),inputRevision:2}),a,1,'policy-v1'));
});
