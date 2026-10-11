import {parsePublicPortalDetail} from '../domain/portal-detail.ts';
import {randomUUID} from 'node:crypto';import type {Principal} from '../domain/model.ts';
import type {RateLimiter,TrustedRequestContext} from '../infrastructure/rate-limit.ts';import {uuidIdentifier} from '../domain/input-values.ts';
import type {createPortalReader} from '../application/portal-read.ts';import type {createReportExports} from '../application/report-export.ts';
import {parsePortalFilter,portalError} from '../domain/portal-query.ts';import {controlledJson,privateJson} from './controlled-json.ts';
export function createPortalHandler(o:{origin:string;reader:ReturnType<typeof createPortalReader>;exports:ReturnType<typeof createReportExports>;authenticate:(r:Request)=>Promise<Principal>;rateLimiter:RateLimiter;readDetail?:(p:Principal,id:string,signal:AbortSignal)=>Promise<unknown>}){
 if(!o.origin.startsWith('https://')||new URL(o.origin).origin!==o.origin)throw portalError('portal_configuration');
 return async(req:Request,context:TrustedRequestContext={}):Promise<Response>=>{const requestId=randomUUID();try{
  await o.rateLimiter.beforeAuthentication(req,context);const u=new URL(req.url);if(u.origin!==o.origin)throw portalError('origin_required',403);
  const detail=/^\/v1\/portal\/tickets\/([a-f0-9-]+)$/.exec(u.pathname),download=/^\/v1\/portal\/exports\/([a-f0-9-]+)\/download$/.exec(u.pathname),create=u.pathname==='/v1/portal/exports';
  const known=['/v1/portal/tickets','/v1/portal/cockpit','/v1/portal/reports'];if(!known.includes(u.pathname)&&!detail&&!download&&!create)throw portalError('not_found',404);
  const method=create||download?'POST':'GET';if(req.method!==method)return privateJson({code:'method_not_allowed'},405,{allow:method});
  if(method==='POST'&&req.headers.get('origin')!==o.origin)throw portalError('origin_required',403);
  const p=await o.authenticate(req);await o.rateLimiter.afterAuthentication(p);
  if(detail){if(u.search)throw portalError('unknown_parameter',400);if(!o.readDetail)throw portalError('structured_detail_not_configured');return privateJson(parsePublicPortalDetail(await o.readDetail(p,uuidIdentifier(detail[1]),req.signal),uuidIdentifier(detail[1])),200,{'x-request-id':requestId});}
  if(create||download){if(u.search)throw portalError('unknown_parameter',400);const input=await controlledJson(req,16384);if(download){if(Object.keys(input).length)throw portalError('unknown_parameter',400);return privateJson(await o.exports.authorizeExportDownload(p,uuidIdentifier(download[1]),req.signal));}const f=parsePortalFilter(input);return privateJson(await o.exports.prepareReportExport(p,f,req.headers.get('idempotency-key')??'',req.signal));}
  const keys=['account_id','view','status','priority','q','from','until','assignment',...(u.pathname==='/v1/portal/tickets'?['limit','cursor']:[])];for(const k of u.searchParams.keys())if(!keys.includes(k)||u.searchParams.getAll(k).length!==1)throw portalError('unknown_parameter',400);
  const optional:Record<string,unknown>={};for(const k of ['q','from','until','assignment'])if(u.searchParams.has(k))optional[k]=u.searchParams.get(k);for(const [key,name] of [['status','statuses'],['priority','priorities']])if(u.searchParams.has(key!))optional[name!]=u.searchParams.get(key!)!.split(',');
  const f=parsePortalFilter({accountId:u.searchParams.get('account_id'),view:u.searchParams.get('view')??'mine',...optional});let result:unknown;
  if(u.pathname==='/v1/portal/tickets'){const text=u.searchParams.get('limit')??'25';if(!/^[1-9]\d{0,2}$/.test(text)||Number(text)>100)throw portalError('invalid_portal_filter',400);result=await o.reader.readQueue(p,f,{limit:Number(text),cursor:u.searchParams.get('cursor')},req.signal);}
  else if(u.pathname==='/v1/portal/cockpit')result=await o.reader.readCockpit(p,f,req.signal);else result=await o.reader.readOperationalReport(p,f,req.signal);
  return privateJson(result,200,{'x-request-id':requestId});
 }catch(e){let status=503,code='portal_unavailable';try{const s=Object.getOwnPropertyDescriptor(e??{},'status')?.value,c=Object.getOwnPropertyDescriptor(e??{},'code')?.value;if(Number.isInteger(s)&&s>=400&&s<=599&&typeof c==='string'&&/^[a-z_]{1,100}$/.test(c)){status=s;code=c;}}catch{}return privateJson({code,detail:'Não foi possível concluir esta consulta.',request_id:requestId},status);}};
}
