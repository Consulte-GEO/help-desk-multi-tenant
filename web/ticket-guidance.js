import {readTicketActions,hasWriteActions} from './ticket-actions.js';
const publicStates={
 received:['Recebido','Acompanhe as próximas atualizações da equipe na conversa.'],
 in_progress:['Em atendimento','Acompanhe a conversa e utilize as ações disponíveis se houver informações novas.'],
 waiting_for_you:['Aguardando você','Confira a solicitação da equipe na conversa e envie as informações solicitadas.'],
 resolved:['Resolvido','Confira a solução registrada na conversa e as ações disponíveis para esta versão.'],
 closed:['Encerrado','Consulte a solução e o histórico deste chamado.']
};
const internalStates={
 new:['Novo','Confira os dados da solicitação e as ações de triagem disponíveis.'],
 triage:['Triagem','Confira o contexto e os dados necessários para iniciar o atendimento.'],
 open:['Em atendimento','Dê continuidade ao atendimento e registre a evolução na conversa ou no checklist disponível.'],
 waiting_customer:['Aguardando cliente','Acompanhe o retorno do solicitante na conversa.'],
 waiting_internal:['Aguardando equipe','Confira a pendência com a equipe e registre a evolução no atendimento.'],
 waiting_third_party:['Aguardando terceiro','Acompanhe a dependência de terceiro e registre a evolução no atendimento.'],
 resolved:publicStates.resolved,closed:publicStates.closed,
 cancelled:['Cancelado','Consulte o motivo do cancelamento no histórico autorizado.']
};
/** Presentation of the current authorized detail only. Never a command plan,
 * authorization source, SLA projection, person lookup or persisted preference. */
export function ticketGuidance(ticket,actions){
 if(!actions)return null;
 try{actions=readTicketActions({...ticket,available_actions:actions});}catch{return null;}
 const internal=ticket.internal_status!==undefined;
 const [situation,hint]=(internal?internalStates[ticket.internal_status]:publicStates[ticket.status]);
 const owners=new Map([['unassigned','Sem responsável'],['mine','Você'],['other','Outro atendente']]);
 const owner=internal?(owners.get(ticket.assignment?.state)??'Não informado nesta consulta'):null;
 return {situation,owner,next:hasWriteActions(actions)?hint:'Acompanhe a conversa e o histórico autorizado. Seu acesso atual permite somente consulta.',version:ticket.version};
}
export function renderTicketGuidance(root,ticket,actions){
 // Remove old projections even while the host keeps an uncertain write/draft.
 root.replaceChildren();root.hidden=true;
 const view=ticketGuidance(ticket,actions);if(!view)return;
 const doc=root.ownerDocument,make=(tag,text)=>{const node=doc.createElement(tag);node.textContent=text;return node;};
 const heading=make('h3','Resumo do atendimento'),list=doc.createElement('dl');
 heading.id='ticket-guidance-title';root.setAttribute('aria-labelledby',heading.id);
 for(const [name,value] of [['Situação',view.situation],['Responsabilidade',view.owner],['Próximo passo',view.next]]){
  if(value===null)continue;const row=doc.createElement('div');row.append(make('dt',name),make('dd',value));list.append(row);
 }
 root.append(heading,list,make('p','Versão '+view.version+' consultada. As ações disponíveis revalidam suas permissões a cada envio.'));root.hidden=false;
}
