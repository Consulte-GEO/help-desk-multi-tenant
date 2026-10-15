/** Filesystem/preflight only. These tests never start PostgreSQL. */
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
const path='../scripts/registration-native-safety.mjs';const safety:any=await import(path).catch(()=>({}));
const requireFn=(name:string)=>{assert.equal(typeof safety[name],'function',`${name} must be implemented`);return safety[name];};
for(const [name,value,expected] of [
 ['initdb','initdb (PostgreSQL) 17.6\n','17.6'],['pg_ctl','pg_ctl (PostgreSQL) 17.6 (vendor build)\n','17.6'],
 ['initdb','initdb (PostgreSQL) 18.0\n',null],['pg_ctl','initdb (PostgreSQL) 17.6\n',null],
 ['initdb','prefix initdb (PostgreSQL) 17.6\n',null],['initdb','initdb (PostgreSQL) 17.6\nextra',null],
 ['postgres','postgres (PostgreSQL) 17.6',null]
] as const)test(`binary version admission: ${name}/${JSON.stringify(value)}`,()=>assert.equal(requireFn('nativeBinaryVersion')(name,value),expected));
test('socket paths use PostgreSQL configuration escaping, never shell interpolation',()=>{
 const text=requireFn('isolatedPostgresSettings')("/tmp/hda-owned/it's\\mine/socket");
 assert.equal(text,"\nlisten_addresses = ''\nport = 5432\nunix_socket_directories = '/tmp/hda-owned/it''s\\\\mine/socket'\n");
});
for(const socket of ['/tmp/bad\nsetting','relative/socket','/tmp/\u0000','/tmp/'+ 'a'.repeat(120)])test(`socket path refuses unsafe/oversized input ${socket.length}`,()=>{const fn=requireFn('isolatedPostgresSettings');assert.throws(()=>fn(socket));});
function fixture(work:(root:string,proof:string)=>void){const root=mkdtempSync(join(tmpdir(),'hda02-owned-')),proof='a'.repeat(64);try{writeFileSync(join(root,'ownership'),proof,{mode:0o600});work(root,proof);}finally{rmSync(root,{recursive:true,force:true});}}
test('ownership verification allows only the exact newly owned marker',()=>fixture((r,p)=>{const owns=requireFn('ownsRegistrationCluster');assert.equal(owns(r,p),true);assert.equal(owns(r,'b'.repeat(64)),false);assert.equal(owns(r,'a'),false);}));
test('ownership verification refuses a symlinked marker',()=>fixture((r,p)=>{rmSync(join(r,'ownership'));writeFileSync(join(r,'target'),p);symlinkSync(join(r,'target'),join(r,'ownership'));assert.equal(requireFn('ownsRegistrationCluster')(r,p),false);}));
for(const part of ['data','socket'])test(`ownership verification refuses symlinked ${part}`,()=>fixture((r,p)=>{mkdirSync(join(r,'elsewhere'));symlinkSync(join(r,'elsewhere'),join(r,part));assert.equal(requireFn('ownsRegistrationCluster')(r,p),false);}));
test('ownership verification refuses non-cluster paths',()=>assert.equal(requireFn('ownsRegistrationCluster')('/tmp','a'.repeat(64)),false));
test('ownership verification refuses a symlinked root even with the original marker',()=>fixture((r,p)=>{const link=r+'-alias';try{symlinkSync(r,link);assert.equal(requireFn('ownsRegistrationCluster')(link,p),false);}finally{rmSync(link,{force:true});}}));
test('source preflight cannot mistake the verification subset for the full repository',()=>{
 const root=mkdtempSync(join(tmpdir(),'hda-source-'));try{
  mkdirSync(join(root,'src/infrastructure'),{recursive:true});writeFileSync(join(root,'src/infrastructure/transaction.ts'),'synthetic');
  writeFileSync(join(root,'package.json'),JSON.stringify({name:'hda-local-subset-verification-only',dependencies:{pg:'8.16.3'}}));
  const issues=requireFn('registrationNativeSourceIssues')(root);assert.ok(issues.includes('complete_repository_required'));assert.ok(issues.includes('canonical_package_required'));assert.ok(issues.includes('pinned_lock_required'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('source preflight accepts complete required metadata without claiming SQL execution',()=>{
 const root=mkdtempSync(join(tmpdir(),'hda-source-'));try{
  for(const path of ['src/infrastructure/transaction.ts','src/infrastructure/database-security-contract.ts','src/application/helpdesk.ts','scripts/migration-files.ts','scripts/database-target.ts','supabase/migrations.manifest.json','shared/form-rules.js']){const parts=path.split('/');parts.pop();mkdirSync(join(root,...parts),{recursive:true});writeFileSync(join(root,path),'synthetic metadata fixture');}
  writeFileSync(join(root,'package.json'),JSON.stringify({name:'@consulte-geo/helpdesk',dependencies:{pg:'8.16.3'}}));
  const lock={lockfileVersion:3,packages:{'':{dependencies:{pg:'8.16.3'}},'node_modules/pg':{version:'8.16.3',integrity:'sha512-YQ=='}}};
  writeFileSync(join(root,'package-lock.json'),JSON.stringify(lock));
  const inspect=requireFn('registrationNativeSourceIssues');assert.deepEqual(inspect(root),[]);
  lock.packages['node_modules/pg'].version='8.16.4';writeFileSync(join(root,'package-lock.json'),JSON.stringify(lock));assert.deepEqual(inspect(root),['pinned_lock_required']);
 }finally{rmSync(root,{recursive:true,force:true});}
});
