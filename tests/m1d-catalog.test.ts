import {test} from 'node:test';
import assert from 'node:assert/strict';
import {HelpdeskService} from '../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../src/infrastructure/memory.ts';
import {principal,coverage} from './fixtures.ts';
import type {Principal,Coverage} from '../src/domain/model.ts';
import type {SupportCatalogEntry} from '../src/application/support-catalog.ts';
import type {UnitOfWork} from '../src/application/ports.ts';

const at='2026-09-16T12:00:00.000Z';
const context=(overrides:Partial<SupportCatalogEntry>&Record<string,unknown>={}):SupportCatalogEntry=>({workspaceId:'workspace-a',accountId:'account-a',accountName:'Cliente A',productInstanceId:'geolab-production',productName:'Sistema A',environment:'production',serviceCode:'SUPPORT',serviceName:'Suporte',...overrides});
function setup(options:{contexts?:ReturnType<typeof context>[];coverages?:Coverage[]}={}){
 const db=new MemoryUnitOfWork({supportContexts:options.contexts??[context()],coverages:options.coverages??[coverage()]});
 return {db,service:new HelpdeskService(db,()=>new Date(at))};
}
test('authorized requester discovers its account/product/service without typing identifiers',async()=>{
 const {service}=setup();const r=await service.supportContexts(principal(),{limit:50});
 assert.equal(r.items.length,1);assert.deepEqual(r.items[0],context());assert.equal(r.nextCursor,null);
});
test('catalogue omits sibling accounts and workspaces with identical context identifiers',async()=>{
 const {service}=setup({contexts:[context(),context({accountId:'account-b',accountName:'SECRET B'}),context({workspaceId:'workspace-b',accountName:'SECRET WORKSPACE'})],coverages:[coverage(),coverage({id:'coverage-b',accountId:'account-b'}),coverage({workspaceId:'workspace-b'})]});
 const r=await service.supportContexts(principal(),{limit:100});assert.deepEqual(r.items,[context()]);assert.ok(!JSON.stringify(r).includes('SECRET'));
});
test('workspace agent without account grant does not discover every customer',async()=>{
 const {service}=setup();assert.deepEqual((await service.supportContexts(principal({workspaceRole:'agent',grants:[]}),{limit:25})).items,[]);
});
test('human workspace administrator discovers eligible accounts in own workspace',async()=>{
 const {service}=setup();assert.equal((await service.supportContexts(principal({workspaceRole:'admin',grants:[]}),{limit:25})).items.length,1);
});
test('integration catalogue obeys connection product allowlist even with a known account',async()=>{
 const {service}=setup();const p=principal({kind:'integration',workspaceRole:null,connectionId:'connection-a',productInstanceIds:['other-instance']});
 assert.equal((await service.supportContexts(p,{limit:25})).items.length,0);
});
test('integration never acquires workspace administrator bypass through catalogue',async()=>{
 const {service}=setup();const p=principal({kind:'integration',workspaceRole:'admin',grants:[],productInstanceIds:['geolab-production']});
 assert.equal((await service.supportContexts(p,{limit:25})).items.length,0);
});
test('contexts:resolve is required before querying the store',async()=>{
 let touched=false;const db:UnitOfWork={async run(){touched=true;throw Error('must not query');}};
 await assert.rejects(()=>new HelpdeskService(db).supportContexts(principal({scopes:['tickets:read']}),{limit:25}),{status:403});assert.equal(touched,false);
});
test('an unauthorized account selector is rejected without existence lookup',async()=>{
 const {service}=setup();await assert.rejects(()=>service.supportContexts(principal(),{limit:25,accountId:'account-b'}),{status:404});
});
for(const patch of [{enabled:false},{published:false},{contractStatus:'suspended'},{contractStatus:'terminated'},{validUntil:at},{validFrom:'2026-09-17T00:00:00Z'}] as Partial<Coverage>[]){
 test('ineligible coverage does not create a catalogue option: '+JSON.stringify(patch),async()=>{
  const {service}=setup({coverages:[coverage(patch)]});assert.deepEqual((await service.supportContexts(principal(),{limit:25})).items,[]);
 });
}
test('multiple valid contracts produce one option and preserve explicit ambiguity at resolve',async()=>{
 const {service}=setup({coverages:[coverage(),coverage({id:'other-coverage',contractId:'other-contract',contractVersionId:'other-version'})]});
 assert.equal((await service.supportContexts(principal(),{limit:25})).items.length,1);
 assert.equal((await service.resolve(principal(),{accountId:'account-a',productInstanceId:'geolab-production',serviceCode:'SUPPORT'})).status,'ambiguous');
});
test('catalogue selection never replaces contract revalidation on creation',async()=>{
 const {service,db}=setup();assert.equal((await service.supportContexts(principal(),{limit:25})).items.length,1);db.seedCoverage(coverage({contractStatus:'suspended'}));
 await assert.rejects(()=>service.create(principal(),{accountId:'account-a',productInstanceId:'geolab-production',serviceCode:'SUPPORT',subject:'Selected service',description:'Description',priority:'normal'},'m1d-catalog-create-key','catalog-test'),{status:422});
 assert.equal(db.snapshot().tickets.length,0);assert.equal(db.snapshot().outbox.length,0);
});
test('composite pagination is stable across identical services on different accounts and instances',async()=>{
 const contexts=[],coverages=[];for(const accountId of ['account-a','account-b'])for(const productInstanceId of ['instance-a','instance-b'])for(const serviceCode of ['SUPPORT','ZETA','ÁUDIO']){
  contexts.push(context({accountId,productInstanceId,serviceCode}));coverages.push(coverage({id:`c-${coverages.length}`,accountId,productInstanceId,serviceCode}));
 }
 const {service}=setup({contexts,coverages});const p=principal({workspaceRole:'admin',grants:[]});const items=[];let cursor:string|undefined;
 do{const r=await service.supportContexts(p,{limit:3,...(cursor?{cursor}:{})});items.push(...r.items);cursor=r.nextCursor??undefined;}while(cursor);
 assert.equal(items.length,12);assert.equal(new Set(items.map(x=>JSON.stringify([x.accountId,x.productInstanceId,x.serviceCode]))).size,12);assert.deepEqual(items,contexts);
});
test('cursor is bound to actor, workspace, and account filter',async()=>{
 const {service}=setup({contexts:[context(),context({serviceCode:'ZZZ'})],coverages:[coverage(),coverage({id:'coverage-z',serviceCode:'ZZZ'})]});
 const cursor=(await service.supportContexts(principal(),{limit:1})).nextCursor!;assert.ok(cursor);
 for(const [p,extra] of [[principal({id:'another-actor'}),{}],[principal({workspaceId:'other-workspace'}),{}],[principal(),{accountId:'account-a'}]] as [Principal,Record<string,string>][])
  await assert.rejects(()=>service.supportContexts(p,{limit:1,cursor,...extra}),{code:'invalid_cursor'});
});
test('revocation between catalogue pages does not reveal previously eligible rows',async()=>{
 const {service}=setup({contexts:[context(),context({serviceCode:'ZZZ'})],coverages:[coverage(),coverage({id:'coverage-z',serviceCode:'ZZZ'})]});
 const cursor=(await service.supportContexts(principal(),{limit:1})).nextCursor!;
 assert.deepEqual((await service.supportContexts(principal({grants:[]}),{limit:1,cursor})).items,[]);
});
for(const limit of [0,101,-1,1.5,NaN,Infinity])test('catalogue refuses invalid limit '+limit,async()=>{const {service}=setup();await assert.rejects(()=>service.supportContexts(principal(),{limit}),{code:'invalid_input'});});
for(const cursor of ['', '%%%', 'a'.repeat(1601), Buffer.from('{"scope":"invented"}').toString('base64url')])test('malformed catalogue cursor is rejected '+cursor.slice(0,20),async()=>{const {service}=setup();await assert.rejects(()=>service.supportContexts(principal(),{limit:25,cursor}),{code:'invalid_cursor'});});
test('malformed or cross-workspace adapter data is rejected instead of serialized',async()=>{
 const db:UnitOfWork={async run(p,work){return work({supportContexts:async()=>[context({workspaceId:'secret-workspace'})]} as never);}};
 await assert.rejects(()=>new HelpdeskService(db).supportContexts(principal(),{limit:25}),{code:'invalid_catalog_result'});
});
test('private adapter extras cannot enter the catalogue projection',async()=>{
 const db:UnitOfWork={async run(p,work){return work({supportContexts:async()=>[context({policy:{secret:'PRIVATE'},credential:'KEY',internalNotes:['INTERNAL']})]} as never);}};
 assert.deepEqual((await new HelpdeskService(db).supportContexts(principal(),{limit:25})).items,[context()]);
});
test('names and service codes remain text, including non-ASCII and HTML-like content',async()=>{
 const c=context({serviceCode:'ORIENTAÇÃO',serviceName:'<script>not executable</script>'});const {service}=setup({contexts:[c],coverages:[coverage({serviceCode:'ORIENTAÇÃO'})]});
 assert.deepEqual((await service.supportContexts(principal(),{limit:25})).items,[c]);
});
for(const override of [{accountName:'Conta\nA'},{serviceCode:'SUP\u0085PORT'}])test('catalogue rejects control characters consistently with guided UI '+JSON.stringify(override),async()=>{
 const db:UnitOfWork={async run(p,work){return work({supportContexts:async()=>[context(override)]} as never);}};
 await assert.rejects(()=>new HelpdeskService(db).supportContexts(principal(),{limit:25}),{code:'invalid_catalog_result'});
});
test('catalogue accepts names of 160 Unicode characters even above 160 UTF-16 units',async()=>{
 const c=context({accountName:'😀'.repeat(160)}),{service}=setup({contexts:[c]});assert.deepEqual((await service.supportContexts(principal(),{limit:50})).items,[c]);
});
for(const [name,rows] of Object.entries({duplicate:[context(),context()],wrongOrder:[context({serviceCode:'ZZZ'}),context()],oversized:[context(),context(),context()]}))test('catalogue refuses adapter ordering or page-bound violation '+name,async()=>{
 const db:UnitOfWork={async run(p,work){return work({supportContexts:async()=>rows} as never);}};
 await assert.rejects(()=>new HelpdeskService(db).supportContexts(principal(),{limit:1}),{code:'invalid_catalog_result'});
});
