/* PRIVATE VISUAL BENCH. This substitutes /app.js only in the loopback test server.
   It does not implement authentication, authorization, API, persistence or a demo fallback. */
const $=id=>document.getElementById(id);
const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
const fixtures=[
  {id:'HD-0104',status:'progress',label:'Em atendimento',title:'Solicitar ajuste no perfil de acesso',text:'A solicitação está em análise pela equipe de atendimento.',product:'Consulte GEO',when:'13 out · 09:42'},
  {id:'HD-0103',status:'wait',label:'Aguardando você',title:'Dúvida sobre o envio de uma solicitação',text:'Precisamos de mais contexto para continuar o atendimento.',product:'Consulte GEO',when:'13 out · 08:16'},
  {id:'HD-0102',status:'good',label:'Resolvido',title:'Orientação para consultar o histórico',text:'Orientações enviadas. Histórico disponível nesta conversa.',product:'Consulte GEO',when:'12 out · 16:25'},
];
function renderList(){
 $('ticket-list').replaceChildren();
 fixtures.forEach((item,i)=>{
  const card=make('button','ticket-card'+(i===0?' selected':''));card.type='button';card.dataset.fixture=String(i);
  const top=make('div','card-top');top.append(make('span','',item.id),make('span','',item.when));
  const bottom=make('div','card-bottom');bottom.append(make('span','badge '+item.status,item.label),make('span','card-product',item.product));
  card.append(top,make('h3','',item.title),make('p','',item.text),bottom);
  card.addEventListener('click',()=>detail(i));$('ticket-list').append(card);
 });
 $('list-count').textContent='3 chamados carregados';
}
function baseApp(){
 $('login-screen').hidden=true;$('app').hidden=false;$('tickets-view').hidden=false;$('guide-view').hidden=true;
 $('operational-status').hidden=true;$('session-banner').hidden=true;$('identity-name').textContent='Equipe de suporte · exemplo';$('workspace-label').textContent='Operação fictícia · Consulte GEO';
 for(const el of $('ticket-filters').querySelectorAll('input,select,button'))el.disabled=false;
 $('new-ticket').disabled=false;$('refresh').disabled=false;
 $('assignment-filter-label').hidden=false;$('list-status').textContent='';
 for(const [id,text] of Object.entries({'stat-total':'3','stat-open':'1','stat-wait':'1','stat-done':'1','nav-count':'3'}))$(id).textContent=text;
 renderList();
}
function detail(i=0,kind='agent'){
 $('message-form').classList.remove('internal');$('message-body').value='';$('notes-section').open=false;$('history-section').open=false;
 $('visibility-help').textContent='Visível para o cliente e para a equipe.';$('send-message').textContent='Enviar resposta';
 document.querySelectorAll('[data-mode]').forEach(e=>e.classList.toggle('selected',e.dataset.mode==='public'));

 $('empty-detail').hidden=true;$('ticket-detail').hidden=false;
 $('ticket-title').textContent=fixtures[i].title;$('ticket-number').textContent=fixtures[i].id+' · DADOS FICTÍCIOS';
 $('ticket-tags').replaceChildren(make('span','badge '+fixtures[i].status,fixtures[i].label),make('span','badge','Prioridade normal'));
 $('contract-info').textContent='Conta Exemplo · Contrato de suporte fictício · Consulte GEO';
 $('ticket-description').textContent='Precisamos revisar o acesso de uma pessoa da equipe. Gostaríamos de confirmar quais informações devem acompanhar a solicitação.';
 $('messages').replaceChildren();
 for(const [who,text] of [['Pessoa solicitante · 09:42','Bom dia! Qual é o procedimento para solicitar uma alteração de perfil?'],['Equipe de atendimento · 10:05','Olá! Informe qual acesso precisa ser ajustado e o contexto da solicitação. Assim poderemos orientar os próximos passos.']]){
  const msg=make('article','message');msg.append(make('small','',who),make('p','',text));$('messages').append(msg);
 }
 for(const id of ['assignment-form','priority-form','transition-area','note-tab','notes-section'])$(id).hidden=kind!=='agent';
 if(kind==='customer'){$('assignment-filter-label').hidden=true;$('identity-name').textContent='Portal do cliente · exemplo';}
 $('assignment-label').textContent='Sem responsável · exemplo de interface';
 $('next-status').replaceChildren(make('option','','Em atendimento'),make('option','','Aguardando cliente'));
 $('notes').replaceChildren();const note=make('article','message internal');note.append(make('small','','Equipe · nota interna fictícia'),make('p','','Confirmar o contexto antes de encaminhar a orientação.'));$('notes').append(note);
 $('history-list').replaceChildren();
 for(const title of ['Prioridade definida como normal','Solicitação recebida']){
  const li=make('li','history-event');li.append(make('small','','13 out 2026 · exemplo'),make('h4','',title),make('p','','Evento demonstrativo, sem operação no servidor.'));$('history-list').append(li);
 }
 document.querySelectorAll('.ticket-card').forEach((e,n)=>e.classList.toggle('selected',n===i));
}
function screen(name){
 for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
 for(const group of document.querySelectorAll('[data-advanced-access]')){group.hidden=true;group.inert=true;}
 $('demo-banner').hidden=false;$('demo-banner').textContent='VALIDAÇÃO VISUAL LOCAL · DADOS FICTÍCIOS · SEM CONEXÃO COM A API';
 if(name==='login'){$('app').hidden=true;$('login-screen').hidden=false;return;}
 baseApp();
 if(name==='inbox'){$('ticket-detail').hidden=true;$('empty-detail').hidden=false;return;}
 if(name==='paused'){
  $('operational-status').hidden=false;$('ticket-detail').hidden=true;$('empty-detail').hidden=false;
  $('ticket-list').replaceChildren();$('assignment-filter-label').hidden=true;
  for(const id of ['stat-total','stat-open','stat-wait','stat-done','nav-count'])$(id).textContent='—';
  $('new-ticket').disabled=true;$('refresh').disabled=true;
  for(const control of $('ticket-filters').querySelectorAll('input,select,button'))control.disabled=true;
  $('list-count').textContent='Consulta ainda não disponível';$('list-status').textContent='Seu acesso foi confirmado. A consulta será habilitada com o atendimento.';return;
 }
 if(name==='guide'){$('tickets-view').hidden=true;$('guide-view').hidden=false;return;}
 detail(0,name==='customer'?'customer':'agent');
 if(name==='internal'){$('composer-tabs').querySelector('[data-mode="internal"]').click();$('notes-section').open=true;}
 if(name==='history')$('history-section').open=true;
}
function createDialog(){
 $('context-choice').replaceChildren(make('option','','Conta Exemplo · Consulte GEO · Orientação — FICTÍCIO'));
 $('context-status').textContent='Opção de interface fictícia. Não consultada no servidor.';$('submit-create').disabled=false;
 $('create-dialog').showModal();
}
for(const form of document.querySelectorAll('form'))form.addEventListener('submit',event=>event.preventDefault());
$('new-ticket').addEventListener('click',createDialog);
$('close-dialog').addEventListener('click',()=>$('create-dialog').close());
$('cancel-create').addEventListener('click',()=>$('create-dialog').close());
for(const button of document.querySelectorAll('[data-view]'))button.addEventListener('click',()=>{
 const guide=button.dataset.view==='guide';$('guide-view').hidden=!guide;$('tickets-view').hidden=guide;$('breadcrumb').textContent=guide?'Operação / Arquitetura e estágio':'Operação / Chamados';
 document.querySelectorAll('[data-view]').forEach(e=>e.classList.toggle('active',e===button));
});
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>{
 const internal=button.dataset.mode==='internal';$('message-form').classList.toggle('internal',internal);
 document.querySelectorAll('[data-mode]').forEach(e=>e.classList.toggle('selected',e===button));
 $('send-message').textContent=internal?'Salvar nota interna':'Enviar resposta';
 $('visibility-help').textContent=internal?'Somente a equipe autorizada pode ler esta nota.':'Visível para o cliente e para a equipe.';
});
for(const id of ['logout','logout-mobile'])$(id).addEventListener('click',()=>screen('login'));
window.__HD_VISUAL_FIXTURE__={
 screen,detail,createDialog,
 advanced(id){screen('login');for(const group of document.querySelectorAll('[data-advanced-access]')){group.hidden=false;group.inert=false;}$(id).showModal();},
 longText(){screen('detail');$('ticket-title').textContent='Solicitação de exemplo com identificador '+('ABCDEFGHIJ'.repeat(25));$('contract-info').textContent='CONTEXTO_FICTICIO_'.repeat(25);$('history-section').open=true;},
 ready:true,
};
