/** UI feedback for the bounded form renderer. Registers ONLY controls already
 * rendered for the current audience. Never resolves schema paths to private labels.
 */
export function issueControlPath(path){return typeof path==='string'?path.replace(/\[(\d+)\]/g,'.$1'):'';}
export function fieldGuidance(field){
 const c=field.config??{};
 if(['text','textarea'].includes(field.type))return `${c.minLength?`Mínimo ${c.minLength}. `:''}Até ${c.maxLength} caracteres.`;
 if(field.type==='integer')return `Número inteiro entre ${c.min} e ${c.max}.`;
 if(field.type==='decimal')return `De ${c.min} a ${c.max}. Use ponto para decimais; até ${c.scale} casas.`;
 if(field.type==='boolean')return 'Selecione Sim ou Não. Não também é uma resposta válida.';
 if(field.type==='cnpj')return 'Informe o CNPJ completo, com ou sem a máscara padrão.';
 if(field.type==='lookup')return 'Selecione nas opções autorizadas. A referência será conferida novamente no envio.';
 if(field.type==='file')return `Até ${c.maxItems} arquivo(s). Referência selecionada não confirma análise nem autorização.`;
 if(field.type==='multiselect')return `Escolha até ${c.maxItems} opção(ões).`;
 return '';
}
export function createFormFeedback(root,prefix){
 const doc=root.ownerDocument,records=new Map(),actions=new Map();
 const node=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const summary=node('section','hd-form-errors');summary.tabIndex=-1;summary.hidden=true;summary.setAttribute('aria-label','Campos que precisam de atenção');
 const title=node('h3'),list=node('ul');summary.append(title,list);
 const expandAndFocus=control=>{
  if(!control||!control.isConnected)return false;
  for(let p=control.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;
  if(control.matches?.(':disabled'))return false;
  control.focus();return true;
 };
 function labelFor(path,label){
  const bits=path.split('.');
  return bits.length===3&&/^\d+$/.test(bits[1])?`${records.get(bits[0])?.label??'Itens'} / Linha ${Number(bits[1])+1} / ${label}`:label;
 }
 function register(path,field,control,box,withHint=true){
  if(!control.id)control.id=prefix+'feedback-'+(records.size+1);
  const error=node('p','hd-field-error');error.id=control.id+'-error';error.hidden=true;box.append(error);
  let hint=null,counter=null;
  if(withHint){const help=fieldGuidance(field);if(help){hint=node('p','hd-field-hint',help);hint.id=control.id+'-hint';box.insertBefore(hint,error);}
   if(['text','textarea'].includes(field.type)){counter=node('p','hd-field-counter');counter.id=control.id+'-counter';counter.setAttribute('aria-live','off');box.insertBefore(counter,error);}
  }
  const original=control.getAttribute('aria-describedby')??'';
  control.setAttribute('aria-describedby',[original,hint?.id,counter?.id,error.id].filter(Boolean).join(' '));
  records.set(path,{control,error,counter,max:field.config?.maxLength,label:labelFor(path,field.label),hint});count(path);
 }
 function count(path){const r=records.get(path);if(r?.counter)r.counter.textContent=`${r.control.value?.length??0} / ${r.max} caracteres`;} 
 function focusPath(path){
  const r=records.get(path),control=r?.control??actions.get(path);
  if(!control)return false;
  const target=['FIELDSET','DIV'].includes(control.tagName)?control.querySelector('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled)')??control:control;
  return expandAndFocus(target);
 }
 function showIssues(issues,{focus=false}={}){
  for(const r of records.values()){r.error.hidden=true;r.error.textContent='';r.control.removeAttribute('aria-invalid');}
  list.replaceChildren();summary.hidden=!issues.length;
  if(!issues.length){title.textContent='';return;}
  title.textContent=`Confira ${issues.length} ${issues.length===1?'campo':'campos'} antes de continuar`;
  for(const issue of issues.slice(0,100)){
   const path=issueControlPath(issue.path),r=records.get(path),li=node('li');
   if(r){r.error.textContent=issue.message;r.error.hidden=false;r.control.setAttribute('aria-invalid','true');const b=node('button','',r.label+' — '+issue.message);b.type='button';b.addEventListener('click',()=>focusPath(path));li.append(b);}
   else li.append(node('span','','Revise os dados do formulário. Um valor não corresponde aos campos disponíveis.'));
   list.append(li);
  }
  if(focus)expandAndFocus(summary);
 }
 function captureFocus(){
  const e=doc.activeElement;if(!root.contains(e))return null;
  const key=e.getAttribute('data-field')??e.getAttribute('data-form-focus');if(!key)return null;
  try{return {key,start:e.selectionStart,end:e.selectionEnd,direction:e.selectionDirection};}catch{return {key};}
 }
 function restoreFocus(saved){
  if(!saved||!focusPath(saved.key))return;
  const e=doc.activeElement;
  if(Number.isInteger(saved.start)&&typeof e.setSelectionRange==='function')try{e.setSelectionRange(saved.start,saved.end,saved.direction);}catch{/* non-text native control */}
 }
 return Object.freeze({register,count,focusPath,captureFocus,restoreFocus,showIssues,
  action(control,key){control.setAttribute('data-form-focus',key);actions.set(key,control);},
  beginRender(){records.clear();actions.clear();list.replaceChildren();title.textContent='';summary.hidden=true;},
  attach(){root.querySelector('h2')?.after(summary);},
  destroy(){for(const r of records.values()){r.error.textContent='';if(r.counter)r.counter.textContent='';}records.clear();actions.clear();list.replaceChildren();title.textContent='';summary.remove();},
 });
}
