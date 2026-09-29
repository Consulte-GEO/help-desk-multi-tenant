import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRuntimeConfig} from '../src/infrastructure/runtime.ts';
import type {RuntimeConfig} from '../src/infrastructure/runtime.ts';
import {HelpdeskError} from '../src/domain/errors.ts';

const config:RuntimeConfig={
 databaseUrl:'postgresql://helpdesk_app.project:fixture_password@pooler.invalid:5432/postgres',
 supabaseUrl:'https://project.supabase.co',publishableKey:'sb_publishable_fixture',
 rateLimitHmacKey:'f'.repeat(43),releaseApproved:'true'
};
function safeFailure(input:RuntimeConfig,code:string){
 assert.throws(()=>validateRuntimeConfig(input),(error:unknown)=>{
  assert.ok(error instanceof HelpdeskError);assert.equal(error.status,503);assert.equal(error.code,code);
  assert.doesNotMatch(error.message,/fixture_password|pooler\.invalid|sb_publishable_fixture/);return true;
 });
}
for(const user of ['helpdesk_app%','helpdesk_app.%E0%A4','helpdesk_app.%FF'])
 test('runtime configuration rejects malformed encoded username safely: '+user,()=>{
  safeFailure({...config,databaseUrl:`postgresql://${user}:fixture_password@pooler.invalid/postgres`},'invalid_configuration');
 });
for(const password of ['fixture_password%','%FF','%00'])
 test('runtime configuration rejects invalid encoded password safely: '+password,()=>{
  safeFailure({...config,databaseUrl:`postgresql://helpdesk_app:${password}@pooler.invalid/postgres`},'invalid_configuration');
 });
for(const field of ['databaseUrl','supabaseUrl','publishableKey','databaseCa','rateLimitHmacKey'] as const)
 test('runtime configuration rejects unexpected type for '+field,()=>{
  safeFailure({...config,[field]:42} as unknown as RuntimeConfig,'invalid_configuration');
 });
for(const raw of [' postgres','postgres\n','post\tgres'])
 test('runtime configuration rejects whitespace/control normalization in URL: '+JSON.stringify(raw),()=>{
  safeFailure({...config,databaseUrl:`${raw}ql://helpdesk_app:fixture_password@pooler.invalid/postgres`},'invalid_configuration');
 });
test('closed runtime gate takes precedence over malformed and missing configuration',()=>{
 for(const releaseApproved of [undefined,'false','TRUE','1'])
  safeFailure({...config,releaseApproved,databaseUrl:'postgresql://helpdesk_app%:x@host/postgres'},'release_gate_closed');
});
test('existing runtime configuration contract remains accepted and unmodified',()=>{
 const before=structuredClone(config);const result=validateRuntimeConfig(config);
 assert.equal(result.databaseUrl,config.databaseUrl);assert.equal(result.supabaseUrl,config.supabaseUrl);
 assert.deepEqual(config,before);
});


for(const releaseApproved of ['true','false'])test('hosted boundary safely reports malformed config with gate '+releaseApproved,async()=>{
 const {createProductionRuntime}=await import('../src/infrastructure/runtime.ts');
 const {createHostedHandler}=await import('../src/infrastructure/hosted-handler.ts');
 const handle=createHostedHandler(()=>createProductionRuntime({...config,releaseApproved,
  databaseUrl:'postgresql://helpdesk_app%:PRIVATE_FIXTURE@pooler.invalid/postgres'}));
 const response=await handle(new Request('https://helpdesk.example/v1/public-config'));
 assert.equal(response.status,503);const body=await response.json();
 assert.equal(body.code,releaseApproved==='true'?'invalid_configuration':'release_gate_closed');
 assert.doesNotMatch(JSON.stringify(body),/PRIVATE_FIXTURE|pooler\.invalid|URIError|stack/);
});
