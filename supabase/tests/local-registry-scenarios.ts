/** Candidate qualification in the owned disposable PG17 runner only. No hosted data. */
import test,{type TestContext} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {planConsulteGeoLocalProvisioning} from '../../src/application/consultegeo-local-provisioning.ts';
import {createPostgresLocalConsulteGeoSourcePorts} from '../../src/infrastructure/consultegeo-local-source.ts';
import {runTransaction} from '../../src/infrastructure/transaction.ts';
import type {SqlPool} from '../../src/infrastructure/sql.ts';
import type {Principal} from '../../src/domain/model.ts';
import {canonicalJson,requestHash} from '../../src/domain/canonical.ts';
import {runLocalCollectionSqlScenarios} from './local-collection-scenarios.ts';
import {installInitialOperationCandidate} from './initial-operation-scenarios.ts';
export function registerLocalRegistrySqlTests(adminPool:()=>SqlPool,appPool:()=>SqlPool){test('local registry private provisioning and native current-decision admission',async suite=>{
 const admin=adminPool();
 assert.equal((await admin.query("select current_database()='helpdesk_test' and current_setting('server_version_num')::int between 170000 and 179999 as owned")).rows[0]?.owned,true);
 await runTransaction(admin,undefined,async client=>{await client.query("select set_config('app.cg_local_candidate','disposable-pg17',true)");await client.query(await readFile(new URL('../candidates/cg_local_registry.sql',import.meta.url),'utf8'));});
 await installInitialOperationCandidate(admin);
 await runLocalRegistryScenarios(suite,admin,appPool());
 await runLocalCollectionSqlScenarios(suite,admin,appPool());
});}
export async function runLocalRegistryScenarios(suite:TestContext,admin:SqlPool,app:SqlPool){
 const w=randomUUID(),a=randomUUID(),person=randomUUID(),user=randomUUID(),product=randomUUID(),instance=randomUUID(),connection=randomUUID(),binding=randomUUID();
 await admin.query("insert into helpdesk_core.workspaces(id,name) values($1,'Disposable local registry')",[w]);
 await admin.query("insert into helpdesk_core.products(workspace_id,id,code,name) values($1,$2,'LOCAL','Disposable')",[w,product]);
 await admin.query("insert into helpdesk_core.product_instances(workspace_id,product_id,id,environment) values($1,$2,$3,'staging')",[w,product,instance]);
 await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[person,user]);
 await admin.query("insert into helpdesk_auth.workspace_memberships(workspace_id,principal_id,role) values($1,$2,'agent')",[w,person]);
 await admin.query("select helpdesk_auth.set_human_scopes($1,$2,array['contexts:resolve','tickets:read','tickets:write'],0,'Disposable permissions',$3)",[w,person,randomUUID()]);
 const declared={workspaceId:w,expectedRegistryRevision:0,requestId:randomUUID(),reason:'Disposable complete registry declaration',
  accounts:[{accountId:a,name:'Disposable declared account',productInstanceId:instance,connectionId:connection,bindingId:binding,tenantId:'0001',active:true}],
  works:[{accountId:a,id:'0001',name:'Disposable work 0001',active:true},{accountId:a,id:'A',name:'Disposable work A',active:true}],
  permissions:['tickets.read','tickets.write'].map(operation=>({accountId:a,principalId:person,role:'requester',operation,active:true,workIds:['0001','A']}))};
 const plan=()=>planConsulteGeoLocalProvisioning(declared),provision=async()=>{const p=plan();try{return (await admin.query(p.sql,[...p.values])).rows[0]!.receipt as {revision:number;commandHash:string;asOf:string;expiresAt:string;recordedBy:string};}
  catch(error){const e=error as {code?:string;where?:string;position?:string;internalPosition?:string};suite.diagnostic(JSON.stringify({fixture:'disposable-local-registry',code:e.code,where:e.where,position:e.position,internalPosition:e.internalPosition}));throw error;}};
 const p:Principal={id:person,workspaceId:w,kind:'human',workspaceRole:'agent',grants:[{accountId:a,role:'requester'}],scopes:['contexts:resolve','tickets:read','tickets:write']};
 const ports=createPostgresLocalConsulteGeoSourcePorts(app),refs=[{connectionId:connection,tenantId:'0001',type:'work',id:'0001'}];
 const access=()=>ports.authority.readAccess({principalId:person,workspaceId:w,connectionId:connection,tenantId:'0001',operation:'tickets.read',refs},new AbortController().signal) as Promise<any>;
 let first:Awaited<ReturnType<typeof provision>>;
 await suite.test('creates only explicitly declared relationship and atomic grant/publication/observation/receipt',async()=>{
  first=await provision();assert.equal(first.revision,1);assert.equal(first.commandHash,plan().values[1]);assert.equal(typeof first.recordedBy,'string');
  const envelope=await access();assert.equal(envelope.asOf,first.asOf);assert.equal(envelope.expiresAt,first.expiresAt);assert.equal(envelope.resources.length,2);
  const ctx={principalId:person,workspaceId:w,accountId:a,bindingId:binding,bindingRevision:envelope.binding.revision,accessRevision:envelope.accessRevision,manifestFingerprint:envelope.manifestFingerprint,operation:'tickets.read',asOf:envelope.asOf,expiresAt:envelope.expiresAt,refs};
  assert.deepEqual((await runTransaction(app,p,client=>client.query('select helpdesk_auth.hdni_lock_scope($1::jsonb) as scope',[ctx]))).rows[0]?.scope,ctx);
  const counts=(await admin.query(`select (select count(*)::int from helpdesk_auth.cg_resource_publication_states where workspace_id=$1) states,
   (select count(*)::int from helpdesk_auth.cg_resource_publication_ledger where workspace_id=$1) receipts,
   (select count(*)::int from helpdesk_auth.cg_resource_observations where workspace_id=$1) observations`,[w])).rows[0];assert.deepEqual(counts,{states:2,receipts:2,observations:2});
 });
 await suite.test('same request replays immutable receipt and stale CAS rolls back',async()=>{
  assert.deepEqual(await provision(),first);declared.requestId=randomUUID();await assert.rejects(provision(),{code:'PGL02'});assert.equal((await access()).accessRevision,'local:1');declared.expectedRegistryRevision=1;
 });
 await suite.test('app login, SET ROLE and client grant attempts cannot provision',async()=>{
  const value=plan();await assert.rejects(app.query(value.sql,[...value.values]),{code:'42501'});
  await assert.rejects(runTransaction(admin,undefined,async client=>{await client.query('set local role helpdesk_app');await client.query(value.sql,[...value.values]);}),{code:'42501'});
  const rows=await admin.query("select has_function_privilege('helpdesk_app','helpdesk_auth.cg_local_base_intake_scope(jsonb)','EXECUTE') as bypass");assert.equal(rows.rows[0]?.bypass,false);
 });
 await suite.test('scopes absent, integration principal or nonexistent human refuse whole declarative change',async()=>{
  const original=declared.permissions[0]!.principalId;
  const unscoped=randomUUID(),integration=randomUUID();await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2),($3,'integration',null)",[unscoped,randomUUID(),integration]);
  for(const target of [randomUUID(),unscoped,integration]){declared.permissions[0]!.principalId=target;declared.requestId=randomUUID();await assert.rejects(provision(),{code:'PGL01'});}
  declared.permissions[0]!.principalId=original;const op=declared.permissions[0]!.operation;declared.permissions[0]!.operation='notes.read';declared.permissions[0]!.role='agent';declared.permissions[1]!.role='agent';declared.requestId=randomUUID();await assert.rejects(provision());
  declared.permissions[0]!.operation=op;declared.permissions.forEach(x=>x.role='requester');assert.equal((await access()).accessRevision,'local:1');
 });
 await suite.test('a failed work declaration rolls back already staged registry and account changes',async()=>{
  const command=JSON.parse(plan().values[0]);command.works[0].name='';command.accounts[0].name='Must roll back';const json=canonicalJson(command);
  await assert.rejects(admin.query('select helpdesk_auth.cg_local_provision($1,$2)',[json,requestHash(command)]));
  assert.equal((await admin.query('select name from helpdesk_core.accounts where workspace_id=$1 and id=$2',[w,a])).rows[0]?.name,'Disposable declared account');assert.equal((await access()).accessRevision,'local:1');
 });
 await suite.test('foreign actor and namespace cannot read local picker or authority data',async()=>{
  const other=randomUUID();await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[other,randomUUID()]);await admin.query("insert into helpdesk_auth.workspace_memberships(workspace_id,principal_id,role) values($1,$2,'agent')",[w,other]);
  await admin.query("select helpdesk_auth.set_human_scopes($1,$2,array['contexts:resolve','tickets:read'],0,'Disposable foreign actor',$3)",[w,other,randomUUID()]);
  assert.equal(await ports.authority.readAccess({principalId:other,workspaceId:w,connectionId:connection,tenantId:'0001',operation:'tickets.read',refs},new AbortController().signal),null);
  assert.deepEqual(await ports.readRequestContexts({...p,id:other,grants:[]},new AbortController().signal),[]);
  assert.equal(await ports.authority.readAccess({principalId:person,workspaceId:w,connectionId:connection,tenantId:'other',operation:'tickets.read',refs:refs.map(r=>({...r,tenantId:'other'}))},new AbortController().signal),null);
 });
 await suite.test('elapsed cadence truly republishes unchanged decision with exact SQL timestamps and atomic receipt',async()=>{
  const before=await access(),count=Number((await admin.query('select count(*) as n from helpdesk_auth.cg_resource_publication_ledger where workspace_id=$1',[w])).rows[0]?.n);
  await new Promise(resolve=>setTimeout(resolve,30_100));const after=await access();assert.equal(after.accessRevision,before.accessRevision);assert.equal(after.binding.revision,before.binding.revision);assert.deepEqual(after.resources,before.resources);assert.notEqual(after.asOf,before.asOf);
  const rows=(await admin.query(`select s.snapshot->>'asOf' as source_asof,helpdesk_auth.hdn_workflow_iso(g.as_of) as grant_asof,o.as_of=g.as_of and o.expires_at=g.expires_at as observation_exact,l.receipt->>'asOf' as receipt_asof
   from helpdesk_auth.cg_resource_grant_sets g join helpdesk_auth.cg_resource_publication_states s using(workspace_id,account_id,binding_id,principal_id,operation)
   join helpdesk_auth.cg_resource_observations o on (o.workspace_id,o.account_id,o.binding_id,o.principal_id,o.operation,o.grant_revision)=(g.workspace_id,g.account_id,g.binding_id,g.principal_id,g.operation,g.revision)
   join helpdesk_auth.cg_resource_publication_ledger l on (l.workspace_id,l.account_id,l.binding_id,l.principal_id,l.operation,l.publication_key)=(s.workspace_id,s.account_id,s.binding_id,s.principal_id,s.operation,s.publication_key)
   where g.workspace_id=$1 and g.operation='tickets.read'`,[w])).rows[0];assert.deepEqual(rows,{source_asof:after.asOf,grant_asof:after.asOf,observation_exact:true,receipt_asof:after.asOf});
  assert.equal(Number((await admin.query('select count(*) as n from helpdesk_auth.cg_resource_publication_ledger where workspace_id=$1',[w])).rows[0]?.n),count+1);
 });
 await suite.test('work deactivation blocks old scope, publishes compatible empty reduced coverage and new receipt',async()=>{
  const old=await access();declared.works[0]!.active=false;declared.requestId=randomUUID();const r=await provision();declared.expectedRegistryRevision=r.revision;
  const next=await access();assert.equal(next.resources.length,1);assert.equal(next.resources[0].id,'A');
  const ctx={principalId:person,workspaceId:w,accountId:a,bindingId:binding,bindingRevision:old.binding.revision,accessRevision:old.accessRevision,manifestFingerprint:old.manifestFingerprint,operation:'tickets.read',asOf:old.asOf,expiresAt:old.expiresAt,refs};
  await assert.rejects(runTransaction(app,p,client=>client.query('select helpdesk_auth.hdni_lock_scope($1::jsonb)',[ctx])),{code:'HDI01'});
 });
 await suite.test('revocation remains denied despite historical observations; fresh reads cannot renew TTL',async()=>{
  declared.permissions.forEach(x=>x.active=false);declared.requestId=randomUUID();const r=await provision();declared.expectedRegistryRevision=r.revision;assert.equal(await access(),null);
  const saved=(await admin.query('select as_of::text,expires_at::text from helpdesk_auth.cg_resource_grant_sets where workspace_id=$1 order by operation',[w])).rows;
  await access();assert.deepEqual((await admin.query('select as_of::text,expires_at::text from helpdesk_auth.cg_resource_grant_sets where workspace_id=$1 order by operation',[w])).rows,saved);
 });
 await suite.test('current decision SHARE lock serializes operator CAS and retains atomic publication',async()=>{
  declared.works[0]!.active=true;declared.permissions.forEach(x=>x.active=true);declared.requestId=randomUUID();const r=await provision();declared.expectedRegistryRevision=r.revision;
  let unlock!:()=>void,locked!:()=>void;const ready=new Promise<void>(resolve=>locked=resolve),hold=new Promise<void>(resolve=>unlock=resolve);
  const business=runTransaction(app,p,async client=>{await client.query('select helpdesk_auth.cg_local_read_access($1,$2,$3)',[connection,'0001','tickets.read']);locked();await hold;});
  await ready;declared.works[0]!.active=false;declared.requestId=randomUUID();let settled=false;const change=provision().finally(()=>settled=true);
  try{await new Promise(resolve=>setTimeout(resolve,75));assert.equal(settled,false);}finally{unlock();}await business;const next=await change;declared.expectedRegistryRevision=next.revision;assert.equal((await access()).resources.length,1);
 });
}
