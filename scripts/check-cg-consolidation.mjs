#!/usr/bin/env node
/** Read-only candidate preflight. Does not install tools or execute any SQL/test runner.
 * --postgres-bin names a trusted local tool directory, never a database URL.
 * Package fingerprints establish consistency only, not review or release approval.
 */
import {readFile,lstat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {inspectConsolidation} from './cg-consolidation-core.mjs';

const help=`Help Desk — preflight de consolidação (somente leitura)

node scripts/check-cg-consolidation.mjs [--root DIRETORIO]
  [--manifest ARQUIVO_JSON] [--postgres-bin DIRETORIO_CONFIAVEL]

Confere os arquivos declarados, migrations antigas e pré-requisitos mínimos.
Consulta apenas a versão do executável PostgreSQL local; não inicia banco.
Não conecta a bancos, executa testes, instala dependências, importa evidências,
aplica migrations ou publica código. Não lê credenciais de banco do ambiente.

Saída JSON: 0 = pré-requisitos observados; 2 = bloqueado ou entrada inválida.
Mesmo com saída 0, SQL, CI, revisão e aceite continuam pendentes.
`;
function options(args){
 const result={root:process.cwd(),manifest:fileURLToPath(new URL('../docs/operations/CG03I-CONSOLIDATION-INPUTS.json',import.meta.url)),postgresBin:null};
 const names=new Map([['--root','root'],['--manifest','manifest'],['--postgres-bin','postgresBin']]);
 const seen=new Set();
 for(let i=0;i<args.length;i++){
  const key=names.get(args[i]);
  if(!key||seen.has(key)||typeof args[i+1]!=='string'||!args[i+1]||args[i+1].startsWith('--'))throw Error();
  seen.add(key);result[key]=args[++i];
 }
 return result;
}
async function jsonFile(path){
 const info=await lstat(path);
 if(!info.isFile()||info.isSymbolicLink()||info.size>2*1024*1024)throw Error();
 return JSON.parse(await readFile(path,'utf8'));
}
async function dependencyVersions(root,spec){
 const entries=Object.keys(spec?.dependencies??{});
 if(!entries.length||entries.length>30||!entries.every(n=>/^(?:@[a-z0-9][a-z0-9-]*\/)?[a-z0-9][a-z0-9._-]*$/i.test(n)))throw Error();
 const versions={};
 for(const name of entries){
  try{
   // Read package metadata without requiring/importing package code or install scripts.
   const pkg=await jsonFile(join(root,'node_modules',name,'package.json'));
   if(typeof pkg.version==='string'&&/^\d+\.\d+\.\d+$/.test(pkg.version))versions[name]=pkg.version;
  }catch{/* Missing/unreadable metadata is an unverified dependency, not an installation. */}
 }
 return versions;
}
function postgresVersion(bin){
 try{
  const executable=bin===null?'postgres':join(resolve(bin),process.platform==='win32'?'postgres.exe':'postgres');
  const result=spawnSync(executable,['--version'],{encoding:'utf8',shell:false,timeout:2000,maxBuffer:8192,windowsHide:true});
  if(result.error||result.status!==0)return null;
  const match=/^postgres \(PostgreSQL\) (\d+\.\d+(?:\.\d+)?)(?:\s|$)/.exec(result.stdout.trim());
  return match?.[1]??null;
 }catch{return null;}
}
async function main(){
 if(process.argv.length===3&&process.argv[2]==='--help'){process.stdout.write(help);return;}
 try{
  const opts=options(process.argv.slice(2)),root=resolve(opts.root);
  const spec=await jsonFile(resolve(opts.manifest));
  const dependencies=await dependencyVersions(root,spec);
  const report=await inspectConsolidation(root,spec,{
   nodeVersion:process.versions.node,postgresVersion:postgresVersion(opts.postgresBin),dependencies,
  });
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  process.exitCode=report.status==='ready_for_existing_runners'?0:2;
 }catch{
  // Never echo paths, arguments, file contents, tool output or environment values.
  process.stdout.write(JSON.stringify({schemaVersion:1,stage:'preflight_only',status:'blocked',
   blockers:[{code:'invalid_preflight_input'}],sqlExecuted:false,ciExecuted:false,productionApproved:false})+'\n');
  process.exitCode=2;
 }
}
await main();
