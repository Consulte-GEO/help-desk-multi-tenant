import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import type {SqlPool} from '../../src/infrastructure/sql.ts';
import {planConsulteGeoInitialOperation} from '../../src/application/consultegeo-initial-operation.ts';
import {planNotificationTemplatePublication} from '../../src/application/notification-template-publication.ts';
import {buildNotificationTemplatePublicationSql} from '../../src/infrastructure/notification-template-publication-sql.ts';
import {assertDatabaseSecurity,assertSafeDatabaseRole} from '../../src/infrastructure/postgres.ts';
export function registerNotificationPublicationSqlTests(operatorPool:()=>SqlPool,controlPool:()=>SqlPool,appPool:()=>SqlPool){
 test('wave1 publication uses a genuine operator and commits templates routes and receipt atomically',async suite=>{
  const operator=operatorPool(),control=controlPool(),app=appPool();
  assert.equal((await control.query('select current_database() db')).rows[0]?.db,'helpdesk_test');
  const createdAuth=!(await control.query("select to_regclass('auth.users') users")).rows[0]?.users;
  if(createdAuth){await control.query('create schema if not exists auth');await control.query('create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz)');}
  const usage=(await control.query("select has_schema_privilege('helpdesk_operator','auth','USAGE') ok")).rows[0]?.ok;
  const select=(await control.query("select has_table_privilege('helpdesk_operator','auth.users','SELECT') ok")).rows[0]?.ok;
  await control.query('grant usage on schema auth to helpdesk_operator');await control.query('grant select on auth.users to helpdesk_operator');
  const snapshot=async()=>Promise.all(['helpdesk_integration.hdn_notification_templates','helpdesk_integration.hdn_notification_routes','helpdesk_audit.audit_events'].map(async table=>({table,rows:(await control.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) rows from ${table} t`)).rows[0]?.rows})));
  const refuses=async(sql:string,code:string,pool=operator)=>{const before=await snapshot();try{await assert.rejects(()=>pool.query(sql.replace('\nCOMMIT;','')), {code});}finally{await pool.query('ROLLBACK');assert.deepEqual(await snapshot(),before);}};
  const w=randomUUID(),who=randomUUID(),user=randomUUID(),email='wave1-'+user+'@example.invalid';
  try{
   await operator.query("insert into helpdesk_core.workspaces(id,name) values($1,'Owned wave1 qualification')",[w]);
   await operator.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[who,user]);
   await operator.query("insert into helpdesk_auth.workspace_memberships(workspace_id,principal_id,role) values($1,$2,'admin')",[w,who]);
   await control.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,clock_timestamp())',[user,email]);
   await operator.query("select helpdesk_auth.set_human_scopes($1,$2,array['contexts:resolve','tickets:read','tickets:write','notes:read','notes:write'],0,'Owned wave1 scope qualification',$3)",[w,who,randomUUID()]);
   const initial=planConsulteGeoInitialOperation({workspaceId:w,administratorId:who,administratorEmail:email,requestId:randomUUID(),accountId:randomUUID(),accountName:'Owned wave1 client',workId:randomUUID(),workName:'Owned wave1 work',productId:randomUUID(),productInstanceId:randomUUID(),connectionId:randomUUID(),bindingId:randomUUID(),contractId:randomUUID(),contractVersionId:randomUUID(),configurationIds:[randomUUID(),randomUUID(),randomUUID()],coverageIds:[randomUUID(),randomUUID(),randomUUID()],calendar:{startDate:new Date(Date.now()-86400000).toISOString().slice(0,10),endDate:new Date(Date.now()+180*86400000).toISOString().slice(0,10),holidays:[]},reason:'Owned initial operation for wave1 qualification'});
   await operator.query(initial.sql,[...initial.values]);
   const expectedRoutes=(await operator.query("select r.kind,r.revision,r.template_id as \"templateId\",r.template_version as \"templateVersion\",t.sha256 as \"templateHash\" from helpdesk_integration.hdn_notification_routes r join helpdesk_integration.hdn_notification_templates t on t.id=r.template_id and t.version=r.template_version where r.workspace_id=$1 order by r.kind",[w])).rows;
   const input={workspaceId:w,administratorId:who,administratorEmail:email,operatorName:'helpdesk_operator',requestId:randomUUID(),reason:'Owned authorized publication of three v2 templates',expectedRoutes};
   const plan=planNotificationTemplatePublication(input),sql=buildNotificationTemplatePublicationSql(plan),before=await snapshot();
   await suite.test('application identity cannot publish or partially insert templates',()=>refuses(sql,'42501',app));
   await suite.test('operator identity must match the bound actual session',()=>refuses(buildNotificationTemplatePublicationSql(planNotificationTemplatePublication({...input,operatorName:'other_operator'})),'HNP01'));
   await suite.test('unverified administrator cannot sponsor a publication',async()=>{await control.query('update auth.users set email_confirmed_at=null where id=$1',[user]);try{await refuses(sql,'HNP01');}finally{await control.query('update auth.users set email_confirmed_at=clock_timestamp() where id=$1',[user]);}});
   await suite.test('changed current route refuses all replacements',async()=>{await operator.query("insert into helpdesk_integration.hdn_notification_routes select workspace_id,kind,2,audience,template_id,template_version,expires_at from helpdesk_integration.hdn_notification_routes where workspace_id=$1 and kind='support.created'",[w]);try{await refuses(sql,'HNP03');}finally{await control.query('alter table helpdesk_integration.hdn_notification_routes disable trigger user');try{await control.query("delete from helpdesk_integration.hdn_notification_routes where workspace_id=$1 and kind='support.created' and revision=2",[w]);}finally{await control.query('alter table helpdesk_integration.hdn_notification_routes enable trigger user');}}});
   for(const mode of ['suppress','failure'])await suite.test('late receipt '+mode+' rolls back all three new versions and routes',async()=>{
    await operator.query(`create function helpdesk_auth.wave1_fault_probe() returns trigger language plpgsql set search_path='' as $$begin if NEW.id::text=TG_ARGV[0] then ${mode==='suppress'?'return null;':"raise exception 'Owned late receipt failure' using errcode='P0001';"}end if;return NEW;end$$`);
    try{await operator.query(`create trigger wave1_fault_probe before insert on helpdesk_audit.audit_events for each row execute function helpdesk_auth.wave1_fault_probe('${input.requestId}')`);try{await refuses(sql,mode==='suppress'?'HNP04':'P0001');}finally{await operator.query('drop trigger wave1_fault_probe on helpdesk_audit.audit_events');}}finally{await operator.query('drop function helpdesk_auth.wave1_fault_probe()');}
   });
   assert.deepEqual(await snapshot(),before);
   await suite.test('publication appends exactly three v2 templates and routes while keeping v1 unchanged',async()=>{
    await operator.query(sql);const rows=(await operator.query('select kind,revision,template_version from helpdesk_integration.hdn_notification_routes where workspace_id=$1 and revision=2 order by kind',[w])).rows;
    assert.equal(rows.length,3);assert.ok(rows.every(r=>r.template_version===2));
    const saved=before[0]!.rows as any[];for(const t of saved)assert.deepEqual((await operator.query('select to_jsonb(t) row from helpdesk_integration.hdn_notification_templates t where id=$1 and version=$2',[t.id,t.version])).rows[0]?.row,t);
    const receipt=(await operator.query('select action,principal_id,request_id from helpdesk_audit.audit_events where workspace_id=$1 and id=$2',[w,input.requestId])).rows[0];assert.deepEqual(receipt,{action:'notification.templates_published',principal_id:who,request_id:'helpdesk_operator:'+plan.values[1]});
   });
   await suite.test('identical replay has no new effects and conflicting request refuses',async()=>{const saved=await snapshot();await operator.query(sql);assert.deepEqual(await snapshot(),saved);await refuses(buildNotificationTemplatePublicationSql(planNotificationTemplatePublication({...input,reason:'Owned different approval under same request'})),'HNP02');});
   await suite.test('a later route is never overwritten by replay of the earlier publication',async()=>{await operator.query("insert into helpdesk_integration.hdn_notification_routes select workspace_id,kind,3,'none',null,null,expires_at from helpdesk_integration.hdn_notification_routes where workspace_id=$1 and kind='support.created' and revision=2",[w]);const saved=await snapshot();await operator.query(sql);assert.deepEqual(await snapshot(),saved);});
   await assertSafeDatabaseRole(app);await assertDatabaseSecurity(app);
  }finally{if(!select)await control.query('revoke select on auth.users from helpdesk_operator');if(!usage)await control.query('revoke usage on schema auth from helpdesk_operator');if(createdAuth)await control.query('drop table auth.users');else await control.query('delete from auth.users where id=$1',[user]);}
 });
}
