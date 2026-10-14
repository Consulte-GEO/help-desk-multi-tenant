import {parseFormVersion,copyFormData,freezeFormData} from '../shared/form-rules.js';
import {mountDynamicForm} from './dynamic-form.js';
import {adminUI,clearAdminNode} from './admin-ui.js';

/** Optional INTERNAL editor. JSON remains bounded data, not executable code.
 * submit is the existing server-owned composition. Preview never publishes/grants access. */
export function mountFormEditor(root,options){
 const ui=adminUI(root,'editor'),{node,button,field,listen}=ui;
 let original=parseFormVersion(options.schema),current=original,phase='idle',intent=null,epoch=0,previewPanel=null,disposed=false,previewStale=false;
 const section=node('section',undefined,{class:'hd-admin','data-admin-panel':'editor'}),header=ui.header('Editor de formulário versionado','Confira a definição, simule o preenchimento e revise a operação antes de confirmar. Nenhuma prévia é publicada automaticamente.'),metadata=node('p','',{class:'hd-admin-muted'});
 header.append(metadata);
 const layout=node('div',undefined,{class:'hd-editor-layout'}),technical=node('section',undefined,{class:'hd-admin-card','data-editor-section':'technical'}),previewSection=node('section',undefined,{class:'hd-admin-card','data-editor-section':'preview'});
 const json=field('Definição do formulário (JSON)','schema',{tag:'textarea',hint:'Edição técnica. Máximo de 262.144 bytes em UTF-8; o conteúdo será validado antes de qualquer operação.',attrs:{maxlength:'262144',class:'hd-editor-json',spellcheck:'false'}}),editor=json.input;
 editor.value=JSON.stringify(current,null,2);
 const bytes=node('p','',{class:'hd-admin-hint'}),previewButton=button('Conferir e visualizar',()=>safe(()=>preview(editor.value)),true);
 technical.append(node('h2','Definição técnica'),json.box,bytes,previewButton);
 const previewAudience=field('Público da prévia','audience',{tag:'select',hint:'Esta escolha simula os campos visíveis. Não altera permissões nem o formulário enviado.'});
 for(const [value,text] of [['customer','Cliente'],['internal','Equipe interna']])previewAudience.input.append(node('option',text,{value}));previewAudience.input.value='customer';
 const stale=node('p','Prévia desatualizada. Clique em Conferir e visualizar para usar a definição editada.',{class:'hd-editor-stale'}),previewRoot=node('fieldset',undefined,{class:'hd-editor-preview'});
 previewSection.append(node('h2','Prévia de preenchimento'),node('p','Dados digitados nesta prévia são apenas uma simulação e não serão gravados.',{class:'hd-admin-muted'}),previewAudience.box,stale,previewRoot);layout.append(technical,previewSection);
 const diffSection=node('section',undefined,{class:'hd-admin-card hd-editor-operation'}),diffView=node('ul',undefined,{class:'hd-editor-diff','data-editor-diff':''});diffSection.append(node('h2','Diferenças da definição conferida'),diffView);
 const operation=node('section',undefined,{class:'hd-admin-card hd-editor-operation','data-editor-section':'operation'}),select=field('Operação','operation',{tag:'select'});
 for(const [value,text] of [['save','Salvar rascunho'],['publish','Publicar versão conferida'],['restore','Preparar nova versão']])select.input.append(node('option',text,{value}));select.input.value='save';
 const reason=field('Motivo da alteração','reason',{hint:'Explique o motivo em até 2.000 caracteres. O texto acompanha a operação confirmada.',attrs:{maxlength:'2000'}});
 const operationHelp=node('p','',{class:'hd-admin-muted'}),prepareGroup=node('div',undefined,{class:'hd-admin-actions'});
 const buttons={
  save:button('Preparar rascunho',()=>safe(()=>prepare('save',reason.input.value)),true,{'data-editor-prepare':'save'}),
  publish:button('Preparar publicação',()=>safe(()=>prepare('publish',reason.input.value)),true,{'data-editor-prepare':'publish'}),
  restore:button('Preparar nova versão',()=>safe(()=>prepare('restore',reason.input.value)),true,{'data-editor-prepare':'restore'})
 };
 prepareGroup.append(...Object.values(buttons));
 const review=node('section',undefined,{class:'hd-editor-review','data-editor-review':''}),reviewData=node('dl'),reviewActions=node('div',undefined,{class:'hd-admin-actions'});
 const confirmButton=button('Confirmar operação',()=>safe(confirm),true),cancelButton=button('Cancelar intenção',()=>cancel());reviewActions.append(cancelButton,confirmButton);review.append(node('h3','Confira antes de confirmar'),reviewData,node('p','O servidor verificará a versão, o catálogo e suas permissões. Preparar esta operação ainda não enviou nenhuma alteração.',{class:'hd-admin-muted'}),reviewActions);
 const reconcileButton=button('Conciliar mesma intenção',()=>safe(reconcile),true),status=node('p','',{role:'status','aria-live':'polite',class:'hd-admin-status'});
 operation.append(node('h2','Preparar operação'),select.box,operationHelp,reason.box,prepareGroup,review,reconcileButton);
 section.append(header,layout,diffSection,operation,status);root.replaceChildren(section);
 const actionText={save:'Salvar rascunho',publish:'Publicar versão conferida',restore:'Preparar nova versão'};
 function diff(){return !current||!original?[]:['id','version','status','title','fields'].filter(k=>JSON.stringify(original[k])!==JSON.stringify(current[k]));}
 function update(){
  const available=phase==='idle';section.setAttribute('data-editor-phase',phase);section.setAttribute('aria-busy',String(phase==='sending'));
  editor.disabled=reason.input.disabled=select.input.disabled=previewAudience.input.disabled=!available;previewRoot.disabled=!available;previewButton.disabled=!available;
  const action=Object.hasOwn(actionText,select.input.value)?select.input.value:'save';
  for(const [name,b] of Object.entries(buttons)){b.hidden=!available||name!==action;b.disabled=!available;}
  prepareGroup.hidden=!available;select.box.hidden=reason.box.hidden=operationHelp.hidden=!available;
  operationHelp.textContent=action==='save'?'Salve uma definição como rascunho, sem publicar.':action==='publish'?'A publicação usa uma versão já salva e consultada. Uma prévia alterada precisa ser salva primeiro.':'Prepare uma nova versão sem apagar o histórico. A atribuição da versão depende do servidor.';
  review.hidden=phase!=='prepared'&&phase!=='sending';confirmButton.disabled=cancelButton.disabled=phase!=='prepared';reconcileButton.hidden=phase!=='unknown';reconcileButton.disabled=phase!=='unknown';
  stale.hidden=!previewStale||phase==='cleared';
  metadata.textContent=original?'Versão consultada '+original.version+' · '+(original.status==='published'?'Publicada no catálogo consultado':'Rascunho')+' · '+original.fields.length+' campo(s) na definição':'';
  bytes.textContent=phase==='cleared'?'':new TextEncoder().encode(editor.value).length.toLocaleString('pt-BR')+' / 262.144 bytes UTF-8';
  if(phase!=='prepared'&&phase!=='sending')clearAdminNode(reviewData);
 }
 function drawDiff(){
  clearAdminNode(diffView);const keys=diff(),names={id:'Identificador',version:'Versão',status:'Situação',title:'Título',fields:'Campos'};
  if(!keys.length){diffView.append(node('li','Sem alterações na definição conferida.'));return;}
  for(const key of keys){const description=key==='fields'?'Campos: estrutura, rótulos ou regras alterados.':names[key]+': '+String(original[key])+' → '+String(current[key]);diffView.append(node('li',description));}
 }
 function drawPreview(){previewPanel?.destroy();previewPanel=mountDynamicForm(previewRoot,{schema:current,audience:previewAudience.input.value==='internal'?'internal':'customer'});}
 function draw(){drawPreview();drawDiff();update();}
 function preview(text){
  if(phase!=='idle')throw Error('Conclua a intenção atual.');
  try{
   if(typeof text!=='string'||new TextEncoder().encode(text).length>262144)throw Error('Schema excede o limite.');
   const parsed=parseFormVersion(JSON.parse(text));current=parsed;editor.value=JSON.stringify(parsed,null,2);previewStale=false;json.feedback('');draw();return parsed;
  }catch(error){previewStale=true;json.feedback('Definição inválida. Revise o JSON, os campos permitidos e o limite de 262.144 bytes.');update();throw error;}
 }
 function prepare(action,message){
  if(phase!=='idle'||!['save','publish','restore'].includes(action)||typeof message!=='string'||!message.trim()||message.length>2000)throw Error('Operação inválida.');
  preview(editor.value);if(action!=='save'&&diff().length)throw Error('Salve e consulte a versão antes de publicar ou restaurar.');
  intent=freezeFormData({action,schema:copyFormData(current),reason:message,key:crypto.randomUUID()});phase='prepared';status.textContent='Confirme a operação. A publicação depende da validação do servidor.';
  clearAdminNode(reviewData);for(const [label,value] of [['Operação',actionText[action]],['Formulário',current.title],['Versão informada',String(current.version)],['Motivo',message]])reviewData.append(node('dt',label),node('dd',value));
  update();confirmButton.focus();
 }
 async function send(){
  if(typeof options.submit!=='function'){phase='unavailable';status.textContent='Catálogo não conectado ao armazenamento validado.';update();return;}
  const generation=epoch;phase='sending';status.textContent='Registrando a operação uma única vez…';update();
  try{
   const result=await options.submit(intent);if(epoch!==generation)return;
   if(result?.state==='confirmed'){phase='refresh_required';intent=null;reason.input.value='';status.textContent='Operação confirmada pelo catálogo. Atualize a versão pela página antes da próxima alteração.';}
   else if(result?.state==='rejected'){phase='idle';intent=null;status.textContent='Operação recusada. Consulte a revisão atual.';}
   else{phase='unknown';status.textContent='Confirmação desconhecida. Concilie a mesma intenção.';}
  }catch{if(epoch===generation){phase='unknown';status.textContent='Confirmação desconhecida. Concilie a mesma intenção.';}}
  finally{if(epoch===generation){update();if(phase==='unknown')reconcileButton.focus();else{status.setAttribute('tabindex','-1');status.focus();}}}
 }
 async function confirm(){if(phase!=='prepared')throw Error('Confirmação explícita necessária.');await send();}
 async function reconcile(){if(phase!=='unknown')throw Error('Não há intenção para conciliar.');await send();}
 function reload(raw){
  if(!['idle','refresh_required','unavailable'].includes(phase))throw Error('Conclua a intenção antes de atualizar.');
  const next=parseFormVersion(raw);if(next.id!==original.id)throw Error('Recrie o painel ao trocar de formulário.');
  original=next;current=next;phase='idle';intent=null;previewStale=false;editor.value=JSON.stringify(next,null,2);reason.input.value='';json.feedback('');reason.feedback('');status.textContent='Versão atualizada.';draw();
 }
 function cancel(){if(phase!=='prepared')return;phase='idle';intent=null;status.textContent='Intenção cancelada antes do envio.';update();(buttons[select.input.value]??buttons.save).focus();}
 function clearAudience(){
  epoch++;intent=null;phase='cleared';editor.value='';reason.input.value='';current=original=null;previewPanel?.destroy();previewPanel=null;previewStale=false;
  clearAdminNode(diffView);clearAdminNode(reviewData);metadata.textContent=bytes.textContent=status.textContent='';json.feedback('');reason.feedback('');update();
 }
 function safe(fn){
  if(disposed||phase==='cleared')return;const generation=epoch;
  const fail=()=>{if(disposed||generation!==epoch)return;status.textContent='Revise a definição e o motivo. Para publicar ou preparar nova versão, salve e consulte primeiro a versão atual.';if(json.input.getAttribute('aria-invalid')==='true')json.input.focus();else if(!reason.input.value.trim()){reason.feedback('Informe o motivo da operação.');reason.input.focus();}};
  try{const promise=fn();if(promise?.catch)promise.catch(fail);}catch{fail();}
 }
 listen(editor,'input',()=>{if(phase!=='idle')return;previewStale=true;json.feedback('');update();});
 listen(select.input,'change',()=>update());
 listen(previewAudience.input,'change',()=>{if(phase==='idle'&&current){drawPreview();update();}});
 draw();
 return Object.freeze({preview,diff,prepare,confirm,reconcile,cancel,clearAudience,reload,state:()=>phase,destroy(){if(disposed)return;disposed=true;clearAudience();ui.removeListeners();clearAdminNode(section);root.replaceChildren();}});
}
