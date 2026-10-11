import {randomUUID} from 'node:crypto';import type {Principal} from '../domain/model.ts';import {uuidIdentifier} from '../domain/input-values.ts';
import type {RateLimiter,TrustedRequestContext} from '../infrastructure/rate-limit.ts';
import type {createOutboxDispatcher} from '../application/outbox-dispatch.ts';
import {notificationRecord} from '../domain/notification-delivery.ts';import {HelpdeskError} from '../domain/errors.ts';import {controlledJson,privateJson,httpFailure} from './controlled-json.ts';
/** Operator-only candidate route group. The injected authorizer must lock/revalidate
 * the human, step-up, exact capability and ticket/resource visibility; no default.
 * Reconciliation queries provider evidence; there is intentionally NO resend action.
 */
export function createDeliveryOperationsHandler(o:{origin:string;dispatcher:ReturnType<typeof createOutboxDispatcher>;rateLimiter:RateLimiter;withAuthorizedDelivery:<T>(req:Request,id:string,cap:'notifications.read'|'notifications.reconcile',work:(p:Principal)=>Promise<T>)=>Promise<T>}){
 const origin=new URL(o.origin);if(origin.protocol!=='https:'||origin.origin!==o.origin)throw Error('Configure an exact HTTPS application origin.');
 return async(req:Request,context:TrustedRequestContext={}):Promise<Response>=>{
  const requestId=randomUUID();try{
   await o.rateLimiter.beforeAuthentication(req,context);const u=new URL(req.url),m=/^\/v1\/deliveries\/([0-9a-f-]+)(\/reconcile)?$/.exec(u.pathname);
   if(!m)throw httpFailure(404,'not_found');const id=uuidIdentifier(m[1]),reconcile=!!m[2];
   if(req.method!==(reconcile?'POST':'GET'))return privateJson({code:'method_not_allowed'},405,{allow:reconcile?'POST':'GET'});
   if(u.search)throw httpFailure(400,'unknown_parameter');
   if(u.origin!==o.origin||reconcile&&req.headers.get('origin')!==o.origin)throw httpFailure(403,'origin_required');
   const result=await o.withAuthorizedDelivery(req,id,reconcile?'notifications.reconcile':'notifications.read',async p=>{
    uuidIdentifier(p.id);await o.rateLimiter.afterAuthentication(p);
    if(reconcile){notificationRecord(await controlledJson(req,1024),[]);return o.dispatcher.reconcileDelivery(id,{actorId:p.id,requestId});}
    return o.dispatcher.readDelivery(id);
   });return privateJson(result,200,{'x-request-id':requestId});
  }catch(e){let status=503,code='delivery_unavailable';if(e instanceof HelpdeskError&&['not_found','invalid_identifier','origin_required','unknown_parameter','unsupported_media_type','invalid_json','invalid_notification','delivery_access_denied','delivery_receipt_mismatch','delivery_event_conflict','request_cancelled','request_timeout','payload_too_large'].includes(e.code)){status=e.status;code=e.code;}
   return privateJson({code,status,detail:'Não foi possível concluir a consulta da entrega.',request_id:requestId},status,{'x-request-id':requestId});}
 };
}
