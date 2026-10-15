import {copyFormData,freezeFormData} from './form-rules.js';
/** Presentation-only contract. Parsing a view never authenticates an audience. */
export const REGISTRATION_REVIEW_LIMITS=Object.freeze({fieldText:1024,fields:128,windowMs:60000});
const statuses=['queued_analysis','analyzing','draft_ready','needs_information','manual_review','analysis_failed','cancelled'];
const fail=()=>{throw Object.assign(new Error('Consulta do rascunho indisponível.'),{code:'registration_review_invalid'});};
function object(value,keys){if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))fail();return value;}
function uuid(v){if(typeof v!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/.test(v))fail();return v;}
function text(v,max=1024){if(typeof v!=='string'||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\p{Cs}]/u.test(v))fail();return v;}
function revision(v,min=1){if(!Number.isSafeInteger(v)||v<min)fail();return v;}
function instant(v){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(Date.parse(v)).toISOString()!==v)fail();return v;}
function context(v){const r=object(v,['workspaceId','accountId','ticketId','operationId']);for(const k of Object.keys(r))uuid(r[k]);return r;}
export function parseRegistrationReviewContext(raw){try{const r=object(copyFormData(raw),['workspaceId','accountId','ticketId','operationId','audience']);context({workspaceId:r.workspaceId,accountId:r.accountId,ticketId:r.ticketId,operationId:r.operationId});if(!['internal','customer'].includes(r.audience))fail();return freezeFormData(r);}catch{fail();}}
function fields(raw){if(!Array.isArray(raw)||raw.length>128)fail();const seen=new Set();return raw.map(row=>{const r=object(row,['key','label','value','truncated']);text(r.key,100);text(r.label,160);text(r.value);if(typeof r.truncated!=='boolean'||!r.key||seen.has(r.key))fail();seen.add(r.key);return r;});}
function messages(raw){if(!Array.isArray(raw)||raw.length>12)fail();return raw.map(s=>text(s,2000));}
export function parseRegistrationReviewView(raw,expected){try{
 const e=parseRegistrationReviewContext(expected),r=object(copyFormData(raw),['schema','audience','context','revision','inputRevision','status','observedAt','expiresAt','detail','capabilities']);
 if(r.schema!==1||r.audience!==e.audience||!statuses.includes(r.status))fail();context(r.context);for(const k of Object.keys(r.context))if(r.context[k]!==e[k])fail();
 revision(r.revision);revision(r.inputRevision);instant(r.observedAt);instant(r.expiresAt);const ttl=Date.parse(r.expiresAt)-Date.parse(r.observedAt);if(ttl<1||ttl>REGISTRATION_REVIEW_LIMITS.windowMs)fail();
 const caps=object(r.capabilities,['edit','approve','execute']);if(Object.values(caps).some(v=>v!==false))fail();
 if(r.audience==='customer'){if(r.detail!==null)fail();}
 else {const d=object(r.detail,['requested','targets','proposal','effects','blockers','draftRevision','draftHash','historyLoaded']);fields(d.requested);fields(d.targets);fields(d.proposal);messages(d.effects);messages(d.blockers);revision(d.draftRevision,0);
  if(d.historyLoaded!==false|| (d.draftHash!==null&&(typeof d.draftHash!=='string'||!/^[a-f0-9]{64}$/.test(d.draftHash))))fail();
  if(r.status==='draft_ready'){if(d.draftRevision<1||d.draftHash===null||d.proposal.length===0)fail();}else if(d.draftHash!==null||d.proposal.length!==0)fail();
 }
 return freezeFormData(r);
}catch{fail();}}
export function registrationReviewStatus(status,audience='internal'){
 const common={queued_analysis:['Na fila de análise','A solicitação aguarda análise.','neutral'],analyzing:['Em análise','Os dados estão sendo avaliados.','info'],draft_ready:['Rascunho preparado','O rascunho aguarda conferência humana. Esta análise não confirma criação no Novo GEO.','warning'],needs_information:['Informações pendentes','A equipe precisa conferir informações adicionais.','warning'],manual_review:['Conferência da equipe','A solicitação precisa de revisão pela equipe.','warning'],analysis_failed:['Análise indisponível','A equipe precisa verificar a análise. Esta análise não confirma criação no Novo GEO.','warning'],cancelled:['Análise cancelada','Esta análise foi cancelada. Isso não altera o histórico do chamado.','neutral']};
 const item=(typeof status==='string'&&Object.hasOwn(common,status)?common[status]:null)??['Estado indisponível','Consulte novamente antes de continuar.','warning'];
 return Object.freeze({label:audience==='customer'&&status==='draft_ready'?'Em conferência':item[0],message:item[1],tone:item[2]});
}
