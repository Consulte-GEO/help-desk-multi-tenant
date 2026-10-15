import {randomUUID} from 'node:crypto';
import type {Principal} from '../domain/model.ts';
import type {RateLimiter,TrustedRequestContext} from '../infrastructure/rate-limit.ts';
import type {RegistrationReviewView} from '../../shared/registration-review.js';
import {HelpdeskError} from '../domain/errors.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {privateJson,httpFailure} from './controlled-json.ts';
import {requireEmptyBody} from './empty-body.ts';
export type RegistrationReviewQueries={readReview(p:Principal,ticketId:string,audience:'internal'|'customer',signal?:AbortSignal,admission?:()=>void):Promise<RegistrationReviewView>};
/** Read-only fixed-audience routes. No client body or selector supplies authority. */
export function createRegistrationReviewHandler(o:{enabled:()=>boolean;origin:string;authenticate:(r:Request)=>Promise<Principal>;rateLimiter:RateLimiter;queries:RegistrationReviewQueries}){
 const origin=new URL(o.origin);if(origin.protocol!=='https:'||origin.origin!==o.origin)throw Error('Configure an exact HTTPS application origin.');
 return async(req:Request,context:TrustedRequestContext={}):Promise<Response>=>{
  const requestId=randomUUID(),admit=()=>{if(o.enabled()!==true)throw httpFailure(503,'release_gate_closed');if(req.signal.aborted)throw httpFailure(409,'request_cancelled');};
  try{
   admit();await o.rateLimiter.beforeAuthentication(req,context);admit();
   const u=new URL(req.url),m=/^\/v1\/(internal\/)?tickets\/([0-9a-f-]+)\/registration-review$/.exec(u.pathname);
   if(!m)throw httpFailure(404,'not_found');if(req.method!=='GET')return privateJson({code:'method_not_allowed'},405,{allow:'GET','x-request-id':requestId});
   if(u.origin!==o.origin)throw httpFailure(403,'origin_required');if(u.search)throw httpFailure(400,'unknown_parameter');await requireEmptyBody(req);admit();
   const ticketId=uuidIdentifier(m[2]),p=await o.authenticate(req);admit();await o.rateLimiter.afterAuthentication(p);admit();
   const value=await o.queries.readReview(p,ticketId,m[1]?'internal':'customer',req.signal,admit);admit();
   return privateJson(value,200,{'x-request-id':requestId});
  }catch(e){
   const statuses:Record<string,number>={release_gate_closed:503,request_cancelled:409,not_found:404,origin_required:403,unknown_parameter:400,invalid_identifier:400,invalid_input:400,body_timeout:408,unauthorized:401,mfa_required:403,auth_unavailable:503,membership_required:403,rate_limit_exceeded:429,registration_scope_denied:403,registration_scope_changed:403,registration_scope_expired:409,registration_review_not_found:404,resource_scope_denied:403,resource_scope_database_mismatch:403};
   const code=e instanceof HelpdeskError&&Object.hasOwn(statuses,e.code)?e.code:'registration_review_unavailable',status=statuses[code]??503;
   return privateJson({code,status,detail:'Não foi possível consultar a automação de cadastro.',request_id:requestId},status,{'x-request-id':requestId});
  }
 };
}
