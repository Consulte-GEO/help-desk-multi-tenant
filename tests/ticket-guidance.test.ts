import test from 'node:test';
import assert from 'node:assert/strict';
import {ticketGuidance} from '../web/ticket-guidance.js';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {createHttpHandler} from '../src/http/handler.ts';
import {principal,ticket} from './fixtures.ts';
import {statuses} from '../src/domain/model.ts';
async function detail(operator=true,status:typeof statuses[number]='open',owner:string|null=null,readonly=false){
 const actor=principal(operator?{id:'agent-a',grants:[{accountId:'account-a',role:'agent'}],...(readonly?{scopes:['tickets:read']}: {})}:{});
 const db=new MemoryUnitOfWork({tickets:[ticket({status,assignedTo:owner})]});
 const handler=createHttpHandler({service:new HelpdeskService(db),authenticate:async()=>actor});
 const response=await handler(new Request('https://example.test/v1/tickets/ticket-a'));assert.equal(response.status,200);
 return {body:await response.json(),db};
}
test('guidance distinguishes authorized internal waiting states using the current detail snapshot',async()=>{
 for(const [status,label,hint] of [['waiting_customer','Aguardando cliente','solicitante'],['waiting_internal','Aguardando equipe','equipe'],['waiting_third_party','Aguardando terceiro','terceiro']] as const){
  const {body}=await detail(true,status);const view=ticketGuidance(body,body.available_actions);
  assert.equal(view?.situation,label);assert.match(view!.next,new RegExp(hint));assert.equal(view?.version,body.version);
 }
});
test('customer guidance never exposes assignment or internal waiting/cancellation distinctions',async()=>{
 for(const status of statuses){const {body}=await detail(false,status,'PRIVATE_OWNER');
  const view=ticketGuidance({...body,assignment:{state:'other',name:'PRIVATE_OWNER'}},body.available_actions);
  assert.ok(view);assert.equal(view.owner,null);assert.doesNotMatch(JSON.stringify(view),/PRIVATE_|terceiro|Cancelado|Triagem|Aguardando equipe/);
  assert.ok(['Recebido','Em atendimento','Aguardando você','Resolvido','Encerrado'].includes(view.situation));
 }
});
test('responsibility is only the authorized relative state, without looking up or exposing a person',async()=>{
 for(const [owner,label] of [[null,'Sem responsável'],['agent-a','Você'],['PRIVATE_OWNER','Outro atendente']] as const){
  const {body}=await detail(true,'open',owner);const view=ticketGuidance(body,body.available_actions);assert.equal(view?.owner,label);assert.doesNotMatch(JSON.stringify(view),/PRIVATE_OWNER|agent-a/);
 }
 const {body}=await detail();for(const state of ['PRIVATE_OWNER','__proto__','constructor'])assert.equal(ticketGuidance({...body,assignment:{state}},body.available_actions)?.owner,'Não informado nesta consulta');
});
test('read-only guidance follows effective actions, never a role or a stale action snapshot',async()=>{
 const {body}=await detail(true,'waiting_internal',null,true);assert.match(ticketGuidance(body,body.available_actions)!.next,/somente consulta/);
 assert.equal(ticketGuidance(body,null),null);
 for(const actions of [{...body.available_actions,version:body.version+1},{...body.available_actions,ticket_id:'other'},{}])assert.equal(ticketGuidance(body,actions),null);
 assert.equal(ticketGuidance({...body,internal_status:'unknown'},body.available_actions),null);
});
test('all current states have guidance without changing tickets or turning hints into commands',async()=>{
 for(const status of statuses){const {body,db}=await detail(true,status);const before=db.snapshot(),input=structuredClone(body);
  const view=ticketGuidance(body,body.available_actions);assert.ok(view?.next);assert.deepEqual(body,input);assert.deepEqual(db.snapshot(),before);
  assert.deepEqual(Object.keys(view).sort(),['next','owner','situation','version']);assert.doesNotMatch(JSON.stringify(view),/prazo|vencimento|aprovado/i);
 }
});
