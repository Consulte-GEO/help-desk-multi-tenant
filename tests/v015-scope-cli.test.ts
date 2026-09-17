import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
const input={workspace_id:'00000000-0000-4000-8000-000000000001',principal_id:'00000000-0000-4000-8000-000000000011',scopes:['tickets:read'],expected_revision:0,reason:'Synthetic review only',request_id:'00000000-0000-4000-8000-000000000901'};
async function fixture(work:(dir:string,file:string)=>Promise<void>){const dir=await mkdtemp(join(tmpdir(),'hd-scope-plan-'));try{const file=join(dir,'input.json');await writeFile(file,JSON.stringify(input));await work(dir,file);}finally{await rm(dir,{recursive:true,force:true});}}
function run(args:string[]){return spawnSync(process.execPath,['--experimental-strip-types','scripts/plan-human-scopes.ts',...args],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH,NODE_NO_WARNINGS:'1'}});}
test('CLI emits a bounded parameterized offline plan without driver credentials',()=>fixture(async(_,file)=>{const r=run([file]);assert.equal(r.status,0,r.stderr);const plan=JSON.parse(r.stdout);assert.equal(plan.executesDatabase,false);assert.equal(plan.values[0],input.workspace_id);assert.deepEqual(plan.values[2],['tickets:read']);assert.match(plan.sql,/\$1::uuid/);assert.doesNotMatch(plan.sql,/00000000/);}));
for(const mode of ['secret','oversize','utf8','symlink','directory','missing'] as const)test('CLI refuses '+mode+' without printing file content',()=>fixture(async(dir,file)=>{let target=file;
 if(mode==='secret')await writeFile(file,JSON.stringify({...input,password:'DO_NOT_PRINT_THIS'}));
 if(mode==='oversize')await writeFile(file,'DO_NOT_PRINT_THIS'+' '.repeat(17000));
 if(mode==='utf8')await writeFile(file,Buffer.from([0xff,0xfe]));
 if(mode==='symlink'){target=join(dir,'link');await symlink(file,target);}
 if(mode==='directory')target=dir;if(mode==='missing')target=join(dir,'absent');
 const r=run([target]);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.doesNotMatch(r.stderr,/DO_NOT_PRINT_THIS/);assert.match(r.stderr,/Plano recusado/);
}));
test('CLI requires exactly one file path',()=>{for(const args of [[],['one','two']]){const r=run(args);assert.equal(r.status,1);assert.equal(r.stdout,'');assert.match(r.stderr,/Plano recusado/);}});
