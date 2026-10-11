import {randomUUID} from 'node:crypto';
import {HelpdeskError} from '../domain/errors.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import type {Principal} from '../domain/model.ts';
import type {VerifiedAdministrativeAssurance} from '../infrastructure/authentication.ts';
import type {createMemberAdministration,MemberAdminReceipt} from '../application/member-admin.ts';

export interface MemberAdminHttpOptions{
 enabled:()=>boolean;
 authentication:{withAdministrativeAssurance<T>(req:Request,work:(p:Principal,proof:VerifiedAdministrativeAssurance)=>Promise<T>):Promise<T>};
 administration:ReturnType<typeof createMemberAdministration>;
 rateLimiter:{beforeAuthentication(req:Request,context?:{clientIp?:string}):Promise<unknown>;afterAuthentication(p:Principal):Promise<unknown>};
}
const fault=(status:number,code:string)=>new HelpdeskError(status,code,'Requisição administrativa não concluída.');
const statusByCode:Record<string,number>={
 release_gate_closed:503,unauthorized:401,membership_required:403,auth_unavailable:503,administrative_assurance_required:403,
 administrative_capability_required:403,invalid_administrative_state:503,member_admin_invalid_state:503,
 invalid_identifier:400,invalid_member_command:400,member_self_change_denied:403,member_version_conflict:412,
 member_cursor_stale:409,member_idempotency_conflict:409,member_already_registered:409,person_not_found:404,
 member_not_found:404,member_not_current:409,member_not_expired:409,last_administrator_required:409,
 successor_not_ready:409,member_admin_outcome_unknown:503,precondition_required:428,
 invalid_idempotency_key:400,unsupported_media_type:415,payload_too_large:413,invalid_json:400,
 unknown_field:400,unknown_parameter:400,method_not_allowed:405,not_found:404,origin_denied:403,
 request_cancelled:409,request_timeout:408,rate_limit_exceeded:429,
};
function response(data:unknown,status:number,requestId:string,extra:Record<string,string>={}):Response{
 return Response.json(data,{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-request-id':requestId,...extra}});
}
function problem(error:unknown,requestId:string):Response{
 let code='member_admin_unavailable';
 try{const d=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code'):undefined;
  if(d&&Object.hasOwn(d,'value')&&typeof d.value==='string'&&Object.hasOwn(statusByCode,d.value))code=d.value;
 }catch{/* Keep private parser/transport errors out of the public response. */}
 const status=statusByCode[code]??503;
 return response({type:'about:blank',status,code,detail:code==='member_admin_outcome_unknown'?'Confirmação desconhecida. Conserve a mesma chave para conciliação; não repita automaticamente.':'Não foi possível concluir esta operação administrativa.',request_id:requestId},status,requestId,{'content-type':'application/problem+json'});
}
async function readBody(req:Request,keys:string[]):Promise<Record<string,unknown>>{
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')??'')||req.headers.has('content-encoding'))throw fault(415,'unsupported_media_type');
 const reader=req.body?.getReader();if(!reader)throw fault(400,'invalid_json');
 const chunks:Uint8Array[]=[];let length=0,rejectStop:(e:unknown)=>void=()=>{};
 const stop=new Promise<never>((_,reject)=>{rejectStop=reject;});
 const onAbort=()=>rejectStop(fault(409,'request_cancelled'));
 const started=performance.now(),timer=setTimeout(()=>rejectStop(fault(408,'request_timeout')),5000);
 req.signal.addEventListener('abort',onAbort,{once:true});
 try{
  if(req.signal.aborted)throw fault(409,'request_cancelled');
  for(;;){const part=await Promise.race([reader.read(),stop]);if(req.signal.aborted)throw fault(409,'request_cancelled');if(performance.now()-started>=5000)throw fault(408,'request_timeout');if(part.done)break;
   length+=part.value.length;if(length>24*1024)throw fault(413,'payload_too_large');chunks.push(part.value);
  }
  const bytes=new Uint8Array(length);let position=0;for(const c of chunks){bytes.set(c,position);position+=c.length;}
  let value:unknown;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw fault(400,'invalid_json');}
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||Object.keys(value).some(k=>!keys.includes(k)))throw fault(400,'unknown_field');
  return value as Record<string,unknown>;
 }catch(error){try{void reader.cancel().catch(()=>{});}catch{/* Best effort */}throw error;}
 finally{clearTimeout(timer);req.signal.removeEventListener('abort',onAbort);try{reader.releaseLock();}catch{/* pending cancellation */}}
}
function memberDto(m:MemberAdminReceipt['member']&{effectiveStatus?:string}){
 return {principal_id:m.principalId,principal_kind:m.principalKind,role:m.role,status:m.status,
  ...(m.effectiveStatus===undefined?{}:{effective_status:m.effectiveStatus}),revision:m.revision,expires_at:m.expiresAt};
}
/** Optional administrative mount. Runtime remains unchanged until SQL, capability
 * policies, schema, original handler contracts and deployment gates are qualified.
 * This module never creates users, expands business scopes or sends invitations.
 */
export function createMemberAdminHttpHandler(d:MemberAdminHttpOptions){
 return async(req:Request,context:{clientIp?:string}={}):Promise<Response>=>{
  const requestId=randomUUID();
  try{
   if(d.enabled()!==true)throw fault(503,'release_gate_closed');
   await d.rateLimiter.beforeAuthentication(req,context);
   const url=new URL(req.url),path=url.pathname.replace(/\/$/,'');
   if(req.signal.aborted)throw fault(409,'request_cancelled');
   if(path==='/v1/admin/members'&&req.method==='GET'){
    if([...url.searchParams.keys()].some(k=>!['limit','cursor'].includes(k)||url.searchParams.getAll(k).length!==1))throw fault(400,'unknown_parameter');
    const textLimit=url.searchParams.get('limit')??'50';if(!/^[1-9]\d{0,2}$/.test(textLimit)||Number(textLimit)>100)throw fault(400,'invalid_member_command');
    return await d.authentication.withAdministrativeAssurance(req,async(p,proof)=>{
     await d.rateLimiter.afterAuthentication(p);if(req.signal.aborted)throw fault(409,'request_cancelled');
     const result=await d.administration.list(p,proof,{limit:Number(textLimit),...(url.searchParams.has('cursor')?{cursor:url.searchParams.get('cursor')!}:{})});
     return response({workspace_id:result.workspaceId,revision:result.revision,total:result.total,available_actions:result.availableActions,items:result.items.map(memberDto),next_cursor:result.nextCursor},200,requestId,{etag:`"${result.revision}"`});
    });
   }
   const invite=path==='/v1/admin/members/invitations';
   const match=/^\/v1\/admin\/members\/([^/]+)(?:\/(revocations|expiry|succession))?$/.exec(path);
   if(!invite&&!match)throw fault(404,'not_found');
   const action=invite?'invite':match![2]==='revocations'?'revoke':match![2]==='expiry'?'expire':match![2]==='succession'?'handoff':'set_role';
   if(req.method!==(action==='set_role'?'PATCH':'POST'))throw fault(405,'method_not_allowed');
   if(url.search)throw fault(400,'unknown_parameter');
   const origin=req.headers.get('origin');if(origin!==null&&origin!==url.origin)throw fault(403,'origin_denied');
   const revision=/^"([1-9]\d*)"$/.exec(req.headers.get('if-match')??'');if(!revision||!Number.isSafeInteger(Number(revision[1])))throw fault(428,'precondition_required');
   const key=req.headers.get('idempotency-key')??'';if(!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw fault(400,'invalid_idempotency_key');
   const target=invite?undefined:uuidIdentifier(match![1]);
   return await d.authentication.withAdministrativeAssurance(req,async(p,proof)=>{
    await d.rateLimiter.afterAuthentication(p);
    const keys=invite?['principal_id','reason','expires_at']:['member_revision','reason',...(action==='set_role'?['role']:[]),...(action==='handoff'?['successor_principal_id']:[])];
    const body=await readBody(req,keys);if(req.signal.aborted)throw fault(409,'request_cancelled');
    const command={action,targetPrincipalId:invite?uuidIdentifier(body.principal_id):target,expectedRevision:Number(revision[1]),reason:body.reason,
     ...(invite?{expiresAt:body.expires_at}:{expectedMemberRevision:body.member_revision}),...(action==='set_role'?{role:body.role}:{}),...(action==='handoff'?{successorPrincipalId:uuidIdentifier(body.successor_principal_id)}:{})};
    const result=await d.administration.execute(p,proof,command,key);
    return response({workspace_id:result.workspaceId,actor_id:result.actorId,revision:result.revision,member:memberDto(result.member),audit_id:result.auditId,notification:result.notification,replayed:result.replayed},invite&&!result.replayed?201:200,requestId,{etag:`"${result.revision}"`,'idempotency-replayed':String(result.replayed)});
   });
  }catch(error){return problem(error,requestId);}
 };
}
