import {HelpdeskError} from '../domain/errors.ts';
import {isOperator} from '../domain/policy.ts';
import type {Principal} from '../domain/model.ts';
import {statuses} from '../domain/model.ts';
import type {Ticket,TicketStatus} from '../domain/model.ts';
import {customerStatus} from '../domain/workflow.ts';
import type {PageOptions} from './pagination.ts';
import {isCanonicalInstant,canonicalInstant,compareInstants} from '../../shared/instant.js';

export type CustomerStatus=ReturnType<typeof customerStatus>;
export type TicketListOptions=PageOptions&{accountId?:string;q?:string;search_in?:string;internal_status?:string;status?:string;priority?:string;assignment?:string;created_from?:string;created_before?:string;updated_from?:string;updated_before?:string;sort?:string};
export type TicketSearchFilters={q?:string;search_in?:'description';internal_status?:TicketStatus;status?:CustomerStatus;priority?:Ticket['priority'];assignment?:'mine'|'unassigned';created_from?:string;created_before?:string;updated_from?:string;updated_before?:string;sort?:'oldest'};
// Deliberately deterministic Latin-1 case folding in JS AND SQL, independent of DB locale.
// Accents stay significant; this is literal substring search, not linguistic full-text search.
export const SEARCH_UPPER='ABCDEFGHIJKLMNOPQRSTUVWXYZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞ';
export const SEARCH_LOWER='abcdefghijklmnopqrstuvwxyzàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþ';
export function foldSearch(value:string):string{
 return value.replace(/[A-ZÀ-ÖØ-Þ]/g,c=>String.fromCharCode(c.charCodeAt(0)+32));
}
export function ticketSearch(options:TicketListOptions|Omit<TicketListOptions,'limit'|'cursor'>):TicketSearchFilters{
 const result:TicketSearchFilters={};
 if(options.sort!==undefined){
  if(!['newest','oldest'].includes(options.sort))throw new HelpdeskError(400,'invalid_input','Ordem de criação inválida.');
  if(options.sort==='oldest')result.sort='oldest';
 }
 for(const key of ['created_from','created_before','updated_from','updated_before'] as const)if(options[key]!==undefined){
  if(!isCanonicalInstant(options[key]))throw new HelpdeskError(400,'invalid_input','Período inválido. Use instantes UTC no formato canônico.');
  result[key]=canonicalInstant(options[key]!);
 }
 if(result.created_from&&result.created_before&&compareInstants(result.created_from,result.created_before)>=0)throw new HelpdeskError(400,'invalid_input','O início do período deve ser anterior ao fim.');
 if(result.updated_from&&result.updated_before&&compareInstants(result.updated_from,result.updated_before)>=0)throw new HelpdeskError(400,'invalid_input','O início do período de atualização deve ser anterior ao fim.');
 if(options.q!==undefined){
  const raw=options.q;
  if(typeof raw!=='string'||raw.length>480||/[\p{Cc}\p{Cs}]/u.test(raw))throw new HelpdeskError(400,'invalid_input','Busca inválida. Use de 2 a 120 caracteres.');
  const trimmed=raw.trim(),length=Array.from(trimmed).length;
  if(length<2||length>120)throw new HelpdeskError(400,'invalid_input','Busca inválida. Use de 2 a 120 caracteres.');
  result.q=foldSearch(trimmed);
 }
 if(options.search_in!==undefined){
  if(options.search_in!=='description'||!result.q)throw new HelpdeskError(400,'invalid_input','Selecione descrição e informe uma busca de 2 a 120 caracteres.');
  result.search_in='description';
 }
 if(options.internal_status!==undefined){
  if(!statuses.includes(options.internal_status as TicketStatus))throw new HelpdeskError(400,'invalid_input','Situação interna inválida.');
  result.internal_status=options.internal_status as TicketStatus;
 }
 if(options.status!==undefined){
  if(!['received','in_progress','waiting_for_you','resolved','closed'].includes(options.status))throw new HelpdeskError(400,'invalid_input','Situação pública inválida.');
  result.status=options.status as CustomerStatus;
 }
 if(options.priority!==undefined){
  if(!['low','normal','high','urgent'].includes(options.priority))throw new HelpdeskError(400,'invalid_input','Prioridade inválida.');
  result.priority=options.priority as Ticket['priority'];
 }
 if(options.assignment!==undefined){
  if(!['mine','unassigned'].includes(options.assignment))throw new HelpdeskError(400,'invalid_input','Responsabilidade inválida.');
  result.assignment=options.assignment as 'mine'|'unassigned';
 }
 return Object.freeze(result);
}
export function statusesForSearch(filters:TicketSearchFilters):TicketStatus[]|null{
 return filters.status?statuses.filter(s=>customerStatus(s)===filters.status):null;
}
export function matchesTicketSearch(ticket:Ticket,filters:TicketSearchFilters,p?:Principal):boolean{
 return (!filters.updated_from||compareInstants(ticket.updatedAt,filters.updated_from)>=0)
  &&(!filters.updated_before||compareInstants(ticket.updatedAt,filters.updated_before)<0)
  &&(!filters.created_from||compareInstants(ticket.createdAt,filters.created_from)>=0)
  &&(!filters.created_before||compareInstants(ticket.createdAt,filters.created_before)<0)
  &&(!filters.q||(filters.search_in==='description'?foldSearch(ticket.description).includes(filters.q):
  foldSearch(ticket.subject).includes(filters.q)||foldSearch(ticket.id)===filters.q
   ||!!ticket.consulteGeo&&foldSearch(ticket.consulteGeo.protocol)===filters.q))
  &&(!filters.internal_status||!!p&&isOperator(p,ticket.workspaceId,ticket.accountId)&&ticket.status===filters.internal_status)
  &&(!filters.status||customerStatus(ticket.status)===filters.status)
  &&(!filters.priority||ticket.priority===filters.priority)
  &&(!filters.assignment||!!p&&isOperator(p,ticket.workspaceId,ticket.accountId)
   &&(filters.assignment==='mine'?ticket.assignedTo===p.id:ticket.assignedTo===null));
}
