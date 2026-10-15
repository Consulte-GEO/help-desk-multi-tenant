import type {SqlClient} from './sql.ts';
import type {RegistrationJobTransaction,RegistrationPersistenceWrite} from '../application/registration-job-store.ts';
import {registrationCommandEventId} from '../application/registration-persistence.ts';
import {registrationRecord,registrationUuid,registrationRevision,registrationDigest,registrationHash,canonicalRegistrationJson,registrationFailure} from '../domain/registration-canonical.ts';
import {parseRegistrationScopeRequest,parseLockedRegistrationScope,parseLockedRegistration,parseStoredRegistration,parseRegistrationPersistenceReceipt,type RegistrationScopeRequest,type LockedRegistrationScope,type LockedRegistration} from '../domain/registration-persistence.ts';
import {createRegistrationState,decideRegistrationTransition} from '../domain/registration-automation.ts';
import {HelpdeskError} from '../domain/errors.ts';
/** Bind these to the existing runTransaction borrowed-client validation APIs.
 * They are server dependencies, never supplied in an HTTP body or agent output. */
export type RegistrationTransactionGuard=Readonly<{assertCurrent:()=>void;reject:(error:unknown)=>never}>;
const native:Readonly<Record<string,[string,number]>>=Object.freeze({HDJ01:['registration_scope_denied',403],HDJ02:['registration_revision_conflict',412],HDJ03:['registration_stale_analysis',409],HDJ04:['registration_event_conflict',409],HDJ05:['registration_storage_unavailable',503]});
const unavailable=()=>registrationFailure('registration_storage_unavailable',503);
function safe(error:unknown):HelpdeskError {
 if(error instanceof HelpdeskError){const code=Object.getOwnPropertyDescriptor(error,'code')?.value,status=Object.getOwnPropertyDescriptor(error,'status')?.value;if(typeof code==='string'&&/^registration_[a-z_]+$/.test(code)&&[400,403,404,409,412,422,503].includes(status))return registrationFailure(code,status);}
 try{const code=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined,match=typeof code==='string'?native[code]:undefined;if(match)return registrationFailure(...match);}catch{}
 return unavailable();
}
/** Narrow adapter on a caller-owned transaction. No connect/BEGIN/COMMIT/release,
 * no default authority, no normal request privileges for the CLI subprocess.
 * This implementation must not be mounted until its candidate SQL and existing
 * authorization composition have been qualified on the complete repository. */
export function createPostgresRegistrationStore(client:SqlClient,identityInput:Readonly<{workspaceId:string;id:string}>,guard:RegistrationTransactionGuard):RegistrationJobTransaction {
 if(!client||typeof client.query!=='function'||!guard||typeof guard.assertCurrent!=='function'||typeof guard.reject!=='function')throw unavailable();
 const identity=Object.freeze({workspaceId:registrationUuid(identityInput.workspaceId),id:registrationUuid(identityInput.id)});
 let scope:LockedRegistrationScope|undefined,locked:LockedRegistration|null|undefined,operationId:string|undefined,applied=false,poisoned=false;
 const reject=(error:unknown):never=>{poisoned=true;const failure=safe(error);guard.reject(failure);throw failure;};
 function fail():never{throw unavailable();}
 const check=()=>{if(poisoned)fail();const result:unknown=guard.assertCurrent();if(result!==undefined){if(result instanceof Promise)void result.catch(()=>{});fail();}};
 const required=():LockedRegistrationScope=>{if(!scope||applied||poisoned)fail();return scope;};
 async function protect<T>(work:()=>Promise<T>):Promise<T>{try{return await work();}catch(error){return reject(error);}}
 async function call(sql:string,values:unknown[]):Promise<unknown>{
  check();const r=await client.query(sql,values);check();
  if(!r||r.command!=='SELECT'||r.rowCount!==1||!Array.isArray(r.rows)||r.rows.length!==1||!r.rows[0]||Object.keys(r.rows[0]).length!==1||!Object.hasOwn(r.rows[0],'result'))return fail();
  return r.rows[0].result;
 }
 const encoded=()=>canonicalRegistrationJson(required());
 return Object.freeze({reject,
  lockScope:(request:RegistrationScopeRequest)=>protect(async()=>{
   if(scope||applied)fail();const p=parseRegistrationScopeRequest(request);if(p.workspaceId!==identity.workspaceId||p.actorId!==identity.id)throw registrationFailure('registration_scope_denied',403);
   scope=parseLockedRegistrationScope(await call('select helpdesk_auth.hda02_lock_scope($1::jsonb) as result',[canonicalRegistrationJson(p)]),p);return scope;
  }),
  readReceipt:(commandId:string)=>protect(async()=>{
   const s=required(),id=registrationUuid(commandId);if(s.permission==='read')fail();
   const raw=await call('select helpdesk_auth.hda02_receipt($1::jsonb,$2::uuid) as result',[encoded(),id]);if(raw===null)return null;
   const r=parseRegistrationPersistenceReceipt(raw);for(const field of ['workspaceId','accountId','actorId','bindingId'] as const)if(r[field]!==s[field])fail();if(r.commandId!==id||r.permission!==s.permission||r.recordedAt>=s.expiresAt)fail();return r;
  }),
  lockOperation:(id:string)=>protect(async()=>{
   required();if(locked!==undefined)fail();operationId=registrationUuid(id);const raw=await call('select helpdesk_auth.hda02_operation($1::jsonb,$2::uuid) as result',[encoded(),operationId]);locked=raw===null?null:parseLockedRegistration(raw,scope!);if(locked&&locked.state.snapshot.operationId!==operationId)fail();return locked;
  }),
  lockNextOperation:()=>protect(async()=>{
   const s=required();if(s.permission!=='claim'||locked!==undefined)fail();
   const raw=await call('select helpdesk_auth.hda02_next($1::jsonb) as result',[encoded()]);locked=raw===null?null:parseLockedRegistration(raw,s);operationId=locked?.state.snapshot.operationId;return locked;
  }),
  apply:(write:RegistrationPersistenceWrite)=>protect(async()=>{
   const s=required();if(s.permission==='read'||locked===undefined||operationId===undefined)fail();
   const r=registrationRecord(write,['schema','command','commandHash','expectedRevision','beforeStateHash','event','next','analysis']);
   if(r.schema!==1)fail();const next=parseStoredRegistration(r.next),expected=registrationRevision(r.expectedRevision,0),commandHash=registrationDigest(r.commandHash);
   const request=parseRegistrationScopeRequest({workspaceId:s.workspaceId,accountId:s.accountId,actorId:s.actorId,bindingId:s.bindingId,permission:s.permission});
   if(commandHash!==registrationHash({scope:request,command:r.command})||next.state.snapshot.operationId!==operationId||next.state.snapshot.targetHash!==s.targetHash||next.state.snapshot.ticketId!==s.ticketId)fail();
   const command=r.command as Record<string,unknown>;if(!command||command.type!==s.permission)fail();const commandId=registrationUuid(command.commandId);
   if(locked===null){if(s.permission!=='prepare'||expected!==0||r.beforeStateHash!==null||r.event!==null||r.analysis!==null||registrationHash(next.state)!==registrationHash(createRegistrationState(next.state.snapshot)))fail();}
   else{
    if(expected!==locked.state.revision||r.beforeStateHash!==registrationHash(locked.state))throw registrationFailure('registration_revision_conflict',412);
    const ev=r.event as Record<string,unknown>;if(!ev||ev.eventId!==registrationCommandEventId(request,commandId))fail();
    const decision=decideRegistrationTransition(locked.state,r.event);if(decision.outcome!=='applied'||registrationHash(decision.state)!==registrationHash(next.state)||registrationHash(decision.analysis)!==registrationHash(r.analysis))fail();
   }
   const raw=await call('select helpdesk_auth.hda02_apply($1::jsonb,$2::jsonb) as result',[encoded(),canonicalRegistrationJson(r)]),receipt=parseRegistrationPersistenceReceipt(raw);
   if(receipt.commandId!==commandId||receipt.commandHash!==commandHash||receipt.operationId!==operationId||receipt.operationRevision!==next.state.revision||receipt.stateHash!==registrationHash(next.state)||receipt.jobId!==next.queue.jobId||receipt.fence!==next.state.analysisFence||receipt.status!==next.state.status)fail();
   // Validate the complete authorization context at this boundary too. A caller
   // must not receive another sender's receipt or an already expired observation.
   for(const field of ['workspaceId','accountId','actorId','bindingId','permission'] as const)if(receipt[field]!==s[field])fail();
   const leaseDeadline=s.permission==='claim'?next.queue.lease?.expiresAt:
    (s.permission==='complete'||s.permission==='fail')?locked?.queue.lease?.expiresAt:undefined;
   if(receipt.recordedAt<(locked?.databaseNow??s.databaseNow)||receipt.recordedAt>=s.expiresAt||(leaseDeadline!==undefined&&receipt.recordedAt>=leaseDeadline))fail();
   applied=true;return receipt;
  })
 });
}
