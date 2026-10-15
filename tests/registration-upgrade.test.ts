import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {compileRegistrationUpgrade,verifyRegistrationUpgrade,REGISTRATION_COMPONENTS,REGISTRATION_MIGRATION} from '../scripts/registration-upgrade.ts';
const components=()=>Promise.all(REGISTRATION_COMPONENTS.map(c=>readFile('supabase/candidates/'+c.file,'utf8')));
test('official HDA append reproduces exactly from pinned components without candidate-only admission',async()=>{
 const sources=await components(),sql=compileRegistrationUpgrade(sources);assert.equal(sql,await readFile('supabase/migrations/'+REGISTRATION_MIGRATION,'utf8'));
 assert.doesNotMatch(sql,/hda02\.disposable|current_database\(\)\s*<>\s*'helpdesk_test'/);
 assert.match(sql,/Exact HDA base catalogue required/);assert.match(sql,/Exact HDA final catalogue required/);
 assert.match(sql,/NOLOGIN NOSUPERUSER NOBYPASSRLS/);assert.match(sql,/SELECT '0\.26\.0'::text/);
 assert.doesNotMatch(sql,/insert into helpdesk_auth\.principals/i);
 assert.equal((await verifyRegistrationUpgrade(process.cwd())).schemaVersion,'0.26.0');
});
test('HDA compiler refuses reordered, edited or missing components before producing SQL',async()=>{
 const sources=await components();for(const bad of [[...sources].reverse(),sources.slice(1),sources.map((s,i)=>i===0?s+'\n-- altered':s)])assert.throws(()=>compileRegistrationUpgrade(bad));
});
