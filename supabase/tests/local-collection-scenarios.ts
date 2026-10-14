/** Real restricted SQL qualification after the local candidate, in owned disposable PG17 only. */
import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import {randomUUID} from 'node:crypto';
import type {SqlPool} from '../../src/infrastructure/sql.ts';
import type {Principal} from '../../src/domain/model.ts';
import {HelpdeskService} from '../../src/application/helpdesk.ts';
import {PostgresUnitOfWork} from '../../src/infrastructure/postgres.ts';
import {createConfiguredConsulteGeoSource} from '../../src/infrastructure/runtime.ts';
import {createConsulteGeoRuntimeHandlers} from '../../src/infrastructure/consultegeo-runtime.ts';
import {planConsulteGeoLocalProvisioning} from '../../src/application/consultegeo-local-provisioning.ts';
export async function runLocalCollectionSqlScenarios(suite:TestContext,admin:SqlPool,app:SqlPool){
 const w=randomUUID(),mrv=randomUUID(),foreign=randomUUID(),who=randomUUID(),product=randomUUID(),instance=randomUUID(),legacyProduct=randomUUID(),legacyInstance=randomUUID(),contract=randomUUID(),version=randomUUID(),connection=randomUUID(),binding=randomUUID();
 await admin.query("insert into helpdesk_core.workspaces(id,name) values($1,'Disposable MRV collection qualification')",[w]);
 await admin.query("insert into helpdesk_core.accounts(workspace_id,id,name) values($1,$2,'MRV'),($1,$3,'Disposable foreign account')",[w,mrv,foreign]);
 for(const [p,i] of [[product,instance],[legacyProduct,legacyInstance]]){
  await admin.query("insert into helpdesk_core.products(workspace_id,id,code,name) values($1::uuid,$2::uuid,$3::text,'Disposable collection product')",[w,p,p]);
  await admin.query("insert into helpdesk_core.product_instances(workspace_id,product_id,id,environment) values($1,$2,$3,'staging')",[w,p,i]);
  await admin.query("insert into helpdesk_core.services(workspace_id,product_id,code,name) values($1,$2,'SUPPORT','Disposable support')",[w,p]);
 }
 await admin.query("insert into helpdesk_core.support_contracts(workspace_id,id,name) values($1,$2,'Disposable collection contract')",[w,contract]);await admin.query("insert into helpdesk_core.contract_versions(workspace_id,contract_id,id,version,published,valid_from,policy) values($1,$2,$3,1,true,'2020-01-01','{}')",[w,contract,version]);
 for(const [a,p,i] of [[mrv,product,instance],[foreign,product,instance],[foreign,legacyProduct,legacyInstance]])await admin.query("insert into helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) values($1,$2,$3,$4,'SUPPORT',$5,$6)",[w,a,p,i,version,randomUUID()]);
 await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[who,randomUUID()]);await admin.query("insert into helpdesk_auth.workspace_memberships(workspace_id,principal_id,role) values($1,$2,'admin')",[w,who]);
 await admin.query("insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$4,'agent'),($1,$3,$4,'agent')",[w,mrv,foreign,who]);
 const scopes=['tickets:read','tickets:write'];await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,0,$4,$5)',[w,who,scopes,'Disposable collection scope ceiling',randomUUID()]);
 const principal:Principal={id:who,workspaceId:w,kind:'human',workspaceRole:'admin',grants:[{accountId:mrv,role:'agent'},{accountId:foreign,role:'agent'}],scopes};
 let tick=Date.parse('2026-10-14T12:00:00Z');const service=new HelpdeskService(new PostgresUnitOfWork(app),()=>new Date(tick+=1000)),tickets:Record<string,string>={};
 for(const name of ['encanto1','encanto2','otherWork','foreign','legacy'])tickets[name]=(await service.create(principal,{accountId:['foreign','legacy'].includes(name)?foreign:mrv,productInstanceId:name==='legacy'?legacyInstance:instance,serviceCode:'SUPPORT',subject:'Disposable collection '+name,description:'Native fixture only',priority:'normal'},randomUUID(),randomUUID())).ticket.id;
 const declared={workspaceId:w,expectedRegistryRevision:0,requestId:randomUUID(),reason:'Disposable MRV Residencial Encanto complete decision',accounts:[{accountId:mrv,name:'MRV',productInstanceId:instance,connectionId:connection,bindingId:binding,tenantId:'mrv',active:true}],works:[{accountId:mrv,id:'encanto',name:'Residencial Encanto',active:true},{accountId:mrv,id:'other',name:'Disposable other work',active:true}],permissions:[{accountId:mrv,principalId:who,role:'agent',operation:'tickets.read',active:true,workIds:['encanto']}]};
 const provision=async()=>{const plan=planConsulteGeoLocalProvisioning(declared);const result=(await admin.query(plan.sql,[...plan.values])).rows[0]!.receipt as {revision:number};declared.expectedRegistryRevision=result.revision;declared.requestId=randomUUID();};await provision();
 for(const name of ['encanto1','encanto2','otherWork']){await admin.query('insert into helpdesk_core.cg_ticket_resource_sets(workspace_id,account_id,ticket_id,binding_id,expected_count) values($1,$2,$3,$4,1)',[w,mrv,tickets[name],binding]);await admin.query("insert into helpdesk_core.cg_ticket_resource_refs(workspace_id,account_id,ticket_id,resource_type,resource_id) values($1,$2,$3,'work',$4)",[w,mrv,tickets[name],name==='otherWork'?'other':'encanto']);await admin.query('update helpdesk_core.cg_ticket_resource_sets set sealed=true where workspace_id=$1 and ticket_id=$2',[w,tickets[name]]);}
 let legacyCalls=0;const runtime=createConsulteGeoRuntimeHandlers({pool:app,source:createConfiguredConsulteGeoSource('local',app),origin:'https://helpdesk.example',authentication:{authenticate:async()=>principal,withAdministrativeAssurance:async()=>{throw Error('No fake MFA');}},rateLimiter:{beforeAuthentication:async()=>{},afterAuthentication:async()=>{}},flags:{business:()=>true,workflow:()=>true,administration:()=>false,intake:()=>false},legacy:async()=>{legacyCalls++;throw Error('No collection fallback');}});
 const list=async(query='')=>{const response=await runtime(new Request('https://helpdesk.example/v1/tickets'+query));assert.equal(response.status,200);return await response.json() as {items:{id:string}[];next_cursor:string|null};};
 let cursor:string|null=null;
 await suite.test('MRV authorized work survives limit=1 despite newer foreign/work/legacy rows; read-only ceiling needs no contexts:resolve',async()=>{
  const first=await list('?limit=1');assert.deepEqual(first.items.map(x=>x.id),[tickets.encanto2]);cursor=first.next_cursor;assert.equal(typeof cursor,'string');assert.equal(legacyCalls,0);
  const next=await list('?limit=1&cursor='+encodeURIComponent(cursor!));assert.deepEqual(next.items.map(x=>x.id),[tickets.encanto1]);assert.equal(next.next_cursor,null);
 });
 await suite.test('search/account filters cannot disclose foreign namespace, unqualified legacy or ungranted work',async()=>{
  assert.deepEqual((await list('?q=foreign')).items,[]);assert.deepEqual((await list('?q=legacy')).items,[]);assert.deepEqual((await list('?q=otherWork')).items,[]);assert.deepEqual((await list('?account_id='+foreign)).items,[]);
 });
 await suite.test('work deactivation removes rows before an existing cursor or limit; prior observations remain historical',async()=>{
  declared.works[0]!.active=false;await provision();assert.deepEqual((await list('?limit=1')).items,[]);assert.deepEqual((await list('?limit=1&cursor='+encodeURIComponent(cursor!))).items,[]);
 });
 await suite.test('reactivation republished then permission revocation denies the whole current collection',async()=>{
  declared.works[0]!.active=true;await provision();assert.equal((await list()).items.length,2);declared.permissions[0]!.active=false;await provision();assert.deepEqual((await list('?limit=1')).items,[]);
 });
}
