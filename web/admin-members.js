import {createMemberAdminController} from './admin-members-state.js';
import {adminUI,adminInstant,clearAdminNode} from './admin-ui.js';

/** Optional INTERNAL mount. Host owns authorization/session and supplies the existing
 * request adapter. Nothing is auto-loaded; controller and command contracts unchanged. */
export function mountAdminMembers(root,options){
 const ui=adminUI(root,'members'),{node,button,field,listen}=ui,rowListeners=[],rowButtons=new Map();
 let destroyed=false,rowsStamp='',lastAudience='',lastMessage='',returnKey=null,focusAfter=null,wasOpen=false,successorsStamp='';
 const section=node('section',undefined,{class:'hd-admin admin-members','data-admin-panel':'members'});
 const toolbar=node('div',undefined,{class:'hd-admin-toolbar'}),status=node('p','',{class:'hd-admin-status','data-admin-status':'',role:'status','aria-live':'polite'});
 const refresh=button('Atualizar membros',()=>void controller.load()),invite=button('Convidar pessoa cadastrada',()=>{returnKey='invite';controller.openDialog('invite');},true);
 const reconcile=button('Conciliar solicitação',()=>void controller.reconcile(),true);reconcile.hidden=true;toolbar.append(refresh,invite,reconcile);
 const count=node('p','',{class:'hd-admin-muted','data-admin-count':''}),empty=node('div','',{class:'hd-admin-empty'});
 const wrap=node('div',undefined,{class:'admin-members-table-wrap'}),table=node('table',undefined,{role:'table','aria-label':'Membros da equipe'}),head=node('thead',undefined,{role:'rowgroup'}),headrow=node('tr',undefined,{role:'row'}),body=node('tbody',undefined,{role:'rowgroup'});
 for(const title of ['Pessoa','Perfil','Estado','Validade','Ações'])headrow.append(node('th',title,{scope:'col',role:'columnheader'}));head.append(headrow);table.append(head,body);wrap.append(table);
 const more=button('Carregar mais membros',()=>void controller.load({append:true}));more.hidden=true;
 const dialog=node('dialog',undefined,{'aria-labelledby':ui.prefix+'-title','aria-describedby':ui.prefix+'-notice'}),dialogHead=node('div',undefined,{class:'hd-admin-dialog-heading'}),title=node('h2','',{id:ui.prefix+'-title'}),notice=node('p','',{id:ui.prefix+'-notice',class:'hd-admin-muted'}),target=node('p','',{class:'hd-admin-muted'});
 dialogHead.append(title,notice,target);
 const dialogStatus=node('p','',{class:'hd-admin-status hd-admin-dialog-status',role:'status','aria-live':'polite'}),form=node('form',undefined,{class:'hd-admin-dialog-form'});form.noValidate=true;
 const fields=node('div',undefined,{class:'hd-admin-dialog-body'});
 const person=field('Identificador da pessoa cadastrada','principalId',{hint:'Informe o UUID da pessoa já cadastrada. Não use e-mail; esta tela não resolve destinatários.',attrs:{'data-admin-field':'principalId'}});
 const expires=field('Validade em UTC','expiresAt',{hint:'Use o instante UTC completo, terminado em Z. A precisão informada será preservada.',attrs:{'data-admin-field':'expiresAt',placeholder:'AAAA-MM-DDTHH:mm:ss.sssZ'}});
 const role=field('Novo perfil','role',{tag:'select',hint:'Alterar o perfil não adiciona permissões de atendimento.',attrs:{'data-admin-field':'role'}});
 for(const [value,text] of [['agent','Atendente'],['admin','Administrador']])role.input.append(node('option',text,{value}));
 const successor=field('Administrador sucessor','successor',{tag:'select',hint:'Somente outro administrador vigente e com permissão de gestão pode ser sucessor.',attrs:{'data-admin-field':'successorPrincipalId'}});
 const reason=field('Motivo da alteração','reason',{tag:'textarea',hint:'Obrigatório: de 3 a 2.000 caracteres. O motivo será registrado no histórico administrativo.',attrs:{'data-admin-reason':'','data-admin-field':'reason',rows:'4',maxlength:'2000',required:''}});
 const all=[person,expires,role,successor,reason];
 for(const [f,name] of [[person,'principalId'],[expires,'expiresAt'],[role,'role'],[successor,'successorPrincipalId'],[reason,'reason']]){
  listen(f.input,'input',()=>controller.setField(name,f.input.value));listen(f.input,'change',()=>controller.setField(name,f.input.value));fields.append(f.box);
 }
 const controls=node('div',undefined,{class:'hd-admin-dialog-footer'}),cancel=button('Cancelar',()=>controller.cancelDialog()),confirm=node('button','Confirmar alteração',{type:'submit',class:'hd-admin-primary'});controls.append(cancel,confirm);form.append(fields,controls);dialog.append(dialogHead,dialogStatus,form);
 function valid(){
  all.forEach(f=>f.feedback(''));const draft=controller.view().dialog;if(!draft)return false;let first=null;
  const issue=(f,text)=>{f.feedback(text);first??=f;};
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(draft.action==='invite'){
   if(!uuid.test(person.input.value))issue(person,'Informe o identificador UUID da pessoa cadastrada, não um e-mail.');
   if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(?:\d{3})?Z$/.test(expires.input.value))issue(expires,'Informe a validade UTC completa, terminada em Z.');
  }
  if(draft.action==='handoff'&&!uuid.test(successor.input.value))issue(successor,'Selecione um administrador sucessor.');
  if(reason.input.value.trim().length<3||reason.input.value.length>2000)issue(reason,'Informe um motivo com pelo menos três caracteres e até 2.000 caracteres.');
  if(first){dialogStatus.textContent='Revise os campos indicados antes de confirmar.';first.input.focus();return false;}dialogStatus.textContent='';return true;
 }
 listen(form,'submit',event=>{event.preventDefault();if(!confirm.disabled&&valid())void controller.confirm();});
 listen(dialog,'cancel',event=>{event.preventDefault();controller.cancelDialog();});
 section.append(ui.header('Membros da equipe','Gerencie os vínculos da equipe. Perfis e permissões de atendimento são validados separadamente.'),toolbar,status,count,empty,wrap,more,dialog);root.replaceChildren(section);
 function clearRows(){ui.removeListeners(rowListeners);rowButtons.clear();clearAdminNode(body);rowsStamp='';}
 function wipeFields(){for(const f of all){f.input.value='';f.input.checked=false;f.input.disabled=true;f.feedback('');}successor.input.replaceChildren();successorsStamp='';title.textContent=notice.textContent=target.textContent=dialogStatus.textContent='';}
 function drawRows(state){
  const stamp=JSON.stringify(state.items);
  if(stamp!==rowsStamp){clearRows();rowsStamp=stamp;
   for(const member of state.items){
    const tr=node('tr',undefined,{'data-admin-member':member.principal_id,role:'row'});
    const cell=label=>{const td=node('td',undefined,{role:'cell'});td.append(node('span',label,{class:'hd-admin-mobile-label','aria-hidden':'true'}));return td;};
    const personCell=cell('Pessoa');personCell.append(node('strong',member.principal_id===state.audience.principalId?'Você':'Pessoa '+member.principal_id.slice(0,8)+'…'+member.principal_id.slice(-4)));
    const technical=node('details');technical.append(node('summary','Ver identificador'),node('code',member.principal_id));personCell.append(technical);
    const roleCell=cell('Perfil');roleCell.append(node('span',member.role==='admin'?'Administrador':'Atendente'));
    const stateCell=cell('Estado');stateCell.append(ui.badge(member.effective_status));
    const validity=cell('Validade');validity.append(node('span',adminInstant(member.expires_at)));
    const actions=cell('Ações'),buttons=node('div',undefined,{class:'admin-members-actions'});
    const add=(action,label)=>{if(!state.availableActions.includes(action))return;const key=member.principal_id+'|'+action;
     const b=button(label,()=>{returnKey=key;controller.openDialog(action,member.principal_id);},false,{'data-admin-action':action},rowListeners);rowButtons.set(key,b);buttons.append(b);};
    if(member.principal_id===state.audience.principalId){if(member.role==='admin'&&member.effective_status==='active')add('handoff','Transferir administração');}
    else if(member.status!=='revoked'){if(member.effective_status==='active')add('set_role','Alterar perfil');add('revoke','Revogar');if(member.effective_status==='expired')add('expire','Registrar expiração');}
    if(!buttons.children.length)buttons.append(node('span','Sem ações disponíveis nesta consulta.',{class:'hd-admin-muted'}));actions.append(buttons);tr.append(personCell,roleCell,stateCell,validity,actions);body.append(tr);
   }
  }
  for(const b of rowButtons.values())b.disabled=state.busy||state.uncertain;
 }
 function render(state){
  const audience=state.audience.workspaceId+'|'+state.audience.principalId;
  if(audience!==lastAudience){clearRows();wipeFields();lastAudience=audience;returnKey=null;focusAfter=null;}
  status.textContent=state.message;section.setAttribute('aria-busy',String(state.busy));
  refresh.disabled=state.busy||state.uncertain;invite.hidden=!state.availableActions.includes('invite');invite.disabled=state.busy||state.uncertain;
  reconcile.hidden=!state.uncertain;reconcile.disabled=state.busy;more.hidden=state.nextCursor===null;more.disabled=state.busy||state.uncertain;
  count.textContent=state.revision===null?'':`${state.items.length} de ${state.total} membros carregados na consulta autorizada.`;
  empty.hidden=state.items.length>0;
  empty.textContent=state.busy?'Carregando membros…':state.revision!==null?'Nenhum membro encontrado nesta consulta.':state.message?'A lista não está disponível. Revise o aviso e atualize o acesso.':'Atualize a lista para consultar os membros autorizados.';
  wrap.hidden=!state.items.length;
  // Capabilities can change without any row data changing.
  const capabilities=state.availableActions.join('|');if(section.getAttribute('data-admin-capabilities')!==capabilities){clearRows();section.setAttribute('data-admin-capabilities',capabilities);}
  drawRows(state);
  if(!state.dialog){
   if(wasOpen){if(dialog.open)dialog.close();focusAfter=state.uncertain?'reconcile':returnKey;wasOpen=false;}
   wipeFields();
  }else{
   const d=state.dialog,newDialog=!wasOpen;
   title.textContent={invite:'Convidar pessoa cadastrada',set_role:'Alterar perfil do membro',revoke:'Revogar vínculo com a equipe',expire:'Registrar expiração do vínculo',handoff:'Transferir administração'}[d.action];
   notice.textContent=d.action==='invite'?'O convite ficará pendente. Nenhum e-mail será enviado por esta ação.':d.action==='handoff'?'A transferência não promove outra pessoa nem amplia suas permissões. Confira o sucessor antes de confirmar.':'Confira a pessoa selecionada. A alteração exige validação do servidor e será registrada no histórico.';
   target.textContent=d.targetPrincipalId?'Pessoa selecionada: '+d.targetPrincipalId:'';
   person.box.hidden=expires.box.hidden=d.action!=='invite';role.box.hidden=d.action!=='set_role';successor.box.hidden=d.action!=='handoff';
   const candidates=state.items.filter(m=>m.principal_id!==state.audience.principalId&&m.role==='admin'&&m.effective_status==='active'&&m.expires_at===null),stamp=JSON.stringify(candidates.map(m=>m.principal_id));
   if(stamp!==successorsStamp){successor.input.replaceChildren(node('option','Selecione um administrador',{value:''}),...candidates.map(m=>node('option',m.principal_id,{value:m.principal_id})));successorsStamp=stamp;}
   for(const [f,name] of [[person,'principalId'],[expires,'expiresAt'],[role,'role'],[successor,'successorPrincipalId'],[reason,'reason']]){if(f.input.value!==(d[name]??''))f.input.value=d[name]??'';f.input.disabled=state.busy||state.uncertain||f.box.hidden;if(newDialog)f.feedback('');}
   cancel.disabled=confirm.disabled=state.busy||state.uncertain;
   confirm.className=['revoke','handoff'].includes(d.action)?'hd-admin-danger':'hd-admin-primary';
   if(newDialog)dialogStatus.textContent='';else if(state.message!==lastMessage)dialogStatus.textContent=state.message;
   if(!dialog.open){dialog.showModal();(d.action==='invite'?person.input:d.action==='handoff'?successor.input:reason.input).focus();}wasOpen=true;
  }
  lastMessage=state.message;
  if(focusAfter&&!state.busy)queueMicrotask(()=>{if(destroyed||!focusAfter||controller.view().busy||controller.view().dialog)return;const key=focusAfter;focusAfter=null;const target=key==='reconcile'?reconcile:key==='invite'?invite:rowButtons.get(key);if(target&&!target.disabled&&!target.hidden)target.focus();else if(!refresh.disabled)refresh.focus();});
 }
 const controller=createMemberAdminController({...options,onState:state=>{render(state);options.onState?.(state);}});render(controller.view());
 return Object.freeze({...controller,destroy(){destroyed=true;controller.destroy();ui.removeListeners(rowListeners);ui.removeListeners();if(dialog.open)dialog.close();wipeFields();clearRows();clearAdminNode(section);root.replaceChildren();lastAudience=lastMessage='';returnKey=focusAfter=null;}});
}
