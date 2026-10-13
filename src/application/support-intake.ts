import type {createIntakeBeneficiaryVerifier,IntakeBeneficiary} from './intake-beneficiary.ts';
import {randomUUID} from 'node:crypto';import type {Principal,Ticket,Coverage} from '../domain/model.ts';
import type {SqlClient,SqlPool} from '../infrastructure/sql.ts';import type {createResourceAccessResolver,ResourceScopeContext} from './resource-access.ts';
import {copyFormData,freezeFormData,validateFormValues} from '../../shared/form-rules.js';
import {parseFormVersion,formRecord,formRevision,type FormVersion} from '../domain/form-schema.ts';
import {uuidIdentifier} from '../domain/input-values.ts';import {requestHash} from '../domain/canonical.ts';
import {parseExternalResourceSelection,externalResourceSelectionKey} from '../domain/external-resource.ts';
import {resolveCoverage} from '../domain/contracts.ts';
import {projectClocks,derivePriority,type PublishedSlaPolicy} from '../domain/sla-clock.ts';
import {instantMicros} from '../domain/business-calendar.ts';
import type {SupportWorkflowProfile,SupportWorkflowEvent} from '../domain/support-workflow.ts';
import {assertCleanAttachment,type AttachmentRecord,type SealedAttachmentObject,type AttachmentBinding} from '../domain/attachment.ts';
import {checkedDraft,type DraftForm,type DraftDirectory} from './form-draft.ts';
import {runIntakeTransaction,intakeFailure as fail,safeIntakeError,type ScopedDraftStore,type IntakeExpiry} from './intake-context.ts';
export type IntakeProfile=Readonly<{profileVersionId:string;status:'published';form:FormVersion;productInstanceId:string;serviceCode:string;impactField:string;priorityPolicy:unknown;fixedPriority?:Ticket['priority'];workflow:SupportWorkflowProfile;initialState:'new'|'triage';approvalRequired:boolean;sla:PublishedSlaPolicy}>;
export type IntakeRequest=Readonly<{draftId:string;expectedDraftRevision:number;subject:string;description:string;coverageId:string|null;previewHash?:string}>;
export type SupportRequestReceipt=Readonly<{ticketId:string;protocol:string;sequence:string;workspaceId:string;accountId:string;actorId:string;requesterId:string;draftId:string;draftRevision:number;version:1;profileVersionId:string;formId:string;formVersion:number;priority:Ticket['priority'];createdAt:string;notification:'pending';replayed:boolean}>;
export type IntakeBundle=Readonly<{draftId:string;resourceScope:ResourceScopeContext;ticket:Ticket;requesterId:string;participants:readonly {principalId:string;role:'requester'}[];protocol:string;sequence:string;form:Readonly<Record<string,unknown>>;workflow:Readonly<Record<string,unknown>>;event:SupportWorkflowEvent;delegation:Readonly<Record<string,unknown>>|null;clocks:ReturnType<typeof projectClocks>;audit:Readonly<Record<string,unknown>>;outbox:Readonly<Record<string,unknown>>}>;
export interface SupportIntakeTransaction extends ScopedDraftStore{
 /** Revalidate beneficiary revision/capability/resource coverage in THIS transaction. */
 lockBeneficiary?(value:IntakeBeneficiary,scope:ResourceScopeContext):Promise<unknown>;
 readDraft(id:string):Promise<DraftForm|null>;
 readProfile(formId:string,formVersion:number):Promise<IntakeProfile>;
 /** Lock the contractual candidates with the same context, as existing locked_coverages does. */
 readCoverages(accountId:string,productInstanceId:string,serviceCode:string):Promise<Coverage[]>;
 lockEvidence(query:Readonly<Record<string,unknown>>,scope:ResourceScopeContext):Promise<{record:AttachmentRecord;object:SealedAttachmentObject}>;
 lockLookup(query:Readonly<Record<string,unknown>>,scope:ResourceScopeContext):Promise<{queryHash:string;status:'verified';expiresAt:string}>;
 /** Actor/workspace/key ledger lock. Receipt is original immutable data, no enrichment. */
 readReceipt(key:string):Promise<{key:string;hash:string;result:SupportRequestReceipt}|null>;
 /** Apply current ticket RLS/resources, including requester participant if delegated. */
 authorizeReceipt(ticketId:string,scope:ResourceScopeContext):Promise<boolean>;
 /** Workspace sequence configured for draft start10001; gaps allowed. Never reset/cycle. */
 allocateProtocol():Promise<string>;
 /** Lock/CAS draft and atomically insert ticket, complete refs, form, profile/SLA,
  * event, audit, participant, minimal outbox, protocol and receipt; consume draft.
  * No COMMIT or provider calls here. Never use unrestricted request DB roles. */
 commitRequest(bundle:IntakeBundle,expectedDraftRevision:number,receipt:{key:string;hash:string;result:SupportRequestReceipt}):Promise<void>;
}
const keyOf=(v:string)=>{if(typeof v!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(v))throw fail('invalid_intake_input',400);return v;};
function parseInput(raw:unknown,commit:boolean):IntakeRequest{
 const r=formRecord(raw,['draftId','expectedDraftRevision','subject','description','coverageId',...(commit?['previewHash']:[])]);
 for(const [key,max] of [['subject',200],['description',12000]] as const)if(typeof r[key]!=='string'||(r[key] as string).trim().length<(key==='subject'?3:1)||(r[key] as string).length>max)throw fail('invalid_intake_input',400);
 if(commit&&(typeof r.previewHash!=='string'||!/^[a-f0-9]{64}$/.test(r.previewHash)))throw fail('invalid_intake_input',400);
 return freezeFormData({draftId:uuidIdentifier(r.draftId),expectedDraftRevision:formRevision(r.expectedDraftRevision),subject:r.subject as string,description:r.description as string,coverageId:r.coverageId===null?null:uuidIdentifier(r.coverageId),...(commit?{previewHash:r.previewHash as string}:{})});
}
function validateProfile(raw:IntakeProfile,d:DraftForm):IntakeProfile{
 const p=copyFormData(raw) as IntakeProfile,s=parseFormVersion(p.form);
 if(p.status!=='published'||s.status!=='published'||s.id!==d.formId||s.version!==d.formVersion||requestHash(s)!==d.schemaHash||p.workflow.status!=='published'||p.workflow.versionId!==p.profileVersionId||p.sla.profileVersionId!==p.profileVersionId||!['new','triage'].includes(p.initialState)||typeof p.approvalRequired!=='boolean'||p.approvalRequired&&p.initialState!=='triage'||p.fixedPriority!==undefined&&!['low','normal','high','urgent'].includes(p.fixedPriority)||typeof p.impactField!=='string'||typeof p.serviceCode!=='string'||!p.serviceCode.length||p.serviceCode.length>80)throw fail('form_schema_changed',409);
 uuidIdentifier(p.productInstanceId);return freezeFormData(p);
}
function coverageFrom(raw:Coverage[],scope:ResourceScopeContext,p:IntakeProfile,id:string|null,at:string):Coverage{
 const rows=copyFormData(raw) as Coverage[];
 if(!Array.isArray(rows)||rows.length>100||new Set(rows.map(c=>c.id)).size!==rows.length)throw fail();
 for(const c of rows){if(c.workspaceId!==scope.workspaceId||c.accountId!==scope.accountId||c.productInstanceId!==p.productInstanceId||c.serviceCode!==p.serviceCode)throw fail();for(const v of [c.id,c.contractId,c.contractVersionId])uuidIdentifier(v);formRevision(c.contractVersion);}
 const r=resolveCoverage(rows,at);const selected=id?r.candidates.find(c=>c.id===id):r.status==='resolved'?r.candidates[0]:undefined;
 if(!selected)throw fail('intake_coverage_unavailable',422);return selected;
}
/** Optional domain-to-transaction composition; real source/store/runtime remain required.
 * Schema/coverage/evidence never originate in an HTTP body. Preview allocates nothing.
 * The SAME input/key replays one immutable ticket/protocol after current authorization. */
export function createSupportIntake(o:{pool:SqlPool;resolver:ReturnType<typeof createResourceAccessResolver>;directory:DraftDirectory;createStore:(c:SqlClient,p:Principal)=>SupportIntakeTransaction;clock?:()=>string;beneficiaries?:ReturnType<typeof createIntakeBeneficiaryVerifier>}){
 const clock=o.clock??(()=>new Date().toISOString());
 function beneficiary(p:Principal,proof:unknown):IntakeBeneficiary{if(!o.beneficiaries)throw fail('intake_delegation_denied',403);return o.beneficiaries.inspect(p,proof);}
 async function checkBeneficiary(tx:SupportIntakeTransaction,scope:ResourceScopeContext,expires:IntakeExpiry,b:IntakeBeneficiary|null){if(!b)return;expires(b.expiresAt,'intake_delegation_denied');if(scope.accountId!==b.accountId||externalResourceSelectionKey(scope.refs)!==externalResourceSelectionKey(b.refs)||!tx.lockBeneficiary||requestHash(copyFormData(await tx.lockBeneficiary(b,scope)))!==requestHash(b))throw fail('intake_delegation_denied',403);}

 async function inScope<T>(p:Principal,input:IntakeRequest,work:(tx:SupportIntakeTransaction,scope:ResourceScopeContext,expires:IntakeExpiry)=>Promise<T>,signal?:AbortSignal,admission?:()=>void){
  const located=await o.directory.locateDraft(p,input.draftId,signal);if(!located)throw fail('draft_not_found',404);const refs=parseExternalResourceSelection(located.refs);
  return runIntakeTransaction({...o,clock},p,refs,'tickets.write',async(tx,scope,expires)=>{if(scope.accountId!==located.accountId)throw fail('draft_forbidden',403);return work(tx,scope,expires);},signal,admission);
 }
 async function prepare(tx:SupportIntakeTransaction,p:Principal,input:IntakeRequest,scope:ResourceScopeContext,expires:IntakeExpiry,b:IntakeBeneficiary|null=null){
  const d=checkedDraft(await tx.readDraft(input.draftId),p,input.draftId,scope.refs,clock(),expires);
  if(d.accountId!==scope.accountId)throw fail('draft_forbidden',403);if(d.status!=='editing')throw fail('draft_already_committed',409);if(d.revision!==input.expectedDraftRevision)throw fail('draft_version_conflict',412);
  const profile=validateProfile(await tx.readProfile(d.formId,d.formVersion),d),values=validateFormValues(profile.form,d.answers,{audience:'customer'});
  if(!values.valid)throw fail('invalid_form_values',422);
  const cover=coverageFrom(await tx.readCoverages(d.accountId,profile.productInstanceId,profile.serviceCode),scope,profile,input.coverageId,clock());if(cover.validUntil!==null)expires(cover.validUntil);
  const evidence:{path:string;id:string;hash:string}[]=[];let total=0;
  for(const requirement of values.requirements)for(const value of requirement.values){if(++total>100)throw fail('intake_evidence_invalid',409);
   const q={kind:requirement.kind,path:requirement.path,registryKey:requirement.key,value,workspaceId:p.workspaceId,accountId:d.accountId,principalId:p.id,bindingId:scope.bindingId,accessRevision:scope.accessRevision,formId:d.formId,formVersion:d.formVersion,draftId:d.id,draftRevision:d.revision};
   if(requirement.kind==='file'){
    const raw=await tx.lockEvidence(q,scope);const binding:AttachmentBinding={workspaceId:p.workspaceId,accountId:d.accountId,ownerId:p.id,draftId:d.id,draftRevision:d.revision,formId:d.formId,formVersion:d.formVersion,fieldPath:requirement.path,registryKey:requirement.key,visibility:'customer',refs:scope.refs};
    if(!raw||raw.record.id!==value)throw fail('intake_evidence_invalid',409);const r=assertCleanAttachment(raw.record,binding,raw.object,clock());expires(r.expiresAt as string,'intake_evidence_invalid');evidence.push({path:requirement.path,id:value,hash:requestHash({sha256:r.sha256,object:r.object,binding,scanPolicyId:r.scanPolicyId,version:r.version})});
   }else{
    const queryHash=requestHash(q),r=formRecord(await tx.lockLookup({...q,queryHash},scope),['queryHash','status','expiresAt']);
    if(!r||r.queryHash!==queryHash||r.status!=='verified')throw fail('intake_evidence_invalid',409);expires(r.expiresAt as string,'intake_evidence_invalid');evidence.push({path:requirement.path,id:value,hash:queryHash});
   }
  }
  const priority=profile.fixedPriority??derivePriority(values.answers[profile.impactField],profile.priorityPolicy),at=clock();
  const candidate:Ticket={id:d.id,workspaceId:p.workspaceId,accountId:d.accountId,productInstanceId:profile.productInstanceId,serviceCode:profile.serviceCode,createdBy:p.id,assignedTo:null,subject:input.subject,description:input.description,status:profile.initialState,priority,version:1,coverageId:cover.id,contractVersionId:cover.contractVersionId,contractSnapshot:{contractId:cover.contractId,version:cover.contractVersion,policy:cover.policy},createdAt:at,updatedAt:at};
  const event:SupportWorkflowEvent={ticketId:d.id,workspaceId:p.workspaceId,profileVersionId:profile.profileVersionId,sequence:1,at,type:'created',actorId:p.id,actorKind:'customer',from:null,to:profile.initialState};
  const clocks=projectClocks({...candidate,profileVersionId:profile.profileVersionId,slaPolicyVersionId:profile.sla.versionId},[event],profile.sla,at);
  const previewHash=requestHash({draftId:d.id,draftRevision:d.revision,answers:values.answers,subject:input.subject,description:input.description,profile,coverage:cover,evidence,...(b?{beneficiary:{beneficiaryId:b.beneficiaryId,accountId:b.accountId,refsKey:externalResourceSelectionKey(b.refs),revision:b.revision}}:{})});
  return {d,profile,values,cover,evidence,priority,at,candidate,event,clocks,previewHash};
 }
 async function preview(person:Principal,raw:unknown,b:IntakeBeneficiary|null,signal?:AbortSignal,admission?:()=>void){try{
  const p=freezeFormData(copyFormData(person)) as Principal,input=parseInput(raw,false);
  return await inScope(p,input,async(tx,scope,expires)=>{await checkBeneficiary(tx,scope,expires,b);const v=await prepare(tx,p,input,scope,expires,b);return freezeFormData({valid:true,commitAuthorized:false,draftId:v.d.id,draftRevision:v.d.revision,previewHash:v.previewHash,subject:input.subject,priority:v.priority,clocks:v.clocks,attachmentCount:v.evidence.length});},signal,admission);
 }catch(e){throw safeIntakeError(e);}}
 async function create(person:Principal,raw:unknown,key:string,requestId:string,b:IntakeBeneficiary|null,signal?:AbortSignal,admission?:()=>void):Promise<SupportRequestReceipt>{try{
  const p=freezeFormData(copyFormData(person)) as Principal,input=parseInput(raw,true);keyOf(key);uuidIdentifier(requestId);const hash=requestHash({workspaceId:p.workspaceId,actorId:p.id,input,...(b?{beneficiaryId:b.beneficiaryId}:{})});
  return await inScope(p,input,async(tx,scope,expires)=>{
   await checkBeneficiary(tx,scope,expires,b);const requesterId=b?.beneficiaryId??p.id;
   const prior=await tx.readReceipt(key);
   if(prior!==null){const old=formRecord(prior,['key','hash','result']),r=old.result as SupportRequestReceipt;
    if(!old||old.key!==key)throw fail();if(old.hash!==hash)throw fail('intake_idempotency_conflict',409);
    if(!r||Object.keys(r).sort().join(',')!==['ticketId','protocol','sequence','workspaceId','accountId','actorId','requesterId','draftId','draftRevision','version','profileVersionId','formId','formVersion','priority','createdAt','notification','replayed'].sort().join(',')||r.actorId!==p.id||r.requesterId!==requesterId||r.workspaceId!==p.workspaceId||r.accountId!==scope.accountId||r.draftId!==input.draftId||r.draftRevision!==input.expectedDraftRevision||r.version!==1||r.notification!=='pending'||r.replayed!==false||typeof r.sequence!=='string'||!/^[1-9]\d{4,17}$/.test(r.sequence)||r.protocol!=='CG-'+r.sequence)throw fail();uuidIdentifier(r.ticketId);uuidIdentifier(r.formId);formRevision(r.formVersion);instantMicros(r.createdAt);if(!['low','normal','high','urgent'].includes(r.priority))throw fail();
    if(await tx.authorizeReceipt(r.ticketId,scope)!==true)throw fail('intake_scope_changed',403);return freezeFormData({...r,replayed:true});
   }
   const v=await prepare(tx,p,input,scope,expires,b);if(v.previewHash!==input.previewHash)throw fail('intake_preview_changed',409);
   const sequence=await tx.allocateProtocol();if(typeof sequence!=='string'||!/^[1-9]\d{4,17}$/.test(sequence)||BigInt(sequence)<10001n)throw fail();
   const id=randomUUID(),protocol='CG-'+sequence,eventId=randomUUID(),ticket=freezeFormData({...v.candidate,id}),event=freezeFormData({...v.event,ticketId:id});
   const result:SupportRequestReceipt=freezeFormData({ticketId:id,protocol,sequence,workspaceId:p.workspaceId,accountId:scope.accountId,actorId:p.id,requesterId,draftId:v.d.id,draftRevision:v.d.revision,version:1,profileVersionId:v.profile.profileVersionId,formId:v.d.formId,formVersion:v.d.formVersion,priority:v.priority,createdAt:v.at,notification:'pending',replayed:false});
   const bundle:IntakeBundle=freezeFormData({draftId:v.d.id,resourceScope:scope,ticket,requesterId,participants:b?[{principalId:requesterId,role:'requester'}]:[],protocol,sequence,form:{formId:v.d.formId,formVersion:v.d.formVersion,schemaHash:v.d.schemaHash,answers:v.values.answers,publicAnswers:v.values.publicAnswers,evidence:v.evidence},workflow:{profileVersionId:v.profile.profileVersionId,slaPolicyVersionId:v.profile.sla.versionId,calendarVersionId:v.profile.sla.calendar.versionId,approval:v.profile.approvalRequired?'pending':'not_required'},event,delegation:b?{type:'request.delegated',actorId:p.id,beneficiaryId:requesterId,beneficiaryRevision:b.revision,ticketId:id,at:v.at}:null,clocks:{...v.clocks,ticketId:id},audit:{id:eventId,actorId:p.id,requestId,at:v.at,action:'support.created',draftId:v.d.id,ticketId:id},outbox:{id:eventId,workspaceId:p.workspaceId,accountId:scope.accountId,ticketId:id,type:'support.created',version:1,requestId,createdAt:v.at}});
   await tx.commitRequest(bundle,v.d.revision,{key,hash,result});return result;
  },signal,admission);
 }catch(e){throw safeIntakeError(e);}}
 return Object.freeze({
  previewSupportRequest:(p:Principal,r:unknown,s?:AbortSignal,a?:()=>void)=>preview(p,r,null,s,a),
  createSupportRequest:(p:Principal,r:unknown,k:string,id:string,s?:AbortSignal,a?:()=>void)=>create(p,r,k,id,null,s,a),
  previewOnBehalfRequest:(p:Principal,r:unknown,proof:unknown,s?:AbortSignal,a?:()=>void)=>Promise.resolve().then(()=>preview(p,r,beneficiary(p,proof),s,a)),
  createOnBehalfRequest:(p:Principal,r:unknown,proof:unknown,k:string,id:string,s?:AbortSignal,a?:()=>void)=>Promise.resolve().then(()=>create(p,r,k,id,beneficiary(p,proof),s,a))
 });
}
