import test from 'node:test';import assert from 'node:assert/strict';
import {createHumanSession} from '../web/human-session.js';import {HumanAuthError} from '../web/human-auth.js';
import {createSessionFetch} from '../web/session-fetch.js';
const USER='11111111-1111-4111-8111-111111111111',WS='22222222-2222-4222-8222-222222222222',FACTOR='33333333-3333-4333-8333-333333333333';
const fields={email:'person@example.test',password:'synthetic',workspace:WS};
const value=(token='aaa.bbb.ccc')=>({accessToken:token,refreshToken:'refresh_synthetic',userId:USER,expiresAt:Date.now()+120000,mfaFactors:[{id:FACTOR,type:'totp' as const}]});
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
async function choosing(auth:ReturnType<typeof createHumanSession>){for(let i=0;i<8;i++)await Promise.resolve();assert.equal(auth.state().phase,'verifying_mfa');}
test('TOTP login does not install a bearer or discover workspaces until code verification',async()=>{
 const events:any[]=[],calls:any[]=[];const auth=createHumanSession({signIn:async()=>value(),refresh:async()=>value(),verifyMfa:async(...args)=>{calls.push(args);return value('verified.new.token');},signOut:async()=>{}},{onChange:s=>events.push(s)});
 const login=auth.signIn(fields);await choosing(auth);await assert.rejects(auth.authorization());assert.equal(auth.state().mfaFactors.length,1);
 await auth.verifyMfa(FACTOR,'123456');await login;assert.equal((await auth.authorization()).accessToken,'verified.new.token');assert.deepEqual(calls[0],[value().accessToken,USER,FACTOR,'123456']);assert.doesNotMatch(JSON.stringify(events),/aaa|refresh_synthetic|123456/);
});
test('unsupported verified factor cannot be skipped into AAL1 workspace access',async()=>{
 const auth=createHumanSession({signIn:async()=>({...value(),mfaFactors:[{id:FACTOR,type:'phone' as const}]}),refresh:async()=>value(),signOut:async()=>{}});await assert.rejects(auth.signIn(fields),(e:any)=>e.code==='unsupported_mfa');assert.equal(auth.state().phase,'signed_out');
});
test('invalid/foreign factor selector and malformed code dispatch nothing',async()=>{
 let calls=0;const auth=createHumanSession({signIn:async()=>value(),refresh:async()=>value(),verifyMfa:async()=>{calls++;return value();},signOut:async()=>{}});const login=auth.signIn(fields),cancelled=assert.rejects(login);await choosing(auth);
 await assert.rejects(auth.verifyMfa(WS,'123456'));await assert.rejects(auth.verifyMfa(FACTOR,'not-a-code'));assert.equal(calls,0);await auth.signOut();await cancelled;
});
test('wrong code keeps login blocked and explicit retry is required',async()=>{
 let calls=0;const auth=createHumanSession({signIn:async()=>value(),refresh:async()=>value(),verifyMfa:async()=>{calls++;if(calls===1)throw new HumanAuthError('mfa_failed');return value('verified.new.token');},signOut:async()=>{}});const login=auth.signIn(fields);await choosing(auth);
 await assert.rejects(auth.verifyMfa(FACTOR,'000000'));assert.equal(auth.state().phase,'verifying_mfa');assert.equal(calls,1);await assert.rejects(auth.authorization());await auth.verifyMfa(FACTOR,'123456');await login;assert.equal(calls,2);
});
test('cancel during verification revokes newest returned session without resurrection and blocks new login',async()=>{
 const wait=deferred<ReturnType<typeof value>>(),tokens:string[]=[];const auth=createHumanSession({signIn:async()=>value(),refresh:async()=>value(),verifyMfa:async()=>wait.promise,signOut:async(token)=>{tokens.push(token);}});
 const login=auth.signIn(fields),cancelled=assert.rejects(login);await choosing(auth);const verifying=auth.verifyMfa(FACTOR,'123456'),stale=assert.rejects(verifying);await Promise.resolve();const out=auth.signOut();await assert.rejects(auth.signIn(fields));wait.resolve(value('verified.new.token'));await cancelled;await stale;assert.equal(await out,'confirmed');assert.deepEqual(tokens,['verified.new.token']);assert.equal(auth.state().phase,'signed_out');
});
test('late MFA refusal from an older bearer is distinguishable from the current credential',async()=>{
 let time=0,sequence=0;const issued=()=>({...value(),mfaFactors:[],accessToken:'aaa.bbb.'+(++sequence),expiresAt:time+120000});
 const auth=createHumanSession({signIn:async()=>issued(),refresh:async()=>issued(),signOut:async()=>{}},{now:()=>time});
 await auth.signIn(fields);const wait=deferred<Response>(),request=createSessionFetch(auth,()=>wait.promise),old=request('/tickets');await Promise.resolve();await Promise.resolve();
 time=70000;await auth.resume();wait.resolve(Response.json({code:'mfa_required'},{status:403}));const response=await old;assert.equal(request.currentResponse(response),false);assert.equal(auth.state().phase,'active');
 const fresh=createSessionFetch(auth,async()=>Response.json({code:'mfa_required'},{status:403}));const current=await fresh('/tickets');assert.equal(fresh.currentResponse(current),true);assert.equal(fresh.currentResponse(Response.json({})),false);
});
