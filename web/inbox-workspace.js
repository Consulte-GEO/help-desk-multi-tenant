import {createInboxViewState,normalizeInboxFilters,inboxFiltersDiffer} from './inbox-view-state.js';
import {saoPauloFilterInstant} from './filter-instant.js';

const mounted=new WeakMap();
/** Presentation only. Callbacks delegate existing reads; this module NEVER commands
 * an API, changes a business field value/permission, clones forms or stores data. */
export function mountInboxWorkspace(doc=document,options={}) {
 if(mounted.has(doc))return mounted.get(doc);
 const win=doc.defaultView,$=id=>doc.getElementById(id);
 const required=['app','tickets-view','ticket-filters','ticket-list','ticket-detail','ticket-title','message-form','assignment-filter-label','transition-area','assignment-form','priority-form','assignment-status','priority-status','composer-tabs'];
 if(!win||required.some(id=>!$(id)))throw new Error('Inbox presentation host is incomplete');
 const view=$('tickets-view'),filters=$('ticket-filters'),list=$('ticket-list'),detail=$('ticket-detail'),composer=$('message-form');
 const listPanel=list.closest('.ticket-panel'),detailPanel=detail.closest('.detail-panel'),filterGrid=filters.querySelector('.filter-grid'),filterActions=filters.querySelector('.filter-actions');
 if(!listPanel||!detailPanel||!filterGrid||!filterActions)throw new Error('Inbox presentation structure is incompatible');
 const abort=new win.AbortController(),{signal}=abort,observers=[],moves=[],added=[],state=createInboxViewState();
 const compact=win.matchMedia('(max-width: 1100px)');
 let disposed=false,applied={},filterBusy=false,authenticated=false,available=false,lastFeedback='',scrollAnchor=null,focusEpoch=0;
 const make=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const text=(n,value)=>{if(n.textContent!==value)n.textContent=value;};
 const add=(n,id)=>{if(id)n.id=id;added.push(n);return n;};
 const relocate=(node,parent)=>{const marker=doc.createComment('UX02 original position');node.before(marker);moves.push({node,marker});parent.append(node);};
 const observe=(node,config,fn)=>{const o=new win.MutationObserver(()=>{if(!disposed)fn();});o.observe(node,config);observers.push(o);};
 const activeView=()=>!disposed&&!$('app').hidden&&!view.hidden;
 const inboxTitle=listPanel.querySelector('h2');const oldInboxTab=inboxTitle?.getAttribute('tabindex'),oldTitleTab=$('ticket-title').getAttribute('tabindex');
 if(inboxTitle)inboxTitle.tabIndex=-1;$('ticket-title').tabIndex=-1;

 // Native disclosure: the existing form, controls, validation and handlers survive.
 const extra=add(make('details','hd-filter-disclosure'),'hd-filter-disclosure');
 const extraSummary=make('summary','','Filtros adicionais');extra.append(extraSummary);filterGrid.before(extra);
 relocate(filterGrid,extra);relocate($('assignment-filter-label'),extra);if($('internal-status-filter-label'))relocate($('internal-status-filter-label'),extra);
 const dirty=add(make('p','fine hd-filter-draft','Há alterações nos filtros ainda não aplicadas.'),'hd-filter-draft');dirty.setAttribute('role','status');dirty.hidden=true;filterActions.before(dirty);
 function draft(){const dates={};for(const [key,id]of [['created_from','created-from'],['created_before','created-before']]){const value=$(id)?.value??'';try{dates[key]=saoPauloFilterInstant(value);}catch{dates[key]='invalid:'+value;}}return normalizeInboxFilters({...dates,q:$('search')?.value,search_in:$('search-in')?.value,internal_status:$('internal-status-filter-label')?.hidden===false?$('internal-status-filter')?.value:'',status:$('status-filter')?.value,priority:$('priority-filter')?.value,assignment:$('assignment-filter-label').hidden?'':$('assignment-filter')?.value});}
 function syncFilters(){
  const count=['status','priority','assignment','internal_status','created_from','created_before'].filter(k=>applied[k]).length;
  text(extraSummary,'Filtros adicionais'+(count?` · ${count} ativo${count===1?'':'s'}`:''));
  dirty.hidden=!inboxFiltersDiffer(draft(),applied);
  text(dirty,filterBusy?'Consulta em andamento. Alterações nos campos ainda não aplicadas.':'Há alterações nos filtros ainda não aplicadas. Use “Aplicar filtros”.');
 }
 filters.addEventListener('input',syncFilters,{signal});filters.addEventListener('change',syncFilters,{signal});
 filters.addEventListener('reset',()=>win.queueMicrotask(()=>{if(!disposed)syncFilters();}),{signal});
 // Invalid secondary controls must be exposed BEFORE the browser attempts to focus.
 filters.addEventListener('invalid',event=>{if(extra.contains(event.target))extra.open=true;},{capture:true,signal});

 const toolbar=add(make('div','hd-detail-navigation'),'hd-detail-navigation');
 const back=make('button','secondary','← Voltar aos chamados');back.type='button';back.id='hd-back-to-tickets';toolbar.append(back);toolbar.hidden=true;
 const readBox=add(make('section','hd-detail-read'),'hd-detail-read');
 const readStatus=make('p','');readStatus.id='hd-detail-read-status';readStatus.setAttribute('role','status');readStatus.setAttribute('aria-live','polite');
 const retry=make('button','secondary','Tentar carregar novamente');retry.id='hd-detail-retry';retry.type='button';readBox.append(readStatus,retry);readBox.hidden=true;detailPanel.prepend(toolbar,readBox);
 retry.addEventListener('click',()=>{const v=state.view();if(v.phase==='error'&&v.error!=='forbidden'&&v.target&&typeof options.retryDetail==='function')options.retryDetail(v.target);},{signal});

 const tools=add(make('details','hd-ticket-tools'),'hd-ticket-tools');const toolsSummary=make('summary','','Ações do chamado');
 const toolsBody=make('div','hd-ticket-tools-body');tools.append(toolsSummary,toolsBody);
 const feedback=add(make('div','hd-tools-feedback'),'hd-tools-feedback');feedback.hidden=true;
 const feedbackLabel=make('p','fine'),showTools=make('button','secondary','Ver ações e avisos');showTools.type='button';feedback.append(feedbackLabel,showTools);
 composer.after(feedback,tools);
 const toolSections=[$('transition-area'),$('assignment-form'),$('priority-form')];for(const node of toolSections)relocate(node,toolsBody);
 showTools.addEventListener('click',()=>{tools.open=true;toolsSummary.focus();toolsSummary.scrollIntoView({block:'nearest'});},{signal});
 function syncActions(){
  const visible=toolSections.filter(n=>!n.hidden);
  tools.hidden=visible.length===0;
  const messages=[$('assignment-status'),$('priority-status')].filter(n=>!n.closest('form').hidden).map(n=>n.textContent.trim()).filter(Boolean);
  const stamp=messages.join('\n');
  if(stamp&&stamp!==lastFeedback&&!tools.hidden)tools.open=true;
  lastFeedback=stamp;feedback.hidden=tools.hidden||!stamp||tools.open;
  // Do not duplicate internal reason/API text into another or public DOM surface.
  text(feedbackLabel,stamp?'Há uma atualização nas ações deste chamado. Abra a seção para conferir antes de continuar.':'');
 }
 tools.addEventListener('toggle',syncActions,{signal});
 for(const node of toolSections)observe(node,{attributes:true,attributeFilter:['hidden']},syncActions);
 for(const id of ['assignment-status','priority-status'])observe($(id),{childList:true,subtree:true,characterData:true},syncActions);

 const noteWarning=add(make('p','hd-internal-warning','Nota interna — visível somente para a equipe autorizada. Não será enviada ao cliente.'),'hd-internal-warning');noteWarning.hidden=true;noteWarning.setAttribute('role','status');
 $('composer-tabs').after(noteWarning);
 function syncComposer(){
  noteWarning.hidden=composer.hidden||!composer.classList.contains('internal');
  for(const button of $('composer-tabs').querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.classList.contains('selected')));
 }
 observe(composer,{attributes:true,attributeFilter:['class','hidden']},syncComposer);
 for(const button of $('composer-tabs').querySelectorAll('[data-mode]'))observe(button,{attributes:true,attributeFilter:['class','hidden']},syncComposer);

 // Status text is conditional on the existing app's authenticated runtime state.
 const guide=$('guide-view');let guideStatus=$('hd-guide-availability');
 if(guide&&!guideStatus){guideStatus=add(make('p','hd-guide-availability'),'hd-guide-availability');guideStatus.setAttribute('role','status');guide.querySelector('h1')?.after(guideStatus);}
 function setAvailability(isAuthenticated,isAvailable){
  if(disposed)return;authenticated=isAuthenticated===true;available=isAvailable===true;
  if(guideStatus)text(guideStatus,!authenticated?'A disponibilidade da operação será verificada após a entrada.':!available?'Seu acesso foi confirmado. As funções de atendimento estão em preparação.':'A consulta segue as permissões do seu acesso. Cada ação depende de nova validação pelo servidor.');
 }
 function draw(){
  if(disposed)return;const v=state.view();view.setAttribute('data-inbox-pane',v.pane);
  toolbar.hidden=!compact.matches||v.pane!=='detail';
  readBox.hidden=!['loading','error'].includes(v.phase);
  text(readStatus,v.phase==='loading'?'Carregando o chamado e conferindo as ações disponíveis…':v.phase==='error'?v.error==='forbidden'?'Este chamado não está disponível para seu acesso. Volte à lista e atualize a consulta.':'Não foi possível carregar o chamado. Nenhuma nova gravação foi enviada por esta consulta.':'');
  retry.hidden=v.phase!=='error'||v.error==='forbidden'||typeof options.retryDetail!=='function';
  detailPanel.setAttribute('aria-busy',String(v.phase==='loading'));
 }
 function backToList(){
  if(disposed)return;state.back();draw();const stamp=++focusEpoch;
  if(!compact.matches)return;
  win.requestAnimationFrame(()=>{
   if(stamp!==focusEpoch||!activeView()||state.view().pane!=='list'||!compact.matches)return;
   const card=scrollAnchor?.id?[...list.querySelectorAll('.ticket-card')].find(n=>n.getAttribute('data-ticket-id')===scrollAnchor.id):null;
   (card??inboxTitle)?.focus({preventScroll:true});
   if(scrollAnchor){list.scrollTop=scrollAnchor.list;win.scrollTo({top:scrollAnchor.window,behavior:'instant'});}
  });
 }
 back.addEventListener('click',backToList,{signal});
 // No global Escape handler: it belongs to dialogs, fields and the navigation menu.
 compact.addEventListener('change',()=>{
  const v=state.view(),focused=doc.activeElement;
  if(activeView()&&!compact.matches&&toolbar.contains(focused))$('ticket-title').focus({preventScroll:true});
  if(activeView()&&compact.matches&&v.pane==='list'&&detailPanel.contains(focused))inboxTitle?.focus({preventScroll:true});
  if(activeView()&&compact.matches&&v.pane==='detail'&&listPanel.contains(focused))back.focus({preventScroll:true});
  draw();
 },{signal});
 // UX01's menu initially targets the first heading, which can now be hidden in
 // detail mode. Correct only presentation focus after existing navigation ran.
 doc.addEventListener('click',event=>{
  const button=event.target.closest?.('.sidebar button[data-view="tickets"]');
  if(!button||button.disabled)return;
  const stamp=++focusEpoch;
  win.queueMicrotask(()=>{
   if(stamp!==focusEpoch||!activeView()||!compact.matches)return;
   const target=state.view().pane==='detail'?(!detail.hidden?$('ticket-title'):back):inboxTitle;
   target?.focus({preventScroll:true});target?.scrollIntoView({block:'start'});
  });
 },{signal});
 const controller=Object.freeze({
  beginDetail(id,navigate=false){
   if(disposed)return null;
   focusEpoch++;
   if(navigate&&state.view().pane==='list')scrollAnchor={id,list:list.scrollTop,window:win.scrollY};
   if(id!==state.view().target){tools.open=false;lastFeedback='';}
   const op=state.begin(id,navigate);draw();
   if(navigate&&compact.matches&&activeView()&&!doc.querySelector('dialog[open]')){back.focus({preventScroll:true});toolbar.scrollIntoView({block:'start'});}
   return op;
  },
  finishDetail(op){
   if(disposed||!state.finish(op))return false;draw();syncActions();syncComposer();
   if(state.consumeFocus()&&compact.matches&&state.view().pane==='detail'&&activeView()&&!doc.querySelector('dialog[open]')){
    $('ticket-title').focus({preventScroll:true});$('ticket-title').scrollIntoView({block:'start'});
   }
   return true;
  },
  failDetail(op,status){if(disposed||!state.fail(op,[401,403,404].includes(status)?'forbidden':'unavailable'))return false;draw();return true;},
  setFilters(value,busy=false){if(disposed)return;applied=normalizeInboxFilters(value);filterBusy=busy===true;syncFilters();},
  setAvailability,backToList,
  reset(){if(disposed)return;focusEpoch++;state.reset();scrollAnchor=null;applied={};filterBusy=false;lastFeedback='';extra.open=false;tools.open=false;feedback.hidden=true;setAvailability(false,false);draw();syncFilters();},
  dispose(){
   if(disposed)return;disposed=true;focusEpoch++;state.reset();scrollAnchor=null;applied={};abort.abort();for(const o of observers)o.disconnect();
   for(const {node,marker} of moves){if(marker.parentNode)marker.replaceWith(node);}
   for(const node of added)node.remove();
   for(const [n,value] of [[inboxTitle,oldInboxTab],[$('ticket-title'),oldTitleTab]])if(n){if(value===null)n.removeAttribute('tabindex');else n.setAttribute('tabindex',value);}
   for(const button of $('composer-tabs').querySelectorAll('[data-mode]'))button.removeAttribute('aria-pressed');
   view.classList.remove('hd-inbox-enhanced');view.removeAttribute('data-inbox-pane');detailPanel.removeAttribute('aria-busy');mounted.delete(doc);
  }
 });
 // Only commit the responsive enhancement after all controls have been mounted.
 view.classList.add('hd-inbox-enhanced');syncFilters();syncActions();syncComposer();setAvailability(false,false);draw();mounted.set(doc,controller);return controller;
}
