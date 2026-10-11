import {createMemberAdminController} from './admin-members-state.js';

/** Optional admin panel. Call only from an authenticated, authorized application
 * shell and supply its memory-only request adapter. Nothing is auto-mounted.
 */
export function mountAdminMembers(root,options){
 const doc=root.ownerDocument;
 const element=(tag,text='',attributes={})=>{const el=doc.createElement(tag);if(text)el.textContent=text;for(const [k,v] of Object.entries(attributes))el.setAttribute(k,v);return el;};
 const button=(text,handler,attributes={})=>{const b=element('button',text,{type:'button',...attributes});b.addEventListener('click',handler);return b;};
 const section=element('section','',{class:'admin-members','aria-labelledby':'admin-members-title'});
 const title=element('h1','Membros da equipe',{id:'admin-members-title'});
 const explanation=element('p','Gerencie vínculos da equipe. Permissões de atendimento e acesso às obras são administrados separadamente.');
 const toolbar=element('div','',{class:'admin-members-toolbar'}),status=element('p','',{'data-admin-status':'',role:'status','aria-live':'polite'});
 const refresh=button('Atualizar membros',()=>void controller.load()),invite=button('Convidar pessoa cadastrada',()=>controller.openDialog('invite'));
 const reconcile=button('Conciliar solicitação',()=>void controller.reconcile());reconcile.hidden=true;
 toolbar.append(refresh,invite,reconcile);
 const tableWrap=element('div','',{class:'admin-members-table-wrap'}),table=element('table'),head=element('thead'),headrow=element('tr');
 for(const text of ['Pessoa','Perfil','Estado','Validade','Ações'])headrow.append(element('th',text,{scope:'col'}));head.append(headrow);
 const body=element('tbody');table.append(head,body);tableWrap.append(table);
 const more=button('Carregar mais membros',()=>void controller.load({append:true}));more.hidden=true;
 const dialog=element('dialog','',{'aria-labelledby':'admin-member-dialog-title'}),dialogTitle=element('h2','',{id:'admin-member-dialog-title'});
 const form=element('form'),notice=element('p');
 function field(labelText,name,tag='input'){
  const group=element('div','',{class:'admin-member-field'}),label=element('label',labelText,{for:'admin-member-'+name}),input=element(tag,'',{id:'admin-member-'+name});
  if(tag==='input'){input.setAttribute('type','text');input.setAttribute('autocomplete','off');}
  input.addEventListener('input',()=>controller.setField(name,input.value));input.addEventListener('change',()=>controller.setField(name,input.value));group.append(label,input);return {group,input};
 }
 const person=field('Identificador da pessoa cadastrada','principalId'),expires=field('Validade em UTC','expiresAt'),role=field('Novo perfil','role','select'),successor=field('Administrador sucessor','successorPrincipalId','select'),reason=field('Motivo da alteração','reason','textarea');
 reason.input.setAttribute('data-admin-reason','');reason.input.setAttribute('maxlength','2000');reason.input.setAttribute('required','');
 reason.input.setAttribute('rows','4');expires.input.setAttribute('placeholder','2026-10-10T12:00:00.000Z');
 for(const [value,text] of [['agent','Atendente'],['admin','Administrador']])role.input.append(element('option',text,{value}));
 const confirm=element('button','Confirmar alteração',{type:'submit'}),cancel=button('Cancelar',()=>controller.cancelDialog()),controls=element('div','',{class:'admin-members-toolbar'});controls.append(cancel,confirm);
 form.append(person.group,expires.group,role.group,successor.group,reason.group,controls);dialog.append(dialogTitle,notice,form);
 form.addEventListener('submit',event=>{event.preventDefault();void controller.confirm();});
 dialog.addEventListener('cancel',event=>{event.preventDefault();controller.cancelDialog();});
 section.append(title,explanation,toolbar,status,tableWrap,more,dialog);root.replaceChildren(section);
 const statusName={active:'Ativo',invited:'Convite pendente',revoked:'Revogado',expired:'Expirado'};
 function render(state){
  status.textContent=state.message;refresh.disabled=state.busy||state.uncertain;
  invite.hidden=!state.availableActions.includes('invite');invite.disabled=state.busy||state.uncertain;
  reconcile.hidden=!state.uncertain;reconcile.disabled=state.busy;
  more.hidden=state.nextCursor===null;more.disabled=state.busy||state.uncertain;
  body.replaceChildren();
  for(const member of state.items){
   const tr=element('tr','',{'data-admin-member':member.principal_id});
   tr.append(element('td',member.principal_id===state.audience.principalId?'Você · '+member.principal_id:member.principal_id),element('td',member.role==='admin'?'Administrador':'Atendente'),element('td',statusName[member.effective_status]??'Indisponível'),element('td',member.expires_at??'Sem expiração'));
   const actions=element('td','',{class:'admin-members-actions'});
   const actionButton=(action,label)=>{if(!state.availableActions.includes(action))return;const b=button(label,()=>controller.openDialog(action,member.principal_id));b.disabled=state.busy||state.uncertain;actions.append(b);};
   if(member.principal_id===state.audience.principalId){if(member.role==='admin'&&member.effective_status==='active')actionButton('handoff','Transferir administração');}
   else if(member.status!=='revoked'){
    if(member.effective_status==='active')actionButton('set_role','Alterar perfil');
    actionButton('revoke','Revogar');if(member.effective_status==='expired')actionButton('expire','Registrar expiração');
   }
   tr.append(actions);body.append(tr);
  }
  if(!state.dialog){
   if(dialog.open)dialog.close();for(const field of [person,expires,role,successor,reason])field.input.value='';notice.textContent='';return;
  }
  const draft=state.dialog;
  dialogTitle.textContent={invite:'Convidar pessoa cadastrada',set_role:'Alterar perfil do membro',revoke:'Revogar vínculo com a equipe',expire:'Registrar expiração do vínculo',handoff:'Transferir administração'}[draft.action];
  notice.textContent=draft.action==='invite'?'O convite ficará pendente. Nenhum e-mail será enviado por esta ação. Use o identificador de uma pessoa já cadastrada, não um e-mail.':draft.action==='handoff'?'O sucessor precisa ser outro administrador vigente e já possuir permissão de gestão. A ação não promove outra pessoa automaticamente.':'Confirme a pessoa selecionada e informe o motivo. A alteração será registrada no histórico administrativo.';
  person.group.hidden=expires.group.hidden=draft.action!=='invite';role.group.hidden=draft.action!=='set_role';successor.group.hidden=draft.action!=='handoff';
  successor.input.replaceChildren(element('option','Selecione um administrador',{value:''}));
  for(const member of state.items)if(member.principal_id!==state.audience.principalId&&member.role==='admin'&&member.effective_status==='active'&&member.expires_at===null)successor.input.append(element('option',member.principal_id,{value:member.principal_id}));
  for(const [field,name] of [[person,'principalId'],[expires,'expiresAt'],[role,'role'],[successor,'successorPrincipalId'],[reason,'reason']]){field.input.value=draft[name]??'';field.input.disabled=state.busy||state.uncertain;}
  cancel.disabled=confirm.disabled=state.busy||state.uncertain;
  if(!dialog.open){dialog.showModal();(draft.action==='invite'?person.input:reason.input).focus();}
 }
 const controller=createMemberAdminController({...options,onState:state=>{render(state);options.onState?.(state);}});render(controller.view());
 return Object.freeze({...controller,destroy(){controller.destroy();root.replaceChildren();}});
}
