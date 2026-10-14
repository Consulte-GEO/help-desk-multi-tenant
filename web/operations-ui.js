/** UX06 presentation only. Never performs I/O, stores credentials, or grants access. */
let sequence = 0;
const fileStates = Object.freeze({
 selected: ['Selecionado · ainda não enviado', 'neutral'],
 uploading: ['Em transferência', 'info'],
 pending_scan: ['Aguardando análise', 'warning'],
 scanning: ['Em análise', 'info'],
 clean: ['Análise concluída', 'success'],
 rejected: ['Arquivo rejeitado', 'danger'],
 unsupported: ['Formato não suportado', 'warning'],
 scan_error: ['Análise indisponível', 'warning'],
});
const deliveryStates = Object.freeze({
 pending: ['Notificação pendente', 'neutral'], leased: ['Preparando envio', 'info'],
 sending: ['Tentativa em andamento', 'info'], retry_wait: ['Aguardando nova tentativa', 'warning'],
 accepted: ['Aceita pelo provedor', 'info'], delivered: ['Entrega confirmada', 'success'],
 failed: ['Falha confirmada', 'danger'], unknown: ['Resultado desconhecido', 'warning'],
 suppressed: ['Envio impedido', 'warning'],
});
function lookup(map, value) {
 const entry = typeof value === 'string' && Object.hasOwn(map, value) ? map[value] : null;
 return entry ? {label: entry[0], tone: entry[1]} : {label: 'Estado indisponível', tone: 'neutral'};
}
export const attachmentView = value => lookup(fileStates, value);
export const deliveryView = value => lookup(deliveryStates, value);
export const operationsText = value => typeof value === 'string' ? value : '';
export function attachmentSelectionIssue(files) {
 if (!Array.isArray(files) || !files.length) return 'Selecione pelo menos um arquivo.';
 if (files.length > 50) return 'Selecione no máximo 50 arquivos por lote.';
 for (const file of files) {
  if (!file || typeof file.name !== 'string' || !file.name.trim()) return 'Não foi possível identificar um arquivo.';
  if (!/\.(png|jpe?g|pdf)$/i.test(file.name)) return 'Use arquivos PNG, JPEG ou PDF. A análise do conteúdo será feita pelo servidor.';
  if (!Number.isSafeInteger(file.size) || file.size < 1) return 'Um arquivo está vazio ou tem tamanho inválido.';
  if (file.size > 104857600) return 'Cada arquivo deve ter no máximo 100 MiB.';
 }
 return '';
}
export function transferredText(bytes, total) {
 if (!Number.isSafeInteger(total) || total <= 0 || !Number.isSafeInteger(bytes) || bytes < 0 || bytes > total) return 'Progresso indisponível';
 return Math.floor(bytes / total * 100) + '% dos bytes confirmados';
}
export function diffValue(value) {
 if (value === undefined) return 'Não informado';
 if (value === null) return 'Vazio';
 if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
 if (typeof value === 'string') return value || 'Texto vazio';
 if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'Valor indisponível';
 try { return JSON.stringify(value, null, 2) ?? 'Valor indisponível'; } catch { return 'Valor indisponível'; }
}
/** Scrub owned subtrees, including detached references, before removal. */
export function clearOperationsNode(node) {
 if (!node) return;
 for (const child of Array.from(node.children ?? [])) clearOperationsNode(child);
 if (['input', 'textarea', 'select'].includes(node.tagName?.toLowerCase())) {
  node.value = ''; node.checked = false; node.disabled = true;
 }
 node.textContent = '';
}
export function operationsUI(root, kind, title, description) {
 const doc = root.ownerDocument, prefix = 'hd-ops-' + kind + '-' + (++sequence), listeners = [];
 const node = (tag, text, attrs = {}) => {
  const element = doc.createElement(tag);
  if (text !== undefined) element.textContent = operationsText(text);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, String(value));
  return element;
 };
 const listen = (target, name, fn) => { target.addEventListener(name, fn); listeners.push([target, name, fn]); };
 const button = (text, action, handler, primary = false) => {
  const b = node('button', text, {type: 'button', class: primary ? 'hd-ops-primary' : 'hd-ops-secondary', 'data-ops-action': action});
  listen(b, 'click', event => { if (!b.disabled && !b.hidden) handler(event); });
  return b;
 };
 const section = node('section', undefined, {class: 'hd-ops', 'data-ops-panel': kind, 'aria-labelledby': prefix + '-title'});
 const header = node('header', undefined, {class: 'hd-ops-header'});
 header.append(node('p', 'ATENDIMENTO COM CONTEXTO', {class: 'hd-ops-kicker'}), node('h2', title, {id: prefix + '-title'}), node('p', description, {class: 'hd-ops-muted'}));
 const status = node('p', '', {class: 'hd-ops-status', role: 'status', 'aria-live': 'polite', tabindex: '-1', 'data-ops-status': ''});
 const field = (labelText, name, tag = 'input', hint = '') => {
  const id = prefix + '-' + name, box = node('div', undefined, {class: 'hd-ops-field'});
  const label = node('label', labelText, {for: id});
  const input = node(tag, undefined, {id, ...(tag === 'input' ? {type: 'text', autocomplete: 'off'} : {})});
  const help = node('p', hint, {id: id + '-help', class: 'hd-ops-muted'}), error = node('p', '', {id: id + '-error', class: 'hd-ops-error'});
  help.hidden = !hint; error.hidden = true; input.setAttribute('aria-describedby', id + '-help ' + id + '-error');
  box.append(label, input, help, error);
  return {box, input, error, feedback(message) { error.textContent = message; error.hidden = !message; if (message) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }};
 };
 const report = (text, tone = 'neutral') => { status.textContent = text; status.hidden = !text; status.setAttribute('data-tone', tone); };
 const badge = view => node('span', view.label, {class: 'hd-ops-badge', 'data-tone': view.tone});
 section.append(header, status);
 return {node, button, field, listen, badge, report, status, section, prefix,
  mount() { root.replaceChildren(section); },
  destroy() { for (const [element, name, fn] of listeners) element.removeEventListener(name, fn); listeners.length = 0; clearOperationsNode(section); if (section.parentNode === root || section.parentElement === root) root.replaceChildren(); },
 };
}
