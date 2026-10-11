import type {Principal} from './model.ts';
import {HelpdeskError} from './errors.ts';
import {uuidIdentifier,isPersistableText} from './input-values.ts';
import {compareInstants,isCanonicalInstant} from '../../shared/instant.js';
import {assertAdministrativeAssurance,type VerifiedAdministrativeAssurance} from '../infrastructure/authentication.ts';

export const ADMIN_CAPABILITIES=Object.freeze(['members.read','members.invite','members.write','members.revoke','members.succession','accounts.read','accounts.write','bindings.read','bindings.write','catalog.read','catalog.write','contracts.read','contracts.write','contracts.publish','forms.read','forms.write','forms.publish','knowledge.read','knowledge.write','knowledge.publish','release.read','release.prepare','release.pilot','release.accept','release.contain'] as const);
export type AdministrativeCapability=typeof ADMIN_CAPABILITIES[number];
export type AdministrativeCapabilityGrant=Readonly<{
 id:string;workspaceId:string;principalId:string;capability:AdministrativeCapability;revision:number;
 reason:string;policyRef:string;approvedBy:string;expiresAt:string|null;active:boolean;
}>;
export type AdminMember=Readonly<{principalId:string;principalKind:'human';role:'admin'|'agent';status:'active'|'invited'|'revoked';revision:number;expiresAt:string|null}>;
export type AdminWorkspace=Readonly<{workspaceId:string;revision:number;members:readonly AdminMember[];capabilityGrants:readonly AdministrativeCapabilityGrant[]}>;
export const adminDenied=()=>new HelpdeskError(403,'administrative_capability_required','Ação administrativa não autorizada para esta pessoa.');
export const adminInvalid=()=>new HelpdeskError(503,'invalid_administrative_state','Não foi possível validar a configuração administrativa.');
export function exactAdminRecord(input:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw adminInvalid();
 const proto=Object.getPrototypeOf(input),actual=Reflect.ownKeys(input);
 if(proto!==Object.prototype&&proto!==null||actual.length!==keys.length||actual.some(k=>typeof k!=='string'||!keys.includes(k)))throw adminInvalid();
 return Object.fromEntries(keys.map(k=>{const d=Object.getOwnPropertyDescriptor(input,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw adminInvalid();return [k,d.value];}));
}
function list(input:unknown,max:number):unknown[]{
 if(!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype||input.length>max||Reflect.ownKeys(input).length!==input.length+1)throw adminInvalid();
 return Array.from({length:input.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(input,String(i));if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw adminInvalid();return d.value;});
}
export function adminRevision(v:unknown):number{if(!Number.isSafeInteger(v)||Number(v)<1)throw adminInvalid();return v as number;}
function expiry(v:unknown):string|null{if(v===null||isCanonicalInstant(v))return v;throw adminInvalid();}
function text(v:unknown,max:number):string{if(!isPersistableText(v)||!v.trim()||v.length>max||/[\p{Cc}]/u.test(v))throw adminInvalid();return v;}
export function parseAdminMember(raw:unknown):AdminMember{
 const x=exactAdminRecord(raw,['principalId','principalKind','role','status','revision','expiresAt']);
 if(x.principalKind!=='human'||!['admin','agent'].includes(x.role as string)||!['active','invited','revoked'].includes(x.status as string))throw adminInvalid();
 return Object.freeze({principalId:uuidIdentifier(x.principalId),principalKind:'human',role:x.role as AdminMember['role'],status:x.status as AdminMember['status'],revision:adminRevision(x.revision),expiresAt:expiry(x.expiresAt)});
}
export function parseAdminWorkspace(raw:unknown):AdminWorkspace{
 try{
  const x=exactAdminRecord(raw,['workspaceId','revision','members','capabilityGrants']),workspaceId=uuidIdentifier(x.workspaceId);
  const members=list(x.members,5000).map(parseAdminMember);
  if(new Set(members.map(m=>m.principalId)).size!==members.length)throw adminInvalid();
  const grants=list(x.capabilityGrants,25000).map(item=>{
   const g=exactAdminRecord(item,['id','workspaceId','principalId','capability','revision','reason','policyRef','approvedBy','expiresAt','active']);
   if(!ADMIN_CAPABILITIES.includes(g.capability as AdministrativeCapability)||typeof g.active!=='boolean'||g.workspaceId!==workspaceId)throw adminInvalid();
   return Object.freeze({id:uuidIdentifier(g.id),workspaceId,principalId:uuidIdentifier(g.principalId),capability:g.capability as AdministrativeCapability,revision:adminRevision(g.revision),reason:text(g.reason,2000),policyRef:text(g.policyRef,160),approvedBy:uuidIdentifier(g.approvedBy),expiresAt:expiry(g.expiresAt),active:g.active});
  });
  if(new Set(grants.map(g=>g.id)).size!==grants.length)throw adminInvalid();
  return Object.freeze({workspaceId,revision:adminRevision(x.revision),members:Object.freeze(members),capabilityGrants:Object.freeze(grants)});
 }catch{throw adminInvalid();}
}
export function memberIsCurrent(m:AdminMember,at:string):boolean{return m.status==='active'&&(m.expiresAt===null||compareInstants(m.expiresAt,at)>0);}
export function memberHasCapability(state:AdminWorkspace,id:string,cap:AdministrativeCapability,at:string):boolean{
 return state.capabilityGrants.some(g=>g.principalId===id&&g.capability===cap&&g.active&&(g.expiresAt===null||compareInstants(g.expiresAt,at)>0));
}
type Scope={principal:Principal;state:AdminWorkspace;clock:()=>string;previous:string;active:boolean};
const live=new WeakMap<object,Scope>();
/** Three-argument public guard from CG04. Only an active SERVER transaction binding
 * can supply capability data; a JSON Boolean/proof/role or business scope cannot.
 */
export function requireAdministrativeCapability(p:Principal,capability:string,proof:VerifiedAdministrativeAssurance):void{
 assertAdministrativeAssurance(p,proof);
 const scope=live.get(proof);
 if(!scope||!scope.active||scope.principal!==p||!ADMIN_CAPABILITIES.includes(capability as AdministrativeCapability))throw adminDenied();
 try{
  const now=scope.clock();
  if(!isCanonicalInstant(now)||compareInstants(now,scope.previous)<0)throw adminInvalid();scope.previous=now;
  const member=scope.state.members.find(m=>m.principalId===p.id);
  if(scope.state.workspaceId!==p.workspaceId||!member||member.role!=='admin'||!memberIsCurrent(member,now)||!memberHasCapability(scope.state,p.id,capability as AdministrativeCapability,now))throw adminDenied();
 }catch(e){scope.active=false;if(e instanceof HelpdeskError)throw e;throw adminInvalid();}
}
/** Internal to server-side member commands: call after reading a LOCKED workspace
 * snapshot; retain the binding through the store's actual commit admission check.
 * No route accepts snapshot or grants. No administrative grant is created here.
 */
export function bindAdministrativeCapabilities(p:Principal,proof:VerifiedAdministrativeAssurance,state:AdminWorkspace,clock:()=>string):{close():void}{
 assertAdministrativeAssurance(p,proof);
 if(live.has(proof)||state.workspaceId!==p.workspaceId)throw adminDenied();
 const at=clock();if(!isCanonicalInstant(at))throw adminInvalid();
 const scope:Scope={principal:p,state,clock,previous:at,active:true};live.set(proof,scope);
 return {close(){scope.active=false;if(live.get(proof)===scope)live.delete(proof);}};
}
