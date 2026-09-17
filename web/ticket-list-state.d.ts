export interface TicketListOperation {readonly generation:number;readonly sequence:number;readonly cursor:string|null;readonly path:string;}
export interface TicketFilters {q?:string;status?:string;priority?:string;assignment?:string;}
export interface TicketListState {
 reset(filters?:TicketFilters):void;restart():void;filters():TicketFilters;
 items():Array<Record<string,unknown>>;next():string|null;status():string;busy():boolean;capped():boolean;
 current(operation:TicketListOperation|null):boolean;begin():TicketListOperation|null;
 accept(operation:TicketListOperation|null,page:unknown):boolean;fail(operation:TicketListOperation|null):boolean;
}
export function createTicketListState():TicketListState;
