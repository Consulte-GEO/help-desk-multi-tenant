import {accessPhase,loginErrorText} from './access-feedback.js';
const mounts=new WeakMap();
/** No network, URL access, credential reads, availability changes or mutation retry.
 * The application supplies ONLY a phase/code/boolean. Hidden/disabled/inert belong
 * exclusively to its existing controller. This layer never grants authentication. */
export function mountAccessExperience(doc=document,{simple=true}={}){
 if(mounts.has(doc))return mounts.get(doc);
 const win=doc.defaultView,login=doc.getElementById('login-screen'),app=doc.getElementById('app'),form=doc.getElementById('login-form'),status=doc.getElementById('login-status'),submit=doc.getElementById('submit-login');
 if(!win||!login||!form||!status||!submit)return Object.freeze({phase(){},configuration(){},loginError:loginErrorText,reset(){},dispose(){}});
 let disposed=false,current='other',configured=null,lastScope=null,invalidQueued=false;
 const unavailableMessage='O serviço de acesso está indisponível. Recarregue a página para verificar novamente.';
 const abort=new win.AbortController(),signal=abort.signal,owned=[],observers=[],attrs=[];
 const make=(tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 function attr(node,name,value){if(!node)return;const before=node.getAttribute(name);attrs.push({node,name,before,value});node.setAttribute(name,value);}
 function link(node,id){if(!node)return;const words=(node.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);if(!words.includes(id)){words.push(id);attr(node,'aria-describedby',words.join(' '));}}
 attr(login,'data-access-experience','1');attr(login,'data-access-phase','other');attr(status,'aria-atomic','true');attr(status,'data-access-tone','neutral');link(form,status.id);attr(submit,'aria-busy','false');
 const controls=['email','password'].map(id=>doc.getElementById(id)).filter(Boolean),errors=new Map();
 for(const control of controls){
  const error=make('span','hd-access-field-error');error.id='hd-access-error-'+control.id;error.hidden=true;
  const host=control.closest('label')||control.parentElement;host.append(error);owned.push(error);link(control,error.id);
  errors.set(control,{node:error,invalidBefore:control.getAttribute('aria-invalid'),marked:false});
 }
 const banner=doc.getElementById('session-banner'),sessionText=doc.getElementById('session-status');let bannerTitle=null;
 if(banner&&sessionText){
  bannerTitle=make('h2','hd-access-session-title','Sua sessão');bannerTitle.id='hd-access-session-title';banner.insertBefore(bannerTitle,sessionText);owned.push(bannerTitle);
  attr(banner,'aria-atomic','true');attr(banner,'data-access-experience','1');attr(banner,'data-access-tone','neutral');
 }
 const visible=n=>!!n&&n.isConnected&&!n.closest('[hidden],[inert]')&&n.getClientRects().length>0;
 const clearError=control=>{const e=errors.get(control);if(!e)return;e.node.textContent='';e.node.hidden=true;if(e.marked&&control.getAttribute('aria-invalid')==='true'){if(e.invalidBefore===null)control.removeAttribute('aria-invalid');else control.setAttribute('aria-invalid',e.invalidBefore);}e.marked=false;};
 form.addEventListener('invalid',event=>{
  if(!simple||disposed||!errors.has(event.target))return;
  const control=event.target,e=errors.get(control);event.preventDefault();
  e.node.textContent=control.id==='email'?(control.validity.valueMissing?'Informe seu e-mail.':'Informe um e-mail válido.'):'Informe sua senha.';e.node.hidden=false;e.marked=true;control.setAttribute('aria-invalid','true');
  if(!invalidQueued){invalidQueued=true;win.queueMicrotask(()=>{invalidQueued=false;if(disposed)return;const first=controls.find(x=>!errors.get(x).node.hidden);if(first&&visible(first)&&(form.contains(doc.activeElement)||doc.activeElement===doc.body))first.focus();});}
 },{capture:true,signal});
 form.addEventListener('input',event=>{if(errors.has(event.target))clearError(event.target);},{signal});
 doc.addEventListener('focusin',event=>{
  // Native disabling/hiding may move focus to body; retain only the last region,
  // never a credential value or a reference to another user's payload.
  if(event.target===doc.body)return;
  lastScope=login.contains(event.target)?login:app?.contains(event.target)?app:null;
 },{signal});
 let loginWasHidden=login.hidden,appWasHidden=app?.hidden??true;
 function navigateFocus(){
  const active=doc.activeElement,loginNow=login.hidden,appNow=app?.hidden??true;
  const lostFrom=loginNow&&!loginWasHidden?login:appNow&&!appWasHidden?app:null;
  const destination=!appNow&&appWasHidden?app:!loginNow&&loginWasHidden?login:null;
  loginWasHidden=loginNow;appWasHidden=appNow;
  if(!lostFrom||!destination||lastScope!==lostFrom)return;
  if(active!==doc.body&&active!==doc.documentElement&&visible(active))return;
  if(destination===login){const target=controls.find(visible)||login.querySelector('h1');if(target&&visible(target)){if(!controls.includes(target)&&!target.hasAttribute('tabindex'))attr(target,'tabindex','-1');target.focus({preventScroll:true});}}
  else {const view=[...app.querySelectorAll('#tickets-view,#guide-view')].find(visible);const target=view?[...view.querySelectorAll('h1,h2')].find(visible):null;if(target&&visible(target)){if(!target.hasAttribute('tabindex'))attr(target,'tabindex','-1');target.focus({preventScroll:true});}}
 }
 const observer=new win.MutationObserver(()=>{if(!disposed)navigateFocus();});
 observer.observe(login,{attributes:true,attributeFilter:['hidden']});if(app)observer.observe(app,{attributes:true,attributeFilter:['hidden']});observers.push(observer);
 function phase(value){
  if(disposed)return;const next=accessPhase(value);current=next.kind;
  submit.setAttribute('aria-busy',String(next.loginBusy));login.setAttribute('data-access-phase',next.kind);
  if(simple&&next.loginBusy){status.setAttribute('data-access-tone','info');for(const c of controls)clearError(c);}
  if(banner){banner.setAttribute('data-access-tone',next.sessionTone);if(bannerTitle)bannerTitle.textContent=next.kind==='paused'?'Sua sessão precisa ser renovada':next.kind==='refreshing'?'Renovando sua sessão':'Sua sessão';}
 }
 function configuration(available){
  if(disposed||typeof available!=='boolean')return;configured=available;
  if(available&&status.textContent===unavailableMessage){status.textContent='';status.setAttribute('data-access-tone','neutral');}
  // An unavailable backend is not a bad password; no user/account is fabricated.
  if(!available&&simple&&current!=='signing_in'){status.textContent=unavailableMessage;status.setAttribute('data-access-tone','warning');}
 }
 function loginError(code){
  const text=loginErrorText(code);if(!disposed){status.setAttribute('data-access-tone','danger');submit.setAttribute('aria-busy','false');}
  return text; // caller writes into the SAME status region; no duplicate live message
 }
 function reset(){if(disposed)return;for(const c of controls)clearError(c);status.setAttribute('data-access-tone',configured===false?'warning':'neutral');submit.setAttribute('aria-busy','false');}
 function dispose(){
  if(disposed)return;disposed=true;abort.abort();for(const o of observers)o.disconnect();for(const c of controls)clearError(c);
  for(const node of owned){node.textContent='';node.remove();}
  for(const {node,name,before,value} of attrs.reverse()){
   if(name==='aria-describedby'){const remaining=(node.getAttribute(name)||'').split(/\s+/).filter(x=>x&&x!==status.id&&!x.startsWith('hd-access-error-'));if(before!==null)for(const w of before.split(/\s+/))if(w&&!remaining.includes(w))remaining.push(w);if(remaining.length)node.setAttribute(name,remaining.join(' '));else node.removeAttribute(name);}
   else if(node.getAttribute(name)===value||['data-access-tone','data-access-phase','aria-busy'].includes(name)){if(before===null)node.removeAttribute(name);else node.setAttribute(name,before);}
  }
  mounts.delete(doc);lastScope=null;
 }
 const instance=Object.freeze({phase,configuration,loginError,reset,dispose});mounts.set(doc,instance);return instance;
}
