import {copyFormData,freezeFormData} from './form-rules.js';
import {isCanonicalInstant,compareInstants} from './instant.js';

export const CHECKLIST_EVIDENCE_PAGE_SIZE=20;
const bad=()=>new Error('Página de evidências inválida ou de outra revisão.');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ident=v=>{if(typeof v!=='string'||!uuid.test(v))throw bad();return v;};
const rev=(v,min)=>{if(!Number.isSafeInteger(v)||v<min||v>=Number.MAX_SAFE_INTEGER)throw bad();return v;};
const instant=v=>{if(!isCanonicalInstant(v))throw bad();return v;};
function object(v,keys){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k)))throw bad();return v;}
function point(v){const p=object(v,['id','at']);ident(p.id);instant(p.at);return p;}
function older(a,b){const c=compareInstants(a.at,b.at);return c<0||c===0&&a.id<b.id;}
/** Cursor is a location, NOT a grant. Source filtering and a fresh read remain mandatory. */
export function parseEvidenceQuery(raw){
 const q=object(copyFormData(raw),['expectedTicketVersion','expectedChecklistRevision','before']);
 rev(q.expectedTicketVersion,1);rev(q.expectedChecklistRevision,0);if(q.before!==null)point(q.before);
 return freezeFormData(q);
}
/** Shared data boundary only: validates the WHOLE returned page, including fields
 * and order, before exposing any option. This does not authenticate the source.
 * No note body/title/snippet/email is part of this contract.
 */
export function readEvidencePage(raw,context,rawQuery){
 const q=parseEvidenceQuery(rawQuery),p=object(copyFormData(raw),['principalId','workspaceId','accountId','ticketId','ticketVersion','checklistRevision','readAt','items','next']);
 for(const k of ['principalId','workspaceId','accountId','ticketId'])if(ident(p[k])!==context[k])throw bad();
 if(rev(p.ticketVersion,1)!==context.ticketVersion||p.ticketVersion!==q.expectedTicketVersion||rev(p.checklistRevision,0)!==context.checklistRevision||p.checklistRevision!==q.expectedChecklistRevision)throw bad();
 instant(p.readAt);if(compareInstants(p.readAt,instant(context.readAt))<0)throw bad();
 if(!Array.isArray(p.items)||p.items.length>CHECKLIST_EVIDENCE_PAGE_SIZE)throw bad();
 const seen=new Set();let prior=q.before;
 for(const row of p.items){point(row);if(seen.has(row.id)||compareInstants(row.at,p.readAt)>0||prior!==null&&!older(row,prior))throw bad();seen.add(row.id);prior=row;}
 if(p.next!==null){point(p.next);const last=p.items.at(-1);if(p.items.length!==CHECKLIST_EVIDENCE_PAGE_SIZE||!last||last.id!==p.next.id||compareInstants(last.at,p.next.at)!==0)throw bad();}
 return freezeFormData(p);
}
