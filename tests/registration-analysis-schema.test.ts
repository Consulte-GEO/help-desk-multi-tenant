import test from 'node:test';import assert from 'node:assert/strict';
import {buildAgentAnalysisOutputSchema} from '../src/domain/registration-analysis-schema.ts';
import {createRegistrationInputSnapshot} from '../src/domain/registration-contracts.ts';
import {createAgentAnalysisJob} from '../src/domain/registration-analysis.ts';
import {id,input} from './fixtures/registration/sample.ts';
const job=()=>createAgentAnalysisJob(createRegistrationInputSnapshot(input()),{jobId:id(20),fence:1,agentVersionRef:'synthetic-agent-v1',knowledgeRefs:[]});
test('analysis JSON schema pins the job/operation/revision and disallows extra keys',()=>{
 const j=job(),schema:any=buildAgentAnalysisOutputSchema(j);assert.equal(schema.additionalProperties,false);assert.equal(schema.properties.jobId.const,j.jobId);assert.equal(schema.properties.operationId.const,j.operationId);assert.equal(schema.properties.inputRevision.const,1);
 assert.deepEqual(schema.properties.disposition.enum,['proposal','needs_information','manual_review','unsupported']);assert.equal(schema.required.length,9);assert.ok(Object.isFrozen(schema.properties));
});
test('schema has no execution permission and no knowledge refs when none were authorized',()=>{
 const schema:any=buildAgentAnalysisOutputSchema(job());assert.equal(schema.properties.knowledgeRefs.maxItems,0);assert.equal('executeAllowed' in schema.properties,false);assert.equal('target' in schema.properties,false);
});
test('schema generation refuses inconsistent action hashes before CLI invocation',()=>{
 assert.throws(()=>buildAgentAnalysisOutputSchema({...job(),actionSchemaHash:'0'.repeat(64)}));
});
