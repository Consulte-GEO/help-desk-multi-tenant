import {randomUUID} from 'node:crypto';import type {Principal} from '../domain/model.ts';import type {RateLimiter,TrustedRequestContext} from '../infrastructure/rate-limit.ts';
import {HelpdeskError} from '../domain/errors.ts';import {uuidIdentifier} from '../domain/input-values.ts';import {parseEmailMonitorFilter,emailMonitorFailure,type EmailMonitorFilter,type EmailMonitorMode} from '../domain/email-monitor.ts';
import {requireEmptyBody} from './empty-body.ts';import {privateJson} from './controlled-json.ts';
export type EmailMonitorInput={mode:EmailMonitorMode;filter:EmailMonitorFilter;eventId:string|null;intentId:string|null};
export interface EmailMonitorQueries{read(p:Principal,input:EmailMonitorInput,signal?:AbortSignal,admission?:()=>void):Promise<Record<string,unknown>>;}
export function createEmailMonitorHandler(o:{enabled:()=>boolean;origin:string;authenticate:(r:Request)=>Promise<Principal>;rateLimiter:RateLimiter;queries:EmailMonitorQueries}){
 if(new URL(o.origin).protocol!=='https:'||new URL(o.origin).origin!==o.origin)throw Error('An exact HTTPS origin is required.');
 return async(req:Request,context:TrustedRequestContext={}):Promise<Response>=>{const requestId=randomUUID();const check=()=>{if(!o.enabled())throw emailMonitorFailure('release_gate_closed',503);if(req.signal.aborted)throw emailMonitorFailure('request_cancelled',409);};try{
  check();await o.rateLimiter.beforeAuthentication(req,context);check();const url=new URL(req.url);
  const match=/^\/v1\/email-communications(?:\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/recipients\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))?)?$/.exec(url.pathname);
  if(!match)throw emailMonitorFailure('not_found',404);if(req.method!=='GET')return privateJson({code:'method_not_allowed'},405,{allow:'GET','x-request-id':requestId});
  if(url.origin!==o.origin)throw emailMonitorFailure('origin_required',403);await requireEmptyBody(req);check();
  const mode:EmailMonitorMode=match[2]?'recipient':match[1]?'delivery':'collection',allowed=mode==='collection'?['limit','cursor','from','to','account_id','work_id','kind','status','q','recipient']:mode==='delivery'?['limit','cursor']:[];
  if([...url.searchParams.keys()].some(k=>!allowed.includes(k)||url.searchParams.getAll(k).length!==1))throw emailMonitorFailure('invalid_email_monitor_filter',400);
  const raw:Record<string,unknown>={};for(const [key,value] of url.searchParams){const name=key==='account_id'?'accountId':key==='work_id'?'workId':key;if(key==='limit'&&!/^[1-9]\d?$/.test(value))throw emailMonitorFailure('invalid_email_monitor_filter',400);raw[name]=key==='limit'?Number(value):value;}
  const filter=parseEmailMonitorFilter(raw),p=await o.authenticate(req);check();await o.rateLimiter.afterAuthentication(p);check();
  const result=await o.queries.read(p,{mode,filter,eventId:match[1]?uuidIdentifier(match[1]):null,intentId:match[2]?uuidIdentifier(match[2]):null},req.signal,check);check();return privateJson(result,200,{'x-request-id':requestId});
 }catch(error){const statuses:Record<string,number>={release_gate_closed:503,request_cancelled:409,not_found:404,origin_required:403,unknown_parameter:400,invalid_identifier:400,invalid_input:400,body_timeout:408,unauthorized:401,mfa_required:403,auth_unavailable:503,membership_required:403,rate_limit_exceeded:429,invalid_email_monitor_filter:400,email_monitor_forbidden:403,email_monitor_cursor_changed:409};const code=error instanceof HelpdeskError&&Object.hasOwn(statuses,error.code)?error.code:'email_monitor_unavailable';return privateJson({code,detail:'Não foi possível consultar a entrega de e-mails.',request_id:requestId},statuses[code]??503,{'x-request-id':requestId});}
 };
}
