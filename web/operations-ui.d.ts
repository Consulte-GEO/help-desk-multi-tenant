export type OperationTone='neutral'|'info'|'warning'|'success'|'danger';
export interface OperationView{label:string;tone:OperationTone;}
export function attachmentView(value:unknown):OperationView;
export function deliveryView(value:unknown):OperationView;
export function operationsText(value:unknown):string;
export function attachmentSelectionIssue(files:unknown):string;
export function transferredText(bytes:unknown,total:unknown):string;
export function diffValue(value:unknown):string;
export function clearOperationsNode(node:HTMLElement|null):void;
export function operationsUI(root:HTMLElement,kind:string,title:string,description:string):{
 node(tag:string,text?:string,attrs?:Record<string,string|number>):HTMLElement;
 button(text:string,action:string,handler:(event:Event)=>void,primary?:boolean):HTMLButtonElement;
 field(label:string,name:string,tag?:string,hint?:string):{box:HTMLElement;input:HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement;error:HTMLElement;feedback(message:string):void};
 listen(target:EventTarget,name:string,fn:EventListener):void;
 badge(view:OperationView):HTMLElement;report(text:string,tone?:OperationTone):void;
 status:HTMLElement;section:HTMLElement;prefix:string;mount():void;destroy():void;
};
