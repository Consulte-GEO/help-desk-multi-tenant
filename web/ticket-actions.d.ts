import type {TicketActions} from '../src/application/ticket-actions.ts';
export type DetailMessage={id:string;ticket_id:string;body:string;actor_type?:string;created_at:string};
export type DetailPage={items:DetailMessage[];next_cursor:string|null};
export function readTicketActions(ticket:unknown):TicketActions;
export function hasWriteActions(actions:TicketActions|null):boolean;
export function loadTicketDetail(ticketId:string,request:(path:string)=>Promise<unknown>,current?:()=>boolean):Promise<null|{
 ticket:Record<string,unknown>;actions:TicketActions;messages:DetailPage;notes:DetailPage;notesUnavailable:boolean;
}>;

export function composerMode(requested:"public"|"internal", actions:TicketActions|null): "public"|"internal";
