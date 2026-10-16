import type {TicketSummary} from '../shared/ticket-summary.js';
export type SummaryOperation=Readonly<{sequence:number;path:string}>;
export function createTicketSummaryState():{
 reset():void;begin(filters:Record<string,string>):SummaryOperation;accept(op:SummaryOperation,body:unknown):boolean;fail(op:SummaryOperation):boolean;
 value():TicketSummary|null;status():'idle'|'loading'|'ready'|'error';
};
