export interface TimelineItem {id:string;type:string;created_at:string;data:Record<string,unknown>;}
export interface TimelineOperation {readonly owner:string;readonly generation:number;readonly cursor:string|null;}
export interface TimelineState {
 reset(owner?:string,operator?:boolean):void;current(operation:TimelineOperation|null):boolean;
 begin():TimelineOperation|null;accept(operation:TimelineOperation|null,page:unknown):boolean;
 fail(operation:TimelineOperation|null):boolean;status():string;items():TimelineItem[];next():string|null;
}
export function createTimelineState():TimelineState;
export function eventPresentation(event:unknown,internal?:boolean):{title:string;description:string;internal:boolean};
