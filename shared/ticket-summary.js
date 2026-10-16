import {isCanonicalInstant} from './instant.js';
export const SUMMARY_STATUSES=Object.freeze(['received','in_progress','waiting_for_you','resolved','closed']);
const bad=()=>{throw Error('Resumo de chamados incompatível.');};
function record(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==keys.length)bad();
 const out={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(value,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)bad();out[k]=d.value;}return out;
}
export function parseTicketCounts(value){
 const raw=record(value,['total','statuses']),statuses=record(raw.statuses,SUMMARY_STATUSES);
 if(![raw.total,...Object.values(statuses)].every(v=>Number.isSafeInteger(v)&&v>=0)||Object.values(statuses).reduce((a,b)=>a+b,0)!==raw.total)bad();
 return {total:raw.total,statuses};
}
export function parseTicketSummary(value){
 const raw=record(value,['as_of','total','statuses']);if(!isCanonicalInstant(raw.as_of))bad();
 return {as_of:raw.as_of,...parseTicketCounts({total:raw.total,statuses:raw.statuses})};
}
