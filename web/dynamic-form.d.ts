import type {FormResult} from '../shared/form-rules.js';
export interface DynamicFormOptions{
 schema:unknown;answers?:unknown;audience?:'customer'|'internal';
 chooseLookup?:(registryKey:string,options:{signal:AbortSignal})=>Promise<unknown>;
 chooseFiles?:(fieldPath:string,options:{signal:AbortSignal})=>Promise<unknown>;
 /** Called after accepted answer edits, including row/paste/reference changes. No payload or authorization. */
 onAnswersChange?:()=>void;
 /** M09a host contract. Immutable accepted answers only, never authority. */
 onChange?:(answers:Readonly<Record<string,unknown>>)=>void;
 canEdit?:()=>boolean;
 download?:(resourceKey:string)=>Promise<unknown>|unknown;
}
export function mountDynamicForm(root:HTMLElement,options:DynamicFormOptions):Readonly<{
 validate(options?:{focus?:boolean}):FormResult;draftAnswers():Readonly<Record<string,unknown>>;snapshot():Readonly<{formId:string;formVersion:number;result:FormResult;commitAuthorized:false}>;
 addRow(path:string):void;removeRow(path:string,index:number):void;paste(path:string,text:string):void;choose(path:string):Promise<void>;
 setAudience(audience:'customer'|'internal'):void;destroy():void;
}>;
