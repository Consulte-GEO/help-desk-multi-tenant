import {parseFormVersion,copyFormData,freezeFormData} from '../shared/form-rules.js';
import {mountDynamicForm} from './dynamic-form.js';
/** Optional editor. submit is a server-owned composition of FormCatalog commands,
 * not a generic database setter. No role, capability or publication is granted here.
 */
export function mountFormEditor(root,options){
 const doc=root.ownerDocument;let original=parseFormVersion(options.schema),current=original,phase='idle',intent=null,epoch=0,previewPanel;
 const n=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const heading=n('h2','Editor de formulário versionado'),label=n('label','Schema JSON limitado'),editor=n('textarea');
 const id='form-schema-editor-'+crypto.randomUUID();label.setAttribute('for',id);editor.setAttribute('id',id);editor.setAttribute('maxlength','262144');editor.value=JSON.stringify(current,null,2);
 const status=n('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');const diffView=n('pre'),previewRoot=n('section');
 const reason=n('input');reason.setAttribute('aria-label','Motivo da alteração');reason.setAttribute('maxlength','2000');
 const buttons={preview:n('button','Conferir e visualizar'),save:n('button','Preparar rascunho'),publish:n('button','Preparar publicação'),restore:n('button','Preparar nova versão'),confirm:n('button','Confirmar operação'),cancel:n('button','Cancelar intenção'),reconcile:n('button','Conciliar mesma intenção')};
 for(const b of Object.values(buttons))b.type='button';
 root.replaceChildren(heading,label,editor,...[buttons.preview],diffView,previewRoot,reason,...Object.values(buttons).slice(1),status);
 function diff(){return ['id','version','status','title','fields'].filter(k=>JSON.stringify(original[k])!==JSON.stringify(current[k]));}
 function update(){const available=phase==='idle';editor.disabled=!available;reason.disabled=!available;for(const name of ['preview','save','publish','restore'])buttons[name].disabled=!available;buttons.confirm.disabled=phase!=='prepared';buttons.cancel.disabled=phase!=='prepared';buttons.reconcile.disabled=phase!=='unknown';}
 function draw(){previewPanel?.destroy();previewPanel=mountDynamicForm(previewRoot,{schema:current});diffView.textContent=diff().length?'Alterações: '+diff().join(', '):'Sem alterações de schema.';update();}
 function preview(text){if(phase!=='idle')throw Error('Conclua a intenção atual.');if(typeof text!=='string'||new TextEncoder().encode(text).length>262144)throw Error('Schema excede o limite.');const parsed=parseFormVersion(JSON.parse(text));current=parsed;editor.value=JSON.stringify(parsed,null,2);draw();return parsed;}
 function prepare(action,message){if(phase!=='idle'||!['save','publish','restore'].includes(action)||typeof message!=='string'||!message.trim()||message.length>2000)throw Error('Operação inválida.');preview(editor.value);if(action!=='save'&&diff().length)throw Error('Salve e consulte a versão antes de publicar ou restaurar.');intent=freezeFormData({action,schema:copyFormData(current),reason:message,key:crypto.randomUUID()});phase='prepared';status.textContent='Confirme a operação. A publicação depende da validação do servidor.';update();}
 async function send(){if(typeof options.submit!=='function'){phase='unavailable';status.textContent='Catálogo não conectado ao armazenamento validado.';update();return;}const generation=epoch;phase='sending';update();
  try{const result=await options.submit(intent);if(epoch!==generation)return;if(result?.state==='confirmed'){phase='refresh_required';intent=null;reason.value='';status.textContent='Operação confirmada pelo catálogo. Atualize a versão antes da próxima alteração.';}else if(result?.state==='rejected'){phase='idle';intent=null;status.textContent='Operação recusada. Consulte a revisão atual.';}else{phase='unknown';status.textContent='Confirmação desconhecida. Concilie a mesma intenção.';}}
  catch{if(epoch===generation){phase='unknown';status.textContent='Confirmação desconhecida. Concilie a mesma intenção.';}}finally{if(epoch===generation)update();}}
 async function confirm(){if(phase!=='prepared')throw Error('Confirmação explícita necessária.');await send();}
 async function reconcile(){if(phase!=='unknown')throw Error('Não há intenção para conciliar.');await send();}
 function reload(raw){if(!['idle','refresh_required','unavailable'].includes(phase))throw Error('Conclua a intenção antes de atualizar.');const next=parseFormVersion(raw);if(next.id!==original.id)throw Error('Recrie o painel ao trocar de formulário.');original=next;current=next;phase='idle';intent=null;editor.value=JSON.stringify(next,null,2);reason.value='';status.textContent='Versão atualizada.';draw();}
 function cancel(){if(phase!=='prepared')return;phase='idle';intent=null;status.textContent='Intenção cancelada antes do envio.';update();}
 function clearAudience(){epoch++;intent=null;phase='cleared';editor.value='';reason.value='';current=null;previewPanel?.destroy();diffView.textContent='';status.textContent='';update();}
 const safe=f=>()=>{try{const p=f();if(p?.catch)p.catch(()=>{status.textContent='Operação inválida.';});}catch{status.textContent='Revise o schema ou o motivo informado.';}};
 buttons.preview.addEventListener('click',safe(()=>preview(editor.value)));for(const action of ['save','publish','restore'])buttons[action].addEventListener('click',safe(()=>prepare(action,reason.value)));buttons.confirm.addEventListener('click',safe(confirm));buttons.reconcile.addEventListener('click',safe(reconcile));buttons.cancel.addEventListener('click',cancel);
 draw();return Object.freeze({preview,diff,prepare,confirm,reconcile,cancel,clearAudience,reload,state:()=>phase,destroy:()=>{clearAudience();root.replaceChildren();}});
}
