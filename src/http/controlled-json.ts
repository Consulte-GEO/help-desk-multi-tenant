import {HelpdeskError} from '../domain/errors.ts';
export const httpFailure=(status:number,code:string)=>new HelpdeskError(status,code,'Não foi possível concluir esta requisição.');
/** Decoded-byte limit and one deadline covering both headers and body consumption.
 * This helper accepts JSON data only. It never executes strings or follows URLs.
 */
export async function controlledJson(req:Request,maxBytes=32768,timeoutMs=5000):Promise<Record<string,unknown>>{
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')??'')||req.headers.has('content-encoding'))throw httpFailure(415,'unsupported_media_type');
 const reader=req.body?.getReader();if(!reader)throw httpFailure(400,'invalid_json');
 let rejectAbort:(reason:unknown)=>void=()=>{};const deadline=performance.now()+timeoutMs;
 const stopped=new Promise<never>((_,reject)=>{rejectAbort=reject;});
 const cancel=()=>rejectAbort(httpFailure(409,'request_cancelled'));
 const timer=setTimeout(()=>rejectAbort(httpFailure(408,'request_timeout')),timeoutMs);req.signal.addEventListener('abort',cancel,{once:true});
 try{
  const parts:Uint8Array[]=[];let total=0;
  for(;;){if(req.signal.aborted)throw httpFailure(409,'request_cancelled');const value=await Promise.race([reader.read(),stopped]);if(performance.now()>=deadline)throw httpFailure(408,'request_timeout');if(req.signal.aborted)throw httpFailure(409,'request_cancelled');if(value.done)break;total+=value.value.byteLength;if(total>maxBytes)throw httpFailure(413,'payload_too_large');parts.push(value.value);}
  const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength;}
  let raw:unknown;try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw httpFailure(400,'invalid_json');}
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw httpFailure(400,'invalid_json');return raw as Record<string,unknown>;
 }catch(error){try{void reader.cancel().catch(()=>{});}catch{/* cleanup only */}throw error;}
 finally{clearTimeout(timer);req.signal.removeEventListener('abort',cancel);try{reader.releaseLock();}catch{/* cancelled stream */}}
}
export function privateJson(data:unknown,status=200,headers:Record<string,string>={}):Response{
 return Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...headers}});
}
