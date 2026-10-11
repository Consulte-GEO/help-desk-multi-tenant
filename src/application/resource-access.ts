import type {Principal, Role} from '../domain/model.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {isPersistableText, uuidIdentifier} from '../domain/input-values.ts';
import {parseScopeList} from '../domain/scopes.ts';
import {canAccessAccount, isOperator} from '../domain/policy.ts';
import {requestHash} from '../domain/canonical.ts';
import {parseExternalResourceSelection, externalResourceSelectionKey,
  requireCompleteResourceCoverage, type ExternalResourceRef} from '../domain/external-resource.ts';
import {isCanonicalInstant, zonedInstantMicros} from '../../shared/instant.js';

const requiredScopes = Object.freeze({
  'contexts.resolve': ['contexts:resolve'],
  'tickets.read': ['tickets:read'],
  'tickets.write': ['tickets:read', 'tickets:write'],
  'notes.read': ['tickets:read', 'notes:read'],
  'notes.write': ['tickets:read', 'notes:write'],
});
export type ResourceOperation = keyof typeof requiredScopes;
export type ResourceAccessQuery = Readonly<{
  principalId:string; workspaceId:string; connectionId:string; tenantId:string;
  operation:ResourceOperation; refs:readonly ExternalResourceRef[];
}>;
/** Construction-time SERVER port, never a callback or response supplied by HTTP.
 * The real adapter must qualify CG01's manifest and verify external identity,
 * binding, live permissions and revision. No adapter or fallback is supplied here.
 * Return null for revoked/absent access. Return the normalized internal envelope
 * documented in CG03B, NOT a raw Novo GEO response or a client-approved boolean.
 */
export interface ResourceAccessAuthority {
  readAccess(query:ResourceAccessQuery, signal:AbortSignal):Promise<unknown>;
}
declare const resourceScopeBrand:unique symbol;
/** In-process, resolver-owned handle. JSON serialization is NOT authorization. */
export type VerifiedRequestScope = Readonly<{[resourceScopeBrand]:true}>;
declare const activeResourceScopeBrand:unique symbol;
/** Lexical lease, valid only during the awaited consumer callback. Never serializable authority. */
export type ActiveResourceScope = Readonly<{[activeResourceScopeBrand]:true}>;
export type ResourceScopeContext = Readonly<{
  principalId:string; workspaceId:string; accountId:string; bindingId:string;
  bindingRevision:string; accessRevision:string; manifestFingerprint:string;
  operation:ResourceOperation; asOf:string; expiresAt:string;
  refs:readonly ExternalResourceRef[];
}>;
type Options = {
  authority:ResourceAccessAuthority; manifestFingerprint:string;
  maxAgeMicros:bigint; timeoutMs:number; clock?:()=>string;
};
type Binding = {id:string; accountId:string; workspaceId:string; connectionId:string;
  tenantId:string; revision:string; active:boolean};
type Access = {principal:Principal; binding:Binding; operation:ResourceOperation; manifestFingerprint:string;
  accessRevision:string; asOf:string; expiresAt:string; resources:unknown};
type Tick = {text:string; value:bigint};
type Decision = {context:ResourceScopeContext; stamp:string; checked:Tick};
type Owned = {principal:Principal; query:ResourceAccessQuery; key:string; decision:Decision};
const denied = ()=>new HelpdeskError(403,'resource_scope_denied',
  'Acesso ao conjunto de recursos não autorizado ou alterado. Consulte novamente.');
const unavailable = ()=>new HelpdeskError(503,'resource_scope_unavailable',
  'Não foi possível confirmar o acesso atual aos recursos. Nenhuma ação foi iniciada.');

/** Exact data descriptors: no getters, toJSON, hidden fields or inherited claims. */
function fields(input:unknown, expected:readonly string[]):Record<string,unknown> {
  if(!input||typeof input!=='object'||Array.isArray(input))throw unavailable();
  const proto=Object.getPrototypeOf(input),keys=Reflect.ownKeys(input);
  if((proto!==Object.prototype&&proto!==null)||keys.length!==expected.length
    ||keys.some(key=>typeof key!=='string'||!expected.includes(key)))throw unavailable();
  const result:Record<string,unknown>={};
  for(const key of expected){
    const d=Object.getOwnPropertyDescriptor(input,key);
    if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw unavailable();
    result[key]=d.value;
  }
  return result;
}
function array(input:unknown,max:number):unknown[] {
  if(!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype)throw unavailable();
  const length=Object.getOwnPropertyDescriptor(input,'length')?.value;
  if(!Number.isSafeInteger(length)||length<0||length>max||Reflect.ownKeys(input).length!==length+1)throw unavailable();
  const result:unknown[]=[];
  for(let i=0;i<length;i++){
    const d=Object.getOwnPropertyDescriptor(input,String(i));
    if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw unavailable();
    result.push(d.value);
  }
  return result;
}
function opaque(value:unknown):string {
  if(!isPersistableText(value)||!value.length||value.length>256||value.trim()!==value
    ||/[\u0000-\u001f\u007f-\u009f]/u.test(value))throw unavailable();
  return value;
}
function fingerprint(value:unknown):string {
  if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))throw unavailable();
  return value;
}
function instant(value:unknown):string {
  if(!isCanonicalInstant(value))throw unavailable();
  return value;
}
function micros(value:string):bigint {return zonedInstantMicros(value)!;}
function principalData(input:unknown):Principal {
  const p=fields(input,['id','workspaceId','kind','workspaceRole','grants','scopes']);
  if(p.kind!=='human'||![null,'admin','agent'].includes(p.workspaceRole as null|string))throw unavailable();
  const grants=array(p.grants,1000).map(raw=>{
    const g=fields(raw,['accountId','role']);
    if(!['requester','account_manager','agent'].includes(g.role as string))throw unavailable();
    return {accountId:uuidIdentifier(g.accountId),role:g.role as Role};
  }).sort((a,b)=>a.accountId.localeCompare(b.accountId));
  if(new Set(grants.map(g=>g.accountId)).size!==grants.length)throw unavailable();
  return {id:uuidIdentifier(p.id),workspaceId:uuidIdentifier(p.workspaceId),kind:'human',
    workspaceRole:p.workspaceRole as Principal['workspaceRole'],grants,
    scopes:parseScopeList(array(p.scopes,5)).sort()};
}
function caller(input:Principal):Principal {
  try{return principalData(input);}catch{throw denied();}
}
function operation(input:string):ResourceOperation {
  if(typeof input!=='string'||!Object.hasOwn(requiredScopes,input))throw new HelpdeskError(400,
    'invalid_resource_operation','Operação de recurso inválida.');
  return input as ResourceOperation;
}
function accessData(input:unknown):Access {
  try{
    const a=fields(input,['principal','binding','operation','manifestFingerprint','accessRevision','asOf','expiresAt','resources']);
    const b=fields(a.binding,['id','accountId','workspaceId','connectionId','tenantId','revision','active']);
    if(typeof b.active!=='boolean')throw unavailable();
    return {operation:operation(a.operation as string),principal:principalData(a.principal),binding:{id:uuidIdentifier(b.id),accountId:uuidIdentifier(b.accountId),
      workspaceId:uuidIdentifier(b.workspaceId),connectionId:uuidIdentifier(b.connectionId),tenantId:opaque(b.tenantId),
      revision:opaque(b.revision),active:b.active},manifestFingerprint:fingerprint(a.manifestFingerprint),
      accessRevision:opaque(a.accessRevision),asOf:instant(a.asOf),expiresAt:instant(a.expiresAt),resources:a.resources};
  }catch{throw unavailable();}
}

/** Local backend engine only. No production factory invocation exists in this slice.
 * It is additional resource authorization, NEVER a replacement for ticket ownership,
 * SQL RLS, product/coverage checks, notes separation, MFA or administrative capability.
 * A store must still revalidate authorization and revisions IN its transaction.
 */
export function createResourceAccessResolver(options:Options) {
  if(!options||typeof options.authority?.readAccess!=='function'||typeof options.maxAgeMicros!=='bigint'
    ||options.maxAgeMicros<=0n||!Number.isInteger(options.timeoutMs)||options.timeoutMs<1||options.timeoutMs>10_000
    ||(options.clock!==undefined&&typeof options.clock!=='function'))throw unavailable();
  const expectedManifest=fingerprint(options.manifestFingerprint),maxAge=options.maxAgeMicros,
    timeout=options.timeoutMs,clock=options.clock??(()=>new Date().toISOString()),
    read=options.authority.readAccess.bind(options.authority);
  const owned=new WeakMap<object,Owned>();
  const active=new WeakMap<object,{principal:Principal; personHash:string; context:ResourceScopeContext;
    original:ResourceScopeContext; last:bigint; signal:AbortSignal|undefined}>();
  function now(previous?:bigint):Tick {
    try{const text=instant(clock()),value=micros(text);if(previous!==undefined&&value<previous)throw unavailable();return {text,value};}
    catch{throw unavailable();}
  }
  function fresh(asOf:string,expiresAt:string,at:bigint):void {
    const start=micros(asOf),end=micros(expiresAt);
    if(start>at||end<=at||end<=start||at-start>maxAge)throw denied();
  }
  async function lookup(query:ResourceAccessQuery, signal?:AbortSignal):Promise<unknown> {
    if(signal?.aborted)throw unavailable();
    const deadline=performance.now()+timeout;
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
    let abort=()=>{};
    const stop=new Promise<never>((_resolve,reject)=>{
      abort=()=>{controller.abort();reject(unavailable());};
      timer=setTimeout(abort,timeout);signal?.addEventListener('abort',abort,{once:true});
    });
    try{
      // A source that ignores abort may finish later, but can never issue a decision.
      const value=await Promise.race([Promise.resolve().then(()=>{
        if(controller.signal.aborted||performance.now()>=deadline){controller.abort();throw unavailable();}
        return read(query,controller.signal);
      }),stop]);
      // A blocked event loop can settle the source before an overdue timer runs.
      if(controller.signal.aborted||signal?.aborted||performance.now()>=deadline){controller.abort();throw unavailable();}
      return value;
    }catch{throw unavailable();}
    finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
  }
  async function decide(p:Principal,q:ResourceAccessQuery,previous?:bigint,signal?:AbortSignal):Promise<Decision> {
    const before=now(previous),raw=await lookup(q,signal),after=now(before.value);
    if(raw===null)throw denied();
    const a=accessData(raw),b=a.binding;
    if(!b.active||a.operation!==q.operation||a.manifestFingerprint!==expectedManifest||b.workspaceId!==q.workspaceId
      ||b.connectionId!==q.connectionId||b.tenantId!==q.tenantId||requestHash(a.principal)!==requestHash(p)
      ||!canAccessAccount(a.principal,q.workspaceId,b.accountId)
      ||!requiredScopes[q.operation].every(s=>a.principal.scopes.includes(s))
      ||q.operation.startsWith('notes.')&&!isOperator(a.principal,q.workspaceId,b.accountId))throw denied();
    fresh(a.asOf,a.expiresAt,after.value);
    // Coverage parser validates the WHOLE response before yielding only selected refs.
    const refs=requireCompleteResourceCoverage(q.refs,a.resources);
    const context:ResourceScopeContext=Object.freeze({principalId:p.id,workspaceId:p.workspaceId,accountId:b.accountId,
      bindingId:b.id,bindingRevision:b.revision,accessRevision:a.accessRevision,manifestFingerprint:expectedManifest,
      operation:q.operation,asOf:a.asOf,expiresAt:a.expiresAt,refs});
    const stamp=requestHash({principal:a.principal,binding:b,manifestFingerprint:expectedManifest,
      accessRevision:a.accessRevision,operation:q.operation,selection:externalResourceSelectionKey(refs)});
    return {context,stamp,checked:after};
  }
  async function resolveResourceScope(p:Principal,refs:readonly ExternalResourceRef[],op:string,signal?:AbortSignal):Promise<VerifiedRequestScope> {
    const person=caller(p),selected=parseExternalResourceSelection(refs),action=operation(op),first=selected[0]!;
    const query:ResourceAccessQuery=Object.freeze({principalId:person.id,workspaceId:person.workspaceId,
      connectionId:first.connectionId,tenantId:first.tenantId,operation:action,refs:selected});
    const decision=await decide(person,query,undefined,signal);
    const issued=now(decision.checked.value);
    fresh(decision.context.asOf,decision.context.expiresAt,issued.value);
    decision.checked=issued;
    if(requestHash(caller(p))!==requestHash(person))throw denied();
    if(signal?.aborted)throw unavailable();
    const proof=Object.freeze(Object.create(null)) as VerifiedRequestScope;
    owned.set(proof,{principal:person,query,key:externalResourceSelectionKey(selected),decision});
    return proof;
  }
  async function withResourceScope<T>(p:Principal,refs:readonly ExternalResourceRef[],op:string,proof:unknown,
    work:(context:ResourceScopeContext,lease:ActiveResourceScope)=>Promise<T>,signal?:AbortSignal):Promise<T> {
    const record=proof&&typeof proof==='object'?owned.get(proof):undefined;
    if(!record)throw denied();
    // Reserve once before the first await. Failure, mismatch, abort and lost responses
    // do not resurrect it. Business idempotency remains the command's responsibility.
    owned.delete(proof as object);
    const person=caller(p),selected=parseExternalResourceSelection(refs),action=operation(op);
    if(action!==record.query.operation||requestHash(person)!==requestHash(record.principal)
      ||externalResourceSelectionKey(selected)!==record.key||typeof work!=='function')throw denied();
    const initial=now(record.decision.checked.value);
    fresh(record.decision.context.asOf,record.decision.context.expiresAt,initial.value);
    const checked=await decide(person,record.query,initial.value,signal);
    const dispatched=now(checked.checked.value);
    fresh(record.decision.context.asOf,record.decision.context.expiresAt,dispatched.value);
    fresh(checked.context.asOf,checked.context.expiresAt,dispatched.value);
    if(record.decision.stamp!==checked.stamp||micros(checked.context.asOf)<micros(record.decision.context.asOf)
      ||requestHash(caller(p))!==requestHash(person))throw denied();
    if(signal?.aborted)throw unavailable();
    const lease=Object.freeze(Object.create(null)) as ActiveResourceScope;
    active.set(lease,{principal:p,personHash:requestHash(person),context:checked.context,
      original:record.decision.context,last:dispatched.value,signal});
    try{return await work(checked.context,lease);}finally{active.delete(lease);}
  }
  /** Local dispatch precondition only. Does not replace live SQL ACL/revision locks.
   * No extra network read and no timer retaining the lease after callback cleanup.
   * A changed/expired/cancelled lease is permanently lost even if the caller catches denial.
   */
  function assertResourceScopeCurrent(p:Principal,context:ResourceScopeContext,lease:unknown):void {
    const record=lease&&typeof lease==='object'?active.get(lease):undefined;
    if(!record)throw denied();
    try {
      if(record.principal!==p||record.context!==context||requestHash(caller(p))!==record.personHash)throw denied();
      if(record.signal?.aborted)throw unavailable();
      const at=now(record.last);
      fresh(record.original.asOf,record.original.expiresAt,at.value);
      fresh(record.context.asOf,record.context.expiresAt,at.value);
      record.last=at.value;
    }catch(error){
      active.delete(lease as object);
      throw error instanceof HelpdeskError?error:unavailable();
    }
  }
  return Object.freeze({resolveResourceScope,withResourceScope,assertResourceScopeCurrent});
}
