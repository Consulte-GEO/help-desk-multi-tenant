import test from 'node:test';
import assert from 'node:assert/strict';
import {readTicketActions,loadTicketDetail,hasWriteActions} from '../web/ticket-actions.js';
import {ticketDto} from '../src/http/serialization.ts';
import {ticketActions} from '../src/application/ticket-actions.ts';
import {principal,ticket} from './fixtures.ts';
const id='13000000-0000-4000-8000-000000000001';
const p=principal({grants:[{accountId:'account-a',role:'agent'}]});
function detail(){const t=ticket({id,status:'open'});return {...ticketDto(p,t),available_actions:ticketActions(p,t)};}
const page=()=>({items:[],next_cursor:null});
test('UI reads a defensive projection and does not persist actions',()=>{
 const body=detail(),a=readTicketActions(body);assert.equal(a.reply,true);assert.equal(a.ticket_id,id);assert.equal(hasWriteActions(a),true);
 a.transitions.length=0;assert.ok(body.available_actions.transitions.length>0);
 assert.equal(hasWriteActions(null),false);
});
test('missing actions never falls back to agent/admin role in the browser',()=>{
 const body:any=detail();delete body.available_actions;assert.throws(()=>readTicketActions(body),/Ações/);
});
test('mismatched ticket or version rejects the full actions package',()=>{
 for(const update of [{ticket_id:'other-ticket'},{version:2},{version:NaN},{version:1.5}]){
  const body=detail();Object.assign(body.available_actions,update);assert.throws(()=>readTicketActions(body),/Ações/);
 }
});
test('actions require real booleans and a closed set of fields',()=>{
 for(const field of ['reply','read_notes','add_note','change_priority','claim','release'])for(const value of ['true',1,null,undefined]){
  const body=detail();Object.assign(body.available_actions,{[field]:value});assert.throws(()=>readTicketActions(body),/Ações/);
 }
 const body=detail();Object.assign(body.available_actions,{secret:'not allowed'});assert.throws(()=>readTicketActions(body),/Ações/);
});
test('invalid, duplicate or augmented transitions are rejected',()=>{
 for(const transitions of [[{to:'fake',requires_reason:false}],[{to:'open',requires_reason:false},{to:'open',requires_reason:false}],[{to:'open',requires_reason:'yes'}],[{to:'open',requires_reason:false,actor_id:'secret'}],null]){
  const body=detail();Object.assign(body.available_actions,{transitions});assert.throws(()=>readTicketActions(body),/Ações/);
 }
});
test('customer DTO cannot carry internal privileges or private workflow destinations',()=>{
 const t=ticket({id,status:'resolved'}),customer=principal();
 for(const extra of [{read_notes:true},{add_note:true},{change_priority:true},{claim:true},{release:true},{transitions:[{to:'waiting_internal',requires_reason:false}]}]){
  const body={...ticketDto(customer,t),available_actions:{...ticketActions(customer,t),...extra}};
  assert.throws(()=>readTicketActions(body),/Ações/);
 }
});
test('all false writes is view-only even when notes can be read',()=>{
 const a={...readTicketActions(detail()),reply:false,add_note:false,change_priority:false,claim:false,release:false,transitions:[]};
 assert.equal(a.read_notes,true);assert.equal(hasWriteActions(a),false);
});
test('detail loader fetches notes only when the server grants reading them',async()=>{
 const t=ticket({id}),q=principal({...p,scopes:['tickets:read','notes:write']}),body={...ticketDto(q,t),available_actions:ticketActions(q,t)};
 const calls:string[]=[];const loaded=await loadTicketDetail(id,async path=>{calls.push(path);return path.endsWith(id)?body:page();});
 assert.deepEqual(calls,['/tickets/'+id,'/tickets/'+id+'/messages?limit=50']);assert.equal(loaded!.actions.add_note,true);assert.equal(loaded!.notesUnavailable,false);
 assert.deepEqual(loaded!.notes,page());
});
test('note service failure does not hide the public conversation; old notes are not reused',async()=>{
 const message={id:'message-one',ticket_id:id,body:'Conversa pública',actor_type:'customer',created_at:'2026-09-17T10:00:00.000Z'};
 const loaded=await loadTicketDetail(id,async path=>{
  if(path.endsWith(id))return detail();if(path.includes('/notes'))throw Object.assign(Error('Private failure must not be shown'),{status:403});return {items:[message],next_cursor:null};
 });
 assert.equal(loaded!.notesUnavailable,true);assert.deepEqual(loaded!.notes,page());assert.equal(loaded!.messages.items[0]!.body,message.body);
 assert.equal(loaded!.actions.read_notes,false);assert.equal(loaded!.actions.add_note,false);assert.equal(loaded!.actions.reply,true);
 assert.equal(JSON.stringify(loaded).includes('Private failure'),false);
});
test('required public-conversation failure is propagated, not replaced by empty success',async()=>{
 await assert.rejects(()=>loadTicketDetail(id,async path=>{if(path.endsWith(id))return detail();throw Error('public unavailable');}),/public unavailable/);
});
test('stale detail response does not launch another conversation request',async()=>{
 let active=true;const calls:string[]=[];const r=await loadTicketDetail(id,async path=>{calls.push(path);active=false;return detail();},()=>active);
 assert.equal(r,null);assert.deepEqual(calls,['/tickets/'+id]);
});
test('stale nested responses never become a new detail result',async()=>{
 let active=true;const r=await loadTicketDetail(id,async path=>{if(path.endsWith(id))return detail();active=false;return page();},()=>active);
 assert.equal(r,null);
});
test('invalid actions stop before any conversation request',async()=>{
 const calls:string[]=[];await assert.rejects(()=>loadTicketDetail(id,async path=>{calls.push(path);return {id,version:1};}),/Ações/);
 assert.deepEqual(calls,['/tickets/'+id]);
});
test('wrong ticket response is rejected rather than loading that conversation',async()=>{
 const body=detail();body.id='other';await assert.rejects(()=>loadTicketDetail(id,async()=>body),/Ações/);
});
test('malformed note page is a section failure; malformed public page fails the read',async()=>{
 const malformed={items:'invalid',next_cursor:null};
 const loaded=await loadTicketDetail(id,async path=>path.endsWith(id)?detail():path.includes('/notes')?malformed:page());
 assert.equal(loaded!.notesUnavailable,true);assert.deepEqual(loaded!.notes,page());
 await assert.rejects(()=>loadTicketDetail(id,async path=>path.endsWith(id)?detail():malformed),/Conversa/);
});

test('refresh pauses writing without switching the selected private draft to public',async()=>{
 const module=await import('../web/ticket-actions.js');
 assert.equal(typeof (module as any).composerMode,'function');
 assert.equal((module as any).composerMode('internal',null),'internal');
 assert.equal((module as any).composerMode('public',null),'public');
});
test('fresh permissions change the composer channel only to an explicitly available channel',async()=>{
 const module=await import('../web/ticket-actions.js');const choose=(module as any).composerMode;
 assert.equal(typeof choose,'function');const a=readTicketActions(detail());
 assert.equal(choose('internal',a),'internal');assert.equal(choose('public',a),'public');
 assert.equal(choose('internal',{...a,add_note:false}),'public');
 assert.equal(choose('public',{...a,reply:false}),'internal');
});

test('detail accepts valid supplementary Unicode scalars up to the API read limit',async()=>{
 const body='🧪'.repeat(7000);const row={id:'message-unicode',ticket_id:id,body,actor_type:'customer',created_at:'2026-09-17T10:00:00.000Z'};
 const read=async(path:string)=>path.endsWith(id)?detail():path.includes('/notes')?page():{items:[row],next_cursor:null};
 assert.equal((await loadTicketDetail(id,read))!.messages.items[0]!.body,body);
 row.body='🧪'.repeat(12001);await assert.rejects(()=>loadTicketDetail(id,read),/Conversa/);
});
