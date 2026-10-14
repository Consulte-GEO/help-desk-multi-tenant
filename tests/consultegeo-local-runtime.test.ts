import test from 'node:test';
import assert from 'node:assert/strict';
import {validateConsulteGeoRuntimeConfig,createConsulteGeoRuntimeHandlers} from '../src/infrastructure/consultegeo-runtime.ts';
import type {Principal} from '../src/domain/model.ts';
import {createPostgresLocalConsulteGeoSourcePorts} from '../src/infrastructure/consultegeo-local-source.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';
const id=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const p:Principal={id:id(2),workspaceId:id(1),kind:'human',workspaceRole:'admin',grants:[{accountId:id(3),role:'agent'}],scopes:['contexts:resolve','tickets:read','tickets:write']};
test('runtime local source mode is explicit; unknown/external/JSON authority refuses configuration',()=>{
 assert.equal((validateConsulteGeoRuntimeConfig({consulteGeoSourceMode:'local',consulteGeoWorkflow:'true',consulteGeoOrigin:'https://helpdesk.example'} as any) as any).sourceMode,'local');
 for(const mode of ['external','novo-geo','true','{}',{},true])assert.throws(()=>validateConsulteGeoRuntimeConfig({consulteGeoSourceMode:mode,consulteGeoWorkflow:'true',consulteGeoOrigin:'https://helpdesk.example'} as any));
 assert.throws(()=>validateConsulteGeoRuntimeConfig({consulteGeoSourceMode:'local',consulteGeoOrigin:'https://helpdesk.example'} as any));
});
function fixture(withSource=true,workflow=true,business=true){const calls:string[]=[];
 const context={accountId:id(3),accountName:'MRV',productInstanceId:id(4),connectionId:id(5),tenantId:'mrv',works:[{id:'encanto',name:'Residencial Encanto',ref:{connectionId:id(5),tenantId:'mrv',type:'work',id:'encanto'}}]};
 const pool:SqlPool={query:async()=>{throw Error();},end:async()=>{},connect:async()=>({release(){},async query(sql){calls.push(sql);return {command:['BEGIN','COMMIT','ROLLBACK'].includes(sql)?sql:'SELECT',rowCount:1,rows:[{source:[context]}]};}})};
 const local=createPostgresLocalConsulteGeoSourcePorts(pool);
 const runtime=createConsulteGeoRuntimeHandlers({pool,origin:'https://helpdesk.example',source:withSource?{...local,mode:'local'} as any:undefined,
 authentication:{authenticate:async()=>{calls.push('auth');return p;},withAdministrativeAssurance:async()=>{throw Error();}},rateLimiter:{beforeAuthentication:async()=>{},afterAuthentication:async()=>{}},
 flags:{business:()=>business,workflow:()=>workflow,administration:()=>false,intake:()=>true},legacy:async()=>{calls.push('legacy');return Response.json({capabilities:{tickets:true,ticket_search:true,support_catalog:true,contract_resolution:true}});}});
 return {runtime,calls};
}
test('runtime mounts authenticated local contexts without legacy fallback',async()=>{
 const f=fixture(),r=await f.runtime(new Request('https://helpdesk.example/v1/consultegeo/contexts'));assert.equal(r.status,200);
 const body=await r.json();assert.equal(body.principalId,p.id);assert.equal(body.contexts[0].accountName,'MRV');assert.equal(body.contexts[0].works[0].name,'Residencial Encanto');
 assert.ok(f.calls.some(x=>x.includes('cg_local_request_contexts')));assert.equal(f.calls.includes('legacy'),false);
});
test('missing local source or closed workflow/business closes contexts before authentication',async()=>{
 for(const args of [[false,true,true],[true,false,true],[true,true,false]]){const f=fixture(...args as [boolean,boolean,boolean]),r=await f.runtime(new Request('https://helpdesk.example/v1/consultegeo/contexts'));assert.equal(r.status,503);assert.deepEqual(f.calls,[]);}
});
test('ticket/search/catalog capabilities require actual local source and workflow/business composition',async()=>{
 const ready=await (await fixture().runtime(new Request('https://helpdesk.example/v1/capabilities'))).json();for(const key of ['tickets','ticket_search','support_catalog','contract_resolution','consultegeo_contexts'])assert.equal(ready.capabilities[key],true,key);
 for(const args of [[false,true,true],[true,true,false],[true,false,true]]){const f=fixture(...args as [boolean,boolean,boolean]),body=await (await f.runtime(new Request('https://helpdesk.example/v1/capabilities'))).json();for(const key of ['tickets','ticket_search','support_catalog','contract_resolution'])assert.equal(body.capabilities[key],false,key);}
});
test('configured local mode retains ticket route ownership when workflow closes; no legacy fallback',async()=>{
 const f=fixture(true,false,true),response=await f.runtime(new Request('https://helpdesk.example/v1/tickets'));assert.equal(response.status,503);assert.deepEqual(f.calls,[]);
});
test('public journey discovery is true only for mounted qualified local intake and closed otherwise',async()=>{assert.equal((await (await fixture().runtime(new Request('https://helpdesk.example/v1/public-config'))).json()).consultegeo_intake,true);for(const args of [[false,true,true],[true,false,true],[true,true,false]])assert.equal((await (await fixture(...args as [boolean,boolean,boolean]).runtime(new Request('https://helpdesk.example/v1/public-config'))).json()).consultegeo_intake,false);});
