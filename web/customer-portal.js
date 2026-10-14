import {formatPortalInstant} from './portal-format.js';
import {node,prepareRoot,counters,stateCard,statusBadge,priorityText,textValue,countText,captureAction,restoreAction} from './portal-ui.js';
/** API shape is unchanged. The host owns filters, pagination, Auth and live scopes. */
export function renderCustomerPortal(root,state,onOpen=()=>{}) { renderPortalView(root,state,onOpen,false); }
export function renderPortalView(root,state,onOpen=()=>{},team=false) {
 const focusKey=captureAction(root);prepareRoot(root,'support-portal hd-portal');root.replaceChildren();
 const header=node(root,'header',undefined,'hd-portal-header'),heading=node(root,'h1',team?'Fila de atendimento':'Meus chamados');
 heading.setAttribute('tabindex','-1');heading.setAttribute('data-portal-heading','');
 header.append(node(root,'p',team?'ATENDIMENTO · EQUIPE':'CENTRAL DE ATENDIMENTO','hd-portal-eyebrow'),heading,
  node(root,'p','Acompanhe solicitações e respostas na consulta autorizada.','hd-portal-muted'));
 root.append(header);
 const status=node(root,'p',state?.pending?'Consultando…':state?.error?'Não foi possível atualizar a consulta.':'','hd-portal-status');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);
 // Missing audience is never an invitation to display a previous user's result.
 if(!state?.audience){root.append(stateCard(root,'Acesse seus chamados','Entre para consultar seus chamados.'));restoreAction(root,focusKey);return;}
 if(state.error){root.append(stateCard(root,'Consulta indisponível','Atualize a consulta pelos controles da página. Nenhum resultado vazio foi assumido.','error'));restoreAction(root,focusKey);return;}
 root.append(counters(root,state.cockpit,team?'Aguardando cliente':'Aguardando você'));
 if(!state.page){root.append(stateCard(root,state.pending?'Carregando chamados':'Consulta não carregada',state.pending?'Aguarde o resultado da consulta autorizada.':'Use os controles da página para consultar os chamados.'));restoreAction(root,focusKey);return;}
 if(!Array.isArray(state.page.items)){root.append(stateCard(root,'Lista indisponível','Atualize a consulta.','error'));restoreAction(root,focusKey);return;}
 const section=node(root,'section',undefined,'hd-portal-list-panel'),title=node(root,'h2',team?'Solicitações da equipe':'Suas solicitações');
 section.append(title,node(root,'p',`${state.page.items.length} carregados de ${countText(state.page.total)} autorizados nesta consulta.`,'hd-portal-muted'));
 const list=node(root,'ul',undefined,'hd-portal-list');list.setAttribute('aria-label','Chamados da consulta');list.setAttribute('aria-busy',String(!!state.pending));
 for(const row of state.page.items){
  const item=node(root,'li',undefined,'hd-portal-ticket'),button=node(root,'button',undefined,'hd-portal-open');
  button.type='button';button.disabled=!!state.pending;button.setAttribute('data-portal-ticket',textValue(row.id));
  button.setAttribute('aria-label','Abrir chamado: '+textValue(row.subject,'Assunto indisponível'));
  const protocol=node(root,'span',textValue(row.protocol)||'Sem protocolo disponível','hd-portal-protocol');
  button.append(protocol,node(root,'span',textValue(row.subject,'Assunto indisponível'),'hd-portal-subject'));
  button.addEventListener('click',()=>{if(!button.disabled&&typeof onOpen==='function')onOpen(row.id);});
  const meta=node(root,'div',undefined,'hd-portal-ticket-meta');meta.append(statusBadge(root,row.status,team),node(root,'span','Prioridade: '+priorityText(row.priority),'hd-portal-muted'),node(root,'span','Atualizado em '+formatPortalInstant(row.updatedAt),'hd-portal-date'));
  item.append(button,meta);list.append(item);
 }
 section.append(list);
 if(!state.page.items.length)section.append(stateCard(root,'Nenhum chamado encontrado','Nenhum chamado encontrado com estes filtros e suas permissões.'));
 if(state.page.nextCursor)section.append(node(root,'p','Há mais resultados disponíveis. Use a paginação da página para continuar.','hd-portal-muted'));
 root.append(section);restoreAction(root,focusKey);
}
