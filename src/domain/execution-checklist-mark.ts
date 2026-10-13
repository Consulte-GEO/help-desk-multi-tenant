import type {Principal} from './model.ts';
import {HelpdeskError} from './errors.ts';
import {uuidIdentifier,isPersistableText} from './input-values.ts';
import {isOperator} from './policy.ts';
import {requestHash} from './canonical.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {compareInstants,isCanonicalInstant} from '../../shared/instant.js';
import {parseExecutionChecklistReference,parseExecutionChecklistTemplate,
 type ExecutionChecklistContext,type ExecutionChecklistTemplate} from './execution-checklist.ts';

export type ChecklistMark=Readonly<{action:'mark';itemId:string;status:'pending'|'done'|'not_applicable';expectedTicketVersion:number;expectedChecklistRevision:number;evidenceRefs:readonly string[];reason:string|null;acknowledgeRisk:boolean}>;
export type ChecklistEntry=Readonly<{itemId:string;status:ChecklistMark['status'];actorId:string|null;at:string|null;evidenceRefs:readonly string[];reason:string|null;riskAcknowledgement:Readonly<{actorId:string;at:string;statement:string}>|null}>;
export type ChecklistSnapshot=ExecutionChecklistContext&Readonly<{revision:number;entries:readonly ChecklistEntry[]}>;
export type ChecklistRecord=Readonly<{context:ExecutionChecklistContext;template:ExecutionChecklistTemplate;snapshot:ChecklistSnapshot|null;ticketStatus:string;assignedTo:string|null;readAt:string}>;
export type ChecklistEvidence=Readonly<{reference:string;workspaceId:string;accountId:string;ticketId:string;actorId:string;at:string}>;
export const CHECKLIST_RISK_STATEMENT='Reconheço o risco descrito e registrei a conferência da execução. Esta marcação não autoriza ação no sistema de origem.';
const known=new WeakSet<object>();
export function checklistError(code='checklist_store_invalid',status=503):HelpdeskError{const e=new HelpdeskError(status,code,'Não foi possível confirmar a marcação interna desta revisão.');known.add(e);return e;}
function guarded<T>(work:()=>T,code='checklist_store_invalid',status=503):T{try{return work();}catch(e){if(e&&typeof e==='object'&&known.has(e))throw e;throw checklistError(code,status);}}
function object(input:unknown,keys:readonly string[]):Record<string,unknown>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==keys.length||keys.some(k=>!Object.hasOwn(input,k)))throw Error();return input as Record<string,unknown>;}
function revision(v:unknown,min=1):number{if(!Number.isSafeInteger(v)||(v as number)<min||(v as number)>=Number.MAX_SAFE_INTEGER)throw Error();return v as number;}
function ref(v:unknown):string{if(typeof v!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(v))throw Error();return v;}
function text(v:unknown):string{if(!isPersistableText(v)||!v.trim()||v.length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(v))throw Error();return v;}
function instant(v:unknown):string{if(!isCanonicalInstant(v))throw Error();return v;}
function refs(v:unknown):string[]{if(!Array.isArray(v)||v.length>20)throw Error();const r=v.map(x=>{if(typeof x!=='string'||!/^note:[0-9a-f-]{36}$/.test(x)||'note:'+uuidIdentifier(x.slice(5))!==x)throw Error();return x;});if(new Set(r).size!==r.length)throw Error();return r;}
export function parseChecklistMark(raw:unknown):ChecklistMark{return guarded(()=>{const x=object(copyFormData(raw),['action','itemId','status','expectedTicketVersion','expectedChecklistRevision','evidenceRefs','reason','acknowledgeRisk']);
 if(x.action!=='mark'||!['pending','done','not_applicable'].includes(x.status as string)||typeof x.acknowledgeRisk!=='boolean')throw Error();
 const result={action:'mark' as const,itemId:ref(x.itemId),status:x.status as ChecklistMark['status'],expectedTicketVersion:revision(x.expectedTicketVersion),expectedChecklistRevision:revision(x.expectedChecklistRevision,0),evidenceRefs:refs(x.evidenceRefs),reason:x.reason===null?null:text(x.reason),acknowledgeRisk:x.acknowledgeRisk};
 if(result.status!=='done'&&(result.reason===null||result.evidenceRefs.length||result.acknowledgeRisk))throw Error();return freezeFormData(result);
 },'invalid_checklist_mark',400);}
function context(raw:unknown):ExecutionChecklistContext{const c=object(raw,['workspaceId','accountId','ticketId','ticketVersion','profileVersionId','reference']);return {workspaceId:uuidIdentifier(c.workspaceId),accountId:uuidIdentifier(c.accountId),ticketId:uuidIdentifier(c.ticketId),ticketVersion:revision(c.ticketVersion),profileVersionId:ref(c.profileVersionId),reference:parseExecutionChecklistReference(c.reference)};}
/** Private row parser. It permits incomplete checklists, never foreign/invalid entries.
 * It does not authorize reads; the application and SQL helper must both do so. */
export function parseChecklistRecord(raw:unknown):ChecklistRecord{return guarded(()=>{
 const r=object(copyFormData(raw),['context','template','snapshot','ticketStatus','assignedTo','readAt']);
 const c=context(r.context),t=parseExecutionChecklistTemplate(r.template),at=instant(r.readAt);
 if(t.status!=='published'||t.id!==c.reference.id||t.version!==c.reference.version||requestHash(t)!==c.reference.sha256)throw Error();
 if(typeof r.ticketStatus!=='string'||!['new','triage','open','waiting_customer','waiting_internal','waiting_third_party','resolved','closed','cancelled'].includes(r.ticketStatus))throw Error();
 const assignedTo=r.assignedTo===null?null:uuidIdentifier(r.assignedTo);
 let snapshot:ChecklistSnapshot|null=null;
 if(r.snapshot!==null){const s=object(r.snapshot,['workspaceId','accountId','ticketId','ticketVersion','profileVersionId','reference','revision','entries']);
  const {revision:sr,entries:se,...bound}=s;if(requestHash(context(bound))!==requestHash(c)||!Array.isArray(se)||se.length>100)throw Error();
  const entries:ChecklistEntry[]=se.map(raw=>{const e=object(raw,['itemId','status','actorId','at','evidenceRefs','reason','riskAcknowledgement']);const item=t.items.find(i=>i.id===e.itemId);if(!item||!['pending','done','not_applicable'].includes(e.status as string))throw Error();
   const evidence=refs(e.evidenceRefs);let actor:string|null=null,when:string|null=null,reason:string|null=null,ack:ChecklistEntry['riskAcknowledgement']=null;
   if(e.status==='pending'){if(e.actorId!==null||e.at!==null||e.reason!==null||e.riskAcknowledgement!==null||evidence.length)throw Error();}
   else{actor=uuidIdentifier(e.actorId);when=instant(e.at);if(compareInstants(when,at)>0)throw Error();reason=e.reason===null?null:text(e.reason);
    if(e.status==='not_applicable'){if(!item.allowNotApplicable||item.risk==='sensitive'||reason===null||evidence.length||e.riskAcknowledgement!==null)throw Error();}
    else{if(item.evidenceRequired&&!evidence.length)throw Error();if(item.risk==='ordinary'){if(e.riskAcknowledgement!==null)throw Error();}
     else{const a=object(e.riskAcknowledgement,['actorId','at','statement']);ack={actorId:uuidIdentifier(a.actorId),at:instant(a.at),statement:text(a.statement)};if(ack.actorId!==actor||compareInstants(ack.at,when)<0||compareInstants(ack.at,at)>0)throw Error();}}
   }
   return {itemId:item.id,status:e.status as ChecklistEntry['status'],actorId:actor,at:when,evidenceRefs:evidence,reason,riskAcknowledgement:ack};
  });if(new Set(entries.map(e=>e.itemId)).size!==entries.length)throw Error();snapshot={...c,revision:revision(sr),entries};
 }
 return freezeFormData({context:c,template:t,snapshot,ticketStatus:r.ticketStatus,assignedTo,readAt:at});
});}
export function requireChecklistOperator(p:Principal,c:ExecutionChecklistContext,write=false,assignedTo?:string|null):void{
 if(!p||p.kind!=='human'||!isOperator(p,c.workspaceId,c.accountId)||!p.scopes.includes('tickets:read')||!p.scopes.includes('notes:read')
  ||write&&(!p.scopes.includes('tickets:write')||!p.scopes.includes('notes:write')||assignedTo!==p.id))throw checklistError('checklist_forbidden',403);
}
/** Pure decision. The server/SQL own actor and time; the browser owns only its intent.
 * Evidence selectors identify existing internal notes. They certify a recorded
 * declaration, not the truth of GEO execution or a right to run dangerous actions. */
export function decideExecutionChecklistMark(p:Principal,rawRecord:unknown,rawCommand:unknown,rawEvidence:unknown,at:string){
 const command=parseChecklistMark(rawCommand);
 return guarded(()=>{
  const r=parseChecklistRecord(rawRecord),c=r.context,now=instant(at);requireChecklistOperator(p,c,true,r.assignedTo);
  if(!['triage','open','waiting_internal','waiting_third_party'].includes(r.ticketStatus))throw checklistError('checklist_state_conflict',409);
  if(compareInstants(now,r.readAt)<0)throw checklistError('checklist_store_invalid');
  if(command.expectedTicketVersion!==c.ticketVersion||command.expectedChecklistRevision!==(r.snapshot?.revision??0))throw checklistError('checklist_version_conflict',412);
  const item=r.template.items.find(i=>i.id===command.itemId);if(!item)throw checklistError('invalid_checklist_mark',400);
  if(command.status==='done'&&item.evidenceRequired&&!command.evidenceRefs.length)throw checklistError('checklist_evidence_denied',403);
  if(command.status==='not_applicable'&&!item.allowNotApplicable)throw checklistError('invalid_checklist_mark',400);
  if(command.status==='done'&&item.risk==='sensitive'&&!command.acknowledgeRisk)throw checklistError('checklist_risk_ack_required',409);
  if(command.acknowledgeRisk&&item.risk!=='sensitive')throw checklistError('invalid_checklist_mark',400);
  const evidence=copyFormData(rawEvidence);if(!Array.isArray(evidence)||evidence.length!==command.evidenceRefs.length)throw checklistError('checklist_evidence_denied',403);
  const seen=new Set<string>();for(const raw of evidence){const e=object(raw,['reference','workspaceId','accountId','ticketId','actorId','at']);const reference=ref(e.reference);
   if(seen.has(reference)||!command.evidenceRefs.includes(reference)||e.workspaceId!==c.workspaceId||e.accountId!==c.accountId||e.ticketId!==c.ticketId||e.actorId!==p.id||compareInstants(instant(e.at),now)>0)throw checklistError('checklist_evidence_denied',403);seen.add(reference);}
  const entry:ChecklistEntry=command.status==='pending'?{itemId:item.id,status:'pending',actorId:null,at:null,evidenceRefs:[],reason:null,riskAcknowledgement:null}:
   {itemId:item.id,status:command.status,actorId:uuidIdentifier(p.id),at:now,evidenceRefs:[...command.evidenceRefs],reason:command.reason,riskAcknowledgement:command.acknowledgeRisk?{actorId:p.id,at:now,statement:CHECKLIST_RISK_STATEMENT}:null};
  const prior=new Map((r.snapshot?.entries??[]).map(e=>[e.itemId,e]));prior.set(item.id,entry);
  const snapshot:ChecklistSnapshot={...c,revision:command.expectedChecklistRevision+1,entries:r.template.items.filter(i=>prior.has(i.id)).map(i=>prior.get(i.id)!)};
  return freezeFormData({snapshot,entry,auditReason:command.reason,beforeSha256:r.snapshot===null?null:requestHash(r.snapshot),afterSha256:requestHash(snapshot)});
 });
}

/** Recheck the current PRIVATE evidence before using a checklist for resolution.
 * The SQL reader must lock the referenced notes in the same transaction as the
 * ticket/snapshot. This validates returned metadata, not the truth of execution.
 * A note shared across items is returned once, but must match EVERY item's author
 * and predate EVERY marking. The resolver/SQL still own current read authorization.
 */
export function assertChecklistResolutionEvidence(record:ChecklistRecord,raw:unknown):void{
 guarded(()=>{
  const required=new Map<string,ChecklistEntry[]>();
  for(const entry of record.snapshot?.entries??[]){
   for(const reference of entry.evidenceRefs){
    const users=required.get(reference)??[];users.push(entry);required.set(reference,users);
   }
  }
  const rows=copyFormData(raw);
  if(!Array.isArray(rows)||rows.length!==required.size||rows.length>2000)throw Error();
  const seen=new Set<string>(),c=record.context;
  for(const rawRow of rows){
   const r=object(rawRow,['reference','workspaceId','accountId','ticketId','actorId','at']);
   const reference=refs([r.reference])[0]!;const users=required.get(reference);
   if(!users||seen.has(reference)||r.workspaceId!==c.workspaceId||r.accountId!==c.accountId||r.ticketId!==c.ticketId)throw Error();
   const author=uuidIdentifier(r.actorId),createdAt=instant(r.at);
   if(compareInstants(createdAt,record.readAt)>0)throw Error();
   for(const entry of users){
    if(entry.status!=='done'||entry.actorId!==author||entry.at===null||compareInstants(createdAt,entry.at)>0)throw Error();
   }
   seen.add(reference);
  }
 },'checklist_evidence_denied',403);
}
