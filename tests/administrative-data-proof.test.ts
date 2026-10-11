import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthentication,assertAdministrativeAssurance} from '../src/infrastructure/authentication.ts';
import type {Principal} from '../src/domain/model.ts';

// The provider and SQL below are synthetic; this exercises the real Auth factory.
const user='00000000-0000-4000-8000-000000000001';
const person='00000000-0000-4000-8000-000000000002';
const workspace='00000000-0000-4000-8000-000000000003';
const account='00000000-0000-4000-8000-000000000005';
const at=Date.parse('2026-10-09T12:00:00Z');
const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user,exp:at/1000+3600,aal:'aal2'})).toString('base64url')+'.synthetic';
const request=()=>new Request('https://helpdesk.example.test/v1/me',{headers:{authorization:'Bearer '+token,'x-workspace-id':workspace}});
const forbidden={status:403,code:'administrative_assurance_required'};
function check(p:Principal,proof:unknown):void{assertAdministrativeAssurance(p,proof);}
function fixture(){
 const principal:Principal={id:person,workspaceId:workspace,kind:'human',workspaceRole:'admin',grants:[{accountId:account,role:'agent'}],scopes:['contexts:resolve','tickets:read']};
 const pool={connect:async()=>{throw Error('unexpected connection');},end:async()=>{},query:async()=>({rows:[{principal}],rowCount:1})};
 const fetcher:typeof fetch=async()=>Response.json({id:user,factors:[{id:'00000000-0000-4000-8000-000000000004',status:'verified',factor_type:'totp'}]});
 return {auth:createAuthentication(pool,{supabaseUrl:'https://auth.example.test',publishableKey:'synthetic-publishable'},fetcher,()=>new Date(at))};
}
// Review regression: JSON.stringify invokes caller-installed toJSON/getters.
// The proof must compare actual data, never a caller-controlled serialization.
test('CG02 review rejects a principal mutation hidden behind toJSON without invoking it',async()=>{
 const f=fixture();await f.auth.withAdministrativeAssurance(request(),async(p,proof)=>{
  const original=structuredClone(p);let calls=0;
  Object.defineProperty(p,'toJSON',{value:()=>{calls++;return original;},configurable:true});
  p.workspaceId=person;
  assert.throws(()=>check(p,proof),forbidden);assert.equal(calls,0);
  delete (p as any).toJSON;p.workspaceId=original.workspaceId;
  assert.throws(()=>check(p,proof),forbidden);
 });
});
test('CG02 review rejects changed scopes hidden behind array serialization',async()=>{
 const f=fixture();await f.auth.withAdministrativeAssurance(request(),async(p,proof)=>{
  const original=[...p.scopes];let calls=0;
  Object.defineProperty(p.scopes,'toJSON',{value:()=>{calls++;return original;}});
  p.scopes.push('tickets:write');
  assert.throws(()=>check(p,proof),forbidden);assert.equal(calls,0);
 });
});
test('CG02 review refuses accessors without reading them even when they return the original value',async()=>{
 const f=fixture();await f.auth.withAdministrativeAssurance(request(),async(p,proof)=>{
  const original=p.workspaceId;let reads=0;
  Object.defineProperty(p,'workspaceId',{get:()=>{reads++;return original;},enumerable:true});
  assert.throws(()=>check(p,proof),forbidden);assert.equal(reads,0);
 });
});
test('CG02 review rejects nested array getters without invoking them',async()=>{
 const f=fixture();await f.auth.withAdministrativeAssurance(request(),async(p,proof)=>{
  const original=p.scopes[0];let reads=0;
  Object.defineProperty(p.scopes,'0',{get:()=>{reads++;return original;},enumerable:true});
  assert.throws(()=>check(p,proof),forbidden);assert.equal(reads,0);
 });
});
for(const key of ['undeclaredCapability',Symbol('undeclaredCapability')])test('CG02 review rejects non-JSON fields on the proof-bound principal '+String(key),async()=>{
 const f=fixture();await f.auth.withAdministrativeAssurance(request(),async(p,proof)=>{
  Object.defineProperty(p,key,{value:'members.write'});
  assert.throws(()=>check(p,proof),forbidden);
 });
});
test('CG02 review rejects a replaced prototype instead of trusting an inherited serialization',async()=>{
 const f=fixture();await f.auth.withAdministrativeAssurance(request(),async(p,proof)=>{
  const original=structuredClone(p);let calls=0;
  Object.setPrototypeOf(p,{toJSON:()=>{calls++;return original;}});
  p.workspaceRole='agent';
  assert.throws(()=>check(p,proof),forbidden);assert.equal(calls,0);
 });
});
test('CG02 review accepts equal plain data in a different property insertion order',async()=>{
 const f=fixture();await f.auth.withAdministrativeAssurance(request(),async(p,proof)=>{
  const role=p.workspaceRole;delete (p as any).workspaceRole;p.workspaceRole=role;
  p.scopes=[...p.scopes];p.grants=p.grants.map(g=>({...g}));
  check(p,proof);assert.deepEqual(p.scopes,['contexts:resolve','tickets:read']);
 });
});

test('CG02 review rejects grant changes hidden by nested serialization',async()=>{
 const f=fixture();await f.auth.withAdministrativeAssurance(request(),async(p,proof)=>{
  const grant=p.grants[0]!,original={...grant};let calls=0;
  Object.defineProperty(grant,'toJSON',{value:()=>{calls++;return original;}});
  grant.role='account_manager';
  assert.throws(()=>check(p,proof),forbidden);assert.equal(calls,0);
 });
});
test('CG02 review rejects grant accessors without running their code',async()=>{
 const f=fixture();await f.auth.withAdministrativeAssurance(request(),async(p,proof)=>{
  const grant=p.grants[0]!,role=grant.role;let reads=0;
  Object.defineProperty(grant,'role',{get:()=>{reads++;return role;},enumerable:true});
  assert.throws(()=>check(p,proof),forbidden);assert.equal(reads,0);
 });
});
