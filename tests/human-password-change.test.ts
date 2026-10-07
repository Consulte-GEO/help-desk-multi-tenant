import test from 'node:test';import assert from 'node:assert/strict';
import {createHumanAuthTransport,HumanAuthError} from '../web/human-auth.js';
import {createHumanSession} from '../web/human-session.js';
import {createSessionFetch} from '../web/session-fetch.js';
const USER='22222222-2222-4222-8222-222222222222',WS='11111111-1111-4111-8111-111111111111';
const config={supabase_url:'https://syntheticproject.supabase.co',publishable_key:'sb_publishable_test'};
const credentials=()=>({accessToken:'aaa.bbb.ccc',refreshToken:'synthetic_refresh',userId:USER,expiresAt:Date.now()+120000});
const fields={email:'person@example.test',password:'synthetic',workspace:WS};
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
test('password change sends only both password fields to fixed PUT user endpoint and returns no metadata',async()=>{
 const calls:any[]=[];const auth=createHumanAuthTransport(config,{fetcher:async(url,init)=>{calls.push({url,init});return json({id:USER,user_metadata:{role:'admin'}});}});
 assert.equal(await auth.changePassword!('aaa.bbb.ccc',USER,' current password ',' new password '),undefined);
 assert.equal(calls.length,1);const {url,init}=calls[0];assert.equal(url,config.supabase_url+'/auth/v1/user');assert.equal(init.method,'PUT');assert.deepEqual(JSON.parse(init.body),{current_password:' current password ',password:' new password '});assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');
});
test('invalid password or identity inputs fail before password dispatch',async()=>{
 let sent=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{sent++;return json({id:USER});}});
 for(const password of ['', 'a\0b','\ud800','a'.repeat(4097)])await assert.rejects(auth.changePassword!('aaa.bbb.ccc',USER,'current',password));
 await assert.rejects(auth.changePassword!('hd_session_fake',USER,'current','new'));
 await assert.rejects(auth.changePassword!('aaa.bbb.ccc','wrong-id','current','new'));assert.equal(sent,0);
});
test('provider password policy and MFA refusals are sanitized and never silently weakened',async()=>{
 for(const [providerCode,expected] of [['weak_password','password_change_rejected'],['reauthentication_needed','password_change_reauthenticate'],['insufficient_aal','password_change_requires_mfa']]){
  const auth=createHumanAuthTransport(config,{fetcher:async()=>json({code:providerCode,msg:'private diagnostic password secret'},400)});
  await assert.rejects(auth.changePassword!('aaa.bbb.ccc',USER,'current','new'),(e:any)=>e instanceof HumanAuthError&&e.code===expected&&!e.message.includes('secret'));
 }
});
test('legacy numeric provider code preserves semantic MFA and recent-auth guidance',async()=>{
 for(const [error_code,expected] of [['insufficient_aal','password_change_requires_mfa'],['reauthentication_needed','password_change_reauthenticate']]){
  const auth=createHumanAuthTransport(config,{fetcher:async()=>json({code:401,error_code,msg:'private'},401)});
  await assert.rejects(auth.changePassword!('aaa.bbb.ccc',USER,'current','new'),(e:any)=>e.code===expected);
 }
});
test('malformed or wrong-user success and timeout cannot confirm a password change',async()=>{
 for(const response of [()=>json({id:WS}),()=>json({}),()=>json({id:USER},204),()=>new Response('not-json')]){
  const auth=createHumanAuthTransport(config,{fetcher:async()=>response()});await assert.rejects(auth.changePassword!('aaa.bbb.ccc',USER,'current','new'));
 }
 const auth=createHumanAuthTransport(config,{timeoutMs:10,fetcher:async()=>new Promise(()=>{})});await assert.rejects(auth.changePassword!('aaa.bbb.ccc',USER,'current','new'));
});
test('session serializes password mutation, blocks other dispatches, then clears local credentials and logs out',async()=>{
 const wait=deferred<void>(),calls:any[]=[],events:any[]=[];
 const auth=createHumanSession({signIn:async()=>credentials(),refresh:async()=>credentials(),changePassword:async(...args)=>{calls.push(args);await wait.promise;},signOut:async(token,scope)=>{calls.push({token,scope});}},{onChange:s=>events.push(s)});
 await auth.signIn(fields);const op=auth.changePassword('current','new');await Promise.resolve();await Promise.resolve();
 assert.equal(auth.state().phase,'changing_password');await assert.rejects(auth.authorization());await assert.rejects(auth.resume());await assert.rejects(auth.changePassword('current','other'));assert.equal(calls.length,1);
 wait.resolve();assert.deepEqual(await op,{changed:true,logout:'confirmed'});assert.equal(auth.state().phase,'signed_out');assert.equal(calls[1].scope,'local');assert.doesNotMatch(JSON.stringify(events),/aaa|synthetic_refresh|current|new/);
});
test('lost password response is not retried; session is cleared and logout truth is attached',async()=>{
 let calls=0;const auth=createHumanSession({signIn:async()=>credentials(),refresh:async()=>credentials(),changePassword:async()=>{calls++;throw new HumanAuthError('auth_unavailable');},signOut:async()=>{throw Error('private');}});
 await auth.signIn(fields);await assert.rejects(auth.changePassword('current','new'),(e:any)=>e.code==='auth_unavailable'&&e.logoutUnconfirmed===true);assert.equal(calls,1);assert.equal(auth.state().phase,'signed_out');
});
test('logout during password change invalidates result and never clears a subsequent login',async()=>{
 const wait=deferred<void>();const auth=createHumanSession({signIn:async()=>credentials(),refresh:async()=>credentials(),changePassword:async()=>wait.promise,signOut:async()=>{}});
 await auth.signIn(fields);const op=auth.changePassword('current','new'),rejected=assert.rejects(op,(e:any)=>e.code==='stale_session');await Promise.resolve();await Promise.resolve();
 const out=auth.signOut();await assert.rejects(auth.signIn(fields));wait.resolve();await out;await rejected;await auth.signIn(fields);assert.equal(auth.state().phase,'active');
});
test('password result does not unlock login before its provider logout completes',async()=>{
 const logout=deferred<void>();const auth=createHumanSession({signIn:async()=>credentials(),refresh:async()=>credentials(),changePassword:async()=>{},signOut:async()=>logout.promise});
 await auth.signIn(fields);const op=auth.changePassword('current','new');
 for(let i=0;i<8;i++)await Promise.resolve();
 assert.equal(auth.state().phase,'signing_out');await assert.rejects(auth.signIn(fields));
 logout.resolve();assert.deepEqual(await op,{changed:true,logout:'confirmed'});assert.equal(auth.state().phase,'signed_out');
});
test('late API 401 cannot drop pending password change or unlock login; cleanup is requested exactly once',async()=>{
 const password=deferred<void>(),response=deferred<Response>(),logout=deferred<void>();let logouts=0;
 const auth=createHumanSession({signIn:async()=>credentials(),refresh:async()=>credentials(),changePassword:async()=>password.promise,signOut:async()=>{logouts++;await logout.promise;}});
 await auth.signIn(fields);const request=createSessionFetch(auth,()=>response.promise),get=request('/tickets');await Promise.resolve();await Promise.resolve();
 const op=auth.changePassword('current','new'),opRejected=assert.rejects(op,(e:any)=>e.code==='stale_session');await Promise.resolve();await Promise.resolve();
 response.resolve(json({code:'unauthorized'},401));assert.equal((await get).status,401);
 assert.equal(auth.state().phase,'signing_out');await assert.rejects(auth.signIn(fields));assert.equal(logouts,0);
 password.resolve();await opRejected;for(let i=0;i<8;i++)await Promise.resolve();assert.equal(logouts,1);await assert.rejects(auth.signIn(fields));
 logout.resolve();for(let i=0;i<8;i++)await Promise.resolve();assert.equal(auth.state().phase,'signed_out');assert.equal(logouts,1);
});
