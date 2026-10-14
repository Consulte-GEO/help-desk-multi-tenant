import {freezeFormData} from '../../../shared/form-rules.js';
import type {NotificationTemplate} from './templates.ts';
export const WAVE1_RENDERER_ID='consultegeo-email-v2';
/** These ID/version/kind tuples are immutable renderer assignments. Future
 * content/layout revisions need new tuples; old intents retain the v1 renderer. */
export const WAVE1_TEMPLATES:readonly NotificationTemplate[]=freezeFormData([
 {id:'consultegeo-opened',version:2,status:'published',visibility:'public',kind:'support.created',subject:'[{{protocol}}] Solicitação recebida',title:'Recebemos sua solicitação',introduction:'A solicitação {{protocol}} foi registrada. A equipe Consulte GEO irá analisar o pedido. Acompanhe o andamento e consulte as informações do atendimento no portal.',actionLabel:'Acompanhar chamado'},
 {id:'consultegeo-updated',version:2,status:'published',visibility:'public',kind:'support.devolutiva',subject:'[{{protocol}}] Atualização do atendimento',title:'Há uma atualização no seu chamado',introduction:'A equipe Consulte GEO publicou uma atualização no chamado {{protocol}}. Consulte as orientações no portal e envie informações quando solicitado.',actionLabel:'Consultar e responder'},
 {id:'consultegeo-resolved',version:2,status:'published',visibility:'public',kind:'support.resolved',subject:'[{{protocol}}] Solução registrada',title:'A solução foi registrada',introduction:'A equipe registrou uma solução para o chamado {{protocol}}. Consulte os detalhes no portal. Se o problema continuar, verifique a opção de reabertura e o prazo aplicável ao chamado.',actionLabel:'Consultar solução'}
]);
export function wave1Renderer(id:unknown,version:unknown,kind:unknown):boolean{
 const pinned=WAVE1_TEMPLATES.find(t=>t.id===id&&t.version===version);
 if(pinned&&pinned.kind!==kind)throw Error('Pinned renderer event mismatch');
 return pinned!==undefined;
}
