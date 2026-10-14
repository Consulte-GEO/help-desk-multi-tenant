export type SupportPanel=Readonly<{dispose():void}>;
/** Callbacks may return a Promise at runtime; void keeps existing consumers compatible.
 * Presentation only. Host disposes on audience changes; rendering does not authorize. */
export function renderKnowledge(root:HTMLElement,result:{items:readonly {title:string;snippet:string}[]}|null,onOpenTicket:()=>void):SupportPanel;
export function renderMacroPreview(root:HTMLElement,preview:{body:string;sent:false}|null):SupportPanel;
export function renderPackage(root:HTMLElement,grant:{id:string;expiresAt:string;objectCount:number}|null,onRequest:(id:string)=>void,options?:{now?:()=>number}):SupportPanel;
export function renderExternalWork(root:HTMLElement,link:{state:string}|null):SupportPanel;
/** API closure owns the token; it is not a DOM, URL or storage field. */
export function mountCsat(root:HTMLElement,submit:(input:{rating:number;comment:string},key:string)=>Promise<{rating:number;attribution:'invitation_possession'}>,keyFactory?:()=>string):SupportPanel;
