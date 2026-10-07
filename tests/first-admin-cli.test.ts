import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
const input={workspace_id:'00000000-0000-4000-8000-000000000001',principal_id:'00000000-0000-4000-8000-000000000011',
 supabase_user_id:'00000000-0000-4000-8000-000000000101',expected_scope_revision:1,request_id:'00000000-0000-4000-8000-000000000901',reason:'Approved initial admin'};
function run(args:string[]){return spawnSync(process.execPath,['--experimental-strip-types','scripts/plan-first-admin.ts',...args],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH,NODE_NO_WARNINGS:'1'}});}
test('bootstrap CLI is offline by default and emits a complete private transaction',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hd-first-admin-'));try{
  const file=join(dir,'input.json');await writeFile(file,JSON.stringify(input));
  const r=run([file]);assert.equal(r.status,0,r.stderr);const plan=JSON.parse(r.stdout);
  assert.equal(plan.executesDatabase,false);assert.equal(plan.changesCapabilities,false);assert.match(plan.sql,/COMMIT;/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
for(const mode of ['secret','oversize','utf8','missing'] as const)test('bootstrap CLI rejects '+mode+' without disclosing contents',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'hd-first-admin-'));try{
  const file=join(dir,'input.json');
  if(mode==='secret')await writeFile(file,JSON.stringify({...input,password:'DO_NOT_PRINT'}));
  if(mode==='oversize')await writeFile(file,'DO_NOT_PRINT'+' '.repeat(17000));
  if(mode==='utf8')await writeFile(file,Buffer.from([0xff,0xfe]));
  const r=run([file]);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.doesNotMatch(r.stderr,/DO_NOT_PRINT/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('bootstrap CLI rejects execution flags and explains the private operator boundary',()=>{
 for(const args of [[],['--execute'],['a','b']]){const r=run(args);assert.equal(r.status,1);assert.equal(r.stdout,'');}
 const help=run(['--help']);assert.equal(help.status,0);assert.match(help.stdout,/Nenhum SQL/);assert.match(help.stdout,/helpdesk_app/);
});
