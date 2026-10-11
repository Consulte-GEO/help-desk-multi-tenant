import type {Principal} from '../domain/model.ts';import {statuses} from '../domain/model.ts';
import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';
import {canAccessAccount,isOperator} from '../domain/policy.ts';
import {requestHash} from '../domain/canonical.ts';import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {instantMicros} from '../domain/business-calendar.ts';import {compareInstants,isCanonicalInstant} from '../../shared/instant.js';
import {parsePortalFilter,portalFilterHash,createPortalCursorCodec,portalError,type PortalFilter,type PortalAfter} from '../domain/portal-query.ts';
import {runTransaction} from '../infrastructure/transaction.ts';import type {SqlClient,SqlPool} from '../infrastructure/sql.ts';
export type PortalCapability='portal.read'|'queue.read'|'reports.read'|'reports.export';
export type PortalAccess=Readonly<{principalId:string;workspaceId:string;accountId:string;view:PortalFilter['view'];capability:PortalCapability;revision:string;expiresAt:string}>;
/** SERVER-only adapter: qualify source identity, account/view capability and CURRENT
 * resource revisions. Implement no default grant from a role, email or HTTP input. */
export interface PortalAuthority{readAccess(p:Principal,filter:PortalFilter,capability:PortalCapability,signal?:AbortSignal):Promise<unknown>}
export interface PortalReadStore{
 assertReady():Promise<void>;
 /** Must enforce ACL BEFORE filtering/LIMIT/aggregate, in this borrowed transaction.
  * Return the complete count independent of this page. No private notes/content. */
 query(p:Principal,filter:PortalFilter,after:PortalAfter|null,limit:number,asOf:string):Promise<unknown>;
}
export type PortalRow=Readonly<{id:string;accountId:string;productInstanceId:string;createdBy:string;assignedTo:string|null;subject:string;status:string;priority:string;version:number;createdAt:string;updatedAt:string}>;
function data(raw:unknown,keys:readonly string[]):Record<string,unknown>{if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error();const proto=Object.getPrototypeOf(raw);if(proto!==Object.prototype&&proto!==null)throw Error();if(Reflect.ownKeys(raw).length!==keys.length)throw Error();return Object.fromEntries(keys.map(k=>{const d=Object.getOwnPropertyDescriptor(raw,k);if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw Error();return [k,d.value];}));}
const natural=(n:unknown)=>{if(!Number.isSafeInteger(n)||Number(n)<0)throw Error();return n as number;};
function parseSnapshot(raw:unknown,p:Principal,f:PortalFilter,limit:number,asOf:string,after:PortalAfter|null){try{
 const s=data(raw,['source','complete','asOf','total','counts','items']);if(s.source!=='postgres-core'||s.complete!==true||s.asOf!==asOf)throw Error();const total=natural(s.total),c=data(s.counts,['open','waitingCustomer','resolvedOrClosed30d','cancelled']);
 for(const value of Object.values(c))if(natural(value)>total)throw Error();if(Number(c.waitingCustomer)>Number(c.open)||Number(c.open)+Number(c.cancelled)+Number(c.resolvedOrClosed30d)>total)throw Error();
 if(!Array.isArray(s.items)||s.items.length>limit||s.items.length>total||Reflect.ownKeys(s.items).length!==s.items.length+1)throw Error();let previous=after;const seen=new Set<string>();
 const items=Array.from({length:s.items.length},(_,i)=>{const d=Object.getOwnPropertyDescriptor(s.items!,String(i));if(!d||!Object.hasOwn(d,'value'))throw Error();const r=copyFormData(data(d.value,['id','accountId','productInstanceId','createdBy','assignedTo','subject','status','priority','version','createdAt','updatedAt'])) as unknown as PortalRow;
  for(const field of ['id','accountId','productInstanceId','createdBy'] as const)uuidIdentifier(r[field]);if(r.assignedTo!==null)uuidIdentifier(r.assignedTo);
  if(r.accountId!==f.accountId||f.view==='mine'&&r.createdBy!==p.id||seen.has(r.id)||!isPersistableText(r.subject)||r.subject.length>200||r.subject.length<3||!(statuses as readonly string[]).includes(r.status)||!['low','normal','high','urgent'].includes(r.priority)||natural(r.version)<1||!isCanonicalInstant(r.createdAt)||!isCanonicalInstant(r.updatedAt)||compareInstants(r.createdAt,asOf)>0||compareInstants(r.updatedAt,r.createdAt)<0)throw Error();
  if(previous&&(compareInstants(r.createdAt,previous.at)>0||compareInstants(r.createdAt,previous.at)===0&&r.id>=previous.id))throw Error();
  if(f.statuses.length&&!f.statuses.includes(r.status)||f.priorities.length&&!f.priorities.includes(r.priority)||f.from&&compareInstants(r.createdAt,f.from)<0||f.until&&compareInstants(r.createdAt,f.until)>=0||f.assignment==='mine'&&r.assignedTo!==p.id||f.assignment==='unassigned'&&r.assignedTo!==null)throw Error();
  previous={at:r.createdAt,id:r.id};seen.add(r.id);return freezeFormData(r);
 });return {total,counts:c as unknown as {open:number;waitingCustomer:number;resolvedOrClosed30d:number;cancelled:number},items,asOf,source:'postgres-core' as const};
 }catch{throw portalError('invalid_portal_result');}}
function publicRow(r:PortalRow,team:boolean){const status=r.status==='waiting_customer'?'waiting_for_you':r.status==='resolved'?'resolved':r.status==='closed'||r.status==='cancelled'?'closed':r.status==='new'||r.status==='triage'?'received':'in_progress';
 return freezeFormData({id:r.id,accountId:r.accountId,subject:r.subject,status,priority:r.priority,version:r.version,createdAt:r.createdAt,updatedAt:r.updatedAt,protocol:null,resources:{availability:'unavailable'},sla:{availability:'unavailable'},actions:[],...(team?{internalStatus:r.status,assignedTo:r.assignedTo}:{})});}
export function createPortalReader(o:{pool:SqlPool;authority:PortalAuthority;cursorKey:Uint8Array;clock:()=>string;timeoutMs?:number;createStore:(client:SqlClient)=>PortalReadStore}){
 const codec=createPortalCursorCodec(o.cursorKey,o.clock),timeout=o.timeoutMs??5000;if(!Number.isInteger(timeout)||timeout<1||timeout>10000)throw portalError('portal_configuration');
 async function read(person:Principal,raw:unknown,capability:PortalCapability,limit:number,cursor:string|null,signal?:AbortSignal){
  const f=parsePortalFilter(raw),p=freezeFormData(copyFormData(person)) as Principal;
  if(p.kind!=='human'||!p.scopes.includes('tickets:read')||!canAccessAccount(p,p.workspaceId,f.accountId)||f.view==='team'&&!isOperator(p,p.workspaceId,f.accountId))throw portalError('portal_access_denied',403);
  const parseGrant=(raw:unknown):PortalAccess=>{try{const g=copyFormData(data(raw,['principalId','workspaceId','accountId','view','capability','revision','expiresAt'])) as unknown as PortalAccess;if(g.principalId!==p.id||g.workspaceId!==p.workspaceId||g.accountId!==f.accountId||g.view!==f.view||g.capability!==capability||typeof g.revision!=='string'||!g.revision||g.revision.length>160||instantMicros(g.expiresAt)<=instantMicros(o.clock()))throw Error();return g;}catch{throw portalError('portal_access_denied',403);}};
  const access=async()=>{
   if(signal?.aborted)throw portalError('request_cancelled',409);
   const controller=new AbortController(),deadline=performance.now()+timeout;let reject!: (e:unknown)=>void;
   const stopped=new Promise<never>((_,r)=>{reject=r;});
   const cancel=()=>{controller.abort();reject(portalError('request_cancelled',409));};
   const timer=setTimeout(()=>{controller.abort();reject(portalError());},timeout);signal?.addEventListener('abort',cancel,{once:true});
   try{const result=await Promise.race([Promise.resolve().then(()=>o.authority.readAccess(p,f,capability,controller.signal)),stopped]);
    if(signal?.aborted)throw portalError('request_cancelled',409);if(performance.now()>=deadline)throw portalError();return parseGrant(result);
   }catch(e){if(signal?.aborted)throw portalError('request_cancelled',409);if(e&&typeof e==='object'&&Object.getOwnPropertyDescriptor(e,'code')?.value==='portal_access_denied')throw portalError('portal_access_denied',403);throw portalError();}
   finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);controller.abort();}
  };
  const first=await access();let validUntil=first.expiresAt,previous=instantMicros(o.clock());const check=()=>{const now=instantMicros(o.clock());if(signal?.aborted)throw portalError('request_cancelled',409);if(now<previous||now>=instantMicros(validUntil))throw portalError('portal_access_changed',412);previous=now;};check();
  const context={principalId:p.id,workspaceId:p.workspaceId,filterHash:portalFilterHash(f),accessRevision:first.revision};const after=cursor===null?null:codec.open(cursor,context),asOf=o.clock();
  const result=await runTransaction(o.pool,p,async c=>{const store=o.createStore(c);await store.assertReady();check();const snapshot=parseSnapshot(await store.query(p,f,after,limit,asOf),p,f,limit,asOf,after);check();const last=await access();if(instantMicros(last.expiresAt)<instantMicros(validUntil))validUntil=last.expiresAt;check();if(requestHash({...last,expiresAt:null})!==requestHash({...first,expiresAt:null}))throw portalError('portal_access_changed',412);return snapshot;},check);
  return {result,context,filter:f};
 }
 return Object.freeze({
  async readQueue(p:Principal,f:unknown,options:{limit?:number;cursor?:string|null}={},signal?:AbortSignal){const limit=options.limit??25;if(!Number.isSafeInteger(limit)||limit<1||limit>100)throw portalError('invalid_portal_filter',400);const raw=parsePortalFilter(f),r=await read(p,raw,raw.view==='team'?'queue.read':'portal.read',limit+1,options.cursor??null,signal);const page=r.result.items.slice(0,limit),last=page.at(-1);return {items:page.map(x=>publicRow(x,raw.view==='team')),total:r.result.total,asOf:r.result.asOf,nextCursor:r.result.items.length>limit&&last?codec.seal({at:last.createdAt,id:last.id},r.context):null,source:r.result.source};},
  async readCockpit(p:Principal,f:unknown,signal?:AbortSignal){const r=await read(p,f,'portal.read',1,null,signal);return {total:r.result.total,...r.result.counts,asOf:r.result.asOf,source:r.result.source,universe:'complete_authorized_query',overdue:{availability:'unavailable',value:null},scope:r.filter.view};},
  async readOperationalReport(p:Principal,f:unknown,signal?:AbortSignal){const r=await read(p,f,'reports.read',1,null,signal);return {total:r.result.total,...r.result.counts,asOf:r.result.asOf,filter:r.filter,universe:'complete_authorized_query',metrics:{firstHumanResponse:{availability:'unavailable',value:null},solutionTime:{availability:'unavailable',value:null},csat:{availability:'unavailable',value:null},knowledge:{availability:'unavailable',value:null},development:{availability:'unavailable',value:null}}};},
  async readExportRows(p:Principal,f:unknown,signal?:AbortSignal){const r=await read(p,f,'reports.export',10001,null,signal);if(r.result.total>10000)throw portalError('portal_export_limit',422);if(r.result.items.length!==r.result.total)throw portalError('portal_export_incomplete');return {items:r.result.items.map(x=>publicRow(x,false)),total:r.result.total,asOf:r.result.asOf,filter:r.filter,accessRevision:r.context.accessRevision};}
 });
}
