import type {TicketStatus} from './model.ts';
const transitions:Record<TicketStatus,readonly TicketStatus[]>={
  new:['triage','open','cancelled'],triage:['open','waiting_customer','cancelled'],
  open:['waiting_customer','waiting_internal','waiting_third_party','resolved','cancelled'],
  waiting_customer:['open','resolved','cancelled'],waiting_internal:['open','resolved','cancelled'],
  waiting_third_party:['open','resolved','cancelled'],resolved:['open','closed'],closed:[],cancelled:[]
};
export function canTransition(from:TicketStatus,to:TicketStatus,actor:'agent'|'customer'):boolean{
  if(actor==='customer')return from==='resolved'&&(to==='closed'||to==='open');
  return transitions[from].includes(to);
}
export function customerStatus(status:TicketStatus):'received'|'in_progress'|'waiting_for_you'|'resolved'|'closed'{
  if(status==='new'||status==='triage')return 'received';
  if(status==='waiting_customer')return 'waiting_for_you';
  if(status==='resolved')return 'resolved';
  if(status==='closed'||status==='cancelled')return 'closed';
  return 'in_progress';
}
