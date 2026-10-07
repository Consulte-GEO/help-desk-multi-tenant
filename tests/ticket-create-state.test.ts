import test from 'node:test';
import assert from 'node:assert/strict';
import {createTicketCreateState,prepareCreateIntent,retryCreateIntent} from '../web/ticket-create-state.js';

const identity={workspace:'workspace-a',principal:'person-a',session:1};
const input={account_id:'account-a',product_instance_id:'instance-a',service_code:'SUPPORT',subject:'Pedido original',description:'Descrição original',priority:'normal' as const,coverage_id:'coverage-a'};
const receipt={id:'ticket-a',...input,version:1,contract_version_id:'version-a',status:'received',created_at:'2026-10-06T12:00:00.000Z',updated_at:'2026-10-06T12:00:00.000Z'};

test('invalid canonical input never installs a dispatched intent and remains correctable',()=>{
 for(const changes of [{subject:'a'},{description:''},{subject:'   '},{description:'\u0000'},{description:'\uD800'},{priority:'other'}]){
  const state=createTicketCreateState();state.reset(identity);
  assert.throws(()=>state.prepare({...input,...changes} as typeof input),/invalid_create_input/);
  assert.equal(state.intent(),null);assert.equal(state.begin(),null);
  state.prepare(input);assert.equal(state.begin()?.payload.subject,'Pedido original');
 }
});

test('creation intent copies and freezes complete payload, explicit coverage and session identity',()=>{
 const draft={...input},owner={...identity};
 const intent=prepareCreateIntent(draft,'key-original',owner);
 draft.subject='Pedido alterado';owner.session=2;
 const request=retryCreateIntent(intent,identity);
 assert.equal(request.body,'{"account_id":"account-a","product_instance_id":"instance-a","service_code":"SUPPORT","subject":"Pedido original","description":"Descrição original","priority":"normal","coverage_id":"coverage-a"}');
 assert.equal(request.headers['idempotency-key'],'key-original');
 assert.ok(Object.isFrozen(intent)&&Object.isFrozen(intent.payload)&&Object.isFrozen(intent.identity));
});

test('unknown creation retries exact bytes/key without accepting an edited intent',()=>{
 const state=createTicketCreateState(()=> 'key-original');state.reset(identity);
 state.prepare(input);const first=state.begin()!;
 assert.equal(state.begin(),null,'only one dispatch');
 assert.equal(state.fail(first),true);assert.equal(state.intent()?.status,'unknown');
 assert.throws(()=>state.prepare({...input,subject:'Editado'}),/unresolved/);
 const replay=state.begin()!;
 assert.deepEqual(retryCreateIntent(replay,identity),retryCreateIntent(first,identity));
 assert.equal(state.confirm(first,receipt),false,'late completion of previous attempt');
 assert.equal(state.confirm(replay,receipt),true);assert.equal(state.intent()?.status,'confirmed');
});

test('reset to another session discards intent and cannot accept old receipts or replay',()=>{
 const state=createTicketCreateState();state.reset(identity);state.prepare(input);const op=state.begin()!;
 const next={...identity,session:2};state.reset(next);
 assert.equal(state.intent(),null);assert.equal(state.fail(op),false);assert.equal(state.confirm(op,receipt),false);
 assert.throws(()=>retryCreateIntent(op,next),/stale_session/);
 for(const next of [{...identity,principal:'person-b'},{...identity,workspace:'workspace-b'}])assert.throws(()=>retryCreateIntent(op,next),/stale_session/);
});

test('invalid or unrelated receipt leaves original intent unknown and retryable',()=>{
 for(const result of [null,{}, {...receipt,id:''},{...receipt,account_id:'account-b'},{...receipt,subject:'Outro pedido'},{...receipt,coverage_id:'coverage-b'}, {...receipt,version:2},{...receipt,status:'closed'},{...receipt,internal_status:'open'},{...receipt,assignment:{}},{...receipt,internal_status:'new',assignment:{state:'mine',can_claim:false,can_release:true}}]){
  const state=createTicketCreateState();state.reset(identity);state.prepare(input);const op=state.begin()!;
  assert.throws(()=>state.confirm(op,result),/invalid_create_receipt/);state.fail(op);
  assert.equal(state.intent()?.status,'unknown');assert.equal(state.begin()?.key,op.key);
 }
});

test('preparation without explicit coverage preserves its absence in retry',()=>{
 const {coverage_id,...draft}=input;
 const intent=prepareCreateIntent(draft,'key-original',identity);
 assert.equal(JSON.parse(retryCreateIntent(intent,identity).body).coverage_id,undefined);
});

test('a confirmed creation permits a new explicitly prepared intent with a new key',()=>{
 let n=0;const state=createTicketCreateState(()=>`key-${++n}`);state.reset(identity);state.prepare(input);const first=state.begin()!;
 assert.equal(state.confirm(first,receipt),true);state.prepare({...input,subject:'Novo pedido'});
 assert.notEqual(state.begin()!.key,first.key);
});
