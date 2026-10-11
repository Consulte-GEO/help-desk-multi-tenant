import {randomUUID} from 'node:crypto';
import type {Principal} from '../domain/model.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {requestHash} from '../domain/canonical.ts';
import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';
import {isCanonicalInstant,compareInstants} from '../../shared/instant.js';
import {assertAdministrativeAssurance,type VerifiedAdministrativeAssurance} from '../infrastructure/authentication.ts';
import {parseAdminWorkspace,bindAdministrativeCapabilities,requireAdministrativeCapability,type AdministrativeCapability} from '../domain/admin-policy.ts';
import {CONFIGURATION_KINDS,configurationObject,configurationRevision,configurationData,parseConfigurationRecord,parseConfigurationState,configurationError as fail,type ConfigurationRecord,type ConfigurationKind,type ConfigurationState} from '../domain/support-configuration.ts';
export type ConfigurationReceipt=Readonly<{workspaceId:string;actorId:string;revision:number;record:ConfigurationRecord;auditId:string;replayed:boolean}>;
export type ConfigurationAudit=Readonly<{id:string;workspaceId:string;actorId:string;action:string;reason:string;at:string;before:ConfigurationRecord|null;after:ConfigurationRecord}>;
export type StoredConfigurationReceipt=Readonly<{key:string;workspaceId:string;actorId:string;hash:string;result:ConfigurationReceipt}>;
export interface ConfigurationTransaction{
 /** Both snapshots and referenced policies/connections must remain locked until commit. */
 readWorkspace():Promise<unknown>;readConfiguration():Promise<unknown>;getReceipt(key:string):Promise<unknown>;
 readConnection(id:string):Promise<unknown>;readApprovedPolicy(reference:string):Promise<unknown>;
 commitChange(expectedRevision:number,record:ConfigurationRecord,audit:ConfigurationAudit,receipt:StoredConfigurationReceipt):Promise<void>;
}
export interface ConfigurationAdminStore{
 /** Dedicated implementation only: same transaction, workspace CAS, relational
  * checks, old versions preserved, append-only audit/receipt, admission before COMMIT.
  * It MUST NOT write the supplied JSON as arbitrary SQL/table/column names.
  */
 transaction<T>(p:Principal,admission:()=>void,work:(tx:ConfigurationTransaction)=>Promise<T>):Promise<T>;
}
export type ConfigurationCommand=Readonly<{action:string;kind:ConfigurationKind;operation:'create'|'update'|'publish';expectedRevision:number;targetId?:string;expectedEntityRevision?:number;reason:string;data:Readonly<Record<string,unknown>>}>;
const family=(kind:ConfigurationKind)=>kind==='account'?'accounts':kind==='binding'?'bindings':kind==='contract'||kind==='contract_version'||kind==='coverage'?'contracts':'catalog';
export function parseConfigurationCommand(raw:unknown):ConfigurationCommand{
 try{
  const property=raw&&typeof raw==='object'?Object.getOwnPropertyDescriptor(raw,'action'):undefined;
  const action=property&&Object.hasOwn(property,'value')?property.value:undefined;
  if(typeof action!=='string')throw Error();const [kind,operation,...extra]=action.split('.');
  if(extra.length||!CONFIGURATION_KINDS.includes(kind as ConfigurationKind)||!['create','update','publish'].includes(operation!)||operation==='publish'&&kind!=='contract_version')throw Error();
  const x=configurationObject(raw,['action','expectedRevision','reason','data',...(operation==='create'?[]:['targetId','expectedEntityRevision'])]);
  if(!isPersistableText(x.reason)||!x.reason.trim()||x.reason.length>2000||/[\p{Cc}]/u.test(x.reason))throw Error();
  const data=operation==='publish'?Object.freeze(configurationObject(x.data,[])):configurationData(kind as ConfigurationKind,x.data);
  return Object.freeze({action,kind:kind as ConfigurationKind,operation:operation as ConfigurationCommand['operation'],expectedRevision:configurationRevision(x.expectedRevision),reason:x.reason,data,...(operation==='create'?{}:{targetId:uuidIdentifier(x.targetId),expectedEntityRevision:configurationRevision(x.expectedEntityRevision)})});
 }catch{throw fail('invalid_configuration_command');}
}
function readReceipt(raw:unknown,p:Principal,key:string,hash:string,cmd:ConfigurationCommand,state:ConfigurationState):ConfigurationReceipt|null{
 if(raw===null)return null;
 let conflict=false;
 try{
  const s=configurationObject(raw,['key','workspaceId','actorId','hash','result']);
  if(s.key!==key||s.workspaceId!==p.workspaceId||s.actorId!==p.id||typeof s.hash!=='string'||!/^[a-f0-9]{64}$/.test(s.hash))throw Error();
  if(s.hash!==hash){conflict=true;throw Error();}
  const r=configurationObject(s.result,['workspaceId','actorId','revision','record','auditId','replayed']),record=parseConfigurationRecord(r.record);
  if(r.workspaceId!==p.workspaceId||r.actorId!==p.id||r.replayed!==false||record.workspaceId!==p.workspaceId||record.kind!==cmd.kind||cmd.targetId&&record.id!==cmd.targetId||configurationRevision(r.revision)>state.revision||!state.records.some(x=>x.id===record.id&&x.revision>=record.revision))throw Error();
  return Object.freeze({workspaceId:p.workspaceId,actorId:p.id,revision:configurationRevision(r.revision),record,auditId:uuidIdentifier(r.auditId),replayed:true});
 }catch{throw conflict?fail('configuration_idempotency_conflict',409):fail('invalid_configuration_state',503);}
}
const known:Record<string,number>={administrative_assurance_required:403,administrative_capability_required:403,invalid_administrative_state:503,invalid_configuration_state:503,invalid_configuration_command:400,configuration_idempotency_conflict:409,configuration_version_conflict:412,configuration_cursor_stale:409,configuration_duplicate:409,configuration_reference_ineligible:409,configuration_identity_immutable:409,published_configuration_immutable:409,configuration_not_found:404};
function safe(error:unknown):HelpdeskError{
 try{if(error instanceof HelpdeskError){const code=Object.getOwnPropertyDescriptor(error,'code')?.value,status=Object.getOwnPropertyDescriptor(error,'status')?.value;if(typeof code==='string'&&Object.hasOwn(known,code)&&known[code]===status)return fail(code,status);}}catch{/* no private error data */}
 return fail('invalid_configuration_state',503);
}
/** Named configuration commands: not SQL setters and not source permission grants. */
export function createConfigurationAdministration(options:{store:ConfigurationAdminStore;clock?:()=>string}){
 const clock=options.clock??(()=>new Date().toISOString());
 const now=()=>{const at=clock();if(!isCanonicalInstant(at))throw fail('invalid_configuration_state',503);return at;};
 async function authorized<T>(p:Principal,proof:VerifiedAdministrativeAssurance,cap:AdministrativeCapability,work:(tx:ConfigurationTransaction,state:ConfigurationState,check:()=>void,guard:(fn:()=>void)=>void)=>Promise<T>):Promise<T>{
  assertAdministrativeAssurance(p,proof);let bound:{close():void}|undefined;const extra:(()=>void)[]=[];
  const check=()=>{assertAdministrativeAssurance(p,proof);if(bound)requireAdministrativeCapability(p,cap,proof);extra.forEach(f=>f());};
  try{return await options.store.transaction(p,check,async tx=>{
   check();const admin=parseAdminWorkspace(await tx.readWorkspace());check();bound=bindAdministrativeCapabilities(p,proof,admin,now);check();
   const state=parseConfigurationState(await tx.readConfiguration());check();if(state.workspaceId!==p.workspaceId)throw fail('invalid_configuration_state',503);
   return work(tx,state,check,fn=>extra.push(fn));
  });}finally{bound?.close();}
 }
 async function execute(p:Principal,proof:VerifiedAdministrativeAssurance,raw:unknown,key:string):Promise<ConfigurationReceipt>{
  const cmd=parseConfigurationCommand(raw);if(typeof key!=='string'||!/^[A-Za-z0-9._:-]{16,128}$/.test(key))throw fail('invalid_configuration_command');
  const hash=requestHash({workspaceId:p.workspaceId,actorId:p.id,command:cmd}),cap=(cmd.operation==='publish'?'contracts.publish':family(cmd.kind)+'.write') as AdministrativeCapability;let prepared=false;
  try{return await authorized(p,proof,cap,async(tx,state,check,guard)=>{
   const prior=readReceipt(await tx.getReceipt(key),p,key,hash,cmd,state);check();if(prior)return prior;
   if(state.revision!==cmd.expectedRevision)throw fail('configuration_version_conflict',412);
   const old=cmd.targetId?state.records.find(r=>r.kind===cmd.kind&&r.id===cmd.targetId)??null:null;
   if(cmd.targetId&&!old)throw fail('configuration_not_found',404);
   if(old&&old.revision!==cmd.expectedEntityRevision)throw fail('configuration_version_conflict',412);
   if(old?.kind==='contract_version'&&old.data.published===true)throw fail('published_configuration_immutable',409);
   const data:Record<string,unknown>={...(cmd.operation==='publish'?old!.data:cmd.data)};
   if(cmd.kind==='contract_version'){
    data.version=old?.data.version??configurationRevision(Math.max(0,...state.records.filter(r=>r.kind==='contract_version'&&r.data.contractId===data.contractId).map(r=>Number(r.data.version)))+1);
    data.published=cmd.operation==='publish';
   }
   const fixed:Partial<Record<ConfigurationKind,string[]>>={product:['code'],instance:['productId','environment'],service:['productId','code'],binding:['accountId','productInstanceId','connectionId','tenantId'],contract_version:['contractId'],coverage:['accountId','productInstanceId','serviceId','contractVersionId']};
   if(old&&(fixed[cmd.kind]??[]).some(k=>data[k]!==old.data[k]))throw fail('configuration_identity_immutable',409);
   if(old?.kind==='contract'&&old.data.status==='terminated'&&data.status!=='terminated')throw fail('configuration_identity_immutable',409);
   const parent=(kind:ConfigurationKind,id:unknown)=>{const row=state.records.find(r=>r.kind===kind&&r.id===id);if(!row||row.data.active===false)throw fail('configuration_reference_ineligible',409);return row;};
   if(cmd.kind==='instance'||cmd.kind==='service')parent('product',data.productId);
   if(cmd.kind==='binding'){
    parent('account',data.accountId);parent('instance',data.productInstanceId);
    const c=configurationObject(await tx.readConnection(data.connectionId as string),['id','workspaceId','productInstanceId','active','qualified']);check();
    if(c.id!==data.connectionId||c.workspaceId!==p.workspaceId||c.productInstanceId!==data.productInstanceId||c.active!==true||c.qualified!==true)throw fail('configuration_reference_ineligible',409);
   }
   if(cmd.kind==='contract_version'){
    const contract=parent('contract',data.contractId);if(contract.data.status!=='active')throw fail('configuration_reference_ineligible',409);
    if(cmd.operation==='publish'){
     const policy=configurationObject(await tx.readApprovedPolicy(data.policyRef as string),['reference','workspaceId','active','validFrom','validUntil']);check();
     if(policy.reference!==data.policyRef||policy.workspaceId!==p.workspaceId||policy.active!==true||!isCanonicalInstant(policy.validFrom)||policy.validUntil!==null&&!isCanonicalInstant(policy.validUntil))throw fail('configuration_reference_ineligible',409);
     const valid=()=>{const at=now();if(compareInstants(policy.validFrom as string,at)>0||policy.validUntil!==null&&compareInstants(policy.validUntil as string,at)<=0||data.validUntil!==null&&compareInstants(data.validUntil as string,at)<=0)throw fail('configuration_reference_ineligible',409);};valid();guard(valid);
    }
   }
   if(cmd.kind==='coverage'){
    parent('account',data.accountId);const instance=parent('instance',data.productInstanceId),service=parent('service',data.serviceId),version=parent('contract_version',data.contractVersionId),contract=parent('contract',version.data.contractId);
    if(service.data.productId!==instance.data.productId||version.data.published!==true||contract.data.status!=='active'||compareInstants(data.validFrom as string,version.data.validFrom as string)<0||version.data.validUntil!==null&&(data.validUntil===null||compareInstants(data.validUntil as string,version.data.validUntil as string)>0))throw fail('configuration_reference_ineligible',409);
   }
   const unique:Partial<Record<ConfigurationKind,string[]>>={product:['code'],service:['productId','code'],binding:['connectionId','tenantId']};
   if(unique[cmd.kind]&&state.records.some(r=>r.kind===cmd.kind&&r.id!==old?.id&&unique[cmd.kind]!.every(k=>r.data[k]===data[k])))throw fail('configuration_duplicate',409);
   const record=parseConfigurationRecord({kind:cmd.kind,workspaceId:p.workspaceId,id:old?.id??randomUUID(),revision:configurationRevision((old?.revision??0)+1),data});
   const result:ConfigurationReceipt=Object.freeze({workspaceId:p.workspaceId,actorId:p.id,revision:configurationRevision(state.revision+1),record,auditId:randomUUID(),replayed:false});
   const audit:ConfigurationAudit={id:result.auditId,workspaceId:p.workspaceId,actorId:p.id,action:cmd.action,reason:cmd.reason,at:now(),before:old,after:record};
   check();await tx.commitChange(state.revision,record,audit,{key,workspaceId:p.workspaceId,actorId:p.id,hash,result});check();prepared=true;return result;
  });}catch(e){if(prepared)throw fail('configuration_outcome_unknown',503);throw safe(e);}
 }
 async function list(p:Principal,proof:VerifiedAdministrativeAssurance,raw:unknown){
  try{
   const x=configurationObject(raw,Object.hasOwn(raw as object,'cursor')?['kind','limit','cursor']:['kind','limit']);if(!CONFIGURATION_KINDS.includes(x.kind as ConfigurationKind)||!Number.isSafeInteger(x.limit)||Number(x.limit)<1||Number(x.limit)>100)throw fail('invalid_configuration_command');
   const kind=x.kind as ConfigurationKind;
   return await authorized(p,proof,(family(kind)+'.read') as AdministrativeCapability,async(_tx,state,check)=>{
    let after='';if(x.cursor!==undefined){
     if(typeof x.cursor!=='string'||x.cursor.length>2048||!/^[A-Za-z0-9_-]+$/.test(x.cursor))throw fail('invalid_configuration_command');
     const c=configurationObject(JSON.parse(Buffer.from(x.cursor,'base64url').toString('utf8')),['v','workspaceId','principalId','kind','revision','after']);
     if(c.v!==1||c.workspaceId!==p.workspaceId||c.principalId!==p.id||c.kind!==kind)throw fail('invalid_configuration_command');if(c.revision!==state.revision)throw fail('configuration_cursor_stale',409);after=uuidIdentifier(c.after);
    }
    const all=state.records.filter(r=>r.kind===kind).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0),remaining=all.filter(r=>r.id>after),items=remaining.slice(0,x.limit as number);check();
    return {workspaceId:p.workspaceId,revision:state.revision,total:all.length,items,nextCursor:remaining.length>items.length?Buffer.from(JSON.stringify({v:1,workspaceId:p.workspaceId,principalId:p.id,kind,revision:state.revision,after:items.at(-1)!.id})).toString('base64url'):null};
   });
  }catch(e){throw safe(e);}
 }
 return Object.freeze({execute,list});
}
