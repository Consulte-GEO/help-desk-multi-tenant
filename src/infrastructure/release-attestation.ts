import {KeyObject,createHash,verify} from 'node:crypto';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {compareInstants} from '../../shared/instant.js';
import {canonicalJson} from '../domain/canonical.ts';import {uuidIdentifier} from '../domain/input-values.ts';
import {releaseRecord,releaseReference,releaseInteger,releaseDigest,releaseInstant,releaseFailure,parseReleaseManifest,parseReleaseEvidence,evaluateReleaseReadiness,type ReleaseManifest,type ReleaseEvidence,type ReleaseIdentity,type ReadinessReport} from '../domain/release-manifest.ts';

declare const releaseBrand:unique symbol;declare const acceptanceBrand:unique symbol;
export type VerifiedReleaseProof=Readonly<{[releaseBrand]:true}>;
export type VerifiedPilotAcceptance=Readonly<{[acceptanceBrand]:true}>;
export type TrustedReleaseKey=Readonly<{id:string;publicKey:KeyObject;enabled:boolean;validFrom:string;expiresAt:string;purposes:readonly ('release'|'acceptance')[]}>;
export type ReleaseOwner=Readonly<{role:'support'|'security'|'customer';principalId:string;decisionRef:string}>;
export type AttestedRelease=Readonly<{manifest:ReleaseManifest;evidence:readonly ReleaseEvidence[];owners:readonly ReleaseOwner[]}>;
export type PilotAcceptance=Readonly<{pilotId:string;pilotRevision:number;manifestHash:string;startedAt:string;completedAt:string;validUntil:string;ownerId:string;decisionRef:string;checks:Readonly<Record<string,boolean>>}>;
const invalid=()=>releaseFailure('release_attestation_invalid',503);
const ACCEPTANCE_CHECKS=['journey','crossWork','crossTenant','nonPilotDenied','replay','notifications','downloads','training','containment'];
function parseReleasePayload(raw:unknown):AttestedRelease{
 const r=releaseRecord(raw,['manifest','evidence','owners']);r.manifest=parseReleaseManifest(r.manifest);
 if(!Array.isArray(r.evidence)||r.evidence.length>32||!Array.isArray(r.owners)||r.owners.length!==3)throw invalid();
 r.evidence=r.evidence.map(parseReleaseEvidence);
 const roles=new Set<string>(),people=new Set<string>();r.owners=r.owners.map(rawOwner=>{const owner=releaseRecord(rawOwner,['role','principalId','decisionRef']);if(!['support','security','customer'].includes(owner.role as string)||roles.has(owner.role as string))throw invalid();roles.add(owner.role as string);owner.principalId=uuidIdentifier(owner.principalId);people.add(owner.principalId as string);releaseReference(owner.decisionRef);return owner;});
 // Conservative organizational separation, not a declaration of who the real owners are.
 if(people.size<2)throw invalid();return freezeFormData(r) as unknown as AttestedRelease;
}
function parseAcceptance(raw:unknown,at:string):PilotAcceptance{
 const r=releaseRecord(raw,['pilotId','pilotRevision','manifestHash','startedAt','completedAt','validUntil','ownerId','decisionRef','checks']);r.pilotId=uuidIdentifier(r.pilotId);r.ownerId=uuidIdentifier(r.ownerId);releaseInteger(r.pilotRevision,1);releaseDigest(r.manifestHash);releaseReference(r.decisionRef);r.checks=releaseRecord(r.checks,ACCEPTANCE_CHECKS);
 if(Object.values(r.checks as object).some(v=>v!==true)||compareInstants(releaseInstant(r.startedAt),releaseInstant(r.completedAt))>0||compareInstants(r.completedAt as string,at)>0||compareInstants(releaseInstant(r.validUntil),at)<=0)throw invalid();return freezeFormData(r) as unknown as PilotAcceptance;
}
/** Verifies provenance of an operator/CI attestation, NOT the honesty of its claims.
 * The attestor must inspect original artifact bytes, real tests, signed owner records
 * and deployment metadata. No signing endpoint/private key is implemented here.
 * keys() is a synchronous server-owned configuration snapshot. Reloading/revoking
 * the key invalidates already-issued proofs; no key is taken from the envelope.
 */
export function createReleaseAttestationVerifier(o:{keys:()=>readonly TrustedReleaseKey[];clock?:()=>string}){
 const clock=o.clock??(()=>new Date().toISOString());
 type RecordProof={purpose:'release'|'acceptance';keyId:string;keyHash:string;payload:AttestedRelease|PilotAcceptance;lastAt:string;until:string};
 const proofs=new WeakMap<object,RecordProof>();
 const now=()=>{try{return releaseInstant(clock());}catch{throw invalid();}};
 function key(id:string,purpose:RecordProof['purpose'],at:string){
  const keys=o.keys();if(!Array.isArray(keys)||!keys.length||keys.length>16||new Set(keys.map(k=>k.id)).size!==keys.length)throw invalid();
  const k=keys.find(k=>k.id===id);if(!k||k.enabled!==true||!(k.publicKey instanceof KeyObject)||k.publicKey.type!=='public'||k.publicKey.asymmetricKeyType!=='ed25519'||!k.purposes.includes(purpose)||compareInstants(releaseInstant(k.validFrom),at)>0||compareInstants(releaseInstant(k.expiresAt),at)<=0)throw invalid();
  return {publicKey:k.publicKey,hash:createHash('sha256').update(k.publicKey.export({type:'spki',format:'der'})).digest('hex')};
 }
 function envelope(raw:unknown,purpose:RecordProof['purpose'],at:string){try{
  const r=releaseRecord(raw,['keyId','payload','signature']),id=releaseReference(r.keyId,80),k=key(id,purpose,at);
  if(typeof r.signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(r.signature))throw invalid();const bytes=Buffer.from(r.signature,'base64url');if(bytes.length!==64||bytes.toString('base64url')!==r.signature)throw invalid();
  const data=Buffer.from(canonicalJson(['helpdesk-operational-attestation-v1',purpose,r.payload]));if(data.length>262144||!verify(null,data,k.publicKey,bytes))throw invalid();return {payload:r.payload,keyId:id,keyHash:k.hash};
 }catch{throw invalid();}}
 function mint(record:RecordProof){const proof=Object.freeze(Object.create(null)) as object;proofs.set(proof,record);return proof;}
 function record(proof:unknown,purpose:RecordProof['purpose']):RecordProof{try{
  if(!proof||typeof proof!=='object')throw invalid();const r=proofs.get(proof),at=now();if(!r||r.purpose!==purpose||compareInstants(at,r.lastAt)<0||compareInstants(at,r.until)>=0||key(r.keyId,purpose,at).hash!==r.keyHash)throw invalid();r.lastAt=at;return r;
 }catch{if(proof&&typeof proof==='object')proofs.delete(proof);throw invalid();}}
 function verifyRelease(raw:unknown,observed:ReleaseIdentity):VerifiedReleaseProof{
  const at=now(),e=envelope(raw,'release',at);let p:AttestedRelease;try{p=parseReleasePayload(e.payload);}catch{throw invalid();}
  const report=evaluateReleaseReadiness(p.manifest,p.evidence,observed,at);if(report.state!=='eligible_for_pilot')throw releaseFailure('release_evidence_incomplete',503);
  return mint({purpose:'release',keyId:e.keyId,keyHash:e.keyHash,payload:p,lastAt:at,until:report.validUntil}) as VerifiedReleaseProof;
 }
 function readRelease(proof:unknown,observed:ReleaseIdentity):Readonly<AttestedRelease&{report:ReadinessReport}>{
  const r=record(proof,'release'),p=r.payload as AttestedRelease;try{const report=evaluateReleaseReadiness(p.manifest,p.evidence,observed,r.lastAt);if(report.state!=='eligible_for_pilot')throw invalid();return freezeFormData({...p,report});}catch{proofs.delete(proof as object);throw invalid();}
 }
 function verifyAcceptance(raw:unknown):VerifiedPilotAcceptance{const at=now(),e=envelope(raw,'acceptance',at);let p:PilotAcceptance;try{p=parseAcceptance(e.payload,at);}catch{throw invalid();}return mint({purpose:'acceptance',keyId:e.keyId,keyHash:e.keyHash,payload:p,lastAt:at,until:p.validUntil}) as VerifiedPilotAcceptance;}
 function readAcceptance(proof:unknown):PilotAcceptance{const r=record(proof,'acceptance');return r.payload as PilotAcceptance;}
 return Object.freeze({verifyRelease,readRelease,verifyAcceptance,readAcceptance});
}
export type ReleaseAttestationVerifier=ReturnType<typeof createReleaseAttestationVerifier>;
