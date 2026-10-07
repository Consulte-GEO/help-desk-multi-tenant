import test from 'node:test';import assert from 'node:assert/strict';
import {createHumanSession} from '../web/human-session.js';
const workspace='22222222-2222-4222-8222-222222222222',other='33333333-3333-4333-8333-333333333333';
const value={accessToken:'aaa.bbb.ccc',refreshToken:'refresh_fixture',userId:'11111111-1111-4111-8111-111111111111',expiresAt:Date.now()+120000};
function fixture(items=[{id:workspace,name:'Suporte'}]){let discoveries=0,logouts=0;const session=createHumanSession({signIn:async()=>value,workspaces:async()=>{discoveries++;return items;},signOut:async()=>{logouts++;},refresh:async()=>value});return {session,counts:()=>({discoveries,logouts})};}
test('one authorized workspace is selected from authenticated discovery without manual UUID',async()=>{
 const f=fixture();await f.session.signIn({email:'fixture@example.test',password:'private',workspace:''});assert.equal((await f.session.authorization()).workspace,workspace);assert.equal(f.counts().discoveries,1);
});
test('multiple workspaces require explicit choice and arbitrary IDs never become selected',async()=>{
 const f=fixture([{id:workspace,name:'A'},{id:other,name:'B'}]);const pending=f.session.signIn({email:'fixture@example.test',password:'private',workspace:''});
 await new Promise(r=>setImmediate(r));assert.equal(f.session.state().phase,'selecting_workspace');await assert.rejects(f.session.authorization());
 assert.throws(()=>f.session.selectWorkspace('44444444-4444-4444-8444-444444444444'));assert.equal(f.session.state().workspace,null);
 f.session.selectWorkspace(other);await pending;assert.equal((await f.session.authorization()).workspace,other);
});
test('empty catalog closes the newly issued provider session instead of retaining inaccessible login',async()=>{
 const f=fixture([]);await assert.rejects(f.session.signIn({email:'fixture@example.test',password:'private',workspace:''}),{code:'membership_required'});assert.equal(f.session.state().phase,'signed_out');assert.equal(f.counts().logouts,1);
});
test('cancel while choosing a workspace cannot resurrect identity and closes the provider session',async()=>{
 const f=fixture([{id:workspace,name:'A'},{id:other,name:'B'}]);const pending=f.session.signIn({email:'fixture@example.test',password:'private',workspace:''});const rejected=assert.rejects(pending,{code:'stale_session'});
 await new Promise(r=>setImmediate(r));assert.equal(f.session.state().phase,'selecting_workspace');assert.equal(await f.session.signOut(),'confirmed');await rejected;assert.equal(f.session.state().phase,'signed_out');assert.equal(f.counts().logouts,1);
});
test('expiry while choosing does not install a stale session and still closes its provider session',async()=>{
 let now=10000,logouts=0;const session=createHumanSession({signIn:async()=>({...value,expiresAt:now+120000}),
  workspaces:async()=>[{id:workspace,name:'A'},{id:other,name:'B'}],refresh:async()=>value,signOut:async()=>{logouts++;}},{now:()=>now});
 const pending=session.signIn({email:'fixture@example.test',password:'private',workspace:''});const rejected=assert.rejects(pending,{code:'session_rejected'});
 await new Promise(r=>setImmediate(r));now+=120001;session.selectWorkspace(workspace);await rejected;assert.equal(session.state().phase,'signed_out');assert.equal(logouts,1);
});
