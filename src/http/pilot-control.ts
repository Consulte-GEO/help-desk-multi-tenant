import {randomUUID} from 'node:crypto';import {HelpdeskError} from '../domain/errors.ts';import {uuidIdentifier} from '../domain/input-values.ts';
import type {createPilotControl} from '../application/pilot-control.ts';import type {createAuthentication} from '../infrastructure/authentication.ts';import type {RateLimiter,TrustedRequestContext} from '../infrastructure/rate-limit.ts';
const codes:Record<string,number>={release_gate_closed:503,unauthorized:401,membership_required:403,auth_unavailable:503,administrative_assurance_required:403,administrative_capability_required:403,invalid_administrative_state:503,pilot_scope_mismatch:403,pilot_revision_conflict:412,pilot_transition_invalid:409,pilot_new_release_required:409,pilot_acceptance_mismatch:409,pilot_idempotency_conflict:409,pilot_receipt_invalid:503,pilot_state_invalid:503,pilot_not_found:404,pilot_command_invalid:400,pilot_outcome_unknown:503,release_attestation_invalid:503,release_evidence_incomplete:503,origin_denied:403,unknown_parameter:400,method_not_allowed:405,precondition_required:428,invalid_identifier:400,invalid_idempotency_key:400,unsupported_media_type:415,payload_too_large:413,invalid_json:400,request_cancelled:409,request_timeout:408,rate_limit_exceeded:429,not_found:404};
const fault=(code:string)=>new HelpdeskError(codes[code]??503,code,'Operação de piloto não concluída.');
const json=(value:unknown,status:number,id:string,headers:Record<string,string>={})=>Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-request-id':id,...headers}});
function problem(error:unknown,id:string){let code='pilot_unavailable';try{const v=Object.getOwnPropertyDescriptor(error??{},'code')?.value;if(typeof v==='string'&&Object.hasOwn(codes,v))code=v;}catch{}const status=codes[code]??503;return json({type:'about:blank',status,code,detail:code==='pilot_outcome_unknown'?'Confirmação desconhecida. Conserve a mesma intenção e chave para conciliação explícita.':'Não foi possível concluir a operação de piloto.',request_id:id},status,id,{'content-type':'application/problem+json'});}
async function body(req:Request):Promise<Record<string,unknown>>{
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')??'')||req.headers.has('content-encoding'))throw fault('unsupported_media_type');
 const reader=req.body?.getReader();if(!reader)throw fault('invalid_json');const started=performance.now();let rejectStop:(error:Error)=>void=()=>{},timer:ReturnType<typeof setTimeout>|undefined;
 const stop=new Promise<never>((_,reject)=>{rejectStop=reject;timer=setTimeout(()=>reject(fault('request_timeout')),5000);});const abort=()=>rejectStop(fault('request_cancelled'));req.signal.addEventListener('abort',abort,{once:true});
 try{const parts:Uint8Array[]=[];let total=0;
  for(;;){if(req.signal.aborted)throw fault('request_cancelled');const item=await Promise.race([reader.read(),stop]);if(req.signal.aborted)throw fault('request_cancelled');if(performance.now()-started>=5000)throw fault('request_timeout');if(item.done)break;total+=item.value.length;if(total>262144)throw fault('payload_too_large');parts.push(item.value);}
  const bytes=new Uint8Array(total);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}
  let raw:unknown;try{raw=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw fault('invalid_json');}if(!raw||typeof raw!=='object'||Array.isArray(raw))throw fault('invalid_json');return raw as Record<string,unknown>;
 }catch(e){try{void reader.cancel().catch(()=>{});}catch{}throw e;}finally{clearTimeout(timer);req.signal.removeEventListener('abort',abort);try{reader.releaseLock();}catch{}}
}
/** Optional, closed-by-configuration mount. Deployment must integrate it into
 * existing runtime/rate-limit/contract guards. It cannot activate a feature with
 * unsigned caller JSON, mint a signing key or create real cohort participants.
 * This is not a replacement for the existing hosted read/Auth/write runners.
 */
export function createPilotControlHttpHandler(o:{enabled:()=>boolean;origin:string;authentication:Pick<ReturnType<typeof createAuthentication>,'withAdministrativeAssurance'>;control:ReturnType<typeof createPilotControl>;rateLimiter:RateLimiter}){
 const origin=new URL(o.origin);if(origin.origin!==o.origin||origin.protocol!=='https:'||origin.username||origin.password)throw fault('origin_denied');
 return async(req:Request,context:TrustedRequestContext={}):Promise<Response>=>{const id=randomUUID();try{
  if(o.enabled()!==true)throw fault('release_gate_closed');await o.rateLimiter.beforeAuthentication(req,context);if(req.signal.aborted)throw fault('request_cancelled');
  const url=new URL(req.url);if(url.origin!==o.origin)throw fault('origin_denied');if(url.search)throw fault('unknown_parameter');
  const match=/^\/v1\/admin\/pilots\/([^/]+)(?:\/(preparations|start|acceptance|containment))?$/.exec(url.pathname);if(!match)throw fault('not_found');const pilotId=uuidIdentifier(match[1]);
  if(!match[2]){if(req.method!=='GET')throw fault('method_not_allowed');return await o.authentication.withAdministrativeAssurance(req,async(p,proof)=>{await o.rateLimiter.afterAuthentication(p);if(req.signal.aborted)throw fault('request_cancelled');const r=await o.control.read(p,proof,pilotId);return json(r,200,id,{etag:`"${r.revision}"`});});}
  if(req.method!=='POST')throw fault('method_not_allowed');if(req.headers.get('origin')!==o.origin)throw fault('origin_denied');
  const revision=/^"(0|[1-9]\d*)"$/.exec(req.headers.get('if-match')??'');if(!revision||!Number.isSafeInteger(Number(revision[1])))throw fault('precondition_required');const key=req.headers.get('idempotency-key')??'';if(!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw fault('invalid_idempotency_key');
  return await o.authentication.withAdministrativeAssurance(req,async(p,proof)=>{
   await o.rateLimiter.afterAuthentication(p);const input=await body(req);if(req.signal.aborted)throw fault('request_cancelled');
   const action=({preparations:'prepare',start:'start',acceptance:'accept',containment:'contain'} as const)[match[2] as 'preparations'|'start'|'acceptance'|'containment'];
   const allowed=['reason',...(action==='prepare'?['releaseEnvelope']:action==='accept'?['acceptanceEnvelope']:[])];if(Object.keys(input).length!==allowed.length||Object.keys(input).some(k=>!allowed.includes(k)))throw fault('pilot_command_invalid');
   const result=await o.control.execute(p,proof,{...input,action,pilotId,expectedRevision:Number(revision[1])},key);
   return json(result,action==='prepare'&&!result.replayed?201:200,id,{etag:`"${result.revision}"`,'idempotency-replayed':String(result.replayed)});
  });
 }catch(e){return problem(e,id);}};
}
