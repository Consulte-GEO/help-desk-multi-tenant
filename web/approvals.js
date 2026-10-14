import {createReviewState} from './review-state.js';
import {operationsUI, clearOperationsNode} from './operations-ui.js';

/** Optional panel. The host owns the authenticated invitation and current context.
 * Opening or reviewing this panel never records a decision. No automatic requests. */
export function mountApprovals(root, options) {
 const ui = operationsUI(root, 'approval', 'Decisão sobre a solicitação', 'Confira o convite, escolha sua decisão e revise a justificativa antes de confirmar.'), {node} = ui;
 let destroyed = false, staged = null, lastPhase = '';
 const step = node('p', '', {class: 'hd-ops-step', 'data-ops-step': ''});
 const fields = node('div');
 const decision = ui.field('Sua decisão', 'decision', 'select', 'Nenhuma decisão é selecionada automaticamente.');
 decision.input.setAttribute('data-ops-decision', '');
 for (const [value, label] of [['', 'Selecione uma decisão'], ['approve', 'Aprovar solicitação'], ['reject', 'Solicitar correção']]) decision.input.append(node('option', label, {value}));
 decision.input.value = '';
 const reason = ui.field('Justificativa da decisão', 'reason', 'textarea', 'Obrigatória para aprovar ou solicitar correção. Até 2.000 caracteres.');
 reason.input.maxLength = 2000; reason.input.required = true;
 fields.append(decision.box, reason.box);
 const review = node('section', undefined, {class: 'hd-ops-review', 'aria-label': 'Revisão da decisão'});
 const reviewText = node('dl', undefined, {class: 'hd-ops-facts'});
 review.append(node('h3', 'Confira antes de confirmar'), reviewText, node('p', 'A conferência visual não registra aprovação. O servidor verificará novamente o convite e a revisão.', {class: 'hd-ops-muted'}));
 const actions = node('div', undefined, {class: 'hd-ops-actions'});
 const prepare = ui.button('Conferir convite', 'prepare-approval', () => run(() => state.prepare()), true);
 const reviewButton = ui.button('Revisar decisão', 'review-decision', () => {
  if (destroyed || state.snapshot().phase !== 'decision') return;
  const validDecision = ['approve', 'reject'].includes(decision.input.value), validReason = !!reason.input.value.trim() && reason.input.value.length <= 2000;
  decision.feedback(validDecision ? '' : 'Selecione uma decisão.'); reason.feedback(validReason ? '' : 'Informe uma justificativa com até 2.000 caracteres.');
  if (!validDecision || !validReason) { (!validDecision ? decision.input : reason.input).focus(); return; }
  staged = Object.freeze({decision: decision.input.value, reason: reason.input.value});
  clearOperationsNode(reviewText);
  for (const [key, value] of [['Decisão', staged.decision === 'approve' ? 'Aprovar solicitação' : 'Solicitar correção'], ['Justificativa', staged.reason]]) {
   const row = node('div'); row.append(node('dt', key), node('dd', value)); reviewText.append(row);
  }
  draw(state.snapshot()); confirm.focus();
 }, true);
 const back = ui.button('Voltar e editar', 'back-decision', () => {
  if (destroyed || state.snapshot().phase !== 'decision') return;
  staged = null; clearOperationsNode(reviewText); draw(state.snapshot()); decision.input.focus();
 });
 const confirm = ui.button('Confirmar aprovação', 'confirm-decision', () => {
  if (!staged || destroyed || state.snapshot().phase !== 'decision') return;
  run(() => state.confirmApproval(staged.decision, staged.reason));
 }, true);
 const reconcile = ui.button('Conciliar mesma decisão', 'reconcile-approval', () => run(() => state.reconcile()), true);
 actions.append(prepare, reviewButton, back, confirm, reconcile);
 ui.section.append(step, fields, review, actions);
 function wipe() { decision.input.value = ''; reason.input.value = ''; staged = null; decision.feedback(''); reason.feedback(''); clearOperationsNode(reviewText); }
 function draw(s) {
  if (destroyed) return;
  const busy = ['preparing', 'submitting'].includes(s.phase), editing = s.phase === 'decision' && !staged;
  if (['confirmed', 'error', 'cleared'].includes(s.phase)) wipe();
  ui.section.setAttribute('aria-busy', String(busy));
  fields.hidden = !editing; review.hidden = !staged;
  decision.input.disabled = reason.input.disabled = !editing;
  prepare.hidden = s.phase !== 'ready'; prepare.disabled = busy;
  reviewButton.hidden = !editing; back.hidden = !staged || s.phase !== 'decision';
  confirm.hidden = !staged || s.phase !== 'decision'; confirm.disabled = busy;
  confirm.textContent = staged?.decision === 'reject' ? 'Confirmar solicitação de correção' : 'Confirmar aprovação';
  reconcile.hidden = s.phase !== 'unknown'; reconcile.disabled = busy;
  step.textContent = s.phase === 'ready' || s.phase === 'preparing' ? '1 de 3 · Conferir convite' : editing ? '2 de 3 · Decisão e justificativa' : s.phase === 'decision' ? '3 de 3 · Revisar e confirmar' : '';
  const texts = {ready: 'Nenhuma decisão será registrada apenas por abrir esta tela.', preparing: 'Conferindo o convite autorizado…', decision: staged ? 'Decisão revisada, ainda não enviada.' : 'Convite conferido. Informe a decisão e a justificativa.', submitting: 'Registrando a decisão uma única vez…', confirmed: 'Decisão registrada. Notificação pendente.', unknown: 'Confirmação desconhecida. Concilie a mesma decisão; não prepare outro convite.', error: 'Não foi possível concluir esta decisão. Recarregue o chamado e confira o convite antes de tentar novamente.', cleared: ''};
  ui.report(texts[s.phase] ?? 'Estado indisponível.', ['unknown', 'error'].includes(s.phase) ? 'warning' : s.phase === 'confirmed' ? 'success' : 'neutral');
  if (lastPhase && lastPhase !== s.phase) {
   if (s.phase === 'decision') decision.input.focus();
   else if (s.phase === 'unknown') reconcile.focus();
   else if (['confirmed', 'error'].includes(s.phase)) ui.status.focus();
  }
  lastPhase = s.phase;
 }
 async function run(fn) {
  if (destroyed || state.snapshot().phase === 'cleared') return;
  try { await fn(); } catch {
   if (!destroyed && state.snapshot().phase !== 'cleared') { ui.report('Confira o convite, a revisão e a justificativa antes de confirmar.', 'warning'); ui.status.focus(); }
  }
 }
 const state = createReviewState({...options, onChange: draw});
 const edited = () => { if (state.snapshot().phase === 'decision') { staged = null; clearOperationsNode(reviewText); decision.feedback(''); reason.feedback(''); draw(state.snapshot()); } };
 ui.listen(decision.input, 'change', edited); ui.listen(reason.input, 'input', edited);
 ui.mount(); draw(state.snapshot());
 return Object.freeze({state, destroy() { if (destroyed) return; destroyed = true; state.clear(); wipe(); ui.destroy(); }});
}
