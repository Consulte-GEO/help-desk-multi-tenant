import test from 'node:test';import assert from 'node:assert/strict';
async function fresh(){
 const path='../web/mutation-state.js';const mod=await import(path).catch(()=>null);
 assert.equal(typeof mod?.createMutationState,'function','Mutation guard must be implemented');
 let n=0;return mod.createMutationState(()=>`mutation-fixture-${++n}`);
}
test('failed request retains payload and idempotency key for an exact retry',async()=>{
 const s=await fresh();s.select('ticket-a');s.edit('public','Mensagem');const a=s.begin('public');
 s.finish(a,false);const b=s.begin('public');assert.equal(a.key,b.key);assert.equal(a.body,b.body);
});
test('successful send clears only the unchanged submitted draft',async()=>{
 const s=await fresh();s.select('ticket-a');s.edit('public','Texto');const a=s.begin('public');
 assert.deepEqual(s.finish(a,true),{current:true,cleared:true});assert.equal(s.draft('public'),'');
});
test('new typing while a send is pending is not erased by its response',async()=>{
 const s=await fresh();s.select('ticket-a');s.edit('public','Primeiro');const a=s.begin('public');
 s.edit('public','Próximo texto');assert.deepEqual(s.finish(a,true),{current:true,cleared:false});assert.equal(s.draft('public'),'Próximo texto');
});
test('switching ticket invalidates late completion and preserves destination draft',async()=>{
 const s=await fresh();s.select('ticket-a');s.edit('public','Texto A');const a=s.begin('public');
 s.select('ticket-b');s.edit('public','Texto B');assert.deepEqual(s.finish(a,true),{current:false,cleared:false});assert.equal(s.draft('public'),'Texto B');
});
test('same ticket ID under a different session cannot reuse old request',async()=>{
 const s=await fresh();s.select('user-a:ticket-a');s.edit('public','Texto');const a=s.begin('public');
 s.reset('');s.select('user-b:ticket-a');assert.equal(s.current(a),false);assert.equal(s.finish(a,true).current,false);
});
test('returning to a ticket does not reactivate its stale operation',async()=>{
 const s=await fresh();s.select('a');s.edit('public','Texto');const a=s.begin('public');s.select('b');s.select('a');assert.equal(s.current(a),false);
});
test('public and private drafts and pending requests are independent',async()=>{
 const s=await fresh();s.select('a');s.edit('public','Público');s.edit('internal','Restrito');const a=s.begin('public');
 s.finish(a,true);assert.equal(s.draft('internal'),'Restrito');assert.equal(s.draft('public'),'');
});
test('duplicate submit during an active request does not create another operation',async()=>{
 const s=await fresh();s.select('a');s.edit('public','Texto');const a=s.begin('public');assert.equal(s.begin('public'),null);assert.equal(s.busy('public'),true);s.finish(a,false);assert.equal(s.busy('public'),false);
});
test('completion can be applied only once',async()=>{
 const s=await fresh();s.select('a');s.edit('public','Texto');const a=s.begin('public');s.finish(a,true);s.edit('public','Novo');assert.equal(s.finish(a,true).current,false);assert.equal(s.draft('public'),'Novo');
});
test('refresh of the same ticket preserves unsent draft and its retry key',async()=>{
 const s=await fresh();s.select('a');s.edit('public','Texto');const a=s.begin('public');s.finish(a,false);s.select('a');assert.equal(s.begin('public').key,a.key);
});
test('changed payload rotates key, identical input does not',async()=>{
 const s=await fresh();s.select('a');s.edit('transition','{"to":"open"}');const a=s.begin('transition');s.finish(a,false);
 s.edit('transition','{"to":"open"}');const b=s.begin('transition');assert.equal(a.key,b.key);s.finish(b,false);
 s.edit('transition','{"to":"closed"}');assert.notEqual(s.begin('transition').key,a.key);
});
test('editing away and back still protects the newer draft revision',async()=>{
 const s=await fresh();s.select('a');s.edit('public','A');const a=s.begin('public');s.edit('public','B');s.edit('public','A');assert.equal(s.finish(a,true).cleared,false);assert.equal(s.draft('public'),'A');
});
test('empty identity cannot submit even when a draft exists',async()=>{
 const s=await fresh();s.edit('public','Texto');assert.equal(s.begin('public'),null);
});
test('snapshot cannot be externally rewritten to change the submitted body',async()=>{
 const s=await fresh();s.select('a');s.edit('internal','Nota');const a=s.begin('internal');assert.equal(Object.isFrozen(a),true);assert.throws(()=>{a.body='Public';});
});
