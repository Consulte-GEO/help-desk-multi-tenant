import {zonedInstantMicros} from '../../shared/instant.js';
import {canonicalJson} from '../domain/canonical.ts';
import {isPersistableText} from '../domain/input-values.ts';
import {HelpdeskError} from '../domain/errors.ts';
import type {Coverage,Principal} from '../domain/model.ts';
import type {SupportContext} from './ports.ts';

const fields=['id','workspaceId','accountId','productInstanceId','serviceCode','contractId',
 'contractVersionId','contractVersion','contractStatus','enabled','published','validFrom','validUntil','policy'];
const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(v);
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)
 &&Object.getPrototypeOf(v)===Object.prototype;
function invalid():never{throw new HelpdeskError(503,'invalid_coverage_result',
 'Não foi possível validar a cobertura contratual. Tente novamente ou contate a equipe de suporte.');}
/** Same finite JSON/text requirements as persisted policy; bounds are checked before cloning.
 * The ancestor set is removed while unwinding: repeated equal/shared subobjects are legal.
 */
function policyJson(v:unknown,ancestors:Set<object>):void{
 if(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v))return;
 if(typeof v==='string'){if(!isPersistableText(v))invalid();return;}
 if(typeof v!=='object'||(!Array.isArray(v)&&!record(v))||ancestors.has(v))invalid();
 ancestors.add(v);
 if(Array.isArray(v)){
  for(let i=0;i<v.length;i++){if(!Object.hasOwn(v,i))invalid();policyJson(v[i],ancestors);}
 }else{
  for(const [k,value] of Object.entries(v)){if(!isPersistableText(k))invalid();policyJson(value,ancestors);}
 }
 ancestors.delete(v);
}
/** Validate the entire private helper response before selecting or exposing any candidate.
 * This is defense in depth, not a replacement for SQL locks, RLS or authorization.
 * Domain/demo aliases remain allowed; PostgreSQL selectors stay UUID-only in the adapter.
 */
export function validateCoverageResult(value:unknown,p:Principal,context:SupportContext):Coverage[]{
 if(!Array.isArray(value)||value.length>100)invalid();
 const result:Coverage[]=[];const ids=new Set<string>();
 for(let i=0;i<value.length;i++){
  if(!Object.hasOwn(value,i))invalid();const r:unknown=value[i];
  if(!record(r)||fields.some(k=>!Object.hasOwn(r,k))||Object.keys(r).some(k=>!fields.includes(k)))invalid();
  for(const k of ['id','workspaceId','accountId','productInstanceId','contractId','contractVersionId'])if(!id(r[k]))invalid();
  if(r.workspaceId!==p.workspaceId||r.accountId!==context.accountId||r.productInstanceId!==context.productInstanceId
   ||r.serviceCode!==context.serviceCode||!isPersistableText(r.serviceCode)||!r.serviceCode.trim()||[...r.serviceCode].length>80
   ||typeof r.enabled!=='boolean'||typeof r.published!=='boolean'
   ||!['active','suspended','terminated'].includes(r.contractStatus as string)
   ||!Number.isSafeInteger(r.contractVersion)||Number(r.contractVersion)<1||!record(r.policy))invalid();
  const start=zonedInstantMicros(r.validFrom),end=r.validUntil===null?null:zonedInstantMicros(r.validUntil);
  if(start===undefined||end===undefined||end!==null&&end<=start||ids.has(r.id as string))invalid();
  try{
   policyJson(r.policy,new Set());
   if(Buffer.byteLength(canonicalJson(r.policy),'utf8')>16384)invalid();
  }catch{invalid();}
  ids.add(r.id as string);result.push(structuredClone(r) as unknown as Coverage);
 }
 return result;
}
