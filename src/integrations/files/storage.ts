import type {SealedAttachmentObject} from '../../domain/attachment.ts';
import {attachmentFailure} from '../../domain/attachment.ts';
export interface PrivateAttachmentStorage {
 /** Issue a create-only, already-created TUS resource for this generated key; no overwrite.
  * The endpoint accepts HEAD/PATCH (not a generic upload-creation URL).
  * Quarantine must be private. Implement provider/size quota enforcement server-side. */
 issueUpload(objectKey:string,bytes:number,mime:string,signal:AbortSignal):Promise<unknown>;
 /** Finish/close the upload and pin an immutable object version before scanning.
  * A plain mutable path/ETag that cannot be read version-specifically is insufficient. */
 seal(objectKey:string,signal:AbortSignal):Promise<unknown>;
 head(object:SealedAttachmentObject,signal:AbortSignal):Promise<unknown>;
 issueDownload(object:SealedAttachmentObject,filename:string,maxSeconds:number,signal:AbortSignal):Promise<unknown>;
}
export interface AttachmentObjectReader {
 /** Worker only. This must read the exact SEALED version, never latest-at-path. */
 open(object:SealedAttachmentObject,signal:AbortSignal):Promise<AsyncIterable<Uint8Array>>;
 head(object:SealedAttachmentObject,signal:AbortSignal):Promise<unknown>;
}
/** Provider deadline with cancellation and a monotonic post-check. No retries. */
export async function fileProviderCall<T>(run:(signal:AbortSignal)=>Promise<T>,timeoutMs:number,signal?:AbortSignal):Promise<T>{
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>300000||signal?.aborted)throw attachmentFailure();
 const controller=new AbortController(),deadline=performance.now()+timeoutMs;let stop=()=>{};let timer:ReturnType<typeof setTimeout>|undefined;
 const ended=new Promise<never>((_,reject)=>{stop=()=>{controller.abort();reject(attachmentFailure());};timer=setTimeout(stop,timeoutMs);signal?.addEventListener('abort',stop,{once:true});});
 try{if(signal?.aborted)throw attachmentFailure();const result=await Promise.race([Promise.resolve().then(()=>run(controller.signal)),ended]);if(controller.signal.aborted||signal?.aborted||performance.now()>=deadline)throw attachmentFailure();return result;}
 catch{throw attachmentFailure();}finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);controller.abort();}
}
