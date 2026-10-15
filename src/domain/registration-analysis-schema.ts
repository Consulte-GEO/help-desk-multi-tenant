import {copyRegistrationValue,type RegistrationJson} from './registration-canonical.ts';
import {parseAgentAnalysisJob} from './registration-analysis.ts';
import {getRegistrationAction} from './registration-action-catalog.ts';
import type {AgentAnalysisJob} from './registration-contracts.ts';
/** Candidate JSON Schema for the qualified bridge's --json-schema argument.
 * Schema compliance only limits syntax. parseAgentAnalysis remains mandatory for
 * cross-field consistency and provenance; actual CLI support is an HDA-04 gate.
 */
export function buildAgentAnalysisOutputSchema(job:AgentAnalysisJob):RegistrationJson {
  const j=parseAgentAnalysisJob(job),action=getRegistrationAction(j.actionKey);
  return copyRegistrationValue({type:'object',additionalProperties:false,
    required:['schema','jobId','operationId','inputRevision','disposition','proposedFields','missingFields','warnings','knowledgeRefs'],
    properties:{schema:{const:1},jobId:{const:j.jobId},operationId:{const:j.operationId},inputRevision:{const:j.inputRevision},
      disposition:{type:'string',enum:['proposal','needs_information','manual_review','unsupported']},
      proposedFields:{oneOf:[action.schema,{type:'object',additionalProperties:false,maxProperties:0}]},
      missingFields:{type:'array',maxItems:action.missingFieldKeys.length,uniqueItems:true,items:{type:'string',enum:action.missingFieldKeys}},
      warnings:{type:'array',maxItems:20,items:{type:'string',minLength:1,maxLength:2000}},
      knowledgeRefs:j.knowledgeRefs.length?{type:'array',maxItems:j.knowledgeRefs.length,uniqueItems:true,items:{enum:j.knowledgeRefs}}:{type:'array',maxItems:0}
    }
  });
}
