/** Local private triage only. Operator choices are not editorial approval, identity,
 * sanitization evidence or publication authority. Every evaluation re-audits bytes. */
import {createHash} from 'node:crypto';
import {auditKnowledgeSource,KNOWLEDGE_LIMITS} from './knowledge-source-audit-core.mjs';

const invalid=(code='knowledge_review_invalid')=>Object.assign(new Error('Revisão não concluída: plano incompatível, desatualizado ou seleção não permitida. Nenhum conteúdo foi publicado.'),{code});
const hash=x=>createHash('sha256').update(x).digest('hex');
function canonical(v){
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 if(v!==null&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
 return JSON.stringify(v);
}
function freeze(v){if(v&&typeof v==='object'){for(const x of Object.values(v))freeze(x);Object.freeze(v);}return v;}
function object(v,keys){
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))throw invalid();
 const own=Reflect.ownKeys(v);if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)))throw invalid();
 const out={};for(const k of keys){const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw invalid();out[k]=d.value;}return out;
}
function list(v,max){
 if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype)throw invalid();const n=Object.getOwnPropertyDescriptor(v,'length')?.value;
 if(!Number.isInteger(n)||n>max||Reflect.ownKeys(v).length!==n+1)throw invalid();
 return Array.from({length:n},(_,i)=>{const d=Object.getOwnPropertyDescriptor(v,''+i);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw invalid();return d.value;});
}
const digest=v=>{if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))throw invalid();return v;};
function path(v){if(typeof v!=='string'||v.length>220||!v.endsWith('.md')||!v.split('/').every(p=>/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(p)&&p!=='.'&&p!=='..'))throw invalid();return v;}
function bindingFor(audit){
 // Observation time is not an attestation. Rechecking identical bytes tomorrow
 // must not invalidate choices solely because the operator ran the tool again.
 const {observedAt,...snapshot}=audit;
 return {corpusId:audit.corpusId,policyRevision:audit.policyRevision,policySha256:audit.policySha256,sourceSetSha256:audit.sourceSetSha256,auditSha256:hash(canonical(snapshot))};
}
function parsePlan(raw){
 try{
  const p=object(raw,['schemaVersion','kind','status','binding','sources','items','publicationAllowed','operational','sanitizationVerified']);
  if(p.schemaVersion!==1||p.kind!=='knowledge_editorial_review'||p.status!=='draft'||p.publicationAllowed!==false||p.operational!==false||p.sanitizationVerified!==false)throw invalid();
  const binding=object(p.binding,['corpusId','policyRevision','policySha256','sourceSetSha256','auditSha256']);
  if(typeof binding.corpusId!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(binding.corpusId)||!Number.isSafeInteger(binding.policyRevision)||binding.policyRevision<1)throw invalid();
  for(const k of ['policySha256','sourceSetSha256','auditSha256'])digest(binding[k]);
  const sources=list(p.sources,KNOWLEDGE_LIMITS.sources).map(v=>{const s=object(v,['path','sourceSha256','action']);path(s.path);if(s.sourceSha256!==null)digest(s.sourceSha256);if(!['pending','exclude','request_revision','review_candidates'].includes(s.action))throw invalid();return s;});
  const items=list(p.items,KNOWLEDGE_LIMITS.candidates).map(v=>{const i=object(v,['id','sourceSha256','sectionSha256','action']);if(typeof i.id!=='string'||!/^KBC-[a-f0-9]{24}$/.test(i.id))throw invalid();digest(i.sourceSha256);digest(i.sectionSha256);if(!['pending','exclude','select'].includes(i.action))throw invalid();return i;});
  if(new Set(sources.map(s=>s.path)).size!==sources.length||new Set(items.map(i=>i.id)).size!==items.length)throw invalid();
  return freeze({...p,binding,sources,items});
 }catch{throw invalid();}
}

/** Returns a complete plan with no assumed editor decisions and no source bodies. */
export async function prepareKnowledgeReview(root,policy,options={}){
 const audit=await auditKnowledgeSource(root,policy,options);
 return freeze({schemaVersion:1,kind:'knowledge_editorial_review',status:'draft',binding:bindingFor(audit),
  sources:audit.documents.map(d=>({path:d.path,sourceSha256:d.sha256,action:'pending'})),
  items:audit.candidateBatch.items.map(c=>({id:c.id,sourceSha256:c.sourceSha256,sectionSha256:c.sectionSha256,action:'pending'})),
  publicationAllowed:false,operational:false,sanitizationVerified:false});
}

/** No input audit is trusted: regenerate it, including negative findings, from
 * the pinned corpus. Selecting one clean locator never clears a blocked file. */
export async function evaluateKnowledgeReview(root,policy,raw,options={}){
 const plan=parsePlan(raw);
 const audit=await auditKnowledgeSource(root,policy,options),binding=bindingFor(audit);
 if(canonical(plan.binding)!==canonical(binding)||plan.sources.length!==audit.documents.length||plan.items.length!==audit.candidateBatch.items.length)throw invalid('knowledge_review_stale');
 const sources=new Map(plan.sources.map(s=>[s.path,s])),items=new Map(plan.items.map(i=>[i.id,i]));
 const eligible=new Set(audit.candidateBatch.items.map(i=>i.sourcePath));
 for(const d of audit.documents){
  const decision=sources.get(d.path);if(!decision||decision.sourceSha256!==d.sha256)throw invalid('knowledge_review_stale');
  if(decision.action==='review_candidates'&&(!eligible.has(d.path)||d.selection!=='active'||d.classification!=='editorial'||d.inspection!=='inspected'||d.findings.some(f=>f.severity==='block')))throw invalid('knowledge_review_selection_denied');
 }
 const selected=[],pending=[],excluded=[];let explicitExclusions=0;
 for(const c of audit.candidateBatch.items){
  const decision=items.get(c.id),source=sources.get(c.sourcePath);
  if(!decision||decision.sourceSha256!==c.sourceSha256||decision.sectionSha256!==c.sectionSha256||!source)throw invalid('knowledge_review_stale');
  if(decision.action==='select'){
   if(source.action!=='review_candidates')throw invalid('knowledge_review_selection_denied');selected.push(c);
  }else if(decision.action==='exclude'||['exclude','request_revision'].includes(source.action)){
   excluded.push(c.id);if(decision.action==='exclude')explicitExclusions++;
  }else pending.push(c.id);
 }
 const sourceBlocked=!audit.complete||audit.unlisted.length>0||audit.rootFindings.some(f=>f.severity==='block');
 const summary={sources:plan.sources.length,items:plan.items.length,
  pendingSources:plan.sources.filter(s=>s.action==='pending').length,
  requestedRevisions:plan.sources.filter(s=>s.action==='request_revision').length,
  quarantinedSources:audit.summary.quarantinedSources,
  selectedItems:sourceBlocked?0:selected.length,pendingItems:pending.length,
  excludedItems:explicitExclusions,effectivelyExcludedItems:excluded.length};
 return freeze({schemaVersion:1,kind:'knowledge_editorial_review_result',binding,observedAt:audit.observedAt,
  status:sourceBlocked?'source_blocked':selected.length?'private_selection_prepared':'review_incomplete',auditStatus:audit.status,sourceInspectionComplete:audit.complete,
  choicesAre:'operator_suggestions_not_approval',summary,
  sourceTasks:audit.documents.map(d=>({sourceId:d.id,path:d.path,sourceSha256:d.sha256,action:sources.get(d.path).action,
   classification:d.classification,generation:d.generation,selection:d.selection,findings:d.findings,
   candidateCount:audit.candidateBatch.items.filter(i=>i.sourcePath===d.path).length})),
  selected:{kind:'editorial_locator_batch',items:sourceBlocked?[]:selected,bodyIncluded:false,publicationAllowed:false},
  pendingItemIds:pending,excludedItemIds:excluded,
  publicationAllowed:false,operational:false,sanitizationVerified:false});
}
