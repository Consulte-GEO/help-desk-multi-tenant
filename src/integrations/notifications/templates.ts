import {copyFormData,freezeFormData} from '../../../shared/form-rules.js';
import {requestHash} from '../../domain/canonical.ts';
import {parseNotificationIntent,notificationRecord,deliveryFailure,type NotificationIntent} from '../../domain/notification-delivery.ts';
import {wave1Renderer} from './wave1-templates.ts';
import {renderWave1Email} from './renderer-v2.ts';
import {wave2Renderer} from './wave2-templates.ts';
import {renderWave2Email} from './renderer-wave2.ts';
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
  const why='Você recebeu este e-mail porque participa deste chamado na Consulte GEO.';
  if(wave2Renderer(t.id,t.version,t.kind))return freezeFormData(renderWave2Email({kind:intent.kind,subject,protocol:intent.protocol,title,introduction:intro,notice,actionLabel:label,href}));
  if(wave1Renderer(t.id,t.version,t.kind))return freezeFormData(renderWave1Email({kind:intent.kind,subject,protocol:intent.protocol,title,introduction:intro,notice,actionLabel:label,href}));
  const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+escape(subject)+'</title></head>'+
   '<body style="margin:0;background:#faf9f7;color:#16213e;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all">'+escape(intro)+'</div>'+
   '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e6e1d6;border-radius:8px">'+
   '<tr><td style="padding:24px;background:#182863;background:linear-gradient(135deg,#182863,#3E2D71 55%,#C5117E);color:#ffffff"><strong style="font-size:22px">Consulte GEO</strong><div style="font-size:12px;margin-top:8px">Atendimento · '+escape(intent.protocol)+'</div></td></tr>'+
   '<tr><td style="padding:32px 24px"><h1 style="font-size:24px;line-height:1.3;margin:0 0 20px">'+escape(title)+'</h1><p style="font-size:16px;line-height:1.6;margin:0 0 20px">'+escape(intro)+'</p><p style="font-size:14px;line-height:1.6;color:#5c5648">'+escape(notice)+'</p>'+
   '<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#182863" style="border-radius:6px"><a href="'+escape(href)+'" style="display:inline-block;line-height:44px;min-height:44px;padding:0 24px;background:#182863;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold;border-radius:6px">'+escape(label)+'</a></td></tr></table></td></tr>'+
   '<tr><td style="padding:24px;background:#faf9f7;color:#5c5648;font-size:12px;line-height:1.6;border-top:1px solid #e6e1d6"><strong>Consulte GEO · Equipe de Atendimento</strong><p style="margin:8px 0 0">'+escape(why)+'</p></td></tr></table></td></tr></table></body></html>';
  return freezeFormData({subject,text:['Consulte GEO · '+intent.protocol,title,intro,notice,label+': '+href,why].join('\n\n'),html});
 }catch{throw unavailable();}
}
