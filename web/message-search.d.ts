export interface MessageSearchView {enabled:boolean;query:string;ids:string[];currentId:string|null;position:number;loaded:number;hasMore:boolean;error:string|null}
export function createMessageSearchState():{
 update(identity:string,messages?:ReadonlyArray<{id:string;body:string}>,hasMore?:boolean):MessageSearchView;
 search(value:string):MessageSearchView;move(direction:number):MessageSearchView;view():MessageSearchView;
};
export function mountMessageSearch(elements:{root:HTMLElement;input:HTMLInputElement;status:HTMLElement;previous:HTMLButtonElement;next:HTMLButtonElement;clear:HTMLButtonElement;container:HTMLElement}):{
 update(identity:string,messages:ReadonlyArray<{id:string;body:string}>,hasMore:boolean):void;reset():void;
};
