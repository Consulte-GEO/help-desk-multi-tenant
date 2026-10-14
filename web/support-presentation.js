/** UX07 pure presentation. These checks are NOT server authorization. */
import {formatPortalInstant} from './portal-format.js';
const externalStates = Object.freeze({
 waiting_internal: Object.freeze({label:'Em acompanhamento no desenvolvimento',tone:'info',description:'A solicitação está em acompanhamento. Esta informação não confirma uma correção ou sua publicação.'}),
 waiting_release: Object.freeze({label:'Aguardando evidência de publicação',tone:'warning',description:'Ainda é necessário conferir a publicação da alteração. O acompanhamento não encerra o chamado.'}),
 awaiting_human_validation: Object.freeze({label:'Publicação recebida. Aguardando validação humana',tone:'info',description:'A evidência de publicação foi recebida. A equipe ainda precisa validar o resultado antes de decidir sobre o encerramento.'}),
});
export function externalWorkView(state) {
 return typeof state==='string' && Object.hasOwn(externalStates,state)
  ? externalStates[state]
  : {label:'Acompanhamento externo indisponível',tone:'neutral',description:'Não há um estado reconhecido para exibir. Consulte a equipe pelo chamado.'};
}
export const CSAT_RATINGS = Object.freeze([
 Object.freeze({value:'1',label:'1 — Muito insatisfeito'}),Object.freeze({value:'2',label:'2 — Insatisfeito'}),
 Object.freeze({value:'3',label:'3 — Neutro'}),Object.freeze({value:'4',label:'4 — Satisfeito'}),
 Object.freeze({value:'5',label:'5 — Muito satisfeito'}),
]);
export function csatIssues(rating,comment) {
 return {
  rating: typeof rating==='string' && /^[1-5]$/.test(rating) ? '' : 'Escolha uma nota de 1 a 5.',
  comment: typeof comment==='string' && comment.length<=2000 ? '' : 'Use até 2.000 caracteres no comentário.',
 };
}
/** Full-page content projection, not an editorial validation/publication policy. */
export function knowledgeView(result) {
 if(!result || !Array.isArray(result.items) || result.items.some(item=>!item || typeof item.title!=='string' || !item.title.trim() || typeof item.snippet!=='string'))return {state:'unavailable',items:[]};
 return {state:result.items.length?'ready':'empty',items:result.items.map(item=>({title:item.title,snippet:item.snippet}))};
}
/** Date and ID checks are a conservative UX guard. Server must reauthorize EVERY request.
 * Microseconds are not rounded to mark a grant expired earlier than its UTC instant.
 */
export function packageAvailability(grant,now=Date.now()) {
 if(!grant)return {state:'unavailable',canRequest:false,expiresLabel:'Validade indisponível'};
 const expires=grant.expiresAt,label=formatPortalInstant(expires);
 if(typeof grant.id!=='string'||!grant.id.trim()||grant.id!==grant.id.trim()||grant.id.length>512||/[\p{Cc}\p{Cs}]/u.test(grant.id)
   ||label==='Data indisponível'||!Number.isSafeInteger(now))return {state:'invalid',canRequest:false,expiresLabel:'Validade indisponível'};
 const micros=BigInt(Date.parse(expires.slice(0,23)+'Z'))*1000n+BigInt(expires.length===27?expires.slice(23,26):0);
 const expired=micros<=BigInt(now)*1000n;
 return {state:expired?'expired':'ready',canRequest:!expired,expiresLabel:label};
}
