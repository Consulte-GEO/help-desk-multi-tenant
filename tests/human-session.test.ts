import test from 'node:test';
import assert from 'node:assert/strict';
import {createHumanSession} from '../web/human-session.js';
import {createSessionFetch} from '../web/session-fetch.js';
import {HumanAuthError} from '../web/human-auth.js';
const WS='11111111-1111-4111-8111-111111111111', USER='22222222-2222-4222-8222-222222222222';
const fields={email:'person@example.test',password:' senha não aparar ',workspace:WS};
function deferred<T>(){let resolve!:(v:T)=>void,reject!:(e:unknown)=>void;const promise=new Promise<T>((y,n)=>{resolve=y;reject=n;});return {promise,resolve,reject};}
function fixture(){
 let time=1_800_000_000_000,seq=0;const seen:{operation:string;value:unknown}[]=[],events:any[]=[];
 const session=()=>({accessToken:'aaa.bbb.'+(++seq),refreshToken:'refresh_'+seq,expiresAt:time+120000,userId:USER});
 const transport={signIn:async(email:string,password:string)=>{seen.push({operation:'login',value:{email,password}});return session();},refresh:async(token:string)=>{seen.push({operation:'refresh',value:token});return session();},signOut:async(token:string)=>{seen.push({operation:'logout',value:token});}};
 const auth=createHumanSession(transport,{now:()=>time,onChange:s=>events.push(s)});
 return {auth,transport,seen,events,session,advance:(ms:number)=>{time+=ms;},now:()=>time};
}
test('human login is memory-only and public state never contains tokens/password/user metadata',async()=>{
 const f=fixture();await f.auth.signIn(fields);const p=await f.auth.authorization();assert.equal(p.workspace,WS);assert.match(p.accessToken,/aaa/);assert.equal(f.auth.state().phase,'active');assert.doesNotMatch(JSON.stringify(f.events),/aaa|refresh_|senha|person@example/);
});
test('fresh token causes no refresh and concurrent near-expiry requests share exactly one rotation',async()=>{
 const f=fixture();await f.auth.signIn(fields);await f.auth.authorization();assert.equal(f.seen.length,1);f.advance(70000);
 const wait=deferred<any>();let n=0;f.transport.refresh=async()=>{n++;return wait.promise;};
 const a=f.auth.authorization(),b=f.auth.authorization();await Promise.resolve();assert.equal(n,1);wait.resolve(f.session());const [x,y]=await Promise.all([a,b]);assert.equal(x.accessToken,y.accessToken);
});
test('next rotation uses newly returned refresh token, not the consumed one',async()=>{
 const f=fixture();await f.auth.signIn(fields);f.advance(70000);await f.auth.authorization();f.advance(70000);await f.auth.authorization();assert.deepEqual(f.seen.filter(x=>x.operation==='refresh').map(x=>x.value),['refresh_1','refresh_2']);
});
test('temporary refresh failure pauses requests and explicit retry resumes without changing identity generation',async()=>{
 const f=fixture();await f.auth.signIn(fields);const generation=f.auth.state().generation;f.advance(70000);const original=f.transport.refresh;let calls=0;f.transport.refresh=async()=>{calls++;throw new HumanAuthError('auth_unavailable');};
 await assert.rejects(f.auth.authorization(),/renova|sessão/i);assert.equal(f.auth.state().phase,'paused');await assert.rejects(f.auth.authorization());assert.equal(calls,1);f.transport.refresh=original;await f.auth.resume();assert.equal(f.auth.state().phase,'active');assert.equal(f.auth.state().generation,generation);
});
test('invalid refresh clears the local identity and cannot keep using old token',async()=>{
 const f=fixture();await f.auth.signIn(fields);f.advance(70000);f.transport.refresh=async()=>{throw new HumanAuthError('session_rejected');};await assert.rejects(f.auth.authorization());assert.equal(f.auth.state().phase,'signed_out');assert.equal(f.auth.state().workspace,null);await assert.rejects(f.auth.authorization());
});
test('identity substitution during refresh never installs the returned token',async()=>{
 const f=fixture();await f.auth.signIn(fields);f.advance(70000);f.transport.refresh=async()=>({...f.session(),userId:'33333333-3333-4333-8333-333333333333'});await assert.rejects(f.auth.authorization());assert.equal(f.auth.state().phase,'signed_out');
});
test('signout clears local state before network confirms, and never emits refresh tokens',async()=>{
 const f=fixture();await f.auth.signIn(fields);const wait=deferred<void>();f.transport.signOut=()=>wait.promise;const out=f.auth.signOut();assert.equal(f.auth.state().phase,'signed_out');await assert.rejects(f.auth.authorization());wait.resolve();assert.equal(await out,'confirmed');assert.doesNotMatch(JSON.stringify(f.events),/aaa|refresh_/);
});
test('failed remote logout is explicitly unconfirmed with local state still cleared',async()=>{
 const f=fixture();await f.auth.signIn(fields);f.transport.signOut=async()=>{throw Error('provider secret diagnostic');};assert.equal(await f.auth.signOut(),'unconfirmed');assert.equal(f.auth.state().phase,'signed_out');
});
test('logout when no identity was started does not contact provider',async()=>{const f=fixture();assert.equal(await f.auth.signOut(),'not_requested');assert.equal(f.seen.length,0);});
test('double click at login is rejected instead of starting two provider sessions',async()=>{
 const f=fixture(),wait=deferred<any>();let n=0;f.transport.signIn=async()=>{n++;return wait.promise;};const a=f.auth.signIn(fields);await assert.rejects(f.auth.signIn(fields));assert.equal(n,1);wait.resolve(f.session());await a;
});
test('cancelled login cannot resurrect identity; its late provider session is signed out',async()=>{
 const f=fixture(),wait=deferred<any>();f.transport.signIn=()=>wait.promise;const a=f.auth.signIn(fields);const rejected=assert.rejects(a,/sessão|cancelad/i);const out=f.auth.signOut();wait.resolve(f.session());await rejected;assert.equal(await out,'confirmed');assert.equal(f.auth.state().phase,'signed_out');assert.equal(f.seen.filter(x=>x.operation==='logout').length,1);
});
test('logout during refresh waits for latest rotated token without restoring cleared state',async()=>{
 const f=fixture();await f.auth.signIn(fields);f.advance(70000);const wait=deferred<any>();f.transport.refresh=()=>wait.promise;const a=f.auth.authorization();const rejected=assert.rejects(a);const out=f.auth.signOut();assert.equal(f.auth.state().phase,'signed_out');const latest=f.session();wait.resolve(latest);await rejected;assert.equal(await out,'confirmed');assert.deepEqual(f.seen.filter(x=>x.operation==='logout').map(x=>x.value),[latest.accessToken]);
});
test('new login survives completion and failure of previous logout/refresh',async()=>{
 const f=fixture();await f.auth.signIn(fields);f.advance(70000);const wait=deferred<any>();f.transport.refresh=()=>wait.promise;const old=f.auth.authorization(),rejected=assert.rejects(old);const out=f.auth.signOut();await f.auth.signIn(fields);const active=await f.auth.authorization();wait.resolve(f.session());await rejected;await out;assert.equal((await f.auth.authorization()).accessToken,active.accessToken);assert.equal(f.auth.state().phase,'active');
});
test('401 for current access token clears identity; stale token refusal after refresh does not',async()=>{
 const f=fixture();await f.auth.signIn(fields);const old=await f.auth.authorization();f.advance(70000);const fresh=await f.auth.authorization();assert.equal(f.auth.reject(old),false);assert.equal(f.auth.state().phase,'active');assert.equal(f.auth.reject(fresh),true);assert.equal(f.auth.state().phase,'signed_out');
});
test('workspace is captured before login and invalid selector is rejected before network',async()=>{
 const f=fixture();await assert.rejects(f.auth.signIn({...fields,workspace:'demo-workspace'}));assert.equal(f.seen.length,0);const args={...fields};const wait=deferred<any>();f.transport.signIn=()=>wait.promise;const a=f.auth.signIn(args);args.workspace='33333333-3333-4333-8333-333333333333';wait.resolve(f.session());await a;assert.equal((await f.auth.authorization()).workspace,WS);
});
test('observer failure does not change auth outcome or leak a rejection',async()=>{
 const f=fixture();const auth=createHumanSession(f.transport,{now:f.now,onChange:async()=>{throw Error('observer failed');}});await auth.signIn(fields);assert.equal(auth.state().phase,'active');await auth.signOut();
});
test('API wrapper never repeats a submitted mutation after 401 or 503',async()=>{
 for(const status of [401,503]){const f=fixture();await f.auth.signIn(fields);const requests:any[]=[];const request=createSessionFetch(f.auth,async(url,init)=>{requests.push({url,init});return new Response('{}',{status});});const response=await request('/tickets',{method:'POST',headers:{'idempotency-key':'same-key'},body:'{"subject":"test"}'});assert.equal(response.status,status);assert.equal(requests.length,1);assert.equal(new Headers(requests[0].init.headers).get('idempotency-key'),'same-key');}
});
test('API wrapper refreshes before sending once, and callers cannot override auth/workspace headers',async()=>{
 const f=fixture();await f.auth.signIn(fields);f.advance(70000);const requests:any[]=[];const request=createSessionFetch(f.auth,async(url,init)=>{requests.push({url,init});return new Response('{}');});await request('/tickets',{method:'POST',headers:{authorization:'Bearer stolen','x-workspace-id':'other','idempotency-key':'original'},body:'{}'});const h=new Headers(requests[0].init.headers);assert.match(h.get('authorization')!,/aaa.bbb.2/);assert.equal(h.get('x-workspace-id'),WS);assert.equal(h.get('idempotency-key'),'original');assert.equal(requests[0].init.redirect,'error');assert.equal(requests[0].init.credentials,'omit');assert.equal(requests.length,1);
});
test('API wrapper sends nothing while refresh is paused',async()=>{
 const f=fixture();await f.auth.signIn(fields);f.advance(70000);f.transport.refresh=async()=>{throw new HumanAuthError('auth_unavailable');};let sent=0;const request=createSessionFetch(f.auth,async()=>{sent++;return new Response('{}');});await assert.rejects(request('/tickets',{method:'POST',body:'{}'}));assert.equal(sent,0);
});
test('API response from an ended identity cannot be handed to the new identity',async()=>{
 const f=fixture();await f.auth.signIn(fields);const wait=deferred<Response>();const request=createSessionFetch(f.auth,()=>wait.promise);const old=request('/tickets');await Promise.resolve();await f.auth.signOut();await f.auth.signIn(fields);wait.resolve(new Response('{}'));await assert.rejects(old,/sessão|cancelad/i);assert.equal(f.auth.state().phase,'active');
});
test('absolute/protocol-relative/escaping API destinations are denied before credentials are obtained',async()=>{
 const f=fixture();await f.auth.signIn(fields);let sent=0;const request=createSessionFetch(f.auth,async()=>{sent++;return new Response('{}');});for(const p of ['https://evil.test','//evil.test','/../auth','/tickets\\evil','/%2e%2e/evil'])await assert.rejects(request(p));assert.equal(sent,0);
});
test('auth refusal before business dispatch is marked unsent, unlike a network failure after dispatch',async()=>{
 const f=fixture();await f.auth.signIn(fields);f.advance(70000);f.transport.refresh=async()=>{throw new HumanAuthError('auth_unavailable');};
 const request=createSessionFetch(f.auth,async()=>{throw Error('network response lost');});
 await assert.rejects(request('/tickets',{method:'POST',body:'{}'}),(e:any)=>e.requestSent===false);
 f.transport.refresh=async()=>f.session();await f.auth.resume();
 await assert.rejects(request('/tickets',{method:'POST',body:'{}'}),(e:any)=>e.requestSent!==false);
});
test('short valid access lifetimes do not rotate on every request immediately after login',async()=>{
 const f=fixture();f.transport.signIn=async()=>({...f.session(),expiresAt:f.now()+30000});await f.auth.signIn(fields);
 await f.auth.authorization();await f.auth.authorization();assert.equal(f.seen.filter(x=>x.operation==='refresh').length,0);
 f.advance(16000);await f.auth.authorization();assert.equal(f.seen.filter(x=>x.operation==='refresh').length,1);
});
