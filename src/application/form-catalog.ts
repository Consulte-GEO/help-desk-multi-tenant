import {randomUUID} from 'node:crypto';
import type {Principal} from '../domain/model.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {requestHash} from '../domain/canonical.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {isCanonicalInstant} from '../../shared/instant.js';
import {assertFormPublishable,type FormRegistry} from '../../shared/form-rules.js';
import {parseFormVersion,formRecord as object,formRevision as revision,formReference as reference,formFailure as fail,freezeFormData,type FormVersion} from '../domain/form-schema.ts';
import {assertAdministrativeAssurance,type VerifiedAdministrativeAssurance} from '../infrastructure/authentication.ts';
import {parseAdminWorkspace,bindAdministrativeCapabilities,requireAdministrativeCapability,type AdministrativeCapability} from '../domain/admin-policy.ts';
export type CatalogForm=Readonly<{workspaceId:string;profileId:string;categoryCode:string;revision:number;schema:FormVersion}>;
export type FormCatalogReceipt=Readonly<{workspaceId:string;actorId:string;revision:number;record:CatalogForm;auditId:string;replayed:boolean}>;
export interface FormCatalogTransaction {
 readWorkspace():Promise<unknown>;readCatalog():Promise<unknown>;getReceipt(key:string):Promise<unknown>;
 /** Qualified taxonomy and handler registry, read under the same transaction. No request-provided approval. */
 readCategory(profileId:string,categoryCode:string):Promise<unknown>;readRegistry():Promise<FormRegistry>;
 commitVersion(expectedRevision:number,record:CatalogForm,audit:Readonly<Record<string,unknown>>,receipt:Readonly<{key:string;hash:string;result:FormCatalogReceipt}>):Promise<void>;
}
export interface FormCatalogStore {
 /** Scoped restricted SQL/CAS, immutable published versions + audit/receipt atomically.
  * Hold admin/category/catalog source rows through the final admission and COMMIT.
  * This interface has NO in-memory production implementation in this delivery.
  */
 transaction<T>(p:Principal,admission:()=>void,work:(tx:FormCatalogTransaction)=>Promise<T>):Promise<T>;
}
function parseRow(raw:unknown):CatalogForm{const x=object(raw,['workspaceId','profileId','categoryCode','revision','schema']),s=parseFormVersion(x.schema);uuidIdentifier(s.id);return freezeFormData({workspaceId:uuidIdentifier(x.workspaceId),profileId:reference(x.profileId),categoryCode:reference(x.categoryCode),revision:revision(x.revision),schema:s});}
function parseCatalog(raw:unknown,p:Principal){const x=object(raw,['workspaceId','revision','versions']);if(x.workspaceId!==p.workspaceId||!Array.isArray(x.versions)||x.versions.length>2000)throw fail('form_catalog_unavailable',503);const versions=x.versions.map(parseRow);if(versions.some(r=>r.workspaceId!==p.workspaceId)||new Set(versions.map(r=>r.schema.id+':'+r.schema.version)).size!==versions.length)throw fail('form_catalog_unavailable',503);return {workspaceId:p.workspaceId,revision:revision(x.revision),versions};}
function command(raw:unknown){
 const base=raw&&typeof raw==='object'?Object.getOwnPropertyDescriptor(raw,'action')?.value:undefined;
 const keys=base==='save'?['action','schema','profileId','categoryCode','expectedRevision','expectedEntityRevision','reason']:base==='publish'?['action','formId','version','expectedRevision','expectedEntityRevision','reason']:base==='restore'?['action','formId','version','expectedRevision','reason']:[];
 if(!keys.length)throw fail('invalid_form_input');const x=object(raw,keys);revision(x.expectedRevision);if(typeof x.reason!=='string'||!x.reason.trim()||x.reason.length>2000||/[\p{Cc}]/u.test(x.reason))throw fail('invalid_form_input');
 if(base==='save'){const s=parseFormVersion(x.schema);if(s.status!=='draft')throw fail('invalid_form_input');uuidIdentifier(s.id);reference(x.profileId);reference(x.categoryCode);revision(x.expectedEntityRevision,0);x.schema=s;}
 else{uuidIdentifier(x.formId);revision(x.version);if(base==='publish')revision(x.expectedEntityRevision);}
 return x;
}
const failures:Record<string,number>={administrative_assurance_required:403,administrative_capability_required:403,invalid_administrative_state:503,invalid_form_input:400,invalid_form_schema:400,form_version_conflict:412,form_published_immutable:409,form_identity_immutable:409,form_idempotency_conflict:409,form_not_publishable:409,form_not_found:404,form_catalog_unavailable:503};
function safe(e:unknown){try{if(e instanceof HelpdeskError){const c=Object.getOwnPropertyDescriptor(e,'code')?.value;if(typeof c==='string'&&Object.hasOwn(failures,c))return fail(c,failures[c]);}}catch{}return fail('form_catalog_unavailable',503);}
export function createFormCatalog(options:{store:FormCatalogStore;clock?:()=>string}){
 const clock=options.clock??(()=>new Date().toISOString());
 async function authorized<T>(p:Principal,proof:VerifiedAdministrativeAssurance,cap:AdministrativeCapability,work:(tx:FormCatalogTransaction,s:ReturnType<typeof parseCatalog>,check:()=>void)=>Promise<T>):Promise<T>{
  assertAdministrativeAssurance(p,proof);let bound:{close():void}|undefined;
  const check=()=>{assertAdministrativeAssurance(p,proof);if(bound)requireAdministrativeCapability(p,cap,proof);};
  try{return await options.store.transaction(p,check,async tx=>{check();const admin=parseAdminWorkspace(await tx.readWorkspace());check();bound=bindAdministrativeCapabilities(p,proof,admin,clock);check();const state=parseCatalog(await tx.readCatalog(),p);check();return work(tx,state,check);});}finally{bound?.close();}
 }
 async function execute(p:Principal,proof:VerifiedAdministrativeAssurance,raw:unknown,key:string):Promise<FormCatalogReceipt>{
  let prepared=false;
  try{const c=command(raw);if(!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw fail('invalid_form_input');const hash=requestHash({workspaceId:p.workspaceId,actorId:p.id,command:c});
   return await authorized(p,proof,c.action==='publish'?'forms.publish':'forms.write',async(tx,s,check)=>{
    const saved=await tx.getReceipt(key);check();
    if(saved!==null){const e=object(saved,['key','hash','result']);if(e.key!==key)throw fail('form_catalog_unavailable',503);if(e.hash!==hash)throw fail('form_idempotency_conflict',409);const r=object(e.result,['workspaceId','actorId','revision','record','auditId','replayed']),row=parseRow(r.record);
     if(r.workspaceId!==p.workspaceId||r.actorId!==p.id||row.workspaceId!==p.workspaceId||r.replayed!==false||revision(r.revision)>s.revision||!s.versions.some(v=>v.schema.id===row.schema.id&&v.schema.version===row.schema.version&&v.revision>=row.revision))throw fail('form_catalog_unavailable',503);
     return freezeFormData({workspaceId:p.workspaceId,actorId:p.id,revision:revision(r.revision),record:row,auditId:uuidIdentifier(r.auditId),replayed:true});}
    if(c.expectedRevision!==s.revision)throw fail('form_version_conflict',412);
    const schema=c.schema as FormVersion|undefined,formId=schema?.id??c.formId,version=schema?.version??c.version;
    const old=s.versions.find(v=>v.schema.id===formId&&v.schema.version===version)??null;
    let record:CatalogForm;
    if(c.action==='save'){
     if(old?.schema.status==='published')throw fail('form_published_immutable',409);
     if((old?.revision??0)!==c.expectedEntityRevision)throw fail('form_version_conflict',412);
     const identity=s.versions.find(v=>v.schema.id===formId);
     if(identity&&(identity.profileId!==c.profileId||identity.categoryCode!==c.categoryCode))throw fail('form_identity_immutable',409);
     const latest=Math.max(0,...s.versions.filter(v=>v.schema.id===formId).map(v=>v.schema.version));if(!old&&version!==latest+1)throw fail('form_version_conflict',412);
     record=parseRow({workspaceId:p.workspaceId,profileId:c.profileId,categoryCode:c.categoryCode,revision:revision((old?.revision??0)+1),schema});
    }else{
     if(!old)throw fail('form_not_found',404);
     if(c.action==='restore'){
      if(old.schema.status!=='published')throw fail('form_not_publishable',409);
      const next=revision(Math.max(...s.versions.filter(v=>v.schema.id===formId).map(v=>v.schema.version))+1);
      record=parseRow({...old,revision:1,schema:{...old.schema,version:next,status:'draft'}});
     }else{
      if(old.revision!==c.expectedEntityRevision)throw fail('form_version_conflict',412);if(old.schema.status==='published')throw fail('form_published_immutable',409);
      const category=object(await tx.readCategory(old.profileId,old.categoryCode),['workspaceId','profileId','categoryCode','active','sourceRef']);check();
      if(category.workspaceId!==p.workspaceId||category.profileId!==old.profileId||category.categoryCode!==old.categoryCode||category.active!==true||typeof category.sourceRef!=='string'||!category.sourceRef)throw fail('form_not_publishable',409);
      const registry=await tx.readRegistry();check();try{assertFormPublishable(old.schema,registry);}catch{throw fail('form_not_publishable',409);}
      record=parseRow({...old,revision:revision(old.revision+1),schema:{...old.schema,status:'published'}});
     }
    }
    const at=clock();if(!isCanonicalInstant(at))throw fail('form_catalog_unavailable',503);
    const result=freezeFormData({workspaceId:p.workspaceId,actorId:p.id,revision:revision(s.revision+1),record,auditId:randomUUID(),replayed:false});
    check();await tx.commitVersion(s.revision,record,{id:result.auditId,workspaceId:p.workspaceId,actorId:p.id,action:c.action,reason:c.reason,at,before:old,after:record},{key,hash,result});check();prepared=true;return result;
   });
  }catch(e){if(prepared)throw fail('form_outcome_unknown',503);throw safe(e);}
 }
 async function read(p:Principal,proof:VerifiedAdministrativeAssurance,id:string,version:number){try{uuidIdentifier(id);revision(version);return await authorized(p,proof,'forms.read',async(_tx,s,check)=>{const row=s.versions.find(v=>v.schema.id===id&&v.schema.version===version);if(!row)throw fail('form_not_found',404);check();return row;});}catch(e){throw safe(e);}}
 return Object.freeze({execute,read});
}
