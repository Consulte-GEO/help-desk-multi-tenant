import type {createConfigurationAdministration} from '../src/application/configuration-admin.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {configurationFixture,id,NOW,LATER} from './helpers/configuration-fixture.ts';
async function factory():Promise<typeof createConfigurationAdministration>{const path='../src/application/configuration-admin.ts';const m=await import(path).catch((e:unknown)=>{if((e as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};throw e;});assert.equal(typeof m.createConfigurationAdministration,'function','C05 administration must be implemented');return m.createConfigurationAdministration;}
async function fixture(){const f=configurationFixture(),api=(await factory())({store:f.store,clock:f.clock});let sequence=0;
 const execute=(action:string,data:any,record?:any,key?:string)=>f.withProof((p,proof)=>api.execute(p,proof,{action,expectedRevision:f.configuration().revision,reason:'Reviewed configuration',data,...(record?{targetId:record.id,expectedEntityRevision:record.revision}:{})},key??'config-key-'+String(++sequence).padStart(16,'0')));
 const list=(kind:string)=>f.withProof((p,proof)=>api.list(p,proof,{kind,limit:100}));
 return {...f,api,execute,list};
}
async function catalog(f:Awaited<ReturnType<typeof fixture>>){
 const account=(await f.execute('account.create',{name:'Customer',active:true})).record;
 const product=(await f.execute('product.create',{code:'GEO',name:'System',active:true})).record;
 const instance=(await f.execute('instance.create',{productId:product.id,environment:'production',active:true})).record;
 const service=(await f.execute('service.create',{productId:product.id,code:'SUPPORT',name:'Support',active:true})).record;
 const contract=(await f.execute('contract.create',{name:'Support contract',status:'active'})).record;
 const version=(await f.execute('contract_version.create',{contractId:contract.id,validFrom:NOW,validUntil:LATER,policyRef:'APPROVED-POLICY'})).record;
 return {account,product,instance,service,contract,version};
}
test('C05 creates named entities, accounts and full catalog with one audit and receipt per command',async()=>{
 const f=await fixture(),c=await catalog(f);assert.equal(f.configuration().records.length,6);assert.equal(f.audits().length,6);assert.equal(c.version.data.version,1);assert.equal(c.version.data.published,false);assert.deepEqual(f.principal.scopes,['contexts:resolve','tickets:read']);
});
test('C05 creates only a binding to an existing qualified connection, without granting resources',async()=>{
 const f=await fixture(),c=await catalog(f);const r=await f.execute('binding.create',{accountId:c.account.id,productInstanceId:c.instance.id,connectionId:id(500),tenantId:'0001',active:true});assert.equal(r.record.data.tenantId,'0001');assert.deepEqual(f.principal.grants,[]);
});
test('C05 draft version cannot provide coverage before explicit publication',async()=>{
 const f=await fixture(),c=await catalog(f);await assert.rejects(f.execute('coverage.create',{accountId:c.account.id,productInstanceId:c.instance.id,serviceId:c.service.id,contractVersionId:c.version.id,validFrom:NOW,validUntil:LATER,enabled:true}),{code:'configuration_reference_ineligible'});
});
test('C05 publishes a valid version and creates coverage with exact instants',async()=>{
 const f=await fixture(),c=await catalog(f);const v=(await f.execute('contract_version.publish',{},c.version)).record;
 const r=await f.execute('coverage.create',{accountId:c.account.id,productInstanceId:c.instance.id,serviceId:c.service.id,contractVersionId:v.id,validFrom:'2026-10-09T12:00:00.123001Z',validUntil:LATER,enabled:true});assert.equal(r.record.data.validFrom,'2026-10-09T12:00:00.123001Z');assert.equal(v.data.published,true);
});
test('C05 published contract versions are immutable; a new version preserves the old snapshot',async()=>{
 const f=await fixture(),c=await catalog(f),v=(await f.execute('contract_version.publish',{},c.version)).record;const old=structuredClone(v);
 await assert.rejects(f.execute('contract_version.update',{contractId:c.contract.id,validFrom:NOW,validUntil:LATER,policyRef:'OTHER'},v),{code:'published_configuration_immutable'});
 const next=(await f.execute('contract_version.create',{contractId:c.contract.id,validFrom:NOW,validUntil:LATER,policyRef:'OTHER'})).record;
 assert.equal(next.data.version,2);assert.deepEqual(f.configuration().records.find((r:any)=>r.id===v.id),old);
});
for(const kind of ['secret','workspace','prototype','extra'])test('C05 unknown or privileged command field '+kind+' is refused before writing',async()=>{
 const f=await fixture();const data:any={name:'Account',active:true};Object.defineProperty(data,kind==='prototype'?'__proto__':kind,{value:'private marker',enumerable:true});await assert.rejects(f.execute('account.create',data),{code:'invalid_configuration_command'});assert.equal(f.configuration().records.length,0);
});
test('C05 capabilities are not inferred from role or business scopes',async()=>{
 const f=await fixture();f.state().capabilityGrants=f.state().capabilityGrants.filter((g:any)=>!g.capability.startsWith('accounts.'));
 await assert.rejects(f.execute('account.create',{name:'Account',active:true}),{code:'administrative_capability_required'});assert.equal(f.counters.writes,0);
});
test('C05 AAL1 fails before configuration lookup',async()=>{
 const f=await fixture();await assert.rejects(f.auth.withAdministrativeAssurance(f.request('aal1'),(p,proof)=>f.api.list(p,proof,{kind:'account',limit:10})),{code:'administrative_assurance_required'});assert.equal(f.counters.reads,0);
});
test('C05 current capability expiry prevents final commit',async()=>{
 const f=await fixture();f.state().capabilityGrants.find((g:any)=>g.capability==='accounts.write').expiresAt=LATER;f.controls.beforeCommit=()=>f.setTime(LATER);
 await assert.rejects(f.execute('account.create',{name:'Account',active:true}));assert.equal(f.configuration().records.length,0);
});
test('C05 stale aggregate or entity revision causes a conflict, not an overwrite',async()=>{
 const f=await fixture(),r=(await f.execute('account.create',{name:'Original',active:true})).record;
 await assert.rejects(f.withProof((p,proof)=>f.api.execute(p,proof,{action:'account.update',expectedRevision:1,targetId:r.id,expectedEntityRevision:r.revision,reason:'Edit',data:{name:'New',active:true}},'config-key-stale-0001')),{code:'configuration_version_conflict'});
 await assert.rejects(f.execute('account.update',{name:'New',active:true},{...r,revision:9}),{code:'configuration_version_conflict'});assert.equal(f.configuration().records[0].data.name,'Original');
});
test('C05 same key and payload returns original record after later unrelated edits',async()=>{
 const f=await fixture();const command={action:'account.create',expectedRevision:1,reason:'Create',data:{name:'Original',active:true}},key='config-replay-0001';
 const a:any=await f.withProof((p,proof)=>f.api.execute(p,proof,command,key));await f.execute('account.update',{name:'Renamed',active:true},a.record);
 const b:any=await f.withProof((p,proof)=>f.api.execute(p,proof,command,key));assert.equal(b.replayed,true);assert.equal(b.record.data.name,'Original');assert.equal(b.auditId,a.auditId);assert.equal(f.audits().length,2);
});
test('C05 same key with altered payload refuses replacement',async()=>{
 const f=await fixture(),command={action:'account.create',expectedRevision:1,reason:'Create',data:{name:'Original',active:true}},key='config-replay-0001';
 await f.withProof((p,proof)=>f.api.execute(p,proof,command,key));await assert.rejects(f.withProof((p,proof)=>f.api.execute(p,proof,{...command,data:{name:'Changed',active:true}},key)),{code:'configuration_idempotency_conflict'});
});
test('C05 lost confirmation is reconciled using the same immutable receipt',async()=>{
 const f=await fixture(),command={action:'account.create',expectedRevision:1,reason:'Create',data:{name:'Original',active:true}},key='config-lost-0000001';f.controls.loseCommit=true;
 await assert.rejects(f.withProof((p,proof)=>f.api.execute(p,proof,command,key)),{code:'configuration_outcome_unknown'});const r:any=await f.withProof((p,proof)=>f.api.execute(p,proof,command,key));assert.equal(r.replayed,true);assert.equal(f.audits().length,1);
});
test('C05 audit failure cannot leave a partial configuration in the model',async()=>{
 const f=await fixture();f.controls.failAudit=true;await assert.rejects(f.execute('account.create',{name:'Not committed',active:true}));assert.equal(f.configuration().records.length,0);assert.equal(f.receipts().size,0);
});
test('C05 list pagination binds person, workspace and revision and gives full total',async()=>{
 const f=await fixture();for(let i=0;i<3;i++)await f.execute('account.create',{name:'Account '+i,active:true});
 const first:any=await f.withProof((p,proof)=>f.api.list(p,proof,{kind:'account',limit:2}));assert.equal(first.total,3);assert.equal(first.items.length,2);assert.ok(first.nextCursor);
 const second:any=await f.withProof((p,proof)=>f.api.list(p,proof,{kind:'account',limit:2,cursor:first.nextCursor}));assert.equal(second.items.length,1);
 await f.execute('account.create',{name:'Fourth',active:true});await assert.rejects(f.withProof((p,proof)=>f.api.list(p,proof,{kind:'account',limit:2,cursor:first.nextCursor})),{code:'configuration_cursor_stale'});
});
test('C05 two commands with the same revision cannot both overwrite the aggregate',async()=>{
 const f=await fixture(),command={action:'account.create',expectedRevision:1,reason:'Concurrent',data:{name:'Account',active:true}};
 const results=await Promise.allSettled([f.withProof((p,proof)=>f.api.execute(p,proof,command,'config-race-one-01')),f.withProof((p,proof)=>f.api.execute(p,proof,command,'config-race-two-02'))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.audits().length,1);
});
test('C05 binding namespace cannot be retargeted by an update',async()=>{
 const f=await fixture(),c=await catalog(f),b=(await f.execute('binding.create',{accountId:c.account.id,productInstanceId:c.instance.id,connectionId:id(500),tenantId:'0001',active:true})).record;
 await assert.rejects(f.execute('binding.update',{...b.data,tenantId:'other'},b),{code:'configuration_identity_immutable'});
});
test('C05 unavailable source/policy prevents binding/publication',async()=>{
 const f=await fixture(),c=await catalog(f);f.controls.connectionActive=false;await assert.rejects(f.execute('binding.create',{accountId:c.account.id,productInstanceId:c.instance.id,connectionId:id(500),tenantId:'0001',active:true}));f.controls.policyActive=false;await assert.rejects(f.execute('contract_version.publish',{},c.version));
});
test('C05 source service from a different product cannot supply this coverage',async()=>{
 const f=await fixture(),c=await catalog(f),p=(await f.execute('product.create',{code:'OTHER',name:'Other',active:true})).record,s=(await f.execute('service.create',{productId:p.id,code:'S',name:'Other service',active:true})).record,v=(await f.execute('contract_version.publish',{},c.version)).record;
 await assert.rejects(f.execute('coverage.create',{accountId:c.account.id,productInstanceId:c.instance.id,serviceId:s.id,contractVersionId:v.id,validFrom:NOW,validUntil:LATER,enabled:true}),{code:'configuration_reference_ineligible'});
});
test('C05 period outside its contract version is refused without truncating microseconds',async()=>{
 const f=await fixture(),c=await catalog(f),v=(await f.execute('contract_version.publish',{},c.version)).record;
 await assert.rejects(f.execute('coverage.create',{accountId:c.account.id,productInstanceId:c.instance.id,serviceId:c.service.id,contractVersionId:v.id,validFrom:'2026-10-09T12:00:00.122999Z',validUntil:LATER,enabled:true}),{code:'configuration_reference_ineligible'});
});
test('C05 product code uniqueness persists when an existing product is inactive',async()=>{
 const f=await fixture();await f.execute('product.create',{code:'GEO',name:'Old',active:false});await assert.rejects(f.execute('product.create',{code:'GEO',name:'New',active:true}),{code:'configuration_duplicate'});
});
test('C05 no delete or arbitrary table operation exists',async()=>{
 const f=await fixture();for(const action of ['account.delete','sql.execute','grants.write'])await assert.rejects(f.execute(action,{}),{code:'invalid_configuration_command'});assert.equal(f.counters.writes,0);
});
test('C05 a foreign workspace record invalidates the whole store response',async()=>{
 const f=await fixture();await f.execute('account.create',{name:'Account',active:true});f.configuration().records[0].workspaceId=id(99);await assert.rejects(f.list('account'),{code:'invalid_configuration_state'});
});
