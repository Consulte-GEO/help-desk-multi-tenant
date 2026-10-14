import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const script=new URL('../scripts/visual-opening/verify-integration.mjs',import.meta.url);
test('UX03 composition gate reports an incomplete checkout as blocked, never approved',()=>{
 assert.ok(existsSync(script),'composition verifier is implemented');
 const root=mkdtempSync(path.join(tmpdir(),'hd-ux03-composition-'));
 try{
  mkdirSync(path.join(root,'scripts/visual-opening'),{recursive:true});
  copyFileSync(script,path.join(root,'scripts/visual-opening/verify-integration.mjs'));
  const result=spawnSync(process.execPath,[path.join(root,'scripts/visual-opening/verify-integration.mjs')],{encoding:'utf8'});
  assert.equal(result.status,2);
  const evidence=JSON.parse(result.stdout);
  assert.equal(evidence.status,'blocked');
  assert.equal(evidence.integrated,false);
  assert.ok(evidence.missing.includes('web/app.js'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('UX03 composition gate rejects a complete file list with absent controller wiring',()=>{
 assert.ok(existsSync(script),'composition verifier is implemented');
 const root=mkdtempSync(path.join(tmpdir(),'hd-ux03-composition-'));
 try{
  mkdirSync(path.join(root,'scripts/visual-opening'),{recursive:true});
  copyFileSync(script,path.join(root,'scripts/visual-opening/verify-integration.mjs'));
  for(const p of ['web/app.js','web/index.html','scripts/build.mjs','scripts/demo.ts','web/opening-flow.js','web/opening-wizard.js','web/form-feedback.js','web/form-experience.css','web/dynamic-form.js','web/dynamic-form.css']){
   mkdirSync(path.dirname(path.join(root,p)),{recursive:true});writeFileSync(path.join(root,p),'// synthetic placeholder, not application code\n');
  }
  const result=spawnSync(process.execPath,[path.join(root,'scripts/visual-opening/verify-integration.mjs')],{encoding:'utf8'});
  assert.equal(result.status,1);
  const evidence=JSON.parse(result.stdout);
  assert.equal(evidence.status,'failed');assert.equal(evidence.integrated,false);
  assert.ok(evidence.checks.some((c:any)=>c.passed===false));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('UX03 static gate recognizes the delivered assets but never labels a synthetic fixture integrated',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'hd-ux03-composition-'));
 try{
  for(const p of ['scripts/visual-opening/verify-integration.mjs','web/index.html','scripts/build.mjs','scripts/demo.ts','web/opening-flow.js','web/opening-wizard.js','web/form-feedback.js','web/form-experience.css','web/dynamic-form.js','web/dynamic-form.css']){
   mkdirSync(path.dirname(path.join(root,p)),{recursive:true});copyFileSync(new URL('../'+p,import.meta.url),path.join(root,p));
  }
  // These strings are deliberately NOT a runnable controller. This tests only
  // the static checker and asset syntax. It is not integration evidence.
  const text=[
   "let openingUX=null; import('./opening-wizard.js').then(({mountOpeningWizard})=>{",
   "if($('create-dialog').open)$('create-dialog').addEventListener('close',mount,{once:true});",
   'openingUX=mountOpeningWizard(document);renderCatalog();',
   'function clearSession(){inboxUX?.reset();openingUX?.reset();recoveryPanel.clear();',
   "openingUX?.update({status,canSubmit:catalog.canSubmit(),pending:!!s.createPending,unresolved:unresolvedCreate(),ambiguous:!$('coverage-label').hidden});",
   "resetOpening();$('create-dialog').showModal();openingUX?.open();if(unresolvedCreate())",
   'retryCreateIntent(operation,createIdentity());creation.confirm(operation,t);'
  ].join('\n');
  writeFileSync(path.join(root,'web/app.js'),text);
  const result=spawnSync(process.execPath,[path.join(root,'scripts/visual-opening/verify-integration.mjs')],{encoding:'utf8'});
  assert.equal(result.status,0,result.stdout+result.stderr);
  const evidence=JSON.parse(result.stdout);assert.equal(evidence.status,'passed');assert.equal(evidence.integrated,false);assert.equal(evidence.failed,0);
 }finally{rmSync(root,{recursive:true,force:true});}
});
