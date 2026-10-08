import test from 'node:test';import assert from 'node:assert/strict';import {createHumanAuthTransport,HumanAuthError} from '../web/human-auth.js';import {createHumanSession} from '../web/human-session.js';
const C={supabase_url:'https://synthetic.supabase.co',publishable_key:'sb_publishable_test'},U='11111111-1111-4111-8111-111111111111',W='22222222-2222-4222-8222-222222222222',mail='person@example.test';const fields={email:mail,password:'synthetic',workspace:W},creds=()=>({accessToken:'aaa.bbb.ccc',refreshToken:'synthetic_refresh',expiresAt:Date.now()+120000,userId:U});function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
test('recovery request sends only normalized email to fixed recover endpoint without bearer/redirect/PKCE',async()=>{
 const calls:any[]=[];const a=createHumanAuthTransport(C,{fetcher:async(url,init)=>{calls.push({url,init});return Response.json({});}});assert.equal(await a.requestRecovery!(' '+mail+' '),undefined);assert.equal(calls.length,1);assert.equal(calls[0].url,C.supabase_url+'/auth/v1/recover');assert.equal(calls[0].init.method,'POST');assert.deepEqual(JSON.parse(calls[0].init.body),{email:mail});assert.equal(calls[0].init.headers.authorization,undefined);assert.equal(calls[0].init.credentials,'omit');assert.equal(calls[0].init.redirect,'error');assert.equal(calls[0].init.referrerPolicy,'no-referrer');
});
test('invalid or oversized recipient cannot dispatch any recovery request',async()=>{
 let calls=0;const a=createHumanAuthTransport(C,{fetcher:async()=>{calls++;return Response.json({});}});for(const bad of ['', 'not-email','a@@example.test','x\0@example.test','x\n@example.test','x\u0001@example.test','x'.repeat(321)+'@example.test'])await assert.rejects(a.requestRecovery!(bad));assert.equal(calls,0);
});
test('acknowledgment containing user/session/message data is not accepted as account or delivery proof',async()=>{
 for(const data of [null,[],{user:{id:U}},{access_token:'private'},{message_id:'private'}]){const a=createHumanAuthTransport(C,{fetcher:async()=>Response.json(data)});await assert.rejects(a.requestRecovery!(mail),(e:any)=>e.code==='recovery_request_unconfirmed');}
});
test('rate limit, captcha/refusal, malformed body and timeout are sanitized and never automatically repeated',async()=>{
 for(const status of [400,403,422,429,503]){let n=0;const a=createHumanAuthTransport(C,{fetcher:async()=>{n++;return Response.json({msg:'private '+mail,error_code:'captcha_failed'},{status});}});await assert.rejects(a.requestRecovery!(mail),(e:any)=>!e.message.includes(mail)&&!e.message.includes('private'));assert.equal(n,1);}const a=createHumanAuthTransport(C,{timeoutMs:10,fetcher:async()=>new Promise(()=>{})});await assert.rejects(a.requestRecovery!(mail));
});
test('request has no credential/workspace/discovery/password side effect and exposes no recipient in state',async()=>{
 let n=0;const s=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),requestRecovery:async()=>{n++;},signOut:async()=>{throw Error('logout must not happen');}});await s.requestRecovery(mail);assert.equal(s.state().phase,'signed_out');assert.equal(s.state().workspace,null);assert.equal(n,1);await assert.rejects(s.authorization());assert.doesNotMatch(JSON.stringify(s.state()),/person|refresh|aaa/);
});
test('in-flight email request blocks new login, duplicate request and recovery-token adoption',async()=>{
 const wait=deferred<void>();let n=0;const s=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),requestRecovery:async()=>{n++;await wait.promise;},verifyRecovery:async()=>creds(),signOut:async()=>{}});const first=s.requestRecovery(mail);await Promise.resolve();await assert.rejects(s.signIn(fields));await assert.rejects(s.requestRecovery(mail));await assert.rejects(s.beginRecovery('private'));wait.resolve();await first;assert.equal(n,1);assert.equal(s.state().phase,'signed_out');
});
test('cancel waits for late request without claiming logout or canceling mail and cannot overwrite replacement login',async()=>{
 const wait=deferred<void>();let logouts=0;const s=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),requestRecovery:()=>wait.promise,signOut:async()=>{logouts++;}});const request=s.requestRecovery(mail),stale=assert.rejects(request,(e:any)=>e.code==='stale_session');await Promise.resolve();const out=s.signOut();await assert.rejects(s.signIn(fields));wait.resolve();await stale;assert.equal(await out,'not_requested');assert.equal(logouts,0);assert.equal(s.state().phase,'signed_out');await s.signIn(fields);assert.equal(s.state().phase,'active');
});
test('failure releases only request context and leaves no automatic email retry',async()=>{
 let calls=0;const s=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),requestRecovery:async()=>{calls++;throw new HumanAuthError('auth_unavailable');},signOut:async()=>{}});await assert.rejects(s.requestRecovery(mail));assert.equal(calls,1);assert.equal(s.state().phase,'signed_out');
});
test('signed-in users cannot request recovery through the unsigned entry point',async()=>{
 let n=0;const s=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),requestRecovery:async()=>{n++;},signOut:async()=>{}});await s.signIn(fields);await assert.rejects(s.requestRecovery(mail));assert.equal(n,0);assert.equal(s.state().phase,'active');
});
test('recovered-password refusal does not instruct the user to provide their old password',async()=>{
 const a=createHumanAuthTransport(C,{fetcher:async()=>Response.json({error_code:'weak_password',msg:'private'},{status:422})});await assert.rejects(a.changeRecoveryPassword!('aaa.bbb.ccc',U,'new'),(e:any)=>e.code==='recovery_password_rejected'&&!/senha atual|private/.test(e.message));
});
