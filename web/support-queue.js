import {renderCustomerPortal} from './customer-portal.js';
/** Presentation only: team/account views require independent backend capability. */
export function renderSupportQueue(root,state,onOpen){renderCustomerPortal(root,state,onOpen);const h=root.children[0];if(h)h.textContent='Fila de atendimento';}
