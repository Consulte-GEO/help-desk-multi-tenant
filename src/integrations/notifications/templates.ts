import {copyFormData,freezeFormData} from '../../../shared/form-rules.js';
import {requestHash} from '../../domain/canonical.ts';
import {parseNotificationIntent,notificationRecord,deliveryFailure,type NotificationIntent} from '../../domain/notification-delivery.ts';
export type NotificationTemplate=Readonly<{id:string;version:number;status:'published';visibility:'public';kind:NotificationIntent['kind'];subject:string;title:string;introduction:string;actionLabel:string}>;
const unavailable=()=>deliveryFailure('notification_template_unavailable');
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Strict plain-text templates: no arbitrary HTML, URLs, selectors or expression language.
 * Recipient names, notes, form data and message bodies are intentionally not inputs.
 */
export function renderNotification(raw:NotificationIntent,source:unknown,portalOrigin:string):Readonly<{subject:string;text:string;html:string}>{
 try{
  const intent=parseNotificationIntent(raw),t=notificationRecord(source,['id','version','status','visibility','kind','subject','title','introduction','actionLabel']);
  if(t.id!==intent.templateId||t.version!==intent.templateVersion||t.kind!==intent.kind||t.status!=='published'||t.visibility!=='public'||requestHash(copyFormData(source))!==intent.templateHash)throw Error();
  const origin=new URL(portalOrigin);if(origin.protocol!=='https:'||origin.origin!==portalOrigin||origin.username||origin.password||origin.search||origin.hash)throw Error();
  const text=(v:unknown,max:number)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\p{Cc}\p{Cs}]/u.test(v)||/[{}]/.test(v.replaceAll('{{protocol}}','')))throw Error();return v.replaceAll('{{protocol}}',intent.protocol);};
  const subject=text(t.subject,160),title=text(t.title,200),intro=text(t.introduction,1500),label=text(t.actionLabel,80);
  const path=intent.kind==='support.approval_requested'?'/support/approvals/'+intent.invitationId:'/support/tickets/'+intent.ticketId;
  const href=portalOrigin+path,notice=intent.kind==='support.approval_requested'?'Abrir este link não registra aprovação. Entre com sua conta e confirme a decisão no portal.':'Entre com sua conta para consultar o atendimento autorizado.';
  return freezeFormData({subject,text:[title,intro,notice,label+': '+href].join('\n\n'),html:'<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>'+escape(subject)+'</title></head><body><h1>'+escape(title)+'</h1><p>'+escape(intro)+'</p><p>'+escape(notice)+'</p><p><a href="'+escape(href)+'">'+escape(label)+'</a></p></body></html>'});
 }catch{throw unavailable();}
}
