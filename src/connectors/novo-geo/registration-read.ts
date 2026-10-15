import {copyRegistrationValue,registrationRecord,registrationRef,registrationRevision,registrationHash,registrationInstant,registrationFailure} from '../../domain/registration-canonical.ts';
import {parseRegistrationDraft,type RegistrationDraft,type RegistrationInputSnapshot} from '../../domain/registration-contracts.ts';

export type OriginPreviewIssue=Readonly<{code:'beneficiary_inactive'|'work_inactive'|'link_exists'|'scope_denied'|'missing_reference'|'rule_changed';field:'sourceBeneficiaryKey'|'sourceWorkKey'|'requestConfirmation'|'target'}>;
export type OriginPreviewDependency=Readonly<{kind:'user'|'work';key:string;state:'satisfied'|'inactive'|'missing'|'denied'}>;
export type OriginPreview=Readonly<{
  schema:1;operationId:string;draftRevision:number;previewRef:string;sourceContractVersion:string;actionSchemaHash:string;targetHash:string;payloadHash:string;effectsHash:string;
  originAccessRevision:string|null;status:'valid'|'invalid'|'conflict';validationIssues:readonly OriginPreviewIssue[];dependencies:readonly OriginPreviewDependency[];
  observedAt:string;expiresAt:string;effectsExecuted:false;
}>;
export type OriginPreviewExpectation=Readonly<{draft:RegistrationDraft;sourceContractVersion:string;at:string;policy:Readonly<{maxAgeMs:number;maxTtlMs:number}>}>;
export type OriginPreviewCandidate=Readonly<{kind:'validated_preview_candidate';preview:OriginPreview;previewHash:string;liveAdapterAllowed:false;executionAllowed:false}>;
/** A port specification, not the discovery of an existing Novo GEO HTTP endpoint. */
export interface RegistrationSourceReadPort {
  readonly liveAdapterAllowed:boolean;
  readContext(snapshot:RegistrationInputSnapshot,signal:AbortSignal):Promise<unknown>;
  preview(draft:RegistrationDraft,signal:AbortSignal):Promise<unknown>;
}
/** Strict candidate parsing. Signature/auth/ACL verification and real side-effect tests
 * belong to HDA-05.preview-real. An output from this function never enables execution.
 */
export function parseOriginPreviewCandidate(raw:unknown,expected:OriginPreviewExpectation):OriginPreviewCandidate {
  const e=registrationRecord(expected,['draft','sourceContractVersion','at','policy']),draft=parseRegistrationDraft(e.draft),sourceContractVersion=registrationRef(e.sourceContractVersion),at=registrationInstant(e.at);
  const policy=registrationRecord(e.policy,['maxAgeMs','maxTtlMs']),maxAgeMs=registrationRevision(policy.maxAgeMs),maxTtlMs=registrationRevision(policy.maxTtlMs);
  if(maxAgeMs>86400000||maxTtlMs>86400000)throw registrationFailure();
  const x=registrationRecord(raw,['schema','operationId','draftRevision','previewRef','sourceContractVersion','actionSchemaHash','targetHash','payloadHash','effectsHash','originAccessRevision','status','validationIssues','dependencies','observedAt','expiresAt','effectsExecuted']);
  if(x.schema!==1||x.operationId!==draft.operationId||x.draftRevision!==draft.draftRevision||x.sourceContractVersion!==sourceContractVersion||x.actionSchemaHash!==draft.actionSchemaHash||x.targetHash!==draft.targetHash||x.payloadHash!==draft.payloadHash||x.effectsHash!==draft.effectsHash||x.originAccessRevision!==draft.target.originAccessRevision||x.effectsExecuted!==false)throw registrationFailure('registration_preview_mismatch',409);
  if(!['valid','invalid','conflict'].includes(x.status as string))throw registrationFailure();
  const observedAt=registrationInstant(x.observedAt),expiresAt=registrationInstant(x.expiresAt),nowMs=Date.parse(at),observedMs=Date.parse(observedAt),expiresMs=Date.parse(expiresAt);
  if(observedMs>nowMs||expiresMs<=nowMs||nowMs-observedMs>maxAgeMs||expiresMs-observedMs>maxTtlMs)throw registrationFailure('registration_preview_expired',409);
  const rawIssues=copyRegistrationValue(x.validationIssues);if(!Array.isArray(rawIssues)||rawIssues.length>20)throw registrationFailure();
  const issueKeys=new Set<string>();
  const validationIssues=Object.freeze(rawIssues.map(raw=>{
    const i=registrationRecord(raw,['code','field']);
    if(!['beneficiary_inactive','work_inactive','link_exists','scope_denied','missing_reference','rule_changed'].includes(i.code as string)||!['sourceBeneficiaryKey','sourceWorkKey','requestConfirmation','target'].includes(i.field as string))throw registrationFailure();
    const key=i.code+':'+i.field;if(issueKeys.has(key))throw registrationFailure();issueKeys.add(key);
    return Object.freeze({code:i.code as OriginPreviewIssue['code'],field:i.field as OriginPreviewIssue['field']});
  }));
  const rawDependencies=copyRegistrationValue(x.dependencies);if(!Array.isArray(rawDependencies)||rawDependencies.length!==2)throw registrationFailure();
  const kinds=new Set<string>();
  const dependencies=Object.freeze(rawDependencies.map(raw=>{
    const d=registrationRecord(raw,['kind','key','state']);
    if(!['user','work'].includes(d.kind as string)||!['satisfied','inactive','missing','denied'].includes(d.state as string)||kinds.has(d.kind as string))throw registrationFailure();
    kinds.add(d.kind as string);const key=registrationRef(d.key),expectedKey=d.kind==='user'?draft.target.sourceBeneficiaryKey:draft.target.sourceWorkKey;
    if(key!==expectedKey)throw registrationFailure('registration_preview_mismatch',409);
    return Object.freeze({kind:d.kind as OriginPreviewDependency['kind'],key,state:d.state as OriginPreviewDependency['state']});
  }));
  if(x.status==='valid'?(validationIssues.length>0||dependencies.some(d=>d.state!=='satisfied')):validationIssues.length===0)throw registrationFailure('registration_preview_inconsistent',409);
  const preview:OriginPreview=Object.freeze({schema:1,operationId:draft.operationId,draftRevision:draft.draftRevision,previewRef:registrationRef(x.previewRef),sourceContractVersion,actionSchemaHash:draft.actionSchemaHash,targetHash:draft.targetHash,payloadHash:draft.payloadHash,effectsHash:draft.effectsHash,originAccessRevision:draft.target.originAccessRevision,status:x.status as OriginPreview['status'],validationIssues,dependencies,observedAt,expiresAt,effectsExecuted:false});
  return Object.freeze({kind:'validated_preview_candidate',preview,previewHash:registrationHash(preview),liveAdapterAllowed:false,executionAllowed:false});
}
/** Fail-closed placeholder for dependency injection, NEVER a mock-data fallback. */
export function createUnavailableRegistrationSourceReadPort():RegistrationSourceReadPort&Readonly<{liveAdapterAllowed:false}> {
  const unavailable=async():Promise<never>=>{throw registrationFailure('registration_source_unqualified',503);};
  return Object.freeze({liveAdapterAllowed:false,readContext:unavailable,preview:unavailable});
}
