import type {RegistrationJson} from '../domain/registration-canonical.ts';
import type {StoredRegistration,RegistrationScopeRequest} from '../domain/registration-persistence.ts';
import type {AgentAnalysis} from '../domain/registration-contracts.ts';
/** Exact atomic write contract. No provider call, public event, approval or origin effect. */
export type RegistrationPersistenceWrite=Readonly<{
 schema:1;command:RegistrationJson;commandHash:string;expectedRevision:number;beforeStateHash:string|null;
 event:RegistrationJson|null;next:StoredRegistration;analysis:AgentAnalysis|null;
}>;
/** All calls belong to ONE already-owned transaction. Implementations must:
 * - lock current authorization rows, not echo a caller's scope;
 * - namespace inbox by workspace/actor/command, and reauthorize every replay;
 * - use DB time, CAS, immutable revisions, job fencing and SQL row locks;
 * - persist state/snapshot/job/draft/inbox together and reject incomplete commits.
 * The analysis runner never receives this store or its database credentials.
 */
export interface RegistrationJobTransaction {
 lockScope(request:RegistrationScopeRequest):Promise<unknown>;
 readReceipt(commandId:string):Promise<unknown>;
 lockOperation(operationId:string):Promise<unknown>;
 /** Scope-bounded FOR UPDATE SKIP LOCKED. null means no claimable analysis. */
 lockNextOperation():Promise<unknown>;
 apply(write:RegistrationPersistenceWrite):Promise<unknown>;
 /** Poison the owned transaction even if its caller catches the validation error. */
 reject(error:unknown):never;
}
