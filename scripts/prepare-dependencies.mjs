/** Explicit local resolution; never fabricates a lockfile or replaces npm ci with npm install on CI. */
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../',import.meta.url));
if(!process.argv.includes('--resolve')){console.error('Use --resolve para gerar o primeiro lockfile localmente, depois revise o diff e os alertas.');process.exitCode=1;}
else{
 for(const args of [['install','--package-lock-only','--ignore-scripts','--fetch-timeout=10000','--fetch-retries=0'],['ci','--ignore-scripts'],['audit','--audit-level=high']]){
  const r=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{cwd,stdio:'inherit'});
  if(r.error||r.status!==0){console.error('Resolução/instalação/auditoria NÃO concluída. Gate de publicação continua fechado.');process.exitCode=1;break;}
 }
}
