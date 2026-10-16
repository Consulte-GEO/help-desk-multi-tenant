import test from 'node:test';
import assert from 'node:assert/strict';
import {createMessageSearchState} from '../web/message-search.js';
const messages=[{id:'a',body:'Concreto recebido. CONCRETO conferido.'},{id:'b',body:'Área com revisão pendente.'},{id:'c',body:'Concreto liberado <script>literal</script>.'}];
test('public-message search is literal, counts messages once and preserves text/order',()=>{
 const state=createMessageSearchState(),before=structuredClone(messages);state.update('person:ticket',messages,true);
 const view=state.search(' CONCRETO ');assert.deepEqual(view.ids,['a','c']);assert.equal(view.currentId,'a');assert.equal(view.position,1);assert.equal(view.loaded,3);assert.equal(view.hasMore,true);assert.deepEqual(messages,before);
 assert.deepEqual(state.search('<script>').ids,['c']);assert.deepEqual(state.search('.*').ids,[]);
});
test('case folding preserves meaningful accents and accepts unicode without treating it as a pattern',()=>{
 const state=createMessageSearchState();state.update('ticket',[...messages,{id:'emoji',body:'Entrega 🧱 pronta'}]);
 assert.deepEqual(state.search('ÁREA').ids,['b']);assert.deepEqual(state.search('area').ids,[]);assert.deepEqual(state.search('🧱 pronta').ids,['emoji']);
});
test('navigation wraps in chronological message order without changing the search',()=>{
 const state=createMessageSearchState();state.update('ticket',messages);state.search('concreto');
 assert.equal(state.move(1).currentId,'c');assert.equal(state.move(1).currentId,'a');assert.equal(state.move(-1).currentId,'c');
 state.search('missing');assert.equal(state.move(1).currentId,null);assert.equal(state.view().position,0);
});
test('new authorized pages preserve selected message and recalculate matches and loaded coverage',()=>{
 const state=createMessageSearchState();state.update('ticket',messages,true);state.search('concreto');state.move(1);
 const added={id:'older',body:'Concreto anterior'};let view=state.update('ticket',[added,...messages],false);
 assert.deepEqual(view.ids,['older','a','c']);assert.equal(view.currentId,'c');assert.equal(view.position,3);assert.equal(view.loaded,4);assert.equal(view.hasMore,false);
 view=state.update('ticket',[added],false);assert.equal(view.currentId,'older');assert.equal(view.position,1);
});
test('ticket, person, workspace changes and suspension clear terms and prior message references',()=>{
 const state=createMessageSearchState();for(const owner of ['workspace:person:ticket','workspace:person:other','workspace:other:other','other:other:other']){
  const view=state.update(owner,messages,true);assert.equal(view.query,'');assert.deepEqual(view.ids,[]);assert.equal(view.currentId,null);state.search('concreto');
 }
 const cleared=state.update('',messages,true);assert.equal(cleared.enabled,false);assert.equal(cleared.loaded,0);assert.equal(cleared.query,'');assert.equal(cleared.hasMore,false);assert.deepEqual(state.search('concreto').ids,[]);
});
test('invalid or overly long terms never leave old matches or references in the view',()=>{
 const state=createMessageSearchState();state.update('ticket',messages);state.search('concreto');
 for(const q of ['a','\nconcreto','x'.repeat(121)]){const view=state.search(q);assert.ok(view.error);assert.deepEqual(view.ids,[]);assert.equal(view.currentId,null);}
 assert.equal(state.search('').error,null);assert.equal(state.search('  ').query,'');assert.deepEqual(state.view().ids,[]);
 const view=state.search('concreto');view.ids.push('injected');assert.deepEqual(state.view().ids,['a','c']);
});
