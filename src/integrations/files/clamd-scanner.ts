import {createConnection} from 'node:net';
import {isAbsolute} from 'node:path';
import {attachmentFailure} from '../../domain/attachment.ts';
import type {AttachmentScanner} from './inspection.ts';
/** Candidate adapter for an OPERATOR-QUALIFIED local ClamD daemon. Unix socket only:
 * no arbitrary path scan, network host or executable taken from upload metadata.
 * Deployment must verify scanner limits, encrypted-file/limit alerts, signatures,
 * license, workers and policy. A functioning wire protocol does not certify those.
 */
export function createClamdScanner(o:{socketPath:string;maxBytes:number;timeoutMs:number}):AttachmentScanner{
 if(typeof o.socketPath!=='string'||!isAbsolute(o.socketPath)||o.socketPath.length>100||o.socketPath.includes('\0')||!Number.isSafeInteger(o.maxBytes)||o.maxBytes<1||o.maxBytes>104857600||!Number.isInteger(o.timeoutMs)||o.timeoutMs<1||o.timeoutMs>300000)throw attachmentFailure('attachments_not_configured');
 async function exchange(command:string,source:AsyncIterable<Uint8Array>|null,signal:AbortSignal,deadline:number):Promise<string>{
  if(signal.aborted||performance.now()>=deadline)throw attachmentFailure();
  const socket=createConnection({path:o.socketPath});let complete=false,ended=source===null,reply=Buffer.alloc(0),stop=()=>{};
  try{return await new Promise<string>((resolve,reject)=>{
   const fail=()=>{if(complete)return;complete=true;reject(attachmentFailure());};stop=fail;
   const timer=setTimeout(fail,Math.max(1,deadline-performance.now()));
   const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',fail);};
   socket.once('error',fail);socket.once('end',()=>{if(!complete)fail();});socket.once('close',cleanup);signal.addEventListener('abort',fail,{once:true});
   socket.on('data',(chunk:Buffer)=>{if(complete)return;reply=Buffer.concat([reply,chunk]);if(reply.length>2048){fail();return;}const n=reply.indexOf(0);if(n<0)return;if(n!==reply.length-1||!ended){fail();return;}complete=true;cleanup();resolve(reply.subarray(0,n).toString('utf8'));});
   const write=(b:Uint8Array)=>new Promise<void>((res,rej)=>{if(signal.aborted||complete||performance.now()>=deadline){rej(attachmentFailure());return;}socket.write(b,e=>e?rej(attachmentFailure()):res());});
   socket.once('connect',()=>{void (async()=>{await write(Buffer.from('z'+command+'\0'));if(source){let total=0;for await(const chunk of source){if(!(chunk instanceof Uint8Array))throw attachmentFailure();total+=chunk.byteLength;if(total>o.maxBytes)throw attachmentFailure();for(let at=0;at<chunk.byteLength;at+=65536){const part=chunk.subarray(at,at+65536),n=Buffer.alloc(4);n.writeUInt32BE(part.byteLength);await write(n);await write(part);}}ended=true;await write(Buffer.alloc(4));}})().catch(fail);});
  });}finally{socket.destroy();signal.removeEventListener('abort',stop);}
 }
 return Object.freeze({async scan(bytes:AsyncIterable<Uint8Array>,signal:AbortSignal){
  const deadline=performance.now()+o.timeoutMs;
  const version=await exchange('VERSION',null,signal,deadline),v=/^ClamAV ([0-9]+\.[0-9]+\.[0-9]+)\/([0-9]+)\/[^\r\n\0]{1,120}$/.exec(version);
  if(!v)throw attachmentFailure();const response=await exchange('INSTREAM',bytes,signal,deadline);
  if(response!=='stream: OK'&&!/^stream: [^\r\n\0]{1,500} FOUND$/.test(response))throw attachmentFailure();
  const after=await exchange('VERSION',null,signal,deadline);if(after!==version)throw attachmentFailure();
  return Object.freeze({verdict:response==='stream: OK'?'clean':'infected',engine:'ClamAV_'+v[1],definitions:v[2],complete:true});
 }});
}
