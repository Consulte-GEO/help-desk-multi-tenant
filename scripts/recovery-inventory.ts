/** Explicit local read-only operator CLI. Redirect stdout outside the input root. */
import {resolve,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {inventoryRecoveryFiles} from '../src/infrastructure/recovery-files.ts';
import {compareRecoveryInventory,parseRecoveryInventory} from '../src/domain/recovery-plan.ts';
import {readPrivateKnowledgeJson} from './knowledge-local-input.mjs';
const algorithm='helpdesk-file-tree-v1';
export async function main(args=process.argv.slice(2)):Promise<number>{
 if(args.length===1&&args[0]==='--help'){
  console.log('Uso: node --experimental-strip-types scripts/recovery-inventory.ts --root <bancada-privada> [--expected <manifesto.json>]\nSomente leitura local; sem restore, rede ou envio. Seis diretórios obrigatórios: database, objects, configuration, key_inventory, outbox, revocations. Redirecione a saída para fora da raiz. Exit0 = inventário concluído/igual;2 = divergência;1 = inspeção incompleta. Igualdade não autoriza produção.');return 0;
 }
 try{
  const selected:Record<string,string>={},seen=new Set<string>();for(let i=0;i<args.length;i+=2){const k=args[i],v=args[i+1];if(!k||!['--root','--expected'].includes(k)||seen.has(k)||!v||v.startsWith('--'))throw Error();seen.add(k);selected[k]=v;}
  const root=selected['--root'];if(!root)throw Error();let expected;
  if(selected['--expected']){
   const path=resolve(selected['--expected']),inside=relative(resolve(root),path);if(!inside||!isAbsolute(inside)&&inside!=='..'&&!inside.startsWith('..'+(process.platform==='win32'?'\\':'/')))throw Error();
   const raw:unknown=await readPrivateKnowledgeJson(path);if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).sort().join(',')!=='algorithm,inventory,schemaVersion')throw Error();const manifest=raw as Record<string,unknown>;if(manifest.schemaVersion!==1||manifest.algorithm!==algorithm)throw Error();expected=parseRecoveryInventory(manifest.inventory);
  }
  const inventory=await inventoryRecoveryFiles(root),manifest={schemaVersion:1,algorithm,inventory};
  if(expected){const verification=compareRecoveryInventory(expected,inventory);console.log(JSON.stringify({...manifest,verification},null,2));return verification.state==='mismatch'?2:0;}
  console.log(JSON.stringify(manifest,null,2));return 0;
 }catch{console.error('Inspeção não concluída: argumentos, cópia ou manifesto inválidos, incompletos ou alterados. Nenhum detalhe privado é exibido.');return 1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
