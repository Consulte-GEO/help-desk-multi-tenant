import {requestHash} from '../domain/canonical.ts';
import type {Principal} from '../domain/model.ts';import {HelpdeskError} from '../domain/errors.ts';
import {compareInstants} from '../../shared/instant.js';
import {parsePilotRequestScope,parseReleaseIdentity,releaseRecord,releaseInteger,releaseInstant,matchPilotCohort,type PilotRequestScope,type ReleaseIdentity} from '../domain/release-manifest.ts';
import {parsePilotRecord} from '../application/pilot-control.ts';
import type {ReleaseAttestationVerifier,VerifiedReleaseProof,VerifiedPilotAcceptance} from './release-attestation.ts';
import type {createResourceAccessResolver,ResourceScopeContext} from '../application/resource-access.ts';
import {runResourceTicketTransaction} from './resource-access-store.ts';import type {SqlClient,SqlPool} from './sql.ts';

/** Private database adapter, never caller JSON. MUST lock the global root and
 * scoped pilot state until the business COMMIT, in this same borrowed connection.
 * A containment/epoch update must serialize against those locks. No production
 * implementation is selected here. root revision must change on any state change.
 * recoveryEpoch must be reconciled against a retained control plane NOT rolled
 * back alongside an old backup; restoring the old root alone cannot be trusted.
 */
export interface LockedPilotStateReader {
 /** Return ticketId and the COMPLETE persisted cohort dimensions along with root/pilot;
  * not a copy of the request. Account/product/category/channel/resource projection
  * must come from the actual ticket and configured route context. */
 readLocked(client:SqlClient,principal:Principal,ticketId:string,scope:PilotRequestScope):Promise<unknown>;
}
export interface PilotTransactionOptions {
 pool:SqlPool;resolver:ReturnType<typeof createResourceAccessResolver>;state:LockedPilotStateReader;
 verifier:ReleaseAttestationVerifier;observe:()=>ReleaseIdentity;clock?:()=>string;
}
const closed=()=>new HelpdeskError(503,'pilot_scope_closed','Atendimento não liberado para este contexto ou evidências indisponíveis.');
/** Additional rollout admission, NOT a replacement for resource ACL/roles/scopes.
 * The hosting adapter derives category/channel/feature from its fixed route and
 * a qualified private ticket directory, never from caller-supplied flags. This
 * optional composition is NOT mounted into existing routes by this delivery.
 */
export async function runPilotedResourceTicketTransaction<T>(o:PilotTransactionOptions,p:Principal,ticketId:string,rawScope:unknown,
 operation:string,resourceProof:unknown,work:(client:SqlClient,scope:ResourceScopeContext)=>Promise<T>,signal?:AbortSignal):Promise<T>{
 let requested:PilotRequestScope;try{requested=parsePilotRequestScope(rawScope);if(requested.principalId!==p.id||requested.workspaceId!==p.workspaceId)throw Error();}catch{throw closed();}
 let guard:(()=>void)|undefined;
 const admission=()=>{if(requested.principalId!==p.id||requested.workspaceId!==p.workspaceId)throw closed();guard?.();};
 return runResourceTicketTransaction(o.pool,o.resolver,p,ticketId,requested.refs,operation,resourceProof,async(client,context)=>{
  try{
   if(context.accountId!==requested.accountId)throw Error();
   const snapshot=releaseRecord(await o.state.readLocked(client,p,ticketId,requested),['globalEnabled','revision','recoveryEpoch','pilot','ticketId','scope']);
   if(snapshot.ticketId!==ticketId||requestHash(parsePilotRequestScope(snapshot.scope))!==requestHash(requested))throw Error();
   if(snapshot.globalEnabled!==true||snapshot.pilot===null)throw Error();releaseInteger(snapshot.revision,1);
   const record=parsePilotRecord(snapshot.pilot);if(!['pilot','accepted'].includes(record.state)||record.workspaceId!==p.workspaceId)throw Error();
   const release:VerifiedReleaseProof=o.verifier.verifyRelease(record.releaseEnvelope,o.observe());
   const accepted:VerifiedPilotAcceptance|undefined=record.state==='accepted'?o.verifier.verifyAcceptance(record.acceptanceEnvelope):undefined;
   guard=()=>{try{
    const at=releaseInstant((o.clock??(()=>new Date().toISOString()))());if(compareInstants(record.changedAt,at)>0)throw Error();
    const observed=parseReleaseIdentity(o.observe());if(observed.recoveryEpoch!==snapshot.recoveryEpoch)throw Error();
    const valid=o.verifier.readRelease(release,observed);
    if(valid.manifest.releaseId!==record.pilotId||valid.report.manifestHash!==record.manifestHash||!matchPilotCohort(valid.manifest,requested)||record.startedAt===null||compareInstants(record.startedAt,valid.manifest.validFrom)<0)throw Error();
    if(accepted){const a=o.verifier.readAcceptance(accepted);
     if(a.pilotId!==record.pilotId||a.pilotRevision!==record.revision-1||a.manifestHash!==record.manifestHash||compareInstants(a.startedAt,record.startedAt)!==0||record.acceptedAt===null||compareInstants(a.completedAt,record.acceptedAt)>0||!valid.owners.some(owner=>owner.role==='customer'&&owner.principalId===a.ownerId))throw Error();
    }
   }catch{throw closed();}};
   admission();
  }catch{throw closed();}
  // Preserve business exceptions and the existing runner's acknowledged/unknown
  // commit semantics. No network or external delivery is initiated by this layer.
  const result=await work(client,context);admission();return result;
 },signal,admission);
}
