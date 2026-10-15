import test from 'node:test';import assert from 'node:assert/strict';
import {carryHostedVersionReceipt} from '../src/infrastructure/hosted-version-carrier.ts';
const load=()=>import('../web/version-receipt.js');
test('host boundary carries only an existing canonical revision without reading or buffering the response',async()=>{
 let cancelled=false;const stream=new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('partial'));},cancel(){cancelled=true;}});
 const source=new Response(stream,{status:200,headers:{etag:'"2"','idempotency-replayed':'false','cache-control':'no-store','content-type':'application/json'}}),r=carryHostedVersionReceipt(source);
 assert.equal(source.bodyUsed,false);assert.equal(r.status,200);assert.equal(r.headers.get('x-helpdesk-etag'),'"2"');assert.equal(r.headers.get('etag'),'"2"');assert.equal(r.headers.get('idempotency-replayed'),'false');assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(source.headers.has('x-helpdesk-etag'),false);
 assert.equal(carryHostedVersionReceipt(r),r);await r.body!.cancel();assert.equal(cancelled,true);
});
test('host does not invent a revision from an absent or opaque representation tag',()=>{
 for(const tag of [null,'W/"2"','"abc"','2','"01"','"9007199254740992"']){const r=new Response(null,{headers:tag===null?{}:{etag:tag}});assert.equal(carryHostedVersionReceipt(r),r);assert.equal(r.headers.has('x-helpdesk-etag'),false);}
});
test('client retains the strict legacy tag when no dedicated revision receipt exists',async()=>{
 const {readVersionReceiptHeader}=await load();for(const tag of [null,'"0"','"2"','W/"2"','opaque']){const r=new Response(null,{headers:tag===null?{}:{etag:tag}});assert.equal(readVersionReceiptHeader(r),tag);}
});
test('client reads the canonical business revision despite absent, weak or generated representation tag',async()=>{
 const {readVersionReceiptHeader}=await load();for(const tag of [null,'"2"','W/"2"','"representation-hash"']){const r=new Response(null,{headers:{'x-helpdesk-etag':'"2"',...(tag===null?{}:{etag:tag})}});assert.equal(readVersionReceiptHeader(r),'"2"');}
});
test('client refuses malformed receipt or contradictory numeric revisions without displaying their values',async()=>{
 const {readVersionReceiptHeader}=await load();for(const [carrier,tag] of [['*',null],['"01"',null],['"9007199254740992"',null],['"2"','"3"'],['"2"','W/"3"']]){const r=new Response(null,{headers:{'x-helpdesk-etag':carrier!,...(tag===null?{}:{etag:tag!})}});assert.throws(()=>readVersionReceiptHeader(r),(e:any)=>{assert.equal(e.message,'Confirmação da revisão indisponível.');return true;});}
});
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const identity={workspaceId:id(1),principalId:id(2)},profile='cg-wf-'+id(3)+'-v1';
const ticket={id:id(4),account_id:id(5),version:2,status:'in_progress',internal_status:'open',assignment:{state:'mine'},consultegeo:{protocol:'CG-10001',profileVersionId:profile,workflow:true as const,requesterId:id(2)}};
const receipt={ticketId:id(4),workspaceId:id(1),accountId:id(5),actorId:id(2),profileVersionId:profile,version:3,status:'open',eventId:id(6),replayed:false};
const ingress=(r:Response)=>{const h=new Headers(r.headers);h.delete('etag');return new Response(r.body,{status:r.status,headers:h});};
test('public workflow confirms exactly once after ingress removes the representation tag',async()=>{
 const modulePath='../web/consultegeo-workflow.js',m:any=await import(modulePath);let calls=0;
 const c=m.createOperationalWorkflow({identity,ticket,canWrite:true,request:async(_p:string,i:any)=>{calls++;assert.equal(i.headers['if-match'],'"2"');assert.deepEqual(JSON.parse(i.body),{action:'reply',body:'Synthetic public update'});return ingress(carryHostedVersionReceipt(Response.json(receipt,{headers:{etag:'"3"','idempotency-replayed':'false'}})));}});
 c.select('reply');c.setField('body','Synthetic public update');c.review();assert.equal(await c.confirm(),true);assert.equal(calls,1);assert.equal(c.view().hasUnconfirmedWrite,false);assert.equal(c.view().receipt.version,3);
});
test('a carried revision cannot authorize a foreign or mismatched workflow receipt',async()=>{
 const modulePath='../web/consultegeo-workflow.js',m:any=await import(modulePath);
 for(const change of [{workspaceId:id(9)},{actorId:id(9)},{version:4}]){const c=m.createOperationalWorkflow({identity,ticket,canWrite:true,request:async()=>ingress(carryHostedVersionReceipt(Response.json({...receipt,...change},{headers:{etag:'"3"','idempotency-replayed':'false'}})))});c.select('reply');c.setField('body','Synthetic public update');c.review();assert.equal(await c.confirm(),false);assert.equal(c.view().hasUnconfirmedWrite,true);assert.equal(c.view().receipt,null);}
});
test('checklist reads its exact zero revision through the same host boundary without weakening its record checks',async()=>{
 const modulePath='../web/execution-checklist-state.js',m:any=await import(modulePath);
 const audience={...identity,accountId:id(5),ticketId:id(4),canWrite:true},record={context:{workspaceId:id(1),accountId:id(5),ticketId:id(4),ticketVersion:2,profileVersionId:profile,reference:{id:'checklist-1',version:1,sha256:'a'.repeat(64)}},template:{schema:1,id:'checklist-1',version:1,status:'published',items:[{id:'check',label:'Conferir solicitação',required:true,allowNotApplicable:false,evidenceRequired:false,risk:'ordinary'}]},snapshot:null,ticketStatus:'open',assignedTo:id(2),readAt:'2026-10-14T23:26:41.420Z'};
 const c=m.createExecutionChecklistController({audience,request:async()=>ingress(carryHostedVersionReceipt(Response.json(record,{headers:{etag:'"0"'}})))});
 assert.equal(await c.load(),true);assert.equal(c.view().phase,'ready');assert.equal(c.view().requiredTotal,1);assert.equal(c.view().canEdit,true);
 const wrong=m.createExecutionChecklistController({audience,request:async()=>ingress(carryHostedVersionReceipt(Response.json({...record,context:{...record.context,ticketId:id(9)}},{headers:{etag:'"0"'}})))});assert.equal(await wrong.load(),false);assert.equal(wrong.view().record,null);
});
