import {captureGeoCallback,createGeoAuthController} from './geo-auth-state.js';
/** Candidate mount. The reviewed host supplies mountAuthenticatedPortal and keeps
 * this document alive, so the session never traverses localStorage or a URL.
 * Merely importing the asset does NOT adopt a session or consume a code. */
let firstCallback=typeof window!=='undefined'?captureGeoCallback(window.location,window.history):null;
export function mountGeoAuthCallback({document,location,history,request,mountAuthenticatedPortal}){
 let callback=typeof window!=='undefined'&&location===window.location?firstCallback:captureGeoCallback(location,history);
 firstCallback=null;
 const confirm=document.getElementById('confirm-geo-login'),cancel=document.getElementById('cancel-geo-login'),status=document.getElementById('geo-login-status');
 if(!confirm||!cancel||!status)throw Error('Callback markup unavailable');
 const configured=typeof request==='function'&&typeof mountAuthenticatedPortal==='function';
 const controller=configured?createGeoAuthController({request,onState:s=>{confirm.disabled=s.busy||!callback;status.textContent=s.message;},onSession:credentials=>{mountAuthenticatedPortal(credentials);history.replaceState(null,'',credentials.return_path);}}):null;
 confirm.disabled=!callback||!configured;status.textContent=configured&&callback?'Confirme para validar este retorno.':'A entrada ainda não está configurada ou o retorno não é válido.';
 confirm.onclick=async()=>{if(!callback||!controller)return;const once=callback;callback=null;confirm.disabled=true;await controller.complete(once);};
 cancel.onclick=()=>{callback=null;controller?.destroy();confirm.disabled=true;status.textContent='Entrada cancelada. Inicie novamente pelo acesso autorizado.';};
 return Object.freeze({controller,destroy:()=>{callback=null;controller?.destroy();confirm.onclick=null;cancel.onclick=null;confirm.disabled=true;status.textContent='';}});
}
// Import scrubs the initial URL but does not consume the code or issue a session.
// The runtime must explicitly invoke the mount with the reviewed portal adapter.
