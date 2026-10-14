/** UX05 presentation primitives. No network, credentials, storage or authorization. */
let sequence=0;
const states=Object.freeze({
 active:{label:'Ativo',tone:'success'},invited:{label:'Convite pendente',tone:'info'},
 expired:{label:'Expirado',tone:'warning'},revoked:{label:'Revogado',tone:'danger'},
 suspended:{label:'Suspenso',tone:'warning'},terminated:{label:'Encerrado',tone:'neutral'},
 draft:{label:'Rascunho',tone:'neutral'},published:{label:'Publicada · somente leitura',tone:'info'},
});
export const adminText=(value,fallback='')=>typeof value==='string'?value:fallback;
export const adminStatus=value=>typeof value==='string'&&Object.hasOwn(states,value)?{...states[value]}:{label:'Indisponível',tone:'neutral'};
export function adminInstant(value){
 if(value===null)return 'Sem expiração';
 if(typeof value!=='string'||!/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(?:\d{3})?Z$/.test(value))return 'Data indisponível';
 const at=value.slice(0,23)+'Z',date=new Date(at);
 if(!Number.isFinite(date.getTime())||date.toISOString()!==at)return 'Data indisponível';
 return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'medium',hourCycle:'h23'}).format(date)+' (São Paulo)';
}
export function adminUI(root,kind){
 const doc=root.ownerDocument,prefix='hd-admin-'+kind+'-'+(++sequence);
 const node=(tag,text,attrs={})=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=adminText(text);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;};
 const listeners=[];
 const listen=(target,event,fn,owner=listeners)=>{target.addEventListener(event,fn);owner.push([target,event,fn]);};
 const removeListeners=(owner=listeners)=>{for(const [e,n,f] of owner)e.removeEventListener(n,f);owner.length=0;};
 const button=(text,fn,primary=false,attrs={},owner=listeners)=>{
  const b=node('button',text,{type:'button',class:primary?'hd-admin-primary':'hd-admin-secondary',...attrs});
  listen(b,'click',event=>{if(!b.disabled)fn(event);},owner);return b;
 };
 const badge=value=>{const s=adminStatus(value);return node('span',s.label,{class:'hd-admin-badge hd-admin-badge--'+s.tone});};
 function field(text,name,{tag='input',hint='',attrs={}}={}){
  const id=prefix+'-'+name,box=node('div',undefined,{class:'hd-admin-field'}),label=node('label',text,{for:id});
  const input=node(tag,undefined,{id,...(tag==='input'?{type:'text',autocomplete:'off'}:{}),...attrs}),help=node('p',hint,{id:id+'-help',class:'hd-admin-hint'}),error=node('p','',{id:id+'-error',class:'hd-admin-error'});
  input.setAttribute('aria-describedby',id+'-help '+id+'-error');help.hidden=!hint;error.hidden=true;box.append(label,input,help,error);
  const feedback=message=>{error.textContent=message;error.hidden=!message;if(message)input.setAttribute('aria-invalid','true');else input.removeAttribute('aria-invalid');};
  return {box,label,input,help,error,feedback};
 }
 const header=(title,description)=>{const h=node('header',undefined,{class:'hd-admin-header'});h.append(node('p','ADMINISTRAÇÃO',{class:'hd-admin-kicker'}),node('h1',title),node('p',description,{class:'hd-admin-muted'}));return h;};
 return {node,button,field,badge,header,listen,removeListeners,prefix};
}
/** Clear detached controls and text before removing a private administrative subtree. */
export function clearAdminNode(node){
 if(!node)return;
 for(const child of Array.from(node.children??[]))clearAdminNode(child);
 const tag=node.tagName?.toLowerCase();
 if(['input','textarea','select'].includes(tag)){node.value='';node.checked=false;node.disabled=true;}
 for(const key of ['data-admin-member','data-admin-target','data-config-record','data-admin-focus'])node.removeAttribute?.(key);
 node.textContent='';
}
