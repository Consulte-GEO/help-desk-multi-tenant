import {copyFormData,freezeFormData} from '../shared/form-rules.js';
export function deliveryStatusText(state){return ({pending:'Notificação pendente.',leased:'Preparando envio.',sending:'Tentativa em andamento; aguarde a confirmação.',retry_wait:'Canal confirmou não aceitação; nova tentativa aguardando intervalo.',accepted:'Aceita pelo provedor; entrega ainda não confirmada.',delivered:'Entrega confirmada pelo provedor.',failed:'Falha confirmada. Consulte o registro.',unknown:'Resultado desconhecido. Consulte o provedor; não reenvie automaticamente.',suppressed:'Envio impedido pelas verificações atuais.'})[state]??'Estado indisponível.';}
/** API methods must use the authenticated, scoped operations routes. No resend API. */
export function createDeliveryOperationsState(options){let id=options.intentId,phase='ready',value=null,epoch=0,active=null;if(typeof id!=='string'||! /^[0-9a-f-]{36}$/.test(id))throw Error('Intenção inválida.');
 const snapshot=()=>freezeFormData({phase,value});const change=()=>{try{options.onChange?.(snapshot());}catch{}};
 async function run(reconcile){if(!id||phase==='loading'||phase==='cleared')throw Error('Consulta indisponível.');const generation=epoch,controller=new AbortController();active=controller;phase='loading';change();try{
  const result=await options.api[reconcile?'reconcile':'read'](id,controller.signal);if(generation!==epoch)return;
  if(result?.intentId!==id||!['pending','leased','sending','retry_wait','accepted','delivered','failed','unknown','suppressed'].includes(result.state))throw Error();
  // Keep only the public operational projection, never raw payload/address from a provider.
  value=freezeFormData({intentId:id,state:result.state,attempts:Number.isSafeInteger(result.attempts)?result.attempts:null,attention:result.attention===true,nextAttemptAt:typeof result.nextAttemptAt==='string'?result.nextAttemptAt:null});phase='loaded';
 }catch{if(generation===epoch){value=null;phase='error';throw Error('Não foi possível confirmar a entrega.');}}finally{controller.abort();if(active===controller)active=null;if(generation===epoch)change();}}
 function clear(){epoch++;active?.abort();active=null;id=null;value=null;phase='cleared';change();}
 return Object.freeze({snapshot,load:()=>run(false),reconcile:()=>run(true),clear});
}
export function mountDeliveryOperations(root,options){const d=root.ownerDocument,n=(tag,text)=>{const e=d.createElement(tag);e.textContent=text;return e;};const title=n('h2','Entrega da notificação'),status=n('p',''),load=n('button','Atualizar estado'),reconcile=n('button','Consultar evidência no provedor');load.type=reconcile.type='button';status.setAttribute('role','status');status.setAttribute('aria-live','polite');let destroyed=false;
 const draw=s=>{status.textContent=s.phase==='error'?'Consulta indisponível. Nenhum reenvio foi solicitado.':s.value?deliveryStatusText(s.value.state):s.phase==='loading'?'Consultando…':'';load.disabled=s.phase==='loading'||s.phase==='cleared';reconcile.disabled=s.phase!=='loaded'||!['unknown','accepted'].includes(s.value?.state);};
 const state=createDeliveryOperationsState({...options,onChange:draw}),safe=f=>()=>{Promise.resolve().then(f).catch(()=>{if(!destroyed)status.textContent='Consulta indisponível. Nenhum reenvio foi solicitado.';});};load.addEventListener('click',safe(state.load));reconcile.addEventListener('click',safe(state.reconcile));root.replaceChildren(title,status,load,reconcile);draw(state.snapshot());return Object.freeze({state,destroy:()=>{destroyed=true;state.clear();status.textContent='';root.replaceChildren();}});
}
