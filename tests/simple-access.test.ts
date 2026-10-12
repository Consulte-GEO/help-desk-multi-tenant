import test from 'node:test';
import assert from 'node:assert/strict';
import {createHumanSession} from '../web/human-session.js';
const user='22222222-2222-4222-8222-222222222222',workspace='11111111-1111-4111-8111-111111111111';
const fields={email:'synthetic@example.test',password:' senha preservada ',workspace:''};
const issued=()=>({accessToken:'aaa.bbb.ccc',refreshToken:'synthetic_refresh',userId:user,expiresAt:Date.now()+120000,mfaFactors:[] as {id:string;type:'totp'}[]});
function fixture(options:{factors?:ReturnType<typeof issued>['mfaFactors'];workspaces?:{id:string;name:string}[]}={}){
 const calls:{kind:string;args:unknown[]}[]=[];
 const transport={signIn:async(...args:string[])=>{calls.push({kind:'password',args});return {...issued(),mfaFactors:options.factors??[]};},refresh:async()=>issued(),signOut:async(...args:unknown[])=>{calls.push({kind:'logout',args});},workspaces:async(...args:unknown[])=>{calls.push({kind:'workspaces',args});return options.workspaces??[{id:workspace,name:'Operação autorizada'}];},verifyMfa:async()=>issued()};
 let session:ReturnType<typeof createHumanSession>;
 session=createHumanSession(transport,{passwordOnly:true,onChange:(s:any)=>{
  // Prevent an old interactive implementation hanging the RED reproduction.
  if(['selecting_workspace','verifying_mfa'].includes(s.phase))void session.signOut();
 }} as any);
 return {session,calls};
}
test('simple access logs in using only email/password and discovers the sole authorized operation',async()=>{
 const {session,calls}=fixture();await session.signIn(fields);
 assert.deepEqual(calls.map(c=>c.kind),['password','workspaces']);assert.deepEqual(calls[0]!.args,[fields.email,fields.password]);
 assert.equal(session.state().phase,'active');assert.equal(session.state().workspace,workspace);
 assert.doesNotMatch(JSON.stringify(session.state()),/aaa|synthetic_refresh/);
});
test('simple access rejects a manual workspace override before sending the password',async()=>{
 const {session,calls}=fixture();await assert.rejects(session.signIn({...fields,workspace}),{code:'invalid_login'});assert.equal(calls.length,0);
});
test('simple access rejects ambiguous operations instead of waiting for hidden controls',async()=>{
 const {session,calls}=fixture({workspaces:[{id:workspace,name:'A'},{id:user,name:'B'}]});
 await assert.rejects(session.signIn(fields),{code:'simple_workspace_required'});
 assert.equal(session.state().phase,'signed_out');assert.equal(calls.filter(c=>c.kind==='logout').length,1);
 await assert.rejects(session.authorization());
});
test('simple access never skips an enrolled MFA requirement or waits for a hidden code field',async()=>{
 const {session,calls}=fixture({factors:[{id:user,type:'totp'}]});
 await assert.rejects(session.signIn(fields),{code:'simple_mfa_required'});
 assert.equal(session.state().phase,'signed_out');assert.equal(calls.filter(c=>c.kind==='workspaces').length,0);
 assert.equal(calls.filter(c=>c.kind==='logout').length,1);await assert.rejects(session.authorization());
});
test('simple access with no authorized operation cleans up the provider session',async()=>{
 const {session,calls}=fixture({workspaces:[]});await assert.rejects(session.signIn(fields),{code:'membership_required'});
 assert.equal(session.state().phase,'signed_out');assert.equal(calls.filter(c=>c.kind==='logout').length,1);
});
