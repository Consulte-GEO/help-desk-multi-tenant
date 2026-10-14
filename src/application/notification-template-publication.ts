import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {formRecord} from '../domain/form-schema.ts';import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';import {canonicalJson,requestHash} from '../domain/canonical.ts';import {HelpdeskError} from '../domain/errors.ts';
import {WAVE1_TEMPLATES,WAVE1_RENDERER_ID} from '../integrations/notifications/wave1-templates.ts';
const failed=()=>new HelpdeskError(400,'notification_publication_plan_invalid','Plano de publicação de notificações inválido. Nenhuma operação foi executada.');
const text=(v:unknown,max:number)=>{if(!isPersistableText(v)||!v.trim()||v.trim()!==v||v.length>max||/[\p{Cc}\p{Cs}]/u.test(v))throw failed();return v;};
/** Offline genuine-operator plan, not an HTTP publisher or an MFA bypass.
 * Exact predecessor hashes/revisions and fixed v2 content bind the whole wave. */
export function planNotificationTemplatePublication(input:unknown){try{
 const x=formRecord(copyFormData(input),['workspaceId','administratorId','administratorEmail','operatorName','requestId','reason','expectedRoutes']);
 const workspaceId=uuidIdentifier(x.workspaceId),administratorId=uuidIdentifier(x.administratorId),requestId=uuidIdentifier(x.requestId),administratorEmail=text(x.administratorEmail,254).toLowerCase(),operatorName=text(x.operatorName,63),reason=text(x.reason,300);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(administratorEmail)||! /^[A-Za-z_][A-Za-z0-9_-]{0,62}$/.test(operatorName)||!Array.isArray(x.expectedRoutes)||x.expectedRoutes.length!==3)throw failed();
 const expectedRows=x.expectedRoutes;
 const expectedRoutes=WAVE1_TEMPLATES.map(t=>{
  const matches=expectedRows.filter((r:unknown)=>r&&typeof r==='object'&&(r as Record<string,unknown>).kind===t.kind);if(matches.length!==1)throw failed();
  const r=formRecord(matches[0],['kind','revision','templateId','templateVersion','templateHash']);
  if(r.templateId!==t.id||r.templateVersion!==1||!Number.isSafeInteger(r.revision)||Number(r.revision)<1||Number(r.revision)>=Number.MAX_SAFE_INTEGER||typeof r.templateHash!=='string'||!/^[a-f0-9]{64}$/.test(r.templateHash))throw failed();
  return {kind:t.kind,revision:Number(r.revision),templateId:t.id,templateVersion:1,templateHash:r.templateHash};
 });
 const command={schema:1,purpose:'notification-wave1',assurance:'operator-delegation',workspaceId,administratorId,administratorEmail,operatorName,requestId,reason,rendererId:WAVE1_RENDERER_ID,expectedRoutes,templates:WAVE1_TEMPLATES.map(document=>({document,sha256:requestHash(document)}))};
 const json=canonicalJson(command);return freezeFormData({executesDatabase:false as const,values:[json,requestHash(command)] as const});
}catch{throw failed();}}
