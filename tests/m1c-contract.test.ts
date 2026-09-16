import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {capabilities} from '../src/http/handler.ts';

test('OpenAPI documents only-current-session DELETE with empty 204 and distinct short bearer',async()=>{
 const spec=JSON.parse(await readFile(new URL('../docs/openapi.json',import.meta.url),'utf8'));
 const op=spec.paths['/integration-tokens/current']?.delete;
 assert.ok(op,'self-revocation contract required');
 assert.equal(op.requestBody,undefined);assert.deepEqual(op.parameters,[]);
 assert.deepEqual(op.security,[{integrationSession:[]}]);assert.ok(op.responses['204']);assert.equal(op.responses['204'].content,undefined);
 assert.equal(spec.info.version,capabilities.release);
 assert.equal(capabilities.capabilities.integration_session_revocation,true);
});
test('candidate self-revocation migration grants only a fixed private digest helper',async()=>{
 const sql=await readFile(new URL('../supabase/migrations/20260916000500_m1_session_lifecycle.sql',import.meta.url),'utf8').catch(()=> '');
 assert.match(sql,/function helpdesk_auth\.revoke_session\(p_session_hash text\)/);
 assert.match(sql,/security definer set search_path=''/);
 assert.match(sql,/delete from helpdesk_auth\.integration_sessions where token_hash=p_session_hash/);
 assert.match(sql,/revoke all on function helpdesk_auth\.revoke_session\(text\) from public/);
 assert.match(sql,/grant execute on function helpdesk_auth\.revoke_session\(text\) to helpdesk_app/);
 assert.doesNotMatch(sql,/delete from helpdesk_auth\.(?:integration_credentials|integration_connections)/);
 assert.match(sql,/select '0\.4\.0'::text/);
});
