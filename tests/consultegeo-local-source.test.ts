import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresLocalConsulteGeoSourcePorts,CONSULTEGEO_LOCAL_MANIFEST_FINGERPRINT} from '../src/infrastructure/consultegeo-local-source.ts';
import type {SqlPool} from '../src/infrastructure/sql.ts';
import type {Principal} from '../src/domain/model.ts';
const w='10000000-0000-4000-8000-000000000001',a='10000000-0000-4000-8000-000000000002',p='10000000-0000-4000-8000-000000000003',c='10000000-0000-4000-8000-000000000004',b='10000000-0000-4000-8000-000000000005',t='10000000-0000-4000-8000-000000000006';
const principal:Principal={id:p,workspaceId:w,kind:'human',workspaceRole:null,grants:[{accountId:a,role:'requester'}],scopes:['contexts:resolve','tickets:read']};
const refs=[{connectionId:c,tenantId:'0001',type:'work',id:'0001'}];
function fixture(value:unknown){const calls:{sql:string;values?:unknown[]}[]=[];let releases=0;const pool:SqlPool={query:async()=>{throw Error('unowned query');},end:async()=>{},connect:async()=>({release:()=>{releases++;},query:async(sql,values)=>{calls.push({sql,values});return {command:sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'?sql:'SELECT',rowCount:1,rows:[{source:value}]};}})};return {ports:createPostgresLocalConsulteGeoSourcePorts(pool),calls,get releases(){return releases;}};}
const query={principalId:p,workspaceId:w,connectionId:c,tenantId:'0001',operation:'tickets.read' as const,refs};
const envelope=()=>({principal,binding:{id:b,accountId:a,workspaceId:w,connectionId:c,tenantId:'0001',revision:'local-binding:1',active:true},operation:'tickets.read',manifestFingerprint:CONSULTEGEO_LOCAL_MANIFEST_FINGERPRINT,accessRevision:'local:1',asOf:'2026-10-14T12:00:00.123456Z',expiresAt:'2026-10-14T12:10:00.123456Z',resources:refs});
test('local adapter uses one actor-bound transaction and preserves persisted microsecond timestamps',async()=>{
 const data=envelope(),f=fixture(data);assert.deepEqual(await f.ports.authority.readAccess(query,new AbortController().signal),data);
 const sql=f.calls.find(x=>x.sql.includes('cg_local_read_access'));assert.deepEqual(sql?.values,[c,'0001','tickets.read']);
 assert.deepEqual(f.calls.find(x=>x.sql.includes('set_config'))?.values,[w,p]);assert.equal(f.releases,1);assert.equal(f.calls.at(-1)?.sql,'COMMIT');
 assert.equal(f.ports.manifestFingerprint,CONSULTEGEO_LOCAL_MANIFEST_FINGERPRINT);
});
test('absent/revoked source remains denied rather than a regenerated observation',async()=>{
 const f=fixture(null);assert.equal(await f.ports.authority.readAccess(query,new AbortController().signal),null);
});
test('an expired persisted envelope cannot become current through the JS reader or resolver',async()=>{
 const data={...envelope(),asOf:'2000-01-01T00:00:00.123456Z',expiresAt:'2000-01-01T00:10:00.123456Z'},f=fixture(data);
 assert.deepEqual(await f.ports.authority.readAccess(query,new AbortController().signal),data);
 await assert.rejects(f.ports.resolver.resolveResourceScope(principal,refs,'tickets.read'),{code:'resource_scope_denied'});
});
test('adapter refuses foreign provenance and rolls back',async()=>{
 const f=fixture({...envelope(),manifestFingerprint:'f'.repeat(64)});await assert.rejects(f.ports.authority.readAccess(query,new AbortController().signal),{code:'local_source_unavailable'});assert.equal(f.calls.at(-1)?.sql,'ROLLBACK');
});
test('aborted or retargeted source query starts no transaction',async()=>{
 const f=fixture(envelope()),abort=new AbortController();abort.abort();await assert.rejects(f.ports.authority.readAccess(query,abort.signal));
 await assert.rejects(f.ports.authority.readAccess({...query,connectionId:b},new AbortController().signal));assert.equal(f.calls.length,0);
});
test('ticket directory returns only SQL-authorized complete selection',async()=>{
 const directory={ticketId:t,workspaceId:w,accountId:a,refs},f=fixture(directory);
 assert.deepEqual(await f.ports.directory.readTicketResources(principal,t,new AbortController().signal),directory);
 assert.deepEqual(f.calls.find(x=>x.sql.includes('cg_local_ticket_directory'))?.values,[t]);
});
test('request contexts use authenticated identity, no caller namespace or fresh JS clock',async()=>{
 const contexts=[{accountId:a,accountName:'Cliente',productInstanceId:b,connectionId:c,tenantId:'0001',works:[{id:'0001',name:'Obra',ref:refs[0]}]}],f=fixture(contexts);
 assert.deepEqual(await f.ports.readRequestContexts(principal,new AbortController().signal),contexts);
 assert.deepEqual(f.calls.find(x=>x.sql.includes('cg_local_request_contexts'))?.values,[]);
});
