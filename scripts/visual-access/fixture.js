/* TEST ONLY. No real Auth/server, no tokens from user accounts. Not copied by build. */
import {mountAccessExperience} from '../../web/access-experience.js';
import {mountBrandShell} from '../../web/brand-shell.js';
window.BRAND=mountBrandShell(document);window.UX=mountAccessExperience(document);
window.REQUESTS=[];window.ADOPTIONS=[];window.HISTORY=[];
const $=id=>document.getElementById(id);
window.hostPhase=phase=>{
 $('submit-login').disabled=phase!=='signed_out';
 $('session-banner').hidden=!['paused','refreshing'].includes(phase);
 $('retry-session').hidden=phase!=='paused';$('retry-session').disabled=phase==='refreshing';
 $('session-status').textContent=phase==='paused'?'Não foi possível renovar a sessão. O rascunho permanece somente nesta tela. Tente renovar ou saia.':'Renovando a sessão antes de novas requisições…';
 if(phase==='signing_in')$('login-status').textContent='Entrando…';
 UX.phase(phase);
};
window.hostLogin=()=>{$('login-screen').hidden=true;$('app').hidden=false;$('empty-detail').hidden=true;$('ticket-detail').hidden=false;$('ticket-title').textContent='Solicitação fictícia para conferir a sessão';$('identity-name').textContent='Perfil fictício';$('workspace-label').textContent='Operação de demonstração';};
window.hostLogout=()=>{UX.reset();$('app').hidden=true;$('login-screen').hidden=false;$('password').value='';$('message-body').value='';$('login-status').textContent='Sessão local encerrada. Entre novamente para continuar.';hostPhase('signed_out');};
window.hostFailure=code=>{hostPhase('signed_out');$('login-status').textContent=UX.loginError(code);};
window.enableSimple=()=>{UX.configuration(true);hostPhase('signed_out');};
window.openAdvanced=id=>{const d=$(id),box=d.closest('[data-advanced-access]');box.hidden=false;box.inert=false;d.showModal();return id;};
window.closeAdvanced=id=>{const d=$(id);d.close();const box=d.closest('[data-advanced-access]');box.hidden=true;box.inert=true;};
window.callbackSetup=async(mode='ready')=>{
 window.CB?.destroy();$('callback-fixture')?.remove();
 $('app').hidden=true;$('login-screen').hidden=true;
 const section=document.createElement('div');section.id='callback-fixture';section.innerHTML='<p id="geo-login-status"></p><button type="button" id="confirm-geo-login">Confirmar</button><button type="button" id="cancel-geo-login">Cancelar</button>';document.body.append(section);
 const mod=await import('../../web/geo-auth-callback.js');
 REQUESTS=[];ADOPTIONS=[];HISTORY=[];window.RETURN_MODE=mode;
 const start='https://helpdesk.example.invalid/auth/geo/callback?code=PRIVATE_CALLBACK&state='+ 's'.repeat(43)+'&iss=https%3A%2F%2Forigin.example.invalid';
 window.RETURN_LOCATION={href:mode==='invalid'?start+'&token=PRIVATE_EXTRA':start};
 const history={replaceState(_a,_b,path){HISTORY.push(path);RETURN_LOCATION.href='https://helpdesk.example.invalid'+path;}};
 const receipt={principal_id:'00000000-0000-4000-8000-000000000002',workspace_id:'00000000-0000-4000-8000-000000000001',access_token:'hd_person_'+ 'a'.repeat(43),refresh_token:'hd_person_refresh_'+ 'b'.repeat(43),expires_at:'2026-10-13T23:00:00.000Z',absolute_expires_at:'2026-10-14T00:00:00.000Z',return_path:'/portal'};
 window.RETURN_RECEIPT=receipt;
 const request=async(path,init)=>{REQUESTS.push({path,method:init.method,body:init.body});if(RETURN_MODE==='delay')return new Promise(resolve=>{window.RESOLVE_RETURN=()=>resolve(Response.json(receipt));});if(RETURN_MODE==='refused')return new Response('PRIVATE_SERVER_BODY',{status:410});if(RETURN_MODE==='incompatible')return Response.json({...receipt,return_path:'https://evil.example.invalid'});return Response.json(receipt);};
 const host=credentials=>{if(RETURN_MODE==='mount-failed')throw Error('PRIVATE_HOST_ERROR');ADOPTIONS.push(credentials.principal_id);};
 window.CB=mod.mountGeoAuthCallback({document,location:RETURN_LOCATION,history,request:mode==='unconfigured'?undefined:request,mountAuthenticatedPortal:host});
 window.REMOUNT_RETURN=()=>mod.mountGeoAuthCallback({document,location:RETURN_LOCATION,history,request,mountAuthenticatedPortal:host});
};
window.READY=true;
