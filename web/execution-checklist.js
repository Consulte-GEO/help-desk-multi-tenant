import {createExecutionChecklistController} from './execution-checklist-state.js';

let sequence=0;
const statusText={pending:'Pendente',done:'Concluído',not_applicable:'Não aplicável'};
/** Optional INTERNAL surface. The host owns Auth, scopes, current context, routing,
 * notes and deployment. Call clear/changeAudience on every audience change; do not
 * put this panel in a customer/public DOM, even hidden. Nothing auto-mounts/loads.
 */
export function mountExecutionChecklist(root,options){
 const doc=root.ownerDocument,prefix='execution-checklist-'+(++sequence),listeners=[];
 let rowTexts=[],rowNodes=[],rowListeners=[],reviewTexts=[],lastRows='',lastPhase='',returnFocus=null;
 let noteNodes=[],noteTexts=[],noteListeners=[],lastEvidence='',selectedNodes=[],selectedTexts=[],selectedListeners=[],lastSelected='';
 const el=(tag,text='',attrs={})=>{const e=doc.createElement(tag);if(text)e.textContent=text;for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
 const listen=(target,type,fn,owner=listeners)=>{target.addEventListener(type,fn);owner.push([target,type,fn]);};
 const button=(text,fn,attrs={},owner=listeners)=>{const b=el('button',text,{type:'button',...attrs});listen(b,'click',fn,owner);return b;};
 const section=el('section','',{class:'execution-checklist','aria-labelledby':prefix+'-title'});
 const heading=el('div','',{class:'checklist__heading'}),textGroup=el('div');
 textGroup.append(el('p','Uso interno · Equipe Consulte',{class:'checklist__eyebrow'}),el('h2','Checklist de execução',{id:prefix+'-title'}));
 const refresh=button('Atualizar checklist',()=>void controller.load(),{'data-checklist-refresh':'',class:'checklist__secondary'});
 heading.append(textGroup,refresh);
 const description=el('p','Registre a conferência de cada etapa antes de resolver o chamado. Marcar um item não executa ações no GEO.',{class:'checklist__description'});
 const summary=el('div','',{class:'checklist__summary'}),progress=el('p','',{'data-checklist-progress':''}),revision=el('p','',{class:'checklist__muted'});
 const meter=el('progress','',{'data-checklist-meter':'','aria-label':'Itens obrigatórios conferidos'});meter.hidden=true;
 summary.append(progress,meter,revision);
 const status=el('p','',{'data-checklist-status':'',role:'status','aria-live':'polite',class:'checklist__status'});
 const reconcile=button('Conciliar marcação',()=>void controller.reconcile(),{'data-checklist-reconcile':'',class:'checklist__primary'});reconcile.hidden=true;
 const rows=el('ol','',{class:'checklist__items'});
 const finalNotice=el('p','A conclusão exibida é informativa. A resolução exige nova validação de acesso, revisão e evidências no servidor.',{class:'checklist__muted'});
 const dialog=el('dialog','',{'data-checklist-dialog':'','aria-labelledby':prefix+'-dialog-title',class:'checklist__dialog'}),dialogTitle=el('h3','',{id:prefix+'-dialog-title'});
 const form=el('form','',{class:'checklist__form'});
 const fields=[];
 function field(label,name,tag){const box=el('div','',{class:'checklist__field'}),id=prefix+'-'+name,labelEl=el('label',label,{for:id}),input=el(tag,'',{id,'data-checklist-field':name});
  fields.push(input);box.append(labelEl,input);return {box,input};}
 const situation=field('Situação do item','status','select');
 situation.input.append(el('option','Concluído',{value:'done'}),el('option','Não aplicável',{value:'not_applicable'}),el('option','Voltar para pendente',{value:'pending'}));
 const evidenceBox=el('div','',{class:'checklist__field','data-checklist-evidence':''});
 const evidenceTitle=el('h4','Notas de conferência'),evidenceStatus=el('p','',{role:'status','aria-live':'polite','data-checklist-evidence-status':''});
 const evidenceHelp=el('p','Escolha notas que você já registrou neste chamado. O texto permanece na conversa. O servidor confere vínculo, autoria e data antes de aceitar a marcação.',{class:'checklist__hint'});
 const evidenceActions=el('div','',{class:'checklist__actions'}),loadNotes=button('Consultar minhas notas',()=>void controller.loadEvidence(),{'data-checklist-load-notes':'',class:'checklist__secondary'}),moreNotes=button('Notas anteriores',()=>void controller.loadEvidence(true),{'data-checklist-more-notes':'',class:'checklist__secondary'});
 const evidenceList=el('div','',{class:'checklist__evidence-options'}),selectedList=el('div','',{class:'checklist__evidence-selected'});
 evidenceActions.append(loadNotes,moreNotes);evidenceBox.append(evidenceTitle,evidenceHelp,evidenceActions,evidenceStatus,evidenceList,selectedList);
 const reason=field('Motivo ou observação','reason','textarea');reason.input.setAttribute('rows','3');reason.input.setAttribute('maxlength','2000');reason.input.setAttribute('autocomplete','off');
 const reasonHint=el('p','Obrigatório para dispensar um item permitido ou desfazer uma marcação. O histórico anterior é preservado.',{id:prefix+'-reason-help',class:'checklist__hint'});reason.input.setAttribute('aria-describedby',prefix+'-reason-help');reason.box.append(reasonHint);
 const risk=el('div','',{class:'checklist__risk'}),riskText=el('p','Ação sensível: confira o procedimento e a evidência antes de marcar. Esta declaração não substitui uma aprovação exigida na origem.');
 const ack=el('input','',{type:'checkbox',id:prefix+'-ack','data-checklist-field':'acknowledgeRisk'}),ackLabel=el('label','Reconheço o risco e conferi a execução',{for:prefix+'-ack'}),ackRow=el('div','',{class:'checklist__ack'});fields.push(ack);ackRow.append(ack,ackLabel);risk.append(riskText,ackRow);
 for(const [field,name] of [[situation,'status'],[reason,'reason']])
  listen(field.input,field===situation?'change':'input',()=>controller.setField(name,field.input.value));
 // Use explicit field identifiers rather than interpreting DOM as a command.
 listen(ack,'change',()=>controller.setField('acknowledgeRisk',ack.checked));
 const editActions=el('div','',{class:'checklist__actions'}),cancelEdit=button('Cancelar',()=>controller.cancel(),{class:'checklist__secondary'}),reviewButton=el('button','Revisar marcação',{type:'submit',class:'checklist__primary'});
 editActions.append(cancelEdit,reviewButton);form.append(situation.box,evidenceBox,reason.box,risk,editActions);
 listen(form,'submit',event=>{event.preventDefault();if(!controller.review()){dialogStatus.focus();}});
 const reviewBox=el('div','',{class:'checklist__review'}),reviewData=el('dl'),reviewNotice=el('p','A marcação não executa ações no GEO. Confirme somente após conferir os dados e a execução.',{class:'checklist__risk'});
 const reviewActions=el('div','',{class:'checklist__actions'}),cancelReview=button('Cancelar',()=>controller.cancel(),{class:'checklist__secondary'}),back=button('Voltar',()=>controller.back(),{class:'checklist__secondary'}),confirm=button('Confirmar marcação',()=>void controller.confirm(),{class:'checklist__primary'});
 reviewActions.append(cancelReview,back,confirm);reviewBox.append(reviewData,reviewNotice,reviewActions);
 const dialogStatus=el('p','',{role:'status','aria-live':'polite',tabindex:'-1',class:'checklist__status'}),step=el('p','',{class:'checklist__step','data-checklist-step':''});dialog.append(step,dialogTitle,dialogStatus,form,reviewBox);
 listen(dialog,'cancel',event=>{event.preventDefault();controller.cancel();});
 section.append(heading,description,summary,status,reconcile,rows,finalNotice,dialog);root.replaceChildren(section);
 function wipeSelected(){lastSelected='';for(const [target,type,fn] of selectedListeners)target.removeEventListener(type,fn);selectedListeners=[];for(const node of selectedTexts)node.textContent='';for(const node of selectedNodes){node.value='';node.checked=false;node.disabled=true;node.removeAttribute('data-checklist-selected-note');}selectedNodes=[];selectedTexts=[];selectedList.replaceChildren();}
 function wipeNotes(){wipeSelected();for(const [target,type,fn] of noteListeners)target.removeEventListener(type,fn);noteListeners=[];for(const node of noteTexts)node.textContent='';for(const node of noteNodes){node.value='';node.checked=false;node.disabled=true;node.removeAttribute('data-checklist-note');node.removeAttribute('data-checklist-selected-note');}noteNodes=[];noteTexts=[];evidenceList.replaceChildren();selectedList.replaceChildren();evidenceStatus.textContent='';lastEvidence='';}
 function renderEvidence(state){
  const ev=state.evidence,enabled=state.phase==='editing'&&state.draft?.status==='done';
  evidenceBox.hidden=state.draft?.status!=='done';loadNotes.disabled=!enabled||ev.phase==='loading';moreNotes.hidden=!ev.next;moreNotes.disabled=!enabled||ev.phase==='loading';
  reviewButton.disabled=ev.phase==='loading';
  const stamp=JSON.stringify({items:ev.items,phase:ev.phase,enabled});
  if(stamp!==lastEvidence){wipeNotes();lastEvidence=stamp;
   for(const [index,note] of ev.items.entries()){
    const row=el('div','',{class:'checklist__evidence-option'}),input=el('input','',{type:'checkbox',id:prefix+'-note-'+index,'data-checklist-note':note.id});
    const label=el('label','Sua nota de '+formatTime(note.at)+' · '+note.id.slice(-8).toUpperCase(),{for:prefix+'-note-'+index});listen(input,'change',()=>controller.toggleEvidence(note.id),noteListeners);noteNodes.push(input);noteTexts.push(label);row.append(input,label);evidenceList.append(row);
   }
  }
  // Keep the active input/focus in place while its selected state changes.
  for(const [index,input] of noteNodes.entries()){input.checked=ev.selected.some(n=>n.id===ev.items[index].id);input.disabled=!enabled||ev.phase!=='ready';}
  evidenceStatus.textContent=ev.message||'Consulte suas notas para selecionar uma evidência.';
  const selectionStamp=JSON.stringify({selected:ev.selected,enabled,phase:ev.phase});
  if(selectionStamp!==lastSelected){
   const focused=doc.activeElement?.getAttribute?.('data-checklist-selected-note');
   wipeSelected();lastSelected=selectionStamp;
   for(const note of ev.selected){const row=el('p'),label=el('span','Selecionada · '+formatTime(note.at)+' · '+note.id.slice(-8).toUpperCase()+' '),remove=button('Remover seleção',()=>controller.toggleEvidence(note.id),{'data-checklist-selected-note':note.id,'aria-label':'Remover seleção da nota de '+formatTime(note.at),class:'checklist__secondary'},selectedListeners);remove.disabled=!enabled||ev.phase!=='ready';selectedNodes.push(remove);selectedTexts.push(label,remove);row.append(label,remove);selectedList.append(row);}
   if(focused&&enabled){const target=selectedNodes.find(n=>n.getAttribute?.('data-checklist-selected-note')===focused)??noteNodes.find(n=>n.getAttribute?.('data-checklist-note')===focused)??loadNotes;if(!target.disabled)target.focus();}
  }

 }
 function wipeFields(){wipeNotes();for(const input of fields){input.value='';if('checked' in input)input.checked=false;input.disabled=true;}dialogTitle.textContent='';dialogStatus.textContent='';step.textContent='';}
 function wipeRows(){for(const [target,type,fn] of rowListeners)target.removeEventListener(type,fn);rowListeners=[];for(const node of rowTexts)node.textContent='';for(const row of rowNodes)row.removeAttribute('data-checklist-item');rowTexts=[];rowNodes=[];rows.replaceChildren();lastRows='';returnFocus=null;}
 function wipeReview(){for(const node of reviewTexts)node.textContent='';reviewTexts=[];reviewData.replaceChildren();}
 function formatTime(at){try{return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}).format(new Date(at));}catch{return 'Data indisponível';}}
 function render(state){
  section.setAttribute('aria-busy',String(state.phase==='loading'||state.phase==='saving'));
  status.textContent=state.message;if(state.phase!=='error')status.setAttribute('data-response-diagnostic','');
  refresh.disabled=!['idle','ready','refresh_required','error'].includes(state.phase);
  reconcile.hidden=state.phase!=='unknown';reconcile.disabled=state.phase==='saving';
  progress.textContent=state.requiredTotal===null?'Nenhuma revisão carregada.':state.requiredCompleted+' de '+state.requiredTotal+' itens obrigatórios conferidos';
  meter.hidden=state.requiredTotal===null;
  if(!meter.hidden){meter.setAttribute('max',String(state.requiredTotal));meter.setAttribute('value',String(state.requiredCompleted));}else{meter.removeAttribute('max');meter.removeAttribute('value');}
  revision.textContent=state.record?'Revisão do chamado '+state.record.context.ticketVersion+' · Checklist '+(state.record.snapshot?.revision??0)+' · '+formatTime(state.record.readAt):'';
  const stamp=state.record?JSON.stringify(state.record):'';
  if(stamp!==lastRows){wipeRows();lastRows=stamp;
   for(const item of state.record?.template.items??[]){
    const entry=state.record.snapshot?.entries.find(e=>e.itemId===item.id),li=el('li','',{'data-checklist-item':item.id,class:'checklist__item'}),content=el('div','',{class:'checklist__item-content'});
    const label=el('h3',item.label),badges=el('p','',{class:'checklist__tags'}),markStatus=el('span',statusText[entry?.status??'pending'],{class:'checklist__badge','data-checklist-status-value':entry?.status??'pending'}),rules=el('span',(item.required?'Obrigatório':'Opcional')+(item.risk==='sensitive'?' · Ação sensível':'')+(item.evidenceRequired?' · Exige evidência':''));
    rowTexts.push(label,markStatus,rules);badges.append(markStatus,rules);content.append(label,badges);
    if(entry?.at){const at=el('p','Registrado em '+formatTime(entry.at),{class:'checklist__muted'});rowTexts.push(at);content.append(at);}
    const mark=button('Registrar item',()=>{returnFocus=mark;controller.editItem(item.id);},{class:'checklist__secondary'},rowListeners);rowNodes.push(li);mark.disabled=!state.canEdit||state.phase!=='ready';
    li.append(content,mark);rows.append(li);
   }
  }
  // Do not rebuild inputs on every keystroke; keep caret and browser focus stable.
  const inDialog=state.phase==='editing'||state.phase==='review';
  if(!inDialog){wipeFields();wipeReview();if(dialog.open)dialog.close();
   if(lastPhase!==state.phase){if(state.phase==='unknown')reconcile.focus();else if(state.phase==='refresh_required')refresh.focus();else if(state.phase==='ready'&&returnFocus&&returnFocus.isConnected!==false)returnFocus.focus();}
  }else{
   const item=state.record.template.items.find(i=>i.id===state.draft.itemId);dialogTitle.textContent=item.label;dialogStatus.textContent=state.message;
   const editing=state.phase==='editing';step.textContent=editing?'1 de 2 · Conferir a execução':'2 de 2 · Revisar e confirmar';form.hidden=!editing;reviewBox.hidden=editing;
   for(const input of fields)input.disabled=!editing;
   for(const [input,key] of [[situation.input,'status'],[reason.input,'reason']])if(input.value!==state.draft[key])input.value=state.draft[key];
   ack.checked=state.draft.acknowledgeRisk;
   renderEvidence(state);
   risk.hidden=item.risk!=='sensitive'||state.draft.status!=='done';ack.required=!risk.hidden;
   reason.input.required=state.draft.status!=='done';
   // A forbidden exemption is not offered, and the controller independently rejects it.
   for(const option of situation.input.children)if(option.value==='not_applicable'||option.getAttribute?.('value')==='not_applicable'||option.attributes?.value==='not_applicable')option.disabled=!item.allowNotApplicable;
   if(!editing){wipeReview();const r=state.review;for(const [key,value] of [['Marcação',statusText[r.status]],['Evidências',String(r.evidenceCount)+' nota(s) interna(s)'],['Motivo',r.reason??'Não informado']]){
     const term=el('dt',key),valueNode=el('dd',value);reviewTexts.push(valueNode);reviewData.append(term,valueNode);}
   }
   if(!dialog.open){dialog.showModal();situation.input.focus();}else if(lastPhase!==state.phase){if(editing)situation.input.focus();else confirm.focus();}
  }
  lastPhase=state.phase;
 }
 const controller=createExecutionChecklistController({...options,onResponseDiagnostic:category=>status.setAttribute('data-response-diagnostic',category),onState:state=>{render(state);options.onState?.(state);}});
 render(controller.view());
 return Object.freeze({...controller,destroy(){controller.destroy();wipeFields();wipeReview();wipeRows();revision.textContent='';status.textContent='';if(dialog.open)dialog.close();for(const [target,type,fn] of listeners)target.removeEventListener(type,fn);root.replaceChildren();returnFocus=null;}});
}
