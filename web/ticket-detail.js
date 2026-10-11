import {formatPortalInstant} from './portal-format.js';
/** Only receives the authorized PUBLIC detail DTO. Internal notes use another
 * component/endpoint and must never be inserted in hidden DOM of this view. */
export function renderTicketDetail(root,detail){const d=root.ownerDocument,e=(tag,text)=>{const x=d.createElement(tag);x.textContent=text;return x;};root.replaceChildren();if(!detail){root.append(e('p','Selecione um chamado autorizado.'));return;}
 root.append(e('h2',detail.subject),e('p',detail.protocol??'Protocolo indisponível'),e('p',detail.description??''));const list=e('ol','');for(const m of detail.messages??[]){const row=e('li','');row.append(e('p',m.body),e('time',formatPortalInstant(m.createdAt)));list.append(row);}root.append(list);
}
