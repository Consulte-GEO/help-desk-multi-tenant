/** Executes local prerequisites; deliberately does not migrate Supabase or deploy Netlify. */
import {mkdir,writeFile,rename} from 'node:fs/promises';import {randomUUID,createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';import {join} from 'node:path';
import {sourceFingerprint,runChecks,validateReport,verifyLogs} from './homologation-core.mjs';
import {runCommand} from './local-process.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),directory=join(root,'evidence/homologation'),runId=randomUUID();
await mkdir(join(directory,'runs',runId),{recursive:true});
try{
 const fingerprint=await sourceFingerprint(root);
 const report=await runChecks({fingerprint,execute:async step=>{
  console.log('Verificação local: '+step.id);
  const command=step.command[0]==='node'?[process.execPath,...step.command.slice(1)]:step.command;
  const result=await runCommand({command,cwd:root,timeoutMs:step.timeout});
  const artifact=`runs/${runId}/${step.id}.log`;await writeFile(join(directory,artifact),result.output);
  return {...result,artifact,sha256:createHash('sha256').update(result.output).digest('hex')};
 }});
 const after=await sourceFingerprint(root);if(after!==fingerprint)report.source_changed_during_run=true;
 await writeFile(join(directory,'runs',runId,'report.json'),JSON.stringify(report,null,2)+'\n');
 await writeFile(join(directory,runId+'.tmp'),JSON.stringify(report,null,2)+'\n');await rename(join(directory,runId+'.tmp'),join(directory,'latest.json'));
 for(const check of report.checks)console.log(`${check.id}: ${check.status}${check.tests?' ('+check.tests.pass+'/'+check.tests.tests+' testes)':''}`);
 validateReport(report,after);await verifyLogs(report,directory);
 console.log('Verificações locais completas. Auth, pooler/TLS, Functions e aprovação operacional do destino permanecem gates separados.');
}catch(error){console.error(error.message);process.exitCode=1;}
