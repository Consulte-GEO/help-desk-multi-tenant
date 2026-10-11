import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const entry=fileURLToPath(new URL('../scripts/check-cg-consolidation.mjs',import.meta.url));
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
async function run(args:string[],env:NodeJS.ProcessEnv=process.env,probe?:string){
 await assert.doesNotReject(access(entry),'C01 command-line entrypoint is missing');
 return spawnSync(process.execPath,[...(probe?['--import',pathToFileURL(probe).href]:[]),entry,...args],{encoding:'utf8',timeout:5000,env});
}
async function fixture(version='17.6'){
 const root=await mkdtemp(join(tmpdir(),'helpdesk-consolidation-cli-'));
 const put=async(path:string,data:string)=>{await mkdir(join(root,path,'..'),{recursive:true});await writeFile(join(root,path),data);};
 const migrations:[{file:string;sha256:string}]=[{file:'20260915000100_original.sql',sha256:hash('-- original\n')}];
 const spec={schemaVersion:1,baseCommit:'a'.repeat(40),scope:'candidate-package-only',files:[{path:'src/test.ts',sha256:hash('export const test=1;\n')}],migrations,
  requiredPaths:['package.json'],dependencies:{pg:'8.16.3'},commands:['npm run homologate:local']};
 await put('spec.json',JSON.stringify(spec));await put('src/test.ts','export const test=1;\n');
 await put('package.json','{"type":"module"}');await put('node_modules/pg/package.json','{"version":"8.16.3"}');
 await put('supabase/migrations/'+migrations[0].file,'-- original\n');
 await put('supabase/migrations.manifest.json',JSON.stringify({format:1,schemaVersion:'0.19.0',migrations}));
 // Test-only interception of the version subprocess; no PostgreSQL or shell fixture.
 // --import is a Node test harness option, not an option of the product CLI.
 const name=process.platform==='win32'?'postgres.exe':'postgres';
 await put('tools/'+name,'version-probe-marker');
 const probe=join(root,'version-probe.mjs');
 await put('version-probe.mjs',`
 import childProcess from 'node:child_process';
 import {syncBuiltinESMExports} from 'node:module';
 import {existsSync} from 'node:fs';
 import {basename} from 'node:path';
 childProcess.spawnSync=(file,args,options)=>{
  if(!['postgres','postgres.exe'].includes(basename(file))||JSON.stringify(args)!=='["--version"]'||options.shell!==false)throw Error('Unexpected subprocess');
  return existsSync(file)?{status:0,stdout:${JSON.stringify('postgres (PostgreSQL) '+version+'\n')},stderr:''}:{status:null,error:new Error('missing')};
 };
 syncBuiltinESMExports();
 `);
 return {root,put,probe,name,args:['--root',root,'--manifest',join(root,'spec.json'),'--postgres-bin',join(root,'tools')],close:()=>rm(root,{recursive:true,force:true})};
}
async function owned(work:(f:Awaited<ReturnType<typeof fixture>>)=>Promise<void>,version='17.6'){
 const f=await fixture(version);try{await work(f);}finally{await f.close();}
}
test('C01 CLI help does not attempt database execution',async()=>{
 const r=await run(['--help']);assert.equal(r.status,0);assert.match(r.stdout,/preflight/i);assert.equal(r.stderr,'');
});
test('C01 CLI refuses unknown options with a safe error',async()=>{
 const r=await run(['--private-marker-password']);assert.equal(r.status,2);assert.doesNotMatch(r.stdout+r.stderr,/private-marker-password/);
});
test('C01 CLI reports ready inputs without approving SQL or CI',()=>owned(async f=>{
 const before=await readFile(join(f.root,'src/test.ts'));const r=await run(f.args,process.env,f.probe);
 assert.equal(r.status,0,r.stderr+r.stdout);const report=JSON.parse(r.stdout);
 assert.equal(report.status,'ready_for_existing_runners');assert.equal(report.sqlExecuted,false);assert.equal(report.productionApproved,false);
 assert.deepEqual(await readFile(join(f.root,'src/test.ts')),before);
}));
test('C01 CLI incompatible engine is blocked, never substituted for PG17',()=>owned(async f=>{
 const r=await run(f.args,process.env,f.probe);assert.equal(r.status,2);assert.ok(JSON.parse(r.stdout).blockers.some((x:any)=>x.code==='postgres17_unavailable'));
},'18.0'));
test('C01 CLI missing version executable is a blocker, not a skipped SQL pass',()=>owned(async f=>{
 await rm(join(f.root,'tools',f.name));const r=await run(f.args,process.env,f.probe);assert.equal(r.status,2);assert.equal(JSON.parse(r.stdout).sqlExecuted,false);
}));
test('C01 CLI malformed manifest does not echo its contents',()=>owned(async f=>{
 await f.put('spec.json','private-marker-password');const r=await run(f.args,process.env,f.probe);assert.equal(r.status,2);assert.doesNotMatch(r.stdout+r.stderr,/private-marker-password/);
}));
test('C01 CLI does not consult or reveal a hosted database URL',()=>owned(async f=>{
 const r=await run(f.args,{...process.env,HELPDESK_TEST_ADMIN_URL:'postgres://private-marker-password@hosted.example.invalid/production'},f.probe);
 assert.equal(r.status,0);assert.doesNotMatch(r.stdout+r.stderr,/private-marker-password|hosted\.example/);
}));
test('C01 CLI changed candidate returns no execution commands',()=>owned(async f=>{
 await f.put('src/test.ts','export const test=2;\n');const r=await run(f.args,process.env,f.probe);assert.equal(r.status,2);assert.deepEqual(JSON.parse(r.stdout).nextCommands,[]);
}));
