import {readOperationalJson} from '../src/infrastructure/operational-json.ts';
import {planFirstAdminBootstrap} from '../src/application/first-admin-bootstrap.ts';
try{
 const args=process.argv.slice(2);
 if(args.length===1&&args[0]==='--help'){
  console.log('Bootstrap privado do primeiro administrador: npm run bootstrap:plan -- arquivo.json\nPlano offline de até 16 KiB. Nenhum SQL, login, migração ou rede é executado. O operador privado deve conferir alvo, hash e revisão antes de aplicar. O papel helpdesk_app não pode executar o plano; nenhum escopo de atendimento é acrescentado.');
 }else{
  if(args.length!==1||!args[0])throw Error();
  console.log(JSON.stringify(planFirstAdminBootstrap(await readOperationalJson(args[0])),null,2));
 }
}catch{
 console.error('Bootstrap recusado. Informe um único JSON UTF-8 regular de até 16 KiB, com alvo existente, revisão e motivo; sem segredos. Nenhum SQL foi executado.');
 process.exitCode=1;
}
