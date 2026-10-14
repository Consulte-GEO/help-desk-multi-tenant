export type AdminStatus={label:string;tone:'success'|'info'|'warning'|'danger'|'neutral'};
export function adminText(value:unknown,fallback?:string):string;
export function adminStatus(value:unknown):AdminStatus;
export function adminInstant(value:unknown):string;
export function clearAdminNode(node:HTMLElement|null):void;
export function adminUI(root:HTMLElement,kind:string):{
 prefix:string;
 node(tag:string,text?:string,attrs?:Record<string,string|number|boolean>):HTMLElement;
 button(text:string,handler:(event:Event)=>void,primary?:boolean,attrs?:Record<string,string>,owner?:Array<[EventTarget,string,EventListener]>):HTMLButtonElement;
 field(text:string,name:string,options?:{tag?:string;hint?:string;attrs?:Record<string,string>}):{box:HTMLElement;label:HTMLLabelElement;input:HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement;help:HTMLElement;error:HTMLElement;feedback(message:string):void};
 badge(value:unknown):HTMLElement;header(title:string,description:string):HTMLElement;
 listen(target:EventTarget,event:string,handler:EventListener,owner?:Array<[EventTarget,string,EventListener]>):void;
 removeListeners(owner?:Array<[EventTarget,string,EventListener]>):void;
};
