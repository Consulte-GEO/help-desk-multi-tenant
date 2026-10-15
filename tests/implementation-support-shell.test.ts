import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {testDom} from './helpers/dom-port.ts';
import {createSessionFetch} from '../web/session-fetch.js';
const staff={id:'person',kind:'human',workspace_role:'agent',grants:[{account_id:'account',role:'agent'}],scopes:['tickets:read']};
const session={id:'person',workspaceId:'workspace'};
async function module(){const path='../web/implementation-support.js';const api=await import(path).catch((e:any)=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});assert.equal(typeof api.mountImplementationSupport,'function','Implementation support shell must exist');return api;}

test('native application boot uses the actual session transport with exactly one API prefix',async()=>{
 const m=await module(),root=testDom(),calls:string[]=[],proof={accessToken:'synthetic-staff',workspace:'workspace'};
 const transport=createSessionFetch({authorization:async()=>proof,current:()=>true,canDispatch:()=>true,sameCredential:()=>true,reject(){throw Error('Unexpected authentication refusal');}} as any,async(path:RequestInfo|URL,init?:RequestInit)=>{
  calls.push(String(path));assert.equal(new Headers(init?.headers).get('authorization'),'Bearer synthetic-staff');assert.equal(new Headers(init?.headers).get('x-workspace-id'),'workspace');
  return path==='/v1/implementation-support/session'?Response.json({enabled:true}):Response.json({code:'not_found'},{status:404});
 });
 const controller=m.mountImplementationSupport(root,{principal:staff,session,request:transport,loadApplication:async()=>({mountImplementationSupportApplication:async({root,request}:any)=>{const response=await request('/v1/implementation-support/session');if(!response.ok)throw Error('Boot failed');root.textContent='Cadastro disponível';return {destroy(){}};}})});
 assert.equal(await controller.ready,true);assert.deepEqual(calls,['/v1/implementation-support/session']);assert.match(root.textContent,/Cadastro disponível/);controller.destroy();
});

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

test('integrated sidebar suspends email polling and destroys implementation before changing views',()=>{
 const source=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
 const body=source.match(/function navigateView\(view\)\{[\s\S]*?\n\}\n/)?.[0];assert.ok(body);
 const nodes=new Map<string,any>(),buttons=['tickets','guide','email','implementation-support'].map(view=>({dataset:{view},classList:{toggle(){}}}));
 const $=(id:string)=>{if(!nodes.has(id))nodes.set(id,{hidden:true,textContent:''});return nodes.get(id);};
 const visible:boolean[]=[];let mounts=0,destroys=0;
 const create=new Function('s','$','document','emailMonitor','isImplementationSupportStaff','mountImplementationSupport','operationalRequest',`let activeView='tickets',implementationSupport=null;${body};return navigateView;`);
 const state:any={me:staff,demo:null,epoch:1,workspace:'workspace'};
 const navigate=create(state,$,{querySelectorAll:()=>buttons},{setVisible:(value:boolean)=>visible.push(value)},(p:any)=>p===staff,()=>{mounts++;return {destroy(){destroys++;}};},()=>async()=>Response.json({}));
 navigate('implementation-support');assert.equal(mounts,1);assert.equal($('implementation-support-view').hidden,false);assert.equal($('email-view').hidden,true);
 navigate('email');assert.equal(destroys,1);assert.equal($('implementation-support-view').hidden,true);assert.equal($('email-view').hidden,false);assert.equal(visible.at(-1),true);
 navigate('tickets');assert.equal($('email-view').hidden,true);assert.equal($('tickets-view').hidden,false);assert.equal(visible.at(-1),false);
 state.me={kind:'human',grants:[]};navigate('implementation-support');assert.equal(mounts,1);assert.equal($('tickets-view').hidden,false);
});
