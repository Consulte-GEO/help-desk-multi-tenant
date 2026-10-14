/** Owns two independent, disposable PG17 containers. Roles cannot be isolated by database alone. */
import {spawnSync} from 'node:child_process';import {randomBytes} from 'node:crypto';
import {waitForPostgresConnection} from './postgres-readiness.mjs';import {runCommand} from './local-process.mjs';import {combinePostgresSuites} from './postgres-suite-output.mjs';
const ownership=randomBytes(12).toString('hex');
const docker=args=>{const r=spawnSync('docker',args,{encoding:'utf8'});if(r.error||r.status!==0)throw Error('Docker command unavailable or failed. No remote fallback is permitted.');return r.stdout.trim();};
async function cluster(profile){
 let containerId;const secrets=Array.from({length:3},()=>randomBytes(24).toString('hex')),[adminPassword,appPassword,operatorPassword]=secrets;
 const scrub=text=>secrets.reduce((s,key)=>s.split(key).join('[REDACTED]'),String(text??''));
 try{
  containerId=docker(['run','--detach','--rm','--label','helpdesk.test.owner='+ownership,
   '--env','POSTGRES_PASSWORD='+adminPassword,'--env','POSTGRES_USER=postgres','--env','POSTGRES_DB=helpdesk_test',
   '--publish','127.0.0.1::5432','postgres:17']);
  const info=JSON.parse(docker(['inspect',containerId]))[0],binding=info.NetworkSettings.Ports['5432/tcp'].find(p=>p.HostIp==='127.0.0.1');
  if(!binding||!/^\d+$/.test(binding.HostPort))throw Error('Loopback port binding not verified.');
  const at='@127.0.0.1:'+binding.HostPort+'/helpdesk_test',{Client}=await import('pg'),adminUrl='postgresql://postgres:'+adminPassword+at;
  await waitForPostgresConnection(async()=>{const client=new Client({connectionString:adminUrl,connectionTimeoutMillis:1000});try{await client.connect();return (await client.query("select current_setting('server_version_num')::integer as version,current_database() as database")).rows[0];}finally{try{await client.end();}catch{}}});
  if(profile==='operator'){
   const client=new Client({connectionString:adminUrl});try{await client.connect();
    const sql=(await client.query("select format('CREATE ROLE helpdesk_operator LOGIN NOSUPERUSER NOCREATEDB CREATEROLE NOINHERIT NOREPLICATION BYPASSRLS PASSWORD %L',$1::text) as sql",[operatorPassword])).rows[0].sql;
    await client.query(sql);await client.query('ALTER DATABASE helpdesk_test OWNER TO helpdesk_operator');
   }finally{await client.end();}
  }
  const tests=profile==='operator'?['supabase/tests/operator-upgrade.test.ts']:['supabase/tests/rls.test.ts','supabase/tests/upgrade.test.ts'];
  const result=await runCommand({command:[process.execPath,'--experimental-strip-types','--test','--test-reporter=tap','--test-concurrency=1',...tests],timeoutMs:300_000,
   env:{...process.env,ALLOW_DATABASE_TESTS:'1',HELPDESK_TEST_ADMIN_URL:adminUrl,HELPDESK_TEST_APP_URL:'postgresql://helpdesk_app:'+appPassword+at,
    ...(profile==='operator'?{HELPDESK_TEST_OPERATOR_URL:'postgresql://helpdesk_operator:'+operatorPassword+at}:{})}});
  return {...result,output:scrub(result.output)};
 }catch{throw Error('Owned PostgreSQL '+profile+' cluster failed. No remote fallback was used.');}
 finally{if(containerId){const label=docker(['inspect','--format','{{ index .Config.Labels "helpdesk.test.owner" }}',containerId]);if(label!==ownership)throw Error('Container ownership mismatch; automatic cleanup refused.');docker(['stop',containerId]);}}
}
try{
 const host=process.env.DOCKER_HOST||JSON.parse(docker(['context','inspect']))[0]?.Endpoints?.docker?.Host;
 if(!host||!(/^(unix:\/\/|npipe:\/\/)/).test(host)||process.env.DOCKER_CONTEXT&&process.env.DOCKER_HOST)throw Error('Use an unambiguous local Docker daemon; remote/SSH/TCP targets are refused.');
 const outputs=[];
 for(const profile of ['superuser','operator']){
  const result=await cluster(profile);outputs.push(result.output);
  if(result.exit_code!==0||result.signal||result.reason){process.stdout.write(outputs.join('\n'));throw Error('PostgreSQL '+profile+' assertions failed.');}
 }
 process.stdout.write(combinePostgresSuites(outputs));
}catch(error){console.error(error.message);process.exitCode=1;}
