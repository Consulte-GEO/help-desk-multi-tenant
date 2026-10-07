import test from 'node:test';
import assert from 'node:assert/strict';
import {planFirstAdminBootstrap} from '../src/application/first-admin-bootstrap.ts';
const input={workspace_id:'00000000-0000-4000-8000-000000000001',principal_id:'00000000-0000-4000-8000-000000000011',
 supabase_user_id:'00000000-0000-4000-8000-000000000101',expected_scope_revision:1,
 request_id:'00000000-0000-4000-8000-000000000901',reason:'Approved initial administrator'};

test('bootstrap produces a deterministic private operator transaction and preserves capabilities',()=>{
 const p=planFirstAdminBootstrap(input);assert.equal(p.executesDatabase,false);assert.equal(p.humanAuthTested,false);
 assert.equal(p.changesCapabilities,false);assert.match(p.requestHash,/^[a-f0-9]{64}$/);
 assert.equal(p.requestHash,planFirstAdminBootstrap({...input}).requestHash);
 assert.match(p.sql,/BEGIN;/);assert.match(p.sql,/COMMIT;/);assert.match(p.sql,/rolsuper or rolbypassrls/);
 assert.match(p.sql,/set_human_scopes/);assert.match(p.sql,/GET DIAGNOSTICS/);
 assert.doesNotMatch(p.sql,/GRANT |CREATE |ALTER |DELETE |tickets:write|notes:read|notes:write/);
 assert.doesNotMatch(p.sql,/action LIKE/,'bootstrap history uses an exact namespace, not SQL wildcards');
});
test('request hash binds the exact subject, revision and approved reason',()=>{
 const p=planFirstAdminBootstrap(input);
 for(const changed of [{...input,principal_id:input.supabase_user_id},{...input,expected_scope_revision:2},
  {...input,reason:'Another approval'},{...input,request_id:input.supabase_user_id}])
  assert.notEqual(planFirstAdminBootstrap(changed).requestHash,p.requestHash);
});
test('UUID normalization and reason trimming do not create another intent',()=>{
 assert.equal(planFirstAdminBootstrap({...input,workspace_id:input.workspace_id.toUpperCase(),reason:' '+input.reason+' '}).requestHash,
  planFirstAdminBootstrap(input).requestHash);
});
test('SQL quoting cannot let approved prose terminate the anonymous operation',()=>{
 const p=planFirstAdminBootstrap({...input,reason:"A ' quote \\ path $helpdesk_bootstrap$; SELECT 'attack'; --"});
 const tag=p.sql.match(/DO (\$[a-z0-9_]+\$)/)?.[1];assert.ok(tag);assert.notEqual(tag,'$helpdesk_bootstrap$');
 assert.equal(p.sql.split(tag).length,3);assert.match(p.sql,/A '' quote/);
 assert.match(p.sql,/SET LOCAL standard_conforming_strings = on/);
});
for(const bad of [null,[],{}, {...input,password:'DO_NOT_PRINT'}, {...input,scopes:['tickets:write']},
 {...input,workspace_id:'demo-workspace'}, {...input,supabase_user_id:null}, {...input,expected_scope_revision:-1},
 {...input,expected_scope_revision:2147483647}, {...input,expected_scope_revision:1.5}, {...input,reason:' '},
 {...input,reason:'a'.repeat(901)}, {...input,reason:'bad\u0000reason'}, {...input,reason:'bad\ud800reason'}])
 test('bootstrap refuses malformed or privilege-bearing input without echoing it',()=>{
  assert.throws(()=>planFirstAdminBootstrap(bad),(e:any)=>e.code==='invalid_bootstrap_plan'&&!e.message.includes('DO_NOT_PRINT'));
 });
