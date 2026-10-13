import type {ChecklistEvidencePoint} from '../shared/checklist-evidence.js';
import type {ChecklistRecord,ChecklistMark} from '../src/domain/execution-checklist-mark.ts';
import type {ChecklistMarkReceipt} from '../src/application/execution-checklist.ts';
export type ChecklistAudience=Readonly<{principalId:string;workspaceId:string;accountId:string;ticketId:string;canWrite:boolean}>;
export type ChecklistDraft=Readonly<{itemId:string;status:ChecklistMark['status'];evidenceText:string;reason:string;acknowledgeRisk:boolean}>;
export type ChecklistView=Readonly<{
 phase:'idle'|'loading'|'ready'|'editing'|'review'|'saving'|'unknown'|'refresh_required'|'error'|'empty'|'disposed';
 evidence:Readonly<{phase:'idle'|'loading'|'ready'|'error';items:readonly ChecklistEvidencePoint[];selected:readonly ChecklistEvidencePoint[];next:ChecklistEvidencePoint|null;message:string}>;
 record:ChecklistRecord|null;draft:ChecklistDraft|null;
 review:Readonly<{itemId:string;label:string;status:ChecklistMark['status'];evidenceCount:number;reason:string|null;risk:'ordinary'|'sensitive'}>|null;
 receipt:ChecklistMarkReceipt|null;requiredTotal:number|null;requiredCompleted:number|null;canEdit:boolean;message:string;hasUnconfirmedWrite:boolean;
}>;
export type ChecklistControllerOptions={audience:ChecklistAudience;request:(path:string,init:RequestInit)=>Promise<Response>;key?:()=>string;timeoutMs?:number;onState?:(state:ChecklistView)=>void};
export interface ChecklistController{
 view():ChecklistView;load():Promise<boolean>;loadEvidence(more?:boolean):Promise<boolean>;toggleEvidence(id:string):boolean;editItem(id:string):boolean;
 setField(name:'status'|'evidenceText'|'reason'|'acknowledgeRisk',value:string|boolean):boolean;
 review():boolean;back():boolean;cancel():boolean;confirm():Promise<boolean>;reconcile():Promise<boolean>;
 changeAudience(audience:ChecklistAudience):boolean;clear():boolean;destroy():void;
}
export function createExecutionChecklistController(options:ChecklistControllerOptions):ChecklistController;
