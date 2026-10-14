export interface InboxRead { readonly generation:number; readonly id:string }
export interface InboxView {readonly pane:'list'|'detail';readonly phase:'idle'|'loading'|'ready'|'error';readonly selected:string|null;readonly target:string|null;readonly error:'forbidden'|'unavailable'|null;readonly focusDetail:boolean}
export function createInboxViewState():Readonly<{view():InboxView;begin(id:string,navigate?:boolean):InboxRead;finish(op:InboxRead|null):boolean;fail(op:InboxRead|null,kind?:string):boolean;back():void;consumeFocus():boolean;reset():void}>;
export function normalizeInboxFilters(value?:unknown):Record<string,string>;
export function inboxFiltersDiffer(draft:unknown,applied:unknown):boolean;
