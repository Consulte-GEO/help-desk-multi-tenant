import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm, symlink, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
async function api(){
 const path='../scripts/cg-consolidation-core.mjs';
 const module=await import(path).catch((error:unknown)=>{
  if((error as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};
  throw error;
 });
 assert.equal(typeof module.inspectConsolidation,'function','C01 consolidation inspector is missing');
 return module;
}
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'helpdesk-consolidation-'));
 const files={'src/feature.ts':'export const candidate = true;\n','supabase/candidates/scope.sql':'-- disposable candidate only\n'};
 const migrations:[{file:string;sha256:string}]=[{file:'20260915000100_original.sql',sha256:hash('-- immutable baseline\n')}];
 const spec={schemaVersion:1,baseCommit:'a'.repeat(40),scope:'candidate-package-only',
  files:Object.entries(files).map(([path,content])=>({path,sha256:hash(content)})),migrations,
  requiredPaths:['package.json','package-lock.json','supabase/tests/rls.test.ts','scripts/homologate-local.mjs'],
  dependencies:{pg:'8.16.3',typescript:'5.8.3'},
  commands:['npm run check:lock','npm run homologate:local','npm run check:homologation']};
 async function put(path:string,content:string){await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),content);}
 for(const [path,content] of Object.entries(files))await put(path,content);
 for(const path of spec.requiredPaths)await put(path,path.endsWith('.json')?'{}\n':'// existing project runner\n');
 await put('supabase/migrations/'+migrations[0].file,'-- immutable baseline\n');
 await put('supabase/migrations.manifest.json',JSON.stringify({format:1,schemaVersion:'0.19.0',migrations}));
 const tooling={nodeVersion:'22.16.0',postgresVersion:'17.6',dependencies:{pg:'8.16.3',typescript:'5.8.3'}};
 return {root,spec,tooling,put,close:()=>rm(root,{recursive:true,force:true})};
}
async function withFixture(work:(f:Awaited<ReturnType<typeof fixture>>,inspect:any)=>Promise<void>){
 const {inspectConsolidation}=await api(),f=await fixture();try{await work(f,inspectConsolidation);}finally{await f.close();}
}

test('C01 ready inputs do not claim SQL execution, CI or production acceptance',()=>withFixture(async(f,inspect)=>{
 const report=await inspect(f.root,f.spec,f.tooling);
 assert.equal(report.status,'ready_for_existing_runners');assert.deepEqual(report.blockers,[]);
 assert.equal(report.sqlExecuted,false);assert.equal(report.ciExecuted,false);assert.equal(report.productionApproved,false);
 assert.equal(report.coverage,'declared-files-and-prerequisites-only');
 assert.deepEqual(report.nextCommands,f.spec.commands);assert.equal(report.baseCommit,f.spec.baseCommit);
}));
test('C01 modified candidate is blocked rather than accepted from an old report',()=>withFixture(async(f,inspect)=>{
 await f.put('src/feature.ts','export const candidate = false;\n');
 const r=await inspect(f.root,f.spec,f.tooling);assert.equal(r.status,'blocked');
 assert.ok(r.blockers.some((x:any)=>x.code==='source_mismatch'&&x.path==='src/feature.ts'));assert.deepEqual(r.nextCommands,[]);
}));
test('C01 a partial delivery is not classified as a checkout ready to execute',()=>withFixture(async(f,inspect)=>{
 await rm(join(f.root,'supabase/tests/rls.test.ts'));
 const r=await inspect(f.root,f.spec,f.tooling);assert.ok(r.blockers.some((x:any)=>x.code==='required_file_missing'));
 assert.equal(r.sourceFiles.matched,2);assert.equal(r.status,'blocked');
}));
test('C01 missing original migration is reported separately from candidate readiness',()=>withFixture(async(f,inspect)=>{
 await rm(join(f.root,'supabase/migrations',f.spec.migrations[0].file));
 const r=await inspect(f.root,f.spec,f.tooling);assert.ok(r.blockers.some((x:any)=>x.code==='migration_missing'));
}));
test('C01 original migration edited together with its manifest is still rejected',()=>withFixture(async(f,inspect)=>{
 await f.put('supabase/migrations/'+f.spec.migrations[0].file,'-- rewritten\n');
 await f.put('supabase/migrations.manifest.json',JSON.stringify({format:1,schemaVersion:'0.19.0',migrations:[{...f.spec.migrations[0],sha256:hash('-- rewritten\n')}]}));
 const r=await inspect(f.root,f.spec,f.tooling);
 assert.ok(r.blockers.some((x:any)=>x.code==='migration_mismatch'));
 assert.ok(r.blockers.some((x:any)=>x.code==='migration_manifest_mismatch'));
}));
test('C01 unexpected migration requires a newly reviewed source specification',()=>withFixture(async(f,inspect)=>{
 await f.put('supabase/migrations/20261010001300_new.sql','-- not reviewed in this cycle\n');
 const r=await inspect(f.root,f.spec,f.tooling);assert.ok(r.blockers.some((x:any)=>x.code==='migration_inventory_changed'));
}));
test('C01 missing PostgreSQL never produces a successful preflight',()=>withFixture(async(f,inspect)=>{
 const r=await inspect(f.root,f.spec,{...f.tooling,postgresVersion:null});assert.equal(r.status,'blocked');
 assert.ok(r.blockers.some((x:any)=>x.code==='postgres17_unavailable'));assert.equal(r.sqlExecuted,false);
}));
for(const postgresVersion of ['16.9','18.0','17x','17','17.1-beta'])test('C01 incompatible PostgreSQL '+postgresVersion,()=>withFixture(async(f,inspect)=>{
 const r=await inspect(f.root,f.spec,{...f.tooling,postgresVersion});assert.ok(r.blockers.some((x:any)=>x.code==='postgres17_unavailable'));
}));
for(const nodeVersion of ['20.19.0','22.15.0','24.1.0','not-a-version'])test('C01 project cycle requires verified Node22 '+nodeVersion,()=>withFixture(async(f,inspect)=>{
 const r=await inspect(f.root,f.spec,{...f.tooling,nodeVersion});assert.ok(r.blockers.some((x:any)=>x.code==='node22_unavailable'));
}));
test('C01 wrong installed dependency is not silently treated as lock verification',()=>withFixture(async(f,inspect)=>{
 const r=await inspect(f.root,f.spec,{...f.tooling,dependencies:{...f.tooling.dependencies,pg:'8.16.2'}});
 assert.ok(r.blockers.some((x:any)=>x.code==='dependency_not_verified'&&x.path==='pg'));
}));
test('C01 missing installed dependency is blocked without auto-install',()=>withFixture(async(f,inspect)=>{
 const r=await inspect(f.root,f.spec,{...f.tooling,dependencies:{}});assert.equal(r.status,'blocked');
 assert.equal(r.blockers.filter((x:any)=>x.code==='dependency_not_verified').length,2);
}));
test('C01 unavailable file contents are not echoed in diagnostics',()=>withFixture(async(f,inspect)=>{
 await f.put('src/feature.ts','private-marker-password\n');await f.put('supabase/migrations.manifest.json','private-marker-password');
 const r=await inspect(f.root,f.spec,f.tooling);assert.doesNotMatch(JSON.stringify(r),/private-marker-password/);
}));
test('C01 source symlink is refused without following it',()=>withFixture(async(f,inspect)=>{
 await rm(join(f.root,'src/feature.ts'));await symlink('/etc/passwd',join(f.root,'src/feature.ts'));
 const r=await inspect(f.root,f.spec,f.tooling);assert.ok(r.blockers.some((x:any)=>x.code==='source_unsafe'));
 assert.doesNotMatch(JSON.stringify(r),/root:x/);
}));
test('C01 symlinked parent directory cannot escape the checkout',()=>withFixture(async(f,inspect)=>{
 await rm(join(f.root,'src'),{recursive:true});await symlink('/etc',join(f.root,'src'));
 const r=await inspect(f.root,f.spec,f.tooling);assert.ok(r.blockers.some((x:any)=>x.code==='source_unsafe'));
}));
test('C01 repeated inspection does not modify any source bytes',()=>withFixture(async(f,inspect)=>{
 const before=await readFile(join(f.root,'src/feature.ts'));
 const a=await inspect(f.root,f.spec,f.tooling),b=await inspect(f.root,f.spec,f.tooling);
 assert.deepEqual(a,b);assert.deepEqual(await readFile(join(f.root,'src/feature.ts')),before);
}));
for(const path of ['../private','/etc/passwd','C:/private','src/../private','src\\private','src//private'])test('C01 invalid declared path '+path,()=>withFixture(async(f,inspect)=>{
 await assert.rejects(inspect(f.root,{...f.spec,files:[{path,sha256:'0'.repeat(64)}]},f.tooling),/Invalid consolidation specification/);
}));
test('C01 duplicate candidate paths are not accepted as extra coverage',()=>withFixture(async(f,inspect)=>{
 await assert.rejects(inspect(f.root,{...f.spec,files:[f.spec.files[0],f.spec.files[0]]},f.tooling),/Invalid consolidation specification/);
}));
test('C01 checks are rejected when approval flags are supplied in the specification',()=>withFixture(async(f,inspect)=>{
 await assert.rejects(inspect(f.root,{...f.spec,productionApproved:true},f.tooling),/Invalid consolidation specification/);
}));
test('C01 command list cannot include deployment, writes, or arbitrary shell commands',()=>withFixture(async(f,inspect)=>{
 for(const command of ['git push','supabase db push','npm run deploy','curl private'])
  await assert.rejects(inspect(f.root,{...f.spec,commands:[command]},f.tooling),/Invalid consolidation specification/);
}));
test('C01 no filesystem or environment result is reclassified as full release approval',()=>withFixture(async(f,inspect)=>{
 await f.put('evidence/homologation/latest.json',JSON.stringify({passed:true,source:'old'}));
 const r=await inspect(f.root,f.spec,f.tooling);assert.equal(r.ciExecuted,false);assert.equal(r.productionApproved,false);
 assert.ok(r.requiredFollowUp.includes('source_bound_ci'));
}));
