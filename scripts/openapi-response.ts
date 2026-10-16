/** Offline test gate over owned Response objects. Never part of the HTTP runtime.
 * Checks documented status/media/body; privacy headers and domain invariants
 * are asserted separately by the integration scenarios. Does not load URLs.
 */
import assert from 'node:assert/strict';
import {Ajv2020} from 'ajv/dist/2020.js';import formats from 'ajv-formats';
import {validateOpenApiDocument} from './check-contracts.ts';
const token=(s:string)=>s.replaceAll('~','~0').replaceAll('/','~1');
export async function createOpenApiResponseValidator(document:unknown){
 await validateOpenApiDocument(document);
 const spec=structuredClone(document) as Record<string,any>,root='urn:helpdesk:response-contract';
 const ajv=new Ajv2020({strict:false,strictSchema:true,allErrors:true,coerceTypes:false,useDefaults:false,removeAdditional:false});
 formats.default(ajv,{mode:'full'});
 // The root is an already validated OpenAPI document, not a payload schema.
 // Keep its metadata as annotations so JSON pointers retain their meaning.
 for(const keyword of Object.keys(spec))if(!ajv.getKeyword(keyword))ajv.addKeyword({keyword,valid:true});
 ajv.addSchema(spec,root);
 const resolve=(pointer:string):any=>{
  let value:any=spec;for(const part of pointer.slice(2).split('/'))value=value[part.replaceAll('~1','/').replaceAll('~0','~')];return value;
 };
 return async(path:string,method:string,response:Response):Promise<void>=>{
  const label=method.toUpperCase()+' '+path+' '+response.status;
  const operation=spec.paths?.[path]?.[method.toLowerCase()];assert.ok(operation?.responses,'Undocumented operation: '+label);
  const responses=operation.responses,status=[String(response.status),String(response.status)[0]+'XX','default'].find(k=>Object.hasOwn(responses,k));
  assert.ok(status,'Undocumented status: '+label);
  let pointer='#/paths/'+token(path)+'/'+method.toLowerCase()+'/responses/'+status,definition=responses[status];
  const seen=new Set<string>();
  while(typeof definition?.$ref==='string'){
   assert.ok(!seen.has(definition.$ref),'Cyclic response reference: '+label);seen.add(definition.$ref);pointer=definition.$ref;definition=resolve(pointer);
  }
  const content=definition.content;
  if(!content||!Object.keys(content).length){assert.equal((await response.clone().arrayBuffer()).byteLength,0,'Unexpected response body: '+label);return;}
  const media=(response.headers.get('content-type')??'').split(';')[0]!.trim().toLowerCase(),declared=Object.keys(content).find(k=>k.toLowerCase()===media);
  assert.ok(declared&&/^application\/(?:[a-z0-9.+-]+\+)?json$/.test(media),'Undocumented JSON media: '+label);
  assert.ok(Object.hasOwn(content[declared],'schema'),'Response schema absent: '+label);
  const validate=ajv.getSchema(root+pointer+'/content/'+token(declared)+'/schema');assert.ok(validate,'Response schema unavailable: '+label);
  let body:unknown;try{body=await response.clone().json();}catch{throw Error('Invalid response JSON: '+label);}
  // Never include payload values, Ajv parameters, or parser messages in errors.
  assert.ok(validate(body),'Response body violates contract: '+label);
  if(media==='application/problem+json')assert.ok((body as {status?:unknown})?.status===response.status,'Problem status differs from HTTP: '+label);
 };
}
