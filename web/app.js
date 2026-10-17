import {isImplementationSupportStaff,mountImplementationSupport} from './implementation-support.js';
let implementationSupport=null,activeView='tickets';
import {ADVANCED_ACCESS} from './access-mode.js';
import {mountOperationalJourney} from './consultegeo-operation.js';
import {mountOperationalWorkflow} from './consultegeo-workflow.js';
import {mountOperationalReview} from './consultegeo-review.js';
import {mountEmailMonitor} from './email-monitor.js';
import {saoPauloFilterInstant} from './filter-instant.js';
const creationDate=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
let emailMonitor=null;
let cgOpening=null,cgWorkflow=null,cgReview=null;
// UX08: optional presentation. Failed/late assets never authorize or block Auth.
let accessUX=null,accessConfiguration=null;
import('./access-experience.js').then(({mountAccessExperience})=>{
 accessUX=mountAccessExperience(document,{simple:!ADVANCED_ACCESS});
 if(accessConfiguration!==null)accessUX.configuration(accessConfiguration);
 accessUX.phase(humanSession?.state().phase??'signed_out');
}).catch(()=>{/* The existing login/session controller remains authoritative. */});
// UX03: deferred presentation; a late asset never reorganizes a form being filled.
let openingUX=null;
import('./opening-wizard.js').then(({mountOpeningWizard})=>{
 const mount=()=>{openingUX=mountOpeningWizard(document);renderCatalog();};
 if($('create-dialog').open)$('create-dialog').addEventListener('close',mount,{once:true});
 else mount();
}).catch(()=>{/* Keep the existing single-page form when the optional asset is unavailable. */});
// UX02: optional presentation. Failure leaves the original UI and Auth available.
let inboxUX=null;
import('./inbox-workspace.js').then(({mountInboxWorkspace})=>{
 inboxUX=mountInboxWorkspace(document,{retryDetail:id=>run(()=>detail(id,{navigate:true}))});
 if(s.ticket){const op=inboxUX.beginDetail(s.ticket.id);inboxUX.finishDetail(op);}
 render();
}).catch(()=>{/* A missing presentation asset never enables a capability. */});
// Somente a opção de código permite reativar os fluxos avançados preservados.
for(const node of document.querySelectorAll('[data-advanced-access]')){node.hidden=!ADVANCED_ACCESS;node.inert=!ADVANCED_ACCESS;}
import {createRecoveryPanel,captureRecoveryNavigation} from './recovery-password.js';
import {captureSupportNavigation} from './support-navigation.js';
const supportNavigation=captureSupportNavigation(location,history);
const recoveryNavigationIntake=captureRecoveryNavigation(location,history);
const recoveryNavigationDiscarded=recoveryNavigationIntake.discarded;
import {loadTicketDetail,hasWriteActions,composerMode} from './ticket-actions.js';
import {renderTicketGuidance} from './ticket-guidance.js';
import {createMfaEnrollmentPanel,createSecurityStatusPanel} from './account-security.js';
import {createHumanAuthTransport,validatePasswordChange} from './human-auth.js';
import {createHumanSession} from './human-session.js';
import {createSessionFetch} from './session-fetch.js';
let humanSession=null,humanFetch=null,loginAttempt=0,lastHumanPhase='signed_out';
import {createTimelineState,eventPresentation} from './timeline-state.js';
const timeline=createTimelineState();
import {createTicketListState} from './ticket-list-state.js';
const inbox=createTicketListState();
import {mountTicketViews,applyTicketView} from './ticket-views.js';
const ticketViews=mountTicketViews(document,id=>run(()=>selectTicketView(id)));
import {createTicketSummaryState} from './ticket-summary-state.js';
const ticketSummary=createTicketSummaryState();
let summaryAbort=null;
import {createConversationState} from './conversation-state.js';
import {mountMessageSearch} from './message-search.js';
import {createMutationState} from './mutation-state.js';
import {createSupportCatalogState} from './support-catalog-state.js';
import {createTicketCreateState,retryCreateIntent,validateCreateInput} from './ticket-create-state.js';
const creation=createTicketCreateState();
const conversation=createConversationState(),mutations=createMutationState(),catalog=createSupportCatalogState();
const $=id=>document.getElementById(id);
const messageSearch=mountMessageSearch({root:$('message-search'),input:$('message-search-input'),status:$('message-search-status'),previous:$('message-search-previous'),next:$('message-search-next'),clear:$('message-search-clear'),container:$('messages')});
const s={token:'',workspace:'',me:null,tickets:[],ticket:null,actions:null,notesUnavailable:false,next:null,mode:'public',epoch:0,detail:0,demo:null,config:null,createKey:crypto.randomUUID(),createPending:null};
const labels={received:'Recebido',in_progress:'Em atendimento',waiting_for_you:'Aguardando você',resolved:'Resolvido',closed:'Encerrado',new:'Novo',triage:'Triagem',open:'Em atendimento',waiting_customer:'Aguardando cliente',waiting_internal:'Aguardando equipe',waiting_third_party:'Aguardando terceiro',cancelled:'Cancelado'};
const priorities={normal:'Normal',low:'Baixa',high:'Alta',urgent:'Urgente'};
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function notice(text,error=false){$('notification').textContent=text;$('notification').classList.toggle('error',error);$('notification').hidden=false;clearTimeout(notice.timer);notice.timer=setTimeout(()=>$('notification').hidden=true,error?10000:5000);}
function run(fn){return Promise.resolve().then(fn).catch(e=>{if(e.message!=='stale_session'&&e.code!=='stale_session')notice(e.message??'Operação não concluída.',true);});}
async function api(path,options={}){
 const epoch=s.epoch;
 try{
  const headers={'content-type':'application/json',...options.headers};
  const r=s.demo
   ?await fetch('/v1'+path,{...options,headers:{...headers,authorization:'Bearer '+s.token,'x-workspace-id':s.workspace},cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'})
   :humanFetch?await humanFetch(path,{...options,headers}):(()=>{throw Error('Autenticação indisponível.');})();
  if(epoch!==s.epoch)throw Error('stale_session');
  let b;try{b=r.status===204?null:await r.json();}catch{throw Error('Resposta inesperada do servidor.');}
  if(epoch!==s.epoch)throw Error('stale_session');
  if(!s.demo&&r.status===403&&b?.code==='mfa_required'&&humanSession){
   if(!humanFetch.currentResponse(r))throw Error('stale_session');
   const result=await leaveHumanSession();
   if(result!==undefined)$('login-status').textContent='Confirme a autenticação multifator ao entrar novamente.'+(result==='unconfirmed'?' Saída no provedor NÃO confirmada.':'');
   throw Error('stale_session');
  }
  if(!r.ok){const retry=r.status===429?r.headers.get('retry-after'):null;const error=Error((b?.detail??'Operação não concluída.')+(retry?' Aguarde '+retry+' segundos antes de reenviar.':''));error.status=r.status;error.code=b?.code;throw error;}
  return b;
 }catch(error){if(epoch!==s.epoch)throw Error('stale_session');throw error;}
}
const post=(path,body,key,headers={})=>api(path,{method:'POST',headers:{'idempotency-key':key,...headers},body:JSON.stringify(body)});
const date=v=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v));
const badge=status=>el('span','badge '+(status==='resolved'?'good':status==='waiting_for_you'?'wait':status==='in_progress'?'progress':''),labels[status]??status);
const product=(id,consultegeo=false)=>consultegeo?'Consulte GEO':s.demo?.contexts.find(c=>c.product_instance_id===id)?.label??'Produto integrado';
// Presentation only: this is an abbreviated UUID, never a business protocol.
const compactTicketId=id=>(id.length>18?id.slice(0,8)+'…'+id.slice(-6):id).toUpperCase();
function clearSession(){messageSearch.reset();renderTicketGuidance($('ticket-guidance'),null,null);emailMonitor?.destroy();emailMonitor=null;$('email-monitor-nav').hidden=true;$('email-view').hidden=true;implementationSupport?.destroy();implementationSupport=null;$('implementation-support-nav').hidden=true;$('implementation-support-view').hidden=true;activeView='tickets';$('tickets-view').hidden=false;$('guide-view').hidden=true;$('breadcrumb').textContent='Operação / Chamados';for(const button of document.querySelectorAll('[data-view]'))button.classList.toggle('active',button.dataset.view==='tickets');cgReview?.destroy();cgReview=null;$('cg-review').hidden=true;cgOpening?.destroy();cgOpening=null;cgWorkflow?.destroy();cgWorkflow=null;$('cg-create-dialog').close();$('cg-workflow').hidden=true;if(s.me)supportNavigation.clear();accessUX?.reset();inboxUX?.reset();openingUX?.reset();recoveryPanel.clear();$('add-mfa').hidden=true;$('add-mfa-login').hidden=true;$('configure-mfa').hidden=true;$('configure-mfa-login').hidden=true;securityPanel.clear();$('security-status').hidden=true;$('security-status-login').hidden=true;enrollmentPanel.clear();$('password-change-dialog').close();resetPasswordDialog();$('change-password').hidden=true;$('change-password-login').hidden=true;clearTimeout(notice.timer);$('notification').textContent='';$('notification').hidden=true;$('transition-reason').value='';for(const id of ['ticket-number','assignment-label','detail-action-status','notes-status'])$(id).replaceChildren();$('logout-all-dialog').close();$('logout-all').hidden=true;$('logout-all-login').hidden=true;$('workspace-change-dialog').close();$('switch-workspace').hidden=true;$('switch-workspace-login').hidden=true;$('workspace-choice-label').hidden=true;$('choose-workspace').hidden=true;$('workspace-choice').replaceChildren();s.actions=null;s.notesUnavailable=false;timeline.reset();$('history-section').open=false;renderTimeline();$('assignment-form').reset();$('assignment-status').textContent='';$('assignment-reload').hidden=true;$('assignment-form').hidden=true;$('priority-form').reset();$('priority-status').textContent='';$('priority-reload').hidden=true;inbox.reset();summaryAbort?.abort();summaryAbort=null;ticketSummary.reset();$('ticket-filters').reset();resetOpening(true);conversation.reset('');mutations.reset('');s.createKey=crypto.randomUUID();$('create-dialog').close();$('older-messages').hidden=true;$('older-notes').hidden=true;s.epoch++;s.detail++;s.token='';s.workspace='';s.me=null;$('identity-name').textContent='';$('workspace-label').textContent='Workspace autorizado';for(const id of ['stat-total','stat-open','stat-wait','stat-done','nav-count'])$(id).textContent='0';$('assignment-filter-label').hidden=true;$('internal-status-filter-label').hidden=true;s.ticket=null;s.tickets=[];s.next=null;for(const id of ['ticket-list','messages','notes','ticket-title','ticket-description','contract-info','ticket-tags'])$(id).replaceChildren();$('message-body').value='';$('ticket-detail').hidden=true;$('empty-detail').hidden=false;mode('public');renderTransitions();render();}
const serviceAvailable=()=>!!s.demo||s.config?.operational!==false;
function renderServiceAvailability(){
 const available=serviceAvailable();
 $('operational-status').hidden=available||!s.me;
 $('new-ticket').disabled=!available||!s.demo&&s.config?.consultegeo_intake===false;$('refresh').disabled=!available;
 $('empty-detail').querySelector('h2').textContent=available?'Todo atendimento começa com uma boa conversa.':'Chamados e conversas';
 $('empty-detail').querySelector('p').textContent=available?'Selecione um chamado para consultar o histórico ou abra uma nova solicitação.':'Quando a consulta estiver disponível, selecione um chamado para acompanhar suas mensagens e seu histórico.';
 for(const control of $('ticket-filters').querySelectorAll('input,select,button'))control.disabled=!available;
 if(!available){
  for(const id of ['stat-total','stat-open','stat-wait','stat-done','nav-count'])$(id).textContent='—';
  $('list-count').textContent='Consulta ainda não disponível';
  $('list-status').textContent='Seu acesso foi confirmado. A consulta de chamados será habilitada com o atendimento.';
 }
}
async function login(){
 s.me=await api('/me');renderWorkspaceChange();$('implementation-support-nav').hidden=!!s.demo||!isImplementationSupportStaff(s.me);
 const canMonitor=!s.demo&&s.config?.email_monitoring===true&&s.me.kind==='human'&&(s.me.workspace_role==='admin'||s.me.grants.some(g=>g.role==='agent'));
 $('email-monitor-nav').hidden=!canMonitor;
 if(canMonitor)emailMonitor=mountEmailMonitor($('email-monitor-root'),{admin:s.me.workspace_role==='admin',request:(path,init)=>api(path,init)});
 // The preserved advanced flow keeps its existing authentication-only screen.
 if(!serviceAvailable()&&ADVANCED_ACCESS){$('login-screen').hidden=false;$('app').hidden=true;$('login-status').textContent='Identidade e acesso ao workspace confirmados. O atendimento ainda não foi liberado.';return;}
 $('assignment-filter-label').hidden=!(s.me.kind==='human'&&(s.me.workspace_role==='admin'||s.me.grants.some(g=>g.role==='agent')));
 $('internal-status-filter-label').hidden=$('assignment-filter-label').hidden;
 $('identity-name').textContent=s.me.workspace_role==='admin'?'Administrador':s.me.grants.some(g=>g.role==='agent')?'Equipe de suporte':'Portal do cliente';
 $('workspace-label').textContent=s.demo?'Consulte · demonstração':ADVANCED_ACCESS?s.workspace:'Operação autorizada';
 $('login-status').textContent='';$('login-screen').hidden=true;$('app').hidden=false;
 render();if(serviceAvailable()){const linked=supportNavigation.takeTicket(),invitation=supportNavigation.takeApproval();await list(true,!linked&&!invitation);if(invitation){
  if(s.config?.consultegeo_review!==true){notice('A consulta deste convite ainda não está disponível.',true);return;}
  try{const landing=await api('/approval-invitations/'+invitation);if(landing?.workspaceId!==s.workspace||landing.invitationId!==invitation||typeof landing.ticketId!=='string'||!/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.test(landing.ticketId))throw Error('Convite indisponível.');await detail(landing.ticketId,{navigate:true});}
  catch{notice('O convite está indisponível para esta sessão ou revisão. Consulte os chamados autorizados.',true);}
 }else if(linked)await detail(linked,{navigate:true});}
 if(!s.demo&&serviceAvailable()&&isImplementationSupportStaff(s.me)&&new URLSearchParams(location.search).get('apoio')==='implantacao')navigateView('implementation-support');

}
async function profile(key){$('profile').value=key;const p=s.demo.profiles.find(p=>p.key===key);clearSession();s.token=p.token;s.workspace=p.workspace_id;await login();}
function syncInbox(){s.tickets=inbox.items();s.next=inbox.next();render();}
async function refreshSummary(){
 if(s.config?.ticket_totals!==true||!s.me||!serviceAvailable())return;
 summaryAbort?.abort();const controller=new AbortController();summaryAbort=controller;
 const op=ticketSummary.begin(inbox.filters()),timeout=setTimeout(()=>controller.abort(),15000);render();
 try{const body=await api(op.path,{signal:controller.signal});if(ticketSummary.accept(op,body))render();}
 catch{if(ticketSummary.fail(op))render();}
 finally{clearTimeout(timeout);if(summaryAbort===controller)summaryAbort=null;}
}
async function list(reset=true,selectFirst=false){
 if(!serviceAvailable()){render();return;}
 if(reset)inbox.restart();const op=inbox.begin();if(!op)return;
 const detailGeneration=s.detail;if(op.cursor===null)void refreshSummary();syncInbox();
 try{const b=await api(op.path);if(!inbox.accept(op,b))return;syncInbox();}
 catch(error){if(inbox.fail(op)){syncInbox();throw error;}return;}
 // Detail failures belong to the detail request, not a page whose state has already completed.
 if(selectFirst&&detailGeneration===s.detail&&!s.ticket&&s.tickets.length)await detail(s.tickets[0].id);
}
function render(){
 const items=s.tickets,phase=inbox.status();$('ticket-list').replaceChildren();
 for(const t of items){const n=el('button','ticket-card'+(s.ticket?.id===t.id?' selected':''));n.type='button';n.setAttribute('data-ticket-id',t.id);if(s.ticket?.id===t.id)n.setAttribute('aria-current','true');n.setAttribute('aria-label','Abrir chamado: '+t.subject);
  const top=el('div','card-top'),bottom=el('div','card-bottom');const identifier=el('span','',t.consultegeo?.protocol??compactTicketId(t.id));identifier.title=t.id;
  n.setAttribute('aria-label','Abrir chamado: '+t.subject+' · identificador '+t.id);
  top.append(identifier,el('span','',date(t.created_at)));
  if(t.assignment)bottom.append(el('span','badge',t.assignment.state==='mine'?'Sob minha responsabilidade':t.assignment.state==='other'?'Com outro atendente':'Sem responsável'));
  bottom.append(badge(t.status),el('span','badge',priorities[t.priority]),el('span','card-product',product(t.product_instance_id,!!t.consultegeo)));
  n.append(top,el('h3','',t.subject),el('p','',t.description),bottom);n.onclick=()=>run(()=>detail(t.id,{navigate:true}));$('ticket-list').append(n);
 }
 if(!items.length)$('ticket-list').append(el('p','list-empty',!serviceAvailable()?'Os chamados serão exibidos aqui quando a consulta estiver disponível.':phase==='loading'?'Consultando chamados autorizados…':phase==='error'?'Não foi possível carregar os chamados. Tente novamente.':phase==='idle'?'Aplique a consulta para carregar chamados.':'Nenhum chamado encontrado para os filtros aplicados e suas permissões.'));
 const totalsEnabled=s.config?.ticket_totals===true,summary=ticketSummary.value(),summaryPhase=ticketSummary.status();
 const values=totalsEnabled?(summary?[summary.total,summary.statuses.received+summary.statuses.in_progress,summary.statuses.waiting_for_you,summary.statuses.resolved]:['—','—','—','—']):[items.length,items.filter(t=>['received','in_progress'].includes(t.status)).length,items.filter(t=>t.status==='waiting_for_you').length,items.filter(t=>t.status==='resolved').length];
 ['total','open','wait','done'].forEach((key,i)=>{$('stat-'+key).textContent=String(values[i]);$('stat-'+key+'-caption').textContent=totalsEnabled?'Da consulta autorizada completa':key==='total'?'Da consulta aplicada':'Entre os itens carregados';});
 $('stat-total-label').textContent=totalsEnabled?'Chamados da consulta':'Chamados carregados';
 $('summary-feedback').hidden=!totalsEnabled||!s.me;$('summary-retry').hidden=summaryPhase!=='error';$('summary-retry').disabled=summaryPhase==='loading';
 $('summary-status').textContent=summaryPhase==='loading'?'Consultando totais autorizados…':summaryPhase==='error'?'Totais indisponíveis. A lista continua disponível; tente novamente.':summary?'Totais consultados em '+date(summary.as_of)+'. A lista é carregada separadamente.':'';
 $('nav-count').textContent=items.length;$('list-count').textContent=items.length+' carregado(s)'+(s.next?' · há mais resultados':'');
 $('more').hidden=!s.next||inbox.capped()||phase==='error';$('more').disabled=inbox.busy();$('list-retry').hidden=phase!=='error';
 $('ticket-list').setAttribute('aria-busy',String(inbox.busy()));
 const applied=inbox.filters(),names=[];$('list-order').textContent=applied.sort==='oldest'?'Mais antigos primeiro':'Mais recentes primeiro';if(applied.sort)names.push('Criação: mais antigos primeiro');if(applied.q)names.push(applied.search_in==='description'?'Busca na descrição':'Busca por assunto/protocolo/UUID');if(applied.status)names.push(labels[applied.status]);if(applied.internal_status)names.push('Situação interna: '+labels[applied.internal_status]);if(applied.priority)names.push('Prioridade '+priorities[applied.priority]);if(applied.assignment)names.push(applied.assignment==='mine'?'Meus atendimentos':'Sem responsável');
 if(applied.created_from)names.push('Criados a partir de '+creationDate.format(new Date(applied.created_from))+' (Brasília)');if(applied.created_before)names.push('Criados antes de '+creationDate.format(new Date(applied.created_before))+' (Brasília)');
 if(applied.updated_from)names.push('Atualizados a partir de '+creationDate.format(new Date(applied.updated_from))+' (Brasília)');if(applied.updated_before)names.push('Atualizados antes de '+creationDate.format(new Date(applied.updated_before))+' (Brasília)');
 $('applied-filters').textContent='Filtros aplicados: '+(names.join(' · ')||'nenhum')+(totalsEnabled?'. Cartões referem-se à consulta autorizada completa.':'. Contagens referem-se somente aos itens carregados.');
 $('list-status').textContent=inbox.capped()?'Limite de 500 itens na tela. Refine a busca ou os filtros para continuar.':phase==='error'?'A consulta falhou; os itens abaixo já haviam sido carregados. Tente novamente.':phase==='loading'?'Consultando…':'';
 renderServiceAvailability();
 ticketViews.update(s.me,inbox.filters(),inbox.busy(),serviceAvailable());
 inboxUX?.setFilters(inbox.filters(),inbox.busy());inboxUX?.setAvailability(!!s.me,serviceAvailable());
}
function collectTicketFilters(){
 const filters={},q=$('search').value.trim(),status=$('status-filter').value,priority=$('priority-filter').value,assignment=$('assignment-filter').value;
 clearPeriodValidity();
 if($('sort-filter').value)filters.sort=$('sort-filter').value;
 for(const [key,id]of [['created_from','created-from'],['created_before','created-before'],['updated_from','updated-from'],['updated_before','updated-before']]){
  const input=$(id);try{if(input.value)filters[key]=saoPauloFilterInstant(input.value);}catch{input.setCustomValidity('Confira o horário de Brasília. Horários inexistentes ou ambíguos não são aceitos.');input.reportValidity();throw Error('Confira o período informado.');}
 }
 for(const [from,before,id]of [['created_from','created_before','created-before'],['updated_from','updated_before','updated-before']])if(filters[from]&&filters[before]&&filters[from]>=filters[before]){$(id).setCustomValidity('Informe um fim posterior ao início.');$(id).reportValidity();throw Error('O início do período deve ser anterior ao fim.');}
 if(!$('internal-status-filter-label').hidden&&$('internal-status-filter').value)filters.internal_status=$('internal-status-filter').value;if(q)filters.q=q;if($('search-in').value)filters.search_in=$('search-in').value;if(status)filters.status=status;if(priority)filters.priority=priority;if(assignment)filters.assignment=assignment;return filters;
}
function selectTicketView(id){
 if(inbox.busy()||!s.me||!serviceAvailable())return;
 void run(async()=>{
 const next=applyTicketView(collectTicketFilters(),id,s.me);
 $('internal-status-filter').value=next.internal_status??'';$('status-filter').value=next.status??'';$('assignment-filter').value=next.assignment??'';
 $('ticket-filters').dispatchEvent(new Event('change',{bubbles:true}));
 $('ticket-filters').requestSubmit();
 });
}
function clearPeriodValidity(){for(const id of ['created-from','created-before','updated-from','updated-before'])$(id).setCustomValidity('');}
for(const id of ['created-from','created-before','updated-from','updated-before'])$(id).addEventListener('input',clearPeriodValidity);
function applyFilters(){
 const filters=collectTicketFilters();
 inbox.reset(filters);return list(false);
}
function renderSearchMode(){
 const description=$('search-in').value==='description';$('search').required=description;
 $('search-help').textContent=description?'Busca literal na descrição de todos os chamados autorizados, antes da paginação. Acentos são significativos. Notas e mensagens não são pesquisadas.':'Busca literal pelo assunto, protocolo CG completo (ex. CG-10001) ou UUID completo. Acentos são significativos no assunto. Para pesquisar a descrição, selecione essa opção acima. Notas e mensagens não são pesquisadas.';
}
$('search-in').addEventListener('change',renderSearchMode);
$('ticket-filters').addEventListener('reset',()=>queueMicrotask(()=>{renderSearchMode();clearPeriodValidity();}));
$('ticket-filters').onsubmit=e=>{e.preventDefault();run(applyFilters);};
$('clear-filters').onclick=()=>{ $('ticket-filters').reset();run(applyFilters); };
$('list-retry').onclick=()=>run(()=>list(false));
$('summary-retry').onclick=()=>void refreshSummary();
function renderConversation(){
 for(const kind of ['messages','notes']){
  $(kind).replaceChildren();const items=conversation.items(kind);
  for(const m of items){const n=el('article','message'+(kind==='notes'?' internal':''));
   if(kind==='messages'){n.dataset.messageId=m.id;n.tabIndex=-1;}
   n.append(el('small','',(kind==='notes'?'NOTA INTERNA':m.actor_type==='human_agent'?'Equipe de suporte':'Solicitante')+' · '+date(m.created_at)),el('p','',m.body));$(kind).append(n);
  }
  if(kind==='messages'&&!items.length)$(kind).append(el('p','fine','Ainda não há respostas nesta conversa.'));
  $('older-'+kind).hidden=!conversation.next(kind);
 }
 messageSearch.update(s.me&&s.ticket&&s.actions?JSON.stringify([s.epoch,s.workspace,s.me.id,s.ticket.id]):'',conversation.items('messages'),!!conversation.next('messages'));
}
function discardRefusedDetail(){
 // Invalidate any detail read started before this authoritative refusal.
 ++s.detail;
 messageSearch.reset();renderTicketGuidance($('ticket-guidance'),null,null);
 cgWorkflow?.destroy();cgWorkflow=null;$('cg-workflow').hidden=true;cgReview?.destroy();cgReview=null;$('cg-review').hidden=true;
 s.actions=null;s.notesUnavailable=false;conversation.reset('');timeline.reset();renderConversation();renderTimeline();
 $('ticket-detail').hidden=true;$('empty-detail').hidden=false;
   // Hiding a refused projection is not cleanup. Do not retain the prior detail
   // or its operational drafts in hidden DOM. Transient failures retain drafts.
   s.ticket=null;mutations.reset('');$('message-body').value='';$('transition-reason').value='';
   $('assignment-form').reset();$('priority-form').reset();
   for(const field of ['ticket-number','ticket-title','ticket-description','ticket-tags','contract-info','assignment-label','assignment-status','priority-status','detail-action-status','notes-status'])$(field).replaceChildren();
   $('assignment-reload').hidden=true;$('priority-reload').hidden=true;$('notes-retry').hidden=true;
   $('notes-section').open=false;$('history-section').open=false;
   // Discard the old list snapshot as well; explicit refresh revalidates its rows.
   inbox.reset(inbox.filters());syncInbox();
 renderComposer();renderAssignment();renderPriority();renderTransitions();
}
async function older(kind){
 const cursor=conversation.next(kind),id=s.ticket?.id,seq=s.detail,generation=conversation.generation();
 if(!cursor||!id||(kind==='notes'&&!s.actions?.read_notes))return;
 const button=$('older-'+kind);button.disabled=true;
 try{const page=await api('/tickets/'+id+'/'+kind+'?limit=50&cursor='+encodeURIComponent(cursor));
  if(seq===s.detail&&id===s.ticket?.id&&conversation.accept(generation,kind,page))renderConversation();
 }catch(error){
  // A refusal of an old page must never erase another ticket or a newer read.
  if(seq!==s.detail||id!==s.ticket?.id||generation!==conversation.generation())return;
  if(kind==='messages'&&[401,403,404].includes(error.status)){
   discardRefusedDetail();inboxUX?.failDetail(inboxUX.beginDetail(id,false),error.status);
  }
  throw error;
 }finally{button.disabled=false;}
}
async function detail(id,{navigate=false}={}){
 if((cgWorkflow?.blocked()||cgReview?.blocked())){if(navigate&&id===s.ticket?.id){const retained=inboxUX?.beginDetail(id,true);if(retained)inboxUX.finishDetail(retained);notice('O atendimento anterior ainda aguarda confirmação. Concilie a mesma intenção.');return;}notice('Concilie o atendimento ou a marcação atual antes de atualizar ou trocar o chamado.',true);return;}
 // Navigation never discards a request still in flight or an unresolved creation.
 if(navigate&&id!==s.ticket?.id&&workspaceChangeBlocked()){notice('Conclua ou recupere o envio atual antes de abrir um chamado. Voltar à lista não cancela o envio.',true);return;}
 cgWorkflow?.destroy();cgWorkflow=null;$('cg-workflow').hidden=true;cgReview?.destroy();cgReview=null;$('cg-review').hidden=true;
 const uxRead=inboxUX?.beginDetail(id,navigate);
 messageSearch.reset();
 // Lock controls while the current GET and required conversation are being refreshed.
 s.actions=null;s.notesUnavailable=false;renderTicketGuidance($('ticket-guidance'),null,null);
 timeline.reset();renderTimeline();$('notes-section').hidden=true;$('note-tab').hidden=true;
 if(s.ticket?.id!==id){
  $('history-section').open=false;$('assignment-form').reset();$('assignment-status').textContent='';$('assignment-reload').hidden=true;
  $('priority-form').reset();$('priority-status').textContent='';$('priority-reload').hidden=true;
  s.ticket=null;mutations.reset('');$('message-body').value='';$('transition-reason').value='';mode('public');
  $('ticket-detail').hidden=true;$('empty-detail').hidden=false;
 }
 renderComposer();renderAssignment();renderPriority();renderTransitions();
 $('detail-action-status').textContent='Atualizando as ações disponíveis para este chamado…';
 const seq=++s.detail,epoch=s.epoch,current=()=>seq===s.detail&&epoch===s.epoch;
 try{
  const loaded=await loadTicketDetail(id,api,current);if(!loaded||!current())return;
  const {ticket:t,actions,messages,notes,notesUnavailable}=loaded;
  mutations.select(JSON.stringify([s.epoch,s.workspace,s.me.id,t.id]));
  s.ticket=t;s.actions=actions;s.notesUnavailable=notesUnavailable;
  const generation=conversation.reset(JSON.stringify([s.workspace,s.me.id,t.id]));
  conversation.accept(generation,'messages',messages);conversation.accept(generation,'notes',notes);
  $('empty-detail').hidden=true;$('ticket-detail').hidden=false;
  $('ticket-number').textContent=(t.consultegeo?.protocol??'CHAMADO '+compactTicketId(t.id))+' · VERSÃO '+t.version;
  $('ticket-title').textContent=t.subject;$('ticket-description').textContent=t.description;$('ticket-operation-help').textContent=t.consultegeo?'O atendimento e as respostas públicas ficam registrados neste chamado. Notas internas são restritas à equipe.':'Anexos, relógios de SLA e envio de notificações não estão habilitados nesta versão.';
  $('ticket-tags').replaceChildren(badge(t.status),el('span','badge',priorities[t.priority]),el('span','badge',product(t.product_instance_id,!!t.consultegeo)));
  $('contract-info').textContent='Versão '+t.contract_version_id.slice(0,12)+' · cobertura '+t.coverage_id.slice(0,12);
  renderConversation();$('notes-section').hidden=!actions.read_notes&&!notesUnavailable;
  $('notes-status').textContent=notesUnavailable?'Notas indisponíveis nesta consulta. O conteúdo anterior foi removido; a conversa pública continua disponível.':'';
  $('notes-retry').hidden=!notesUnavailable;if(notesUnavailable)$('notes-section').open=true;
  $('detail-action-status').textContent=hasWriteActions(actions)?'Ações verificadas pelo servidor para esta versão. Cada envio revalida suas permissões.':'Modo de consulta: seu acesso atual não permite alterações neste chamado.';
  mode(s.mode);renderTransitions();renderAssignment();renderPriority();renderTicketGuidance($('ticket-guidance'),t,actions);
  if(!s.demo&&t.consultegeo?.workflow===true){$('cg-workflow').hidden=false;const epoch=s.epoch;cgWorkflow=mountOperationalWorkflow($('cg-workflow'),{identity:{workspaceId:s.workspace,principalId:s.me.id},ticket:t,request:operationalRequest(),canWriteWorkflow:actions.reply||actions.transitions.length>0,canWriteChecklist:t.internal_status!==undefined&&actions.add_note&&s.me.scopes.includes('tickets:write'),onChange:()=>renderComposer(),onRefresh:()=>run(()=>detail(t.id)),onConfirmed:()=>run(async()=>{if(epoch!==s.epoch)return;await detail(t.id);if(epoch===s.epoch)await list();})});}
  if(!s.demo&&s.config?.consultegeo_review===true&&t.consultegeo?.workflow===true){$('cg-review').hidden=false;const epoch=s.epoch;cgReview=mountOperationalReview($('cg-review'),{identity:{workspaceId:s.workspace,principalId:s.me.id},ticket:t,origin:location.origin,request:operationalRequest(),canReadAttention:s.me.workspace_role==='admin',onChange:()=>renderComposer(),onRefresh:()=>run(()=>detail(t.id)),onConfirmed:()=>run(async()=>{if(epoch!==s.epoch)return;await detail(t.id);if(epoch===s.epoch)await list();})});void cgReview.load();}
  timeline.reset(JSON.stringify([s.epoch,s.workspace,s.me.id,t.id]),t.internal_status!==undefined);renderTimeline();
  if(current())inboxUX?.finishDetail(uxRead??inboxUX.beginDetail(id,navigate));
  if($('history-section').open)await loadTimeline();if(current())render();
 }catch(error){
  if(!current())return;
  s.actions=null;conversation.reset('');timeline.reset();renderConversation();renderTimeline();
  $('ticket-detail').hidden=true;$('empty-detail').hidden=false;
  if([401,403,404].includes(error.status)){
   discardRefusedDetail();
  }
  renderComposer();renderAssignment();renderPriority();renderTransitions();
  inboxUX?.failDetail(uxRead??inboxUX.beginDetail(id,navigate),error.status);
  throw error;
 }
}

function renderTransitions(){renderReviewLocks();
 const moves=s.actions?.transitions??[],selected=$('next-status').value;
 $('transition-area').hidden=!!s.ticket?.consultegeo||!moves.length;
 $('next-status').replaceChildren(...moves.map(v=>option(v.to,labels[v.to])));
 if(moves.some(v=>v.to===selected))$('next-status').value=selected;
 updateTransitionReason();
}
function updateTransitionReason(){
 const move=s.actions?.transitions.find(v=>v.to===$('next-status').value);
 $('transition-reason').required=!!move?.requires_reason;
 $('transition-reason').setAttribute('aria-required',String(!!move?.requires_reason));
 $('transition-reason').placeholder=move?.requires_reason?'Informe por que o chamado deve ser reaberto':'Motivo opcional';
 $('transition').disabled=!move||mutations.busy('transition');
}
$('next-status').onchange=updateTransitionReason;
$('notes-retry').onclick=()=>run(async()=>{const id=s.ticket?.id;if(id)await detail(id);});

function renderTimeline(){
 const phase=timeline.status(),rows=timeline.items();$('history-list').replaceChildren();
 for(const item of rows){const view=eventPresentation(item,!!s.actions&&s.ticket?.internal_status!==undefined);const node=el('li','history-event'+(view.internal?' internal':''));node.append(el('small','',date(item.created_at)),el('h4','',view.title),el('p','',view.description));if(view.internal)node.append(el('span','badge','Restrito à equipe'));$('history-list').append(node);}
 $('history-status').textContent=phase==='loading'?'Consultando o histórico…':phase==='error'?'Não foi possível carregar o histórico. Eventos já carregados foram preservados.':phase==='capped'?'Limite de 500 eventos nesta tela. A lista não representa o total do histórico.':phase==='ready'?(rows.length?rows.length+' evento(s) carregado(s).':'Nenhum evento autorizado disponível.'):'Abra esta seção para consultar o histórico.';
 $('history-more').hidden=!timeline.next()||phase==='capped'||phase==='error';$('history-more').disabled=phase==='loading';$('history-retry').hidden=phase!=='error';$('history-refresh').disabled=phase==='loading'||!s.ticket||!s.actions;
}
async function loadTimeline(){
 const id=s.ticket?.id,op=s.actions?timeline.begin():null;if(!id||!op)return;renderTimeline();
 try{const page=await api('/tickets/'+id+'/timeline?limit=50'+(op.cursor?'&cursor='+encodeURIComponent(op.cursor):''));if(timeline.accept(op,page))renderTimeline();}
 catch(error){if(timeline.fail(op))renderTimeline();}
}
$('history-section').ontoggle=()=>{if($('history-section').open&&timeline.status()==='idle')run(loadTimeline);};
$('history-more').onclick=()=>run(loadTimeline);$('history-retry').onclick=()=>run(loadTimeline);
$('history-refresh').onclick=()=>run(async()=>{if(!s.ticket||!s.actions)return;timeline.reset(JSON.stringify([s.epoch,s.workspace,s.me.id,s.ticket.id]),s.ticket.internal_status!==undefined);await loadTimeline();});
function renderAssignment(){renderReviewLocks();
 const t=s.ticket,a=t?.assignment,visible=t&&!t.consultegeo&&s.actions&&a;
 $('assignment-form').hidden=!visible;if(!visible)return;
 $('assignment-label').textContent=a.state==='mine'?'Responsável: você.':a.state==='other'?'Responsável: outro atendente. Em chamados não encerrados, um administrador pode liberar para nova atribuição.':'Este chamado está sem responsável.';
 const busy=mutations.busy('assignment'),draft=mutations.draft('assignment');
 if(draft){try{$('assignment-reason').value=JSON.parse(draft).reason;}catch{$('assignment-status').textContent='Rascunho inválido. Reabra o chamado.';}}
 else $('assignment-reason').value='';
 $('claim-ticket').disabled=busy||!s.actions?.claim;$('release-ticket').disabled=busy||!s.actions?.release;$('assignment-reload').disabled=busy;
 $('assignment-reason').disabled=mutations.unresolved('assignment');
}
function editAssignment(action,rebase=false){
 if(!s.ticket)return;let previous=null;try{previous=JSON.parse(mutations.draft('assignment'));}catch{}
 const selected=action??previous?.action??(s.ticket.assignment?.state==='mine'?'release':'claim');
 const reason=$('assignment-reason').value;
 // Keep an uncertain request byte-for-byte until its content changes or the user explicitly reloads.
 const version=!rebase&&previous?.action===selected&&previous?.reason===reason?previous.version:s.ticket.version;
 mutations.edit('assignment',JSON.stringify({action:selected,reason,version}));
}
$('assignment-reason').oninput=()=>editAssignment();
$('assignment-form').onsubmit=e=>{e.preventDefault();const action=e.submitter?.value;if(!['claim','release'].includes(action))return;run(async()=>{
 const t=s.ticket;if(cgReview?.blocked()||!t||!(action==='claim'?s.actions?.claim:s.actions?.release))return;editAssignment(action);const op=mutations.begin('assignment');if(!op)return;
 const d=JSON.parse(op.body);$('assignment-status').textContent='Confirmando responsabilidade com a versão '+d.version+'…';$('assignment-reload').hidden=true;renderAssignment();
 try{
  await post('/tickets/'+t.id+'/assignments',{action:d.action,reason:d.reason.trim()},op.key,{'if-match':'"'+d.version+'"'});
  if(!mutations.finish(op,true).current)return;
  $('assignment-status').textContent=d.action==='claim'?'Atendimento assumido. Registro somente no histórico interno.':'Atendimento liberado. Nenhuma permissão de acesso foi modificada.';
  await detail(t.id);if(mutations.current(op))await list();
 }catch(error){
  if(mutations.finish(op,false,outcomeUnknown(error)).current||mutations.current(op)){
   const conflict=error.status===412||error.code==='assignment_conflict'||error.code==='assignment_release_forbidden';
   $('assignment-status').textContent=error.requestSent===false?'Alteração não enviada: renove a sessão e confirme novamente. O motivo foi preservado.':conflict?'Responsabilidade ou versão alterada. Atualize o chamado e revise antes de confirmar novamente.':(error.status===503||!Number.isInteger(error.status))?'Resultado ainda não confirmado. Não crie outra operação: repita sem alterar os campos ou atualize o chamado para verificar.':error.message;
   $('assignment-reload').hidden=!conflict;
  }
 }finally{renderAssignment();}
});};
$('assignment-reload').onclick=()=>run(async()=>{
 const id=s.ticket?.id,epoch=s.epoch;if(!id||mutations.busy('assignment'))return;
 await detail(id);if(s.ticket?.id===id&&epoch===s.epoch){editAssignment(undefined,true);$('assignment-reload').hidden=true;$('assignment-status').textContent='Versão atualizada. Motivo preservado; revise a responsabilidade antes de confirmar.';renderAssignment();}
});

function renderPriority(){renderReviewLocks();
 const t=s.ticket,allowed=t&&!t.consultegeo&&s.actions?.change_priority;
 $('priority-form').hidden=!allowed;if(!allowed)return;
 const draft=mutations.draft('priority');
 if(draft){try{const d=JSON.parse(draft);$('ticket-priority').value=d.priority;$('priority-reason').value=d.reason;}catch{$('priority-status').textContent='Rascunho de prioridade inválido. Reabra o chamado.';}}
 else{$('ticket-priority').value=t.priority;$('priority-reason').value='';}
 $('save-priority').disabled=mutations.busy('priority');
 $('ticket-priority').disabled=$('priority-reason').disabled=mutations.unresolved('priority');
}
function editPriority(){if(!s.ticket)return;mutations.edit('priority',JSON.stringify({priority:$('ticket-priority').value,reason:$('priority-reason').value,version:s.ticket.version}));}
$('ticket-priority').onchange=editPriority;$('priority-reason').oninput=editPriority;
$('priority-form').onsubmit=e=>{e.preventDefault();run(async()=>{
 const t=s.ticket;if(cgReview?.blocked()||!t||!s.actions?.change_priority)return;editPriority();const op=mutations.begin('priority');if(!op)return;
 const draft=JSON.parse(op.body);$('priority-status').textContent='Salvando com a versão '+draft.version+'…';$('priority-reload').hidden=true;renderPriority();
 try{
  await api('/tickets/'+t.id,{method:'PATCH',headers:{'idempotency-key':op.key,'if-match':'"'+draft.version+'"'},body:JSON.stringify({priority:draft.priority,reason:draft.reason})});
  if(!mutations.finish(op,true).current)return;
  $('priority-status').textContent=draft.priority===t.priority?'A prioridade já era a selecionada. Nenhuma alteração foi registrada.':'Prioridade salva. Motivo registrado somente no histórico interno.';
  await detail(t.id);if(mutations.current(op))await list();
 }catch(error){
  if(mutations.finish(op,false,outcomeUnknown(error)).current||mutations.current(op)){
   $('priority-status').textContent=error.requestSent===false?'Alteração não enviada: renove a sessão e confirme novamente. O motivo foi preservado.':error.status===412?'Outro atendimento modificou este chamado. Atualize a versão, revise a prioridade e confirme novamente.':(error.status===503||!Number.isInteger(error.status))?'Não foi possível confirmar a gravação. Repita sem alterar os campos para reutilizar a mesma chave ou atualize o chamado antes de decidir.':error.message;
   $('priority-reload').hidden=error.status!==412;
  }
 }finally{renderPriority();}
});};
$('priority-reload').onclick=()=>run(async()=>{const id=s.ticket?.id,epoch=s.epoch;if(!id)return;await detail(id);if(s.ticket?.id===id&&s.epoch===epoch){$('priority-reload').hidden=true;$('priority-status').textContent='Versão atualizada. Revise a prioridade e o motivo antes de confirmar novamente.';}});

$('older-messages').onclick=()=>run(()=>older('messages'));
$('older-notes').onclick=()=>run(()=>older('notes'));
function option(value,label){const n=el('option','',label);n.value=value;return n;}
function renderComposer(){renderReviewLocks();
 const a=s.actions,publicAllowed=!s.ticket?.consultegeo&&!!a?.reply,internalAllowed=!!a?.add_note;
 s.mode=s.ticket?.consultegeo&&internalAllowed?'internal':composerMode(s.mode,a);
 $('public-tab').hidden=!publicAllowed;$('note-tab').hidden=!internalAllowed;
 $('message-form').hidden=!publicAllowed&&!internalAllowed;
 $('message-body').value=mutations.draft(s.mode);
 const enabled=s.mode==='internal'?internalAllowed:publicAllowed;
 $('message-body').disabled=(cgWorkflow?.blocked()||cgReview?.blocked())===true||!enabled||mutations.unresolved(s.mode);
 $('send-message').disabled=(cgWorkflow?.blocked()||cgReview?.blocked())===true||!enabled||mutations.busy(s.mode)||!s.ticket;
 $('transition').disabled=mutations.busy('transition')||!s.ticket||!a?.transitions.length;
 $('next-status').disabled=$('transition-reason').disabled=mutations.unresolved('transition');
 $('message-form').classList.toggle('internal',s.mode==='internal');
 for(const b of document.querySelectorAll('[data-mode]'))b.classList.toggle('selected',b.dataset.mode===s.mode);
 $('composer-label').textContent=s.mode==='internal'?'Escreva uma nota interna':'Escreva uma resposta pública';
 $('message-body').placeholder=s.mode==='internal'?'Escreva uma nota interna para a equipe…':'Escreva uma resposta para esta conversa…';
 $('visibility-help').textContent=s.mode==='internal'?'Restrita à equipe. Não é enviada ao cliente.':'Visível para o cliente e para a equipe.';
 $('send-message').textContent=mutations.unresolved(s.mode)?'Conciliar envio anterior':s.mode==='internal'?'Salvar nota interna':'Enviar resposta';
}
function mode(value){s.mode=value;renderComposer();}

const contextKey=v=>JSON.stringify([v.account_id,v.product_instance_id,v.service_code]);
const environmentLabels={production:'Produção',staging:'Homologação',development:'Desenvolvimento'};
function createIdentity(){return s.me?{workspace:s.workspace,principal:s.me.id,session:s.epoch}:null;}
function unresolvedCreate(){const intent=creation.intent();return !!intent&&intent.status!=='confirmed';}
function resetOpening(clearIntent=false){
 if(clearIntent)creation.reset(null);
 if(unresolvedCreate()){renderCatalog();return;}
 creation.reset(createIdentity());catalog.reset();s.createPending=null;s.createKey=crypto.randomUUID();$('create-form').reset();$('context-choice').replaceChildren(option('','Selecione uma opção'));$('coverage-choice').replaceChildren();$('coverage-label').hidden=true;renderCatalog();
}
function renderCatalog(){
 const status=catalog.status(),choices=catalog.choices(),selected=catalog.selectedKey();
 $('context-choice').replaceChildren(option('',status==='loading'&&!choices.length?'Carregando opções autorizadas…':'Selecione uma opção'),...choices.map(c=>option(contextKey(c),c.account_name+' · '+c.product_name+' ('+environmentLabels[c.environment]+') · '+c.service_name)));
 const locked=unresolvedCreate()||!!s.createPending;
 $('context-choice').value=selected;$('context-choice').disabled=locked||status==='loading'||status==='error'||!choices.length;
 for(const id of ['subject','description','priority','coverage-choice'])$(id).disabled=locked;
 $('context-more').hidden=!catalog.next()||status==='error';$('context-more').disabled=status==='loading'||!!s.createPending;
 $('context-retry').hidden=status!=='error';$('context-retry').disabled=!!s.createPending;
 $('context-status').textContent=status==='loading'?'Consultando as opções autorizadas…':status==='error'?'Não foi possível carregar as opções. Tente novamente. As opções são obtidas exclusivamente pela API.':status==='empty'?'Nenhuma opção com cobertura vigente está disponível para este perfil. Solicite à equipe de suporte a revisão dos vínculos e contratos.':status==='ready'?choices.length+' opção(ões) carregada(s). '+(catalog.next()?'Há mais opções disponíveis. ':choices.length===1?'A única opção disponível foi selecionada. ':'Escolha explicitamente a conta e o sistema. ')+'O contrato será revalidado antes de salvar.':'Abra o formulário para consultar as opções disponíveis.';
 $('submit-create').disabled=(!unresolvedCreate()&&!catalog.canSubmit())||!!s.createPending;
 $('submit-create').textContent=unresolvedCreate()?'Recuperar abertura':'Validar e abrir chamado';
 $('create-help').textContent=unresolvedCreate()?'A confirmação desta abertura está pendente. Recupere o pedido original antes de iniciar outro. Fechar o formulário preserva o pedido nesta sessão.':'Sem cobertura contratual vigente, a abertura é bloqueada. Triagem sem contrato está prevista para outra entrega.';
 openingUX?.update({status,canSubmit:catalog.canSubmit(),pending:!!s.createPending,unresolved:unresolvedCreate(),ambiguous:!$('coverage-label').hidden});
}
async function loadCatalog(){
 const op=catalog.begin();if(!op)return;renderCatalog();
 try{const page=await api('/support-contexts?limit=50'+(op.cursor?'&cursor='+encodeURIComponent(op.cursor):''));if(!catalog.current(op))return;catalog.accept(op,page);renderCatalog();}
 catch(error){if(catalog.fail(op))renderCatalog();}
}
function operationalRequest(){const epoch=s.epoch,transport=humanFetch;return async(path,init={})=>{if(epoch!==s.epoch||!s.me||s.demo||!transport||transport!==humanFetch)throw Error('stale_session');const response=await transport(path,init);if(epoch!==s.epoch||transport!==humanFetch||!transport.currentResponse(response))throw Error('stale_session');return response;};}
async function startOperationalCreate(){
 if(workspaceChangeBlocked()){notice('Conclua ou concilie o envio atual antes de abrir outro chamado.',true);return;}
 if(cgOpening?.state().phase==='confirmed'){cgOpening.destroy();cgOpening=null;}
 $('cg-create-dialog').showModal();
 if(cgOpening)return;const epoch=s.epoch;cgOpening=mountOperationalJourney($('cg-create-root'),{identity:{workspaceId:s.workspace,principalId:s.me.id},request:operationalRequest(),onReceipt:receipt=>run(async()=>{if(epoch!==s.epoch)return;$('cg-create-dialog').close();await list();if(epoch===s.epoch)await detail(receipt.ticketId,{navigate:true});if(epoch===s.epoch)notice('Chamado '+receipt.protocol+' registrado. A notificação está na fila de email.');})});
 await cgOpening.load();
}
$('cg-close-create').onclick=()=>{if(cgOpening?.blocked()){notice('Concilie a mesma intenção antes de fechar o formulário.',true);return;}$('cg-create-dialog').close();};
$('cg-create-dialog').addEventListener('cancel',e=>{if(cgOpening?.blocked()){e.preventDefault();notice('Concilie a mesma intenção antes de fechar o formulário.',true);}});
async function startCreate(){
 if(!s.demo&&s.config?.consultegeo_intake===false){notice('A abertura de chamados ainda não está disponível.',true);return;}
 if(!s.demo&&s.config?.consultegeo_intake===true)return startOperationalCreate();
 if(ticketMutationBlocked()){notice('Conclua ou recupere o envio atual antes de abrir outro chamado.',true);return;}resetOpening();$('create-dialog').showModal();openingUX?.open();if(unresolvedCreate()){$('submit-create').focus();return;}creation.reset(createIdentity());$('subject').focus();await loadCatalog();}
$('context-choice').onchange=()=>{catalog.select($('context-choice').value);s.createKey=crypto.randomUUID();$('coverage-label').hidden=true;renderCatalog();};
$('context-more').onclick=()=>run(loadCatalog);$('context-retry').onclick=()=>run(loadCatalog);
$('create-form').addEventListener('input',e=>{s.createKey=crypto.randomUUID();if(e.target.id!=='coverage-choice')$('coverage-label').hidden=true;});
$('create-form').onsubmit=e=>{e.preventDefault();run(async()=>{
 const choice=catalog.selection();if(s.createPending||!unresolvedCreate()&&(!catalog.canSubmit()||!choice))return;
 const pending=Object.freeze({key:s.createKey,epoch:s.epoch});s.createPending=pending;renderCatalog();
 const key=pending.key,epoch=pending.epoch,unchanged=()=>s.createPending===pending&&epoch===s.epoch&&key===s.createKey&&$('create-dialog').open;
 // A selection is a selector, not permission: resolve and create both revalidate on the server.
 const context=choice?{account_id:choice.account_id,product_instance_id:choice.product_instance_id,service_code:choice.service_code}:null;
 const payload={...context,subject:$('subject').value.trim(),description:$('description').value.trim(),priority:$('priority').value};
 const selected=$('coverage-choice').value,hasSelection=!$('coverage-label').hidden;
 let operation=null,confirmed=false;
 try{
 if(!unresolvedCreate()){
  validateCreateInput(payload);
  const r=await post('/contexts/resolve',context,key);
  if(!unchanged())return;
  if(r.status==='no_coverage')throw Error('Nenhuma cobertura vigente para este contexto. Feche e reabra o formulário para atualizar as opções.');
  if(r.status==='ambiguous'&&(!hasSelection||!r.candidates.some(c=>c.coverage_id===selected))){
   const placeholder=option('','Selecione a cobertura');placeholder.disabled=true;
   $('coverage-choice').replaceChildren(placeholder,...r.candidates.map(c=>option(c.coverage_id,'Contrato '+c.contract_id.slice(0,12)+' · versão '+c.contract_version)));
   $('coverage-choice').value='';$('coverage-label').hidden=false;notice('Selecione uma das coberturas elegíveis e confirme.');return;
  }
  creation.prepare({...payload,...(r.status==='ambiguous'?{coverage_id:selected}:{})});
 }
  operation=creation.begin();if(!operation)return;renderCatalog();
  const {path,...request}=retryCreateIntent(operation,createIdentity());
  const t=await api(path,request);
  if(!creation.confirm(operation,t))return;
  confirmed=true;
  const visible=$('create-dialog').open;
  if(visible)$('create-dialog').close();else resetOpening();await list();
  if(!visible)return;
  if(epoch!==s.epoch)return;await detail(t.id,{navigate:true});
  if(epoch===s.epoch&&s.ticket?.id===t.id)notice('Chamado aberto. Contrato e histórico preservados.');
 }catch(error){
  if(confirmed){if(epoch===s.epoch){error.message='Chamado aberto, mas não foi possível atualizar a leitura. '+error.message;throw error;}}
  else if(operation){if(creation.fail(operation)){renderCatalog();error.message='A abertura não foi confirmada. Recupere o pedido original. '+(error.message==='invalid_create_receipt'?'Resposta incompatível do servidor.':error.message);throw error;}}
  else if(unchanged()){if(error.message==='invalid_create_input')error.message='Confira o assunto (3 a 200 caracteres) e a descrição (1 a 12000 caracteres), sem contar os espaços nas pontas.';throw error;}
 }finally{if(s.createPending===pending){s.createPending=null;renderCatalog();}}
});};
$('message-body').oninput=()=>mutations.edit(s.mode,$('message-body').value);
$('message-form').onsubmit=e=>{e.preventDefault();run(async()=>{
 if((cgWorkflow?.blocked()||cgReview?.blocked())||!s.ticket||!(s.mode==='internal'?s.actions?.add_note:s.actions?.reply))return;
 const id=s.ticket.id,channel=s.mode;mutations.edit(channel,$('message-body').value);
 const op=mutations.begin(channel);if(!op)return;renderComposer();
 try{
  await post('/tickets/'+id+(channel==='internal'?'/notes':'/messages'),{body:op.body.trim()},op.key);
  const result=mutations.finish(op,true);if(!result.current)return;renderComposer();
  await detail(id);
  if(mutations.current(op))notice(channel==='internal'?'Nota salva apenas para a equipe.':'Resposta adicionada à conversa. Sem envio de e-mail nesta versão.');
 }catch(error){if(mutations.finish(op,false,outcomeUnknown(error)).current||mutations.current(op))throw error;}
 finally{renderComposer();}
});};
$('transition').onclick=()=>run(async()=>{
 const t=s.ticket,move=s.actions?.transitions.find(v=>v.to===$('next-status').value);if(cgReview?.blocked()||!t||!move)return;
 if(move.requires_reason&&!$('transition-reason').value.trim()){notice('Informe o motivo da reabertura.',true);$('transition-reason').focus();return;}
 const body={to:move.to,reason:$('transition-reason').value};
 mutations.edit('transition',JSON.stringify({...body,version:t.version}));
 const op=mutations.begin('transition');if(!op)return;renderComposer();
 try{
  const original=JSON.parse(op.body);await post('/tickets/'+t.id+'/transitions',{to:original.to,reason:original.reason},op.key,{'if-match':'"'+original.version+'"'});
  if(!mutations.finish(op,true).current)return;
  if($('transition-reason').value===body.reason)$('transition-reason').value='';
  await list();if(!mutations.current(op))return;await detail(t.id);
  if(mutations.current(op))notice('Estado atualizado com controle de versão.');
 }catch(error){if(mutations.finish(op,false,outcomeUnknown(error)).current||mutations.current(op))throw error;}
 finally{renderComposer();}
});
function navigateView(view){
 const labels={tickets:'Operação / Chamados',guide:'Projeto / Arquitetura e estágio',email:'Operação / E-mails','implementation-support':'Operação / Apoio Implantação'};
 if(!Object.hasOwn(labels,view))return;
 if(view==='implementation-support'&&(!s.me||s.demo||!isImplementationSupportStaff(s.me)))return;
 if(view==='email'&&!emailMonitor)return;
 if(activeView!==view){implementationSupport?.destroy();implementationSupport=null;}
 activeView=view;
 void emailMonitor?.setVisible(view==='email');
 for(const name of Object.keys(labels))$(name+'-view').hidden=name!==view;
 $('breadcrumb').textContent=labels[view];
 for(const button of document.querySelectorAll('[data-view]'))button.classList.toggle('active',button.dataset.view===view);
 if(view==='implementation-support'&&!implementationSupport){
  const epoch=s.epoch;
  implementationSupport=mountImplementationSupport($('implementation-support-root'),{principal:s.me,getPrincipal:()=>s.me,session:{id:s.me.id,workspaceId:s.workspace},request:operationalRequest(),isCurrent:()=>epoch===s.epoch&&activeView==='implementation-support'&&!s.demo});
 }
}
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>mode(b.dataset.mode);
for(const button of document.querySelectorAll('[data-view]'))button.onclick=()=>navigateView(button.dataset.view);
$('refresh').onclick=()=>run(async()=>{await list();if(s.ticket)await detail(s.ticket.id);});$('more').onclick=()=>run(()=>list(false));$('new-ticket').onclick=()=>run(startCreate);$('create-dialog').addEventListener('close',()=>{if(!$('create-dialog').open)resetOpening();});$('close-dialog').onclick=()=>$('create-dialog').close();$('cancel-create').onclick=()=>$('create-dialog').close();$('profile').onchange=e=>run(()=>profile(e.target.value));$('start-demo').onclick=()=>run(()=>profile(s.demo.profiles[0].key));async function leaveHumanSession(scope='local'){
 loginAttempt++;
 if(s.demo||!humanSession){clearSession();$('app').hidden=true;$('login-screen').hidden=false;$('password').value='';return;}
 const out=humanSession.signOut({scope}),epoch=s.epoch;
 $('login-status').textContent=scope==='global'?'Dados locais removidos. Confirmando encerramento de todas as sessões no provedor…':'Dados locais removidos. Confirmando saída da sessão atual no provedor…';
 const result=await out;
 if(epoch!==s.epoch||humanSession.state().phase!=='signed_out')return;
 $('login-status').textContent=scope==='global'
  ?result==='confirmed'?'Todas as sessões foram encerradas no provedor. Tokens de acesso já emitidos podem continuar válidos até expirar.'
   :result==='not_requested'?'Nenhuma sessão humana ativa neste navegador. Nenhum encerramento global foi solicitado.'
   :'Dados locais removidos, mas o encerramento de todas as sessões NÃO foi confirmado. Tokens já emitidos podem continuar válidos até expirar.'
  :result==='confirmed'
  ?'Sessão atual encerrada no provedor. Outras sessões não foram solicitadas para encerramento.'
  :result==='not_requested'?'Nenhuma sessão humana ativa neste navegador.'
  :'Dados locais removidos, mas a saída no provedor NÃO foi confirmada. Tokens já emitidos podem continuar válidos até expirar.';
 return result;
}
let workspaceChangeChoice=null;
function renderWorkspaceChange(){
 const available=!s.demo&&!!s.me&&!!humanSession&&['active','paused','refreshing'].includes(humanSession.state().phase);
 $('security-status').hidden=!available;$('security-status-login').hidden=!available||s.config?.operational!==false;
 $('configure-mfa').hidden=!available;$('configure-mfa-login').hidden=!available||s.config?.operational!==false;
 if(!ADVANCED_ACCESS)return; // Workspace, senha e sessões globais continuam na apresentação avançada.
 $('switch-workspace').hidden=!available;$('switch-workspace-login').hidden=!available||s.config?.operational!==false;
 $('logout-all').hidden=!available;$('logout-all-login').hidden=!available||s.config?.operational!==false;
 $('security-status').hidden=!available;$('security-status-login').hidden=!available||s.config?.operational!==false;
 $('add-mfa').hidden=!available;$('add-mfa-login').hidden=!available||s.config?.operational!==false;
 $('configure-mfa').hidden=!available;$('configure-mfa-login').hidden=!available||s.config?.operational!==false;
 $('change-password').hidden=!available;$('change-password-login').hidden=!available||s.config?.operational!==false;
}
const recoveryPanel=createRecoveryPanel({getSession:()=>humanSession,getEpoch:()=>s.epoch,onResult:message=>$('login-status').textContent=message,elements:{navigationNote:$('recovery-navigation-note'),email:$('recovery-email'),mailStep:$('recovery-request-step'),request:$('request-recovery-link'),entry:$('recover-access'),dialog:$('recovery-dialog'),link:$('recovery-link'),start:$('verify-recovery-link'),mfa:$('recovery-mfa-step'),factors:$('recovery-mfa-factor'),code:$('recovery-mfa-code'),verify:$('verify-recovery-mfa'),passwordStep:$('recovery-password-step'),password:$('recovered-password'),confirm:$('confirm-recovered-password'),submit:$('submit-recovered-password'),status:$('recovery-status')}});
if(ADVANCED_ACCESS){ // Recuperação: ativação desativada pela opção de código.
$('request-recovery-link').onclick=()=>run(recoveryPanel.request);$('recover-access').onclick=()=>run(recoveryPanel.open);$('verify-recovery-link').onclick=()=>run(recoveryPanel.start);$('verify-recovery-mfa').onclick=()=>run(recoveryPanel.verify);$('submit-recovered-password').onclick=()=>run(recoveryPanel.submit);$('cancel-recovery').onclick=()=>run(recoveryPanel.cancel);
}
const securityPanel=createSecurityStatusPanel({getSession:()=>humanSession,getEpoch:()=>s.epoch,elements:{dialog:$('security-dialog'),refresh:$('refresh-security'),factors:$('security-factors'),level:$('security-level'),status:$('security-read-status')}});
// Consulta somente da própria conta, sob a sessão humana atual.
$('security-status').onclick=()=>run(securityPanel.open);$('security-status-login').onclick=()=>run(securityPanel.open);$('refresh-security').onclick=()=>run(securityPanel.refresh);$('close-security').onclick=securityPanel.clear;
function outcomeUnknown(error){return error.requestSent!==false&&(!Number.isInteger(error.status)||error.status>=500||error.status===408);}
function renderReviewLocks(){const reviewHeld=cgReview?.blocked()===true;for(const id of ['cg-workflow','message-form','assignment-form','priority-form','transition-area'])$(id).inert=reviewHeld;const elsewhere=cgWorkflow?.blocked()===true||['public','internal','transition','assignment','priority'].some(channel=>mutations.busy(channel)||mutations.unresolved(channel));$('cg-review').inert=elsewhere;}
function ticketMutationBlocked(){return (cgWorkflow?.blocked()||cgReview?.blocked())===true||['public','internal','transition','assignment','priority'].some(channel=>mutations.busy(channel)||mutations.unresolved(channel));}
function workspaceChangeBlocked(){return cgOpening?.blocked()===true||creation.busy()||unresolvedCreate()||ticketMutationBlocked();}
const enrollmentPanel=createMfaEnrollmentPanel({getSession:()=>humanSession,getEpoch:()=>s.epoch,blocked:workspaceChangeBlocked,onResult:message=>$('login-status').textContent=message,elements:{title:$('mfa-enrollment-title'),description:$('mfa-enrollment-description'),label:$('mfa-enrollment-label'),dialog:$('mfa-enrollment-dialog'),start:$('start-mfa-enrollment'),confirm:$('confirm-mfa-enrollment'),factor:$('mfa-enrollment-factor'),code:$('mfa-enrollment-code'),secret:$('mfa-enrollment-secret'),qr:$('mfa-enrollment-qr'),provision:$('mfa-provision'),status:$('mfa-enrollment-status')}});
if(ADVANCED_ACCESS){
$('add-mfa').onclick=()=>run(()=>enrollmentPanel.open({additional:true}));$('add-mfa-login').onclick=()=>run(()=>enrollmentPanel.open({additional:true}));
}
$('configure-mfa').onclick=()=>run(enrollmentPanel.open);$('configure-mfa-login').onclick=()=>run(enrollmentPanel.open);$('start-mfa-enrollment').onclick=()=>run(enrollmentPanel.start);$('confirm-mfa-enrollment').onclick=()=>run(enrollmentPanel.confirm);$('cancel-mfa-enrollment').onclick=()=>run(enrollmentPanel.cancel);
let passwordChoice=null;
function passwordDialogBusy(value){for(const id of ['submit-password-change','cancel-password-change','request-password-code'])$(id).disabled=value;}
function resetPasswordDialog(){
 $('password-change-form').reset();$('password-change-status').textContent='';
 passwordDialogBusy(false);
}
function requestPasswordChange(){
 if(s.demo||!s.me||!humanSession||!['active','paused','refreshing'].includes(humanSession.state().phase))return;
 if(workspaceChangeBlocked())throw Error('Conclua ou reconcilie o envio atual antes de alterar a senha.');
 resetPasswordDialog();passwordChoice={epoch:s.epoch,generation:humanSession.state().generation,busy:false};$('password-change-dialog').showModal();
}
if(ADVANCED_ACCESS){ // Alteração de senha, logout global e troca de operação desativados.
$('change-password').onclick=()=>run(requestPasswordChange);$('change-password-login').onclick=()=>run(requestPasswordChange);
$('cancel-password-change').onclick=()=>{if(!passwordChoice?.busy)$('password-change-dialog').close();};
$('password-change-dialog').addEventListener('cancel',e=>{if(passwordChoice?.busy)e.preventDefault();});
$('password-change-dialog').addEventListener('close',()=>{if(!$('password-change-dialog').open){passwordChoice=null;resetPasswordDialog();}});
$('request-password-code').onclick=()=>run(async()=>{
 const choice=passwordChoice;if(!choice||choice.busy)return;
 if(choice.epoch!==s.epoch||choice.generation!==humanSession?.state().generation){$('password-change-dialog').close();return;}
 if(workspaceChangeBlocked())throw Error('Conclua ou reconcilie o envio atual antes de solicitar o código.');
 choice.busy=true;$('password-change-form').reset();passwordDialogBusy(true);
 $('password-change-status').textContent='Solicitando código ao canal cadastrado, uma única vez. Aguarde o resultado…';
 try{await humanSession.reauthenticate();
  if(passwordChoice!==choice||choice.epoch!==s.epoch||choice.generation!==humanSession.state().generation)return;
  $('password-change-status').textContent='Solicitação confirmada pelo provedor. Verifique seu canal cadastrado e informe o código com as senhas. O recebimento depende do serviço de entrega.';
 }catch(error){
  if(error.code==='stale_session')return;
  if(humanSession.state().generation===choice.generation+1&&humanSession.state().phase==='signed_out'){
   $('login-status').textContent=error.message+' Entre novamente antes de solicitar outro código.'+(error.logoutUnconfirmed?' O encerramento da sessão no provedor NÃO foi confirmado.':'');
  }else if(passwordChoice===choice&&choice.generation===humanSession.state().generation){
   $('password-change-status').textContent='A solicitação de código NÃO foi confirmada. '+error.message+' Não repetimos o envio; verifique seu canal antes de solicitar novamente.';
  }
 }finally{if(passwordChoice===choice){choice.busy=false;passwordDialogBusy(false);}}
});
$('password-change-form').onsubmit=e=>{e.preventDefault();run(async()=>{
 const choice=passwordChoice;if(!choice||choice.busy)return;
 if(choice.epoch!==s.epoch||choice.generation!==humanSession?.state().generation){$('password-change-dialog').close();return;}
 if(workspaceChangeBlocked())throw Error('Conclua ou reconcilie o envio atual antes de alterar a senha.');
 const current=$('current-password').value,password=$('new-password').value,nonce=$('password-nonce').value.trim();
 try{if(password!==$('confirm-password').value)throw Error('A confirmação deve ser igual à nova senha.');validatePasswordChange(current,password,nonce);}
 catch(error){$('password-change-status').textContent=error.message;return;}
 choice.busy=true;$('password-change-form').reset();passwordDialogBusy(true);
 $('password-change-status').textContent='Enviando a alteração uma única vez. Aguarde a confirmação e a saída da sessão…';
 try{const result=await humanSession.changePassword(current,password,nonce);
  if(humanSession.state().generation!==choice.generation+1||humanSession.state().phase!=='signed_out')return;
  $('login-status').textContent='Senha alterada e confirmada pelo provedor. Entre novamente com a nova senha.'+(result.logout==='unconfirmed'?' O encerramento da sessão no provedor NÃO foi confirmado. Tokens emitidos podem continuar válidos até expirar.':'');
 }catch(error){
  if(error.code==='stale_session')return;
  if(humanSession.state().generation!==choice.generation+1||humanSession.state().phase!=='signed_out'){
   if(passwordChoice===choice){choice.busy=false;passwordDialogBusy(false);$('password-change-status').textContent=error.message;}return;
  }
  const refusal=['password_change_rejected','password_change_reauthenticate','password_change_requires_mfa','password_change_nonce_invalid'].includes(error.code);
  $('login-status').textContent=(refusal?error.message:'Não foi possível confirmar a alteração de senha. Não repetimos o envio. Entre novamente; a senha anterior ou a nova pode ser necessária.')+(error.logoutUnconfirmed?' O encerramento da sessão no provedor NÃO foi confirmado. Tokens emitidos podem continuar válidos até expirar.':'');
 }
});};
let logoutAllChoice=null;
function requestLogoutAll(){
 if(s.demo||!s.me||!humanSession||!['active','paused','refreshing'].includes(humanSession.state().phase))return;
 logoutAllChoice={epoch:s.epoch,generation:humanSession.state().generation};$('logout-all-dialog').showModal();
}
$('logout-all').onclick=()=>run(requestLogoutAll);$('logout-all-login').onclick=()=>run(requestLogoutAll);
$('cancel-logout-all').onclick=()=>$('logout-all-dialog').close();
$('logout-all-dialog').addEventListener('close',()=>{if(!$('logout-all-dialog').open)logoutAllChoice=null;});
$('confirm-logout-all').onclick=()=>run(async()=>{
 if(!logoutAllChoice||logoutAllChoice.epoch!==s.epoch||logoutAllChoice.generation!==humanSession?.state().generation){$('logout-all-dialog').close();return;}
 $('logout-all-dialog').close();await leaveHumanSession('global');
});

function requestWorkspaceChange(){
 if(s.demo||!s.me||!humanSession||!['active','paused','refreshing'].includes(humanSession.state().phase))return;
 if(workspaceChangeBlocked())throw Error('Conclua ou reconcilie o envio atual antes de trocar workspace.');
 workspaceChangeChoice={epoch:s.epoch,generation:humanSession.state().generation};$('workspace-change-dialog').showModal();
}
$('switch-workspace').onclick=()=>run(requestWorkspaceChange);$('switch-workspace-login').onclick=()=>run(requestWorkspaceChange);
$('cancel-workspace-change').onclick=()=>$('workspace-change-dialog').close();
$('workspace-change-dialog').addEventListener('close',()=>{if(!$('workspace-change-dialog').open)workspaceChangeChoice=null;});
$('confirm-workspace-change').onclick=()=>run(async()=>{
 if(!workspaceChangeChoice||workspaceChangeChoice.epoch!==s.epoch||workspaceChangeChoice.generation!==humanSession?.state().generation){$('workspace-change-dialog').close();return;}
 if(workspaceChangeBlocked())throw Error('Conclua ou reconcilie o envio atual antes de trocar workspace.');
 $('workspace-change-dialog').close();$('workspace').value='';const result=await leaveHumanSession();
 if(result==='confirmed')$('login-status').textContent='Sessão atual encerrada no provedor. Entre novamente para escolher outro workspace.';
});
}
$('logout').onclick=()=>run(leaveHumanSession);
$('logout-mobile').onclick=()=>run(leaveHumanSession);
$('cancel-login').onclick=()=>run(leaveHumanSession);
if(ADVANCED_ACCESS)$('choose-workspace').onclick=()=>run(()=>humanSession?.selectWorkspace($('workspace-choice').value));
function humanChanged(value){recoveryPanel.sync(value);
 const previous=lastHumanPhase;lastHumanPhase=value.phase;
 const authenticationOnly=s.config?.operational===false,choosing=value.phase==='selecting_workspace';
 const verifying=value.phase==='verifying_mfa',selectedFactor=$('mfa-factor').value;
 $('mfa-panel').hidden=!verifying;$('verify-mfa').disabled=value.mfaBusy;$('mfa-code').disabled=value.mfaBusy;
 if(verifying){
  $('mfa-factor').replaceChildren(option('','Selecione seu autenticador'),...value.mfaFactors.map((f,i)=>option(f.id,'Autenticador '+(i+1)+' · '+f.id.slice(0,8))));
  $('mfa-factor').value=value.mfaFactors.length===1?value.mfaFactors[0].id:value.mfaFactors.some(f=>f.id===selectedFactor)?selectedFactor:'';
  $('mfa-factor').disabled=value.mfaBusy;
  if(previous!=='verifying_mfa'){$('login-status').textContent='Senha validada. Confirme seu autenticador para concluir a entrada.';$('mfa-code').focus();}
 }else{$('mfa-code').value='';$('mfa-factor').replaceChildren();$('mfa-status').textContent='';}
 $('workspace-choice-label').hidden=!choosing;$('choose-workspace').hidden=!choosing;
 if(choosing){$('workspace-choice').replaceChildren(option('','Selecione um workspace'),...value.workspaceOptions.map(w=>option(w.id,w.name)));$('login-status').textContent='Identidade validada. Escolha o workspace para confirmar seu acesso.';}
 $('submit-login').disabled=value.phase!=='signed_out';$('cancel-login').hidden=!['signing_in','selecting_workspace','verifying_mfa'].includes(value.phase)&&!(authenticationOnly&&!['signed_out','signing_out'].includes(value.phase));$('cancel-login').textContent=['signing_in','selecting_workspace','verifying_mfa'].includes(value.phase)?'Cancelar entrada':ADVANCED_ACCESS?'Encerrar sessão':'Sair';
 if(!ADVANCED_ACCESS){$('login-form').hidden=authenticationOnly&&['active','paused','refreshing'].includes(value.phase);$('cancel-login').hidden=verifying?false:!authenticationOnly||!['active','paused','refreshing'].includes(value.phase);}
 $('session-banner').hidden=!['paused','refreshing'].includes(value.phase);
 $('retry-session').hidden=value.phase!=='paused';$('retry-session').disabled=value.phase==='refreshing';
 $('session-status').textContent=value.phase==='paused'
  ?'Não foi possível renovar a sessão. Novas requisições estão pausadas; o rascunho permanece somente nesta tela. Tente renovar ou saia.'
  :'Renovando a sessão antes de enviar novas requisições…';
 renderWorkspaceChange();
 if(['signed_out','signing_out'].includes(value.phase)&&!['signed_out','signing_out'].includes(previous)){
  clearSession();$('app').hidden=true;$('login-screen').hidden=false;$('password').value='';
  $('login-status').textContent='Sessão local encerrada. Entre novamente para continuar.';
 }
 accessUX?.phase(value.phase);
}
async function submitMfa(){
 if(!humanSession||humanSession.state().phase!=='verifying_mfa'||humanSession.state().mfaBusy)return;
 const generation=humanSession.state().generation,factor=$('mfa-factor').value,code=$('mfa-code').value.trim();$('mfa-code').value='';$('mfa-status').textContent='Confirmando o código uma única vez…';
 try{await humanSession.verifyMfa(factor,code);}catch(error){
  if(humanSession.state().generation===generation&&humanSession.state().phase==='verifying_mfa')$('mfa-status').textContent=error.message;
 }
}
// O código só é aceito na etapa de MFA exigida pelo provedor.
$('verify-mfa').onclick=()=>run(submitMfa);
$('mfa-code').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();run(submitMfa);}});
$('retry-session').onclick=()=>run(async()=>{
 if(!humanSession)return;const epoch=s.epoch;
 await humanSession.resume();
 if(epoch===s.epoch)notice('Sessão renovada. Nenhuma gravação foi repetida; revise e confirme a operação desejada.');
});
$('login-form').onsubmit=e=>{e.preventDefault();run(async()=>{
 if(s.demo||!humanSession)throw Error('Ambiente ainda não configurado para login.');
 if(humanSession.state().phase!=='signed_out')return;
 const fields={email:$('email').value,password:$('password').value,workspace:ADVANCED_ACCESS?$('workspace').value.trim():''};
 const attempt=++loginAttempt;clearSession();$('password').value='';$('login-status').textContent='Entrando…';
 const pending=humanSession.signIn(fields),generation=humanSession.state().generation;
 try{
  await pending;if(attempt!==loginAttempt||generation!==humanSession.state().generation)return;
  s.workspace=humanSession.state().workspace;await login();
  if(attempt===loginAttempt&&s.config?.operational!==false)$('login-status').textContent='';
 }catch(error){
  if(attempt!==loginAttempt||error.code==='stale_session'||error.message==='stale_session')return;
  const message=ADVANCED_ACCESS?error.message:(accessUX?.loginError(error.code)??'Não foi possível entrar. Confira seus dados e tente novamente.');
  // A valid provider identity without a successful /me is not a Help Desk login.
  if(!s.me&&humanSession.state().generation===generation&&humanSession.state().phase!=='signed_out'){
   const result=await humanSession.signOut();
   if(attempt!==loginAttempt||humanSession.state().phase!=='signed_out')return;
   $('login-status').textContent=message+(result==='unconfirmed'?' Saída no provedor não confirmada.':'');
  }else if(!s.me){$('login-status').textContent=message+(error.logoutUnconfirmed?' Saída no provedor não confirmada.':'');}
  else notice(error.message,true);
 }
});};
async function init(){try{const r=await fetch('/demo-config');if(r.ok){const c=await r.json();if(c.mode==='local-demo')s.demo=c;}}catch{}if(s.demo){recoveryNavigationIntake.clear();$('recover-access').hidden=true;$('demo-banner').hidden=false;$('login-form').hidden=true;$('demo-login').hidden=false;$('profile-label').hidden=false;$('profile').replaceChildren(...s.demo.profiles.map(p=>option(p.key,p.label)));}else{try{const r=await fetch('/v1/public-config');if(r.ok){s.config=await r.json();humanSession=createHumanSession(createHumanAuthTransport(s.config),{onChange:humanChanged,passwordOnly:!ADVANCED_ACCESS,allowSimpleMfa:true});humanFetch=createSessionFetch(humanSession);$('submit-login').disabled=false;$('recover-access').disabled=false;if(!ADVANCED_ACCESS){recoveryNavigationIntake.clear();}
 else if(recoveryNavigationIntake.hasLink()){const link=recoveryNavigationIntake.takeLink(s.config.supabase_url);if(link)recoveryPanel.offerNavigation(link);}else if(recoveryNavigationDiscarded)$('login-status').textContent='Credenciais recebidas pela URL não foram utilizadas. Use um link direto de recuperação ainda não aberto nesta etapa.';}else recoveryNavigationIntake.clear();}catch{recoveryNavigationIntake.clear();notice('API indisponível. Nenhum dado fictício foi carregado.',true);}}}run(async()=>{await init();accessConfiguration=!!s.demo||!!humanSession;accessUX?.configuration(accessConfiguration);});
