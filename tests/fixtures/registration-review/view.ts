import {createRegistrationInputSnapshot} from '../../../src/domain/registration-contracts.ts';
import {createRegistrationState,decideRegistrationTransition} from '../../../src/domain/registration-automation.ts';
import {createAgentAnalysisJob} from '../../../src/domain/registration-analysis.ts';
import {projectRegistrationDraftReview} from '../../../src/application/registration-drafts.ts';
import {id,input,output} from '../registration/sample.ts';
export const reviewContext={workspaceId:id(1),accountId:id(2),ticketId:id(11),operationId:id(10),audience:'internal' as const};
export function view(audience:'internal'|'customer'='internal',windowMs=60000){
 const snapshot=createRegistrationInputSnapshot({...input(),answers:{name:'Pessoa de demonstração',email:'pessoa@example.invalid',note:'Liberar acesso à obra existente, preservando os demais vínculos.',requestConfirmation:true}});
 const job=createAgentAnalysisJob(snapshot,{jobId:id(40),fence:1,agentVersionRef:'agent.v1',knowledgeRefs:[]});
 const start=decideRegistrationTransition(createRegistrationState(snapshot),{type:'analysis_started',eventId:id(71),operationId:id(10),expectedRevision:1,job}).state;
 const state=decideRegistrationTransition(start,{type:'analysis_completed',eventId:id(72),operationId:id(10),expectedRevision:2,jobId:job.jobId,fence:1,policyVersion:'policy.v1',output:output(job)}).state;
 const {audience:_,...context}=reviewContext,observedAt='2026-10-14T12:00:00.000Z';
 return projectRegistrationDraftReview(state,{audience,context,observedAt,expiresAt:new Date(Date.parse(observedAt)+windowMs).toISOString()});
}
