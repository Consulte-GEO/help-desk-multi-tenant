#!/usr/bin/env node
'use strict';
// Aplicação LOCAL de pacote versionado. Padrão somente --check.
// Não executa rede, instalação de pacotes, migration, commit, push ou deploy.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const cp = require('node:child_process');
const BASE_COMMIT = 'dcf5607652281bb688f366e6a4f05e07eb698d31';
const NEW_VERSION = '5.0.22-55';
const digest = content => crypto.createHash('sha256').update(content).digest('hex');
function utf8(buffer) { return new TextDecoder('utf-8',{fatal:true}).decode(buffer); }
function canonical(buffer) { return utf8(buffer).replace(/\r\n/g,'\n'); }
function blob(content) { return crypto.createHash('sha1').update('blob '+Buffer.byteLength(content)+'\0').update(content).digest('hex'); }
function fail(code, detail='') { throw new Error(code+(detail?': '+detail:'')); }
function safePath(root, relative) {
  if (typeof relative!=='string' || !relative || relative.includes('\\') || relative.includes('\0') || path.isAbsolute(relative) ||
      relative.split('/').some(part=>!part || part==='.' || part==='..' || part==='.git')) fail('UNSAFE_PATH',String(relative));
  let current = root;
  for (const part of relative.split('/')) {
    current=path.join(current,part);
    if(fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) fail('SYMLINK',relative);
    try { if(fs.lstatSync(current).isSymbolicLink()) fail('SYMLINK',relative); }
    catch(error) { if(error.code!=='ENOENT') throw error; }
  }
  return current;
}
function replaceOnce(source, before, after) {
  if (!before || source.split(before).length!==2) fail('ANCHOR_COUNT',before.slice(0,60));
  return source.replace(before,()=>after);
}
function transform(source, entry) {
  if (entry.kind==='importer') {
    source=replaceOnce(source,'<script src="./assets/similarity-engine.js"></script>',
      '<script src="./assets/similarity-engine.js?v=2.0.0"></script>\n'+
      '<script src="./assets/import-integrity.js?v=1.0.0"></script>\n'+
      '<script src="./assets/import-legacy-adapter.js?v=1.1.0"></script>');
    source=replaceOnce(source,"const APP_VERSION='3.4.0';","const APP_VERSION='3.6.0';");
    const install = '// IMP-01 R02: montagem explícita; componentes incompatíveis impedem o BOOT.\n'+
      'try {\n'+
      '  if (!window.ImportLegacyAdapter || window.ImportLegacyAdapter.VERSION!=="1.1.0") throw new Error("INCOMPATIBLE_IMPORT_ADAPTER");\n'+
      '  window.ImportLegacyAdapter.install({appState,Converter,Actions,Validators,Exporter,UI,Utils,Toast,Similarity,\n'+
      '    integrity:window.ImportIntegrity,requiredFields:REQUIRED_FIELDS,document});\n'+
      '} catch (error) {\n'+
      '  const notice=document.createElement("p");notice.setAttribute("role","alert");\n'+
      '  notice.textContent="A atualização do importador está incompleta. Recarregue a página ou procure o suporte. Nenhum arquivo foi importado.";\n'+
      '  document.getElementById("app").replaceChildren(notice);throw error;\n'+
      '}\n';
    source=replaceOnce(source,'STORAGE.load();',install+'STORAGE.load();');
    const start = source.indexOf("<script>\n'use strict';");
    if(start<0 || source.indexOf("<script>\n'use strict';",start+1)>=0) fail('INLINE_SCRIPT_BOUNDARY');
    const end = source.indexOf('</script>',start);
    if(end<0)fail('INLINE_SCRIPT_BOUNDARY');
    new vm.Script(source.slice(start+'<script>\n'.length,end),{filename:'importa.html:inline'});
    return source;
  }
  if (entry.kind==='package-version' || entry.kind==='lock-version') {
    const data=JSON.parse(source);
    const expected=entry.kind==='package-version'?'5.0.22-51':'5.0.22-45';
    if(data.version!==expected)fail('VERSION_MISMATCH');
    data.version=NEW_VERSION;
    if(entry.kind==='lock-version') {
      if(data.lockfileVersion!==3 || data.packages?.['']?.version!==expected) fail('LOCK_ROOT_MISMATCH');
      data.packages[''].version=NEW_VERSION;
    } else {
      data.scripts={...data.scripts,'test:import-integrity':'node --test ../tools/tests/import-integrity/*.test.cjs','test:import-process':'node --experimental-strip-types --test ../tools/tests/import-process/*.test.mjs','typecheck:import-process':'tsc -p ../modules/import-process/tsconfig.json','typecheck:import-process-client':'tsc -p ../modules/import-process-client/tsconfig.json','test:import-process:postgres':'node --experimental-strip-types ../tools/qualify-import-process-postgres.mjs'};
    }
    return JSON.stringify(data,null,2)+'\n';
  }
  if(entry.kind==='netlify') {
    if(source.includes('# IMP-01 R02:'))fail('ALREADY_APPLIED');
    return source+'\n# IMP-01 R02: motores sem hash no nome nao usam cache imutavel.\n'+
      '[[headers]]\n  for = "/assets/import-*.js"\n  [headers.values]\n    Cache-Control = "public, max-age=0, must-revalidate"\n'+
      '\n[[headers]]\n  for = "/assets/similarity-*.js"\n  [headers.values]\n    Cache-Control = "public, max-age=0, must-revalidate"\n';
  }
  fail('UNSUPPORTED_TRANSFORM',entry.kind);
}
function planPackage(repoRoot, packageRoot, manifest) {
  repoRoot=fs.realpathSync(repoRoot);packageRoot=fs.realpathSync(packageRoot);
  if(!Array.isArray(manifest.entries) || !manifest.entries.length || manifest.entries.length>500)fail('INVALID_MANIFEST');
  const seen=new Set();
  return manifest.entries.map(entry=>{
    const destination=safePath(repoRoot,entry.path);
    if(seen.has(destination))fail('DUPLICATE_DESTINATION');seen.add(destination);
    let old=null;
    try {if(!fs.statSync(destination).isFile())fail('NOT_A_FILE',entry.path);old=fs.readFileSync(destination);}
    catch(error){if(error.code!=='ENOENT')throw error;}
    if(entry.beforeBlob===null) {
      if(old!==null)fail('TARGET_ALREADY_EXISTS',entry.path);
    } else {
      if(typeof entry.beforeBlob!=='string' || !/^[a-f0-9]{40}$/.test(entry.beforeBlob))fail('INVALID_BASE_BLOB');
      if(old===null || blob(canonical(old))!==entry.beforeBlob)fail('BASE_BLOB_MISMATCH',entry.path);
    }
    let text;
    if(entry.kind==='file') {
      const payload=safePath(packageRoot,entry.payload),bytes=fs.readFileSync(payload);
      if(digest(bytes)!==entry.sha256)fail('PAYLOAD_HASH_MISMATCH',entry.payload);
      text=canonical(bytes);
    } else if(entry.kind==='verify') text=canonical(old);
    else text=transform(canonical(old),entry);
    const crlf=old!==null && utf8(old).includes('\r\n');
    const content=Buffer.from(crlf?text.replace(/\n/g,'\r\n'):text);
    return {repoRoot,path:entry.path,destination,old,content,readonly:entry.kind==='verify',
      beforeHash:old===null?null:digest(old),afterHash:digest(content)};
  });
}
function assertUnchanged(item) {
  safePath(item.repoRoot,item.path);
  let current=null;
  try{if(fs.lstatSync(item.destination).isSymbolicLink())fail('SYMLINK');current=fs.readFileSync(item.destination);}
  catch(error){if(error.code!=='ENOENT')throw error;}
  if((current===null?null:digest(current))!==item.beforeHash) fail('CHANGED_AFTER_CHECK',item.path);
}
function applyPlan(plan) {
  plan.forEach(assertUnchanged);
  const changed=[];
  try {
    for(const item of plan) {
      if(item.readonly)continue;
      // Segundo check imediatamente antes de cada gravação. O checkout deve
      // permanecer exclusivo; não há transação global de filesystem.
      assertUnchanged(item);
      fs.mkdirSync(path.dirname(item.destination),{recursive:true});
      safePath(item.repoRoot,item.path);
      const temp=item.destination+'.imp-r04-'+crypto.randomUUID()+'.tmp';
      try {fs.writeFileSync(temp,item.content,{flag:'wx'});fs.renameSync(temp,item.destination);}
      finally {if(fs.existsSync(temp))fs.unlinkSync(temp);}
      changed.push(item);
    }
  } catch(error) {
    const failures=[];
    for(const item of changed.reverse()) {
      try {if(item.old===null)fs.unlinkSync(item.destination);else fs.writeFileSync(item.destination,item.old);}
      catch(rollbackError){failures.push(item.path+': '+rollbackError.message);}
    }
    if(failures.length)fail('ROLLBACK_INCOMPLETE',error.message+'; '+failures.join('; '));
    throw error;
  }
}
function git(repo,args){return cp.execFileSync('git',['-C',repo,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function validateManifestIdentity(manifest) {
  if(manifest.baseCommit!==BASE_COMMIT || manifest.repository!=='Consulte-GEO/setup-implantacao-obras' || manifest.format!=='consultegeo.local-change-package.v1')fail('MANIFEST_IDENTITY_MISMATCH');
  if(manifest.releaseCandidate!==NEW_VERSION)fail('MANIFEST_RELEASE_MISMATCH');
  if(manifest.packageRevision!=='R04')fail('MANIFEST_PACKAGE_MISMATCH');
}
function main(argv) {
  let repo, pkg=__dirname, apply=false;
  for(let n=0;n<argv.length;n++) {
    if(argv[n]==='--repo')repo=argv[++n];
    else if(argv[n]==='--package')pkg=argv[++n];
    else if(argv[n]==='--apply')apply=true;
    else if(argv[n]==='--check')continue;
    else if(argv[n]==='--help'){console.log('node aplicar-r04.cjs --repo CAMINHO_DO_CHECKOUT [--package PACOTE] [--check|--apply]');return;}
    else fail('UNKNOWN_ARGUMENT',argv[n]);
  }
  if(!repo)fail('REPO_REQUIRED');
  repo=fs.realpathSync(repo);pkg=fs.realpathSync(pkg);
  if(fs.realpathSync(git(repo,['rev-parse','--show-toplevel']))!==repo)fail('REPO_ROOT_REQUIRED');
  const branch=git(repo,['branch','--show-current']);
  if(!branch || ['main','master','codex/m1-reproducibilidade'].includes(branch))fail('ISOLATED_BRANCH_REQUIRED');
  if(git(repo,['status','--porcelain']))fail('CLEAN_CHECKOUT_REQUIRED');
  git(repo,['merge-base','--is-ancestor',BASE_COMMIT,'HEAD']);
  const manifest=JSON.parse(fs.readFileSync(path.join(pkg,'MANIFEST.json'),'utf8'));
  validateManifestIdentity(manifest);
  const plan=planPackage(repo,pkg,manifest);
  const head=git(repo,['rev-parse','HEAD']);
  if(apply)applyPlan(plan);
  console.log(JSON.stringify({mode:apply?'applied_locally':'check_only',repository:manifest.repository,baseCommit:BASE_COMMIT,head,branch,
    releaseCandidate:NEW_VERSION,operational:false,files:plan.map(x=>({path:x.path,readonly:x.readonly,beforeSha256:x.beforeHash,afterSha256:x.afterHash}))},null,2));
}
module.exports={BASE_COMMIT,NEW_VERSION,validateManifestIdentity,blob,transform,planPackage,applyPlan,main};
if(require.main===module){try{main(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}}
