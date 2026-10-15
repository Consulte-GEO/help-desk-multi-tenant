import test from 'node:test';import assert from 'node:assert/strict';
import {id} from './fixtures/registration/sample.ts';
import {HelpdeskError} from '../src/domain/errors.ts';
const path='../src/http/registration-review.ts',m:any=await import(path).catch(()=>({}));
const principal={id:id(20),workspaceId:id(1),kind:'human',workspaceRole:'admin',grants:[],scopes:['tickets:read']};
function fixture(){
 assert.equal(typeof m.createRegistrationReviewHandler,'function','authorized HTTP reader is required');
 let calls=0,auth=0,enabled=true;let result:any={safe:true};
 const handler=m.createRegistrationReviewHandler({enabled:()=>enabled,origin:'https://helpdesk.example',authenticate:async()=>{auth++;return principal;},rateLimiter:{beforeAuthentication:async()=>{},afterAuthentication:async()=>{}},queries:{readReview:async(p:any,ticket:string,audience:string)=>{calls++;if(result instanceof Error)throw result;return {...result,ticket,audience};}}});
 return {handler,calls:()=>calls,auth:()=>auth,disable:()=>{enabled=false;},result:(r:any)=>{result=r;}};
}
for(const [prefix,audience] of [['/v1/tickets/','customer'],['/v1/internal/tickets/','internal']])test('fixed '+audience+' route receives authenticated identity and emits private JSON',async()=>{
 const f=fixture(),r=await f.handler(new Request('https://helpdesk.example'+prefix+id(11)+'/registration-review'));
 assert.equal(r.status,200);assert.equal((await r.json()).audience,audience);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(f.auth(),1);
});
for(const suffix of ['?audience=internal','?bindingId='+id(30),'?accountId='+id(2)])test('client authorization selector '+suffix+' is refused before query',async()=>{const f=fixture(),r=await f.handler(new Request('https://helpdesk.example/v1/tickets/'+id(11)+'/registration-review'+suffix));assert.equal(r.status,400);assert.equal(f.calls(),0);});
test('closed gate never authenticates or reads',async()=>{const f=fixture();f.disable();assert.equal((await f.handler(new Request('https://helpdesk.example/v1/tickets/'+id(11)+'/registration-review'))).status,503);assert.equal(f.auth(),0);assert.equal(f.calls(),0);});
test('wrong origin and mutation methods are rejected',async()=>{const f=fixture();assert.equal((await f.handler(new Request('https://other.example/v1/tickets/'+id(11)+'/registration-review'))).status,403);assert.equal((await f.handler(new Request('https://helpdesk.example/v1/tickets/'+id(11)+'/registration-review',{method:'POST',body:'{}'}))).status,405);assert.equal(f.calls(),0);});
test('storage errors cannot leak state or driver details',async()=>{const f=fixture();f.result(new HelpdeskError(503,'database_unavailable','postgres://PRIVATE_SECRET'));const r=await f.handler(new Request('https://helpdesk.example/v1/tickets/'+id(11)+'/registration-review'));assert.equal(r.status,503);assert.ok(!(await r.text()).includes('PRIVATE_SECRET'));});
