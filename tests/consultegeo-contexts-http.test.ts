import {test} from 'node:test';import assert from 'node:assert/strict';
import {createConsulteGeoContextsHttpHandler} from '../src/http/consultegeo-contexts.ts';
const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const p:any={id:id(1),workspaceId:id(2),kind:'human',workspaceRole:'admin',grants:[],scopes:['contexts:resolve','tickets:read']};
const ref={connectionId:id(5),tenantId:id(3),type:'work',id:id(4)};
const contexts=[{accountId:id(3),accountName:'Cliente real',productInstanceId:id(6),connectionId:id(5),tenantId:id(3),works:[{id:id(4),name:'Obra autorizada',ref}]}];
function setup(change:any={}){const calls={auth:0,source:0};const handler=createConsulteGeoContextsHttpHandler({enabled:()=>true,origin:'https://helpdesk.example',authenticate:async()=>{calls.auth++;return p;},rateLimiter:{beforeAuthentication:async()=>{},afterAuthentication:async()=>{}},readRequestContexts:async()=>{calls.source++;return contexts;},...change});return {handler,calls};}
const request=(suffix='',init?:RequestInit)=>new Request('https://helpdesk.example/v1/consultegeo/contexts'+suffix,init);
test('current authenticated context returns bounded account/work metadata and private headers',async()=>{const f=setup(),r=await f.handler(request());assert.equal(r.status,200);assert.deepEqual(await r.json(),{schema:1,workspaceId:p.workspaceId,principalId:p.id,contexts});assert.match(r.headers.get('cache-control')!,/no-store/);assert.equal(f.calls.source,1);});
test('closed gate invokes neither identity nor local source',async()=>{const f=setup({enabled:()=>false}),r=await f.handler(request());assert.equal(r.status,503);assert.deepEqual(f.calls,{auth:0,source:0});});
test('unknown parameters/wrong method/origin refuse discovery',async()=>{const f=setup();for(const req of [request('?principal_id='+id(9)),request('',{method:'POST'}),new Request('https://other.example/v1/consultegeo/contexts')])assert.notEqual((await f.handler(req)).status,200);assert.equal(f.calls.source,0);});
test('empty authorized registry is explicit empty data',async()=>{const r=await setup({readRequestContexts:async()=>[]}).handler(request());assert.equal(r.status,200);assert.deepEqual((await r.json()).contexts,[]);});
test('requester cannot receive metadata for unrelated account',async()=>{const f=setup({authenticate:async()=>({...p,workspaceRole:null,grants:[]})});assert.equal((await f.handler(request())).status,503);});
test('malformed/cross-namespace refs and private extra fields fail whole projection',async()=>{
 for(const source of [[{...contexts[0],privateNote:'internal'}],[{...contexts[0],works:[{id:id(4),name:'Work',ref:{...ref,tenantId:'other'}}]}],Array(51).fill(contexts[0]),[{...contexts[0],works:[]}]] ){
  const r=await setup({readRequestContexts:async()=>source}).handler(request());assert.equal(r.status,503);assert.equal(JSON.stringify(await r.json()).includes('internal'),false);
 }
});
test('source failure emits safe public error and never its private message',async()=>{const r=await setup({readRequestContexts:async()=>{throw Error('private connection password');}}).handler(request());assert.equal(r.status,503);assert.equal(JSON.stringify(await r.json()).includes('password'),false);});
test('gate revoked during source lookup cannot return earlier metadata',async()=>{let enabled=true;const r=await setup({enabled:()=>enabled,readRequestContexts:async()=>{enabled=false;return contexts;}}).handler(request());assert.equal(r.status,503);});
