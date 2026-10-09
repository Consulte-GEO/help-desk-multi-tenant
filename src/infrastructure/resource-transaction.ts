import type {Principal} from '../domain/model.ts';
import type {ExternalResourceRef} from '../domain/external-resource.ts';
import type {createResourceAccessResolver,ResourceScopeContext} from '../application/resource-access.ts';
import type {SqlClient,SqlPool} from './sql.ts';
import {runTransaction} from './transaction.ts';

type Resolver=ReturnType<typeof createResourceAccessResolver>;
/** SERVER composition only; there is no runtime route wired to this bridge yet.
 * Resolve live authority BEFORE the transaction, then check its local lease after
 * pool/BEGIN/context waits, around store queries, and immediately before COMMIT.
 * `work` MUST still apply ticket ownership, scopes, product/contract and SQL resource
 * ACL/revision locks in this SAME transaction. This bridge does not implement them.
 * Never use the returned context as another request's credential, a persisted grant
 * or proof of distributed revocation. A sent COMMIT keeps confirmed/unknown semantics.
 */
export function runResourceTransaction<T>(pool:SqlPool,resolver:Resolver,p:Principal,
 refs:readonly ExternalResourceRef[],operation:string,proof:unknown,
 work:(client:SqlClient,context:ResourceScopeContext)=>Promise<T>,signal?:AbortSignal):Promise<T> {
 return resolver.withResourceScope(p,refs,operation,proof,(context,lease)=>
  runTransaction(pool,p,client=>work(client,context),
   ()=>resolver.assertResourceScopeCurrent(p,context,lease)),signal);
}
