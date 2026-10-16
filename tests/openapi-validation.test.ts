import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const contract=()=>JSON.parse(''+String.raw`{"openapi":"3.1.1","info":{"title":"Owned test contract","version":"1.0.0"},"paths":{"/owned":{"get":{"operationId":"getOwned","responses":{"200":{"description":"Found"}}}}}}`);
async function validator(){const m=await import('../scripts/check-contracts.ts');assert.equal(typeof m.validateOpenApiDocument,'function');return m.validateOpenApiDocument;}

test('formal validator rejects a schema violation accepted by the structural sentinels',async()=>{
 const validate=await validator(),d=contract();d.info.version=42 as any;
 await assert.rejects(()=>validate(d),/schema|version|validation/i);
});
test('formal validator accepts the project OpenAPI3.1.1 without mutating it',async()=>{
 const validate=await validator(),d=JSON.parse(await readFile(new URL('../docs/openapi.json',import.meta.url),'utf8')),before=JSON.stringify(d);
 await validate(d);assert.equal(JSON.stringify(d),before);
});
test('external file, HTTPS and unresolved references are rejected by the contract gate',async()=>{
 const validate=await validator();
 for(const ref of ['https://example.invalid/secret.json','file:///etc/passwd','#/components/schemas/Absent']){
  const d:any=contract();d.paths['/owned'].get.responses['200']={description:'Found',content:{'application/json':{schema:{$ref:ref}}}};
  await assert.rejects(()=>validate(d));
 }
});

test('component and nested payload schemas must also satisfy JSON Schema2020-12',async()=>{
 const validate=await validator();
 for(const bad of [{type:'not_a_type'},{type:'object',properties:{value:{type:123}}}]){
  const d:any=contract();d.components={schemas:{Payload:bad}};
  await assert.rejects(()=>validate(d),/schema|type/i);
 }
 const d:any=contract();d.paths['/owned'].get.responses['200']={description:'Found',content:{'application/json':{schema:{type:'object',required:'wrong'}}}};
 await assert.rejects(()=>validate(d),/schema|required/i);
});
test('unresolved internal dynamic references fail before accepting the contract',async()=>{
 const validate=await validator(),d:any=contract();d.components={schemas:{Payload:{$dynamicRef:'#/components/schemas/Absent'}}};
 await assert.rejects(()=>validate(d));
});
test('example payload properties called schema are not interpreted as OpenAPI schema locations',async()=>{
 const validate=await validator(),d:any=contract();d.components={schemas:{Payload:{type:'object',examples:[{schema:{type:'this is a business value'}}]}}};
 await validate(d);
});
test('component names are opaque map keys, never schema or example keywords',async()=>{
 const validate=await validator();
 for(const name of ['schema','examples','x-owned','ordinary']){
  const valid:any=contract();valid.components={parameters:{[name]:{in:'query',name:'q',required:true,schema:{type:'string'}}}};
  await validate(valid);
  valid.components.parameters[name].schema={type:123};await assert.rejects(()=>validate(valid),/schema|type/i);
 }
});
test('schema references also validate targets outside canonical component locations, with bounded cycles',async()=>{
 const validate=await validator(),d:any=contract();d['x-owned-schema']={type:123};
 d.paths['/owned'].get.responses['200']={description:'Found',content:{'application/json':{schema:{type:'object',properties:{nested:{$ref:'#/x-owned-schema'}}}}}};
 await assert.rejects(()=>validate(d),/schema|type/i);
 d['x-owned-schema']={type:'object',properties:{next:{$ref:'#/x-owned-schema'}}};await validate(d);
});
