import {randomUUID} from 'node:crypto';
import type {Principal} from '../domain/model.ts';
import type {VerifiedAdministrativeAssurance} from '../infrastructure/authentication.ts';
import type {createConfigurationAdministration} from '../application/configuration-admin.ts';
import {configurationObject,type ConfigurationKind} from '../domain/support-configuration.ts';
import {controlledJson,privateJson,httpFailure as fail} from './controlled-json.ts';
const paths:Record<string,ConfigurationKind>={accounts:'account',products:'product',instances:'instance',services:'service',bindings:'binding',contracts:'contract', 'contract-versions':'contract_version',coverages:'coverage'};
const safeStatus:Record<string,number>={release_gate_closed:503,unsupported_media_type:415,invalid_json:400,payload_too_large:413,request_cancelled:409,request_timeout:408,not_found:404,method_not_allowed:405,unknown_parameter:400,origin_denied:403,precondition_required:428,invalid_idempotency_key:400,administrative_assurance_required:403,administrative_capability_required:403,invalid_administrative_state:503,invalid_configuration_state:503,invalid_configuration_command:400,configuration_version_conflict:412,configuration_cursor_stale:409,configuration_duplicate:409,configuration_reference_ineligible:409,configuration_identity_immutable:409,published_configuration_immutable:409,configuration_not_found:404,configuration_idempotency_conflict:409,configuration_outcome_unknown:503,rate_limit_exceeded:429,unauthorized:401,auth_unavailable:503,membership_required:403};
export interface ConfigurationAdminHttpOptions{
 enabled:()=>boolean;
 authentication:{withAdministrativeAssurance<T>(request:Request,work:(p:Principal,proof:VerifiedAdministrativeAssurance)=>Promise<T>):Promise<T>};
 administration:ReturnType<typeof createConfigurationAdministration>;
 rateLimiter:{beforeAuthentication(request:Request,context?:{clientIp?:string}):Promise<unknown>;afterAuthentication(p:Principal):Promise<unknown>};
}
/** Optional mount: enable only with the reviewed SQL store, runtime gates and source
 * qualification. A route selector maps to a fixed command, never a table name.
 */
export function createConfigurationAdminHttpHandler(d:ConfigurationAdminHttpOptions){
 return async(req:Request,context:{clientIp?:string}={}):Promise<Response>=>{
  const requestId=randomUUID();
  try{
   if(d.enabled()!==true)throw fail(503,'release_gate_closed');await d.rateLimiter.beforeAuthentication(req,context);
   const url=new URL(req.url),match=/^\/v1\/admin\/([a-z-]+)(?:\/([0-9a-f-]+)(?:\/(publish))?)?\/?$/.exec(url.pathname);
   const kind=match&&Object.hasOwn(paths,match[1]!)?paths[match[1]!]!:undefined;if(!kind)throw fail(404,'not_found');
   const id=match![2],publish=match![3]==='publish';
   if(req.method==='GET'&&!id){
    if([...url.searchParams.keys()].some(k=>!['limit','cursor'].includes(k)||url.searchParams.getAll(k).length!==1))throw fail(400,'unknown_parameter');
    const limit=url.searchParams.get('limit')??'50';if(!/^[1-9][0-9]{0,2}$/.test(limit)||Number(limit)>100)throw fail(400,'invalid_configuration_command');
    return await d.authentication.withAdministrativeAssurance(req,async(p,proof)=>{
     await d.rateLimiter.afterAuthentication(p);if(req.signal.aborted)throw fail(409,'request_cancelled');
     const r=await d.administration.list(p,proof,{kind,limit:Number(limit),...(url.searchParams.has('cursor')?{cursor:url.searchParams.get('cursor')}:{})});
     return privateJson({workspace_id:r.workspaceId,revision:r.revision,total:r.total,items:r.items,next_cursor:r.nextCursor},200,{'x-request-id':requestId,etag:`"${r.revision}"`});
    });
   }
   const method=publish||!id?'POST':'PATCH';if(req.method!==method||publish&&kind!=='contract_version')throw fail(405,'method_not_allowed');
   if(url.search)throw fail(400,'unknown_parameter');const origin=req.headers.get('origin');if(origin!==null&&origin!==url.origin)throw fail(403,'origin_denied');
   const revision=/^"([1-9][0-9]*)"$/.exec(req.headers.get('if-match')??'');if(!revision||!Number.isSafeInteger(Number(revision[1])))throw fail(428,'precondition_required');
   const key=req.headers.get('idempotency-key')??'';if(!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw fail(400,'invalid_idempotency_key');
   return await d.authentication.withAdministrativeAssurance(req,async(p,proof)=>{
    await d.rateLimiter.afterAuthentication(p);const b=configurationObject(await controlledJson(req),['data','reason',...(id?['entity_revision']:[])]);
    if(req.signal.aborted)throw fail(409,'request_cancelled');
    const result=await d.administration.execute(p,proof,{action:kind+'.'+(publish?'publish':id?'update':'create'),expectedRevision:Number(revision[1]),reason:b.reason,data:b.data,...(id?{targetId:id,expectedEntityRevision:b.entity_revision}:{})},key);
    return privateJson({workspace_id:result.workspaceId,actor_id:result.actorId,revision:result.revision,record:result.record,audit_id:result.auditId,replayed:result.replayed},!id&&!result.replayed?201:200,{'x-request-id':requestId,etag:`"${result.revision}"`,'idempotency-replayed':String(result.replayed)});
   });
  }catch(e){
   let code='configuration_unavailable';try{const c=e&&typeof e==='object'?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;if(typeof c==='string'&&Object.hasOwn(safeStatus,c))code=c;}catch{/* no private error messages */}
   const status=safeStatus[code]??503;return privateJson({type:'about:blank',status,code,detail:code==='configuration_outcome_unknown'?'Confirmação desconhecida. Concilie a mesma intenção antes de iniciar outra.':'Não foi possível concluir a configuração.',request_id:requestId},status,{'content-type':'application/problem+json','x-request-id':requestId});
  }
 };
}
