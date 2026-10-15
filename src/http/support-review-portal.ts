import {randomUUID} from 'node:crypto';import type {Principal} from '../domain/model.ts';import type {createAuthentication} from '../infrastructure/authentication.ts';import type {RateLimiter,TrustedRequestContext} from '../infrastructure/rate-limit.ts';
import {HelpdeskError} from '../domain/errors.ts';import {uuidIdentifier} from '../domain/input-values.ts';import {privateJson,httpFailure} from './controlled-json.ts';
type Queries={readReviewContext(p:Principal,id:string,signal?:AbortSignal,admission?:()=>void):Promise<unknown>;readDeliveryAttention(p:Principal,id:string,proof:unknown,signal?:AbortSignal,admission?:()=>void):Promise<unknown>};
/** Read-only projections. Decision/challenge POSTs have a separate handler.
 * No dispatcher, provider, sender or reconciliation port is constructed here. */
export function createSupportReviewPortalHandler(o:{enabled:()=>boolean;origin:string;authentication:Pick<ReturnType<typeof createAuthentication>,'authenticate'|'withAdministrativeAssurance'>;rateLimiter:RateLimiter;queries:Queries}){
 const origin=new URL(o.origin);if(origin.protocol!=='https:'||origin.origin!==o.origin)throw Error('Configure an exact HTTPS application origin.');
 return async(req:Request,context:TrustedRequestContext={}):Promise<Response>=>{
  const requestId=randomUUID(),admission=()=>{if(o.enabled()!==true)throw httpFailure(503,'release_gate_closed');if(req.signal.aborted)throw httpFailure(409,'request_cancelled');};
  try{
   admission();await o.rateLimiter.beforeAuthentication(req,context);admission();const u=new URL(req.url),match=/^\/v1\/tickets\/([0-9a-f-]+)\/(review-context|notification-attention)$/.exec(u.pathname);
   if(!match)throw httpFailure(404,'not_found');if(req.method!=='GET')return privateJson({code:'method_not_allowed'},405,{allow:'GET','x-request-id':requestId});
   if(u.origin!==o.origin)throw httpFailure(403,'origin_required');if(u.search)throw httpFailure(400,'unknown_parameter');const id=uuidIdentifier(match[1]);
   const read=async(p:Principal,proof?:unknown)=>{admission();await o.rateLimiter.afterAuthentication(p);admission();const result=match[2]==='review-context'?await o.queries.readReviewContext(p,id,req.signal,admission):await o.queries.readDeliveryAttention(p,id,proof,req.signal,admission);admission();return result;};
   const result=match[2]==='notification-attention'?await o.authentication.withAdministrativeAssurance(req,read):await read(await o.authentication.authenticate(req));
   return privateJson(result,200,{'x-request-id':requestId});
  }catch(e){const statuses:Record<string,number>={release_gate_closed:503,request_cancelled:409,not_found:404,origin_required:403,unknown_parameter:400,invalid_identifier:400,unauthorized:401,mfa_required:403,auth_unavailable:503,membership_required:403,rate_limit_exceeded:429,approval_forbidden:403,review_step_up_required:403,review_not_found:404,resource_scope_denied:403,resource_scope_database_mismatch:403};
   const code=e instanceof HelpdeskError&&Object.hasOwn(statuses,e.code)?e.code:'review_unavailable',status=statuses[code]??503;
   return privateJson({code,status,detail:'Não foi possível consultar a revisão ou o estado das notificações.',request_id:requestId},status,{'x-request-id':requestId});
  }
 };
}
