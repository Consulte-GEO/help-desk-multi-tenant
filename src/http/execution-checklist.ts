import {parseEvidenceQuery} from '../../shared/checklist-evidence.js';
import {randomUUID} from 'node:crypto';
import type {Principal} from '../domain/model.ts';
import type {ExternalResourceRef} from '../domain/external-resource.ts';
import type {createExecutionChecklistService} from '../application/execution-checklist.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {parseChecklistMark} from '../domain/execution-checklist-mark.ts';
import {controlledJson,privateJson,httpFailure} from './controlled-json.ts';
export interface ExecutionChecklistHttpOptions{
 enabled:()=>boolean;origin:string;authenticate:(request:Request)=>Promise<Principal>;
 rateLimiter:{beforeAuthentication(request:Request,context:{clientIp?:string}):Promise<unknown>;afterAuthentication(p:Principal):Promise<unknown>};
 directory:{readTicketResources(p:Principal,ticketId:string,signal:AbortSignal):Promise<readonly ExternalResourceRef[]>};
 service:Pick<ReturnType<typeof createExecutionChecklistService>,'read'|'mark'>&Partial<Pick<ReturnType<typeof createExecutionChecklistService>,'queryEvidence'>>;
}
const statuses:Record<string,number>={invalid_checklist_evidence_query:400,release_gate_closed:503,not_found:404,method_not_allowed:405,unknown_parameter:400,origin_denied:403,precondition_required:428,invalid_idempotency_key:400,invalid_identifier:400,unsupported_media_type:415,invalid_json:400,payload_too_large:413,request_cancelled:409,request_timeout:408,unauthorized:401,auth_unavailable:503,membership_required:403,rate_limit_exceeded:429,invalid_checklist_mark:400,checklist_forbidden:403,checklist_evidence_denied:403,checklist_state_conflict:409,checklist_intent_conflict:409,checklist_binding_required:409,checklist_risk_ack_required:409,checklist_version_conflict:412,checklist_store_invalid:503,checklist_store_unavailable:503,invalid_resource_selection:400,resource_scope_denied:403,resource_scope_unavailable:503,resource_scope_database_mismatch:403,resource_scope_database_unavailable:503,transaction_identity_changed:403,transaction_statement_failed:503,transaction_work_incomplete:503,transaction_outcome_unknown:503};
/** OPTIONAL private mount. It must be wired only with the existing Auth/MFA,
 * distributed limiter, qualified directory, scoped stores and release readiness.
 * This file does not turn on an endpoint, create a grant or mount a demo fallback.
 */
export function createExecutionChecklistHttpHandler(d:ExecutionChecklistHttpOptions){
 const origin=new URL(d.origin);if(origin.origin!==d.origin||origin.protocol!=='https:'||origin.username||origin.password)throw Error('Configured HTTPS origin required');
 return async(request:Request,context:{clientIp?:string}={}):Promise<Response>=>{
  const requestId=randomUUID();
  // Request-owned synchronous admission. Pass the same guard into the existing
  // transaction runner; a one-time enabled check cannot cover asynchronous waits.
  // Once refused, this request cannot be revived by reopening the global gate.
  let refusal:ReturnType<typeof httpFailure>|undefined;
  const admission=():void=>{
   if(refusal)throw refusal;
   let enabled:boolean;
   try{enabled=d.enabled()===true;}catch{refusal=httpFailure(503,'checklist_store_unavailable');throw refusal;}
   if(!enabled)refusal=httpFailure(503,'release_gate_closed');
   else if(request.signal.aborted)refusal=httpFailure(409,'request_cancelled');
   if(refusal)throw refusal;
  };
  try{
   admission();await d.rateLimiter.beforeAuthentication(request,context);admission();
   const url=new URL(request.url);if(url.origin!==d.origin)throw httpFailure(403,'origin_denied');if(url.search)throw httpFailure(400,'unknown_parameter');
   const match=/^\/v1\/internal\/tickets\/([0-9a-f-]+)\/execution-checklist(\/(?:marks|evidence))?$/.exec(url.pathname);
   if(!match)throw httpFailure(404,'not_found');const ticketId=uuidIdentifier(match[1]),write=match[2]==='/marks',evidenceQuery=match[2]==='/evidence';
   if(request.method!==((write||evidenceQuery)?'POST':'GET'))throw httpFailure(405,'method_not_allowed');
   if((write||evidenceQuery)&&request.headers.get('origin')!==d.origin)throw httpFailure(403,'origin_denied');
   const p=freezeFormData(copyFormData(await d.authenticate(request))) as Principal;admission();
   await d.rateLimiter.afterAuthentication(p);admission();
   let data:unknown,revision:number,extra:Record<string,string>={};
   if(evidenceQuery){
    const rev=/^"(0|[1-9]\d*)"$/.exec(request.headers.get('if-match')??'');
    if(!rev||!Number.isSafeInteger(Number(rev[1])))throw httpFailure(428,'precondition_required');
    const raw=await controlledJson(request,8192);admission();let q;try{q=parseEvidenceQuery(raw);}catch{throw httpFailure(400,'invalid_checklist_evidence_query');}
    if(q.expectedChecklistRevision!==Number(rev[1]))throw httpFailure(412,'checklist_version_conflict');
    if(typeof d.service.queryEvidence!=='function')throw httpFailure(503,'checklist_store_unavailable');
    const refs=await d.directory.readTicketResources(p,ticketId,request.signal);admission();
    const page=await d.service.queryEvidence(p,ticketId,refs,q,request.signal,admission);admission();data=page;revision=page.checklistRevision;
   }else if(write){
    const matchRevision=/^"(0|[1-9]\d*)"$/.exec(request.headers.get('if-match')??'');if(!matchRevision||!Number.isSafeInteger(Number(matchRevision[1])))throw httpFailure(428,'precondition_required');
    const key=request.headers.get('idempotency-key')??'';if(!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw httpFailure(400,'invalid_idempotency_key');
    const command=parseChecklistMark(await controlledJson(request,8192));admission();if(command.expectedChecklistRevision!==Number(matchRevision[1]))throw httpFailure(412,'checklist_version_conflict');
    const refs=await d.directory.readTicketResources(p,ticketId,request.signal);admission();
    const r=await d.service.mark(p,ticketId,refs,command,key,requestId,request.signal,admission);data=r;revision=r.checklistRevision;extra={'idempotency-replayed':String(r.replayed)};
   }else{
    const refs=await d.directory.readTicketResources(p,ticketId,request.signal);admission();
    const r=await d.service.read(p,ticketId,refs,request.signal,admission);admission();data=r;revision=r.snapshot?.revision??0;
   }
   // A mark returned by the real service has a confirmed COMMIT. Do not run
   // admission again here and relabel it as failure; reads above are withheld
   // if closure was observed before their private response is emitted.
   return privateJson(data,200,{etag:`"${revision}"`,'x-request-id':requestId,...extra});
  }catch(e){let code='checklist_store_unavailable';try{const c=e&&typeof e==='object'?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;if(typeof c==='string'&&Object.hasOwn(statuses,c))code=c;}catch{}
   const status=statuses[code]!;return privateJson({type:'about:blank',status,code,detail:code==='transaction_outcome_unknown'?'Confirmação desconhecida. Concilie a mesma chave e conteúdo.':'Não foi possível confirmar a operação interna. Confira acesso, revisão e evidência.',request_id:requestId},status,{'content-type':'application/problem+json','x-request-id':requestId});
  }
 };
}
