import type {TicketFilters} from './ticket-list-state.js';
export function availableTicketViews(person:unknown):Array<{id:string;label:string}>;
export function applyTicketView(filters:TicketFilters,id:string,person:unknown):TicketFilters;
export function activeTicketView(filters:TicketFilters,person:unknown):string|null;
export function mountTicketViews(doc:Document,onSelect:(id:string)=>unknown):{update(person:unknown,filters:TicketFilters,busy:boolean,available:boolean):void};
