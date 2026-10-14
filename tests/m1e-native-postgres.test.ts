import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,access,readdir,readFile,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,basename} from 'node:path';
async function native(){const path='../scripts/native-postgres.mjs';const m=await import(path).catch(()=>null);assert.equal(typeof m?.runNativeTests,'function');return m;}
async function f(){const base=await mkdtemp(join(tmpdir(),'helpdesk-native-fixture-')),bin=join(base,'bin');await mkdir(bin);for(const name of ['initdb','pg_ctl','psql'])await writeFile(join(bin,name),'fixture only',{mode:0o700});return {base,bin,close:()=>rm(base,{recursive:true,force:true})};}
function executor(options:{testCode?:number;failStage?:string;tamper?:boolean}={}){let running=false;const calls:any[]=[];let adminSecret='',appSecret='';
 const execute=async(o:any)=>{calls.push(o);const [cmd,...args]=o.command;let output='',exit_code=0;const name=basename(cmd);
  if(args.includes('--version'))output=name+' (PostgreSQL) 17.6';
  else if(name==='initdb'){const at=args.indexOf('-D');await mkdir(args[at+1],{recursive:true});await writeFile(join(args[at+1],'PG_VERSION'),'17\n');adminSecret=(await readFile(args.find((a:string)=>a.startsWith('--pwfile=')).split('=')[1],'utf8')).trim();if(options.failStage==='initdb')exit_code=1;}
  else if(name==='pg_ctl'){if(args.includes('start'))running=true;if(args.includes('stop')){if(options.failStage==='stop')exit_code=1;else running=false;}if(args.includes('status'))exit_code=running?0:3;}
  else if(name==='psql'&&options.failStage==='database')exit_code=1;
  else if(args.includes('--test')){appSecret=new URL(o.env.HELPDESK_TEST_APP_URL).password;output='1..60\n# tests 60\n# pass 60\n# fail 0\n# skipped 0\n# cancelled 0\n# todo 0\n'+adminSecret+' '+appSecret;
   exit_code=options.testCode??0;if(options.tamper)await writeFile(join(o.env.HOME,'..','.helpdesk-native-owner'),'foreign');}
  return {exit_code,signal:null,output,stdout:output,stderr:'',reason:null};
 };return {execute,calls,secrets:()=>[adminSecret,appSecret]};}
test('native configuration rejects relative/missing binary path, root, Windows and mixed engine',async()=>{
 const m=await native();for(const [env,platform,uid] of [[{},'linux',1000],[{HELPDESK_TEST_PG_BIN:'relative'},'linux',1000],[{HELPDESK_TEST_PG_BIN:'/opt/pg17/bin'},'linux',0],[{HELPDESK_TEST_PG_BIN:'/opt/pg17/bin'},'win32',1000],[{HELPDESK_TEST_PG_BIN:'/opt/pg17/bin',HELPDESK_TEST_DB_ENGINE:'docker'},'linux',1000]] as const)assert.throws(()=>m.nativeSettings(env,platform,uid));
});
test('native environment cannot inherit production, PG service overrides or Node preload hooks',async()=>{
 const m=await native();const env=m.nativeEnvironment({PATH:'/usr/bin',PGHOST:'prod',PGHOSTADDR:'1.1.1.1',PGSERVICE:'production',PGOPTIONS:'unsafe',PGPASSWORD:'PRIVATE',NODE_OPTIONS:'--require injected',HELPDESK_DATABASE_URL:'PRIVATE',SUPABASE_URL:'PRIVATE',HOME:'/private'},'/owned');
 assert.deepEqual(Object.keys(env).sort(),['HOME','LANG','LC_ALL','PATH','TMPDIR','TZ'].sort());assert.equal(env.HOME,'/owned/home');assert.doesNotMatch(JSON.stringify(env),/PRIVATE|production|unsafe|injected/);
});
test('native lifecycle creates its own SCRAM cluster, runs guarded suite and cleans only owned directory',async()=>{
 const m=await native(),fixture=await f(),x=executor();try{
  const r=await m.runNativeTests({env:{PATH:process.env.PATH,HELPDESK_TEST_PG_BIN:fixture.bin},platform:'linux',uid:1000,tempParent:fixture.base,execute:x.execute,checkDriver:()=>{}});
  assert.equal(r.exit_code,0);assert.equal(r.cleanup,'removed');assert.equal(r.version,'17.6');assert.equal((await readdir(fixture.base)).filter((s:string)=>s.startsWith('helpdesk-native-')).length,0);
  const init=x.calls.find(c=>basename(c.command[0])==='initdb'&&!c.command.includes('--version'));assert.ok(init.command.includes('--auth-host=scram-sha-256'));assert.ok(init.command.includes('--auth-local=scram-sha-256'));
  const start=x.calls.find(c=>c.command.includes('start'));assert.match(start.command.join(' '),/127\.0\.0\.1/);assert.match(start.command.join(' '),/unix_socket_directories/);
  const suite=x.calls.find(c=>c.command.includes('--test'));assert.equal(suite.env.ALLOW_DATABASE_TESTS,'1');assert.equal(new URL(suite.env.HELPDESK_TEST_APP_URL).hostname,'127.0.0.1');assert.equal(new URL(suite.env.HELPDESK_TEST_APP_URL).pathname,'/helpdesk_test');assert.equal(new URL(suite.env.HELPDESK_TEST_APP_URL).username,'helpdesk_app');
  for(const secret of x.secrets()){assert.ok(secret.length>=40);assert.ok(!r.output.includes(secret));assert.ok(!JSON.stringify(x.calls.map(c=>c.command)).includes(secret));}
 }finally{await fixture.close();}
});
test('operator native profile starts an independent cluster and authenticates operator directly',async()=>{
 const m=await native(),fixture=await f(),x=executor();try{
  const r=await m.runNativeTests({profile:'operator',env:{HELPDESK_TEST_PG_BIN:fixture.bin},platform:'linux',uid:1000,tempParent:fixture.base,execute:x.execute,checkDriver:()=>{}});
  assert.equal(r.exit_code,0);assert.equal(r.cleanup,'removed');
  const suite=x.calls.find(c=>c.command.includes('--test'));assert.ok(suite.command.includes('supabase/tests/operator-upgrade.test.ts'));assert.ok(!suite.command.includes('supabase/tests/rls.test.ts'));
  const url=new URL(suite.env.HELPDESK_TEST_OPERATOR_URL);assert.equal(url.username,'helpdesk_operator');assert.equal(url.pathname,'/helpdesk_test');assert.equal(url.hostname,'127.0.0.1');assert.ok(url.password.length>=40);assert.ok(!r.output.includes(url.password));
  assert.ok(x.calls.some(c=>basename(c.command[0])==='psql'&&c.command.includes('-f')));
 }finally{await fixture.close();}
});
test('native homologation owns two different data directories and preserves both suite results',async()=>{const m=await native(),fixture=await f(),x=executor();try{const r=await m.runNativeHomologation({env:{HELPDESK_TEST_PG_BIN:fixture.bin},platform:'linux',uid:1000,tempParent:fixture.base,execute:x.execute,checkDriver:()=>{}});assert.equal(r.exit_code,0);assert.equal(r.cleanup,'removed');const starts=x.calls.filter(c=>c.command.includes('start'));assert.equal(starts.length,2);assert.notEqual(starts[0]!.command[2],starts[1]!.command[2]);const suites=x.calls.filter(c=>c.command.includes('--test'));assert.equal(suites.length,2);assert.ok(suites[0]!.command.includes('supabase/tests/rls.test.ts'));assert.ok(suites[0]!.command.includes('supabase/tests/upgrade.test.ts'));assert.ok(suites[1]!.command.includes('supabase/tests/operator-upgrade.test.ts'));assert.match(r.output,/# tests 120/);assert.equal([...r.output.matchAll(/^# tests /gm)].length,1);}finally{await fixture.close();}});
test('failed database assertions are not converted to successful execution and still clean the cluster',async()=>{
 const m=await native(),fixture=await f(),x=executor({testCode:1});try{const r=await m.runNativeTests({env:{HELPDESK_TEST_PG_BIN:fixture.bin},platform:'linux',uid:1000,tempParent:fixture.base,execute:x.execute,checkDriver:()=>{}});assert.equal(r.exit_code,1);assert.equal(r.cleanup,'removed');assert.equal(r.stage,'tests');}finally{await fixture.close();}
});
test('database creation failure never starts suite; own server is still stopped',async()=>{
 const m=await native(),fixture=await f(),x=executor({failStage:'database'});try{const r=await m.runNativeTests({env:{HELPDESK_TEST_PG_BIN:fixture.bin},platform:'linux',uid:1000,tempParent:fixture.base,execute:x.execute,checkDriver:()=>{}});assert.equal(r.exit_code,1);assert.ok(!x.calls.some(c=>c.command.includes('--test')));assert.ok(x.calls.some(c=>c.command.includes('stop')));assert.equal(r.cleanup,'removed');}finally{await fixture.close();}
});
test('failed shutdown preserves data directory and fails even after successful tests',async()=>{
 const m=await native(),fixture=await f(),x=executor({failStage:'stop'});try{const r=await m.runNativeTests({env:{HELPDESK_TEST_PG_BIN:fixture.bin},platform:'linux',uid:1000,tempParent:fixture.base,execute:x.execute,checkDriver:()=>{}});assert.equal(r.exit_code,1);assert.equal(r.cleanup,'preserved');assert.ok((await readdir(fixture.base)).some((s:string)=>s.startsWith('helpdesk-native-')));}finally{await fixture.close();}
});
test('altered ownership marker prevents both automatic stop and directory deletion',async()=>{
 const m=await native(),fixture=await f(),x=executor({tamper:true});try{const r=await m.runNativeTests({env:{HELPDESK_TEST_PG_BIN:fixture.bin},platform:'linux',uid:1000,tempParent:fixture.base,execute:x.execute,checkDriver:()=>{}});assert.equal(r.exit_code,1);assert.equal(r.cleanup,'preserved');assert.ok(!x.calls.some(c=>c.command.includes('stop')));}finally{await fixture.close();}
});
test('missing driver or non-17 binaries fail before initdb, never download or use a remote target',async()=>{
 const m=await native(),fixture=await f();try{for(const driverFails of [true,false]){const x=executor();const r=await m.runNativeTests({env:{HELPDESK_TEST_PG_BIN:fixture.bin,HELPDESK_DATABASE_URL:'postgres://PRIVATE'},platform:'linux',uid:1000,tempParent:fixture.base,checkDriver:()=>{if(driverFails)throw Error('PRIVATE');},execute:driverFails?x.execute:async(o:any)=>{x.calls.push(o);return {exit_code:0,output:'postgres (PostgreSQL) 18.1',stdout:'postgres (PostgreSQL) 18.1',stderr:'',signal:null};}});assert.equal(r.exit_code,1);assert.ok(!x.calls.some(c=>c.command.includes('-D')));assert.doesNotMatch(r.output,/PRIVATE/);}}
 finally{await fixture.close();}
});
test('abort signal terminates only its owned child promptly, without waiting for the normal timeout',async()=>{
 const path='../scripts/local-process.mjs';const {runCommand}=await import(path);const controller=new AbortController();const start=Date.now();const pending=runCommand({command:[process.execPath,'-e','setInterval(()=>{},1000)'],timeoutMs:1500,signal:controller.signal});setTimeout(()=>controller.abort(),40);const r=await pending;assert.equal(r.reason,'aborted');assert.notEqual(r.exit_code,0);assert.ok(Date.now()-start<1200);
});
test('pre-aborted command does not start a child process',async()=>{
 const path='../scripts/local-process.mjs';const {runCommand}=await import(path);const controller=new AbortController();controller.abort();const r=await runCommand({command:[process.execPath,'-e','console.log("SHOULD_NOT_RUN")'],signal:controller.signal});assert.equal(r.reason,'aborted');assert.doesNotMatch(r.output,/SHOULD_NOT_RUN/);
});

test('symbolic-link substitution of data directory blocks automatic cleanup and preserves foreign files',async()=>{
 const m=await native(),fixture=await f(),x=executor();const foreign=join(fixture.base,'foreign');await mkdir(foreign);await writeFile(join(foreign,'keep'),'untouched');
 try{const execute=async(o:any)=>{const result=await x.execute(o);if(o.command.includes('--test')){const data=join(o.env.HOME,'..','data');await rm(data,{recursive:true});await symlink(foreign,data);}return result;};
 const r=await m.runNativeTests({env:{HELPDESK_TEST_PG_BIN:fixture.bin},platform:'linux',uid:1000,tempParent:fixture.base,execute,checkDriver:()=>{}});
 assert.equal(r.exit_code,1);assert.equal(r.cleanup,'preserved');assert.equal(await readFile(join(foreign,'keep'),'utf8'),'untouched');assert.ok(!x.calls.some(c=>c.command.includes('stop')));
 }finally{await fixture.close();}
});
test('aborted test stage still stops only its own cluster with non-aborted cleanup commands',async()=>{
 const m=await native(),fixture=await f(),x=executor(),controller=new AbortController();try{
 const execute=async(o:any)=>{if(o.command.includes('--test')){controller.abort();return {exit_code:1,signal:'SIGTERM',reason:'aborted',output:''};}if(o.command.includes('status')||o.command.includes('stop'))assert.equal(o.signal,undefined);return x.execute(o);};
 const r=await m.runNativeTests({env:{HELPDESK_TEST_PG_BIN:fixture.bin},platform:'linux',uid:1000,tempParent:fixture.base,execute,checkDriver:()=>{},signal:controller.signal});
 assert.equal(r.exit_code,1);assert.equal(r.cleanup,'removed');assert.ok(x.calls.some(c=>c.command.includes('stop')));
 }finally{await fixture.close();}
});
test('unknown engine cannot silently fall back to Docker, native PostgreSQL or a remote database',async()=>{
 const path='../scripts/local-process.mjs';const {runCommand}=await import(path);const r=await runCommand({command:[process.execPath,'scripts/test-db-local.mjs'],env:{PATH:process.env.PATH,HELPDESK_TEST_DB_ENGINE:'supabase',HELPDESK_DATABASE_URL:'postgresql://PRIVATE_PROD'},timeoutMs:10_000});
 assert.notEqual(r.exit_code,0);assert.match(r.output,/Engine local inválido/);assert.doesNotMatch(r.output,/PRIVATE_PROD/);
});
