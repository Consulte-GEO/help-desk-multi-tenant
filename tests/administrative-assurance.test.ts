import test from 'node:test';
import assert from 'node:assert/strict';
import * as module from '../src/infrastructure/authentication.ts';
import type {Principal} from '../src/domain/model.ts';

// Synthetic Auth transport only. Tokens below are not signed or usable at a real provider.
const user='00000000-0000-4000-8000-000000000001',person='00000000-0000-4000-8000-000000000002',workspace='00000000-0000-4000-8000-000000000003';
const factor={id:'00000000-0000-4000-8000-000000000004',status:'verified',factor_type:'totp'};
const now=Date.parse('2026-10-08T12:00:00Z');
const jwt=(claims:Record<string,unknown>={})=>Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user,exp:now/1000+3600,aal:'aal2',...claims})).toString('base64url')+'.synthetic';
const request=(token=jwt())=>new Request('https://helpdesk.example.test/v1/me',{headers:{authorization:'Bearer '+token,'x-workspace-id':workspace}});
const forbidden=(error:unknown)=>Boolean(error&&typeof error==='object'&&(error as {status?:number}).status===403);
function fixture(options:{factors?:unknown;omitFactors?:boolean;role?:'admin'|'agent'|null;status?:number;providerId?:string;clock?:()=>Date;afterFetch?:()=>void;afterSql?:()=>void;missingMember?:boolean}={}){
 let fetches=0,queries=0;const sqlCalls:{sql:string;values:unknown[]|undefined}[]=[];
 const principal:Principal={id:person,workspaceId:workspace,kind:'human',workspaceRole:options.role===undefined?'admin':options.role,grants:[],scopes:['contexts:resolve','tickets:read']};
 const pool={connect:async()=>{throw Error('unexpected connection in control query test');},end:async()=>{},query:async(sql:string,values?:unknown[])=>{
  queries++;sqlCalls.push({sql,values});options.afterSql?.();return {rows:sql.includes('list_human_workspaces')?[{workspaces:[{id:workspace,name:'Synthetic workspace'}]}]:[{principal:options.missingMember?null:principal}],rowCount:1};
 }};
 const fetcher:typeof fetch=async(input,init)=>{
  fetches++;assert.equal(String(input),'https://auth.example.test/auth/v1/user');assert.equal(init?.redirect,'error');assert.ok(init?.signal);assert.ok(new Headers(init?.headers).get('authorization')?.startsWith('Bearer '));
  options.afterFetch?.();return Response.json({id:options.providerId??user,...(options.omitFactors?{}:{factors:options.factors===undefined?[factor]:options.factors}),user_metadata:{role:'admin',mfa:true}},{status:options.status??200});
 };
 const auth=module.createAuthentication(pool,{supabaseUrl:'https://auth.example.test',publishableKey:'synthetic-publishable'},fetcher,options.clock??(()=>new Date(now)));
 return {auth,principal,sqlCalls,counts:()=>({fetches,queries})};
}
function strict(auth:ReturnType<typeof fixture>['auth']){
 const method=(auth as any).withAdministrativeAssurance;
 assert.equal(typeof method,'function','CG02 server-side administrative assurance entry point is missing');
 return method as (req:Request,work:(p:Principal,proof:unknown)=>Promise<unknown>)=>Promise<unknown>;
}
function check(p:Principal,proof:unknown){
 const guard=(module as any).assertAdministrativeAssurance;
 assert.equal(typeof guard,'function','CG02 opaque administrative proof guard is missing');
 guard(p,proof);
}

test('CG02 ordinary authentication without a factor preserves initial self-setup and the two scopes',async()=>{
 const f=fixture({factors:[]});const p=await f.auth.authenticate(request(jwt({aal:'aal1'})));
 assert.equal(p.workspaceRole,'admin');assert.deepEqual(p.scopes,['contexts:resolve','tickets:read']);assert.deepEqual(f.counts(),{fetches:1,queries:1});
});
test('CG02 workspace discovery without a factor remains separate from administration',async()=>{
 const f=fixture({factors:[]});const result=await f.auth.discoverWorkspaces(request(jwt({aal:'aal1'})));
 assert.deepEqual(result.items,[{id:workspace,name:'Synthetic workspace'}]);
});
for(const options of [{factors:[]},{omitFactors:true},{factors:[{...factor,status:'unverified'}]}])test('CG02 administration refuses absent or pending factor '+JSON.stringify(options),async()=>{
 const f=fixture(options);let calls=0;await assert.rejects(strict(f.auth)(request(),async()=>{calls++;}),forbidden);
 assert.equal(calls,0);assert.deepEqual(f.counts(),{fetches:1,queries:0});
});
for(const claims of [{aal:'aal1'},{aal:null},{sub:person},{exp:now/1000},{exp:Infinity}])test('CG02 administration rejects insufficient or mismatched claims '+JSON.stringify(claims),async()=>{
 const f=fixture();let calls=0;await assert.rejects(strict(f.auth)(request(jwt(claims)),async()=>{calls++;}),forbidden);assert.equal(calls,0);assert.equal(f.counts().queries,0);
});
for(const token of ['hd_session_'+'a'.repeat(43),'hd_key_'+'a'.repeat(43)])test('CG02 machine credential never reaches administrative identity '+token.slice(0,10),async()=>{
 const f=fixture();let calls=0;await assert.rejects(strict(f.auth)(request(token),async()=>{calls++;}),forbidden);
 assert.equal(calls,0);assert.deepEqual(f.counts(),{fetches:0,queries:0});
});
for(const status of [401,429,500])test('CG02 rejected Auth response precedes SQL and private operation '+status,async()=>{
 const f=fixture({status});let calls=0;await assert.rejects(strict(f.auth)(request(),async()=>{calls++;}),(e:any)=>e.status===(status===401?401:503));
 assert.equal(calls,0);assert.equal(f.counts().queries,0);
});
test('CG02 malformed factor catalog fails closed without SQL',async()=>{
 const f=fixture({factors:[{...factor,status:'unexpected'}]});await assert.rejects(strict(f.auth)(request(),async()=>assert.fail()),{status:503,code:'auth_unavailable'});assert.equal(f.counts().queries,0);
});
for(const role of ['agent',null] as const)test('CG02 JWT metadata never promotes the live workspace role '+role,async()=>{
 const f=fixture({role});await assert.rejects(strict(f.auth)(request(),async()=>assert.fail()),forbidden);assert.equal(f.counts().queries,1);
});
test('CG02 current membership is still required after verified MFA',async()=>{
 const f=fixture({missingMember:true});await assert.rejects(strict(f.auth)(request(),async()=>assert.fail()),{status:403,code:'membership_required'});
});
test('CG02 administrative proof is opaque, request-local and does not expand scopes',async()=>{
 const f=fixture();let retained:{p:Principal;proof:unknown}|undefined;
 const result=await strict(f.auth)(request(),async(p,proof)=>{
  check(p,proof);assert.equal(Object.isFrozen(proof),true);assert.equal(JSON.stringify(proof),'{}');
  assert.deepEqual(p.scopes,['contexts:resolve','tickets:read']);assert.deepEqual(p.grants,[]);retained={p,proof};return 'verified identity only';
 });
 assert.equal(result,'verified identity only');assert.deepEqual(f.counts(),{fetches:1,queries:1});
 assert.throws(()=>check(retained!.p,retained!.proof),forbidden);
 assert.deepEqual(f.sqlCalls[0]!.values,[user,workspace]);
});
test('CG02 cloned or fabricated proof and a different principal cannot authorize',async()=>{
 const f=fixture();await strict(f.auth)(request(),async(p,proof)=>{
  for(const fake of [true,false,{},null,{aal:'aal2',verified:true,principalId:p.id},JSON.parse(JSON.stringify(proof))])assert.throws(()=>check(p,fake),forbidden);
  assert.throws(()=>check({...p},proof),forbidden);check(p,proof);
 });
});
test('CG02 changing scopes, principal or workspace invalidates the bound proof',async()=>{
 const f=fixture();await strict(f.auth)(request(),async(p,proof)=>{
  const old=p.workspaceId;p.workspaceId=person;assert.throws(()=>check(p,proof),forbidden);p.workspaceId=old;
  p.scopes.push('tickets:write');assert.throws(()=>check(p,proof),forbidden);p.scopes.pop();assert.throws(()=>check(p,proof),forbidden);
 });
});
test('CG02 callback failure invalidates its proof and never retries',async()=>{
 const f=fixture();let retained:any,calls=0;const failure=Error('synthetic callback failure');
 await assert.rejects(strict(f.auth)(request(),async(p,proof)=>{retained={p,proof};calls++;throw failure;}),e=>e===failure);
 assert.equal(calls,1);assert.throws(()=>check(retained.p,retained.proof),forbidden);assert.equal(f.counts().fetches,1);
});
test('CG02 expiry during membership lookup prevents entering the administrative callback',async()=>{
 let tick=now;const f=fixture({clock:()=>new Date(tick),afterSql:()=>{tick=now+3600_000;}});
 await assert.rejects(strict(f.auth)(request(),async()=>assert.fail()),forbidden);
});
test('CG02 expired, invalid or backwards local clock invalidates a live proof',async()=>{
 let tick=now;const f=fixture({clock:()=>new Date(tick)});
 await strict(f.auth)(request(),async(p,proof)=>{
  for(const invalid of [now+3600_000,NaN,now-1]){tick=invalid;assert.throws(()=>check(p,proof),forbidden);}tick=now;assert.throws(()=>check(p,proof),forbidden);
 });
});
test('CG02 mutable headers cannot replace the bearer that Auth actually validated',async()=>{
 const req=request(jwt({aal:'aal1'}));const f=fixture({afterFetch:()=>req.headers.set('authorization','Bearer '+jwt())});
 await assert.rejects(strict(f.auth)(req,async()=>assert.fail()),forbidden);assert.equal(f.counts().queries,0);
});
test('CG02 every administrative request rechecks live Auth and membership',async()=>{
 const f=fixture();const run=strict(f.auth);await run(request(),async(p,proof)=>check(p,proof));await run(request(),async(p,proof)=>check(p,proof));
 assert.deepEqual(f.counts(),{fetches:2,queries:2});
});
test('CG02 an ended proof does not affect a concurrent owned proof',async()=>{
 const f=fixture();let resolve!:()=>void,retained:any;const gate=new Promise<void>(r=>{resolve=r;});
 const first=strict(f.auth)(request(),async(p,proof)=>{retained={p,proof};await gate;check(p,proof);});
 try{
  await new Promise<void>(r=>setImmediate(r));
  await strict(f.auth)(request(),async(p,proof)=>{check(p,proof);check(retained.p,retained.proof);});
  check(retained.p,retained.proof);
 }finally{resolve();}
 await first;assert.throws(()=>check(retained.p,retained.proof),forbidden);
});

test('CG02 expired assurance cannot revive after a wall-clock correction',async()=>{
 let tick=now;const f=fixture({clock:()=>new Date(tick)});
 await strict(f.auth)(request(),async(p,proof)=>{
  tick=now+3600_000;assert.throws(()=>check(p,proof),forbidden);tick=now;
  assert.throws(()=>check(p,proof),forbidden);
 });
});
test('CG02 clock rollback between proof checks is denied even above request start',async()=>{
 let tick=now;const f=fixture({clock:()=>new Date(tick)});
 await strict(f.auth)(request(),async(p,proof)=>{
  tick=now+2000;check(p,proof);tick=now+1000;assert.throws(()=>check(p,proof),forbidden);
 });
});
test('CG02 an observed principal mutation cannot revive an old assurance by restoring fields',async()=>{
 const f=fixture();await strict(f.auth)(request(),async(p,proof)=>{
  p.scopes.push('tickets:write');assert.throws(()=>check(p,proof),forbidden);p.scopes.pop();
  assert.throws(()=>check(p,proof),forbidden);
 });
});

test('CG02 throwing administrative clock is sanitized before Auth or SQL',async()=>{
 const f=fixture({clock:()=>{throw Error('private clock detail');}});
 await assert.rejects(strict(f.auth)(request(),async()=>assert.fail()),(e:any)=>forbidden(e)&&!/private/.test(e.message));
 assert.deepEqual(f.counts(),{fetches:0,queries:0});
});
test('CG02 throwing clock after Auth cannot enter SQL or the administrative callback',async()=>{
 let reads=0;const f=fixture({clock:()=>{if(++reads>1)throw Error('private clock detail');return new Date(now);}});
 await assert.rejects(strict(f.auth)(request(),async()=>assert.fail()),(e:any)=>forbidden(e)&&!/private/.test(e.message));
 assert.deepEqual(f.counts(),{fetches:1,queries:0});
});
