import {copyFormData,freezeFormData} from '../shared/form-rules.js';
import {isCanonicalInstant,compareInstants} from '../shared/instant.js';

// Presentation validation only. These checks never authorize reads, marks or
// resolution; the existing service and SQL remain authoritative.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ref=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const statuses=['new','triage','open','waiting_customer','waiting_internal','waiting_third_party','resolved','closed','cancelled'];
const markable=['triage','open','waiting_internal','waiting_third_party'];
const bad=()=>new Error('Dados do checklist indisponíveis ou incompatíveis.');
function object(value,keys){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw bad();
 return value;
}
const id=v=>{if(typeof v!=='string'||!uuid.test(v))throw bad();return v;};
const reference=v=>{if(typeof v!=='string'||!ref.test(v))throw bad();return v;};
const rev=(v,min=1)=>{if(!Number.isSafeInteger(v)||v<min||v>=Number.MAX_SAFE_INTEGER)throw bad();return v;};
const instant=v=>{if(!isCanonicalInstant(v))throw bad();return v;};
function text(v,max){if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\p{Cs}]/u.test(v))throw bad();return v;}
function refs(v){
 if(!Array.isArray(v)||v.length>20)throw bad();
 const values=v.map(s=>{if(typeof s!=='string'||!s.startsWith('note:')||'note:'+id(s.slice(5))!==s)throw bad();return s;});
 if(new Set(values).size!==values.length)throw bad();return values;
}
function checklistReference(value){const r=object(value,['id','version','sha256']);reference(r.id);rev(r.version);if(typeof r.sha256!=='string'||!/^[a-f0-9]{64}$/.test(r.sha256))throw bad();return r;}
function boundContext(value){const c=object(value,['workspaceId','accountId','ticketId','ticketVersion','profileVersionId','reference']);id(c.workspaceId);id(c.accountId);id(c.ticketId);rev(c.ticketVersion);reference(c.profileVersionId);checklistReference(c.reference);return c;}
function sameContext(a,b){return ['workspaceId','accountId','ticketId','ticketVersion','profileVersionId'].every(k=>a[k]===b[k])&&['id','version','sha256'].every(k=>a.reference[k]===b.reference[k]);}
export function checklistAudience(raw){
 const a=object(copyFormData(raw),['principalId','workspaceId','accountId','ticketId','canWrite']);
 for(const k of ['principalId','workspaceId','accountId','ticketId'])id(a[k]);
 if(typeof a.canWrite!=='boolean')throw bad();return freezeFormData(a);
}
export function readChecklistPresentation(raw,audience,etag){
 const r=object(copyFormData(raw),['context','template','snapshot','ticketStatus','assignedTo','readAt']);
 const c=boundContext(r.context),t=object(r.template,['schema','id','version','status','items']);
 if(c.workspaceId!==audience.workspaceId||c.accountId!==audience.accountId||c.ticketId!==audience.ticketId)throw bad();
 if(t.schema!==1||t.status!=='published'||t.id!==c.reference.id||t.version!==c.reference.version||!Array.isArray(t.items)||t.items.length<1||t.items.length>100)throw bad();
 const names=new Set();
 for(const rawItem of t.items){const i=object(rawItem,['id','label','required','allowNotApplicable','evidenceRequired','risk']);
  reference(i.id);text(i.label,300);if(names.has(i.id)||['required','allowNotApplicable','evidenceRequired'].some(k=>typeof i[k]!=='boolean')||!['ordinary','sensitive'].includes(i.risk))throw bad();
  if(i.risk==='sensitive'&&(!i.required||i.allowNotApplicable||!i.evidenceRequired))throw bad();names.add(i.id);
 }
 if(!t.items.some(i=>i.required)||!statuses.includes(r.ticketStatus))throw bad();
 if(r.assignedTo!==null)id(r.assignedTo);instant(r.readAt);
 const completed=new Set();let revision=0;
 if(r.snapshot!==null){const s=object(r.snapshot,['workspaceId','accountId','ticketId','ticketVersion','profileVersionId','reference','revision','entries']);
  const {revision:sr,entries,...other}=s;if(!sameContext(boundContext(other),c)||!Array.isArray(entries)||entries.length>100)throw bad();revision=rev(sr);
  const seen=new Set();
  for(const rawEntry of entries){const e=object(rawEntry,['itemId','status','actorId','at','evidenceRefs','reason','riskAcknowledgement']),item=t.items.find(i=>i.id===e.itemId);
   if(!item||seen.has(e.itemId)||!['pending','done','not_applicable'].includes(e.status))throw bad();seen.add(e.itemId);refs(e.evidenceRefs);
   if(e.status==='pending'){if(e.actorId!==null||e.at!==null||e.evidenceRefs.length||e.reason!==null||e.riskAcknowledgement!==null)throw bad();continue;}
   id(e.actorId);instant(e.at);if(compareInstants(e.at,r.readAt)>0)throw bad();if(e.reason!==null)text(e.reason,2000);
   if(e.status==='not_applicable'){
    if(!item.allowNotApplicable||item.risk==='sensitive'||e.reason===null||e.evidenceRefs.length||e.riskAcknowledgement!==null)throw bad();
   }else{
    if(item.evidenceRequired&&!e.evidenceRefs.length)throw bad();
    if(item.risk==='ordinary'){if(e.riskAcknowledgement!==null)throw bad();}
    else{const ack=object(e.riskAcknowledgement,['actorId','at','statement']);id(ack.actorId);instant(ack.at);text(ack.statement,2000);
     if(ack.actorId!==e.actorId||compareInstants(ack.at,e.at)<0||compareInstants(ack.at,r.readAt)>0)throw bad();}
   }
   completed.add(e.itemId);
  }
 }
 if(etag!=='"'+revision+'"')throw bad();
 return freezeFormData({record:r,requiredTotal:t.items.filter(i=>i.required).length,requiredCompleted:t.items.filter(i=>i.required&&completed.has(i.id)).length,
  canEdit:audience.canWrite&&r.assignedTo===audience.principalId&&markable.includes(r.ticketStatus)});
}
export function prepareChecklistMark(record,rawDraft){
 const d=object(copyFormData(rawDraft),['itemId','status','evidenceText','reason','acknowledgeRisk']);
 const item=record.template.items.find(i=>i.id===d.itemId);
 if(!item||!['pending','done','not_applicable'].includes(d.status)||typeof d.evidenceText!=='string'||d.evidenceText.length>1000||typeof d.reason!=='string'||typeof d.acknowledgeRisk!=='boolean')throw bad();
 const evidence=d.evidenceText.split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map(s=>s.startsWith('note:')?s:'note:'+s.toLowerCase());refs(evidence);
 const reason=d.reason.trim()?text(d.reason,2000):null;
 if(d.status!=='done'&&(reason===null||evidence.length||d.acknowledgeRisk))throw bad();
 if(d.status==='not_applicable'&&!item.allowNotApplicable)throw bad();
 if(d.status==='done'&&((item.evidenceRequired&&!evidence.length)||(item.risk==='sensitive'&&!d.acknowledgeRisk)))throw bad();
 if(item.risk==='ordinary'&&d.acknowledgeRisk)throw bad();
 return freezeFormData({action:'mark',itemId:item.id,status:d.status,expectedTicketVersion:record.context.ticketVersion,expectedChecklistRevision:record.snapshot?.revision??0,
  evidenceRefs:evidence,reason,acknowledgeRisk:d.acknowledgeRisk});
}
export function readChecklistMarkReceipt(raw,audience,command,readAt,etag){
 const r=object(copyFormData(raw),['ticketId','workspaceId','accountId','actorId','itemId','status','ticketVersion','checklistRevision','auditId','at','replayed']);
 if(r.ticketId!==audience.ticketId||r.workspaceId!==audience.workspaceId||r.accountId!==audience.accountId||r.actorId!==audience.principalId||r.itemId!==command.itemId||r.status!==command.status||r.ticketVersion!==command.expectedTicketVersion||r.checklistRevision!==command.expectedChecklistRevision+1||typeof r.replayed!=='boolean')throw bad();
 id(r.auditId);instant(r.at);if(compareInstants(r.at,readAt)<0||etag!=='"'+r.checklistRevision+'"')throw bad();return freezeFormData(r);
}
