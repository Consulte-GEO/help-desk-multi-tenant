/** Owned local PostgreSQL 17 candidate acceptance. Never selects an existing DSN.
 * Plan is the default. A successful candidate suite is NOT full-core/hosted acceptance.
 */
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,appendFileSync,readFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {randomBytes} from 'node:crypto';
import {nativeBinaryVersion,isolatedPostgresSettings,ownsRegistrationCluster,registrationNativeSourceIssues} from './registration-native-safety.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const plan={mode:'plan',executed:false,approval:false,database:'helpdesk_test',transport:'owned_unix_socket',required:['PostgreSQL 17','Linux non-root','complete Help Desk repository','pinned pg dependency'],scope:'HDA candidate with a synthetic core fixture; full historical upgrade is a separate gate'};
const report=j=>console.log(JSON.stringify(j));
const stop=code=>{report({...plan,mode:'blocked',code});process.exitCode=2;};
const args=process.argv.slice(2);
if(args.includes('--full-core'))plan.scope='HDA candidate against the complete immutable migration chain; no origin or hosted acceptance';
if(args.length>2||new Set(args).size!==args.length||args.some(x=>!['--execute','--plan','--full-core'].includes(x))||args.includes('--execute')&&args.includes('--plan'))stop('invalid_arguments');
else if(!args.includes('--execute'))report(plan);
else if(Object.keys(process.env).some(k=>/^PG[A-Z_]+$/.test(k)||/^(DATABASE_URL|SUPABASE_DB_URL|HELPDESK_DATABASE_URL|HELPDESK_TEST_(ADMIN|APP|OPERATOR)_URL|HDA_DATABASE_URL|HDA_TEST_DATABASE_URL)$/.test(k)))stop('external_database_configuration_refused');
else {
 let pg;const issues=[...registrationNativeSourceIssues(root)];
 if(process.platform!=='linux')issues.push('linux_required');
 if(process.getuid?.()===0)issues.push('non_root_required');
 const [major,minor]=process.versions.node.split('.').map(Number);
 if(major<22||major>24||(major===22&&minor<16))issues.push('supported_node_version_required');
 if(major===22&&!process.execArgv.includes('--experimental-strip-types'))issues.push('strip_types_flag_required');
 try{pg=await import('pg');}catch{issues.push('pg_dependency_unavailable');}
 const bindir=process.env.HDA_PG_BINDIR;const binary=name=>bindir?join(resolve(bindir),name):name;
 const versionEnv={PATH:process.env.PATH,LANG:'C.UTF-8',LC_ALL:'C.UTF-8',TZ:'UTC'},versions={};
 for(const name of ['initdb','pg_ctl']){
  const r=spawnSync(binary(name),['--version'],{encoding:'utf8',env:versionEnv,timeout:5000,maxBuffer:8192});
  const version=r.status===0?nativeBinaryVersion(name,r.stdout):null;
  if(version===null)issues.push(name+'_17_unavailable');else versions[name]=version;
 }
 if(versions.initdb&&versions.pg_ctl&&versions.initdb!==versions.pg_ctl)issues.push('postgres_tool_version_mismatch');
 if(issues.length){report({...plan,mode:'blocked',code:'native_prerequisites_missing',issues:[...new Set(issues)]});process.exitCode=2;}
 else {
  const dir=mkdtempSync(join(tmpdir(),'hda02-owned-')),data=join(dir,'data'),socket=join(dir,'socket'),proof=randomBytes(32).toString('hex');
  const pools=[];let startRequested=false,started=false,summary;
  const passwords={hda_test_owner:randomBytes(32).toString('hex'),helpdesk_app:randomBytes(32).toString('hex'),helpdesk_registration_worker:randomBytes(32).toString('hex')};
  writeFileSync(join(dir,'ownership'),proof,{mode:0o600});mkdirSync(socket,{mode:0o700});mkdirSync(join(dir,'home'),{mode:0o700});
  const env={...versionEnv,HOME:join(dir,'home'),TMPDIR:dir};
  const command=(name,params)=>{
   const r=spawnSync(binary(name),params,{env,encoding:'utf8',timeout:45000,maxBuffer:2*1024*1024});
   if(r.status!==0||r.signal||r.error)throw Error('local_cluster_command_failed');
  };
  const base={host:socket,port:5432,connectionTimeoutMillis:5000,statement_timeout:10000,application_name:'hda02-owned-acceptance'};
  try{
   const settings=isolatedPostgresSettings(socket),pwfile=join(dir,'owner-password');
   writeFileSync(pwfile,passwords.hda_test_owner,{mode:0o600});
   command('initdb',['-D',data,'-U','hda_test_owner','--encoding=UTF8','--locale=C.UTF-8','--auth-local=scram-sha-256','--auth-host=reject','--pwfile='+pwfile]);
   rmSync(pwfile);
   appendFileSync(join(data,'postgresql.conf'),settings);
   startRequested=true;command('pg_ctl',['-D',data,'-l',join(dir,'postgres.log'),'-w','start']);started=true;
   const Pool=pg.Pool??pg.default.Pool;
   let owner=new Pool({...base,user:'hda_test_owner',password:passwords.hda_test_owner,database:'postgres',max:2});pools.push(owner);
   const check=await owner.query("select current_database() db,current_user actor,inet_server_addr() addr,current_setting('server_version_num') v");
   if(check.rows[0].db!=='postgres'||check.rows[0].actor!=='hda_test_owner'||check.rows[0].addr!==null||Math.floor(Number(check.rows[0].v)/10000)!==17)throw Error('local_cluster_identity_mismatch');
   await owner.query('create database helpdesk_test');await owner.end();pools.pop();
   owner=new Pool({...base,user:'hda_test_owner',password:passwords.hda_test_owner,database:'helpdesk_test',max:4});pools.push(owner);
   for(const role of ['helpdesk_app','helpdesk_registration_worker'])await owner.query(`create role ${role} login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls password '${passwords[role]}'`);
   if(args.includes('--full-core')){
    const {loadMigrationBundle}=await import('./migration-files.ts');
    const bundle=await loadMigrationBundle(root);
    for(const migration of bundle.migrations)await owner.query(migration.sql);
   }else await owner.query(readFileSync(join(root,'supabase/tests/fixtures/hda02-core-local.sql'),'utf8'));
   const install=await owner.connect();
   try{await install.query("set hda02.disposable='owned-local-cluster'");await install.query(readFileSync(join(root,'supabase/candidates/hda02_analysis_persistence.sql'),'utf8'));}
   catch(e){await install.query('ROLLBACK').catch(()=>{});throw e;}finally{install.release();}
   const app=new Pool({...base,user:'helpdesk_app',password:passwords.helpdesk_app,database:'helpdesk_test',max:4});
   const worker=new Pool({...base,user:'helpdesk_registration_worker',password:passwords.helpdesk_registration_worker,database:'helpdesk_test',max:4});pools.push(app,worker);
   const {runNativeSuite}=await import(args.includes('--full-core')?'../supabase/tests/hda-full-core-suite.mjs':'../supabase/tests/hda02-native-suite.mjs');const result=await runNativeSuite({owner,app,worker});
   summary={mode:'executed',executed:true,approval:false,database:'helpdesk_test',transport:'owned_unix_socket',postgresVersion:versions.initdb,scope:plan.scope,...result};
   if(result.failures)process.exitCode=1;
  }catch(e){summary={mode:'failed',executed:started,approval:false,code:'native_acceptance_failed',sqlState:typeof e?.code==='string'&&/^[A-Z0-9]{5}$/.test(e.code)?e.code:null};process.exitCode=1;}
  finally{
   await Promise.allSettled(pools.map(p=>p.end()));
   let stopped=!startRequested,cleanup='preserved';
   if(ownsRegistrationCluster(dir,proof)){
    if(startRequested){try{command('pg_ctl',['-D',data,'-m','fast','-w','stop']);const status=spawnSync(binary('pg_ctl'),['-D',data,'status'],{env,encoding:'utf8',timeout:5000});stopped=status.status===3&&!status.error&&!status.signal;}catch{stopped=false;}}
    if(stopped&&ownsRegistrationCluster(dir,proof)){try{rmSync(dir,{recursive:true});cleanup='removed';}catch{cleanup='preserved';}}
   }
   if(cleanup!=='removed')process.exitCode=1;
   report({...summary,cleanup,...(cleanup!=='removed'?{recoveryDirectory:dir}:{})});
  }
 }
}
