import type {TransactionAdmission} from '../infrastructure/transaction.ts';
import type {Principal} from '../domain/model.ts';
import {requestHash} from '../domain/canonical.ts';import {uuidIdentifier} from '../domain/input-values.ts';import {isCanonicalInstant,compareInstants} from '../../shared/instant.js';
import {formRecord,formRevision} from '../domain/form-schema.ts';import {copyFormData,freezeFormData,type FormRegistry} from '../../shared/form-rules.js';
import {configurationObject} from '../domain/support-configuration.ts';
import {createBusinessCalendar} from '../domain/business-calendar.ts';
import {assertAdministrativeAssurance,type VerifiedAdministrativeAssurance} from '../infrastructure/authentication.ts';
import {parseAdminWorkspace,bindAdministrativeCapabilities,requireAdministrativeCapability,type AdministrativeCapability} from '../domain/admin-policy.ts';
import {parseConsulteGeoConfiguration,compileConsulteGeoConfiguration,configurationFailure as fail,CONSULTE_CONFIGURATION_FIELD_TYPES,type ConsulteGeoConfiguration,type ConsulteGeoArtifacts} from '../integrations/consultegeo/configuration.ts';
export type ConsulteGeoConfigurationRecord=Readonly<{workspaceId:string;id:string;version:number;revision:number;status:'draft'|'published';definition:ConsulteGeoConfiguration;contentHash:string;artifacts:ConsulteGeoArtifacts|null;createdBy:string;createdAt:string;publishedBy:string|null;publishedAt:string|null}>;
export type ConsulteGeoConfigurationCommand=Readonly<{action:'save'|'publish'|'restore';expectedRevision:number;expectedEntityRevision:number;reason:string;definition?:ConsulteGeoConfiguration;id:string;version:number}>;
export type ConsulteGeoConfigurationReceipt=Readonly<{workspaceId:string;actorId:string;revision:number;record:ConsulteGeoConfigurationRecord;auditId:string;replayed:boolean}>;
export interface ConsulteGeoConfigurationTransaction{readWorkspace():Promise<unknown>;readState():Promise<unknown>;readRegistry():Promise<FormRegistry>;getReceipt(key:string):Promise<unknown>;commitCommand(command:ConsulteGeoConfigurationCommand,key:string,hash:string,artifacts:ConsulteGeoArtifacts|null):Promise<unknown>}
export interface ConsulteGeoConfigurationStore{transaction<T>(p:Principal,admission:()=>void,work:(tx:ConsulteGeoConfigurationTransaction)=>Promise<T>):Promise<T>}
const unavailable=()=>fail('consultegeo_configuration_unavailable',503);
function artifacts(raw:unknown,d:ConsulteGeoConfiguration):ConsulteGeoArtifacts{
 const x=formRecord(raw,['calendar','entries','attachmentsPolicy']),calendar=createBusinessCalendar(x.calendar).version;
 if(calendar.versionId!=='cg_'+d.id.replaceAll('-','_')+'_'+d.version)throw unavailable();
 // Qualification is performed at publication. The exact stored calendar is retained
 // on read; subsequent timezone-data updates must not rewrite its UTC intervals.
 const references=d.entries.flatMap(e=>e.form.fields),registry={types:CONSULTE_CONFIGURATION_FIELD_TYPES,lookups:references.filter(f=>f.type==='lookup').map(f=>String(f.config.resolver)),files:true,downloads:references.filter(f=>f.type==='download').map(f=>String(f.config.resource))};
 const expected=compileConsulteGeoConfiguration(d,registry as FormRegistry);
 if(requestHash(x.entries)!==requestHash(expected.entries)||requestHash(x.attachmentsPolicy)!==requestHash(expected.attachmentsPolicy))throw unavailable();
 return freezeFormData({calendar,entries:copyFormData(x.entries),attachmentsPolicy:copyFormData(x.attachmentsPolicy)}) as ConsulteGeoArtifacts;
}
export function parseConsulteGeoConfigurationRecord(raw:unknown):ConsulteGeoConfigurationRecord{try{
 const x=formRecord(raw,['workspaceId','id','version','revision','status','definition','contentHash','artifacts','createdBy','createdAt','publishedBy','publishedAt']),definition=parseConsulteGeoConfiguration(x.definition);
 if(x.id!==definition.id||x.version!==definition.version||!['draft','published'].includes(x.status as string)||!isCanonicalInstant(x.createdAt))throw unavailable();
 const value=x.status==='published'?artifacts(x.artifacts,definition):null;if(x.status==='draft'&&(x.artifacts!==null||x.publishedBy!==null||x.publishedAt!==null)||x.status==='published'&&(!isCanonicalInstant(x.publishedAt)||compareInstants(x.publishedAt,x.createdAt)<0))throw unavailable();
 if(x.contentHash!==requestHash({definition,artifacts:value}))throw unavailable();
 return freezeFormData({workspaceId:uuidIdentifier(x.workspaceId),id:definition.id,version:definition.version,revision:formRevision(x.revision),status:x.status,definition,contentHash:x.contentHash,artifacts:value,createdBy:uuidIdentifier(x.createdBy),createdAt:x.createdAt,publishedBy:x.status==='published'?uuidIdentifier(x.publishedBy):null,publishedAt:x.publishedAt}) as ConsulteGeoConfigurationRecord;
}catch{throw unavailable();}}
export function parseConsulteGeoConfigurationCommand(raw:unknown):ConsulteGeoConfigurationCommand{try{
 const action=raw&&typeof raw==='object'?Object.getOwnPropertyDescriptor(raw,'action')?.value:undefined;if(!['save','publish','restore'].includes(action))throw fail();
 const x=formRecord(raw,['action','expectedRevision','expectedEntityRevision','reason',...(action==='save'?['definition']:['id','version'])]);
 if(typeof x.reason!=='string'||!x.reason.trim()||x.reason.length>2000||/[\p{Cc}\p{Cs}]/u.test(x.reason))throw fail();
 const definition=action==='save'?parseConsulteGeoConfiguration(x.definition):undefined;
 return freezeFormData({action,expectedRevision:formRevision(x.expectedRevision),expectedEntityRevision:formRevision(x.expectedEntityRevision,action==='save'?0:1),reason:x.reason,...(definition?{definition}:{}),id:definition?.id??uuidIdentifier(x.id),version:definition?.version??formRevision(x.version)}) as ConsulteGeoConfigurationCommand;
}catch{throw fail();}}
const codes:Record<string,number>={release_gate_closed:503,request_cancelled:409,invalid_consultegeo_configuration:400,consultegeo_configuration_not_publishable:409,consultegeo_configuration_version_conflict:412,consultegeo_configuration_immutable:409,consultegeo_configuration_identity_immutable:409,consultegeo_configuration_idempotency_conflict:409,consultegeo_configuration_not_found:404,consultegeo_configuration_unavailable:503,administrative_assurance_required:403,administrative_capability_required:403,invalid_administrative_state:503};
function safe(error:unknown){const code=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined;return typeof code==='string'&&Object.hasOwn(codes,code)?fail(code,codes[code]):unavailable();}
export function createConsulteGeoConfigurationAdministration(o:{store:ConsulteGeoConfigurationStore;clock?:()=>string}){
 const clock=o.clock??(()=>new Date().toISOString());
 async function authorized<T>(p:Principal,proof:VerifiedAdministrativeAssurance,cap:AdministrativeCapability,work:(tx:ConsulteGeoConfigurationTransaction,state:{workspaceId:string;revision:number;records:ConsulteGeoConfigurationRecord[]},check:()=>void)=>Promise<T>,admission?:TransactionAdmission){
  assertAdministrativeAssurance(p,proof);let bound:{close():void}|undefined;
  const check=()=>{admission?.();assertAdministrativeAssurance(p,proof);if(bound)requireAdministrativeCapability(p,cap,proof);};
  try{return await o.store.transaction(p,check,async tx=>{check();bound=bindAdministrativeCapabilities(p,proof,parseAdminWorkspace(await tx.readWorkspace()),clock);check();const raw=configurationObject(await tx.readState(),['workspaceId','revision','records']);if(raw.workspaceId!==p.workspaceId||!Array.isArray(raw.records)||raw.records.length>500||Reflect.ownKeys(raw.records).length!==raw.records.length+1)throw unavailable();const records=Array.from({length:raw.records.length},(_,i)=>{const descriptor=Object.getOwnPropertyDescriptor(raw.records,String(i));if(!descriptor||!Object.hasOwn(descriptor,'value')||!descriptor.enumerable)throw unavailable();return parseConsulteGeoConfigurationRecord(descriptor.value);});if(records.some(r=>r.workspaceId!==p.workspaceId)||new Set(records.map(r=>r.id+':'+r.version)).size!==records.length)throw unavailable();return work(tx,{workspaceId:p.workspaceId,revision:formRevision(raw.revision),records},check);});}finally{bound?.close();}
 }
 function receipt(raw:unknown,p:Principal,expected?:{revision:number;id:string;version:number;status:string}):ConsulteGeoConfigurationReceipt{
  const x=formRecord(raw,['workspaceId','actorId','revision','record','auditId','replayed']),record=parseConsulteGeoConfigurationRecord(x.record);
  if(x.workspaceId!==p.workspaceId||x.actorId!==p.id||record.workspaceId!==p.workspaceId||x.replayed!==false||expected&&(x.revision!==expected.revision||record.id!==expected.id||record.version!==expected.version||record.status!==expected.status||record.status==='published'&&record.publishedBy!==p.id))throw unavailable();
  return freezeFormData({workspaceId:p.workspaceId,actorId:p.id,revision:formRevision(x.revision),record,auditId:uuidIdentifier(x.auditId),replayed:false});
 }
 async function execute(p:Principal,proof:VerifiedAdministrativeAssurance,raw:unknown,key:string,admission?:TransactionAdmission):Promise<ConsulteGeoConfigurationReceipt>{let prepared=false;try{
  const command=parseConsulteGeoConfigurationCommand(raw);if(typeof key!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw fail();const hash=requestHash({workspaceId:p.workspaceId,actorId:p.id,command});
  return await authorized(p,proof,command.action==='publish'?'forms.publish':'forms.write',async(tx,s,check)=>{
   const cached=await tx.getReceipt(key);check();if(cached!==null){const c=formRecord(cached,['key','hash','result']);if(c.key!==key||typeof c.hash!=='string'||!/^[a-f0-9]{64}$/.test(c.hash))throw unavailable();if(c.hash!==hash)throw fail('consultegeo_configuration_idempotency_conflict',409);const r=receipt(c.result,p);if(r.record.id!==command.id||r.revision>s.revision||!s.records.some(x=>x.id===r.record.id&&x.version===r.record.version&&x.revision>=r.record.revision))throw unavailable();return freezeFormData({...r,replayed:true});}
   if(s.revision!==command.expectedRevision)throw fail('consultegeo_configuration_version_conflict',412);
   const old=s.records.find(x=>x.id===command.id&&x.version===command.version),latest=Math.max(0,...s.records.filter(x=>x.id===command.id).map(x=>x.version));
   if((old?.revision??0)!==command.expectedEntityRevision)throw fail('consultegeo_configuration_version_conflict',412);
   if(command.action==='save'){if(old?.status==='published')throw fail('consultegeo_configuration_immutable',409);if(!old&&command.version!==latest+1)throw fail('consultegeo_configuration_version_conflict',412);const prior=s.records.find(x=>x.id===command.id);if(prior&&prior.definition.service!==command.definition!.service)throw fail('consultegeo_configuration_identity_immutable',409);}
   else if(!old)throw fail('consultegeo_configuration_not_found',404);
   if(command.action==='publish'&&old!.status==='published')throw fail('consultegeo_configuration_immutable',409);
   if(command.action==='restore'&&old!.status!=='published')throw fail('consultegeo_configuration_not_publishable',409);
   const value=command.action==='publish'?compileConsulteGeoConfiguration(old!.definition,await tx.readRegistry()):null;check();
   const result=receipt(await tx.commitCommand(command,key,hash,value),p,{revision:s.revision+1,id:command.id,version:command.action==='restore'?latest+1:command.version,status:command.action==='publish'?'published':'draft'});check();prepared=true;return result;
  },admission);
 }catch(e){const code=e&&typeof e==='object'?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;if(prepared&&!(typeof code==='string'&&Object.hasOwn(codes,code)))throw fail('consultegeo_configuration_outcome_unknown',503);throw safe(e);}}
 async function read(p:Principal,proof:VerifiedAdministrativeAssurance,id:string,version:number,admission?:TransactionAdmission){try{uuidIdentifier(id);formRevision(version);return await authorized(p,proof,'forms.read',async(_tx,s,check)=>{const record=s.records.find(r=>r.id===id&&r.version===version);if(!record)throw fail('consultegeo_configuration_not_found',404);check();return {revision:s.revision,record};},admission);}catch(e){throw safe(e);}}
 async function list(p:Principal,proof:VerifiedAdministrativeAssurance,admission?:TransactionAdmission){try{return await authorized(p,proof,'forms.read',async(_tx,s,check)=>{check();return {revision:s.revision,records:s.records.map(({definition,artifacts,...metadata})=>({...metadata,service:definition.service,title:definition.title}))};},admission);}catch(e){throw safe(e);}}
 return Object.freeze({execute,read,list});
}
/** For a trusted, locked intake snapshot; not a grant or a customer-facing reader. */
export function pinPublishedConsulteGeoConfiguration(raw:unknown,action:string,priority:string,hash:string){const r=parseConsulteGeoConfigurationRecord(raw);if(r.status!=='published'||r.contentHash!==hash)throw fail('consultegeo_configuration_not_publishable',409);const entry=r.artifacts!.entries.find(e=>e.action===action&&e.priority===priority);if(!entry)throw fail('consultegeo_configuration_not_found',404);return freezeFormData({configurationId:r.id,version:r.version,contentHash:r.contentHash,form:entry.form,workflow:entry.workflow,checklistReference:entry.workflow.executionChecklist,sla:entry.sla,calendar:r.artifacts!.calendar,attachmentsPolicy:r.artifacts!.attachmentsPolicy});}
