import test from 'node:test';import assert from 'node:assert/strict';
import {createAuthentication} from '../src/infrastructure/authentication.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';import {principal as domainPrincipal} from './fixtures.ts';
const principal=(overrides:Parameters<typeof domainPrincipal>[0]={})=>domainPrincipal({id:'00000000-0000-4000-8000-000000000001',workspaceId:'00000000-0000-4000-8000-000000000002',grants:[{accountId:'00000000-0000-4000-8000-000000000003',role:'requester'}],...overrides});
const config={supabaseUrl:'https://example.supabase.co',publishableKey:'sb_publishable_fixture'};
const machine=()=>principal({kind:'integration',connectionId:'00000000-0000-4000-8000-000000000005',productInstanceIds:['00000000-0000-4000-8000-000000000006'],scopes:['contexts:resolve','tickets:read','tickets:write']});
function make(value:unknown=principal(),fetcher:typeof fetch=async()=>Response.json({id:'00000000-0000-4000-8000-000000000004'})){
 let lookups=0;const pool:SqlPool={query:async()=>{lookups++;return {rows:[{principal:value}],rowCount:1};},connect:async()=>{throw Error('Unused');},end:async()=>{}};
 return {auth:createAuthentication(pool,config,fetcher),lookups:()=>lookups};
}
const request=(machine=false)=>new Request('https://hd.test',{headers:{authorization:'Bearer '+(machine?'hd_session_'+'a'.repeat(43):'human.jwt.fixture'),'x-workspace-id':'00000000-0000-4000-8000-000000000002'}});
for(const [name,body] of [['broken','{'],['null','null'],['array','[]'],['missing id','{}'],['invalid id','{"id":"bad id"}']] as const)
 test('malformed successful Auth response fails safely: '+name,async()=>{
  const {auth,lookups}=make(principal(),async()=>new Response(body,{headers:{'content-type':'application/json'}}));
  await assert.rejects(()=>auth.authenticate(request()),{status:503,code:'auth_unavailable'});assert.equal(lookups(),0);
 });
for(const [name,value] of [
 ['missing id',{...principal(),id:undefined}],['bad id',{...principal(),id:'invalid id'}],
 ['kind',principal({kind:'robot' as never})],['role',principal({workspaceRole:'owner' as never})],
 ['grant account',principal({grants:[{accountId:'',role:'requester'}]})],
 ['grant role',principal({grants:[{accountId:'00000000-0000-4000-8000-000000000003',role:'owner' as never}]})],
 ['duplicate grant',principal({grants:[{accountId:'00000000-0000-4000-8000-000000000003',role:'requester'},{accountId:'00000000-0000-4000-8000-000000000003',role:'agent'}]})],
 ['null grant',principal({grants:[null as never]})],['nonstring scope',principal({scopes:[5 as never]})],
 ['unknown scope',principal({scopes:['*']})],['duplicate scope',principal({scopes:['tickets:read','tickets:read']})],
 ['human with connection',principal({connectionId:'00000000-0000-4000-8000-000000000005'})]
] as const)test('malformed domain principal rejected: '+name,async()=>{await assert.rejects(()=>make(value).auth.authenticate(request()),{code:'invalid_principal'});});
test('human token cannot resolve as integration',async()=>{await assert.rejects(()=>make(machine()).auth.authenticate(request()),{code:'invalid_principal'});});
test('M2M session cannot resolve as human operator',async()=>{await assert.rejects(()=>make(principal({workspaceRole:'admin'})).auth.authenticate(request(true)),{code:'invalid_principal'});});
for(const [name,value] of [
 ['workspace role', {...machine(),workspaceRole:'admin'}],
 ['agent account', {...machine(),grants:[{accountId:'00000000-0000-4000-8000-000000000003',role:'agent'}]}],
 ['notes scope', {...machine(),scopes:['tickets:read','notes:read']}],
 ['missing connection',{...machine(),connectionId:undefined}],
 ['missing product',{...machine(),productInstanceIds:[]}],
 ['multiple products',{...machine(),productInstanceIds:['a','b']}]
] as const)test('integration structure cannot gain human capabilities: '+name,async()=>{await assert.rejects(()=>make(value).auth.authenticate(request(true)),{code:'invalid_principal'});});
test('valid principal output is detached from mutable SQL response',async()=>{
 const source=principal();const out=await make(source).auth.authenticate(request());source.grants[0]!.role='agent';
 assert.equal(out.grants[0]?.role,'requester');
});
test('unrecognized fields from principal helper are never projected into authentication context',async()=>{
 const out=await make({...principal(),credential_hash:'PRIVATE-EXTRA'}).auth.authenticate(request());assert.equal((out as unknown as Record<string,unknown>).credential_hash,undefined);
});
