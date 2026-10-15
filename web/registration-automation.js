import {operationsUI,clearOperationsNode} from './operations-ui.js';
import {createRegistrationReviewState} from './registration-review-state.js';
import {registrationReviewStatus} from '../shared/registration-review.js';
/** Optional read-only panel; mount only after host authorization of the audience.
 * No automatic read, route, persistence, approve button or execution callback. */
export function mountRegistrationAutomation(root,options){
 const ui=operationsUI(root,'registration-review','Rascunho de cadastro','Confira o pedido, o destino e os efeitos propostos. Consultar não aprova nem cria um cadastro.'),{node}=ui;
 let destroyed=false,lastPhase='';
 const content=node('div',undefined,{'data-review-content':''});
 const actions=node('div',undefined,{class:'hd-ops-actions'});
 const read=ui.button('Consultar rascunho','read-registration',()=>state.refresh(),true);
 actions.append(read);ui.section.append(actions,content);
 const facts=rows=>{
  const dl=node('dl',undefined,{class:'hd-ops-facts'});
  for(const field of rows){const row=node('div'),dd=node('dd',field.value);row.append(node('dt',field.label),dd);
   if(field.truncated)row.append(node('p','Texto abreviado nesta consulta; confira o conteúdo integral no chamado.',{class:'hd-ops-muted'}));dl.append(row);
  }return dl;
 };
 const section=(title,rows,empty)=>{const box=node('section',undefined,{class:'hd-registration-section'});box.append(node('h3',title));box.append(rows.length?facts(rows):node('p',empty,{class:'hd-ops-muted'}));return box;};
 function draw(s){
  if(destroyed)return;
  clearOperationsNode(content);
  if(s.phase==='cleared'){ui.destroy();return;}
  ui.section.setAttribute('aria-busy',String(s.phase==='loading'));read.disabled=s.phase==='loading';
  read.textContent=s.phase==='ready'?'Consultar rascunho':s.phase==='loading'?'Consultando…':'Consultar novamente';
  const states={ready:'Nenhuma consulta foi enviada. Os dados serão conferidos quando você consultar.',loading:'Consultando a revisão autorizada…',error:'Não foi possível conferir o rascunho. Esta consulta não altera cadastros. Consulte novamente.',expired:'A consulta expirou. Consulte novamente para ver a revisão atual.'};
  if(s.phase!=='loaded')ui.report(states[s.phase]??'Consulta indisponível.',['error','expired'].includes(s.phase)?'warning':'neutral');
  else {
   const v=s.view,summary=registrationReviewStatus(v.status,v.audience);ui.report(summary.message,summary.tone);
   const top=node('div',undefined,{class:'hd-registration-heading'});top.append(ui.badge(summary),node('p',`Solicitação · revisão ${v.inputRevision}`,{class:'hd-ops-muted'}));content.append(top);
   if(v.detail){const d=v.detail,grid=node('div',undefined,{class:'hd-registration-grid'});
    const proposed=node('div');proposed.append(section('Sugestão do agente',d.proposal,'Não há rascunho pronto nesta revisão.'),section('Dados e vínculos propostos',d.targets,'Destino indisponível.'));
    grid.append(section('Solicitado',d.requested,'Não há campos adicionais nesta consulta.'),proposed);content.append(grid);
    const effects=node('section',undefined,{class:'hd-registration-section'});effects.append(node('h3','Efeitos do cadastro'));
    if(d.effects.length){const list=node('ul');for(const effect of d.effects)list.append(node('li',effect));effects.append(list);}else effects.append(node('p','Nenhum efeito proposto para execução.',{class:'hd-ops-muted'}));proposed.append(effects);
    const notice=node('section',undefined,{class:'hd-ops-review'});notice.append(node('h3','O que falta para criar'));for(const blocker of d.blockers)notice.append(node('p',blocker));content.append(notice);
    const history=node('details',undefined,{class:'hd-registration-history'});history.append(node('summary','Revisões e rastreabilidade'));
    history.append(node('p',`Revisão da operação: ${v.revision}. Revisão do rascunho: ${d.draftRevision}.`,{class:'hd-ops-muted'}),node('p','Você está vendo a revisão atual. O histórico completo ainda não está conectado a esta consulta.',{class:'hd-ops-muted'}));
    if(d.draftHash)history.append(node('p','Identificador do conteúdo conferido',{class:'hd-ops-muted'}),node('code',d.draftHash));content.append(history);
   }else content.append(node('p','Acompanhe o andamento pelo chamado. A análise não concede acesso nem confirma um cadastro no Novo GEO.',{class:'hd-ops-muted'}));
  }
  if(lastPhase==='loading'&&['loaded','error','expired'].includes(s.phase))ui.status.focus();lastPhase=s.phase;
 }
 const state=createRegistrationReviewState({...options,onChange:draw});
 ui.mount();draw(state.snapshot());
 return Object.freeze({state,destroy(){if(destroyed)return;destroyed=true;state.clear();clearOperationsNode(content);ui.destroy();}});
}
