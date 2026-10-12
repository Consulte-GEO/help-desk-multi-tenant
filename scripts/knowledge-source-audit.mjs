/** Explicit local operator CLI. It reads the supplied root and policy only.
 * stdout is safe JSON metadata; redirection must be OUTSIDE the source root.
 * Exit 0 means inventory completed for review, NOT permission to publish. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {auditKnowledgeSource} from './knowledge-source-audit-core.mjs';
import {readPrivateKnowledgeJson} from './knowledge-local-input.mjs';

export async function main(args=process.argv.slice(2)){
 if(args.length===1&&args[0]==='--help'){
  console.log('Uso: node scripts/knowledge-source-audit.mjs --root <wiki-privada> --policy <policy.json> [--at <UTC-ISO>]\nSomente leitura, sem rede; saída de metadados para revisão, não publica artigos. Redirecione a saída para fora da raiz. Exit 0 = requer revisão; 2 = bloqueios; 1 = inspeção não concluída.');return 0;
 }
 try{
  const selected={},seen=new Set();
  for(let i=0;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!['--root','--policy','--at'].includes(k)||seen.has(k)||!v||v.startsWith('--'))throw Error();seen.add(k);selected[k]=v;}
  if(!selected['--root']||!selected['--policy'])throw Error();
  const policy=await readPrivateKnowledgeJson(selected['--policy']);
  const report=await auditKnowledgeSource(selected['--root'],policy,selected['--at']?{at:selected['--at']}:{});
  console.log(JSON.stringify(report,null,2));return report.status==='blocked'?2:0;
 }catch{
  console.error('Inspeção não concluída: argumentos, fonte ou política inválidos. Nenhum detalhe privado é exibido.');return 1;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
