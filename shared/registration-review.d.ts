export type RegistrationReviewContext=Readonly<{workspaceId:string;accountId:string;ticketId:string;operationId:string;audience:'internal'|'customer'}>;
export type ReviewField=Readonly<{key:string;label:string;value:string;truncated:boolean}>;
export type RegistrationReviewView=Readonly<{
 schema:1;audience:RegistrationReviewContext['audience'];context:Omit<RegistrationReviewContext,'audience'>;
 revision:number;inputRevision:number;status:'queued_analysis'|'analyzing'|'draft_ready'|'needs_information'|'manual_review'|'analysis_failed'|'cancelled';observedAt:string;expiresAt:string;
 detail:null|Readonly<{requested:readonly ReviewField[];targets:readonly ReviewField[];proposal:readonly ReviewField[];effects:readonly string[];blockers:readonly string[];draftRevision:number;draftHash:string|null;historyLoaded:false}>;
 capabilities:Readonly<{edit:false;approve:false;execute:false}>;
}>;
export const REGISTRATION_REVIEW_LIMITS:Readonly<{fieldText:1024;fields:128;windowMs:60000}>;
export function parseRegistrationReviewContext(raw:unknown):RegistrationReviewContext;
export function parseRegistrationReviewView(raw:unknown,expected:RegistrationReviewContext):RegistrationReviewView;
export function registrationReviewStatus(status:string,audience?:string):Readonly<{label:string;message:string;tone:string}>;
