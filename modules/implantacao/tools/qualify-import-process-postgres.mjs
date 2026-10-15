#!/usr/bin/env node
/** Qualification ONLY. Creates its own PostgreSQL 17 cluster on a private local
 * Unix socket. No URL, remote host, credentials, existing database or production
 * project can be supplied. Does not install dependencies or run hosted migrations.
 * Missing requirements => exit 2 + postgresqlExecuted:false, NEVER a green skip. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {createImportProcessService} from '../modules/import-process/service.ts';
import {createPostgresProcessRepository} from '../modules/import-process/postgres.ts';
import {createHostedImportProcess} from '../modules/import-process/hosted.ts';
import {qualifyImportStorage} from './import-storage-native.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function parseArguments(args){
 const o={execute:false,production:false,pgBin:null,driver:null,output:null},seen=new Set();
 for(let i=0;i<args.length;i++){
  const arg=args[i];if(seen.has(arg))throw Error('DUPLICATE_ARGUMENT');seen.add(arg);
  if(arg==='--execute'){o.execute=true;continue;}
  if(arg==='--production'){o.production=true;continue;}
  const key={'--pg-bin':'pgBin','--driver':'driver','--output':'output'}[arg];
  if(!key||!args[i+1]||args[i+1].startsWith('--'))throw Error('INVALID_ARGUMENT');
  const value=args[++i];if(!path.isAbsolute(value)||/[\0\r\n]/.test(value)||value.includes('://'))throw Error('INVALID_LOCAL_PATH');o[key]=value;
 }
 return o;
}
export function prerequisites(o){
 const blockers=[];
 if(!o.execute)blockers.push('EXPLICIT_EXECUTION_REQUIRED');
 if(process.platform==='win32')blockers.push('LINUX_OR_UNIX_RUNNER_REQUIRED');
 if(process.getuid?.()===0)blockers.push('NON_ROOT_OS_USER_REQUIRED');
 if(!o.pgBin||!['initdb','postgres','pg_ctl'].every(n=>fs.existsSync(path.join(o.pgBin,n))))blockers.push('LOCAL_PG_BINARIES_REQUIRED');
 if(!o.driver||!fs.existsSync(path.join(o.driver,'package.json')))blockers.push('LOCAL_NODE_PG_DRIVER_REQUIRED');
 if(!o.output)blockers.push('EVIDENCE_DIRECTORY_REQUIRED');
 else if(fs.existsSync(o.output))blockers.push('FRESH_EVIDENCE_DIRECTORY_REQUIRED');
 return blockers;
}
export async function finalizeCluster({startAttempted,stop,remove}){
 try{if(startAttempted)await stop();await remove();return true;}catch{return false;}
}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const empty=()=>({schemaVersion:'1',records:[],decisions:[],findings:[],artifactIds:[]});
function scoped(s,pool,fn){return pool.connect().then(async c=>{try{
 await c.query('BEGIN');await c.query("SELECT set_config('setup_import.workspace_id',$1,true),set_config('setup_import.account_id',$2,true),set_config('setup_import.case_id',$3,true),set_config('setup_import.actor_id',$4,true),set_config('setup_import.requester_id',$4,true)",[s.workspaceId,s.accountId,s.caseId,id(4)]);
 const result=await fn(c);await c.query('COMMIT');return result;
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release()}});}
async function execute(o){
 const blockers=prerequisites(o);if(blockers.length)return {status:'blocked',postgresqlExecuted:false,blockers,exitCode:2};
 const driverPackage=JSON.parse(fs.readFileSync(path.join(o.driver,'package.json'),'utf8'));
 if(driverPackage.name!=='pg'||typeof driverPackage.version!=='string')throw Error('INVALID_LOCAL_NODE_PG_DRIVER');
 const {Pool}=createRequire(import.meta.url)(o.driver);if(typeof Pool!=='function')throw Error('INVALID_LOCAL_NODE_PG_DRIVER');
 const version=spawnSync(path.join(o.pgBin,'postgres'),['--version'],{encoding:'utf8'});
 if(version.status!==0||!/^postgres \(PostgreSQL\) 17\./.test(version.stdout.trim()))throw Error('POSTGRESQL_17_REQUIRED');
 fs.mkdirSync(o.output,{mode:0o700});
 const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'imp02-pg17-'));fs.chmodSync(temporary,0o700);
 const data=path.join(temporary,'data'),socket=path.join(temporary,'socket');fs.mkdirSync(socket,{mode:0o700});
 const marker=path.join(temporary,'OWNED_BY_IMPORT_QUALIFIER');fs.writeFileSync(marker,'synthetic disposable database only\n',{flag:'wx'});
 const results=[];let started=false,executed=false,admin,app;const failed=[];
 const run=(bin,args)=>{const r=spawnSync(path.join(o.pgBin,bin),args,{encoding:'utf8',timeout:30000});fs.appendFileSync(path.join(o.output,'cluster-tooling.log'),`\n${bin}: exit ${r.status}\n${r.stdout||''}${r.stderr||''}`);if(r.status!==0)throw Error('LOCAL_CLUSTER_COMMAND_FAILED');};
 const test=async(name,fn)=>{try{await fn();results.push({name,status:'passed'});}catch(e){results.push({name,status:'failed',error:String(e.message).slice(0,1000)});failed.push(name);}};
 const ddlPath=path.join(root,o.production?'docs/implantacao/sql/IMP02_PROCESSOS_PRODUCTION.sql':'docs/implantacao/sql/IMP02_PROCESSOS_CANDIDATO.sql'),ddl=fs.readFileSync(ddlPath,'utf8');
 let report,storageQualification;
 try{
  run('initdb',['-D',data,'--username=imp_qualifier','--auth-local=trust','--auth-host=reject','--no-locale','--encoding=UTF8']);
  // Even a failed/timeout start can leave a running server: attempt stop before any removal.
  started=true;
  run('pg_ctl',['-D',data,'-l',path.join(o.output,'postgres.log'),'-o',`-c listen_addresses='' -c unix_socket_directories='${socket.replaceAll("'","''")}' -c port=55432`,'-w','start']);started=true;executed=true;
  const options={host:socket,port:55432,database:'postgres',user:'imp_qualifier',ssl:false,connectionTimeoutMillis:5000,max:6};
  admin=new Pool(options);await admin.query('CREATE DATABASE imp02_qualification');await admin.end();
  admin=new Pool({...options,database:'imp02_qualification'});
  await admin.query('CREATE ROLE setup_import_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOINHERIT');
  if(o.production){
   await admin.query("CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_app_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb); CREATE TABLE public.projects(id uuid PRIMARY KEY,is_active boolean NOT NULL,created_by uuid); CREATE TABLE public.project_members(project_id uuid,user_id uuid,role text); ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY; ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;");
   await admin.query('INSERT INTO auth.users VALUES ($1),($2)',[id(4),id(99)]);
  }
  const install=await admin.connect();try{await install.query("SET setup_import.candidate_install='r02-reviewed'");await install.query(ddl);}finally{install.release();}
  if(o.production)await admin.query("INSERT INTO setup_import.access_grants(workspace_id,account_id,actor_id,requester_id,role) VALUES ($1,$2,$3,$3,'requester')",[id(1),id(2),id(4)]);
  app=new Pool({...options,database:'imp02_qualification',user:'setup_import_app'});
  const makeService=pool=>createImportProcessService({repository:createPostgresProcessRepository(pool),clock:()=>new Date(),newId:()=>crypto.randomUUID(),retentionDays:90,
   authority:{resolve:async(_credential,s)=>({...s,actorId:id(4),requesterId:id(4),role:'requester',accessVersion:1,expiresAt:new Date(Date.now()+60000).toISOString()})},
   inspector:{inspect:async()=>({sha256:'a'.repeat(64),bytes:100,mime:'application/pdf',private:true,contentValidated:true,scan:'clean',objectVersion:'fixture-v1'})}});
  let service=makeService(app),serial=1000;
  const setup=async()=>{const scope={workspaceId:id(1),accountId:id(2),caseId:id(serial++),workRef:null};const command={scope,operationId:crypto.randomUUID(),expectedVersion:0,purpose:'new_work',target:{system:'qualification_fixture',contractVersion:'1'},snapshot:empty(),reason:'Synthetic PostgreSQL qualification'};const r=await service.createCase({},command);return {scope,command,r};};
  await test('catalogo: tabelas privadas, FORCE RLS, owner separado',async()=>{const r=await admin.query("SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) AS owner FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='setup_import' AND c.relkind='r'");assert.equal(r.rows.length,o.production?7:5);for(const t of r.rows){assert.equal(t.relrowsecurity,true);assert.equal(t.relforcerowsecurity,true);assert.notEqual(t.owner,'setup_import_app');}fs.writeFileSync(path.join(o.output,'catalog.json'),JSON.stringify(r.rows,null,2));});
  await test('criar e recuperar replay sem duplicar revisão/evento',async()=>{const x=await setup();const replay=await service.createCase({},x.command);assert.equal(replay.replayed,true);assert.equal(replay.hash,x.r.hash);assert.equal((await service.getCase({},x.scope)).process.version,1)});
  await test('fechar pool e reabrir preserva processo e revisão',async()=>{const x=await setup();await app.end();app=new Pool({...options,database:'imp02_qualification',user:'setup_import_app'});service=makeService(app);assert.equal((await service.getCase({},x.scope)).currentRevision.hash,x.r.hash)});
  await test('duas conexões gravando mesma versão: um vencedor',async()=>{const x=await setup();const outcomes=await Promise.allSettled([1,2].map(()=>service.saveRevision({}, {scope:x.scope,operationId:crypto.randomUUID(),expectedVersion:1,snapshot:empty(),reason:'Concurrent write'})));assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.match(outcomes.find(x=>x.status==='rejected').reason.message,/VERSION_CONFLICT/);assert.equal((await service.getCase({},x.scope)).process.version,2)});
  await test('RLS sem GUC não vê processos; SET LOCAL não vaza no pool',async()=>{await setup();assert.equal((await app.query('SELECT * FROM setup_import.cases')).rows.length,0);assert.equal((await app.query("SELECT NULLIF(current_setting('setup_import.account_id',true),'') AS account")).rows[0].account,null)});
  await test('outra conta e solicitante incorreto são isolados',async()=>{const x=await setup();await assert.rejects(service.getCase({}, {...x.scope,accountId:id(99)}),/CASE_NOT_FOUND/);await scoped(x.scope,app,async c=>{await c.query("SELECT set_config('setup_import.requester_id',$1,true)",[id(99)]);assert.equal((await c.query('SELECT * FROM setup_import.cases')).rows.length,0)})});
  await test('UPDATE/DELETE/TRUNCATE não alteram revisões e recibos',async()=>{const x=await setup();for(const table of ['revisions','receipts','events'])for(const command of [`UPDATE setup_import.${table} SET body=body`,`DELETE FROM setup_import.${table}`,`TRUNCATE setup_import.${table}`])await assert.rejects(scoped(x.scope,app,c=>c.query(command)));assert.equal((await service.getCase({},x.scope)).process.version,1)});
  await test('COMMIT sem evento/recibo é recusado e revertido',async()=>{const x=await setup();await assert.rejects(scoped(x.scope,app,c=>c.query("UPDATE setup_import.cases SET version=2,body=jsonb_set(body,'{version}','2'::jsonb) WHERE case_id=$1",[x.scope.caseId])),/MISSING_TRANSACTION_EVIDENCE/);assert.equal((await service.getCase({},x.scope)).process.version,1)});
  await test('papel administrativo não pode ser usado pelo adaptador',async()=>{const x=await setup();const unsafe=makeService(admin);await assert.rejects(unsafe.getCase({},x.scope),/UNSAFE_DATABASE_ROLE/)});
  await test('arquivo pendente é recusado; ready usa inspeção controlada',async()=>{const x=await setup(),a=await service.registerArtifact({}, {scope:x.scope,operationId:crypto.randomUUID(),expectedVersion:1,name:'synthetic.pdf',mime:'application/pdf',bytes:100,sha256:'a'.repeat(64)});const s={...empty(),artifactIds:[a.artifactId]};await assert.rejects(service.saveRevision({}, {scope:x.scope,operationId:crypto.randomUUID(),expectedVersion:2,snapshot:s,reason:'Pending file'}));await service.finalizeArtifact({}, {scope:x.scope,operationId:crypto.randomUUID(),expectedVersion:2,artifactId:a.artifactId});const r=await service.saveRevision({}, {scope:x.scope,operationId:crypto.randomUUID(),expectedVersion:3,snapshot:s,reason:'Ready fixture'});assert.equal(r.version,4)});
  await test('falha depois de INSERT revision reverte unidade inteira',async()=>{const x=await setup();const repository=createPostgresProcessRepository(app);const wrapped={transaction:(s,work)=>repository.transaction(s,tx=>work({...tx,insertEvent:async()=>{throw Error('INJECTED_TEST_FAILURE')}}))};const original=makeService(app);const failing=createImportProcessService({repository:wrapped,clock:()=>new Date(),newId:()=>crypto.randomUUID(),retentionDays:90,authority:{resolve:async(_c,s)=>({...s,actorId:id(4),requesterId:id(4),role:'requester',accessVersion:1,expiresAt:new Date(Date.now()+60000).toISOString()})},inspector:{inspect:async()=>{throw Error()}}});await assert.rejects(failing.saveRevision({}, {scope:x.scope,operationId:crypto.randomUUID(),expectedVersion:1,snapshot:empty(),reason:'Fault injection'}),/INJECTED_TEST_FAILURE/);assert.equal((await original.getCase({},x.scope)).process.version,1);const count=await admin.query('SELECT count(*)::integer AS n FROM setup_import.revisions WHERE case_id=$1',[x.scope.caseId]);assert.equal(count.rows[0].n,1)});
  if(o.production){
   const authorityPool=new Pool({...options,database:'imp02_qualification',user:'setup_import_app',max:1});
   await test('quota: pending tiny uploads reserve maximum immutable storage bytes',async()=>{
    const x=await setup();let version=1;
    for(let n=0;n<17;n++){const result=await service.registerArtifact({}, {scope:x.scope,operationId:crypto.randomUUID(),expectedVersion:version,name:'tiny.pdf',mime:'application/pdf',bytes:1,sha256:'a'.repeat(64)});version=result.version;}
    await assert.rejects(service.registerArtifact({}, {scope:x.scope,operationId:crypto.randomUUID(),expectedVersion:version,name:'eighteenth.pdf',mime:'application/pdf',bytes:1,sha256:'a'.repeat(64)}),/ARTIFACT_QUOTA/);
    const count=await admin.query('SELECT count(*)::integer AS n FROM setup_import.artifacts WHERE case_id=$1',[x.scope.caseId]);assert.equal(count.rows[0].n,17);assert.equal((await service.getCase({},x.scope)).process.version,18);
   });
   const configuration={enabled:true,origin:'https://setupobras.netlify.app',supabaseUrl:'https://yglcnirbnbwjqpvalqif.supabase.co',publishableKey:'sb_publishable_fixture',databaseUrl:'unused-local-only',databaseCa:'',retentionDays:90};
   const host=()=>createHostedImportProcess({configuration,pool:app,authorityPool,inspector:{inspect:async()=>{throw Error('UNQUALIFIED_SCANNER')}},fetch:async(_url,init)=>Response.json({id:init.headers.authorization==='Bearer other.actor'?id(99):id(4),app_metadata:{}})});
   let hosted=host();const headers={authorization:'Bearer fixture.actor',origin:configuration.origin};
   const req=(route='',init={})=>new Request(configuration.origin+'/v1/import-processes'+route,{...init,headers:{...headers,...init.headers}});
   let saved;
   try{
    await test('production host: live stored grant session, durable create, list and read',async()=>{
     const session=await hosted(req('/session'));assert.equal(session.status,200);assert.equal((await session.json()).scopes.length,1);
     const scope={workspaceId:id(1),accountId:id(2),caseId:id(serial++),workRef:null},operationId=crypto.randomUUID();
     const command={scope,operationId,expectedVersion:0,purpose:'history',target:{system:'prepared_origin',contractVersion:'pending'},snapshot:empty(),reason:'Hosted PostgreSQL fixture'};
     const created=await hosted(req('',{method:'POST',headers:{'content-type':'application/json','idempotency-key':operationId},body:JSON.stringify(command)}));assert.equal(created.status,201,await created.clone().text());saved={scope,result:await created.json()};
     hosted=host();const read=await hosted(req('/'+scope.caseId));assert.equal(read.status,200);assert.equal((await read.json()).process.headHash,saved.result.hash);
     const directory=await hosted(req());assert.equal(directory.status,200);const list=await directory.json();assert(list.cases.some(x=>x.caseId===scope.caseId));assert(list.cases.every(x=>!('snapshot' in x)&&!('requesterId' in x)));assert(list.cases.length<=100);
    });
    await test('production ACL: another authenticated user cannot list, locate or self-provision',async()=>{
     const r=await hosted(req('',{headers:{authorization:'Bearer other.actor'}}));assert.deepEqual(await r.json(),{cases:[],more:false});
     const read=await hosted(req('/'+saved.scope.caseId,{headers:{authorization:'Bearer other.actor'}}));assert.equal(read.status,404);
     await assert.rejects(scoped(saved.scope,app,c=>c.query("INSERT INTO setup_import.access_grants(workspace_id,account_id,actor_id,requester_id,role) VALUES ($1,$2,$3,$3,'requester')",[id(1),id(2),id(99)])),/permission denied/);
    });
    await test('production support admin revoked before confirmation rolls back revision',async()=>{
     await admin.query("UPDATE auth.users SET raw_app_meta_data='{\"is_admin\":true}'::jsonb WHERE id=$1",[id(99)]);
     await admin.query("INSERT INTO setup_import.access_grants(workspace_id,account_id,actor_id,requester_id,role) VALUES ($1,$2,$3,$4,'support')",[id(1),id(2),id(99),id(4)]);
     const revokingPool={async connect(){const c=await app.connect();return {release:error=>c.release(error),async query(sql,values){const result=await c.query(sql,values);if(sql.startsWith('UPDATE setup_import.cases'))await admin.query("UPDATE auth.users SET raw_app_meta_data='{}'::jsonb WHERE id=$1",[id(99)]);return result;}};}};
     const supportHost=createHostedImportProcess({configuration,pool:revokingPool,authorityPool,inspector:{inspect:async()=>{throw Error('UNQUALIFIED_SCANNER')}},fetch:async()=>Response.json({id:id(99),app_metadata:{is_admin:true}})});
     const operationId=crypto.randomUUID();const result=await supportHost(req('/'+saved.scope.caseId+'/revisions',{method:'POST',headers:{'content-type':'application/json','idempotency-key':operationId,'if-match':`"imp:${saved.scope.caseId}:1"`},body:JSON.stringify({operationId,expectedVersion:1,snapshot:empty(),reason:'Support revocation fixture'})}));
     assert.equal(result.status,403,await result.clone().text());assert.equal((await (await hosted(req('/'+saved.scope.caseId))).json()).process.version,1);
     assert.equal(Number((await admin.query('SELECT count(*) AS n FROM setup_import.revisions WHERE case_id=$1',[saved.scope.caseId])).rows[0].n),1);
     await admin.query('DELETE FROM setup_import.access_grants WHERE actor_id=$1',[id(99)]);
    });
    await test('production project source: binding requires active project and live membership',async()=>{
     await admin.query('INSERT INTO public.projects VALUES ($1,true,$2)',[id(700),id(99)]);
     await admin.query("INSERT INTO setup_import.access_grants(workspace_id,account_id,actor_id,requester_id,work_ref,project_id,role) VALUES ($1,$2,$3,$3,$4::text,$4::uuid,'requester')",[id(1),id(2),id(4),id(700)]);
     const count=async()=>((await (await hosted(req('/session'))).json()).scopes).length;
     assert.equal(await count(),1);await admin.query("INSERT INTO public.project_members VALUES($1,$2,'member')",[id(700),id(4)]);assert.equal(await count(),2);
     await admin.query('UPDATE public.projects SET is_active=false WHERE id=$1',[id(700)]);assert.equal(await count(),1);
    });
    await test('production grant revocation blocks reads and changes access version',async()=>{
     const before=(await admin.query('SELECT access_version FROM setup_import.access_grants WHERE actor_id=$1 AND work_ref IS NULL',[id(4)])).rows[0].access_version;
     await admin.query('UPDATE setup_import.access_grants SET revoked_at=clock_timestamp() WHERE actor_id=$1 AND work_ref IS NULL',[id(4)]);
     assert.equal((await hosted(req('/'+saved.scope.caseId))).status,404);
     const after=(await admin.query('SELECT access_version FROM setup_import.access_grants WHERE actor_id=$1 AND work_ref IS NULL',[id(4)])).rows[0].access_version;assert.equal(after,before+1);
    });
   }finally{await authorityPool.end();}
   storageQualification=await qualifyImportStorage({admin,app,root,test});
  }
  report={status:failed.length?'failed':'passed',postgresqlExecuted:true,productionSchema:o.production,...(storageQualification?{storageQualification}:{}),postgresVersion:version.stdout.trim(),driverVersion:driverPackage.version,ddlSha256:hash(ddl),tests:results,passed:results.length-failed.length,failed:failed.length,
   limits:['Authority and scanner are controlled test fixtures.','No real object storage or hosted environment tested.','Physical cluster restart, restore and ambiguous COMMIT socket cut require further tests.'],exitCode:failed.length?1:0};
 }catch(error){report={status:'failed',postgresqlExecuted:executed,ddlSha256:hash(ddl),tests:results,error:String(error.message).slice(0,2000),exitCode:1};}
 finally{
  await app?.end().catch(()=>{});await admin?.end().catch(()=>{});
  const removed=await finalizeCluster({startAttempted:started,stop:()=>run('pg_ctl',['-D',data,'-m','fast','-w','stop']),remove:()=>{
   if(!fs.existsSync(marker)||!path.basename(temporary).startsWith('imp02-pg17-'))throw Error('NOT_OWNED_CLUSTER');fs.rmSync(temporary,{recursive:true});
  }});
  if(!removed){report={...report,status:'failed',cleanup:'Cluster retained; manual local stop required',exitCode:1};}
 }
 fs.writeFileSync(path.join(o.output,'qualification.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const report=await execute(parseArguments(process.argv.slice(2)));console.log(JSON.stringify(report,null,2));process.exitCode=report.exitCode;}
 catch(error){console.log(JSON.stringify({status:'blocked',postgresqlExecuted:false,blockers:[String(error.message)],exitCode:2}));process.exitCode=2;}
}
