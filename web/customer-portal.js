const labels={received:'Recebido',in_progress:'Em atendimento',waiting_for_you:'Aguardando você',resolved:'Resolvido',closed:'Encerrado'};
export function renderCustomerPortal(root,state,onOpen=()=>{}){
 const d=root.ownerDocument,el=(tag,text)=>{const e=d.createElement(tag);e.textContent=text;return e;};root.replaceChildren();root.setAttribute('class','support-portal');root.append(el('h1','Meus chamados'));
 const status=el('p',state.pending?'Consultando…':state.error??'');status.setAttribute('role','status');status.setAttribute('aria-live','polite');root.append(status);
 if(!state.audience){root.append(el('p','Entre para consultar seus chamados.'));return;}
 const counts=d.createElement('section');counts.setAttribute('aria-label','Resumo da consulta autorizada');for(const [key,label] of [['total','Total autorizado'],['open','Em aberto'],['waitingCustomer','Aguardando você'],['resolvedOrClosed30d','Resolvidos ou encerrados em 30 dias']])counts.append(el('p',`${label}: ${Number.isSafeInteger(state.cockpit?.[key])?state.cockpit[key]:'Indisponível'}`));root.append(counts);
 if(!state.page)return;root.append(el('p',`${state.page.items.length} carregados de ${state.page.total} autorizados nesta consulta.`));const list=el('ul','');
 for(const row of state.page.items){const item=el('li',''),button=el('button',`${row.protocol??'Sem protocolo disponível'} — ${row.subject}`);button.type='button';button.disabled=state.pending;button.addEventListener('click',()=>onOpen(row.id));item.append(button,el('span',labels[row.status]??'Situação indisponível'));list.append(item);}root.append(list);if(!state.page.items.length)root.append(el('p','Nenhum chamado encontrado com estes filtros.'));
}
