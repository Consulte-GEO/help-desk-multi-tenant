/** Presentation only. A brand never determines account, contract or permissions. */
const profiles = Object.freeze({
  'consulte-geo': Object.freeze({
    id: 'consulte-geo', name: 'Consulte GEO', product: 'Help Desk',
    title: 'Consulte GEO · Help Desk',
    logoColor: '/assets/consulte-geo-color.png',
    logoWhite: '/assets/consulte-geo-white.png',
    eyebrow: 'CONSULTE GEO · CENTRAL DE ATENDIMENTO',
    intro: 'Mais clareza. Do pedido à resposta.',
    description: 'Um espaço para suas solicitações, conversas e histórico de atendimento.',
  }),
  neutral: Object.freeze({
    id: 'neutral', name: 'Central de atendimento', product: 'Help Desk',
    title: 'Help Desk · Central de atendimento', logoColor: null, logoWhite: null,
    eyebrow: 'CENTRAL DE ATENDIMENTO',
    intro: 'Mais clareza. Do pedido à resposta.',
    description: 'Um espaço para suas solicitações, conversas e histórico de atendimento.',
  }),
});
/** @param {unknown} id */
export function getBrandProfile(id) {
  return typeof id === 'string' && Object.hasOwn(profiles, id) ? profiles[id] : profiles.neutral;
}
/** @param {unknown} value @returns {'auto'|'light'|'dark'} */
export function themePreference(value) {
  return value === 'light' || value === 'dark' ? value : 'auto';
}
export const THEME_STORAGE_KEY = 'helpdesk.ui.theme';
