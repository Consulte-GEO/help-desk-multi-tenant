/** Candidate SQL runs only when registered by the existing, opted-in fresh PG17 suite.
 * Never a hosted runner. Synthetic identities are ordinary existing Supabase humans,
 * not fabricated external identities. No top-level SQL or network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {validateDatabaseTestTargets} from '../../scripts/database-target.ts';
import {HelpdeskService} from '../../src/application/helpdesk.ts';
import {PostgresUnitOfWork,assertSafeDatabaseRole} from '../../src/infrastructure/postgres.ts';
import {runTransaction} from '../../src/infrastructure/transaction.ts';
import type {SqlPool} from '../../src/infrastructure/sql.ts';
import type {Principal} from '../../src/domain/model.ts';

export function registerResourceAccessSqlCandidateTests(adminPool:()=>SqlPool){
 test('CG03d candidate resource policies against real restricted PostgreSQL',async t=>{
  const {appUrl}=validateDatabaseTestTargets(process.env),admin=adminPool();
  const major=Number((await admin.query("select current_setting('server_version_num') as version")).rows[0]?.version);
  assert.ok(major>=170000&&major<180000);
  const moduleName='pg',driver=await import(moduleName) as {Pool:new(options:Record<string,unknown>)=>SqlPool};
  const pool=new driver.Pool({connectionString:appUrl,max:2,connectionTimeoutMillis:5000});
  try{
   await assertSafeDatabaseRole(pool);
   const w=randomUUID(),account=randomUUID(),product=randomUUID(),instance=randomUUID(),legacyProduct=randomUUID(),legacyInstance=randomUUID();
   const contract=randomUUID(),version=randomUUID();
   await admin.query("insert into helpdesk_core.workspaces(id,name) values($1,'CG03d synthetic')",[w]);
   await admin.query("insert into helpdesk_core.accounts(workspace_id,id,name) values($1,$2,'CG03d account')",[w,account]);
   for(const [p,i] of [[product,instance],[legacyProduct,legacyInstance]]){
    await admin.query("insert into helpdesk_core.products(workspace_id,id,code,name) values($1,$2,$3,'CG03d product')",[w,p,p]);
    await admin.query("insert into helpdesk_core.product_instances(workspace_id,product_id,id,environment) values($1,$2,$3,'staging')",[w,p,i]);
    await admin.query("insert into helpdesk_core.services(workspace_id,product_id,code,name) values($1,$2,'SUPPORT','Support')",[w,p]);
   }
   await admin.query("insert into helpdesk_core.support_contracts(workspace_id,id,name) values($1,$2,'CG03d contract')",[w,contract]);
   await admin.query("insert into helpdesk_core.contract_versions(workspace_id,contract_id,id,version,published,valid_from,policy) values($1,$2,$3,1,true,'2020-01-01T00:00:00Z','{}')",[w,contract,version]);
   for(const [p,i] of [[product,instance],[legacyProduct,legacyInstance]])await admin.query("insert into helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) values($1,$2,$3,$4,'SUPPORT',$5,$6)",[w,account,p,i,version,randomUUID()]);
   const people={} as Record<'requester'|'manager'|'agent'|'admin',Principal>;
   for(const name of ['requester','manager','agent','admin'] as const){
    const id=randomUUID(),role=name==='manager'?'account_manager':name==='agent'?'agent':'requester';
    await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[id,randomUUID()]);
    await admin.query('insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,$4)',[w,account,id,role]);
    if(name==='admin')await admin.query("insert into helpdesk_auth.workspace_memberships(workspace_id,principal_id,role) values($1,$2,'admin')",[w,id]);
    const scopes=['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write'];
    await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,0,$4,$5)',[w,id,scopes,'CG03d disposable fixture',randomUUID()]);
    people[name]={id,workspaceId:w,kind:'human',workspaceRole:name==='admin'?'admin':null,grants:[{accountId:account,role}],scopes};
   }
   const service=new HelpdeskService(new PostgresUnitOfWork(pool));
   const input={accountId:account,productInstanceId:instance,serviceCode:'SUPPORT',subject:'CG03d synthetic',description:'Synthetic scope fixture',priority:'normal' as const};
   const tickets={} as Record<string,string>,keys={} as Record<string,string>;
   for(const name of ['A','B','C','AB','AC','tenantB','zero','unmarked','legacy']){
    keys[name]=randomUUID();tickets[name]=(await service.create(people.requester,{...input,productInstanceId:name==='legacy'?legacyInstance:instance,subject:'CG03d '+name},keys[name]!,randomUUID())).ticket.id;
   }
   await service.addNote(people.agent,tickets.C!,'CG03d private C',randomUUID(),randomUUID());
   await service.addNote(people.agent,tickets.A!,'CG03d private A',randomUUID(),randomUUID());
   await service.addMessage(people.requester,tickets.C!,'CG03d public but scoped C',randomUUID(),randomUUID());
   const original=await admin.query('select id,version,contract_snapshot from helpdesk_core.tickets where workspace_id=$1 order by id',[w]);
   const sql=await readFile(new URL('../candidates/cg_resource_scope.sql',import.meta.url),'utf8');
   // The existing fresh-db guard and runner own this database; no DSN is accepted from a request.
   const install=await admin.connect();
   try{await install.query('BEGIN');await install.query("select set_config('app.cg03d_candidate','disposable-pg17',true)");await install.query(sql);await install.query('COMMIT');}
   catch(error){await install.query('ROLLBACK');throw error;}finally{install.release();}
   const ready=(await admin.query("select to_regclass('helpdesk_auth.cg_resource_bindings') is not null as ready")).rows[0]?.ready===true;
   const connection=randomUUID(),binding=randomUUID(),otherBinding=randomUUID();
   // During RED the exact existing application/SQL still runs. No fake denial fallback.
   // Setup is conditional only to expose the pre-implementation visibility bug, not a missing-table error.
   if(ready){
    await admin.query('insert into helpdesk_auth.cg_resource_connections(workspace_id,id,product_instance_id) values($1,$2,$3)',[w,connection,instance]);
    for(const [b,tenant] of [[binding,'tenant-A'],[otherBinding,'tenant-B']])await admin.query('insert into helpdesk_auth.cg_resource_bindings(workspace_id,account_id,id,connection_id,tenant_id) values($1,$2,$3,$4,$5)',[w,account,b,connection,tenant]);
    for(const p of Object.values(people))for(const op of ['tickets.read','tickets.write','notes.read','notes.write']){
     await admin.query("insert into helpdesk_auth.cg_resource_grant_sets(workspace_id,account_id,binding_id,principal_id,operation,source_revision,as_of,expires_at,expected_count) values($1,$2,$3,$4,$5,'synthetic-v1',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '1 hour',3)",[w,account,binding,p.id,op]);
     for(const id of ['A','B','0001'])await admin.query("insert into helpdesk_auth.cg_resource_grant_refs(workspace_id,account_id,binding_id,principal_id,operation,resource_type,resource_id) values($1,$2,$3,$4,$5,'work',$6)",[w,account,binding,p.id,op,id]);
     await admin.query('update helpdesk_auth.cg_resource_grant_sets set active=true where workspace_id=$1 and binding_id=$2 and principal_id=$3 and operation=$4',[w,binding,p.id,op]);
    }
    const sets:Record<string,string[]>={A:['A'],B:['B'],C:['C'],AB:['A','B'],AC:['A','C'],tenantB:['A'],zero:['0001']};
    for(const [name,refs] of Object.entries(sets)){
     await admin.query('insert into helpdesk_core.cg_ticket_resource_sets(workspace_id,account_id,ticket_id,binding_id,expected_count) values($1,$2,$3,$4,$5)',[w,account,tickets[name],name==='tenantB'?otherBinding:binding,refs.length]);
     for(const id of refs)await admin.query("insert into helpdesk_core.cg_ticket_resource_refs(workspace_id,account_id,ticket_id,resource_type,resource_id) values($1,$2,$3,'work',$4)",[w,account,tickets[name],id]);
     await admin.query('update helpdesk_core.cg_ticket_resource_sets set sealed=true where workspace_id=$1 and ticket_id=$2',[w,tickets[name]]);
    }
   }
   const rowsAs=(p:Principal,statement:string,values:unknown[]=[])=>runTransaction(pool,p,c=>c.query(statement,values));
   const visible=(p:Principal,id:string)=>rowsAs(p,'select id from helpdesk_core.tickets where workspace_id=$1 and id=$2',[w,id]);
   for(const role of ['manager','requester','admin'] as const)await t.test(role+' cannot SELECT owned/account work C directly',async()=>assert.deepEqual((await visible(people[role],tickets.C!)).rows,[]));
   await t.test('complete A+B visible, partial A+C entirely denied',async()=>{
    assert.equal((await visible(people.manager,tickets.AB!)).rows.length,1);
    assert.deepEqual((await visible(people.manager,tickets.AC!)).rows,[]);
   });
   await t.test('same source ID in another tenant remains inaccessible',async()=>assert.deepEqual((await visible(people.manager,tickets.tenantB!)).rows,[]));
   await t.test('unmarked protected ticket is not a global-access fallback',async()=>assert.deepEqual((await visible(people.manager,tickets.unmarked!)).rows,[]));
   await t.test('existing unprotected product and snapshots survive candidate installation',async()=>{
    assert.equal((await visible(people.requester,tickets.legacy!)).rows.length,1);
    assert.deepEqual((await admin.query('select id,version,contract_snapshot from helpdesk_core.tickets where workspace_id=$1 order by id',[w])).rows,original.rows);
   });
   await t.test('ACL is applied before aggregate and LIMIT, with source zeroes preserved',async()=>{
    const expected=['A','B','AB','zero','legacy'].map(n=>tickets[n]).sort();
    assert.deepEqual((await rowsAs(people.manager,'select id from helpdesk_core.tickets where workspace_id=$1 order by id',[w])).rows.map(r=>r.id).sort(),expected);
    assert.equal((await rowsAs(people.manager,'select count(*)::int as total from helpdesk_core.tickets where workspace_id=$1',[w])).rows[0]?.total,5);
    assert.equal((await rowsAs(people.manager,'select id from helpdesk_core.tickets where workspace_id=$1 order by (id=$2) desc,id limit 1',[w,tickets.C])).rows[0]?.id===tickets.C,false);
   });
   await t.test('public messages and private notes of C cannot bypass the parent ACL',async()=>{
    for(const table of ['ticket_messages','internal_notes','ticket_events'])assert.deepEqual((await rowsAs(people.agent,'select id from helpdesk_core.'+table+' where workspace_id=$1 and ticket_id=$2',[w,tickets.C])).rows,[]);
   });
   await t.test('idempotency helper cannot disclose the cached C receipt',async()=>{
    const r=await rowsAs(people.requester,"select helpdesk_auth.lookup_idempotency('tickets.create',$1) as receipt",[keys.C]);assert.deepEqual(r.rows[0]?.receipt,{denied:true});
   });
   await t.test('application GET also denies C, and authorized A still works',async()=>{
    await assert.rejects(service.get(people.manager,tickets.C!),{status:404});
    assert.equal((await service.get(people.manager,tickets.A!)).id,tickets.A);
   });
   if(!ready){await t.test('candidate schema was installed',()=>assert.equal(ready,true));return;}
   await t.test('request role cannot alter or read the private source-grant tables',async()=>{
    for(const table of ['cg_resource_connections','cg_resource_bindings','cg_resource_grant_sets','cg_resource_grant_refs'])await assert.rejects(rowsAs(people.admin,'select * from helpdesk_auth.'+table),{code:'42501'});
    await assert.rejects(rowsAs(people.admin,"update helpdesk_auth.cg_resource_grant_sets set active=true"),{code:'42501'});
   });
   await t.test('all six candidate tables FORCE RLS and helpers deny PUBLIC execute',async()=>{
    const r=await admin.query("select c.relname,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('helpdesk_core','helpdesk_auth') and c.relname like 'cg_%' and c.relkind='r'");
    assert.equal(r.rows.length,6);assert.ok(r.rows.every(v=>v.relrowsecurity&&v.relforcerowsecurity));
    assert.equal((await admin.query("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where n.nspname in ('helpdesk_core','helpdesk_auth') and p.proname like 'cg_%' and a.grantee=0 and a.privilege_type='EXECUTE'")).rows.length,0);
   });
   await t.test('missing/expired/unpublished grant never becomes all-resource permission',async()=>{
    for(const condition of ["active=false","expires_at=clock_timestamp()-interval '1 second'","expected_count=4"]){
     const c=await admin.connect();try{await c.query('BEGIN');
      await c.query('update helpdesk_auth.cg_resource_grant_sets set '+condition+' where workspace_id=$1 and principal_id=$2 and operation=$3',[w,people.manager.id,'tickets.read']);
      await c.query('COMMIT');assert.deepEqual((await visible(people.manager,tickets.A!)).rows,[]);
     }finally{c.release();await admin.query("update helpdesk_auth.cg_resource_grant_sets set active=true,expires_at=clock_timestamp()+interval '1 hour',expected_count=3 where workspace_id=$1 and principal_id=$2 and operation='tickets.read'",[w,people.manager.id]);}
    }
   });
   await t.test('revoked binding remains restrictive rather than reverting to legacy',async()=>{
    await admin.query('update helpdesk_auth.cg_resource_bindings set active=false where id=$1',[binding]);
    try{assert.deepEqual((await visible(people.manager,tickets.A!)).rows,[]);assert.equal((await visible(people.manager,tickets.legacy!)).rows.length,1);}
    finally{await admin.query('update helpdesk_auth.cg_resource_bindings set active=true where id=$1',[binding]);}
   });
   await t.test('direct mutation of C changes no rows and note INSERT cannot bypass it',async()=>{
    assert.equal((await rowsAs(people.agent,"update helpdesk_core.tickets set priority='high',version=version+1,updated_at=clock_timestamp() where workspace_id=$1 and id=$2",[w,tickets.C])).rowCount,0);
    await assert.rejects(service.addNote(people.agent,tickets.C!,'Must not persist',randomUUID(),randomUUID()),{status:404});
   });
   await t.test('authorized notes-only writer keeps its own receipt but not the notes collection',async()=>{
    const current=await admin.query('select revision from helpdesk_auth.human_scope_versions where workspace_id=$1 and principal_id=$2',[w,people.agent.id]);
    const limited=['tickets:read','notes:write'];
    await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,$4,$5,$6)',[w,people.agent.id,limited,current.rows[0]?.revision,'CG03d notes-only fixture',randomUUID()]);
    const p={...people.agent,scopes:limited},key=randomUUID();
    const result=await service.addNote(p,tickets.A!,'Authorized own receipt',key,randomUUID());assert.ok(result);
    assert.deepEqual((await rowsAs(p,'select id from helpdesk_core.internal_notes where workspace_id=$1 and ticket_id=$2',[w,tickets.A])).rows,[]);
    const receipt=(await rowsAs(p,'select helpdesk_auth.lookup_idempotency($1,$2) as receipt',['notes.create:'+tickets.A,key])).rows[0]?.receipt as {denied?:boolean;result?:unknown};
    assert.equal(receipt.denied,undefined);assert.ok(receipt.result);
   });
   await t.test('source child edit invalidates the entire grant snapshot',async()=>{
    await admin.query("delete from helpdesk_auth.cg_resource_grant_refs where workspace_id=$1 and principal_id=$2 and operation='tickets.read' and resource_id='B'",[w,people.requester.id]);
    assert.deepEqual((await visible(people.requester,tickets.A!)).rows,[]);
   });
   await t.test('published ticket references are immutable and cannot lose C silently',async()=>{
    await assert.rejects(admin.query("delete from helpdesk_core.cg_ticket_resource_refs where workspace_id=$1 and ticket_id=$2 and resource_id='C'",[w,tickets.AC]),{code:'23514'});
    assert.deepEqual((await visible(people.manager,tickets.AC!)).rows,[]);
   });
   await t.test('an in-flight authorized read serializes against a local grant revocation',async()=>{
    const read=await pool.connect(),writer=await admin.connect();
    try{
     await read.query('BEGIN');await read.query("select set_config('app.workspace_id',$1,true),set_config('app.principal_id',$2,true)",[w,people.manager.id]);
     assert.equal((await read.query('select id from helpdesk_core.tickets where workspace_id=$1 and id=$2',[w,tickets.A])).rows.length,1);
     await writer.query('BEGIN');await writer.query("set local lock_timeout='200ms'");
     await assert.rejects(writer.query("update helpdesk_auth.cg_resource_grant_sets set active=false where workspace_id=$1 and principal_id=$2 and operation='tickets.read'",[w,people.manager.id]),{code:'55P03'});
     await writer.query('ROLLBACK');await read.query('COMMIT');
     await writer.query("update helpdesk_auth.cg_resource_grant_sets set active=false where workspace_id=$1 and principal_id=$2 and operation='tickets.read'",[w,people.manager.id]);
     assert.deepEqual((await visible(people.manager,tickets.A!)).rows,[]);
    }finally{await read.query('ROLLBACK');await writer.query('ROLLBACK');read.release();writer.release();}
   });
  }finally{await pool.end();}
 });
}
