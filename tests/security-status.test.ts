import test from 'node:test';import assert from 'node:assert/strict';
import {createHumanAuthTransport,HumanAuthError} from '../web/human-auth.js';import {createHumanSession} from '../web/human-session.js';
const U='11111111-1111-4111-8111-111111111111',W='22222222-2222-4222-8222-222222222222',F='33333333-3333-4333-8333-333333333333';
const config={supabase_url:'https://synthetic.supabase.co',publishable_key:'sb_publishable_test'},now=Date.now();
const jwt=(aal='aal2',sub=U,exp=Math.floor(now/1000)+120)=>'e30.'+Buffer.from(JSON.stringify({aal,sub,exp})).toString('base64url')+'.synthetic';
const creds=(token=jwt())=>({accessToken:token,refreshToken:'synthetic_refresh',expiresAt:now+120000,userId:U});
const fields={email:'synthetic@example.test',password:'synthetic',workspace:W};
const snapshot={factors:[{id:F,type:'totp',status:'verified'}],currentLevel:'aal2',observedAt:now};
function deferred<T>(){let resolve!:(v:T)=>void,reject!:(e:unknown)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};}
test('own security reads only GET /user and strips contact, seed, friendly name and raw claims',async()=>{
 const calls:any[]=[];const auth=createHumanAuthTransport(config,{now:()=>now,fetcher:async(url,init)=>{calls.push({url,init});return Response.json({id:U,email:'private@example.test',factors:[{id:F,factor_type:'totp',status:'verified',friendly_name:'<img src=x onerror=private>',secret:'private'},{id:W,factor_type:'phone',status:'unverified',phone:'private'}]});}});
 assert.deepEqual(await auth.securityStatus!(jwt(),U),{...snapshot,factors:[...snapshot.factors,{id:W,type:'phone',status:'unverified'}]});assert.equal(calls.length,1);assert.equal(calls[0].init.method,'GET');assert.equal(calls[0].init.body,undefined);assert.equal(calls[0].url,config.supabase_url+'/auth/v1/user');assert.equal(calls[0].init.cache,'no-store');
});
test('empty live catalog and unsupported/expired/mismatched claims never invent MFA assurance',async()=>{
 const auth=createHumanAuthTransport(config,{now:()=>now,fetcher:async()=>Response.json({id:U})});
 for(const token of [jwt('other'),jwt('aal2',W),jwt('aal2',U,Math.floor(now/1000)), 'aaa.bbb.ccc'])assert.deepEqual(await auth.securityStatus!(token,U),{factors:[],currentLevel:'unknown',observedAt:now});assert.equal((await auth.securityStatus!(jwt('aal1'),U)).currentLevel,'aal1');
});
test('whole malformed catalog or other user rejects without partial factors',async()=>{
 const valid={id:F,factor_type:'totp',status:'verified'};for(const user of [{id:W,factors:[]},{id:U,factors:null},{id:U,factors:[valid,{}]},{id:U,factors:[valid,valid]},{id:U,factors:Array(21).fill(valid)}]){let n=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{n++;return Response.json(user);}});await assert.rejects(auth.securityStatus!(jwt(),U),(e:any)=>e.code==='auth_response_invalid');assert.equal(n,1);}
});
test('security read failure is sanitized, bounded and never retries or writes',async()=>{
 for(const status of [401,403,429,503]){let n=0;const auth=createHumanAuthTransport(config,{fetcher:async()=>{n++;return Response.json({msg:'private'},{status});}});await assert.rejects(auth.securityStatus!(jwt(),U),(e:any)=>!e.message.includes('private'));assert.equal(n,1);}
 const auth=createHumanAuthTransport(config,{timeoutMs:10,fetcher:async()=>new Promise(()=>{})});await assert.rejects(auth.securityStatus!(jwt(),U),(e:any)=>e.code==='auth_unavailable');
});
test('session returns own read without exposing credentials in state or changing active session',async()=>{
 const calls:any[]=[];const session=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),securityStatus:async(...args)=>{calls.push(args);return snapshot as any;},signOut:async()=>{}});await session.signIn(fields);assert.deepEqual(await session.securityStatus(),snapshot);assert.deepEqual(calls,[[jwt(),U]]);assert.equal(session.state().phase,'active');assert.doesNotMatch(JSON.stringify(session.state()),/synthetic_refresh|e30/);
});
test('late catalog cannot be returned after logout or credential rotation',async()=>{
 for(const rotate of [false,true]){const wait=deferred<any>();const session=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(jwt('aal1')),securityStatus:async()=>wait.promise,signOut:async()=>{}});await session.signIn(fields);const read=session.securityStatus(),rejected=assert.rejects(read,(e:any)=>e.code==='stale_session');await Promise.resolve();await Promise.resolve();if(rotate)await session.resume();else await session.signOut();wait.resolve(snapshot);await rejected;}
});
test('current 401 closes session while late 401 cannot invalidate refreshed credentials',async()=>{
 for(const rotate of [false,true]){const wait=deferred<any>();const session=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(jwt('aal1')),securityStatus:async()=>wait.promise,signOut:async()=>{}});await session.signIn(fields);const read=session.securityStatus(),rejected=assert.rejects(read,(e:any)=>e.code===(rotate?'stale_session':'session_rejected'));await Promise.resolve();await Promise.resolve();if(rotate)await session.resume();wait.reject(new HumanAuthError('session_rejected'));await rejected;assert.equal(session.state().phase,rotate?'active':'signed_out');}
});
test('temporary read failure preserves session and requires explicit retry',async()=>{
 let calls=0;const session=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(),securityStatus:async()=>{calls++;throw new HumanAuthError('auth_unavailable');},signOut:async()=>{}});await session.signIn(fields);await assert.rejects(session.securityStatus());assert.equal(calls,1);assert.equal(session.state().phase,'active');
});

import {createSecurityStatusPanel} from '../web/account-security.js';
test('panel rechecks snapshot ownership through the delivery-to-DOM microtask gap and restores update control',async()=>{
 const wait=deferred<any>(),started=deferred<void>(),refresh=deferred<ReturnType<typeof creds>>();const session=createHumanSession({signIn:async()=>creds(),refresh:async()=>refresh.promise,securityStatus:()=>{started.resolve();return wait.promise;},signOut:async()=>{}});await session.signIn(fields);
 const original=globalThis.document;const node=()=>({textContent:'',disabled:false,children:[] as any[],replaceChildren(...items:any[]){this.children=items;},addEventListener(){}});const e={dialog:{...node(),open:false,close(){this.open=false;},showModal(){this.open=true;}},refresh:node(),factors:node(),level:node(),status:node()};
 globalThis.document={createElement:()=>node()} as any;
 try{const panel=createSecurityStatusPanel({elements:e as any,getSession:()=>session,getEpoch:()=>0});const opening=panel.open();await started.promise;wait.resolve(snapshot);let rotation:Promise<unknown>|undefined;queueMicrotask(()=>{rotation=session.resume();});await opening;assert.equal(session.state().phase,'refreshing');assert.equal(e.level.textContent,'');assert.equal(e.factors.children.length,0);assert.equal(e.refresh.disabled,false);refresh.resolve(creds(jwt('aal1')));await rotation;panel.clear();}finally{globalThis.document=original;}
});
test('opaque catalog receipt becomes invalid after same-generation credential rotation',async()=>{
 const session=createHumanSession({signIn:async()=>creds(),refresh:async()=>creds(jwt('aal1')),securityStatus:async()=>snapshot as any,signOut:async()=>{}});await session.signIn(fields);const value=await session.securityStatus();assert.equal(session.securityStatusCurrent(value),true);await session.resume();assert.equal(session.securityStatusCurrent(value),false);assert.equal(session.state().phase,'active');
});

