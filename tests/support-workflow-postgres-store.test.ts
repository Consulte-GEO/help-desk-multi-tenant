import test from 'node:test';
import assert from 'node:assert/strict';
import {requestHash} from '../src/domain/canonical.ts';
import {decideSupportTransition,type SupportTicket,type SupportWorkflowProfile} from '../src/domain/support-workflow.ts';
import type {Principal} from '../src/domain/model.ts';
import type {SqlClient,SqlPool,SqlResult} from '../src/infrastructure/sql.ts';
import {runTransaction} from '../src/infrastructure/transaction.ts';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const AT='2026-10-13T12:00:00.000000Z';
const p:Principal={id:id(2),workspaceId:id(1),kind:'human',workspaceRole:null,grants:[{accountId:id(3),role:'agent'}],scopes:['tickets:read','tickets:write','notes:read','notes:write']};
const t:SupportTicket={id:id(6),workspaceId:id(1),accountId:id(3),productInstanceId:id(7),serviceCode:'SUPPORT',createdBy:id(2),assignedTo:id(2),subject:'Cadastro de usuário',description:'Pedido sintético',status:'open',priority:'normal',version:4,coverageId:id(9),contractVersionId:id(10),contractSnapshot:{contractId:id(11),version:1,policy:{}},createdAt:AT,updatedAt:AT,profileVersionId:'P1',lastEventAt:AT,closedAt:null,resolution:null,approval:'not_required'};
const profile:SupportWorkflowProfile={versionId:'P1',status:'published',reopenWindowMicros:'604800000000'};
async function factory(){
 const path='../src/infrastructure/support-workflow-store.ts';
 const mod=await import(path).catch((e:unknown)=>{if(e&&typeof e==='object'&&'code' in e&&e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof mod.createPostgresSupportWorkflowStore,'function','Writer PostgreSQL do workflow ainda não implementado');
 return mod.createPostgresSupportWorkflowStore as (c:SqlClient,p:Principal)=>import('../src/application/support-workflow.ts').SupportWorkflowTransaction;
}
function setup(){
 let source=structuredClone(t),definition=structuredClone(profile),row:unknown=null,override:((sql:string,r:SqlResult)=>SqlResult)|undefined;
 const calls:{sql:string;values:unknown[]}[]=[];
 const client:SqlClient={async query(sql,values=[]){calls.push({sql,values});let result:unknown;
  if(sql.includes('hdn_read_support_workflow'))result={principalId:p.id,ticket:source,profile:definition};
  else if(sql.includes('hdn_support_workflow_receipt'))result=row;
  else if(sql.includes('hdn_commit_support_workflow'))result=(values[1] as any).receipt;
  else throw Error('Unexpected SQL '+sql);
  const r={command:'SELECT',rowCount:1,rows:[{result:structuredClone(result)}]};return override?override(sql,r):r;
 },release(){assert.fail('borrowed client must not be released');}};
 return {client,calls,setTicket(v:SupportTicket){source=v;},setProfile(v:SupportWorkflowProfile){definition=v;},setRow(v:unknown){row=v;},setOverride(v:typeof override){override=v;}};
}
function operation(ticket=t,definition=profile,action='resolve'){
 const command=action==='resolve'?{action,expectedVersion:ticket.version,body:'Cadastro executado e conferido.'}:{action,expectedVersion:ticket.version,body:'Favor informar os dados faltantes.'};
 const decision=decideSupportTransition(p,ticket,definition,command,AT),eventId=id(80);
 const receipt={key:'workflow-operational-intent-0001',hash:requestHash({workspaceId:p.workspaceId,actorId:p.id,ticketId:ticket.id,command}),result:{ticketId:ticket.id,workspaceId:p.workspaceId,accountId:ticket.accountId,actorId:p.id,profileVersionId:ticket.profileVersionId,version:decision.after.version,status:decision.after.status,eventId,replayed:false as const}};
 const audit={id:eventId,workspaceId:p.workspaceId,ticketId:ticket.id,actorId:p.id,requestId:id(90),at:AT,action:decision.audit.action,reason:decision.audit.reason,from:ticket.status,to:decision.after.status,version:decision.after.version};
 const outbox={id:eventId,workspaceId:p.workspaceId,accountId:ticket.accountId,ticketId:ticket.id,type:'support.'+decision.event.type,version:receipt.result.version,requestId:id(90),createdAt:AT};
 return {command,decision,receipt,audit,outbox};
}
test('writer reads locked ticket and pinned profile without a caller-supplied directory',async()=>{const f=setup(),s=(await factory())(f.client,p);assert.deepEqual(await s.readTicket(t.id),t);assert.deepEqual(await s.readProfile('P1'),profile);assert.equal(f.calls.length,1);assert.deepEqual(f.calls[0]!.values,[t.id]);});
test('reader refuses changing target within a transaction store',async()=>{const f=setup(),s=(await factory())(f.client,p);await s.readTicket(t.id);await assert.rejects(s.readTicket(id(66)),{code:'workflow_store_unavailable'});assert.equal(f.calls.length,1);});
for(const [name,change] of [
 ['workspace',(v:any)=>({...v,workspaceId:id(55)})],['actor envelope',null],['private field',(v:any)=>({...v,internalNotes:['PRIVATE']})],['profile pointer',(v:any)=>({...v,profileVersionId:'P2'})],['negative version',(v:any)=>({...v,version:-1})],['impossible timestamp',(v:any)=>({...v,updatedAt:'2026-02-30T12:00:00.000Z'})]
] as const)test('reader rejects '+name,async()=>{const f=setup();if(change)f.setTicket(change(t));else f.setOverride((_sql,r)=>({...r,rows:[{result:{principalId:id(44),ticket:t,profile}}]}));await assert.rejects((await factory())(f.client,p).readTicket(t.id));});
test('missing ticket remains not-found, never synthesized',async()=>{const f=setup();f.setOverride((_s,r)=>({...r,rows:[{result:null}]}));assert.equal(await (await factory())(f.client,p).readTicket(t.id),null);});
test('profile cannot be retrieved independently of an authorized locked ticket',async()=>{const f=setup();await assert.rejects((await factory())(f.client,p).readProfile('P1'));assert.equal(f.calls.length,0);});
test('durable commit sends one bound payload, not arbitrary UPDATE or transaction control',async()=>{const f=setup(),s=(await factory())(f.client,p),o=operation();await s.readTicket(t.id);await s.readProfile('P1');await s.commitDecision(t.version,o.decision,o.audit,o.outbox,o.receipt);assert.equal(f.calls.length,2);assert.match(f.calls[1]!.sql,/hdn_commit_support_workflow/);const payload=f.calls[1]!.values[1] as any;assert.deepEqual(payload.command,o.command);assert.deepEqual(payload.receipt,o.receipt.result);assert.equal(payload.key,o.receipt.key);assert.equal(payload.hash,o.receipt.hash);assert.equal(f.calls.some(c=>/^(BEGIN|COMMIT|ROLLBACK|update)/i.test(c.sql)),false);});
for(const field of ['accountId','createdBy','subject','priority','coverageId'] as const)test('commit rejects forged after.'+field,async()=>{const f=setup(),s=(await factory())(f.client,p),o=operation();await s.readTicket(t.id);const d=structuredClone(o.decision) as any;d.after[field]=field==='priority'?'urgent':field==='subject'?'Forged':id(55);await assert.rejects(s.commitDecision(t.version,d,o.audit,o.outbox,o.receipt));assert.equal(f.calls.length,1);});
for(const kind of ['audit actor','receipt id','outbox private','profile changed','hash changed','event body','receipt extra'] as const)test('commit refuses '+kind,async()=>{const f=setup(),s=(await factory())(f.client,p),o=operation();await s.readTicket(t.id);let {decision,audit,outbox,receipt}=structuredClone(o) as any;
 if(kind==='audit actor')audit.actorId=id(66);if(kind==='receipt id')receipt.result.eventId=id(66);if(kind==='outbox private')outbox.note='PRIVATE';if(kind==='profile changed')decision.after.profileVersionId='P2';if(kind==='hash changed')receipt.hash='a'.repeat(64);if(kind==='event body')decision.event.body='forged';if(kind==='receipt extra')receipt.result.privateNote='PRIVATE';
 await assert.rejects(s.commitDecision(t.version,decision,audit,outbox,receipt));assert.equal(f.calls.length,1);
});
test('stored receipt is bound to current actor ticket and revision before replay',async()=>{const f=setup(),s=(await factory())(f.client,p),o=operation();f.setTicket({...t,version:5,status:'resolved',resolution:o.command.body});f.setRow(o.receipt);await s.readTicket(t.id);assert.deepEqual(await s.readReceipt(o.receipt.key),o.receipt);f.setRow({...o.receipt,result:{...o.receipt.result,actorId:id(55)}});await assert.rejects(s.readReceipt(o.receipt.key));});
test('no receipt is legitimate absence',async()=>{const f=setup(),s=(await factory())(f.client,p);await s.readTicket(t.id);assert.equal(await s.readReceipt('legitimate-absence-01'),null);});
test('SQL failure does not leak its private error message',async()=>{const c:SqlClient={query:async()=>{throw Object.assign(Error('PASSWORD_PRIVATE'),{code:'HDW02'});},release(){}};await assert.rejects((await factory())(c,p).readTicket(t.id),(e:any)=>e.code==='workflow_version_conflict'&&!e.message.includes('PASSWORD'));});
test('missing qualified assignee is refused, not invented from a supplied scope',async()=>{const f=setup(),s=(await factory())(f.client,p);await s.readTicket(t.id);await assert.rejects(s.verifyAssignee(id(77),{} as any),{code:'workflow_assignee_denied'});});
test('captured malformed commit invalidates owned transaction and prevents later COMMIT',async()=>{
 const f=setup(),calls:string[]=[];f.setOverride((sql,r)=>sql.includes('hdn_commit_support_workflow')?{...r,rows:[{result:{ok:true}}]}:r);
 const pool:SqlPool={async connect(){return {async query(sql,values){calls.push(sql);if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {command:sql,rows:[],rowCount:null};if(sql.startsWith('select set_config'))return {command:'SELECT',rows:[],rowCount:1};return f.client.query(sql,values);},release(){}};},query:async()=>assert.fail(),end:async()=>{}};
 await assert.rejects(runTransaction(pool,p,async c=>{const s=(await factory())(c,p),o=operation();await s.readTicket(t.id);await assert.rejects(s.commitDecision(t.version,o.decision,o.audit,o.outbox,o.receipt));}),{code:'transaction_validation_failed'});
 assert.equal(calls.includes('COMMIT'),false);assert.equal(calls.at(-1),'ROLLBACK');
});

test('application-shaped driver error is sanitized instead of exposing transport details',async()=>{
 const {HelpdeskError}=await import('../src/domain/errors.ts');
 const client:SqlClient={query:async()=>{throw new HelpdeskError(403,'resource_scope_denied','PRIVATE_OPERATOR_TOKEN');},release(){}};
 await assert.rejects((await factory())(client,p).readTicket(t.id),(e:any)=>e.code==='resource_scope_denied'&&!e.message.includes('PRIVATE'));
});
test('a hostile error-code accessor is not executed or leaked',async()=>{
 let reads=0;const error=new Proxy({}, {getOwnPropertyDescriptor(){reads++;throw Error('PRIVATE_PROXY');}});
 const c:SqlClient={query:async()=>{throw error;},release(){}};
 await assert.rejects((await factory())(c,p).readTicket(t.id),(e:any)=>e.code==='workflow_store_unavailable'&&!e.message.includes('PRIVATE'));assert.ok(reads<=1);
});
test('a closure later than the recorded history is rejected',async()=>{
 const f=setup();f.setTicket({...t,status:'closed',resolution:'Concluído',closedAt:'2026-10-13T12:00:00.000001Z'});
 await assert.rejects((await factory())(f.client,p).readTicket(t.id),{code:'workflow_store_unavailable'});
});
test('unqualified customer return is refused before SQL mutation while preserving current core rules',async()=>{
 const customer:Principal={...p,workspaceRole:null,grants:[{accountId:t.accountId,role:'requester'}]};
 const f=setup(),ticket={...t,status:'waiting_customer' as const},cmd={action:'customer_reply',expectedVersion:t.version,body:'Dados complementados.'};
 f.setTicket(ticket);const s=(await factory())(f.client,customer);await s.readTicket(t.id);
 const d=decideSupportTransition(customer,ticket,profile,cmd,AT),eid=id(80),audit={id:eid,workspaceId:p.workspaceId,ticketId:t.id,actorId:p.id,requestId:id(90),at:AT,action:'customer_reply',reason:null,from:'waiting_customer',to:'open',version:t.version+1};
 const result={ticketId:t.id,workspaceId:p.workspaceId,accountId:t.accountId,actorId:p.id,profileVersionId:'P1',version:t.version+1,status:'open' as const,eventId:eid,replayed:false as const};
 const outbox={id:eid,workspaceId:p.workspaceId,accountId:t.accountId,ticketId:t.id,type:'support.customer_reply',version:t.version+1,requestId:id(90),createdAt:AT};
 await assert.rejects(s.commitDecision(t.version,d,audit,outbox,{key:'limited-customer-return-01',hash:requestHash({workspaceId:p.workspaceId,actorId:p.id,ticketId:t.id,command:cmd}),result}),{code:'workflow_transition_forbidden'});
 assert.equal(f.calls.length,1);
});
