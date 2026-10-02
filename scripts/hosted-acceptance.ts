/** Explicit operator invocation. Plan mode neither reads tokens nor accesses the network. */
import {open} from 'node:fs/promises';
import {runHostedReadAcceptance} from './hosted-acceptance-core.ts';

async function main():Promise<void>{
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--help'){
  console.log('Uso: npm run --silent test:hosted:read -- --config fixture.json [--execute --confirm-origin https://<deploy>--helpdesk-consultegeo.netlify.app]');return;
 }
 let configPath:string|undefined,confirmOrigin:string|undefined,execute=false;
 const seen=new Set<string>();
 for(let i=0;i<args.length;i++){
  const arg=args[i]!;if(seen.has(arg))throw Error();seen.add(arg);
  if(arg==='--execute'){execute=true;continue;}
  if(arg!=='--config'&&arg!=='--confirm-origin')throw Error();
  const value=args[++i];if(!value||value.startsWith('--'))throw Error();
  if(arg==='--config')configPath=value;else confirmOrigin=value;
 }
 if(!configPath||(!execute&&confirmOrigin!==undefined)||(execute&&!confirmOrigin))throw Error();
 if(execute&&process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw Error();
 const file=await open(configPath,'r');let input:unknown;
 try{
  const stat=await file.stat();if(!stat.isFile()||stat.size>32768)throw Error();
  // Also bound actual bytes read, rather than trusting only a prior stat().
  const bytes=Buffer.alloc(32769);let count=0;
  while(count<bytes.length){const part=await file.read(bytes,count,bytes.length-count,null);if(!part.bytesRead)break;count+=part.bytesRead;}
  if(count>32768)throw Error();input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,count)));
 }finally{await file.close();}
 const tokens=execute?{requesterA:process.env.HELPDESK_TEST_HUMAN_A,requesterB:process.env.HELPDESK_TEST_HUMAN_B,
  agentA:process.env.HELPDESK_TEST_AGENT_A,machineA:process.env.HELPDESK_TEST_M2M_SESSION_A}:{};
 const report=await runHostedReadAcceptance(input,tokens,{execute,confirmOrigin});
 console.log(JSON.stringify(report,null,2));
 process.exitCode=report.status==='blocked'?2:report.status==='failed'?1:0;
}
try{await main();}catch{
 console.error('Aceitação não executada: argumentos, configuração ou credenciais inválidos. Nenhum detalhe sensível é exibido.');process.exitCode=1;
}
