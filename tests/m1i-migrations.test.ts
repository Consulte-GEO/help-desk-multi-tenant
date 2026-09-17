import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const file='20260916000100_fixture.sql';const sql='begin; select 1; commit;\n';
const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
async function fixture(fn:(root:string,manifest:{format:number;schemaVersion:string;migrations:{file:string;sha256:string}[]})=>Promise<void>){
 const root=await mkdtemp(join(tmpdir(),'helpdesk-migrations-'));
 const manifest={format:1,schemaVersion:'0.9.0',migrations:[{file,sha256:hash(sql)}]};
 try{await mkdir(join(root,'supabase/migrations'),{recursive:true});await writeFile(join(root,'supabase/migrations',file),sql);
 await writeFile(join(root,'supabase/migrations.manifest.json'),JSON.stringify(manifest));await fn(root,manifest);}finally{await rm(root,{recursive:true,force:true});}
}
async function loader(){const name='../scripts/migration-files.ts';return await import(name);}
test('migration loader is available before any driver import',async()=>{const m=await loader();assert.equal(typeof m.loadMigrationBundle,'function');});
test('verified bytes and reviewed order are returned for execution',async()=>fixture(async(root)=>{
 const m=await loader();const b=await m.loadMigrationBundle(root);assert.equal(b.schemaVersion,'0.9.0');assert.equal(b.migrations.length,1);assert.equal(b.migrations[0].sql,sql);assert.equal(b.migrations[0].file,file);
}));
for(const mode of ['edited','missing','extra','renamed','symbolic-file','symbolic-directory','non-file'])test('migration loader rejects '+mode,async()=>fixture(async(root)=>{
 const path=join(root,'supabase/migrations',file),dir=join(root,'supabase/migrations');
 if(mode==='edited')await writeFile(path,sql+'select 2;');
 if(mode==='missing')await rm(path);
 if(mode==='extra')await writeFile(join(dir,'20260916000200_extra.sql'),sql);
 if(mode==='renamed'){await rm(path);await writeFile(join(dir,'20260916000200_other.sql'),sql);}
 if(mode==='symbolic-file'){await rm(path);await writeFile(join(root,'other.sql'),sql);await symlink(join(root,'other.sql'),path);}
 if(mode==='symbolic-directory'){await rm(dir,{recursive:true});await mkdir(join(root,'other'));await writeFile(join(root,'other',file),sql);await symlink(join(root,'other'),dir);}
 if(mode==='non-file'){await rm(path);await mkdir(path);}
 const m=await loader();await assert.rejects(()=>m.loadMigrationBundle(root));
}));
for(const mode of ['empty','duplicate','traversal','invalid-hash','unknown-field','unsorted','bad-schema','null'])test('migration manifest rejects '+mode,async()=>fixture(async(root,manifest)=>{
 let value:unknown=manifest;
 if(mode==='empty')manifest.migrations=[];
 if(mode==='duplicate')manifest.migrations.push({...manifest.migrations[0]!});
 if(mode==='traversal')manifest.migrations[0]!.file='../escape.sql';
 if(mode==='invalid-hash')manifest.migrations[0]!.sha256='not-a-hash';
 if(mode==='unknown-field')value={...manifest,skip:true};
 if(mode==='unsorted')manifest.migrations.unshift({file:'20260916009900_last.sql',sha256:hash(sql)});
 if(mode==='bad-schema')manifest.schemaVersion='latest';
 if(mode==='null')value=null;
 await writeFile(join(root,'supabase/migrations.manifest.json'),JSON.stringify(value));
 const m=await loader();await assert.rejects(()=>m.loadMigrationBundle(root));
}));
test('a changed file on disk does not replace the bytes already verified',async()=>fixture(async(root)=>{
 const m=await loader(),b=await m.loadMigrationBundle(root);await writeFile(join(root,'supabase/migrations',file),'changed');assert.equal(b.migrations[0].sql,sql);
 await assert.rejects(()=>m.loadMigrationBundle(root));
}));
test('actual project bundle is eight unchanged candidate migrations, not DB execution',async()=>{
 const m=await loader(),b=await m.loadMigrationBundle(process.cwd());assert.equal(b.migrations.length,9);assert.equal(b.schemaVersion,'0.15.0');
 const bytes=await readFile('supabase/migrations/20260916000800_ticket_assignment.sql','utf8');assert.equal(b.migrations[7].sql,bytes);
});
for(const mode of ['manifest-symlink','supabase-symlink','oversized-manifest','oversized-sql','invalid-utf8','empty-sql'])test('migration bytes reject '+mode,async()=>fixture(async(root,manifest)=>{
 const path=join(root,'supabase/migrations',file),manifestPath=join(root,'supabase/migrations.manifest.json');
 if(mode==='manifest-symlink'){await rm(manifestPath);await writeFile(join(root,'external.json'),JSON.stringify(manifest));await symlink(join(root,'external.json'),manifestPath);}
 if(mode==='supabase-symlink'){await rm(join(root,'supabase'),{recursive:true});await mkdir(join(root,'elsewhere'));await symlink(join(root,'elsewhere'),join(root,'supabase'));}
 if(mode==='oversized-manifest')await writeFile(manifestPath,' '.repeat(65537));
 if(['oversized-sql','invalid-utf8','empty-sql'].includes(mode)){
  const bytes=mode==='oversized-sql'?Buffer.alloc(2*1024*1024+1,32):mode==='invalid-utf8'?Buffer.from([0xff,0xfe]):Buffer.alloc(0);
  await writeFile(path,bytes);manifest.migrations[0]!.sha256=createHash('sha256').update(bytes).digest('hex');await writeFile(manifestPath,JSON.stringify(manifest));
 }
 const m=await loader();await assert.rejects(()=>m.loadMigrationBundle(root));
}));
