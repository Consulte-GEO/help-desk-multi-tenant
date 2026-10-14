import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import type {SqlPool} from '../src/infrastructure/sql.ts';
import {READINESS_FLAGS} from '../src/infrastructure/database-security.ts';

async function helper(){try{return await import('./helpers/qualified-v023.ts');}catch(error){assert.fail('Explicit reviewed 0.23 qualification helper is missing: '+String(error));}}
test('the saved 0.23 contract retains the reviewed source bytes',async()=>{
 const saved=await readFile('src/infrastructure/consultegeo-v023-security-contract.ts','utf8').catch(()=>undefined);
 assert.equal(createHash('sha256').update(saved??'').digest('hex'),'894e1d16a5f0dc0cb91b1663ff7d41fa103a36b9039324d2c8ac594c66eb300e','The reviewed 0.23 source must remain unchanged after adopting the native 0.24 inventory');
});
test('historical native suites qualify the exact first sixteen current migration files',async()=>{
 const h=await helper(),bundle=await h.loadQualifiedV023Bundle(process.cwd());
 assert.equal(bundle.schemaVersion,'0.23.0');assert.equal(bundle.migrations.length,16);
 assert.equal(bundle.migrations[15]?.sha256,'10847387946f06cfb292fc849e97917a48cdd0e18ad07ba49a7bc34340b003bd');
});
test('self-consistent manifest changes cannot requalify the immutable 0.23 prefix',async()=>{
 const h=await helper(),root=await mkdtemp(join(tmpdir(),'helpdesk-v023-'));
 try{
  await mkdir(join(root,'supabase'));await cp('supabase/migrations',join(root,'supabase/migrations'),{recursive:true});
  const manifest=JSON.parse(await readFile('supabase/migrations.manifest.json','utf8')) as {migrations:{file:string;sha256:string}[]};
  const m=manifest.migrations[15]!,sql=await readFile(join(root,'supabase/migrations',m.file),'utf8')+'\n-- unreviewed prefix\n';
  m.sha256=createHash('sha256').update(sql).digest('hex');await writeFile(join(root,'supabase/migrations',m.file),sql);
  await writeFile(join(root,'supabase/migrations.manifest.json'),JSON.stringify(manifest));
  await assert.rejects(()=>h.loadQualifiedV023Bundle(root),/qualified 0\.23/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('the historical guard checks the real 0.23 marker and supplies the saved ACL contract',async()=>{
 const h=await helper();let marker='0.23.0';const calls:{sql:string;args?:unknown[]}[]=[];
 const good:Record<string,unknown>={...Object.fromEntries(READINESS_FLAGS.map(k=>[k,true])),table_count:53,unsafe_tables:0,public_schema_access:false,client_schema_access:false,public_helper_execute:false};
 const pool:SqlPool={query:async(sql,args)=>{calls.push({sql,args});return {rows:[sql.includes('schema_version()')?{version:marker}:good],rowCount:1};},connect:async()=>{throw Error('unused');},end:async()=>{}};
 await h.assertSchemaCompatibility(pool);await h.assertDatabaseSecurity(pool);
 const supplied=JSON.parse(String(calls[1]?.args?.[0]));assert.equal(supplied.schemaVersion,'0.23.0');assert.equal(supplied.tables.length,53);
 marker='0.24.0';await assert.rejects(()=>h.assertSchemaCompatibility(pool),{code:'schema_version_mismatch'});
 good.owner_defaults_ok=false;await assert.rejects(()=>h.assertDatabaseSecurity(pool),{code:'unsafe_database_policies'});
});
