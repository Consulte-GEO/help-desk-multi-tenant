import test from 'node:test';
import assert from 'node:assert/strict';
import {createExecutionChecklistController} from '../web/execution-checklist-state.js';
import {markingFixture,id,AT} from './fixtures/checklist/marking.ts';
import {parseChecklistMark} from '../src/domain/execution-checklist-mark.ts';

const KEY='hdn-ui-intent-00000001';
const fixture=()=>{
 const f=markingFixture();
 return {...f,audience:{principalId:f.principal.id,workspaceId:f.context.workspaceId,accountId:f.context.accountId,ticketId:f.context.ticketId,canWrite:true}};
};
const reply=(data:unknown,status=200,etag='"0"')=>Response.json(data,{status,headers:{etag,'cache-control':'no-store'}});
const refusal=(code:string,status:number)=>reply({type:'about:blank',status,code,detail:'PRIVATE_TRANSPORT_DETAIL',request_id:id(99)},status);
const deferred=<T,>()=>{let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};};
function harness(overrides:Record<string,unknown>={}){
 const f=fixture(),calls:{path:string;init:RequestInit}[]=[];
 let request=async(_p:string,_i:RequestInit):Promise<Response>=>reply(f.record);
 const c=createExecutionChecklistController({audience:f.audience,request:async(path:string,init:RequestInit)=>{calls.push({path,init});return request(path,init);},key:()=>KEY,...overrides});
 return {f,c,calls,setRequest(fn:typeof request){request=fn;}};
}
async function review(h:ReturnType<typeof harness>,item='grupo'){
 await h.c.load();assert.equal(h.c.editItem(item),true);
 h.c.setField('evidenceText','note:'+id(90));h.c.setField('reason','Conferência sintética');
 if(item==='risco')h.c.setField('acknowledgeRisk',true);
 assert.equal(h.c.review(),true);
}
function receipt(h:ReturnType<typeof harness>,item='grupo',status='done'){
 return {ticketId:h.f.context.ticketId,workspaceId:h.f.context.workspaceId,accountId:h.f.context.accountId,actorId:h.f.principal.id,itemId:item,status,ticketVersion:4,checklistRevision:1,auditId:id(88),at:AT,replayed:false};
}

test('HDN UI does not fetch or mutate when allocated; explicit load reads the internal path',async()=>{
 const h=harness();assert.equal(h.calls.length,0);await h.c.load();assert.equal(h.c.view().phase,'ready');
 assert.equal(h.calls.length,1);assert.equal(h.calls[0]!.path,'/v1/internal/tickets/'+h.f.context.ticketId+'/execution-checklist');
 assert.equal(h.calls[0]!.init.method,'GET');assert.equal(h.c.view().requiredTotal,3);assert.equal(h.c.view().requiredCompleted,0);
 assert.equal('canResolve' in h.c.view(),false);
});
for(const field of ['workspaceId','accountId','ticketId'])test('HDN UI refuses record from a different '+field,async()=>{
 const h=harness();(h.f.record.context as any)[field]=id(77);await h.c.load();assert.equal(h.c.view().phase,'error');assert.equal(h.c.view().record,null);
});
for(const change of [
 (r:any)=>{r.internalNoteBody='must never be rendered';},
 (r:any)=>{r.template.status='draft';},
 (r:any)=>{r.template.version=2;},
 (r:any)=>{r.template.items.push({...r.template.items[0]});},
 (r:any)=>{r.template.items[0].required='yes';},
 (r:any)=>{r.readAt='2026-02-30T12:00:00.000Z';},
])test('HDN UI fails closed on malformed projection '+change.toString().slice(0,65),async()=>{
 const h=harness();change(h.f.record);await h.c.load();assert.equal(h.c.view().phase,'error');assert.equal(h.c.view().record,null);
});
for(const etag of ['W/"0"','"1"','0',''])test('HDN UI refuses mismatched or weak ETag '+etag,async()=>{
 const h=harness();h.setRequest(async()=>reply(h.f.record,200,etag));await h.c.load();assert.equal(h.c.view().record,null);
});
test('HDN UI another assignee or absent write hint permits read only, never enables marking',async()=>{
 for(const other of [true,false]){const h=harness(other?{}:{audience:{...fixture().audience,canWrite:false}});if(other)h.f.record.assignedTo=id(50);await h.c.load();assert.equal(h.c.view().phase,'ready');assert.equal(h.c.editItem('grupo'),false);assert.equal(h.calls.length,1);}
});
for(const status of ['new','waiting_customer','resolved','closed','cancelled'])test('HDN UI does not offer marking in '+status,async()=>{
 const h=harness();h.f.record.ticketStatus=status;await h.c.load();assert.equal(h.c.editItem('grupo'),false);
});
test('HDN UI editing, review, back and cancellation have no side effect',async()=>{
 const h=harness();await review(h);assert.equal(h.calls.length,1);assert.equal(h.c.view().phase,'review');
 assert.equal(h.c.back(),true);assert.equal(h.c.view().phase,'editing');assert.equal(h.c.cancel(),true);assert.equal(h.c.view().draft,null);assert.equal(h.calls.length,1);
});
test('HDN UI blocks required evidence and sensitive acknowledgement before dispatch',async()=>{
 const h=harness();await h.c.load();h.c.editItem('risco');assert.equal(h.c.review(),false);
 h.c.setField('evidenceText',id(90));assert.equal(h.c.review(),false);h.c.setField('acknowledgeRisk',true);assert.equal(h.c.review(),true);assert.equal(h.calls.length,1);
});
test('HDN UI not-applicable requires allowed item and reason, reset requires a reason',async()=>{
 const h=harness();await h.c.load();h.c.editItem('email');h.c.setField('status','not_applicable');assert.equal(h.c.review(),false);
 h.c.setField('reason','Sem envio neste pedido');assert.equal(h.c.review(),true);h.c.cancel();h.c.editItem('risco');h.c.setField('status','not_applicable');h.c.setField('reason','Não pode');assert.equal(h.c.review(),false);
 h.c.setField('status','pending');h.c.setField('reason','');assert.equal(h.c.review(),false);h.c.setField('reason','Refazer conferência');assert.equal(h.c.review(),true);
});
for(const text of [id(90)+'\n'+id(90),'https://example.test/note','note:'+id(91)+'\ninvalid'])test('HDN UI rejects duplicated or non-note evidence input '+text,async()=>{
 const h=harness();await h.c.load();h.c.editItem('grupo');h.c.setField('evidenceText',text);assert.equal(h.c.review(),false);assert.equal(h.calls.length,1);
});
test('HDN UI explicit confirmation submits exact server command and verifies receipt, then requires reload',async()=>{
 const h=harness();await review(h);h.setRequest(async()=>reply(receipt(h),200,'"1"'));await h.c.confirm();
 assert.equal(h.c.view().phase,'refresh_required');assert.equal(h.c.view().record,null);assert.equal(h.c.view().draft,null);assert.equal(h.c.editItem('email'),false);
 const sent=h.calls[1]!,body=JSON.parse(sent.init.body as string);assert.deepEqual(parseChecklistMark(body),{action:'mark',itemId:'grupo',status:'done',expectedTicketVersion:4,expectedChecklistRevision:0,evidenceRefs:['note:'+id(90)],reason:'Conferência sintética',acknowledgeRisk:false});
 assert.equal(new Headers(sent.init.headers).get('if-match'),'"0"');assert.equal(new Headers(sent.init.headers).get('idempotency-key'),KEY);
 assert.equal('actorId' in body,false);assert.equal('at' in body,false);assert.equal(sent.path.endsWith('/marks'),true);assert.equal(h.calls.length,2);
});
test('HDN UI two confirmation clicks issue only one POST',async()=>{
 const h=harness();await review(h);const d=deferred<Response>();h.setRequest(()=>d.promise);const a=h.c.confirm();const b=h.c.confirm();await Promise.resolve();assert.equal(h.calls.filter(c=>c.init.method==='POST').length,1);d.resolve(reply(receipt(h),200,'"1"'));await Promise.all([a,b]);assert.equal(h.c.view().phase,'refresh_required');
});
for(const code of ['resource_scope_denied','resource_scope_database_mismatch']){
 test('HDN UI definitive '+code+' refusal permits reload without an unknown intention',async()=>{
  const h=harness();await review(h);h.setRequest(async()=>refusal(code,403));
  assert.equal(await h.c.confirm(),false);assert.equal(h.c.view().phase,'refresh_required');
  assert.equal(h.c.view().hasUnconfirmedWrite,false);assert.equal(h.c.view().record,null);
  assert.equal(h.c.view().draft,null);assert.doesNotMatch(JSON.stringify(h.c.view()),/PRIVATE_TRANSPORT_DETAIL/);
  assert.equal(h.calls.filter(c=>c.init.method==='POST').length,1);
  h.setRequest(async()=>reply(h.f.record));assert.equal(await h.c.load(),true);
  assert.equal(h.c.view().phase,'ready');assert.equal(h.calls.filter(c=>c.init.method==='POST').length,1);
 });
 test('HDN UI '+code+' during reconciliation does not erase the earlier unknown result',async()=>{
  const h=harness();await review(h);h.setRequest(async()=>{throw Error('lost confirmation');});
  await h.c.confirm();const sent=h.calls[1]!;h.setRequest(async()=>refusal(code,403));
  assert.equal(await h.c.reconcile(),false);assert.equal(h.c.view().phase,'unknown');
  assert.equal(h.c.view().hasUnconfirmedWrite,true);assert.equal(await h.c.load(),false);
  assert.equal(h.calls[2]!.init.body,sent.init.body);
  assert.equal(new Headers(h.calls[2]!.init.headers).get('idempotency-key'),KEY);
 });
}
test('HDN UI lost confirmation keeps the same payload/key and blocks all new intentions',async()=>{
 const h=harness();await review(h);h.setRequest(async()=>{throw Error('PRIVATE_TRANSPORT_DETAIL');});await h.c.confirm();assert.equal(h.c.view().phase,'unknown');assert.equal(h.c.view().draft,null);
 assert.equal(h.c.editItem('email'),false);assert.equal(h.c.cancel(),false);assert.equal(await h.c.load(),false);assert.equal(await h.c.confirm(),false);assert.equal(h.calls.length,2);
 const first=h.calls[1]!;h.setRequest(async()=>reply({...receipt(h),replayed:true},200,'"1"'));await h.c.reconcile();const second=h.calls[2]!;
 assert.equal(second.path,first.path);assert.equal(second.init.body,first.init.body);assert.deepEqual(second.init.headers,first.init.headers);assert.equal(h.c.view().phase,'refresh_required');
 assert.equal(JSON.stringify(h.c.view()).includes(KEY),false);
});
for(const [code,status] of [['checklist_version_conflict',412],['checklist_forbidden',403],['unauthorized',401]] as const)test('HDN UI negative replay cannot prove original rollback: '+code,async()=>{
 const h=harness();await review(h);h.setRequest(async()=>{throw Error();});await h.c.confirm();h.setRequest(async()=>refusal(code,status));await h.c.reconcile();
 assert.equal(h.c.view().phase,'unknown');assert.equal(h.c.view().record,null);assert.equal(h.c.editItem('grupo'),false);assert.equal(JSON.stringify(h.c.view()).includes('PRIVATE_TRANSPORT_DETAIL'),false);
});
test('HDN UI an initial precise revision conflict requires fresh review, without automatic retry',async()=>{
 const h=harness();await review(h);h.setRequest(async()=>refusal('checklist_version_conflict',412));await h.c.confirm();assert.equal(h.c.view().phase,'refresh_required');assert.equal(h.c.view().receipt,null);assert.equal(await h.c.reconcile(),false);assert.equal(h.calls.length,2);
});
for(const change of [(r:any)=>{r.actorId=id(51);},(r:any)=>{r.itemId='email';},(r:any)=>{r.checklistRevision=2;},(r:any)=>{r.privateNote='secret';},(r:any)=>{r.at='2026-10-12T11:59:59.999999Z';}])test('HDN UI malformed success remains unknown '+change.toString(),async()=>{
 const h=harness();await review(h);const r=receipt(h);change(r);h.setRequest(async()=>reply(r,200,'"1"'));await h.c.confirm();assert.equal(h.c.view().phase,'unknown');assert.equal(h.c.view().receipt,null);
});
test('HDN UI failed refresh clears old private data and does not display error details',async()=>{
 const h=harness();await h.c.load();h.setRequest(async()=>refusal('checklist_forbidden',403));await h.c.load();assert.equal(h.c.view().record,null);assert.equal(h.c.view().requiredTotal,null);assert.equal(JSON.stringify(h.c.view()).includes('PRIVATE_TRANSPORT_DETAIL'),false);
});
test('HDN UI A to B to A discards a late response from the first A',async()=>{
 const h=harness(),d=deferred<Response>();h.setRequest(()=>d.promise);const p=h.c.load();await Promise.resolve();
 h.c.changeAudience({...h.f.audience,accountId:id(80)});h.c.changeAudience(h.f.audience);d.resolve(reply(h.f.record));await p;assert.equal(h.c.view().phase,'idle');assert.equal(h.c.view().record,null);
});
test('HDN UI audience cleanup during write removes all private state and ignores late receipt',async()=>{
 const h=harness();await review(h);const d=deferred<Response>();h.setRequest(()=>d.promise);const p=h.c.confirm();await Promise.resolve();h.c.clear();d.resolve(reply(receipt(h),200,'"1"'));await p;
 assert.equal(h.c.view().phase,'empty');assert.equal(h.c.view().record,null);assert.equal(h.c.view().receipt,null);assert.equal(h.c.view().draft,null);assert.equal(await h.c.reconcile(),false);
});
test('HDN UI render callback that clears before dispatch prevents a write',async()=>{
 const h=harness({onState:(s:any)=>{if(s.phase==='saving')h.c.clear();}});await review(h);await h.c.confirm();assert.equal(h.calls.length,1);assert.equal(h.c.view().phase,'empty');
});
test('HDN UI request deadline aborts a hanging read without accepting later completion',async()=>{
 const h=harness({timeoutMs:30}),d=deferred<Response>();h.setRequest(()=>d.promise);await h.c.load();assert.equal(h.c.view().phase,'error');assert.equal(h.calls[0]!.init.signal?.aborted,true);d.resolve(reply(h.f.record));await Promise.resolve();assert.equal(h.c.view().record,null);
});
test('HDN UI oversized response is rejected and body reader is cancelled',async()=>{
 const h=harness();let cancelled=false;
 h.setRequest(async()=>new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode(' '.repeat(262145)));},cancel(){cancelled=true;}}),{headers:{'content-type':'application/json',etag:'"0"'}}));
 await h.c.load();assert.equal(h.c.view().record,null);assert.equal(cancelled,true);
});
test('HDN UI destroy is terminal and observers cannot reactivate the controller',async()=>{
 const h=harness();await h.c.load();h.c.editItem('grupo');h.c.setField('reason','PRIVATE_DRAFT');h.c.destroy();assert.equal(h.c.view().phase,'disposed');assert.equal(h.c.changeAudience(h.f.audience),false);assert.equal(await h.c.load(),false);assert.equal(JSON.stringify(h.c.view()).includes('PRIVATE_DRAFT'),false);
});
test('HDN UI cancels a response with an unsupported MIME instead of retaining its stream',async()=>{
 const h=harness();let cancelled=false;h.setRequest(async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'text/html'}}));
 await h.c.load();assert.equal(h.c.view().phase,'error');assert.equal(cancelled,true);
});
test('HDN UI cancels a late unconsumed response after the request deadline',async()=>{
 const h=harness({timeoutMs:20}),d=deferred<Response>();let cancelled=false;h.setRequest(()=>d.promise);await h.c.load();
 d.resolve(new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}}));
 await new Promise<void>(r=>setImmediate(r));assert.equal(cancelled,true);assert.equal(h.c.view().record,null);
});
test('HDN UI evidence is mandatory independently of risk acknowledgement',async()=>{
 const h=harness();await h.c.load();h.c.editItem('grupo');assert.equal(h.c.review(),false);h.c.cancel();h.c.editItem('risco');h.c.setField('acknowledgeRisk',true);assert.equal(h.c.review(),false);assert.equal(h.calls.length,1);
});
