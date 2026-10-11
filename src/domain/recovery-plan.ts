import {createHash} from 'node:crypto';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {canonicalJson,requestHash} from './canonical.ts';import {uuidIdentifier} from './input-values.ts';
import {compareInstants} from '../../shared/instant.js';
import {parseDeliveryRecord,type DeliveryRecord} from './notification-delivery.ts';
import {releaseRecord,releaseInstant,releaseInteger,releaseDigest} from './release-manifest.ts';import {HelpdeskError} from './errors.ts';
const conflict=()=>new HelpdeskError(409,'recovery_state_conflict','Os registros de recuperação são incompatíveis. Nenhum envio ou acesso foi liberado.');
const invalid=()=>new HelpdeskError(503,'recovery_inventory_invalid','Não foi possível conferir integralmente o inventário de recuperação.');
/** Pure candidate plan: never calls a channel, restores a database, reissues a token
 * or modifies a published receipt. `current` must come from an authoritative ledger
 * not rolled back with the backup. Missing evidence never permits a resend. */
export function reconcileRestoredDelivery(backupRaw:unknown,currentRaw:unknown|null,at:string){try{
 releaseInstant(at);const backup=parseDeliveryRecord(backupRaw),current=currentRaw===null?null:parseDeliveryRecord(currentRaw);
 if(current&&current.revision===backup.revision&&requestHash(current)!==requestHash(backup))throw conflict();
 if(current&&(requestHash(current.intent)!==requestHash(backup.intent)||current.revision<backup.revision||compareInstants(current.updatedAt,backup.updatedAt)<0||backup.state==='delivered'&&current.state!=='delivered'||backup.state==='accepted'&&!['accepted','delivered','failed'].includes(current.state)))throw conflict();
 const r=current??backup;if(compareInstants(at,r.updatedAt)<0)throw conflict();let record:DeliveryRecord=r;
 if(['pending','retry_wait','leased','sending'].includes(r.state)){
  if(r.revision===Number.MAX_SAFE_INTEGER)throw conflict();
  record=parseDeliveryRecord({...r,revision:r.revision+1,state:r.attempts===0?'suppressed':'unknown',lease:null,nextAttemptAt:null,lastReason:r.attempts===0?'recovery_requires_review':'recovery_confirmation_unknown',attention:true,updatedAt:at});
 }
 return freezeFormData({record,mayDispatch:false as const,requiresCurrentAuthorization:true as const,recordHash:requestHash(record)});
 }catch{throw conflict();}}
export function planDeliveryRecovery(backupRaw:unknown,currentRaw:unknown,at:string){try{
 const backup=copyFormData(backupRaw),current=copyFormData(currentRaw);if(!Array.isArray(backup)||!Array.isArray(current)||backup.length>1000||current.length>1000)throw conflict();
 const b=backup.map(parseDeliveryRecord),c=current.map(parseDeliveryRecord);for(const list of [b,c])if(new Set(list.map(r=>r.intent.id)).size!==list.length||new Set(list.map(r=>r.intent.idempotencyKey)).size!==list.length)throw conflict();
 const byId=new Map(c.map(r=>[r.intent.id,r])),ids=new Set(b.map(r=>r.intent.id));const records=b.map(r=>reconcileRestoredDelivery(r,byId.get(r.intent.id)??null,at).record);
 for(const r of c)if(!ids.has(r.intent.id))records.push(reconcileRestoredDelivery(r,null,at).record);
 if(new Set(records.map(r=>r.intent.idempotencyKey)).size!==records.length)throw conflict();
 records.sort((a,b)=>a.intent.id<b.intent.id?-1:1);return freezeFormData({records,dispatchable:0 as const,productionApproved:false as const,planHash:requestHash(records)});
 }catch{throw conflict();}}

const entities=['principal','session','resource_binding','download_receipt','object'] as const;
/** A retained revocation/erasure registry is mandatory input to the real restore
 * process. This planner never returns 'activate' and never removes a tombstone. */
export function planRestoredAccess(restoredRaw:unknown,tombstonesRaw:unknown){try{
 const raw=copyFormData(restoredRaw),marks=copyFormData(tombstonesRaw);if(!Array.isArray(raw)||!Array.isArray(marks)||raw.length>1000||marks.length>1000)throw conflict();
 const parse=(value:unknown,tombstone:boolean)=>{const r=releaseRecord(value,tombstone?['kind','id','revision','action']:['kind','id','revision']);if(!entities.includes(r.kind as typeof entities[number]))throw conflict();r.id=uuidIdentifier(r.id);releaseInteger(r.revision,1);if(tombstone&&!['erase','revoke'].includes(r.action as string))throw conflict();return r;};
 const restored=raw.map(x=>parse(x,false)),tombstones=marks.map(x=>parse(x,true)),key=(r:Record<string,unknown>)=>JSON.stringify([r.kind,r.id]);
 for(const list of [restored,tombstones])if(new Set(list.map(key)).size!==list.length)throw conflict();
 const lookup=new Map(tombstones.map(r=>[key(r),r]));return freezeFormData(restored.map(r=>{const mark=lookup.get(key(r));return {kind:r.kind,id:r.id,expectedRevision:r.revision,action:mark?.action==='erase'?'do_not_restore':mark?'keep_revoked':r.kind==='session'||r.kind==='download_receipt'?'invalidate':r.kind==='object'?'quarantine':'require_revalidation'};}));
 }catch{throw conflict();}}

export type RecoveryInventoryEntry=Readonly<{count:number;bytes:number;sha256:string}>;
export const RECOVERY_COMPONENTS=['database','objects','configuration','key_inventory','outbox','revocations'] as const;
export type RecoveryInventory=Readonly<Record<typeof RECOVERY_COMPONENTS[number],RecoveryInventoryEntry>>;
/** Hashes a sorted, bounded stream. key ordering is UTF-8 binary (PostgreSQL COLLATE C),
 * not labels or locale. The reader supplies stable keys and excludes secret VALUES
 * from key_inventory (references/generations only). No source row is logged/returned.
 */
export async function digestRecoveryRows(rows:AsyncIterable<unknown>,options:{maxRows?:number;maxBytes?:number;timeoutMs?:number;signal?:AbortSignal}={}):Promise<RecoveryInventoryEntry>{
 let iterator:AsyncIterator<unknown>|undefined,timer:ReturnType<typeof setTimeout>|undefined,abortListener:(()=>void)|undefined;
 try{
  const maxRows=options.maxRows??1000000,maxBytes=options.maxBytes??268435456,timeoutMs=options.timeoutMs??30000;
  if(!Number.isSafeInteger(maxRows)||maxRows<1||maxRows>1000000||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1073741824||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw invalid();
  if(options.signal?.aborted)throw invalid();iterator=rows[Symbol.asyncIterator]();const started=performance.now();
  const cancelled=new Promise<never>((_resolve,reject)=>{abortListener=()=>reject(invalid());options.signal?.addEventListener('abort',abortListener,{once:true});timer=setTimeout(()=>reject(invalid()),timeoutMs);});
  const hash=createHash('sha256').update('helpdesk-recovery-inventory-v1\n');let count=0,bytes=0,previous:Buffer|undefined;
  for(;;){if(options.signal?.aborted||performance.now()-started>=timeoutMs)throw invalid();const item=await Promise.race([Promise.resolve().then(()=>iterator!.next()),cancelled]);if(options.signal?.aborted||performance.now()-started>=timeoutMs)throw invalid();if(item.done)break;
   const r=releaseRecord(item.value,['key','value']);if(typeof r.key!=='string'||!r.key||r.key.length>256||/[\p{Cc}\p{Cs}]/u.test(r.key))throw invalid();const key=Buffer.from(r.key);if(previous&&Buffer.compare(previous,key)>=0)throw invalid();previous=key;
   const encoded=Buffer.from(canonicalJson(r));count++;bytes+=encoded.length;if(count>maxRows||bytes>maxBytes)throw invalid();hash.update(String(encoded.length)+':').update(encoded).update('\n');
  }
  return Object.freeze({count,bytes,sha256:hash.digest('hex')});
 }catch{try{void Promise.resolve(iterator?.return?.()).catch(()=>{});}catch{}throw invalid();}
 finally{clearTimeout(timer);if(abortListener)options.signal?.removeEventListener('abort',abortListener);}
}
export function parseRecoveryInventory(raw:unknown):RecoveryInventory{try{const r=releaseRecord(raw,RECOVERY_COMPONENTS);for(const name of RECOVERY_COMPONENTS){const e=releaseRecord(r[name],['count','bytes','sha256']);releaseInteger(e.count);releaseInteger(e.bytes);releaseDigest(e.sha256);r[name]=e;}return freezeFormData(r) as unknown as RecoveryInventory;}catch{throw invalid();}}
/** Database row totals cannot stand in for objects/configuration/secrets metadata.
 * A match is inventory evidence, never proof of a performed/accepted restore. */
export function compareRecoveryInventory(expectedRaw:unknown,observedRaw:unknown){const expected=parseRecoveryInventory(expectedRaw),observed=parseRecoveryInventory(observedRaw);const mismatches=RECOVERY_COMPONENTS.filter(k=>requestHash(expected[k])!==requestHash(observed[k]));return freezeFormData({state:mismatches.length?'mismatch':'matched',mismatches,productionApproved:false as const,restorePerformedByThisFunction:false as const,resumeWorkers:false as const});}
