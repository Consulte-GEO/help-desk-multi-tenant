/** Explicit opt-in only, called by Wiki's disposable run_email.mjs. Never hosted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {createWikiEmailStore,createWikiNotificationCycle,assertWikiEmailDatabase,WIKI_EMAIL_DATABASE_QUERY} from '../../src/infrastructure/wiki-notification-runtime.ts';
import {createResendNotificationChannel} from '../../src/integrations/notifications/resend-channel.ts';
import type {SqlPool} from '../../src/infrastructure/sql.ts';
function local(name:string,user:string){const raw=process.env[name];if(!raw)throw Error('Only the disposable Wiki email runner may execute this test.');const u=new URL(raw);if(u.protocol!=='postgresql:'||u.hostname!=='127.0.0.1'||u.username!==user||u.pathname!=='/postgres'||!u.port||u.search||u.hash)throw Error('Local fixture URL required');return raw;}
const admin=new pg.Pool({connectionString:local('WIKI_EMAIL_ADMIN_URL','wiki_email_owner'),max:1}),worker=new pg.Pool({connectionString:local('WIKI_EMAIL_TEST_URL','helpdesk_notification_worker'),max:2});
const store=createWikiEmailStore(worker as unknown as SqlPool),recipient='10000000-0000-4000-8000-000000000002';
const from='Wiki <wiki@example.invalid>',provider='00000000-0000-4000-8000-000000000081';
async function reset(){
 await admin.query("update auth.users set email='thiago@consultegeo.com.br',email_confirmed_at=now() where id=$1",[recipient]);
 await admin.query('delete from wiki_cg.equipe where usuario_id=$1',[recipient]);
 await admin.query('select wiki_cg.email_configurar($1,true)',[recipient]);
 await admin.query("update wiki_cg.colab_email_outbox set state='pending',attempts=0,first_attempt_at=null,lease_id=null,lease_until=null,next_at=now(),envelope=null,envelope_hash=null,recipient_id=null,provider_id=null,revision=revision+1");
}
async function isolate(){await reset();await admin.query("update wiki_cg.colab_email_outbox set state='accepted',provider_id=$1 where event_id<>(select min(event_id) from wiki_cg.colab_email_outbox)",[provider]);}
async function due(){await admin.query("update wiki_cg.colab_email_outbox set next_at=now() where state in ('unknown','retry_wait')");}
const channel=(fetch:typeof globalThis.fetch)=>createResendNotificationChannel({id:'resend',apiKey:'local-test-only',from,fetch});
test.after(async()=>{await worker.end();await admin.end();});
test('Wiki additional catalog attestation accepts restricted login and rejects exposed wrapper grants',async()=>{
 const checked=await worker.query(WIKI_EMAIL_DATABASE_QUERY,[['public.wiki_cg_email_contract()','public.wiki_cg_email_claim()','public.wiki_cg_email_begin(bigint,uuid,bigint,text)','public.wiki_cg_email_finish(bigint,uuid,bigint,jsonb)']]);
 assert.deepEqual(checked.rows,[{sessionUser:'helpdesk_notification_worker',currentUser:'helpdesk_notification_worker',wrappers:true,tables:true,acl:true}]);
 await assertWikiEmailDatabase(worker as unknown as SqlPool);
 await admin.query('grant execute on function public.wiki_cg_email_claim() to authenticated');
 try{await assert.rejects(assertWikiEmailDatabase(worker as unknown as SqlPool),{code:'wiki_notification_database_unqualified'});}finally{await admin.query('revoke execute on function public.wiki_cg_email_claim() from authenticated');}
 await assertWikiEmailDatabase(worker as unknown as SqlPool);
});
test('two genuine restricted connections claim separate events and CAS rejects stale revision',async()=>{
 await reset();const claims=await Promise.all([store.claim(),store.claim()]);assert(claims[0] && !('attention' in claims[0]));assert(claims[1] && !('attention' in claims[1]));assert.notEqual(claims[0].eventId,claims[1].eventId);assert.equal(await store.claim(),null);
 await assert.rejects(store.begin({...claims[0],revision:claims[0].revision-1},from),{code:'40001'});
 const message=await store.begin(claims[0],from);assert(message);assert.equal(message.to,'thiago@consultegeo.com.br');
 await assert.rejects(store.begin(claims[0],from),{code:'40001'});
 const occurred=await admin.query("select to_char(occurred_at at time zone 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') stamp from wiki_cg.colab_email_outbox where event_id=$1",[claims[0].eventId]);
 assert(message.text.includes(occurred.rows[0].stamp));assert.doesNotMatch(message.text,/Como conferir|sintética|documentar o procedimento/);
 assert.match(message.text,/Este aviso registra o envio/);assert.match(message.text,/https:\/\/helpdesk\.consultegeo\.org\/wiki\/contribuicoes\//);
});
test('closed gate preserves unsent queue and current authority is checked after claim',async()=>{
 await isolate();await admin.query('update wiki_cg.colab_email_config set delivery_enabled=false');assert.equal(await store.claim(),null);
 assert.equal((await admin.query("select count(*)::int n from wiki_cg.colab_email_outbox where state='pending'")).rows[0].n,1);
 for(const mutation of ["update auth.users set email_confirmed_at=null where id=$1","update auth.users set email='changed@example.invalid' where id=$1","insert into wiki_cg.equipe(usuario_id,papel,ativo) values($1,'leitor',false)"]){
  await isolate();const claim=await store.claim();assert(claim && !('attention' in claim));await admin.query(mutation,[recipient]);assert.equal(await store.begin(claim,from),null);
  const row=(await admin.query('select state,attempts from wiki_cg.colab_email_outbox where event_id=$1',[claim.eventId])).rows[0];assert.deepEqual(row,{state:'retry_wait',attempts:0});
 }
});
test('Resend lost ACK recovers same immutable envelope/key and records accepted only on provider evidence',async()=>{
 await isolate();const requests:{body:string;key:string}[]=[];
 const cycle=createWikiNotificationCycle({store,from,channel:channel(async(_url,options)=>{
  requests.push({body:String(options?.body),key:new Headers(options?.headers).get('Idempotency-Key')!});
  if(requests.length===1)throw Error('response lost after provider acceptance');return Response.json({id:provider});
 })});
 assert.deepEqual(await cycle(),{processed:1,attention:0});assert.equal((await admin.query("select state from wiki_cg.colab_email_outbox where state<>'accepted'")).rows[0].state,'unknown');
 await due();assert.deepEqual(await cycle(),{processed:1,attention:0});assert.equal(requests.length,2);assert.deepEqual(requests[0],requests[1]);
 assert.equal((await admin.query("select count(*)::int n from wiki_cg.colab_email_outbox where state='accepted'")).rows[0].n,2);
 assert.equal(JSON.parse(requests[0]!.body).to[0],'thiago@consultegeo.com.br');
});
test('rate limit uses server backoff while permanent rejection is terminal',async()=>{
 await isolate();const cycle=createWikiNotificationCycle({store,from,channel:channel(async()=>Response.json({name:'rate_limit_exceeded'},{status:429}))});
 await cycle();const row=(await admin.query("select state,next_at>updated_at wait from wiki_cg.colab_email_outbox where state<>'accepted'")).rows[0];assert.deepEqual(row,{state:'retry_wait',wait:true});assert.equal(await store.claim(),null);
 await due();await createWikiNotificationCycle({store,from,channel:channel(async()=>Response.json({name:'validation_error'},{status:422}))})();
 assert.equal((await admin.query("select state from wiki_cg.colab_email_outbox where state<>'accepted'")).rows[0].state,'failed');await due();assert.equal(await store.claim(),null);
});
test('expiry or exhausted attempts never resends after provider deduplication boundary',async()=>{
 for(const boundary of ["first_attempt_at=now()-interval '22 hours'","attempts=6"]){
  await isolate();let sends=0;const cycle=createWikiNotificationCycle({store,from,channel:channel(async()=>{sends++;return Response.json({name:'internal_error'},{status:500});})});
  await cycle();await admin.query(`update wiki_cg.colab_email_outbox set ${boundary},next_at=now() where state='unknown'`);
  await cycle();assert.equal(sends,1);assert.equal((await admin.query("select state,last_reason from wiki_cg.colab_email_outbox where state<>'accepted'")).rows[0].state,'attention');
 }
});
test('crash after durable begin remains unknown and a different sender cannot replace the envelope',async()=>{
 await isolate();let sends=0;
 const cycle=createWikiNotificationCycle({store:{...store,async begin(c,f){await store.begin(c,f);throw Error('lost COMMIT acknowledgement');}},from,channel:channel(async()=>{sends++;return Response.json({id:provider});})});
 await assert.rejects(cycle(),{code:'wiki_notification_unavailable'});assert.equal(sends,0);
 await admin.query("update wiki_cg.colab_email_outbox set lease_until=now()-interval '1 second' where state='sending'");
 const claim=await store.claim();assert(claim && !('attention' in claim));assert.equal(await store.begin(claim,'Changed <changed@example.invalid>'),null);
 assert.equal((await admin.query("select last_reason from wiki_cg.colab_email_outbox where state='attention'")).rows[0].last_reason,'envelope_changed');
});
test('lost settlement ACK after acceptance never causes another provider call',async()=>{
 await isolate();let sends=0;const cycle=createWikiNotificationCycle({store:{...store,async finish(c,r){await store.finish(c,r);throw Error('lost COMMIT acknowledgement');}},from,channel:channel(async()=>{sends++;return Response.json({id:provider});})});
 await assert.rejects(cycle(),{code:'wiki_notification_unavailable'});assert.equal(await store.claim(),null);assert.equal(sends,1);
});
test('malformed outcome cannot forge provider acceptance and audit excludes envelope/user text',async()=>{
 await isolate();const claim=await store.claim();assert(claim && !('attention' in claim));const envelope=await store.begin(claim,from);assert(envelope);
 await assert.rejects(worker.query('select public.wiki_cg_email_finish($1,$2,$3,$4)',[envelope.eventId,envelope.leaseId,envelope.revision,{state:'accepted',providerMessageId:provider,extra:'forged'}]),{code:'22023'});
 const logs=JSON.stringify((await admin.query('select * from wiki_cg.colab_email_attempts')).rows);assert.doesNotMatch(logs,/thiago@|Como conferir|local-test-only|response lost/);
});
