import type {Principal} from '../domain/model.ts';import type {SqlClient,SqlPool} from '../infrastructure/sql.ts';
import type {createResourceAccessResolver,ResourceScopeContext} from './resource-access.ts';
import {runTransaction} from '../infrastructure/transaction.ts';import {instantMicros} from '../domain/business-calendar.ts';
import type {ExternalResourceRef} from '../domain/external-resource.ts';import {requestHash} from '../domain/canonical.ts';import {canonicalInstant} from '../../shared/instant.js';
import {HelpdeskError} from '../domain/errors.ts';
export const intakeFailure=(code='intake_unavailable',status=503)=>new HelpdeskError(status,code,'Não foi possível confirmar a solicitação. Confira a revisão e o estado dos dados.');
export interface ScopedDraftStore {lockScope(scope:ResourceScopeContext):Promise<ResourceScopeContext|null>}
export type IntakeExpiry=(until:string,code?:string)=>void;
export function assertIntakeScope(actual:ResourceScopeContext|null,expected:ResourceScopeContext){
 try{if(!actual||requestHash({...actual,asOf:canonicalInstant(actual.asOf),expiresAt:canonicalInstant(actual.expiresAt)})!==requestHash({...expected,asOf:canonicalInstant(expected.asOf),expiresAt:canonicalInstant(expected.expiresAt)}))throw Error();}catch{throw intakeFailure('intake_scope_changed',403);}
}
/** Reuses the existing transaction. Resource proof plus every pinned expiry is
 * checked after waits and before COMMIT. Store readers must lock the CURRENT
 * database rows/revisions under RLS on the borrowed connection, not echo scope. */
export async function runIntakeTransaction<T,S extends ScopedDraftStore>(o:{pool:SqlPool;resolver:ReturnType<typeof createResourceAccessResolver>;createStore:(client:SqlClient,p:Principal)=>S;clock:()=>string},p:Principal,refs:readonly ExternalResourceRef[],op:'tickets.read'|'tickets.write',work:(tx:S,scope:ResourceScopeContext,expires:IntakeExpiry)=>Promise<T>,signal?:AbortSignal,admission?:()=>void):Promise<T>{
 admission?.();const proof=await o.resolver.resolveResourceScope(p,refs,op,signal);
 return o.resolver.withResourceScope(p,refs,op,proof,(scope,lease)=>{
  const limits:{at:bigint;code:string}[]=[];
  const check=()=>{admission?.();o.resolver.assertResourceScopeCurrent(p,scope,lease);const at=instantMicros(o.clock());for(const l of limits)if(at>=l.at)throw intakeFailure(l.code,409);};
  const expires:IntakeExpiry=(until,code='intake_source_expired')=>{limits.push({at:instantMicros(until),code});check();};
  return runTransaction(o.pool,p,async c=>{const store=o.createStore(c,p);assertIntakeScope(await store.lockScope(scope),scope);check();return work(store,scope,expires);},check);
 },signal);
}
const codes:Record<string,number>={release_gate_closed:503,request_cancelled:409,invalid_intake_input:400,invalid_form_schema:400,invalid_form_values:422,form_not_published:409,form_schema_changed:409,draft_version_conflict:412,draft_not_found:404,draft_forbidden:403,draft_expired:409,draft_already_committed:409,intake_scope_changed:403,intake_source_expired:409,intake_preview_changed:409,intake_idempotency_conflict:409,intake_coverage_unavailable:422,intake_evidence_invalid:409,attachment_not_clean_or_changed:409,resource_scope_denied:403,resource_scope_unavailable:503,transaction_outcome_unknown:503,intake_delegation_denied:403};
export function safeIntakeError(e:unknown){try{if(e instanceof HelpdeskError){const code=Object.getOwnPropertyDescriptor(e,'code')?.value;if(typeof code==='string'&&Object.hasOwn(codes,code))return intakeFailure(code,codes[code]);}}catch{}return intakeFailure();}
