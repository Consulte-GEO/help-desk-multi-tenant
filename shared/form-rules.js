import {normalizeCnpj} from './cnpj.js';
/** Shared bounded DSL, never executable code. All functions are pure and perform no network. */
export const FORM_TYPES=Object.freeze(['text','textarea','integer','decimal','boolean','date','cnpj','select','multiselect','repeater','table_paste','lookup','file','info','download']);
export const FORM_LIMITS=Object.freeze({bytes:262144,fields:100,rows:100,cells:2000,depth:12,issues:100});
const forbidden=new Set(['__proto__','constructor','prototype']);
export const formError=(code='invalid_form_schema')=>Object.assign(new Error(code==='invalid_form_schema'?'Definição de formulário inválida ou não suportada.':'Respostas do formulário inválidas.'),{code});
export function freezeFormData(value){if(value&&typeof value==='object'){Object.values(value).forEach(freezeFormData);Object.freeze(value);}return value;}
/** Does not call getters/toJSON; counts nodes and decoded UTF-8 bytes. */
export function copyFormData(value){
 let bytes=0,nodes=0;const seen=new Set(),encoder=new TextEncoder();
 const charge=v=>{bytes+=encoder.encode(v).length;if(bytes>FORM_LIMITS.bytes)throw formError();};
 const visit=(v,depth)=>{
  if(++nodes>15000||depth>FORM_LIMITS.depth)throw formError();
  if(v===null||typeof v==='boolean'){bytes+=5;return v;}
  if(typeof v==='string'){if(v.length>32768||/[\u0000\p{Cs}]/u.test(v))throw formError();charge(v);return v;}
  if(typeof v==='number'&&Number.isFinite(v)){bytes+=24;return v;}
  if(!v||typeof v!=='object'||seen.has(v))throw formError();seen.add(v);
  const array=Array.isArray(v),proto=Object.getPrototypeOf(v),keys=Reflect.ownKeys(v);
  if(array?proto!==Array.prototype:proto!==Object.prototype&&proto!==null)throw formError();
  if(keys.some(k=>typeof k!=='string'||forbidden.has(k)))throw formError();
  let out;
  if(array){const length=Object.getOwnPropertyDescriptor(v,'length').value;if(length>2000||keys.length!==length+1)throw formError();out=[];for(let i=0;i<length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d||!d.enumerable||!Object.hasOwn(d,'value'))throw formError();out.push(visit(d.value,depth+1));}}
  else{if(keys.length>150)throw formError();out={};for(const k of keys){charge(k);const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!d.enumerable||!Object.hasOwn(d,'value'))throw formError();out[k]=visit(d.value,depth+1);}}
  seen.delete(v);return out;
 };
 try{const result=visit(value,0);if(bytes>FORM_LIMITS.bytes)throw formError();return result;}catch{throw formError();}
}
const own=(x,required,optional=[])=>{
 if(!x||typeof x!=='object'||Array.isArray(x)||required.some(k=>!Object.hasOwn(x,k))||Object.keys(x).some(k=>![...required,...optional].includes(k)))throw formError();return x;
};
const id=(v,max=80)=>{if(typeof v!=='string'||!v||v.length>max||!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(v)||forbidden.has(v))throw formError();return v;};
const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\p{Cs}]/u.test(v))throw formError();return v;};
const integer=(n,min,max)=>{if(!Number.isSafeInteger(n)||n<min||n>max)throw formError();return n;};
export function decimalValue(v,scale=6){
 if(typeof v!=='string'||v.length>32||!/^(-?)(0|[1-9]\d*)(?:\.(\d+))?$/.test(v)||v==='-0')throw formError('invalid_form_values');
 const match=/^(-?)(\d+)(?:\.(\d+))?$/.exec(v),frac=match[3]??'';
 if(frac.length>scale||match[2].length>18)throw formError('invalid_form_values');
 const n=BigInt(match[2]+frac.padEnd(scale,'0'))*(match[1]==='-'?-1n:1n);
 if(n===0n&&match[1]==='-')throw formError('invalid_form_values');
 return {normalized:(match[1]??'')+match[2]+(frac.replace(/0+$/,'')?'.'+frac.replace(/0+$/,''):''),scaled:n};
}
function date(v){if(typeof v!=='string'||! /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(v))throw formError();const n=Date.parse(v+'T00:00:00.000Z');if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==v)throw formError();return v;}
function schemaFields(input,nested,budget){
 if(!Array.isArray(input)||!input.length||input.length>FORM_LIMITS.fields)throw formError();
 const previous=new Map();
 return input.map(raw=>{
  const f=own(raw,['key','type','label','required','public','config'],['when']);id(f.key,64);text(f.label,160);
  if(previous.has(f.key)||!FORM_TYPES.includes(f.type)||typeof f.required!=='boolean'||typeof f.public!=='boolean'||++budget.fields>FORM_LIMITS.fields)throw formError();
  const c=f.config;
  if(['text','textarea'].includes(f.type)){own(c,['maxLength'],['minLength']);integer(c.maxLength,1,12000);if(c.minLength!==undefined)integer(c.minLength,0,c.maxLength);}
  else if(['integer','decimal'].includes(f.type)){own(c,['min','max',...(f.type==='decimal'?['scale']:[])],['unit']);const scale=f.type==='decimal'?integer(c.scale,0,6):0;if(decimalValue(c.min,scale).scaled>decimalValue(c.max,scale).scaled)throw formError();if(c.unit!==undefined)id(c.unit,24);}
  else if(['date','cnpj','boolean'].includes(f.type))own(c,[]);
  else if(['select','multiselect'].includes(f.type)){
   own(c,['options',...(f.type==='multiselect'?['maxItems']:[])]);
   if(!Array.isArray(c.options)||!c.options.length||c.options.length>100)throw formError();const codes=new Set();
   c.options.forEach(o=>{own(o,['value','label']);id(o.value);text(o.label,160);if(codes.has(o.value))throw formError();codes.add(o.value);});
   if(f.type==='multiselect')integer(c.maxItems,1,c.options.length);
  }else if(['repeater','table_paste'].includes(f.type)){
   own(c,['fields','minRows','maxRows']);if(nested)throw formError();integer(c.maxRows,1,FORM_LIMITS.rows);integer(c.minRows,0,c.maxRows);c.fields=schemaFields(c.fields,true,budget);
   if(f.type==='table_paste'&&c.fields.some(x=>!['text','textarea','integer','decimal','date','cnpj','select'].includes(x.type)||x.when))throw formError();
   if(!f.public&&c.fields.some(x=>x.public))throw formError();
  }else if(f.type==='lookup'){own(c,['resolver']);id(c.resolver);}
  else if(f.type==='file'){own(c,['maxItems']);integer(c.maxItems,1,10);}
  else if(f.type==='info'){own(c,['text']);text(c.text,4000);if(f.required)throw formError();}
  else if(f.type==='download'){own(c,['resource']);id(c.resource);if(f.required)throw formError();}
  if(Object.hasOwn(f,'when')){const w=own(f.when,['field','equals']),before=previous.get(w.field);if(!before||before.when||!['text','select','boolean','integer'].includes(before.type)||f.public&&!before.public)throw formError();
   if(before.type==='boolean'?typeof w.equals!=='boolean':typeof w.equals!=='string')throw formError();
   if(before.type==='select'&&!before.config.options.some(o=>o.value===w.equals))throw formError();
   if(before.type==='integer'){const n=decimalValue(w.equals,0);if(n.normalized!==w.equals||n.scaled<decimalValue(before.config.min,0).scaled||n.scaled>decimalValue(before.config.max,0).scaled)throw formError();}
  }
  previous.set(f.key,f);return f;
 });
}
export function parseFormVersion(raw){try{const s=own(copyFormData(raw),['id','version','status','title','fields']);id(s.id);integer(s.version,1,Number.MAX_SAFE_INTEGER);if(!['draft','published'].includes(s.status))throw formError();text(s.title,200);s.fields=schemaFields(s.fields,false,{fields:0});return freezeFormData(s);}catch{throw formError();}}
export function fieldIsVisible(field,answers,audience='customer'){return (audience==='internal'||field.public)&&(!field.when||answers[field.when.field]===field.when.equals);}
const missing=v=>v===undefined||v===null||v===''||Array.isArray(v)&&v.length===0;
const messages={required:'Preencha este campo.',unknown_field:'Campo não previsto nesta versão.',hidden_field:'Campo não disponível para esta resposta.',invalid_value:'Valor incompatível com o tipo ou limite do campo.',invalid_batch:'Linhas inválidas ou acima do limite.'};
export function validateFormValues(rawSchema,rawAnswers,options={}){
 const s=parseFormVersion(rawSchema),issues=[],requirements=[];let answers;
 const audience=options.audience??'customer';if(!['customer','internal'].includes(audience))throw formError();
 const issue=(path,code)=>{if(issues.length<FORM_LIMITS.issues)issues.push({path,code,message:messages[code]});};
 try{answers=copyFormData(rawAnswers);if(!answers||Array.isArray(answers)||typeof answers!=='object')throw formError();}catch{return freezeFormData({valid:false,answers:{},publicAnswers:{},issues:[{path:'',code:'invalid_value',message:messages.invalid_value}],requirements:[]});}
 let cells=0;
 const scalar=(f,v,path)=>{
  const c=f.config;
  if(['text','textarea'].includes(f.type)){if(typeof v!=='string'||v.length>c.maxLength||v.trim().length<(c.minLength??(f.required?1:0)))throw formError();return v;}
  if(['integer','decimal'].includes(f.type)){const scale=f.type==='integer'?0:c.scale,x=decimalValue(v,scale);if(x.scaled<decimalValue(c.min,scale).scaled||x.scaled>decimalValue(c.max,scale).scaled)throw formError();return x.normalized;}
  if(f.type==='boolean'){if(typeof v!=='boolean')throw formError();return v;}
  if(f.type==='date')return date(v);
  if(f.type==='cnpj')return normalizeCnpj(v);
  if(f.type==='select'){if(!c.options.some(o=>o.value===v))throw formError();return v;}
  if(f.type==='multiselect'){if(!Array.isArray(v)||v.length>c.maxItems||new Set(v).size!==v.length||v.some(x=>!c.options.some(o=>o.value===x)))throw formError();return [...v];}
  if(f.type==='lookup'){if(typeof v!=='string'||!v||v.length>256||v.trim()!==v||/[\p{Cc}\p{Cs}]/u.test(v))throw formError();requirements.push({kind:'lookup',path,key:c.resolver,values:[v]});return v;}
  if(f.type==='file'){if(!Array.isArray(v)||v.length>c.maxItems||new Set(v).size!==v.length)throw formError();v.forEach(x=>id(x,128));requirements.push({kind:'file',path,key:f.key,values:[...v]});return [...v];}
  throw formError();
 };
 const walk=(fields,data,prefix)=>{
  if(!data||typeof data!=='object'||Array.isArray(data)){issue(prefix,'invalid_batch');return [{},{}];}
  const out={},pub={};
  for(const key of Object.keys(data))if(!fields.some(f=>f.key===key))issue(prefix+key,'unknown_field');
  for(const f of fields){if(++cells>FORM_LIMITS.cells)throw formError();const path=prefix+f.key,has=Object.hasOwn(data,f.key),v=data[f.key];
   const visible=fieldIsVisible(f,out,audience);
   if(!visible||['info','download'].includes(f.type)){if(has)issue(path,'hidden_field');continue;}
   if(missing(v)){if(f.required)issue(path,'required');continue;}
   try{
    if(['repeater','table_paste'].includes(f.type)){
     if(!Array.isArray(v)||v.length<f.config.minRows||v.length>f.config.maxRows)throw formError();const r=v.map((row,i)=>walk(f.config.fields,row,path+'['+i+'].'));out[f.key]=r.map(x=>x[0]);if(f.public)pub[f.key]=r.map(x=>x[1]);
    }else{out[f.key]=scalar(f,v,path);if(f.public)pub[f.key]=out[f.key];}
   }catch{issue(path,'invalid_value');}
  }
  return [out,pub];
 };
 let out={},pub={};try{[out,pub]=walk(s.fields,answers,'');}catch{issue('','invalid_batch');}
 return freezeFormData({valid:issues.length===0,answers:issues.length?{}:out,publicAnswers:issues.length?{}:pub,issues,requirements:issues.length?[]:requirements});
}
export function parseTablePaste(rawField,value){
 const f=parseFormVersion({id:'table',version:1,status:'draft',title:'Table',fields:[rawField]}).fields[0];
 if(f.type!=='table_paste'||typeof value!=='string'||value.length>FORM_LIMITS.bytes)throw formError('invalid_form_values');
 const lines=value.replace(/\r\n/g,'\n').split('\n');if(lines.at(-1)==='')lines.pop();const header=lines.shift()?.split('\t');
 const fields=f.config.fields;if(!header||header.join('\0')!==fields.map(x=>x.key).join('\0')||lines.length>f.config.maxRows)throw formError('invalid_form_values');
 const rows=lines.map(line=>{const cells=line.split('\t');if(cells.length!==fields.length)throw formError('invalid_form_values');return Object.fromEntries(fields.map((x,i)=>[x.key,cells[i]]));});
 const result=validateFormValues({id:'table',version:1,status:'draft',title:'Table',fields:[f]},{[f.key]:rows},{audience:'internal'});
 if(!result.valid)throw formError('invalid_form_values');return result.answers[f.key];
}
export function assertFormPublishable(raw,registry){
 const s=parseFormVersion(raw);const r=own(copyFormData(registry),['types','lookups','files','downloads'],['units']);
 if(!Array.isArray(r.types)||!Array.isArray(r.lookups)||!Array.isArray(r.downloads)||typeof r.files!=='boolean')throw formError();
 const units=r.units??[];if(!Array.isArray(units)||units.length>100||new Set(units).size!==units.length)throw formError();units.forEach(u=>id(u,24));
 const walk=fields=>fields.forEach(f=>{if(f.config.unit!==undefined&&!units.includes(f.config.unit))throw formError();if(!r.types.includes(f.type)||f.type==='lookup'&&!r.lookups.includes(f.config.resolver)||f.type==='file'&&!r.files||f.type==='download'&&!r.downloads.includes(f.config.resource))throw formError();if(f.config.fields)walk(f.config.fields);});walk(s.fields);return s;
}
