import {HelpdeskError} from './errors.ts';
import {uuidIdentifier,isPersistableText} from './input-values.ts';
import {requestHash} from './canonical.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {isCanonicalInstant,compareInstants} from '../../shared/instant.js';

/** Internal, version-bound execution evidence. This is NOT authorization to act
 * in the source system and does not certify the truth of an analyst's statement.
 * The private store must authenticate writes and hold template/snapshot locks in
 * the same resource-authorized transaction through ticket CAS and COMMIT.
 */
export type ExecutionChecklistReference=Readonly<{id:string;version:number;sha256:string}>;
export type ExecutionChecklistItem=Readonly<{
 id:string;label:string;required:boolean;allowNotApplicable:boolean;
 evidenceRequired:boolean;risk:'ordinary'|'sensitive';
}>;
export type ExecutionChecklistTemplate=Readonly<{
 schema:1;id:string;version:number;status:'draft'|'published';items:readonly ExecutionChecklistItem[];
}>;
export type ExecutionChecklistContext=Readonly<{
 workspaceId:string;accountId:string;ticketId:string;ticketVersion:number;
 profileVersionId:string;reference:ExecutionChecklistReference;
}>;
export type ExecutionChecklistCompletion=Readonly<{
 templateId:string;templateVersion:number;templateSha256:string;
 snapshotRevision:number;snapshotSha256:string;
 doneCount:number;waivedCount:number;optionalPendingCount:number;
}>;
const errors=new WeakSet<object>();
function failure(code='workflow_checklist_unavailable',status=503):HelpdeskError{
 const e=new HelpdeskError(status,code,'Não foi possível confirmar o checklist de execução desta revisão.');errors.add(e);return e;
}
function guarded<T>(fn:()=>T):T{
 try{return fn();}catch(e){if(e&&typeof e==='object'&&errors.has(e))throw e;throw failure();}
}
function object(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw failure();
 if(Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw failure();
 return value as Record<string,unknown>;
}
function list(value:unknown,max:number,min=0):unknown[]{
 if(!Array.isArray(value)||value.length<min||value.length>max)throw failure();return value;
}
function revision(v:unknown):number{if(!Number.isSafeInteger(v)||(v as number)<1)throw failure();return v as number;}
function ref(v:unknown):string{if(typeof v!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(v))throw failure();return v;}
function digest(v:unknown):string{if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))throw failure();return v;}
function text(v:unknown,max:number):string{
 if(!isPersistableText(v)||!v.trim()||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(v))throw failure();return v;
}
function instant(v:unknown):string{if(!isCanonicalInstant(v))throw failure();return v;}
function reference(value:unknown):ExecutionChecklistReference{
 const r=object(value,['id','version','sha256']);return {id:ref(r.id),version:revision(r.version),sha256:digest(r.sha256)};
}
function template(value:unknown):ExecutionChecklistTemplate{
 const r=object(value,['schema','id','version','status','items']);
 if(r.schema!==1||r.status!=='draft'&&r.status!=='published')throw failure();
 const items=list(r.items,100,1).map((v):ExecutionChecklistItem=>{
  const i=object(v,['id','label','required','allowNotApplicable','evidenceRequired','risk']);
  if(typeof i.required!=='boolean'||typeof i.allowNotApplicable!=='boolean'||typeof i.evidenceRequired!=='boolean'||i.risk!=='ordinary'&&i.risk!=='sensitive')throw failure();
  if(i.risk==='sensitive'&&(!i.required||i.allowNotApplicable||!i.evidenceRequired))throw failure();
  return {id:ref(i.id),label:text(i.label,300),required:i.required,allowNotApplicable:i.allowNotApplicable,evidenceRequired:i.evidenceRequired,risk:i.risk};
 });
 if(new Set(items.map(i=>i.id)).size!==items.length||!items.some(i=>i.required))throw failure();
 return {schema:1,id:ref(r.id),version:revision(r.version),status:r.status,items};
}
export function parseExecutionChecklistReference(input:unknown):ExecutionChecklistReference{
 return guarded(()=>freezeFormData(reference(copyFormData(input))));
}
export function parseExecutionChecklistTemplate(input:unknown):ExecutionChecklistTemplate{
 return guarded(()=>freezeFormData(template(copyFormData(input))));
}

/** Checks only the bound snapshot read by the server. No public command accepts
 * checklist data, approval booleans or source capabilities as a substitute.
 * Optional missing items count as pending; mandatory items never disappear.
 */
export function assertExecutionChecklistComplete(input:unknown,expected:ExecutionChecklistContext,at:string):ExecutionChecklistCompletion{
 return guarded(()=>{
  if(input===null)throw failure('workflow_checklist_required',409);
  // Copy first: reject inherited/accessor/symbol/hidden/sparse data without using
  // caller serialization. Exceptions thrown by proxies are never trusted errors.
  const value=object(copyFormData(input),['template','snapshot']);
  const c=object(copyFormData(expected),['workspaceId','accountId','ticketId','ticketVersion','profileVersionId','reference']);
  const target={workspaceId:uuidIdentifier(c.workspaceId),accountId:uuidIdentifier(c.accountId),ticketId:uuidIdentifier(c.ticketId),ticketVersion:revision(c.ticketVersion),profileVersionId:ref(c.profileVersionId),reference:reference(c.reference)};
  const now=instant(at),definition=template(value.template);
  const hash=requestHash(definition);
  if(definition.id!==target.reference.id||definition.version!==target.reference.version||hash!==target.reference.sha256)throw failure('workflow_checklist_mismatch',409);
  if(definition.status!=='published'||value.snapshot===null)throw failure('workflow_checklist_required',409);
  const s=object(value.snapshot,['workspaceId','accountId','ticketId','ticketVersion','profileVersionId','reference','revision','entries']);
  const currentRef=reference(s.reference),snapshotRevision=revision(s.revision);
  if(uuidIdentifier(s.workspaceId)!==target.workspaceId||uuidIdentifier(s.accountId)!==target.accountId||uuidIdentifier(s.ticketId)!==target.ticketId||revision(s.ticketVersion)!==target.ticketVersion||ref(s.profileVersionId)!==target.profileVersionId||requestHash(currentRef)!==requestHash(target.reference))throw failure('workflow_checklist_mismatch',409);
  const entries=list(s.entries,100),byId=new Map<string,Record<string,unknown>>();
  for(const raw of entries){
   const e=object(raw,['itemId','status','actorId','at','evidenceRefs','reason','riskAcknowledgement']);
   const itemId=ref(e.itemId);if(byId.has(itemId)||!definition.items.some(i=>i.id===itemId))throw failure();
   if(!['pending','done','not_applicable'].includes(e.status as string))throw failure();
   const evidence=list(e.evidenceRefs,20).map(ref);
   if(new Set(evidence).size!==evidence.length)throw failure();
   if(e.reason!==null)text(e.reason,2000);
   if(e.status==='pending'){
    if(e.actorId!==null||e.at!==null||e.reason!==null||e.riskAcknowledgement!==null||evidence.length)throw failure();
   }else{
    uuidIdentifier(e.actorId);instant(e.at);
    if(compareInstants(e.at as string,now)>0)throw failure('workflow_checklist_mismatch',409);
    if(e.riskAcknowledgement!==null){
     const ack=object(e.riskAcknowledgement,['actorId','at','statement']);uuidIdentifier(ack.actorId);instant(ack.at);text(ack.statement,2000);
    }
   }
   byId.set(itemId,e);
  }
  let doneCount=0,waivedCount=0,optionalPendingCount=0;
  for(const item of definition.items){
   const e=byId.get(item.id);
   if(!e||e.status==='pending'){
    if(item.required)throw failure('workflow_checklist_required',409);
    optionalPendingCount++;continue;
   }
   if(e.status==='not_applicable'){
    if(!item.allowNotApplicable||e.reason===null||item.risk==='sensitive')throw failure('workflow_checklist_required',409);
    if(e.riskAcknowledgement!==null)throw failure();waivedCount++;continue;
   }
   if(item.evidenceRequired&&!(e.evidenceRefs as unknown[]).length)throw failure('workflow_checklist_required',409);
   if(item.risk==='sensitive'){
    if(e.riskAcknowledgement===null)throw failure('workflow_checklist_confirmation_required',409);
    const ack=e.riskAcknowledgement as Record<string,unknown>;
    if(uuidIdentifier(ack.actorId)!==uuidIdentifier(e.actorId)||compareInstants(ack.at as string,e.at as string)<0||compareInstants(ack.at as string,now)>0)throw failure('workflow_checklist_confirmation_required',409);
   }else if(e.riskAcknowledgement!==null)throw failure();
   doneCount++;
  }
  return freezeFormData({templateId:definition.id,templateVersion:definition.version,templateSha256:hash,snapshotRevision,snapshotSha256:requestHash(s),doneCount,waivedCount,optionalPendingCount});
 });
}
