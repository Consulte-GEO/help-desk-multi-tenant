import {captureGeoCallback,createGeoAuthController} from './geo-auth-state.js';
/** Optional return surface. Import only on the reviewed callback document.
 * Import preserves the existing URL scrub, but never consumes a code or session.
 * mountAuthenticatedPortal is the existing SYNCHRONOUS in-document host adapter;
 * it must not navigate or hand the credentials to storage, HTML or another page. */
let firstCallback=typeof window!=='undefined'?captureGeoCallback(window.location,window.history):null;
const mounted=new WeakMap();
export function mountGeoAuthCallback({document,location,history,request,mountAuthenticatedPortal}){
 if(mounted.has(document))return mounted.get(document);
 let callback=typeof window!=='undefined'&&location===window.location?firstCallback:captureGeoCallback(location,history);firstCallback=null;
 const confirm=document.getElementById('confirm-geo-login'),cancel=document.getElementById('cancel-geo-login'),status=document.getElementById('geo-login-status');
 if(!confirm||!cancel||!status)throw Error('Callback markup unavailable');
 let disposed=false,cancelled=false,authenticated=false,lastActionFocus=false;
 const win=document.defaultView,abort=new (win?.AbortController??AbortController)(),signal=abort.signal;
 const make=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 // Move the SAME controls into an owned section, not a styling constraint on body.
 const holders=[status,confirm,cancel].map(node=>{const mark=document.createComment('UX08 return position');node.parentNode.insertBefore(mark,node);return {node,mark,cls:node.getAttribute('class'),type:node.getAttribute('type'),label:node===status?null:node.textContent};});
 const panel=make('section','hd-geo-access');panel.setAttribute('aria-label','Retorno de acesso do Novo GEO');
 status.parentNode.insertBefore(panel,status);
 const title=make('h1','','Entrar pelo Novo GEO'),intro=make('p','hd-geo-intro','Confira este retorno antes de continuar. A entrada só será solicitada após sua confirmação.');
 const actions=make('div','hd-geo-actions');actions.append(confirm,cancel);
 panel.append(make('p','eyebrow','Consulte GEO · Acesso'),title,intro,status,actions);
 const savedAttrs=['role','aria-live','aria-atomic','tabindex'].map(name=>[name,status.getAttribute(name)]);
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');status.tabIndex=-1;
 confirm.type=cancel.type='button';confirm.classList.add('primary');cancel.classList.add('secondary');confirm.textContent='Confirmar entrada';cancel.textContent='Cancelar entrada';
 const active=()=>!disposed&&!cancelled&&panel.isConnected!==false;
 function paint(stage,text){if(disposed)return;panel.setAttribute('data-geo-stage',stage);status.textContent=text;confirm.setAttribute('aria-busy',String(stage==='validating'));}
 // Status updates are announced; no network update should take focus from a
 // control the user chose elsewhere. Terminal focus is only restored if lost.
 const focusStatus=()=>{if(!disposed&&lastActionFocus&&(document.activeElement===document.body||document.activeElement===confirm)&&!authenticated)status.focus({preventScroll:true});};
 const configured=typeof request==='function'&&typeof mountAuthenticatedPortal==='function';
 const controller=configured?createGeoAuthController({request,onState:s=>{
  if(!active())return;authenticated=s.authenticated===true;confirm.disabled=s.busy||!callback;cancel.disabled=authenticated;
  paint(s.busy?'validating':authenticated?'confirmed':'error',s.message);
  if(!s.busy)focusStatus();
 },onSession:credentials=>{
  if(!active())throw Error('Return surface disposed');
  mountAuthenticatedPortal(credentials);history.replaceState(null,'',credentials.return_path);
 }}):null;
 confirm.disabled=!callback||!configured;cancel.disabled=false;
 paint(!configured?'unconfigured':callback?'ready':'invalid',!configured?'Esta entrada ainda não está configurada. Use o acesso autorizado indicado pela equipe.':callback?'Retorno recebido. Confirme para validar a entrada.':'Este retorno não é válido ou já foi utilizado. Inicie novamente pelo acesso autorizado.');
 confirm.onclick=async()=>{if(!active()||!callback||!controller||confirm.disabled)return;lastActionFocus=document.activeElement===confirm;const once=callback;callback=null;confirm.disabled=true;await controller.complete(once);};
 cancel.onclick=()=>{if(!active()||authenticated)return;callback=null;cancelled=true;controller?.destroy();confirm.disabled=true;cancel.disabled=true;paint('cancelled','Entrada cancelada. Inicie novamente pelo acesso autorizado.');status.focus({preventScroll:true});};
 document.addEventListener('focusin',event=>{if(event.target!==document.body&&event.target!==confirm&&event.target!==status)lastActionFocus=false;},{signal});
 const instance=Object.freeze({controller,destroy(){
  if(disposed)return;disposed=true;callback=null;controller?.destroy();abort.abort();lastActionFocus=false;
  confirm.onclick=null;cancel.onclick=null;confirm.disabled=cancel.disabled=true;confirm.removeAttribute('aria-busy');status.textContent='';
  for(const [name,value]of savedAttrs){if(value===null)status.removeAttribute(name);else status.setAttribute(name,value);}
  for(const {node,mark,cls,type,label}of holders){if(label!==null)node.textContent=label;if(cls===null)node.removeAttribute('class');else node.setAttribute('class',cls);if(type===null)node.removeAttribute('type');else node.setAttribute('type',type);if(mark.parentNode)mark.replaceWith(node);}
  panel.replaceChildren();panel.remove();mounted.delete(document);
 }});mounted.set(document,instance);return instance;
}
