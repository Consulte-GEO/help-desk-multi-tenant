import {mkdtemp,rm,lstat,realpath,open} from 'node:fs/promises';
import {constants} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';
import {HelpdeskError} from '../../src/domain/errors.ts';
import {registrationRecord,registrationFailure,type RegistrationJson} from '../../src/domain/registration-canonical.ts';
import {buildAnalysisPrompt,type AnalysisRequest} from '../../src/connectors/dev-agent/analysis-request.ts';
import {decodeClaudeJson,CLAUDE_JSON_LIMITS} from '../../src/connectors/dev-agent/strict-json.ts';
import {parseClaudeStructuredOutput} from '../../src/connectors/dev-agent/contract.ts';
import {getRegistrationAction} from '../../src/domain/registration-action-catalog.ts';
import type {AgentAnalysis} from '../../src/domain/registration-contracts.ts';
import {parseClaudeRunnerConfig,type ClaudeRunnerConfig} from './config.ts';
import {runAnalysisSubprocess} from './subprocess.ts';
export type AnalysisRunResult=Readonly<{output:RegistrationJson;analysis:AgentAnalysis;metrics:Readonly<{stdoutBytes:number;stderrBytes:number;durationMs:number}>}>;
export type AnalysisRunner=Readonly<{analyze(request:AnalysisRequest,signal?:AbortSignal):Promise<AnalysisRunResult>}>;
async function verifyBinary(config:ClaudeRunnerConfig,signal:AbortSignal):Promise<void> {
 const fail=()=>registrationFailure('registration_runner_binary_mismatch',503);
 try{
  if(await realpath(config.executablePath)!==config.executablePath)throw fail();
  const file=await open(config.executablePath,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{
   const info=await file.stat();if(!info.isFile()||(info.mode&0o022)!==0||info.size>512*1024*1024||info.size===0)throw fail();
   const hash=createHash('sha256');for await(const chunk of file.createReadStream({autoClose:false})){if(signal.aborted)throw fail();hash.update(chunk);}
   if(hash.digest('hex')!==config.executableSha256)throw fail();
  }finally{await file.close();}
 }catch{throw fail();}
}
/** No HTTP entrypoint, scheduler, queue/database, origin credential or email tool.
 * The caller supplies a dedicated model API key through a private resolver. The
 * personal Claude OAuth login and inherited shell environment are never used. */
export function createClaudeAnalysisRunner(rawConfig:unknown,credentials:()=>Promise<Readonly<{ANTHROPIC_API_KEY:string}>>):AnalysisRunner {
 const config=parseClaudeRunnerConfig(rawConfig);if(typeof credentials!=='function')throw registrationFailure('registration_runner_configuration_invalid',503);
 let busy=false;
 return Object.freeze({async analyze(request:AnalysisRequest,parent?:AbortSignal):Promise<AnalysisRunResult>{
  if(busy)throw registrationFailure('registration_runner_busy',409);busy=true;
  let dir:string|undefined,cleanupFailed=false;const c=new AbortController(),started=performance.now();
  const cancel=()=>c.abort('caller');parent?.addEventListener('abort',cancel,{once:true});if(parent?.aborted)cancel();
  const timer=setTimeout(()=>c.abort('deadline'),config.timeoutMs);
  const check=()=>{if(c.signal.aborted)throw registrationFailure(c.signal.reason==='deadline'?'registration_runner_timeout':'registration_runner_aborted',409);};
  const bounded=<T>(work:Promise<T>):Promise<T>=>new Promise((resolve,reject)=>{
   const abort=()=>reject(registrationFailure(c.signal.reason==='deadline'?'registration_runner_timeout':'registration_runner_aborted',409));
   c.signal.addEventListener('abort',abort,{once:true});if(c.signal.aborted)abort();
   void work.then(resolve,reject).finally(()=>c.signal.removeEventListener('abort',abort));
  });
  try{
   check();if(process.platform!=='linux'||process.getuid?.()===0)throw registrationFailure('registration_runner_host_unqualified',503);
   const r=registrationRecord(request,['snapshot','job','knowledge']),prompt=buildAnalysisPrompt(r.snapshot,r.job,r.knowledge);
   if(prompt.job.agentVersionRef!==config.agentVersionRef)throw registrationFailure('registration_runner_version_mismatch',409);
   await bounded(verifyBinary(config,c.signal));check();
   dir=await mkdtemp(join(tmpdir(),'hda-analysis-'));check();
   const env={PATH:'/usr/bin:/bin',HOME:dir,CLAUDE_CONFIG_DIR:join(dir,'claude'),XDG_CONFIG_HOME:join(dir,'config'),TMPDIR:dir,LANG:'C.UTF-8',LC_ALL:'C.UTF-8',TZ:'UTC'};
   const version=await runAnalysisSubprocess({executable:config.executablePath,args:['--version'],stdin:'',cwd:dir,env,signal:c.signal,stdoutLimit:8192,stderrLimit:8192});
   try{if(version.stdout.toString('utf8').trim()!==config.cliVersion+' (Claude Code)')throw registrationFailure('registration_runner_version_mismatch',503);}finally{version.stdout.fill(0);}
   check();let secret:unknown;
   try{secret=await bounded(credentials());}catch{check();throw registrationFailure('registration_runner_credentials_invalid',503);}
   let key:string;
   try{const v=registrationRecord(secret,['ANTHROPIC_API_KEY']);if(typeof v.ANTHROPIC_API_KEY!=='string'||v.ANTHROPIC_API_KEY.length<8||v.ANTHROPIC_API_KEY.length>4096||/[\s\p{Cc}]/u.test(v.ANTHROPIC_API_KEY))throw Error();key=v.ANTHROPIC_API_KEY;}catch{throw registrationFailure('registration_runner_credentials_invalid',503);}
   await bounded(verifyBinary(config,c.signal));check();
   const args=['--bare','-p','--output-format','json','--json-schema',JSON.stringify(prompt.outputSchema),'--system-prompt',prompt.systemPrompt,'--tools','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}','--setting-sources','','--disable-slash-commands','--no-session-persistence','--permission-mode','dontAsk','--max-turns','2','--max-budget-usd',config.maxBudgetUsd,'--model',config.modelId];
   const result=await runAnalysisSubprocess({executable:config.executablePath,args,stdin:prompt.stdin,cwd:dir,env:{...env,ANTHROPIC_API_KEY:key},signal:c.signal,stdoutLimit:CLAUDE_JSON_LIMITS.bytes,stderrLimit:16384});
   try{
    check();const decoded=decodeClaudeJson(result.stdout),analysis=parseClaudeStructuredOutput(decoded,prompt.job,getRegistrationAction(prompt.job.actionKey));
    // Only the nine wire fields return to the persistence parser. Provider logs,
    // metadata, session IDs and cost estimates are not retained or persisted.
    const output:RegistrationJson={schema:1,jobId:analysis.jobId,operationId:analysis.operationId,inputRevision:analysis.inputRevision,disposition:analysis.disposition,proposedFields:analysis.proposedFields,missingFields:analysis.missingFields,warnings:analysis.warnings,knowledgeRefs:analysis.knowledgeRefs};
    return Object.freeze({output:Object.freeze(output),analysis,metrics:Object.freeze({stdoutBytes:result.stdout.length,stderrBytes:result.stderrBytes,durationMs:Math.ceil(performance.now()-started)})});
   }finally{result.stdout.fill(0);}
  }catch(error){
   check();
   if(error instanceof HelpdeskError&&/^registration_[a-z_]+$/.test(error.code))throw registrationFailure(error.code,[400,403,409,422,503].includes(error.status)?error.status:503);
   throw registrationFailure('registration_runner_failed',503);
  }
  finally{
   clearTimeout(timer);parent?.removeEventListener('abort',cancel);
   if(dir){try{const s=await lstat(dir);if(!s.isDirectory()||s.isSymbolicLink()||s.uid!==process.getuid?.()||await realpath(dir)!==dir)throw Error();await rm(dir,{recursive:true});}catch{cleanupFailed=true;}}
   busy=false;if(cleanupFailed)throw registrationFailure('registration_runner_cleanup_failed',503);
  }
 }});
}
