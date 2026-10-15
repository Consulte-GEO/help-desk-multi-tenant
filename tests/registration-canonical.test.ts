import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalRegistrationJson, registrationHash, parseRegistrationJson, copyRegistrationValue, HDA_CANONICAL_PROFILE} from '../src/domain/registration-canonical.ts';

const invalid = (work:()=>unknown) => assert.throws(work, (e:any)=>e.name==='HelpdeskError' && e.code==='registration_invalid_data' && !e.message.includes('private-secret'));
test('X01 canonical profile is explicitly versioned',()=>assert.equal(HDA_CANONICAL_PROFILE,'hda-cjson-v1'));
test('X01 sorts ASCII keys, preserves null false zero and array order',()=>{
 const raw={z:null,b:false,a:0,items:['0001','1']};
 assert.equal(canonicalRegistrationJson(raw),'{"a":0,"b":false,"items":["0001","1"],"z":null}');
 assert.equal(registrationHash(raw),createHash('sha256').update(canonicalRegistrationJson(raw),'utf8').digest('hex'));
});
test('A03 omission is different from null, false, empty string and zero',()=>{
 const values=[{}, {a:null},{a:false},{a:''},{a:0}]; assert.equal(new Set(values.map(registrationHash)).size,5);
});
test('X01 preserves Unicode without silent normalization',()=>{
 assert.notEqual(registrationHash({a:'é'}),registrationHash({a:'e\u0301'}));
 assert.equal(canonicalRegistrationJson({a:'ação 🧱\n"\\'}),JSON.stringify({a:'ação 🧱\n"\\'}));
});
for(const [name,value] of [['float',1.25],['negative zero',-0],['infinity',Infinity],['NaN',NaN],['unsafe',9007199254740992],['undefined',undefined],['bigint',1n],['date',new Date()],['surrogate','\ud800'],['NUL','\0'],['symbol',Symbol('private-secret')]] as const){
 test('canonical rejects '+name,()=>invalid(()=>canonicalRegistrationJson(value)));
}
test('canonical refuses accessors without running them',()=>{
 let calls=0; const x=Object.defineProperty({},'value',{enumerable:true,get(){calls++;return 'private-secret';}});
 invalid(()=>canonicalRegistrationJson(x)); assert.equal(calls,0);
});
test('canonical rejects inherited, hidden and symbol fields',()=>{
 invalid(()=>canonicalRegistrationJson(Object.create({x:1})));
 invalid(()=>canonicalRegistrationJson(Object.defineProperty({},'x',{value:1})));
 invalid(()=>canonicalRegistrationJson({[Symbol('s')]:1}));
});
test('canonical rejects unsafe keys and non-ASCII keys',()=>{
 for(const text of ['{"__proto__":{}}','{"constructor":1}','{"á":1}']) invalid(()=>canonicalRegistrationJson(JSON.parse(text)));
});
test('canonical bounds depth and cycles',()=>{
 const cycle:any={};cycle.a=cycle;invalid(()=>canonicalRegistrationJson(cycle));
 let x:any=null;for(let i=0;i<18;i++)x={a:x};invalid(()=>canonicalRegistrationJson(x));
});
test('canonical refuses sparse and augmented arrays',()=>{
 invalid(()=>canonicalRegistrationJson(new Array(2)));
 const x:any=[1]; x.other=2;invalid(()=>canonicalRegistrationJson(x));
});
test('canonical bounds string, array and total bytes',()=>{
 invalid(()=>canonicalRegistrationJson('x'.repeat(16385)));
 invalid(()=>canonicalRegistrationJson(Array(257).fill(1)));
 invalid(()=>canonicalRegistrationJson(Array(10).fill('x'.repeat(10000))));
});
test('canonical supports repeated non-cyclic objects and deep frozen independent copies',()=>{
 const inner={a:[0,false,null]}; const raw={a:inner,b:inner}; const out:any=copyRegistrationValue(raw);
 assert.deepEqual(out,raw); assert.ok(Object.isFrozen(out.a.a)); assert.notEqual(out.a,inner);
 inner.a.push(1);assert.equal(out.a.a.length,3);
});
test('JSON parser rejects duplicate keys including escaped equivalents',()=>{
 for(const text of ['{"a":1,"a":2}','{"a":1,"\\u0061":2}','{"a":{"x":1,"x":2}}'])invalid(()=>parseRegistrationJson(text));
});
test('JSON parser accepts exact UTF8 bytes and returns deeply frozen values',()=>{
 const x:any=parseRegistrationJson(new TextEncoder().encode(' { "a": [0, false, null, "ação"] } '));
 assert.deepEqual(x,{a:[0,false,null,'ação']});assert.ok(Object.isFrozen(x.a));
});
for(const text of ['','{','{} {}','{"a":01}','{"a":1e0}','{"a":1.0}','{"a":-0}','{"a":undefined}','{"a":1,}','[1,]','```json\n{}\n```','\ufeff{}']){
 test('JSON parser refuses malformed/ambiguous input '+JSON.stringify(text),()=>invalid(()=>parseRegistrationJson(text)));
}
test('JSON parser refuses malformed UTF8, BOM bytes and over-budget data',()=>{
 invalid(()=>parseRegistrationJson(new Uint8Array([0xc3,0x28])));
 invalid(()=>parseRegistrationJson(new Uint8Array([0xef,0xbb,0xbf,0x7b,0x7d])));
 invalid(()=>parseRegistrationJson(' '.repeat(65537)+'{}'));
});
test('aggregate byte budget stops traversal before later values are inspected',()=>{
 let visited=0;const late=new Proxy({ok:true},{ownKeys(target){visited++;return Reflect.ownKeys(target);}});
 invalid(()=>copyRegistrationValue({a:'x'.repeat(16000),b:'x'.repeat(16000),c:'x'.repeat(16000),d:'x'.repeat(16000),e:'x'.repeat(16000),z:late}));
 assert.equal(visited,0);
});
