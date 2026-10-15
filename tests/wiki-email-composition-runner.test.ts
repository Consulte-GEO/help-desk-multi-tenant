import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,realpathSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createNativePostgresRunner,configureTlsLoopbackPostgres} from '../supabase/tests/wiki-email-composition-native.mjs';
function removeTemp(temp:string){
 const checked=realpathSync(temp);assert.equal(dirname(checked),realpathSync(tmpdir()));assert(basename(checked).startsWith('wiki-composition-'));
 rmSync(checked,{recursive:true});
}

for(const platform of ['linux','win32'])test('composition pg_ctl preserves diagnostics without inheriting Windows child pipes: '+platform,()=>{
 const temp=mkdtempSync(join(tmpdir(),'wiki-composition-process-'));
 try{
  writeFileSync(join(temp,'server.log'),'FATAL: could not create Unix socket lock: Permission denied');
  let options:any;
  const run=createNativePostgresRunner({bin:temp,suffix:'',env:{},temp,platform,spawn:(_command:any,_args:any,input:any)=>{options=input;return {status:1,stderr:'pg_ctl: could not start server',stdout:''};}});
  assert.throws(()=>run('pg_ctl',['start']),error=>{
   assert.match((error as Error).message,/pg_ctl: could not start server/);
   assert.match((error as Error).message,/could not create Unix socket lock/);return true;
  });
  assert.equal(options.stdio,platform==='win32'?'ignore':undefined);
  assert.equal(options.windowsHide,true);
 }finally{removeTemp(temp);}
});
test('composition startup errors remain useful when no server log was created',()=>{
 const run=createNativePostgresRunner({bin:'/local',suffix:'',env:{},temp:'/missing-composition-test',spawn:()=>({status:1,stderr:'initdb fixture failure',stdout:''})});
 assert.throws(()=>run('pg_ctl',['start']),/initdb fixture failure/);
});
test('composition process success returns SQL output and keeps regular command pipes',()=>{
 let options:any;
 const run=createNativePostgresRunner({bin:'/local',suffix:'',env:{},temp:'/unused',platform:'win32',spawn:(_command:any,_args:any,input:any)=>{options=input;return {status:0,stdout:'qualified'};}});
 assert.equal(run('psql',['-X'],'select 1'),'qualified');assert.equal(options.stdio,undefined);assert.equal(options.input,'select 1');
});
test('composition failure includes only the bounded end of the local PostgreSQL log',()=>{
 const temp=mkdtempSync(join(tmpdir(),'wiki-composition-process-'));
 try{
  writeFileSync(join(temp,'server.log'),'discarded-prefix'+'.'.repeat(40000)+'FATAL: bounded diagnostic');
  const run=createNativePostgresRunner({bin:temp,suffix:'',env:{},temp,spawn:()=>({status:1,stderr:'',stdout:''})});
  assert.throws(()=>run('pg_ctl',['start']),error=>{assert.match((error as Error).message,/bounded diagnostic/);assert.doesNotMatch((error as Error).message,/discarded-prefix/);assert((error as Error).message.length<33000);return true;});
 }finally{removeTemp(temp);}
});
test('composition cluster disables packaged Unix sockets and preserves verified TLS file paths',()=>{
 const temp=mkdtempSync(join(tmpdir(),'wiki-composition-process-'));
 try{
  writeFileSync(join(temp,'postgresql.conf'),'# initial local config\n');
  configureTlsLoopbackPostgres(temp,{cert:"C:\\local test\\server's.crt",key:'C:\\local test\\server.key'});
  const config=readFileSync(join(temp,'postgresql.conf'),'utf8');
  assert.match(config,/^# initial local config/m);assert.match(config,/^unix_socket_directories = ''$/m);
  assert.match(config,/^ssl=on$/m);assert.match(config,/^ssl_cert_file='C:\/local test\/server''s.crt'$/m);assert.match(config,/^ssl_key_file='C:\/local test\/server.key'$/m);
 }finally{removeTemp(temp);}
});
for(const count of [0,2])test('composition refuses ambiguous official Wiki migrations before native tools or database: '+count,()=>{
 const temp=mkdtempSync(join(tmpdir(),'wiki-composition-discovery-'));
 try{
  mkdirSync(join(temp,'.git'));mkdirSync(join(temp,'supabase/migrations'),{recursive:true});
  if(count===2)for(const stamp of ['20261015164036','20261015174731'])writeFileSync(join(temp,'supabase/migrations',stamp+'_wiki_cg_contribution_email_v1.sql'),'synthetic-only');
  const result=spawnSync(process.execPath,['--experimental-strip-types',fileURLToPath(new URL('../supabase/tests/run-wiki-email-composition.mjs',import.meta.url))],{env:{...process.env,WIKI_EMAIL_SOURCE_ROOT:temp},encoding:'utf8',windowsHide:true});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Exactly one official Wiki contribution email migration is required/);
 }finally{removeTemp(temp);}
});
