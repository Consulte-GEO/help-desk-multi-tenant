import {performance} from 'node:perf_hooks';
import type {Principal} from '../domain/model.ts';import type {SqlPool,SqlClient} from './sql.ts';
import type {createResourceAccessResolver} from '../application/resource-access.ts';import type {ReviewDirectory} from '../application/support-review.ts';
import {runResourceTicketTransaction} from './resource-access-store.ts';
import {assertBorrowedTransactionIdentity,rejectTransactionValidation} from './transaction.ts';
import {createPostgresRegistrationStore} from './registration-store.ts';
import {projectRegistrationDraftReview} from '../application/registration-drafts.ts';
import {registrationRecord,registrationUuid,registrationHash,registrationFailure as fail} from '../domain/registration-canonical.ts';
import {parseRegistrationScopeRequest,parseLockedRegistrationScope,parseLockedRegistration} from '../domain/registration-persistence.ts';
import {parseExternalResourceSelection} from '../domain/external-resource.ts';import {isOperator} from '../domain/policy.ts';import {HelpdeskError} from '../domain/errors.ts';
import type {RegistrationReviewQueries} from '../http/registration-review.ts';
const unavailable=()=>fail('registration_review_unavailable',503);
function safe(error:unknown){
 const allowed:Record<string,number>={release_gate_closed:503,request_cancelled:409,registration_scope_denied:403,registration_scope_changed:403,registration_scope_expired:409,registration_review_not_found:404,resource_scope_denied:403,resource_scope_database_mismatch:403};
 if(error instanceof HelpdeskError&&Object.hasOwn(allowed,error.code))return fail(error.code,allowed[error.code]);
 const code=error&&typeof error==='object'?Object.getOwnPropertyDescriptor(error,'code')?.value:undefined;
 return code==='HDJ01'?fail('registration_scope_denied',403):unavailable();
}
/** Concrete composition on the ordinary authenticated app pool. Current resource
 * ACL, HDA read grant, binding and operation are checked in ONE transaction.
 * Candidate persistence/helper absence fails closed; no origin API is inferred.
 */
export function createPostgresRegistrationReviewQueries(o:{pool:SqlPool;resolver:ReturnType<typeof createResourceAccessResolver>;directory:ReviewDirectory;enabled:()=>boolean}):RegistrationReviewQueries{
 return Object.freeze({async readReview(p,ticketId,audience,signal,admission){
  try{
   const id=registrationUuid(ticketId),fingerprint=registrationHash(p);let deadline=Infinity;
   const check=()=>{admission?.();if(o.enabled()!==true)throw fail('release_gate_closed',503);if(signal?.aborted)throw fail('request_cancelled',409);if(performance.now()>=deadline)throw fail('registration_scope_expired',409);if(registrationHash(p)!==fingerprint||p.kind!=='human'||!p.scopes.includes('tickets:read')||!['internal','customer'].includes(audience))throw fail('registration_scope_denied',403);};
   check();const located=await o.directory.locateTicket(p,id,signal);check();if(!located)throw fail('registration_review_not_found',404);
   const accountId=registrationUuid(located.accountId),refs=parseExternalResourceSelection(located.refs);
   if(audience==='internal'&&!isOperator(p,p.workspaceId,accountId))throw fail('registration_scope_denied',403);
   const proof=await o.resolver.resolveResourceScope(p,refs,'tickets.read',signal);check();
   return await runResourceTicketTransaction(o.pool,o.resolver,p,id,refs,'tickets.read',proof,async(client,resource)=>{
    const guard=()=>{check();assertBorrowedTransactionIdentity(client,p);};
    const reject=(e:unknown):never=>rejectTransactionValidation(client,safe(e));
    try{
     guard();if(resource.accountId!==accountId)throw fail('registration_scope_changed',403);
     const resolve=async()=>{
      guard();const r=await client.query('select helpdesk_auth.hda06_review_target($1::uuid,$2::boolean) as result',[id,audience==='internal']);guard();
      if(r.command!=='SELECT'||r.rowCount!==1||r.rows.length!==1)throw unavailable();
      const raw=registrationRecord(r.rows[0],['result']).result;if(raw===null)throw fail('registration_review_not_found',404);
      const v=registrationRecord(raw,['workspaceId','accountId','ticketId','bindingId','operationId']);
      for(const key of ['workspaceId','accountId','ticketId','bindingId','operationId'])registrationUuid(v[key]);
      if(v.workspaceId!==p.workspaceId||v.accountId!==accountId||v.ticketId!==id)throw fail('registration_scope_changed',403);
      return v as Record<string,string>;
     };
     const target=await resolve(),scope=parseRegistrationScopeRequest({workspaceId:p.workspaceId,accountId,actorId:p.id,bindingId:target.bindingId,permission:'read'});
     const store=createPostgresRegistrationStore(client,p,{assertCurrent:guard,reject}),started=performance.now();
     const locked=parseLockedRegistrationScope(await store.lockScope(scope),scope);
     deadline=started+Date.parse(locked.expiresAt)-Date.parse(locked.databaseNow);guard();
     if(locked.ticketId!==id)throw fail('registration_scope_changed',403);
     const raw=await store.lockOperation(target.operationId!);if(raw===null)throw fail('registration_review_not_found',404);
     const operation=parseLockedRegistration(raw,locked);guard();
     const expiresAt=new Date(Math.min(Date.parse(locked.expiresAt),Date.parse(operation.databaseNow)+60_000)).toISOString();
     const view=projectRegistrationDraftReview(operation.state,{audience,context:{workspaceId:p.workspaceId,accountId,ticketId:id,operationId:target.operationId},observedAt:operation.databaseNow,expiresAt});
     if(registrationHash(await resolve())!==registrationHash(target))throw fail('registration_scope_changed',403);guard();return view;
    }catch(error){return reject(error);}
   },signal,check);
  }catch(error){throw safe(error);}
 }});
}
