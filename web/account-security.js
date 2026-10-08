/** Own first/additional factor setup. Secret exists only in the explicitly opened dialog. */
import {drawTotpQr} from './totp-qr.js';
export function createMfaEnrollmentPanel({elements:e,getSession,getEpoch,blocked,onResult}){
 let choice=null;
 function eraseQr(){if(e.qr){e.qr.hidden=true;e.qr.width=e.qr.height=0;}}
 function busy(value){e.start.disabled=value||choice?.started===true;e.confirm.disabled=value||!choice?.started;e.factor.disabled=value;e.code.disabled=value;}
 function clear(){choice=null;eraseQr();e.label.textContent='';e.secret.textContent='';e.code.value='';e.factor.replaceChildren();e.provision.hidden=true;e.status.textContent='';e.dialog.close();busy(false);}
 const current=c=>choice===c&&c.epoch===getEpoch()&&c.generation===getSession()?.state().generation;
 function result(c,message){const s=getSession()?.state();if(s?.generation===c.generation+1&&s.phase==='signed_out')onResult(message);}
 async function closeStarted(c){
  const logout=await getSession().signOut();
  result(c,'Chave e códigos removidos deste navegador. O cadastro poderá permanecer pendente no provedor; nenhum fator foi removido. Entre novamente para continuar.'+(logout==='unconfirmed'?' Saída no provedor NÃO confirmada.':''));
 }
 async function cancel(){const c=choice;clear();if(c?.started)await closeStarted(c);}
 function open({additional=false}={}){
  if(typeof additional!=='boolean')throw Error('Configuração de autenticador inválida.');
  const s=getSession()?.state();if(!s||!['active','paused','refreshing'].includes(s.phase))return;
  if(blocked())throw Error('Conclua ou reconcilie o envio atual antes de configurar MFA.');
  clear();choice={epoch:getEpoch(),generation:s.generation,started:false,working:false,additional};
  e.title.textContent=additional?'Adicionar outro autenticador':'Configurar meu primeiro autenticador';
  e.description.textContent=(additional?'Adicione mais um aplicativo à própria conta, mantendo seu autenticador confirmado. É necessário ter entrado com MFA. ':'Cadastro opcional do primeiro autenticador da própria conta. ')+ 'Ao iniciar, novas operações ficam pausadas; ao confirmar ou encerrar, entre novamente. Fechar apaga a chave desta tela e pode deixar cadastro pendente. A aplicação não remove fatores; ao confirmar, o provedor pode limpar outros cadastros não confirmados e encerrar sessões conforme sua política.';
  e.dialog.showModal();busy(false);
 }
 async function start(){
  const c=choice;if(!c||c.started||c.working||!current(c))return;if(blocked())throw Error('Conclua ou reconcilie o envio atual antes de configurar MFA.');
  c.started=true;c.working=true;busy(true);e.status.textContent=c.additional?'Consultando seus fatores e preparando outro autenticador…':'Consultando seus fatores e preparando o primeiro autenticador…';
  try{const registration=await getSession().beginMfaEnrollment({additional:c.additional});if(!current(c))return;
   e.factor.replaceChildren(...registration.factors.map((factor,i)=>{const option=document.createElement('option');option.value=factor.id;option.textContent='Autenticador pendente '+(i+1)+' · '+factor.id.slice(0,8);return option;}));
   e.secret.textContent=registration.secret??'';e.label.textContent=registration.generated?'Consulte Help Desk · '+registration.factors[0].id:'';e.provision.hidden=!registration.generated;
   eraseQr();let qrReady=false;
   if(registration.generated&&e.qr){try{drawTotpQr(e.qr,registration.secret,registration.factors[0].id);qrReady=true;}catch{eraseQr();}}
   e.status.textContent=registration.generated?(qrReady?'Leia o QR ou adicione a chave manualmente ao aplicativo. Confirme o código para ativar.':'QR indisponível. Adicione a chave manualmente ao seu aplicativo e confirme o código para ativar.'): 'Já existe TOTP pendente. Se você já o configurou no aplicativo, confirme o código. A chave anterior não pode ser exibida; sem ela, será necessária revisão no provedor.';
  }catch(error){if(error.code==='stale_session')return;
   if(current(c)){c.started=false;e.status.textContent=error.message;}else result(c,error.message+' Cadastro não confirmado; poderá haver fator pendente. Nenhum envio foi repetido.'+(error.logoutUnconfirmed?' Saída no provedor NÃO confirmada.':''));
  }finally{if(current(c)){c.working=false;busy(false);}}
 }
 async function confirm(){
  const c=choice;if(!c||!c.started||c.working||!current(c))return;
  const factor=e.factor.value,code=e.code.value.trim();e.code.value='';c.working=true;busy(true);e.status.textContent='Confirmando o código uma única vez…';
  try{const receipt=await getSession().confirmMfaEnrollment(factor,code);result(c,'Autenticador confirmado pelo provedor. Entre novamente com a senha e o código do aplicativo.'+(receipt.logout==='unconfirmed'?' Saída no provedor NÃO confirmada.':''));}
  catch(error){if(error.code==='stale_session')return;if(current(c))e.status.textContent=error.message;else result(c,error.message+' Confirmação não obtida; o fator poderá estar pendente ou confirmado. Nenhum envio foi repetido.'+(error.logoutUnconfirmed?' Saída no provedor NÃO confirmada.':''));}
  finally{if(current(c)){c.working=false;busy(false);}}
 }
 e.dialog.addEventListener('cancel',event=>{event.preventDefault();void cancel();});
 e.dialog.addEventListener('close',()=>{if(!e.dialog.open&&choice){const c=choice;clear();if(c.started)void closeStarted(c);}});
 return Object.freeze({open,start,confirm,cancel,clear});
}

/** Read-only own catalog; closing invalidates late responses and erases the snapshot. */
export function createSecurityStatusPanel({elements:e,getSession,getEpoch}){
 let choice=null;
 const types={totp:'Aplicativo TOTP',phone:'Telefone',webauthn:'WebAuthn',recovery_code:'Código de recuperação'};
 const current=c=>choice===c&&c.epoch===getEpoch()&&c.session===getSession()&&c.generation===c.session.state().generation;
 function erase(){e.factors.replaceChildren();e.level.textContent='';e.status.textContent='';}
 function clear(){choice=null;erase();e.refresh.disabled=false;e.dialog.close();}
 async function refresh(){
  const c=choice;if(!c||c.busy||!current(c))return;c.busy=true;e.refresh.disabled=true;erase();e.status.textContent='Consultando a segurança da sua conta…';
  try{const snapshot=await c.session.securityStatus();if(!current(c))return;if(!c.session.securityStatusCurrent(snapshot)){e.status.textContent='A sessão mudou durante a consulta. Atualize para consultar novamente.';return;}
   e.level.textContent='Nível informado pela sessão: '+({aal1:'AAL1 — entrada convencional',aal2:'AAL2 — entrada com MFA',unknown:'não identificado'}[snapshot.currentLevel]);
   e.factors.replaceChildren(...snapshot.factors.map(f=>{const row=document.createElement('li');row.textContent=types[f.type]+' · '+(f.status==='verified'?'Confirmado':'Pendente')+' · '+f.id.slice(0,8);return row;}));
   e.status.textContent=snapshot.factors.length?'Consulta concluída. Atualize para conferir alterações posteriores.':'Nenhum fator informado pelo provedor nesta consulta.';
  }catch(error){if(current(c))e.status.textContent=error.code==='stale_session'?'A sessão mudou durante a consulta. Atualize para consultar novamente.':error.message;}
  finally{if(current(c)){c.busy=false;e.refresh.disabled=false;}}
 }
 function open(){const session=getSession(),s=session?.state();if(!s||!['active','paused','refreshing'].includes(s.phase))return;clear();choice={session,epoch:getEpoch(),generation:s.generation,busy:false};e.dialog.showModal();return refresh();}
 e.dialog.addEventListener('cancel',event=>{event.preventDefault();clear();});e.dialog.addEventListener('close',()=>{if(choice&&!e.dialog.open)clear();});
 return Object.freeze({open,refresh,clear});
}
