export type TicketCounts={total:number;statuses:{received:number;in_progress:number;waiting_for_you:number;resolved:number;closed:number}};
export type TicketSummary=TicketCounts&{as_of:string};
export const SUMMARY_STATUSES:readonly (keyof TicketCounts['statuses'])[];
export function parseTicketCounts(value:unknown):TicketCounts;
export function parseTicketSummary(value:unknown):TicketSummary;
