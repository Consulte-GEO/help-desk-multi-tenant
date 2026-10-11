import {createHash} from 'node:crypto';
import {copyFormData} from '../../../shared/form-rules.js';
export type ScanReport=Readonly<{status:'clean'|'rejected'|'unsupported'|'scan_error';sha256:string|null;bytes:number;mime:string|null;engine:string|null;definitions:string|null;reason:string}>;
export interface AttachmentScanner {
 /** Must inspect ALL bytes, including archive policy, limits and encrypted inputs.
  * An unconfigured/synthetic implementation must NEVER be mounted in production.
  * The worker, not the provider, computes the digest of this exact stream. */
 scan(bytes:AsyncIterable<Uint8Array>,signal:AbortSignal):Promise<unknown>;
}
function signature(b:Uint8Array):string|null{
 const h=Buffer.from(b).toString('hex');
 if(h.startsWith('89504e470d0a1a0a'))return 'image/png';
 if(h.startsWith('ffd8ff'))return 'image/jpeg';
 if(Buffer.from(b.subarray(0,5)).toString('ascii')==='%PDF-')return 'application/pdf';
 return null;
}
/** Worker-only streaming inspection. Not an upload endpoint or antivirus substitute.
 * Memory is bounded to the source chunk + 16 bytes. ZIP/Office/SVG/unknown formats
 * are unsupported, not unpacked or silently passed. Magic bytes alone prove no safety.
 * Policy must explicitly allow the type and a configured scanner must finish it. */
export async function inspectAttachmentStream(source:AsyncIterable<Uint8Array>,o:{expectedBytes:number;maxBytes:number;declaredMime:string;allowedMime:readonly string[];timeoutMs:number;scanner?:AttachmentScanner;signal?:AbortSignal}):Promise<ScanReport>{
 let count=0,prefix=Buffer.alloc(0),complete=false;const digest=createHash('sha256');let sha:string|null=null;
 const result=(status:ScanReport['status'],reason:string,engine:string|null=null,definitions:string|null=null):ScanReport=>Object.freeze({status,reason,sha256:sha,bytes:count,mime:signature(prefix),engine,definitions});
 if(!Number.isSafeInteger(o.maxBytes)||o.maxBytes<1||o.maxBytes>104857600||!Number.isSafeInteger(o.expectedBytes)||o.expectedBytes<1||!Number.isInteger(o.timeoutMs)||o.timeoutMs<1||o.timeoutMs>300000||typeof o.scanner?.scan!=='function'||o.signal?.aborted)return result('scan_error','scan_unavailable');
 const abort=new AbortController(),deadline=performance.now()+o.timeoutMs,oversize=new Error();let timer:ReturnType<typeof setTimeout>|undefined;let stop=()=>{};let iterator:AsyncIterator<Uint8Array>|undefined;
 const stopped=new Promise<never>((_,reject)=>{stop=()=>{abort.abort();reject(new Error());};timer=setTimeout(stop,o.timeoutMs);o.signal?.addEventListener('abort',stop,{once:true});});
 try{
  iterator=source[Symbol.asyncIterator]();
  const measured:AsyncIterable<Uint8Array>={async *[Symbol.asyncIterator](){
   for(;;){if(abort.signal.aborted||performance.now()>=deadline)throw new Error();const part=await iterator!.next();if(part.done){complete=true;sha=digest.digest('hex');return;}const b=part.value;if(!(b instanceof Uint8Array))throw new Error();count+=b.byteLength;if(count>o.maxBytes)throw oversize;if(prefix.length<16)prefix=Buffer.concat([prefix,Buffer.from(b.subarray(0,16-prefix.length))]);digest.update(b);yield b;}
  }};
  const raw=await Promise.race([Promise.resolve().then(()=>o.scanner!.scan(measured,abort.signal)),stopped]);
  if(abort.signal.aborted||o.signal?.aborted||performance.now()>=deadline||!complete)return result('scan_error','scan_incomplete');
  const r=copyFormData(raw) as Record<string,unknown>;
  if(!r||Array.isArray(r)||Object.keys(r).length!==4||r.complete!==true||!['clean','infected','unsupported'].includes(r.verdict as string)||typeof r.engine!=='string'||! /^[\w.:-]{1,100}$/.test(r.engine)||typeof r.definitions!=='string'||! /^[\w.:-]{1,100}$/.test(r.definitions))return result('scan_error','scan_invalid_report');
  const mime=signature(prefix);
  if(count!==o.expectedBytes)return result('rejected','size_mismatch',r.engine,r.definitions);
  if(!mime||!o.allowedMime.includes(mime)||r.verdict==='unsupported')return result('unsupported','format_not_qualified',r.engine,r.definitions);
  if(mime!==o.declaredMime)return result('rejected','mime_mismatch',r.engine,r.definitions);
  return r.verdict==='infected'?result('rejected','threat_detected',r.engine,r.definitions):result('clean','scan_completed',r.engine,r.definitions);
 }catch(e){return e===oversize?result('rejected','size_limit'):result('scan_error','scan_unavailable');}
 finally{clearTimeout(timer);o.signal?.removeEventListener('abort',stop);abort.abort();try{void Promise.resolve(iterator?.return?.()).catch(()=>{});}catch{/* Never expose private object paths. */}}
}
