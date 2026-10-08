export function discardRecoveryNavigation(location:{href:string},history:{replaceState(data:unknown,unused:string,url?:string|URL|null):void}):boolean;

export function captureRecoveryNavigation(location:{href:string},history:{replaceState(data:unknown,unused:string,url?:string|URL|null):void}):{readonly discarded:boolean;hasLink():boolean;clear():void;takeLink(supabaseUrl:string):string|null};
