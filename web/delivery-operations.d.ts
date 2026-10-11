export type DeliveryView=Readonly<{intentId:string;state:string;attempts:number|null;attention:boolean;nextAttemptAt:string|null}>;
export type DeliveryOperationsSnapshot=Readonly<{phase:string;value:DeliveryView|null}>;
export type DeliveryOperationsOptions={intentId:string;api:{read:(id:string,signal?:AbortSignal)=>Promise<unknown>;reconcile:(id:string,signal?:AbortSignal)=>Promise<unknown>};onChange?:(snapshot:DeliveryOperationsSnapshot)=>void};
export interface DeliveryOperationsState{snapshot():DeliveryOperationsSnapshot;load():Promise<void>;reconcile():Promise<void>;clear():void}
export function deliveryStatusText(state:string):string;
export function createDeliveryOperationsState(options:DeliveryOperationsOptions):DeliveryOperationsState;
export function mountDeliveryOperations(root:HTMLElement,options:DeliveryOperationsOptions):Readonly<{state:DeliveryOperationsState;destroy():void}>;
