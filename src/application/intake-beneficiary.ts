import type {Principal} from '../domain/model.ts';import type {ExternalResourceRef} from '../domain/external-resource.ts';
import {parseExternalResourceSelection,externalResourceSelectionKey} from '../domain/external-resource.ts';
import {uuidIdentifier} from '../domain/input-values.ts';import {formRecord,formRevision} from '../domain/form-schema.ts';
import {isOperator} from '../domain/policy.ts';import {requestHash} from '../domain/canonical.ts';import {instantMicros} from '../domain/business-calendar.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';import {fileProviderCall} from '../integrations/files/storage.ts';
import {intakeFailure} from './intake-context.ts';
export type IntakeBeneficiary=Readonly<{actorId:string;beneficiaryId:string;principalKind:'human';workspaceId:string;accountId:string;refs:readonly ExternalResourceRef[];capability:'intake.on_behalf';revision:number;expiresAt:string;active:true}>;
declare const proofBrand:unique symbol;export type VerifiedIntakeBeneficiary=Readonly<{[proofBrand]:true}>;
/** The implementation must qualify the requester, operator capability and complete
 * resource coverage from current server-side sources. No email/profile inference. */
export interface IntakeBeneficiaryDirectory{resolve(p:Principal,accountId:string,refs:readonly ExternalResourceRef[],candidateId:string,signal:AbortSignal):Promise<unknown>}
const denied=()=>intakeFailure('intake_delegation_denied',403);
/** A structural envelope alone never proves beneficiary identity. This factory owns
 * its trusted directory and issues opaque in-process proofs, not HTTP bearer tokens. */
export function createIntakeBeneficiaryVerifier(o:{directory:IntakeBeneficiaryDirectory;clock?:()=>string;timeoutMs?:number}){
 const clock=o.clock??(()=>new Date().toISOString()),proofs=new WeakMap<object,{principalHash:string;value:IntakeBeneficiary}>();
 const current=(p:Principal,v:IntakeBeneficiary)=>{if(p.kind!=='human'||!p.scopes.includes('tickets:write')||!p.scopes.includes('tickets:read')||!isOperator(p,p.workspaceId,v.accountId)||p.id!==v.actorId||p.workspaceId!==v.workspaceId||instantMicros(clock())>=instantMicros(v.expiresAt))throw denied();};
 async function resolve(person:Principal,rawAccount:string,rawRefs:readonly ExternalResourceRef[],rawCandidate:string,signal?:AbortSignal):Promise<VerifiedIntakeBeneficiary>{try{
  const p=freezeFormData(copyFormData(person)) as Principal,accountId=uuidIdentifier(rawAccount),refs=parseExternalResourceSelection(rawRefs),candidateId=uuidIdentifier(rawCandidate);
  if(candidateId===p.id||p.kind!=='human'||!isOperator(p,p.workspaceId,accountId)||!p.scopes.includes('tickets:write')||!p.scopes.includes('tickets:read'))throw denied();
  const r=formRecord(await fileProviderCall(s=>o.directory.resolve(p,accountId,refs,candidateId,s),o.timeoutMs??5000,signal),['actorId','beneficiaryId','principalKind','workspaceId','accountId','refs','capability','revision','expiresAt','active']);
  if(r.actorId!==p.id||r.beneficiaryId!==candidateId||r.principalKind!=='human'||r.workspaceId!==p.workspaceId||r.accountId!==accountId||externalResourceSelectionKey(parseExternalResourceSelection(r.refs))!==externalResourceSelectionKey(refs)||r.capability!=='intake.on_behalf'||r.active!==true)throw denied();
  formRevision(r.revision);instantMicros(r.expiresAt as string);const value=freezeFormData({...r,refs}) as IntakeBeneficiary;current(p,value);
  const proof=Object.freeze(Object.create(null)) as VerifiedIntakeBeneficiary;proofs.set(proof,{principalHash:requestHash(p),value});return proof;
 }catch{throw denied();}}
 function inspect(person:Principal,proof:unknown):IntakeBeneficiary{try{const p=copyFormData(person) as Principal,r=proof&&typeof proof==='object'?proofs.get(proof):undefined;if(!r||r.principalHash!==requestHash(p))throw denied();current(p,r.value);return r.value;}catch{throw denied();}}
 return Object.freeze({resolve,inspect});
}
