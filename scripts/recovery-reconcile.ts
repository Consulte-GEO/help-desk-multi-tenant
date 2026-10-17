/** Explicit read-only operator CLI, using the C15 candidate contracts. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readPrivateKnowledgeJson,samePrivateKnowledgePath} from './knowledge-local-input.mjs';
import {summarizeRecoveryReconciliation} from '../src/domain/recovery-reconciliation-report.ts';
const flags=['--delivery-backup','--delivery-current','--access-restored','--access-tombstones'] as const;
export async function main(args=process.argv.slice(2)):Promise<number>{
 if(args.length===1&&args[0]==='--help'){
  console.log('Uso: node --experimental-strip-types scripts/recovery-reconcile.ts --delivery-backup <json> --delivery-current <json> --access-restored <json> --access-tombstones <json> --at <UTC-Z>\nRelatório local somente leitura. Quatro arrays C12/C15, não exports nativos HDN/Resend/SQL. Máximo 2 MiB e 1.000 elementos por arquivo; caminhos distintos, sem links. UTC com 3 ou 6 casas decimais. Fontes congeladas: ledger atual e tombstones conservados fora do rollback; autoridade e cobertura exigem comprovação própria. Saída contém somente contagens/hashes, sem restore, rede, envio ou ativação. Redirecione para arquivo novo fora das entradas: o shell abre o destino antes do programa. Exit0 = cálculo concluído, sem autorização de produção; exit1 = argumentos/fontes inválidos ou conflito, sem relatório parcial.');return 0;
 }
 try{
  const selected:Record<string,string>={};
  for(let n=0;n<args.length;n+=2){const key=args[n],value=args[n+1];if(!key||![...flags,'--at'].includes(key)||Object.hasOwn(selected,key)||!value||!value.trim()||value.startsWith('--'))throw Error();selected[key]=value;}
  if(flags.some(k=>!selected[k])||!selected['--at'])throw Error();
  const paths=flags.map(k=>resolve(selected[k]!));
  for(let n=0;n<paths.length;n++)for(let m=0;m<n;m++)if(samePrivateKnowledgePath(paths[n]!,paths[m]!))throw Error();
  const rows:unknown[]=[];for(const path of paths)rows.push(await readPrivateKnowledgeJson(path,2097152));
  const report=summarizeRecoveryReconciliation(rows[0],rows[1],rows[2],rows[3],selected['--at']);
  console.log(JSON.stringify(report,null,2));return 0;
 }catch{console.error('Reconciliação não concluída: argumentos, fontes ou estados inválidos, incompletos ou incompatíveis. Nenhum detalhe privado é exibido.');return 1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
