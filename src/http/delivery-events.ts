import type {RateLimiter,TrustedRequestContext} from '../infrastructure/rate-limit.ts';import {HelpdeskError} from '../domain/errors.ts';import {privateJson,httpFailure} from './controlled-json.ts';
/** Dedicated normalized, signed provider/relay callback. No human session or caller
 * identity accepted. The supplied consumer MUST verify signature before any DB call.
 * Header/body timeouts, TLS, ingress quotas and provider mapping require deployment QA.
 */
export function createDeliveryEventHandler(o:{ingress:Pick<RateLimiter,'beforeAuthentication'>;acceptDeliveryEvent:(h:Headers,raw:Uint8Array)=>Promise<unknown>}){
 return async(req:Request,context:TrustedRequestContext={}):Promise<Response>=>{
  try{await o.ingress.beforeAuthentication(req,context);const u=new URL(req.url);if(u.pathname!=='/v1/delivery-events')throw httpFailure(404,'not_found');if(req.method!=='POST')return privateJson({code:'method_not_allowed'},405,{allow:'POST'});if(u.search)throw httpFailure(400,'unknown_parameter');
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')??'')||req.headers.has('content-encoding'))throw httpFailure(415,'unsupported_media_type');
   const reader=req.body?.getReader();if(!reader)throw httpFailure(400,'invalid_json');const deadline=performance.now()+5000;let timer:ReturnType<typeof setTimeout>|undefined,reject!:()=>void;const stopped=new Promise<never>((_,r)=>{reject=()=>r(httpFailure(408,'request_timeout'));timer=setTimeout(reject,5000);});req.signal.addEventListener('abort',reject,{once:true});let raw:Uint8Array;
   try{const parts:Uint8Array[]=[];let size=0;for(;;){if(req.signal.aborted)throw httpFailure(409,'request_cancelled');if(performance.now()>=deadline)throw httpFailure(408,'request_timeout');const p=await Promise.race([reader.read(),stopped]);if(performance.now()>=deadline)throw httpFailure(408,'request_timeout');if(req.signal.aborted)throw httpFailure(409,'request_cancelled');if(p.done)break;size+=p.value.byteLength;if(size>32768)throw httpFailure(413,'payload_too_large');parts.push(p.value);}raw=new Uint8Array(size);let offset=0;for(const p of parts){raw.set(p,offset);offset+=p.length;}}
   catch(e){try{void reader.cancel().catch(()=>{});}catch{}throw e;}finally{clearTimeout(timer);req.signal.removeEventListener('abort',reject);try{reader.releaseLock();}catch{}}
   await o.acceptDeliveryEvent(req.headers,raw);return privateJson({recorded:true},200);
  }catch(e){let status=503,code='delivery_unavailable';if(e instanceof HelpdeskError&&['not_found','unknown_parameter','unsupported_media_type','invalid_json','request_timeout','request_cancelled','payload_too_large','delivery_signature_invalid','delivery_receipt_mismatch','delivery_event_conflict','delivery_state_conflict'].includes(e.code)){status=e.status;code=e.code;}
   return privateJson({code,status,detail:'Não foi possível validar o evento de entrega.'},status);}
 };
}
