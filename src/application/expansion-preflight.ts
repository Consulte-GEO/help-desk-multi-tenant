import {performance} from 'node:perf_hooks';
import {freezeFormData} from '../../shared/form-rules.js';
import {compareInstants} from '../../shared/instant.js';
import {requestHash} from '../domain/canonical.ts';
import {uuidIdentifier} from '../domain/input-values.ts';
import {HelpdeskError} from '../domain/errors.ts';
import {evaluateProfileExpansion,parseProfileExpansion,parseExpansionContract} from '../domain/profile-expansion.ts';
import {parsePilotRecord} from './pilot-control.ts';
import {parseReleaseIdentity,releaseRecord,releaseInteger,releaseInstant,releaseReference,type ReleaseIdentity} from '../domain/release-manifest.ts';
import type {FormRegistry} from '../../shared/form-rules.js';
import type {ReleaseAttestationVerifier} from '../infrastructure/release-attestation.ts';

/** Private operational reader; NOT a route, request-supplied object or SQL fallback.
 * Return one complete snapshot: root revision/epoch, current profile identity/version,
 * accepted pilot, qualified taxonomy/registry, candidate and its signed envelope.
 * No writer exists here. The real adapter and source qualification remain required.
 */
export interface ExpansionSnapshotReader {
 read(pilotId:string,proposalId:string,signal:AbortSignal):Promise<unknown>;
}
const internalErrors=new WeakSet<object>();
function failure(code='expansion_preflight_unavailable',status=503){const e=new HelpdeskError(status,code,'Não foi possível validar a expansão. O escopo vigente não foi alterado.');internalErrors.add(e);return e;}
function snapshot(raw:unknown){
 const s=releaseRecord(raw,['revision','globalEnabled','recoveryEpoch','currentProfileId','currentProfileVersion','baselineIdentity','pilot','proposal','contract','registry','releaseEnvelope']);
 releaseInteger(s.revision,1);releaseInteger(s.currentProfileVersion,1);s.currentProfileId=releaseReference(s.currentProfileId,80);if(typeof s.globalEnabled!=='boolean')throw failure();s.recoveryEpoch=uuidIdentifier(s.recoveryEpoch);
 s.baselineIdentity=parseReleaseIdentity(s.baselineIdentity);s.pilot=parsePilotRecord(s.pilot);s.proposal=parseProfileExpansion(s.proposal);s.contract=parseExpansionContract(s.contract);
 return freezeFormData(s);
}
/** Read-only review, not an authorization proof or a release command. The C16
 * lifecycle still requires its own live checks, authority, transaction and acceptance.
 * No bearer, grant, migration, tenant, category or pilot is created by this function.
 */
export function createExpansionPreflight(o:{reader:ExpansionSnapshotReader;verifier:ReleaseAttestationVerifier;observe:()=>ReleaseIdentity;clock?:()=>string;timeoutMs:number}){
 if(!o||typeof o.reader?.read!=='function'||typeof o.observe!=='function'||!o.verifier||!Number.isSafeInteger(o.timeoutMs)||o.timeoutMs<1||o.timeoutMs>5000)throw failure();
 const clock=o.clock??(()=>new Date().toISOString());
 async function review(pilotId:string,proposalId:string,options:{signal?:AbortSignal}={}){
  const pId=uuidIdentifier(pilotId),cId=uuidIdentifier(proposalId),signal=options.signal;
  if(signal!==undefined&&!(signal instanceof AbortSignal))throw failure();
  let stopped:'cancelled'|'timeout'|undefined,last:string|undefined;
  const control=new AbortController(),deadline=performance.now()+o.timeoutMs;
  const stop=(reason:'cancelled'|'timeout')=>{if(!stopped){stopped=reason;control.abort();}};
  const cancel=()=>stop('cancelled');
  const open=()=>{if(!stopped&&performance.now()>=deadline)stop('timeout');if(stopped)throw failure('expansion_preflight_'+stopped,stopped==='cancelled'?409:503);};
  const now=()=>{open();const at=releaseInstant(clock());if(last!==undefined&&compareInstants(at,last)<0)throw failure();last=at;return at;};
  async function read(){
   open();return new Promise<ReturnType<typeof snapshot>>((resolve,reject)=>{
    const abort=()=>{cleanup();reject(failure('expansion_preflight_'+(stopped??'cancelled'),stopped==='timeout'?503:409));};
    const cleanup=()=>control.signal.removeEventListener('abort',abort);control.signal.addEventListener('abort',abort,{once:true});
    Promise.resolve().then(()=>{open();return o.reader.read(pId,cId,control.signal);}).then(raw=>{
     cleanup();try{open();resolve(snapshot(raw));}catch(e){reject(e);}
    },()=>{cleanup();try{open();}catch(e){reject(e);return;}reject(failure());});
   });
  }
  if(signal?.aborted)throw failure('expansion_preflight_cancelled',409);signal?.addEventListener('abort',cancel,{once:true});
  const timer=setTimeout(()=>stop('timeout'),o.timeoutMs);
  try{
   now();const s=await read();now();
   const pilot=parsePilotRecord(s.pilot),proposal=parseProfileExpansion(s.proposal),baselineIdentity=parseReleaseIdentity(s.baselineIdentity);
   if(!s.globalEnabled||pilot.state!=='accepted'||pilot.pilotId!==pId||proposal.id!==cId||proposal.profileId!==s.currentProfileId||proposal.previousVersion!==s.currentProfileVersion||s.recoveryEpoch!==baselineIdentity.recoveryEpoch)throw failure();
   const baseline=o.verifier.verifyRelease(pilot.releaseEnvelope,baselineIdentity),acceptance=o.verifier.verifyAcceptance(pilot.acceptanceEnvelope);
   const target=o.verifier.verifyRelease(s.releaseEnvelope,o.observe());
   const check=()=>{
    const at=now(),observed=parseReleaseIdentity(o.observe());if(observed.recoveryEpoch!==s.recoveryEpoch||compareInstants(pilot.changedAt,at)>0)throw failure();
    const a=o.verifier.readRelease(baseline,baselineIdentity),accepted=o.verifier.readAcceptance(acceptance),b=o.verifier.readRelease(target,observed);
    if(a.manifest.releaseId!==pilot.pilotId||a.report.manifestHash!==pilot.manifestHash||pilot.startedAt===null||pilot.acceptedAt===null||accepted.pilotId!==pilot.pilotId||accepted.pilotRevision!==pilot.revision-1||accepted.manifestHash!==pilot.manifestHash||compareInstants(accepted.startedAt,pilot.startedAt)!==0||compareInstants(accepted.completedAt,pilot.acceptedAt)>0||!a.owners.some(v=>v.role==='customer'&&v.principalId===accepted.ownerId)||[...a.manifest.cohorts,...b.manifest.cohorts].some(v=>v.workspaceId!==pilot.workspaceId))throw failure();
    const report=evaluateProfileExpansion(proposal,s.contract,s.registry as FormRegistry,a.manifest,b.manifest);
    const validUntil=[a.report.validUntil,b.report.validUntil,accepted.validUntil].sort(compareInstants)[0]!;
    return {at,report,validUntil};
   };
   check();const hash=requestHash(s),second=await read();
   if(requestHash(second)!==hash)throw failure();
   const {at,report,validUntil}=check();open();
   return freezeFormData({...report,state:report.state==='blocked'?'blocked':'ready_for_scoped_pilot_review',activationAllowed:false,snapshotHash:hash,checkpointRevision:s.revision,asOf:at,validUntil});
  }catch(e){if(e&&typeof e==='object'&&internalErrors.has(e))throw e;throw failure();}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',cancel);}
 }
 return Object.freeze({review});
}
