import {createOpeningFlow,openingIssues} from './opening-flow.js';
const mounted=new WeakMap();
/** Enhances the existing creation form. No fetch, mutation, storage, grants or new
 * intent. The host calls update/open/reset; the original submit handler owns writes.
 * If this optional module fails to load, the existing single-page form still works.
 */
export function mountOpeningWizard(doc=document){
 if(mounted.has(doc))return mounted.get(doc);
 const $=id=>doc.getElementById(id),win=doc.defaultView;
 const required=['create-dialog','create-form','context-choice','context-status','subject','description','priority','coverage-label','coverage-choice','create-help','submit-create'];
 if(!win||required.some(id=>!$(id)))throw Error('Opening presentation host is incomplete');
 const dialog=$('create-dialog'),form=$('create-form'),submit=$('submit-create'),actions=form.querySelector('.dialog-actions'),catalogActions=form.querySelector('.catalog-actions');
 const controls={context:$('context-choice'),subject:$('subject'),description:$('description'),priority:$('priority'),coverage:$('coverage-choice')};
 if(!actions||!catalogActions||Object.values(controls).some(n=>!n.closest('label')))throw Error('Opening structure is incompatible');
 const abort=new win.AbortController(),{signal}=abort,moves=[],added=[],flow=createOpeningFlow(),metadata=new Map();
 let disposed=false,active=false,runtime={status:'idle',canSubmit:false,pending:false,unresolved:false,ambiguous:false};
 const original={noValidate:form.noValidate,submitHidden:submit.hidden,cls:dialog.getAttribute('class')};
 const n=(tag,cls,text)=>{const node=doc.createElement(tag);if(cls)node.className=cls;if(text)node.textContent=text;return node;};
 const add=(node,id)=>{if(id)node.id=id;added.push(node);return node;};
 const move=(node,parent)=>{const marker=doc.createComment('UX03 original position');node.before(marker);moves.push({node,marker});parent.append(node);};
 const values=()=>Object.fromEntries(Object.entries(controls).map(([k,c])=>[k,c.value]));
 const steps=add(n('ol','hd-opening-steps'),'hd-opening-steps');steps.setAttribute('aria-label','Etapas de abertura');
 const names=['Contexto','Seu pedido','Revisão'];
 const stepItems=names.map((text,i)=>{const li=n('li','',''+(i+1)+'. '+text);steps.append(li);return li;});
 const errors=add(n('section','hd-form-errors'),'hd-opening-errors');errors.tabIndex=-1;errors.hidden=true;errors.setAttribute('aria-label','Campos que precisam de atenção');
 const errorTitle=n('h3'),errorList=n('ul');errors.append(errorTitle,errorList);
 const status=add(n('p','hd-opening-status'),'hd-opening-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const panels=names.map((label,i)=>{const p=add(n('section','hd-opening-step'),'hd-opening-step-'+(i+1));const h=n('h3','',`Etapa ${i+1} de 3 · ${label}`);h.tabIndex=-1;h.id='hd-opening-title-'+(i+1);p.setAttribute('aria-labelledby',h.id);p.append(h);return p;});
 form.querySelector('.dialog-title').after(steps,status,errors,...panels);
 move(controls.context.closest('label'),panels[0]);move($('context-status'),panels[0]);move(catalogActions,panels[0]);
 for(const key of ['subject','description','priority'])move(controls[key].closest('label'),panels[1]);
 const review=n('dl','hd-opening-review');panels[2].append(n('p','muted','Confira os dados antes de confirmar. Esta revisão não reserva nem autoriza cobertura.'),review);move($('coverage-label'),panels[2]);
 const instructions={context:'Escolha a conta, o sistema e o serviço disponíveis para seu acesso.',subject:'Resuma o pedido em 3 a 200 caracteres.',description:'Informe o que esperava e o que aconteceu. Não inclua senhas, tokens ou códigos de acesso.',priority:'A prioridade escolhida será validada pelas regras do atendimento.',coverage:'Há mais de uma cobertura elegível. Escolha explicitamente a opção desejada.'};
 for(const [key,control] of Object.entries(controls)){
  const hint=add(n('p','hd-field-hint',instructions[key]),'hd-opening-'+key+'-hint'),error=add(n('p','hd-field-error'),'hd-opening-'+key+'-error');error.hidden=true;
  control.closest('label').after(hint,error);
  const oldDesc=control.getAttribute('aria-describedby'),oldInvalid=control.getAttribute('aria-invalid');
  control.setAttribute('aria-describedby',[oldDesc,hint.id,error.id].filter(Boolean).join(' '));metadata.set(key,{control,hint,error,oldDesc,oldInvalid});
 }
 const next=add(n('button','primary','Continuar'),'hd-opening-next'),back=add(n('button','secondary','Voltar'),'hd-opening-back');next.type=back.type='button';submit.before(next);actions.prepend(back);
 const counter=add(n('p','hd-field-counter'),'hd-opening-counter');controls.description.closest('label').after(counter);
 function clearErrors(){errors.hidden=true;errorList.replaceChildren();errorTitle.textContent='';for(const m of metadata.values()){m.error.hidden=true;m.error.textContent='';if(m.oldInvalid===null)m.control.removeAttribute('aria-invalid');else m.control.setAttribute('aria-invalid',m.oldInvalid);}}
 function showErrors(issues){
  clearErrors();if(!issues.length)return;errors.hidden=false;errorTitle.textContent='Confira os campos indicados';
  for(const issue of issues){const m=metadata.get(issue.field);if(!m)continue;m.error.textContent=issue.message;m.error.hidden=false;m.control.setAttribute('aria-invalid','true');const li=n('li'),b=n('button','',issue.message);b.type='button';b.addEventListener('click',()=>{flow.edited(issue.field);draw();m.control.focus();});li.append(b);errorList.append(li);}
  errors.focus();
 }
 function drawReview(){
  review.replaceChildren();if(!active||!dialog.open||flow.view().step!==3)return;
  const choice=control=>control.selectedOptions?.[0]?.textContent??'';
  const v=values(),rows=[['Conta, sistema e serviço',choice(controls.context)],['Assunto',v.subject.trim()],['Descrição',v.description.trim()],['Prioridade',choice(controls.priority)]];
  if(runtime.ambiguous&&v.coverage)rows.push(['Cobertura selecionada',choice(controls.coverage)]);
  for(const [label,value] of rows)review.append(n('dt','',label),n('dd','',value||'Não informado'));
 }
 function draw(){
  if(disposed)return;const v=flow.view(),focused=doc.activeElement;
  const focusWillHide=panels.some((p,i)=>i!==v.step-1&&p.contains(focused));
  panels.forEach((p,i)=>{p.hidden=i!==v.step-1;stepItems[i].toggleAttribute('data-current',i===v.step-1);if(i===v.step-1)stepItems[i].setAttribute('aria-current','step');else stepItems[i].removeAttribute('aria-current');});
  next.hidden=v.step===3;next.disabled=v.locked||!v.catalogReady;next.textContent=v.step===1?'Continuar':'Revisar pedido';
  back.hidden=v.step===1||v.recovering;back.disabled=v.locked;submit.hidden=v.step!==3;
  form.setAttribute('aria-busy',String(v.pending));
  const text=v.pending?'Confirmando a solicitação. Não envie outro pedido.':v.recovering?'A confirmação anterior está pendente. “Recuperar abertura” confere a mesma intenção; não inicia outro chamado.':v.step===3?'Revisão local. A cobertura e as permissões serão conferidas novamente ao confirmar.':`Etapa ${v.step} de 3. Seus dados permanecem ao avançar ou voltar.`;
  if(status.textContent!==text)status.textContent=text;
  metadata.get('coverage').hint.hidden=!runtime.ambiguous;metadata.get('coverage').error.hidden=!runtime.ambiguous||!metadata.get('coverage').error.textContent;
  counter.textContent=`${controls.description.value.length} / 12.000 caracteres`;
  drawReview();
  if(active&&dialog.open&&focusWillHide)panels[v.step-1].querySelector('h3').focus();
 }
 function advance(){
  if(flow.view().locked)return;
  const stage=flow.view().step,v=values();
  if(!flow.next(v)){showErrors(openingIssues(v,runtime).filter(x=>stage===1?x.field==='context':x.field!=='coverage'));return;}
  clearErrors();draw();panels[flow.view().step-1].querySelector('h3').focus();
 }
 next.addEventListener('click',advance,{signal});back.addEventListener('click',()=>{if(flow.back()){clearErrors();draw();panels[flow.view().step-1].querySelector('h3').focus();}},{signal});
 const changed=event=>{if(flow.view().locked)return;const key=Object.entries(controls).find(([,c])=>c===event.target)?.[0];if(!key)return;clearErrors();flow.edited(key);if(key==='coverage')flow.reviewCoverage(values());draw();};
 form.addEventListener('input',changed,{signal});form.addEventListener('change',changed,{signal});
 // Native validation is replaced ONLY while the optional wizard is mounted. This
 // capture listener validates before the original handler; server checks are unchanged.
 form.noValidate=true;
 form.addEventListener('submit',event=>{
  if(flow.allowSubmit(values()))return;
  event.preventDefault();event.stopImmediatePropagation();
  if(flow.view().locked){draw();return;}
  if(flow.view().step<3){advance();return;}
  const issues=openingIssues(values(),runtime);
  if(issues.length)showErrors(issues);
  else{flow.edited('subject');draw();status.textContent='Os dados mudaram. Revise o pedido novamente antes de confirmar.';panels[1].querySelector('h3').focus();}
 },{capture:true,signal});
 dialog.addEventListener('close',()=>{active=false;flow.reset();clearErrors();review.replaceChildren();status.textContent='';counter.textContent='';},{signal});
 dialog.classList.add('hd-opening');
 const api=Object.freeze({
  update(nextRuntime){if(disposed)return;runtime={...nextRuntime};flow.update(runtime);draw();},
  open(){if(disposed)return;active=true;flow.reset();flow.update(runtime);clearErrors();draw();panels[flow.view().step-1].querySelector('h3').focus();},
  reset(){if(disposed)return;active=false;runtime={status:'idle',canSubmit:false,pending:false,unresolved:false,ambiguous:false};flow.reset();clearErrors();review.replaceChildren();status.textContent='';counter.textContent='';draw();},
  dispose(){if(disposed)return;disposed=true;active=false;abort.abort();clearErrors();review.replaceChildren();status.textContent='';counter.textContent='';
   for(const m of metadata.values()){for(const [attribute,value] of [['aria-describedby',m.oldDesc],['aria-invalid',m.oldInvalid]])if(value===null)m.control.removeAttribute(attribute);else m.control.setAttribute(attribute,value);}metadata.clear();
   for(const {node,marker} of moves){marker.replaceWith(node);}for(const node of added)node.remove();form.noValidate=original.noValidate;form.removeAttribute('aria-busy');submit.hidden=original.submitHidden;if(original.cls===null)dialog.removeAttribute('class');else dialog.setAttribute('class',original.cls);mounted.delete(doc);
  }
 });mounted.set(doc,api);draw();return api;
}
