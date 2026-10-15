import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('../modules/implantacao/frontend/',import.meta.url));
const npm=process.platform==='win32'?'npm.cmd':'npm';
for(const [command,args] of [[npm,['ci','--ignore-scripts']],[process.execPath,['support-typecheck.mjs']],[npm,['exec','vite','build','--','--config','vite.support.config.ts']]]){
  const result=spawnSync(command,args,{cwd,stdio:'inherit',shell:command===npm&&process.platform==='win32'});
  if(result.error)throw result.error;
  if(result.status!==0)process.exit(result.status??1);
}
