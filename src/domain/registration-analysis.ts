import {copyRegistrationValue,registrationRecord,registrationRef,registrationUuid,registrationRevision,registrationDigest,registrationText,registrationHash,registrationFailure,type RegistrationJson} from './registration-canonical.ts';
import {getRegistrationAction,parseGrantWorkPayload,type RegistrationActionDefinition} from './registration-action-catalog.ts';
import {parseRegistrationInputSnapshot,type RegistrationInputSnapshot,type AgentAnalysisJob,type AgentAnalysis,type KnowledgeRef} from './registration-contracts.ts';
export type {AgentAnalysis,AgentAnalysisJob} from './registration-contracts.ts';
function refs(raw:unknown):readonly KnowledgeRef[] {
  const values=copyRegistrationValue(raw);if(!Array.isArray(values)||values.length>20)throw registrationFailure();
  const seen=new Set<string>();return Object.freeze(values.map(value=>{
    const x=registrationRecord(value,['id','hash']),id=registrationRef(x.id),hash=registrationDigest(x.hash);if(seen.has(id))throw registrationFailure();seen.add(id);return Object.freeze({id,hash});
  }));
}
export function parseAgentAnalysisJob(raw:unknown):AgentAnalysisJob {
  const x=registrationRecord(raw,['schema','jobId','operationId','inputRevision','requestHash','actionKey','actionSchemaHash','targetHash','fence','agentVersionRef','knowledgeRefs']);
  const action=getRegistrationAction(x.actionKey);if(x.schema!==1||x.actionSchemaHash!==action.schemaHash)throw registrationFailure();
  return Object.freeze({schema:1,jobId:registrationUuid(x.jobId),operationId:registrationUuid(x.operationId),inputRevision:registrationRevision(x.inputRevision),requestHash:registrationDigest(x.requestHash),actionKey:action.actionKey,actionSchemaHash:action.schemaHash,targetHash:registrationDigest(x.targetHash),fence:registrationRevision(x.fence),agentVersionRef:registrationRef(x.agentVersionRef),knowledgeRefs:refs(x.knowledgeRefs)});
}
/** Metadata only: no queue claim, no CLI invocation and no validation of the real host. */
export function createAgentAnalysisJob(snapshot:RegistrationInputSnapshot,raw:unknown):AgentAnalysisJob {
  const s=parseRegistrationInputSnapshot(snapshot),x=registrationRecord(raw,['jobId','fence','agentVersionRef','knowledgeRefs']);
  return parseAgentAnalysisJob({schema:1,jobId:x.jobId,operationId:s.operationId,inputRevision:s.inputRevision,requestHash:s.requestHash,actionKey:s.actionKey,actionSchemaHash:s.actionSchemaHash,targetHash:s.targetHash,fence:x.fence,agentVersionRef:x.agentVersionRef,knowledgeRefs:x.knowledgeRefs});
}
function texts(raw:unknown):readonly string[] {
  const values=copyRegistrationValue(raw);if(!Array.isArray(values)||values.length>20)throw registrationFailure();
  return Object.freeze(values.map(value=>registrationText(value,2000)));
}
/** A schema-valid model output is still untrusted data, never a grant or a receipt. */
export function parseAgentAnalysis(raw:unknown,expectedJob:AgentAnalysisJob,definition:RegistrationActionDefinition):AgentAnalysis {
  const j=parseAgentAnalysisJob(expectedJob),action=getRegistrationAction(j.actionKey);
  if(registrationHash(definition)!==registrationHash(action))throw registrationFailure('registration_action_mismatch',409);
  const x=registrationRecord(raw,['schema','jobId','operationId','inputRevision','disposition','proposedFields','missingFields','warnings','knowledgeRefs']);
  if(x.schema!==1||x.jobId!==j.jobId||x.operationId!==j.operationId||x.inputRevision!==j.inputRevision)throw registrationFailure('registration_analysis_mismatch',409);
  const disposition=x.disposition;if(!['proposal','needs_information','manual_review','unsupported'].includes(disposition as string))throw registrationFailure();
  const missingFields=texts(x.missingFields),warnings=texts(x.warnings),knowledgeRefs=refs(x.knowledgeRefs);
  if(new Set(missingFields).size!==missingFields.length||missingFields.some(field=>!action.missingFieldKeys.includes(field)))throw registrationFailure();
  const permitted=new Map(j.knowledgeRefs.map(ref=>[ref.id,ref.hash]));if(knowledgeRefs.some(ref=>permitted.get(ref.id)!==ref.hash))throw registrationFailure('registration_knowledge_out_of_scope',403);
  let proposedFields:Readonly<Record<string,RegistrationJson>>;
  if(disposition==='proposal') {if(missingFields.length)throw registrationFailure();proposedFields=parseGrantWorkPayload(x.proposedFields);}
  else {proposedFields=registrationRecord(x.proposedFields,[]);if(disposition==='needs_information'&&!missingFields.length)throw registrationFailure();}
  return Object.freeze({schema:1,jobId:j.jobId,operationId:j.operationId,inputRevision:j.inputRevision,disposition:disposition as AgentAnalysis['disposition'],proposedFields,missingFields,warnings,knowledgeRefs,
    actionKey:action.actionKey,actionSchemaHash:action.schemaHash,requestHash:j.requestHash,targetHash:j.targetHash,agentVersionRef:j.agentVersionRef,executionAllowed:false});
}
