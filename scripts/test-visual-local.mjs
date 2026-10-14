/** Original UI/controller in owned offline browsers. No hosted or origin approval. */
import {readFile,mkdir,mkdtemp,lstat,realpath} from 'node:fs/promises';import {createHash} from 'node:crypto';import {join,resolve,relative,sep} from 'node:path';import {fileURLToPath} from 'node:url';import {runCommand} from './local-process.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const defaults={app:{minimum:134,cases:23,requiredSources:['web/app.js','web/human-session.js','web/session-fetch.js']},journey:{minimum:190,requiredSources:['web/consultegeo-request.js','web/consultegeo-intake-api.js','web/support-intake.js','web/dynamic-form.js','web/consultegeo-configuration.js','web/human-session.js','web/session-fetch.js']}};
const refuse=()=>{throw Error('Relatório visual incompleto ou incompatível com a fonte.');};
export async function validateVisualReport(checkout,raw,kind,policy=defaults[kind]){
 if(!policy||!raw||typeof raw!=='object'||Array.isArray(raw))refuse();
 if(kind==='app'?(raw.mode!=='offline-full-app-synthetic-transport'||raw.original_controller_replaced!==false||raw.legacy_css_loaded!==true):kind==='journey'?raw.scope!=='offline-native-ui-and-adapters; synthetic identity/server; not PostgreSQL or HTTP authorization':true)refuse();
 if(!Array.isArray(raw.checks)||raw.checks.length<(policy.minimum??1)||raw.checks.length>5000||raw.checks.some(c=>!c||typeof c.name!=='string'||!c.name.length||c.name.length>300||c.passed!==true)||raw.failed!==0||raw.passed!==raw.checks.length)refuse();
 if(policy.cases&&(!Array.isArray(raw.cases)||raw.cases.length!==policy.cases||raw.cases.some(c=>c.passed!==true||!Number.isSafeInteger(c.checks)||c.checks<1)||raw.cases.reduce((n,c)=>n+c.checks,0)!==raw.checks.length))refuse();
 const sources=kind==='app'?raw.source_sha256:raw.sources;if(!sources||typeof sources!=='object'||Array.isArray(sources))refuse();
 const normalized=new Map(),base=await realpath(checkout);
 for(const [name,hash] of Object.entries(sources)){
  const path=name.replaceAll('\\','/');if(!/^(web|shared|scripts)\/[A-Za-z0-9_.\-/]+$/.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..')||normalized.has(path)||typeof hash!=='string'||!/^[a-f0-9]{64}$/.test(hash))refuse();
  let file=base;for(const part of path.split('/')){file=join(file,part);if((await lstat(file)).isSymbolicLink())refuse();}
  if(!(await lstat(file)).isFile()||relative(base,await realpath(file)).startsWith('..'+sep)||createHash('sha256').update(await readFile(file)).digest('hex')!==hash)refuse();normalized.set(path,hash);
 }
 if((policy.requiredSources??[]).some(path=>!normalized.has(path)))refuse();
 return raw.checks.map(c=>({check:kind+': '+c.name,result:'passed'}));
}
async function main(){
 const parent=join(root,'evidence/consultegeo-ux10/visual-runs');await mkdir(parent,{recursive:true});const output=await mkdtemp(join(parent,'run-')),checks=[];
 for(const [kind,script] of [['journey','scripts/visual-consultegeo/browser-check.py'],['app','scripts/visual-integration/browser-check.py']]){
  const destination=join(output,kind),result=await runCommand({command:['python','-X','utf8',script,'--output',destination],cwd:root,timeoutMs:240000});
  if(result.exit_code!==0||result.signal||result.reason)throw Error('Verificação visual '+kind+' falhou: '+result.output.slice(-2000));
  const raw=JSON.parse(await readFile(join(destination,'results.json'),'utf8'));checks.push(...await validateVisualReport(root,raw,kind));
 }
 console.log(JSON.stringify({scope:'owned-offline-UI; synthetic identity/transport; not hosted approval',checks}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
