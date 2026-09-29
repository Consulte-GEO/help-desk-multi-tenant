import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {runRuntimePreflight} from '../src/infrastructure/runtime-preflight.ts';
import type {RuntimeConfig} from '../src/infrastructure/runtime-config.ts';

const help=`Help Desk — diagnóstico privado de runtime (somente leitura)

npm run --silent runtime:preflight
  Verifica somente configuração. Não importa pg, não conecta e não abre o gate.

npm run --silent runtime:preflight -- --connect
  Solicita uma conexão real com TLS verificado e consulta somente leitura.
  Usar exclusivamente em ambiente/destino autorizado; não executa migrations.

Variáveis do ambiente: HELPDESK_DATABASE_URL, HELPDESK_DATABASE_CA,
SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, HELPDESK_RATE_LIMIT_HMAC_KEY,
HELPDESK_RELEASE_APPROVED. Não passar valores secretos nos argumentos.
Nenhum .env é carregado implicitamente. Nenhuma flag/arquivo/dado é alterado.
O relatório não homologa Auth, a Function hospedada ou a operação do produto.
`;
const failure=(code:string)=>({schema:'helpdesk.runtime-preflight.v1',success:false,code,
 production_approved:false,operational:false,auth_tested:false,hosted_function_tested:false,business_operations_dispatched:0});

export async function runPreflightCli(argv:string[],env:NodeJS.ProcessEnv):Promise<{exitCode:number;output:string}>{
 if(argv.length===1&&argv[0]==='--help')return {exitCode:0,output:help};
 if(argv.length>1||(argv.length===1&&argv[0]!=='--connect'))
  return {exitCode:1,output:JSON.stringify(failure('invalid_arguments'),null,2)+'\n'};
 const started_at=new Date().toISOString();
 try{
  const input:RuntimeConfig={databaseUrl:env.HELPDESK_DATABASE_URL,databaseCa:env.HELPDESK_DATABASE_CA,
   supabaseUrl:env.SUPABASE_URL,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,
   rateLimitHmacKey:env.HELPDESK_RATE_LIMIT_HMAC_KEY,releaseApproved:env.HELPDESK_RELEASE_APPROVED};
  const fingerprintModule='./homologation-core.mjs';
  const {sourceFingerprint}=await import(fingerprintModule);
  const root=fileURLToPath(new URL('../',import.meta.url));
  const before=await sourceFingerprint(root);
  const result=await runRuntimePreflight(input,{connect:argv[0]==='--connect'});
  const after=await sourceFingerprint(root);
  const output={...result,started_at,completed_at:new Date().toISOString(),source_fingerprint:before,
   source_changed_during_run:before!==after};
  // A report must not silently combine two different source snapshots.
  if(before!==after)output.success=false;
  return {exitCode:output.success?0:1,output:JSON.stringify(output,null,2)+'\n'};
 }catch{return {exitCode:1,output:JSON.stringify(failure('preflight_failed'),null,2)+'\n'};}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const result=await runPreflightCli(process.argv.slice(2),process.env);
 process.stdout.write(result.output);process.exitCode=result.exitCode;
}
