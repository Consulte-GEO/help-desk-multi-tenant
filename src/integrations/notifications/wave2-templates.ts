import {freezeFormData} from '../../../shared/form-rules.js';
import type {NotificationTemplate} from './templates.ts';
export const WAVE2_RENDERER_ID='consultegeo-email-wave2-v1';
export const WAVE2_PUBLIC_TEMPLATES:readonly NotificationTemplate[]=freezeFormData([
 {id:'consultegeo-started',version:1,status:'published',visibility:'public',kind:'support.transition',subject:'[{{protocol}}] Atendimento iniciado',title:'Seu chamado está em atendimento',introduction:'O atendimento do chamado {{protocol}} foi iniciado. Consulte o andamento e os próximos passos no portal.',actionLabel:'Acompanhar atendimento'},
 {id:'consultegeo-reply',version:1,status:'published',visibility:'public',kind:'support.reply',subject:'[{{protocol}}] Nova resposta do suporte',title:'Há uma nova resposta no seu chamado',introduction:'A equipe Consulte GEO publicou uma resposta no chamado {{protocol}}. Entre no portal para consultar a mensagem e responder, se necessário.',actionLabel:'Consultar resposta'},
 {id:'consultegeo-handoff',version:1,status:'published',visibility:'public',kind:'support.handoff',subject:'[{{protocol}}] Atualização do encaminhamento',title:'Seu chamado foi encaminhado',introduction:'O chamado {{protocol}} foi encaminhado para continuidade da análise. O protocolo permanece o mesmo. Consulte o andamento e as orientações no portal.',actionLabel:'Consultar andamento'},
 {id:'consultegeo-closed',version:1,status:'published',visibility:'public',kind:'support.closed',subject:'[{{protocol}}] Chamado encerrado',title:'O chamado foi encerrado',introduction:'O chamado {{protocol}} foi encerrado. O histórico do atendimento continua disponível no portal conforme suas permissões de acesso.',actionLabel:'Consultar histórico'},
 {id:'consultegeo-reopened',version:1,status:'published',visibility:'public',kind:'support.reopened',subject:'[{{protocol}}] Chamado reaberto',title:'Seu chamado foi reaberto',introduction:'A reabertura do chamado {{protocol}} foi registrada. Acompanhe a continuidade do atendimento no portal.',actionLabel:'Acompanhar chamado'},
 {id:'consultegeo-cancelled',version:1,status:'published',visibility:'public',kind:'support.cancelled',subject:'[{{protocol}}] Chamado cancelado',title:'O cancelamento foi registrado',introduction:'O chamado {{protocol}} foi cancelado. Consulte o motivo registrado e o histórico no portal.',actionLabel:'Consultar registro'}
]);
const presentations:Readonly<Record<string,{id:string;tone:string;pill:string;internal:boolean}>>=freezeFormData({
 'support.transition':{id:'02',tone:'blue',pill:'Atendimento iniciado',internal:false},
 'support.reply':{id:'03',tone:'blue',pill:'Nova resposta',internal:false},
 'support.handoff':{id:'06',tone:'purple',pill:'Encaminhamento registrado',internal:false},
 'support.closed':{id:'08',tone:'neutral',pill:'Chamado encerrado',internal:false},
 'support.reopened':{id:'09',tone:'amber',pill:'Reabertura registrada',internal:false},
 'support.cancelled':{id:'25',tone:'neutral',pill:'Cancelamento registrado',internal:false}
});
export function wave2Presentation(kind:string){const p=presentations[kind];if(!p)throw Error('Unsupported wave2 event');return p;}
/** Renderer assignments are immutable. A reserved ID cannot silently select a
 * legacy renderer when its version or kind disagrees with the published tuple. */
export function wave2Renderer(id:unknown,version:unknown,kind:unknown):boolean{
 const t=WAVE2_PUBLIC_TEMPLATES.find(t=>t.id===id);if(!t)return false;
 if(t.version!==version||t.kind!==kind)throw Error('Pinned wave2 renderer mismatch');return true;
}
