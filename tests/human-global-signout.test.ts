import test from 'node:test';
import assert from 'node:assert/strict';
import {createHumanAuthTransport,HumanAuthError} from '../web/human-auth.js';
import {createHumanSession} from '../web/human-session.js';
const config={supabase_url:'https://syntheticproject.supabase.co',publishable_key:'sb_publishable_test'};
const fields={email:'person@example.test',password:'synthetic',workspace:'11111111-1111-4111-8111-111111111111'};
const issued={accessToken:'aaa.bbb.ccc',refreshToken:'synthetic_refresh',userId:'22222222-2222-4222-8222-222222222222',expiresAt:Date.now()+120000};
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
test('global logout uses explicit provider scope without body, redirects or credential storage',async()=>{
 const calls:any[]=[];const auth=createHumanAuthTransport(config,{fetcher:async(url,init)=>{calls.push({url,init});return new Response(null,{status:204});}});
 await auth.signOut(issued.accessToken,'global');await auth.signOut(issued.accessToken);
 assert.deepEqual(calls.map(x=>x.url),[config.supabase_url+'/auth/v1/logout?scope=global',config.supabase_url+'/auth/v1/logout?scope=local']);
 for(const {init} of calls){assert.equal(init.body,undefined);assert.equal(init.headers.authorization,'Bearer '+issued.accessToken);assert.equal(init.redirect,'error');assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');}
});
test('unsupported logout scope never dispatches or silently escalates to global',async()=>{
 let sent=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{sent++;return new Response(null,{status:204});}});
 for(const scope of ['others','global&redirect=evil','','GLOBAL',null])await assert.rejects(auth.signOut(issued.accessToken,scope as any),(e:any)=>e instanceof HumanAuthError&&e.code==='invalid_logout_scope');
 assert.equal(sent,0);
});
test('global provider failure or timeout is not reported as confirmed',async()=>{
 const refused=createHumanAuthTransport(config,{fetcher:async()=>new Response('{}',{status:503})});
 await assert.rejects(refused.signOut(issued.accessToken,'global'));
 const hung=createHumanAuthTransport(config,{timeoutMs:10,fetcher:async()=>new Promise(()=>{})});
 await assert.rejects(hung.signOut(issued.accessToken,'global'));
});
test('global logout clears credentials synchronously and blocks login until provider completes',async()=>{
 const wait=deferred<void>(),calls:any[]=[],events:any[]=[];
 const auth=createHumanSession({signIn:async()=>issued,refresh:async()=>issued,signOut:async(token,scope)=>{calls.push({token,scope});await wait.promise;}},{onChange:s=>events.push(s)});
 await auth.signIn(fields);const proof=await auth.authorization();const out=auth.signOut({scope:'global'});
 assert.equal(auth.state().phase,'signing_out');assert.equal(auth.state().workspace,null);assert.equal(auth.current(proof),false);
 await assert.rejects(auth.authorization());await assert.rejects(auth.signIn(fields));
 assert.doesNotMatch(JSON.stringify(events),/aaa|synthetic_refresh/);
 wait.resolve();assert.equal(await out,'confirmed');assert.equal(auth.state().phase,'signed_out');assert.deepEqual(calls,[{token:issued.accessToken,scope:'global'}]);
 await auth.signIn(fields);assert.equal(auth.state().phase,'active');
});
test('repeated global logout joins the existing request and cannot start a second revocation',async()=>{
 const wait=deferred<void>();let calls=0;
 const auth=createHumanSession({signIn:async()=>issued,refresh:async()=>issued,signOut:async()=>{calls++;await wait.promise;}});
 await auth.signIn(fields);const a=auth.signOut({scope:'global'}),b=auth.signOut({scope:'global'});wait.resolve();assert.equal(await a,'confirmed');assert.equal(await b,'confirmed');assert.equal(calls,1);
});
test('global logout during refresh revokes latest issued token without restoring identity',async()=>{
 let time=0;const first={...issued,expiresAt:120000},latest={...first,accessToken:'new.bearer.token',expiresAt:190000},wait=deferred<typeof first>(),calls:any[]=[];
 const auth=createHumanSession({signIn:async()=>first,refresh:()=>wait.promise,signOut:async(token,scope)=>{calls.push({token,scope});}},{now:()=>time});
 await auth.signIn(fields);time=70000;const rotating=auth.authorization(),rejected=assert.rejects(rotating);const out=auth.signOut({scope:'global'});wait.resolve(latest);
 await rejected;assert.equal(await out,'confirmed');assert.equal(auth.state().phase,'signed_out');assert.deepEqual(calls,[{token:latest.accessToken,scope:'global'}]);
});
test('failed global logout unlocks login but leaves local credentials removed',async()=>{
 const auth=createHumanSession({signIn:async()=>issued,refresh:async()=>issued,signOut:async()=>{throw Error('private provider error');}});
 await auth.signIn(fields);assert.equal(await auth.signOut({scope:'global'}),'unconfirmed');assert.equal(auth.state().phase,'signed_out');await assert.rejects(auth.authorization());await auth.signIn(fields);assert.equal(auth.state().phase,'active');
});
test('invalid session logout scope preserves active session without contacting provider',async()=>{
 let sent=0;const auth=createHumanSession({signIn:async()=>issued,refresh:async()=>issued,signOut:async()=>{sent++;}});
 await auth.signIn(fields);await assert.rejects(auth.signOut({scope:'others'} as any));assert.equal(auth.state().phase,'active');assert.equal(sent,0);
});
