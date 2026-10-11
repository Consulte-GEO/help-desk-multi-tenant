import {types} from 'node:util';
import {HelpdeskError} from './errors.ts';
import {uuidIdentifier,isPersistableText} from './input-values.ts';
import {isCanonicalInstant,compareInstants} from '../../shared/instant.js';
export const CONFIGURATION_KINDS=Object.freeze(['account','product','instance','service','binding','contract','contract_version','coverage'] as const);
export type ConfigurationKind=typeof CONFIGURATION_KINDS[number];
export type ConfigurationRecord=Readonly<{kind:ConfigurationKind;workspaceId:string;id:string;revision:number;data:Readonly<Record<string,unknown>>}>;
export type ConfigurationState=Readonly<{workspaceId:string;revision:number;records:readonly ConfigurationRecord[]}>;
export const configurationError=(code:string,status=400)=>new HelpdeskError(status,code,'Configuração incompatível com a operação solicitada.');
export function configurationObject(raw:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||types.isProxy(raw))throw configurationError('invalid_configuration_command');
 const prototype=Object.getPrototypeOf(raw),own=Reflect.ownKeys(raw);
 if(prototype!==Object.prototype&&prototype!==null||own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)))throw configurationError('invalid_configuration_command');
 return Object.fromEntries(keys.map(key=>{const d=Object.getOwnPropertyDescriptor(raw,key);if(!d||!d.enumerable||!Object.hasOwn(d,'value'))throw configurationError('invalid_configuration_command');return [key,d.value];}));
}
export function configurationRevision(value:unknown,min=1):number{if(!Number.isSafeInteger(value)||Number(value)<min)throw configurationError('invalid_configuration_command');return value as number;}
const fields:Record<ConfigurationKind,readonly string[]>={
 account:['name','active'],product:['code','name','active'],instance:['productId','environment','active'],service:['productId','code','name','active'],
 binding:['accountId','productInstanceId','connectionId','tenantId','active'],contract:['name','status'],contract_version:['contractId','validFrom','validUntil','policyRef'],
 coverage:['accountId','productInstanceId','serviceId','contractVersionId','validFrom','validUntil','enabled']
};
function text(v:unknown,max:number):string{if(!isPersistableText(v)||!v||v.length>max||v.trim()!==v||/[\p{Cc}]/u.test(v))throw configurationError('invalid_configuration_command');return v;}
export function configurationData(kind:ConfigurationKind,raw:unknown,stored=false):Readonly<Record<string,unknown>>{
 const x=configurationObject(raw,[...fields[kind],...(stored&&kind==='contract_version'?['version','published']:[])]),out:Record<string,unknown>={};
 for(const [key,value] of Object.entries(x)){
  if(['accountId','productId','productInstanceId','connectionId','contractId','serviceId','contractVersionId'].includes(key))out[key]=uuidIdentifier(value);
  else if(['active','enabled','published'].includes(key)){if(typeof value!=='boolean')throw configurationError('invalid_configuration_command');out[key]=value;}
  else if(key==='version')out[key]=configurationRevision(value);
  else if(key==='validUntil'&&value===null)out[key]=null;
  else if(key==='validFrom'||key==='validUntil'){if(!isCanonicalInstant(value))throw configurationError('invalid_configuration_command');out[key]=value;}
  else if(key==='environment'){if(value!=='production'&&value!=='staging')throw configurationError('invalid_configuration_command');out[key]=value;}
  else if(key==='status'){if(!['active','suspended','terminated'].includes(value as string))throw configurationError('invalid_configuration_command');out[key]=value;}
  else if(key==='code'){const s=text(value,80);if(!/^[A-Za-z0-9._-]+$/.test(s))throw configurationError('invalid_configuration_command');out[key]=s;}
  else out[key]=text(value,key==='name'?160:key==='tenantId'?256:160);
 }
 if(out.validUntil!==undefined&&out.validUntil!==null&&compareInstants(out.validFrom as string,out.validUntil as string)>=0)throw configurationError('invalid_configuration_command');
 return Object.freeze(out);
}
export function parseConfigurationRecord(raw:unknown):ConfigurationRecord{
 const x=configurationObject(raw,['kind','workspaceId','id','revision','data']);if(!CONFIGURATION_KINDS.includes(x.kind as ConfigurationKind))throw configurationError('invalid_configuration_state',503);
 return Object.freeze({kind:x.kind as ConfigurationKind,workspaceId:uuidIdentifier(x.workspaceId),id:uuidIdentifier(x.id),revision:configurationRevision(x.revision),data:configurationData(x.kind as ConfigurationKind,x.data,true)});
}
export function parseConfigurationState(raw:unknown):ConfigurationState{
 try{
  const x=configurationObject(raw,['workspaceId','revision','records']),workspaceId=uuidIdentifier(x.workspaceId);
  if(!Array.isArray(x.records)||types.isProxy(x.records)||x.records.length>5000||Reflect.ownKeys(x.records).length!==x.records.length+1)throw Error();
  const records=Array.from({length:x.records.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(x.records,String(i));if(!d||!Object.hasOwn(d,'value'))throw Error();return parseConfigurationRecord(d.value);});
  if(records.some(r=>r.workspaceId!==workspaceId)||new Set(records.map(r=>r.id)).size!==records.length)throw Error();
  return Object.freeze({workspaceId,revision:configurationRevision(x.revision),records:Object.freeze(records)});
 }catch{throw configurationError('invalid_configuration_state',503);}
}
export const configurationFields=(kind:ConfigurationKind):readonly string[]=>fields[kind];
