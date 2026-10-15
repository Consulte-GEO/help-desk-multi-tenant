import {spawn} from 'node:child_process';
import {registrationFailure} from '../../src/domain/registration-canonical.ts';
/** Linux process-group supervision. This is NOT an OS sandbox. A trusted,
 * immutable binary, dedicated unprivileged identity and network/filesystem
 * confinement must be qualified before production. No shell or ambient env. */
export async function runAnalysisSubprocess(o:Readonly<{executable:string;args:readonly string[];stdin:string;cwd:string;env:Readonly<Record<string,string>>;signal:AbortSignal;stdoutLimit:number;stderrLimit:number}>):Promise<{stdout:Buffer;stderrBytes:number}> {
 if(o.signal.aborted)throw registrationFailure('registration_runner_aborted',409);
 return new Promise((resolve,reject)=>{
  let child:ReturnType<typeof spawn>;
  try{child=spawn(o.executable,[...o.args],{cwd:o.cwd,env:{...o.env},shell:false,detached:true,windowsHide:true,stdio:['pipe','pipe','pipe']});}
  catch{reject(registrationFailure('registration_runner_offline',503));return;}
  let done=false,failure:string|null=null,stdoutBytes=0,stderrBytes=0;
  const chunks:Buffer[]=[];let force:ReturnType<typeof setTimeout>|undefined,hard:ReturnType<typeof setTimeout>|undefined;
  const kill=(signal:NodeJS.Signals)=>{
   if(!child.pid)return;
   try{process.kill(-child.pid,signal);}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')failure='registration_runner_cleanup_failed';}
  };
  const finish=()=>{
   if(done)return;done=true;clearTimeout(force);clearTimeout(hard);o.signal.removeEventListener('abort',abort);
   // Any remaining descendants in our group are stopped; escaped process groups
   // require the deployment sandbox and cannot be proved by this helper.
   kill('SIGKILL');child.stdin?.destroy();child.stdout?.destroy();child.stderr?.destroy();
   if(failure){chunks.forEach(b=>b.fill(0));reject(registrationFailure(failure,failure==='registration_runner_aborted'?409:503));}
   else {const stdout=Buffer.concat(chunks,stdoutBytes);chunks.forEach(b=>b.fill(0));resolve({stdout,stderrBytes});}
  };
  const stop=(reason:string)=>{
   if(done||failure)return;failure=reason;kill('SIGTERM');
   force=setTimeout(()=>kill('SIGKILL'),250);
   hard=setTimeout(()=>{failure='registration_runner_cleanup_failed';finish();},1500);
  };
  const abort=()=>stop('registration_runner_aborted');
  o.signal.addEventListener('abort',abort,{once:true});if(o.signal.aborted)abort();
  child.on('error',()=>{failure='registration_runner_offline';finish();});
  child.stdout!.on('data',(raw:Buffer)=>{stdoutBytes+=raw.length;if(stdoutBytes>o.stdoutLimit){stop('registration_runner_output_limit');return;}if(!failure&&!done)chunks.push(Buffer.from(raw));});
  // Keep only a count, never stderr text or a provider's possibly secret error.
  child.stderr!.on('data',(raw:Buffer)=>{stderrBytes+=raw.length;if(stderrBytes>o.stderrLimit)stop('registration_runner_output_limit');});
  child.stdin!.on('error',()=>stop('registration_runner_input_failed'));
  child.on('close',(code,signal)=>{if(!failure&&(code!==0||signal!==null))failure='registration_runner_failed';finish();});
  child.stdin!.end(o.stdin,'utf8');
 });
}
