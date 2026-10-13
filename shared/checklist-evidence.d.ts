export const CHECKLIST_EVIDENCE_PAGE_SIZE:20;
export type ChecklistEvidencePoint=Readonly<{id:string;at:string}>;
export type ChecklistEvidenceQuery=Readonly<{expectedTicketVersion:number;expectedChecklistRevision:number;before:ChecklistEvidencePoint|null}>;
export type ChecklistEvidenceContext=Readonly<{principalId:string;workspaceId:string;accountId:string;ticketId:string;ticketVersion:number;checklistRevision:number;readAt:string}>;
export type ChecklistEvidencePage=ChecklistEvidenceContext&Readonly<{items:readonly ChecklistEvidencePoint[];next:ChecklistEvidencePoint|null}>;
export function parseEvidenceQuery(raw:unknown):ChecklistEvidenceQuery;
export function readEvidencePage(raw:unknown,context:ChecklistEvidenceContext,query:ChecklistEvidenceQuery):ChecklistEvidencePage;
