/** Shared presentation only. No transports, authorization, persistence or totals calculation. */
const integer = new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 0});
const decimal = new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 20});
const statuses = Object.freeze({
 received: {label: 'Recebido', tone: 'info'},
 in_progress: {label: 'Em atendimento', tone: 'brand'},
 waiting_for_you: {label: 'Aguardando você', tone: 'warning'},
 resolved: {label: 'Resolvido', tone: 'success'},
 closed: {label: 'Encerrado', tone: 'neutral'},
});
const priorities = Object.freeze({low: 'Baixa', normal: 'Normal', high: 'Alta', urgent: 'Urgente'});
export const countText = value => Number.isSafeInteger(value) && value >= 0 ? integer.format(value===0?0:value) : 'Indisponível';
export function metricText(metric) {
 if (!metric || metric.availability !== 'available' || typeof metric.value !== 'number' || !Number.isFinite(metric.value) || metric.value < 0) return 'Indisponível';
 // The existing contract has no unit. Never guess minutes, percentages or currency.
 return decimal.format(metric.value===0?0:metric.value);
}
export const priorityText = value => typeof value === 'string' && Object.hasOwn(priorities, value) ? priorities[value] : 'Prioridade indisponível';
export const statusView = value => typeof value === 'string' && Object.hasOwn(statuses, value) ? {...statuses[value]} : {label: 'Situação indisponível', tone: 'neutral'};
export const textValue = (value, fallback = '') => typeof value === 'string' ? value : fallback;
export function node(root, tag, text, className) {
 const element = root.ownerDocument.createElement(tag);
 if (text !== undefined) element.textContent = textValue(text);
 if (className) element.setAttribute('class', className);
 return element;
}
export function prepareRoot(root, classes) {
 // The small DOM ports used by the existing Node tests do not implement classList.
 if (root.classList) root.classList.add(...classes.split(' '));
 else root.setAttribute('class', classes);
}
export function stateCard(root, title, text, tone = 'neutral') {
 const card = node(root, 'section', undefined, 'hd-portal-state hd-portal-state--' + tone);
 card.append(node(root, 'h2', title), node(root, 'p', text));
 return card;
}
export function counters(root, values, waitingLabel = 'Aguardando você') {
 const section = node(root, 'section', undefined, 'hd-portal-stats');
 section.setAttribute('aria-label', 'Resumo da consulta autorizada');
 for (const [key, label] of [['total', 'Total autorizado'], ['open', 'Em aberto'], ['waitingCustomer', waitingLabel], ['resolvedOrClosed30d', 'Resolvidos ou encerrados em 30 dias']]) {
  const card = node(root, 'article');card.setAttribute('data-portal-count', key);
  card.append(node(root, 'h2', label), node(root, 'strong', countText(values?.[key])), node(root, 'p', 'Na consulta autorizada'));
  section.append(card);
 }
 return section;
}
export function statusBadge(root, value, team = false) {
 const status = statusView(value);
 if (team && value === 'waiting_for_you') status.label = 'Aguardando cliente';
 return node(root, 'span', status.label, 'hd-portal-badge hd-portal-badge--' + status.tone);
}
/** Restore the same action only when focus was in this panel; never inspect another panel's state. */
export function captureAction(root) {
 const active = root.ownerDocument.activeElement;
 return root.contains?.(active) ? active?.getAttribute?.('data-portal-ticket') : null;
}
export function restoreAction(root, key) {
 if (!key) return;
 const target = Array.from(root.querySelectorAll?.('[data-portal-ticket]') ?? []).find(e => e.getAttribute('data-portal-ticket') === key);
 const fallback = root.querySelector?.('[data-portal-heading]');
 (target && !target.disabled ? target : fallback)?.focus({preventScroll: true});
}
