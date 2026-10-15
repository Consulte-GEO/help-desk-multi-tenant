import test from 'node:test';
import assert from 'node:assert/strict';
const M = await import('../../../modules/import-process/canonical.ts').catch(()=>({}));
const empty = ()=>({schemaVersion:'1',records:[],decisions:[],findings:[],artifactIds:[]});
const field = (x={})=>({rawValue:'120 mm',rawUnit:'mm',value:12,unit:'cm',presence:'present',provenance:'normalized',semanticRole:'measured',locations:[{artifactId:'11111111-1111-4111-8111-111111111111',sheet:'Dados',row:2}],...x});
test('serialização e hash não dependem da ordem das chaves',async()=>{
 assert.equal(typeof M.canonicalJson,'function');assert.equal(M.canonicalJson({b:2,a:1}),' {"a":1,"b":2}'.trim());
 assert.equal(await M.contentHash({b:2,a:1}),await M.contentHash({a:1,b:2}));
 assert.notEqual(await M.contentHash([1,2]),await M.contentHash([2,1]));
});
for(const [name,value] of [['NaN',NaN],['Infinity',Infinity],['undefined',undefined],['Date',new Date()],['BigInt',1n],['hole',Array(2)],['function',()=>1],['nul','x\0y'],['surrogate','\uD800']])
 test('recusa JSON não representável: '+name,()=>{assert.equal(typeof M.canonicalJson,'function');assert.throws(()=>M.canonicalJson(value),/INVALID_JSON|LIMIT/)});
test('não executa getters na serialização',()=>{let called=false;const v={get secret(){called=true;return 1}};assert.equal(typeof M.canonicalJson,'function');assert.throws(()=>M.canonicalJson(v),/INVALID_JSON/);assert.equal(called,false)});
test('ciclos e profundidade excessiva são recusados',()=>{const v={};v.v=v;assert.equal(typeof M.canonicalJson,'function');assert.throws(()=>M.canonicalJson(v));let n={};for(let i=0;i<35;i++)n={child:n};assert.throws(()=>M.canonicalJson(n),/LIMIT/)});
test('snapshot válido é cópia independente da entrada',()=>{assert.equal(typeof M.parseSnapshot,'function');const s=empty(),r=M.parseSnapshot(s);s.records.push({bad:1});assert.deepEqual(r,empty())});
test('schema desconhecido e sinalização de aprovação são recusados',()=>{assert.equal(typeof M.parseSnapshot,'function');assert.throws(()=>M.parseSnapshot({...empty(),approved:true}),/INVALID/);assert.throws(()=>M.parseSnapshot({...empty(),schemaVersion:'2'}),/INVALID/)});
test('campo medido documentado é preservado sem arredondamento',()=>{assert.equal(typeof M.parseField,'function');assert.deepEqual(M.parseField(field()),field())});
for(const provenance of ['proposed','operational'])test('valor '+provenance+' não pode ser salvo como medido',()=>{assert.equal(typeof M.parseField,'function');assert.throws(()=>M.parseField(field({provenance})),/SEMANTIC/)});
for(const presence of ['absent','illegible','not_applicable'])test(presence+' não comporta valor confirmado',()=>{assert.equal(typeof M.parseField,'function');assert.throws(()=>M.parseField(field({presence})),/PRESENCE/)});
test('dado de fonte preenchido exige localização',()=>{assert.equal(typeof M.parseField,'function');assert.throws(()=>M.parseField(field({locations:[]})),/SOURCE/)});
test('IDs duplicados e vínculos para registro inexistente são recusados',()=>{assert.equal(typeof M.parseSnapshot,'function');const r={id:'src1',kind:'delivery',fields:{},links:{}};assert.throws(()=>M.parseSnapshot({...empty(),records:[r,r]}),/DUPLICATE/);assert.throws(()=>M.parseSnapshot({...empty(),records:[{...r,links:{event:'missing'}}]}),/REFERENCE/)});
test('origem de campo tem que estar na lista explícita de artefatos',()=>{assert.equal(typeof M.parseSnapshot,'function');assert.throws(()=>M.parseSnapshot({...empty(),records:[{id:'r1',kind:'delivery',fields:{Slump:field()},links:{}}]}),/ARTIFACT/)});
test('objetos inesperados e texto excessivo são recusados',()=>{assert.equal(typeof M.canonicalJson,'function');assert.throws(()=>M.canonicalJson({x:'a'.repeat(1100000)}),/LIMIT/);assert.throws(()=>M.parseSnapshot({...empty(),records:[{id:'a',kind:'delivery',fields:{},links:{},approved:true}]}),/INVALID/)});
