import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,writeFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const script=fileURLToPath(new URL('../scripts/runtime-preflight.ts',import.meta.url));
function env(valid=true):NodeJS.ProcessEnv{
 const e={...process.env};delete e.NODE_TEST_CONTEXT;
 for(const key of Object.keys(e))if(key.startsWith('HELPDESK_')||key==='SUPABASE_URL'||key==='SUPABASE_PUBLISHABLE_KEY')delete e[key];
 if(valid)Object.assign(e,{HELPDESK_DATABASE_URL:'postgresql://helpdesk_app:PRIVATE_FIXTURE@pooler.invalid/postgres',
  SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',
  HELPDESK_RATE_LIMIT_HMAC_KEY:'f'.repeat(43),HELPDESK_RELEASE_APPROVED:'false'});
 return e;
}
function run(args:string[]=[],e=env(),cwd?:string){
 assert.ok(existsSync(script),'Private preflight CLI is not implemented');
 return spawnSync(process.execPath,['--experimental-strip-types',script,...args],{env:e,cwd,encoding:'utf8',timeout:10_000});
}
function report(args:string[]=[],e=env(),cwd?:string){const result=run(args,e,cwd);
 assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_FIXTURE|pooler\.invalid|sb_publishable_fixture/);
 return {result,data:JSON.parse(result.stdout)};
}
test('CLI defaults to offline configuration with a source-bound report and no operational approval',()=>{
 const {result,data}=report();assert.equal(result.status,0,result.stderr);assert.equal(data.success,true);
 assert.equal(data.mode,'configuration');assert.equal(data.release_flag,'closed');assert.equal(data.operational,false);
 assert.equal(data.production_approved,false);assert.equal(data.auth_tested,false);assert.equal(data.hosted_function_tested,false);
 assert.match(data.source_fingerprint,/^[a-f0-9]{64}$/);assert.ok(Number.isFinite(Date.parse(data.started_at)));
 assert.ok(data.checks.filter((c:any)=>c.id!=='configuration').every((c:any)=>c.status==='not_executed'));
});
test('CLI does not discover or load a .env file from the current directory',()=>{
 const dir=mkdtempSync(join(tmpdir(),'helpdesk-private-preflight-'));
 try{
  writeFileSync(join(dir,'.env'),'HELPDESK_RELEASE_APPROVED=true\nHELPDESK_DATABASE_URL=PRIVATE_FIXTURE\n');
  const {result,data}=report([],env(false),dir);assert.equal(result.status,1);
  assert.equal(data.checks[0].code,'configuration_required');assert.deepEqual(readdirSync(dir),['.env']);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
for(const args of [['--connect','--connect'],['--connect','--help'],['--approve'],['--database-url=PRIVATE_FIXTURE'],['--connect=true']])
 test('CLI rejects unknown or conflicting flags without echoing them: '+args[0],()=>{
  const {result,data}=report(args);assert.equal(result.status,1);assert.equal(data.code,'invalid_arguments');assert.equal(data.production_approved,false);
 });
test('CLI --connect with missing configuration fails before a driver/connection probe',()=>{
 const {result,data}=report(['--connect'],env(false));assert.equal(result.status,1);
 assert.equal(data.mode,'database');assert.equal(data.checks.find((c:any)=>c.id==='connection').status,'not_executed');
});
test('CLI help documents the opt-in and never prints configured values',()=>{
 const result=run(['--help']);assert.equal(result.status,0);assert.match(result.stdout,/--connect/);assert.match(result.stdout,/somente leitura/);
 assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_FIXTURE|pooler\.invalid|sb_publishable_fixture/);
});
