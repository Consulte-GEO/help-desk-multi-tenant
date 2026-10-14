import {HelpdeskError} from '../domain/errors.ts';
import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';
import {canonicalJson,requestHash} from '../domain/canonical.ts';
import {CONSULTEGEO_LOCAL_MANIFEST,CONSULTEGEO_LOCAL_MANIFEST_FINGERPRINT} from '../domain/consultegeo-local-manifest.ts';
const invalid=()=>new HelpdeskError(400,'invalid_local_provisioning','Plano local inválido. Revise contas, obras, pessoas existentes, operações, revisão e motivo.');
function fields(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw invalid();
 const own=Reflect.ownKeys(value);if(own.length!==keys.length||own.some(k=>typeof k!=='string'||!keys.includes(k)))throw invalid();
 return Object.fromEntries(keys.map(k=>{const d=Object.getOwnPropertyDescriptor(value,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw invalid();return [k,d.value];}));
}
function array(value:unknown,max:number):unknown[]{
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max||Reflect.ownKeys(value).length!==value.length+1)throw invalid();
 return Array.from({length:value.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw invalid();return d.value;});
}
function text(value:unknown,max:number){if(!isPersistableText(value)||!value.length||value.length>max||value.trim()!==value||/[\u0000-\u001f\u007f-\u009f]/u.test(value))throw invalid();return value;}
function bool(value:unknown){if(typeof value!=='boolean')throw invalid();return value;}
function unique<T>(list:T[],key:(v:T)=>string){if(new Set(list.map(key)).size!==list.length)throw invalid();return list;}
/** One bounded, complete desired snapshot. Offline only: the private SQL operator
 * separately admits real existing humans/scopes and current CAS. No user creation,
 * MFA assertion, credential loading, remote SQL or implied scope grant exists here.
 */
export function planConsulteGeoLocalProvisioning(input:unknown){
 try{
  const x=fields(input,['workspaceId','expectedRegistryRevision','requestId','reason','accounts','works','permissions']);
  if(!Number.isInteger(x.expectedRegistryRevision)||Number(x.expectedRegistryRevision)<0||Number(x.expectedRegistryRevision)>=2147483647)throw invalid();
  const accounts=unique(array(x.accounts,50).map(v=>{const a=fields(v,['accountId','name','productInstanceId','connectionId','bindingId','tenantId','active']);
   return {accountId:uuidIdentifier(a.accountId),name:text(a.name,160),productInstanceId:uuidIdentifier(a.productInstanceId),connectionId:uuidIdentifier(a.connectionId),bindingId:uuidIdentifier(a.bindingId),tenantId:text(a.tenantId,256),active:bool(a.active)};
  }),a=>a.accountId);
  if(new Set(accounts.map(a=>a.bindingId)).size!==accounts.length||new Set(accounts.map(a=>JSON.stringify([a.connectionId,a.tenantId]))).size!==accounts.length)throw invalid();
  const works=unique(array(x.works,1000).map(v=>{const a=fields(v,['accountId','id','name','active']);
   return {accountId:uuidIdentifier(a.accountId),id:text(a.id,256),name:text(a.name,160),active:bool(a.active)};
  }),a=>JSON.stringify([a.accountId,a.id]));
  if(works.some(w=>!accounts.some(a=>a.accountId===w.accountId)))throw invalid();
  const permissions=unique(array(x.permissions,1000).map(v=>{const a=fields(v,['accountId','principalId','role','operation','active','workIds']);
   if(!['requester','account_manager','agent'].includes(a.role as string)||!['tickets.read','tickets.write','notes.read','notes.write'].includes(a.operation as string))throw invalid();
   const accountId=uuidIdentifier(a.accountId),workIds=unique(array(a.workIds,1000).map(id=>text(id,256)),id=>id);
   if(!accounts.some(a=>a.accountId===accountId)||workIds.some(id=>!works.some(w=>w.accountId===accountId&&w.id===id)))throw invalid();
   if((a.operation==='notes.read'||a.operation==='notes.write')&&a.role==='requester')throw invalid();
   return {accountId,principalId:uuidIdentifier(a.principalId),role:a.role as 'requester'|'account_manager'|'agent',operation:a.operation as 'tickets.read'|'tickets.write'|'notes.read'|'notes.write',active:bool(a.active),workIds};
  }),a=>JSON.stringify([a.accountId,a.principalId,a.operation]));
  if(permissions.some(p=>permissions.some(q=>p.accountId===q.accountId&&p.principalId===q.principalId&&p.role!==q.role)))throw invalid();
  const reason=text(x.reason,1000);if(reason.length<3)throw invalid();
  const command={workspaceId:uuidIdentifier(x.workspaceId),expectedRegistryRevision:x.expectedRegistryRevision as number,requestId:uuidIdentifier(x.requestId),reason,
   sourceManifest:CONSULTEGEO_LOCAL_MANIFEST,manifestFingerprint:CONSULTEGEO_LOCAL_MANIFEST_FINGERPRINT,accounts,works,permissions};
  const json=canonicalJson(command);if(Buffer.byteLength(json,'utf8')>16*1024)throw invalid();
  return Object.freeze({executesDatabase:false as const,sql:'select helpdesk_auth.cg_local_provision($1::text,$2::text) as receipt',values:Object.freeze([json,requestHash(command)] as const)});
 }catch{throw invalid();}
}
