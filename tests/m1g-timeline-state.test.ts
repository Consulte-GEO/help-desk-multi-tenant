import test from 'node:test';
import assert from 'node:assert/strict';
import {createMutationState} from '../web/mutation-state.js';
const path='../web/timeline-state.js';
async function timeline(){const mod=await import(path).catch(()=>null);assert.ok(mod,'Timeline state module must exist');return mod;}
const event=(n:number,type='ticket.created',data:Record<string,unknown>={})=>({id:'event-'+n,type,data,created_at:new Date(Date.UTC(2026,8,16,0,n)).toISOString()});

test('timeline starts idle and requires a selected owner',async()=>{const {createTimelineState}=await timeline();const s=createTimelineState();assert.equal(s.begin(),null);assert.equal(s.status(),'idle');});
test('history loads newest-first and appends validated older pages',async()=>{const {createTimelineState}=await timeline();const s=createTimelineState();s.reset('person/ticket',false);const a=s.begin();assert.ok(s.accept(a,{items:[event(3),event(2)],next_cursor:'older'}));const b=s.begin();assert.equal(b.cursor,'older');assert.ok(s.accept(b,{items:[event(1)],next_cursor:null}));assert.deepEqual(s.items().map((e:{id:string})=>e.id),['event-3','event-2','event-1']);assert.equal(s.status(),'ready');});
test('duplicate click cannot request the same history page concurrently',async()=>{const {createTimelineState}=await timeline();const s=createTimelineState();s.reset('one',false);s.begin();assert.equal(s.begin(),null);});
test('old history does not enter a new ticket or an A-B-A generation',async()=>{const {createTimelineState}=await timeline();const s=createTimelineState();s.reset('A',false);const a=s.begin();s.reset('B',false);s.reset('A',false);assert.equal(s.accept(a,{items:[event(1)],next_cursor:null}),false);assert.deepEqual(s.items(),[]);});
test('failure preserves older accepted events and enables retry',async()=>{const {createTimelineState}=await timeline();const s=createTimelineState();s.reset('one',false);s.accept(s.begin(),{items:[event(2)],next_cursor:'older'});const b=s.begin();assert.equal(s.fail(b),true);assert.equal(s.items().length,1);assert.equal(s.status(),'error');assert.equal(s.begin().cursor,'older');});
test('public client cannot accept an internal-note history entry',async()=>{const {createTimelineState}=await timeline();const s=createTimelineState();s.reset('one',false);const op=s.begin();assert.throws(()=>s.accept(op,{items:[event(1,'note.created',{noteId:'private'})],next_cursor:null}));assert.equal(s.items().length,0);});
test('public priority event cannot carry internal reason or arbitrary fields',async()=>{const {createTimelineState}=await timeline();const s=createTimelineState();s.reset('one',false);assert.throws(()=>s.accept(s.begin(),{items:[event(1,'ticket.priority_changed',{from:'normal',to:'high',version:2,reason:'SECRET'})],next_cursor:null}));assert.deepEqual(s.items(),[]);});
test('operator can render priority explanation but never raw JSON/identity fields',async()=>{const {createTimelineState,eventPresentation}=await timeline();const s=createTimelineState();s.reset('one',true);s.accept(s.begin(),{items:[event(1,'ticket.priority_changed',{from:'normal',to:'high',version:2,reason:'Urgência operacional'})],next_cursor:null});const view=eventPresentation(s.items()[0],true);assert.equal(view.title,'Prioridade alterada');assert.match(view.description,/Normal → Alta/);assert.match(view.description,/Motivo interno: Urgência/);assert.equal(view.internal,true);});
for(const [label,page] of [
 ['unknown envelope field',{items:[],next_cursor:null,debug:'SECRET'}],
 ['unknown event field',{items:[{...event(1),actor_id:'secret'}],next_cursor:null}],
 ['unknown type',{items:[event(1,'internal.export',{secret:'bad'})],next_cursor:null}],
 ['invalid time',{items:[{...event(1),created_at:'yesterday'}],next_cursor:null}],
 ['duplicate event',{items:[event(1),event(1)],next_cursor:null}],
 ['bad order',{items:[event(1),event(2)],next_cursor:null}],
 ['unknown public data',{items:[event(1,'message.created',{body:'SECRET'})],next_cursor:null}],
 ['empty page with cursor',{items:[],next_cursor:'loop'}],
 ['empty cursor',{items:[event(1)],next_cursor:''}],
 ['overlong cursor',{items:[event(1)],next_cursor:'x'.repeat(701)}],
 ['too many events',{items:Array.from({length:51},(_,i)=>event(51-i)),next_cursor:null}],
] as [string,unknown][])test('history rejects '+label+' atomically',async()=>{const {createTimelineState}=await timeline();const s=createTimelineState();s.reset('one',false);assert.throws(()=>s.accept(s.begin(),page));assert.deepEqual(s.items(),[]);});
test('reject repeated cursor and cross-page repeated events without partial merge',async()=>{const {createTimelineState}=await timeline();for(const page of [{items:[event(1)],next_cursor:'older'},{items:[event(2)],next_cursor:null}]){const s=createTimelineState();s.reset('one',false);s.accept(s.begin(),{items:[event(2)],next_cursor:'older'});assert.throws(()=>s.accept(s.begin(),page));assert.equal(s.items().length,1);}});
test('history snapshot cannot be mutated by UI callers',async()=>{const {createTimelineState}=await timeline();const s=createTimelineState();s.reset('one',false);s.accept(s.begin(),{items:[event(1,'ticket.priority_changed',{from:'normal',to:'high',version:2})],next_cursor:null});const a=s.items();a[0].data.from='urgent';a.pop();assert.equal(s.items()[0].data.from,'normal');});
test('history stops at 500 visible events, not a claim of total audit count',async()=>{const {createTimelineState}=await timeline();const s=createTimelineState();s.reset('one',false);for(let page=0;page<10;page++)s.accept(s.begin(),{items:Array.from({length:50},(_,i)=>event(1000-page*50-i)),next_cursor:'cursor-'+page});assert.equal(s.items().length,500);assert.equal(s.status(),'capped');assert.equal(s.begin(),null);});
test('public status history uses only the public status label',async()=>{const {eventPresentation}=await timeline();assert.deepEqual(eventPresentation(event(1,'ticket.status_changed',{status:'in_progress'}),false),{title:'Situação atualizada',description:'Em atendimento',internal:false});});
test('operator note history records existence without note body',async()=>{const {eventPresentation}=await timeline();const p=eventPresentation(event(1,'note.created',{noteId:'secret-note-id'}),true);assert.equal(p.title,'Nota interna registrada');assert.doesNotMatch(JSON.stringify(p),/secret-note/);});

test('priority request snapshot preserves new edits and the public reply draft',()=>{
 let n=0;const state=createMutationState(()=>`key-${++n}`);state.select('session/ticket');state.edit('public','Resposta em edição');
 state.edit('priority',JSON.stringify({priority:'high',reason:'Original',version:1}));const op=state.begin('priority');state.edit('priority',JSON.stringify({priority:'urgent',reason:'Novo motivo',version:1}));
 assert.deepEqual(state.finish(op,true),{current:true,cleared:false});assert.match(state.draft('priority'),/Novo motivo/);assert.equal(state.draft('public'),'Resposta em edição');
});
test('uncertain priority retry preserves expected version, content and idempotency key',()=>{let n=0;const state=createMutationState(()=>`key-${++n}`);state.select('one');state.edit('priority',JSON.stringify({priority:'high',reason:'Urgente',version:7}));const a=state.begin('priority');state.finish(a,false);const b=state.begin('priority');assert.equal(a?.body,b?.body);assert.equal(a?.key,b?.key);});
test('late priority acknowledgement does not clear another ticket form',()=>{const state=createMutationState();state.select('one');state.edit('priority','first');const op=state.begin('priority');state.select('two');state.edit('priority','second');assert.deepEqual(state.finish(op,true),{current:false,cleared:false});assert.equal(state.draft('priority'),'second');});
