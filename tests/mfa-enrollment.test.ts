import test from 'node:test';import assert from 'node:assert/strict';
import {createHumanAuthTransport,HumanAuthError} from '../web/human-auth.js';import {createHumanSession} from '../web/human-session.js';import {createSessionFetch} from '../web/session-fetch.js';
const USER='11111111-1111-4111-8111-111111111111',WS='22222222-2222-4222-8222-222222222222',FACTOR='33333333-3333-4333-8333-333333333333';
const SECRET='JBSWY3DPEHPK3PXP',config={supabase_url:'https://synthetic.supabase.co',publishable_key:'sb_publishable_test'};
const fields={email:'person@example.test',password:'synthetic',workspace:WS};
const creds=(accessToken='aaa.bbb.ccc')=>({accessToken,refreshToken:'refresh_synthetic',userId:USER,expiresAt:Date.now()+120000});
const enrollment=()=>({generated:true,factors:[{id:FACTOR,type:'totp' as const}],secret:SECRET});
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
test('first enrollment validates own live catalog before a bounded TOTP-only creation and discards SVG/URI',async()=>{
 const calls:any[]=[];const auth=createHumanAuthTransport(config,{fetcher:async(url,init)=>{calls.push({url,init});return Response.json(calls.length===1?{id:USER,factors:[]}:{id:FACTOR,type:'totp',totp:{secret:SECRET,qr_code:'<svg><script>private</script></svg>',uri:'otpauth://private'}});}});
 const result=await auth.enrollFirstMfa!('aaa.bbb.ccc',USER);assert.deepEqual(result,enrollment());assert.equal(calls.length,2);assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.body,undefined);assert.equal(calls[1].url,config.supabase_url+'/auth/v1/factors');assert.deepEqual(JSON.parse(calls[1].init.body),{factor_type:'totp',friendly_name:'Consulte Help Desk',issuer:'Consulte Help Desk'});assert.doesNotMatch(JSON.stringify(result),/svg|script|otpauth|private/);
});
test('verified factor refuses first enrollment and pending own TOTP is resumed without creating/deleting',async()=>{
 for(const status of ['verified','unverified']){let calls=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{calls++;return Response.json({id:USER,factors:[{id:FACTOR,factor_type:'totp',status}]});}});
  if(status==='verified')await assert.rejects(auth.enrollFirstMfa!('aaa.bbb.ccc',USER),(e:any)=>e.code==='mfa_enrollment_exists');else assert.deepEqual(await auth.enrollFirstMfa!('aaa.bbb.ccc',USER),{generated:false,factors:[{id:FACTOR,type:'totp'}]});assert.equal(calls,1);
 }
});
test('mismatched user or malformed catalog cannot create an enrollment',async()=>{
 for(const user of [{id:WS,factors:[]},{id:USER,factors:null},{id:USER,factors:[{}]}]){let calls=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{calls++;return Response.json(user);}});await assert.rejects(auth.enrollFirstMfa!('aaa.bbb.ccc',USER));assert.equal(calls,1);}
});
test('malformed enrollment success never exposes its secret or repeats creation',async()=>{
 for(const result of [{id:'bad',type:'totp',totp:{secret:SECRET}},{id:FACTOR,type:'phone',totp:{secret:SECRET}},{id:FACTOR,type:'totp',totp:{secret:'<script>'}}]){let calls=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>Response.json(++calls===1?{id:USER,factors:[]}:result)});await assert.rejects(auth.enrollFirstMfa!('aaa.bbb.ccc',USER),(e:any)=>!JSON.stringify(e).includes(SECRET));assert.equal(calls,2);}
});
test('enrollment timeout/refusal is sanitized with no automatic retry or factor removal',async()=>{
 for(const status of [422,429,503]){let calls=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>++calls===1?Response.json({id:USER,factors:[]}):Response.json({msg:'private secret'},{status})});await assert.rejects(auth.enrollFirstMfa!('aaa.bbb.ccc',USER),(e:any)=>!e.message.includes('private'));assert.equal(calls,2);}
});
test('session reserves enrollment, blocks dispatch and keeps seed out of observable state',async()=>{
 const wait=deferred<ReturnType<typeof enrollment>>(),events:any[]=[];let requests=0;
 const auth=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),enrollFirstMfa:async()=>wait.promise,signOut:async()=>{}},{onChange:s=>events.push(s)});await auth.signIn(fields);
 const start=auth.beginMfaEnrollment(),fetcher=createSessionFetch(auth,async()=>{requests++;return Response.json({});}),request=fetcher('/tickets',{method:'POST',body:'{}'});await assert.rejects(request,(e:any)=>e.requestSent===false);await assert.rejects(auth.authorization());await assert.rejects(auth.resume());
 wait.resolve(enrollment());assert.deepEqual(await start,enrollment());assert.equal(requests,0);assert.equal(auth.state().phase,'enrolling_mfa');assert.doesNotMatch(JSON.stringify(events),/JBSWY|refresh_synthetic|aaa/);await auth.signOut();
});
test('only owned pending factor can be confirmed, wrong code has explicit retry and success requires new login',async()=>{
 let attempts=0;const out:string[]=[];const auth=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),enrollFirstMfa:async()=>enrollment(),verifyMfa:async()=>{if(++attempts===1)throw new HumanAuthError('mfa_failed');return creds('new.verified.token');},signOut:async(token)=>{out.push(token);}});
 await auth.signIn(fields);await auth.beginMfaEnrollment();await assert.rejects(auth.confirmMfaEnrollment(WS,'123456'));await assert.rejects(auth.confirmMfaEnrollment(FACTOR,'000000'));assert.equal(auth.state().phase,'enrolling_mfa');assert.equal(attempts,1);
 assert.deepEqual(await auth.confirmMfaEnrollment(FACTOR,'123456'),{confirmed:true,logout:'confirmed'});assert.equal(auth.state().phase,'signed_out');assert.deepEqual(out,['new.verified.token']);
});
test('cancel during enrollment generation waits, never returns seed to another context and deletes no factor',async()=>{
 const wait=deferred<ReturnType<typeof enrollment>>();let logouts=0;const auth=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),enrollFirstMfa:async()=>wait.promise,signOut:async()=>{logouts++;}});
 await auth.signIn(fields);const start=auth.beginMfaEnrollment(),stale=assert.rejects(start,(e:any)=>e.code==='stale_session');await Promise.resolve();await Promise.resolve();const out=auth.signOut();await assert.rejects(auth.signIn(fields));wait.resolve(enrollment());await stale;assert.equal(await out,'confirmed');assert.equal(logouts,1);assert.equal(auth.state().phase,'signed_out');
});
test('late 401 retains enrollment cleanup ownership until current operation is settled',async()=>{
 const wait=deferred<ReturnType<typeof enrollment>>(),response=deferred<Response>();let logouts=0;const auth=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),enrollFirstMfa:async()=>wait.promise,signOut:async()=>{logouts++;}});
 await auth.signIn(fields);const fetcher=createSessionFetch(auth,()=>response.promise),get=fetcher('/tickets');await Promise.resolve();await Promise.resolve();const start=auth.beginMfaEnrollment(),stale=assert.rejects(start);await Promise.resolve();await Promise.resolve();response.resolve(Response.json({},{status:401}));await get;await assert.rejects(auth.signIn(fields));wait.resolve(enrollment());await stale;for(let i=0;i<8;i++)await Promise.resolve();assert.equal(logouts,1);assert.equal(auth.state().phase,'signed_out');
});
