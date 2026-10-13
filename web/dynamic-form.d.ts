import type {FormResult} from '../shared/form-rules.js';
export interface DynamicFormOptions{
 schema:unknown;answers?:unknown;audience?:'customer'|'internal';
 canEdit?:()=>boolean;onChange?:(answers:Readonly<Record<string,unknown>>)=>void;
 chooseLookup?:(registryKey:string,options:{signal:AbortSignal})=>Promise<unknown>;
 chooseFiles?:(fieldPath:string,options:{signal:AbortSignal})=>Promise<unknown>;
 download?:(resourceKey:string)=>Promise<unknown>|unknown;
}
export function mountDynamicForm(root:HTMLElement,options:DynamicFormOptions):Readonly<{
 validate():FormResult;draftAnswers():Readonly<Record<string,unknown>>;snapshot():Readonly<{formId:string;formVersion:number;result:FormResult;commitAuthorized:false}>;
 addRow(path:string):void;removeRow(path:string,index:number):void;paste(path:string,text:string):void;choose(path:string):Promise<void>;
 setAudience(audience:'customer'|'internal'):void;destroy():void;
}>;
