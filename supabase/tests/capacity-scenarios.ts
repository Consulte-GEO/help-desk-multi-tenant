/** Invoked only inside rls.test.ts's opted-in fresh local PostgreSQL17 setup. */
import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID,randomBytes,createHmac} from 'node:crypto';import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {validateDatabaseTestTargets} from '../../scripts/database-target.ts';import {runBoundedWorkload,summarizeCapacity,createCapacityLimiter,validateCapacityPool,type Sample} from '../../tests/performance/m1.ts';
import {HelpdeskService} from '../../src/application/helpdesk.ts';import {PostgresUnitOfWork,assertSafeDatabaseRole} from '../../src/infrastructure/postgres.ts';
import type {SqlPool,SqlClient} from '../../src/infrastructure/sql.ts';import type {Principal} from '../../src/domain/model.ts';
type Cohort=Sample['cohort'];type Actor={principal:Principal;input:{accountId:string;productInstanceId:string;serviceCode:string;subject:string;description:string;priority:'normal'}};
export function registerCapacityTests(adminPool:()=>SqlPool){
 const runId=randomUUID();
 async function fingerprint(){const moduleName='../../scripts/homologation-core.mjs';const core=await import(moduleName) as {sourceFingerprint:(root:string)=>Promise<string>};return core.sourceFingerprint(process.cwd());}
 async function fixture(){
  const {appUrl}=validateDatabaseTestTargets(process.env),admin=adminPool();
  const version=Number((await admin.query("select current_setting('server_version_num') as version")).rows[0]?.version);assert.ok(version>=170000&&version<180000);
  const moduleName='pg',driver=await import(moduleName) as {Pool:new(options:Record<string,unknown>)=>SqlPool};
  const raw=new driver.Pool({connectionString:appUrl,max:1,connectionTimeoutMillis:5000});let active=0,maxLeases=0;
  const physical=new Set<number>(),wrappers=new WeakMap<SqlClient,{client:SqlClient;leased:boolean}>();
  const pool:SqlPool={
   on:(event,listener)=>raw.on?.(event,listener),end:()=>raw.end(),
   connect:async()=>{const c=await raw.connect();let entry=wrappers.get(c);
    if(!entry){try{const pid=(await c.query('select pg_backend_pid() as pid')).rows[0]?.pid;assert.ok(Number.isInteger(pid));physical.add(Number(pid));}catch(error){c.release(error instanceof Error?error:Error('Probe failed'));throw error;}
     entry={leased:false,client:{query:(sql,values)=>c.query(sql,values),on:(event,listener)=>c.on?.(event,listener),release:error=>{assert.ok(entry!.leased);entry!.leased=false;active--;c.release(error);}}};wrappers.set(c,entry);
    }
    assert.equal(entry.leased,false);entry.leased=true;active++;maxLeases=Math.max(maxLeases,active);return entry.client;
   },
   query:async(sql,values)=>{const c=await pool.connect();try{return await c.query(sql,values);}finally{c.release();}}
  };
  try{await assertSafeDatabaseRole(pool);
   const workspaces=[randomUUID(),randomUUID()],instances:string[]=[],versions:string[]=[];
   for(const w of workspaces){const product=randomUUID(),instance=randomUUID(),contract=randomUUID(),versionId=randomUUID();instances.push(instance);versions.push(versionId);
    await admin.query("insert into helpdesk_core.workspaces(id,name) values($1,'Synthetic capacity workspace')",[w]);
    await admin.query("insert into helpdesk_core.products(workspace_id,id,code,name) values($1,$2,'CAPACITY','Synthetic product')",[w,product]);
    await admin.query("insert into helpdesk_core.product_instances(workspace_id,product_id,id,environment) values($1,$2,$3,'staging')",[w,product,instance]);
    await admin.query("insert into helpdesk_core.services(workspace_id,product_id,code,name) values($1,$2,'SUPPORT','Synthetic support')",[w,product]);
    await admin.query("insert into helpdesk_core.support_contracts(workspace_id,id,name) values($1,$2,'Synthetic capacity contract')",[w,contract]);
    await admin.query("insert into helpdesk_core.contract_versions(workspace_id,contract_id,id,version,published,valid_from,policy) values($1,$2,$3,1,true,'2020-01-01T00:00:00Z','{}')",[w,contract,versionId]);
   }
   const actors={} as Record<Cohort,Actor>;
   for(const cohort of ['busy','neighbor','other_workspace'] as const){const i=cohort==='other_workspace'?1:0,w=workspaces[i]!,account=randomUUID(),person=randomUUID(),scopes=['contexts:resolve','tickets:read','tickets:write'];
    await admin.query("insert into helpdesk_core.accounts(workspace_id,id,name) values($1,$2,'Synthetic capacity account')",[w,account]);
    await admin.query("insert into helpdesk_auth.principals(id,kind,supabase_user_id) values($1,'human',$2)",[person,randomUUID()]);
    await admin.query("insert into helpdesk_auth.account_grants(workspace_id,account_id,principal_id,role) values($1,$2,$3,'requester')",[w,account,person]);
    await admin.query('select helpdesk_auth.set_human_scopes($1,$2,$3,0,$4,$5)',[w,person,scopes,'Synthetic capacity profile only',randomUUID()]);
    await admin.query("insert into helpdesk_core.coverages(workspace_id,account_id,product_id,product_instance_id,service_code,contract_version_id,id) select $1,$2,product_id,id,'SUPPORT',$4,$5 from helpdesk_core.product_instances where workspace_id=$1 and id=$3",[w,account,instances[i],versions[i],randomUUID()]);
    actors[cohort]={principal:{id:person,workspaceId:w,kind:'human',workspaceRole:null,grants:[{accountId:account,role:'requester'}],scopes},input:{accountId:account,productInstanceId:instances[i]!,serviceCode:'SUPPORT',subject:'Capacity replay',description:'Synthetic disposable load only',priority:'normal'}};
   }
   return {admin,pool,actors,workspaces,service:new HelpdeskService(new PostgresUnitOfWork(pool)),stats:()=>({max_active_leases:maxLeases,active_leases:active,distinct_backends_observed:physical.size})};
  }catch(error){await pool.end();throw error;}
 }
 async function save(name:string,value:unknown){await mkdir('evidence/capacity',{recursive:true});const tmp='evidence/capacity/'+runId+'.tmp';await writeFile(tmp,JSON.stringify(value,null,2)+'\n');await rename(tmp,'evidence/capacity/'+name);}
 const meta=(source:string)=>({schema:1,run_id:runId,source_sha256:source,environment:'local-disposable-postgres',postgres_major:17,synthetic:true,restricted_role:'helpdesk_app',auth_provider_tested:false,hosted_capacity_tested:false,restore_tested:false,platform_approved:false});
 test('HD-P04 real PostgreSQL single-connection mixed workload measures queue, replay, isolation and complete cursor search',async()=>{
  const f=await fixture(),source=await fingerprint(),started=new Date().toISOString();try{
   const key=randomUUID(),original=await f.service.create(f.actors.busy.principal,f.actors.busy.input,key,randomUUID());const ids={} as Record<Cohort,string[]>;for(const c of ['busy','neighbor','other_workspace'] as const)ids[c]=[];
   const jobs=Array.from({length:24},(_,i)=>{const cohort:Cohort=i%6===1?'neighbor':i%6===2?'other_workspace':'busy',a=f.actors[cohort];return {cohort,operation:'create' as const,run:async()=>{const value=await f.service.create(a.principal,{...a.input,subject:'Capacity unique '+i},randomUUID(),randomUUID());ids[cohort].push(value.ticket.id);return 'ok' as const;}};});
   const replay=Array.from({length:8},()=>({cohort:'busy' as const,operation:'replay' as const,run:async()=>{const value=await f.service.create(f.actors.busy.principal,f.actors.busy.input,key,randomUUID());assert.equal(value.ticket.id,original.ticket.id);assert.equal(value.replayed,true);return 'ok' as const;}}));
   const writes=await runBoundedWorkload([...jobs,...replay],{concurrency:8});assert.ok(writes.every(s=>s.outcome==='ok'));assert.deepEqual(Object.values(ids).map(v=>v.length),[16,4,4]);
   const reads=await runBoundedWorkload(Array.from({length:12},(_,i)=>({cohort:i%3===0?'busy' as const:i%3===1?'neighbor' as const:'other_workspace' as const,operation:'read' as const,run:async()=>{if(i%3===0){assert.equal((await f.service.get(f.actors.busy.principal,ids.busy[0]!)).id,ids.busy[0]);return 'ok' as const;}await assert.rejects(f.service.get(f.actors[i%3===1?'neighbor':'other_workspace'].principal,ids.busy[0]!),{status:404});return 'denied' as const;}})),{concurrency:8});assert.equal(reads.filter(s=>s.outcome==='denied').length,8);assert.ok(reads.every(s=>s.outcome!=='error'));
   const lists=await runBoundedWorkload((['busy','neighbor','other_workspace'] as const).map(cohort=>({cohort,operation:'list' as const,run:async()=>{const seen=new Set<string>();let cursor:string|null=null,pages=0;do{const page=await f.service.list(f.actors[cohort].principal,{limit:5,cursor:cursor??undefined,q:'Capacity unique'});for(const item of page.items){assert.equal(item.accountId,f.actors[cohort].input.accountId);assert.equal(seen.has(item.id),false);seen.add(item.id);}cursor=page.nextCursor;assert.ok(++pages<=8);}while(cursor);assert.deepEqual([...seen].sort(),[...ids[cohort]].sort());return 'ok' as const;}})),{concurrency:3});assert.ok(lists.every(s=>s.outcome==='ok'));
   const counts=(await f.admin.query("select (select count(*)::int from helpdesk_core.tickets where workspace_id=any($1::uuid[])) as tickets,(select count(*)::int from helpdesk_core.ticket_events where workspace_id=any($1::uuid[]) and type='ticket.created') as events,(select count(*)::int from helpdesk_integration.outbox_events where workspace_id=any($1::uuid[]) and type='ticket.created') as outbox,(select count(*)::int from helpdesk_integration.api_idempotency_keys where workspace_id=any($1::uuid[])) as intents",[f.workspaces])).rows[0];assert.deepEqual(counts,{tickets:25,events:25,outbox:25,intents:25});
   const context=(await f.pool.query("select nullif(current_setting('app.principal_id',true),'') as actor,nullif(current_setting('app.workspace_id',true),'') as workspace")).rows[0];assert.deepEqual(context,{actor:null,workspace:null});validateCapacityPool(f.stats());
   await save('workload.json',{...meta(source),started_at:started,completed_at:new Date().toISOString(),measurement:summarizeCapacity([...writes,...reads,...lists],source,{concurrency:8,pool_max:1}),invariants:{...counts,...f.stats(),authorized_cursor_results:24,denied_cross_account_or_workspace_reads:8,context_cleared:true}});
  }finally{await f.pool.end();}
 });
 test('HD-P04 real distributed quota bursts are atomic, preserve neighbor semantics and produce only source-bound sanitized evidence',async()=>{
  const f=await fixture(),source=await fingerprint();try{
   const profiles=[];for(const policy of ['ingress','token_exchange','principal','workspace'] as const){
    // Avoid interpreting a natural minute reset as broken quota. Never alter the SQL clock/window/policy.
    let window=(await f.admin.query("select floor(extract(epoch from clock_timestamp())/60)::bigint::text as minute,60-mod(extract(epoch from clock_timestamp()),60) as remaining")).rows[0]!;
    if(Number(window.remaining)<15){await new Promise(r=>setTimeout(r,(Number(window.remaining)+.1)*1000));window=(await f.admin.query("select floor(extract(epoch from clock_timestamp())/60)::bigint::text as minute")).rows[0]!;}
    const secret=randomBytes(32).toString('base64url'),limiter=createCapacityLimiter(f.pool,secret),hash=(name:string,subject:unknown)=>createHmac('sha256',Buffer.from(secret,'base64url')).update(JSON.stringify(['helpdesk-rate-v1',name,subject])).digest('hex');
    const busy=f.actors.busy.principal,bucket=hash(policy,policy==='principal'?[busy.workspaceId,busy.id]:policy==='workspace'?busy.workspaceId:'192.0.2.40'),maximum=policy==='workspace'?1800:policy==='token_exchange'?10:120;
    await f.admin.query('insert into helpdesk_auth.rate_limit_buckets(policy,bucket_key,window_start,used) values($1,$2,to_timestamp($3::bigint*60),$4)',[policy,bucket,window.minute,maximum-1]);
    const samples=await runBoundedWorkload(Array.from({length:24},(_,i)=>{const cohort:Cohort=i%6===1?'neighbor':i%6===2?'other_workspace':'busy',actor=f.actors[cohort].principal;return {cohort,operation:'quota' as const,run:async()=>{try{if(policy==='ingress'||policy==='token_exchange')await limiter.beforeAuthentication(new Request(policy==='ingress'?'https://synthetic.test/v1/tickets':'https://synthetic.test/v1/workspaces'),{clientIp:cohort==='busy'?'192.0.2.40':cohort==='neighbor'?'192.0.2.41':'192.0.2.42'});else await limiter.afterAuthentication(actor);return 'ok' as const;}catch(error){const e=error as {status?:number;retryAfterSeconds?:number};if(e.status!==429)throw error;assert.ok(Number.isInteger(e.retryAfterSeconds)&&e.retryAfterSeconds!>=1&&e.retryAfterSeconds!<=60);return 'limited' as const;}}};}),{concurrency:8});
    assert.equal((await f.admin.query("select floor(extract(epoch from clock_timestamp())/60)::bigint::text as minute")).rows[0]?.minute,window.minute,'Minute rollover is inconclusive, never a false approval');
    assert.equal(samples.filter(s=>s.outcome==='error').length,0);assert.equal(samples.filter(s=>s.outcome==='ok').length,policy==='workspace'?5:9);assert.equal(samples.filter(s=>s.outcome==='limited').length,policy==='workspace'?19:15);
    assert.ok(samples.filter(s=>s.cohort==='other_workspace').every(s=>s.outcome==='ok'));if(policy!=='workspace')assert.ok(samples.filter(s=>s.cohort==='neighbor').every(s=>s.outcome==='ok'));
    assert.equal((await f.admin.query('select used from helpdesk_auth.rate_limit_buckets where policy=$1 and bucket_key=$2',[policy,bucket])).rows[0]?.used,maximum);
    if(policy==='token_exchange')assert.equal((await f.admin.query("select used from helpdesk_auth.rate_limit_buckets where policy='ingress' and bucket_key=$1",[hash('ingress','192.0.2.40')])).rows[0]?.used,1,'Denied token attempts must not partly consume ingress');
    if(policy==='principal')assert.equal((await f.admin.query("select used from helpdesk_auth.rate_limit_buckets where policy='workspace' and bucket_key=$1",[hash('workspace',busy.workspaceId)])).rows[0]?.used,5,'Denied principal attempts must not partly consume workspace');
    if(policy==='workspace'){let consumed=0;for(const cohort of ['busy','neighbor'] as const)consumed+=Number((await f.admin.query("select used from helpdesk_auth.rate_limit_buckets where policy='principal' and bucket_key=$1",[hash('principal',[f.actors[cohort].principal.workspaceId,f.actors[cohort].principal.id])])).rows[0]?.used??0);assert.equal(consumed,1,'Denied workspace attempts must not partly consume principal');}
    profiles.push({policy,fixture:'near-limit-existing-bucket',maximum,measurement:summarizeCapacity(samples,source,{concurrency:8,pool_max:1})});
   }
   const workload=JSON.parse(await readFile('evidence/capacity/workload.json','utf8'));assert.equal(workload.run_id,runId);assert.equal(workload.source_sha256,source);assert.equal(workload.platform_approved,false);validateCapacityPool(f.stats());
   await save('latest.json',{...meta(source),completed_at:new Date().toISOString(),workload,quota_profiles:profiles,invariants:f.stats(),slo_approved:false,rpo_rto_approved:false});
  }finally{await f.pool.end();}
 });
}
