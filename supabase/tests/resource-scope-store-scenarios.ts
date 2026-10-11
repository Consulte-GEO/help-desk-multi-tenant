/** Runs after the CG03d candidate in the same guarded, owned PostgreSQL17 database.
 * No remote credentials, new provider or hosted migration. The authority is synthetic;
 * resolver, bridge, store, pg transport and database policy are real.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {validateDatabaseTestTargets} from '../../scripts/database-target.ts';
import {createResourceAccessResolver} from '../../src/application/resource-access.ts';
import {runResourceTicketTransaction} from '../../src/infrastructure/resource-access-store.ts';
import {runTransaction} from '../../src/infrastructure/transaction.ts';
import {HelpdeskService} from '../../src/application/helpdesk.ts';
import {PostgresUnitOfWork,assertSafeDatabaseRole} from '../../src/infrastructure/postgres.ts';
import type {SqlPool} from '../../src/infrastructure/sql.ts';
import type {Principal} from '../../src/domain/model.ts';

export function registerResourceScopeStoreSqlTests(adminPool:()=>SqlPool){
 test('CG03e database observations bind the resource lease to the actual ticket transaction',async t=>{
  const {appUrl}=validateDatabaseTestTargets(process.env),admin=adminPool();
  assert.equal((await admin.query("select to_regclass('helpdesk_auth.cg_resource_bindings') is not null as ready")).rows[0]?.ready,true);
  const installer=await admin.connect();
  try{await installer.query('BEGIN');await installer.query("select set_config('app.cg03e_candidate','disposable-pg17',true)");
   await installer.query(await readFile(new URL('../candidates/cg_resource_observation.sql',import.meta.url),'utf8'));await installer.query('COMMIT');
  }catch(e){await installer.query('ROLLBACK');throw e;}finally{installer.release();}
  const moduleName='pg',driver=await import(moduleName) as {Pool:new(o:Record<string,unknown>)=>SqlPool};
  const pool=new driver.Pool({connectionString:appUrl,max:2,connectionTimeoutMillis:5000});
  try{
   await assertSafeDatabaseRole(pool);
   const w=randomUUID(),account=randomUUID(),product=randomUUID(),instance=randomUUID(),contract=randomUUID(),version=randomUUID();
   const who=randomUUID(),connection=randomUUID(),binding=randomUUID(),manifest='a'.repeat(64);
   await admin.query("insert into helpdesk_core.workspaces(id,name) values($1,'CG03e synthetic')",[w]);
   await admin.query("insert into helpdesk_core.accounts(workspace_id,id,name) values($1,$2,'CG03e account')",[w,account]);
   await admin.query("insert into helpdesk_core.products(workspace_id,id,code,name) values($1,$2,$3,'CG03e product')",[w,product,product]);
   await admin.query("insert into helpdesk_core.product_instances(workspace_id,product_id,id,environment) values($1,$2,$3,'staging')",[w,product,instance]);
   await admin.query("insert into helpdesk_core.services(workspace_id,product_id,code,name) values($1,$2,'SUPPORT','Support')",[w,product]);
   await admin.query("insert into helpdesk_core.support_contracts(workspace_id,id,name) values($1,$2,'CG03e contract')",[w,contract]);
   await admin.query("insert into helpdesk_core.contract_versions(workspace_id,contract_id,id,version,published,valid_from,policy) values($1,$2,$3,1,true,'2020-01-01','{}')",[w,contract,version]);
   await admin.query("insert into helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) values($1,$2,$3,$4,'SUPPORT',$5,$6)",[w,account,product,instance,version,randomUUID()]);
   await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[who,randomUUID()]);
   await admin.query("insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,'account_manager')",[w,account,who]);
   const p:Principal={id:who,workspaceId:w,kind:'human',workspaceRole:null,grants:[{accountId:account,role:'account_manager'}],scopes:['tickets:read','tickets:write']};
   await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,0,$4,$5)',[w,who,p.scopes,'CG03e synthetic',randomUUID()]);
   const service=new HelpdeskService(new PostgresUnitOfWork(pool)),tickets:Record<string,string>={};
   for(const name of ['A','AB','C'])tickets[name]=(await service.create(p,{accountId:account,productInstanceId:instance,serviceCode:'SUPPORT',subject:'CG03e '+name,description:'Synthetic',priority:'normal'},randomUUID(),randomUUID())).ticket.id;
   await admin.query('insert into helpdesk_auth.cg_resource_connections(workspace_id,id,product_instance_id) values($1,$2,$3)',[w,connection,instance]);
   await admin.query("insert into helpdesk_auth.cg_resource_bindings(workspace_id,account_id,id,connection_id,tenant_id) values($1,$2,$3,$4,'Tenant-A')",[w,account,binding,connection]);
   for(const [name,ids] of [['A',['A']],['AB',['A','B']],['C',['C']]] as const){
    await admin.query('insert into helpdesk_core.cg_ticket_resource_sets(workspace_id,account_id,ticket_id,binding_id,expected_count) values($1,$2,$3,$4,$5)',[w,account,tickets[name],binding,ids.length]);
    for(const id of ids)await admin.query("insert into helpdesk_core.cg_ticket_resource_refs(workspace_id,account_id,ticket_id,resource_type,resource_id) values($1,$2,$3,'work',$4)",[w,account,tickets[name],id]);
    await admin.query('update helpdesk_core.cg_ticket_resource_sets set sealed=true where workspace_id=$1 and ticket_id=$2',[w,tickets[name]]);
   }
   const times=(await admin.query(`select to_char((clock_timestamp()-interval '1 second') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as start,to_char((clock_timestamp()+interval '10 minutes') at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as finish`)).rows[0]!;
   const asOf=String(times.start),expiresAt=String(times.finish);
   for(const op of ['tickets.read','tickets.write']){
    await admin.query('insert into helpdesk_auth.cg_resource_grant_sets(workspace_id,account_id,binding_id,principal_id,operation,source_revision,as_of,expires_at,expected_count) values($1,$2,$3,$4,$5,$6,$7,$8,2)',[w,account,binding,who,op,'source-1',asOf,expiresAt]);
    for(const id of ['A','B'])await admin.query("insert into helpdesk_auth.cg_resource_grant_refs(workspace_id,account_id,binding_id,principal_id,operation,resource_type,resource_id) values($1,$2,$3,$4,$5,'work',$6)",[w,account,binding,who,op,id]);
    await admin.query('update helpdesk_auth.cg_resource_grant_sets set active=true where workspace_id=$1 and binding_id=$2 and operation=$3',[w,binding,op]);
   }
   // Only the disposable administrator publishes a synthetic observation. There is
   // deliberately no production publisher or caller-controlled approval endpoint.
   await admin.query(`insert into helpdesk_auth.cg_resource_observations(workspace_id,account_id,binding_id,principal_id,operation,grant_revision,binding_revision,access_revision,manifest_fingerprint,as_of,expires_at,expected_count)
    select workspace_id,account_id,binding_id,principal_id,operation,revision,'binding-1',source_revision,$3,as_of,expires_at,expected_count from helpdesk_auth.cg_resource_grant_sets where workspace_id=$1 and binding_id=$2 and operation='tickets.read'`,[w,binding,manifest]);
   const ref=(id:string)=>({connectionId:connection,tenantId:'Tenant-A',type:'work',id});
   const authority=(edits:Record<string,unknown>={},op='tickets.read')=>{
    let reads=0;const resolver=createResourceAccessResolver({manifestFingerprint:String(edits.manifestFingerprint??manifest),maxAgeMicros:900_000_000n,timeoutMs:1000,
     authority:{readAccess:async()=>{reads++;return {principal:structuredClone(p),binding:{id:binding,workspaceId:w,accountId:account,connectionId:connection,tenantId:'Tenant-A',revision:'binding-1',active:true,...(edits.binding as object??{})},
      operation:op,accessRevision:'source-1',manifestFingerprint:manifest,asOf,expiresAt,resources:[ref('A'),ref('B')],...Object.fromEntries(Object.entries(edits).filter(([k])=>k!=='binding'))};}}});
    return {resolver,reads:()=>reads};
   };
   const denied={code:'resource_scope_database_mismatch'};
   async function run(name='A',selection=['A'],edits:Record<string,unknown>={},op='tickets.read',onWork?:()=>Promise<unknown>,selectedPool:SqlPool=pool){
    const {resolver}=authority(edits,op),refs=selection.map(ref),proof=await resolver.resolveResourceScope(p,refs,op);
    return runResourceTicketTransaction(selectedPool,resolver,p,tickets[name]!,refs,op,proof,async(c)=>{
     if(onWork)return onWork();return (await c.query('select id from helpdesk_core.tickets where workspace_id=$1 and id=$2',[w,tickets[name]])).rows;
    });
   }
   const changeGrant=(set:string)=>admin.query('update helpdesk_auth.cg_resource_grant_sets set '+set+" where workspace_id=$1 and binding_id=$2 and operation='tickets.read'",[w,binding]);
   const visible=()=>runTransaction(pool,p,c=>c.query('select id from helpdesk_core.tickets where workspace_id=$1 and id=$2',[w,tickets.A]));
   await t.test('matching lease and published observation allow the exact ticket on the same transaction',async()=>assert.deepEqual(await run(),[{id:tickets.A}]));
   await t.test('equivalent resource order matches the exact multi-resource ticket',async()=>assert.deepEqual(await run('AB',['B','A']),[{id:tickets.AB}]));
   await t.test('a lease for A cannot admit an A+B ticket even with full underlying coverage',async()=>{await assert.rejects(run('AB',['A']),denied);});
   await t.test('a local write lease without persisted observation is denied',async()=>{await assert.rejects(run('A',['A'],{},'tickets.write'),denied);});
   for(const [name,edits] of [['access revision',{accessRevision:'source-2'}],['binding revision',{binding:{revision:'binding-2'}}],['manifest',{manifestFingerprint:'b'.repeat(64)}]] as const){
    await t.test('mismatched '+name+' stops before business SQL',async()=>{let calls=0;await assert.rejects(run('A',['A'],edits,'tickets.read',async()=>{calls++;}),denied);assert.equal(calls,0);});
   }
   await t.test('one microsecond difference in the persisted observation is not rounded away',async()=>{
    const match=/\.(\d{6})Z$/.exec(asOf)!;const fraction=Number(match[1]);const changed=asOf.replace(/\.\d{6}Z$/,'.'+String(fraction===999999?fraction-1:fraction+1).padStart(6,'0')+'Z');
    await assert.rejects(run('A',['A'],{asOf:changed}),denied);
   });
   await t.test('a new local grant revision invalidates older provenance despite unchanged resources',async()=>{
    const old=(await admin.query("select revision::text from helpdesk_auth.cg_resource_grant_sets where workspace_id=$1 and binding_id=$2 and operation='tickets.read'",[w,binding])).rows[0]?.revision;
    await changeGrant('revision=revision+1');try{assert.equal((await visible()).rows.length,1);await assert.rejects(run(),denied);}finally{await changeGrant('revision='+String(old));}
   });
   await t.test('same grant number with altered source metadata is not the recorded observation',async()=>{
    await changeGrant("source_revision='source-2'");try{assert.equal((await visible()).rows.length,1);await assert.rejects(run(),denied);}finally{await changeGrant("source_revision='source-1'");}
   });
   await t.test('source change while awaiting a pool connection is detected by the SQL store',async()=>{
    const wrapped:SqlPool={...pool,connect:async()=>{await changeGrant("source_revision='source-2'");return pool.connect();},query:(s,v)=>pool.query(s,v),end:async()=>{}};
    try{await assert.rejects(run('A',['A'],{},'tickets.read',undefined,wrapped),denied);}finally{await changeGrant("source_revision='source-1'");}
   });
   await t.test('observation table is private and its history cannot be rewritten',async()=>{
    await assert.rejects(runTransaction(pool,p,c=>c.query('select * from helpdesk_auth.cg_resource_observations')),{code:'42501'});
    await assert.rejects(admin.query("update helpdesk_auth.cg_resource_observations set binding_revision='changed' where workspace_id=$1",[w]),{code:'23514'});
    const flags=(await admin.query("select relrowsecurity,relforcerowsecurity from pg_class where oid='helpdesk_auth.cg_resource_observations'::regclass")).rows[0];assert.deepEqual(flags,{relrowsecurity:true,relforcerowsecurity:true});
   });
   await t.test('scope helper returns no metadata for C or an unsupported operation',async()=>{
    for(const [id,op] of [[tickets.C,'tickets.read'],[tickets.A,'contexts.resolve']]){
     const rows=await runTransaction(pool,p,c=>c.query('select helpdesk_auth.cg_lock_ticket_scope($1,$2) as scope',[id,op]));assert.deepEqual(rows.rows,[{scope:null}]);
    }
   });
   await t.test('a provenance insert with wrong source metadata is refused, not silently approved',async()=>{
    await assert.rejects(admin.query(`insert into helpdesk_auth.cg_resource_observations(workspace_id,account_id,binding_id,principal_id,operation,grant_revision,binding_revision,access_revision,manifest_fingerprint,as_of,expires_at,expected_count)
     select workspace_id,account_id,binding_id,principal_id,operation,revision,'binding-1','wrong-source',$3,as_of,expires_at,expected_count from helpdesk_auth.cg_resource_grant_sets where workspace_id=$1 and binding_id=$2 and operation='tickets.write'`,[w,binding,manifest]),{code:'23514'});
   });
   await t.test('database locks prevent observation invalidation until the authorized transaction ends',async()=>{
    await run('A',['A'],{},'tickets.read',async()=>{
     const writer=await admin.connect();try{await writer.query('BEGIN');await writer.query("set local lock_timeout='200ms'");
      await assert.rejects(writer.query("update helpdesk_auth.cg_resource_grant_sets set source_revision='source-2' where workspace_id=$1 and binding_id=$2 and operation='tickets.read'",[w,binding]),{code:'55P03'});
     }finally{await writer.query('ROLLBACK');writer.release();}return true;
    });
    await changeGrant("source_revision='source-2'");try{await assert.rejects(run(),denied);}finally{await changeGrant("source_revision='source-1'");}
   });
  }finally{await pool.end();}
 });
}
