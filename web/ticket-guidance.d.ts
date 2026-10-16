export interface TicketGuidance {situation:string;owner:string|null;next:string;version:number}
export function ticketGuidance(ticket:unknown,actions:unknown):TicketGuidance|null;
export function renderTicketGuidance(root:HTMLElement,ticket:unknown,actions:unknown):void;
