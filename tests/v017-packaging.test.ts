/** Source/build guards, not a browser or provider certification. */
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {ERROR_CODES} from '../src/observability/codes.ts';
test('new shared source changes the homologation fingerprint',async()=>{
 const path='../scripts/homologation-core.mjs';const {sourceFingerprint}=await import(path);
 const root=await mkdtemp(join(tmpdir(),'hd-precision-source-'));
 try{
  await mkdir(join(root,'shared'));await writeFile(join(root,'shared','instant.js'),'export const value=1;');
  const before=await sourceFingerprint(root);await writeFile(join(root,'shared','instant.js'),'export const value=2;');
  assert.notEqual(await sourceFingerprint(root),before);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('browser precision module has an explicit same-origin demo route and shipped build file',async()=>{
 const read=(name:string)=>readFile(new URL('../'+name,import.meta.url),'utf8');
 assert.match(await read('scripts/build.mjs'),/\.\.\/dist\/shared\/instant\.js/);
 assert.match(await read('scripts/demo.ts'),/['"]\/shared\/instant\.js['"]/);
 assert.match(await read('scripts/smoke-local-http.mjs'),/['"]\/shared\/instant\.js['"]/);
 for(const module of ['conversation-state','ticket-list-state','timeline-state','ticket-actions']){
  const source=await read('web/'+module+'.js');assert.match(source,/from '\.\.\/shared\/instant\.js'/);
  assert.equal(new URL('../shared/instant.js','https://helpdesk.example/'+module+'.js').pathname,'/shared/instant.js');
 }
});
test('invalid database timestamp uses a recognized safe diagnostic, not raw driver details',()=>{
 assert.equal(ERROR_CODES.has('invalid_database_result'),true);
});
