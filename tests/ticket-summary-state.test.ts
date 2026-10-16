import test from 'node:test';import assert from 'node:assert/strict';
const load=async()=>{const m=await import('../web/ticket-summary-state.js').catch(()=>null);assert.ok(m,'Estado de totais ausente');return m.createTicketSummaryState();};
const result=(n=607)=>({as_of:'2026-10-16T15:00:00.000Z',total:n,statuses:{received:n,in_progress:0,waiting_for_you:0,resolved:0,closed:0}});
test('totais preservam valores completos e vinculam o caminho à consulta aplicada',async()=>{
 const s=await load(),op=s.begin({q:'100%_',priority:'high'});assert.equal(new URL(op.path,'https://hd.test').searchParams.get('limit'),null);
 assert.equal(new URL(op.path,'https://hd.test').searchParams.get('q'),'100%_');assert.equal(s.accept(op,result()),true);assert.equal(s.value()?.total,607);
});
test('nova consulta e logout eliminam totais e recusam respostas e erros antigos',async()=>{
 const s=await load(),old=s.begin({q:'antigo'}),current=s.begin({q:'novo'});assert.equal(s.value(),null);
 assert.equal(s.accept(old,result()),false);s.accept(current,result(2));s.reset();assert.equal(s.value(),null);assert.equal(s.accept(current,result()),false);assert.equal(s.fail(old),false);
});
test('resumo inválido não vira zero nem preserva totais da consulta anterior; repetição recupera',async()=>{
 const s=await load();for(const bad of [{...result(),total:0},{...result(),notes:['private']},{...result(),total:-1},{...result(),total:NaN},{...result(),as_of:'bad'}, {...result(),statuses:{...result().statuses,internal:2}}]){
  const op=s.begin({});assert.throws(()=>s.accept(op,bad));s.fail(op);assert.equal(s.status(),'error');assert.equal(s.value(),null);
 }const retry=s.begin({});s.accept(retry,result(0));assert.equal(s.value()?.total,0);assert.equal(s.status(),'ready');
});
