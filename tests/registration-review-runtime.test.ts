import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createConsulteGeoRuntimeHandlers} from '../src/infrastructure/consultegeo-runtime.ts';
import {createConfiguredConsulteGeoSource} from '../src/infrastructure/runtime.ts';
import {id} from './fixtures/registration/sample.ts';
function fixture(sourceReady=true,registrationReview?:()=>boolean){
 let legacy=0,auth=0,sql=0;const pool:any={query:async()=>{sql++;throw Error('Uninstalled prepared integration');},connect:async()=>{sql++;throw Error('Uninstalled prepared integration');},end:async()=>{}};
 const runtime=createConsulteGeoRuntimeHandlers({pool,origin:'https://helpdesk.example.test',source:sourceReady?createConfiguredConsulteGeoSource('local',pool):undefined,authentication:{authenticate:async()=>{auth++;return {id:id(20),workspaceId:id(1),kind:'human',workspaceRole:'admin',grants:[],scopes:['tickets:read']};},withAdministrativeAssurance:async()=>{throw Error('No MFA mutation');}},rateLimiter:{beforeAuthentication:async()=>{},afterAuthentication:async()=>{}},flags:{business:()=>true,administration:()=>false,workflow:()=>true,intake:()=>true,review:()=>true,...(registrationReview?{registrationReview}:{})} as any,legacy:async()=>{legacy++;return Response.json({existing:true,capabilities:{tickets:true}});}});
 return {runtime,counts:()=>({legacy,auth,sql}),request:(path:string)=>new Request('https://helpdesk.example.test'+path)};
}
for(const prefix of ['/v1/tickets/','/v1/internal/tickets/'])for(const sourceReady of [false,true])test('prepared E06 '+prefix+' defaults closed with source='+sourceReady+' and cannot fall through',async()=>{
 const f=fixture(sourceReady),r=await f.runtime(f.request(prefix+id(11)+'/registration-review'));assert.equal(r.status,503);assert.equal((await r.json()).code,'release_gate_closed');assert.deepEqual(f.counts(),{legacy:0,auth:0,sql:0});
});
test('prepared E06 capability remains false while ordinary legacy routes keep working',async()=>{const f=fixture();const caps=await (await f.runtime(f.request('/v1/capabilities'))).json();assert.equal(caps.capabilities.registration_review,false);assert.equal(caps.capabilities.tickets,true);assert.equal((await f.runtime(f.request('/v1/me'))).status,200);assert.deepEqual(f.counts(),{legacy:2,auth:0,sql:0});});
test('explicit server construction uses the real authorized reader and uninstalled storage still fails closed',async()=>{const f=fixture(true,()=>true),r=await f.runtime(f.request('/v1/tickets/'+id(11)+'/registration-review'));assert.equal(r.status,503);assert.equal((await r.json()).code,'registration_review_unavailable');assert.deepEqual(f.counts(),{legacy:0,auth:1,sql:1});});
test('prepared E06 OpenAPI declares gated fixed audience GET paths without mutation authority',async()=>{
 const spec=JSON.parse(await readFile('docs/openapi.json','utf8'));
 for(const prefix of ['/tickets/','/internal/tickets/']){const methods=spec.paths[prefix+'{ticket_id}/registration-review'];assert.ok(methods);assert.deepEqual(Object.keys(methods),['get']);const op=methods.get;assert.equal(op['x-status'],'prepared/gated');assert.deepEqual(op.security,[{bearerAuth:[]}]);assert.equal(op.requestBody,undefined);assert.ok(op.responses['503']);assert.ok(!op.parameters.some((p:any)=>p.in==='query'));}
 assert.deepEqual(spec.components.schemas.RegistrationReviewCapabilities.properties,{edit:{const:false},approve:{const:false},execute:{const:false}});
 assert.equal(spec.components.schemas.RegistrationReviewCustomer.properties.detail.type,'null');
});
