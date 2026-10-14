import {renderPortalView} from './customer-portal.js';
/** Presentation only: the caller still needs independent team/account capability. */
export function renderSupportQueue(root,state,onOpen){renderPortalView(root,state,onOpen,true);}
