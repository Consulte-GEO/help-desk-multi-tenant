import {randomUUID} from 'node:crypto';
import type {Principal} from '../domain/model.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {parseExternalResourceSelection} from '../domain/external-resource.ts';
import type {ResourceOperation, createResourceAccessResolver} from '../application/resource-access.ts';
import {runResourceTicketTransaction} from '../infrastructure/resource-access-store.ts';
import {runTransaction} from '../infrastructure/transaction.ts';
import type {SqlClient,SqlPool} from '../infrastructure/sql.ts';

/** Private lookup only. Return the COMPLETE ticket selection, never caller-chosen refs.
 * This port must use the authenticated actor's base relationship and a qualified
 * directory. Its output is metadata, not authorization; resolver and SQL check again.
 */
export interface TicketResourceDirectory {
 readTicketResources(principal:Principal,ticketId:string,signal:AbortSignal):Promise<unknown>;
}
export interface ScopedTicketHttpOptions {
 enabled:()=>boolean;
 authenticate:(request:Request)=>Promise<Principal>;
 rateLimiter:{beforeAuthentication:(request:Request,context?:{clientIp?:string})=>Promise<unknown>;afterAuthentication:(p:Principal)=>Promise<unknown>};
 pool:SqlPool;
 resolver:ReturnType<typeof createResourceAccessResolver>;
 directory:TicketResourceDirectory;
 directoryTimeoutMs:number;
 streamTimeoutMs?:number;
 /** Server-selected local collection composition; never a request selector. */
 collection?:boolean;
 /** Required server adapter: use existing HelpdeskService/DTOs on THIS borrowed
  * client. No second pool, nested BEGIN/COMMIT or optional-note data in public DTOs.
  * This factory does not supply a fake implementation when the adapter is absent.
  */
 execute:(client:SqlClient,principal:Principal,request:Request)=>Promise<Response>;
}
const fail=(status:number,code:string,message:string)=>new HelpdeskError(status,code,message);
const unavailable=()=>fail(503,'resource_directory_unavailable','Não foi possível conferir os recursos do chamado.');
const canceled=()=>fail(409,'request_cancelled','Requisição cancelada.');
function object(input:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw unavailable();
 const proto=Object.getPrototypeOf(input),actual=Reflect.ownKeys(input);
 if(proto!==Object.prototype&&proto!==null||actual.length!==keys.length||actual.some(k=>typeof k!=='string'||!keys.includes(k)))throw unavailable();
 return Object.fromEntries(keys.map(k=>{const d=Object.getOwnPropertyDescriptor(input,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw unavailable();return [k,d.value];}));
}
async function ownedLookup(d:ScopedTicketHttpOptions,p:Principal,ticketId:string,signal:AbortSignal){
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 let rejectAbort:(e:unknown)=>void=()=>{};const started=performance.now();
 const abort=()=>{controller.abort();rejectAbort(canceled());};
 const stop=new Promise<never>((_,reject)=>{rejectAbort=reject;timer=setTimeout(()=>{controller.abort();reject(unavailable());},d.directoryTimeoutMs);});
 signal.addEventListener('abort',abort,{once:true});
 try{
  if(signal.aborted)throw canceled();
  const value=await Promise.race([Promise.resolve().then(()=>d.directory.readTicketResources(p,ticketId,controller.signal)),stop]);
  if(signal.aborted)throw canceled();
  if(performance.now()-started>=d.directoryTimeoutMs)throw unavailable();
  if(value===null)throw fail(404,'resource_not_found','Recurso não encontrado ou sem acesso.');
  const x=object(value,['ticketId','workspaceId','accountId','refs']);
  if(x.ticketId!==ticketId||x.workspaceId!==p.workspaceId)throw fail(403,'resource_scope_denied','Contexto do chamado não autorizado.');
  const accountId=uuidIdentifier(x.accountId);
  if(p.workspaceRole!=='admin'&&!p.grants.some(g=>g.accountId===accountId))throw fail(403,'resource_scope_denied','Conta não autorizada.');
  return {accountId,refs:parseExternalResourceSelection(x.refs)};
 }catch(e){
  if(signal.aborted)throw canceled();
  if(e instanceof HelpdeskError&&['resource_not_found','resource_scope_denied'].includes(e.code))throw e;
  throw unavailable();
 }finally{clearTimeout(timer);signal.removeEventListener('abort',abort);controller.abort();}
}
async function boundedBytes(stream:ReadableStream<Uint8Array>|null,limit:number,signal:AbortSignal,timeoutMs:number):Promise<Uint8Array>{
 if(!stream)return new Uint8Array();
 const reader=stream.getReader(),parts:Uint8Array[]=[];let n=0;
 let rejectAbort:(e:unknown)=>void=()=>{};
 const abort=()=>rejectAbort(canceled());
 const started=performance.now();
 const stopped=new Promise<never>((_,reject)=>{rejectAbort=reject;});
 const timer=setTimeout(()=>rejectAbort(fail(503,'scoped_stream_timeout','Leitura de conteúdo excedeu o limite.')),timeoutMs);
 signal.addEventListener('abort',abort,{once:true});
 try{
  if(signal.aborted)throw canceled();
  for(;;){const part=await Promise.race([reader.read(),stopped]);if(signal.aborted)throw canceled();if(performance.now()-started>=timeoutMs)throw fail(503,'scoped_stream_timeout','Leitura de conteúdo excedeu o limite.');if(part.done)break;
   n+=part.value.length;if(n>limit)throw fail(413,'payload_too_large','Conteúdo excede o limite permitido.');parts.push(part.value);
  }
  const data=new Uint8Array(n);let at=0;for(const part of parts){data.set(part,at);at+=part.length;}return data;
 }catch(e){void reader.cancel().catch(()=>{});throw e;}
 finally{clearTimeout(timer);signal.removeEventListener('abort',abort);try{reader.releaseLock();}catch{/* stopped reader */}}
}
const routeOperations:Record<string,ResourceOperation>={
 'GET:':'tickets.read','GET:messages':'tickets.read','GET:notes':'notes.read','GET:timeline':'tickets.read',
 'POST:messages':'tickets.write','POST:notes':'notes.write','POST:transitions':'tickets.write','POST:assignments':'tickets.write','PATCH:':'tickets.write',
};
async function validateRequest(req:Request,url:URL,action:string,timeoutMs:number):Promise<void>{
 const allowed=req.method==='GET'&&action?['limit','cursor']:[];
 for(const k of url.searchParams.keys())if(!allowed.includes(k)||url.searchParams.getAll(k).length!==1)throw fail(400,'unknown_parameter','Parâmetro de consulta não permitido.');
 if(url.searchParams.has('limit')&&(!/^\d{1,3}$/.test(url.searchParams.get('limit')!)||Number(url.searchParams.get('limit'))<1||Number(url.searchParams.get('limit'))>100))throw fail(400,'invalid_input','Limite de página inválido.');
 if(req.method==='GET')return;
 if(!/^[A-Za-z0-9._:-]{16,128}$/.test(req.headers.get('idempotency-key')??''))throw fail(400,'invalid_idempotency_key','Informe a chave de idempotência original.');
 if(req.method==='PATCH'||['transitions','assignments'].includes(action)){
  const m=/^"([1-9]\d*)"$/.exec(req.headers.get('if-match')??'');
  if(!m||!Number.isSafeInteger(Number(m[1])))throw fail(428,'precondition_required','Informe a versão atual em If-Match.');
 }
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type')??'')||req.headers.has('content-encoding'))throw fail(415,'unsupported_media_type','Envie JSON sem compressão de conteúdo.');
 const bytes=await boundedBytes(req.clone().body,24*1024,req.signal,timeoutMs);let value:unknown;
 try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw fail(400,'invalid_json','JSON inválido.');}
 const keys=action==='messages'||action==='notes'?['body']:action==='transitions'?['to','reason']:action==='assignments'?['action','reason']:['priority','reason'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!keys.includes(k)))throw fail(400,'unknown_field','Campo não permitido nesta operação.');
 // Detailed domain validation still belongs to the original command.
}
const safeStatus:Record<string,number>={resource_not_found:404,resource_scope_denied:403,resource_scope_unavailable:503,resource_scope_database_mismatch:403,resource_scope_database_unavailable:503,transaction_outcome_unknown:503,transaction_identity_changed:403,database_unavailable:503,unauthorized:401,forbidden:403,membership_required:403,mfa_required:403,rate_limit_exceeded:429,
 release_gate_closed:503,resource_directory_unavailable:503,request_cancelled:409,unknown_parameter:400,invalid_identifier:400,invalid_input:400,invalid_idempotency_key:400,precondition_required:428,unsupported_media_type:415,payload_too_large:413,invalid_json:400,unknown_field:400,method_not_allowed:405,scoped_collection_not_ready:503,scoped_stream_timeout:503,business_request_rejected:503};
function problem(error:unknown,requestId:string):Response{
 let code='scoped_request_unavailable',status=503;
 try{if(error instanceof HelpdeskError){const c=Object.getOwnPropertyDescriptor(error,'code');
  if(c&&Object.hasOwn(c,'value')&&typeof c.value==='string'&&Object.hasOwn(safeStatus,c.value)){code=c.value;status=safeStatus[code]!;
   if(code==='business_request_rejected'){const value=Object.getOwnPropertyDescriptor(error,'status')?.value;if([400,403,404,409,412,422,428,429].includes(value))status=value;}
  }
 }}catch{code='scoped_request_unavailable';status=503;}
 return Response.json({type:'about:blank',title:status>=500?'Serviço indisponível':'Requisição não concluída',status,code,detail:code==='transaction_outcome_unknown'?'Confirmação desconhecida. Conserve a mesma chave e não repita automaticamente.':status>=500?'Operação indisponível. Nenhuma autorização adicional foi concedida.':'Requisição não concluída.',request_id:requestId},{status,headers:{'content-type':'application/problem+json','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-request-id':requestId}});
}
async function authenticated(d:ScopedTicketHttpOptions,req:Request):Promise<Principal>{
 const p=structuredClone(await d.authenticate(req));for(const grant of p.grants)Object.freeze(grant);Object.freeze(p.grants);Object.freeze(p.scopes);
 if(p.productInstanceIds)Object.freeze(p.productInstanceIds);return Object.freeze(p);
}
async function materializedResponse(response:Response,req:Request,requestId:string,timeoutMs:number):Promise<Response>{
 if(!(response instanceof Response))throw unavailable();
 if(!response.ok)throw fail([400,403,404,409,412,422,428,429].includes(response.status)?response.status:503,'business_request_rejected','Operação recusada.');
 const data=await boundedBytes(response.body,2*1024*1024,req.signal,timeoutMs),headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-request-id':requestId});
 for(const key of ['etag','location','idempotency-replayed']){const value=response.headers.get(key);if(value!==null)headers.set(key,value);}
 return new Response(data,{status:response.status,headers});
}
/** Opt-in mounted router. Not installed by default into the production runtime.
 * It owns /v1/tickets and its children: NEVER fall back to unscoped handling on a
 * denial/null directory. Collection requires the local borrowed SQL store;
 * generic creation remains closed in favor of the qualified opening pipeline.
 */
export function createScopedTicketHttpHandler(d:ScopedTicketHttpOptions):(req:Request,context?:{clientIp?:string})=>Promise<Response>{
 if(!Number.isInteger(d.directoryTimeoutMs)||d.directoryTimeoutMs<1||d.directoryTimeoutMs>5000||typeof d.enabled!=='function'||typeof d.execute!=='function'||!d.rateLimiter)throw unavailable();
 const streamTimeoutMs=d.streamTimeoutMs??5000;if(!Number.isInteger(streamTimeoutMs)||streamTimeoutMs<1||streamTimeoutMs>5000)throw unavailable();
 return async(req,context={})=>{
  const requestId=randomUUID();let refusal:HelpdeskError|undefined;const admission=()=>{if(refusal)throw refusal;try{if(d.enabled()!==true)refusal=fail(503,'release_gate_closed','Atendimento ainda não liberado.');else if(req.signal.aborted)refusal=canceled();}catch{refusal=unavailable();}if(refusal)throw refusal;};
  try{
   if(d.enabled()!==true)throw fail(503,'release_gate_closed','Atendimento ainda não liberado.');
   await d.rateLimiter.beforeAuthentication(req,context);admission();
   const url=new URL(req.url),path=url.pathname.replace(/\/$/,'');
   if(path==='/v1/tickets'||path==='/v1/tickets/summary'){
    if(path==='/v1/tickets/summary'&&d.collection===true&&req.method!=='GET'){
     const response=problem(fail(405,'method_not_allowed','Use GET para consultar os totais.'),requestId);response.headers.set('allow','GET');return response;
    }
    if(req.method!=='GET'||d.collection!==true)throw fail(503,'scoped_collection_not_ready','Coleção ou abertura genérica indisponível.');
    const p=await authenticated(d,req);await d.rateLimiter.afterAuthentication(p);admission();
    if(p.kind!=='human'||!p.scopes.includes('tickets:read'))throw fail(403,'forbidden','Operação não autorizada.');
    for(const key of url.searchParams.keys())if(!(path.endsWith('/summary')?['account_id','q','status','priority','assignment']:['limit','cursor','account_id','q','status','priority','assignment']).includes(key)||url.searchParams.getAll(key).length!==1)throw fail(400,'unknown_parameter','Parâmetro de consulta não permitido.');
    if(url.searchParams.has('limit')&&(!/^\d{1,3}$/.test(url.searchParams.get('limit')!)||Number(url.searchParams.get('limit'))<1||Number(url.searchParams.get('limit'))>100))throw fail(400,'invalid_input','Limite de página inválido.');
    if(url.searchParams.has('account_id'))uuidIdentifier(url.searchParams.get('account_id'));
    return await runTransaction(d.pool,p,async client=>materializedResponse(await d.execute(client,p,req),req,requestId,streamTimeoutMs),admission);
   }
   const m=/^\/v1\/tickets\/([^/]+)(?:\/(messages|notes|timeline|transitions|assignments))?$/.exec(path);
   if(!m)throw fail(404,'resource_not_found','Recurso não encontrado.');
   const ticketId=uuidIdentifier(m[1]),action=m[2]??'',operation=routeOperations[req.method+':'+action];
   if(!operation)throw fail(405,'method_not_allowed','Método não permitido.');
   // Detach/freeze the authenticated context before handing it to async metadata
   // adapters. Such adapters may read it, but must not enlarge its capabilities.
   const p=await authenticated(d,req);
   await d.rateLimiter.afterAuthentication(p);admission();
   await validateRequest(req,url,action,streamTimeoutMs);
   if(req.signal.aborted)throw canceled();
   const mapping=await ownedLookup(d,p,ticketId,req.signal);
   admission();const proof=await d.resolver.resolveResourceScope(p,mapping.refs,operation,req.signal);
   return await runResourceTicketTransaction(d.pool,d.resolver,p,ticketId,mapping.refs,operation,proof,async(client,scope)=>{
    if(scope.accountId!==mapping.accountId)throw fail(403,'resource_scope_denied','Conta do chamado alterada.');
    // Fully consume the DTO before leaving the transaction. Do not return a lazy
    // stream capable of querying after the connection/proof has been released.
    return materializedResponse(await d.execute(client,p,req),req,requestId,streamTimeoutMs);
   },req.signal,admission);
  }catch(error){return problem(error,requestId);}
 };
}
