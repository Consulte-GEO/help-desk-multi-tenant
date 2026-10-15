import {copyRegistrationValue,registrationRecord,registrationUuid,registrationRef,registrationRevision,registrationDigest,registrationHash,registrationFailure,type RegistrationJson} from './registration-canonical.ts';
import {getRegistrationAction,parseGrantWorkPayload,type RegistrationActionKey,type GrantWorkPayload,type RegistrationEffects} from './registration-action-catalog.ts';

export type RegistrationTarget = Readonly<{
  system:'NOVO_GEO';workspaceId:string;accountId:string;sourceConnectionId:string;sourceInstanceId:string;
  sourceTenantKey:string;sourceContractCode:string;sourceWorkKey:string;sourceBeneficiaryKey:string;originAccessRevision:string|null;
}>;
export type RegistrationTargetV1 = RegistrationTarget;
export type RegistrationAttachmentRef = Readonly<{id:string;hash:string}>;
export type RegistrationInputSnapshot = Readonly<{
  schema:1;operationId:string;ticketId:string;inputRevision:number;formVersion:string;actionKey:RegistrationActionKey;actionSchemaHash:string;
  target:RegistrationTarget;targetHash:string;answers:Readonly<Record<string,RegistrationJson>>;attachmentRefs:readonly RegistrationAttachmentRef[];requestHash:string;
}>;
export type KnowledgeRef = Readonly<{id:string;hash:string}>;
export type AgentAnalysisJob = Readonly<{
  schema:1;jobId:string;operationId:string;inputRevision:number;requestHash:string;actionKey:RegistrationActionKey;actionSchemaHash:string;targetHash:string;
  fence:number;agentVersionRef:string;knowledgeRefs:readonly KnowledgeRef[];
}>;
export type AgentAnalysis = Readonly<{
  schema:1;jobId:string;operationId:string;inputRevision:number;disposition:'proposal'|'needs_information'|'manual_review'|'unsupported';
  proposedFields:Readonly<Record<string,RegistrationJson>>;missingFields:readonly string[];warnings:readonly string[];knowledgeRefs:readonly KnowledgeRef[];
  actionKey:RegistrationActionKey;actionSchemaHash:string;requestHash:string;targetHash:string;agentVersionRef:string;executionAllowed:false;
}>;
export type RegistrationDraft = Readonly<{
  schema:1;operationId:string;inputRevision:number;draftRevision:number;actionKey:RegistrationActionKey;actionSchemaHash:string;requestHash:string;
  target:RegistrationTarget;targetHash:string;payload:GrantWorkPayload;payloadHash:string;effects:RegistrationEffects;effectsHash:string;
  previewRef:null;policyVersion:string;analysisJobId:string;agentVersionRef:string;contentHash:string;status:'draft';executionAllowed:false;
}>;
/** Persistence contracts only. Data carrying these fields is NOT an authorization.
 * HDA-07 must prove live human/grant/step-up/consent in its own transaction.
 */
export type ExecutionApproval = Readonly<{
  approvalId:string;operationId:string;draftRevision:number;purpose:'registration_execution';targetHash:string;payloadHash:string;effectsHash:string;
  draftHash:string;policyVersion:string;humanActorId:string;approvedAt:string;expiresAt:string;status:'approved'|'revoked'|'expired';
}>;
/** Observation is untrusted until the future qualified adapter verifies provenance. */
export type OriginObservation = Readonly<{
  executionIntentId:string;originReference:string|null;sourceContractVersion:string;status:'committed'|'rejected'|'pending'|'unknown'|'partially_completed';
  confirmedTargetHash:string;confirmedPayloadHash:string;entityRefs:readonly Readonly<{kind:string;key:string}>[];observedAt:string;evidenceRef:string|null;
}>;
const targetKeys=['system','workspaceId','accountId','sourceConnectionId','sourceInstanceId','sourceTenantKey','sourceContractCode','sourceWorkKey','sourceBeneficiaryKey','originAccessRevision'] as const;
export function parseRegistrationTarget(raw:unknown):RegistrationTarget {
  const x=registrationRecord(raw,targetKeys);if(x.system!=='NOVO_GEO')throw registrationFailure();
  const target:RegistrationTarget={system:'NOVO_GEO',workspaceId:registrationUuid(x.workspaceId),accountId:registrationUuid(x.accountId),sourceConnectionId:registrationUuid(x.sourceConnectionId),
    sourceInstanceId:registrationRef(x.sourceInstanceId),sourceTenantKey:registrationRef(x.sourceTenantKey),sourceContractCode:registrationRef(x.sourceContractCode),
    sourceWorkKey:registrationRef(x.sourceWorkKey),sourceBeneficiaryKey:registrationRef(x.sourceBeneficiaryKey),originAccessRevision:x.originAccessRevision===null?null:registrationRef(x.originAccessRevision)};
  if(/^0+$/.test(target.sourceWorkKey)||/^0+$/.test(target.sourceBeneficiaryKey))throw registrationFailure();
  return Object.freeze(target);
}
function attachments(raw:unknown):readonly RegistrationAttachmentRef[] {
  const values=copyRegistrationValue(raw);if(!Array.isArray(values)||values.length>20)throw registrationFailure();
  const seen=new Set<string>();return Object.freeze(values.map(value=>{
    const x=registrationRecord(value,['id','hash']),id=registrationUuid(x.id),hash=registrationDigest(x.hash);
    if(seen.has(id))throw registrationFailure();seen.add(id);return Object.freeze({id,hash});
  }));
}
/** Caller must supply a SERVER-resolved candidate scope. This pure builder never grants access. */
export function createRegistrationInputSnapshot(raw:unknown):RegistrationInputSnapshot {
  const x=registrationRecord(raw,['operationId','ticketId','inputRevision','formVersion','actionKey','target','answers','attachmentRefs']);
  const action=getRegistrationAction(x.actionKey),target=parseRegistrationTarget(x.target),answers=copyRegistrationValue(x.answers);
  if(!answers||typeof answers!=='object'||Array.isArray(answers))throw registrationFailure();
  const data={schema:1 as const,operationId:registrationUuid(x.operationId),ticketId:registrationUuid(x.ticketId),inputRevision:registrationRevision(x.inputRevision),formVersion:registrationRef(x.formVersion),
    actionKey:action.actionKey,actionSchemaHash:action.schemaHash,target,targetHash:registrationHash(target),answers:answers as Readonly<Record<string,RegistrationJson>>,attachmentRefs:attachments(x.attachmentRefs)};
  return Object.freeze({...data,requestHash:registrationHash(data)});
}
export function parseRegistrationInputSnapshot(raw:unknown):RegistrationInputSnapshot {
  const x=registrationRecord(raw,['schema','operationId','ticketId','inputRevision','formVersion','actionKey','actionSchemaHash','target','targetHash','answers','attachmentRefs','requestHash']);
  const s=createRegistrationInputSnapshot({operationId:x.operationId,ticketId:x.ticketId,inputRevision:x.inputRevision,formVersion:x.formVersion,actionKey:x.actionKey,target:x.target,answers:x.answers,attachmentRefs:x.attachmentRefs});
  if(x.schema!==1||x.requestHash!==s.requestHash||x.targetHash!==s.targetHash||x.actionSchemaHash!==s.actionSchemaHash)throw registrationFailure('registration_snapshot_mismatch',409);
  return s;
}
function draftData(raw:unknown) {
  const x=registrationRecord(raw,['schema','operationId','inputRevision','draftRevision','actionKey','actionSchemaHash','requestHash','target','targetHash','payload','payloadHash','effects','effectsHash','previewRef','policyVersion','analysisJobId','agentVersionRef','status','executionAllowed']);
  const action=getRegistrationAction(x.actionKey),target=parseRegistrationTarget(x.target),payload=parseGrantWorkPayload(x.payload);
  if(x.schema!==1||x.actionSchemaHash!==action.schemaHash||x.targetHash!==registrationHash(target)||x.payloadHash!==registrationHash(payload)||registrationHash(x.effects)!==registrationHash(action.effects)||x.effectsHash!==registrationHash(action.effects)||x.previewRef!==null||x.status!=='draft'||x.executionAllowed!==false)throw registrationFailure('registration_draft_mismatch',409);
  return {schema:1 as const,operationId:registrationUuid(x.operationId),inputRevision:registrationRevision(x.inputRevision),draftRevision:registrationRevision(x.draftRevision),actionKey:action.actionKey,actionSchemaHash:action.schemaHash,requestHash:registrationDigest(x.requestHash),
    target,targetHash:registrationHash(target),payload,payloadHash:registrationHash(payload),effects:action.effects,effectsHash:registrationHash(action.effects),previewRef:null,policyVersion:registrationRef(x.policyVersion),analysisJobId:registrationUuid(x.analysisJobId),agentVersionRef:registrationRef(x.agentVersionRef),status:'draft' as const,executionAllowed:false as const};
}
export function createRegistrationDraft(snapshot:RegistrationInputSnapshot,analysis:AgentAnalysis,revision:number,policyVersion:string):RegistrationDraft {
  const s=parseRegistrationInputSnapshot(snapshot),a=registrationRecord(analysis,['schema','jobId','operationId','inputRevision','disposition','proposedFields','missingFields','warnings','knowledgeRefs','actionKey','actionSchemaHash','requestHash','targetHash','agentVersionRef','executionAllowed']);
  if(a.schema!==1||a.disposition!=='proposal'||a.executionAllowed!==false||a.operationId!==s.operationId||a.inputRevision!==s.inputRevision||a.actionKey!==s.actionKey||a.actionSchemaHash!==s.actionSchemaHash||a.requestHash!==s.requestHash||a.targetHash!==s.targetHash||!Array.isArray(a.missingFields)||a.missingFields.length)throw registrationFailure('registration_analysis_mismatch',409);
  const action=getRegistrationAction(s.actionKey),payload=parseGrantWorkPayload(a.proposedFields);
  const data=draftData({schema:1,operationId:s.operationId,inputRevision:s.inputRevision,draftRevision:revision,actionKey:s.actionKey,actionSchemaHash:s.actionSchemaHash,requestHash:s.requestHash,target:s.target,targetHash:s.targetHash,
    payload,payloadHash:registrationHash(payload),effects:action.effects,effectsHash:registrationHash(action.effects),previewRef:null,policyVersion,analysisJobId:a.jobId,agentVersionRef:a.agentVersionRef,status:'draft',executionAllowed:false});
  return Object.freeze({...data,contentHash:registrationHash(data)});
}
export function parseRegistrationDraft(raw:unknown):RegistrationDraft {
  const copy=copyRegistrationValue(raw);if(!copy||typeof copy!=='object'||Array.isArray(copy))throw registrationFailure();
  const {contentHash,...rest}=copy as Readonly<Record<string,RegistrationJson>>,data=draftData(rest);
  if(registrationDigest(contentHash)!==registrationHash(data))throw registrationFailure('registration_draft_mismatch',409);
  return Object.freeze({...data,contentHash:registrationHash(data)});
}
