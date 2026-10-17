import test from 'node:test';import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';import {principal,ticket} from './fixtures.ts';
import {statuses} from '../src/domain/model.ts';
const p=principal(),at='2026-10-16T15:00:00.000Z';
const setup=(rows=[ticket()])=>new HelpdeskService(new MemoryUnitOfWork({tickets:rows}),()=>new Date(at));
test('resumo conta todo o conjunto autorizado antes da paginação e do teto visual500',async()=>{
 const rows=Array.from({length:607},(_,i)=>ticket({id:'t-'+i,status:statuses[i%statuses.length]}));
 const s=setup([...rows,ticket({id:'hidden-account',accountId:'other'}),ticket({id:'hidden-person',createdBy:'other'}),ticket({id:'hidden-workspace',workspaceId:'other'})]);
 const summary=await s.summarize(p,{});assert.equal(summary.total,607);assert.deepEqual(summary.statuses,{received:136,in_progress:202,waiting_for_you:68,resolved:67,closed:134});assert.equal(summary.as_of,at);
 assert.equal((await s.list(p,{limit:25})).items.length,25);
});
test('resumo usa filtros literais, estados públicos e protocolo exato sem pesquisar descrição',async()=>{
 const s=setup([ticket({subject:'RELATÓRIO 100%_',status:'waiting_internal',priority:'high'}),ticket({id:'b',subject:'Relatório comum',description:'100%_'}),ticket({id:'c',status:'cancelled'})]);
 assert.deepEqual((await s.summarize(p,{q:'100%_',status:'in_progress',priority:'high'})).statuses,{received:0,in_progress:1,waiting_for_you:0,resolved:0,closed:0});
 assert.equal((await s.summarize(p,{status:'closed'})).total,1);assert.equal((await s.summarize(p,{q:'ausente'})).total,0);
});
test('resumo mantém exigência de scope, conta e filtros de responsabilidade',async()=>{
 const s=setup();await assert.rejects(()=>s.summarize(principal({scopes:[]}),{}),{status:403});
 await assert.rejects(()=>s.summarize(p,{accountId:'other'}),{status:404});await assert.rejects(()=>s.summarize(p,{assignment:'mine'}),{status:403});
 await assert.rejects(()=>s.summarize(p,{status:'waiting_internal'}),{status:400});
});
test('resumo limita integração ao produto e operador às próprias contas de atendimento',async()=>{
 const s=setup([ticket(),ticket({id:'b',productInstanceId:'other'}),ticket({id:'c',accountId:'account-b',createdBy:'person-b'})]);
 const machine=principal({kind:'integration',productInstanceIds:['geolab-production']});assert.equal((await s.summarize(machine,{})).total,1);
 const agent=principal({grants:[{accountId:'account-a',role:'agent'},{accountId:'account-b',role:'requester'}]});assert.equal((await s.summarize(agent,{assignment:'unassigned'})).total,2);
 assert.equal((await s.summarize({...agent,grants:[]},{})).total,0);
});
test('HTTP tem rota própria habilitada explicitamente e recusa paginação/duplicatas',async()=>{
 const h=createHttpHandler({service:setup(),authenticate:async()=>p,ticketTotals:true});
 for(const query of ['limit=1','cursor=abc','q=ab&q=cd','private_filter=open'])assert.equal((await h(new Request('https://hd.test/v1/tickets/summary?'+query))).status,400);
 assert.equal((await h(new Request('https://hd.test/v1/tickets/summary?internal_status=open'))).status,403);
 const r=await h(new Request('https://hd.test/v1/tickets/summary'));
 assert.equal(r.status,200);assert.equal((await r.json()).total,1);assert.equal(r.headers.get('cache-control'),'no-store');
 assert.equal((await h(new Request('https://hd.test/v1/tickets/summary',{method:'POST'}))).status,405);
 const off=createHttpHandler({service:setup(),authenticate:async()=>p});assert.equal((await off(new Request('https://hd.test/v1/tickets/summary'))).status,503);
});
