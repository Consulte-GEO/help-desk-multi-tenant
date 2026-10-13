import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {parseExecutionChecklistTemplate,assertExecutionChecklistComplete} from '../src/domain/execution-checklist.ts';
import {requestHash} from '../src/domain/canonical.ts';
const file=JSON.parse(await readFile(new URL('../profiles/consultegeo/execution-checklists.draft.json',import.meta.url),'utf8'));
const uuid='00000000-0000-4000-8000-000000000001';
test('HDN01 operator models are four explicit drafts, never automatic publications',()=>{assert.equal(file.templates.length,4);assert.equal(file.status,'draft');assert.equal(file.automaticPublication,false);assert.equal(new Set(file.templates.map((x:any)=>x.id)).size,4);assert.match(file.source.sha256,/^[a-f0-9]{64}$/);});
for(const raw of file.templates)test('HDN01 '+raw.id+' is valid draft but cannot satisfy resolution',()=>{
 const t=parseExecutionChecklistTemplate(raw);assert.ok(Object.isFrozen(t.items));assert.equal(t.status,'draft');
 const reference={id:t.id,version:t.version,sha256:requestHash(t)};
 assert.throws(()=>assertExecutionChecklistComplete({template:t,snapshot:null},{workspaceId:uuid,accountId:uuid,ticketId:uuid,ticketVersion:1,profileVersionId:'P1',reference},'2026-10-12T12:00:00.000Z'),{code:'workflow_checklist_required'});
});
test('HDN01 trace model does not impose 28 days or execute source actions',()=>{const t=file.templates.find((x:any)=>x.id==='cadastro-traco');assert.doesNotMatch(JSON.stringify(t),/28|execute_sql|endpoint|http:\/\/|https:\/\//);assert.ok(t.items.some((x:any)=>x.risk==='sensitive'));});
