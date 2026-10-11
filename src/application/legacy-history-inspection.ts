import {createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {freezeFormData} from '../../shared/form-rules.js';
import {compareInstants} from '../../shared/instant.js';
import {requestHash} from '../domain/canonical.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {releaseRecord,releaseInteger,releaseInstant} from '../domain/release-manifest.ts';
import {parseLegacyHistoryBatch,parseLegacyMapping,parseRetainedLegacyIndex,planLegacyHistoryBatch,legacyRecordKey} from '../connectors/geo-legacy/mapping.ts';

/** Private normalized snapshot, sourced from a qualified exporter and retained
 * mapping/revocation ledger. No database or legacy credentials are accepted here. */
export interface LegacyInspectionReader {read(exportId:string,signal:AbortSignal):Promise<unknown>}
export type LegacyBlobSelector=Readonly<{kind:'payload'|'attachment';partKey:string;expectedSha256:string;expectedBytes:number}>;
/** Map hashed selectors to exporter-owned objects. Do not turn raw record IDs into
 * file paths or URLs. Open a fixed object version, and release it on signal/return.
 * This port is NOT implemented against the legacy API or a cloud store here. */
export interface LegacyInspectionBlobs {open(exportId:string,sourceKey:string,part:LegacyBlobSelector,signal:AbortSignal):Promise<AsyncIterable<Uint8Array>>}
const ownErrors=new WeakSet<object>();
function fail(code='legacy_inspection_unavailable',status=503){const e=new HelpdeskError(status,code,'Inspeção do histórico não concluída. Nenhum dado foi importado.');ownErrors.add(e);return e;}
function snapshot(raw:unknown){const s=releaseRecord(raw,['revision','batch','mapping','retained']);releaseInteger(s.revision,1);return freezeFormData({revision:s.revision as number,batch:parseLegacyHistoryBatch(s.batch),mapping:parseLegacyMapping(s.mapping),retained:parseRetainedLegacyIndex(s.retained)});}
/** Byte-level preflight only. It neither parses the payload as public content nor
 * imports it. A valid hash is integrity, not identity/ACL/antivirus or import approval.
 * Final output may be considered only for PRIVATE staging after separate approval.
 */
export function createLegacyHistoryInspector(o:{reader:LegacyInspectionReader;blobs:LegacyInspectionBlobs;clock?:()=>string;timeoutMs:number;maxBytes:number}){
 if(!o||typeof o.reader?.read!=='function'||typeof o.blobs?.open!=='function'||!Number.isSafeInteger(o.timeoutMs)||o.timeoutMs<1||o.timeoutMs>300000||!Number.isSafeInteger(o.maxBytes)||o.maxBytes<1||o.maxBytes>268435456)throw fail();
 const clock=o.clock??(()=>new Date().toISOString());
 async function inspect(exportId:string,options:{signal?:AbortSignal}={}){
  const id=uuidIdentifier(exportId),caller=options.signal;if(caller!==undefined&&!(caller instanceof AbortSignal))throw fail();
  const controller=new AbortController(),deadline=performance.now()+o.timeoutMs;let stopped:'cancelled'|'timeout'|undefined,previous:string|undefined,bytesRead=0,partsVerified=0;
  const stop=(why:'cancelled'|'timeout')=>{if(!stopped){stopped=why;controller.abort();}},cancel=()=>stop('cancelled');
  const open=()=>{if(!stopped&&performance.now()>=deadline)stop('timeout');if(stopped)throw fail('legacy_inspection_'+stopped,stopped==='cancelled'?409:503);};
  const now=()=>{open();const at=releaseInstant(clock());if(previous!==undefined&&compareInstants(at,previous)<0)throw fail();previous=at;return at;};
  function bounded<T>(work:()=>Promise<T>):Promise<T>{
   open();return new Promise<T>((resolve,reject)=>{
    const cleanup=()=>controller.signal.removeEventListener('abort',abort);
    const abort=()=>{cleanup();reject(fail('legacy_inspection_'+(stopped??'cancelled'),stopped==='timeout'?503:409));};controller.signal.addEventListener('abort',abort,{once:true});
    Promise.resolve().then(()=>{open();return work();}).then(v=>{cleanup();try{open();resolve(v);}catch(e){reject(e);}},()=>{cleanup();try{open();}catch(e){reject(e);return;}reject(fail());});
   });
  }
  if(caller?.aborted)throw fail('legacy_inspection_cancelled',409);caller?.addEventListener('abort',cancel,{once:true});const timer=setTimeout(()=>stop('timeout'),o.timeoutMs);
  try{
   now();const first=snapshot(await bounded(()=>o.reader.read(id,controller.signal)));if(first.batch.exportId!==id)throw fail();
   const initial=planLegacyHistoryBatch(first.batch,first.mapping,first.retained,now()),problems=new Map<string,string[]>();
   for(const row of initial.records){
    open();if(row.state!=='requires_byte_verification')continue;
    const record=first.batch.records.find(r=>legacyRecordKey(r.ref)===row.sourceKey)!;
    const parts:LegacyBlobSelector[]=[{kind:'payload',partKey:requestHash(['legacy-export-part-v1',row.sourceKey,'payload',record.sourceRevision]),expectedSha256:record.payloadSha256,expectedBytes:record.payloadBytes},...record.attachments.map(a=>({kind:'attachment' as const,partKey:requestHash(['legacy-export-part-v1',row.sourceKey,'attachment',a.id,a.objectVersion]),expectedSha256:a.sha256,expectedBytes:a.bytes}))];
    for(const descriptor of parts){
     now();if(descriptor.expectedBytes>o.maxBytes-bytesRead)throw fail('legacy_inspection_limit',413);
     const stream=await bounded(()=>o.blobs.open(id,row.sourceKey,freezeFormData(descriptor),controller.signal));
     if(!stream||typeof stream[Symbol.asyncIterator]!=='function')throw fail();
     const iterator=stream[Symbol.asyncIterator](),hash=createHash('sha256');let count=0,done=false;
     try{
      for(;;){const next=await bounded(()=>iterator.next());now();if(!next||typeof next.done!=='boolean'&&next.done!==undefined)throw fail();if(next.done){done=true;break;}
       if(!(next.value instanceof Uint8Array))throw fail();const size=next.value.byteLength;
       if(size>o.maxBytes-bytesRead)throw fail('legacy_inspection_limit',413);bytesRead+=size;count+=size;hash.update(next.value);
       // Do not continue consuming unbounded data after a fixed object's declared length.
       if(count>descriptor.expectedBytes)break;
      }
     }finally{if(!done&&typeof iterator.return==='function'){try{void Promise.resolve(iterator.return()).catch(()=>{});}catch{/* best-effort close; no private exception */}}}
     const valid=done&&count===descriptor.expectedBytes&&hash.digest('hex')===descriptor.expectedSha256;
     if(!valid){problems.set(row.sourceKey,[...(problems.get(row.sourceKey)??[]),descriptor.kind==='payload'?'payload_integrity_mismatch':'attachment_integrity_mismatch']);break;}
     partsVerified++;
    }
   }
   const second=snapshot(await bounded(()=>o.reader.read(id,controller.signal)));if(requestHash(second)!==requestHash(first))throw fail();
   const final=planLegacyHistoryBatch(second.batch,second.mapping,second.retained,now());
   const records=final.records.map(r=>{const reasons=[...r.reasons,...(problems.get(r.sourceKey)??[])];return {...r,reasons,target:reasons.length?null:r.target,state:reasons.length?'quarantined':r.state==='unchanged'?'unchanged':'verified_for_private_staging_review'};});
   const state=records.some(r=>r.state==='quarantined')?'blocked':records.every(r=>r.state==='unchanged')?'no_changes':'ready_for_private_staging_review';
   open();return freezeFormData({...final,kind:'legacy_history_byte_inspection',state,operational:false,snapshotHash:requestHash(second),bytesRead,partsVerified,records});
  }catch(e){if(e&&typeof e==='object'&&ownErrors.has(e))throw e;throw fail();}
  finally{clearTimeout(timer);caller?.removeEventListener('abort',cancel);}
 }
 return Object.freeze({inspect});
}
