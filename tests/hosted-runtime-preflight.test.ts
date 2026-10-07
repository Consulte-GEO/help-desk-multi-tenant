import test from 'node:test';
import assert from 'node:assert/strict';
import {createHostedPreflight} from '../src/infrastructure/hosted-preflight.ts';
import type {RuntimePreflightReport} from '../src/infrastructure/runtime-preflight.ts';

const report=():RuntimePreflightReport=>({schema:'helpdesk.runtime-preflight.v1',mode:'database',success:true,
 release_flag:'closed',production_approved:false,operational:false,auth_tested:false,hosted_function_tested:false,
 business_operations_dispatched:0,checks:(['configuration','driver','connection','tls','read_only','database_role','schema','database_security','rollback','cleanup'] as const)
 .map(id=>({id,status:'passed',code:'passed'}))});
const values:Record<string,string>={HELPDESK_DATABASE_URL:'PRIVATE_DATABASE_SECRET',HELPDESK_DATABASE_CA:'PRIVATE_CA',
 SUPABASE_URL:'https://project.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',
 HELPDESK_RATE_LIMIT_HMAC_KEY:'PRIVATE_HMAC_SECRET',HELPDESK_RELEASE_APPROVED:'false'};

test('hosted probe reads configuration only during invocation and explicitly connects with the existing diagnostic',async()=>{
 const reads:string[]=[],logs:unknown[]=[];
 const run=createHostedPreflight(name=>{reads.push(name);return values[name];},entry=>{logs.push(entry);},async(input,options)=>{
  assert.equal(input.databaseUrl,values.HELPDESK_DATABASE_URL);assert.equal(input.databaseCa,values.HELPDESK_DATABASE_CA);
  assert.equal(input.releaseApproved,'false');assert.deepEqual(options,{connect:true});return report();
 });
 assert.deepEqual(reads,[]);await run();assert.equal(reads.length,6);assert.equal(logs.length,1);
 assert.doesNotMatch(JSON.stringify(logs),/PRIVATE_|sb_publishable_fixture|project\.supabase/);
});

test('probe preserves closed gate and never reports business or Auth approval',async()=>{
 const logs:any[]=[];await createHostedPreflight(name=>values[name],entry=>logs.push(entry),async()=>report())();
 assert.equal(logs[0].release_flag,'closed');assert.equal(logs[0].production_approved,false);
 assert.equal(logs[0].operational,false);assert.equal(logs[0].auth_tested,false);
 assert.equal(logs[0].business_operations_dispatched,0);assert.equal(logs[0].diagnostic_executed_in_function,true);
});

test('configuration/transport failures emit a fixed safe failure and never exception contents',async()=>{
 for(const mode of ['read','probe']){
  const logs:any[]=[];
  await createHostedPreflight(name=>{if(mode==='read')throw Error('PRIVATE_DATABASE_SECRET');return values[name];},
   entry=>logs.push(entry),async()=>{throw Error('PRIVATE_HMAC_SECRET');})();
  assert.equal(logs.length,1);assert.equal(logs[0].success,false);assert.equal(logs[0].code,'preflight_failed');
  assert.doesNotMatch(JSON.stringify(logs),/PRIVATE_/);
 }
});

test('only allowlisted diagnostic fields and codes reach the private log',async()=>{
 const logs:any[]=[];const result=report() as any;
 result.secret='PRIVATE_DATABASE_SECRET';result.checks=[{id:'tls',status:'failed',code:'PRIVATE_HMAC_SECRET',secret:'PRIVATE_CA'}];
 result.success=false;
 await createHostedPreflight(name=>values[name],entry=>logs.push(entry),async()=>result)();
 assert.equal(logs[0].success,false);assert.equal(logs[0].checks[0].code,'check_failed');
 assert.doesNotMatch(JSON.stringify(logs),/PRIVATE_|secret/);
});

test('database rejection is not changed into successful monitoring',async()=>{
 const logs:any[]=[];const result=report();result.success=false;
 result.checks=[{id:'database_role',status:'failed',code:'unsafe_database_role'}];
 await createHostedPreflight(name=>values[name],entry=>logs.push(entry),async()=>result)();
 assert.equal(logs[0].success,false);assert.equal(logs[0].checks[0].code,'unsafe_database_role');
});

test('incomplete, duplicate or failed checks cannot advertise a successful probe',async()=>{
 for(const checks of [[],[report().checks[0]!],report().checks.map(c=>({...c,id:'configuration'})),
  report().checks.map(c=>({...c,status:c.id==='tls'?'failed':'passed'}))]){
  const logs:any[]=[];const result={...report(),checks} as RuntimePreflightReport;
  await createHostedPreflight(name=>values[name],entry=>logs.push(entry),async()=>result)();
  assert.equal(logs[0].success,false);
 }
});

test('the Netlify entry point subscribes only to deployment events without a public path',async()=>{
 const module=await import('../netlify/functions/runtime-preflight.mts');
 assert.deepEqual(Object.keys(module.default),['deploySucceeded']);
 const previous=(globalThis as any).Netlify;const previousLog=console.log;const logs:string[]=[];
 try{
  (globalThis as any).Netlify={env:{get:()=>undefined}};console.log=(message:string)=>{logs.push(message);};
  const result=await module.default.deploySucceeded({site:{id:'9781cd85-7dc1-4ef5-868b-947e389a9d4d'},
   deploy:{siteId:'9781cd85-7dc1-4ef5-868b-947e389a9d4d',context:'production',id:'6ac5aff54233380008d0f1eb'}} as any);
  assert.equal(result,undefined);assert.equal(logs.length,1);
  assert.equal(JSON.parse(logs[0]!).success,false);
 }finally{(globalThis as any).Netlify=previous;console.log=previousLog;}
});

test('another site, preview or malformed deployment cannot read runtime secrets or run a probe',async()=>{
 const module=await import('../netlify/functions/runtime-preflight.mts');
 const previous=(globalThis as any).Netlify;const previousLog=console.log;let reads=0;const logs:string[]=[];
 try{
  (globalThis as any).Netlify={env:{get:()=>{reads++;throw Error('should_not_read');}}};
  console.log=(message:string)=>{logs.push(message);};
  const expected='9781cd85-7dc1-4ef5-868b-947e389a9d4d';
  for(const event of [undefined,{}, {site:{id:expected},deploy:{siteId:expected,context:'deploy-preview'}},
   {site:{id:'other'},deploy:{siteId:expected,context:'production'}},
   {site:{id:expected},deploy:{siteId:'other',context:'production'}}])
   await module.default.deploySucceeded(event as any);
  assert.equal(reads,0);
  assert.equal(logs.length,5);
  for(const line of logs){const entry=JSON.parse(line);assert.equal(entry.event,'helpdesk.runtime-preflight.skipped');
   assert.equal(entry.business_operations_dispatched,0);assert.equal(entry.success,false);assert.equal(entry.credentials_read,false);}
 }finally{(globalThis as any).Netlify=previous;console.log=previousLog;}
});
