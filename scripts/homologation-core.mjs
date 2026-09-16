/** Local evidence, not a signed attestation or proof of production platform readiness. */
import {createHash} from 'node:crypto';
import {lstat,readFile,readdir,realpath} from 'node:fs/promises';
import {join,relative,sep} from 'node:path';
export const steps = Object.freeze([
 {id:'lock',requires:[],command:['node','scripts/verify-lock.mjs'],timeout:60_000,minTests:0},
 {id:'install',requires:['lock'],command:['npm','ci','--ignore-scripts'],timeout:600_000,minTests:0},
 {id:'audit',requires:['install'],command:['npm','audit','--audit-level=high'],timeout:300_000,minTests:0},
 {id:'application',requires:['install'],command:['npm','run','verify'],timeout:300_000,minTests:569},
 {id:'postgres',requires:['install'],command:['npm','run','test:db:local'],timeout:600_000,minTests:82},
 {id:'interface',requires:['application'],command:['node','scripts/test-ui-local.mjs'],timeout:300_000,minTests:44}
]);
const hash = text => createHash('sha256').update(text).digest('hex');
export function testCounts(output) {
 const fields=['tests','pass','fail','cancelled','skipped','todo'],result={};
 for(const name of fields){const found=[...output.matchAll(new RegExp('^# '+name+' (\\d+)\\r?$','gm'))];if(found.length!==1)return null;result[name]=Number(found[0][1]);}
 return result;
}
const countOK=(counts,min)=>!min||!!counts&&Number.isSafeInteger(counts.tests)&&counts.tests>=min&&counts.pass===counts.tests
 &&counts.fail===0&&counts.cancelled===0&&counts.skipped===0&&counts.todo===0;
export async function runChecks({fingerprint,execute,now=()=>new Date().toISOString()}) {
 const report={schema:1,scope:'local-m1',platform_approved:false,source_sha256:fingerprint,started_at:now(),completed_at:null,checks:[]};
 for(const step of steps){
  if(step.requires.some(id=>!report.checks.some(c=>c.id===id&&c.status==='passed'))){
   report.checks.push({id:step.id,status:'blocked',reason:'prerequisite_not_passed',exit_code:null,signal:null,tests:null});continue;
  }
  try{
   const result=await execute(step),counts=step.minTests?testCounts(result.output):null;
   const passed=result.exit_code===0&&!result.signal&&countOK(counts,step.minTests);
   report.checks.push({id:step.id,status:passed?'passed':'failed',reason:passed?null:'command_or_assertions_failed',exit_code:result.exit_code,
    signal:result.signal??null,artifact:result.artifact,sha256:result.sha256,tests:counts});
  }catch{
   // Exception messages can contain connection strings, so they are deliberately excluded.
   report.checks.push({id:step.id,status:'failed',reason:'executor_failed',exit_code:null,signal:null,tests:null});
  }
 }
 report.completed_at=now();return report;
}
export function validateReport(report,currentFingerprint,now=new Date()) {
 const reject=()=>{throw Error('PUBLICAÇÃO BLOQUEADA: evidência local incompleta, vencida ou incompatível com este código.');};
 if(report?.source_changed_during_run===true||report?.schema!==1||report.scope!=='local-m1'||report.platform_approved!==false
   ||!/^[a-f0-9]{64}$/.test(report.source_sha256??'')||report.source_sha256!==currentFingerprint
   ||!Array.isArray(report.checks)||report.checks.length!==steps.length)reject();
 const started=Date.parse(report.started_at),ended=Date.parse(report.completed_at),age=now.getTime()-ended;
 if(!Number.isFinite(started)||!Number.isFinite(ended)||ended<started||age<0||age>7*24*60*60*1000)reject();
 for(const step of steps){
  const matches=report.checks.filter(c=>c?.id===step.id);if(matches.length!==1)reject();const c=matches[0];
  if(c.status!=='passed'||c.exit_code!==0||c.signal!==null||!countOK(c.tests,step.minTests)
   ||!/^runs\/[a-zA-Z0-9-]+\/[a-z]+\.log$/.test(c.artifact??'')||!/^[a-f0-9]{64}$/.test(c.sha256??''))reject();
 }
}
export async function verifyLogs(report,directory) {
 const base=await realpath(directory);
 for(const step of steps){
  const check=report.checks.find(c=>c.id===step.id);
  if(!check||!/^runs\/[a-zA-Z0-9-]+\/[a-z]+\.log$/.test(check.artifact??''))throw Error('Arquivo de evidência inválido.');
  const candidate=join(base,check.artifact),resolved=await realpath(candidate),rel=relative(base,resolved);
  if(rel.startsWith('..'+sep)||rel==='..'||rel.startsWith(sep)||(await lstat(candidate)).isSymbolicLink())throw Error('Evidência fora do diretório autorizado.');
  const bytes=await readFile(resolved);
  if(hash(bytes)!==check.sha256)throw Error('Arquivo de evidência alterado ou incompatível.');
  if(step.minTests&&(!countOK(testCounts(bytes.toString('utf8')),step.minTests)
   ||JSON.stringify(testCounts(bytes.toString('utf8')))!==JSON.stringify(check.tests)))throw Error('Contagem de testes não corresponde ao log.');
 }
}
/** Hash every relevant source/config/test file, including new/untracked source files. */
export async function sourceFingerprint(root) {
 const roots=['src','scripts','tests','supabase','web','netlify','.github','package.json','package-lock.json','tsconfig.json',
  'netlify.toml','.gitignore','.npmrc','.nvmrc','.env.example','docs/openapi.json'];
 const files=[];
 async function walk(path){
  let stat;try{stat=await lstat(path);}catch(e){if(e.code==='ENOENT')return;throw e;}
  if(stat.isSymbolicLink())throw Error('Fontes simbólicas não são aceitas para homologação.');
  if(stat.isDirectory()){for(const name of (await readdir(path)).sort())if(name!=='__pycache__')await walk(join(path,name));}
  else if(stat.isFile())files.push(path);
  else throw Error('Tipo de fonte não suportado para homologação.');
 }
 for(const path of roots)await walk(join(root,path));
 const digest=createHash('sha256');
 for(const path of files.sort()){digest.update(relative(root,path).split(sep).join('/')+'\0');digest.update(hash(await readFile(path))+'\0');}
 return digest.digest('hex');
}
