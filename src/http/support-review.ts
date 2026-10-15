import {randomUUID} from 'node:crypto';import type {Principal} from '../domain/model.ts';
import type {RateLimiter,TrustedRequestContext} from '../infrastructure/rate-limit.ts';
import {uuidIdentifier} from '../domain/input-values.ts';import {HelpdeskError} from '../domain/errors.ts';
import {reviewRecord} from '../domain/support-review.ts';import {safeReviewError,type createSupportReview} from '../application/support-review.ts';
import {controlledJson,privateJson,httpFailure} from './controlled-json.ts';
/** Optional route group, mounted only by the qualified schema25 runtime gates.
 * withIdentity must preserve the owned server-side step-up proof throughout callback.
 * Never accept a proof/role/capability from request JSON. */
export function createSupportReviewHandler(o:{origin:string;service:ReturnType<typeof createSupportReview>;rateLimiter:RateLimiter;withIdentity:<T>(request:Request,work:(p:Principal,stepUp:unknown)=>Promise<T>)=>Promise<T>}){
 const origin=new URL(o.origin);if(origin.protocol!=='https:'||origin.origin!==o.origin)throw Error('Configure an exact HTTPS application origin.');
 return async(req:Request,context:TrustedRequestContext={}):Promise<Response>=>{
  const requestId=randomUUID();
  try{
   await o.rateLimiter.beforeAuthentication(req,context);const u=new URL(req.url);
   if(u.pathname==='/v1/tickets'&&req.method==='POST')throw httpFailure(503,'structured_intake_required');
   const match=/^\/v1\/tickets\/([0-9a-f-]+)\/(approval-challenge|approval-decisions|approval-invitations|form-preview|form-revisions)$/.exec(u.pathname);
   if(!match)throw httpFailure(404,'not_found');
   if(req.method!=='POST')return privateJson({code:'method_not_allowed'},405,{allow:'POST','x-request-id':requestId});
   if(u.origin!==o.origin||req.headers.get('origin')!==o.origin)throw httpFailure(403,'origin_required');
   if(u.search)throw httpFailure(400,'unknown_parameter');
   const ticketId=uuidIdentifier(match[1]),revision=/^"([1-9]\d*)"$/.exec(req.headers.get('if-match')??'');
   if(!revision||!Number.isSafeInteger(Number(revision[1])))throw httpFailure(428,'precondition_required');const expected=Number(revision[1]);
   const action=match[2],key=req.headers.get('idempotency-key')??'';
   if(!['approval-challenge','form-preview'].includes(action!)&&!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw httpFailure(400,'invalid_idempotency_key');
   const result=await o.withIdentity(req,async(p,proof)=>{
    await o.rateLimiter.afterAuthentication(p);const raw=await controlledJson(req,65536),signal=req.signal;
    if(action==='approval-invitations'){reviewRecord(raw,[]);return o.service.requestApproval(p,ticketId,expected,key,requestId,proof,signal);}
    if(action==='approval-challenge'){const b=reviewRecord(raw,['invitationId']);return o.service.prepareApproval(p,ticketId,uuidIdentifier(b.invitationId),expected,requestId,proof,signal);}
    if(action==='approval-decisions'){const b=reviewRecord(raw,['invitationId','expectedFormRevision','token','decision','reason']);return o.service.decideApproval(p,{...b,ticketId,expectedVersion:expected},key,requestId,proof,signal);}
    const b=reviewRecord(raw,['expectedFormRevision','draftId','expectedDraftRevision','comment',...(action==='form-revisions'?['previewHash']:[])]),command={...b,ticketId,expectedVersion:expected};
    return action==='form-preview'?o.service.previewSupportRevision(p,command,signal):o.service.reviseSupportForm(p,command,key,requestId,signal);
   });
   return privateJson(result,match[2]==='approval-invitations'?202:200,{'x-request-id':requestId});
  }catch(e){const httpCodes=['structured_intake_required','not_found','origin_required','unknown_parameter','precondition_required','invalid_idempotency_key','unsupported_media_type','invalid_json','request_cancelled','request_timeout','payload_too_large','invalid_identifier'];
   const boundaryStatuses:Record<string,number>={unauthorized:401,membership_required:403,mfa_required:403,rate_limit_exceeded:429,auth_unavailable:503};
   const safe=e instanceof HelpdeskError&&Object.hasOwn(boundaryStatuses,e.code)?httpFailure(boundaryStatuses[e.code]!,e.code):e instanceof HelpdeskError&&httpCodes.includes(e.code)?httpFailure(e.status,e.code):safeReviewError(e);
   return privateJson({code:safe.code,status:safe.status,detail:safe.message,request_id:requestId},safe.status,{'x-request-id':requestId});
  }
 };
}
