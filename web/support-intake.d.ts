import type {DynamicFormOptions} from './dynamic-form.js';
export type IntakeUiPhase='editing'|'saved'|'saving'|'previewing'|'review'|'sending'|'unknown'|'confirmed'|'cleared';
export type IntakeUiSnapshot=Readonly<{phase:IntakeUiPhase;revision:number;answers:Readonly<Record<string,unknown>>;preview:Readonly<Record<string,unknown>>|null;receipt:Readonly<{ticketId:string;protocol:string;notification:'pending'}>|null}>;
export interface IntakeUiApi{
 save(payload:Readonly<Record<string,unknown>>,expectedRevision:number,signal:AbortSignal):Promise<unknown>;
 preview(payload:Readonly<Record<string,unknown>>,signal:AbortSignal):Promise<unknown>;
 create(payload:Readonly<Record<string,unknown>>,key:string,signal:AbortSignal):Promise<unknown>;
}
export interface IntakeUiOptions{
 draft:Readonly<{id:string;accountId:string;refs:readonly unknown[];formId:string;formVersion:number}>;revision?:number;answers?:unknown;
 subject?:string;description?:string;coverageId?:string|null;api:IntakeUiApi;onChange?:(snapshot:IntakeUiSnapshot)=>void;
}
export function createSupportIntakeState(options:IntakeUiOptions):Readonly<{
 edit(value:{answers:unknown;subject:string;description:string;coverageId:string|null}):void;
 save():Promise<void>;preview():Promise<void>;confirm():Promise<void>;reconcile():Promise<void>;clear():void;snapshot():IntakeUiSnapshot;
}>;
export function mountSupportIntake(root:HTMLElement,options:IntakeUiOptions&DynamicFormOptions):Readonly<{state:ReturnType<typeof createSupportIntakeState>;clear():void;destroy():void}>;
