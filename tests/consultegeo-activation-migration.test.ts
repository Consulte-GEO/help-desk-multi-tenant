import test from 'node:test';import assert from 'node:assert/strict';import {readFile,cp,mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
import {DATABASE_SECURITY_CONTRACT as current} from '../src/infrastructure/consultegeo-v024-security-contract.ts';
async function recipe(){try{return await import('../scripts/consultegeo-activation-upgrade.ts');}catch(error){assert.fail('The append-only activation recipe is missing: '+String(error));}}
const guard='DO $candidate$ BEGIN RAISE EXCEPTION \'disposable only\'; END $candidate$;';
const body='\n\nCREATE FUNCTION helpdesk_auth.example() RETURNS text LANGUAGE sql SET search_path=\'\' AS $$SELECT \'unchanged\'::text$$;\n';
test('activation body extraction preserves every byte except the candidate guard',async()=>{
 const {extractActivationBody}=await recipe(),source='-- private module\n'+guard+body;
 assert.equal(extractActivationBody('cg_local_registry.sql',source),'-- private module\n'+body);
});
test('notification envelope is removed explicitly so promotion has one outer transaction',async()=>{
 const {extractActivationBody}=await recipe(),source='-- private delivery\nBEGIN;\n'+guard+body+'COMMIT;\n';
 assert.equal(extractActivationBody('hdn_notification_delivery.sql',source),'-- private delivery\n\n'+body+'\n');
 for(const changed of [source.replace('BEGIN;','START TRANSACTION;'),source.replace('COMMIT;','ROLLBACK;'),source+'COMMIT;\n'])
  assert.throws(()=>extractActivationBody('hdn_notification_delivery.sql',changed),/activation recipe/);
});
test('activation cannot strip an executable prelude, another guard or an unknown module',async()=>{
 const {extractActivationBody}=await recipe();
 for(const source of ['SELECT 1;\n'+guard+body,guard+'\n'+guard+body,'-- missing guard\n'+body,'BEGIN;\n'+guard+body+'COMMIT;'])
  assert.throws(()=>extractActivationBody('cg_local_registry.sql',source),/activation recipe/);
 assert.throws(()=>extractActivationBody('unreviewed.sql',guard+body),/activation recipe/);
});
test('the activation recipe pins all sixteen qualified migration bytes',async()=>{
 const {ACTIVATION_BASELINE}=await recipe(),saved=JSON.parse(await readFile('tests/fixtures/migration-baselines/v023.json','utf8'));
 assert.deepEqual(ACTIVATION_BASELINE,saved.migrations);assert.equal(ACTIVATION_BASELINE.length,16);
 assert.ok(Object.isFrozen(ACTIVATION_BASELINE));assert.ok(ACTIVATION_BASELINE.every(Object.isFrozen));
});
async function components():Promise<{file:string;sha256:string;sql:string}[]>{const m=await recipe();return Promise.all(m.QUALIFIED_ACTIVATION_COMPONENTS.map(async component=>({...component,sql:await readFile('supabase/candidates/'+component.file,'utf8')})));}
test('current schema 0.24 adopts exactly the complete captured native inventory',async()=>{
 assert.equal(current.schemaVersion,'0.24.0');assert.equal(current.tables.length,67);assert.equal(current.functions.length,162);
 const {ACTIVATION_INVENTORY_SOURCE}=await recipe(),inventory=JSON.parse(await readFile(ACTIVATION_INVENTORY_SOURCE,'utf8'));assert.deepEqual(current,inventory);
 const worker=current.roles.find(role=>role.name==='helpdesk_notification_worker');assert.deepEqual(worker?.schemas,['helpdesk_auth']);assert.equal(worker?.functions.length,13);
 for(const table of current.tables.filter(table=>/\.(cg_local_|cg_initial_|hdn_notification_)/.test(table.name)))assert.deepEqual([table.read,table.insert,table.updates],[false,false,[]]);
});
test('activation compiler emits deterministic atomic SQL and publishes the marker after exact ACL qualification',async()=>{
 const m=await recipe(),sources=await components(),sql=m.compileConsulteGeoActivation(sources);
 assert.equal(sql,m.compileConsulteGeoActivation(sources));assert.equal([...sql.matchAll(/^BEGIN;$/gm)].length,1);assert.equal([...sql.matchAll(/^COMMIT;$/gm)].length,1);
 assert.match(sql,/current_user<>session_user/);assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/bootstrap\.oid=10 AND bootstrap\.rolsuper/);
 assert.match(sql,/Incompatible operator defaults refused/);assert.match(sql,/schema_version\(\) IS DISTINCT FROM '0\.23\.0'/);
 assert.doesNotMatch(sql,/app\.(?:cg_local_candidate|hdn_notification_candidate|cg_initial_candidate)|current_database\(\)<>\s*'helpdesk_test'|DO\s+\$candidate\$/);
 const guard=sql.indexOf('END $activation_final_catalogue$;'),marker=sql.indexOf("SELECT '0.24.0'::text");assert.ok(guard>0&&marker>guard);
 for(const component of sources){assert.ok(sql.includes('-- SOURCE '+component.file+' SHA256 '+component.sha256));assert.ok(sql.includes(m.extractActivationBody(component.file,component.sql)));}
});
for(const mode of ['missing','reordered','duplicate','altered-source','altered-hash','unknown-file','extra-field'])test('activation compiler rejects '+mode,async()=>{
 const m=await recipe(),sources=await components();
 if(mode==='missing')sources.pop();if(mode==='reordered')[sources[0],sources[1]]=[sources[1]!,sources[0]!];if(mode==='duplicate')sources[1]=sources[0]!;
 if(mode==='altered-source')sources[0]!.sql+='\n-- unreviewed';if(mode==='altered-hash')sources[0]!.sha256='a'.repeat(64);if(mode==='unknown-file')sources[0]!.file='outside.sql';if(mode==='extra-field')Object.assign(sources[0]!,{adopt:true});
 assert.throws(()=>m.compileConsulteGeoActivation(sources),/activation recipe/);
});
async function fixture(work:(root:string)=>Promise<void>){const root=await mkdtemp(join(tmpdir(),'helpdesk-activation-'));try{
 await mkdir(join(root,'supabase'));await cp('supabase/migrations',join(root,'supabase/migrations'),{recursive:true});await cp('supabase/candidates',join(root,'supabase/candidates'),{recursive:true});
 await cp('supabase/migrations.manifest.json',join(root,'supabase/migrations.manifest.json'));await cp('supabase/consultegeo-activation.manifest.json',join(root,'supabase/consultegeo-activation.manifest.json'));
 for(const file of ['consultegeo-upgrade.manifest.json','consultegeo-guard-revision.manifest.json','consultegeo-email-wave2.manifest.json'])await cp(join('supabase',file),join(root,'supabase',file));
 await cp('supabase/qualifications',join(root,'supabase/qualifications'),{recursive:true});await work(root);
 }finally{await rm(root,{recursive:true,force:true});}}
test('activation verifier binds the CLI-generated append, frozen sources, original sixteen hashes and real native receipt',async()=>{const m=await recipe(),verified=await m.verifyConsulteGeoActivation(process.cwd());assert.equal(verified.schemaVersion,'0.24.0');assert.match(verified.file,/^\d{14}_consultegeo_operational_activation\.sql$/);const manifest=JSON.parse(await readFile('supabase/consultegeo-activation.manifest.json','utf8'));assert.equal(manifest.generatedBy.version,'2.120.0');assert.equal(manifest.baseline.length,16);assert.deepEqual(manifest.qualification,m.ACTIVATION_QUALIFICATION);});
test('activation qualification survives a source-only stage with no historical evidence',async()=>{const m=await recipe();await fixture(async root=>{
 await assert.rejects(()=>readFile(join(root,'evidence/consultegeo-activation/security-inventory.json')), {code:'ENOENT'});
 const verified=await m.verifyConsulteGeoActivation(root);assert.equal(verified.schemaVersion,'0.24.0');
 const {verifyConsulteGeoUpgrade}=await import('../scripts/consultegeo-upgrade.ts');assert.equal((await verifyConsulteGeoUpgrade(root)).schemaVersion,'0.20.0');
 const {loadQualifiedV023Bundle}=await import('./helpers/qualified-v023.ts');assert.equal((await loadQualifiedV023Bundle(root)).migrations.length,16);
 await assert.rejects(()=>readFile(join(root,'evidence/consultegeo-activation/security-inventory.json')), {code:'ENOENT'});
});});
test('the exact native qualification inventory participates in the source fingerprint',async()=>{const m=await recipe();await fixture(async root=>{
 const path=join(root,m.ACTIVATION_INVENTORY_SOURCE),bytes=await readFile(path);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),m.ACTIVATION_QUALIFICATION.inventorySha256);
 const corePath='../scripts/homologation-core.mjs', {sourceFingerprint}=await import(corePath),before=await sourceFingerprint(root);
 await writeFile(path,Buffer.concat([bytes,Buffer.from(' ')]));assert.notEqual(await sourceFingerprint(root),before);
});});
test('the original standalone M05 verifier also qualifies the complete current eighteen-file bundle',async()=>{const {verifyConsulteGeoUpgrade}=await import('../scripts/consultegeo-upgrade.ts');const verified=await verifyConsulteGeoUpgrade(process.cwd());assert.equal(verified.schemaVersion,'0.20.0');const manifest=JSON.parse(await readFile('supabase/migrations.manifest.json','utf8'));assert.equal(manifest.schemaVersion,'0.25.0');assert.equal(manifest.migrations.length,18);});
for(const mode of ['baseline-rehashed','source-rehashed','sql-rehashed','file-renamed','recipe-extra','receipt-altered'])test('activation verifier rejects '+mode+' without repair',async()=>{const m=await recipe();await fixture(async root=>{
 const manifestPath=join(root,'supabase/migrations.manifest.json'),recipePath=join(root,'supabase/consultegeo-activation.manifest.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8')),r=JSON.parse(await readFile(recipePath,'utf8'));
 const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
 if(mode==='baseline-rehashed'){const old=manifest.migrations[15],body=await readFile(join(root,'supabase/migrations',old.file),'utf8')+'\n-- prefix changed';await writeFile(join(root,'supabase/migrations',old.file),body);old.sha256=hash(body);r.baseline[15].sha256=old.sha256;}
 if(mode==='source-rehashed'){const c=r.components[0],path=join(root,'supabase/candidates',c.file),body=await readFile(path,'utf8')+'\n-- source changed';await writeFile(path,body);c.sha256=hash(body);}
 if(mode==='sql-rehashed'){const last=manifest.migrations[16],path=join(root,'supabase/migrations',last.file),body=await readFile(path,'utf8')+'\n-- wrapper changed';await writeFile(path,body);last.sha256=r.sha256=hash(body);}
 if(mode==='file-renamed'){const last=manifest.migrations[16],old=join(root,'supabase/migrations',last.file),body=await readFile(old,'utf8');await rm(old);last.file=r.file=last.file.replace('operational_activation','unqualified_activation');await writeFile(join(root,'supabase/migrations',last.file),body);}
 if(mode==='recipe-extra')r.adopt=true;if(mode==='receipt-altered'){const path=join(root,m.ACTIVATION_INVENTORY_SOURCE);await writeFile(path,await readFile(path,'utf8')+' ');}
 await writeFile(manifestPath,JSON.stringify(manifest));await writeFile(recipePath,JSON.stringify(r));const before=await readFile(recipePath,'utf8');await assert.rejects(()=>m.verifyConsulteGeoActivation(root),/activation recipe/);assert.equal(await readFile(recipePath,'utf8'),before);
 });});
