import test from 'node:test';
import assert from 'node:assert/strict';

const connection='abcdefab-1234-4567-89ab-000000000001';
const otherConnection='abcdefab-1234-4567-89ab-000000000002';
const ref=(id='0001',tenantId='tenant-A',connectionId=connection,type='work')=>({connectionId,tenantId,type,id});
const invalid={status:400,code:'invalid_resource_selection'};
const denied={status:403,code:'resource_scope_denied'};
const unavailable={status:503,code:'resource_scope_unavailable'};
async function api(){
 const path='../src/domain/external-resource.ts';
 const mod=await import(path).catch((e:unknown)=>{
  if((e as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};
  throw e;
 });
 for(const name of ['parseExternalResourceRef','parseExternalResourceSelection','externalResourceKey','externalResourceSelectionKey','requireCompleteResourceCoverage'])
  assert.equal(typeof mod[name],'function','CG03 local resource contract is missing: '+name);
 return mod;
}

test('CG03 selector preserves opaque identifiers and canonicalizes only the local connection UUID',async()=>{
 const m=await api(),original=ref('0001','Tenant-A',connection.toUpperCase());
 assert.deepEqual(m.parseExternalResourceRef(original),ref('0001','Tenant-A'));
 assert.equal(original.connectionId,connection.toUpperCase());
 for(const id of ['0','0001','Work-A','work-a','Obra São José','e\u0301','é','x:y|z/1','["literal"]'])
  assert.equal(m.parseExternalResourceRef(ref(id)).id,id);
});
test('CG03 every namespace component contributes to resource identity',async()=>{
 const m=await api(),references=[ref(),ref('1'),ref('0001','tenant-B'),ref('0001','tenant-A',otherConnection),ref('0001','tenant-A',connection,'document')];
 const keys=references.map(m.externalResourceKey);
 assert.equal(new Set(keys).size,references.length);
 assert.equal(m.externalResourceKey({...ref(),connectionId:connection.toUpperCase()}),keys[0]);
 assert.notEqual(m.externalResourceKey(ref('é')),m.externalResourceKey(ref('e\u0301')));
});
test('CG03 tuple keys cannot collide through delimiter-like source identifiers',async()=>{
 const m=await api();
 assert.notEqual(m.externalResourceKey(ref('b:c','a')),m.externalResourceKey(ref('c','a:b')));
 assert.notEqual(m.externalResourceKey(ref('b|c','a')),m.externalResourceKey(ref('c','a|b')));
});
for(const field of ['connectionId','tenantId','type','id'])test('CG03 missing namespace component '+field+' is invalid',async()=>{
 const m=await api(),input:Record<string,unknown>=ref();delete input[field];
 assert.throws(()=>m.parseExternalResourceRef(input),invalid);
});
for(const value of [null,[],true,42,'0001',new String('0001')])test('CG03 non-record reference is rejected '+String(value),async()=>{
 const m=await api();assert.throws(()=>m.parseExternalResourceRef(value),invalid);
});
for(const [field,value] of [
 ['id',1],['id',''],['id',' 0001'],['id','0001 '],['id','a\u0000b'],['id','a\nb'],['id','\ud800'],['id','x'.repeat(257)],
 ['tenantId',0],['tenantId',''],['tenantId',' a'],['tenantId','a\u0085b'],['type','Work'],['type','work.item'],['type',''],
 ['type','a'.repeat(33)],['connectionId','tenant-A'],['connectionId',123],['connectionId',connection+' ']
] as const)test('CG03 invalid component '+field+' variant '+JSON.stringify(value),async()=>{
 const m=await api();assert.throws(()=>m.parseExternalResourceRef({...ref(),[field]:value}),invalid);
});
for(const field of ['label','accountId','workspaceId','AcessaTodasObras','allowed','__proto__'])test('CG03 unknown field is never adopted as access '+field,async()=>{
 const m=await api(),input=ref();Object.defineProperty(input,field,{value:true,enumerable:true});
 assert.throws(()=>m.parseExternalResourceRef(input),invalid);
});
test('CG03 reference rejects descriptors and inherited configuration without invoking getters',async()=>{
 const m=await api();let reads=0;
 const accessor=ref();Object.defineProperty(accessor,'id',{get:()=>{reads++;return '0001';},enumerable:true});
 const hidden=ref();Object.defineProperty(hidden,'hidden',{value:'secret'});
 const symbolic=ref();Object.defineProperty(symbolic,Symbol('private'),{value:'secret'});
 for(const value of [accessor,hidden,symbolic,Object.create(ref())])assert.throws(()=>m.parseExternalResourceRef(value),invalid);
 assert.equal(reads,0);
 assert.deepEqual(m.parseExternalResourceRef(Object.assign(Object.create(null),ref())),ref());
});
test('CG03 selection and nested references are detached and immutable',async()=>{
 const m=await api(),input=[ref('A'),ref('B')],result=m.parseExternalResourceSelection(input);
 input[0]!.id='C';input.push(ref('D'));
 assert.deepEqual(result,[ref('A'),ref('B')]);assert.equal(Object.isFrozen(result),true);
 assert.equal(result.every(Object.isFrozen),true);assert.throws(()=>result.push(ref('D')),TypeError);
});
test('CG03 an empty request is not an implicit global or all-works scope',async()=>{
 const m=await api();for(const input of [[],null,undefined,{},'all'])assert.throws(()=>m.parseExternalResourceSelection(input),invalid);
 assert.throws(()=>m.requireCompleteResourceCoverage([],[]),invalid);
});
test('CG03 repeated references are rejected including a UUID case alias',async()=>{
 const m=await api();assert.throws(()=>m.parseExternalResourceSelection([ref(),ref()]),invalid);
 assert.throws(()=>m.parseExternalResourceSelection([ref(),ref('0001','tenant-A',connection.toUpperCase())]),invalid);
});
test('CG03 one request cannot silently join tenants or connections',async()=>{
 const m=await api();
 for(const input of [[ref(),ref('B','tenant-B')],[ref(),ref('B','tenant-A',otherConnection)]])
  assert.throws(()=>m.parseExternalResourceSelection(input),invalid);
});
test('CG03 bounded selection validates all rows and never truncates excess rows',async()=>{
 const m=await api();const input=Array.from({length:100},(_,i)=>ref(String(i)));
 assert.equal(m.parseExternalResourceSelection(input).length,100);
 assert.throws(()=>m.parseExternalResourceSelection([...input,ref('overflow')]),invalid);
 assert.throws(()=>m.parseExternalResourceSelection([...input.slice(0,99),{...ref('99'),label:'foreign'}]),invalid);
});
test('CG03 sparse/accessor/extra-property arrays fail without executing source code',async()=>{
 const m=await api(),sparse=[ref(),ref('B')];delete sparse[0];let reads=0;
 const accessor=[ref()];Object.defineProperty(accessor,0,{get:()=>{reads++;return ref();},enumerable:true});
 const extra=[ref()];Object.defineProperty(extra,'extra',{value:true});
 for(const value of [sparse,accessor,extra])assert.throws(()=>m.parseExternalResourceSelection(value),invalid);
 assert.equal(reads,0);
});
test('CG03 set key is order-independent and still binds tenant/connection/type/id',async()=>{
 const m=await api(),input=[ref('B'),ref('A')];
 assert.equal(m.externalResourceSelectionKey(input),m.externalResourceSelectionKey([ref('A'),ref('B')]));
 assert.notEqual(m.externalResourceSelectionKey(input),m.externalResourceSelectionKey([ref('A')]));
 assert.notEqual(m.externalResourceSelectionKey([ref()]),m.externalResourceSelectionKey([ref('0001','tenant-B')]));
 assert.deepEqual(input,[ref('B'),ref('A')]);
});
test('CG03 complete coverage returns only the requested immutable selectors, not permission flags',async()=>{
 const m=await api(),granted=[ref('A'),ref('B'),ref('D')],requested=[ref('B'),ref('A')];
 const result=m.requireCompleteResourceCoverage(requested,granted);
 assert.deepEqual(result,requested);assert.equal(Object.isFrozen(result),true);
 assert.equal(result.every(Object.isFrozen),true);
 for(const item of result)assert.deepEqual(Object.keys(item).sort(),['connectionId','id','tenantId','type']);
 granted[0]!.id='C';assert.deepEqual(result,[ref('B'),ref('A')]);
});
for(const role of ['requester','account_manager','admin'])test('CG03 '+role+' selection A+C is denied in full when source coverage is only A/B',async()=>{
 const m=await api();const actor={role,sourceCoverage:[ref('A'),ref('B')]};
 // This layer has NO role bypass; identity/grants are checked by the future orchestrator.
 assert.throws(()=>m.requireCompleteResourceCoverage([ref('A'),ref('C')],actor.sourceCoverage),denied);
 assert.throws(()=>m.requireCompleteResourceCoverage([ref('C')],actor.sourceCoverage),denied);
});
test('CG03 same work ID in another tenant/connection/type is never a matching grant',async()=>{
 const m=await api();
 for(const available of [[ref('0001','tenant-B')],[ref('0001','tenant-A',otherConnection)],[ref('0001','tenant-A',connection,'document')]])
  assert.throws(()=>m.requireCompleteResourceCoverage([ref()],available),denied);
});
test('CG03 literal wildcard-like IDs cannot grant a different resource',async()=>{
 const m=await api();assert.throws(()=>m.requireCompleteResourceCoverage([ref('C')],[ref('*')]),denied);
 assert.throws(()=>m.requireCompleteResourceCoverage([ref('C')],[ref('all')]),denied);
});
test('CG03 empty current coverage means no access, not unavailable or a global grant',async()=>{
 const m=await api();assert.throws(()=>m.requireCompleteResourceCoverage([ref('A')],[]),denied);
});
test('CG03 corrupt coverage is unavailable even when the first row matches',async()=>{
 const m=await api();
 for(const bad of [null,undefined,{},[ref(),{...ref('B'),label:'private-label'}],[ref(),ref()],[ref(),ref('B','tenant-B')]])
  assert.throws(()=>m.requireCompleteResourceCoverage([ref()],bad),unavailable);
});
test('CG03 bound source response can contain up to 1000 entries without truncation',async()=>{
 const m=await api(),available=Array.from({length:1000},(_,i)=>ref(String(i)));
 assert.deepEqual(m.requireCompleteResourceCoverage([ref('999')],available),[ref('999')]);
 assert.throws(()=>m.requireCompleteResourceCoverage([ref('999')],[...available,ref('1000')]),unavailable);
});
test('CG03 source getters and thrown details are not read into errors or diagnostics',async()=>{
 const m=await api();let reads=0;const source=ref();
 Object.defineProperty(source,'id',{get:()=>{reads++;throw Error('private-token-marker');},enumerable:true});
 const proxy=new Proxy({}, {getPrototypeOf(){throw Error('private-token-marker');}});
 for(const value of [[source],proxy])assert.throws(()=>m.requireCompleteResourceCoverage([ref()],value),(e:any)=>e.code===unavailable.code&&!/private|token|marker/.test(e.message));
 assert.equal(reads,0);
 assert.throws(()=>m.parseExternalResourceRef(proxy),(e:any)=>e.code===invalid.code&&!/private|token|marker/.test(e.message));
});
test('CG03 mismatch errors contain neither requested identifiers nor source labels',async()=>{
 const m=await api();assert.throws(()=>m.requireCompleteResourceCoverage([ref('private-customer-reference')],[ref('A')]),(e:any)=>e.code===denied.code&&!/private-customer|tenant-A|abcdef/.test(JSON.stringify(e)));
});
