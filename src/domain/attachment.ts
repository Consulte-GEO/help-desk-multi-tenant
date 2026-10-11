import {uuidIdentifier} from './input-values.ts';
import {requestHash} from './canonical.ts';
import {HelpdeskError} from './errors.ts';
import {parseExternalResourceSelection,externalResourceSelectionKey,type ExternalResourceRef} from './external-resource.ts';
import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {isCanonicalInstant,compareInstants} from '../../shared/instant.js';
export type AttachmentBinding=Readonly<{workspaceId:string;accountId:string;ownerId:string;draftId:string;draftRevision:number;formId:string;formVersion:number;fieldPath:string;registryKey:string;visibility:'customer'|'internal';refs:readonly ExternalResourceRef[]}>;
export type AttachmentPolicy=Readonly<{id:string;status:'published';maxBytes:number;maxFiles:number;uploadTtlSeconds:number;receiptTtlSeconds:number;allowedMime:readonly string[];uploadOrigin:string;downloadOrigin:string;scanPolicyId:string}>;
export type AttachmentMetadata=Readonly<{filename:string;mime:string;bytes:number}>;
export type SealedAttachmentObject=Readonly<{key:string;version:string;bytes:number}>;
export type AttachmentRecord=Readonly<{id:string;version:number;binding:AttachmentBinding;metadata:AttachmentMetadata;policy:AttachmentPolicy;objectKey:string;object:SealedAttachmentObject|null;status:'uploading'|'pending_scan'|'scanning'|'clean'|'rejected'|'unsupported'|'scan_error';sha256:string|null;createdAt:string;expiresAt:string;scanPolicyId:string}>;
export const attachmentFailure=(code='attachment_unavailable',status=503)=>new HelpdeskError(status,code,'Não foi possível validar o anexo. Atualize seu estado antes de continuar.');
export function attachmentRecord(raw:unknown,keys:readonly string[]):Record<string,unknown>{
 try{const r=copyFormData(raw) as Record<string,unknown>;if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==keys.length||keys.some(k=>!Object.hasOwn(r,k)))throw Error();return r;}catch{throw attachmentFailure('invalid_attachment_input',400);}
}
export function attachmentRevision(n:unknown,min=1,max=Number.MAX_SAFE_INTEGER):number{if(!Number.isSafeInteger(n)||Number(n)<min||Number(n)>max)throw attachmentFailure('invalid_attachment_input',400);return n as number;}
const ref=(v:unknown,max=100)=>{if(typeof v!=='string'||!new RegExp('^[A-Za-z0-9][A-Za-z0-9._:-]{0,'+(max-1)+'}$').test(v))throw attachmentFailure('invalid_attachment_input',400);return v;};
function fieldPath(v:unknown):string{if(typeof v!=='string'||v.length>180||! /^[A-Za-z0-9_-]+(?:\[[0-9]{1,3}\])?(?:\.[A-Za-z0-9_-]+(?:\[[0-9]{1,3}\])?)*$/.test(v))throw attachmentFailure('invalid_attachment_input',400);return v;}
export function parseAttachmentBinding(raw:unknown):AttachmentBinding{
 const r=attachmentRecord(raw,['workspaceId','accountId','ownerId','draftId','draftRevision','formId','formVersion','fieldPath','registryKey','visibility','refs']);
 if(!['customer','internal'].includes(r.visibility as string))throw attachmentFailure('invalid_attachment_input',400);
 return freezeFormData({workspaceId:uuidIdentifier(r.workspaceId),accountId:uuidIdentifier(r.accountId),ownerId:uuidIdentifier(r.ownerId),draftId:uuidIdentifier(r.draftId),draftRevision:attachmentRevision(r.draftRevision),formId:uuidIdentifier(r.formId),formVersion:attachmentRevision(r.formVersion),fieldPath:fieldPath(r.fieldPath),registryKey:ref(r.registryKey),visibility:r.visibility as AttachmentBinding['visibility'],refs:parseExternalResourceSelection(r.refs)});
}
export function attachmentBindingKey(raw:unknown){const b=parseAttachmentBinding(raw);return requestHash({...b,refs:externalResourceSelectionKey(b.refs)});}
export function privateOrigin(value:unknown):string{if(typeof value!=='string')throw attachmentFailure();const u=new URL(value);if(u.protocol!=='https:'||u.origin!==value||u.username||u.password)throw attachmentFailure();return u.origin;}
export function parseAttachmentPolicy(raw:unknown):AttachmentPolicy{
 const p=attachmentRecord(raw,['id','status','maxBytes','maxFiles','uploadTtlSeconds','receiptTtlSeconds','allowedMime','uploadOrigin','downloadOrigin','scanPolicyId']);
 if(p.status!=='published'||!Array.isArray(p.allowedMime)||!p.allowedMime.length||p.allowedMime.length>3||new Set(p.allowedMime).size!==p.allowedMime.length||p.allowedMime.some(x=>!['application/pdf','image/png','image/jpeg'].includes(x as string)))throw attachmentFailure('attachment_policy_unavailable');
 return freezeFormData({id:ref(p.id),status:'published',maxBytes:attachmentRevision(p.maxBytes,1,104857600),maxFiles:attachmentRevision(p.maxFiles,1,50),uploadTtlSeconds:attachmentRevision(p.uploadTtlSeconds,1,3600),receiptTtlSeconds:attachmentRevision(p.receiptTtlSeconds,1,604800),allowedMime:p.allowedMime as string[],uploadOrigin:privateOrigin(p.uploadOrigin),downloadOrigin:privateOrigin(p.downloadOrigin),scanPolicyId:ref(p.scanPolicyId)});
}
export function parseAttachmentMetadata(raw:unknown,rawPolicy:unknown):AttachmentMetadata{
 const p=parseAttachmentPolicy(rawPolicy),r=attachmentRecord(raw,['filename','mime','bytes']);
 const name=r.filename,mime=r.mime;
 if(typeof name!=='string'||!name.trim()||name!==name.trim()||name.length>180||/[\p{Cc}\p{Cf}\p{Cs}\\/:%<>"|?*]/u.test(name)||name.startsWith('.')||name.endsWith('.')||name.includes('..')||typeof mime!=='string'||!p.allowedMime.includes(mime))throw attachmentFailure('invalid_attachment_metadata',400);
 const extensions:Record<string,string[]>={'image/png':['png'],'image/jpeg':['jpg','jpeg'],'application/pdf':['pdf']};
 if(!extensions[mime]?.includes(name.split('.').at(-1)!.toLowerCase()))throw attachmentFailure('invalid_attachment_metadata',400);
 return Object.freeze({filename:name,mime,bytes:attachmentRevision(r.bytes,1,p.maxBytes)});
}
export function attachmentObjectKey(workspaceId:string,id:string){return 'quarantine/'+uuidIdentifier(workspaceId)+'/'+uuidIdentifier(id);}
export function parseSealedObject(raw:unknown,expectedKey:string):SealedAttachmentObject{
 const r=attachmentRecord(raw,['key','version','bytes']);if(r.key!==expectedKey)throw attachmentFailure('attachment_object_changed',409);
 return Object.freeze({key:expectedKey,version:ref(r.version,160),bytes:attachmentRevision(r.bytes,1,104857600)});
}
/** Additional check only. The caller must lock the receipt and apply CURRENT
 * person/ticket/resource authorization. The digest or status is not a bearer. */
export function assertCleanAttachment(raw:AttachmentRecord,binding:AttachmentBinding,observed:SealedAttachmentObject,at:string):AttachmentRecord{
 try{
  const r=copyFormData(raw) as AttachmentRecord,b=parseAttachmentBinding(r.binding),p=parseAttachmentPolicy(r.policy);uuidIdentifier(r.id);attachmentRevision(r.version);
  if(r.status!=='clean'||!r.object||r.objectKey!==attachmentObjectKey(b.workspaceId,r.id)||attachmentBindingKey(b)!==attachmentBindingKey(binding)||r.scanPolicyId!==p.scanPolicyId||typeof r.sha256!=='string'||!/^[a-f0-9]{64}$/.test(r.sha256)||!isCanonicalInstant(at)||!isCanonicalInstant(r.createdAt)||!isCanonicalInstant(r.expiresAt)||compareInstants(r.createdAt,at)>0||compareInstants(r.expiresAt,at)<=0)throw Error();
  const stored=parseSealedObject(r.object,r.objectKey),current=parseSealedObject(observed,r.objectKey);parseAttachmentMetadata(r.metadata,p);
  if(requestHash(stored)!==requestHash(current)||stored.bytes!==r.metadata.bytes)throw Error();return freezeFormData(r);
 }catch{throw attachmentFailure('attachment_not_clean_or_changed',409);}
}
