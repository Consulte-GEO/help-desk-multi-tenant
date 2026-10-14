import test from 'node:test';
import assert from 'node:assert/strict';
import {planConsulteGeoLocalProvisioning} from '../src/application/consultegeo-local-provisioning.ts';
import {CONSULTEGEO_LOCAL_MANIFEST,CONSULTEGEO_LOCAL_MANIFEST_FINGERPRINT} from '../src/infrastructure/consultegeo-local-source.ts';
import {requestHash} from '../src/domain/canonical.ts';
const w='10000000-0000-4000-8000-000000000001',a='10000000-0000-4000-8000-000000000002';
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const input=()=>({workspaceId:w,expectedRegistryRevision:0,requestId:id(3),reason:'Cadastro real declarado pelo operador',
 accounts:[{accountId:a,name:'Cliente declarado',productInstanceId:id(4),connectionId:id(5),bindingId:id(6),tenantId:'0001',active:true}],
 works:[{accountId:a,id:'0001',name:'Obra declarada',active:true}],
 permissions:[{accountId:a,principalId:id(7),role:'requester',operation:'tickets.read',active:true,workIds:['0001']}]});
test('offline plan fixes local provenance and preserves opaque work IDs without executing SQL',()=>{
 const p=planConsulteGeoLocalProvisioning(input());assert.equal(p.executesDatabase,false);
 assert.equal(p.sql,'select helpdesk_auth.cg_local_provision($1::text,$2::text) as receipt');
 const command=JSON.parse(p.values[0]);assert.deepEqual(command.sourceManifest,CONSULTEGEO_LOCAL_MANIFEST);
 assert.equal(command.manifestFingerprint,CONSULTEGEO_LOCAL_MANIFEST_FINGERPRINT);assert.equal(command.works[0].id,'0001');
 assert.equal(p.values[1],requestHash(command));assert.ok(!p.sql.includes('insert into'));
});
test('empty complete snapshot is an explicit revocation plan',()=>{
 const x=input();x.accounts=[];x.works=[];x.permissions=[];assert.equal(JSON.parse(planConsulteGeoLocalProvisioning(x).values[0]).permissions.length,0);
});
test('planner refuses caller provenance, principal data, scopes, unknown keys and implied broad grants',()=>{
 for(const extra of [{manifestFingerprint:'f'.repeat(64)},{sourceManifest:{}},{principal:{}},{scopes:['tickets:write']},{password:'secret'}])assert.throws(()=>planConsulteGeoLocalProvisioning({...input(),...extra}),{code:'invalid_local_provisioning'});
 for(const mutation of [(x:any)=>x.permissions[0].role='admin',(x:any)=>x.permissions[0].operation='*',(x:any)=>x.permissions[0].workIds=['unknown'],(x:any)=>x.permissions[0].principalId='new-human',(x:any)=>x.works.push({...x.works[0]}),(x:any)=>x.accounts[0].active='true']){
  const x=input();mutation(x);assert.throws(()=>planConsulteGeoLocalProvisioning(x),{code:'invalid_local_provisioning'});
 }
});
test('planner rejects accessor input, invalid CAS, mixed accounts and oversized commands',()=>{
 let read=false;const x=input();Object.defineProperty(x,'reason',{enumerable:true,get(){read=true;return 'bad';}});
 assert.throws(()=>planConsulteGeoLocalProvisioning(x));assert.equal(read,false);
 for(const revision of [-1,1.5,2147483647,'0'])assert.throws(()=>planConsulteGeoLocalProvisioning({...input(),expectedRegistryRevision:revision}));
 const foreign=input();foreign.works[0]!.accountId=id(99);assert.throws(()=>planConsulteGeoLocalProvisioning(foreign));
 const huge=input();huge.works=Array.from({length:1000},(_,n)=>({accountId:a,id:String(n),name:'x'.repeat(160),active:true}));assert.throws(()=>planConsulteGeoLocalProvisioning(huge));
});
