import test from 'node:test';import assert from 'node:assert/strict';
import {createHumanAuthTransport} from '../web/human-auth.js';
import {createHumanSession} from '../web/human-session.js';
const USER='11111111-1111-4111-8111-111111111111',FACTOR='33333333-3333-4333-8333-333333333333',CHALLENGE='44444444-4444-4444-8444-444444444444',time=1800000000000;
const config={supabase_url:'https://synthetic.supabase.co',publishable_key:'sb_publishable_test'};
const jwt=(aal='aal2',sub=USER)=>'e30.'+Buffer.from(JSON.stringify({aal,sub,exp:time/1000+120})).toString('base64url')+'.c2ln';
const session=(aal='aal2')=>({access_token:jwt(aal),refresh_token:'refresh_synthetic',expires_in:120,token_type:'bearer',user:{id:USER,factors:[{id:FACTOR,status:'verified',factor_type:'totp'}],user_metadata:{role:'admin'}}});
const challenge=()=>({id:CHALLENGE,type:'totp',expires_at:time/1000+60});
test('TOTP challenge and verification use only fixed selected-factor endpoints and exact private payloads',async()=>{
 const calls:any[]=[];const auth=createHumanAuthTransport(config,{now:()=>time,fetcher:async(url,init)=>{calls.push({url,init});return Response.json(calls.length===1?challenge():session());}});
 const result=await auth.verifyMfa!(jwt('aal1'),USER,FACTOR,'123456');assert.equal(result.userId,USER);assert.equal(result.accessToken,jwt());
 assert.deepEqual(calls.map(c=>c.url),[config.supabase_url+'/auth/v1/factors/'+FACTOR+'/challenge',config.supabase_url+'/auth/v1/factors/'+FACTOR+'/verify']);
 assert.deepEqual(calls.map(c=>JSON.parse(c.init.body)),[{}, {challenge_id:CHALLENGE,code:'123456'}]);for(const {url,init} of calls){assert.equal(init.method,'POST');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.doesNotMatch(url,/123456|refresh_synthetic/);}
 assert.doesNotMatch(JSON.stringify(result),/admin|123456/);
});
for(const value of [{...challenge(),id:'bad'},{...challenge(),type:'phone'},{...challenge(),expires_at:time/1000},null])test('invalid challenge cannot trigger verification '+JSON.stringify(value),async()=>{
 let calls=0;const auth=createHumanAuthTransport(config,{now:()=>time,fetcher:async()=>{calls++;return Response.json(value);}});await assert.rejects(auth.verifyMfa!(jwt('aal1'),USER,FACTOR,'123456'));assert.equal(calls,1);
});
for(const value of [session('aal1'),{...session(),user:{id:FACTOR}},{...session(),access_token:jwt('aal2',FACTOR)}])test('MFA success cannot install downgraded/substituted identity '+JSON.stringify(value).slice(0,90),async()=>{
 let calls=0;const auth=createHumanAuthTransport(config,{now:()=>time,fetcher:async()=>Response.json(++calls===1?challenge():value)});await assert.rejects(auth.verifyMfa!(jwt('aal1'),USER,FACTOR,'123456'),(e:any)=>e.code==='auth_response_invalid');assert.equal(calls,2);
});
test('invalid factor/code is rejected before any network request',async()=>{
 let calls=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{calls++;return Response.json({});}});for(const code of ['12345','1234567','123 56','１２３４５６'])await assert.rejects(auth.verifyMfa!(jwt('aal1'),USER,FACTOR,code));await assert.rejects(auth.verifyMfa!(jwt('aal1'),USER,'../user','123456'));assert.equal(calls,0);
});
test('MFA-enabled refresh with AAL1 cannot silently resume a protected session',async()=>{
 const auth=createHumanAuthTransport(config,{now:()=>time,fetcher:async()=>Response.json(session('aal1'))});await assert.rejects(auth.refresh('refresh_synthetic'),(e:any)=>e.code==='mfa_required');
});
test('policy refusal and unknown MFA error end login rather than presenting a retryable wrong code',async()=>{
 for(const errorCode of ['mfa_verification_rejected','mfa_totp_verify_disabled','future_error']){
  const calls:string[]=[];const transport=createHumanAuthTransport(config,{now:()=>time,fetcher:async(url)=>{
   const path=new URL(String(url)).pathname;calls.push(path);return path.endsWith('/token')?Response.json(session('aal1')):path.endsWith('/challenge')?Response.json(challenge()):path.endsWith('/verify')?Response.json({code:403,error_code:errorCode},{status:403}):new Response(null,{status:204});
  }});const auth=createHumanSession(transport,{now:()=>time});const login=auth.signIn({email:'person@example.test',password:'synthetic',workspace:'22222222-2222-4222-8222-222222222222'}),rejected=assert.rejects(login);
  for(let i=0;i<20&&auth.state().phase!=='verifying_mfa';i++)await new Promise(r=>setTimeout(r,1));
  await assert.rejects(auth.verifyMfa(FACTOR,'123456'),(e:any)=>e.code==='mfa_unavailable');await rejected;assert.equal(auth.state().phase,'signed_out');assert.equal(calls.filter(p=>p.endsWith('/verify')).length,1);assert.equal(calls.filter(p=>p.endsWith('/logout')).length,1);
 }
});
test('same-user malformed MFA session is not installed but newest bearer is retained privately for logout',async()=>{
 const logouts:string[]=[],latest=session(),malformed={...latest,refresh_token:undefined};let failure:any;
 const transport=createHumanAuthTransport(config,{now:()=>time,fetcher:async(url,init)=>{
  const path=new URL(String(url)).pathname;
  if(path.endsWith('/logout')){logouts.push(new Headers(init?.headers).get('authorization')!);return new Response(null,{status:204});}
  return Response.json(path.endsWith('/token')?session('aal1'):path.endsWith('/challenge')?challenge():malformed);
 }});const auth=createHumanSession(transport,{now:()=>time});const login=auth.signIn({email:'person@example.test',password:'synthetic',workspace:'22222222-2222-4222-8222-222222222222'}),rejected=assert.rejects(login);
 for(let i=0;i<20&&auth.state().phase!=='verifying_mfa';i++)await new Promise(r=>setTimeout(r,1));
 try{await auth.verifyMfa(FACTOR,'123456');}catch(error){failure=error;}await rejected;assert.equal(auth.state().phase,'signed_out');assert.deepEqual(logouts,['Bearer '+latest.access_token]);assert.doesNotMatch(JSON.stringify(failure),/access_token|refresh_synthetic|e30\./);
});
