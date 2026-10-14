import {readOperationalJson} from '../src/infrastructure/operational-json.ts';
import {planConsulteGeoLocalProvisioning} from '../src/application/consultegeo-local-provisioning.ts';
// Private offline plan only. Never imports pg or obtains environment credentials.
try{const args=process.argv.slice(2);if(args.length!==1||!args[0])throw Error();
 console.log(JSON.stringify(planConsulteGeoLocalProvisioning(await readOperationalJson(args[0])),null,2));
}catch{console.error('Plano recusado. Informe um arquivo JSON UTF-8 regular de até 16 KiB, sem segredos, com contas, obras e permissões reais declaradas. Nenhum SQL foi executado.');process.exitCode=1;}
