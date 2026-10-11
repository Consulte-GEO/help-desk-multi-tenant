import {randomUUID} from 'node:crypto';import type {Principal} from '../domain/model.ts';import {uuidIdentifier} from '../domain/input-values.ts';
import {formRecord} from '../domain/form-schema.ts';import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {controlledJson,privateJson,httpFailure as fail} from './controlled-json.ts';
import type {createAttachmentService} from '../application/attachments.ts';import type {createFormDraftService,DraftForm} from '../application/form-draft.ts';
import type {createSupportIntake} from '../application/support-intake.ts';import type {createIntakeBeneficiaryVerifier} from '../application/intake-beneficiary.ts';
export interface SupportIntakeHttpOptions{
 enabled:()=>boolean;authenticate:(req:Request)=>Promise<Principal>;
 rateLimiter:{beforeAuthentication(req:Request,context:{clientIp?:string}):Promise<unknown>;afterAuthentication(p:Principal):Promise<unknown>};
 attachments:ReturnType<typeof createAttachmentService>;drafts:ReturnType<typeof createFormDraftService>;intake:ReturnType<typeof createSupportIntake>;
 beneficiaries?:ReturnType<typeof createIntakeBeneficiaryVerifier>;
}
const statuses:Record<string,number>={release_gate_closed:503,not_found:404,method_not_allowed:405,unknown_parameter:400,origin_denied:403,precondition_required:428,invalid_idempotency_key:400,invalid_identifier:400,unsupported_media_type:415,invalid_json:400,payload_too_large:413,request_cancelled:409,request_timeout:408,unauthorized:401,auth_unavailable:503,membership_required:403,rate_limit_exceeded:429,intake_unavailable:503,attachment_unavailable:503,intake_delegation_denied:403,intake_preview_changed:409,intake_idempotency_conflict:409,intake_scope_changed:403,intake_evidence_invalid:409,intake_coverage_unavailable:422,invalid_intake_input:400,invalid_form_input:400,invalid_form_schema:400,invalid_form_values:422,form_schema_changed:409,form_not_published:409,draft_not_found:404,draft_expired:409,draft_forbidden:403,draft_version_conflict:412,draft_already_committed:409,invalid_attachment_input:400,invalid_attachment_metadata:400,attachment_not_clean_or_changed:409,attachment_binding_changed:409,attachment_expired:409,attachment_forbidden:403,attachment_quota_exceeded:429,resource_scope_denied:403,resource_scope_unavailable:503,transaction_outcome_unknown:503};
const key=(r:Request)=>{const k=r.headers.get('idempotency-key')??'';if(!/^[A-Za-z0-9._:-]{16,128}$/.test(k))throw fail(400,'invalid_idempotency_key');return k;};
const revision=(r:Request)=>{const m=/^"(0|[1-9]\d*)"$/.exec(r.headers.get('if-match')??'');if(!m||!Number.isSafeInteger(Number(m[1])))throw fail(428,'precondition_required');return Number(m[1]);};
const draftDto=(d:DraftForm)=>({id:d.id,accountId:d.accountId,refs:d.refs,formId:d.formId,formVersion:d.formVersion,revision:d.revision,expiresAt:d.expiresAt,answers:d.answers,status:d.status,ticketId:d.ticketId});
/** OPTIONAL mount: does not register itself in runtime/OpenAPI/capabilities. The
 * generic collection remains closed here, not a fallback around resource checks.
 * Auth, source, stores and provider readiness must be reviewed before enabling. */
export function createSupportIntakeHttpHandler(d:SupportIntakeHttpOptions){return async(req:Request,context:{clientIp?:string}={}):Promise<Response>=>{
 const requestId=randomUUID();try{
  if(d.enabled()!==true)throw fail(503,'release_gate_closed');await d.rateLimiter.beforeAuthentication(req,context);
  const url=new URL(req.url);if(url.search)throw fail(400,'unknown_parameter');if(url.pathname==='/v1/tickets')throw fail(503,'release_gate_closed');
  const attachment=/^\/v1\/attachments\/([0-9a-f-]+)\/(bind|finish|download)$/.exec(url.pathname),draft=/^\/v1\/form-drafts\/([0-9a-f-]+)$/.exec(url.pathname);
  const preview=url.pathname==='/v1/support-requests/preview',commit=url.pathname==='/v1/support-requests',onBehalf=url.pathname==='/v1/support-requests/on-behalf'||url.pathname==='/v1/support-requests/on-behalf/preview',upload=url.pathname==='/v1/attachments';
  if(!attachment&&!draft&&!preview&&!commit&&!onBehalf&&!upload)throw fail(404,'not_found');
  if(req.method!==(draft?(req.method==='GET'?'GET':'PUT'):'POST'))throw fail(405,'method_not_allowed');
  if(req.method!=='GET'&&req.headers.get('origin')!==url.origin)throw fail(403,'origin_denied');
  const p=freezeFormData(copyFormData(await d.authenticate(req))) as Principal;await d.rateLimiter.afterAuthentication(p);if(req.signal.aborted)throw fail(409,'request_cancelled');
  let data:unknown,status=200,extra:Record<string,string>={};
  if(draft){const id=uuidIdentifier(draft[1]);if(req.method==='GET'){const r=await d.drafts.readFormDraft(p,id,req.signal);data=draftDto(r);extra.etag=`"${r.revision}"`;}else{const expected=revision(req),b=await controlledJson(req,262144);if(b.id!==id)throw fail(400,'invalid_intake_input');const r=await d.drafts.saveFormDraft(p,b,expected,req.signal);data=draftDto(r);extra.etag=`"${r.revision}"`;}}
  else if(upload){const k=key(req),b=formRecord(await controlledJson(req,16384),['draftId','draftRevision','fieldPath','metadata']);data=await d.attachments.startAttachment(p,b,k,req.signal);}
  else if(attachment){const id=uuidIdentifier(attachment[1]),action=attachment[2];if(action==='bind'){const expected=revision(req);formRecord(await controlledJson(req,1024),[]);data=await d.attachments.bindAttachmentDraft(p,id,expected,req.signal);}else{const k=action==='finish'?key(req):null;formRecord(await controlledJson(req,1024),[]);data=action==='finish'?await d.attachments.finishAttachment(p,id,k!,req.signal):await d.attachments.authorizeDownload(p,id,req.signal);}}
  else{
   const isPreview=preview||url.pathname.endsWith('/preview'),expected=isPreview?null:revision(req),k=isPreview?null:key(req),b=await controlledJson(req,262144);
   if(onBehalf){if(!d.beneficiaries)throw fail(503,'release_gate_closed');const v=formRecord(b,['input','beneficiaryId']),input=v.input as Record<string,unknown>;
    if(!input||!isPreview&&input.expectedDraftRevision!==expected)throw fail(400,'invalid_intake_input');const stored=await d.drafts.readFormDraft(p,uuidIdentifier(input.draftId),req.signal);
    const proof=await d.beneficiaries.resolve(p,stored.accountId,stored.refs,uuidIdentifier(v.beneficiaryId),req.signal);
    data=isPreview?await d.intake.previewOnBehalfRequest(p,input,proof,req.signal):await d.intake.createOnBehalfRequest(p,input,proof,k!,requestId,req.signal);
   }else{if(!isPreview&&b.expectedDraftRevision!==expected)throw fail(400,'invalid_intake_input');data=isPreview?await d.intake.previewSupportRequest(p,b,req.signal):await d.intake.createSupportRequest(p,b,k!,requestId,req.signal);}
   if(!isPreview){const r=data as {replayed:boolean;ticketId:string;version:number};status=r.replayed?200:201;extra={'idempotency-replayed':String(r.replayed),etag:`"${r.version}"`,location:'/v1/tickets/'+r.ticketId};}
  }
  const response=privateJson(data,status,{'x-request-id':requestId,...extra});return response;
 }catch(e){let code='intake_unavailable';try{const c=e&&typeof e==='object'?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;if(typeof c==='string'&&Object.hasOwn(statuses,c))code=c;}catch{}
  const status=statuses[code]!;return privateJson({type:'about:blank',status,code,detail:code==='transaction_outcome_unknown'?'Confirmação desconhecida. Concilie usando a mesma intenção.':'Não foi possível concluir. Confira o acesso, a revisão e os anexos.',request_id:requestId},status,{'content-type':'application/problem+json','x-request-id':requestId});}
};}
