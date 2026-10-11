import type {Principal} from '../domain/model.ts';import type {SqlPool,SqlClient} from '../infrastructure/sql.ts';
import type {createResourceAccessResolver} from './resource-access.ts';
import {uuidIdentifier} from '../domain/input-values.ts';import {requestHash} from '../domain/canonical.ts';
import {parseExternalResourceSelection,externalResourceSelectionKey,type ExternalResourceRef} from '../domain/external-resource.ts';
import {parseFormVersion,formRecord,formRevision,type FormVersion} from '../domain/form-schema.ts';
import {copyFormData,freezeFormData,validateFormValues} from '../../shared/form-rules.js';
import {formatMicros,instantMicros} from '../domain/business-calendar.ts';
import {runIntakeTransaction,intakeFailure as fail,safeIntakeError,type ScopedDraftStore,type IntakeExpiry} from './intake-context.ts';
export type DraftForm=Readonly<{id:string;ownerId:string;workspaceId:string;accountId:string;refs:readonly ExternalResourceRef[];formId:string;formVersion:number;schemaHash:string;revision:number;expiresAt:string;answers:Record<string,unknown>;status:'editing'|'committed';ticketId:string|null;sourceHash:string}>;
export interface DraftDirectory{locateDraft(p:Principal,id:string,signal?:AbortSignal):Promise<{refs:readonly ExternalResourceRef[];accountId:string}|null>}
export interface FormDraftTransaction extends ScopedDraftStore{
 readDraft(id:string):Promise<DraftForm|null>;
 readSchema(formId:string,version:number):Promise<FormVersion>;
 /** CAS + owner/refs + no resurrection of committed/expired drafts. Atomic. */
 saveDraft(draft:DraftForm,expectedRevision:number):Promise<void>;
}
export function checkedDraft(raw:DraftForm|null,p:Principal,id:string,refs:readonly ExternalResourceRef[],at:string,expires?:IntakeExpiry):DraftForm{
 if(!raw)throw fail('draft_not_found',404);const d=copyFormData(raw) as DraftForm;
 if(d.id!==id||d.ownerId!==p.id||d.workspaceId!==p.workspaceId||externalResourceSelectionKey(d.refs)!==externalResourceSelectionKey(refs))throw fail('draft_forbidden',403);
 formRevision(d.revision);uuidIdentifier(d.accountId);uuidIdentifier(d.formId);formRevision(d.formVersion);
 if(!['editing','committed'].includes(d.status)||typeof d.schemaHash!=='string'||!/^[a-f0-9]{64}$/.test(d.schemaHash))throw fail();
 if(instantMicros(d.expiresAt)<=instantMicros(at))throw fail('draft_expired',409);expires?.(d.expiresAt,'draft_expired');return freezeFormData(d);
}
export function createFormDraftService(o:{pool:SqlPool;resolver:ReturnType<typeof createResourceAccessResolver>;directory:DraftDirectory;createStore:(c:SqlClient,p:Principal)=>FormDraftTransaction;draftTtlSeconds:number;clock?:()=>string}){
 const clock=o.clock??(()=>new Date().toISOString());if(!Number.isSafeInteger(o.draftTtlSeconds)||o.draftTtlSeconds<1||o.draftTtlSeconds>604800)throw fail();
 async function saveFormDraft(person:Principal,raw:unknown,expectedRevision:number,signal?:AbortSignal):Promise<DraftForm>{try{
  const p=freezeFormData(copyFormData(person)) as Principal,input=formRecord(raw,['id','accountId','refs','formId','formVersion','answers']),id=uuidIdentifier(input.id),accountId=uuidIdentifier(input.accountId),refs=parseExternalResourceSelection(input.refs),formId=uuidIdentifier(input.formId),formVersion=formRevision(input.formVersion),expected=formRevision(expectedRevision,0),answers=copyFormData(input.answers) as Record<string,unknown>;
  if(!answers||typeof answers!=='object'||Array.isArray(answers)||expected===Number.MAX_SAFE_INTEGER)throw fail('invalid_intake_input',400);
  const sourceHash=requestHash({id,accountId,refsKey:externalResourceSelectionKey(refs),formId,formVersion,answers});
  return await runIntakeTransaction({...o,clock},p,refs,'tickets.write',async(tx,scope,expires)=>{
   if(scope.accountId!==accountId)throw fail('draft_forbidden',403);const old=await tx.readDraft(id);let current:DraftForm|null=null;
   if(old){current=checkedDraft(old,p,id,refs,clock(),expires);if(current.accountId!==accountId||current.formId!==formId||current.formVersion!==formVersion)throw fail('draft_forbidden',403);if(current.status==='committed')throw fail('draft_already_committed',409);if(current.revision===expected+1&&current.sourceHash===sourceHash)return current;}
   if((current?.revision??0)!==expected)throw fail('draft_version_conflict',412);
   const schema=parseFormVersion(await tx.readSchema(formId,formVersion));if(schema.id!==formId||schema.version!==formVersion||schema.status!=='published')throw fail('form_not_published',409);
   if(current&&current.schemaHash!==requestHash(schema))throw fail('form_schema_changed',409);
   const result=validateFormValues(schema,answers,{audience:'customer'});if(result.issues.some(i=>['unknown_field','hidden_field','invalid_batch'].includes(i.code)))throw fail('invalid_form_values',422);
   // Incomplete ordinary values may be saved. Saving never means they are valid for submission.
   const d:DraftForm=freezeFormData({id,ownerId:p.id,workspaceId:p.workspaceId,accountId,refs,formId,formVersion,schemaHash:requestHash(schema),revision:expected+1,expiresAt:current?.expiresAt??formatMicros(instantMicros(clock())+BigInt(o.draftTtlSeconds)*1000000n),answers,status:'editing',ticketId:null,sourceHash});
   expires(d.expiresAt,'draft_expired');await tx.saveDraft(d,expected);return d;
  },signal);
 }catch(e){throw safeIntakeError(e);}}
 async function readFormDraft(person:Principal,rawId:string,signal?:AbortSignal){try{
  const p=freezeFormData(copyFormData(person)) as Principal,id=uuidIdentifier(rawId),located=await o.directory.locateDraft(p,id,signal);if(!located)throw fail('draft_not_found',404);const refs=parseExternalResourceSelection(located.refs);
  return await runIntakeTransaction({...o,clock},p,refs,'tickets.read',async(tx,scope,expires)=>{const d=checkedDraft(await tx.readDraft(id),p,id,refs,clock(),expires);if(scope.accountId!==d.accountId||located.accountId!==d.accountId)throw fail('draft_forbidden',403);return d;},signal);
 }catch(e){throw safeIntakeError(e);}}
 return Object.freeze({saveFormDraft,readFormDraft});
}
