export interface CreateIdentity {readonly workspace:string;readonly principal:string;readonly session:number;}
export interface CreateTicketInput {readonly account_id:string;readonly product_instance_id:string;readonly service_code:string;readonly subject:string;readonly description:string;readonly priority:'low'|'normal'|'high'|'urgent';readonly coverage_id?:string;}
export interface CreateIntent {readonly key:string;readonly identity:CreateIdentity;readonly payload:CreateTicketInput;readonly body:string;readonly status:'prepared'|'dispatched'|'unknown'|'confirmed';}
export interface RequestDescriptor {path:string;method:'POST';headers:{'idempotency-key':string};body:string;}
export interface TicketCreateState {
 reset(identity:CreateIdentity|null):void;intent():CreateIntent|null;busy():boolean;
 prepare(input:CreateTicketInput):CreateIntent;begin():CreateIntent|null;current(operation:CreateIntent|null):boolean;
 fail(operation:CreateIntent):boolean;confirm(operation:CreateIntent,result:unknown):boolean;
}
export function prepareCreateIntent(input:CreateTicketInput,key:string,identity:CreateIdentity):CreateIntent;
export function validateCreateInput(input:CreateTicketInput):void;
export function retryCreateIntent(intent:CreateIntent,identity:CreateIdentity):RequestDescriptor;
export function createTicketCreateState(makeKey?:()=>string):TicketCreateState;
