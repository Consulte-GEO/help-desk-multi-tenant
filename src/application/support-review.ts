import {randomBytes,randomUUID} from 'node:crypto';
import type {Principal} from '../domain/model.ts';
import type {SqlClient,SqlPool} from '../infrastructure/sql.ts';
import type {createResourceAccessResolver,ResourceScopeContext} from './resource-access.ts';
import type {SupportTicket,SupportWorkflowEvent} from '../domain/support-workflow.ts';
import type {IntakeProfile,SupportIntakeTransaction} from './support-intake.ts';
import type {DraftForm} from './form-draft.ts';
import {runResourceTicketTransaction} from '../infrastructure/resource-access-store.ts';
import {parseExternalResourceSelection,externalResourceSelectionKey,type ExternalResourceRef} from '../domain/external-resource.ts';
import {parseFormVersion} from '../domain/form-schema.ts';
import {copyFormData,freezeFormData,validateFormValues} from '../../shared/form-rules.js';
import {instantMicros,formatMicros} from '../domain/business-calendar.ts';
import {projectClocks,derivePriority} from '../domain/sla-clock.ts';
import {assertCleanAttachment,type AttachmentBinding} from '../domain/attachment.ts';
import {canReadTicket} from '../domain/policy.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {requestHash,secretHash} from '../domain/canonical.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {approvalTargetHash,decideScopedApproval,decideFormRevision,diffFormAnswers,parseApprovalInvitation,parseApprovalPolicy,parseApprovalInput,reviewRecord,reviewRevision,reviewDigest,reviewText,reviewFailure as fail,type ApprovalInvitation,type ApprovalTarget,type ApprovalPolicy} from '../domain/support-review.ts';
export type ReviewFormSnapshot=Readonly<{formId:string;formVersion:number;schemaHash:string;revision:number;answers:unknown;publicAnswers:unknown;evidence:readonly {path:string;id:string;hash:string}[];draftId:string;draftRevision:number}>;
export type ReviewAggregate=Readonly<{ticket:SupportTicket;requesterId:string;protocol:string;refs:readonly ExternalResourceRef[];form:ReviewFormSnapshot;profile:IntakeProfile;approvalPolicy:ApprovalPolicy;events:readonly SupportWorkflowEvent[]}>;
export type ReviewReceipt=Readonly<{ticketId:string;workspaceId:string;accountId:string;actorId:string;eventId:string;version:number;formRevision:number;action:'approval'|'revision';invitationId:string|null;decision:'approve'|'reject'|null;notification:'pending';replayed:boolean}>;
export type InvitationReceipt=Readonly<{ticketId:string;workspaceId:string;accountId:string;actorId:string;invitationId:string;ticketVersion:number;formRevision:number;notification:'pending';replayed:boolean}>;
export type ReviewReceiptEnvelope=Readonly<{key:string;hash:string;result:ReviewReceipt}>;
export interface ReviewTransaction extends Pick<SupportIntakeTransaction,'lockEvidence'|'lockLookup'>{
 /** These readers lock CURRENT RLS-visible ticket, pinned profile, immutable form,
  * invitation and exact actor/resource capability. Never echo request values. */
 readAggregate(ticketId:string):Promise<ReviewAggregate|null>;
 /** C11 optional producer methods. Qualified roster must be locked and current;
  * it is never selected from an email or a free principal ID in the browser. */
 lockApprovalRoute?(ticketId:string,scope:ResourceScopeContext):Promise<unknown>;
 findPendingInvitation?(ticketId:string):Promise<ApprovalInvitation|null>;
 readInvitationReceipt?(key:string):Promise<unknown>;
 commitInvitation?(bundle:{invitation:ApprovalInvitation;audit:Readonly<Record<string,unknown>>;outbox:Readonly<Record<string,unknown>>},receipt:{key:string;hash:string;result:InvitationReceipt}):Promise<void>;
 readInvitation(id:string):Promise<ApprovalInvitation|null>;
 lockReviewGrant(capability:'approvals.request'|'approvals.decide'|'forms.revise',ticketId:string,scope:ResourceScopeContext):Promise<unknown>;
 readReceipt(key:string):Promise<unknown>;
 readDraft(id:string):Promise<DraftForm|null>;
 /** Lock invitation and compare prior generation; persist HASH ONLY. */
 replaceChallenge(invitation:ApprovalInvitation,expectedGeneration:number):Promise<void>;
 /** Same borrowed client, no nested pool/COMMIT. Ticket CAS + consume challenge +
  * decision + complete event stream/clocks + audit + minimal outbox + receipt. */
 commitApproval(bundle:ApprovalBundle,receipt:ReviewReceiptEnvelope):Promise<void>;
 /** Append form response (never UPDATE old responses), consume draft by CAS,
  * invalidate old invitations, and persist all accompanying effects atomically. */
 commitRevision(bundle:RevisionBundle,receipt:ReviewReceiptEnvelope):Promise<void>;
}
export type ApprovalBundle=Readonly<{expectedVersion:number;invitationId:string;decision:ReturnType<typeof decideScopedApproval>;clocks:ReturnType<typeof projectClocks>;audit:Readonly<Record<string,unknown>>;outbox:Readonly<Record<string,unknown>>}>;
export type RevisionBundle=Readonly<{expectedVersion:number;expectedFormRevision:number;draftId:string;expectedDraftRevision:number;decision:ReturnType<typeof decideFormRevision>;form:ReviewFormSnapshot;clocks:ReturnType<typeof projectClocks>;audit:Readonly<Record<string,unknown>>;outbox:Readonly<Record<string,unknown>>}>;
export interface ReviewDirectory {locateTicket(p:Principal,id:string,signal?:AbortSignal):Promise<{accountId:string;refs:readonly ExternalResourceRef[]}|null>}
export function reviewAuthorityKey(s:ResourceScopeContext){return requestHash({principalId:s.principalId,workspaceId:s.workspaceId,accountId:s.accountId,bindingId:s.bindingId,bindingRevision:s.bindingRevision,accessRevision:s.accessRevision,manifestFingerprint:s.manifestFingerprint,refs:externalResourceSelectionKey(s.refs)});}
const keyOf=(v:string)=>{if(typeof v!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(v))throw fail('invalid_review_input',400);return v;};
const errors:Record<string,number>={release_gate_closed:503,invalid_review_input:400,approval_forbidden:403,approval_already_pending:409,approval_revision_changed:412,approval_unavailable:409,approval_self_forbidden:403,review_state_conflict:409,review_no_changes:409,review_time_conflict:409,review_capability_required:403,review_step_up_required:403,review_not_found:404,review_idempotency_conflict:409,review_draft_invalid:409,review_preview_changed:409,invalid_form_values:422,attachment_not_clean_or_changed:409,resource_scope_denied:403,resource_scope_unavailable:503,resource_scope_database_mismatch:403,resource_scope_database_unavailable:503,transaction_outcome_unknown:503,transaction_identity_changed:403,transaction_work_incomplete:503,transaction_statement_failed:503,calendar_horizon_exceeded:503};
export function safeReviewError(e:unknown){try{if(e instanceof HelpdeskError){const c=Object.getOwnPropertyDescriptor(e,'code')?.value;if(typeof c==='string'&&Object.hasOwn(errors,c))return fail(c,errors[c]);}}catch{}return fail();}
function formHash(f:ReviewFormSnapshot){return requestHash({formId:f.formId,formVersion:f.formVersion,schemaHash:f.schemaHash,answers:f.answers,evidence:f.evidence});}
function target(a:ReviewAggregate):ApprovalTarget{return {ticket:a.ticket,requesterId:a.requesterId,formRevision:a.form.revision,formHash:formHash(a.form),refsHash:requestHash(externalResourceSelectionKey(a.refs))};}
function aggregate(raw:ReviewAggregate|null,p:Principal,ticketId:string,scope:ResourceScopeContext):ReviewAggregate{
 if(!raw)throw fail('review_not_found',404);
 const a=copyFormData(raw) as ReviewAggregate,t=a.ticket,f=a.form,s=parseFormVersion(a.profile.form);
 if(t.id!==ticketId||t.workspaceId!==p.workspaceId||t.accountId!==scope.accountId||!canReadTicket(p,t)||externalResourceSelectionKey(a.refs)!==externalResourceSelectionKey(scope.refs)||f.formId!==s.id||f.formVersion!==s.version||s.status!=='published'||f.schemaHash!==requestHash(s)||a.profile.status!=='published'||a.profile.profileVersionId!==t.profileVersionId||a.profile.sla.profileVersionId!==t.profileVersionId||typeof a.profile.approvalRequired!=='boolean')throw fail();
 uuidIdentifier(a.requesterId);reviewRevision(f.revision);reviewRevision(t.version);parseApprovalPolicy(a.approvalPolicy);approvalTargetHash(target(a));return freezeFormData(a);
}
type Expiry=(until:string,code:string,status?:number)=>void;
type RevisionInput={ticketId:string;expectedVersion:number;expectedFormRevision:number;draftId:string;expectedDraftRevision:number;comment:string;previewHash?:string};
function revisionInput(raw:unknown,commit:boolean):RevisionInput{const r=reviewRecord(raw,['ticketId','expectedVersion','expectedFormRevision','draftId','expectedDraftRevision','comment',...(commit?['previewHash']:[])]);return freezeFormData({ticketId:uuidIdentifier(r.ticketId),expectedVersion:reviewRevision(r.expectedVersion),expectedFormRevision:reviewRevision(r.expectedFormRevision),draftId:uuidIdentifier(r.draftId),expectedDraftRevision:reviewRevision(r.expectedDraftRevision),comment:reviewText(r.comment,12000,true),...(commit?{previewHash:reviewDigest(r.previewHash)}:{})});}
/** Optional C11 composition; requires qualified directory, RLS-backed store and
 * current capability grants. No default role promotion, issuer, recipient or owner.
 * Email landing is informational; challenge and decision are explicit POSTs. */
export function createSupportReview(o:{pool:SqlPool;resolver:ReturnType<typeof createResourceAccessResolver>;directory:ReviewDirectory;createStore:(c:SqlClient,p:Principal)=>ReviewTransaction;clock?:()=>string;admit?:()=>void;assertStepUp?:(p:Principal,proof:unknown)=>void}){
 const clock=o.clock??(()=>new Date().toISOString());
 async function run<T>(p:Principal,ticketId:string,cap:'approvals.request'|'approvals.decide'|'forms.revise',proof:unknown,signal:AbortSignal|undefined,work:(tx:ReviewTransaction,a:ReviewAggregate,s:ResourceScopeContext,expires:Expiry)=>Promise<T>):Promise<T>{
  const original=requestHash(copyFormData(p));const limits:{at:bigint;code:string;status:number}[]=[];let sensitive=false;
  const check=()=>{o.admit?.();if(requestHash(copyFormData(p))!==original)throw fail('approval_forbidden',403);for(const l of limits)if(instantMicros(clock())>=l.at)throw fail(l.code,l.status);if(sensitive){if(!o.assertStepUp)throw fail('review_step_up_required',403);try{o.assertStepUp(p,proof);}catch{throw fail('review_step_up_required',403);}}};
  const expires:Expiry=(until,code,status=409)=>{limits.push({at:instantMicros(until),code,status});check();};
  check();const located=await o.directory.locateTicket(p,ticketId,signal);check();if(!located)throw fail('review_not_found',404);const refs=parseExternalResourceSelection(located.refs);
  const lease=await o.resolver.resolveResourceScope(p,refs,'tickets.write',signal);check();
  return runResourceTicketTransaction(o.pool,o.resolver,p,ticketId,refs,'tickets.write',lease,async(c,s)=>{
   if(s.accountId!==located.accountId)throw fail('approval_forbidden',403);const tx=o.createStore(c,p),a=aggregate(await tx.readAggregate(ticketId),p,ticketId,s);
   const raw=await tx.lockReviewGrant(cap,ticketId,s);if(!raw)throw fail('review_capability_required',403);
   const g=reviewRecord(raw,['principalId','workspaceId','accountId','capability','scopeHash','active','revision','expiresAt']);
   if(g.principalId!==p.id||g.workspaceId!==p.workspaceId||g.accountId!==s.accountId||g.capability!==cap||g.scopeHash!==reviewAuthorityKey(s)||g.active!==true||typeof g.revision!=='string'||!g.revision)throw fail('review_capability_required',403);
   expires(g.expiresAt as string,'review_capability_required',403);sensitive=cap!=='forms.revise'&&a.approvalPolicy.sensitive;check();return work(tx,a,s,expires);
  },signal,check);
 }
 async function receipt(tx:ReviewTransaction,p:Principal,a:ReviewAggregate,key:string,hash:string,action:'approval'|'revision',version:number,formRevision:number,invitationId:string|null):Promise<ReviewReceipt|null>{
  const raw=await tx.readReceipt(key);if(raw===null)return null;const row=reviewRecord(raw,['key','hash','result']);if(row.key!==key)throw fail();if(row.hash!==hash)throw fail('review_idempotency_conflict',409);
  const r=reviewRecord(row.result,['ticketId','workspaceId','accountId','actorId','eventId','version','formRevision','action','invitationId','decision','notification','replayed']) as unknown as ReviewReceipt;
  if(r.ticketId!==a.ticket.id||r.workspaceId!==p.workspaceId||r.accountId!==a.ticket.accountId||r.actorId!==p.id||r.version!==version+1||r.version>a.ticket.version||r.formRevision!==formRevision+(action==='revision'?1:0)||r.action!==action||r.invitationId!==invitationId||r.notification!=='pending'||r.replayed!==false||action==='revision'&&r.decision!==null||action==='approval'&&!['approve','reject'].includes(r.decision??''))throw fail();uuidIdentifier(r.eventId);return freezeFormData({...r,replayed:true});
 }
 function effects(p:Principal,a:ReviewAggregate,after:SupportTicket,event:SupportWorkflowEvent,requestId:string,action:string,detail:Record<string,unknown>){
  const id=randomUUID();return {id,clocks:projectClocks({id:after.id,workspaceId:after.workspaceId,profileVersionId:after.profileVersionId,slaPolicyVersionId:a.profile.sla.versionId,version:after.version,status:after.status},[...a.events,event],a.profile.sla,event.at),audit:freezeFormData({id,actorId:p.id,workspaceId:p.workspaceId,ticketId:after.id,requestId,at:event.at,action,...detail}),outbox:freezeFormData({id,workspaceId:p.workspaceId,accountId:after.accountId,ticketId:after.id,type:'support.'+event.type,version:after.version,requestId,createdAt:event.at})};
 }
 async function requestApproval(p:Principal,ticket:string,expected:number,key:string,requestId:string,stepUp?:unknown,signal?:AbortSignal):Promise<InvitationReceipt>{try{
  const ticketId=uuidIdentifier(ticket);reviewRevision(expected);keyOf(key);uuidIdentifier(requestId);const hash=requestHash({ticketId,expected,actorId:p.id,workspaceId:p.workspaceId});
  return await run(p,ticketId,'approvals.request',stepUp,signal,async(tx,a,s,expires)=>{
   if(!tx.lockApprovalRoute||!tx.findPendingInvitation||!tx.readInvitationReceipt||!tx.commitInvitation)throw fail();
   const prior=await tx.readInvitationReceipt(key);
   if(prior!==null){const row=reviewRecord(prior,['key','hash','result']);if(row.key!==key||row.hash!==hash)throw fail('review_idempotency_conflict',409);
    const r=reviewRecord(row.result,['ticketId','workspaceId','accountId','actorId','invitationId','ticketVersion','formRevision','notification','replayed']) as unknown as InvitationReceipt;
    if(r.ticketId!==ticketId||r.workspaceId!==p.workspaceId||r.accountId!==a.ticket.accountId||r.actorId!==p.id||r.ticketVersion!==expected||r.ticketVersion>a.ticket.version||r.formRevision>a.form.revision||r.notification!=='pending'||r.replayed!==false)throw fail();uuidIdentifier(r.invitationId);reviewRevision(r.formRevision);return freezeFormData({...r,replayed:true});
   }
   if(a.ticket.version!==expected)throw fail('approval_revision_changed',412);
   if(a.ticket.approval!=='pending'||!['new','triage'].includes(a.ticket.status)||a.profile.approvalRequired!==true)throw fail('approval_unavailable',409);
   // This first policy supports a single active invitation per request revision.
   // Multi-approver/quorum policies require a separate published model, not guessing.
   const route=reviewRecord(await tx.lockApprovalRoute(ticketId,s),['principalId','principalKind','workspaceId','accountId','ticketId','policyVersionId','resourceHash','revision','active','expiresAt']);
   const approverId=uuidIdentifier(route.principalId);
   if(route.principalKind!=='human'||route.workspaceId!==p.workspaceId||route.accountId!==a.ticket.accountId||route.ticketId!==ticketId||route.policyVersionId!==a.approvalPolicy.versionId||route.resourceHash!==requestHash(externalResourceSelectionKey(s.refs))||route.active!==true||typeof route.revision!=='string'||!route.revision)throw fail('approval_forbidden',403);
   if(!a.approvalPolicy.selfApprovalAllowed&&(approverId===a.requesterId||approverId===a.ticket.createdBy))throw fail('approval_self_forbidden',403);
   expires(route.expiresAt as string,'approval_unavailable');const at=clock(),invitationId=randomUUID(),id=randomUUID();
   const pending=await tx.findPendingInvitation(ticketId);
   if(pending!==null){const old=parseApprovalInvitation(pending);
    if(old.status!=='pending'||old.ticketId!==ticketId||old.workspaceId!==p.workspaceId||old.accountId!==a.ticket.accountId)throw fail();
    if(instantMicros(old.expiresAt)>instantMicros(at)&&old.ticketVersion===expected&&old.formRevision===a.form.revision&&old.targetHash===approvalTargetHash(target(a))&&old.approverId===approverId&&old.policyVersionId===a.approvalPolicy.versionId)throw fail('approval_already_pending',409);
   }
   const invitation:ApprovalInvitation=freezeFormData({id:invitationId,ticketId,workspaceId:p.workspaceId,accountId:a.ticket.accountId,approverId,policyVersionId:a.approvalPolicy.versionId,ticketVersion:expected,formRevision:a.form.revision,targetHash:approvalTargetHash(target(a)),status:'pending',createdAt:at,expiresAt:route.expiresAt as string,challenge:null});
   parseApprovalInvitation(invitation);
   const result:InvitationReceipt=freezeFormData({ticketId,workspaceId:p.workspaceId,accountId:a.ticket.accountId,actorId:p.id,invitationId,ticketVersion:expected,formRevision:a.form.revision,notification:'pending',replayed:false});
   await tx.commitInvitation({invitation,audit:freezeFormData({id,actorId:p.id,ticketId,invitationId,requestId,type:'approval.requested',rosterRevision:route.revision,at}),outbox:freezeFormData({id,workspaceId:p.workspaceId,accountId:a.ticket.accountId,ticketId,type:'support.approval_requested',invitationId,version:expected,requestId,createdAt:at})},{key,hash,result});return result;
  });
 }catch(e){throw safeReviewError(e);}}
 async function prepareApproval(p:Principal,ticket:string,invitation:string,expected:number,requestId:string,stepUp?:unknown,signal?:AbortSignal){try{
  const ticketId=uuidIdentifier(ticket),invitationId=uuidIdentifier(invitation);reviewRevision(expected);uuidIdentifier(requestId);
  return await run(p,ticketId,'approvals.decide',stepUp,signal,async(tx,a,_s,expires)=>{
   const i=parseApprovalInvitation(await tx.readInvitation(invitationId));if(i.id!==invitationId||i.approverId!==p.id||i.ticketId!==ticketId||i.accountId!==a.ticket.accountId||i.workspaceId!==p.workspaceId)throw fail('approval_forbidden',403);
   if(expected!==a.ticket.version||i.targetHash!==approvalTargetHash(target(a)))throw fail('approval_revision_changed',412);
   if(i.status!=='pending'||a.ticket.approval!=='pending'||!['new','triage'].includes(a.ticket.status)||i.policyVersionId!==a.approvalPolicy.versionId)throw fail('approval_unavailable',409);
   if(!a.approvalPolicy.selfApprovalAllowed&&(p.id===a.ticket.createdBy||p.id===a.requesterId))throw fail('approval_self_forbidden',403);
   const now=instantMicros(clock());if(instantMicros(i.createdAt)>now)throw fail('approval_unavailable',409);expires(i.expiresAt,'approval_unavailable');
   const limit=now+BigInt(a.approvalPolicy.challengeTtlSeconds)*1000000n,until=formatMicros(limit<instantMicros(i.expiresAt)?limit:instantMicros(i.expiresAt));
   expires(until,'approval_unavailable');const generation=(i.challenge?.generation??0)+1;reviewRevision(generation);const token='hd_approval_'+randomBytes(32).toString('base64url');
   await tx.replaceChallenge(freezeFormData({...i,challenge:{hash:secretHash(token),generation,expiresAt:until}}),generation-1);
   return freezeFormData({invitationId,ticketId,ticketVersion:a.ticket.version,formRevision:a.form.revision,token,expiresAt:until,generation,decisionApplied:false});
  });
 }catch(e){throw safeReviewError(e);}}
 async function decideApproval(p:Principal,raw:unknown,key:string,requestId:string,stepUp?:unknown,signal?:AbortSignal):Promise<ReviewReceipt>{try{
  const c=parseApprovalInput(raw);keyOf(key);uuidIdentifier(requestId);const hash=requestHash({actorId:p.id,workspaceId:p.workspaceId,command:{...c,token:secretHash(c.token)}});
  return await run(p,c.ticketId,'approvals.decide',stepUp,signal,async(tx,a,_s,expires)=>{
   const i=parseApprovalInvitation(await tx.readInvitation(c.invitationId));if(i.id!==c.invitationId||i.approverId!==p.id||i.workspaceId!==p.workspaceId||i.accountId!==a.ticket.accountId||i.ticketId!==c.ticketId)throw fail('approval_forbidden',403);
   const prior=await receipt(tx,p,a,key,hash,'approval',c.expectedVersion,c.expectedFormRevision,i.id);if(prior)return prior;
   const decision=decideScopedApproval(p,target(a),a.approvalPolicy,i,c,clock());expires(i.expiresAt,'approval_unavailable');expires(i.challenge!.expiresAt,'approval_unavailable');
   const e=effects(p,a,decision.after,decision.event,requestId,'approval.'+c.decision,{invitationId:i.id,formRevision:a.form.revision,reason:c.reason,capability:'approvals.decide',originPermissionGranted:false});
   const result:ReviewReceipt=freezeFormData({ticketId:c.ticketId,workspaceId:p.workspaceId,accountId:a.ticket.accountId,actorId:p.id,eventId:e.id,version:decision.after.version,formRevision:a.form.revision,action:'approval',invitationId:i.id,decision:c.decision,notification:'pending',replayed:false});
   await tx.commitApproval({expectedVersion:c.expectedVersion,invitationId:i.id,decision,clocks:e.clocks,audit:e.audit,outbox:e.outbox},{key,hash,result});return result;
  });
 }catch(e){throw safeReviewError(e);}}
 async function prepareRevision(tx:ReviewTransaction,p:Principal,a:ReviewAggregate,s:ResourceScopeContext,c:RevisionInput,expires:Expiry){
  if(a.ticket.version!==c.expectedVersion||a.form.revision!==c.expectedFormRevision)throw fail('approval_revision_changed',412);
  if(a.ticket.status!=='waiting_customer')throw fail('review_state_conflict',409);
  const d=copyFormData(await tx.readDraft(c.draftId)) as DraftForm|null;
  if(!d||d.id!==c.draftId||d.ownerId!==p.id||d.workspaceId!==p.workspaceId||d.accountId!==s.accountId||d.status!=='editing'||d.revision!==c.expectedDraftRevision||d.formId!==a.form.formId||d.formVersion!==a.form.formVersion||d.schemaHash!==a.form.schemaHash||externalResourceSelectionKey(d.refs)!==externalResourceSelectionKey(s.refs))throw fail('review_draft_invalid',409);
  expires(d.expiresAt,'review_draft_invalid');const values=validateFormValues(a.profile.form,d.answers,{audience:'customer'});if(!values.valid)throw fail('invalid_form_values',422);
  const evidence:{path:string;id:string;hash:string}[]=[];let total=0;
  for(const r of values.requirements)for(const id of r.values){if(++total>100)throw fail('invalid_review_input',400);const q={kind:r.kind,path:r.path,registryKey:r.key,value:id,workspaceId:p.workspaceId,accountId:s.accountId,principalId:p.id,bindingId:s.bindingId,accessRevision:s.accessRevision,formId:d.formId,formVersion:d.formVersion,draftId:d.id,draftRevision:d.revision};
   if(r.kind==='file'){const binding:AttachmentBinding={workspaceId:p.workspaceId,accountId:s.accountId,ownerId:p.id,draftId:d.id,draftRevision:d.revision,formId:d.formId,formVersion:d.formVersion,fieldPath:r.path,registryKey:r.key,visibility:'customer',refs:s.refs};const item=await tx.lockEvidence(q,s),valid=assertCleanAttachment(item.record,binding,item.object,clock());if(valid.id!==id)throw fail('attachment_not_clean_or_changed',409);expires(valid.expiresAt,'attachment_not_clean_or_changed');evidence.push({path:r.path,id,hash:requestHash({sha256:valid.sha256,object:valid.object,version:valid.version,binding:valid.binding})});}
   else{const x=await tx.lockLookup(q,s);if(x.status!=='verified'||x.queryHash!==requestHash(q))throw fail();expires(x.expiresAt,'review_draft_invalid');evidence.push({path:r.path,id,hash:x.queryHash});}
  }
  const rawDecision=decideFormRevision(p,target(a),{versionId:a.approvalPolicy.versionId,requiresApproval:a.profile.approvalRequired},{expectedVersion:c.expectedVersion,expectedFormRevision:c.expectedFormRevision,answers:values.answers,comment:c.comment},a.form.answers,clock());
  const fixed=a.profile.fixedPriority;if(fixed!==undefined&&!['low','normal','high','urgent'].includes(fixed))throw fail();
  const decision=freezeFormData({...rawDecision,after:{...rawDecision.after,priority:fixed??derivePriority(values.answers[a.profile.impactField],a.profile.priorityPolicy)}});
  const form:ReviewFormSnapshot=freezeFormData({formId:d.formId,formVersion:d.formVersion,schemaHash:d.schemaHash,revision:a.form.revision+1,answers:values.answers,publicAnswers:values.publicAnswers,evidence,draftId:d.id,draftRevision:d.revision});
  const publicDiff=diffFormAnswers(a.form.publicAnswers,values.publicAnswers),previewHash=requestHash({ticketId:c.ticketId,expectedVersion:c.expectedVersion,expectedFormRevision:c.expectedFormRevision,draftId:d.id,draftRevision:d.revision,form,profile:a.profile,approvalPolicy:a.approvalPolicy,comment:c.comment,refs:externalResourceSelectionKey(s.refs)});
  return {decision,form,publicDiff,previewHash};
 }
 async function previewSupportRevision(p:Principal,raw:unknown,signal?:AbortSignal){try{const c=revisionInput(raw,false);return await run(p,c.ticketId,'forms.revise',undefined,signal,async(tx,a,s,expires)=>{const v=await prepareRevision(tx,p,a,s,c,expires);return freezeFormData({ticketId:c.ticketId,version:a.ticket.version,formRevision:a.form.revision,previewHash:v.previewHash,publicDiff:v.publicDiff,commitAuthorized:false});});}catch(e){throw safeReviewError(e);}}
 async function reviseSupportForm(p:Principal,raw:unknown,key:string,requestId:string,signal?:AbortSignal):Promise<ReviewReceipt>{try{const c=revisionInput(raw,true);keyOf(key);uuidIdentifier(requestId);const hash=requestHash({actorId:p.id,workspaceId:p.workspaceId,command:c});return await run(p,c.ticketId,'forms.revise',undefined,signal,async(tx,a,s,expires)=>{
  const prior=await receipt(tx,p,a,key,hash,'revision',c.expectedVersion,c.expectedFormRevision,null);if(prior)return prior;
  const v=await prepareRevision(tx,p,a,s,c,expires);if(v.previewHash!==c.previewHash)throw fail('review_preview_changed',409);
  const e=effects(p,a,v.decision.after,v.decision.event,requestId,'form.revised',{fromRevision:a.form.revision,toRevision:v.form.revision,diff:v.decision.diff,comment:c.comment});
  const result:ReviewReceipt=freezeFormData({ticketId:c.ticketId,workspaceId:p.workspaceId,accountId:a.ticket.accountId,actorId:p.id,eventId:e.id,version:v.decision.after.version,formRevision:v.form.revision,action:'revision',invitationId:null,decision:null,notification:'pending',replayed:false});
  await tx.commitRevision({expectedVersion:c.expectedVersion,expectedFormRevision:c.expectedFormRevision,draftId:c.draftId,expectedDraftRevision:c.expectedDraftRevision,decision:v.decision,form:v.form,clocks:e.clocks,audit:e.audit,outbox:e.outbox},{key,hash,result});return result;
 });}catch(e){throw safeReviewError(e);}}
 return Object.freeze({requestApproval,prepareApproval,decideApproval,previewSupportRevision,reviseSupportForm});
}
