import {HelpdeskError} from './errors.ts';
import {uuidIdentifier,isPersistableText} from './input-values.ts';
import {parseExternalResourceCoverage,externalResourceKey,type ExternalResourceRef} from './external-resource.ts';
import {requestHash} from './canonical.ts';
import {isCanonicalInstant,canonicalInstant,zonedInstantMicros} from '../../shared/instant.js';

const operations=['tickets.read','tickets.write','notes.read','notes.write'] as const;
/** Existing mapped server target, not evidence of an identity or an administrative grant. */
export type ResourceGrantTarget=Readonly<{
 principalId:string;workspaceId:string;accountId:string;bindingId:string;
 connectionId:string;tenantId:string;operation:typeof operations[number];
}>;
/** Internal complete observation. ONLY a qualified server source may provide it to a publisher.
 * `complete` is a shape requirement, NOT an approval flag or proof of source authenticity.
 */
export type ResourceGrantSnapshot=Readonly<{
 target:ResourceGrantTarget;manifestFingerprint:string;bindingRevision:string;accessRevision:string;
 asOf:string;expiresAt:string;state:'active'|'revoked';complete:true;resources:readonly ExternalResourceRef[];
}>;
export type ResourceGrantState=Readonly<{revision:string;snapshot:ResourceGrantSnapshot|null}>;
export type ResourcePublicationPlan=Readonly<{
 target:ResourceGrantTarget;expectedRevision:string;snapshot:ResourceGrantSnapshot;snapshotHash:string;
}>;
const MAX_REVISION=9223372036854775807n;
const invalid=()=>new HelpdeskError(400,'resource_publication_invalid','Publicação de cobertura inválida. Nenhuma permissão foi publicada.');
const conflict=()=>new HelpdeskError(409,'resource_publication_conflict','A revisão ou o conteúdo da cobertura mudou. Não foi feita substituição.');
const stale=()=>new HelpdeskError(409,'resource_publication_stale','Observação de cobertura vencida, futura ou anterior à já registrada.');
const targetFields=['principalId','workspaceId','accountId','bindingId','connectionId','tenantId','operation'] as const;
function object(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value))throw invalid();
 const proto=Object.getPrototypeOf(value),actual=Reflect.ownKeys(value);
 if((proto!==Object.prototype&&proto!==null)||actual.length!==keys.length||actual.some(k=>typeof k!=='string'||!keys.includes(k)))throw invalid();
 const result:Record<string,unknown>={};
 for(const key of keys){const d=Object.getOwnPropertyDescriptor(value,key);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw invalid();result[key]=d.value;}
 return result;
}
function text(value:unknown):string{
 if(!isPersistableText(value)||!value.length||value.length>256||value.trim()!==value||/[\u0000-\u001f\u007f-\u009f]/u.test(value))throw invalid();
 return value;
}
function instant(value:unknown):string{if(!isCanonicalInstant(value))throw invalid();return canonicalInstant(value);}
const micros=(value:string)=>zonedInstantMicros(value)!;
export function resourceGrantRevision(value:unknown):string{
 if(typeof value!=='string'||!/^(0|[1-9][0-9]{0,18})$/.test(value)||BigInt(value)>MAX_REVISION)throw invalid();
 return value;
}
export function parseResourceGrantTarget(value:unknown):ResourceGrantTarget{
 try{
  const v=object(value,targetFields);if(!operations.includes(v.operation as ResourceGrantTarget['operation']))throw invalid();
  return Object.freeze({principalId:uuidIdentifier(v.principalId),workspaceId:uuidIdentifier(v.workspaceId),accountId:uuidIdentifier(v.accountId),
   bindingId:uuidIdentifier(v.bindingId),connectionId:uuidIdentifier(v.connectionId),tenantId:text(v.tenantId),operation:v.operation as ResourceGrantTarget['operation']});
 }catch{throw invalid();}
}
export function normalizeResourceGrantSnapshot(value:unknown):ResourceGrantSnapshot{
 try{
  const v=object(value,['target','manifestFingerprint','bindingRevision','accessRevision','asOf','expiresAt','state','complete','resources']);
  if(v.complete!==true||!['active','revoked'].includes(v.state as string)||typeof v.manifestFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(v.manifestFingerprint))throw invalid();
  const target=parseResourceGrantTarget(v.target),asOf=instant(v.asOf),expiresAt=instant(v.expiresAt);
  if(micros(expiresAt)<=micros(asOf))throw invalid();
  const resources=[...parseExternalResourceCoverage(v.resources)];
  if(resources.some(r=>r.connectionId!==target.connectionId||r.tenantId!==target.tenantId)||v.state==='revoked'&&resources.length)throw invalid();
  resources.sort((a,b)=>{const x=externalResourceKey(a),y=externalResourceKey(b);return x===y?0:x<y?-1:1;});
  return Object.freeze({target,manifestFingerprint:v.manifestFingerprint,bindingRevision:text(v.bindingRevision),accessRevision:text(v.accessRevision),
   asOf,expiresAt,state:v.state as 'active'|'revoked',complete:true,resources:Object.freeze(resources)});
 }catch{throw invalid();}
}
export function normalizeResourceGrantState(value:unknown):ResourceGrantState{
 try{
  const v=object(value,['revision','snapshot']),revision=resourceGrantRevision(v.revision);
  if((revision==='0')!==(v.snapshot===null))throw invalid();
  return Object.freeze({revision,snapshot:v.snapshot===null?null:normalizeResourceGrantSnapshot(v.snapshot)});
 }catch{throw invalid();}
}
export function assertResourceGrantFresh(snapshot:ResourceGrantSnapshot,at:unknown,maxAgeMicros:bigint):void{
 if(typeof maxAgeMicros!=='bigint'||maxAgeMicros<=0n)throw invalid();
 const tick=micros(instant(at)),start=micros(snapshot.asOf),end=micros(snapshot.expiresAt);
 if(start>tick||end<=tick||tick-start>maxAgeMicros)throw stale();
}
/** Pure consistency/CAS plan. Does NOT authenticate a source, execute SQL, publish a grant,
 * bless a candidate manifest or grant admin capabilities. Call under a locked store state.
 * The adapter returns the actual next revision; existing child triggers may increment it
 * more than once, so this engine never assumes nextRevision === oldRevision + 1.
 */
export function planResourcePublication(current:unknown,proposal:unknown,expectedRevision:unknown,at:unknown,maxAgeMicros:bigint):ResourcePublicationPlan{
 const state=normalizeResourceGrantState(current),snapshot=normalizeResourceGrantSnapshot(proposal),expected=resourceGrantRevision(expectedRevision);
 if(state.revision!==expected||BigInt(expected)===MAX_REVISION)throw conflict();
 assertResourceGrantFresh(snapshot,at,maxAgeMicros);
 const old=state.snapshot;
 if(old){
  if(requestHash(old.target)!==requestHash(snapshot.target)||old.manifestFingerprint!==snapshot.manifestFingerprint)throw conflict();
  const age=micros(snapshot.asOf)-micros(old.asOf);
  if(age<0n)throw stale();
  if(age===0n&&requestHash(old)!==requestHash(snapshot))throw conflict();
  if(old.bindingRevision===snapshot.bindingRevision&&old.accessRevision===snapshot.accessRevision&&
    (old.state!==snapshot.state||requestHash(old.resources)!==requestHash(snapshot.resources)))throw conflict();
 }
 return Object.freeze({target:snapshot.target,expectedRevision:expected,snapshot,snapshotHash:requestHash(snapshot)});
}
