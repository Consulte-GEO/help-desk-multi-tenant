import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {testDom} from './helpers/dom-port.ts';
const staff={id:'person',kind:'human',workspace_role:'agent',grants:[{account_id:'account',role:'agent'}],scopes:['tickets:read']};
const session={id:'person',workspaceId:'workspace'};
async function module(){const path='../web/implementation-support.js';const api=await import(path).catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});assert.equal(typeof api.mountImplementationSupport,'function','Implementation support shell must exist');return api;}

test('nonstaff and integration principals never load the implementation application',async()=>{
 const m=await module();for(const principal of [null,{}, {...staff,grants:[]},{...staff,kind:'integration'},{...staff,workspace_role:'admin',kind:'integration'},{...staff,grants:[{role:'account_manager'}]}]){
  const root=testDom();let loads=0;const c=m.mountImplementationSupport(root,{principal,session,request:async()=>{throw Error('No request');},loadApplication:async()=>{loads++;throw Error('No import');}});await c.ready;assert.equal(loads,0);assert.equal(await c.retry(),false);c.destroy();assert.equal(root.textContent,'');
 }
 assert.equal(m.isImplementationSupportStaff({...staff,workspace_role:'admin',grants:[]}),true);
 assert.equal(m.isImplementationSupportStaff(staff),true);
});

test('logout during application import prevents mounting and removes the loading state',async()=>{
 const m=await module(),root=testDom();let resolve:any,mounts=0;const c=m.mountImplementationSupport(root,{principal:staff,session,request:async()=>Response.json({}),loadApplication:()=>new Promise(r=>resolve=r)});
 c.destroy();resolve({mountImplementationSupportApplication:async()=>{mounts++;return {destroy(){}};}});await c.ready;assert.equal(mounts,0);assert.equal(root.textContent,'');
});

test('late async application mount is detached, aborted and destroyed after logout',async()=>{
 const m=await module(),root=testDom();let finish:any,received:any,destroyed=0;const c=m.mountImplementationSupport(root,{principal:staff,session:{...session,token:'must-not-pass'},request:async()=>Response.json({}),loadApplication:async()=>({mountImplementationSupportApplication:async(o:any)=>{received=o;return new Promise(r=>finish=r);}})});
 await Promise.resolve();await Promise.resolve();assert.deepEqual(received.session,session);c.destroy();assert.equal(received.signal.aborted,true);received.root.textContent='late private result';finish({destroy(){destroyed++;}});await c.ready;assert.equal(destroyed,1);assert.equal(root.textContent,'');
});

test('failed application load requires explicit retry and a live current principal',async()=>{
 const m=await module(),root=testDom();let loads=0,current:any=staff,destroyed=0;const c=m.mountImplementationSupport(root,{principal:staff,getPrincipal:()=>current,session,request:async()=>Response.json({}),loadApplication:async()=>{loads++;if(loads===1)throw Error('sensitive diagnostic');return {mountImplementationSupportApplication:async({root}:any)=>{root.textContent='Original workflow';return {destroy(){destroyed++;}};}};}});
 await c.ready;assert.equal(loads,1);assert.doesNotMatch(root.textContent,/sensitive/);assert.match(root.textContent,/Tentar novamente/);assert.equal(await c.retry(),true);assert.equal(loads,2);assert.match(root.textContent,/Original workflow/);current={...staff,grants:[]};assert.equal(await c.retry(),false);assert.equal(destroyed,1);assert.equal(loads,2);assert.doesNotMatch(root.textContent,/Original workflow/);c.destroy();
});

test('an application retaining request after navigation cannot dispatch or accept a late response',async()=>{
 const m=await module(),root=testDom();let request:any,finish:any,calls=0;const c=m.mountImplementationSupport(root,{principal:staff,session,request:()=>{calls++;return new Promise(r=>finish=r);},loadApplication:async()=>({mountImplementationSupportApplication:async(o:any)=>{request=o.request;return {destroy(){}};}})});
 await c.ready;const pending=request('/private');c.destroy();finish(Response.json({private:'data'}));await assert.rejects(pending,/stale_session/);await assert.rejects(request('/private'),/stale_session/);assert.equal(calls,1);
});

test('a failing child cleanup cannot interrupt the Help Desk logout cleanup',async()=>{
 const m=await module(),root=testDom();const c=m.mountImplementationSupport(root,{principal:staff,session,request:async()=>Response.json({}),loadApplication:async()=>({mountImplementationSupportApplication:async({root}:any)=>{root.textContent='private';return {destroy(){throw Error('cleanup failed');}};}})});
 await c.ready;assert.doesNotThrow(()=>c.destroy());assert.equal(root.textContent,'');
});

test('shell ships a hidden staff menu, native mount root and generalized view handling',()=>{
 const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');const html=source('web/index.html'),app=source('web/app.js');
 assert.match(html,/<button[^>]+id="implementation-support-nav"[^>]+hidden[^>]*>/);assert.match(html,/Apoio Implantação/);assert.match(html,/id="implementation-support-view" hidden/);assert.match(html,/id="implementation-support-root"/);assert.match(app,/implementationSupport\?\.destroy\(\)/);assert.match(app,/function navigateView\(/);assert.doesNotMatch(html,/<iframe/i);
});
