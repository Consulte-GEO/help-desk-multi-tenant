import test from 'node:test';import assert from 'node:assert/strict';
import {createAuthentication} from '../src/infrastructure/authentication.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';import {principal} from './fixtures.ts';
const USER='11111111-1111-4111-8111-111111111111',WS='22222222-2222-4222-8222-222222222222',FACTOR='33333333-3333-4333-8333-333333333333',time=1800000000000;
const factor={id:FACTOR,factor_type:'totp',status:'verified'};
const jwt=(payload:unknown)=>'e30.'+Buffer.from(JSON.stringify(payload)).toString('base64url')+'.c2ln';
const claims=(aal='aal1')=>({sub:USER,aal,exp:time/1000+120,aud:'authenticated'});
function fixture(factors:unknown=[factor],value:unknown=principal({id:FACTOR,workspaceId:WS,grants:[]}),status=200){
 let queries=0,identities=0;const pool={query:async()=>{queries++;return {rows:[{principal:value,workspaces:[]}],rowCount:1};},connect:async()=>{throw Error('unused');},end:async()=>{}} as SqlPool;
 const auth=createAuthentication(pool,{supabaseUrl:'https://synthetic.supabase.co',publishableKey:'sb_publishable_test'},async()=>{identities++;return Response.json({id:USER,...(factors===undefined?{}:{factors}),user_metadata:{aal:'aal2',role:'admin'}},{status});},()=>new Date(time));
 const request=(token:string)=>new Request('https://desk/v1/me',{headers:{authorization:'Bearer '+token,'x-workspace-id':WS}});
 return {auth,request,queries:()=>queries,identities:()=>identities};
}
test('MFA-enabled human with AAL1 is refused before membership resolution despite metadata',async()=>{
 const f=fixture();await assert.rejects(f.auth.authenticate(f.request(jwt(claims()))),{status:403,code:'mfa_required'});assert.equal(f.queries(),0);assert.equal(f.identities(),1);
});
test('provider validation precedes MFA claims; forged AAL2 token never reaches database after rejection',async()=>{
 const f=fixture([factor],null,401);await assert.rejects(f.auth.authenticate(f.request(jwt(claims('aal2')))),{status:401,code:'unauthorized'});assert.equal(f.queries(),0);
});
test('MFA-enabled AAL2 still requires live workspace grants and cannot turn into admin',async()=>{
 const f=fixture([factor],null);await assert.rejects(f.auth.authenticate(f.request(jwt(claims('aal2')))),{status:403,code:'membership_required'});assert.equal(f.queries(),1);
});
test('provider-validated AAL2 preserves restricted principal scopes',async()=>{
 const p=principal({id:FACTOR,workspaceId:WS,grants:[],scopes:['tickets:read']});const f=fixture([factor],p);const result=await f.auth.authenticate(f.request(jwt(claims('aal2'))));assert.deepEqual(result.scopes,['tickets:read']);assert.equal(f.queries(),1);
});
for(const payload of [claims(),{...claims('aal2'),sub:WS},{...claims('aal2'),exp:time/1000},{...claims('aal2'),exp:'future'},{sub:USER,exp:time/1000+120,user_metadata:{aal:'aal2'}}])test('insufficient/mismatched/expired MFA claims fail closed '+JSON.stringify(payload),async()=>{
 const f=fixture();await assert.rejects(f.auth.authenticate(f.request(jwt(payload))));assert.equal(f.queries(),0);
});
test('workspace discovery cannot disclose workspace names to MFA-enabled AAL1',async()=>{
 const f=fixture();await assert.rejects(f.auth.discoverWorkspaces(f.request(jwt(claims()))),{status:403,code:'mfa_required'});assert.equal(f.queries(),0);
});
for(const factors of [null,{},[{}],[{...factor,status:'unknown'}],[factor,factor],Array.from({length:21},()=>factor)])test('incompatible factor catalog cannot disable MFA '+JSON.stringify(factors).slice(0,70),async()=>{
 const f=fixture(factors);await assert.rejects(f.auth.authenticate(f.request(jwt(claims('aal2')))),{status:503,code:'auth_unavailable'});assert.equal(f.queries(),0);
});
test('unverified factors do not silently force or confer MFA assurance',async()=>{
 const f=fixture([{...factor,status:'unverified'}]);await f.auth.authenticate(f.request('provider-validated-fixture-token'));assert.equal(f.queries(),1);
});
