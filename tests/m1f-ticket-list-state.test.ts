import test from 'node:test';import assert from 'node:assert/strict';
import {ticketDto} from '../src/http/serialization.ts';import {principal,ticket} from './fixtures.ts';
const load=async()=>{
 // @ts-ignore Native JS module is exercised directly; there is no simulated DOM.
 const module=await import('../web/ticket-list-state.js').catch(()=>null);
 assert.ok(module,'Estado da caixa de chamados ainda não implementado.');return module.createTicketListState();
};
const item=(id='ticket-a')=>ticketDto(principal(),ticket({id}));
const page=(ids:string[],next:string|null=null)=>({items:ids.map(id=>item(id)),next_cursor:next});
test('requisição da lista inclui filtros e cursor no servidor',async()=>{
 const s=await load();s.reset({q:' relatório ',status:'in_progress',priority:'high'});
 const op=s.begin();const url=new URL(op.path,'https://hd.test');
 assert.equal(url.searchParams.get('q'),'relatório');assert.equal(url.searchParams.get('status'),'in_progress');assert.equal(url.searchParams.get('priority'),'high');assert.equal(url.searchParams.get('limit'),'25');
 s.accept(op,page(['a'],'next-a'));const more=s.begin();assert.equal(new URL(more.path,'https://hd.test').searchParams.get('cursor'),'next-a');
});
test('resposta antiga não substitui resultado de filtro mais novo',async()=>{
 const s=await load();s.reset({q:'Antigo'});const old=s.begin();s.reset({q:'Novo'});const current=s.begin();
 assert.equal(s.accept(current,page(['new'])),true);assert.equal(s.accept(old,page(['old'])),false);assert.deepEqual(s.items().map((t:any)=>t.id),['new']);
});
test('resposta antiga da página seguinte não entra após atualizar lista',async()=>{
 const s=await load();const first=s.begin();s.accept(first,page(['a'],'cursor-a'));const old=s.begin();s.restart();const current=s.begin();s.accept(current,page(['b']));
 assert.equal(s.accept(old,page(['c'])),false);assert.deepEqual(s.items().map((t:any)=>t.id),['b']);
});
test('mudança de sessão elimina itens e invalida conclusões antigas',async()=>{
 const s=await load();s.accept(s.begin(),page(['a'],'cursor-a'));const old=s.begin();s.reset();
 assert.deepEqual(s.items(),[]);assert.equal(s.accept(old,page(['private'])),false);assert.equal(s.fail(old),false);
});
test('uma página pendente não pode disparar carregamento duplicado',async()=>{
 const s=await load();const op=s.begin();assert.equal(s.begin(),null);assert.equal(s.busy(),true);s.accept(op,page(['a']));assert.equal(s.busy(),false);assert.equal(s.begin(),null);
});
test('erro preserva página já carregada e permite repetir o mesmo cursor',async()=>{
 const s=await load();s.accept(s.begin(),page(['a'],'cursor-a'));const op=s.begin();assert.equal(s.fail(op),true);
 assert.equal(s.status(),'error');assert.deepEqual(s.items().map((t:any)=>t.id),['a']);const retry=s.begin();assert.equal(retry.cursor,op.cursor);
 s.accept(retry,page(['b']));assert.deepEqual(s.items().map((t:any)=>t.id),['a','b']);
});
test('estado não retém mutações externas nos itens ou filtros',async()=>{
 const s=await load();const filters={q:'Original'};s.reset(filters);filters.q='Changed';assert.equal(s.filters().q,'Original');
 const p=page(['a']);s.accept(s.begin(),p);p.items[0]!.subject='Changed';const copy=s.items();copy[0].subject='Mutated';assert.equal(s.items()[0].subject,'Falha de relatório');
});
test('página duplicada ou cursor repetido não corrompe resultados aceitos',async()=>{
 const s=await load();s.accept(s.begin(),page(['a'],'cursor-a'));const op=s.begin();
 assert.throws(()=>s.accept(op,page(['a'],'cursor-b')));assert.deepEqual(s.items().map((t:any)=>t.id),['a']);s.fail(op);
 const retry=s.begin();assert.throws(()=>s.accept(retry,page(['b'],'cursor-a')));assert.deepEqual(s.items().map((t:any)=>t.id),['a']);
});
test('payload com metadados privados ou formato inesperado é rejeitado',async()=>{
 const invalid=[{items:[],next_cursor:null,internal_notes:['segredo']},{items:[{...item(),private_value:'segredo'}],next_cursor:null},page(['a','a']),{items:[],next_cursor:'cursor-a'},{items:[{...item(),status:'waiting_internal'}],next_cursor:null},{items:[{...item(),version:0}],next_cursor:null},{items:[{...item(),created_at:'bad'}],next_cursor:null},page(Array.from({length:26},(_,i)=>String(i)))];
 for(const p of invalid){const s=await load();const op=s.begin();assert.throws(()=>s.accept(op,p));assert.deepEqual(s.items(),[]);}
});
test('filtros inválidos não apagam a lista atual',async()=>{
 const s=await load();s.accept(s.begin(),page(['a']));
 for(const filters of [{q:'x'},{q:'a'.repeat(121)},{q:'ab\u0000'},{status:'waiting_internal'},{priority:'all'},{private_scope:'x'}]){assert.throws(()=>s.reset(filters));assert.equal(s.items().length,1);}
});
test('paginação em memória é limitada e informa necessidade de refinar filtros',async()=>{
 const s=await load();
 for(let i=0;i<20;i++)s.accept(s.begin(),page(Array.from({length:25},(_,n)=>`t-${i}-${n}`),'cursor-'+i));
 assert.equal(s.items().length,500);assert.equal(s.capped(),true);assert.equal(s.begin(),null);
 s.restart();assert.equal(s.capped(),false);assert.deepEqual(s.items(),[]);assert.ok(s.begin());
});
test('resultado vazio não é confundido com carregamento ou erro',async()=>{
 const s=await load();assert.equal(s.status(),'idle');const op=s.begin();assert.equal(s.status(),'loading');s.accept(op,page([]));assert.equal(s.status(),'empty');assert.equal(s.next(),null);
});
