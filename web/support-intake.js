import {copyFormData,freezeFormData} from '../shared/form-rules.js';import {mountDynamicForm} from './dynamic-form.js';
/** Explicit review/confirm state. api methods must classify authoritative rejection
 * separately from ambiguous transport/COMMIT results. All data stays in memory.
 * No preview proof is authorization; the server validates it again at commit. */
export function createSupportIntakeState(options){let draft=freezeFormData(copyFormData(options.draft)),revision=options.revision??0,data=copyFormData({answers:options.answers??{},subject:options.subject??'',description:options.description??'',coverageId:options.coverageId??null}),phase='editing',previewValue=null,receipt=null,intent=null,epoch=0,controller=null;
 if(!Number.isSafeInteger(revision)||revision<0)throw Error('Revisão inválida.');
 const snapshot=()=>freezeFormData({phase,revision,answers:copyFormData(data.answers),preview:previewValue,receipt});
 const changed=()=>{try{options.onChange?.(snapshot());}catch{/* observer does not grant access */}};
 function edit(input){if(!['editing','saved','review'].includes(phase))throw Error('Conclua a intenção atual.');const v=copyFormData(input);if(!v||Object.keys(v).sort().join(',')!=='answers,coverageId,description,subject'||typeof v.subject!=='string'||typeof v.description!=='string')throw Error('Dados inválidos.');data=v;previewValue=null;intent=null;phase='editing';changed();}
 async function send(){const stamp=epoch,active=intent;controller=new AbortController();phase=active.op==='save'?'saving':'sending';changed();try{
  const result=active.op==='save'?await options.api.save(active.payload,active.expectedRevision,controller.signal):await options.api.create(active.payload,active.key,controller.signal);
  if(stamp!==epoch)return;
  if(result?.kind==='rejected'){phase='editing';intent=null;previewValue=null;return;}
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
/** Candidate panel, no automatic app mount. Schema/context/API must originate from
 * authenticated server configuration. File chooser must save the batch ID selection
 * and bind its returned revision before finalization; it cannot return raw clean=true. */
export function mountSupportIntake(root,options){const doc=root.ownerDocument,n=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};let dynamic=null,cleared=false;
 const heading=n('h2','Nova solicitação de suporte'),subject=n('input'),description=n('textarea'),formRoot=n('fieldset'),review=n('section'),status=n('p');
 const label=(text,input)=>{const l=n('label',text),id='intake-'+crypto.randomUUID();input.setAttribute('id',id);l.setAttribute('for',id);return l;};subject.value=options.subject??'';description.value=options.description??'';subject.setAttribute('maxlength','200');description.setAttribute('maxlength','12000');status.setAttribute('role','status');status.setAttribute('aria-live','polite');review.setAttribute('aria-label','Revisão da solicitação');formRoot.setAttribute('data-intake-fields','true');formRoot.append(n('legend','Dados da solicitação'));
 const buttons={save:n('button','Salvar rascunho'),preview:n('button','Revisar solicitação'),confirm:n('button','Confirmar abertura'),reconcile:n('button','Conciliar mesma intenção')};for(const b of Object.values(buttons))b.type='button';
 function draw(s){const editable=['editing','saved','review'].includes(s.phase);subject.disabled=!editable;description.disabled=!editable;formRoot.disabled=!editable;buttons.save.disabled=!editable;buttons.preview.disabled=s.phase!=='saved';buttons.confirm.disabled=s.phase!=='review';buttons.reconcile.disabled=s.phase!=='unknown';
  review.replaceChildren();if(s.preview)review.append(n('h3','Confira antes de enviar'),n('p','Assunto: '+subject.value),n('p','Prioridade calculada: '+s.preview.priority),n('p','Evidências conferidas: '+s.preview.attachmentCount),n('p','O acesso e os anexos serão conferidos novamente ao confirmar.'));
  status.textContent=s.phase==='unknown'?'Confirmação desconhecida. Não abra outra intenção; concilie esta mesma solicitação.':s.phase==='confirmed'?'Solicitação registrada: '+s.receipt.protocol+'. Notificação pendente.':s.phase==='saving'?'Salvando rascunho…':s.phase==='previewing'?'Conferindo fontes e anexos…':s.phase==='sending'?'Confirmando abertura…':'';
  if(s.phase==='confirmed'||s.phase==='cleared'){subject.value='';description.value='';dynamic?.destroy();}
 }
 const state=createSupportIntakeState({...options,onChange:draw});
 dynamic=mountDynamicForm(formRoot,{schema:options.schema,answers:options.answers,chooseFiles:options.chooseFiles,chooseLookup:options.chooseLookup});
 const sync=()=>{state.edit({answers:dynamic.draftAnswers(),subject:subject.value,description:description.value,coverageId:options.coverageId??null});};
 const safe=(f)=>()=>{try{Promise.resolve(f()).catch(()=>{if(!cleared)status.textContent='Revise os dados e as evidências antes de continuar.';});}catch{if(!cleared)status.textContent='Conclua a intenção atual antes de alterar.';}};
 buttons.save.addEventListener('click',safe(async()=>{sync();await state.save();}));buttons.preview.addEventListener('click',safe(()=>state.preview()));buttons.confirm.addEventListener('click',safe(()=>state.confirm()));buttons.reconcile.addEventListener('click',safe(()=>state.reconcile()));
 // Any edit invalidates the prepared preview. Delegate fields are deliberately not
 // accepted here; the qualified server on-behalf composition owns that operation.
 const changed=safe(()=>{if(['editing','saved','review'].includes(state.snapshot().phase))sync();});subject.addEventListener('input',changed);description.addEventListener('input',changed);formRoot.addEventListener('input',changed);formRoot.addEventListener('change',changed);
 root.replaceChildren(heading,label('Assunto',subject),subject,label('Descrição',description),description,formRoot,review,...Object.values(buttons),status);draw(state.snapshot());
 return Object.freeze({state,clear:()=>{cleared=true;state.clear();subject.value='';description.value='';dynamic.destroy();review.replaceChildren();status.textContent='';},destroy:()=>{cleared=true;state.clear();dynamic.destroy();subject.value='';description.value='';root.replaceChildren();}});
}
