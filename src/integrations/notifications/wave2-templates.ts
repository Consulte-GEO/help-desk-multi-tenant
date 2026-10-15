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
/** Public-safe envelope; internal audience authority is separate and mandatory. */
export const WAVE2_INTERNAL_TEMPLATES:readonly NotificationTemplate[]=freezeFormData([
 {id:'consultegeo-queue-created',version:1,status:'published',visibility:'public',kind:'internal.queue_created',subject:'[{{protocol}}] Novo chamado na fila',title:'Há um novo chamado na fila',introduction:'Uma nova solicitação está disponível na fila de atendimento. Abra o portal para consultar o chamado {{protocol}} e as ações permitidas para sua equipe.',actionLabel:'Consultar chamado'},
 {id:'consultegeo-assignment',version:1,status:'published',visibility:'public',kind:'internal.assignment_changed',subject:'[{{protocol}}] Atribuição de atendimento',title:'Um chamado foi atribuído a você',introduction:'Foi registrada uma atribuição para você no chamado {{protocol}}. Consulte as informações, os prazos vigentes e as ações disponíveis no portal.',actionLabel:'Consultar atribuição'},
 {id:'consultegeo-customer-return',version:1,status:'published',visibility:'public',kind:'support.customer_reply',subject:'[{{protocol}}] Nova mensagem do solicitante',title:'O solicitante respondeu',introduction:'Foi registrada uma resposta do solicitante no chamado {{protocol}}. Consulte a mensagem e os próximos passos no portal.',actionLabel:'Consultar mensagem'}
]);
export const WAVE2_REVIEW_TEMPLATES:readonly NotificationTemplate[]=freezeFormData([
 {id:'consultegeo-form-revised',version:1,status:'published',visibility:'public',kind:'support.form_revised',subject:'[{{protocol}}] Informações atualizadas',title:'A revisão foi recebida',introduction:'Foi registrada uma nova versão das informações do chamado {{protocol}}. Consulte no portal os próximos passos. A revisão pode exigir uma nova análise ou aprovação.',actionLabel:'Consultar revisão'},
 {id:'consultegeo-approval-requested',version:1,status:'published',visibility:'public',kind:'support.approval_requested',subject:'[{{protocol}}] Há uma solicitação para sua análise',title:'Sua análise foi solicitada',introduction:'Há uma solicitação de aprovação relacionada ao chamado {{protocol}}. Acesse o portal para conferir a versão apresentada e registrar sua decisão, se estiver autorizado.',actionLabel:'Analisar solicitação'},
 {id:'consultegeo-approval-granted',version:1,status:'published',visibility:'public',kind:'support.approval_granted',subject:'[{{protocol}}] Aprovação registrada',title:'A aprovação foi registrada',introduction:'Uma aprovação foi registrada para o chamado {{protocol}}. Consulte a decisão e os próximos passos no portal. A aprovação não confirma a execução do serviço solicitado.',actionLabel:'Consultar decisão'},
 {id:'consultegeo-approval-rejected',version:1,status:'published',visibility:'public',kind:'support.approval_rejected',subject:'[{{protocol}}] Consulte a decisão da solicitação',title:'Sua solicitação precisa de revisão',introduction:'Uma decisão de não aprovação foi registrada para o chamado {{protocol}}. Consulte no portal o motivo e as orientações para os próximos passos.',actionLabel:'Consultar orientação'}
]);
export const WAVE2_TEMPLATES:readonly NotificationTemplate[]=freezeFormData([...WAVE2_PUBLIC_TEMPLATES,...WAVE2_INTERNAL_TEMPLATES,...WAVE2_REVIEW_TEMPLATES]);
const presentations:Readonly<Record<string,{id:string;tone:string;pill:string;internal:boolean}>>=freezeFormData({
 'support.transition':{id:'02',tone:'blue',pill:'Atendimento iniciado',internal:false},
 'support.reply':{id:'03',tone:'blue',pill:'Nova resposta',internal:false},
 'support.handoff':{id:'06',tone:'purple',pill:'Encaminhamento registrado',internal:false},
 'support.closed':{id:'08',tone:'neutral',pill:'Chamado encerrado',internal:false},
 'support.reopened':{id:'09',tone:'amber',pill:'Reabertura registrada',internal:false},
 'support.cancelled':{id:'25',tone:'neutral',pill:'Cancelamento registrado',internal:false},
 'internal.queue_created':{id:'10',tone:'magenta',pill:'Novo chamado na fila',internal:true},
 'internal.assignment_changed':{id:'11',tone:'blue',pill:'Atribuição registrada',internal:true},
 'support.customer_reply':{id:'12',tone:'blue',pill:'Retorno do solicitante',internal:true},
 'support.form_revised':{id:'21',tone:'blue',pill:'Revisão registrada',internal:false},
 'support.approval_requested':{id:'22',tone:'purple',pill:'Análise solicitada',internal:false},
 'support.approval_granted':{id:'23',tone:'green',pill:'Aprovação registrada',internal:false},
 'support.approval_rejected':{id:'24',tone:'red',pill:'Decisão registrada',internal:false}
});
export function wave2Presentation(kind:string){const p=presentations[kind];if(!p)throw Error('Unsupported wave2 event');return p;}
/** Renderer assignments are immutable. A reserved ID cannot silently select a
 * legacy renderer when its version or kind disagrees with the published tuple. */
export function wave2Renderer(id:unknown,version:unknown,kind:unknown):boolean{
 const t=WAVE2_TEMPLATES.find(t=>t.id===id);if(!t)return false;
 if(t.version!==version||t.kind!==kind)throw Error('Pinned wave2 renderer mismatch');return true;
}
