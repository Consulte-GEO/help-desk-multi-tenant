import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {compareInstants,isCanonicalInstant} from '../../shared/instant.js';
import {requestHash} from './canonical.ts';import {uuidIdentifier} from './input-values.ts';import {HelpdeskError} from './errors.ts';
import {parseExternalResourceSelection,externalResourceKey,type ExternalResourceRef} from './external-resource.ts';

/** Operational attestations are private server inputs. Parsing is NOT provenance or approval. */
export const RELEASE_FEATURES=['core','external_identity','attachments','approvals','email','exports','packages','knowledge','csat','gtc'] as const;
export type ReleaseFeature=typeof RELEASE_FEATURES[number];
export type ReleaseIdentity=Readonly<{sourceSha:string;sourceFingerprint:string;apiVersion:string;schemaVersion:string;configDigest:string;providerDigest:string;netlifySiteId:string;supabaseProjectId:string;deployId:string;recoveryEpoch:string}>;
export type PilotCohort=Readonly<{id:string;workspaceId:string;accountId:string;productInstanceId:string;categoryId:string;channelId:string;personIds:readonly string[];refs:readonly ExternalResourceRef[];features:readonly ReleaseFeature[]}>;
export type ReleaseManifest=Readonly<{schema:1;releaseId:string;identity:ReleaseIdentity;validFrom:string;expiresAt:string;policySetDigest:string;cohorts:readonly PilotCohort[]}>;
export type PilotRequestScope=Readonly<{workspaceId:string;principalId:string;accountId:string;productInstanceId:string;categoryId:string;channelId:string;refs:readonly ExternalResourceRef[];feature:ReleaseFeature}>;
export const releaseFailure=(code='release_manifest_invalid',status=400)=>new HelpdeskError(status,code,'Não foi possível validar a liberação deste escopo. O atendimento permanece fechado.');
export function releaseRecord(raw:unknown,keys:readonly string[]):Record<string,unknown>{try{const r=copyFormData(raw) as Record<string,unknown>;if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==keys.length||keys.some(k=>!Object.hasOwn(r,k)))throw Error();return r;}catch{throw releaseFailure();}}
export function releaseReference(raw:unknown,max=160):string{if(typeof raw!=='string'||raw.length>max||!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(raw))throw releaseFailure();return raw;}
export function releaseDigest(raw:unknown):string{if(typeof raw!=='string'||!/^[a-f0-9]{64}$/.test(raw))throw releaseFailure();return raw;}
export function releaseInteger(raw:unknown,min=0):number{if(!Number.isSafeInteger(raw)||Number(raw)<min)throw releaseFailure();return raw as number;}
export function releaseInstant(raw:unknown):string{if(!isCanonicalInstant(raw))throw releaseFailure();return raw;}
function list(raw:unknown,min:number,max:number):unknown[]{if(!Array.isArray(raw)||raw.length<min||raw.length>max)throw releaseFailure();return raw;}
const identityKeys=['sourceSha','sourceFingerprint','apiVersion','schemaVersion','configDigest','providerDigest','netlifySiteId','supabaseProjectId','deployId','recoveryEpoch'];
export function parseReleaseIdentity(raw:unknown):ReleaseIdentity{try{const r=releaseRecord(raw,identityKeys);if(typeof r.sourceSha!=='string'||!/^[a-f0-9]{40}$/.test(r.sourceSha)||typeof r.supabaseProjectId!=='string'||!/^[a-z]{20}$/.test(r.supabaseProjectId)||typeof r.deployId!=='string'||!/^[a-f0-9]{24}$/.test(r.deployId))throw Error();for(const k of ['apiVersion','schemaVersion'])if(typeof r[k]!=='string'||!/^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(r[k] as string))throw Error();for(const k of ['sourceFingerprint','configDigest','providerDigest'])releaseDigest(r[k]);r.netlifySiteId=uuidIdentifier(r.netlifySiteId);r.recoveryEpoch=uuidIdentifier(r.recoveryEpoch);return freezeFormData(r) as unknown as ReleaseIdentity;}catch{throw releaseFailure();}}
function features(raw:unknown):readonly ReleaseFeature[]{const x=list(raw,1,RELEASE_FEATURES.length);if(new Set(x).size!==x.length||!x.includes('core')||x.some(f=>!RELEASE_FEATURES.includes(f as ReleaseFeature)))throw releaseFailure();return Object.freeze([...(x as ReleaseFeature[])].sort());}
function sortedRefs(raw:unknown){return Object.freeze([...parseExternalResourceSelection(raw)].sort((a,b)=>externalResourceKey(a)<externalResourceKey(b)?-1:1));}
function cohort(raw:unknown):PilotCohort{const c=releaseRecord(raw,['id','workspaceId','accountId','productInstanceId','categoryId','channelId','personIds','refs','features']);for(const k of ['id','workspaceId','accountId','productInstanceId'])c[k]=uuidIdentifier(c[k]);for(const k of ['categoryId','channelId'])releaseReference(c[k],80);const people=list(c.personIds,1,250).map(uuidIdentifier);if(new Set(people).size!==people.length)throw releaseFailure();c.personIds=people.sort();c.refs=sortedRefs(c.refs);c.features=features(c.features);return freezeFormData(c) as unknown as PilotCohort;}
export function parseReleaseManifest(raw:unknown):ReleaseManifest{try{const r=releaseRecord(raw,['schema','releaseId','identity','validFrom','expiresAt','policySetDigest','cohorts']);if(r.schema!==1)throw Error();r.releaseId=uuidIdentifier(r.releaseId);r.identity=parseReleaseIdentity(r.identity);releaseDigest(r.policySetDigest);if(compareInstants(releaseInstant(r.validFrom),releaseInstant(r.expiresAt))>=0)throw Error();const c=list(r.cohorts,1,100).map(cohort);if(new Set(c.map(x=>x.id)).size!==c.length)throw Error();r.cohorts=c.sort((a,b)=>a.id<b.id?-1:1);return freezeFormData(r) as unknown as ReleaseManifest;}catch{throw releaseFailure();}}
export const releaseManifestHash=(m:unknown)=>requestHash(parseReleaseManifest(m));
export function parsePilotRequestScope(raw:unknown):PilotRequestScope{try{const r=releaseRecord(raw,['workspaceId','principalId','accountId','productInstanceId','categoryId','channelId','refs','feature']);for(const k of ['workspaceId','principalId','accountId','productInstanceId'])r[k]=uuidIdentifier(r[k]);for(const k of ['categoryId','channelId'])releaseReference(r[k],80);r.refs=sortedRefs(r.refs);if(!RELEASE_FEATURES.includes(r.feature as ReleaseFeature))throw Error();return freezeFormData(r) as unknown as PilotRequestScope;}catch{throw releaseFailure();}}
/** No Cartesian product of different cohorts. One row must cover the entire context.
 * This returns rollout eligibility only; the existing data ACL must ALSO authorize. */
export function matchPilotCohort(raw:unknown,scopeRaw:unknown):PilotCohort|null{const m=parseReleaseManifest(raw),s=parsePilotRequestScope(scopeRaw);const matches=m.cohorts.filter(c=>c.workspaceId===s.workspaceId&&c.accountId===s.accountId&&c.productInstanceId===s.productInstanceId&&c.categoryId===s.categoryId&&c.channelId===s.channelId&&c.personIds.includes(s.principalId)&&c.features.includes(s.feature)&&s.refs.every(ref=>c.refs.some(r=>externalResourceKey(r)===externalResourceKey(ref))));return matches.length===1?matches[0]!:null;}

export const RELEASE_REQUIREMENTS=freezeFormData({
 ci:{environment:'ci_linux',checks:['lock','tests','contracts','migrations','secretScan','typecheck','build','audit']},
 postgres:{environment:'owned_pg17',checks:['resourceIsolation','upgrade','oldUsers','rls','concurrency']},
 browser:{environment:'owned_browser',checks:['desktop','mobile','csp','keyboard','audienceClear']},
 security:{environment:'hosted_existing',checks:['auth','privileges','ssrf','notesIsolation','exportIsolation','findingsTriaged']},
 capacity:{environment:'hosted_existing',checks:['targetsAccepted','noisyNeighbor','pooler','limits','costsMeasured']},
 restore:{environment:'authorized_isolated_restore',checks:['database','objects','configuration','keyReferences','counts','hashes','noReplayedDeliveries','noResurrectedData','rpoRtoAccepted']},
 review:{environment:'independent_review',checks:['notAuthor','findingsResolved']},
 operations:{environment:'owner_acceptance',checks:['owners','policies','runbooks','containment','providers','training']},
 external_identity:{environment:'hosted_existing',checks:['oidc','twoPeople','scopeRevocation']},
 attachments:{environment:'hosted_existing',checks:['privateStorage','realScanner','downloadRevocation','cleanup','costs']},
 approvals:{environment:'hosted_existing',checks:['currentPerson','currentRevision','duplicateDecision']},
 email:{environment:'hosted_existing',checks:['provider','dns','unknownOutcome','deliveryLedger','noPrivateNotes']},
 exports:{environment:'hosted_existing',checks:['completeUniverse','downloadRevocation','privateStorage']},
 packages:{environment:'hosted_existing',checks:['qualifiedProducer','realScanner','objectRestore']},
 knowledge:{environment:'hosted_existing',checks:['editorialSource','audience']},
 csat:{environment:'hosted_existing',checks:['invitation','useOnce','limits']},
 gtc:{environment:'hosted_existing',checks:['qualifiedContract','signature','releaseEvidence','noAutomaticClose']},
});
export type ReleaseGate=keyof typeof RELEASE_REQUIREMENTS;
export type ReleaseEvidence=Readonly<{id:string;kind:ReleaseGate;manifestHash:string;artifactHash:string;environment:string;status:'passed'|'failed'|'inconclusive';checkedAt:string;validUntil:string;checks:Readonly<Record<string,boolean>>;tests:Readonly<{total:number;passed:number;failed:number;skipped:number;cancelled:number;todo:number}>|null}>;
const baseGates:readonly ReleaseGate[]=['ci','postgres','browser','security','capacity','restore','review','operations'];
export function parseReleaseEvidence(raw:unknown):ReleaseEvidence{try{const r=releaseRecord(raw,['id','kind','manifestHash','artifactHash','environment','status','checkedAt','validUntil','checks','tests']);releaseReference(r.id);if(typeof r.kind!=='string'||!Object.hasOwn(RELEASE_REQUIREMENTS,r.kind))throw Error();const kind=r.kind as ReleaseGate;releaseDigest(r.manifestHash);releaseDigest(r.artifactHash);releaseReference(r.environment,80);if(!['passed','failed','inconclusive'].includes(r.status as string)||compareInstants(releaseInstant(r.checkedAt),releaseInstant(r.validUntil))>=0)throw Error();r.checks=releaseRecord(r.checks,RELEASE_REQUIREMENTS[kind].checks);if(Object.values(r.checks as object).some(v=>typeof v!=='boolean'))throw Error();if(r.tests!==null){const t=releaseRecord(r.tests,['total','passed','failed','skipped','cancelled','todo']);Object.values(t).forEach(v=>releaseInteger(v));r.tests=t;}return freezeFormData(r) as unknown as ReleaseEvidence;}catch{throw releaseFailure();}}
export type ReadinessReport=Readonly<{state:'blocked'|'eligible_for_pilot';operational:false;manifestHash:string;validUntil:string;blockers:readonly Readonly<{gate:string;reason:string}>[]}>;
/** Structural evaluation only. A trusted attestor must first verify original reports,
 * artifact bytes/digests, actual environment and owner acceptance. Booleans do not
 * prove a test happened. No local script or unsigned JSON can mint the opaque proof. */
export function evaluateReleaseReadiness(raw:unknown,evidenceRaw:unknown,observedRaw:unknown,at:string):ReadinessReport{
 const m=parseReleaseManifest(raw),observed=parseReleaseIdentity(observedRaw);releaseInstant(at);const h=releaseManifestHash(m);
 const e=list(copyFormData(evidenceRaw),0,32).map(parseReleaseEvidence);if(new Set(e.map(x=>x.kind)).size!==e.length||new Set(e.map(x=>x.id)).size!==e.length)throw releaseFailure();
 const blockers:{gate:string;reason:string}[]=[];let until=m.expiresAt;
 if(requestHash(m.identity)!==requestHash(observed))blockers.push({gate:'identity',reason:'source_or_destination_changed'});
 if(compareInstants(at,m.validFrom)<0||compareInstants(at,m.expiresAt)>=0)blockers.push({gate:'validity',reason:'outside_release_window'});
 const required=new Set<ReleaseGate>(baseGates);for(const c of m.cohorts)for(const f of c.features)if(f!=='core')required.add(f);
 // CG-14 depends on CG-07/11/12 even when only package delivery is announced.
 if(required.has('packages'))for(const kind of ['attachments','approvals','email'] as const)required.add(kind);
 for(const kind of required){const x=e.find(v=>v.kind===kind);if(!x){blockers.push({gate:kind,reason:'missing_evidence'});continue;}
  if(compareInstants(x.validUntil,until)<0)until=x.validUntil;
  const t=x.tests,testGate=['ci','postgres','browser'].includes(kind);
  if(x.manifestHash!==h||x.status!=='passed'||x.environment!==RELEASE_REQUIREMENTS[kind].environment||compareInstants(x.checkedAt,at)>0||compareInstants(x.validUntil,at)<=0||Object.values(x.checks).some(v=>v!==true)||testGate&&(!t||t.total<1||t.passed!==t.total||t.failed!==0||t.skipped!==0||t.cancelled!==0||t.todo!==0))blockers.push({gate:kind,reason:'evidence_not_acceptable'});
 }
 return freezeFormData({state:blockers.length?'blocked':'eligible_for_pilot',operational:false,manifestHash:h,validUntil:until,blockers}) as ReadinessReport;
}
