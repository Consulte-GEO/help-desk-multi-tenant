import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {formRecord} from '../domain/form-schema.ts';
import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';
import {canonicalJson,requestHash} from '../domain/canonical.ts';
import {createConsulteGeoConfigurationDraft,compileConsulteGeoConfiguration,type ConsulteGeoCalendar} from '../integrations/consultegeo/configuration.ts';
import {planConsulteGeoLocalProvisioning} from './consultegeo-local-provisioning.ts';
import type {NotificationTemplate} from '../integrations/notifications/templates.ts';
const fail=()=>Error('Plano inicial Consulte GEO inválido. Nenhuma operação foi executada.');
const text=(v:unknown,max:number)=>{if(!isPersistableText(v)||!v.trim()||v.trim()!==v||v.length>max||/[\p{Cc}\p{Cs}]/u.test(v))throw fail();return v;};
/** Offline operator plan. The real native operator checks the existing verified
 * administrator and empty workspace. No login, scope, MFA or external contract
 * is manufactured. published_by references the explicitly delegating sponsor;
 * the separate immutable receipt records the actual session_user operator. */
export function planConsulteGeoInitialOperation(input:unknown){try{
 const x=formRecord(copyFormData(input),['workspaceId','administratorId','administratorEmail','requestId','accountId','accountName','workId','workName','productId','productInstanceId','connectionId','bindingId','contractId','contractVersionId','configurationIds','coverageIds','calendar','reason']);
 const ids=Object.fromEntries(['workspaceId','administratorId','requestId','accountId','productId','productInstanceId','connectionId','bindingId','contractId','contractVersionId'].map(k=>[k,uuidIdentifier(x[k])]));
 const three=(raw:unknown)=>{if(!Array.isArray(raw)||raw.length!==3||new Set(raw).size!==3)throw fail();return raw.map(uuidIdentifier);};
 const configurationIds=three(x.configurationIds),coverageIds=three(x.coverageIds),email=text(x.administratorEmail,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw fail();
 const calendar=copyFormData(x.calendar) as ConsulteGeoCalendar,accountName=text(x.accountName,160),workId=text(x.workId,256),workName=text(x.workName,160),reason=text(x.reason,1000);
 const registry={types:['text','textarea','boolean','select','info'],lookups:[],files:false,downloads:[]};
 const configurations=(['questions','backup','problem'] as const).map((service,i)=>{
  const base=createConsulteGeoConfigurationDraft(service,configurationIds[i]!,1,calendar),labels=['Conferir cliente, obra e informações da solicitação.','Registrar o atendimento realizado e a evidência do resultado.','Conferir o resultado e registrar a devolutiva pública.'];
  const definition={...base,entries:base.entries.map(e=>({...e,checklist:{...e.checklist,items:e.checklist.items.map((item,index)=>({...item,label:labels[index]!}))}}))};
  const artifacts=compileConsulteGeoConfiguration(definition,registry);return {definition,artifacts,contentHash:requestHash({definition,artifacts}),coverageId:coverageIds[i]!};
 });
 const localPlan=planConsulteGeoLocalProvisioning({workspaceId:ids.workspaceId,expectedRegistryRevision:0,requestId:ids.requestId,reason,accounts:[{accountId:ids.accountId,name:accountName,productInstanceId:ids.productInstanceId,connectionId:ids.connectionId,bindingId:ids.bindingId,tenantId:ids.accountId,active:true}],works:[{accountId:ids.accountId,id:workId,name:workName,active:true}],permissions:['tickets.read','tickets.write','notes.read','notes.write'].map(operation=>({accountId:ids.accountId,principalId:ids.administratorId,role:'agent',operation,active:true,workIds:[workId]}))});
 const templates:NotificationTemplate[]=[
  {id:'consultegeo-opened',version:1,status:'published',visibility:'public',kind:'support.created',subject:'{{protocol}} · Solicitação recebida',title:'Recebemos sua solicitação',introduction:'Sua solicitação foi registrada. Acompanhe o andamento e os prazos no portal da Consulte GEO.',actionLabel:'Acompanhar chamado'},
  {id:'consultegeo-updated',version:1,status:'published',visibility:'public',kind:'support.devolutiva',subject:'{{protocol}} · Atualização do atendimento',title:'Há uma atualização no seu chamado',introduction:'A equipe Consulte GEO publicou uma resposta. Entre no portal para consultar as informações e responder quando necessário.',actionLabel:'Consultar atualização'},
  {id:'consultegeo-resolved',version:1,status:'published',visibility:'public',kind:'support.resolved',subject:'{{protocol}} · Atendimento resolvido',title:'O atendimento foi resolvido',introduction:'Consulte a solução registrada no portal. Se precisar de um ajuste, você pode solicitar a reabertura dentro de sete dias.',actionLabel:'Consultar solução'}
 ];
 const routes=['support.created','support.devolutiva','support.customer_reply','support.form_revised','support.resolved','support.approval_requested','support.approval_granted','support.approval_rejected'].map(kind=>{const template=templates.find(t=>t.kind===kind);return {kind,revision:1,audience:template?'requester':'none',templateId:template?.id??null,templateVersion:template?.version??null};});
 const command={schema:1,product:'CONSULTE_GEO',...ids,administratorEmail:email,accountName,workId,workName,reason,registry,configurations,local:JSON.parse(localPlan.values[0]),localHash:localPlan.values[1],coveragePolicy:{kind:'local_operational_policy',externalContractQualified:false,approvedBy:ids.administratorId,policyVersion:1},protocolPolicy:{namespace:'CONSULTE_GEO_HELPDESK',prefix:'CG-',lastSequence:'10000',legacyImport:'separate_external_identity'},templates:templates.map(document=>({document,sha256:requestHash(document)})),routes};
 const json=canonicalJson(command);if(Buffer.byteLength(json)>160*1024)throw fail();
 return freezeFormData({executesDatabase:false as const,sql:'select helpdesk_auth.cg_initial_operation($1::text,$2::text) as receipt',values:[json,requestHash(command)] as const});
}catch{throw fail();}}
