import {parseFormVersion,validateFormValues,copyFormData,freezeFormData,fieldIsVisible,parseTablePaste} from '../shared/form-rules.js';
let mountSequence=0;
/** Safe DOM renderer. Provider ports return selected REFERENCES, not authorization.
 * The server must independently validate the exact form, scoped lookup and clean
 * file receipts during commit. No persistence, tokens, arbitrary URLs or HTML.
 */
export function mountDynamicForm(root,options){
 const schema=parseFormVersion(options.schema),doc=root.ownerDocument,prefix='support-form-'+(++mountSequence)+'-';
 let answers=options.answers?copyFormData(options.answers):{},audience=options.audience??'customer',disposed=false,generation=0;
 if(!answers||typeof answers!=='object'||Array.isArray(answers))throw Error('Respostas inválidas.');
 let controls=[],listeners=[],requests=new Set(),selections=new Map();
 const node=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const active=()=>{if(disposed)throw Error('Formulário encerrado.');};
 const listen=(e,name,fn)=>{e.addEventListener(name,fn);listeners.push([e,name,fn]);};
 function scrub(){for(const e of controls){e.value='';e.checked=false;}for(const [e,n,f] of listeners)e.removeEventListener(n,f);controls=[];listeners=[];}
 const label=(box,f,path,input)=>{const id=prefix+path.replaceAll('.','-');input.setAttribute('id',id);input.setAttribute('data-field',path);input.setAttribute('aria-required',String(f.required));const l=node('label',f.label+(f.config?.unit?' ('+f.config.unit+')':'')+(f.required?' *':''));l.setAttribute('for',id);box.append(l,input);controls.push(input);};
 function location(path){const bits=path.split('.');let owner=answers,fields=schema.fields;for(let i=0;i<bits.length;i++){const f=fields.find(v=>v.key===bits[i]);if(!f)throw Error('Campo inválido.');if(i===bits.length-1)return {owner,key:f.key,field:f};if(!['repeater','table_paste'].includes(f.type))throw Error('Campo inválido.');const index=Number(bits[++i]);if(!Number.isSafeInteger(index)||index<0||!Array.isArray(owner[f.key])||!owner[f.key][index])throw Error('Linha inválida.');owner=owner[f.key][index];fields=f.config.fields;}throw Error('Campo inválido.');}
 const status=node('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 function clearHidden(fields,values){for(const f of fields){if(!fieldIsVisible(f,values,audience)){delete values[f.key];continue;}if(['repeater','table_paste'].includes(f.type)&&Array.isArray(values[f.key]))for(const row of values[f.key])clearHidden(f.config.fields,row);}}
 function show(){active();clearHidden(schema.fields,answers);scrub();root.replaceChildren();const heading=node('h2',schema.title);root.append(heading);render(schema.fields,answers,root,'');root.append(status);}
 function render(fields,values,parent,base){for(const f of fields){if(!fieldIsVisible(f,values,audience))continue;const path=base+f.key,box=node('div');box.setAttribute('class','dynamic-field');parent.append(box);
  if(f.type==='info'){box.append(node('p',f.config.text));continue;}
  if(f.type==='download'){const b=node('button',f.label);b.type='button';b.disabled=typeof options.download!=='function';listen(b,'click',()=>{const stamp=generation;if(!b.disabled)void Promise.resolve().then(()=>{if(disposed||stamp!==generation)return;return options.download(f.config.resource);}).catch(()=>{if(!disposed&&stamp===generation)status.textContent='Documento indisponível.';});});box.append(b);continue;}
  if(['repeater','table_paste'].includes(f.type)){
   box.append(node('h3',f.label));const rows=Array.isArray(values[f.key])?values[f.key]:[];
   for(let i=0;i<rows.length;i++){const line=node('fieldset');line.append(node('legend',`Linha ${i+1}`));render(f.config.fields,rows[i],line,path+'.'+i+'.');const remove=node('button','Remover linha');remove.type='button';listen(remove,'click',()=>removeRow(path,i));line.append(remove);box.append(line);}
   if(f.type==='repeater'){const add=node('button','Adicionar linha');add.type='button';add.disabled=rows.length>=f.config.maxRows;listen(add,'click',()=>addRow(path));box.append(add);}
   else{const area=node('textarea');label(box,{...f,label:'Cole a tabela, incluindo o cabeçalho'},path+':paste',area);area.setAttribute('placeholder',f.config.fields.map(c=>c.key).join('\t'));const apply=node('button','Conferir e aplicar tabela');apply.type='button';listen(apply,'click',()=>{try{paste(path,area.value);status.textContent='Tabela conferida.';}catch{status.textContent='Tabela inválida. Os dados anteriores foram preservados.';}});box.append(apply);}
   continue;
  }
  if(f.type==='multiselect'){const group=node('fieldset');group.append(node('legend',f.label));for(const choice of f.config.options){const input=node('input');input.type='checkbox';input.checked=Array.isArray(values[f.key])&&values[f.key].includes(choice.value);input.setAttribute('data-choice',choice.value);label(group,{...f,label:choice.label,required:false},path+':'+choice.value,input);listen(input,'change',()=>{const next=new Set(values[f.key]??[]);if(input.checked)next.add(choice.value);else next.delete(choice.value);values[f.key]=[...next];});}box.append(group);continue;}
  const input=node(f.type==='textarea'?'textarea':f.type==='select'?'select':'input');
  if(f.type==='select'){const placeholder=node('option','Selecione');placeholder.value='';input.append(placeholder);for(const o of f.config.options){const e=node('option',o.label);e.value=o.value;input.append(e);}}
  if(!['textarea','select'].includes(f.type))input.type=f.type==='boolean'?'checkbox':f.type==='date'?'date':'text';
  input.value=typeof values[f.key]==='string'?values[f.key]:'';input.checked=values[f.key]===true;
  if(f.config.maxLength)input.setAttribute('maxlength',String(f.config.maxLength));if(['integer','decimal'].includes(f.type))input.setAttribute('inputmode','decimal');
  if(['lookup','file'].includes(f.type)){input.readOnly=true;input.value=f.type==='file'?(values[f.key]??[]).join(', '):values[f.key]??'';label(box,f,path,input);const b=node('button',f.type==='file'?'Selecionar evidências':'Consultar opções autorizadas');b.type='button';b.disabled=typeof options[f.type==='file'?'chooseFiles':'chooseLookup']!=='function';listen(b,'click',()=>{void choose(path).catch(()=>{status.textContent='Não foi possível consultar as opções.';});});box.append(b);continue;}
  label(box,f,path,input);listen(input,f.type==='boolean'||f.type==='select'?'change':'input',()=>{active();values[f.key]=f.type==='boolean'?input.checked:input.value;if(fields.some(other=>other.when?.field===f.key))show();});
 }}
 function addRow(path){active();const {owner,key,field}=location(path);if(field.type!=='repeater')throw Error('Campo não repetível.');const rows=owner[key]??[];if(!Array.isArray(rows)||rows.length>=field.config.maxRows)throw Error('Limite de linhas atingido.');owner[key]=[...rows,{}];show();}
 function removeRow(path,index){active();const {owner,key,field}=location(path);if(!['repeater','table_paste'].includes(field.type)||!Array.isArray(owner[key])||!Number.isSafeInteger(index)||index<0||index>=owner[key].length)throw Error('Linha inválida.');owner[key].splice(index,1);show();}
 function paste(path,text){active();const {owner,key,field}=location(path);const rows=parseTablePaste(field,text);owner[key]=copyFormData(rows);show();}
 async function choose(path){active();const {owner,key,field}=location(path),fn=options[field.type==='file'?'chooseFiles':'chooseLookup'];if(!['lookup','file'].includes(field.type)||typeof fn!=='function')throw Error('Consulta indisponível.');const epoch=generation,abort=new AbortController();selections.get(path)?.abort();selections.set(path,abort);requests.add(abort);
  try{const value=await fn(field.type==='file'?path:field.config.resolver,{signal:abort.signal});if(disposed||epoch!==generation||abort.signal.aborted)return;const local={...schema,fields:[{...field,when:undefined}]};delete local.fields[0].when;const result=validateFormValues(local,{[key]:value},{audience});if(!result.valid)throw Error('Referência inválida.');owner[key]=copyFormData(result.answers[key]);show();}finally{requests.delete(abort);if(selections.get(path)===abort)selections.delete(path);}}
 function validate(){active();const result=validateFormValues(schema,answers,{audience});status.textContent=result.valid?'Campos conferidos. A autorização será validada no envio.':result.issues.map(i=>i.path+': '+i.message).join(' ');return result;}
 function invalidate(){generation++;for(const c of requests)c.abort();requests.clear();selections.clear();scrub();answers={};status.textContent='';}
 show();return Object.freeze({validate,draftAnswers:()=>{active();clearHidden(schema.fields,answers);return freezeFormData(copyFormData(answers));},snapshot:()=>{active();return freezeFormData({formId:schema.id,formVersion:schema.version,result:validate(),commitAuthorized:false});},addRow,removeRow,paste,choose,
  setAudience:(next)=>{active();if(!['customer','internal'].includes(next))throw Error('Público inválido.');invalidate();audience=next;show();},destroy:()=>{if(disposed)return;invalidate();disposed=true;root.replaceChildren();}});
}
