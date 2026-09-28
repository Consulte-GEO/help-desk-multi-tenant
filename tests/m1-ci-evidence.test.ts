import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
const modulePath='../scripts/homologation-core.mjs';
const {testCounts,sourceFingerprint}=await import(modulePath);

test('declared application test command emits counts accepted by the release gate',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'helpdesk-reporter-'));
 try{
  const file=join(dir,'case.test.mjs');
  await writeFile(file,"import test from 'node:test'; test('real passing case',()=>{});");
  const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
  const [binary,...args]=pkg.scripts.test.split(' ');
  assert.equal(binary,'node');
  // This is a separate test invocation, not a recursively spawned Node test worker.
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const run=spawnSync(process.execPath,args.map((arg:string)=>arg==='tests/*.test.ts'?file:arg),{encoding:'utf8',env});
  assert.equal(run.status,0,run.stderr);
  assert.deepEqual(testCounts(run.stdout),{tests:1,pass:1,fail:0,cancelled:0,skipped:0,todo:0});
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('changing checkout byte rules invalidates the source fingerprint',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'helpdesk-attributes-'));
 try{
  await writeFile(join(dir,'.gitattributes'),'*.ts text eol=lf\n');
  const before=await sourceFingerprint(dir);
  await writeFile(join(dir,'.gitattributes'),'*.ts text eol=crlf\n');
  assert.notEqual(await sourceFingerprint(dir),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
