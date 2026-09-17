import test from 'node:test';
import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import type {CreateTicket, StoredResult, UnitOfWork} from '../src/application/ports.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {PostgresUnitOfWork} from '../src/infrastructure/postgres.ts';
import type {SqlPool, SqlResult} from '../src/infrastructure/sql.ts';
import {principal, coverage, ticket} from './fixtures.ts';

const operator = principal({workspaceRole:'admin'});
const clock = () => new Date('2026-09-17T12:00:00.000Z');
const input:CreateTicket = {accountId:'account-a',productInstanceId:'geolab-production',serviceCode:'SUPPORT',subject:'Relatório não gerado',description:'Dados originais do pedido',priority:'normal'};
const key = 'review-replay-key-0001';
const req = '00000000-0000-4000-8000-000000000014';
type Mode = 'create'|'message'|'note'|'priority'|'assignment'|'transition';
function command(service:HelpdeskService, mode:Mode, p=operator) {
  switch(mode) {
    case 'create': return service.create(p,input,key,req);
    case 'message': return service.addMessage(p,'ticket-a','Mensagem original',key,req);
    case 'note': return service.addNote(p,'ticket-a','Nota interna original',key,req);
    case 'priority': return service.changePriority(p,'ticket-a','high',1,'Reclassificação justificada',key,req);
    case 'assignment': return service.changeAssignment(p,'ticket-a','claim',1,'Início de atendimento',key,req);
    case 'transition': return service.transition(p,'ticket-a','open',1,'Início de análise',key,req);
  }
}
function wrapped(db:MemoryUnitOfWork, transform:(record:StoredResult)=>unknown):UnitOfWork {
  return {run:(p,work)=>db.run(p,s=>work({...s,getIdempotency:async(op,k)=>{
    const record = await s.getIdempotency(op,k);
    return record===null ? null : transform(structuredClone(record)) as StoredResult;
  }}))};
}
async function original(mode:Mode) {
  const db = new MemoryUnitOfWork({tickets:[ticket()],coverages:[coverage()]});
  const service = new HelpdeskService(db,clock);
  const response = await command(service,mode);
  return {db,service,response};
}
const rejected = {status:503,code:'invalid_idempotency_result'};

for (const field of ['workspaceId','principalId','operation','key'] as const) {
  test(`replay rejects mismatched envelope ${field} without another mutation`,async()=>{
    const {db}=await original('message');const before=db.snapshot();
    const service = new HelpdeskService(wrapped(db,r=>({...r,[field]:'different-scope'})),clock);
    await assert.rejects(command(service,'message'),rejected);
    assert.deepEqual(db.snapshot(),before);
  });
}
for (const [label,transform] of [
  ['false cache value',()=>false],['missing cache value',()=>undefined],
  ['string denial',(r:StoredResult)=>({...r,denied:'false'})],
  ['string expiry',(r:StoredResult)=>({...r,expired:'false'})],
  ['invalid hash',(r:StoredResult)=>({...r,hash:'not-a-digest'})],
] as const) {
  test(`replay rejects ${label} instead of treating it as absent or authoritative`,async()=>{
    const {db}=await original('message');const before=db.snapshot();
    await assert.rejects(command(new HelpdeskService(wrapped(db,transform),clock),'message'),rejected);
    assert.deepEqual(db.snapshot(),before);
  });
}
for (const mode of ['create','message','note','priority','assignment','transition'] as const) {
  test(`${mode} replay rejects result from another account even with a matching key`,async()=>{
    const {db}=await original(mode);const before=db.snapshot();
    const service=new HelpdeskService(wrapped(db,r=>({...r,result:{...(r.result as object),accountId:'account-b'}})),clock);
    await assert.rejects(command(service,mode),rejected);
    assert.deepEqual(db.snapshot(),before);
  });
  test(`${mode} replay accepts only its result shape, not appended private fields`,async()=>{
    const {db}=await original(mode);
    const service=new HelpdeskService(wrapped(db,r=>({...r,result:{...(r.result as object),private_note:'SENTINEL-DO-NOT-EXPOSE'}})),clock);
    await assert.rejects(command(service,mode),rejected);
  });
}
for (const mode of ['message','note'] as const) {
  for (const [field,value] of [['ticketId','ticket-other'],['actorId','person-other'],['body','Conteúdo de outra operação'],['createdAt','invalid-date']] as const) {
    test(`${mode} replay binds ${field} to the authorized request`,async()=>{
      const {db}=await original(mode);
      const service=new HelpdeskService(wrapped(db,r=>({...r,result:{...(r.result as object),[field]:value}})),clock);
      await assert.rejects(command(service,mode),rejected);
    });
  }
}
for (const [field,value] of [
  ['id','ticket-other'],['productInstanceId','other-product'],['serviceCode','OTHER'],
  ['createdBy','other-person'],['coverageId','other-coverage'],['contractVersionId','other-version'],
  ['subject','Assunto de outro chamado'],['description','Conteúdo de outro chamado'],
  ['contractSnapshot',{contractId:'contract-b',version:1,policy:{secret:'another-account'}}],
  ['version',300],['priority','urgent'],['updatedAt','not-a-date'],
] as const) {
  test(`priority snapshot refuses incompatible ${field}`,async()=>{
    const {db}=await original('priority');
    const service=new HelpdeskService(wrapped(db,r=>({...r,result:{...(r.result as object),[field]:value}})),clock);
    await assert.rejects(command(service,'priority'),rejected);
  });
}
test('create replay validates the snapshot before using its identifier',async()=>{
  const {db}=await original('create');
  await assert.rejects(command(new HelpdeskService(wrapped(db,r=>({...r,result:null})),clock),'create'),rejected);
});
test('assignment replay cannot return a different owner for a claim',async()=>{
  const {db}=await original('assignment');
  await assert.rejects(command(new HelpdeskService(wrapped(db,r=>({...r,result:{...(r.result as object),assignedTo:'other-person'}})),clock),'assignment'),rejected);
});
test('transition replay must represent the requested target status',async()=>{
  const {db}=await original('transition');
  await assert.rejects(command(new HelpdeskService(wrapped(db,r=>({...r,result:{...(r.result as object),status:'resolved'}})),clock),'transition'),rejected);
});

test('valid replay preserves the original response after further changes, not the current ticket',async()=>{
  const {db,service,response}=await original('priority');
  await service.changePriority(operator,'ticket-a','urgent',2,'Outra alteração',key+'-other',req);
  const after=db.snapshot();const replay=await command(service,'priority');
  assert.deepEqual(replay,{...response,replayed:true});
  assert.deepEqual(db.snapshot(),after);
});
test('pre-assignment cache stays byte-semantically historical without adding assignedTo',async()=>{
  const {db,response}=await original('create');
  const service=new HelpdeskService(wrapped(db,r=>{const result={...(r.result as Record<string,unknown>)};delete result.assignedTo;return {...r,result};}),clock);
  const replay=await command(service,'create');
  assert.equal(replay.replayed,true);
  assert.equal(Object.hasOwn((replay as {ticket:object}).ticket,'assignedTo'),false);
  const expected={...((response as {ticket:object}).ticket)} as Record<string,unknown>;delete expected.assignedTo;
  assert.deepEqual((replay as {ticket:object}).ticket,expected);
});
test('JSONB property ordering in a contractual snapshot is not a conflict',async()=>{
  const {db}=await original('create');
  const service=new HelpdeskService(wrapped(db,r=>{const result=r.result as Record<string,unknown>;const snapshot=result.contractSnapshot as Record<string,unknown>;const policy=snapshot.policy as object;
    return {...r,result:{...result,contractSnapshot:{policy:Object.fromEntries(Object.entries(policy).reverse()),version:snapshot.version,contractId:snapshot.contractId}}};}),clock);
  assert.equal((await command(service,'create')).replayed,true);
});
test('historical message actor type is preserved when a requester becomes an operator',async()=>{
  const db=new MemoryUnitOfWork({tickets:[ticket()]});const service=new HelpdeskService(db,clock);
  const first=await command(service,'message',principal());
  const replay=await command(service,'message',operator);
  assert.deepEqual(replay,{...first,replayed:true});
  assert.equal((replay as {message:{actorType:string}}).message.actorType,'customer');
});
test('legitimate expired and denied cache signals keep their existing public errors',async()=>{
  for (const [flag,error] of [['expired',{code:'idempotency_expired',status:409}],['denied',{code:'resource_not_found',status:404}]] as const) {
    const {db}=await original('message');
    await assert.rejects(command(new HelpdeskService(wrapped(db,r=>({...r,[flag]:true})),clock),'message'),error);
  }
});
test('valid different request digest still means idempotency conflict, not cache absence',async()=>{
  const {db}=await original('message');
  await assert.rejects(command(new HelpdeskService(wrapped(db,r=>({...r,hash:'a'.repeat(64)})),clock),'message'),{code:'idempotency_conflict',status:409});
});
test('revoked access is checked before reading protected reply cache',async()=>{
  const {db}=await original('message');let touched=false;
  const revoked=principal({grants:[]});
  await assert.rejects(command(new HelpdeskService(wrapped(db,r=>{touched=true;return r;}),clock),'message',revoked),{status:404});
  assert.equal(touched,false);
});

function sqlFixture(rows:Record<string,unknown>[]) {
  const calls:string[]=[];
  const query=async(sql:string):Promise<SqlResult>=>{calls.push(sql);return {command:sql.split(' ')[0]?.toUpperCase(),rows:sql.includes('lookup_idempotency')?rows:[],rowCount:sql.includes('lookup_idempotency')?rows.length:0};};
  const pool:SqlPool={query,connect:async()=>({query,release:()=>{}}),end:async()=>{}};
  return {calls,db:new PostgresUnitOfWork(pool)};
}
for (const [label,rows] of [
  ['missing SQL row',[]],['record absent',[{}]],['multiple rows',[{record:null},{record:null}]],
  ['false record',[{record:false}]],['empty string record',[{record:''}]],['zero record',[{record:0}]],
  ['array record',[{record:[]}]],['string boolean',[{record:{denied:'true'}}]],
  ['missing result',[{record:{hash:'b'.repeat(64),expired:false}}]],
  ['additional private fields',[{record:{hash:'b'.repeat(64),result:{},expired:false,secret:'DO-NOT-EXPOSE'}}]],
] as [string,Record<string,unknown>[]][]) {
  test(`PostgreSQL adapter rejects ${label}; cannot execute a replacement mutation`,async()=>{
    const f=sqlFixture(rows);
    await assert.rejects(f.db.run(operator,s=>s.getIdempotency('tickets.create',key)),rejected);
    assert.equal(f.calls.at(-1),'ROLLBACK');
  });
}
test('PostgreSQL adapter accepts only explicit SQL NULL as cache miss',async()=>{
  const f=sqlFixture([{record:null}]);assert.equal(await f.db.run(operator,s=>s.getIdempotency('tickets.create',key)),null);
});
test('PostgreSQL adapter preserves legitimate successful and terminal lookup records',async()=>{
  for (const record of [{denied:true},{expired:true},{hash:'b'.repeat(64),result:{id:'ticket-a'},expired:false}]) {
    const f=sqlFixture([{record}]);const value=await f.db.run(operator,s=>s.getIdempotency('tickets.create',key));
    assert.equal(value?.principalId,operator.id);assert.equal(value?.workspaceId,operator.workspaceId);
  }
});
