import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {runRuntimePreflight} from '../src/infrastructure/runtime-preflight.ts';
import {eventFixture,fixtureConfig} from './helpers/preflight-event-fixture.ts';
import type {EventMode} from './helpers/preflight-event-fixture.ts';

for(const mode of ['async-query','after-query','release','pool-end','pool-before-connect'] satisfies EventMode[]){
 test('diagnostic owns client errors without crash or raw payload: '+mode,()=>{
  const script=`
   import {runRuntimePreflight} from './src/infrastructure/runtime-preflight.ts';
   import {eventFixture,fixtureConfig} from './tests/helpers/preflight-event-fixture.ts';
   const fixture=eventFixture(${JSON.stringify(mode)});
   try { const report=await runRuntimePreflight(fixtureConfig,{connect:true,poolFactory:async()=>fixture.pool});
    console.log(JSON.stringify({report,queries:fixture.calls.length,state:fixture.state()}));
   } finally {fixture.close();}
  `;
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const child=spawnSync(process.execPath,['--experimental-strip-types','--input-type=module','-e',script],
   {cwd:new URL('../',import.meta.url),encoding:'utf8',env,timeout:5_000});
  assert.equal(child.status,0,'Diagnostic child must return a report, not crash: '+child.stderr);
  assert.doesNotMatch(child.stdout+child.stderr,/PRIVATE_DIAGNOSTIC_SENTINEL|fixture_password|pooler\.invalid/);
  const {report,queries,state}=JSON.parse(child.stdout);
  assert.equal(report.success,false);assert.equal(report.checks.find((c:{id:string})=>c.id==='connection').status,'failed');
  assert.deepEqual(state,{releases:1,ends:1,connects:1});
  if(mode==='pool-before-connect')assert.equal(queries,0);
  if(mode==='async-query'||mode==='after-query'){
   assert.equal(queries,1,'Do not issue new SQL, including rollback, through a broken connection');
   assert.equal(report.checks.find((c:{id:string})=>c.id==='rollback').status,'failed');
  }
  assert.equal(report.production_approved,false);assert.equal(report.operational,false);
  assert.equal(report.auth_tested,false);assert.equal(report.hosted_function_tested,false);
  assert.equal(report.business_operations_dispatched,0);
 });
}
test('diagnostic preserves another client error listener and still rejects the report',async()=>{
 const f=eventFixture('after-query');let observed=0;const other=()=>{observed++;};f.client.on('error',other);
 try{
  const report=await runRuntimePreflight(fixtureConfig,{connect:true,poolFactory:async()=>f.pool});
  assert.equal(report.success,false);assert.equal(observed,1);assert.ok(f.client.listeners('error').includes(other));
  assert.equal(f.calls.length,1);
 }finally{f.close();}
});
test('query rejection without connection event still attempts exactly one rollback',async()=>{
 const f=eventFixture('query-rejection');
 try{
  const report=await runRuntimePreflight(fixtureConfig,{connect:true,poolFactory:async()=>f.pool});
  assert.equal(report.success,false);assert.deepEqual(f.calls,['BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY','ROLLBACK']);
  assert.equal(report.checks.find(c=>c.id==='rollback')?.status,'passed');
 }finally{f.close();}
});
test('healthy EventEmitter client preserves successful read-only diagnostic',async()=>{
 const f=eventFixture('none');try{
  const report=await runRuntimePreflight(fixtureConfig,{connect:true,poolFactory:async()=>f.pool});
  assert.equal(report.success,true);assert.equal(f.calls.at(-1),'ROLLBACK');assert.deepEqual(f.state(),{releases:1,ends:1,connects:1});
 }finally{f.close();}
});

test('release gate and explicit TLS command include the new transport regressions',async()=>{
 const {readFile}=await import('node:fs/promises');
 const modulePath='../scripts/homologation-core.mjs';const {steps}=await import(modulePath);
 assert.ok(steps.find((s:{id:string})=>s.id==='application').minTests>=1114);
 assert.ok(steps.find((s:{id:string})=>s.id==='postgres').minTests>=204);
 const pkg=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));
 assert.equal(pkg.scripts['test:tls:local'],'node --experimental-strip-types --test --test-reporter=tap tests/m1-preflight-tls.test.ts');
 const workflow=await readFile(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');
 assert.match(workflow,/run: openssl version/);
});
