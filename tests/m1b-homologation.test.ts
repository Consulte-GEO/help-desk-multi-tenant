import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
async function module(){const path='../scripts/homologation-core.mjs';const mod=await import(path).catch(()=>null);assert.equal(typeof mod?.runChecks,'function','Homologation executor must exist');return mod;}
const now='2026-09-16T12:00:00.000Z',sha='a'.repeat(64);
const stats=(n:number)=>`# tests ${n}\n# pass ${n}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`;
async function good(){const m=await module();return m.runChecks({fingerprint:sha,now:()=>now,execute:async(step:any)=>({exit_code:0,signal:null,artifact:`runs/fixture/${step.id}.log`,sha256:sha,output:stats(step.minTests||1)})});}
test('outer interface deadline accommodates its existing visual subprocess budget and stays bounded',async()=>{
 const m=await module(),source=await readFile(new URL('../scripts/test-ui-local.mjs',import.meta.url),'utf8');
 const visualBudget=Number(/scripts\/test-visual-local\.mjs.*timeoutMs:(\d+)/.exec(source)?.[1]);
 assert.ok(Number.isSafeInteger(visualBudget)&&visualBudget>0);
 const outer=m.steps.find((s:any)=>s.id==='interface').timeout;
 assert.ok(outer>visualBudget,'The global deadline must not kill a visual subprocess inside its qualified budget');assert.ok(outer<=900_000);
});
for(const id of ['lock','install','audit','application','postgres','interface'])test('release evidence requires successful '+id,async()=>{
 const m=await module(),report=await good();report.checks.find((c:any)=>c.id===id).status='blocked';assert.throws(()=>m.validateReport(report,sha,new Date(now)));
});
test('successful unit fixtures describe local M1 only, never platform production approval',async()=>{
 const m=await module(),r=await good();assert.equal(r.scope,'local-m1');assert.equal(r.platform_approved,false);assert.doesNotThrow(()=>m.validateReport(r,sha,new Date(now)));
});
test('failure does not execute steps depending on the failed prerequisite',async()=>{
 const m=await module(),calls:string[]=[];const r=await m.runChecks({fingerprint:sha,now:()=>now,execute:async(s:any)=>{calls.push(s.id);return {exit_code:1,artifact:'runs/fixture/lock.log',sha256:sha,signal:null,output:''};}});
 assert.deepEqual(calls,['lock']);assert.equal(r.checks[0].status,'failed');assert.ok(r.checks.slice(1).every((s:any)=>s.status==='blocked'));
});
test('exit zero without actual PostgreSQL test counts cannot be accepted',async()=>{
 const m=await module(),r=await m.runChecks({fingerprint:sha,now:()=>now,execute:async(s:any)=>({exit_code:0,artifact:`runs/fixture/${s.id}.log`,sha256:sha,signal:null,output:s.id==='postgres'?'No tests executed':stats(s.minTests||1)})});
 assert.equal(r.checks.find((s:any)=>s.id==='postgres').status,'failed');
});
test('skipped database tests cannot appear as passed homologation',async()=>{
 const m=await module(),r=await m.runChecks({fingerprint:sha,now:()=>now,execute:async(s:any)=>({exit_code:0,artifact:`runs/fixture/${s.id}.log`,sha256:sha,signal:null,output:s.id==='postgres'?'# tests 35\n# pass 34\n# fail 0\n# cancelled 0\n# skipped 1\n# todo 0\n':stats(s.minTests||1)})});
 assert.equal(r.checks.find((s:any)=>s.id==='postgres').status,'failed');
});
for(const [label,change] of Object.entries({differentSource:(r:any)=>{r.source_sha256='b'.repeat(64);},missing:(r:any)=>{r.checks.pop();},duplicate:(r:any)=>{r.checks.push(r.checks[0]);},nonzero:(r:any)=>{r.checks[0].exit_code=2;},signalled:(r:any)=>{r.checks[0].signal='SIGTERM';},noTests:(r:any)=>{r.checks.find((s:any)=>s.id==='application').tests=null;},old:(r:any)=>{r.completed_at='2020-01-01T00:00:00.000Z';},future:(r:any)=>{r.completed_at='2030-01-01T00:00:00.000Z';},wrongScope:(r:any)=>{r.scope='production';},pathEscape:(r:any)=>{r.checks[0].artifact='../outside.log';}}))test('evidence guard rejects '+label,async()=>{
 const m=await module(),r=await good();change(r);assert.throws(()=>m.validateReport(r,sha,new Date(now)));
});
test('failed executor is recorded without copying a private exception into report',async()=>{
 const m=await module(),r=await m.runChecks({fingerprint:sha,now:()=>now,execute:async()=>{throw Error('SECRET-DATABASE-PASSWORD');}});assert.equal(r.checks[0].status,'failed');assert.doesNotMatch(JSON.stringify(r),/SECRET/);
});
test('fingerprint includes code and test changes but not generated evidence',async()=>{
 const m=await module(),root=await mkdtemp(join(tmpdir(),'helpdesk-fingerprint-'));
 try{await mkdir(join(root,'src'));await mkdir(join(root,'evidence'));await writeFile(join(root,'package.json'),'{}');await writeFile(join(root,'src','a.ts'),'original');const a=await m.sourceFingerprint(root);
 await writeFile(join(root,'evidence','log.txt'),'new result');assert.equal(await m.sourceFingerprint(root),a);
 await writeFile(join(root,'src','a.ts'),'changed');assert.notEqual(await m.sourceFingerprint(root),a);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('fingerprint refuses symlinked source trees',async()=>{
 const m=await module(),root=await mkdtemp(join(tmpdir(),'helpdesk-fingerprint-'));
 try{await writeFile(join(root,'target'),'code');await symlink(join(root,'target'),join(root,'src'));await assert.rejects(()=>m.sourceFingerprint(root));}
 finally{await rm(root,{recursive:true,force:true});}
});
test('fingerprint binds draft checklist profiles to evidence across add, edit and removal',async()=>{
 const m=await module(),root=await mkdtemp(join(tmpdir(),'helpdesk-profile-fingerprint-'));
 try{
  await writeFile(join(root,'package.json'),'{}');const absent=await m.sourceFingerprint(root);
  await mkdir(join(root,'profiles','consultegeo'),{recursive:true});
  const path=join(root,'profiles','consultegeo','execution-checklists.draft.json');
  await writeFile(path,'{"status":"draft","templates":[]}');const original=await m.sourceFingerprint(root);
  assert.notEqual(original,absent,'adding a tested profile must invalidate previous evidence');
  await writeFile(path,'{"status":"draft","templates":[{"id":"changed"}]}');
  assert.notEqual(await m.sourceFingerprint(root),original,'editing a tested profile must invalidate evidence');
  await rm(path);assert.equal(await m.sourceFingerprint(root),absent,'removing the profile changes its fingerprint');
 }finally{await rm(root,{recursive:true,force:true});}
});
test('log digest mismatch rejects evidence even when report claims all stages passed',async()=>{
 const m=await module(),r=await good(),root=await mkdtemp(join(tmpdir(),'helpdesk-evidence-'));
 try{await mkdir(join(root,'runs','fixture'),{recursive:true});for(const s of r.checks)await writeFile(join(root,s.artifact),'tampered');await assert.rejects(()=>m.verifyLogs(r,root));}
 finally{await rm(root,{recursive:true,force:true});}
});
test('source changing during a run is never accepted after a later checkout restores the digest',async()=>{
 const m=await module(),r=await good();r.source_changed_during_run=true;assert.throws(()=>m.validateReport(r,sha,new Date(now)));
});
