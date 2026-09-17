/** Explicit, disposable local PostgreSQL 17. No installation, privilege escalation or remote fallback. */
import {access,mkdir,mkdtemp,writeFile,readFile,lstat,realpath,rm} from 'node:fs/promises';
import {constants} from 'node:fs';import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';import {join,isAbsolute,dirname,basename} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';import {createServer} from 'node:net';
import {fileURLToPath} from 'node:url';import {runCommand} from './local-process.mjs';
const projectRoot=fileURLToPath(new URL('../',import.meta.url));
export function nativeSettings(env,platform=process.platform,uid=process.getuid?.()) {
 if(!['linux','darwin'].includes(platform)||!Number.isInteger(uid)||uid<=0)
  throw Error('PostgreSQL nativo exige Linux/macOS com usuário sem privilégios root; no Windows use WSL ou Docker.');
 if(!env.HELPDESK_TEST_PG_BIN||!isAbsolute(env.HELPDESK_TEST_PG_BIN)||env.HELPDESK_TEST_PG_BIN.includes('\0')
   ||(env.HELPDESK_TEST_DB_ENGINE&&env.HELPDESK_TEST_DB_ENGINE!=='native'))
  throw Error('Informe HELPDESK_TEST_PG_BIN absoluto e engine native, sem configuração conflitante.');
 return {binDirectory:env.HELPDESK_TEST_PG_BIN};
}
export function nativeEnvironment(env,root) {
 return {PATH:env.PATH??'/usr/bin:/bin',HOME:join(root,'home'),TMPDIR:root,LANG:'C',LC_ALL:'C',TZ:'UTC'};
}
async function unusedLoopbackPort(){return await new Promise((resolve,reject)=>{
 const s=createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{
  const address=s.address();if(!address||typeof address==='string'){s.close();reject(Error('Loopback unavailable'));return;}
  s.close(error=>error?reject(error):resolve(address.port));
 });
});}
async function owns(root,owner){
 try{if(!basename(root).startsWith('helpdesk-native-')||(await lstat(root)).isSymbolicLink()||!(await lstat(root)).isDirectory())return false;
  const marker=join(root,'.helpdesk-native-owner'),m=await lstat(marker);if(!m.isFile()||m.isSymbolicLink()||await readFile(marker,'utf8')!==owner)return false;
  try{const data=await lstat(join(root,'data'));if(data.isSymbolicLink()||!data.isDirectory())return false;}catch(error){if(error.code!=='ENOENT')return false;}
  return true;
 }catch{return false;}
}
/** execute/checkDriver/uid are test seams. The CLI never obtains them from environment or arguments. */
export async function runNativeTests({env=process.env,platform=process.platform,uid=process.getuid?.(),tempParent=tmpdir(),execute=runCommand,
 checkDriver=()=>createRequire(import.meta.url).resolve('pg'),signal}={}) {
 const result={engine:'native',version:null,exit_code:1,stage:'configuration',cleanup:'not_created',output:'',reason:null};
 const owner=randomUUID(),adminSecret=randomBytes(24).toString('hex'),appSecret=randomBytes(24).toString('hex');
 const scrub=text=>String(text??'').split(adminSecret).join('[REDACTED]').split(appSecret).join('[REDACTED]');
 let root,bin,childEnv,startAttempted=false;
 const call=async(command,options={})=>{
  if(signal?.aborted&&!options.cleanup)throw Error('aborted');
  return await execute({command,cwd:projectRoot,env:childEnv,timeoutMs:30_000,...options,signal:options.cleanup?undefined:signal});
 };
 const ok=r=>r.exit_code===0&&!r.signal&&!r.reason;
 const must=async(command,options)=>{const r=await call(command,options);if(!ok(r))throw Error('native_stage_failed');return r;};
 try {
  const c=nativeSettings(env,platform,uid);result.stage='prerequisites';await checkDriver();
  bin=await realpath(c.binDirectory);if(!(await lstat(bin)).isDirectory())throw Error('invalid_bin_directory');
  for(const name of ['initdb','pg_ctl','psql']){
   const file=await realpath(join(bin,name));if(dirname(file)!==bin)throw Error('mixed_bin_directory');await access(file,constants.X_OK);
   const reply=await execute({command:[file,'--version'],cwd:projectRoot,env:{PATH:env.PATH??'/usr/bin:/bin',LANG:'C',LC_ALL:'C',TZ:'UTC'},timeoutMs:10_000,signal});
   const match=/\(PostgreSQL\) (17\.\d+)\b/.exec(reply.output??'');
   if(!ok(reply)||!match||(result.version&&result.version!==match[1]))throw Error('incompatible_postgres_version');result.version=match[1];
  }
  root=await mkdtemp(join(tempParent,'helpdesk-native-'));result.cleanup='pending';
  await writeFile(join(root,'.helpdesk-native-owner'),owner,{mode:0o600,flag:'wx'});await mkdir(join(root,'home'),{mode:0o700});
  childEnv=nativeEnvironment(env,root);const passwordFile=join(root,'init-password');await writeFile(passwordFile,adminSecret+'\n',{mode:0o600,flag:'wx'});
  const data=join(root,'data');const port=await unusedLoopbackPort();result.stage='initdb';
  await must([join(bin,'initdb'),'-D',data,'--username=postgres','--encoding=UTF8','--locale=C','--auth-host=scram-sha-256','--auth-local=scram-sha-256','--pwfile='+passwordFile]);
  await rm(passwordFile);result.stage='start';startAttempted=true;
  await must([join(bin,'pg_ctl'),'-D',data,'-l',join(root,'server.log'),'-o',`-h 127.0.0.1 -p ${port} -c unix_socket_directories=''`,'-w','-t','20','start']);
  result.stage='database';
  // Random credentials + an owned cluster prevent attaching to an unrelated service after a port race.
  await must([join(bin,'psql'),'-X','--no-password','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',String(port),'-U','postgres','-d','postgres','-c','CREATE DATABASE helpdesk_test;'],{env:{...childEnv,PGPASSWORD:adminSecret}});
  const endpoint=`@127.0.0.1:${port}/helpdesk_test`;result.stage='tests';
  const suite=await call([process.execPath,'--experimental-strip-types','--test','--test-concurrency=1','supabase/tests/rls.test.ts','supabase/tests/upgrade.test.ts'],{
   timeoutMs:300_000,env:{...childEnv,ALLOW_DATABASE_TESTS:'1',HELPDESK_TEST_ADMIN_URL:'postgresql://postgres:'+adminSecret+endpoint,HELPDESK_TEST_APP_URL:'postgresql://helpdesk_app:'+appSecret+endpoint}
  });
  result.output=scrub(suite.output);result.exit_code=ok(suite)?0:1;result.reason=ok(suite)?null:'test_command_failed';
 }catch{result.reason=signal?.aborted?'aborted':'native_'+result.stage+'_unavailable';result.exit_code=1;}
 finally {
  if(root){try{
   if(!await owns(root,owner))throw Error('ownership_mismatch');
   if(startAttempted){
    const command=[join(bin,'pg_ctl'),'-D',join(root,'data')];
    const state=await call([...command,'status'],{cleanup:true});
    if(state.exit_code===0&&!state.signal&&!state.reason){
     const stopped=await call([...command,'-m','fast','-w','-t','15','stop'],{cleanup:true});if(!ok(stopped))throw Error('shutdown_not_confirmed');
    }else if(state.exit_code!==3||state.signal||state.reason)throw Error('state_unknown');
    const stateAfter=await call([...command,'status'],{cleanup:true});if(stateAfter.exit_code!==3||stateAfter.signal||stateAfter.reason)throw Error('server_still_running');
   }
   if(!await owns(root,owner))throw Error('ownership_mismatch');
   await rm(root,{recursive:true,force:false});result.cleanup='removed';
  }catch{result.cleanup='preserved';result.recovery_directory=root;result.reason='native_cleanup_unconfirmed';result.exit_code=1;}}
 }
 return result;
}
