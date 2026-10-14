import test from 'node:test';import assert from 'node:assert/strict';
const panelModule='../web/admin-configuration.js',callbackModule='../web/geo-auth-callback.js';
const {mountConfigurationPanel}=await import(panelModule);
const {mountGeoAuthCallback}=await import(callbackModule);
import {TestElement as E,testDom} from './helpers/dom-port.ts';
/** Structural wiring only; browser evidence is separate. */
const all=(e:E):E[]=>[e,...e.children.flatMap(all)];const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
function dom(){const root=testDom();return {doc:root.ownerDocument,root};}
async function panel(){const {root}=dom();const m=mountConfigurationPanel(root,{audience:{principalId:id(2),workspaceId:id(1)},request:async()=>Response.json({workspace_id:id(1),revision:1,total:1,items:[{kind:'account',workspaceId:id(1),id:id(9),revision:1,data:{name:'<img src=x onerror=private>',active:true}}],next_cursor:null})});await m.controller.load('account');return {root,...m};}
test('C05 DOM only treats server labels as text, never HTML',async()=>{const {root}=await panel();assert.match(root.textContent,/<img src=x onerror=private>/);assert.equal(all(root).filter(x=>x.tagName==='img').length,0);});
test('C05 DOM clears detached form values on an audience change',async()=>{const p=await panel();p.controller.open('update',id(9));const reason=all(p.root).find(x=>x.tagName==='textarea')!;reason.value='Private business reason';reason.dispatch('input');p.controller.setAudience({principalId:id(3),workspaceId:id(4)});assert.equal(reason.value,'');assert.ok(!p.root.textContent.includes('Private business reason'));});
test('C05 DOM destroys content and form values instead of leaving detached drafts',async()=>{const p=await panel();p.controller.open('update',id(9));const input=all(p.root).find(x=>x.tagName==='input')!;input.value='PRIVATE_DRAFT';p.destroy();assert.equal(input.value,'');assert.equal(p.root.children.length,0);});
test('C06 callback DOM cleans URL but never posts until explicit confirmation',async()=>{
 const {doc,root}=dom(),nodes:any={};for(const id of ['confirm-geo-login','cancel-geo-login','geo-login-status'])nodes[id]=new E(id==='geo-login-status'?'p':'button',doc);root.append(...Object.values(nodes) as E[]);doc.getElementById=(id:string)=>nodes[id];let requests=0,mounts=0;const history:string[]=[];
 const view=mountGeoAuthCallback({document:doc,location:new URL('https://helpdesk.example.test/auth/geo/callback?code=PRIVATE&state='+'a'.repeat(43)+'&iss=https%3A%2F%2Fidentity.example.invalid'),history:{replaceState:(_:any,__:any,path:string)=>history.push(path)},request:async()=>{requests++;return Response.json({principal_id:id(2),workspace_id:id(1),access_token:'hd_person_'+'a'.repeat(43),refresh_token:'hd_person_refresh_'+'b'.repeat(43),expires_at:'2026-10-09T12:01:00.000Z',absolute_expires_at:'2026-10-09T12:30:00.000Z',return_path:'/tickets'});},mountAuthenticatedPortal:()=>{mounts++;}});
 assert.deepEqual(history,['/auth/geo/callback']);assert.equal(requests,0);await nodes['confirm-geo-login'].onclick();assert.equal(requests,1);assert.equal(mounts,1);assert.equal(history.at(-1),'/tickets');assert.ok(!nodes['geo-login-status'].textContent.includes('PRIVATE'));view.destroy();
});
