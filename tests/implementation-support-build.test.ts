import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,access,rmdir,rm} from 'node:fs/promises';import{tmpdir}from'node:os';import{join}from'node:path';
const {sourceFingerprint}=await import(new URL('../scripts/homologation-core.mjs',import.meta.url).href);
test('homologation binds implantation sources and locks but excludes dependencies and generated bundles',async()=>{
 const root=await mkdtemp(join(tmpdir(),'implantacao-source-'));
 try{
  const before=await sourceFingerprint(root);
  const src=join(root,'modules/implantacao/frontend/src');await mkdir(src,{recursive:true});await writeFile(join(src,'support-app.ts'),'first-source');
  const source=await sourceFingerprint(root);assert.notEqual(source,before,'module code must be bound');
  await writeFile(join(root,'modules/implantacao/frontend/package-lock.json'),'first-lock');const lock=await sourceFingerprint(root);assert.notEqual(lock,source,'nested lock must be bound');
  for(const folder of ['node_modules/vendor','dist-support','dist','../.support-validation','../.laudo-validation','../.v8-validation','../.v13-validation','../.laudo-build']){await mkdir(join(root,'modules/implantacao/frontend',folder),{recursive:true});await writeFile(join(root,'modules/implantacao/frontend',folder,'generated.js'),'cache');}
  assert.equal(await sourceFingerprint(root),lock,'generated/dependency bytes must not invalidate source evidence');
  await writeFile(join(src,'support-app.ts'),'changed-source');assert.notEqual(await sourceFingerprint(root),lock);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('static implantation graph refuses historical HTML, SQL, maps and private trees before copying',async()=>{
 const {copyImplementationAssets}=await import('../scripts/implantacao-assets.mjs');
 const root=await mkdtemp(join(tmpdir(),'implantacao-public-'));
 try{
  const source=join(root,'source');await mkdir(source);await writeFile(join(source,'support-app.js'),'native entry');
  await mkdir(join(source,'chunks'));await writeFile(join(source,'chunks/module.js'),'native chunk');
  await copyImplementationAssets(source,join(root,'good'));
  assert.equal(await readFile(join(root,'good/chunks/module.js'),'utf8'),'native chunk');
  for(const file of ['legacy.html','migration.sql','support-app.js.map','private/config.json','tests/fixture.json']){
   await mkdir(join(source,file,'..'),{recursive:true});await writeFile(join(source,file),'private fixture');
   await assert.rejects(copyImplementationAssets(source,join(root,'bad')),/Unsafe|Unreviewed/);
   await assert.rejects(access(join(root,'bad/support-app.js')));
   await rm(join(source,file));
   if(file.includes('/'))await rmdir(join(source,file.split('/')[0]!));
  }
 }finally{await rm(root,{recursive:true,force:true});}
});
