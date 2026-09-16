import {randomUUID} from 'node:crypto';
import {RELEASE} from '../version.ts';
import {ERROR_CODES} from './codes.ts';
export const METHODS=new Set(['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS','OTHER']);
export const ROUTES=new Set([
 '/v1/capabilities','/v1/public-config','/v1/integration-tokens','/v1/integration-tokens/current',
 '/v1/me','/v1/support-contexts','/v1/contexts/resolve','/v1/tickets',
 '/v1/tickets/{ticket_id}','/v1/tickets/{ticket_id}/messages','/v1/tickets/{ticket_id}/notes',
 '/v1/tickets/{ticket_id}/timeline','/v1/tickets/{ticket_id}/transitions','/v1/tickets/{ticket_id}/assignments','unmatched'
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function requestIdFor(request:Request):string {
 const value=request.headers.get('x-request-id');
 // A propagated correlation identifier is NOT an identity, proof of origin or metric dimension.
 return value&&UUID.test(value)?value.toLowerCase():randomUUID();
}
export function routeTemplate(path:string):string {
 if(ROUTES.has(path)&&!path.includes('{'))return path;
 const ticket=/^\/v1\/tickets\/[^/]+(?:\/(messages|notes|timeline|transitions|assignments))?$/.exec(path);
 return ticket?'/v1/tickets/{ticket_id}'+(ticket[1]?'/'+ticket[1]:''):'unmatched';
}
export type HttpObservation=Readonly<{
 event_schema:1;component:'helpdesk.http';release:string;occurred_at:string;request_id:string;
 phase:'http'|'bootstrap'|'dispatch';route:string;method:string;status:number;status_class:string;
 severity:'info'|'warn'|'error';error_code:string|null;duration_ms:number|null;
}>;
export type HttpObserver=(event:HttpObservation)=>unknown;
export function httpObservation(input:{request:Request;requestId:string;status:number;errorCode?:string|null;
 phase:HttpObservation['phase'];started:number;finished:number}):HttpObservation {
 const elapsed=input.finished-input.started;
 return Object.freeze({
  event_schema:1,component:'helpdesk.http',release:RELEASE,occurred_at:new Date().toISOString(),
  request_id:input.requestId,phase:input.phase,
  route:routeTemplate(new URL(input.request.url).pathname.replace(/\/$/,'')),
  method:METHODS.has(input.request.method)?input.request.method:'OTHER',status:input.status,
  status_class:Math.floor(input.status/100)+'xx',severity:input.status>=500?'error':input.status>=400?'warn':'info',
  error_code:input.status<400?null:ERROR_CODES.has(input.errorCode??'')?input.errorCode!:'unclassified_error',
  duration_ms:Number.isFinite(elapsed)&&elapsed>=0&&elapsed<=86_400_000?Math.round(elapsed*1000)/1000:null
 });
}
/** A diagnostic sink cannot change transaction outcomes or leave an unhandled rejected Promise. */
export function notifyObserver(observer:HttpObserver|undefined,event:HttpObservation):void {
 if(!observer)return;
 try{const pending=observer(event);if(pending&&typeof (pending as PromiseLike<unknown>).then==='function')void Promise.resolve(pending).catch(()=>{});}
 catch{/* Bounded, best-effort telemetry. No retry queue or recursive logging. */}
}
export const consoleHttpObserver:HttpObserver=event=>{
 // event is a closed, immutable projection, not request/error/headers spread into a log.
 const line=JSON.stringify(event);
 if(event.severity==='error')console.error(line);else if(event.severity==='warn')console.warn(line);else console.info(line);
};
