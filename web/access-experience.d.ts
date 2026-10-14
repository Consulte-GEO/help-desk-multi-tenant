export interface AccessExperience {phase(phase:unknown):void;configuration(available:boolean):void;loginError(code:unknown):string;reset():void;dispose():void;}
export function mountAccessExperience(document?:Document,options?:{simple?:boolean}):Readonly<AccessExperience>;
