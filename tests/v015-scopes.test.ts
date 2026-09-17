import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePrincipal} from '../src/infrastructure/principal-validation.ts';
import {principal,ticket} from './fixtures.ts';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
const w='00000000-0000-4000-8000-000000000001';
const p='00000000-0000-4000-8000-000000000011';
const request='00000000-0000-4000-8000-000000000099';
const load=()=>import('../src/application/human-scope-change.ts');
const input=()=>({workspace_id:w,principal_id:p,scopes:['tickets:read'],expected_revision:0,reason:'Provisionamento revisado',request_id:request});
test('scope plan is a bound, non-executing command with explicit expected revision',async()=>{
 const {planHumanScopeChange}=await load();const result=planHumanScopeChange(input());
 assert.equal(result.sql,'select helpdesk_auth.set_human_scopes($1::uuid,$2::uuid,$3::text[],$4::integer,$5::text,$6::uuid) as revision');
 assert.deepEqual(result.values,[w,p,['tickets:read'],0,'Provisionamento revisado',request]);
 assert.equal(result.executesDatabase,false);
});
test('scope plan canonicalizes order without adding read or write capabilities',async()=>{
 const {planHumanScopeChange}=await load();const result=planHumanScopeChange({...input(),scopes:['notes:write','tickets:read']});
 assert.deepEqual(result.values[2],['tickets:read','notes:write']);
});
test('scope plan explicitly permits revoking all capabilities',async()=>{
 const {planHumanScopeChange}=await load();assert.deepEqual(planHumanScopeChange({...input(),scopes:[],expected_revision:2}).values[2],[]);
});
for(const [label,patch] of [
 ['unknown capability',{scopes:['admin:*']}],['duplicate',{scopes:['tickets:read','tickets:read']}],['null capability',{scopes:[null]}],
 ['missing scopes',{scopes:undefined}],['string scopes',{scopes:'tickets:read'}],['negative revision',{expected_revision:-1}],
 ['noninteger revision',{expected_revision:1.5}],['null revision',{expected_revision:null}],['overflow revision',{expected_revision:2147483647}],
 ['blank reason',{reason:'  '}],['invalid text',{reason:'reason\u0000'}],['long reason',{reason:'x'.repeat(1001)}],
 ['demo workspace',{workspace_id:'workspace-a'}],['demo principal',{principal_id:'agent-a'}],['invalid request',{request_id:'none'}],
 ['extra privilege',{role:'admin'}],['credentials field',{password:'never-accepted'}]
] as const)test('scope plan rejects '+label,async()=>{const {planHumanScopeChange}=await load();assert.throws(()=>planHumanScopeChange({...input(),...patch}),{code:'invalid_scope_change'});});
test('shared scope contract refuses sparse arrays and never promotes provider metadata',async()=>{
 const {parseScopeList}=await import('../src/domain/scopes.ts');
 assert.throws(()=>parseScopeList(Array(1)));assert.deepEqual(parseScopeList([]),[]);
 assert.throws(()=>validatePrincipal({id:p,workspaceId:w,kind:'human',workspaceRole:'admin',grants:[],scopes:Array(1)},w,'human'),{code:'invalid_principal'});
});
test('notes-write-only has own idempotent receipt but cannot list notes, alter a ticket or access another account',async()=>{
 const t=ticket(),db=new MemoryUnitOfWork({tickets:[t]}),service=new HelpdeskService(db);
 const agent=principal({id:'agent-a',grants:[{accountId:'account-a',role:'agent'}],scopes:['tickets:read','notes:write']});
 const first=await service.addNote(agent,t.id,'Nota privada própria','scope-write-only-key','scope-request');
 const replay=await service.addNote(agent,t.id,'Nota privada própria','scope-write-only-key','scope-request');
 assert.equal(replay.replayed,true);assert.deepEqual(replay.note,first.note);
 assert.equal(db.snapshot().notes.length,1);assert.equal(db.snapshot().outbox.length,0);
 await assert.rejects(()=>service.notes(agent,t.id),{status:403});
 await assert.rejects(()=>service.addMessage(agent,t.id,'public','scope-public-message','scope-request'),{status:403});
 await assert.rejects(()=>service.addNote({...agent,scopes:['tickets:read','notes:read']},t.id,'Nota privada própria','scope-write-only-key','scope-request'),{status:403});
 await assert.rejects(()=>service.addNote({...agent,workspaceId:'workspace-b'},t.id,'Nota privada própria','scope-write-only-key','scope-request'),{status:404});
});
