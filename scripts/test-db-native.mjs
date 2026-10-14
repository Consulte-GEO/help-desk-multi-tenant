import {runNativeHomologation} from './native-postgres.mjs';
const controller=new AbortController();const abort=()=>controller.abort();
process.once('SIGINT',abort);process.once('SIGTERM',abort);
try {
 const result=await runNativeHomologation({signal:controller.signal});
 if(result.output)process.stdout.write(result.output+'\n');
 console.log(JSON.stringify({component:'helpdesk.test.native',engine:result.engine,postgres_version:result.version,
  stage:result.stage,exit_code:result.exit_code,cleanup:result.cleanup,reason:result.reason,
  ...(result.recovery_directory?{recovery_directory:result.recovery_directory}:{})}));
 if(result.exit_code)console.error('PostgreSQL nativo NÃO homologado. Exige pg instalado, binários PostgreSQL 17 em HELPDESK_TEST_PG_BIN e usuário não root (Linux/macOS/WSL). Nenhum fallback remoto foi usado.');
 process.exitCode=result.exit_code;
}finally{process.removeListener('SIGINT',abort);process.removeListener('SIGTERM',abort);}
