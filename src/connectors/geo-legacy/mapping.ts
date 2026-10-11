import {freezeFormData,copyFormData} from '../../../shared/form-rules.js';
import {compareInstants} from '../../../shared/instant.js';
import {requestHash} from '../../domain/canonical.ts';
import {uuidIdentifier,isPersistableText} from '../../domain/input-values.ts';
import {HelpdeskError} from '../../domain/errors.ts';
import {parseExternalResourceSelection,externalResourceKey,type ExternalResourceRef} from '../../domain/external-resource.ts';
import {releaseRecord,releaseDigest,releaseInteger,releaseInstant} from '../../domain/release-manifest.ts';

/** Internal normalized export envelope. NOT the legacy API, identity or import permission. */
export type LegacyRecordRef=Readonly<{sourceSystem:'GEO_LEGACY';connectionId:string;tenantId:string;type:string;id:string;legacyCode:string}>;
export type LegacyAttachment=Readonly<{id:string;sha256:string;bytes:number;objectVersion:string;scanStatus:'clean'|'pending_scan'|'rejected'|'unsupported';retainUntil:string}>;
export type LegacyHistoryRecord=Readonly<{ref:LegacyRecordRef;sourceRevision:string;createdAt:string;updatedAt:string;retainUntil:string;actor:Readonly<{kind:'named'|'shared'|'unknown';sourceId:string|null}>;resources:readonly ExternalResourceRef[];payloadSha256:string;payloadBytes:number;attachments:readonly LegacyAttachment[]}>;
export type LegacyTarget=Readonly<{workspaceId:string;accountId:string;productInstanceId:string;bindingId:string}>;
export type LegacyMapping=Readonly<{schema:1;sourceSystem:'GEO_LEGACY';connectionId:string;revision:string;contractHash:string;asOf:string;expiresAt:string;entries:readonly Readonly<LegacyTarget&{tenantId:string;type:string;id:string}>[]}>;
export type LegacyHistoryBatch=Readonly<{schema:1;sourceSystem:'GEO_LEGACY';connectionId:string;exportId:string;exportedAt:string;expectedCount:number;recordsHash:string;records:readonly LegacyHistoryRecord[]}>;
export type LegacyHistoryPlan=Readonly<{kind:'legacy_history_dry_run';importAllowed:false;recordsWritten:0;grantsCreated:0;sessionsCreated:0;notificationsCreated:0;slaRecalculations:0;exportId:string;batchHash:string;mappingHash:string;checkedAt:string;records:readonly Readonly<{sourceKey:string;recordHash:string;state:'quarantined'|'unchanged'|'requires_byte_verification';reasons:readonly string[];target:LegacyTarget|null;actor:Readonly<{kind:'historical_reference';referenceHash:string}>|Readonly<{kind:'historical_unknown'}>}>[]}>;
const invalid=()=>new HelpdeskError(400,'legacy_history_invalid','Exportação ou mapeamento legado inválido. Nenhum registro foi importado.');
function text(v:unknown,max=256):string{if(!isPersistableText(v)||!v.length||v.length>max||v.trim()!==v||/[\p{Cc}]/u.test(v))throw invalid();return v;}
function type(v:unknown):string{const s=text(v,32);if(!/^[a-z][a-z0-9_]*$/.test(s))throw invalid();return s;}
function list(v:unknown,max:number,min=0):unknown[]{if(!Array.isArray(v)||v.length<min||v.length>max)throw invalid();return v;}
const resourceIdentity=(r:{tenantId:string;type:string;id:string})=>JSON.stringify([r.tenantId,r.type,r.id]);
export function parseLegacyRecordRef(raw:unknown):LegacyRecordRef{try{
 const r=releaseRecord(raw,['sourceSystem','connectionId','tenantId','type','id','legacyCode']);if(r.sourceSystem!=='GEO_LEGACY')throw invalid();r.connectionId=uuidIdentifier(r.connectionId);text(r.tenantId);type(r.type);text(r.id);text(r.legacyCode);return freezeFormData(r) as unknown as LegacyRecordRef;
}catch{throw invalid();}}
/** Stable source key excludes the DISPLAY legacy code; changing that code is a
 * content revision/conflict, not a way to create another imported record. */
export function legacyRecordKey(raw:unknown):string{const r=parseLegacyRecordRef(raw);return requestHash(['helpdesk-legacy-record-v1',r.sourceSystem,r.connectionId,r.tenantId,r.type,r.id]);}
export function parseLegacyHistoryRecord(raw:unknown):LegacyHistoryRecord{try{
 const r=releaseRecord(raw,['ref','sourceRevision','createdAt','updatedAt','retainUntil','actor','resources','payloadSha256','payloadBytes','attachments']);const ref=parseLegacyRecordRef(r.ref);r.ref=ref;text(r.sourceRevision);
 if(compareInstants(releaseInstant(r.createdAt),releaseInstant(r.updatedAt))>0||compareInstants(r.createdAt as string,releaseInstant(r.retainUntil))>0)throw invalid();
 const actor=releaseRecord(r.actor,['kind','sourceId']);if(!['named','shared','unknown'].includes(actor.kind as string)||actor.kind==='unknown'&&actor.sourceId!==null)throw invalid();if(actor.kind!=='unknown')text(actor.sourceId);r.actor=actor;
 const refs=parseExternalResourceSelection(r.resources);if(refs.some(v=>v.connectionId!==ref.connectionId||v.tenantId!==ref.tenantId))throw invalid();r.resources=[...refs].sort((a,b)=>externalResourceKey(a)<externalResourceKey(b)?-1:1);
 releaseDigest(r.payloadSha256);releaseInteger(r.payloadBytes,1);if(Number(r.payloadBytes)>16777216)throw invalid();
 const attachments=list(r.attachments,100).map(x=>{const a=releaseRecord(x,['id','sha256','bytes','objectVersion','scanStatus','retainUntil']);text(a.id);text(a.objectVersion);releaseDigest(a.sha256);releaseInteger(a.bytes,1);if(Number(a.bytes)>104857600||!['clean','pending_scan','rejected','unsupported'].includes(a.scanStatus as string))throw invalid();releaseInstant(a.retainUntil);return a as unknown as LegacyAttachment;});
 if(new Set(attachments.map(v=>v.id)).size!==attachments.length)throw invalid();r.attachments=attachments.sort((a,b)=>a.id<b.id?-1:1);
 return freezeFormData(r) as unknown as LegacyHistoryRecord;
}catch{throw invalid();}}
export function parseLegacyMapping(raw:unknown):LegacyMapping{try{
 const r=releaseRecord(raw,['schema','sourceSystem','connectionId','revision','contractHash','asOf','expiresAt','entries']);if(r.schema!==1||r.sourceSystem!=='GEO_LEGACY')throw invalid();r.connectionId=uuidIdentifier(r.connectionId);text(r.revision);releaseDigest(r.contractHash);if(compareInstants(releaseInstant(r.asOf),releaseInstant(r.expiresAt))>=0)throw invalid();
 const entries=list(r.entries,1000).map(v=>{const e=releaseRecord(v,['tenantId','type','id','workspaceId','accountId','productInstanceId','bindingId']);text(e.tenantId);type(e.type);text(e.id);for(const k of ['workspaceId','accountId','productInstanceId','bindingId'])e[k]=uuidIdentifier(e[k]);return e as unknown as LegacyMapping['entries'][number];});
 if(new Set(entries.map(resourceIdentity)).size!==entries.length)throw invalid();r.entries=entries.sort((a,b)=>resourceIdentity(a)<resourceIdentity(b)?-1:1);return freezeFormData(r) as unknown as LegacyMapping;
}catch{throw invalid();}}
export function legacyMappingHash(raw:unknown):string{const m=parseLegacyMapping(raw);return requestHash(['helpdesk-legacy-mapping-v1',m.sourceSystem,m.connectionId,m.revision,m.contractHash,m.entries]);}
function records(raw:unknown):readonly LegacyHistoryRecord[]{const a=list(copyFormData(raw),200).map(parseLegacyHistoryRecord);if(new Set(a.map(v=>legacyRecordKey(v.ref))).size!==a.length)throw invalid();return a.sort((a,b)=>legacyRecordKey(a.ref)<legacyRecordKey(b.ref)?-1:1);}
export function legacyBatchHash(raw:unknown):string{try{return requestHash(['helpdesk-legacy-export-records-v1',records(raw)]);}catch{throw invalid();}}
export function parseLegacyHistoryBatch(raw:unknown):LegacyHistoryBatch{try{
 const r=releaseRecord(raw,['schema','sourceSystem','connectionId','exportId','exportedAt','expectedCount','recordsHash','records']);if(r.schema!==1||r.sourceSystem!=='GEO_LEGACY')throw invalid();r.connectionId=uuidIdentifier(r.connectionId);r.exportId=uuidIdentifier(r.exportId);releaseInstant(r.exportedAt);releaseInteger(r.expectedCount);releaseDigest(r.recordsHash);const rows=records(r.records);
 if(r.expectedCount!==rows.length||r.recordsHash!==legacyBatchHash(rows)||rows.some(x=>x.ref.connectionId!==r.connectionId||compareInstants(x.updatedAt,r.exportedAt as string)>0))throw invalid();r.records=rows;return freezeFormData(r) as unknown as LegacyHistoryBatch;
}catch{throw invalid();}}
export function parseRetainedLegacyIndex(raw:unknown){try{
 const r=releaseRecord(raw,['entries','revokedSourceKeys']);const entries=list(r.entries,2000).map(v=>{const e=releaseRecord(v,['sourceKey','recordHash','mappingHash']);Object.values(e).forEach(releaseDigest);return e as {sourceKey:string;recordHash:string;mappingHash:string};});
 const revoked=list(r.revokedSourceKeys,2000).map(releaseDigest);if(new Set(entries.map(v=>v.sourceKey)).size!==entries.length||new Set(revoked).size!==revoked.length)throw invalid();return freezeFormData({entries,revokedSourceKeys:revoked});
}catch{throw invalid();}}
/** Deterministic metadata dry-run. Inputs must come from qualified private export,
 * mapping and independently retained revocations. This does not authenticate that
 * provenance, read payloads, publish data, register people or run a historical import.
 */
export function planLegacyHistoryBatch(raw:unknown,mappingRaw:unknown,indexRaw:unknown,at:string):LegacyHistoryPlan{try{
 const b=parseLegacyHistoryBatch(raw),m=parseLegacyMapping(mappingRaw),index=parseRetainedLegacyIndex(indexRaw);releaseInstant(at);if(b.connectionId!==m.connectionId||compareInstants(b.exportedAt,at)>0)throw invalid();const mappingHash=legacyMappingHash(m);
 const planned=b.records.map(r=>{
  const sourceKey=legacyRecordKey(r.ref),recordHash=requestHash(r),reasons:string[]=[];
  if(compareInstants(m.asOf,at)>0||compareInstants(m.expiresAt,at)<=0)reasons.push('mapping_not_current');
  if(compareInstants(r.retainUntil,at)<=0)reasons.push('retention_expired');
  if(index.revokedSourceKeys.includes(sourceKey))reasons.push('retained_revocation');
  if(r.attachments.some(a=>a.scanStatus!=='clean'||compareInstants(a.retainUntil,at)<=0))reasons.push('attachment_not_qualified');
  const mapped=r.resources.map(x=>m.entries.find(e=>resourceIdentity(e)===resourceIdentity(x)));let target:LegacyTarget|null=null;
  if(mapped.some(x=>!x))reasons.push('unmapped_resource');else{
   const targets=mapped.map(e=>({workspaceId:e!.workspaceId,accountId:e!.accountId,productInstanceId:e!.productInstanceId,bindingId:e!.bindingId}));
   if(new Set(targets.map(requestHash)).size!==1)reasons.push('mixed_target_context');else target=targets[0]!;
  }
  const prior=index.entries.find(e=>e.sourceKey===sourceKey);if(prior&&(prior.recordHash!==recordHash||prior.mappingHash!==mappingHash))reasons.push('existing_record_conflict');
  const state=reasons.length?'quarantined':prior?'unchanged':'requires_byte_verification';
  const actor=r.actor.kind==='named'?{kind:'historical_reference' as const,referenceHash:requestHash(['legacy-passive-actor',r.ref.connectionId,r.ref.tenantId,r.actor.sourceId])}:{kind:'historical_unknown' as const};
  return {sourceKey,recordHash,state,reasons,target:reasons.length?null:target,actor};
 });
 return freezeFormData({kind:'legacy_history_dry_run',importAllowed:false,recordsWritten:0,grantsCreated:0,sessionsCreated:0,notificationsCreated:0,slaRecalculations:0,exportId:b.exportId,batchHash:b.recordsHash,mappingHash,checkedAt:at,records:planned}) as LegacyHistoryPlan;
}catch{throw invalid();}}
