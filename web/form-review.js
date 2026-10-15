import {createReviewState} from './review-state.js';
import {operationsUI, diffValue, operationsText, clearOperationsNode} from './operations-ui.js';

/** Receives only a saved draft reference and the server's public diff. No GET,
 * preview or visual confirmation can replace server authorization at commit. */
export function mountFormReview(root, options) {
 const ui = operationsUI(root, 'form-review', 'Revisar devolutiva', 'Confira as alterações do rascunho salvo antes de confirmar. As respostas anteriores permanecem no histórico.'), {node} = ui;
 let destroyed = false, waitingForDraft = false, epoch = 0, lastPhase = '', diffStamp = '';
 const diff = node('section', undefined, {'aria-label': 'Diferenças públicas do formulário'}), list = node('ol', undefined, {class: 'hd-ops-diff-list'});
 diff.append(node('h3', 'O que será alterado'), list);
 const actions = node('div', undefined, {class: 'hd-ops-actions'});
 const preview = ui.button(options.saveOnPreview ? 'Salvar e conferir alterações' : 'Conferir alterações salvas', 'preview-revision', async () => {
  if (destroyed || waitingForDraft || state.snapshot().phase !== 'ready') return;
  const stamp = epoch; waitingForDraft = true; draw(state.snapshot()); let failed = false;
  try {
   const draft = await options.savedDraft();
   if (destroyed || stamp !== epoch || state.snapshot().phase !== 'ready') return;
   await state.previewRevision(draft);
  } catch { failed = true; }
  finally {
   waitingForDraft = false;
   if (!destroyed && stamp === epoch && state.snapshot().phase !== 'cleared') {
    draw(state.snapshot());
    if (failed) { ui.report('Não foi possível conferir o rascunho salvo. Revise os dados e os anexos no chamado.', 'warning'); ui.status.focus(); }
    else if (state.snapshot().phase === 'review') confirm.focus();
   }
  }
 }, true);
 const confirm = ui.button('Confirmar revisão', 'confirm-revision', () => run(() => state.confirmRevision()), true);
 const reconcile = ui.button('Conciliar mesma revisão', 'reconcile-revision', () => run(() => state.reconcile()), true);
 actions.append(preview, confirm, reconcile);
 ui.section.append(diff, node('p', 'Esta tela mostra apenas diferenças públicas. Confirmar depende de nova validação de acesso, revisão e anexos no servidor.', {class: 'hd-ops-muted'}), actions);
 function draw(s) {
  if (destroyed) return;
  if (s.phase === 'cleared') { epoch++; waitingForDraft = false; }
  const busy = waitingForDraft || ['previewing', 'submitting'].includes(s.phase);
  ui.section.setAttribute('aria-busy', String(busy));
  preview.hidden = s.phase !== 'ready'; preview.disabled = busy;
  confirm.hidden = s.phase !== 'review'; confirm.disabled = busy;
  reconcile.hidden = s.phase !== 'unknown'; reconcile.disabled = busy;
  diff.hidden = s.phase !== 'review';
  const stamp = s.phase === 'review' ? JSON.stringify(s.publicDiff) : '';
  if (stamp !== diffStamp) {
   clearOperationsNode(list); diffStamp = stamp;
   if (s.phase === 'review' && !s.publicDiff.length) list.append(node('li', 'Não há diferenças públicas nesta revisão.', {class: 'hd-ops-notice'}));
   for (const item of s.phase === 'review' ? s.publicDiff : []) {
    const row = node('li', undefined, {class: 'hd-ops-diff'}), columns = node('div', undefined, {class: 'hd-ops-diff-columns'});
    row.append(node('h4', operationsText(item?.path) || 'Campo do formulário'));
    for (const [label, value] of [['Antes', item?.before], ['Depois', item?.after]]) {
     const box = node('div'); box.append(node('h4', label), node('pre', diffValue(value))); columns.append(box);
    }
    row.append(columns); list.append(row);
   }
  }
  const texts = {ready: waitingForDraft ? 'Consultando o rascunho salvo…' : 'Salve o rascunho no chamado e confira as alterações aqui.', previewing: 'Conferindo a revisão e as diferenças públicas…', review: 'Confira os valores antes e depois. Nenhuma revisão foi registrada ainda.', submitting: 'Registrando a revisão uma única vez…', confirmed: 'Revisão registrada. Respostas anteriores preservadas; notificação pendente.', unknown: 'Confirmação desconhecida. Preserve o rascunho e concilie esta mesma revisão.', error: 'Revisão indisponível. Recarregue o chamado e confira o rascunho e os anexos.', cleared: ''};
  ui.report(texts[s.phase] ?? 'Estado indisponível.', ['unknown', 'error'].includes(s.phase) ? 'warning' : s.phase === 'confirmed' ? 'success' : 'neutral');
  if (lastPhase && lastPhase !== s.phase) {
   if (s.phase === 'review' && !waitingForDraft) confirm.focus();
   else if (s.phase === 'unknown') reconcile.focus();
   else if (['error', 'confirmed'].includes(s.phase)) ui.status.focus();
  }
  lastPhase = s.phase;
  try { options.onChange?.(s); } catch { /* presentation observer only */ }
 }
 async function run(fn) {
  if (destroyed || state.snapshot().phase === 'cleared') return;
  try { await fn(); } catch {
   if (!destroyed && state.snapshot().phase !== 'cleared') ui.report('Confira a revisão atual do chamado antes de continuar.', 'warning');
  }
 }
 const state = createReviewState({...options, onChange: draw});
 ui.mount(); draw(state.snapshot());
 return Object.freeze({state, destroy() { if (destroyed) return; destroyed = true; epoch++; state.clear(); clearOperationsNode(list); ui.destroy(); }});
}
