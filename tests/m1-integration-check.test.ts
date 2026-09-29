import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm, symlink, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const modulePath='../scripts/homologation-core.mjs';
const {sourceFingerprint}=await import(modulePath);
const cli=resolve('scripts/check-integration.mjs');
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const patch='diff --git a/src/value.ts b/src/value.ts\nindex 1234567..2345678 100644\n--- a/src/value.ts\n+++ b/src/value.ts\n@@ -1 +1 @@\n-export const value=1;\n+export const value=2;\n';
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'helpdesk integration ')),checkout=join(root,'checkout'),pack=join(root,'package');
 await mkdir(join(checkout,'src'),{recursive:true});await mkdir(join(pack,'patches'),{recursive:true});
 await writeFile(join(checkout,'src/value.ts'),'export const value=1;\n');
 const before=await sourceFingerprint(checkout);
 await writeFile(join(checkout,'src/value.ts'),'export const value=2;\n');const after=await sourceFingerprint(checkout);
 await writeFile(join(checkout,'src/value.ts'),'export const value=1;\n');await writeFile(join(pack,'patches/change.patch'),patch);
 const manifest:any={schema:'helpdesk.cumulative-increments.v1',source_fingerprint:after,variants:[{name:'r5-only',patch:'patches/change.patch',patch_sha256:sha(patch),expected_base_source_fingerprint:before,files:[{path:'src/value.ts',operation:'modify',before_sha256:sha('export const value=1;\n'),after_sha256:sha('export const value=2;\n')}]}]};
 const save=()=>writeFile(join(pack,'manifest.json'),JSON.stringify(manifest));await save();
 const run=(stage='before',extra:string[]=[])=>{
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath,[cli,'--checkout',checkout,'--package',pack,'--variant','r5-only','--stage',stage,...extra],{encoding:'utf8',env,timeout:5000});
 };
 return{root,checkout,pack,manifest,save,run,close:()=>rm(root,{recursive:true,force:true})};
}
async function rejected(f:Awaited<ReturnType<typeof fixture>>,code:string,stage='before',extra:string[]=[]){
 const result=f.run(stage,extra);assert.equal(result.status,1,result.stderr);
 const body=JSON.parse(result.stdout);assert.equal(body.ok,false);assert.equal(body.code,code);assert.equal(body.writes_performed,false);
 assert.equal(body.homologated,false);assert.equal(body.operational,false);assert.equal(result.stderr,'');
 return body;
}
test('R5 valid preimages and patch pass read-only inspection, not homologation',async()=>{
 const f=await fixture();try{
  const before=await readFile(join(f.checkout,'src/value.ts'),'utf8');const r=f.run();assert.equal(r.status,0,r.stderr);
  const b=JSON.parse(r.stdout);assert.equal(b.ok,true);assert.equal(b.stage,'before');assert.equal(b.checked_files,1);
  assert.equal(b.writes_performed,false);assert.equal(b.homologated,false);assert.equal(b.tests_executed,false);
  assert.equal(await readFile(join(f.checkout,'src/value.ts'),'utf8'),before);assert.deepEqual(await readdir(f.checkout),['src']);
 }finally{await f.close();}
});
test('R5 explicit after inspection accepts final bytes and refuses replay against an applied checkout',async()=>{
 const f=await fixture();try{
  await writeFile(join(f.checkout,'src/value.ts'),'export const value=2;\n');
  assert.equal(f.run('after').status,0);await rejected(f,'file_mismatch');
 }finally{await f.close();}
});
test('R5 concurrent source changes outside the patch invalidate the whole source fingerprint',async()=>{
 const f=await fixture();try{await writeFile(join(f.checkout,'src/concurrent.ts'),'export const other=true;\n');await rejected(f,'source_mismatch');}finally{await f.close();}
});
test('R5 document-only conflict is caught even outside source fingerprint roots',async()=>{
 const f=await fixture();try{
  await mkdir(join(f.checkout,'docs'));await writeFile(join(f.checkout,'docs/value.md'),'Concurrent documentation draft\n');
  const changed=patch.replaceAll('src/value.ts','docs/value.md');await writeFile(join(f.pack,'patches/change.patch'),changed);
  f.manifest.variants[0].patch_sha256=sha(changed);f.manifest.variants[0].files[0].path='docs/value.md';
  await f.save();await rejected(f,'file_mismatch');
 }finally{await f.close();}
});
test('R5 modified patch cannot pass by borrowing a previous manifest hash',async()=>{
 const f=await fixture();try{await writeFile(join(f.pack,'patches/change.patch'),patch+'\n');await rejected(f,'patch_mismatch');}finally{await f.close();}
});
test('R5 mismatched declared patch paths cannot pass even with recomputed patch hash',async()=>{
 const f=await fixture();try{
  const altered=patch.replaceAll('src/value.ts','src/foreign.ts');await writeFile(join(f.pack,'patches/change.patch'),altered);
  f.manifest.variants[0].patch_sha256=sha(altered);await f.save();await rejected(f,'patch_paths_mismatch');
 }finally{await f.close();}
});
for(const path of ['../escape','/absolute','src/../../escape','src\\escape','src/.git/config','src/CON.ts','src/file.','src/file:stream','src//file','src/%2e%2e/file']){
 test(`R5 unsafe manifest path is rejected: ${path}`,async()=>{const f=await fixture();try{f.manifest.variants[0].files[0].path=path;await f.save();await rejected(f,'invalid_manifest');}finally{await f.close();}});
}
test('R5 symlinked patch is refused even if target bytes match',async()=>{
 const f=await fixture();try{
  await writeFile(join(f.root,'outside.patch'),patch);await rm(join(f.pack,'patches/change.patch'));await symlink(join(f.root,'outside.patch'),join(f.pack,'patches/change.patch'));
  await rejected(f,'unsafe_path');
 }finally{await f.close();}
});
test('R5 symlinked checkout ancestor cannot redirect file checks',async()=>{
 const f=await fixture();try{
  await mkdir(join(f.root,'outside'));await writeFile(join(f.root,'outside/value.ts'),'export const value=1;\n');
  await rm(join(f.checkout,'src'),{recursive:true});await symlink(join(f.root,'outside'),join(f.checkout,'src'));
  await rejected(f,'unsafe_path');
 }finally{await f.close();}
});
test('R5 duplicate and case-colliding paths are rejected before filesystem access',async()=>{
 const f=await fixture();try{
  f.manifest.variants[0].files.push({...f.manifest.variants[0].files[0],path:'src/Value.ts'});await f.save();await rejected(f,'invalid_manifest');
 }finally{await f.close();}
});
test('R5 duplicate variant names are not resolved by taking the first one',async()=>{
 const f=await fixture();try{f.manifest.variants.push({...f.manifest.variants[0]});await f.save();await rejected(f,'invalid_manifest');}finally{await f.close();}
});
test('R5 invalid JSON never discloses raw content or stack',async()=>{
 const f=await fixture();try{await writeFile(join(f.pack,'manifest.json'),'PRIVATE_MANIFEST_SENTINEL');const r=f.run();assert.equal(r.status,1);assert.equal(r.stderr,'');assert.doesNotMatch(r.stdout,/PRIVATE_MANIFEST_SENTINEL|SyntaxError|stack/);assert.equal(JSON.parse(r.stdout).code,'invalid_manifest');}finally{await f.close();}
});
test('R5 unsupported deletion or executable-mode patch is rejected',async()=>{
 const f=await fixture();try{
  const altered=patch.replace('100644','100755');await writeFile(join(f.pack,'patches/change.patch'),altered);f.manifest.variants[0].patch_sha256=sha(altered);await f.save();await rejected(f,'unsupported_patch');
 }finally{await f.close();}
});
test('R5 semantic hunk mismatch is caught by git apply --check without applying',async()=>{
 const f=await fixture();try{
  const altered=patch.replace('-export const value=1;','-export const value=42;');await writeFile(join(f.pack,'patches/change.patch'),altered);f.manifest.variants[0].patch_sha256=sha(altered);await f.save();await rejected(f,'patch_not_applicable');
  assert.equal(await readFile(join(f.checkout,'src/value.ts'),'utf8'),'export const value=1;\n');
 }finally{await f.close();}
});
test('R5 refuses unknown or duplicate CLI switches; never accepts apply mode',async()=>{
 const f=await fixture();try{await rejected(f,'invalid_arguments','before',['--apply']);await rejected(f,'invalid_arguments','before',['--stage','after']);}finally{await f.close();}
});
test('R5 new files require absence before and exact content after',async()=>{
 const f=await fixture();try{
  const extra='diff --git a/docs/new.md b/docs/new.md\nnew file mode 100644\nindex 0000000..1234567\n--- /dev/null\n+++ b/docs/new.md\n@@ -0,0 +1 @@\n+New documentation\n';
  await writeFile(join(f.pack,'patches/change.patch'),patch+extra);f.manifest.variants[0].patch_sha256=sha(patch+extra);
  f.manifest.variants[0].files.push({path:'docs/new.md',operation:'add',before_sha256:null,after_sha256:sha('New documentation\n')});await f.save();
  assert.equal(f.run().status,0);await mkdir(join(f.checkout,'docs'));await writeFile(join(f.checkout,'docs/new.md'),'Existing local draft\n');await rejected(f,'file_mismatch');
  await writeFile(join(f.checkout,'docs/new.md'),'New documentation\n');await writeFile(join(f.checkout,'src/value.ts'),'export const value=2;\n');assert.equal(f.run('after').status,0);
 }finally{await f.close();}
});
test('R5 manifest size is bounded before parsing',async()=>{
 const f=await fixture();try{await writeFile(join(f.pack,'manifest.json'),' '.repeat(2*1024*1024+1));await rejected(f,'resource_limit');}finally{await f.close();}
});
test('R5 final hashes are verified rather than trusting a matching source fingerprint',async()=>{
 const f=await fixture();try{
  await writeFile(join(f.checkout,'src/value.ts'),'export const value=2;\n');f.manifest.variants[0].files[0].after_sha256='0'.repeat(64);await f.save();await rejected(f,'file_mismatch','after');
 }finally{await f.close();}
});
test('R5 null manifest entries and missing variants fail closed',async()=>{
 const f=await fixture();try{f.manifest.variants[0].files=[null];await f.save();await rejected(f,'invalid_manifest');f.manifest.variants=[];await f.save();await rejected(f,'invalid_manifest');}finally{await f.close();}
});
test('R5 symlinked package directory is not followed to a matching patch',async()=>{
 const f=await fixture();try{
  await mkdir(join(f.root,'outside'));await writeFile(join(f.root,'outside/change.patch'),patch);
  await rm(join(f.pack,'patches'),{recursive:true});await symlink(join(f.root,'outside'),join(f.pack,'patches'));await rejected(f,'unsafe_path');
 }finally{await f.close();}
});
test('R5 integration gate includes its regression suite without reducing SQL or browser requirements',async()=>{
 const {steps}=await import(modulePath);
 assert.ok(steps.find((s:any)=>s.id==='application').minTests>=1163);
 assert.ok(steps.find((s:any)=>s.id==='postgres').minTests>=207);
 assert.ok(steps.find((s:any)=>s.id==='interface').minTests>=71);
});
