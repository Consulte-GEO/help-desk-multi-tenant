import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {formRecord} from '../domain/form-schema.ts';import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';
import {canonicalJson,requestHash} from '../domain/canonical.ts';import {instantMicros} from '../domain/business-calendar.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {WAVE2_RENDERER_ID,WAVE2_PUBLIC_TEMPLATES,WAVE2_INTERNAL_TEMPLATES,WAVE2_REVIEW_TEMPLATES} from '../integrations/notifications/wave2-templates.ts';
const failure=()=>new HelpdeskError(400,'notification_wave2_plan_invalid','Plano da segunda onda inválido. Nenhuma operação foi executada.');
const text=(v:unknown,max:number)=>{if(!isPersistableText(v)||!v.trim()||v.trim()!==v||v.length>max||/[\p{Cc}\p{Cs}]/u.test(v))throw failure();return v;};
const templates={public:WAVE2_PUBLIC_TEMPLATES,team:WAVE2_INTERNAL_TEMPLATES,review:WAVE2_REVIEW_TEMPLATES} as const;
const audiences:Readonly<Record<string,string>>=Object.freeze({'internal.queue_created':'queue','internal.assignment_changed':'assignee','support.customer_reply':'customer_return','support.approval_requested':'approver'});
function cohort(raw:unknown):string[]{if(!Array.isArray(raw)||raw.length<1||raw.length>10)throw failure();const ids=raw.map(uuidIdentifier);if(new Set(ids).size!==ids.length)throw failure();return ids.sort();}
/** Offline plan only. Fixed renderer/templates, observed predecessor tuples and
 * an explicit bounded cohort are part of every canonical command and receipt.
 * Genuine operator SQL must separately revalidate identity, scope and current CAS. */
export function planNotificationWave2Publication(raw:unknown){try{
 const x=formRecord(copyFormData(raw),['workspaceId','administratorId','administratorEmail','operatorName','requestId','reason','group','phase','recipientIds','expiresAt','expectedRoutes']);
 if(!['public','team','review'].includes(String(x.group))||!['prepare','activate','pause'].includes(String(x.phase)))throw failure();
 const group=x.group as keyof typeof templates,phase=x.phase as 'prepare'|'activate'|'pause';
 const workspaceId=uuidIdentifier(x.workspaceId),administratorId=uuidIdentifier(x.administratorId),requestId=uuidIdentifier(x.requestId),administratorEmail=text(x.administratorEmail,254).toLowerCase(),operatorName=text(x.operatorName,63),reason=text(x.reason,1000);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(administratorEmail)||!/^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(operatorName)||['helpdesk_app','helpdesk_notification_worker','helpdesk_resource_publisher','helpdesk_maintenance','anon','authenticated','service_role'].includes(operatorName))throw failure();
 const recipientIds=cohort(x.recipientIds),expiresAt=text(x.expiresAt,40);instantMicros(expiresAt);
 if(!Array.isArray(x.expectedRoutes)||x.expectedRoutes.length!==templates[group].length)throw failure();const rows=x.expectedRoutes;
 const expectedRoutes=templates[group].map(t=>{
  const matches=rows.filter((r:unknown)=>r&&typeof r==='object'&&(r as Record<string,unknown>).kind===t.kind);if(matches.length!==1)throw failure();
  const r=formRecord(matches[0],['kind','revision','audience','templateId','templateVersion','templateHash','effectiveAfter','recipientIds']);
  if(!Number.isSafeInteger(r.revision)||Number(r.revision)<0||Number(r.revision)>=Number.MAX_SAFE_INTEGER||!['none',audiences[t.kind]??'requester'].includes(String(r.audience)))throw failure();
  if(r.audience==='none'){if(r.templateId!==null||r.templateVersion!==null||r.templateHash!==null)throw failure();}
  else if(r.templateId!==t.id||r.templateVersion!==t.version||r.templateHash!==requestHash(t))throw failure();
  if(r.effectiveAfter!==null)instantMicros(text(r.effectiveAfter,40));
  const priorIds=r.recipientIds===null?null:cohort(r.recipientIds);
  if(r.revision===0&&(r.audience!=='none'||r.effectiveAfter!==null||priorIds!==null))throw failure();
  return {...r,kind:t.kind,revision:Number(r.revision),recipientIds:priorIds};
 });
 const command={schema:1,purpose:'notification-wave2',assurance:'operator-delegation',workspaceId,administratorId,administratorEmail,operatorName,requestId,reason,group,phase,recipientIds,expiresAt,rendererId:WAVE2_RENDERER_ID,expectedRoutes,
  templates:templates[group].map(document=>({document,sha256:requestHash(document),audience:audiences[document.kind]??'requester'}))};
 const json=canonicalJson(command);if(Buffer.byteLength(json)>32*1024)throw failure();
 return freezeFormData({executesDatabase:false as const,values:[json,requestHash(command)] as const});
}catch{throw failure();}}
