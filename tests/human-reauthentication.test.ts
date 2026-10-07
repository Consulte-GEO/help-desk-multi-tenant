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
test('reauthentication uses SDK-compatible GET with bearer and no recipient, body or query',async()=>{
 const calls:any[]=[];const auth=createHumanAuthTransport(config,{fetcher:async(url,init)=>{calls.push({url,init});return json({});}});
 assert.equal(await auth.reauthenticate!('aaa.bbb.ccc'),undefined);const {url,init}=calls[0];assert.equal(calls.length,1);assert.equal(url,config.supabase_url+'/auth/v1/reauthenticate');assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.headers.authorization,'Bearer aaa.bbb.ccc');assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');
});
test('invalid bearer and incompatible success never confirm a code request',async()=>{
 let sent=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{sent++;return json({});}});await assert.rejects(auth.reauthenticate!('hd_session_wrong'));assert.equal(sent,0);
 for(const value of [null,[],{access_token:'secret'}, {message_id:'\0private'}]){const auth=createHumanAuthTransport(config,{fetcher:async()=>json(value)});await assert.rejects(auth.reauthenticate!('aaa.bbb.ccc'));}
});
test('reauthentication rate limit, refusal and deadline are sanitized without automatic replay',async()=>{
 for(const [status,code] of [[429,'auth_rate_limited'],[401,'session_rejected'],[422,'auth_reauthentication_rejected'],[503,'auth_unavailable']] as const){
  let sent=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{sent++;return json({msg:'private'},status);}});await assert.rejects(auth.reauthenticate!('aaa.bbb.ccc'),(e:any)=>e.code===code&&!e.message.includes('private'));assert.equal(sent,1);
 }
 const auth=createHumanAuthTransport(config,{timeoutMs:10,fetcher:async()=>new Promise(()=>{})});await assert.rejects(auth.reauthenticate!('aaa.bbb.ccc'));
});
test('password nonce is optional, private and transmitted only with the intended password update',async()=>{
 const bodies:any[]=[];const auth=createHumanAuthTransport(config,{fetcher:async(_,init)=>{bodies.push(JSON.parse(String(init?.body)));return json({id:USER});}});
 await auth.changePassword!('aaa.bbb.ccc',USER,'current','new','123456');await auth.changePassword!('aaa.bbb.ccc',USER,'current','new');assert.deepEqual(bodies,[{current_password:'current',password:'new',nonce:'123456'},{current_password:'current',password:'new'}]);
 for(const nonce of ['a\0b','\ud800','a'.repeat(129),'with spaces',null])await assert.rejects(auth.changePassword!('aaa.bbb.ccc',USER,'current','new',nonce as any));assert.equal(bodies.length,2);
});
test('expired or invalid nonce produces explicit guidance without bypass or raw provider text',async()=>{
 for(const error_code of ['reauthentication_not_valid','otp_expired']){const auth=createHumanAuthTransport(config,{fetcher:async()=>json({code:422,error_code,msg:'private'},422)});await assert.rejects(auth.changePassword!('aaa.bbb.ccc',USER,'current','new','123456'),(e:any)=>e.code==='password_change_nonce_invalid'&&!e.message.includes('private'));}
});
test('session serializes code requests and blocks password/business dispatch while preserving identity',async()=>{
 const wait=deferred<void>();let sent=0;const events:any[]=[];
 const auth=createHumanSession({signIn:async()=>credentials(),refresh:async()=>credentials(),reauthenticate:async()=>{sent++;await wait.promise;},changePassword:async()=>{throw Error('must not dispatch');},signOut:async()=>{}},{onChange:s=>events.push(s)});
 await auth.signIn(fields);const generation=auth.state().generation,op=auth.reauthenticate();await Promise.resolve();await Promise.resolve();assert.equal(auth.state().phase,'reauthenticating');
 await assert.rejects(auth.authorization());await assert.rejects(auth.resume());await assert.rejects(auth.reauthenticate());await assert.rejects(auth.changePassword('current','new'));wait.resolve();await op;
 assert.equal(sent,1);assert.equal(auth.state().phase,'active');assert.equal(auth.state().generation,generation);assert.doesNotMatch(JSON.stringify(events),/aaa|refresh|123456/);
});
test('temporary code request failure preserves the same identity with no password mutation',async()=>{
 let passwords=0;const auth=createHumanSession({signIn:async()=>credentials(),refresh:async()=>credentials(),reauthenticate:async()=>{throw new HumanAuthError('auth_unavailable');},changePassword:async()=>{passwords++;},signOut:async()=>{}});
 await auth.signIn(fields);const generation=auth.state().generation;await assert.rejects(auth.reauthenticate());assert.equal(auth.state().phase,'active');assert.equal(auth.state().generation,generation);assert.equal(passwords,0);
});
test('code nonce reaches the session transport without becoming observable state',async()=>{
 let nonceValue:unknown;const events:any[]=[];const auth=createHumanSession({signIn:async()=>credentials(),refresh:async()=>credentials(),changePassword:async(_,__,___,____,nonce)=>{nonceValue=nonce;},signOut:async()=>{}},{onChange:s=>events.push(s)});
 await auth.signIn(fields);await auth.changePassword('current','new','123456');assert.equal(nonceValue,'123456');assert.doesNotMatch(JSON.stringify(events),/123456/);
});
test('logout and late 401 retain pending reauthentication cleanup until request and provider logout finish',async()=>{
 const request=deferred<void>(),response=deferred<Response>(),logout=deferred<void>();let logouts=0;
 const auth=createHumanSession({signIn:async()=>credentials(),refresh:async()=>credentials(),reauthenticate:async()=>request.promise,signOut:async()=>{logouts++;await logout.promise;}});
 await auth.signIn(fields);const fetcher=createSessionFetch(auth,()=>response.promise),read=fetcher('/tickets');await Promise.resolve();await Promise.resolve();
 const op=auth.reauthenticate(),rejected=assert.rejects(op,(e:any)=>e.code==='stale_session');await Promise.resolve();await Promise.resolve();response.resolve(json({},401));await read;assert.equal(auth.state().phase,'signing_out');await assert.rejects(auth.signIn(fields));
 request.resolve();await rejected;for(let i=0;i<8;i++)await Promise.resolve();assert.equal(logouts,1);await assert.rejects(auth.signIn(fields));logout.resolve();for(let i=0;i<8;i++)await Promise.resolve();await auth.signIn(fields);assert.equal(auth.state().phase,'active');
});
test('same-turn business dispatch cannot escape a starting reauthentication request',async()=>{
 const wait=deferred<void>();let sent=0;
 const auth=createHumanSession({signIn:async()=>credentials(),refresh:async()=>credentials(),reauthenticate:async()=>wait.promise,signOut:async()=>{}});
 await auth.signIn(fields);const fetcher=createSessionFetch(auth,async()=>{sent++;return json({});});
 const code=auth.reauthenticate(),request=fetcher('/tickets',{method:'POST',body:'{}'});
 await assert.rejects(request,(e:any)=>e.requestSent===false);assert.equal(sent,0);wait.resolve();await code;assert.equal(auth.state().phase,'active');
});
test('same-turn business dispatch cannot escape a starting password change',async()=>{
 const wait=deferred<void>();let sent=0;
 const auth=createHumanSession({signIn:async()=>credentials(),refresh:async()=>credentials(),changePassword:async()=>wait.promise,signOut:async()=>{}});
 await auth.signIn(fields);const fetcher=createSessionFetch(auth,async()=>{sent++;return json({});});
 const password=auth.changePassword('current','new'),request=fetcher('/tickets',{method:'POST',body:'{}'});
 await assert.rejects(request,(e:any)=>e.requestSent===false);assert.equal(sent,0);wait.resolve();await password;
});
