export interface MutationOperation {
 readonly owner:string;readonly generation:number;readonly channel:string;
 readonly revision:number;readonly body:string;readonly key:string;
}
export interface MutationResult {current:boolean;cleared:boolean;}
export interface MutationState {
 select(owner:string):void;reset(owner:string):void;edit(channel:string,body:string):void;
 draft(channel:string):string;busy(channel:string):boolean;current(operation:MutationOperation|null):boolean;
 begin(channel:string):MutationOperation|null;finish(operation:MutationOperation|null,succeeded:boolean):MutationResult;
}
export function createMutationState(makeKey?:()=>string):MutationState;
