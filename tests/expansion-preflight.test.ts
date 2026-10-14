import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {canonicalJson} from '../src/domain/canonical.ts';
import {releaseManifestHash} from '../src/domain/release-manifest.ts';
import {createReleaseAttestationVerifier} from '../src/infrastructure/release-attestation.ts';
import {expansionPolicyDigest} from '../src/domain/profile-expansion.ts';
import {rawExpansion} from './helpers/expansion-fixture.ts';
import {AT,BEFORE,UNTIL,u,evidenceFor,identity} from './helpers/release-fixtures.ts';

// Positive crypto/validation scenarios use the supported full budget under the
// parallel application suite. The explicit 15 ms hanging-reader case below
// independently proves the deadline and cancellation behavior.
async function setup(timeoutMs=5000){
 const path='../src/application/expansion-preflight.ts',m=await import(path).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});assert.equal(typeof m.createExpansionPreflight,'function','C17 attested preflight missing');
 const f=rawExpansion();f.after.policySetDigest=expansionPolicyDigest(f.before,f.proposal,f.contract);
 const pair=generateKeyPairSync('ed25519');let tick=AT,enabled=true,reads=0;const signalLog:AbortSignal[]=[],control={afterRead:(_n:number)=>{},reject:false,hang:false};
 const signed=(purpose:string,payload:any)=>({keyId:'test',payload,signature:sign(null,Buffer.from(canonicalJson(['helpdesk-operational-attestation-v1',purpose,payload])),pair.privateKey).toString('base64url')});
 const release=(m:any)=>signed('release',{manifest:m,evidence:evidenceFor(releaseManifestHash(m)),owners:['support','security','customer'].map((role,i)=>({role,principalId:u(20+i),decisionRef:'TEST-'+role}))});
 const acceptance=(id=u(5),revision=2)=>signed('acceptance',{pilotId:id,pilotRevision:revision,manifestHash:releaseManifestHash(f.before),startedAt:BEFORE,completedAt:AT,validUntil:UNTIL,ownerId:u(22),decisionRef:'SYNTHETIC-ACCEPTANCE',checks:{journey:true,crossWork:true,crossTenant:true,nonPilotDenied:true,replay:true,notifications:true,downloads:true,training:true,containment:true}});
 const snapshot:any={revision:1,globalEnabled:true,recoveryEpoch:identity().recoveryEpoch,currentProfileId:'SYNTHETIC_PROFILE',currentProfileVersion:1,baselineIdentity:identity(),pilot:{schema:1,pilotId:u(5),workspaceId:u(1),revision:3,state:'accepted',manifestHash:releaseManifestHash(f.before),releaseEnvelope:release(f.before),startedAt:BEFORE,acceptedAt:AT,acceptanceEnvelope:acceptance(),changedAt:AT,changedBy:u(20)},proposal:f.proposal,contract:f.contract,registry:f.registry,releaseEnvelope:release(f.after)};
 const verifier=createReleaseAttestationVerifier({clock:()=>tick,keys:()=>[{id:'test',publicKey:pair.publicKey,enabled,validFrom:BEFORE,expiresAt:UNTIL,purposes:['release','acceptance']}]});
 const reader={read:async(pilotId:string,proposalId:string,signal:AbortSignal)=>{assert.equal(pilotId,u(5));assert.equal(proposalId,u(902));signalLog.push(signal);reads++;if(control.reject)throw Error('secret connection');if(control.hang)return new Promise(()=>{});const value=structuredClone(snapshot);control.afterRead(reads);return value;}};
 const observed=identity();const api=m.createExpansionPreflight({reader,verifier,observe:()=>observed,clock:()=>tick,timeoutMs});
 return {api,snapshot,control,observed,signalLog,verifier,release,acceptance,setTime:(v:string)=>tick=v,revoke:()=>enabled=false,reads:()=>reads,review:(signal?:AbortSignal)=>api.review(u(5),u(902),{signal})};
}
const denied={status:503,code:'expansion_preflight_unavailable'};
test('C17 signed accepted baseline plus distinct attested candidate produces only a review report',async()=>{const f=await setup(),r=await f.review();assert.equal(r.state,'ready_for_scoped_pilot_review');assert.equal(r.operational,false);assert.equal(r.activationAllowed,false);assert.equal(f.reads(),2);assert.match(r.snapshotHash,/^[a-f0-9]{64}$/);assert.ok(!JSON.stringify(r).includes('signature'));});
for(const state of ['prepared','pilot','contained'])test('C17 '+state+' pilot cannot authorize expansion',async()=>{const f=await setup();f.snapshot.pilot.state=state;await assert.rejects(f.review(),denied);});
test('C17 an unsigned candidate cannot use the baseline acceptance as its approval',async()=>{const f=await setup();f.snapshot.releaseEnvelope.signature='A'.repeat(86);await assert.rejects(f.review(),denied);});
test('C17 a valid signature for another pilot does not meet the baseline acceptance',async()=>{const f=await setup();f.snapshot.pilot.acceptanceEnvelope=f.acceptance(u(777));await assert.rejects(f.review(),denied);});
test('C17 baseline profile revision cannot be skipped despite valid source/evidence',async()=>{const f=await setup();f.snapshot.currentProfileVersion=8;await assert.rejects(f.review(),denied);});
test('C17 expired baseline is refused; fixtures do not renew it implicitly',async()=>{const f=await setup();f.setTime(UNTIL);await assert.rejects(f.review(),denied);});
test('C17 new deployment identity must match the live observation',async()=>{const f=await setup();f.observed.sourceSha='f'.repeat(40);await assert.rejects(f.review(),denied);});
test('C17 containment between reads invalidates the prepared review',async()=>{const f=await setup();f.control.afterRead=n=>{if(n===1){f.snapshot.pilot.state='contained';f.snapshot.revision++;}};await assert.rejects(f.review(),denied);assert.equal(f.reads(),2);});
test('C17 changed candidate data with same row revision is still rejected',async()=>{const f=await setup();f.control.afterRead=n=>{if(n===1)f.snapshot.proposal.forms[0].form.title='changed';};await assert.rejects(f.review(),denied);});
test('C17 key revocation while reading the second snapshot invalidates the proof',async()=>{const f=await setup();f.control.afterRead=n=>{if(n===2)f.revoke();};await assert.rejects(f.review(),denied);});
test('C17 expiry during the final read cannot return a stale result',async()=>{const f=await setup();f.control.afterRead=n=>{if(n===2)f.setTime(UNTIL);};await assert.rejects(f.review(),denied);});
test('C17 global containment or wrong retained recovery generation blocks review',async()=>{for(const update of [{globalEnabled:false},{recoveryEpoch:u(888)}]){const f=await setup();Object.assign(f.snapshot,update);await assert.rejects(f.review(),denied);}});
test('C17 returned pilot/target identifiers must equal the requested snapshot',async()=>{const f=await setup();f.snapshot.proposal.id=u(999);await assert.rejects(f.review(),denied);});
test('C17 cancelled caller starts no read',async()=>{const f=await setup(),a=new AbortController();a.abort();await assert.rejects(f.review(a.signal),{code:'expansion_preflight_cancelled'});assert.equal(f.reads(),0);});
test('C17 cancellation between stages starts no additional read',async()=>{const f=await setup(),a=new AbortController();f.control.afterRead=()=>a.abort();await assert.rejects(f.review(a.signal),{code:'expansion_preflight_cancelled'});assert.equal(f.reads(),1);});
test('C17 reader ignoring abort is bounded and receives cancellation without retry',async()=>{const f=await setup(15);f.control.hang=true;await assert.rejects(f.review(),{code:'expansion_preflight_timeout'});assert.equal(f.reads(),1);assert.equal(f.signalLog[0]!.aborted,true);});
test('C17 private source errors do not escape or trigger a retry',async()=>{const f=await setup();f.control.reject=true;await assert.rejects(f.review(),(e:any)=>e.code===denied.code&&!/secret/.test(e.message));assert.equal(f.reads(),1);});
test('C17 observed clock cannot go backwards during review',async()=>{const f=await setup();f.control.afterRead=n=>{if(n===2)f.setTime(BEFORE);};await assert.rejects(f.review(),denied);});
test('C17 current profile identity is mandatory, not just a coincident numeric version',async()=>{const f=await setup();delete f.snapshot.currentProfileId;await assert.rejects(f.review(),denied);});
test('C17 explicit matching current profile participates in the signed-review composition',async()=>{const f=await setup();f.snapshot.currentProfileId='SYNTHETIC_PROFILE';assert.equal((await f.review()).state,'ready_for_scoped_pilot_review');});
test('C17 different existing profile with the same version must not be replaced',async()=>{const f=await setup();f.snapshot.currentProfileId='DIFFERENT_PROFILE';await assert.rejects(f.review(),denied);});
