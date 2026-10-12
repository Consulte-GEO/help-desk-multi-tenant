/** Explicit offline operator command. Never publishes or alters source files.
 * Redirect output outside the source root; all output is private review metadata. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readPrivateKnowledgeJson} from './knowledge-local-input.mjs';
import {prepareKnowledgeReview,evaluateKnowledgeReview} from './knowledge-editorial-review-core.mjs';
export async function main(args=process.argv.slice(2)){
 if(args.length===1&&args[0]==='--help'){
  console.log('Uso: node scripts/knowledge-editorial-review.mjs --mode prepare|check --root <wiki-privada> --policy <policy.json> [--review <review.json>] [--at <UTC-ISO>]\nPrepare gera decisões pending; check exige --review e relê a fonte. Sem rede, não publica nem sana credenciais. Saída fora da raiz. Exit 0: plano preparado ou seleção privada; 2: revisão pendente/fonte bloqueada; 1: erro ou plano desatualizado. Nenhum código autoriza publicação.');return 0;
 }
 try{
  const chosen={},seen=new Set();
  for(let i=0;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!['--mode','--root','--policy','--review','--at'].includes(k)||seen.has(k)||!v||v.startsWith('--'))throw Error();seen.add(k);chosen[k]=v;}
  const mode=chosen['--mode'];if(!['prepare','check'].includes(mode)||!chosen['--root']||!chosen['--policy']||(mode==='prepare'&&chosen['--review'])||(mode==='check'&&!chosen['--review']))throw Error();
  const policy=await readPrivateKnowledgeJson(chosen['--policy']),options=chosen['--at']?{at:chosen['--at']}:{};
  const result=mode==='prepare'?await prepareKnowledgeReview(chosen['--root'],policy,options):await evaluateKnowledgeReview(chosen['--root'],policy,await readPrivateKnowledgeJson(chosen['--review'],4194304),options);
  console.log(JSON.stringify(result,null,2));return mode==='prepare'||result.status==='private_selection_prepared'?0:2;
 }catch(e){
  // Only this closed set of codes is displayed; no paths, JSON fragments or raw errors.
  let code='knowledge_review_unavailable';
  try{const c=e&&typeof e==='object'?Object.getOwnPropertyDescriptor(e,'code')?.value:undefined;if(['knowledge_review_invalid','knowledge_review_stale','knowledge_review_selection_denied','knowledge_input_invalid','knowledge_policy_invalid'].includes(c))code=c;}catch{}
  console.error('Revisão não concluída ('+code+'). Nenhum conteúdo foi publicado; detalhes privados omitidos.');return 1;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
