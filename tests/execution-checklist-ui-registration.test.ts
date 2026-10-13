import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('HDN browser scenario is registered once, preserving every current UI suite',async()=>{
 const runner=await readFile(new URL('../scripts/test-ui-local.mjs',import.meta.url),'utf8');
 for(const prior of ['smoke-local-http.mjs','browser-smoke.py','browser-simple-access.py','browser-human-session.py','browser-note-recovery.py','browser-admin-members.py'])assert.equal(runner.split(prior).length-1,1);
 assert.equal(runner.split('browser-execution-checklist.py').length-1,1);assert.match(runner,/browser-execution-checklist\.py'\],ownsFixture:true/);assert.match(runner,/timeoutMs:120_000/);
});
