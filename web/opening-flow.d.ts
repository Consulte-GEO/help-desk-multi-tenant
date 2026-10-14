export type OpeningValues={context?:string;subject?:string;description?:string;priority?:string;coverage?:string};
export type OpeningRuntime={status:string;canSubmit:boolean;pending:boolean;unresolved:boolean;ambiguous:boolean};
export function openingFingerprint(values?:OpeningValues,ambiguous?:boolean):string;
export function openingIssues(values?:OpeningValues,runtime?:OpeningRuntime):ReadonlyArray<Readonly<{field:string;message:string}>>;
export function createOpeningFlow():Readonly<{
 view():Readonly<{step:number;pending:boolean;recovering:boolean;locked:boolean;catalogReady:boolean}>;
 update(runtime:OpeningRuntime):void;next(values:OpeningValues):boolean;back():boolean;edited(field:string):void;
 allowSubmit(values:OpeningValues):boolean;reviewCoverage(values:OpeningValues):boolean;reset():void;
}>;
