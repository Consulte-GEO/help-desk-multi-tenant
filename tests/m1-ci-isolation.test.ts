import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, readdir, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

const modulePath='../scripts/stage-ci-source.mjs';
const corePath='../scripts/homologation-core.mjs';
async function staging(){
 const m=await import(modulePath).catch(()=>null);
 assert.equal(typeof m?.stageCiSource,'function','A CI deve extrair a fonte sem trazer evidências históricas.');
 return m;
}
const git=(root:string,...args:string[])=>{
 const env={...process.env}; for(const key of Object.keys(env))if(key.startsWith('GIT_'))delete env[key];
 const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',env});assert.equal(r.status,0,r.stderr);return r.stdout.trim();
};
type CiStagingOptions={checkout:string;tempParent:string;commit:string;runId:string;attempt:string};
type CiFixture={parent:string;checkout:string;temp:string;commit:string;options:()=>CiStagingOptions};
async function fixture(work:(f:CiFixture)=>Promise<void>){
 const parent=await mkdtemp(join(tmpdir(),'helpdesk-ci-test-'));
 try{
  const checkout=join(parent,'checkout'),temp=join(parent,'runner temp');await mkdir(checkout);await mkdir(temp);
  git(checkout,'init','-q');git(checkout,'config','user.name','CI Fixture');git(checkout,'config','user.email','ci-fixture@example.invalid');
  await mkdir(join(checkout,'src'));await mkdir(join(checkout,'evidence','homologation'),{recursive:true});
  await writeFile(join(checkout,'src','test.ts'),'export const test = 1;\n');
  await writeFile(join(checkout,'evidence','homologation','latest.json'),'{"old_result":"passed"}\n');
  await writeFile(join(checkout,'evidence','interface-desktop.png'),'OLD-SCREENSHOT');
  await writeFile(join(checkout,'.gitattributes'),'* text=auto eol=lf\n');
  git(checkout,'add','.');git(checkout,'commit','-qm','fixture');
  const f:CiFixture={parent,checkout,temp,commit:git(checkout,'rev-parse','HEAD'),
   options:()=>({checkout,tempParent:temp,commit:f.commit,runId:'123456',attempt:'2'})};
  await work(f);
 }finally{await rm(parent,{recursive:true,force:true});}
}
test('CI extraction excludes committed historical reports and screenshots without deleting originals',async()=>{
 const m=await staging();await fixture(async f=>{
  const result=await m.stageCiSource(f.options()), core=await import(corePath);
  assert.equal(result.source_sha256,await core.sourceFingerprint(f.checkout));
  assert.equal(await readFile(join(result.root,'src','test.ts'),'utf8'),'export const test = 1;\n');
  assert.deepEqual(await readdir(join(result.root,'evidence')),['ci']);
  assert.match(await readFile(join(f.checkout,'evidence','homologation','latest.json'),'utf8'),/old_result/);
  assert.equal(await readFile(join(f.checkout,'evidence','interface-desktop.png'),'utf8'),'OLD-SCREENSHOT');
  const receipt=JSON.parse(await readFile(join(result.root,'evidence','ci','source.json'),'utf8'));
  assert.equal(receipt.commit,f.commit);assert.equal(receipt.run_id,'123456');assert.equal(receipt.run_attempt,'2');
  assert.equal(receipt.platform_approved,false);assert.equal(receipt.tests_executed,false);
 });
});
test('repeating CI staging creates a new empty evidence root instead of reusing an earlier attempt',async()=>{
 const m=await staging();await fixture(async f=>{
  const a=await m.stageCiSource(f.options());await writeFile(join(a.root,'evidence','previous-run.json'),'STALE');
  const b=await m.stageCiSource(f.options());assert.notEqual(a.root,b.root);assert.deepEqual(await readdir(join(b.root,'evidence')),['ci']);
 });
});
for(const kind of ['tracked','untracked'])test(`CI staging refuses ${kind} source changes not present in the tested commit`,async()=>{
 const m=await staging();await fixture(async f=>{
  await writeFile(join(f.checkout,'src',kind==='tracked'?'test.ts':'extra.ts'),'changed source');
  await assert.rejects(()=>m.stageCiSource(f.options()));
 });
});
test('CI staging rejects a different commit and hostile run identifiers',async()=>{
 const m=await staging();await fixture(async f=>{
  for(const bad of [{commit:'a'.repeat(40)},{commit:'HEAD'},{runId:'12\nINJECT=1'},{attempt:'0'},{attempt:'1/2'},{runId:123},{attempt:['1']}]){
   await assert.rejects(()=>m.stageCiSource({...f.options(),...bad}));
  }
  assert.deepEqual(await readdir(f.temp),[]);
 });
});
test('CI staging refuses source symlinks instead of reading outside the checkout',async()=>{
 const m=await staging();await fixture(async f=>{
  await writeFile(join(f.parent,'private.txt'),'PRIVATE-NOT-ARCHIVED');
  await symlink(join(f.parent,'private.txt'),join(f.checkout,'src','escape.ts'));git(f.checkout,'add','.');git(f.checkout,'commit','-qm','link');f.commit=git(f.checkout,'rev-parse','HEAD');
  await assert.rejects(()=>m.stageCiSource(f.options()));
 });
});
test('archive export-ignore cannot silently remove required source from a CI run',async()=>{
 const m=await staging();await fixture(async f=>{
  await writeFile(join(f.checkout,'.gitattributes'),'src/test.ts export-ignore\n');git(f.checkout,'add','.');git(f.checkout,'commit','-qm','export-ignore');f.commit=git(f.checkout,'rev-parse','HEAD');
  await assert.rejects(()=>m.stageCiSource(f.options()));
 });
});
test('CI staging rejects a temp parent inside the checkout',async()=>{
 const m=await staging();await fixture(async f=>{
  await assert.rejects(()=>m.stageCiSource({...f.options(),tempParent:f.checkout}));
 });
});
const counts=(n:number)=>`# tests ${n}\n# pass ${n}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`;
for(const interfaceReady of [false,'true'])test(`browser preparation ${String(interfaceReady)} never blocks independent PostgreSQL or approves the interface`,async()=>{
 const core=await import(corePath),calls:string[]=[],now='2026-09-28T12:00:00.000Z';
 const r=await core.runChecks({fingerprint:'a'.repeat(64),interfaceReady,now:()=>now,execute:async(s:any)=>{
  calls.push(s.id);return {exit_code:0,signal:null,output:counts(s.minTests||1),artifact:`runs/fixture/${s.id}.log`,sha256:'a'.repeat(64)};
 }});
 assert.ok(calls.includes('postgres'));assert.ok(!calls.includes('interface'));
 const check=r.checks.find((s:any)=>s.id==='interface');assert.equal(check.status,'blocked');assert.equal(check.reason,'browser_tooling_not_ready');
 assert.throws(()=>core.validateReport(r,'a'.repeat(64),new Date(now)));
});
test('workflow keeps independent gates eligible after browser failure without continue-on-error',async()=>{
 const yaml=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
 assert.match(yaml,/id: source/);assert.match(yaml,/id: browser/);
 assert.match(yaml,/id: gates\n\s+if:.*!cancelled\(\).*steps\.source\.outcome == 'success'/);
 assert.match(yaml,/HELPDESK_CI_BROWSER_READY:.*steps\.browser\.outcome/);
 assert.doesNotMatch(yaml,/continue-on-error:\s*true/);
});
test('workflow uploads only isolated evidence and names each attempt separately',async()=>{
 const yaml=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
 assert.match(yaml,/path: \$\{\{ steps\.source\.outputs\.root \}\}\/evidence\//);
 assert.match(yaml,/name: helpdesk-homologation-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
 assert.doesNotMatch(yaml,/path: \|\n\s+evidence\//);
});

test('CI staging preserves a committed file named source.tar without colliding with its temporary archive',async()=>{
 const m=await staging();await fixture(async f=>{
  await writeFile(join(f.checkout,'source.tar'),'USER-TRACKED-FILE');git(f.checkout,'add','.');git(f.checkout,'commit','-qm','archive name');f.commit=git(f.checkout,'rev-parse','HEAD');
  const result=await m.stageCiSource(f.options());assert.equal(await readFile(join(result.root,'source.tar'),'utf8'),'USER-TRACKED-FILE');
 });
});
test('CI staging refuses a symlinked temp parent resolving to a newline path before emitting step outputs',async()=>{
 const m=await staging();await fixture(async f=>{
  const actual=join(f.parent,'runner\nBAD_OUTPUT=1');await mkdir(actual);const link=join(f.parent,'temp-link');await symlink(actual,link);
  await assert.rejects(()=>m.stageCiSource({...f.options(),tempParent:link}));
  assert.deepEqual(await readdir(actual),[]);
 });
});

test('migration baseline inputs are immutable source fixtures, not historical run outputs',async()=>{
 const {createHash}=await import('node:crypto');
 for(const [version,sha] of [
  ['v015','dc0ea0be5ac2b2fbfbf267881be0a9817532736eff2f5ef685d892e4da18cb32'],
  ['v016','5a988a8032dac9a96f6212efdd8ef18493e5adf25a792af56b7a70d4843dc91b'],
 ]){
  const bytes=await readFile(new URL(`./fixtures/migration-baselines/${version}.json`,import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),sha);
 }
});
