import {requestHash} from '../domain/canonical.ts';
import {HelpdeskError,deny} from '../domain/errors.ts';
import type {Principal} from '../domain/model.ts';
import {canAccessAccount,canUseProduct,hasScope} from '../domain/policy.ts';
import type {UnitOfWork} from './ports.ts';

/** Public-facing names only: no policy, grants, contracts or diagnostic payloads. */
export type SupportCatalogEntry={
 workspaceId:string;accountId:string;accountName:string;productInstanceId:string;
 productName:string;environment:'development'|'staging'|'production';serviceCode:string;serviceName:string;
};
export type ContextKey=Pick<SupportCatalogEntry,'accountId'|'productInstanceId'|'serviceCode'>;
export type CatalogOptions={limit:number;cursor?:string;accountId?:string};
export type CatalogWindow={limit:number;after:ContextKey|null;accountId?:string};
export type CatalogPage={items:SupportCatalogEntry[];nextCursor:string|null};
const idPattern=/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const codeValid=(v:unknown):v is string=>typeof v==='string'&&v.length>=1&&[...v].length<=80&&v.trim().length>0&&!/\p{Cc}/u.test(v);
const idValid=(v:unknown):v is string=>typeof v==='string'&&idPattern.test(v);
const nameValid=(v:unknown):v is string=>typeof v==='string'&&[...v].length<=160&&v.trim().length>0&&!/\p{Cc}/u.test(v);
/** PostgreSQL UUID order (canonical lowercase IDs) and service_code COLLATE "C" (UTF-8). */
export function compareContext(a:ContextKey,b:ContextKey):number{
 for(const key of ['accountId','productInstanceId','serviceCode'] as const){const order=Buffer.compare(Buffer.from(a[key]),Buffer.from(b[key]));if(order)return order;}
 return 0;
}
function invalidResult():never{throw new HelpdeskError(503,'invalid_catalog_result','Não foi possível carregar as opções de atendimento.');}
function project(value:unknown,p:Principal,window:CatalogWindow):SupportCatalogEntry{
 if(!value||typeof value!=='object'||Array.isArray(value))invalidResult();
 const r=value as Record<string,unknown>;
 if(!idValid(r.workspaceId)||!idValid(r.accountId)||!idValid(r.productInstanceId)||!codeValid(r.serviceCode)
   ||!nameValid(r.accountName)||!nameValid(r.productName)||!nameValid(r.serviceName)
   ||typeof r.environment!=='string'||!['development','staging','production'].includes(String(r.environment)))invalidResult();
 if(r.workspaceId!==p.workspaceId||!canAccessAccount(p,r.workspaceId,r.accountId)||!canUseProduct(p,r.productInstanceId)
   ||window.accountId!==undefined&&r.accountId!==window.accountId)invalidResult();
 return {workspaceId:r.workspaceId,accountId:r.accountId,accountName:r.accountName,productInstanceId:r.productInstanceId,
  productName:r.productName,environment:r.environment as SupportCatalogEntry['environment'],serviceCode:r.serviceCode,serviceName:r.serviceName};
}
function parseOptions(p:Principal,options:CatalogOptions):{window:CatalogWindow;scope:string}{
 if(!Number.isInteger(options.limit)||options.limit<1||options.limit>100||options.accountId!==undefined&&!idValid(options.accountId))
  throw new HelpdeskError(400,'invalid_input','Use limite entre 1 e 100 e uma conta válida.');
 const scope=requestHash({resource:'support-contexts.v1',workspace:p.workspaceId,principal:p.id,account:options.accountId??null});
 let after:ContextKey|null=null;
 if(options.cursor!==undefined){try{
  if(!options.cursor.length||options.cursor.length>1600||!/^[A-Za-z0-9_-]+$/.test(options.cursor))throw Error();
  const bytes=Buffer.from(options.cursor,'base64url');if(bytes.toString('base64url')!==options.cursor)throw Error();
  const c=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!c||Object.keys(c).sort().join(',')!=='account,instance,scope,service,v'||c.v!==1||c.scope!==scope
   ||!idValid(c.account)||!idValid(c.instance)||!codeValid(c.service))throw Error();
  after={accountId:c.account,productInstanceId:c.instance,serviceCode:c.service};
 }catch{throw new HelpdeskError(400,'invalid_cursor','Cursor inválido para este contexto.');}}
 return {window:{limit:options.limit+1,after,...(options.accountId!==undefined?{accountId:options.accountId}:{})},scope};
}
/** Discovery is advisory. Ticket creation still locks/revalidates contractual coverage. */
export async function discoverSupportContexts(db:UnitOfWork,clock:()=>Date,p:Principal,options:CatalogOptions):Promise<CatalogPage>{
 if(!hasScope(p,'contexts:resolve'))throw new HelpdeskError(403,'forbidden','Operação não autorizada.');
 if(options.accountId!==undefined&&!canAccessAccount(p,p.workspaceId,options.accountId))deny();
 const {window,scope}=parseOptions(p,options);
 return db.run(p,async store=>{
  // Clock sampled after entering the unit of work. SQL uses its statement clock for live eligibility.
  const source=await store.supportContexts(window,clock().toISOString());
  if(!Array.isArray(source)||source.length>window.limit)invalidResult();
  const rows=source.map(r=>project(r,p,window));let previous=window.after;
  for(const row of rows){if(previous&&compareContext(previous,row)>=0)invalidResult();previous=row;}
  const items=rows.slice(0,options.limit),last=items.at(-1);
  const nextCursor=rows.length>options.limit&&last?Buffer.from(JSON.stringify({v:1,account:last.accountId,instance:last.productInstanceId,service:last.serviceCode,scope})).toString('base64url'):null;
  return {items,nextCursor};
 });
}
