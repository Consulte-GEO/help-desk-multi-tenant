/** Password and long-term M2M key are read only for an explicitly confirmed session test. */
import {open} from 'node:fs/promises';
import {runHostedAuthAcceptance} from './hosted-auth-acceptance-core.ts';
async function main():Promise<void>{
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--help'){
  console.log('Uso: npm run --silent test:hosted:auth -- --config fixture.json [--execute --allow-session-mutations --confirm-origin <permalink> --confirm-auth-origin <Supabase>]');return;
 }
 let configPath:string|undefined,confirmOrigin:string|undefined,confirmAuthOrigin:string|undefined,execute=false,allowSessionMutations=false;
 const seen=new Set<string>();
 for(let i=0;i<args.length;i++){
  const arg=args[i]!;if(seen.has(arg))throw Error();seen.add(arg);
  if(arg==='--execute'){execute=true;continue;}
  if(arg==='--allow-session-mutations'){allowSessionMutations=true;continue;}
  if(!['--config','--confirm-origin','--confirm-auth-origin'].includes(arg))throw Error();
  const value=args[++i];if(!value||value.startsWith('--'))throw Error();
  if(arg==='--config')configPath=value;else if(arg==='--confirm-origin')confirmOrigin=value;else confirmAuthOrigin=value;
 }
 if(!configPath||(!execute&&(allowSessionMutations||confirmOrigin||confirmAuthOrigin))
  ||(execute&&(!allowSessionMutations||!confirmOrigin||!confirmAuthOrigin||process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0')))throw Error();
 const file=await open(configPath,'r');let input:unknown;
 try{
  const stat=await file.stat();if(!stat.isFile()||stat.size>32768)throw Error();
  const bytes=Buffer.alloc(32769);let count=0;
  while(count<bytes.length){const part=await file.read(bytes,count,bytes.length-count,null);if(!part.bytesRead)break;count+=part.bytesRead;}
  if(count>32768)throw Error();input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(0,count)));
 }finally{await file.close();}
 const secrets=execute?{email:process.env.HELPDESK_TEST_EMAIL_A,password:process.env.HELPDESK_TEST_PASSWORD_A,integrationKey:process.env.HELPDESK_TEST_M2M_KEY_A}:{};
 const report=await runHostedAuthAcceptance(input,secrets,{execute,allowSessionMutations,confirmOrigin,confirmAuthOrigin});
 console.log(JSON.stringify(report,null,2));process.exitCode=report.status==='blocked'?2:report.status==='failed'?1:0;
}
try{await main();}catch{console.error('Aceitação de sessões não executada: parâmetros ou credenciais inválidos. Nenhum detalhe sensível é exibido.');process.exitCode=1;}
