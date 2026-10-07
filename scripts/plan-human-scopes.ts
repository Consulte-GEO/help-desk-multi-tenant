import {readOperationalJson} from '../src/infrastructure/operational-json.ts';
import {planHumanScopeChange} from '../src/application/human-scope-change.ts';

// Offline only: bounded, regular UTF-8 JSON; never loads a DB driver or environment credentials.
try{
 const args=process.argv.slice(2);
 if(args.length!==1||!args[0])throw Error();
 const value=await readOperationalJson(args[0]);
 console.log(JSON.stringify(planHumanScopeChange(value),null,2));
}catch{
 console.error('Plano recusado. Informe um único arquivo JSON UTF-8 regular de até 16 KiB, sem segredos e com os campos exigidos. Nenhum SQL foi executado.');
 process.exitCode=1;
}
