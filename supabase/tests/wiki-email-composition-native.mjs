/** Local disposable composition-test infrastructure; never used by a deployed runtime. */
import {spawnSync} from 'node:child_process';
import {appendFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

export function createNativePostgresRunner({bin,suffix,env,temp,platform=process.platform,spawn=spawnSync}){
 return (name,args,input)=>{
  const r=spawn(join(bin,name+suffix),args,{env,input,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,...(name==='pg_ctl'&&platform==='win32'?{stdio:'ignore'}:{})});
  if(r.status!==0){
   let serverLog='';
   if(name==='pg_ctl')try{serverLog=readFileSync(join(temp,'server.log'),'utf8').slice(-32768);}catch{}
   throw Error(`${name} failed (${r.status}): ${[r.stderr,r.stdout,r.error?.message,serverLog].filter(Boolean).join('\n')}`);
  }
  return r.stdout;
 };
}
export function configureTlsLoopbackPostgres(data,{cert,key}){
 const quote=value=>"'"+value.replaceAll('\\','/').replaceAll("'","''")+"'";
 // All connections use TCP loopback. Ubuntu's packaged Unix socket directory
 // can belong to the system postgres account instead of the runner account.
 appendFileSync(join(data,'postgresql.conf'),`\nunix_socket_directories = ''\nssl=on\nssl_cert_file=${quote(cert)}\nssl_key_file=${quote(key)}\n`);
}
