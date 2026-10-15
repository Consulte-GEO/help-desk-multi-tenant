// Independent local composition qualification. Never accepts a hosted database URL or provider credentials.
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,realpathSync,lstatSync,rmSync,mkdirSync,chmodSync,readdirSync} from 'node:fs';
import {join,resolve,dirname,basename,isAbsolute,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {createServer} from 'node:net';
import {randomBytes,createHash} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createNativePostgresRunner,configureTlsLoopbackPostgres} from './wiki-email-composition-native.mjs';
const helpdesk=realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
function localPath(value,label,directory=true){
 assert(value&&isAbsolute(value)&&!/^[/\\]{2}/.test(value)&&!value.includes('://'),`${label} requires an absolute local path.`);
 const actual=realpathSync(value),stat=lstatSync(actual);
 assert(directory?stat.isDirectory():stat.isFile(),`${label} has the wrong file type.`);
 return actual;
}
const wiki=localPath(process.env.WIKI_EMAIL_SOURCE_ROOT,'WIKI_EMAIL_SOURCE_ROOT');
assert(existsSync(join(wiki,'.git')),'WIKI_EMAIL_SOURCE_ROOT must be a local Git checkout.');
const emailMigrations=readdirSync(join(wiki,'supabase/migrations')).filter(name=>/^\d{14}_wiki_cg_contribution_email_v1\.sql$/.test(name));
assert.equal(emailMigrations.length,1,'Exactly one official Wiki contribution email migration is required.');
const emailMigration='supabase/migrations/'+emailMigrations[0];
const suffix=process.platform==='win32'?'.exe':'';
const bin=localPath(process.env.WIKI_PG_BINDIR,'WIKI_PG_BINDIR');
const openssl=localPath(process.env.WIKI_OPENSSL_BIN,'WIKI_OPENSSL_BIN',false);
for(const name of ['initdb','pg_ctl','postgres'])assert(existsSync(join(bin,name+suffix)),`Missing ${name} binary.`);
const frozen={
 'helpdesk:src/infrastructure/wiki-notification-runtime.ts':'8e1702d2f1d8b2371c9cd977805974d9d0b1d2decc3fa3a4a3672752fee43b47',
 'helpdesk:src/infrastructure/notification-runtime.ts':'ddac1f82a1322f5a07ee4bbb38e282773120fb274a0b342ec40a8072c779ef37',
 'helpdesk:netlify/functions/wiki-notification-worker.mts':'af052a59633a603c78a56d076ccfbbf4d4790d688fe5956100000d87844f9805',
 'wiki:supabase/changes/wiki_cg_contribution_email_v1.sql':'73f7e428f8326a1f30d7fe7c7c483ae39874a4ccc9d7ab414feeac21ae4246cf',
 ['wiki:'+emailMigration]:'73f7e428f8326a1f30d7fe7c7c483ae39874a4ccc9d7ab414feeac21ae4246cf'
};
const sourceBytes=new Map(),sources={};
function capture(base,file){
 const root=base==='helpdesk'?helpdesk:wiki,path=realpathSync(join(root,file));
 assert(!relative(root,path).startsWith('..')&&lstatSync(path).isFile(),'Source must remain in its local checkout.');
 const bytes=readFileSync(path),id=base+':'+file;
 sourceBytes.set(id,bytes);sources[id]=createHash('sha256').update(bytes).digest('hex');
 if(frozen[id])assert.equal(sources[id],frozen[id],`Frozen source changed: ${id}`);
}
for(const id of Object.keys(frozen)){const split=id.indexOf(':');capture(id.slice(0,split),id.slice(split+1));}
for(const file of ['supabase/tests/supabase_stub.sql','supabase/tests/wiki_cg_email.test.sql','supabase/migrations/20261013180000_wiki_cg_backend.sql','supabase/changes/wiki_cg_publication_v2.sql','supabase/changes/wiki_cg_collaboration_v1.sql'])capture('wiki',file);
for(const file of ['src/infrastructure/notification-delivery-store.ts','src/infrastructure/database-security.ts','src/integrations/notifications/resend-events.ts'])capture('helpdesk',file);
capture('helpdesk','scripts/migration-files.ts');
capture('helpdesk','supabase/migrations.manifest.json');
capture('helpdesk','supabase/tests/wiki-email-composition-native.mjs');
const tempParent=realpathSync(tmpdir());
let temp,data,cert,key;
function cleanup(){
 const actual=realpathSync(temp);
 assert.equal(dirname(actual),tempParent,'Cleanup must remain within the original temporary directory.');
 assert.equal(actual,resolve(temp));
 assert.match(basename(actual),/^wiki-email-composition-[A-Za-z0-9]+$/);
 assert(!lstatSync(temp).isSymbolicLink()&&lstatSync(temp).isDirectory());
 rmSync(actual,{recursive:true,force:false});
 assert(!existsSync(temp),'Temporary cluster cleanup failed.');
}
const env={...process.env};for(const k of Object.keys(env))if(k.startsWith('PG'))delete env[k];
const pgmod=await import(pathToFileURL(join(helpdesk,'node_modules/pg/lib/index.js')).href),pg=pgmod.default;
const {loadMigrationBundle}=await import(pathToFileURL(join(helpdesk,'scripts/migration-files.ts')).href);
const {assertNotificationWorkerDatabase,createNotificationRuntime}=await import(pathToFileURL(join(helpdesk,'src/infrastructure/notification-runtime.ts')).href);
const {assertWikiEmailDatabase,createWikiNotificationRuntime,WIKI_EMAIL_DATABASE_QUERY}=await import(pathToFileURL(join(helpdesk,'src/infrastructure/wiki-notification-runtime.ts')).href);
const bundle=await loadMigrationBundle(helpdesk);
assert.equal(bundle.schemaVersion,'0.27.0');assert.equal(bundle.migrations.length,21);
assert.equal(createHash('sha256').update(JSON.stringify(bundle.migrations.slice(0,20).map(({file,sha256})=>({file,sha256})))).digest('hex'),'019eca369064e0d69e238966eb89668c0ce0b21e67b02fa0eaee6a9ee88ca12a','Original20 migration prefix changed.');console.log('PASS original20 immutable migration fingerprints preserved');
const migrations=bundle.migrations.map(({file,sha256})=>({file,sha256}));
const socket=createServer();await new Promise((ok,no)=>{socket.once('error',no);socket.listen(0,'127.0.0.1',ok);});const port=socket.address().port;await new Promise(ok=>socket.close(ok));
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
let started=false,admin,worker,oldRuntime,newRuntime,result;
temp=mkdtempSync(join(tempParent,'wiki-email-composition-'));data=join(temp,'data');cert=join(temp,'server.crt');key=join(temp,'server.key');
const run=createNativePostgresRunner({bin,suffix,env,temp});
try{
 createNativePostgresRunner({bin:dirname(openssl),suffix:'',env,temp})(basename(openssl),['req','-x509','-newkey','rsa:2048','-noenc','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1','-days','1','-keyout',key,'-out',cert]);
 if(process.platform!=='win32')chmodSync(key,0o600);
 run('initdb',['-D',data,'--auth=trust','--no-locale','-E','UTF8','-U','wiki_composition_owner']);
 configureTlsLoopbackPostgres(data,{cert,key});
 started=true;
 run('pg_ctl',['-D',data,'-l',join(temp,'server.log'),'-o',`-h 127.0.0.1 -p ${port}`,'-w','start']);
 const ca=readFileSync(cert,'utf8'),url=`postgresql://wiki_composition_owner@127.0.0.1:${port}/postgres`;
 admin=new pg.Pool({connectionString:url,max:1,ssl:{rejectUnauthorized:true,ca}});
 assert.match((await admin.query('show server_version_num')).rows[0].server_version_num,/^17\d{4}$/,'PostgreSQL 17 is required.');
 const sqlFile=async(base,file)=>{const text=sourceBytes.get((base===wiki?'wiki':'helpdesk')+':'+file).toString('utf8').replace(/^\\set.*$/gm,'');for(const part of (file.endsWith('.test.sql')?text.split(/^(begin;|rollback;)$/gm):[text]))if(part.trim())await admin.query(part);console.log('PASS install',file);};
 await sqlFile(wiki,'supabase/tests/supabase_stub.sql');
 await admin.query('alter table auth.users add column banned_until timestamptz,add column deleted_at timestamptz;');
 for(const migration of bundle.migrations){await admin.query(migration.sql);console.log('PASS verified HelpDesk migration',migration.file);}
 const password=randomBytes(24).toString('hex');
 await admin.query(`alter role helpdesk_notification_worker login password ${quote(password)};`);
 const workerUrl=`postgresql://helpdesk_notification_worker:${password}@127.0.0.1:${port}/postgres`;
 worker=new pg.Pool({connectionString:workerUrl,max:1,ssl:{rejectUnauthorized:true,ca}});
 const tls=(await worker.query('select session_user,current_user,ssl,version from pg_stat_ssl where pid=pg_backend_pid()')).rows[0];
 assert.equal(tls.session_user,'helpdesk_notification_worker');assert.equal(tls.current_user,'helpdesk_notification_worker');assert.equal(tls.ssl,true);assert.match(tls.version,/^TLSv1\.[23]$/);
 await assertNotificationWorkerDatabase(worker);console.log('PASS original 4-schema/13-helper guard before Wiki, genuine restricted login + verified TLS');
 const catalogSQL=`select jsonb_build_object(
 'relations',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relkind,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')),
 'functions',(select jsonb_agg(jsonb_build_array(p.oid::regprocedure::text,p.proowner,p.proacl::text,p.proconfig,p.prosrc) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit')),
 'worker',(select to_jsonb(r)-'rolpassword' from pg_roles r where rolname='helpdesk_notification_worker'),
 'memberships',(select coalesce(jsonb_agg(to_jsonb(m) order by roleid,member),'[]') from pg_auth_members m),
 'helpers',(select jsonb_agg(p.oid::regprocedure::text order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('helpdesk_auth','helpdesk_core','helpdesk_integration','helpdesk_audit') and has_function_privilege('helpdesk_notification_worker',p.oid,'EXECUTE'))) value`;
 const before=(await admin.query(catalogSQL)).rows[0].value;
 await assert.rejects(assertWikiEmailDatabase(worker),{code:'wiki_notification_database_unqualified'});
 for(const file of ['supabase/migrations/20261013180000_wiki_cg_backend.sql','supabase/changes/wiki_cg_publication_v2.sql','supabase/changes/wiki_cg_collaboration_v1.sql','supabase/changes/wiki_cg_contribution_email_v1.sql'])await sqlFile(wiki,file);
 const after=(await admin.query(catalogSQL)).rows[0].value;assert.deepEqual(after,before);assert.equal(after.helpers.length,13);
 console.log('PASS Wiki email installation preserved every HelpDesk relation/function/ACL/role/membership and all 13 helpers');
 await assertNotificationWorkerDatabase(worker);await assertWikiEmailDatabase(worker);
 console.log('PASS both production database attestations on the same native PostgreSQL TLS connection');
 // Incorrect CA and plaintext sessions must fail; no TLS bits are mocked.
 const bad=new pg.Pool({connectionString:workerUrl,max:1,ssl:{rejectUnauthorized:true}});
 try{await assert.rejects(bad.query('select 1'),error=>['DEPTH_ZERO_SELF_SIGNED_CERT','SELF_SIGNED_CERT_IN_CHAIN','UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(error.code));}finally{await bad.end();}
 const plaintext=new pg.Pool({connectionString:workerUrl,max:1,ssl:false});
 try{await assert.rejects(assertNotificationWorkerDatabase(plaintext),{code:'notification_database_unqualified'});}finally{await plaintext.end();}
 console.log('PASS untrusted certificate and genuine plaintext PostgreSQL session rejected');
 const cfg={enabled:'true',releaseApproved:'true',databaseUrl:workerUrl,databaseCa:ca,origin:'https://helpdesk.consultegeo.org',resendApiKey:'local-fixture-only',resendFrom:'Wiki <wiki@example.invalid>',senderVerified:'true'};
 let providerCalls=0;const fetch=async()=>{providerCalls++;return Response.json({id:'00000000-0000-4000-8000-000000000081'});};
 newRuntime=await createWikiNotificationRuntime(cfg,{fetch});assert.deepEqual(await newRuntime.runOnce(),{processed:0,attention:0});assert.equal(providerCalls,0);
 oldRuntime=await createNotificationRuntime(cfg,{fetch});assert.deepEqual(await oldRuntime.runOnce('local-composition'),{planned:0,processed:0,attention:0});assert.equal(providerCalls,0);
 console.log('PASS both complete runtimes initialize/run without provider work while Wiki SQL gate is false');
 // Existing independent fixtures create real local user-RPC events, never hosted tickets or emails.
 await sqlFile(wiki,'supabase/tests/wiki_cg_email.test.sql');
 await admin.query("select wiki_cg.email_configurar('10000000-0000-4000-8000-000000000002',true)");
 assert.deepEqual(await newRuntime.runOnce(),{processed:1,attention:0});assert.equal(providerCalls,1);
 assert.equal((await admin.query("select count(*)::int n from wiki_cg.colab_email_outbox where state='accepted'")).rows[0].n,1);
 await assertNotificationWorkerDatabase(worker);await assertWikiEmailDatabase(worker);
 assert.deepEqual((await admin.query(catalogSQL)).rows[0].value,before);
 console.log('PASS complete Wiki runtime commits one local provider acceptance with unchanged HelpDesk catalog/worker contract');
 for(const [id,bytes] of sourceBytes){const split=id.indexOf(':'),base=id.slice(0,split)==='helpdesk'?helpdesk:wiki;assert(readFileSync(join(base,id.slice(split+1))).equals(bytes),`Source changed during qualification: ${id}`);}
 result={format:1,qualifiedAt:new Date().toISOString(),sources,migrations,postgres:'17',helpdeskSchema:bundle.schemaVersion,verifiedMigrations:bundle.migrations.length,tls:tls.version,certificateVerified:true,sessionUser:tls.session_user,helpdeskHelpers:after.helpers.length,provider:'in-process fake; no email sent',catalogSha256:createHash('sha256').update(JSON.stringify(before)).digest('hex'),checks:9};
 console.log('PASS independent composition qualification',JSON.stringify({checks:result.checks,tls:result.tls,verifiedMigrations:result.verifiedMigrations}));
}finally{
 const closed=await Promise.allSettled([newRuntime?.close(),oldRuntime?.close(),worker?.end(),admin?.end()]);
 // Never remove a cluster if stopping it failed.
 if(started)run('pg_ctl',['-D',data,'-m','immediate','-w','stop']);
 cleanup();
 for(const value of closed)if(value.status==='rejected')throw value.reason;
 console.log('PASS disposable cluster, certificates and keys removed');
}
assert(result,'Composition did not complete.');
result.cleanupVerified=true;
const evidence=join(helpdesk,'evidence/wiki-email-v17');
mkdirSync(evidence,{recursive:true});
writeFileSync(join(evidence,'composition.json'),JSON.stringify(result,null,2)+'\n');
console.log('PASS evidence/wiki-email-v17/composition.json (source hashes only; no credentials or test keys)');
