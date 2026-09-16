import {spawn} from 'node:child_process';
/** Kill only the process/group started by this invocation, never a PID discovered by port. */
export function stopOwned(child,signal='SIGTERM') {
 if(!child.pid||child.exitCode!==null||child.signalCode!==null)return;
 try{if(process.platform==='win32')child.kill(signal);else process.kill(-child.pid,signal);}catch(error){if(error.code!=='ESRCH')throw error;}
}
export function runCommand({command,cwd,env=process.env,timeoutMs=60_000,maxBytes=8*1024*1024}) {
 return new Promise(resolve=>{
  let stdout='',stderr='',bytes=0,reason=null,finished=false,timer,force;
  const [binary,...args]=command;
  const child=spawn(binary,args,{cwd,env,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
  const stop=why=>{reason??=why;stopOwned(child);force??=setTimeout(()=>stopOwned(child,'SIGKILL'),1000);};
  const append=channel=>chunk=>{const available=Math.max(0,maxBytes-bytes),part=chunk.subarray(0,available);bytes+=part.length;
   if(channel==='stdout')stdout+=part.toString('utf8');else stderr+=part.toString('utf8');
   if(chunk.length>available)stop('output_limit');
  };
  child.stdout.on('data',append('stdout'));child.stderr.on('data',append('stderr'));
  const finish=(code,signal)=>{if(finished)return;finished=true;clearTimeout(timer);clearTimeout(force);
   resolve({exit_code:reason?(code||1):(code??1),signal:signal??null,reason,stdout,stderr,output:stdout+'\n'+stderr});};
  child.once('error',()=>{reason='spawn_failed';finish(1,null);});
  child.once('close',finish);
  timer=setTimeout(()=>stop('timeout'),timeoutMs);
 });
}
