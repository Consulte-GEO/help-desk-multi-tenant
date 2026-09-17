import {HelpdeskError} from '../domain/errors.ts';

export const AUTH_RESPONSE_MAX_BYTES=64*1024;
function unavailable():HelpdeskError {
  return new HelpdeskError(503,'auth_unavailable','Resposta inválida ou indisponível do serviço de identidade. Acesso não concedido.');
}
/** Limit decoded bytes, not Content-Length (which can refer to compressed bytes).
 * The caller supplies the SAME abort signal used for fetching the response headers.
 * No metadata is logged or promoted to permissions; this only decodes bounded JSON.
 */
export async function readIdentityResponse(response:Response,signal:AbortSignal):Promise<unknown> {
  if(!response.body)throw unavailable();
  const reader=response.body.getReader();
  let onAbort:()=>void=()=>{};
  const abort=new Promise<never>((_resolve,reject)=>{
    onAbort=()=>reject(unavailable());
    signal.addEventListener('abort',onAbort,{once:true});
  });
  try {
    if(signal.aborted)throw unavailable();
    const chunks:Uint8Array[]=[];let length=0;
    for(;;) {
      const part=await Promise.race([reader.read(),abort]);
      if(signal.aborted)throw unavailable();
      if(part.done)break;
      length+=part.value.byteLength;
      if(length>AUTH_RESPONSE_MAX_BYTES)throw unavailable();
      chunks.push(part.value);
    }
    const bytes=new Uint8Array(length);let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  } catch {
    // Cancellation is best-effort and must not hold the request open on a broken stream.
    try {void reader.cancel().catch(()=>{});} catch { /* no credential-bearing errors */ }
    throw unavailable();
  } finally {
    signal.removeEventListener('abort',onAbort);
    try {reader.releaseLock();} catch { /* pending/broken stream is not usable */ }
  }
}
