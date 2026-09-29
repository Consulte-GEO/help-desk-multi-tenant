/** Linux CI only. Read a committed source, preserve checkout history, stage NEW evidence. */
import {spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,writeFile,lstat,realpath,rm,appendFile} from 'node:fs/promises';
import {join,relative,isAbsolute,resolve,sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sourceFingerprint} from './homologation-core.mjs';

const within=(base,target)=>{const r=relative(base,target);return !r||(!r.startsWith('..'+sep)&&r!=='..'&&!isAbsolute(r));};
function command(binary,args,cwd){
 const env={...process.env};
 for(const key of Object.keys(env))if(key.startsWith('GIT_')||key.startsWith('TAR_'))delete env[key];
 const r=spawnSync(binary,args,{cwd,env,encoding:'utf8',timeout:30_000,maxBuffer:16*1024*1024});
 // Tool stderr may contain local configuration. Never publish it in the receipt.
 if(r.error||r.signal||r.status!==0)throw Error('CI source preparation failed.');
 return r.stdout;
}
/** No network, dependency installation, database, historical evidence or approval. */
export async function stageCiSource({checkout,tempParent,commit,runId,attempt,platform=process.platform}){
 if(platform!=='linux'||[commit,runId,attempt].some(v=>typeof v!=='string')||!/^[a-f0-9]{40}$/.test(commit??'')||! /^[1-9][0-9]{0,19}$/.test(runId??'')
  ||! /^[1-9][0-9]{0,9}$/.test(attempt??'')||typeof checkout!=='string'||typeof tempParent!=='string'
  ||!isAbsolute(checkout)||!isAbsolute(tempParent)||/[\r\n\0]/.test(checkout+tempParent))throw Error('Invalid CI source context.');
 const base=await realpath(checkout),parent=await realpath(tempParent);
 if(/[\r\n\0]/.test(base+parent)||within(base,parent)||!(await lstat(base)).isDirectory()||!(await lstat(parent)).isDirectory())throw Error('Invalid CI staging directory.');
 if(command('git',['rev-parse','--show-toplevel'],base).trim()!==base
  ||command('git',['rev-parse','--verify','HEAD'],base).trim()!==commit)throw Error('CI commit does not match checkout.');
 const tree=command('git',['ls-tree','-rz','--full-tree',commit],base).split('\0').filter(Boolean);
 for(const entry of tree){
  const tab=entry.indexOf('\t'),header=entry.slice(0,tab),path=entry.slice(tab+1);
  if(path==='evidence'||path.startsWith('evidence/'))continue;
  if(tab<0||!/^100(644|755) blob [a-f0-9]{40}$/.test(header)||/[\r\n\\]/.test(path)
    ||path.startsWith('/')||path.split('/').some(p=>p==='..'||p==='.'||!p))throw Error('Unsupported CI source entry.');
 }
 const before=await sourceFingerprint(base),owned=await mkdtemp(join(parent,'helpdesk-ci-')),root=join(owned,'source');
 try{
  await mkdir(root);
  const archive=join(owned,'source.tar');
  command('git',['archive','--format=tar','--output='+archive,commit],base);
  command('tar',['--extract','--file='+archive,'--directory='+root,'--anchored','--exclude=evidence','--exclude=evidence/*','--no-same-owner'],base);
  await rm(archive);
  const fingerprint=await sourceFingerprint(root);
  if(fingerprint!==before||await sourceFingerprint(base)!==before)throw Error('CI archive differs from current source.');
  // No history is removed in the original checkout. A fresh staging directory must be empty of evidence.
  await mkdir(join(root,'evidence'));await mkdir(join(root,'evidence','ci'));
  const receipt={schema:1,scope:'ci-source-only',commit,run_id:runId,run_attempt:attempt,
   source_sha256:fingerprint,created_at:new Date().toISOString(),historical_evidence_included:false,
   tests_executed:false,platform_approved:false};
  await writeFile(join(root,'evidence','ci','source.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
  return {root,source_sha256:fingerprint};
 }catch(error){
  // Only this invocation's mkdtemp directory is owned; never clean the checkout or a pre-existing target.
  await rm(owned,{recursive:true,force:true});throw error;
 }
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
 try{
  if(process.argv.length!==2)throw Error('Arguments not supported.');
  const output=process.env.GITHUB_OUTPUT;
  if(!output||!isAbsolute(output)||/[\r\n\0]/.test(output))throw Error('Missing CI output.');
  const stat=await lstat(output);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Invalid CI output.');
  const result=await stageCiSource({checkout:process.env.GITHUB_WORKSPACE,tempParent:process.env.RUNNER_TEMP,
   commit:process.env.GITHUB_SHA,runId:process.env.GITHUB_RUN_ID,attempt:process.env.GITHUB_RUN_ATTEMPT});
  await appendFile(output,`root=${result.root}\nsource_sha256=${result.source_sha256}\n`);
  console.log('Fonte CI isolada; nenhum teste executado ou ambiente liberado.');
 }catch{console.error('Preparação de fonte CI não aprovada. Checkout e evidências históricas preservados.');process.exitCode=1;}
}
