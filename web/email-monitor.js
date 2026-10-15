/** Read-only email monitoring. Request must be the existing authenticated session
 * transport; identity changes destroy this instance. Private data stays in memory. */
export function createEmailMonitor(options){
 const schedule=options.schedule??((fn,ms)=>setTimeout(fn,ms)),cancel=options.cancel??clearTimeout;
 let generation=0,active=null,timer=null,visible=false,dead=false,revoked=false;
 let phase='idle',error='',filters={},cursor=null,eventId=null,intentId=null,list=null,delivery=null,recipient=null;
 const snapshot=()=>structuredClone({phase,error,visible,filters,cursor,eventId,intentId,list,delivery,recipient});
 const emit=()=>options.onChange?.(snapshot());
 function invalidate(){generation++;if(timer!==null)cancel(timer);timer=null;active?.abort();active=null;}
 function wipe(){list=delivery=recipient=null;cursor=eventId=intentId=null;}
 function arm(){if(!dead&&!revoked&&visible&&timer===null&&!active)timer=schedule(()=>{timer=null;return refresh();},15000);}
 function path(){const base='/email-communications';if(intentId)return base+'/'+encodeURIComponent(eventId)+'/recipients/'+encodeURIComponent(intentId);
  const query=new URLSearchParams(eventId?{}:filters);query.set('limit','25');if(cursor)query.set('cursor',cursor);
  return base+(eventId?'/'+encodeURIComponent(eventId):'')+'?'+query;
 }
 const number=v=>Number.isSafeInteger(v)&&v>=0,text=v=>typeof v==='string',date=v=>v===null||text(v)&&Number.isFinite(Date.parse(v));
 const validSummary=(s,total)=>s&&['sent','delivered','opened','clicked'].every(key=>{const m=s[key];return m&&m.total===total&&number(m.eligible)&&m.eligible<=total&&(m.count===null||number(m.count)&&m.count<=total);})&&s.states&&['pending','retry_wait','leased','sending','unknown','accepted','delivered','failed','suppressed'].every(key=>number(s.states[key]))&&number(s.attention);
 const validCommunication=v=>v&&['eventId','protocol','subject','kind'].every(key=>text(v[key]))&&date(v.createdAt)&&number(v.total)&&validSummary(v.summary,v.total);
 const validRecipient=v=>v&&['id','recipientDisplay','visibility','state','badge'].every(key=>text(v[key]))&&['sentAt','deliveredAt','openedAt','clickedAt'].every(key=>date(v[key]))&&['openAvailability','clickAvailability'].every(key=>['observed','not_observed','not_collected','unavailable'].includes(v[key]))&&typeof v.attention==='boolean';
 async function refresh(){
  if(dead||revoked||!visible||active)return;
  if(timer!==null)cancel(timer);timer=null;
  const own=generation,controller=new AbortController();active=controller;phase='loading';error='';emit();
  try{
   const value=await options.request(path(),{method:'GET',signal:controller.signal});
   if(own!==generation||dead)return;
   if(!value||typeof value.asOf!=='string'||!Number.isFinite(Date.parse(value.asOf)))throw Error('invalid_response');
   if(intentId){if(value.id!==intentId||value.eventId!==eventId||!text(value.recipientDisplay)||!text(value.state)||!Array.isArray(value.timeline)||!value.timeline.every(v=>text(v.kind)&&date(v.occurredAt)&&date(v.receivedAt))||!Array.isArray(value.attempts)||!value.attempts.every(v=>number(v.number)&&date(v.startedAt)))throw Error('invalid_response');recipient=value;}
   else{if(!Array.isArray(value.items)||!Number.isSafeInteger(value.total)||value.total<0||value.nextCursor!==null&&typeof value.nextCursor!=='string')throw Error('invalid_response');
    if(eventId){if(value.eventId!==eventId||!validCommunication(value)||!value.items.every(validRecipient))throw Error('invalid_response');delivery=value;}else{if(!value.items.every(validCommunication))throw Error('invalid_response');list=value;}}
   phase='ready';
  }catch(reason){
   if(own!==generation||dead)return;
   if([401,403,404].includes(reason?.status)||['stale_session','unauthorized','mfa_required'].includes(reason?.code)||reason?.message==='stale_session'){
    invalidate();wipe();filters={};revoked=true;phase='revoked';error='O acesso à consulta foi encerrado. Entre novamente ou atualize seu acesso.';
   }else if(cursor&&(reason?.status===409||reason?.code==='invalid_cursor')){
    cursor=null;if(eventId)delivery=null;else list=null;phase='error';error='A coleção mudou. Consulte novamente a primeira página.';
   }else{phase='error';error='Não foi possível atualizar. Tente consultar novamente.';}
  }finally{if(active===controller)active=null;if(own===generation&&!dead){emit();arm();}}
  // Access failures invalidate the generation as well as the transport.
  if(revoked&&!dead)emit();
 }
 async function setVisible(value){if(dead||revoked)return;const next=!!value;if(next===visible)return;visible=next;invalidate();if(visible)return refresh();phase='idle';emit();}
 async function setFilters(value){if(dead||revoked)return;invalidate();wipe();filters=Object.fromEntries(Object.entries(value??{}).filter(([key,v])=>['from','to','account_id','work_id','kind','status','q','recipient'].includes(key)&&typeof v==='string'&&v!==''));error='';phase='idle';emit();return refresh();}
 async function openDelivery(id){if(dead||revoked)return;invalidate();eventId=id;intentId=null;cursor=null;delivery=recipient=null;phase='idle';error='';emit();return refresh();}
 async function closeDelivery(){if(dead||revoked)return;invalidate();eventId=intentId=cursor=null;delivery=recipient=null;phase='idle';error='';emit();return refresh();}
 async function openRecipient(id){if(dead||revoked||!eventId)return;invalidate();intentId=id;recipient=null;phase='idle';error='';emit();return refresh();}
 async function closeRecipient(){if(dead||revoked)return;invalidate();intentId=null;recipient=null;phase='idle';error='';emit();return refresh();}
 async function nextPage(){if(dead||revoked||intentId||active)return;const page=eventId?delivery:list;if(!page?.nextCursor)return;invalidate();cursor=page.nextCursor;if(eventId)delivery=null;else list=null;emit();return refresh();}
 async function firstPage(){if(dead||revoked||active)return;invalidate();cursor=null;if(eventId)delivery=null;else list=null;emit();return refresh();}
 function clear(){invalidate();dead=true;visible=false;wipe();filters={};phase='cleared';error='';emit();}
 return Object.freeze({snapshot,setVisible,setFilters,refresh,openDelivery,closeDelivery,openRecipient,closeRecipient,nextPage,firstPage,clear});
}

export function emailDate(value){if(!value||!Number.isFinite(Date.parse(value)))return '—';const p=new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));const get=key=>p.find(x=>x.type===key)?.value;return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;}
export function emailSignal(value,availability){if(value)return emailDate(value);if(availability==='not_collected')return 'N/D — coleta não disponível';if(availability==='unavailable')return 'N/D — informação indisponível';return '—';}
export function emailMetric(metric,engagement=false){
 if(!metric||metric.count===null||metric.eligible===0&&metric.count===0)return {value:'N/D',coverage:'Coleta não disponível'};
 const partial=metric.eligible<metric.total;
 // count includes every known fact, including historical sends outside eligible.
 // Without a separate cohort numerator, partial coverage cannot yield a rate.
 if(partial&&metric.count>0||metric.count>metric.eligible)return {value:String(metric.count)+(metric.count===1?' observado':' observados'),coverage:(metric.eligible===0?'Cobertura indisponível; '+metric.total+' destinatários no grupo':'Cobertura parcial: '+metric.eligible+' de '+metric.total+' destinatários')+'. A contagem inclui fatos históricos; não representa taxa da coorte.'};
 return {value:metric.count+' / '+(engagement?metric.eligible:metric.total)+(engagement&&partial?' com coleta':''),coverage:partial?'Cobertura: '+metric.eligible+' de '+metric.total+' destinatários':'Cobertura: '+metric.total+' destinatários'};
}

const stateNames={pending:'Na fila',retry_wait:'Aguardando nova tentativa',leased:'Em envio',sending:'Em envio',unknown:'Resultado desconhecido',accepted:'Saiu',delivered:'Entregue',failed:'Falhou',suppressed:'Suprimido'};
const kindNames={'support.created':'Abertura','support.devolutiva':'Informações solicitadas','support.resolved':'Solução','support.closed':'Encerramento','support.reopened':'Reabertura','support.cancelled':'Cancelamento','support.reply':'Resposta pública','support.customer_reply':'Resposta do solicitante','internal.queue_created':'Fila de atendimento','internal.assignment_changed':'Atribuição','email.sent':'Aceite do provedor','email.delivered':'Entrega confirmada','email.opened':'Abertura aproximada','email.clicked':'Acesso a link','email.failed':'Falha','email.bounced':'Falha informada pelo provedor'};
const timelineNames={communication:'Comunicação criada',queued:'Entrada na fila',accepted:'Aceite do provedor',delivered:'Entrega confirmada',opened:'Abertura aproximada',clicked:'Acesso a link',failed:'Falha',suppressed:'Suprimido','provider.accepted':'Aceite do provedor','provider.delivered':'Entrega confirmada','provider.failed':'Falha'};
export function emailTimelineLabel(kind){return timelineNames[kind]??kindNames[kind]??'Evento registrado';}
export function emailStatusOptions(){return [['all','Todas'],['queue','Fila'],['attention','Requer atenção'],...Object.entries(stateNames)];}
// Normalized reasons in notification-delivery.ts, outbox-dispatch.ts and the
// Resend sender. These descriptions never infer a mailbox or bounce cause.
const reasonDescriptions={
 rejected:'Não houve aceite do envio; a tentativa foi recusada.',
 rate_limited:'O serviço de envio limitou a frequência das solicitações.',
 temporarily_unavailable:'Foi registrada indisponibilidade temporária no serviço de envio.',
 send_confirmation_unknown:'Não foi possível confirmar o resultado do envio. A equipe pode verificar a conciliação.',
 contradictory_provider_event:'Há evidências do provedor conflitantes. A equipe pode verificar a conciliação.',
 intent_expired:'O prazo autorizado desta intenção de envio expirou.',
 recipient_unavailable:'A verificação do destinatário não pôde ser concluída.',
 recipient_revoked:'A autorização de envio ao destinatário não está mais disponível.',
 recipient_changed:'A verificação do destinatário ou do conteúdo autorizado encontrou uma mudança.',
 template_unavailable:'Não foi possível usar o modelo de e-mail autorizado.',
 unsent_lease_expired:'A reserva de processamento expirou antes do envio.',
 ledger_confirmation_unknown:'O resultado da gravação do envio não foi confirmado.'
};
export function emailReason(reason){
 if(reason===null||reason===undefined)return null;
 const code=typeof reason==='string'&&/^[a-z][a-z0-9_]{0,119}$/.test(reason)?reason:'unclassified';
 return {code,description:Object.hasOwn(reasonDescriptions,code)?reasonDescriptions[code]:'Motivo operacional registrado; a equipe responsável pode verificar a configuração e a conciliação.'};
}
export function emailPendingAge(detail){
 const age=detail?.pendingAgeSeconds;
 if(!['pending','retry_wait','leased','sending','unknown'].includes(detail?.state)||!Number.isSafeInteger(age)||age<0)return null;
 let remaining=age;const parts=[];
 for(const [unit,singular,plural] of [[86400,'dia','dias'],[3600,'h','h'],[60,'min','min'],[1,'s','s']]){const amount=Math.floor(remaining/unit);remaining%=unit;if(amount)parts.push(amount+' '+(amount===1?singular:plural));}
 return 'Pendente desde o enfileiramento: '+(parts.join(' ')||'0 s')+' (na última leitura).';
}

/** Convert a wall clock filter in the displayed zone. Round-trip verification
 * rejects impossible dates and gaps rather than silently changing the interval. */
export function emailFilterInstant(raw){
 if(!raw)return '';
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw))throw Error('Confira o período.');
 const [y,m,d,h,min]=raw.split(/[-T:]/).map(Number),wall=Date.UTC(y,m-1,d,h,min);
 const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const parts=at=>Object.fromEntries(fmt.formatToParts(new Date(at)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
 let at=wall;
 for(let i=0;i<3;i++){const p=parts(at),display=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute);at+=wall-display;}
 const p=parts(at);if(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`!==raw)throw Error('Confira o período.');
 return new Date(at).toISOString();
}

export function mountEmailMonitor(root,options){
 const doc=root.ownerDocument,win=doc.defaultView,abort=new win.AbortController(),signal=abort.signal;
 const prefix='email-'+crypto.randomUUID();let disposed=false,selected=false,returnTo=null,recipientReturn=null,lastList='',lastDelivery='',lastRecipient='';
 const node=(tag,text,cls)=>{const n=doc.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,action,key)=>{const n=node('button',text,'secondary');n.type='button';if(key)n.dataset.emailFocus=key;n.addEventListener('click',action,{signal});return n;};
 const heading=node('h1','Comunicações por e-mail');heading.tabIndex=-1;root.classList.add('email-monitor');
 const intro=node('p','Situação atual das comunicações originadas no período selecionado. Horários em America/Sao_Paulo.','muted');
 const shortcuts=node('div',undefined,'email-shortcuts'),form=node('form',undefined,'email-filters');form.setAttribute('aria-label','Filtrar comunicações por e-mail');
 const fields={};
 function field(key,label,type='text'){const wrap=node('label',label),input=node('input');input.name=key;input.type=type;input.autocomplete='off';input.maxLength=240;wrap.append(input);form.append(wrap);fields[key]=input;return input;}
 field('q','Protocolo ou chamado','search');field('from','A partir de (America/Sao_Paulo)','datetime-local');field('to','Antes de (America/Sao_Paulo)','datetime-local');field('account_id','Conta autorizada (identificador)');field('work_id','Obra autorizada (identificador)');field('kind','Tipo de notificação');
 const statusLabel=node('label','Situação'),status=node('select');status.name='status';for(const [value,text] of emailStatusOptions()){const o=node('option',text);o.value=value;status.append(o);}statusLabel.append(status);form.append(statusLabel);fields.status=status;
 if(options.admin)field('recipient','Destinatário completo (admin)','email');
 const filterActions=node('div',undefined,'email-filter-actions'),submit=node('button','Aplicar filtros','primary');submit.type='submit';filterActions.append(submit,button('Limpar',()=>{form.reset();void controller.setFilters({});}));form.append(filterActions);
 const feedback=node('p','', 'email-status');feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 const retry=button('Tentar consultar novamente',()=>void controller.refresh()),count=node('p','', 'email-count'),listArea=node('div',undefined,'email-list');
 const listPager=node('div',undefined,'email-pagination'),listFirst=button('Primeira página',()=>void controller.firstPage(),'list-first'),listNext=button('Próxima página',()=>void controller.nextPage(),'list-next');listPager.append(listFirst,listNext);
 const dialog=node('dialog',undefined,'email-delivery-dialog');dialog.setAttribute('aria-labelledby',prefix+'-title');dialog.setAttribute('aria-describedby',prefix+'-subtitle');
 const head=node('header',undefined,'email-dialog-head'),title=node('h2','Entrega do e-mail');title.id=prefix+'-title';
 const close=button('×',()=>void controller.closeDelivery(),'close');close.setAttribute('aria-label','Fechar entrega do e-mail');
 head.append(title,close);const subtitle=node('p','', 'email-subtitle');subtitle.id=prefix+'-subtitle';
 const body=node('div',undefined,'email-dialog-body'),modalStatus=node('p','', 'email-status');modalStatus.setAttribute('role','status');modalStatus.setAttribute('aria-live','polite');
 const modalRetry=button('Tentar consultar novamente',()=>void controller.refresh(),'modal-retry'),reading=node('p','', 'email-reading'),overview=node('div'),metrics=node('div',undefined,'email-metrics'),attention=node('p','', 'email-attention'),explanation=node('aside',undefined,'email-explanation');
 explanation.append(node('h3','Como interpretar os sinais'));
 for(const [label,text] of [
  ['Saiu','O provedor aceitou o envio. Isso ainda não confirma a entrega.'],
  ['Entregue','O provedor informou a entrega ao servidor de destino. Isso não garante caixa de entrada nem leitura.'],
  ['Aberto*','Sinal aproximado de carregamento de imagem. Proteções de privacidade e bloqueio de imagens podem distorcer a medição.'],
  ['Clicou','Foi registrado acesso a um link rastreado. Esse sinal não identifica, por si só, a pessoa que clicou.']
 ]){const p=node('p'),strong=node('strong',label+': ');p.append(strong,doc.createTextNode(text));explanation.append(p);}
 explanation.append(node('p','Abertura e clique não equivalem a ciência, aceite ou confirmação de leitura.'));
 const zone=node('p','Horários em America/Sao_Paulo · —: evento não observado em coleta aplicável · N/D: coleta ausente ou indisponível.','email-reading');
 const tableWrap=node('div',undefined,'email-recipient-scroll');tableWrap.tabIndex=0;tableWrap.setAttribute('aria-label','Destinatários; tabela com rolagem horizontal e vertical');
 const table=node('table'),caption=node('caption','Entrega por destinatário'),thead=node('thead'),tr=node('tr');for(const text of ['Destinatário','Status','Enviado','Entregue','Aberto*','Clicou','Detalhe']){const th=node('th',text);th.scope='col';tr.append(th);}thead.append(tr);const tbody=node('tbody');table.append(caption,thead,tbody);tableWrap.append(table);
 const recipientTotal=node('p','', 'email-reading'),modalPager=node('div',undefined,'email-pagination'),modalFirst=button('Primeira página',()=>void controller.firstPage(),'modal-first'),modalNext=button('Próxima página',()=>void controller.nextPage(),'modal-next');modalPager.append(modalFirst,modalNext);
 overview.append(metrics,attention,explanation,zone,recipientTotal,tableWrap,modalPager);
 const recipientPanel=node('section',undefined,'email-recipient-detail'),back=button('Voltar à entrega',()=>void controller.closeRecipient(),'recipient-back'),recipientContent=node('div');recipientPanel.append(back,node('h3','Detalhes do destinatário'),recipientContent);recipientPanel.hidden=true;
 body.append(modalStatus,modalRetry,reading,overview,recipientPanel);const foot=node('footer',undefined,'email-dialog-foot');foot.append(button('Fechar',()=>void controller.closeDelivery(),'footer-close'));dialog.append(head,subtitle,body,foot);
 root.replaceChildren(heading,intro,shortcuts,form,feedback,retry,count,listArea,listPager,dialog);

 function restoreFocus(key){if(!key)return;const target=[...root.querySelectorAll('[data-email-focus]')].find(n=>n.dataset.emailFocus===key);target?.focus({preventScroll:true});}
 function render(view){
  if(disposed)return;
  const focused=doc.activeElement,focusKey=root.contains(focused)?focused?.dataset.emailFocus:null;
  const value=view.eventId?(view.intentId?view.recipient:view.delivery):view.list,busy=view.phase==='loading';
  const message=view.phase==='error'||view.phase==='revoked'?view.error:busy?(value?'Atualizando consulta…':'Carregando consulta…'):'';
  feedback.textContent=view.eventId?'':message;modalStatus.textContent=view.eventId?message:'';
  retry.hidden=!!view.eventId||view.phase!=='error';modalRetry.hidden=!view.eventId||view.phase!=='error';
  for(const control of form.elements)control.disabled=view.phase==='revoked';
  for(const control of shortcuts.querySelectorAll('button'))control.disabled=view.phase==='revoked';
  if(view.phase==='revoked'||view.phase==='cleared')form.reset();
  root.setAttribute('aria-busy',String(busy&&!view.eventId));
  const listKey=JSON.stringify(view.list);
  if(listKey!==lastList){lastList=listKey;listArea.replaceChildren();
   if(view.list){for(const item of view.list.items){const article=node('article',undefined,'email-communication'),content=node('div'),h=node('h2',item.protocol+' · '+item.subject),meta=node('p',(kindNames[item.kind]??'Notificação de chamado')+' · '+emailDate(item.createdAt)+' · '+item.total+' destinatário(s)');
    const sent=emailMetric(item.summary?.sent),delivered=emailMetric(item.summary?.delivered);const brief=node('p','Saiu: '+sent.value+' · Entregue: '+delivered.value,'email-reading');
    const open=button('Ver entrega',()=>{returnTo=open;void controller.openDelivery(item.eventId);},'event-'+item.eventId);open.dataset.eventId=item.eventId;content.append(h,meta,brief);article.append(content,open);listArea.append(article);}
    if(!view.list.items.length)listArea.append(node('p','Nenhuma comunicação encontrada. Ajuste os filtros.'));
   }
  }
  count.textContent=view.list?view.list.total+' comunicações · situação em '+emailDate(view.list.asOf)+' (America/Sao_Paulo)':'';
  listPager.hidden=!view.list||!!view.eventId;listFirst.disabled=busy||!view.cursor;listNext.disabled=busy||!view.list?.nextCursor;
  if(!view.eventId){
   if(dialog.open){dialog.close();const fallback=returnTo?.isConnected?returnTo:heading;fallback.focus({preventScroll:true});}
   else if(focusKey&&!focused?.isConnected)restoreFocus(focusKey);
   lastDelivery=lastRecipient='';metrics.replaceChildren();tbody.replaceChildren();recipientContent.replaceChildren();subtitle.textContent='';reading.textContent='';return;
  }
  if(!dialog.open){dialog.showModal();close.focus();}
  const scrollTop=tableWrap.scrollTop,scrollLeft=tableWrap.scrollLeft,bodyTop=body.scrollTop;
  const valueKey=JSON.stringify(view.delivery);
  if(valueKey!==lastDelivery){lastDelivery=valueKey;metrics.replaceChildren();tbody.replaceChildren();
   const d=view.delivery;
   if(d){subtitle.textContent=d.protocol+' · '+d.subject+' · '+(kindNames[d.kind]??'Notificação de chamado');
    for(const [key,label] of [['sent','Saiu'],['delivered','Entregue'],['opened','Aberto*'],['clicked','Clicou']]){const metric=emailMetric(d.summary[key],key==='opened'||key==='clicked'),card=node('article',undefined,'email-metric');card.append(node('h3',label),node('p',metric.value,'email-metric-value'),node('small',metric.coverage));metrics.append(card);}
    const states=d.summary.states??{};attention.textContent=[['Na fila',(states.pending??0)+(states.retry_wait??0)],['Em envio',(states.leased??0)+(states.sending??0)],['Falhou',states.failed??0],['Suprimido',states.suppressed??0],['Requer atenção',d.summary.attention??0]].filter(([,n])=>n>0).map(([label,n])=>label+': '+n).join(' · ');attention.hidden=!attention.textContent;
    recipientTotal.textContent=d.total+' destinatário(s) autorizado(s) · página com '+d.items.length+' linha(s)';
    for(const rec of d.items){const row=node('tr'),who=node('td',rec.recipientDisplay),identity=node('small','Referência: '+rec.id);who.append(node('br'),identity);const statusCell=node('td'),badge=node('span',rec.badge??stateNames[rec.state]??'Requer atenção','email-badge');statusCell.append(badge);row.append(who,statusCell,node('td',emailDate(rec.sentAt)),node('td',emailDate(rec.deliveredAt)),node('td',emailSignal(rec.openedAt,rec.openAvailability)),node('td',emailSignal(rec.clickedAt,rec.clickAvailability)));
     const detailCell=node('td'),detail=button('Detalhes',()=>{recipientReturn='recipient-'+rec.id;void controller.openRecipient(rec.id);},'recipient-'+rec.id);detail.setAttribute('aria-label','Detalhes de '+rec.recipientDisplay+' — referência '+rec.id);detailCell.append(detail);row.append(detailCell);tbody.append(row);
    }
    if(!d.items.length){const row=node('tr'),cell=node('td','Sem dados de entrega. Não há registros por destinatário nesta comunicação.');cell.colSpan=7;row.append(cell);tbody.append(row);}
   }else{subtitle.textContent='Consultando comunicação…';recipientTotal.textContent='';attention.textContent='';}
  }
  overview.hidden=!!view.intentId||!view.delivery;recipientPanel.hidden=!view.intentId;
  const recipientKey=JSON.stringify(view.recipient);
  if(recipientKey!==lastRecipient){lastRecipient=recipientKey;recipientContent.replaceChildren();const rec=view.recipient;if(rec){
   recipientContent.append(node('h4',rec.recipientDisplay),node('p','Estado operacional: '+(stateNames[rec.state]??'Requer atenção')));
   recipientContent.append(node('p','Referência da intenção: '+rec.id),node('p','Referência do evento: '+rec.eventId));
   if(rec.attention)recipientContent.append(node('p','Requer atenção.','email-attention'));
   const reason=emailReason(rec.reason);if(reason)recipientContent.append(node('p','Código do motivo: '+reason.code),node('p',reason.description));
   const pendingAge=emailPendingAge(rec);if(pendingAge)recipientContent.append(node('p',pendingAge));
   recipientContent.append(node('p','Próxima tentativa: '+(rec.nextAttemptAt?emailDate(rec.nextAttemptAt)+' (previsão do agendador)':'Sem previsão registrada')));
   const timeline=node('ol');for(const item of rec.timeline){const li=node('li',emailTimelineLabel(item.kind)+' · Ocorreu em '+emailDate(item.occurredAt)+' · Recebido em '+emailDate(item.receivedAt));timeline.append(li);}recipientContent.append(node('h4','Linha do tempo'),timeline);
   const attempts=node('ul');for(const item of rec.attempts)attempts.append(node('li','Tentativa '+item.number+' · '+emailDate(item.startedAt)));recipientContent.append(node('h4','Tentativas'),attempts);
   if(options.admin&&rec.providerMessageId)recipientContent.append(node('p','Referência do provedor: '+rec.providerMessageId));
   if(options.admin&&rec.template&&typeof rec.template==='object'){if(rec.template.version!==undefined)recipientContent.append(node('p','Versão de template: '+rec.template.version));if(typeof rec.template.hash==='string')recipientContent.append(node('p','Hash de template: '+rec.template.hash));}
  }}
  reading.textContent=value?'Comunicação: '+emailDate(view.delivery?.createdAt)+' · Última leitura: '+emailDate(value.asOf)+' · America/Sao_Paulo':'';
  modalFirst.disabled=busy||!view.cursor;modalNext.disabled=busy||!view.delivery?.nextCursor;
  tableWrap.scrollTop=scrollTop;tableWrap.scrollLeft=scrollLeft;body.scrollTop=bodyTop;
  if(view.intentId&&focusKey?.startsWith('recipient-')&&focusKey!=='recipient-back')back.focus({preventScroll:true});
  else if(!view.intentId&&focusKey==='recipient-back')restoreFocus(recipientReturn);
  else if(focusKey&&!focused?.isConnected)restoreFocus(focusKey);
 }
 const controller=createEmailMonitor({...options,onChange:render});
 for(const [label,value] of [['Histórico','all'],['Fila','queue'],['Falhas e atenção','attention']]){const shortcut=button(label,()=>{status.value=value;void controller.setFilters({...controller.snapshot().filters,status:value});});shortcuts.append(shortcut);}
 form.addEventListener('submit',event=>{event.preventDefault();try{const filters=Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,['from','to'].includes(key)?emailFilterInstant(input.value):input.value.trim()]));if(filters.from&&filters.to&&filters.from>=filters.to)throw Error('Confira o período.');void controller.setFilters(filters);}catch{feedback.textContent='Confira o período e informe datas válidas, com início anterior ao fim.';}},{signal});
 dialog.addEventListener('cancel',event=>{event.preventDefault();void controller.closeDelivery();},{signal});
 dialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const nodes=[...dialog.querySelectorAll('button,input,select,[tabindex="0"]')].filter(n=>!n.disabled&&!n.hidden&&n.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&doc.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();first?.focus();}},{signal});
 const visibility=()=>void controller.setVisible(selected&&doc.visibilityState!=='hidden');doc.addEventListener('visibilitychange',visibility,{signal});render(controller.snapshot());
 return Object.freeze({setVisible(value){selected=!!value;return controller.setVisible(selected&&doc.visibilityState!=='hidden');},refresh:controller.refresh,snapshot:controller.snapshot,destroy(){if(disposed)return;disposed=true;abort.abort();controller.clear();if(dialog.open)dialog.close();root.replaceChildren();}});
}
