import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {instantMicros} from '../domain/business-calendar.ts';
import {attachmentFailure as fail,parseAttachmentBinding,parseAttachmentPolicy,parseAttachmentMetadata,parseSealedObject,attachmentObjectKey,type AttachmentRecord} from '../domain/attachment.ts';
import {requestHash} from '../domain/canonical.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {fileProviderCall,type AttachmentObjectReader} from '../integrations/files/storage.ts';
import {inspectAttachmentStream,type AttachmentScanner,type ScanReport} from '../integrations/files/inspection.ts';
export type AttachmentScanJob=Readonly<{id:string;leaseId:string;leaseUntil:string;record:AttachmentRecord}>;
export interface AttachmentScanQueue{
 /** Private worker role: atomically claim a pending job with bounded lease. */
 claim(workerId:string,at:string):Promise<AttachmentScanJob|null>;
 /** One atomic CAS on job/lease/version/object pointer + scan record + receipt.
  * Verify lease and expires_at with DATABASE clock; rejected/error jobs never mint
  * a clean receipt. Return false for lost lease. No client may call this writer. */
 complete(job:AttachmentScanJob,report:ScanReport,at:string):Promise<boolean>;
}
/** One iteration only. No scheduler/service/provisioning is created. A hosting
 * adapter must select approved Storage, scanner/config/definitions and worker role.
 * No HTTP endpoint accepts an arbitrary scan result or `clean: true` from callers. */
export function createAttachmentScanWorker(o:{store:AttachmentScanQueue;reader:AttachmentObjectReader;scanner:AttachmentScanner;scanPolicyId:string;timeoutMs:number;clock?:()=>string}){
 const clock=o.clock??(()=>new Date().toISOString());
 async function runOnce(workerId:string,signal?:AbortSignal){
  if(!/^[\w:-]{1,100}$/.test(workerId)||!o.scanner||typeof o.scanner.scan!=='function')throw fail('attachments_not_configured');
  const raw=await o.store.claim(workerId,clock());if(raw===null)return Object.freeze({state:'idle'});
  const job=copyFormData(raw) as AttachmentScanJob;uuidIdentifier(job.id);uuidIdentifier(job.leaseId);
  const r=job.record,b=parseAttachmentBinding(r.binding),p=parseAttachmentPolicy(r.policy);parseAttachmentMetadata(r.metadata,p);
  if(r.status!=='scanning'||r.objectKey!==attachmentObjectKey(b.workspaceId,r.id)||r.scanPolicyId!==o.scanPolicyId||p.scanPolicyId!==o.scanPolicyId||!r.object)throw fail('attachment_policy_unavailable');
  const object=parseSealedObject(r.object,r.objectKey);const live=()=>!signal?.aborted&&instantMicros(job.leaseUntil)>instantMicros(clock())&&instantMicros(r.expiresAt)>instantMicros(clock());
  if(!live())return Object.freeze({state:'stale',jobId:job.id});let report:ScanReport;
  try{
   report=await fileProviderCall(async s=>{
    const before=parseSealedObject(await o.reader.head(object,s),r.objectKey);if(requestHash(before)!==requestHash(object))throw fail();
    const stream=await o.reader.open(object,s);
    const found=await inspectAttachmentStream(stream,{expectedBytes:r.metadata.bytes,maxBytes:p.maxBytes,declaredMime:r.metadata.mime,allowedMime:p.allowedMime,timeoutMs:o.timeoutMs,scanner:o.scanner,signal:s});
    const after=parseSealedObject(await o.reader.head(object,s),r.objectKey);if(requestHash(after)!==requestHash(object))throw fail();return found;
   },o.timeoutMs,signal);
  }catch{report=Object.freeze({status:'scan_error',reason:'object_or_scanner_unavailable',sha256:null,bytes:0,mime:null,engine:null,definitions:null});}
  if(!live())return Object.freeze({state:'stale',jobId:job.id});
  try{const done=await o.store.complete(freezeFormData(job),report,clock());return Object.freeze({state:done?'recorded':'stale',jobId:job.id,status:report.status});}
  catch{return Object.freeze({state:'unknown',jobId:job.id});}
 }
 return Object.freeze({runOnce});
}
