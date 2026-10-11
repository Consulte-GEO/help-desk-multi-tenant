export function renderKnowledge(root:HTMLElement,result:{items:readonly {title:string;snippet:string}[]}|null,onOpenTicket:()=>void):void;
export function renderMacroPreview(root:HTMLElement,preview:{body:string;sent:false}|null):void;
export function renderPackage(root:HTMLElement,grant:{id:string;expiresAt:string;objectCount:number}|null,onRequest:(id:string)=>void):void;
export function renderExternalWork(root:HTMLElement,link:{state:string}|null):void;
/** API closure owns the token; it is not a DOM, URL or storage field. */
export function mountCsat(root:HTMLElement,submit:(input:{rating:number;comment:string},key:string)=>Promise<{rating:number;attribution:'invitation_possession'}>,keyFactory?:()=>string):Readonly<{dispose():void}>;
