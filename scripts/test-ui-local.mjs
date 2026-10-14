/** Each suite owns a fresh loopback fixture; never attach to an existing server. */
import {spawn} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {runCommand,stopOwned} from './local-process.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
async function freshDemo(work){
 const child=spawn(process.execPath,['--experimental-strip-types','scripts/demo.ts'],{cwd:root,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
 let timer,ended=false,ready=false,output='';const closed=new Promise(resolve=>child.once('close',()=>{ended=true;resolve();}));
 try{
  await new Promise((resolve,reject)=>{
   const fail=()=>{if(!ready)reject(Error('Não foi possível iniciar uma demonstração própria em loopback. Nenhum servidor existente será reutilizado.'));};
   child.once('error',fail);child.once('close',fail);child.stderr.on('data',()=>{});
   child.stdout.on('data',chunk=>{output=(output+chunk.toString()).slice(-4096);if(output.includes('Demonstração LOCAL: http://127.0.0.1:4317')){ready=true;clearTimeout(timer);resolve();}});
   timer=setTimeout(()=>reject(Error('Demonstração local não iniciou dentro do limite de execução.')),10_000);
  });
  return await work();
 }finally{
  clearTimeout(timer);if(!ended){stopOwned(child);const forced=setTimeout(()=>stopOwned(child,'SIGKILL'),1000);await closed;clearTimeout(forced);}
 }
}
try{
 let count=0;
 const operation=await freshDemo(()=>runCommand({command:['python','tests/browser-consultegeo-operation.py'],cwd:root,timeoutMs:120_000}));
 if(operation.exit_code!==0||operation.signal){console.error(operation.output);throw Error('Operação Consulte GEO: não aprovada.');}
 const operationChecks=JSON.parse(operation.stdout).checks;if(!Array.isArray(operationChecks)||!operationChecks.length||operationChecks.some(c=>c.result!=='passed'))throw Error('Operação Consulte GEO: asserções incompletas.');count+=operationChecks.length;console.log('Operação Consulte GEO: '+operationChecks.length+' verificações aprovadas.');
 for(const suite of [{name:'HTTP em memória',command:[process.execPath,'scripts/smoke-local-http.mjs']},{name:'Navegador em memória',command:['python','tests/browser-smoke.py']},{name:'Acesso simples atual (provedor sintético)',command:['python','tests/browser-simple-access.py']},{name:'Acesso avançado preservado (fixture explicitamente habilitada)',command:['python','tests/browser-human-session.py']},{name:'Recuperação explícita de notas (memória)',command:['python','tests/browser-note-recovery.py']},{name:'Membros (Auth e store sintéticos)',command:['python','tests/browser-admin-members.py'],ownsFixture:true},{name:'Checklist interno (HTTP e estado sintéticos)',command:['python','tests/browser-execution-checklist.py'],ownsFixture:true},{name:'M04 configuração Consulte GEO (HTTP e estado sintéticos)',command:['python','tests/browser-consultegeo-configuration.py'],ownsFixture:true},{name:'M06 workflow HTTPS (identidade e estado sintéticos)',command:['python','tests/browser-support-workflow.py'],ownsFixture:true},{name:'M09a formulários Consulte GEO (origem, identidade e store sintéticos)',command:['python','tests/browser-consultegeo-request.py'],ownsFixture:true}]){
  const run=()=>runCommand({command:suite.command,cwd:root,timeoutMs:120_000});
  const result=await (suite.ownsFixture?run():freshDemo(run));
  if(result.exit_code!==0||result.signal){console.error(result.output);throw Error(suite.name+': não aprovado.');}
  const json=JSON.parse(result.stdout),checks=Array.isArray(json)?json:json.checks;
  if(!Array.isArray(checks)||!checks.length||checks.some(c=>c.result!=='passed'))throw Error('Asserções da interface ausentes/incompletas.');
  count+=checks.length;console.log(suite.name+': '+checks.length+' verificações aprovadas.');
 }
 const visual=await runCommand({command:[process.execPath,'scripts/test-visual-local.mjs'],cwd:root,timeoutMs:500000});
 if(visual.exit_code!==0||visual.signal||visual.reason){console.error(visual.output);throw Error('UX10 composição visual: não aprovada.');}
 const visualChecks=JSON.parse(visual.stdout).checks;if(!Array.isArray(visualChecks)||visualChecks.length<324||visualChecks.some(c=>c.result!=='passed'))throw Error('UX10 asserções incompletas.');
 count+=visualChecks.length;console.log('UX10 composição visual: '+visualChecks.length+' verificações aprovadas.');
 console.log(`# tests ${count}\n# pass ${count}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0`);
}catch(error){console.error(error.message);process.exitCode=1;}
