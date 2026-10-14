import {randomUUID} from 'node:crypto';
import type {Principal} from '../domain/model.ts';
import {canAccessAccount} from '../domain/policy.ts';
import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';
import {parseExternalResourceRef} from '../domain/external-resource.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {privateJson,httpFailure} from './controlled-json.ts';
type Options={enabled:()=>boolean;origin:string;authenticate:(r:Request)=>Promise<Principal>;
 rateLimiter:{beforeAuthentication(r:Request,c?:{clientIp?:string}):Promise<unknown>;afterAuthentication(p:Principal):Promise<unknown>};
 readRequestContexts(p:Principal,signal:AbortSignal):Promise<unknown>};
const unavailable=()=>httpFailure(503,'local_contexts_unavailable');
function exact(v:unknown,keys:string[]):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))throw unavailable();
 return v as Record<string,unknown>;
}
function text(v:unknown,max:number):string{
 if(!isPersistableText(v)||!v.length||v.trim()!==v||v.length>max||/[\u0000-\u001f\u007f-\u009f]/u.test(v))throw unavailable();return v;
}
/** Bounded authenticated metadata only. Every opening still resolves current
 * resource authority and revalidates SQL under the business transaction lock. */
export function projectConsulteGeoContexts(raw:unknown,p:Principal){
 try{
  const data=copyFormData(raw);if(!Array.isArray(data)||data.length>50)throw unavailable();
  const seen=new Set<string>();let total=0;
  const contexts=data.map(value=>{
   const c=exact(value,['accountId','accountName','productInstanceId','connectionId','tenantId','works']);
   const account=uuidIdentifier(c.accountId),connection=uuidIdentifier(c.connectionId),tenant=text(c.tenantId,256);
   if(seen.has(account)||!canAccessAccount(p,p.workspaceId,account)||!Array.isArray(c.works)||!c.works.length||c.works.length>1000)throw unavailable();seen.add(account);
   const works=new Set<string>();total+=c.works.length;if(total>1000)throw unavailable();
   return {accountId:account,accountName:text(c.accountName,160),productInstanceId:uuidIdentifier(c.productInstanceId),connectionId:connection,tenantId:tenant,
    works:c.works.map(value=>{const w=exact(value,['id','name','ref']),id=text(w.id,256),ref=parseExternalResourceRef(w.ref);
     if(works.has(id)||ref.connectionId!==connection||ref.tenantId!==tenant||ref.type!=='work'||ref.id!==id)throw unavailable();works.add(id);
     return {id,name:text(w.name,160),ref};
    })};
  });
  const result={schema:1,workspaceId:p.workspaceId,principalId:p.id,contexts};
  if(Buffer.byteLength(JSON.stringify(result),'utf8')>262144)throw unavailable();return freezeFormData(result);
 }catch{throw unavailable();}
}
export function createConsulteGeoContextsHttpHandler(d:Options){
 return async(req:Request,context:{clientIp?:string}={}):Promise<Response>=>{
  const requestId=randomUUID();const admit=()=>{if(d.enabled()!==true)throw httpFailure(503,'release_gate_closed');if(req.signal.aborted)throw httpFailure(409,'request_cancelled');};
  try{
   admit();await d.rateLimiter.beforeAuthentication(req,context);admit();const url=new URL(req.url);
   if(url.origin!==d.origin)throw httpFailure(403,'origin_denied');if(url.pathname!=='/v1/consultegeo/contexts')throw httpFailure(404,'not_found');
   if(url.search)throw httpFailure(400,'unknown_parameter');if(req.method!=='GET')throw httpFailure(405,'method_not_allowed');
   const p=await d.authenticate(req);admit();await d.rateLimiter.afterAuthentication(p);admit();
   if(p.kind!=='human'||!p.scopes.includes('contexts:resolve')||!p.scopes.includes('tickets:read'))throw httpFailure(403,'forbidden');
   const raw=await d.readRequestContexts(p,req.signal);admit();const projected=projectConsulteGeoContexts(raw,p);admit();
   return privateJson(projected,200,{'x-request-id':requestId});
  }catch(e){
   const safe:Record<string,number>={release_gate_closed:503,request_cancelled:409,origin_denied:403,not_found:404,unknown_parameter:400,method_not_allowed:405,unauthorized:401,mfa_required:403,membership_required:403,forbidden:403,rate_limit_exceeded:429};
   const code=e&&typeof e==='object'?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;
   const status=typeof code==='string'?safe[code]:undefined;
   return privateJson({type:'about:blank',title:'Consulta indisponível',status:status??503,code:status?code:'local_contexts_unavailable',detail:'Não foi possível consultar as obras autorizadas.',request_id:requestId},status??503,{'x-request-id':requestId});
  }
 };
}
