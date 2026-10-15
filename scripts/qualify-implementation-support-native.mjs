/** Fresh owned PG17 only. No existing, hosted or caller supplied DSN accepted. */
import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,appendFileSync,readFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import {fileURLToPath} from 'node:url';import {randomBytes} from 'node:crypto';
import {nativeBinaryVersion,isolatedPostgresSettings,ownsRegistrationCluster,registrationNativeSourceIssues} from './registration-native-safety.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv.slice(2);
const plan={module:'implementation-support',executed:false,hosted:false,coreSchema:'0.26.0',coreMigrations:20,required:['Linux non-root','PostgreSQL 17','pinned pg 8.16.3','complete immutable core chain']};
if(args.length!==1||args[0]!=='--execute'){console.log(JSON.stringify({...plan,mode:args.length?'blocked':'plan',...(args.length?{code:'invalid_arguments'}:{})}));if(args.length)process.exitCode=2;}
else if(Object.keys(process.env).some(k=>/^PG[A-Z_]+$/.test(k)||/^(DATABASE_URL|SUPABASE_DB_URL|HELPDESK_DATABASE_URL|HELPDESK_TEST_(ADMIN|APP|OPERATOR)_URL|HDA_DATABASE_URL|HDA_TEST_DATABASE_URL)$/.test(k))){console.log(JSON.stringify({...plan,mode:'blocked',code:'external_database_configuration_refused'}));process.exitCode=2;}
else{
 const issues=[...registrationNativeSourceIssues(root)],versions={};let pg;
 if(process.platform!=='linux')issues.push('linux_required');if(process.getuid?.()===0)issues.push('non_root_required');
 try{pg=await import('pg');}catch{issues.push('pg_dependency_unavailable');}
 const bindir=process.env.HELPDESK_IMPLANTACAO_PG_BIN??process.env.HDA_PG_BINDIR;
 const binary=name=>bindir?join(resolve(bindir),name):name;
 const versionEnv={PATH:process.env.PATH,LANG:'C.UTF-8',LC_ALL:'C.UTF-8',TZ:'UTC'};
 for(const name of ['initdb','pg_ctl']){const r=spawnSync(binary(name),['--version'],{encoding:'utf8',env:versionEnv,timeout:5000,maxBuffer:8192});const v=r.status===0?nativeBinaryVersion(name,r.stdout):null;if(!v)issues.push(name+'_17_unavailable');else versions[name]=v;}
 if(versions.initdb&&versions.initdb!==versions.pg_ctl)issues.push('postgres_tool_version_mismatch');
 if(issues.length){console.log(JSON.stringify({...plan,mode:'blocked',issues}));process.exitCode=2;}
 else{
  const dir=mkdtempSync(join(tmpdir(),'hda02-owned-')),data=join(dir,'data'),socket=join(dir,'socket'),proof=randomBytes(32).toString('hex'),passwords={postgres:randomBytes(32).toString('hex'),helpdesk_app:randomBytes(32).toString('hex')};
  writeFileSync(join(dir,'ownership'),proof,{mode:0o600});mkdirSync(socket,{mode:0o700});mkdirSync(join(dir,'home'),{mode:0o700});
  const env={...versionEnv,HOME:join(dir,'home'),TMPDIR:dir},pools=[];let startRequested=false,summary;
  const command=(name,params)=>{const r=spawnSync(binary(name),params,{env,encoding:'utf8',timeout:45000,maxBuffer:2*1024*1024});if(r.status!==0||r.signal||r.error)throw Error('local_cluster_command_failed');};
  try{
   const pw=join(dir,'owner-password');writeFileSync(pw,passwords.postgres,{mode:0o600});
   command('initdb',['-D',data,'-U','postgres','--encoding=UTF8','--locale=C.UTF-8','--auth-local=scram-sha-256','--auth-host=reject','--pwfile='+pw]);rmSync(pw);appendFileSync(join(data,'postgresql.conf'),isolatedPostgresSettings(socket));
   startRequested=true;command('pg_ctl',['-D',data,'-l',join(dir,'postgres.log'),'-w','start']);
   const Pool=pg.Pool??pg.default.Pool,base={host:socket,port:5432,connectionTimeoutMillis:5000,statement_timeout:10000,application_name:'implantacao-owned-acceptance'};
   let owner=new Pool({...base,user:'postgres',password:passwords.postgres,database:'postgres',max:2});pools.push(owner);
   const identity=(await owner.query("select current_database() db,current_user actor,inet_server_addr() addr,current_setting('server_version_num') v")).rows[0];if(identity.db!=='postgres'||identity.actor!=='postgres'||identity.addr!==null||Math.floor(Number(identity.v)/10000)!==17)throw Error('owned_cluster_identity_mismatch');
   await owner.query('create database helpdesk_test');await owner.end();pools.pop();owner=new Pool({...base,user:'postgres',password:passwords.postgres,database:'helpdesk_test',max:4});pools.push(owner);
   await owner.query(`create role helpdesk_app login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls password '${passwords.helpdesk_app}'`);
   const {loadMigrationBundle}=await import('./migration-files.ts'),bundle=await loadMigrationBundle(root);if(bundle.schemaVersion!=='0.26.0'||bundle.migrations.length!==20)throw Error('immutable_core_026_required');
   for(const migration of bundle.migrations)await owner.query(migration.sql);
   const app=new Pool({...base,user:'helpdesk_app',password:passwords.helpdesk_app,database:'helpdesk_test',max:4});pools.push(app);
   const {assertDatabaseSecurity}=await import('../src/infrastructure/database-security.ts');await assertDatabaseSecurity(app,'0.26.0');
   await owner.query(readFileSync(join(root,'supabase/addons/implantacao/20261015180006_implementation_support_addon.sql'),'utf8'));
   await assertDatabaseSecurity(app,'0.26.0');
   const {runImplementationSupportNativeSuite}=await import('../supabase/tests/implementation-support-native-suite.mjs');const result=await runImplementationSupportNativeSuite({owner,app});
   summary={...plan,mode:'executed',executed:true,postgresVersion:versions.initdb,...result};if(result.failures)process.exitCode=1;
  }catch(error){summary={...plan,mode:'failed',executed:startRequested,code:'native_acceptance_failed',sqlState:typeof error?.code==='string'&&/^[A-Z0-9]{5}$/.test(error.code)?error.code:null,message:typeof error?.message==='string'?error.message.replace(/postgresql:\/\/\S+/g,'[REDACTED]').slice(0,250):'unknown'};process.exitCode=1;}
  finally{
   await Promise.allSettled(pools.map(p=>p.end()));let stopped=!startRequested,cleanup='preserved';
   if(ownsRegistrationCluster(dir,proof)){if(startRequested){try{command('pg_ctl',['-D',data,'-m','fast','-w','stop']);const s=spawnSync(binary('pg_ctl'),['-D',data,'status'],{env,encoding:'utf8',timeout:5000});stopped=s.status===3&&!s.signal&&!s.error;}catch{stopped=false;}}if(stopped&&ownsRegistrationCluster(dir,proof)){try{rmSync(dir,{recursive:true});cleanup='removed';}catch{/* Keep recoverable owned directory. */}}}
   if(cleanup!=='removed')process.exitCode=1;console.log(JSON.stringify({...summary,cleanup,...(cleanup!=='removed'?{recoveryDirectory:dir}:{})}));
  }
 }
}
