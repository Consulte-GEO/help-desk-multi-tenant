import {randomUUID} from 'node:crypto';
import type {Principal} from '../domain/model.ts';
import type {VerifiedAdministrativeAssurance} from '../infrastructure/authentication.ts';
import type {createFormCatalog} from '../application/form-catalog.ts';
import {formRecord} from '../domain/form-schema.ts';
import {controlledJson,privateJson,httpFailure as fail} from './controlled-json.ts';
export interface FormCatalogHttpOptions{
 enabled:()=>boolean;
 authentication:{withAdministrativeAssurance<T>(req:Request,work:(p:Principal,proof:VerifiedAdministrativeAssurance)=>Promise<T>):Promise<T>};
 catalog:ReturnType<typeof createFormCatalog>;
 rateLimiter:{beforeAuthentication(req:Request,context?:{clientIp?:string}):Promise<unknown>;afterAuthentication(p:Principal):Promise<unknown>};
}
const codes:Record<string,number>={release_gate_closed:503,not_found:404,method_not_allowed:405,unknown_parameter:400,origin_denied:403,precondition_required:428,invalid_idempotency_key:400,unsupported_media_type:415,invalid_json:400,payload_too_large:413,request_cancelled:409,request_timeout:408,unauthorized:401,auth_unavailable:503,membership_required:403,rate_limit_exceeded:429,administrative_assurance_required:403,administrative_capability_required:403,invalid_administrative_state:503,invalid_form_input:400,invalid_form_schema:400,form_version_conflict:412,form_identity_immutable:409,form_published_immutable:409,form_idempotency_conflict:409,form_not_publishable:409,form_not_found:404,form_outcome_unknown:503,form_catalog_unavailable:503};
/** Optional mount only. No automatic route registration, capability grants or
 * published taxonomy. The caller must supply the reviewed persistent store.
 */
export function createFormCatalogHttpHandler(d:FormCatalogHttpOptions){
 return async(req:Request,context:{clientIp?:string}={}):Promise<Response>=>{
  const requestId=randomUUID();
  try{
   if(d.enabled()!==true)throw fail(503,'release_gate_closed');await d.rateLimiter.beforeAuthentication(req,context);
   const url=new URL(req.url),draft=url.pathname==='/v1/admin/forms/drafts';
   const match=/^\/v1\/admin\/forms\/([0-9a-f-]+)\/versions\/([1-9]\d*)(?:\/(publish|restore))?$/.exec(url.pathname);
   if(!draft&&!match)throw fail(404,'not_found');if(url.search)throw fail(400,'unknown_parameter');
   const action=draft?'save':match![3],version=match?Number(match[2]):undefined;
   if(version!==undefined&&!Number.isSafeInteger(version))throw fail(400,'invalid_form_input');
   if(!action){if(req.method!=='GET')throw fail(405,'method_not_allowed');return await d.authentication.withAdministrativeAssurance(req,async(p,proof)=>{await d.rateLimiter.afterAuthentication(p);if(req.signal.aborted)throw fail(409,'request_cancelled');const record=await d.catalog.read(p,proof,match![1]!,version!);return privateJson({record},200,{'x-request-id':requestId});});}
   if(req.method!=='POST')throw fail(405,'method_not_allowed');const origin=req.headers.get('origin');if(origin!==null&&origin!==url.origin)throw fail(403,'origin_denied');
   const expected=/^"([1-9]\d*)"$/.exec(req.headers.get('if-match')??'');if(!expected||!Number.isSafeInteger(Number(expected[1])))throw fail(428,'precondition_required');
   const key=req.headers.get('idempotency-key')??'';if(!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw fail(400,'invalid_idempotency_key');
   return await d.authentication.withAdministrativeAssurance(req,async(p,proof)=>{
    await d.rateLimiter.afterAuthentication(p);
    const b=formRecord(await controlledJson(req,262144),action==='save'?['schema','profileId','categoryCode','expectedEntityRevision','reason']:action==='publish'?['expectedEntityRevision','reason']:['reason']);
    if(req.signal.aborted)throw fail(409,'request_cancelled');
    const result=await d.catalog.execute(p,proof,{action,...b,expectedRevision:Number(expected[1]),...(draft?{}:{formId:match![1],version})},key);
    return privateJson(result,draft&&!result.replayed?201:200,{'x-request-id':requestId,etag:`"${result.revision}"`,'idempotency-replayed':String(result.replayed)});
   });
  }catch(e){let code='form_catalog_unavailable';try{const c=e&&typeof e==='object'?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;if(typeof c==='string'&&Object.hasOwn(codes,c))code=c;}catch{}const status=codes[code]!;
   return privateJson({type:'about:blank',status,code,detail:code==='form_outcome_unknown'?'Confirmação desconhecida. Concilie a mesma intenção.':'Não foi possível concluir a operação do formulário.',request_id:requestId},status,{'content-type':'application/problem+json','x-request-id':requestId});}
 };
}
