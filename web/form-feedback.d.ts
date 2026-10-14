export type GuidanceField={type:string;label?:string;config?:Record<string,unknown>};
export function issueControlPath(path:unknown):string;
export function fieldGuidance(field:GuidanceField):string;
export function createFormFeedback(root:HTMLElement,prefix:string):Readonly<{
 register(path:string,field:GuidanceField,control:HTMLElement,box:HTMLElement,withHint?:boolean):void;
 count(path:string):void;focusPath(path:string):boolean;captureFocus():unknown;restoreFocus(saved:unknown):void;
 showIssues(issues:ReadonlyArray<{path:string;message:string}>,options?:{focus?:boolean}):void;
 action(control:HTMLElement,key:string):void;beginRender():void;attach():void;destroy():void;
}>;
