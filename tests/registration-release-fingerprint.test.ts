import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('release fingerprint changes when the standalone analysis worker changes',async()=>{
 const name='../scripts/homologation-core.mjs',m=await import(name),root=await mkdtemp(join(tmpdir(),'hda-fingerprint-'));
 try{
  const before=await m.sourceFingerprint(root);await mkdir(join(root,'workers','dev-agent-bridge'),{recursive:true});
  const path=join(root,'workers','dev-agent-bridge','service.ts');await writeFile(path,'export const version=1;');
  const added=await m.sourceFingerprint(root);assert.notEqual(added,before);
  await writeFile(path,'export const version=2;');assert.notEqual(await m.sourceFingerprint(root),added);
  await rm(path);assert.equal(await m.sourceFingerprint(root),before);
 }finally{await rm(root,{recursive:true,force:true});}
});
