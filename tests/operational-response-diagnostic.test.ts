import test from 'node:test';import assert from 'node:assert/strict';
import {testDom,elements} from './helpers/dom-port.ts';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const identity={workspaceId:id(1),principalId:id(2)},profile='cg-wf-'+id(3)+'-v1';
const ticket={id:id(4),account_id:id(5),version:1,status:'received',internal_status:'new',consultegeo:{protocol:'CG-10001',profileVersionId:profile,workflow:true as const,requesterId:id(2)}};
const receipt={ticketId:id(4),workspaceId:id(1),accountId:id(5),actorId:id(2),profileVersionId:profile,version:2,status:'open',eventId:id(6),replayed:false};
test('operational response diagnostics classify metadata without exposing raw values or changing refusal',async()=>{
 const path='../web/consultegeo-operation.js',m:any=await import(path),categories:string[]=[];
 await assert.rejects(m.readOperationalResponse(async()=>new Response('private-value',{headers:{'content-type':'text/html'}}),'/tickets',{},undefined,(c:string)=>categories.push(c)));
 assert.deepEqual(categories,['response_content_type']);assert.ok(!JSON.stringify(categories).includes('private-value'));
});
test('receipt diagnostics preserve unknown intent and exact reconciliation when confirmation header is absent',async()=>{
 const path='../web/consultegeo-workflow.js',m:any=await import(path),calls:any[]=[],categories:string[]=[];
 const c=m.createOperationalWorkflow({identity,ticket,canWrite:true,key:()=>id(7),onResponseDiagnostic:(x:string)=>categories.push(x),request:async(p:string,i:any)=>{calls.push({p,i});return Response.json({...receipt,replayed:calls.length>1},{headers:{'idempotency-replayed':String(calls.length>1)}});}});
 c.select('start');c.review();assert.equal(await c.confirm(),false);assert.equal(c.view().hasUnconfirmedWrite,true);assert.deepEqual(categories,['workflow_etag']);
 assert.equal(await c.reconcile(),false);assert.equal(calls.length,2);assert.equal(calls[0].i.body,calls[1].i.body);assert.equal(calls[0].i.headers['idempotency-key'],calls[1].i.headers['idempotency-key']);assert.equal(calls[0].i.headers['if-match'],calls[1].i.headers['if-match']);
});
test('diagnostic observer failures cannot turn valid confirmation into unknown or expose an arbitrary category',async()=>{
 const path='../web/response-diagnostic.js',d:any=await import(path),seen:string[]=[];
 d.observeResponseDiagnostic((c:string)=>seen.push(c),'private-value');assert.deepEqual(seen,[]);
 d.observeResponseDiagnostic(()=>{throw Error('private-value');},'workflow_etag');
 d.observeResponseDiagnostic(()=>Promise.reject(Error('private-value')),'workflow_etag');await new Promise(r=>setImmediate(r));
 const workflow='../web/consultegeo-workflow.js',m:any=await import(workflow),c=m.createOperationalWorkflow({identity,ticket,canWrite:true,onResponseDiagnostic:()=>{throw Error();},request:async()=>Response.json(receipt,{headers:{etag:'"2"','idempotency-replayed':'false'}})});
 c.select('start');c.review();assert.equal(await c.confirm(),true);assert.equal(c.view().hasUnconfirmedWrite,false);
});
test('checklist read diagnostics keep an incompatible revision unavailable and never dispatch a mark',async()=>{
 const path='../web/execution-checklist-state.js',m:any=await import(path),categories:string[]=[],calls:string[]=[];
 const audience={...identity,accountId:id(5),ticketId:id(4),canWrite:true};
 const record={context:{workspaceId:id(1),accountId:id(5),ticketId:id(4),ticketVersion:2,profileVersionId:profile,reference:{id:'checklist-1',version:1,sha256:'a'.repeat(64)}},template:{schema:1,id:'checklist-1',version:1,status:'published',items:[{id:'check',label:'Conferir solicitação',required:true,allowNotApplicable:false,evidenceRequired:false,risk:'ordinary'}]},snapshot:null,ticketStatus:'open',assignedTo:id(2),readAt:'2026-10-14T23:26:41.420Z'};
 const c=m.createExecutionChecklistController({audience,onResponseDiagnostic:(x:string)=>categories.push(x),request:async(p:string)=>{calls.push(p);return Response.json(record);}});
 assert.equal(await c.load(),false);assert.deepEqual(categories,['checklist_etag']);assert.equal(c.view().phase,'error');assert.equal(c.editItem('check'),false);assert.equal(await c.confirm(),false);assert.equal(calls.length,1);c.clear();assert.equal(c.view().record,null);
});
test('mounted private diagnostic contains only a category and is removed on cleanup',async()=>{
 const path='../web/consultegeo-workflow.js',m:any=await import(path),root=testDom();
 const p=m.mountOperationalWorkflow(root,{identity,ticket,canWriteWorkflow:true,canWriteChecklist:false,request:async(path:string)=>path.includes('workflow-commands')?Response.json(receipt,{headers:{'idempotency-replayed':'false'}}):new Response('private-body',{headers:{'content-type':'text/html'}})});
 p.controller.select('start');p.controller.review();assert.equal(await p.controller.confirm(),false);
 const status=elements(root).find((e:any)=>e.attributes?.['data-response-diagnostic']==='workflow_etag');assert.ok(status);assert.equal(root.textContent.includes('private-body'),false);p.clear();assert.equal(root.children.length,0);
});
