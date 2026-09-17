import test from 'node:test';import assert from 'node:assert/strict';
import {PostgresUnitOfWork} from '../src/infrastructure/postgres.ts';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {ticketSearch,foldSearch,SEARCH_UPPER,SEARCH_LOWER} from '../src/application/ticket-search.ts';
import {principal,ticket} from './fixtures.ts';
import type {SqlPool,SqlClient} from '../src/infrastructure/sql.ts';
function capture(){
 const calls:{sql:string;values:unknown[]}[]=[];
 const query=async(sql:string,values:unknown[]=[])=>{calls.push({sql,values});return {rows:[],rowCount:0,command:sql.trim().split(/\s/)[0]?.toUpperCase()};};
 const client:SqlClient={query,release:()=>{}};const pool:SqlPool={query,connect:async()=>client,end:async()=>{}};return {calls,pool};
}
test('busca SQL mantém texto malicioso somente em parâmetros e filtros antes do LIMIT',async()=>{
 const f=capture(),needle="' OR TRUE --";const service=new HelpdeskService(new PostgresUnitOfWork(f.pool));
 await service.list(principal(),{limit:25,q:needle,status:'in_progress',priority:'high'});
 const q=f.calls.find(c=>c.sql.includes('from helpdesk_core.tickets'));assert.ok(q);
 assert.ok(!q.sql.includes(needle));assert.equal(q.values[5],foldSearch(needle));assert.equal(q.values[4],26);
 assert.match(q.sql,/workspace_id=\$1/);assert.match(q.sql,/strpos\(translate\(subject,\$7::text,\$8::text\),\$6\)>0/);
 assert.match(q.sql,/status=any\(\$9::text\[\]\)/);assert.match(q.sql,/priority=\$10/);assert.match(q.sql,/order by tickets\.created_at desc,id desc limit \$5/);
 assert.deepEqual(q.values[8],['open','waiting_internal','waiting_third_party']);assert.equal(q.values[9],'high');
 assert.doesNotMatch(q.sql,/join|internal_notes|ticket_messages|unaccent|ilike/i);
});
test('normalização JS e parâmetros de tradução SQL usam o mesmo alfabeto latino',()=>{
 assert.equal(foldSearch(SEARCH_UPPER),SEARCH_LOWER);assert.equal(SEARCH_UPPER.length,SEARCH_LOWER.length);
 assert.equal(foldSearch('RELATÓRIO ÇÃO ÄÖÜ'), 'relatório ção äöü');assert.equal(foldSearch('ação'),'ação');
 assert.equal(foldSearch('Σİẞ'),'Σİẞ'); // This is not full Unicode linguistic folding.
});
test('consulta sem novos filtros mantém parâmetros opcionais nulos',async()=>{
 const f=capture();await new HelpdeskService(new PostgresUnitOfWork(f.pool)).list(principal(),{limit:25});
 const q=f.calls.find(c=>c.sql.includes('from helpdesk_core.tickets'));assert.ok(q);assert.equal(q.values[5],null);assert.equal(q.values[8],null);assert.equal(q.values[9],null);
});
test('não há cache de busca que preserve autorização de uma página anterior',async()=>{
 const db=new MemoryUnitOfWork({tickets:[ticket(),ticket({id:'ticket-b'})]}),service=new HelpdeskService(db),p=principal();
 const first=await service.list(p,{limit:1,q:'Falha'});assert.ok(first.nextCursor);
 const r=await service.list({...p,grants:[]},{limit:1,q:'Falha',cursor:first.nextCursor!});assert.deepEqual(r,{items:[],nextCursor:null});
});
test('filtro de conta continua autorizado antes da consulta de texto',async()=>{
 const service=new HelpdeskService(new MemoryUnitOfWork({tickets:[ticket()]}));
 await assert.rejects(()=>service.list(principal(),{limit:25,accountId:'account-b',q:'Falha'}),{code:'resource_not_found'});
});
test('telemetria da busca não inclui termo, prioridade, conta nem querystring',async()=>{
 const events:unknown[]=[];const h=createHttpHandler({service:new HelpdeskService(new MemoryUnitOfWork()),authenticate:async()=>principal(),observe:e=>{events.push(e);}});
 const response=await h(new Request('https://hd.test/v1/tickets?q=DOCUMENTO_SIGILOSO&priority=high'));
 assert.equal(response.status,200);assert.equal(events.length,1);assert.doesNotMatch(JSON.stringify(events),/DOCUMENTO_SIGILOSO|high|q=|account-a/);
 assert.equal(response.headers.get('cache-control'),'no-store');
});
test('busca aceita 120 pontos de código mas não controles, inválidos ou mais de 120',()=>{
 assert.equal(Array.from(ticketSearch({limit:25,q:'🚧'.repeat(120)}).q!).length,120);
 assert.throws(()=>ticketSearch({limit:25,q:'🚧'.repeat(121)}),{code:'invalid_input'});
});
