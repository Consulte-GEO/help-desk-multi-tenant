import {validateRecoveryEmail} from './human-auth.js';
/** Credentials arriving in a navigation are never adopted by this manual recovery flow. */
export function captureRecoveryNavigation(location,history){
 const url=new URL(location.href),fragment=new URLSearchParams(url.hash.slice(1));let secret=null;
 const sensitive=['access_token','refresh_token','token','token_hash','code'];
 const discarded=sensitive.some(k=>url.searchParams.has(k)||fragment.has(k))||url.searchParams.get('type')==='recovery'||fragment.get('type')==='recovery';
 if(discarded){
  const keys=[...fragment.keys()],hash=fragment.get('token_hash');
  if(url.href.length<=4096&&!url.search&&['/','/index.html'].includes(url.pathname)&&keys.length===2&&new Set(keys).size===2&&keys.every(k=>['type','token_hash'].includes(k))&&fragment.get('type')==='recovery'&&/^[A-Za-z0-9_-]{16,256}$/.test(hash??'')&&!hash.startsWith('pkce_'))secret=hash;
  history.replaceState(null,'',url.pathname);
 }
 return Object.freeze({discarded,hasLink:()=>secret!==null,clear:()=>{secret=null;},takeLink:supabaseUrl=>{const value=secret;secret=null;if(value===null)return null;if(typeof supabaseUrl!=='string'||!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(supabaseUrl))throw Error('Provedor de recuperação inválido.');return new URL(supabaseUrl).origin+'/auth/v1/verify?type=recovery&token_hash='+value;}});
}
export function discardRecoveryNavigation(location,history){const intake=captureRecoveryNavigation(location,history);intake.clear();return intake.discarded;}
export function createRecoveryPanel({elements:e,getSession,getEpoch,onResult}){
 let choice=null;
 const current=c=>choice===c&&c.session===getSession()&&c.generation===c.session.state().generation&&c.epoch===getEpoch();
 function clear(){choice=null;for(const n of [e.email,e.link,e.code,e.password,e.confirm])n.value='';e.factors.replaceChildren();e.status.textContent='';e.navigationNote.hidden=true;e.mailStep.hidden=false;e.mfa.hidden=true;e.passwordStep.hidden=true;e.dialog.close();e.start.disabled=false;}
 function sync(state){
  e.entry.disabled=state.phase!=='signed_out';const c=choice;if(!c)return;
  if(!current(c))return;const busy=c.working||state.recoveryBusy;
  const navigation=!!c.navigationLink;e.navigationNote.hidden=!navigation;e.mailStep.hidden=c.started||navigation;e.request.disabled=c.started||busy||navigation;e.email.disabled=c.started||busy||navigation;e.start.disabled=c.started||busy;e.link.disabled=c.started||navigation;e.verify.disabled=busy;e.code.disabled=busy;e.submit.disabled=busy||!state.recoveryReady;e.password.disabled=busy;e.confirm.disabled=busy;
  e.mfa.hidden=state.phase!=='recovering_password'||state.recoveryReady||!state.recoveryFactors.length;e.passwordStep.hidden=state.phase!=='recovering_password'||!state.recoveryReady;
  const selected=e.factors.value;e.factors.replaceChildren(...state.recoveryFactors.map((f,i)=>{const n=document.createElement('option');n.value=f.id;n.textContent='Autenticador '+(i+1)+' · '+f.id.slice(0,8);return n;}));if(state.recoveryFactors.some(f=>f.id===selected))e.factors.value=selected;
 }
 function result(c,message){const s=getSession()?.state();if(c.session===getSession()&&s?.generation===c.generation+1&&s.phase==='signed_out')onResult(message);}
 function open(){const session=getSession(),state=session?.state();if(state?.phase!=='signed_out')return;clear();choice={session,epoch:getEpoch(),generation:state.generation,started:false,working:false};e.dialog.showModal();sync(state);}
 function offerNavigation(link){const session=getSession();if(session?.state().phase!=='signed_out'||typeof link!=='string')return false;open();if(!choice)return false;choice.navigationLink=link;sync(session.state());e.status.textContent='Link de recuperação recebido. Confirme a validação para continuar; o código ainda não foi enviado ao provedor.';return true;}
 async function cancel(){const c=choice;clear();if(c?.started){const logout=await c.session.signOut();result(c,c.intent==='request'?'Solicitação encerrada. Fechar não confirma nem cancela a entrega de e-mail já despachada.':'Recuperação encerrada. Entre novamente para continuar.'+(logout==='unconfirmed'?' Saída no provedor NÃO confirmada.':''));}}
 async function request(){const c=choice;if(!c||c.started||c.working||!current(c))return;const email=e.email.value;e.email.value='';try{validateRecoveryEmail(email);}catch(error){e.status.textContent=error.message;return;}c.intent='request';c.started=true;c.generation++;c.working=true;e.status.textContent='Solicitando um link uma única vez…';
  try{await c.session.requestRecovery(email);result(c,'Se o provedor processar a solicitação e houver conta elegível nesse e-mail, você poderá receber um link. Confira sua caixa de entrada e spam; copie o link direto antes de abri-lo e use Recuperar acesso. Esta resposta não confirma entrega nem existência da conta.');}
  catch(error){if(error.code==='stale_session')return;result(c,error.message+' Nenhum envio foi repetido.');}
  finally{if(current(c)){c.working=false;sync(c.session.state());}}
 }
 async function start(){const c=choice;if(!c||c.started||c.working||!current(c))return;const link=c.navigationLink??e.link.value;c.navigationLink=null;e.link.value='';c.started=true;c.generation++;c.working=true;e.status.textContent='Validando o link uma única vez…';
  try{await c.session.beginRecovery(link);if(current(c))e.status.textContent=c.session.state().recoveryReady?'Link confirmado. Informe sua nova senha.':'Link confirmado. Confirme seu autenticador antes de informar a nova senha.';}
  catch(error){if(error.code==='stale_session')return;result(c,error.message+' Nenhuma senha foi enviada nesta etapa.'+(error.logoutUnconfirmed?' Saída no provedor NÃO confirmada.':''));}
  finally{if(current(c)){c.working=false;sync(c.session.state());}}
 }
 async function verify(){const c=choice;if(!c||c.working||!current(c))return;const factor=e.factors.value,code=e.code.value.trim();e.code.value='';c.working=true;e.status.textContent='Confirmando seu autenticador…';sync(c.session.state());
  try{await c.session.verifyRecoveryMfa(factor,code);if(current(c))e.status.textContent='Autenticador confirmado. Informe sua nova senha.';}
  catch(error){if(error.code==='stale_session')return;if(current(c))e.status.textContent=error.message;else result(c,error.message+' Recuperação encerrada.'+(error.logoutUnconfirmed?' Saída no provedor NÃO confirmada.':''));}
  finally{if(current(c)){c.working=false;sync(c.session.state());}}
 }
 async function submit(){const c=choice;if(!c||c.working||!current(c))return;const password=e.password.value,confirmation=e.confirm.value;e.password.value='';e.confirm.value='';if(!password||password!==confirmation){e.status.textContent='Informe e confirme a mesma nova senha.';return;}c.working=true;e.status.textContent='Enviando sua nova senha uma única vez…';sync(c.session.state());
  try{const receipt=await c.session.changeRecoveryPassword(password);result(c,'Senha alterada pelo provedor. Entre novamente com a nova senha e seu MFA, quando necessário.'+(receipt.logout==='unconfirmed'?' Saída no provedor NÃO confirmada.':''));}
  catch(error){if(error.code==='stale_session')return;if(current(c))e.status.textContent=error.message;else result(c,error.message+' Alteração não confirmada; nenhum envio foi repetido. Use um novo contexto de recuperação ou tente entrar.'+(error.logoutUnconfirmed?' Saída no provedor NÃO confirmada.':''));}
  finally{if(current(c)){c.working=false;sync(c.session.state());}}
 }
 e.dialog.addEventListener('cancel',event=>{event.preventDefault();void cancel();});e.dialog.addEventListener('close',()=>{if(!e.dialog.open&&choice)void cancel();});
 return Object.freeze({offerNavigation,open,request,start,verify,submit,cancel,clear,sync});
}
