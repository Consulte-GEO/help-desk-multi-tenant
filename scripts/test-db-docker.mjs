/** Owns only its disposable, labelled container. Never reads remote/project credentials. */
import {spawnSync,spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
const ownership=randomBytes(12).toString('hex');let containerId;
const docker=(args)=>{const r=spawnSync('docker',args,{encoding:'utf8'});if(r.error||r.status!==0)throw Error('Docker command unavailable or failed. No remote fallback is permitted.');return r.stdout.trim();};
try{
 // Docker contexts can point to remote daemons: refuse those before creating anything.
 const host=process.env.DOCKER_HOST||JSON.parse(docker(['context','inspect']))[0]?.Endpoints?.docker?.Host;
 if(!host||!(/^(unix:\/\/|npipe:\/\/)/).test(host)||process.env.DOCKER_CONTEXT&&process.env.DOCKER_HOST)
  throw Error('Use an unambiguous local Docker daemon; remote/SSH/TCP targets are refused.');
 const adminPassword=randomBytes(24).toString('hex'),appPassword=randomBytes(24).toString('hex');
 const portEnv='POSTGRES_PASSWORD='+adminPassword;
 containerId=docker(['run','--detach','--rm','--label','helpdesk.test.owner='+ownership,
  '--env',portEnv,'--env','POSTGRES_USER=postgres','--env','POSTGRES_DB=helpdesk_test',
  '--publish','127.0.0.1::5432','postgres:17']);
 for(let attempt=0;attempt<40;attempt++){
  const r=spawnSync('docker',['exec',containerId,'pg_isready','-U','postgres','-d','helpdesk_test'],{stdio:'ignore'});
  if(r.status===0)break;if(attempt===39)throw Error('Local PostgreSQL did not become ready.');
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 const info=JSON.parse(docker(['inspect',containerId]))[0];
 const binding=info.NetworkSettings.Ports['5432/tcp'].find(p=>p.HostIp==='127.0.0.1');
 if(!binding||!/^\d+$/.test(binding.HostPort))throw Error('Loopback port binding not verified.');
 const at='@127.0.0.1:'+binding.HostPort+'/helpdesk_test';
 const child=spawn(process.execPath,['--experimental-strip-types','--test','--test-concurrency=1','supabase/tests/rls.test.ts','supabase/tests/upgrade.test.ts'],{stdio:'inherit',env:{...process.env,ALLOW_DATABASE_TESTS:'1',HELPDESK_TEST_ADMIN_URL:'postgresql://postgres:'+adminPassword+at,HELPDESK_TEST_APP_URL:'postgresql://helpdesk_app:'+appPassword+at}});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code??1));});process.exitCode=code;
}catch(error){console.error(error.message);process.exitCode=1;}
finally{
 if(containerId){try{const label=docker(['inspect','--format','{{ index .Config.Labels "helpdesk.test.owner" }}',containerId]);if(label===ownership)docker(['stop',containerId]);else throw Error('Container ownership mismatch; automatic cleanup refused.');}catch(error){console.error(error.message);process.exitCode=1;}}
}
