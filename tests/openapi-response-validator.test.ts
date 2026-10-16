import test from 'node:test';import assert from 'node:assert/strict';
const contract=()=>({openapi:'3.1.1',info:{title:'Owned response fixture',version:'1'},paths:{'/owned':{get:{operationId:'getOwned',responses:{'200':{description:'Owned JSON',content:{'application/json':{schema:{$ref:'#/components/schemas/Payload'}}}}}}}},components:{schemas:{Payload:{type:'object',additionalProperties:false,required:['count','at','id'],properties:{count:{type:'integer',minimum:0},at:{type:'string',format:'date-time'},id:{type:'string',format:'uuid'}}}}}});
const valid={count:7,at:'2026-10-16T16:00:00.123456Z',id:'10000000-0000-4000-8000-000000000001'};
async function validator(d:unknown=contract()){const m=await import('../scripts/openapi-response.ts').catch(()=>null);assert.ok(m,'Response contract validator absent');return m.createOpenApiResponseValidator(d);}
test('response gate resolves internal schemas without consuming or modifying the response',async()=>{
 const d=contract(),before=JSON.stringify(d),check=await validator(d),response=Response.json(valid);await check('/owned','GET',response);
 assert.equal(response.bodyUsed,false);assert.deepEqual(await response.json(),valid);assert.equal(JSON.stringify(d),before);
});
test('response gate refuses type coercion, absent fields, extras, and impossible dates or UUIDs',async()=>{
 const check=await validator();for(const bad of [{...valid,count:'7'},{at:valid.at,id:valid.id},{...valid,private_note:'PRIVATE_SENTINEL'},{...valid,at:'2026-02-30T16:00:00Z'},{...valid,id:'not-a-uuid'}]){
  await assert.rejects(()=>check('/owned','GET',Response.json(bad)),e=>{assert.doesNotMatch(String(e),/PRIVATE_SENTINEL/);return true;});
 }
});
test('response gate refuses undocumented status, method, path, wrong media and malformed JSON',async()=>{
 const check=await validator();for(const [path,method,response] of [['/other','GET',Response.json(valid)],['/owned','POST',Response.json(valid)],['/owned','GET',Response.json(valid,{status:201})],['/owned','GET',new Response(JSON.stringify(valid),{headers:{'content-type':'text/plain'}})],['/owned','GET',new Response('{',{headers:{'content-type':'application/json'}})]] as const)await assert.rejects(()=>check(path,method,response));
});
test('response gate refuses external references, missing targets and unknown formats',async()=>{
 for(const ref of ['https://example.invalid/schema.json','file:///private.json','#/components/schemas/Missing']){const d=contract();d.paths['/owned'].get.responses['200'].content['application/json'].schema.$ref=ref;await assert.rejects(()=>validator(d));}
 const d=contract();d.components.schemas.Payload.properties.at.format='unregistered-format';const check=await validator(d);await assert.rejects(()=>check('/owned','GET',Response.json(valid)),/unknown format/);
});
test('response gate checks explicit empty-body contracts and problem status correlation',async()=>{
 const d:any=contract();d.paths['/empty']={get:{operationId:'getEmpty',responses:{'200':{description:'Empty response'}}}};
 d.paths['/owned'].get.responses.default={description:'Problem',content:{'application/problem+json':{schema:{type:'object',required:['status'],properties:{status:{type:'integer'}}}}}};
 const check=await validator(d);await check('/empty','GET',new Response(null));await assert.rejects(()=>check('/empty','GET',Response.json({})));
 await check('/owned','GET',Response.json({status:503},{status:503,headers:{'content-type':'application/problem+json'}}));
 await assert.rejects(()=>check('/owned','GET',Response.json({status:400},{status:503,headers:{'content-type':'application/problem+json'}})));
});
test('response gate follows referenced response objects and declared status ranges',async()=>{
 const d:any=contract();d.components.responses={OwnedResponse:d.paths['/owned'].get.responses['200']};d.paths['/owned'].get.responses={'2XX':{$ref:'#/components/responses/OwnedResponse'}};
 const check=await validator(d);await check('/owned','GET',Response.json(valid,{status:201}));await assert.rejects(()=>check('/owned','GET',Response.json({...valid,count:'7'})));
});
