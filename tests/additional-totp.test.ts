import test from 'node:test';import assert from 'node:assert/strict';
import {createHumanAuthTransport,HumanAuthError} from '../web/human-auth.js';import {createHumanSession} from '../web/human-session.js';
const U='11111111-1111-4111-8111-111111111111',W='22222222-2222-4222-8222-222222222222',F='33333333-3333-4333-8333-333333333333',NEW='44444444-4444-4444-8444-444444444444',now=Date.now();
const config={supabase_url:'https://synthetic.supabase.co',publishable_key:'sb_publishable_test'},secret='JBSWY3DPEHPK3PXP';
const jwt=(aal='aal2',sub=U)=>'e30.'+Buffer.from(JSON.stringify({aal,sub,exp:Math.floor(now/1000)+120})).toString('base64url')+'.synthetic';
const verified={id:F,factor_type:'totp',status:'verified'},pending={id:NEW,factor_type:'totp',status:'unverified'},enrolled={id:NEW,type:'totp',totp:{secret,uri:'otpauth://private',qr_code:'<svg>private</svg>'}};
const registration={generated:true,factors:[{id:NEW,type:'totp' as const}],secret},creds=(accessToken=jwt())=>({accessToken,refreshToken:'synthetic_refresh',userId:U,expiresAt:now+120000}),fields={email:'synthetic@example.test',password:'synthetic',workspace:W};
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
test('additional TOTP validates own live catalog and AAL2, creates a unique name and exposes only manual seed',async()=>{
 const names:string[]=[];for(let attempt=0;attempt<2;attempt++){const calls:any[]=[];const auth=createHumanAuthTransport(config,{now:()=>now,fetcher:async(url,init)=>{calls.push({url,init});return Response.json(calls.length===1?{id:U,factors:[verified]}:enrolled);}});assert.deepEqual(await auth.enrollAdditionalMfa!(jwt(),U),registration);assert.equal(calls.length,2);assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.body,undefined);const body=JSON.parse(calls[1].init.body);assert.equal(body.factor_type,'totp');assert.equal(body.issuer,'Consulte Help Desk');assert.match(body.friendly_name,/^Consulte Help Desk · [0-9a-f-]{36}$/);assert.deepEqual(Object.keys(body).sort(),['factor_type','friendly_name','issuer']);names.push(body.friendly_name);assert.equal(calls[1].init.headers.authorization,'Bearer '+jwt());assert.doesNotMatch(JSON.stringify(registration),/svg|otpauth/);}assert.notEqual(names[0],names[1]);
});
test('AAL1 or mismatched claims cannot add or resume a factor even with verified catalog',async()=>{
 for(const token of [jwt('aal1'),jwt('aal2',W),'aaa.bbb.ccc']){let calls=0;const auth=createHumanAuthTransport(config,{now:()=>now,fetcher:async()=>{calls++;return Response.json({id:U,factors:[verified,pending]});}});await assert.rejects(auth.enrollAdditionalMfa!(token,U),(e:any)=>e.code==='mfa_required');assert.equal(calls,1);}
});
test('no verified factor uses first-setup guidance and never creates through additional flow',async()=>{
 for(const factors of [[],[pending]]){let calls=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{calls++;return Response.json({id:U,factors});}});await assert.rejects(auth.enrollAdditionalMfa!(jwt(),U),(e:any)=>e.code==='mfa_addition_requires_verified');assert.equal(calls,1);}
});
test('existing pending TOTP resumes under AAL2 without creating, deleting or disclosing previous seed',async()=>{
 let calls=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{calls++;return Response.json({id:U,factors:[verified,{...pending,secret:'private',friendly_name:'private'}]});}});assert.deepEqual(await auth.enrollAdditionalMfa!(jwt(),U),{generated:false,factors:[{id:NEW,type:'totp'}]});assert.equal(calls,1);
});
test('entire invalid catalog, duplicate or wrong user refuses additional setup before writing',async()=>{
 for(const data of [{id:W,factors:[verified]},{id:U,factors:[verified,{}]},{id:U,factors:[verified,verified]},{id:U,factors:null}]){let calls=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{calls++;return Response.json(data);}});await assert.rejects(auth.enrollAdditionalMfa!(jwt(),U));assert.equal(calls,1);}
});
test('new enrollment cannot reuse a verified or other catalog factor ID',async()=>{
 let calls=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>Response.json(++calls===1?{id:U,factors:[verified]}:{...enrolled,id:F})});await assert.rejects(auth.enrollAdditionalMfa!(jwt(),U),(e:any)=>e.code==='auth_response_invalid');assert.equal(calls,2);
});
test('catalog at supported limit refuses a new creation without disabling or deleting existing factors',async()=>{
 const factors=Array.from({length:20},(_,i)=>({...verified,id:(i+1).toString(16).padStart(8,'0')+'-1111-4111-8111-111111111111'}));let calls=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{calls++;return Response.json({id:U,factors});}});await assert.rejects(auth.enrollAdditionalMfa!(jwt(),U),(e:any)=>e.code==='mfa_factor_limit');assert.equal(calls,1);
});
test('additional setup uses owned enrollment phase, rejects old factor confirmation and ends after new factor confirmation',async()=>{
 let first=0,additional=0,attempts=0;const out:string[]=[];const session=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),enrollFirstMfa:async()=>{first++;return registration;},enrollAdditionalMfa:async()=>{additional++;return registration;},verifyMfa:async()=>{attempts++;return creds('new.verified.token');},signOut:async token=>{out.push(token);}});await session.signIn(fields);await session.beginMfaEnrollment({additional:true});assert.equal(first,0);assert.equal(additional,1);assert.equal(session.state().phase,'enrolling_mfa');await assert.rejects(session.authorization());await assert.rejects(session.confirmMfaEnrollment(F,'123456'));assert.equal(attempts,0);await session.confirmMfaEnrollment(NEW,'123456');assert.equal(attempts,1);assert.equal(session.state().phase,'signed_out');assert.deepEqual(out,['new.verified.token']);
});
test('preflight-only additional guidance preserves session but AAL1 refusal logs out once',async()=>{
 for(const code of ['mfa_addition_requires_verified','mfa_factor_limit','mfa_required']){let logouts=0;const session=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),enrollAdditionalMfa:async()=>{throw new HumanAuthError(code);},signOut:async()=>{logouts++;}});await session.signIn(fields);await assert.rejects(session.beginMfaEnrollment({additional:true}),(e:any)=>e.code===code);assert.equal(session.state().phase,code==='mfa_required'?'signed_out':'active');assert.equal(logouts,code==='mfa_required'?1:0);}
});
test('cancelling additional creation never installs its seed or deletes existing factor',async()=>{
 const wait=deferred<typeof registration>();let out=0;const session=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),enrollAdditionalMfa:async()=>wait.promise,signOut:async()=>{out++;}});await session.signIn(fields);const read=session.beginMfaEnrollment({additional:true}),rejected=assert.rejects(read,(e:any)=>e.code==='stale_session');await Promise.resolve();await Promise.resolve();const logout=session.signOut();await assert.rejects(session.signIn(fields));wait.resolve(registration);await rejected;await logout;assert.equal(out,1);assert.equal(session.state().phase,'signed_out');assert.doesNotMatch(JSON.stringify(session.state()),/JBSWY/);
});
