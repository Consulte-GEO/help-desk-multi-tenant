import test from 'node:test';
import assert from 'node:assert/strict';
import {parseExternalIdentityRegistration} from '../src/domain/external-identity.ts';
import {createExternalIdentityResolver} from '../src/application/external-identity.ts';
const issuer='https://identity.example.invalid/Realm-A',clientId='Client-A';
const now='2026-10-09T12:00:00.000000Z';
const registration=()=>({principalId:'00000000-0000-4000-8000-000000000001',revision:'1',active:true,principalActive:true,
 origin:{kind:'external',identityId:'00000000-0000-4000-8000-000000000002',issuer,subject:'A'}});

test('C02 review requires an explicit human parent, not just an origin labelled external',()=>{
 assert.throws(()=>parseExternalIdentityRegistration(registration()),{code:'external_identity_data_invalid'});
});
test('C02 review accepts the explicit human parent in the normalized directory contract',()=>{
 const value={...registration(),principalKind:'human'};
 assert.deepEqual(parseExternalIdentityRegistration(value),value);
});
test('C02 review never accepts an integration principal as a human external registration',()=>{
 assert.throws(()=>parseExternalIdentityRegistration({...registration(),principalKind:'integration'}),{code:'external_identity_data_invalid'});
});
test('C02 review a blocked event loop cannot postpone the deadline into an accepted match',async()=>{
 let lookups=0;
 const resolver=createExternalIdentityResolver({namespace:{issuer,clientId},timeoutMs:10,maxObservationAgeMicros:5_000_000n,clock:()=>now,
  verifier:{verify:async()=>{
   // Simulates one synchronous adapter blocking past the deadline. Not a retry/sleep
   // added to make a race disappear; this delay is the failure being injected.
   Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,30);
   return {issuer,clientId,subject:'A',asOf:now,expiresAt:'2026-10-09T12:00:05.000000Z'};
  }},directory:{lookup:async()=>{lookups++;return [registration()];}}});
 await assert.rejects(resolver.resolve('synthetic-owned-evidence'),{code:'external_identity_timeout'});
 assert.equal(lookups,0);
});
