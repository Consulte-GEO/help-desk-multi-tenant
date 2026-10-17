import test from 'node:test';
import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {principal,ticket} from './fixtures.ts';
import {statuses} from '../src/domain/model.ts';
import type {Principal,Ticket} from '../src/domain/model.ts';
const uuid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const rows=Array.from({length:65},(_,i)=>ticket({id:uuid(i+1),subject:i===64?'Agulha no histórico':'Atendimento recente '+i,createdAt:new Date(Date.UTC(2026,8,16,12,0,-i)).toISOString()}));
function setup(tickets:Ticket[]=rows,p:Principal=principal()){
 const db=new MemoryUnitOfWork({tickets}),service=new HelpdeskService(db);
 const handler=createHttpHandler({service,authenticate:async()=>p});
 const get=(query:string)=>handler(new Request('https://hd.test/v1/tickets?'+query));
 return {db,service,p,get};
}
test('busca no servidor alcança chamado anterior à primeira página de 25',async()=>{
 const {service,p}=setup();const options={limit:25,q:'Agulha'};
 const r=await service.list(p,options);assert.deepEqual(r.items.map(t=>t.id),[uuid(65)]);assert.equal(r.nextCursor,null);
});
test('HTTP aceita busca e filtra antes de paginar, sem vazar termos nos headers',async()=>{
 const {get}=setup();const r=await get('limit=25&q=Agulha');assert.equal(r.status,200);
 const body=await r.json();assert.equal(body.items.length,1);assert.equal(body.items[0].id,uuid(65));assert.equal(body.next_cursor,null);
 assert.ok(!JSON.stringify([...r.headers]).includes('Agulha'));
});
test('busca literal ignora caixa latina, preserva acentos e não interpreta curingas',async()=>{
 const {service,p}=setup([ticket({subject:'RELATÓRIO 100%_completo'}),ticket({id:uuid(2),subject:'Relatorio comum'})]);
 for(const [q,expected] of [[' relatório ',['ticket-a']],['100%_', ['ticket-a']],['relatorio',[uuid(2)]],['100__',[]]] as const){
  const r=await service.list(p,{limit:25,q});assert.deepEqual(r.items.map(t=>t.id),expected);
 }
});
test('não pesquisa descrição, mensagem nem nota interna',async()=>{
 const {db,service,p}=setup([ticket({description:'Confidencial descrição'})]);
 await service.addMessage(p,'ticket-a','Confidencial mensagem','m1f-public-search-key','test');
 const agent=principal({grants:[{accountId:'account-a',role:'agent'}]});
 await service.addNote(agent,'ticket-a','Confidencial nota','m1f-private-search-key','test');
 assert.equal((await service.list(p,{limit:25,q:'Confidencial'})).items.length,0);
 assert.equal(db.snapshot().notes.length,1);
});
test('UUID completo localiza o recurso; prefixo do UUID não é pesquisa por identificador',async()=>{
 const {service,p}=setup([ticket({id:uuid(111)})]);
 assert.equal((await service.list(p,{limit:25,q:uuid(111).toUpperCase()})).items.length,1);
 assert.equal((await service.list(p,{limit:25,q:uuid(111).slice(0,12)})).items.length,0);
});
test('status público reúne estados internos equivalentes sem expor classificação privada',async()=>{
 const {service,p}=setup(statuses.map((status,i)=>ticket({id:uuid(i),status})));
 const expected={received:['new','triage'],in_progress:['open','waiting_internal','waiting_third_party'],waiting_for_you:['waiting_customer'],resolved:['resolved'],closed:['closed','cancelled']};
 for(const [status,wanted] of Object.entries(expected)){
  const r=await service.list(p,{limit:25,status});assert.deepEqual(r.items.map(t=>t.status).sort(),[...wanted].sort());
 }
});
test('filtros de prioridade/status/assunto são combinados por AND',async()=>{
 const {service,p}=setup([ticket({subject:'Relatório antigo',status:'open',priority:'high'}),ticket({id:uuid(2),subject:'Relatório novo',priority:'high'}),ticket({id:uuid(3),subject:'Relatório normal',status:'open'})]);
 const r=await service.list(p,{limit:25,q:'relatório',status:'in_progress',priority:'high'});assert.deepEqual(r.items.map(t=>t.id),['ticket-a']);
});
test('busca não permite inferir títulos de outra conta, workspace ou solicitante',async()=>{
 const {service,p}=setup([ticket({subject:'Visível'}),ticket({id:uuid(2),subject:'Alvo secreto',accountId:'account-b'}),ticket({id:uuid(3),subject:'Alvo secreto',workspaceId:'workspace-b'}),ticket({id:uuid(4),subject:'Alvo secreto',createdBy:'person-b'})]);
 const r=await service.list(p,{limit:1,q:'Alvo secreto'});assert.deepEqual(r,{items:[],nextCursor:null});
});
test('integração não pesquisa produto fora do binding autorizado',async()=>{
 const p=principal({kind:'integration',id:'machine',productInstanceIds:['geolab-production']});
 const {service}=setup([ticket({createdBy:p.id,subject:'Permitido'}),ticket({id:uuid(2),createdBy:p.id,subject:'Segredo outro produto',productInstanceId:'school'})],p);
 assert.deepEqual(await service.list(p,{limit:25,q:'Segredo'}),{items:[],nextCursor:null});
});
test('ausência de tickets:read não é compensada pela busca',async()=>{
 const {service}=setup();await assert.rejects(()=>service.list(principal({scopes:['contexts:resolve']}),{limit:25,q:'Agulha'}),{status:403});
});
test('cursor vincula consulta, status e prioridade; não transfere autorização',async()=>{
 const {service,p}=setup(rows.map(t=>({...t,subject:'Termo comum',priority:'high'})));
 const r=await service.list(p,{limit:1,q:'Termo',status:'received',priority:'high'});assert.ok(r.nextCursor);
 for(const filters of [{q:'Outro',status:'received',priority:'high'},{q:'Termo',status:'closed',priority:'high'},{q:'Termo',status:'received',priority:'normal'}]){
  await assert.rejects(()=>service.list(p,{limit:1,cursor:r.nextCursor!,...filters}),{code:'invalid_cursor'});
 }
 const page=await service.list(p,{limit:1,cursor:r.nextCursor!,q:' Termo ',status:'received',priority:'high'});assert.equal(page.items[0]?.id,uuid(2));
});
test('cursor anterior sem novos filtros continua utilizável',async()=>{
 const {service,p}=setup();const r=await service.list(p,{limit:1});
 assert.equal((await service.list(p,{limit:1,cursor:r.nextCursor!})).items[0]?.id,uuid(2));
});
test('requisição com filtro inválido é recusada antes da consulta',async()=>{
 const {service,p}=setup();
 for(const options of [{q:''},{q:' '},{q:'x'},{q:'a'.repeat(121)},{q:'ab\u0000cd'},{q:'ab\ud800'},{q:123},{status:'waiting_internal'},{status:''},{priority:'extreme'},{priority:''}]){
  await assert.rejects(()=>service.list(p,{limit:25,...options} as never),{code:'invalid_input'});
 }
});
test('HTTP recusa filtro duplicado, desconhecido e seletor interno',async()=>{
 const {get}=setup();
 for(const q of ['q=teste&q=outro','priority=high&priority=low','status=closed&status=received','private_filter=waiting_internal','status=waiting_internal','q=%00aa','q='])assert.equal((await get(q)).status,400,q);
 assert.equal((await get('internal_status=waiting_internal')).status,403);
});
test('string parecida com injeção não expande os resultados',async()=>{
 const {service,p}=setup();assert.equal((await service.list(p,{limit:25,q:"' OR 1=1 --"})).items.length,0);
});
test('paginação filtrada percorre todos os resultados sem duplicação ou chamada ausente',async()=>{
 const {service,p}=setup(rows.map((t,i)=>({...t,subject:i%2?'Outro assunto':'Procurado'})));
 const ids:string[]=[];let cursor:string|undefined;
 do {const r=await service.list(p,{limit:7,q:'Procurado',...(cursor?{cursor}:{})});ids.push(...r.items.map(t=>t.id));cursor=r.nextCursor??undefined;}while(cursor);
 assert.equal(ids.length,33);assert.equal(new Set(ids).size,33);assert.deepEqual(ids,rows.filter((_,i)=>i%2===0).map(t=>t.id));
});
