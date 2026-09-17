import {createHumanAuthTransport} from './human-auth.js';
import {createHumanSession} from './human-session.js';
import {createSessionFetch} from './session-fetch.js';
let humanSession=null,humanFetch=null,loginAttempt=0,lastHumanPhase='signed_out';
import {createTimelineState,eventPresentation} from './timeline-state.js';
const timeline=createTimelineState();
import {createTicketListState} from './ticket-list-state.js';
const inbox=createTicketListState();
import {createConversationState} from './conversation-state.js';
import {createMutationState} from './mutation-state.js';
import {createSupportCatalogState} from './support-catalog-state.js';
const conversation=createConversationState(),mutations=createMutationState(),catalog=createSupportCatalogState();
const $=id=>document.getElementById(id);
const s={token:'',workspace:'',me:null,tickets:[],ticket:null,next:null,mode:'public',epoch:0,detail:0,demo:null,config:null,createKey:crypto.randomUUID(),createPending:null};
const labels={received:'Recebido',in_progress:'Em atendimento',waiting_for_you:'Aguardando você',resolved:'Resolvido',closed:'Encerrado',new:'Novo',triage:'Triagem',open:'Em atendimento',waiting_customer:'Aguardando cliente',waiting_internal:'Aguardando equipe',waiting_third_party:'Aguardando terceiro',cancelled:'Cancelado'};
const moves={new:['triage','open','cancelled'],triage:['open','waiting_customer','cancelled'],open:['waiting_customer','waiting_internal','waiting_third_party','resolved','cancelled'],waiting_customer:['open','resolved','cancelled'],waiting_internal:['open','resolved','cancelled'],waiting_third_party:['open','resolved','cancelled'],resolved:['open','closed'],closed:[],cancelled:[]};
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
  if(!r.ok){const retry=r.status===429?r.headers.get('retry-after'):null;const error=Error((b?.detail??'Operação não concluída.')+(retry?' Aguarde '+retry+' segundos antes de reenviar.':''));error.status=r.status;error.code=b?.code;throw error;}
  return b;
 }catch(error){if(epoch!==s.epoch)throw Error('stale_session');throw error;}
}
const post=(path,body,key,headers={})=>api(path,{method:'POST',headers:{'idempotency-key':key,...headers},body:JSON.stringify(body)});
const date=v=>new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(v));
const badge=status=>el('span','badge '+(status==='resolved'?'good':status==='waiting_for_you'?'wait':status==='in_progress'?'progress':''),labels[status]??status);
const operator=account=>s.me?.kind==='human'&&(s.me.workspace_role==='admin'||s.me.grants.some(g=>g.account_id===account&&g.role==='agent'));
const product=id=>s.demo?.contexts.find(c=>c.product_instance_id===id)?.label??'Produto integrado';
function clearSession(){timeline.reset();$('history-section').open=false;renderTimeline();$('assignment-form').reset();$('assignment-status').textContent='';$('assignment-reload').hidden=true;$('assignment-form').hidden=true;$('priority-form').reset();$('priority-status').textContent='';$('priority-reload').hidden=true;inbox.reset();$('ticket-filters').reset();resetOpening();conversation.reset('');mutations.reset('');s.createKey=crypto.randomUUID();$('create-dialog').close();$('older-messages').hidden=true;$('older-notes').hidden=true;s.epoch++;s.detail++;s.token='';s.workspace='';s.me=null;$('identity-name').textContent='';$('workspace-label').textContent='Workspace autorizado';for(const id of ['stat-total','stat-open','stat-wait','stat-done','nav-count'])$(id).textContent='0';$('assignment-filter-label').hidden=true;s.ticket=null;s.tickets=[];s.next=null;for(const id of ['ticket-list','messages','notes','ticket-title','ticket-description','contract-info','ticket-tags'])$(id).replaceChildren();$('message-body').value='';$('ticket-detail').hidden=true;$('empty-detail').hidden=false;mode('public');}
async function login(){s.me=await api('/me');$('assignment-filter-label').hidden=!(s.me.kind==='human'&&(s.me.workspace_role==='admin'||s.me.grants.some(g=>g.role==='agent')));$('login-screen').hidden=true;$('app').hidden=false;$('identity-name').textContent=s.me.grants.some(g=>g.role==='agent')?'Equipe de suporte':'Portal do cliente';$('workspace-label').textContent=s.demo?'Consulte · demonstração':s.workspace;await list(true,true);}
async function profile(key){$('profile').value=key;const p=s.demo.profiles.find(p=>p.key===key);clearSession();s.token=p.token;s.workspace=p.workspace_id;await login();}
function syncInbox(){s.tickets=inbox.items();s.next=inbox.next();render();}
async function list(reset=true,selectFirst=false){
 if(reset)inbox.restart();const op=inbox.begin();if(!op)return;
 const detailGeneration=s.detail;syncInbox();
 try{const b=await api(op.path);if(!inbox.accept(op,b))return;syncInbox();}
 catch(error){if(inbox.fail(op)){syncInbox();throw error;}return;}
 // Detail failures belong to the detail request, not a page whose state has already completed.
 if(selectFirst&&detailGeneration===s.detail&&!s.ticket&&s.tickets.length)await detail(s.tickets[0].id);
}
function render(){
 const items=s.tickets,phase=inbox.status();$('ticket-list').replaceChildren();
 for(const t of items){const n=el('button','ticket-card'+(s.ticket?.id===t.id?' selected':''));n.type='button';n.setAttribute('aria-label','Abrir chamado: '+t.subject);
  const top=el('div','card-top'),bottom=el('div','card-bottom');top.append(el('span','',t.id.slice(0,8).toUpperCase()),el('span','',date(t.created_at)));
  if(t.assignment)bottom.append(el('span','badge',t.assignment.state==='mine'?'Sob minha responsabilidade':t.assignment.state==='other'?'Com outro atendente':'Sem responsável'));
  bottom.append(badge(t.status),el('span','badge',priorities[t.priority]),el('span','card-product',product(t.product_instance_id)));
  n.append(top,el('h3','',t.subject),el('p','',t.description),bottom);n.onclick=()=>run(()=>detail(t.id));$('ticket-list').append(n);
 }
 if(!items.length)$('ticket-list').append(el('p','list-empty',phase==='loading'?'Consultando chamados autorizados…':phase==='error'?'Não foi possível carregar os chamados. Tente novamente.':phase==='idle'?'Aplique a consulta para carregar chamados.':'Nenhum chamado encontrado para os filtros aplicados e suas permissões.'));
 $('stat-total').textContent=items.length;$('stat-open').textContent=items.filter(t=>['received','in_progress'].includes(t.status)).length;
 $('stat-wait').textContent=items.filter(t=>t.status==='waiting_for_you').length;$('stat-done').textContent=items.filter(t=>t.status==='resolved').length;
 $('nav-count').textContent=items.length;$('list-count').textContent=items.length+' carregado(s)'+(s.next?' · há mais resultados':'');
 $('more').hidden=!s.next||inbox.capped()||phase==='error';$('more').disabled=inbox.busy();$('list-retry').hidden=phase!=='error';
 $('ticket-list').setAttribute('aria-busy',String(inbox.busy()));
 const applied=inbox.filters(),names=[];if(applied.q)names.push('Busca por assunto/UUID');if(applied.status)names.push(labels[applied.status]);if(applied.priority)names.push('Prioridade '+priorities[applied.priority]);if(applied.assignment)names.push(applied.assignment==='mine'?'Meus atendimentos':'Sem responsável');
 $('applied-filters').textContent='Filtros aplicados: '+(names.join(' · ')||'nenhum')+'. Contagens referem-se somente aos itens carregados.';
 $('list-status').textContent=inbox.capped()?'Limite de 500 itens na tela. Refine a busca ou os filtros para continuar.':phase==='error'?'A consulta falhou; os itens abaixo já haviam sido carregados. Tente novamente.':phase==='loading'?'Consultando…':'';
}
function applyFilters(){
 const filters={},q=$('search').value.trim(),status=$('status-filter').value,priority=$('priority-filter').value,assignment=$('assignment-filter').value;
 if(q)filters.q=q;if(status)filters.status=status;if(priority)filters.priority=priority;if(assignment)filters.assignment=assignment;
 inbox.reset(filters);return list(false);
}
$('ticket-filters').onsubmit=e=>{e.preventDefault();run(applyFilters);};
$('clear-filters').onclick=()=>{ $('ticket-filters').reset();run(applyFilters); };
$('list-retry').onclick=()=>run(()=>list(false));
function renderConversation(){
 for(const kind of ['messages','notes']){
  $(kind).replaceChildren();const items=conversation.items(kind);
  for(const m of items){const n=el('article','message'+(kind==='notes'?' internal':''));
   n.append(el('small','',(kind==='notes'?'NOTA INTERNA':m.actor_type==='human_agent'?'Equipe de suporte':'Solicitante')+' · '+date(m.created_at)),el('p','',m.body));$(kind).append(n);
  }
  if(kind==='messages'&&!items.length)$(kind).append(el('p','fine','Ainda não há respostas nesta conversa.'));
  $('older-'+kind).hidden=!conversation.next(kind);
 }
}
async function older(kind){
 const cursor=conversation.next(kind),id=s.ticket?.id,seq=s.detail,generation=conversation.generation();
 if(!cursor||!id)return;
 const button=$('older-'+kind);button.disabled=true;
 try{const page=await api('/tickets/'+id+'/'+kind+'?limit=50&cursor='+encodeURIComponent(cursor));
  if(seq===s.detail&&id===s.ticket?.id&&conversation.accept(generation,kind,page))renderConversation();
 }finally{button.disabled=false;}
}
async function detail(id){
 // Invalidate pending writes as soon as navigation starts, not after the GET returns.
 if(s.ticket?.id!==id){timeline.reset();$('history-section').open=false;renderTimeline();$('assignment-form').reset();$('assignment-status').textContent='';$('assignment-reload').hidden=true;$('assignment-form').hidden=true;$('priority-form').reset();$('priority-status').textContent='';$('priority-reload').hidden=true;s.ticket=null;mutations.reset('');$('message-body').value='';$('transition-reason').value='';mode('public');$('ticket-detail').hidden=true;$('empty-detail').hidden=false;}
 const seq=++s.detail,t=await api('/tickets/'+id);
 const [messages,notes]=await Promise.all([api('/tickets/'+id+'/messages?limit=50'),operator(t.account_id)&&s.me.scopes.includes('notes:read')?api('/tickets/'+id+'/notes?limit=50'):Promise.resolve({items:[],next_cursor:null})]);
 if(seq!==s.detail)return;
 mutations.select(JSON.stringify([s.epoch,s.workspace,s.me.id,t.id]));
 s.ticket=t;renderComposer();const generation=conversation.reset(JSON.stringify([s.workspace,s.me.id,t.id]));
 conversation.accept(generation,'messages',messages);conversation.accept(generation,'notes',notes);
 $('empty-detail').hidden=true;$('ticket-detail').hidden=false;
 $('ticket-number').textContent='CHAMADO '+t.id.slice(0,8).toUpperCase()+' · VERSÃO '+t.version;
 $('ticket-title').textContent=t.subject;$('ticket-description').textContent=t.description;
 $('ticket-tags').replaceChildren(badge(t.status),el('span','badge',priorities[t.priority]),el('span','badge',product(t.product_instance_id)));
 $('contract-info').textContent='Versão '+t.contract_version_id.slice(0,12)+' · cobertura '+t.coverage_id.slice(0,12);
 renderConversation();const agent=operator(t.account_id);$('notes-section').hidden=!agent;$('note-tab').hidden=!agent;
 if(!agent)mode('public');const allowed=agent?(moves[t.internal_status]??[]):t.status==='resolved'?['open','closed']:[];
 $('transition-area').hidden=!allowed.length;$('next-status').replaceChildren(...allowed.map(v=>option(v,labels[v])));
 renderAssignment();renderPriority();timeline.reset(JSON.stringify([s.epoch,s.workspace,s.me.id,t.id]),agent);renderTimeline();if($('history-section').open)await loadTimeline();render();
}

function renderTimeline(){
 const phase=timeline.status(),rows=timeline.items();$('history-list').replaceChildren();
 for(const item of rows){const view=eventPresentation(item,operator(s.ticket?.account_id));const node=el('li','history-event'+(view.internal?' internal':''));node.append(el('small','',date(item.created_at)),el('h4','',view.title),el('p','',view.description));if(view.internal)node.append(el('span','badge','Restrito à equipe'));$('history-list').append(node);}
 $('history-status').textContent=phase==='loading'?'Consultando o histórico…':phase==='error'?'Não foi possível carregar o histórico. Eventos já carregados foram preservados.':phase==='capped'?'Limite de 500 eventos nesta tela. A lista não representa o total do histórico.':phase==='ready'?(rows.length?rows.length+' evento(s) carregado(s).':'Nenhum evento autorizado disponível.'):'Abra esta seção para consultar o histórico.';
 $('history-more').hidden=!timeline.next()||phase==='capped'||phase==='error';$('history-more').disabled=phase==='loading';$('history-retry').hidden=phase!=='error';$('history-refresh').disabled=phase==='loading'||!s.ticket;
}
async function loadTimeline(){
 const id=s.ticket?.id,op=timeline.begin();if(!id||!op)return;renderTimeline();
 try{const page=await api('/tickets/'+id+'/timeline?limit=50'+(op.cursor?'&cursor='+encodeURIComponent(op.cursor):''));if(timeline.accept(op,page))renderTimeline();}
 catch(error){if(timeline.fail(op))renderTimeline();}
}
$('history-section').ontoggle=()=>{if($('history-section').open&&timeline.status()==='idle')run(loadTimeline);};
$('history-more').onclick=()=>run(loadTimeline);$('history-retry').onclick=()=>run(loadTimeline);
$('history-refresh').onclick=()=>run(async()=>{if(!s.ticket)return;timeline.reset(JSON.stringify([s.epoch,s.workspace,s.me.id,s.ticket.id]),operator(s.ticket.account_id));await loadTimeline();});
function renderAssignment(){
 const t=s.ticket,a=t?.assignment,visible=t&&operator(t.account_id)&&a;
 $('assignment-form').hidden=!visible;if(!visible)return;
 $('assignment-label').textContent=a.state==='mine'?'Responsável: você.':a.state==='other'?'Responsável: outro atendente. Em chamados não encerrados, um administrador pode liberar para nova atribuição.':'Este chamado está sem responsável.';
 const busy=mutations.busy('assignment'),draft=mutations.draft('assignment');
 if(draft){try{$('assignment-reason').value=JSON.parse(draft).reason;}catch{$('assignment-status').textContent='Rascunho inválido. Reabra o chamado.';}}
 else $('assignment-reason').value='';
 $('claim-ticket').disabled=busy||!a.can_claim;$('release-ticket').disabled=busy||!a.can_release;$('assignment-reload').disabled=busy;
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
 const t=s.ticket;if(!t||!operator(t.account_id))return;editAssignment(action);const op=mutations.begin('assignment');if(!op)return;
 const d=JSON.parse(op.body);$('assignment-status').textContent='Confirmando responsabilidade com a versão '+d.version+'…';$('assignment-reload').hidden=true;renderAssignment();
 try{
  await post('/tickets/'+t.id+'/assignments',{action:d.action,reason:d.reason.trim()},op.key,{'if-match':'"'+d.version+'"'});
  if(!mutations.finish(op,true).current)return;
  $('assignment-status').textContent=d.action==='claim'?'Atendimento assumido. Registro somente no histórico interno.':'Atendimento liberado. Nenhuma permissão de acesso foi modificada.';
  await detail(t.id);if(mutations.current(op))await list();
 }catch(error){
  if(mutations.finish(op,false).current||mutations.current(op)){
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

function renderPriority(){
 const t=s.ticket,allowed=t&&operator(t.account_id)&&s.me.scopes.includes('tickets:read')&&s.me.scopes.includes('tickets:write')&&!['closed','cancelled'].includes(t.internal_status);
 $('priority-form').hidden=!allowed;if(!allowed)return;
 const draft=mutations.draft('priority');
 if(draft){try{const d=JSON.parse(draft);$('ticket-priority').value=d.priority;$('priority-reason').value=d.reason;}catch{$('priority-status').textContent='Rascunho de prioridade inválido. Reabra o chamado.';}}
 else{$('ticket-priority').value=t.priority;$('priority-reason').value='';}
 $('save-priority').disabled=mutations.busy('priority');
}
function editPriority(){if(!s.ticket)return;mutations.edit('priority',JSON.stringify({priority:$('ticket-priority').value,reason:$('priority-reason').value,version:s.ticket.version}));}
$('ticket-priority').onchange=editPriority;$('priority-reason').oninput=editPriority;
$('priority-form').onsubmit=e=>{e.preventDefault();run(async()=>{
 const t=s.ticket;if(!t||!operator(t.account_id))return;editPriority();const op=mutations.begin('priority');if(!op)return;
 const draft=JSON.parse(op.body);$('priority-status').textContent='Salvando com a versão '+draft.version+'…';$('priority-reload').hidden=true;renderPriority();
 try{
  await api('/tickets/'+t.id,{method:'PATCH',headers:{'idempotency-key':op.key,'if-match':'"'+draft.version+'"'},body:JSON.stringify({priority:draft.priority,reason:draft.reason})});
  if(!mutations.finish(op,true).current)return;
  $('priority-status').textContent=draft.priority===t.priority?'A prioridade já era a selecionada. Nenhuma alteração foi registrada.':'Prioridade salva. Motivo registrado somente no histórico interno.';
  await detail(t.id);if(mutations.current(op))await list();
 }catch(error){
  if(mutations.finish(op,false).current||mutations.current(op)){
   $('priority-status').textContent=error.requestSent===false?'Alteração não enviada: renove a sessão e confirme novamente. O motivo foi preservado.':error.status===412?'Outro atendimento modificou este chamado. Atualize a versão, revise a prioridade e confirme novamente.':(error.status===503||!Number.isInteger(error.status))?'Não foi possível confirmar a gravação. Repita sem alterar os campos para reutilizar a mesma chave ou atualize o chamado antes de decidir.':error.message;
   $('priority-reload').hidden=error.status!==412;
  }
 }finally{renderPriority();}
});};
$('priority-reload').onclick=()=>run(async()=>{const id=s.ticket?.id,epoch=s.epoch;if(!id)return;await detail(id);if(s.ticket?.id===id&&s.epoch===epoch){$('priority-reload').hidden=true;$('priority-status').textContent='Versão atualizada. Revise a prioridade e o motivo antes de confirmar novamente.';}});

$('older-messages').onclick=()=>run(()=>older('messages'));
$('older-notes').onclick=()=>run(()=>older('notes'));
function option(value,label){const n=el('option','',label);n.value=value;return n;}
function renderComposer(){$('message-body').value=mutations.draft(s.mode);$('send-message').disabled=mutations.busy(s.mode)||!s.ticket;$('transition').disabled=mutations.busy('transition')||!s.ticket;}
function mode(value){s.mode=value;renderComposer();$('message-form').classList.toggle('internal',value==='internal');for(const b of document.querySelectorAll('[data-mode]'))b.classList.toggle('selected',b.dataset.mode===value);$('composer-label').textContent=value==='internal'?'Escreva uma nota interna':'Escreva uma resposta pública';$('visibility-help').textContent=value==='internal'?'Restrita à equipe. Não é enviada ao cliente.':'Visível para o cliente e para a equipe.';$('send-message').textContent=value==='internal'?'Salvar nota':'Enviar resposta';}
const contextKey=v=>JSON.stringify([v.account_id,v.product_instance_id,v.service_code]);
const environmentLabels={production:'Produção',staging:'Homologação',development:'Desenvolvimento'};
function resetOpening(){catalog.reset();s.createPending=null;s.createKey=crypto.randomUUID();$('create-form').reset();$('context-choice').replaceChildren(option('','Selecione uma opção'));$('coverage-choice').replaceChildren();$('coverage-label').hidden=true;renderCatalog();}
function renderCatalog(){
 const status=catalog.status(),choices=catalog.choices(),selected=catalog.selectedKey();
 $('context-choice').replaceChildren(option('',status==='loading'&&!choices.length?'Carregando opções autorizadas…':'Selecione uma opção'),...choices.map(c=>option(contextKey(c),c.account_name+' · '+c.product_name+' ('+environmentLabels[c.environment]+') · '+c.service_name)));
 $('context-choice').value=selected;$('context-choice').disabled=status==='loading'||status==='error'||!choices.length;
 $('context-more').hidden=!catalog.next()||status==='error';$('context-more').disabled=status==='loading'||!!s.createPending;
 $('context-retry').hidden=status!=='error';$('context-retry').disabled=!!s.createPending;
 $('context-status').textContent=status==='loading'?'Consultando as opções autorizadas…':status==='error'?'Não foi possível carregar as opções. Tente novamente. As opções são obtidas exclusivamente pela API.':status==='empty'?'Nenhuma opção com cobertura vigente está disponível para este perfil. Solicite à equipe de suporte a revisão dos vínculos e contratos.':status==='ready'?choices.length+' opção(ões) carregada(s). '+(catalog.next()?'Há mais opções disponíveis. ':choices.length===1?'A única opção disponível foi selecionada. ':'Escolha explicitamente a conta e o sistema. ')+'O contrato será revalidado antes de salvar.':'Abra o formulário para consultar as opções disponíveis.';
 $('submit-create').disabled=!catalog.canSubmit()||!!s.createPending;
}
async function loadCatalog(){
 const op=catalog.begin();if(!op)return;renderCatalog();
 try{const page=await api('/support-contexts?limit=50'+(op.cursor?'&cursor='+encodeURIComponent(op.cursor):''));if(!catalog.current(op))return;catalog.accept(op,page);renderCatalog();}
 catch(error){if(catalog.fail(op))renderCatalog();}
}
async function startCreate(){resetOpening();$('create-dialog').showModal();$('subject').focus();await loadCatalog();}
$('context-choice').onchange=()=>{catalog.select($('context-choice').value);s.createKey=crypto.randomUUID();$('coverage-label').hidden=true;renderCatalog();};
$('context-more').onclick=()=>run(loadCatalog);$('context-retry').onclick=()=>run(loadCatalog);
$('create-form').addEventListener('input',e=>{s.createKey=crypto.randomUUID();if(e.target.id!=='coverage-choice')$('coverage-label').hidden=true;});
$('create-form').onsubmit=e=>{e.preventDefault();run(async()=>{
 const choice=catalog.selection();if(!catalog.canSubmit()||!choice||s.createPending)return;
 const pending=Object.freeze({key:s.createKey,epoch:s.epoch});s.createPending=pending;renderCatalog();
 const key=pending.key,epoch=pending.epoch,unchanged=()=>s.createPending===pending&&epoch===s.epoch&&key===s.createKey&&$('create-dialog').open;
 // A selection is a selector, not permission: resolve and create both revalidate on the server.
 const context={account_id:choice.account_id,product_instance_id:choice.product_instance_id,service_code:choice.service_code};
 const payload={...context,subject:$('subject').value.trim(),description:$('description').value.trim(),priority:$('priority').value};
 const selected=$('coverage-choice').value,hasSelection=!$('coverage-label').hidden;
 try{
  const r=await post('/contexts/resolve',context,key);
  if(!unchanged())return;
  if(r.status==='no_coverage')throw Error('Nenhuma cobertura vigente para este contexto. Feche e reabra o formulário para atualizar as opções.');
  if(r.status==='ambiguous'&&(!hasSelection||!r.candidates.some(c=>c.coverage_id===selected))){
   const placeholder=option('','Selecione a cobertura');placeholder.disabled=true;
   $('coverage-choice').replaceChildren(placeholder,...r.candidates.map(c=>option(c.coverage_id,'Contrato '+c.contract_id.slice(0,12)+' · versão '+c.contract_version)));
   $('coverage-choice').value='';$('coverage-label').hidden=false;notice('Selecione uma das coberturas elegíveis e confirme.');return;
  }
  const t=await post('/tickets',{...payload,...(r.status==='ambiguous'?{coverage_id:selected}:{})},key);
  if(!unchanged())return;
  $('create-dialog').close();await list();
  if(epoch!==s.epoch)return;await detail(t.id);
  if(epoch===s.epoch&&s.ticket?.id===t.id)notice('Chamado aberto. Contrato e histórico preservados.');
 }catch(error){if(unchanged())throw error;}finally{if(s.createPending===pending){s.createPending=null;renderCatalog();}}
});};
$('message-body').oninput=()=>mutations.edit(s.mode,$('message-body').value);
$('message-form').onsubmit=e=>{e.preventDefault();run(async()=>{
 if(!s.ticket)return;
 const id=s.ticket.id,channel=s.mode;mutations.edit(channel,$('message-body').value);
 const op=mutations.begin(channel);if(!op)return;renderComposer();
 try{
  await post('/tickets/'+id+(channel==='internal'?'/notes':'/messages'),{body:op.body.trim()},op.key);
  const result=mutations.finish(op,true);if(!result.current)return;renderComposer();
  await detail(id);
  if(mutations.current(op))notice(channel==='internal'?'Nota salva apenas para a equipe.':'Resposta adicionada à conversa. Sem envio de e-mail nesta versão.');
 }catch(error){if(mutations.finish(op,false).current||mutations.current(op))throw error;}
 finally{renderComposer();}
});};
$('transition').onclick=()=>run(async()=>{
 const t=s.ticket;if(!t)return;
 const body={to:$('next-status').value,reason:$('transition-reason').value};
 mutations.edit('transition',JSON.stringify({...body,version:t.version}));
 const op=mutations.begin('transition');if(!op)return;renderComposer();
 try{
  await post('/tickets/'+t.id+'/transitions',body,op.key,{'if-match':'"'+t.version+'"'});
  if(!mutations.finish(op,true).current)return;
  if($('transition-reason').value===body.reason)$('transition-reason').value='';
  await list();if(!mutations.current(op))return;await detail(t.id);
  if(mutations.current(op))notice('Estado atualizado com controle de versão.');
 }catch(error){if(mutations.finish(op,false).current||mutations.current(op))throw error;}
 finally{renderComposer();}
});
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>mode(b.dataset.mode);for(const n of document.querySelectorAll('[data-view]'))n.onclick=()=>{const tickets=n.dataset.view==='tickets';$('tickets-view').hidden=!tickets;$('guide-view').hidden=tickets;$('breadcrumb').textContent=tickets?'Operação / Chamados':'Projeto / Arquitetura e estágio';for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b===n);};
$('refresh').onclick=()=>run(async()=>{await list();if(s.ticket)await detail(s.ticket.id);});$('more').onclick=()=>run(()=>list(false));$('new-ticket').onclick=()=>run(startCreate);$('create-dialog').addEventListener('close',()=>{if(!$('create-dialog').open)resetOpening();});$('close-dialog').onclick=()=>$('create-dialog').close();$('cancel-create').onclick=()=>$('create-dialog').close();$('profile').onchange=e=>run(()=>profile(e.target.value));$('start-demo').onclick=()=>run(()=>profile(s.demo.profiles[0].key));async function leaveHumanSession(){
 loginAttempt++;
 if(s.demo||!humanSession){clearSession();$('app').hidden=true;$('login-screen').hidden=false;$('password').value='';return;}
 const out=humanSession.signOut(),epoch=s.epoch;
 $('login-status').textContent='Dados locais removidos. Confirmando saída da sessão atual no provedor…';
 const result=await out;
 if(epoch!==s.epoch||humanSession.state().phase!=='signed_out')return;
 $('login-status').textContent=result==='confirmed'
  ?'Sessão atual encerrada no provedor. Outras sessões não foram solicitadas para encerramento.'
  :result==='not_requested'?'Nenhuma sessão humana ativa neste navegador.'
  :'Dados locais removidos, mas a saída no provedor NÃO foi confirmada. Tokens já emitidos podem continuar válidos até expirar.';
}
$('logout').onclick=()=>run(leaveHumanSession);
$('cancel-login').onclick=()=>run(leaveHumanSession);
function humanChanged(value){
 const previous=lastHumanPhase;lastHumanPhase=value.phase;
 $('submit-login').disabled=value.phase==='signing_in';$('cancel-login').hidden=value.phase!=='signing_in';
 $('session-banner').hidden=!['paused','refreshing'].includes(value.phase);
 $('retry-session').hidden=value.phase!=='paused';$('retry-session').disabled=value.phase==='refreshing';
 $('session-status').textContent=value.phase==='paused'
  ?'Não foi possível renovar a sessão. Novas requisições estão pausadas; o rascunho permanece somente nesta tela. Tente renovar ou saia.'
  :'Renovando a sessão antes de enviar novas requisições…';
 if(value.phase==='signed_out'&&previous!=='signed_out'){
  clearSession();$('app').hidden=true;$('login-screen').hidden=false;$('password').value='';
  $('login-status').textContent='Sessão local encerrada. Entre novamente para continuar.';
 }
}
$('retry-session').onclick=()=>run(async()=>{
 if(!humanSession)return;const epoch=s.epoch;
 await humanSession.resume();
 if(epoch===s.epoch)notice('Sessão renovada. Nenhuma gravação foi repetida; revise e confirme a operação desejada.');
});
$('login-form').onsubmit=e=>{e.preventDefault();run(async()=>{
 if(s.demo||!humanSession)throw Error('Ambiente ainda não configurado para login.');
 if(humanSession.state().phase!=='signed_out')return;
 const fields={email:$('email').value,password:$('password').value,workspace:$('workspace').value.trim()};
 const attempt=++loginAttempt;clearSession();$('password').value='';$('login-status').textContent='Validando identidade e acesso ao workspace…';
 const pending=humanSession.signIn(fields),generation=humanSession.state().generation;
 try{
  await pending;if(attempt!==loginAttempt||generation!==humanSession.state().generation)return;
  s.workspace=humanSession.state().workspace;await login();
  if(attempt===loginAttempt)$('login-status').textContent='';
 }catch(error){
  if(attempt!==loginAttempt||error.code==='stale_session'||error.message==='stale_session')return;
  // A valid provider identity without a successful /me is not a Help Desk login.
  if(!s.me&&humanSession.state().generation===generation&&humanSession.state().phase!=='signed_out'){
   const result=await humanSession.signOut();
   if(attempt!==loginAttempt||humanSession.state().phase!=='signed_out')return;
   $('login-status').textContent=error.message+(result==='unconfirmed'?' Saída no provedor não confirmada.':'');
  }else if(!s.me){$('login-status').textContent=error.message;}
  else notice(error.message,true);
 }
});};
async function init(){try{const r=await fetch('/demo-config');if(r.ok){const c=await r.json();if(c.mode==='local-demo')s.demo=c;}}catch{}if(s.demo){$('demo-banner').hidden=false;$('login-form').hidden=true;$('demo-login').hidden=false;$('profile-label').hidden=false;$('profile').replaceChildren(...s.demo.profiles.map(p=>option(p.key,p.label)));}else{try{const r=await fetch('/v1/public-config');if(r.ok){s.config=await r.json();humanSession=createHumanSession(createHumanAuthTransport(s.config),{onChange:humanChanged});humanFetch=createSessionFetch(humanSession);}}catch{notice('API indisponível. Nenhum dado fictício foi carregado.',true);}}}run(init);
