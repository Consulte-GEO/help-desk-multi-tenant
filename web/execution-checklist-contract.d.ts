import type {ChecklistRecord,ChecklistMark} from '../src/domain/execution-checklist-mark.ts';
import type {ChecklistMarkReceipt} from '../src/application/execution-checklist.ts';
import type {ChecklistAudience,ChecklistDraft} from './execution-checklist-state.js';
export function checklistAudience(raw:unknown):ChecklistAudience;
export function readChecklistPresentation(raw:unknown,audience:ChecklistAudience,etag:string|null):Readonly<{record:ChecklistRecord;requiredTotal:number;requiredCompleted:number;canEdit:boolean}>;
export function prepareChecklistMark(record:ChecklistRecord,draft:ChecklistDraft):ChecklistMark;
export function readChecklistMarkReceipt(raw:unknown,audience:ChecklistAudience,command:ChecklistMark,readAt:string,etag:string|null):ChecklistMarkReceipt;
