/** CG03g integration specifications for the EXISTING owned fresh-PG17 runner.
 * Real driver and database when executed; not executable without D/E and guarded targets.
 * This file is not a hosted installer. No external source or production identity is used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import {validateDatabaseTestTargets} from '../../scripts/database-target.ts';
import {createResourceGrantPublisher} from '../../src/application/resource-grant-publisher.ts';
import {createPostgresResourceGrantPublicationStore} from '../../src/infrastructure/resource-grant-publication-store.ts';
import {canonicalJson,requestHash} from '../../src/domain/canonical.ts';
import {planResourcePublication} from '../../src/domain/resource-publication.ts';
import {runTransaction} from '../../src/infrastructure/transaction.ts';
import type {SqlPool} from '../../src/infrastructure/sql.ts';

export function registerResourcePublicationSqlTests(adminPool:()=>SqlPool){
 test('CG03g complete publication, observation and receipt on real restricted PostgreSQL',async t=>{
  const {appUrl}=validateDatabaseTestTargets(process.env),admin=adminPool();
  assert.equal((await admin.query("select to_regclass('helpdesk_auth.cg_resource_observations') is not null as ready")).rows[0]?.ready,true);
  const install=await admin.connect();
  try{await install.query('BEGIN');await install.query("select set_config('app.cg03g_candidate','disposable-pg17',true)");
   await install.query(await readFile(new URL('../candidates/cg_resource_publication.sql',import.meta.url),'utf8'));await install.query('COMMIT');
  }catch(error){await install.query('ROLLBACK');throw error;}finally{install.release();}
  const password=randomBytes(32).toString('base64url');
  const alter=(await admin.query("select format('alter role helpdesk_resource_publisher login password %L',$1::text) as command",[password])).rows[0]?.command;
  assert.equal(typeof alter,'string');await admin.query(String(alter));
  const url=new URL(appUrl);url.username='helpdesk_resource_publisher';url.password=password;
  const name='pg',driver=await import(name) as {Pool:new(o:Record<string,unknown>)=>SqlPool};
  const pool=new driver.Pool({connectionString:url.toString(),max:2,connectionTimeoutMillis:5000});
  const app=new driver.Pool({connectionString:appUrl,max:1,connectionTimeoutMillis:5000});
  try{
   const w=randomUUID(),a=randomUUID(),product=randomUUID(),instance=randomUUID(),connection=randomUUID(),binding=randomUUID(),fingerprint='a'.repeat(64);
   await admin.query("insert into helpdesk_core.workspaces(id,name) values($1,'CG03g synthetic')",[w]);
   await admin.query("insert into helpdesk_core.accounts(workspace_id,id,name) values($1,$2,'CG03g synthetic')",[w,a]);
   await admin.query("insert into helpdesk_core.products(workspace_id,id,code,name) values($1,$2,'CG03G','Synthetic')",[w,product]);
   await admin.query("insert into helpdesk_core.product_instances(workspace_id,product_id,id,environment) values($1,$2,$3,'staging')",[w,product,instance]);
   await admin.query('insert into helpdesk_auth.cg_resource_connections(workspace_id,id,product_instance_id) values($1,$2,$3)',[w,connection,instance]);
   await admin.query("insert into helpdesk_auth.cg_resource_bindings(workspace_id,account_id,id,connection_id,tenant_id) values($1,$2,$3,$4,'Tenant-G')",[w,a,binding,connection]);
   await admin.query('insert into helpdesk_auth.cg_resource_publishers(workspace_id,connection_id,manifest_fingerprint,active) values($1,$2,$3,true)',[w,connection,fingerprint]);
   async function fixture(selectedPool=pool){
    const person=randomUUID();await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[person,randomUUID()]);
    await admin.query("insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,'requester')",[w,a,person]);
    const times=(await admin.query(`select to_char((clock_timestamp()-interval '1 second') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as start,
     to_char((clock_timestamp()+interval '10 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as finish`)).rows[0]!;
    const target={principalId:person,workspaceId:w,accountId:a,bindingId:binding,connectionId:connection,tenantId:'Tenant-G',operation:'tickets.read' as const};
    const observation={target,manifestFingerprint:fingerprint,bindingRevision:'binding-1',accessRevision:'source-1',asOf:String(times.start),expiresAt:String(times.finish),state:'active' as 'active'|'revoked',complete:true,
     resources:['A','0001'].map(id=>({connectionId:connection,tenantId:'Tenant-G',type:'work',id}))};
    const publisher=createResourceGrantPublisher({source:{readCompleteCoverage:async()=>structuredClone(observation)},store:createPostgresResourceGrantPublicationStore(selectedPool),manifestFingerprint:fingerprint,maxAgeMicros:60_000_000n,timeoutMs:1000});
    return {target,observation,publisher,publish:(expected='0',key=randomUUID())=>publisher.publish(target,expected,key),newer:async()=>{
     observation.accessRevision+='-next';observation.asOf=String((await admin.query(`select to_char(($1::timestamptz+interval '1 microsecond') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as instant`,[observation.asOf])).rows[0]?.instant);
    },counts:async()=> (await admin.query(`select (select count(*)::int from helpdesk_auth.cg_resource_grant_sets where principal_id=$1) as grants,
     (select count(*)::int from helpdesk_auth.cg_resource_grant_refs where principal_id=$1) as refs,
     (select count(*)::int from helpdesk_auth.cg_resource_observations where principal_id=$1) as observations,
     (select count(*)::int from helpdesk_auth.cg_resource_publication_ledger where principal_id=$1) as receipts`,[person])).rows[0]};
   }
   await t.test('new target publishes complete refs, matching observation and one audit receipt',async()=>{
    const f=await fixture(),result=await f.publish();assert.equal(result.replayed,false);assert.ok(BigInt(result.receipt.revision)>0n);
    assert.deepEqual(await f.counts(),{grants:1,refs:2,observations:1,receipts:1});
   });
   await t.test('same intent replays its original receipt without republishing a newer source',async()=>{
    const f=await fixture(),key=randomUUID(),first=await f.publish('0',key);await f.newer();f.observation.resources=[];f.observation.state='revoked';
    const second=await f.publish('0',key);assert.equal(second.replayed,true);assert.deepEqual(second.receipt,first.receipt);assert.deepEqual(await f.counts(),{grants:1,refs:2,observations:1,receipts:1});
   });
   await t.test('two intents against the same existing revision have one winner',async()=>{
    const f=await fixture(),first=await f.publish();await f.newer();
    const results=await Promise.allSettled([f.publish(first.receipt.revision),f.publish(first.receipt.revision)]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
    assert.equal((await f.counts())?.receipts,2);
   });
   await t.test('two intents for an absent target are serialized before row creation',async()=>{
    const f=await fixture(),results=await Promise.allSettled([f.publish(),f.publish()]);
    assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.deepEqual(await f.counts(),{grants:1,refs:2,observations:1,receipts:1});
   });
   await t.test('concurrent same-key requests produce one effect and the same receipt',async()=>{
    const f=await fixture(),key=randomUUID(),results=await Promise.all([f.publish('0',key),f.publish('0',key)]);
    assert.deepEqual(results[0].receipt,results[1].receipt);assert.equal(results.filter(r=>r.replayed).length,1);assert.equal((await f.counts())?.receipts,1);
   });
   function faultPool(fault:'append'|'commit'):SqlPool{
    let fail=true;return {query:(s,v)=>pool.query(s,v),end:async()=>{},connect:async()=>{
     const c=await pool.connect();return {on:(event,fn)=>c.on?.(event,fn),release:e=>c.release(e),query:async(s,v)=>{
      if(fail&&fault==='append'&&s.includes('cg_publication_append')){fail=false;throw Error('Synthetic pre-append failure');}
      const result=await c.query(s,v);if(fail&&fault==='commit'&&s==='COMMIT'){fail=false;throw Error('Synthetic lost COMMIT acknowledgement');}return result;
     }};
    }};
   }
   await t.test('failure before receipt SQL rolls back replacement and observation',async()=>{
    const f=await fixture(faultPool('append'));await assert.rejects(f.publish());assert.deepEqual(await f.counts(),{grants:0,refs:0,observations:0,receipts:0});
   });
   await t.test('a real COMMIT followed by simulated lost ack is reconciled with the same key',async()=>{
    const f=await fixture(faultPool('commit')),key=randomUUID();await assert.rejects(f.publish('0',key),{code:'transaction_outcome_unknown'});
    assert.deepEqual(await f.counts(),{grants:1,refs:2,observations:1,receipts:1});assert.equal((await f.publish('0',key)).replayed,true);
   });
   // CG03i: pg8.16.3 rejects a non-array values argument before sending SQL.
   // Unlike a server statement error, this does not itself abort the transaction.
   // Existing publication writes and their receipt must still roll back together.
   // WRITTEN ONLY until this guarded scenario runs against PostgreSQL17.
   await t.test('CG03i caught client-side rejection cannot commit an already staged publication',async()=>{
    const f=await fixture(),key=randomUUID();
    const plan=planResourcePublication({revision:'0',snapshot:null},f.observation,'0',new Date().toISOString(),60_000_000n);
    const target=canonicalJson(plan.target);
    await assert.rejects(runTransaction(pool,undefined,async c=>{
     await c.query('select helpdesk_auth.cg_publication_open($1,$2)',[target,key]);
     const response=await c.query('select helpdesk_auth.cg_publication_replace($1,$2,$3,$4,$5) as publication',
      [target,key,'0',canonicalJson(plan.snapshot),plan.snapshotHash]);
     const ack=response.rows[0]?.publication as {revision:string;snapshotHash:string};
     assert.equal(typeof ack?.revision,'string');assert.equal(ack.snapshotHash,plan.snapshotHash);
     const receipt={key,commandHash:requestHash({target:plan.target,expectedRevision:'0'}),targetHash:requestHash(plan.target),
      previousRevision:'0',revision:ack.revision,snapshotHash:plan.snapshotHash,state:plan.snapshot.state,
      resourceCount:plan.snapshot.resources.length,asOf:plan.snapshot.asOf,expiresAt:plan.snapshot.expiresAt};
     const saved=await c.query('select helpdesk_auth.cg_publication_append($1,$2,$3) as publication',[target,key,canonicalJson(receipt)]);
     assert.equal(saved.rows[0]?.publication,true);
     await assert.rejects(c.query('select $1::text','synthetic-invalid-values' as unknown as unknown[]),
      {message:'Query values must be an array'});
     return 'the caught error must not allow a partial success';
    }),{status:503,code:'transaction_statement_failed'});
    assert.deepEqual(await f.counts(),{grants:0,refs:0,observations:0,receipts:0});
   });
   async function refusesUnsafePublisher(){
    const f=await fixture();
    await assert.rejects(f.publish(),{code:'resource_publication_publisher_denied'});
    // Also call the SECURITY DEFINER helper directly, bypassing the adapter gate.
    await assert.rejects(pool.query('select helpdesk_auth.cg_publication_open($1,$2)',
     [canonicalJson(f.target),randomUUID()]),{code:'PGR02'});
    assert.deepEqual(await f.counts(),{grants:0,refs:0,observations:0,receipts:0});
   }
   await t.test('replication publisher is denied by both the adapter and SQL helper',async()=>{
    await admin.query('alter role helpdesk_resource_publisher replication');
    try{await refusesUnsafePublisher();}finally{await admin.query('alter role helpdesk_resource_publisher noreplication');}
   });
   await t.test('private schema ownership denies the publisher before any publication',async()=>{
    // A separate private namespace tests ownership without changing helper ACLs.
    await admin.query('create schema helpdesk_publication_ownership_probe authorization helpdesk_resource_publisher');
    try{await refusesUnsafePublisher();}finally{await admin.query('drop schema helpdesk_publication_ownership_probe');}
   });
   await t.test('private function ownership denies the publisher before any publication',async()=>{
    await admin.query("create function helpdesk_auth.cg_publication_ownership_probe() returns boolean language sql as 'select false'");
    try{
     await admin.query('alter function helpdesk_auth.cg_publication_ownership_probe() owner to helpdesk_resource_publisher');
     await refusesUnsafePublisher();
    }finally{await admin.query('drop function helpdesk_auth.cg_publication_ownership_probe()');}
   });
   await t.test('normal request login cannot use publication helpers or the private adapter',async()=>{
    const f=await fixture(app);await assert.rejects(f.publish());
    await assert.rejects(app.query('select helpdesk_auth.cg_publication_open($1,$2)',[canonicalJson(f.target),randomUUID()]),{code:'42501'});assert.equal((await f.counts())?.grants,0);
   });
   await t.test('publisher login has no direct table read/write and no PUBLIC helper grant',async()=>{
    for(const table of ['cg_resource_publishers','cg_resource_publication_states','cg_resource_publication_ledger','cg_resource_grant_sets'])await assert.rejects(pool.query('select * from helpdesk_auth.'+table),{code:'42501'});
    const rows=await admin.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname='helpdesk_auth' and p.proname like 'cg_publication_%' and a.grantee=0 and a.privilege_type='EXECUTE'");assert.equal(rows.rows.length,0);
   });
   await t.test('revoked snapshot publishes no resources or current observation',async()=>{
    const f=await fixture();f.observation.state='revoked';f.observation.resources=[];const r=await f.publish();assert.equal(r.receipt.state,'revoked');
    assert.deepEqual(await f.counts(),{grants:1,refs:0,observations:0,receipts:1});
    assert.equal((await admin.query('select active from helpdesk_auth.cg_resource_grant_sets where principal_id=$1',[f.target.principalId])).rows[0]?.active,false);
   });
   await t.test('disabled source publisher mapping denies writes without granting legacy fallback',async()=>{
    const f=await fixture();await admin.query('update helpdesk_auth.cg_resource_publishers set active=false where workspace_id=$1',[w]);
    try{await assert.rejects(f.publish());assert.equal((await f.counts())?.grants,0);}finally{await admin.query('update helpdesk_auth.cg_resource_publishers set active=true where workspace_id=$1',[w]);}
   });
   await t.test('retargeting the tenant cannot publish under a known binding',async()=>{
    const f=await fixture();f.target.tenantId='Other';await assert.rejects(f.publish());assert.equal((await f.counts())?.grants,0);
   });
   await t.test('deferred database constraint refuses staging without its same-transaction receipt',async()=>{
    const f=await fixture(),key=randomUUID(),plan=planResourcePublication({revision:'0',snapshot:null},f.observation,'0',new Date().toISOString(),60_000_000n);
    await assert.rejects(runTransaction(pool,undefined,async c=>{
     await c.query('select helpdesk_auth.cg_publication_open($1,$2)',[canonicalJson(f.target),key]);
     await c.query('select helpdesk_auth.cg_publication_replace($1,$2,$3,$4,$5)',[canonicalJson(f.target),key,'0',canonicalJson(plan.snapshot),plan.snapshotHash]);
    }));
    assert.deepEqual(await f.counts(),{grants:0,refs:0,observations:0,receipts:0});
   });
   await t.test('ledger cannot be updated or deleted even by the test administrator',async()=>{
    const f=await fixture();await f.publish();for(const statement of ["update helpdesk_auth.cg_resource_publication_ledger set receipt='{}' where principal_id=$1",'delete from helpdesk_auth.cg_resource_publication_ledger where principal_id=$1'])await assert.rejects(admin.query(statement,[f.target.principalId]),{code:'23514'});
   });
   await t.test('externally changed grant state cannot be silently adopted as revision zero',async()=>{
    const f=await fixture(),first=await f.publish();await f.newer();
    await admin.query("delete from helpdesk_auth.cg_resource_grant_refs where principal_id=$1 and resource_id='A'",[f.target.principalId]);
    await assert.rejects(f.publish(first.receipt.revision));assert.equal((await f.counts())?.receipts,1);
   });
  }finally{await pool.end();await app.end();}
 });
}
