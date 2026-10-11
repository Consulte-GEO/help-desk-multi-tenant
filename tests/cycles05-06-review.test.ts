import test from 'node:test';import assert from 'node:assert/strict';
import {HelpdeskError} from '../src/domain/errors.ts';
import {configurationFixture,id} from './helpers/configuration-fixture.ts';
import {createConfigurationAdministration} from '../src/application/configuration-admin.ts';
import {createConfigurationAdminHttpHandler} from '../src/http/configuration-admin.ts';
import {createMemberInvitationAcceptance} from '../src/application/member-invitation.ts';
import {oidcFixture} from './helpers/oidc-fixture.ts';
import {createGeoLogin} from '../src/application/geo-login.ts';
const options=(f:ReturnType<typeof oidcFixture>)=>({...f,flowLifetimeSeconds:120,accessLifetimeSeconds:60,sessionLifetimeSeconds:1800,allowedReturnPaths:['/','/tickets'],timeoutMs:5000});
async function session(f:ReturnType<typeof oidcFixture>,api:ReturnType<typeof createGeoLogin>){const flow=await api.beginGeoLogin('/tickets');f.setNonce(flow.authorizationUrl);return api.completeGeoLogin({code:'code',state:new URL(flow.authorizationUrl).searchParams.get('state'),iss:f.registration.issuer},flow.browserBinding,id(1));}
test('C05 review GET authentication refusal is serialized, never an unhandled rejection',async()=>{
 const f=configurationFixture(),h=createConfigurationAdminHttpHandler({enabled:()=>true,administration:createConfigurationAdministration({store:f.store,clock:f.clock}),authentication:{withAdministrativeAssurance:async()=>{throw new HelpdeskError(401,'unauthorized','private');}},rateLimiter:{beforeAuthentication:async()=>{},afterAuthentication:async()=>{}}});
 const r=await h(new Request('https://helpdesk.example.test/v1/admin/accounts'));assert.equal(r.status,401);assert.ok(!(await r.text()).includes('private'));
});
test('C04 review hostile exception getter cannot inject an error message through invitation acceptance',async()=>{
 const f=configurationFixture(),poison=new HelpdeskError(503,'invalid_administrative_state','private');Object.defineProperty(poison,'code',{get(){throw new HelpdeskError(403,'invitation_unavailable','private-secret');}});
 const api=createMemberInvitationAcceptance({store:{...f.store,transaction:async()=>{throw poison;}} as any,clock:f.clock});
 await assert.rejects(api.accept(f.principal,{expectedRevision:1,expectedMemberRevision:1},'test-intention-review'),(e:any)=>e.status===503&&!e.message.includes('private'));
});
test('C06 review logout while provider refresh is in flight prevents server resurrection',async()=>{
 const f=oidcFixture();let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>release=r),started=new Promise<void>(r=>entered=r);
 const provider={...f.provider,refresh:async(...args:Parameters<typeof f.provider.refresh>)=>{entered();await gate;return f.provider.refresh(...args);}};
 const api=createGeoLogin({...options(f),provider}),r=await session(f,api);const pending=api.rotatePersonSession(r.refreshToken);await started;await api.logoutPersonSession(r.accessToken);release();
 await assert.rejects(pending);assert.equal([...f.sessions.values()][0].status,'revoked');
});
test('C06 review revocation during live directory lookup is observed before returning a principal',async()=>{
 const f=oidcFixture();let revoke=false;
 const identityDirectory={lookup:async(...args:Parameters<typeof f.identityDirectory.lookup>)=>{const rows=await f.identityDirectory.lookup(...args);if(revoke)[...f.sessions.values()][0].status='revoked';return rows;}};
 const api=createGeoLogin({...options(f),identityDirectory}),r=await session(f,api);revoke=true;await assert.rejects(api.authenticatePersonSession(r.accessToken,id(1)));
});
test('C06 review an expired local access token can still request revocation of its own session family',async()=>{
 const f=oidcFixture(),api=createGeoLogin(options(f)),r=await session(f,api);f.setTime('2026-10-09T12:05:00.123Z');await api.logoutPersonSession(r.accessToken);assert.equal([...f.sessions.values()][0].status,'revoked');
});
