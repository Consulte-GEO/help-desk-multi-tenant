import test from 'node:test';
import assert from 'node:assert/strict';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import type {Store,UnitOfWork} from '../src/application/ports.ts';
import {principal,ticket,coverage} from './fixtures.ts';
const actor=principal({grants:[{accountId:'account-a',role:'agent'}]});
const input={accountId:'account-a',productInstanceId:'geolab-production',serviceCode:'SUPPORT',subject:'Atomic effects',description:'Synthetic only',priority:'normal' as const};
const setup=(alter:(s:Store)=>Store=(s=>s))=>{const db=new MemoryUnitOfWork({tickets:[ticket()],coverages:[coverage()]});const uow:UnitOfWork={run:(p,f)=>db.run(p,s=>f(alter(s)))};return{db,service:new HelpdeskService(uow)};};
const commands={
 create:(s:HelpdeskService)=>s.create(actor,input,'effect-create-0001','r'),
 message:(s:HelpdeskService)=>s.addMessage(actor,'ticket-a','Synthetic reply','effect-message-001','r'),
 note:(s:HelpdeskService)=>s.addNote(actor,'ticket-a','Private reason','effect-note-00001','r'),
 transition:(s:HelpdeskService)=>s.transition(actor,'ticket-a','open',1,'','effect-status-001','r'),
 priority:(s:HelpdeskService)=>s.changePriority(actor,'ticket-a','high',1,'Need attention','effect-priority-01','r'),
 assignment:(s:HelpdeskService)=>s.changeAssignment(actor,'ticket-a','claim',1,'Starting work','effect-assignment','r'),
};
for(const [name,command] of Object.entries(commands)){
 test(`effects: silently lost event rolls back ${name} and idempotency`,async()=>{
  const {db,service}=setup(s=>({...s,addEvent:async()=>{}})),before=db.snapshot();
  await assert.rejects(()=>command(service),{code:'transaction_effect_mismatch'});assert.deepEqual(db.snapshot(),before);
 });
 test(`effects: complete ${name} commits exactly one new event`,async()=>{
  const {db,service}=setup();await command(service);assert.equal(db.snapshot().events.length,1);
  assert.equal(db.snapshot().outbox.length,['note','assignment'].includes(name)?0:1);
 });
}
for(const name of ['create','message','transition','priority'] as const){
 test(`effects: silently lost outbox rolls back ${name}`,async()=>{const {db,service}=setup(s=>({...s,enqueue:async()=>{}})),before=db.snapshot();await assert.rejects(()=>commands[name](service),{code:'transaction_effect_mismatch'});assert.deepEqual(db.snapshot(),before);});
}
for(const change of ['account','actor','data','duplicate','private'] as const){
 test(`effects: rejects event corruption ${change}`,async()=>{
  const {db,service}=setup(s=>({...s,addEvent:async e=>{if(change==='duplicate')await s.addEvent(e);await s.addEvent({...e,...(change==='account'?{accountId:'account-b'}:{}),...(change==='actor'?{actorId:'someone-else'}:{}),...(change==='data'?{data:{...e.data,secret:'wrong'}}:{}),...(change==='private'?{customerVisible:false}:{})});}}));
  await assert.rejects(()=>commands.message(service),{code:'transaction_effect_mismatch'});assert.equal(db.snapshot().messages.length,0);
 });
}
for(const change of ['version','body','type','duplicate','id'] as const){
 test(`effects: rejects outbox corruption ${change}`,async()=>{
  const {db,service}=setup(s=>({...s,enqueue:async e=>{if(change==='duplicate')await s.enqueue(e);await s.enqueue({...e,...(change==='id'?{id:'other'}:{}),...(change==='type'?{type:'note.created'}:{}),payload:{...e.payload,...(change==='version'?{data:{ticket_id:e.ticketId,version:999}}:{}),...(change==='body'?{body:'private-content'}:{})}});}}));
  await assert.rejects(()=>commands.message(service),{code:'transaction_effect_mismatch'});assert.equal(db.snapshot().outbox.length,0);
 });
}
test('effects: parent version cannot advance without public message',async()=>{const {db}=setup(),before=db.snapshot();await assert.rejects(()=>db.run(actor,s=>s.updateTicket(ticket({version:2}),1)),{code:'transaction_effect_mismatch'});assert.deepEqual(db.snapshot(),before);});
test('effects: note may not leave an external event',async()=>{const {db,service}=setup(s=>({...s,addEvent:async e=>{await s.addEvent(e);await s.enqueue({id:e.id,workspaceId:e.workspaceId,accountId:e.accountId,ticketId:e.ticketId,type:e.type,createdAt:e.createdAt,requestId:'r',payload:{}});}}));await assert.rejects(()=>commands.note(service),{code:'transaction_effect_mismatch'});assert.equal(db.snapshot().notes.length,0);});
test('effects: earlier event cannot replace a new event of the same type',async()=>{const {db,service}=setup();await commands.message(service);const original=db.snapshot();const broken=new HelpdeskService({run:(p,f)=>db.run(p,s=>f({...s,addEvent:async()=>{}}))});await assert.rejects(()=>broken.addMessage(actor,'ticket-a','Second','effect-message-002','r'),{code:'transaction_effect_mismatch'});assert.deepEqual(db.snapshot(),original);});
test('effects: reenvio adds no event/outbox and returns original answer',async()=>{const {db,service}=setup();const first=await commands.message(service),before=db.snapshot();const second=await commands.message(service);assert.deepEqual(second.message,first.message);assert.equal(second.replayed,true);assert.deepEqual(db.snapshot(),before);});
test('effects: orphan event cannot be committed independently',async()=>{const {db,service}=setup();await commands.message(service);const e=db.snapshot().events[0]!;await assert.rejects(()=>db.run(actor,s=>s.addEvent({...e,id:'orphan'})),{code:'transaction_effect_mismatch'});});

test('effects: multiple complete commands may commit together with their own versions',async()=>{
 const {db}=setup();await db.run(actor,async store=>{
  const s=new HelpdeskService({run:async(_p,f)=>f(store)});
  await s.addMessage(actor,'ticket-a','First','batch-message-0001','r');
  await s.transition(actor,'ticket-a','open',2,'','batch-transition-1','r');
  await s.addNote(actor,'ticket-a','Private','batch-note-000001','r');
 });
 const snap=db.snapshot();assert.equal(snap.tickets[0]!.version,3);assert.equal(snap.events.length,3);assert.equal(snap.outbox.length,2);
});
test('effects: missing parent version advance leaves the message transaction incomplete',async()=>{
 const {db,service}=setup(s=>({...s,updateTicket:async()=>{}})),prior=db.snapshot();
 await assert.rejects(()=>commands.message(service),{code:'transaction_effect_mismatch'});assert.deepEqual(db.snapshot(),prior);
});
test('effects: a status event cannot legitimize an unsupported subject change',async()=>{
 const {db,service}=setup(s=>({...s,updateTicket:async(t,v)=>s.updateTicket({...t,subject:'Silently changed'},v)})),prior=db.snapshot();
 await assert.rejects(()=>commands.transition(service),{code:'transaction_effect_mismatch'});assert.deepEqual(db.snapshot(),prior);
});

test('effects: a deferred server rejection is never returned as successful COMMIT',async()=>{
 const {runTransaction}=await import('../src/infrastructure/transaction.ts');
 const {principal}=await import('./fixtures.ts');let discarded:Error|undefined;
 const client={query:async(sql:string)=>{
  if(sql==='COMMIT')throw Object.assign(new Error('Synthetic constraint rejection'),{code:'23514'});
  return {rows:[],rowCount:0,command:sql==='BEGIN'?'BEGIN':sql==='ROLLBACK'?'ROLLBACK':'SELECT'};
 },release:(e?:Error)=>{discarded=e;}};
 await assert.rejects(()=>runTransaction({query:client.query,connect:async()=>client,end:async()=>{}},principal(),async()=>({notReturned:true})),{status:503,code:'transaction_outcome_unknown'});
 assert.ok(discarded);
});
