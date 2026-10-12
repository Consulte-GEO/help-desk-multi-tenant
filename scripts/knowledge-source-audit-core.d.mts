/** Types for the operator-only, read-only audit. No type represents publication approval. */
export type KnowledgeSourcePolicy = Readonly<{
 schemaVersion:1;corpusId:string;revision:number;status:'draft';sources:readonly Readonly<{
  path:string;sha256:string;classification:'editorial'|'internal'|'legacy';
  generation:'NOVO_GEO'|'LEGADO'|'HELP_DESK'|'MIXED'|'UNKNOWN';
  basis:readonly ('wiki_herdada'|'treinamento'|'demonstracao'|'codigo'|'banco'|'decisao_aprovada'|'unknown')[];
  target:string|null;units?:'auto'|'faq'|'table'|'sections'|'none';
 }>[];
}>;
export type SourceFinding=Readonly<{code:string;severity:'block'|'review'|'info';startLine:number|null;endLine:number|null;column:number|null}>;
export type SourceLink=Readonly<{line:number;column:number;kind:'inline'|'definition'|'reference'|'autolink'|'html';inCode:boolean;fragmentPresent:boolean;fragmentVerified:false;status:string;targetSourceId:string|null}>;
export type KnowledgeSourceRecord=Readonly<{
 id:string;path:string;logicalPath:string;expectedSha256:string;sha256:string|null;bytes:number|null;lineCount:number|null;
 classification:KnowledgeSourcePolicy['sources'][number]['classification'];generation:KnowledgeSourcePolicy['sources'][number]['generation'];
 basis:readonly string[];verification:'not_verified';selection:'active'|'superseded'|'excluded';inspection:'inspected'|'blocked';
 findings:readonly SourceFinding[];links:readonly SourceLink[];markers:readonly string[];publicationAllowed:false;
}>;
export type EditorialCandidateLocator=Readonly<{
 id:string;sourceId:string;logicalPath:string;sourcePath:string;sourceSha256:string;startLine:number;endLine:number;
 kind:'faq_item'|'table_row'|'section'|'document';sectionSha256:string;markers:readonly string[];sourceMarkers:readonly string[];
 generation:KnowledgeSourceRecord['generation'];basis:readonly string[];status:'candidate';audience:'editorial_private';
 applicabilityVerified:false;bodyIncluded:false;publicationAllowed:false;referencesResolved:boolean;
}>;
export type SourceAuditReport=Readonly<{
 schemaVersion:1;kind:'knowledge_source_audit';corpusId:string;policyRevision:number;policySha256:string;sourceSetSha256:string;
 observedAt:string;status:'blocked'|'review_required';complete:boolean;publicationAllowed:false;operational:false;
 secretScan:'heuristic_not_a_clearance';sourceReadOnly:true;
 summary:Readonly<{configuredSources:number;inspectedSources:number;effectiveDocuments:number;supersededSources:number;quarantinedSources:number;unlistedSources:number;bytesRead:number;linkOccurrences:number;missingRelativeLinks:number;candidateLocators:number}>;
 rootFindings:readonly SourceFinding[];unlisted:readonly Readonly<{id:string;path:null;reason:'unlisted_source';bytes:number|null}>[];
 documents:readonly KnowledgeSourceRecord[];candidateBatch:Readonly<{kind:'editorial_locator_batch';publicationAllowed:false;bodyIncluded:false;items:readonly EditorialCandidateLocator[]}>;
}>;
export const KNOWLEDGE_LIMITS:Readonly<{sources:500;entries:4096;depth:12;fileBytes:1048576;totalBytes:33554432;candidates:10000;links:10000}>;
export function validateKnowledgeSourcePolicy(input:unknown):KnowledgeSourcePolicy;
export function auditKnowledgeSource(root:string,input:unknown,options?:Readonly<{at?:string}>):Promise<SourceAuditReport>;
