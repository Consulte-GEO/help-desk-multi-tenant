import test from 'node:test';
import assert from 'node:assert/strict';
import {copyFile, mkdir, mkdtemp, rename, rm, symlink, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const coreModule='../scripts/homologation-core.mjs';
const {runChecks,validateReport,verifyLogs,sourceFingerprint}=await import(coreModule);
const fingerprint='a'.repeat(64);

// These are deliberately synthetic gate inputs, not approvals of application, SQL or browser.
// They only live in a test-owned temporary directory and never become release evidence.
async function fixture(){
 const root=await mkdtemp(join(tmpdir(),'helpdesk-evidence-coherence-'));
 const directory=join(root,'evidence','homologation');
 try{
  const report=await runChecks({fingerprint,execute:async(step:{id:string;minTests:number})=>{
   const n=step.minTests||1;
   const output=`# synthetic gate fixture: ${step.id}\n# tests ${n}\n# pass ${n}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`;
   const artifact=`runs/current/${step.id}.log`;
   await mkdir(dirname(join(directory,artifact)),{recursive:true});
   await writeFile(join(directory,artifact),output);
   return {exit_code:0,signal:null,output,artifact,sha256:createHash('sha256').update(output).digest('hex')};
  }});
  return {root,directory,report,dispose:()=>rm(root,{recursive:true,force:true})};
 }catch(error){await rm(root,{recursive:true,force:true});throw error;}
}
async function moveToAnotherRun(f:Awaited<ReturnType<typeof fixture>>){
 const check=f.report.checks.find((c:{id:string})=>c.id==='postgres');
 const previous=join(f.directory,check.artifact);
 check.artifact='runs/previous/postgres.log';
 await mkdir(dirname(join(f.directory,check.artifact)),{recursive:true});
 await rename(previous,join(f.directory,check.artifact));
}
function substituteAuditLog(f:Awaited<ReturnType<typeof fixture>>){
 const install=f.report.checks.find((c:{id:string})=>c.id==='install');
 const audit=f.report.checks.find((c:{id:string})=>c.id==='audit');
 audit.artifact=install.artifact;audit.sha256=install.sha256;
}

test('M1-R9 report refuses otherwise passing checks from different execution directories',async()=>{
 const f=await fixture();try{
  await moveToAnotherRun(f);
  assert.throws(()=>validateReport(f.report,fingerprint),/PUBLICAÇÃO BLOQUEADA/);
 }finally{await f.dispose();}
});
test('M1-R9 report refuses installation evidence substituted for audit evidence',async()=>{
 const f=await fixture();try{
  substituteAuditLog(f);
  assert.throws(()=>validateReport(f.report,fingerprint),/PUBLICAÇÃO BLOQUEADA/);
 }finally{await f.dispose();}
});
test('M1-R9 file verification rejects a mixed run even when all hashes and counts match',async()=>{
 const f=await fixture();try{
  await moveToAnotherRun(f);
  await assert.rejects(()=>verifyLogs(f.report,f.directory));
 }finally{await f.dispose();}
});
test('M1-R9 file verification rejects a reused phase log even when its hash is correct',async()=>{
 const f=await fixture();try{
  substituteAuditLog(f);
  await assert.rejects(()=>verifyLogs(f.report,f.directory));
 }finally{await f.dispose();}
});
test('M1-R9 coherent evidence from a single execution remains accepted without field changes',async()=>{
 const f=await fixture();try{
  assert.doesNotThrow(()=>validateReport(f.report,fingerprint));
  await verifyLogs(f.report,f.directory);
  assert.equal(f.report.platform_approved,false);
 }finally{await f.dispose();}
});
test('M1-R9 release gate CLI rejects mixed execution logs with valid hashes and current source fingerprint',async()=>{
 const f=await fixture();try{
  await mkdir(join(f.root,'scripts'));
  for(const name of ['check-homologation.mjs','homologation-core.mjs'])
   await copyFile(new URL('../scripts/'+name,import.meta.url),join(f.root,'scripts',name));
  await moveToAnotherRun(f);
  f.report.source_sha256=await sourceFingerprint(f.root);
  await writeFile(join(f.directory,'latest.json'),JSON.stringify(f.report));
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const result=spawnSync(process.execPath,[join(f.root,'scripts','check-homologation.mjs')],{env,encoding:'utf8',timeout:10000});
  assert.ifError(result.error);
  assert.equal(result.status,1,result.stdout+result.stderr);
  assert.match(result.stderr,/PUBLICAÇÃO BLOQUEADA/);
 }finally{await f.dispose();}
});
test('M1-R9 a symbolic execution directory cannot redirect evidence to an older run',async()=>{
 const f=await fixture();try{
  await rename(join(f.directory,'runs','current'),join(f.directory,'runs','previous'));
  await symlink('previous',join(f.directory,'runs','current'),'dir');
  await assert.rejects(()=>verifyLogs(f.report,f.directory));
 }finally{await f.dispose();}
});
test('M1-R9 file verification independently rejects a duplicated execution phase',async()=>{
 const f=await fixture();try{
  f.report.checks.push({...f.report.checks[0]});
  await assert.rejects(()=>verifyLogs(f.report,f.directory));
 }finally{await f.dispose();}
});
