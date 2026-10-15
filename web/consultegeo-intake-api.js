import {readVersionReceiptHeader} from './version-receipt.js';
import {copyFormData,freezeFormData} from '../shared/form-rules.js';
import {parseConsulteGeoRequestContext} from '../shared/consultegeo-request.js';
import {isCanonicalInstant} from '../shared/instant.js';
const fail=()=>new Error('Confirmação indisponível. Concilie a mesma intenção antes de iniciar outra.');
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const exact=(raw,keys)=>{const v=copyFormData(raw);if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))throw fail();return v;};
const positive=n=>Number.isSafeInteger(n)&&n>0;
const canonical=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(key=>[key,x[key]])):x);
const sameRefs=(a,b)=>JSON.stringify([...a].map(v=>JSON.stringify([v.connectionId,v.tenantId,v.type,v.id])).sort())===JSON.stringify([...b].map(v=>JSON.stringify([v.connectionId,v.tenantId,v.type,v.id])).sort());
const known={intake_preview_changed:409,intake_idempotency_conflict:409,intake_scope_changed:403,intake_coverage_unavailable:422,intake_evidence_invalid:409,invalid_intake_input:400,invalid_form_values:422,form_schema_changed:409,form_not_published:409,draft_not_found:404,draft_expired:409,draft_forbidden:403,draft_version_conflict:412,draft_already_committed:409,resource_scope_denied:403,release_gate_closed:503,unauthorized:401,membership_required:403,precondition_required:428,origin_denied:403,rate_limit_exceeded:429};
async function body(response,signal){
 if(!/^application\/(?:json|problem\+json)(?:\s*;|$)/i.test(response.headers.get('content-type')??'')||!response.body)throw fail();
 const reader=response.body.getReader(),parts=[];let total=0,timer,abort;
 const deadline=performance.now()+5000,stop=new Promise((_,reject)=>{abort=()=>reject(fail());timer=setTimeout(abort,5000);signal.addEventListener('abort',abort,{once:true});});
 try{for(;;){if(signal.aborted)throw fail();const r=await Promise.race([reader.read(),stop]);if(signal.aborted||performance.now()>=deadline)throw fail();if(r.done)break;total+=r.value.byteLength;if(total>262144)throw fail();parts.push(r.value);}
  const b=new Uint8Array(total);let at=0;for(const p of parts){b.set(p,at);at+=p.byteLength;}return copyFormData(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b)));
 }catch{try{void reader.cancel().catch(()=>{});}catch{}throw fail();}finally{clearTimeout(timer);signal.removeEventListener('abort',abort);try{reader.releaseLock();}catch{}}}
/** Authenticated session closure owns request/credentials. Fixed same-origin paths;
 * no token, URL, provider, retry or source authority is manufactured here. */
function observeDraftPrecondition(response){try{const category=response.headers.get('x-helpdesk-precondition-state');if(['missing','invalid_format','out_of_range'].includes(category))console.warn(JSON.stringify({component:'helpdesk.draft_precondition',category}));}catch{/* A diagnostic cannot change the authoritative refusal. */}}
export function createConsulteGeoIntakeApi(options){
 const context=parseConsulteGeoRequestContext(options.context),draft=exact(options.draft,['id','accountId','refs','formId','formVersion']);
 if(typeof options.request!=='function'||!uuid(draft.id)||!uuid(draft.formId)||!positive(draft.formVersion)||draft.accountId!==context.accountId||!sameRefs(draft.refs,context.refs)||options.profileVersionId!=='cg-wf-'+draft.formId+'-v'+draft.formVersion)throw fail();
 const request=options.request,profile=options.profileVersionId;freezeFormData(draft);
 async function invoke(path,method,input,headers,signal){
  if(signal.aborted)throw fail();let r;try{r=await request(path,{method,headers:{'content-type':'application/json',...headers},body:JSON.stringify(input),signal});}catch{throw fail();}
  if(signal.aborted||!r||r.redirected)throw fail();const data=await body(r,signal);
  if(!r.ok){if(data&&data.status===r.status&&typeof data.code==='string'&&Object.hasOwn(known,data.code)&&known[data.code]===r.status){if(data.code==='precondition_required')observeDraftPrecondition(r);return {rejected:{kind:'rejected',code:data.code}};}throw fail();}
  return {r,data};
 }
 function input(raw,commit){const v=exact(raw,['draftId','expectedDraftRevision','subject','description','coverageId',...(commit?['previewHash']:[])]);if(v.draftId!==draft.id||!positive(v.expectedDraftRevision)||v.coverageId!==context.coverageId||typeof v.subject!=='string'||Array.from(v.subject.trim()).length<3||v.subject.length>200||typeof v.description!=='string'||!v.description.trim()||v.description.length>12000||commit&&(typeof v.previewHash!=='string'||!/^[a-f0-9]{64}$/.test(v.previewHash)))throw fail();return v;}
 return Object.freeze({
  async save(raw,expected,signal){
   const v=exact(raw,['id','accountId','refs','formId','formVersion','answers']);if(!Number.isSafeInteger(expected)||expected<0||expected>=Number.MAX_SAFE_INTEGER||v.id!==draft.id||v.accountId!==draft.accountId||v.formId!==draft.formId||v.formVersion!==draft.formVersion||!sameRefs(v.refs,draft.refs))throw fail();
   const {r,data,rejected}=await invoke('/form-drafts/'+draft.id,'PUT',v,{'if-match':'"'+expected+'"'},signal);if(rejected)return rejected;
   const x=exact(data,['id','accountId','refs','formId','formVersion','revision','expiresAt','answers','status','ticketId']);if(r.status!==200||readVersionReceiptHeader(r)!=='"'+(expected+1)+'"'||x.id!==draft.id||x.accountId!==draft.accountId||x.formId!==draft.formId||x.formVersion!==draft.formVersion||x.revision!==expected+1||x.status!=='editing'||x.ticketId!==null||!sameRefs(x.refs,draft.refs)||!isCanonicalInstant(x.expiresAt)||canonical(x.answers)!==canonical(v.answers))throw fail();
   return {kind:'confirmed',value:freezeFormData(x)};
  },
  async preview(raw,signal){const v=input(raw,false),{r,data,rejected}=await invoke('/support-requests/preview','POST',v,{},signal);if(rejected)throw new Error('Revise o acesso, os dados e a versão do rascunho.');
   const x=exact(data,['valid','commitAuthorized','draftId','draftRevision','previewHash','subject','priority','clocks','attachmentCount']);if(r.status!==200||x.valid!==true||x.commitAuthorized!==false||x.draftId!==draft.id||x.draftRevision!==v.expectedDraftRevision||x.subject!==v.subject||typeof x.previewHash!=='string'||!/^[a-f0-9]{64}$/.test(x.previewHash)||!['low','normal','high','urgent'].includes(x.priority)||!Number.isSafeInteger(x.attachmentCount)||x.attachmentCount<0||x.attachmentCount>100)throw fail();return freezeFormData(x);
  },
  async create(raw,key,signal){const v=input(raw,true);if(typeof key!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw fail();const {r,data,rejected}=await invoke('/support-requests','POST',v,{'if-match':'"'+v.expectedDraftRevision+'"','idempotency-key':key},signal);if(rejected)return rejected;
   const x=exact(data,['ticketId','protocol','sequence','workspaceId','accountId','actorId','requesterId','draftId','draftRevision','version','profileVersionId','formId','formVersion','priority','createdAt','notification','replayed']);
   if(!uuid(x.ticketId)||x.workspaceId!==context.workspaceId||x.accountId!==context.accountId||x.actorId!==context.principalId||x.requesterId!==context.principalId||x.draftId!==draft.id||x.draftRevision!==v.expectedDraftRevision||x.formId!==draft.formId||x.formVersion!==draft.formVersion||x.profileVersionId!==profile||x.version!==1||x.notification!=='pending'||typeof x.sequence!=='string'||!/^[1-9]\d{4,17}$/.test(x.sequence)||x.protocol!=='CG-'+x.sequence||!isCanonicalInstant(x.createdAt)||!['low','normal','high','urgent'].includes(x.priority)||typeof x.replayed!=='boolean'||r.status!==(x.replayed?200:201)||r.headers.get('idempotency-replayed')!==String(x.replayed)||readVersionReceiptHeader(r)!=='"1"'||r.headers.get('location')!=='/v1/tickets/'+x.ticketId)throw fail();return {kind:'confirmed',value:freezeFormData(x)};
  }
 });
}
