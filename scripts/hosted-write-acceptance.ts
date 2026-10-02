/** Plan by default. The CLI never accepts tokens as arguments or creates identities. */
import {open} from 'node:fs/promises';
import {runHostedWriteAcceptance} from './hosted-write-acceptance-core.ts';
async function main():Promise<void>{
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--help'){
  console.log('Uso: npm run --silent test:hosted:write -- --config fixture.json [--execute --allow-ticket-mutations --confirm-origin <permalink> --confirm-config-sha256 <hash do plano>]');return;
 }
 let configPath:string|undefined,confirmOrigin:string|undefined,confirmConfigSha256:string|undefined,execute=false,allowTicketMutations=false;
 const seen=new Set<string>();
 for(let i=0;i<args.length;i++){
  const arg=args[i]!;if(seen.has(arg))throw Error();seen.add(arg);
  if(arg==='--execute'){execute=true;continue;}if(arg==='--allow-ticket-mutations'){allowTicketMutations=true;continue;}
  if(!['--config','--confirm-origin','--confirm-config-sha256'].includes(arg))throw Error();const value=args[++i];if(!value||value.startsWith('--'))throw Error();
  if(arg==='--config')configPath=value;else if(arg==='--confirm-origin')confirmOrigin=value;else confirmConfigSha256=value;
 }
 if(!configPath||(!execute&&(allowTicketMutations||confirmOrigin||confirmConfigSha256))||(execute&&(!allowTicketMutations||!confirmOrigin||!confirmConfigSha256||process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0')))throw Error();
 const file=await open(configPath,'r');let input:unknown;
 try{
  const stat=await file.stat();if(!stat.isFile()||stat.size>32768)throw Error();const bytes=Buffer.alloc(32769);let count=0;
  while(count<bytes.length){const part=await file.read(bytes,count,bytes.length-count,null);if(!part.bytesRead)break;count+=part.bytesRead;}
  if(count>32768)throw Error();input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,count)));
 }finally{await file.close();}
 const plan=await runHostedWriteAcceptance(input);
 if(!execute){console.log(JSON.stringify(plan,null,2));return;}
 if(plan.origin!==confirmOrigin||plan.config_sha256!==confirmConfigSha256)throw Error();
 const tokens={requesterA:process.env.HELPDESK_TEST_HUMAN_A,requesterB:process.env.HELPDESK_TEST_HUMAN_B,
  agentA:process.env.HELPDESK_TEST_AGENT_A,machineA:process.env.HELPDESK_TEST_M2M_SESSION_A};
 const report=await runHostedWriteAcceptance(input,tokens,{execute,allowTicketMutations,confirmOrigin,confirmConfigSha256});
 console.log(JSON.stringify(report,null,2));process.exitCode=report.status==='blocked'?2:report.status==='failed'?1:0;
}
try{await main();}catch{console.error('Aceitação de gravações não executada: configuração, confirmações ou credenciais inválidas. Nenhum detalhe sensível é exibido.');process.exitCode=1;}
