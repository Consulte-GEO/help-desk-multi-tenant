import {operationsUI, deliveryView} from './operations-ui.js';
import {formatPortalInstant} from './portal-format.js';
import {copyFormData,freezeFormData} from '../shared/form-rules.js';
const deliveryTexts=Object.freeze({pending:'Notificação pendente.',leased:'Preparando envio.',sending:'Tentativa em andamento; aguarde a confirmação.',retry_wait:'Canal confirmou não aceitação; nova tentativa aguardando intervalo.',accepted:'Aceita pelo provedor; entrega ainda não confirmada.',delivered:'Entrega confirmada pelo provedor.',failed:'Falha confirmada. Consulte o registro.',unknown:'Resultado desconhecido. Consulte o provedor; não reenvie automaticamente.',suppressed:'Envio impedido pelas verificações atuais.'});
export function deliveryStatusText(state){return typeof state==='string'&&Object.hasOwn(deliveryTexts,state)?deliveryTexts[state]:'Estado indisponível.';}
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

/** Optional query-only panel. Neither button can enqueue or resend a notification. */
export function mountDeliveryOperations(root, options) {
 const ui = operationsUI(root, 'delivery', 'Entrega da notificação', 'Consulte o resultado da notificação. Consultar evidência não reenvia mensagens.'), {node} = ui;
 let destroyed = false, lastPhase = '';
 const badge = node('span', '', {class: 'hd-ops-badge', 'data-delivery-state': ''});
 const facts = node('dl', undefined, {class: 'hd-ops-facts'});
 const attemptsBox = node('div'), nextBox = node('div'), attempts = node('dd'), next = node('dd');
 attemptsBox.append(node('dt', 'Tentativas registradas'), attempts); nextBox.append(node('dt', 'Próxima tentativa informada'), next); facts.append(attemptsBox, nextBox);
 const notice = node('p', 'Aceita pelo provedor não significa entrega confirmada. A confirmação depende da evidência do canal.', {class: 'hd-ops-notice'});
 const attention = node('p', 'Esta notificação exige atenção da operação. Nenhum reenvio foi solicitado por esta tela.', {class: 'hd-ops-notice', 'data-tone': 'warning'});
 const actions = node('div', undefined, {class: 'hd-ops-actions'});
 const load = ui.button('Atualizar estado', 'read-delivery', () => run(() => state.load()), true);
 const reconcile = ui.button('Consultar evidência no provedor', 'reconcile-delivery', () => run(() => state.reconcile()));
 actions.append(load, reconcile); ui.section.append(badge, facts, attention, notice, actions);
 function draw(s) {
  if (destroyed) return;
  const value = s.phase === 'loaded' ? s.value : null, view = deliveryView(value?.state);
  ui.section.setAttribute('aria-busy', String(s.phase === 'loading'));
  badge.hidden = facts.hidden = !value; badge.textContent = value ? view.label : ''; badge.setAttribute('data-tone', view.tone); badge.setAttribute('data-delivery-state', value?.state ?? '');
  attempts.textContent = value ? (Number.isSafeInteger(value.attempts) && value.attempts >= 0 ? String(value.attempts) : 'Indisponível') : '';
  next.textContent = value ? (value.nextAttemptAt === null ? 'Não informada' : formatPortalInstant(value.nextAttemptAt)) : '';
  attention.hidden = !value?.attention;
  load.disabled = ['loading', 'cleared'].includes(s.phase); reconcile.hidden = !value || !['unknown', 'accepted'].includes(value.state); reconcile.disabled = s.phase !== 'loaded';
  ui.report(s.phase === 'loading' ? 'Consultando o estado autorizado…' : s.phase === 'error' ? 'Consulta indisponível. Nenhum reenvio foi solicitado.' : s.phase === 'cleared' ? '' : value ? deliveryStatusText(value.state) : 'Atualize o estado para consultar o resultado da notificação.', s.phase === 'error' ? 'warning' : value ? view.tone : 'neutral');
  if (lastPhase && lastPhase !== s.phase && ['loaded', 'error'].includes(s.phase)) ui.status.focus();
  lastPhase = s.phase;
 }
 async function run(fn) {
  if (destroyed || state.snapshot().phase === 'cleared') return;
  try { await fn(); } catch {
   if (!destroyed && state.snapshot().phase !== 'cleared') ui.report('Consulta indisponível. Nenhum reenvio foi solicitado.', 'warning');
  }
 }
 const state = createDeliveryOperationsState({...options, onChange: draw});
 ui.mount(); draw(state.snapshot());
 return Object.freeze({state, destroy() { if (destroyed) return; destroyed = true; state.clear(); ui.destroy(); }});
}
