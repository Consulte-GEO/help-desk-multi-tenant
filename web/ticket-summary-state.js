import {parseTicketSummary} from '../shared/ticket-summary.js';
import {createTicketListState} from './ticket-list-state.js';
/** Ephemeral, independent read: a new query never displays the previous totals. */
export function createTicketSummaryState(){
 let sequence=0,pending=null,value=null,phase='idle';
 const current=op=>!!op&&op===pending;
 return {
  reset(){pending=null;value=null;phase='idle';},
  begin(filters){
   const validation=createTicketListState();validation.reset(filters);const query=new URLSearchParams(validation.filters());
   pending=Object.freeze({sequence:++sequence,path:'/tickets/summary'+(query.size?'?'+query.toString():'')});value=null;phase='loading';return pending;
  },
  accept(op,body){if(!current(op))return false;const parsed=parseTicketSummary(body);value=parsed;pending=null;phase='ready';return true;},
  fail(op){if(!current(op))return false;pending=null;value=null;phase='error';return true;},
  value:()=>value?structuredClone(value):null,status:()=>phase
 };
}
