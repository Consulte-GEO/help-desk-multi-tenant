import type {FormVersion} from '../shared/form-rules.js';
export type FormEditorIntent=Readonly<{action:'save'|'publish'|'restore';schema:FormVersion;reason:string;key:string}>;
export function mountFormEditor(root:HTMLElement,options:{schema:unknown;submit?:(intent:FormEditorIntent)=>Promise<{state:'confirmed'|'rejected'|'unknown'}>}):Readonly<{
 preview(json:string):FormVersion;diff():string[];prepare(action:'save'|'publish'|'restore',reason:string):void;
 confirm():Promise<void>;reconcile():Promise<void>;cancel():void;clearAudience():void;reload(schema:unknown):void;state():string;destroy():void;
}>;
