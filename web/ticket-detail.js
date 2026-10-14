import {formatPortalInstant} from './portal-format.js';
import {node,prepareRoot,stateCard,statusBadge,priorityText,textValue} from './portal-ui.js';
/** PUBLIC DTO only. Do not insert internal notes, raw history or unknown properties, even hidden. */
export function renderTicketDetail(root,detail){
 prepareRoot(root,'hd-portal hd-public-detail');root.replaceChildren();
 if(!detail){root.append(stateCard(root,'Selecione um chamado','Selecione um chamado autorizado para consultar suas mensagens.'));return;}
 const header=node(root,'header',undefined,'hd-portal-header');
 header.append(node(root,'p',textValue(detail.protocol)||'Protocolo indisponível','hd-portal-eyebrow'),node(root,'h2',textValue(detail.subject,'Assunto indisponível')));
 const tags=node(root,'div',undefined,'hd-portal-tags');tags.append(statusBadge(root,detail.status),node(root,'span','Prioridade: '+priorityText(detail.priority),'hd-portal-muted'));header.append(tags);root.append(header);
 const description=node(root,'section',undefined,'hd-portal-list-panel');description.append(node(root,'h3','Sua solicitação'),node(root,'p',textValue(detail.description)||'Descrição não informada.','hd-portal-prose'));root.append(description);
 const conversation=node(root,'section',undefined,'hd-portal-list-panel');conversation.setAttribute('aria-label','Conversa pública');conversation.append(node(root,'h3','Conversa'),node(root,'p','Mensagens públicas disponibilizadas nesta consulta.','hd-portal-muted'));
 const list=node(root,'ol',undefined,'hd-portal-conversation');
 for(const message of Array.isArray(detail.messages)?detail.messages:[]){
  const row=node(root,'li',undefined,'hd-portal-message'),time=node(root,'time',formatPortalInstant(message.createdAt),'hd-portal-date');
  // Only canonical timestamps get a machine-readable attribute; invalid strings remain labelled.
  if(formatPortalInstant(message.createdAt)!=='Data indisponível')time.setAttribute('datetime',message.createdAt);
  row.append(time,node(root,'p',textValue(message.body),'hd-portal-prose'));list.append(row);
 }
 conversation.append(list);if(!list.children.length)conversation.append(node(root,'p','Nenhuma mensagem pública disponível nesta consulta.','hd-portal-muted'));root.append(conversation);
}
