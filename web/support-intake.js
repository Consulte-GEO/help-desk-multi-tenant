import {priorityText as intakePriority,countText as intakeCount} from './portal-ui.js';
import {copyFormData,freezeFormData} from '../shared/form-rules.js';import {mountDynamicForm} from './dynamic-form.js';
/** Explicit review/confirm state. api methods must classify authoritative rejection
 * separately from ambiguous transport/COMMIT results. All data stays in memory.
 * No preview proof is authorization; the server validates it again at commit. */
export function createSupportIntakeState(options){let draft=freezeFormData(copyFormData(options.draft)),revision=options.revision??0,data=copyFormData({answers:options.answers??{},subject:options.subject??'',description:options.description??'',coverageId:options.coverageId??null}),phase='editing',previewValue=null,receipt=null,intent=null,epoch=0,controller=null;
 if(!Number.isSafeInteger(revision)||revision<0)throw Error('Revisão inválida.');
 const snapshot=()=>freezeFormData({phase,revision,answers:copyFormData(data.answers),preview:previewValue,receipt});
 const changed=()=>{try{options.onChange?.(snapshot());}catch{/* observer does not grant access */}};
 function edit(input){if(!['editing','saved','review'].includes(phase))throw Error('Conclua a intenção atual.');const v=copyFormData(input);if(!v||Object.keys(v).sort().join(',')!=='answers,coverageId,description,subject'||typeof v.subject!=='string'||typeof v.description!=='string')throw Error('Dados inválidos.');data=v;previewValue=null;intent=null;phase='editing';changed();}
 async function send(){const reconciling=phase==='unknown',stamp=epoch,active=intent;controller=new AbortController();phase=active.op==='save'?'saving':'sending';changed();try{
  const result=active.op==='save'?await options.api.save(active.payload,active.expectedRevision,controller.signal):await options.api.create(active.payload,active.key,controller.signal);
  if(stamp!==epoch)return;
  if(result?.kind==='rejected'){if(reconciling){phase='unknown';return;}phase='editing';intent=null;previewValue=null;return;}
  if(result?.kind!=='confirmed')throw Error('Confirmação desconhecida.');
  if(active.op==='save'){if(result.value?.id!==draft.id||result.value?.revision!==active.expectedRevision+1)throw Error('Revisão incompatível.');revision=result.value.revision;phase='saved';}
  else{if(typeof result.value?.ticketId!=='string'||typeof result.value?.protocol!=='string'||!/^CG-[1-9]\d{4,17}$/.test(result.value.protocol)||result.value.notification!=='pending')throw Error('Recibo incompatível.');receipt=freezeFormData({ticketId:result.value.ticketId,protocol:result.value.protocol,notification:'pending'});phase='confirmed';data={answers:{},subject:'',description:'',coverageId:null};}
  intent=null;previewValue=null;
 }catch{if(stamp===epoch)phase='unknown';}finally{controller?.abort();controller=null;if(stamp===epoch)changed();}}
 async function save(){if(!['editing','saved','review'].includes(phase))throw Error('Conclua a intenção atual.');intent=freezeFormData({op:'save',expectedRevision:revision,payload:{...draft,answers:copyFormData(data.answers)}});previewValue=null;await send();}
 async function preview(){if(phase!=='saved'||revision<1)throw Error('Salve o rascunho primeiro.');const stamp=epoch;controller=new AbortController();phase='previewing';changed();try{
  const value=await options.api.preview({draftId:draft.id,expectedDraftRevision:revision,subject:data.subject,description:data.description,coverageId:data.coverageId},controller.signal);if(epoch!==stamp)return;
  if(value?.valid!==true||value.commitAuthorized!==false||value.draftId!==draft.id||value.draftRevision!==revision||typeof value.previewHash!=='string'||!/^[a-f0-9]{64}$/.test(value.previewHash))throw Error('Prévia inválida.');
  previewValue=freezeFormData(copyFormData(value));phase='review';
 }catch(e){if(epoch===stamp){phase='editing';previewValue=null;throw Error('Revise o rascunho e os anexos.');}}finally{controller?.abort();controller=null;if(stamp===epoch)changed();}}
 async function confirm(){if(phase!=='review'||!previewValue)throw Error('Revisão e confirmação explícitas necessárias.');intent=freezeFormData({op:'create',key:crypto.randomUUID(),payload:{draftId:draft.id,expectedDraftRevision:revision,subject:data.subject,description:data.description,coverageId:data.coverageId,previewHash:previewValue.previewHash}});await send();}
 async function reconcile(){if(phase!=='unknown'||!intent)throw Error('Sem intenção pendente.');await send();}
 function clear(){epoch++;controller?.abort();controller=null;intent=null;previewValue=null;receipt=null;data={answers:{},subject:'',description:'',coverageId:null};draft=null;revision=0;phase='cleared';changed();}
 return Object.freeze({edit,save,preview,confirm,reconcile,clear,snapshot});
}
/** Optional host. Caller owns authenticated schema, draft, ports and page routing.
 * Presentation never mounts endpoints, changes scopes or treats a preview as permission. */
export function mountSupportIntake(root,options){
 const doc=root.ownerDocument,make=(tag,text,cls)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
 const prefix='intake-'+crypto.randomUUID(),listeners=[];let cleared=false,dynamic=null,state=null,pendingChoices=0,lastFields=null,reviewSignature=null,lastPhase=null;
 const ownedClass=!root.classList.contains('hd-intake'),priorBusy=root.getAttribute('aria-busy');
 root.classList.add('hd-intake');
 const listen=(e,event,handler)=>{e.addEventListener(event,handler);listeners.push([e,event,handler]);};
 const heading=make('h2','Nova solicitação de suporte'),eyebrow=make('p','CENTRAL DE ATENDIMENTO','hd-intake-eyebrow'),intro=make('p','Preencha os dados, confira a revisão e confirme a abertura.','hd-intake-muted');
 const steps=make('ol',undefined,'hd-intake-steps');steps.setAttribute('aria-label','Etapas da solicitação');
 for(const label of ['1. Preencher','2. Conferir','3. Concluir'])steps.append(make('li',label));
 const status=make('p','','hd-intake-status');status.setAttribute('data-intake-status','');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.tabIndex=-1;
 const errors=make('section',undefined,'hd-intake-errors');errors.hidden=true;errors.tabIndex=-1;errors.setAttribute('role','alert');errors.setAttribute('aria-label','Campos que precisam de revisão');
 const fields=make('fieldset',undefined,'hd-intake-fields');fields.append(make('legend','Seu pedido'));
 function field(text,name,tag,max){
  const box=make('div',undefined,'hd-intake-field'),label=make('label',text),input=make(tag),hint=make('p','','hd-intake-muted'),error=make('p','','hd-intake-field-error');
  input.id=prefix+'-'+name;input.setAttribute('data-intake-'+name,'');label.htmlFor=input.id;input.maxLength=max;input.required=true;input.setAttribute('aria-describedby',input.id+'-help '+input.id+'-error');
  hint.id=input.id+'-help';error.id=input.id+'-error';hint.textContent=name==='subject'?'De 3 a 200 caracteres.':'Descreva o que aconteceu e o que esperava. Até 12.000 caracteres.';
  box.append(label,input,hint,error);fields.append(box);return {input,error,label:text};
 }
 const subject=field('Assunto','subject','input',200),description=field('Descrição','description','textarea',12000);description.input.rows=4;
 subject.input.value=options.subject??'';description.input.value=options.description??'';
 const dynamicFields=make('fieldset',undefined,'hd-intake-dynamic-fields');dynamicFields.setAttribute('data-intake-fields','true');const formRoot=make('div');dynamicFields.append(make('legend','Dados complementares'),formRoot);fields.append(dynamicFields);
 const review=make('section',undefined,'hd-intake-review');review.hidden=true;review.setAttribute('aria-label','Revisão da solicitação');review.tabIndex=-1;
 const reviewTitle=make('h3','Confira antes de enviar'),reviewData=make('dl'),reviewNotice=make('p','Esta prévia não reserva cobertura nem autoriza a abertura. O acesso, a revisão e os anexos serão conferidos novamente ao confirmar.','hd-intake-notice');review.append(reviewTitle,reviewData,reviewNotice);
 const actions=make('div',undefined,'hd-intake-actions');
 const buttons={save:make('button','Salvar rascunho'),preview:make('button','Revisar solicitação'),confirm:make('button','Confirmar abertura'),back:make('button','Voltar para editar'),reconcile:make('button','Conciliar mesma intenção')};
 for(const [key,button] of Object.entries(buttons)){button.type='button';button.className=key==='back'?'hd-intake-secondary':'hd-intake-primary';button.setAttribute('data-intake-action',key);actions.append(button);}
 const receipt=make('section',undefined,'hd-intake-receipt');receipt.hidden=true;receipt.tabIndex=-1;
 root.replaceChildren(eyebrow,heading,intro,steps,status,errors,fields,review,actions,receipt);
 const read=()=>({answers:dynamic.draftAnswers(),subject:subject.input.value,description:description.input.value,coverageId:options.coverageId??null});
 const signature=input=>JSON.stringify(input);
 function sync(){
  if(cleared||!dynamic||!['editing','saved','review'].includes(state.snapshot().phase))return false;
  const input=read(),next=signature(input);if(next===lastFields)return false;
  lastFields=next;reviewSignature=null;state.edit(input);return true;
 }
 function wipe(){
  if(cleared)return;cleared=true;for(const [el,name,fn] of listeners)el.removeEventListener(name,fn);listeners.length=0;
  subject.input.value='';description.input.value='';dynamic?.destroy();lastFields=reviewSignature=null;reviewData.replaceChildren();receipt.replaceChildren();status.textContent='';errors.replaceChildren();root.replaceChildren();
  if(ownedClass)root.classList.remove('hd-intake');if(priorBusy===null)root.removeAttribute('aria-busy');else root.setAttribute('aria-busy',priorBusy);
 }
 function render(s){
  if(cleared)return;
  if(s.phase==='cleared'){wipe();return;}
  const busy=['saving','previewing','sending'].includes(s.phase),editable=['editing','saved'].includes(s.phase)&&pendingChoices===0;
  fields.disabled=!editable;dynamicFields.disabled=!editable;fields.hidden=['review','sending','unknown','confirmed'].includes(s.phase);
  root.setAttribute('aria-busy',String(busy||pendingChoices>0));
  for(const [key,allowed] of Object.entries({save:s.phase==='editing',preview:s.phase==='saved',confirm:s.phase==='review',back:s.phase==='review',reconcile:s.phase==='unknown'})){
   buttons[key].hidden=!allowed;buttons[key].disabled=!allowed||pendingChoices>0;
  }
  review.hidden=!s.preview||!['review','sending','unknown'].includes(s.phase);
  if(s.phase==='review'&&reviewSignature===null)reviewSignature=lastFields;
  reviewData.replaceChildren();
  if(!review.hidden){
   for(const [label,value] of [['Assunto',subject.input.value],['Descrição',description.input.value],['Prioridade calculada',intakePriority(s.preview.priority)],['Evidências conferidas na prévia',intakeCount(s.preview.attachmentCount)]])reviewData.append(make('dt',label),make('dd',value));
  }
  const step=s.phase==='confirmed'?2:['saved','previewing','review','sending','unknown'].includes(s.phase)?1:0;
  [...steps.children].forEach((node,index)=>{if(index===step)node.setAttribute('aria-current','step');else node.removeAttribute('aria-current');});
  const messages={editing:'Preencha os campos antes de salvar o rascunho.',saving:'Salvando rascunho…',saved:'Rascunho salvo. Revise a solicitação antes de confirmar.',previewing:'Conferindo a revisão e as evidências…',review:'Prévia conferida. Confirme somente após revisar os dados.',sending:'Confirmando abertura…',unknown:'Confirmação desconhecida. Concilie a mesma intenção; não inicie outro pedido.',confirmed:'Solicitação registrada. Notificação pendente.'};
  status.textContent=pendingChoices?'Consultando a referência selecionada. Aguarde antes de salvar.':s.phase==='editing'&&['saving','sending'].includes(lastPhase)?'Solicitação recusada. Revise os dados e as permissões antes de tentar novamente.':s.phase==='editing'&&lastPhase==='previewing'?'Não foi possível conferir a prévia. Revise o rascunho e as evidências.':messages[s.phase]??'Solicitação indisponível.';
  if(s.phase==='confirmed'){
   subject.input.value='';description.input.value='';dynamic?.destroy();lastFields=reviewSignature=null;errors.replaceChildren();errors.hidden=true;
   receipt.replaceChildren(make('h3','Chamado registrado'),make('p',s.receipt.protocol),make('p','Notificação pendente. A criação não confirma o envio de uma mensagem externa.'));receipt.hidden=false;
  }else receipt.hidden=true;
  lastPhase=s.phase;
 }
 function validate(){
  const issues=[];
  for(const [f,min,max] of [[subject,3,200],[description,1,12000]]){
   const text=f.input.value,invalid=text.trim().length<min||text.length>max||/[\u0000\p{Cs}]/u.test(text);
   f.input.setAttribute('aria-invalid',String(invalid));f.error.textContent=invalid?`Informe ${f.label.toLowerCase()} válido, de ${min} a ${max} caracteres.`:'';
   if(invalid)issues.push(f);
  }
  errors.replaceChildren();errors.hidden=!issues.length;
  const result=dynamic.validate({focus:!issues.length});
  if(issues.length){errors.append(make('h3','Revise os campos indicados'));for(const f of issues){const b=make('button',f.error.textContent);b.type='button';b.addEventListener('click',()=>f.input.focus());errors.append(b);}errors.focus();}
  return !issues.length&&result.valid;
 }
 function picker(fn){return typeof fn!=='function'?undefined:async(...args)=>{
  if(cleared)throw Error('Solicitação encerrada.');pendingChoices++;render(state.snapshot());
  try{return await fn(...args);}finally{pendingChoices--;if(!cleared)render(state.snapshot());}
 };}
 // The renderer callback includes changes that have no native input event (rows/paste/lookup).
 state=createSupportIntakeState({...options,onChange:s=>{render(s);options.onChange?.(s);}});
 dynamic=mountDynamicForm(formRoot,{schema:options.schema,answers:options.answers,chooseFiles:picker(options.chooseFiles),chooseLookup:picker(options.chooseLookup),canEdit:()=>!cleared&&['editing','saved'].includes(state.snapshot().phase),onAnswersChange:()=>{if(!cleared)sync();}});
 sync();render(state.snapshot());
 function afterAction(){
  if(cleared)return;const active=doc.activeElement;if(active!==doc.body&&!root.contains(active))return;
  const s=state.snapshot();const target=s.phase==='saved'?buttons.preview:s.phase==='review'?review:s.phase==='unknown'?buttons.reconcile:s.phase==='confirmed'?receipt:status;
  target.focus({preventScroll:true});
 }
 const safe=action=>async()=>{
  if(cleared||pendingChoices)return;
  try{const acted=await action();if(acted!==false)afterAction();}
  catch{if(!cleared){status.textContent='Revise os dados e as evidências antes de continuar. Nenhum novo envio foi iniciado automaticamente.';afterAction();}}
 };
 listen(buttons.save,'click',safe(async()=>{if(state.snapshot().phase!=='editing')return false;if(!validate())return false;sync();await state.save();}));
 listen(buttons.preview,'click',safe(async()=>{if(state.snapshot().phase!=='saved')return false;if(sync()){status.textContent='Os dados mudaram. Salve novamente antes de revisar.';return;}if(!validate())return false;await state.preview();}));
 listen(buttons.confirm,'click',safe(async()=>{
  if(state.snapshot().phase!=='review')return false;
  if(signature(read())!==reviewSignature){sync();status.textContent='Os dados mudaram após a revisão. Salve e confira novamente antes de confirmar.';return;}
  await state.confirm();
 }));
 listen(buttons.back,'click',safe(()=>{if(state.snapshot().phase!=='review')return false;reviewSignature=null;state.edit(read());return true;}));
 listen(buttons.reconcile,'click',safe(async()=>{if(state.snapshot().phase!=='unknown')return false;await state.reconcile();}));
 for(const field of [subject.input,description.input])listen(field,'input',()=>{if(!cleared)sync();});
 // clear and destroy scrub duplicate review/receipt text too. Late promises are gated above.
 return Object.freeze({state,clear(){state.clear();wipe();},destroy(){state.clear();wipe();}});
}
