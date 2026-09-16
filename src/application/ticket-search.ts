import {HelpdeskError} from '../domain/errors.ts';
import {statuses} from '../domain/model.ts';
import type {Ticket,TicketStatus} from '../domain/model.ts';
import {customerStatus} from '../domain/workflow.ts';
import type {PageOptions} from './pagination.ts';

export type CustomerStatus=ReturnType<typeof customerStatus>;
export type TicketListOptions=PageOptions&{accountId?:string;q?:string;status?:string;priority?:string};
export type TicketSearchFilters={q?:string;status?:CustomerStatus;priority?:Ticket['priority']};
// Deliberately deterministic Latin-1 case folding in JS AND SQL, independent of DB locale.
// Accents stay significant; this is literal substring search, not linguistic full-text search.
export const SEARCH_UPPER='ABCDEFGHIJKLMNOPQRSTUVWXYZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ';
export const SEARCH_LOWER='abcdefghijklmnopqrstuvwxyzàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ';
export function foldSearch(value:string):string{
 return value.replace(/[A-ZÀ-ÖØ-Þ]/g,c=>String.fromCharCode(c.charCodeAt(0)+32));
}
export function ticketSearch(options:TicketListOptions):TicketSearchFilters{
 const result:TicketSearchFilters={};
 if(options.q!==undefined){
  const raw=options.q;
  if(typeof raw!=='string'||raw.length>480||/[\p{Cc}\p{Cs}]/u.test(raw))throw new HelpdeskError(400,'invalid_input','Busca inválida. Use de 2 a 120 caracteres.');
  const trimmed=raw.trim(),length=Array.from(trimmed).length;
  if(length<2||length>120)throw new HelpdeskError(400,'invalid_input','Busca inválida. Use de 2 a 120 caracteres.');
  result.q=foldSearch(trimmed);
 }
 if(options.status!==undefined){
  if(!['received','in_progress','waiting_for_you','resolved','closed'].includes(options.status))throw new HelpdeskError(400,'invalid_input','Situação pública inválida.');
  result.status=options.status as CustomerStatus;
 }
 if(options.priority!==undefined){
  if(!['low','normal','high','urgent'].includes(options.priority))throw new HelpdeskError(400,'invalid_input','Prioridade inválida.');
  result.priority=options.priority as Ticket['priority'];
 }
 return Object.freeze(result);
}
export function statusesForSearch(filters:TicketSearchFilters):TicketStatus[]|null{
 return filters.status?statuses.filter(s=>customerStatus(s)===filters.status):null;
}
export function matchesTicketSearch(ticket:Ticket,filters:TicketSearchFilters):boolean{
 return (!filters.q||foldSearch(ticket.subject).includes(filters.q)||foldSearch(ticket.id)===filters.q)
  &&(!filters.status||customerStatus(ticket.status)===filters.status)
  &&(!filters.priority||ticket.priority===filters.priority);
}
