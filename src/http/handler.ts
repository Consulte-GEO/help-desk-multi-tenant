import {ticketActions} from '../application/ticket-actions.ts';
import type {RateLimiter,TrustedRequestContext} from '../infrastructure/rate-limit.ts';
import {requireEmptyBody} from './empty-body.ts';
import {SHORT_SESSION_PATTERN} from '../infrastructure/session-lifecycle.ts';
import {RELEASE} from '../version.ts';
import {httpObservation,notifyObserver,requestIdFor} from '../observability/http.ts';
import type {HttpObserver} from '../observability/http.ts';
const problemCodes=new WeakMap<Response,string>();
export const diagnosticProblemCode=(response:Response):string|undefined=>problemCodes.get(response);
import type {HelpdeskService} from '../application/helpdesk.ts';import type {Principal,Ticket} from '../domain/model.ts';import {statuses} from '../domain/model.ts';
import {HelpdeskError} from '../domain/errors.ts';import {readObject,text,identifier,ifMatch} from './validation.ts';import {ticketDto,messageDto,noteDto,eventDto} from './serialization.ts';
export const capabilities={api_version:'v1',release:RELEASE,capabilities:{tickets:true,ticket_search:true,ticket_totals:false,ticket_priority_update:true,ticket_self_assignment:true,ticket_assignment_filter:true,ticket_timeline:true,ticket_action_hints:true,contract_resolution:true,support_catalog:true,public_messages:true,internal_notes:true,optimistic_concurrency:true,idempotency:true,conversation_pagination:true,integration_session_revocation:true,attachments:false,webhook_delivery:false,sla_clocks:false,support_sessions:false,contract_admin:false,email:false}};
export type HttpDependencies={ticketTotals?:boolean;authenticationOnly?:boolean;rateLimiter?:RateLimiter;service:HelpdeskService;authenticate:(request:Request)=>Promise<Principal>;discoverWorkspaces?:(request:Request)=>Promise<{items:{id:string;name:string}[]}>;exchangeToken?:(key:string)=>Promise<unknown>;revokeSession?:(token:string)=>Promise<void>;publicConfig?:{supabaseUrl:string;publishableKey:string};observe?:HttpObserver};
export function jsonResponse(data:unknown,status=200,extra:Record<string,string>={}):Response{return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',...extra}});}
export function problemResponse(error:unknown,requestId:string):Response{const e=error instanceof HelpdeskError?error:null;let status=e?.status??500,code=e?.code??'internal_error',detail=e?.message??'Não foi possível concluir a operação.';
 const pgcode=(error as {code?:string})?.code;if(!e&&['22P02','22007','22008'].includes(pgcode??'')){status=400;code='invalid_input';detail='Identificador ou data inválidos.';}
 if(!e&&['23503','23505','23514'].includes(pgcode??'')){status=409;code='data_conflict';detail='Operação incompatível com o estado atual dos dados.';}
 if(!e&&['40001','40P01','55P03','57014','08006','53300','57P01','57P02','57P03','ECONNRESET','ECONNREFUSED','ETIMEDOUT'].includes(pgcode??'')){status=503;code='retryable_conflict';detail='Operação temporariamente indisponível. Reenvie com a mesma chave de idempotência.';}
 if(!e&&['PHD01','PHD02'].includes(pgcode??'')){status=429;code=pgcode==='PHD01'?'session_quota_exceeded':'idempotency_quota_exceeded';detail='Limite temporário de recursos atingido.';}
 if(!e&&pgcode==='PHD03'){status=409;code='coverage_configuration_limit';detail='Configuração de coberturas excedeu o limite suportado. Contate a administração.';}
 if(!e&&pgcode==='42501'){status=403;code='forbidden';detail='Operação não autorizada.';}
 if(!e&&pgcode==='HDW03'){status=409;code='structured_workflow_required';detail='Use o fluxo de atendimento deste chamado para registrar a alteração.';}
 const retry=(error as {retryAfterSeconds?:number})?.retryAfterSeconds;
 const response=jsonResponse({type:'about:blank',title:status>=500?'Serviço indisponível':'Requisição não concluída',status,code,detail,request_id:requestId},status,{'content-type':'application/problem+json; charset=utf-8','x-request-id':requestId,...(status===503?{'retry-after':'2'}:status===429?{'retry-after':String(Number.isInteger(retry)&&Number(retry)>=1&&Number(retry)<=60?retry:60)}:{})});
 problemCodes.set(response,code);return response;
}
export function createHttpHandler(deps:HttpDependencies){return async(req:Request,context:TrustedRequestContext={}):Promise<Response>=>{
 const requestId=requestIdFor(req);const started=performance.now();let response:Response;
 try{await deps.rateLimiter?.beforeAuthentication(req,context);response=await route(req,requestId,deps);}catch(error){response=problemResponse(error,requestId);}
 response.headers.set('x-request-id',requestId);
 notifyObserver(deps.observe,httpObservation({request:req,requestId,status:response.status,errorCode:diagnosticProblemCode(response),phase:'http',started,finished:performance.now()}));
 return response;
};}
async function route(req:Request,requestId:string,d:HttpDependencies):Promise<Response>{
 const url=new URL(req.url),path=url.pathname.replace(/\/$/,''),method=req.method;
 if(d.authenticationOnly&&!((method==='GET'&&['/v1/capabilities','/v1/public-config','/v1/me','/v1/workspaces'].includes(path))||(method==='POST'&&path==='/v1/integration-tokens')||(method==='DELETE'&&path==='/v1/integration-tokens/current')))throw new HelpdeskError(503,'release_gate_closed','Atendimento ainda não liberado.');
 if(path==='/v1/capabilities'&&method==='GET')return jsonResponse({...capabilities,...(d.authenticationOnly?{operational:false}:{}),capabilities:{...(d.authenticationOnly?Object.fromEntries(Object.keys(capabilities.capabilities).map(key=>[key,false])):capabilities.capabilities),ticket_totals:!d.authenticationOnly&&d.ticketTotals===true,integration_session_revocation:typeof d.revokeSession==='function'}});
 if(path==='/v1/public-config'&&method==='GET')return jsonResponse({supabase_url:d.publicConfig?.supabaseUrl??null,publishable_key:d.publicConfig?.publishableKey??null,...(d.authenticationOnly?{operational:false}:{})});
 if(path==='/v1/workspaces'){
  if(method!=='GET')throw new HelpdeskError(405,'method_not_allowed','Use GET para escolher workspace.');
  if(url.search)throw new HelpdeskError(400,'invalid_input','A descoberta usa somente a identidade da sessão humana.');
  if(!d.discoverWorkspaces)throw new HelpdeskError(503,'feature_not_configured','Descoberta indisponível.');
  return jsonResponse(await d.discoverWorkspaces(req));
 }
 if(path==='/v1/integration-tokens'&&method==='POST'){
  if(!d.exchangeToken)throw new HelpdeskError(503,'feature_not_configured','Autenticação de integrações não configurada neste ambiente.');
  const match=/^Bearer (hd_key_[A-Za-z0-9_-]{43,128})$/.exec(req.headers.get('authorization')??'');if(!match)throw new HelpdeskError(401,'unauthorized','Credencial de integração inválida.');
  return jsonResponse(await d.exchangeToken(match[1]!),201);
 }
 if(path==='/v1/integration-tokens/current'){
  if(method!=='DELETE')throw new HelpdeskError(405,'method_not_allowed','Método não permitido para este recurso.');
  if(url.search)throw new HelpdeskError(400,'invalid_input','Envie somente o bearer da sessão atual, sem corpo ou seletores.');
  const token=/^Bearer ([^\s]+)$/.exec(req.headers.get('authorization')??'')?.[1];
  if(!token||!SHORT_SESSION_PATTERN.test(token))throw new HelpdeskError(401,'unauthorized','Sessão de integração inválida.');
  if(!d.revokeSession)throw new HelpdeskError(503,'feature_not_configured','Encerramento de sessão não configurado neste ambiente.');
  await requireEmptyBody(req);
  await d.revokeSession(token);
  return new Response(null,{status:204,headers:{'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
 }
 const p=await d.authenticate(req);await d.rateLimiter?.afterAuthentication(p);const key=req.headers.get('idempotency-key')??'';
 if(path==='/v1/me'&&method==='GET')return jsonResponse({id:p.id,kind:p.kind,workspace_id:p.workspaceId,workspace_role:p.workspaceRole,grants:p.grants.map(g=>({account_id:g.accountId,role:g.role})),product_instance_ids:p.productInstanceIds??[],scopes:p.scopes});
 if(path==='/v1/support-contexts'){
  if(method!=='GET'){const r=problemResponse(new HelpdeskError(405,'method_not_allowed','Catálogo disponível somente para consulta.'),requestId);r.headers.set('allow','GET');return r;}
  if([...url.searchParams.keys()].some(k=>!['limit','cursor','account_id'].includes(k)||url.searchParams.getAll(k).length!==1))
   throw new HelpdeskError(400,'unknown_parameter','Parâmetro de consulta não permitido ou duplicado.');
  const result=await d.service.supportContexts(p,{limit:Number(url.searchParams.get('limit')??50),
   ...(url.searchParams.has('cursor')?{cursor:url.searchParams.get('cursor')!}:{}),
   ...(url.searchParams.has('account_id')?{accountId:identifier(url.searchParams.get('account_id'))}:{})});
  return jsonResponse({items:result.items.map(c=>({account_id:c.accountId,account_name:c.accountName,
   product_instance_id:c.productInstanceId,product_name:c.productName,environment:c.environment,
   service_code:c.serviceCode,service_name:c.serviceName})),next_cursor:result.nextCursor});
 }
 if(path==='/v1/contexts/resolve'&&method==='POST'){
  const b=await readObject(req,['account_id','product_instance_id','service_code']);const result=await d.service.resolve(p,{accountId:identifier(b.account_id),productInstanceId:identifier(b.product_instance_id),serviceCode:text(b,'service_code',1,80)});
  return jsonResponse({status:result.status,candidates:result.candidates.map(c=>({coverage_id:c.id,contract_id:c.contractId,contract_version_id:c.contractVersionId,contract_version:c.contractVersion,valid_until:c.validUntil}))});
 }
 if(path==='/v1/tickets/summary'){
  if(!d.ticketTotals)throw new HelpdeskError(503,'feature_not_configured','Resumo de chamados indisponível.');
  if(method!=='GET'){const response=problemResponse(new HelpdeskError(405,'method_not_allowed','Use GET para consultar os totais.'),requestId);response.headers.set('allow','GET');return response;}
  if([...url.searchParams.keys()].some(k=>!['account_id','q','search_in','internal_status','status','priority','assignment'].includes(k)||url.searchParams.getAll(k).length!==1))throw new HelpdeskError(400,'unknown_parameter','Parâmetro de consulta não permitido.');
  await requireEmptyBody(req);
  return jsonResponse(await d.service.summarize(p,{...(url.searchParams.has('account_id')?{accountId:identifier(url.searchParams.get('account_id'))}:{}),...Object.fromEntries(['q','search_in','internal_status','status','priority','assignment'].filter(k=>url.searchParams.has(k)).map(k=>[k,url.searchParams.get(k)!]))}));
 }
 if(path==='/v1/tickets'&&method==='GET'){
  if([...url.searchParams.keys()].some(x=>!['limit','cursor','account_id','q','search_in','internal_status','status','priority','assignment'].includes(x)||url.searchParams.getAll(x).length!==1))throw new HelpdeskError(400,'unknown_parameter','Parâmetro de consulta não permitido.');
  const accountId=url.searchParams.get('account_id');const result=await d.service.list(p,{limit:Number(url.searchParams.get('limit')??25),...(url.searchParams.has('cursor')?{cursor:url.searchParams.get('cursor')!}:{}),...(accountId!==null?{accountId:identifier(accountId)}:{}),...Object.fromEntries(['q','search_in','internal_status','status','priority','assignment'].filter(k=>url.searchParams.has(k)).map(k=>[k,url.searchParams.get(k)!]))});
  return jsonResponse({items:result.items.map(t=>ticketDto(p,t)),next_cursor:result.nextCursor});
 }
 if(path==='/v1/tickets'&&method==='POST'){
  const b=await readObject(req,['account_id','product_instance_id','service_code','subject','description','priority','coverage_id']);
  const result=await d.service.create(p,{accountId:identifier(b.account_id),productInstanceId:identifier(b.product_instance_id),serviceCode:text(b,'service_code',1,80),subject:text(b,'subject',3,200),description:text(b,'description',1,12000),priority:text(b,'priority',1,10) as Ticket['priority'],...(b.coverage_id===undefined?{}:{coverageId:identifier(b.coverage_id)})},key,requestId);
  return jsonResponse(ticketDto(p,result.ticket),result.replayed?200:201,{etag:`"${result.ticket.version}"`,'idempotency-replayed':String(result.replayed),location:`/v1/tickets/${result.ticket.id}`});
 }
 const match=/^\/v1\/tickets\/([^/]+)(?:\/(messages|notes|transitions|timeline|assignments))?$/.exec(path);
 if(match){const id=identifier(match[1]),action=match[2];
  if(!action&&method==='GET'){const ticket=await d.service.get(p,id);return jsonResponse({...ticketDto(p,ticket),available_actions:ticketActions(p,ticket)},200,{etag:`"${ticket.version}"`});}
  if(action==='assignments'&&method==='POST'){
   if(url.search)throw new HelpdeskError(400,'unknown_parameter','Esta operação não aceita parâmetros de consulta.');
   const expected=ifMatch(req),b=await readObject(req,['action','reason']);
   const result=await d.service.changeAssignment(p,id,b.action,expected,b.reason,key,requestId);
   return jsonResponse(ticketDto(p,result.ticket),200,{etag:`"${result.ticket.version}"`,'idempotency-replayed':String(result.replayed)});
  }
  if(!action&&method==='PATCH'){
   if(url.search)throw new HelpdeskError(400,'unknown_parameter','Esta operação não aceita parâmetros de consulta.');
   const expected=ifMatch(req),b=await readObject(req,['priority','reason']);
   const result=await d.service.changePriority(p,id,b.priority,expected,b.reason,key,requestId);
   return jsonResponse(ticketDto(p,result.ticket),200,{etag:`"${result.ticket.version}"`,'idempotency-replayed':String(result.replayed)});
  }
  if((action==='messages'||action==='notes'||action==='timeline')&&method==='GET'){
   if([...url.searchParams.keys()].some(k=>!['limit','cursor'].includes(k)||url.searchParams.getAll(k).length!==1))
    throw new HelpdeskError(400,'unknown_parameter','Parâmetro de consulta não permitido ou duplicado.');
   const options={limit:Number(url.searchParams.get('limit')??50),...(url.searchParams.has('cursor')?{cursor:url.searchParams.get('cursor')!}:{})};
   if(action==='messages'){const r=await d.service.conversation(p,id,'messages',options);return jsonResponse({items:r.items.map(messageDto),next_cursor:r.nextCursor});}
   if(action==='notes'){const r=await d.service.conversation(p,id,'notes',options);return jsonResponse({items:r.items.map(noteDto),next_cursor:r.nextCursor});}
   const r=await d.service.conversation(p,id,'timeline',options);return jsonResponse({items:r.items.map(e=>eventDto(p,e)),next_cursor:r.nextCursor});
  }
  if((action==='messages'||action==='notes')&&method==='POST'){
   const b=await readObject(req,['body']);const body=text(b,'body',1,12000);
   if(action==='messages'){const result=await d.service.addMessage(p,id,body,key,requestId);return jsonResponse(messageDto(result.message),result.replayed?200:201,{'idempotency-replayed':String(result.replayed)});}
   const result=await d.service.addNote(p,id,body,key,requestId);return jsonResponse(noteDto(result.note),result.replayed?200:201,{'idempotency-replayed':String(result.replayed)});
  }
  if(action==='transitions'&&method==='POST'){
   const expected=ifMatch(req),b=await readObject(req,['to','reason']);const to=text(b,'to',1,30);if(!(statuses as readonly string[]).includes(to))throw new HelpdeskError(400,'invalid_status','Estado inválido.');
   const result=await d.service.transition(p,id,to as Ticket['status'],expected,text(b,'reason',0,2000),key,requestId);return jsonResponse(ticketDto(p,result.ticket),200,{etag:`"${result.ticket.version}"`,'idempotency-replayed':String(result.replayed)});
  }
  throw new HelpdeskError(405,'method_not_allowed','Método não permitido para este recurso.');
 }
 throw new HelpdeskError(404,'not_found','Recurso não encontrado.');
}
