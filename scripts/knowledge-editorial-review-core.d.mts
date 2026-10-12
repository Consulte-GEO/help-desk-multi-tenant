import type {EditorialCandidateLocator,SourceFinding} from './knowledge-source-audit-core.mjs';
export type ReviewBinding=Readonly<{corpusId:string;policyRevision:number;policySha256:string;sourceSetSha256:string;auditSha256:string}>;
export type SourceReviewAction='pending'|'exclude'|'request_revision'|'review_candidates';
export type ItemReviewAction='pending'|'exclude'|'select';
/** Serialized editable choices; not a signed decision or an authorization token. */
export type KnowledgeEditorialReview=Readonly<{
 schemaVersion:1;kind:'knowledge_editorial_review';status:'draft';binding:ReviewBinding;
 sources:readonly Readonly<{path:string;sourceSha256:string|null;action:SourceReviewAction}>[];
 items:readonly Readonly<{id:string;sourceSha256:string;sectionSha256:string;action:ItemReviewAction}>[];
 publicationAllowed:false;operational:false;sanitizationVerified:false;
}>;
export type KnowledgeEditorialReviewResult=Readonly<{
 schemaVersion:1;kind:'knowledge_editorial_review_result';binding:ReviewBinding;observedAt:string;
 status:'source_blocked'|'private_selection_prepared'|'review_incomplete';auditStatus:'blocked'|'review_required';sourceInspectionComplete:boolean;
 choicesAre:'operator_suggestions_not_approval';
 summary:Readonly<{sources:number;items:number;pendingSources:number;requestedRevisions:number;quarantinedSources:number;selectedItems:number;pendingItems:number;excludedItems:number;effectivelyExcludedItems:number}>;
 sourceTasks:readonly Readonly<{sourceId:string;path:string;sourceSha256:string|null;action:SourceReviewAction;classification:string;generation:string;selection:string;findings:readonly SourceFinding[];candidateCount:number}>[];
 selected:Readonly<{kind:'editorial_locator_batch';items:readonly EditorialCandidateLocator[];bodyIncluded:false;publicationAllowed:false}>;
 pendingItemIds:readonly string[];excludedItemIds:readonly string[];
 publicationAllowed:false;operational:false;sanitizationVerified:false;
}>;
export function prepareKnowledgeReview(root:string,policy:unknown,options?:Readonly<{at?:string}>):Promise<KnowledgeEditorialReview>;
export function evaluateKnowledgeReview(root:string,policy:unknown,plan:unknown,options?:Readonly<{at?:string}>):Promise<KnowledgeEditorialReviewResult>;
