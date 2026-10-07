import test from 'node:test';
import assert from 'node:assert/strict';
import {hostedFixture,uuid} from './fixtures/hosted-acceptance-fixture.ts';
import {hostedAuthFixture} from './fixtures/hosted-auth-fixture.ts';
import {runHostedReadAcceptance} from '../scripts/hosted-acceptance-core.ts';
import {runHostedAuthAcceptance} from '../scripts/hosted-auth-acceptance-core.ts';
import {runHostedWriteAcceptance} from '../scripts/hosted-write-acceptance-core.ts';

test('production read, Auth and write configurations plan without credentials or requests',async()=>{
 const f=await hostedFixture(),a=await hostedAuthFixture();
 const read={...f.config,environment:'production'};
 const auth={...a.config,environment:'production'};
 const write={schema:1,readFixture:read,executionId:uuid(9801),coverageId:uuid(401),includeMachineWrites:true};
 const reports=[await runHostedReadAcceptance(read),await runHostedAuthAcceptance(auth),await runHostedWriteAcceptance(write)];
 for(const report of reports){assert.equal(report.status,'planned');assert.equal(report.transport,'none');assert.equal(report.platform_approved,false);}
 assert.equal(f.requests.length,0);assert.equal(a.requests.length,0);
});

test('production read validates production instances through all existing isolation scenarios',async()=>{
 const f=await hostedFixture(),config={...f.config,environment:'production'};
 const report=await runHostedReadAcceptance(config,f.tokens,{execute:true,confirmOrigin:config.origin,fetcher:async(input,init)=>{
  const response=await f.fetcher(input,init);
  if(new URL(input instanceof Request?input.url:String(input)).pathname==='/v1/support-contexts'){
   const body=await response.json();for(const item of body.items??[])item.environment='production';
   return new Response(JSON.stringify(body),{status:response.status,headers:response.headers});
  }
  return response;
 }});
 assert.equal(report.status,'passed',JSON.stringify(report.checks.filter(c=>c.status!=='passed')));
 assert.equal(report.checks.length,28);assert.equal(report.transport,'injected');assert.equal(report.platform_approved,false);
});

test('production configuration refuses a staging catalog without weakening the isolation checks',async()=>{
 const f=await hostedFixture(),config={...f.config,environment:'production'};
 const report=await runHostedReadAcceptance(config,f.tokens,{execute:true,confirmOrigin:config.origin,fetcher:async(input,init)=>{
  const response=await f.fetcher(input,init);
  if(new URL(input instanceof Request?input.url:String(input)).pathname==='/v1/support-contexts'){
   const body=await response.json();for(const item of body.items??[])item.environment='staging';
   return new Response(JSON.stringify(body),{status:response.status,headers:response.headers});
  }
  return response;
 }});
 assert.equal(report.status,'failed');assert.ok(report.checks.some(c=>c.code==='fixture_missing'));
});
