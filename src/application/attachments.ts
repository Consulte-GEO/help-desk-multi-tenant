import {randomUUID} from 'node:crypto';
import type {Principal} from '../domain/model.ts';
import type {SqlPool,SqlClient} from '../infrastructure/sql.ts';
import type {createResourceAccessResolver,ResourceScopeContext} from './resource-access.ts';
import {runResourceTransaction} from '../infrastructure/resource-transaction.ts';
import {runResourceTicketTransaction} from '../infrastructure/resource-access-store.ts';
import {isOperator} from '../domain/policy.ts';
import {requestHash} from '../domain/canonical.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {instantMicros,formatMicros} from '../domain/business-calendar.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {attachmentFailure as fail,attachmentRecord,attachmentRevision,parseAttachmentBinding,attachmentBindingKey,parseAttachmentMetadata,parseAttachmentPolicy,attachmentObjectKey,parseSealedObject,assertCleanAttachment,type AttachmentBinding,type AttachmentRecord,type AttachmentPolicy} from '../domain/attachment.ts';
import {fileProviderCall,type PrivateAttachmentStorage} from '../integrations/files/storage.ts';
export type AttachmentLocation=Readonly<{binding:AttachmentBinding;ticketId:string|null}>;
export interface AttachmentDirectory{
 /** Private metadata only, under current actor ACL; never accept these records from HTTP. */
 locateDraft(p:Principal,draftId:string,fieldPath:string,signal?:AbortSignal):Promise<AttachmentLocation>;
 locateAttachment(p:Principal,uploadId:string,signal?:AbortSignal):Promise<AttachmentLocation>;
}
export interface AttachmentTransaction{
 /** Lock draft/ticket and resource authorization in THIS client. TTL, revision,
  * field registry/visibility and owner are authoritative, not caller echoes. */
 lockBinding(binding:AttachmentBinding,scope:ResourceScopeContext):Promise<{bindingKey:string;active:boolean;expiresAt:string}>;
 readPolicy(registryKey:string):Promise<AttachmentPolicy>;
 readUpload(id:string):Promise<AttachmentRecord|null>;
 readIntent(key:string):Promise<{hash:string;uploadId:string}|null>;
 /** Atomic per-workspace/person/draft quota reservation + intent + audit. */
 reserve(record:AttachmentRecord,key:string,hash:string):Promise<void>;
 /** CAS upload version + immutable object pointer + ONE scan-job outbox record. */
 queueScan(record:AttachmentRecord,expectedVersion:number):Promise<void>;
 /** Only before sealing/scanning. Verify this upload ID is present in the exact
  * field of the current locked draft, then CAS intent binding+audit. A clean/pending
  * receipt cannot be rebound to a new revision. No published binding is rewritten. */
 bindUploadToDraft(record:AttachmentRecord,expectedVersion:number):Promise<void>;
 auditDownload(uploadId:string,objectVersion:string,at:string):Promise<void>;
}
const safeCodes:Record<string,number>={invalid_attachment_input:400,invalid_attachment_metadata:400,attachment_idempotency_conflict:409,attachment_object_changed:409,attachment_not_clean_or_changed:409,attachment_binding_changed:409,attachment_not_found:404,attachment_forbidden:403,attachment_policy_unavailable:503,attachments_not_configured:503,resource_scope_denied:403,resource_scope_unavailable:503,resource_scope_database_mismatch:403,resource_scope_database_unavailable:503,transaction_outcome_unknown:503};
function safe(e:unknown){try{if(e instanceof HelpdeskError){const code=Object.getOwnPropertyDescriptor(e,'code')?.value;if(typeof code==='string'&&Object.hasOwn(safeCodes,code))return fail(code,safeCodes[code]);}}catch{}return fail();}
const intention=(key:string)=>{if(typeof key!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw fail('invalid_attachment_input',400);return key;};
/** Optional composition. NO Storage/scanner/default store is fabricated. Constructor
 * ports are trusted server code; absence of a qualified pipeline keeps it disabled.
 * All binary bytes bypass the Function and go to private Storage directly. */
export function createAttachmentService(o:{pool:SqlPool;resolver:ReturnType<typeof createResourceAccessResolver>;directory:AttachmentDirectory;storage:PrivateAttachmentStorage;createStore:(client:SqlClient,p:Principal)=>AttachmentTransaction;enabled:()=>boolean;scanPolicyId:()=>string|null;clock?:()=>string;providerTimeoutMs?:number}){
 const clock=o.clock??(()=>new Date().toISOString()),timeout=o.providerTimeoutMs??5000;
 const configured=()=>{if(o.enabled()!==true||!o.scanPolicyId())throw fail('attachments_not_configured');};
 async function scoped<T>(p:Principal,rawLocation:AttachmentLocation,write:boolean,work:(store:AttachmentTransaction,b:AttachmentBinding,at:string,expires:(at:string)=>void)=>Promise<T>,signal?:AbortSignal):Promise<T>{
  configured();const location=copyFormData(rawLocation) as AttachmentLocation,b=parseAttachmentBinding(location.binding);
  if(b.workspaceId!==p.workspaceId||(!location.ticketId&&b.ownerId!==p.id))throw fail('attachment_forbidden',403);
  if(b.visibility==='internal'&&(!isOperator(p,p.workspaceId,b.accountId)||!p.scopes.includes(write?'notes:write':'notes:read')))throw fail('attachment_forbidden',403);
  const limits:bigint[]=[];const check=()=>{const now=instantMicros(clock());if(limits.some(at=>at<=now))throw fail('attachment_binding_changed',409);};const expires=(at:string)=>{limits.push(instantMicros(at));check();};
  const op=b.visibility==='internal'?(write?'notes.write':'notes.read'):(write?'tickets.write':'tickets.read');const proof=await o.resolver.resolveResourceScope(p,b.refs,op,signal);
  const run=async(client:SqlClient,scope:ResourceScopeContext)=>{const tx=o.createStore(client,p),locked=attachmentRecord(await tx.lockBinding(b,scope),['bindingKey','active','expiresAt']);const at=clock();
   if(scope.accountId!==b.accountId||!locked||locked.bindingKey!==attachmentBindingKey(b)||locked.active!==true||instantMicros(locked.expiresAt as string)<=instantMicros(at))throw fail('attachment_binding_changed',409);
   expires(locked.expiresAt as string);return work(tx,b,at,expires);
  };
  return location.ticketId?runResourceTicketTransaction(o.pool,o.resolver,p,uuidIdentifier(location.ticketId),b.refs,op,proof,run,signal,check):runResourceTransaction(o.pool,o.resolver,p,b.refs,op,proof,run,signal,check);
 }
 function checkedRow(raw:AttachmentRecord|null,b:AttachmentBinding,id:string,at:string,expires?:(at:string)=>void){if(!raw)throw fail('attachment_not_found',404);const r=copyFormData(raw) as AttachmentRecord;
  if(r.id!==id||attachmentBindingKey(r.binding)!==attachmentBindingKey(b)||r.objectKey!==attachmentObjectKey(b.workspaceId,id)||instantMicros(r.expiresAt)<=instantMicros(at)||r.scanPolicyId!==o.scanPolicyId())throw fail('attachment_binding_changed',409);attachmentRevision(r.version);expires?.(r.expiresAt);return r;
 }
 async function startAttachment(person:Principal,raw:unknown,key:string,signal?:AbortSignal){try{
  configured();const p=freezeFormData(copyFormData(person)) as Principal,input=attachmentRecord(raw,['draftId','draftRevision','fieldPath','metadata']);intention(key);
  const draftId=uuidIdentifier(input.draftId),revision=attachmentRevision(input.draftRevision);if(typeof input.fieldPath!=='string')throw fail('invalid_attachment_input',400);
  const location=await o.directory.locateDraft(p,draftId,input.fieldPath,signal);
  const record=await scoped(p,location,true,async(tx,b,at,expires)=>{
   if(b.draftId!==draftId||b.draftRevision!==revision||b.fieldPath!==input.fieldPath)throw fail('attachment_binding_changed',409);
   const policy=parseAttachmentPolicy(await tx.readPolicy(b.registryKey));if(policy.scanPolicyId!==o.scanPolicyId())throw fail('attachment_policy_unavailable');
   const metadata=parseAttachmentMetadata(input.metadata,policy),hash=requestHash({bindingKey:attachmentBindingKey(b),metadata});const old=await tx.readIntent(key);
   if(old){if(old.hash!==hash)throw fail('attachment_idempotency_conflict',409);return checkedRow(await tx.readUpload(old.uploadId),b,old.uploadId,at,expires);}
   const id=randomUUID(),r:AttachmentRecord=freezeFormData({id,version:1,binding:b,metadata,policy,objectKey:attachmentObjectKey(p.workspaceId,id),object:null,status:'uploading',sha256:null,createdAt:at,expiresAt:formatMicros(instantMicros(at)+BigInt(policy.uploadTtlSeconds)*1000000n),scanPolicyId:policy.scanPolicyId});
   expires(r.expiresAt);await tx.reserve(r,key,hash);return r;
  },signal);
  if(record.status!=='uploading')return Object.freeze({uploadId:record.id,status:record.status,upload:null});
  const rawGrant=await fileProviderCall(s=>o.storage.issueUpload(record.objectKey,record.metadata.bytes,record.metadata.mime,s),timeout,signal);
  const grant=attachmentRecord(rawGrant,['protocol','endpoint','token','objectKey','expiresAt']);const url=new URL(String(grant.endpoint));
  if(grant.protocol!=='tus'||url.origin!==record.policy.uploadOrigin||url.username||url.password||url.hash||url.search||grant.objectKey!==record.objectKey||typeof grant.token!=='string'||grant.token.length<16||grant.token.length>4096||/[\r\n]/.test(grant.token)||instantMicros(grant.expiresAt)>instantMicros(record.expiresAt))throw fail();
  await scoped(p,location,true,async(tx,b,at,expires)=>{const r=checkedRow(await tx.readUpload(record.id),b,record.id,at,expires);if(r.status!=='uploading'||r.version!==record.version||instantMicros(grant.expiresAt)<=instantMicros(at))throw fail('attachment_binding_changed',409);},signal);
  return freezeFormData({uploadId:record.id,status:record.status,upload:grant});
 }catch(e){throw safe(e);}}
 async function finishAttachment(person:Principal,rawId:string,key:string,signal?:AbortSignal){try{
  configured();const p=freezeFormData(copyFormData(person)) as Principal,id=uuidIdentifier(rawId);intention(key);const location=await o.directory.locateAttachment(p,id,signal);
  const r=await scoped(p,location,true,async(tx,b,at,expires)=>checkedRow(await tx.readUpload(id),b,id,at,expires),signal);
  if(r.status!=='uploading')return Object.freeze({uploadId:id,status:r.status});
  const object=parseSealedObject(await fileProviderCall(s=>o.storage.seal(r.objectKey,s),timeout,signal),r.objectKey);
  if(object.bytes!==r.metadata.bytes)throw fail('attachment_object_changed',409);
  return await scoped(p,location,true,async(tx,b,at,expires)=>{const current=checkedRow(await tx.readUpload(id),b,id,at,expires);
   if(current.status!=='uploading')return Object.freeze({uploadId:id,status:current.status});if(current.version!==r.version)throw fail('attachment_binding_changed',409);
   const next:AttachmentRecord=freezeFormData({...current,version:current.version+1,object,status:'pending_scan',expiresAt:formatMicros(instantMicros(at)+BigInt(current.policy.receiptTtlSeconds)*1000000n)});await tx.queueScan(next,current.version);return Object.freeze({uploadId:id,status:next.status});},signal);
 }catch(e){throw safe(e);}}
 /** Bind a still-unsealed intent after its ID was saved in the draft. The file
  * upload may already be in progress, but no scan receipt exists yet. This resolves
  * the draft-revision handshake without mutating a published clean receipt. */
 async function bindAttachmentDraft(person:Principal,rawId:string,draftRevision:number,signal?:AbortSignal){try{
  configured();const p=freezeFormData(copyFormData(person)) as Principal,id=uuidIdentifier(rawId),revision=attachmentRevision(draftRevision);
  const old=await o.directory.locateAttachment(p,id,signal);if(old.ticketId)throw fail('attachment_forbidden',403);
  const location=await o.directory.locateDraft(p,old.binding.draftId,old.binding.fieldPath,signal);
  return await scoped(p,location,true,async(tx,b,at,expires)=>{
   const raw=await tx.readUpload(id);if(!raw)throw fail('attachment_not_found',404);const r=copyFormData(raw) as AttachmentRecord;
   if(r.id!==id||b.draftRevision!==revision||attachmentBindingKey({...r.binding,draftRevision:revision})!==attachmentBindingKey(b)||revision<r.binding.draftRevision||r.objectKey!==attachmentObjectKey(p.workspaceId,id))throw fail('attachment_binding_changed',409);
   expires(r.expiresAt);if(attachmentBindingKey(r.binding)===attachmentBindingKey(b))return Object.freeze({uploadId:id,draftRevision:revision,status:r.status});
   if(r.status!=='uploading'||r.object!==null||r.sha256!==null||r.version===Number.MAX_SAFE_INTEGER)throw fail('attachment_binding_changed',409);
   const next=freezeFormData({...r,binding:b,version:r.version+1});await tx.bindUploadToDraft(next,r.version);return Object.freeze({uploadId:id,draftRevision:revision,status:next.status});
  },signal);
 }catch(e){throw safe(e);}}
 async function authorizeDownload(person:Principal,rawId:string,signal?:AbortSignal){try{
  configured();const p=freezeFormData(copyFormData(person)) as Principal,id=uuidIdentifier(rawId),location=await o.directory.locateAttachment(p,id,signal);
  const r=await scoped(p,location,false,async(tx,b,at,expires)=>{const r=checkedRow(await tx.readUpload(id),b,id,at,expires);if(!r.object)throw fail('attachment_not_clean_or_changed',409);return assertCleanAttachment(r,b,r.object,at);},signal);
  const current=parseSealedObject(await fileProviderCall(s=>o.storage.head(r.object!,s),timeout,signal),r.objectKey);assertCleanAttachment(r,r.binding,current,clock());
  const maxSeconds=Math.min(300,Math.floor(Number(instantMicros(r.expiresAt)-instantMicros(clock()))/1000000));if(maxSeconds<1)throw fail('attachment_not_clean_or_changed',409);
  const grant=attachmentRecord(await fileProviderCall(s=>o.storage.issueDownload(current,r.metadata.filename,maxSeconds,s),timeout,signal),['url','objectKey','objectVersion','expiresAt']);const u=new URL(String(grant.url));
  if(u.origin!==r.policy.downloadOrigin||u.username||u.password||u.hash||grant.objectKey!==r.objectKey||grant.objectVersion!==current.version||instantMicros(grant.expiresAt)>instantMicros(r.expiresAt)||instantMicros(grant.expiresAt)>instantMicros(clock())+BigInt(maxSeconds)*1000000n)throw fail();
  await scoped(p,location,false,async(tx,b,at,expires)=>{const last=checkedRow(await tx.readUpload(id),b,id,at,expires);assertCleanAttachment(last,b,current,at);if(last.version!==r.version||instantMicros(grant.expiresAt)<=instantMicros(at))throw fail('attachment_binding_changed',409);await tx.auditDownload(id,current.version,at);},signal);
  return freezeFormData({receiptId:id,url:grant.url,expiresAt:grant.expiresAt});
 }catch(e){throw safe(e);}}
 return Object.freeze({startAttachment,bindAttachmentDraft,finishAttachment,authorizeDownload});
}
