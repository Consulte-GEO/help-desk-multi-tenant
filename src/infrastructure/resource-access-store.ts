import type {Principal} from '../domain/model.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {parseExternalResourceSelection,externalResourceSelectionKey,type ExternalResourceRef} from '../domain/external-resource.ts';
import type {createResourceAccessResolver,ResourceScopeContext} from '../application/resource-access.ts';
import {isCanonicalInstant,compareInstants} from '../../shared/instant.js';
import type {SqlClient,SqlPool} from './sql.ts';
import {runResourceTransaction} from './resource-transaction.ts';

const unavailable=()=>new HelpdeskError(503,'resource_scope_database_unavailable',
 'Não foi possível conferir o escopo persistido. Nenhuma ação foi iniciada.');
const mismatch=()=>new HelpdeskError(403,'resource_scope_database_mismatch',
 'O escopo persistido não corresponde à autorização atual. Consulte novamente.');
const identityFields=['principalId','workspaceId','accountId','bindingId','bindingRevision',
 'accessRevision','manifestFingerprint','operation'] as const;
function own(input:unknown,key:string):unknown{
 if(!input||typeof input!=='object')throw unavailable();
 const d=Object.getOwnPropertyDescriptor(input,key);
 if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw unavailable();
 return d.value;
}
function record(input:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!input||typeof input!=='object'||Array.isArray(input))throw unavailable();
 const prototype=Object.getPrototypeOf(input),actual=Reflect.ownKeys(input);
 if(prototype!==Object.prototype&&prototype!==null||actual.length!==keys.length
  ||actual.some(k=>typeof k!=='string'||!keys.includes(k)))throw unavailable();
 return Object.fromEntries(keys.map(key=>[key,own(input,key)]));
}
/** The database must return one explicit, current-actor scope, not a truthy receipt.
 * Driver Result may have transport bookkeeping; the row and JSON envelope are exact.
 * Never execute toJSON/getters or turn malformed data into an empty permission set.
 */
function assertSnapshot(raw:unknown,ticketId:string,expected:ResourceScopeContext):void{
 // Only this invocation's own denial may leave the parser as a 403. A driver
 // object may throw an Error with the same class/code; it is still malformed data.
 const localDenial=mismatch();
 try{
  if(own(raw,'command')!=='SELECT'||own(raw,'rowCount')!==1)throw unavailable();
  const rows=own(raw,'rows');
  if(!Array.isArray(rows)||rows.length!==1||Reflect.ownKeys(rows).length!==2)throw unavailable();
  const value=record(own(rows,'0'),['scope']).scope;
  if(value===null)throw localDenial;
  const scope=record(value,['ticketId',...identityFields,'asOf','expiresAt','refs']);
  if(scope.ticketId!==ticketId||identityFields.some(k=>scope[k]!==expected[k]))throw localDenial;
  for(const key of ['asOf','expiresAt'] as const){
   if(!isCanonicalInstant(scope[key]))throw unavailable();
   if(compareInstants(scope[key] as string,expected[key])!==0)throw localDenial;
  }
  const refs=parseExternalResourceSelection(scope.refs);
  if(externalResourceSelectionKey(refs)!==externalResourceSelectionKey(expected.refs))throw localDenial;
 }catch(e){
  if(e===localDenial)throw e;
  throw unavailable();
 }
}
/** SERVER composition; no HTTP handler is wired here. The resolver owns the proof,
 * the SQL helper owns current rows/locks, and the existing runner owns COMMIT/cleanup.
 * Context is never accepted from JSON input as authorization. The callback must
 * target this ticket and still use ordinary RLS/domain/contract/idempotency checks.
 * No publisher of trusted external observations or new integration is enabled.
 */
export function runResourceTicketTransaction<T>(pool:SqlPool,resolver:ReturnType<typeof createResourceAccessResolver>,p:Principal,
 ticketId:string,refs:readonly ExternalResourceRef[],operation:string,proof:unknown,
 work:(client:SqlClient,context:ResourceScopeContext)=>Promise<T>,signal?:AbortSignal,additionalAdmission?:()=>void):Promise<T>{
 const target=uuidIdentifier(ticketId);
 return runResourceTransaction(pool,resolver,p,refs,operation,proof,async(client,context)=>{
  let result:unknown;
  try{result=await client.query('select helpdesk_auth.cg_lock_ticket_scope($1,$2) as scope',[target,context.operation]);}
  catch(error){
   // A driver may throw an application-shaped Error; its message is still untrusted.
   // Retain only known admission semantics, with a locally owned safe explanation.
   let code:unknown;
   try{code=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined;}
   catch{throw unavailable();}
   if(code==='release_gate_closed')throw new HelpdeskError(503,code,'O atendimento foi desabilitado antes da confirmação.');
   if(code==='request_cancelled')throw new HelpdeskError(409,code,'A requisição foi cancelada antes da confirmação.');
   if(code==='resource_scope_denied')throw new HelpdeskError(403,code,'A autorização dos recursos foi recusada.');
   if(code==='resource_scope_unavailable')throw new HelpdeskError(503,code,'Não foi possível confirmar a autorização dos recursos.');
   if(code==='transaction_identity_changed')throw new HelpdeskError(403,code,'A identidade da transação foi alterada.');
   if(code==='database_unavailable')throw new HelpdeskError(503,code,'A conexão ao banco está indisponível.');
   throw unavailable();
  }
  assertSnapshot(result,target,context);
  return work(client,context);
 },signal,additionalAdmission);
}
