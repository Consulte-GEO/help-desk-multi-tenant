/** Formal OpenAPI schema validation plus project sentinels. Live response
 * conformance, SQL/RLS and mounted capabilities remain separate gates. */
import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import SwaggerParser from '@apidevtools/swagger-parser';
import {Ajv2020} from 'ajv/dist/2020.js';

export async function validateOpenApiDocument(document:unknown):Promise<void>{
 const spec=structuredClone(document) as Record<string,unknown>;
 assert.equal(spec?.openapi,'3.1.1');
 const jsonDialect='https://json-schema.org/draft/2020-12/schema',oasDialect='https://spec.openapis.org/oas/3.1/dialect/base';
 assert.ok(spec.jsonSchemaDialect===undefined||[jsonDialect,oasDialect].includes(String(spec.jsonSchemaDialect)),'Unsupported JSON Schema dialect.');
 const ajv=new Ajv2020({strict:false,allErrors:true,validateFormats:false});
 // The OAS dialect adds annotation keywords. Its underlying constraints are
 // JSON Schema2020-12; validate them locally without fetching a dialect URI.
 ajv.addMetaSchema({$id:oasDialect,$schema:jsonDialect,$ref:jsonDialect});
 const seen=new Set<object>();
 function references(value:unknown):void{
  if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);
  for(const [key,child] of Object.entries(value)){
   if(key==='$ref'||key==='$dynamicRef'){
    assert.ok(typeof child==='string'&&child.startsWith('#/'),'Only internal OpenAPI references are allowed.');
    let target:unknown=spec;
    for(const token of child.slice(2).split('/')){
     assert.ok(!/~(?![01])/.test(token),'Invalid JSON pointer.');
     const name=token.replaceAll('~1','/').replaceAll('~0','~');
     assert.ok(target!==null&&typeof target==='object'&&Object.hasOwn(target,name),'Unresolved internal reference '+child);
     target=(target as Record<string,unknown>)[name];
    }
   }
   references(child);
  }
 }
 references(spec);
 function schema(value:unknown):void{
  assert.ok(ajv.validateSchema(value as object),'Invalid JSON Schema: '+ajv.errorsText());
 }
 // Follow OpenAPI locations, not arbitrary names: component names, media types
 // and callback expressions can themselves be "schema", "examples" or "x-...".
 const record=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
 const values=(v:unknown,visit:(x:unknown)=>void)=>Object.values(record(v)).forEach(visit);
 function content(v:unknown):void{values(v,media=>{const m=record(media);if(Object.hasOwn(m,'schema'))schema(m.schema);values(m.encoding,e=>values(record(e).headers,parameter));});}
 function parameter(v:unknown):void{const p=record(v);if(Object.hasOwn(p,'schema'))schema(p.schema);content(p.content);}
 function body(v:unknown):void{content(record(v).content);}
 function response(v:unknown):void{const r=record(v);content(r.content);values(r.headers,parameter);}
 function callback(v:unknown):void{for(const [expression,item] of Object.entries(record(v)))if(expression!=='$ref'&&!expression.startsWith('x-'))pathItem(item);}
 function pathItem(v:unknown):void{
  const item=record(v);if(Array.isArray(item.parameters))item.parameters.forEach(parameter);
  for(const method of ['get','put','post','delete','options','head','patch','trace']){
   const op=record(item[method]);if(Array.isArray(op.parameters))op.parameters.forEach(parameter);
   body(op.requestBody);values(op.responses,response);values(op.callbacks,callback);
  }
 }
 const components=record(spec.components);
 values(components.schemas,schema);values(components.parameters,parameter);values(components.headers,parameter);
 values(components.requestBodies,body);values(components.responses,response);values(components.callbacks,callback);values(components.pathItems,pathItem);
 values(spec.paths,pathItem);values(spec.webhooks,pathItem);
 await SwaggerParser.validate(spec as any,{resolve:{external:false,file:false,http:false}});
}

export async function checkContracts():Promise<void>{
const spec=JSON.parse(await readFile(new URL('../docs/openapi.json',import.meta.url),'utf8'));
await validateOpenApiDocument(spec);
assert.equal(spec.openapi,'3.1.1');const operations=new Set<string>();
function visit(value:unknown){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach(visit);return;}const o=value as Record<string,unknown>;if(typeof o.$ref==='string'){assert.ok(o.$ref.startsWith('#/'));let target:unknown=spec;for(const key of o.$ref.slice(2).split('/')){target=(target as Record<string,unknown>)[key];assert.notEqual(target,undefined,'Unresolved reference '+o.$ref);}}Object.values(o).forEach(visit);}
visit(spec);
let count=0;for(const [path,methods]of Object.entries(spec.paths as Record<string,Record<string,{operationId:string;responses:Record<string,unknown>;parameters:unknown[]}>>)){for(const operation of Object.values(methods)){assert.ok(operation.operationId);assert.ok(!operations.has(operation.operationId));operations.add(operation.operationId);assert.ok(Object.keys(operation.responses).some(c=>/^2/.test(c)));if(path.includes('{ticket_id}'))assert.ok(JSON.stringify(operation.parameters).includes('TicketId'));count++;}}
const fn=await readFile(new URL('../netlify/functions/api.mts',import.meta.url),'utf8');assert.ok(!/MemoryUnitOfWork|demo-agent|scripts\/demo/.test(fn));
const migration=await readFile(new URL('../supabase/migrations/20260915000200_helpdesk_foundation.sql',import.meta.url),'utf8');assert.ok(!/create table public\./i.test(migration));assert.ok(migration.includes('force row level security'));assert.ok(migration.includes('deferrable initially deferred'));assert.ok(migration.includes("set search_path=''")&&migration.includes('nobypassrls'));
console.log(`OpenAPI 3.1.1 schema and structural checks passed: ${count} API operations, internal references, production/demo separation and migration sentinels. Live response conformance, SQL/RLS and mounted capabilities remain separate gates.`);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await checkContracts();
