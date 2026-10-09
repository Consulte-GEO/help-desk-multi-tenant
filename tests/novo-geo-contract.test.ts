import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const fixture=JSON.parse(await readFile(new URL('./fixtures/novo-geo/manifest.json',import.meta.url),'utf8'));
const candidate=()=>structuredClone(fixture.manifest);
async function validator(){
 const path='../src/connectors/novo-geo/contract.ts';
 const api=await import(path).catch((error:unknown)=>{
  if((error as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};
  throw error;
 });
 assert.equal(typeof api.validateIntegrationManifest,'function','CG01 candidate manifest validator is missing');
 return api.validateIntegrationManifest as (value:unknown)=>any;
}
const invalid={status:400,code:'integration_manifest_invalid'};

test('CG01 missing verified integration manifest cannot enable a live adapter',async()=>{
 const validate=await validator();assert.throws(()=>validate({}),invalid);
});
test('CG01 complete synthetic candidate is validated, never approved for live use',async()=>{
 const validate=await validator(),input=candidate(),result=validate(input);
 assert.equal(fixture.synthetic,true);assert.equal(fixture.providerContractVerified,false);
 assert.equal(result.kind,'validated_candidate');assert.equal(result.liveAdapterAllowed,false);
 assert.deepEqual(result.candidate,input);assert.match(result.fingerprint,/^[a-f0-9]{64}$/);
 assert.equal(Object.hasOwn(result,'approved'),false);
});
test('CG01 detached immutable output cannot change when input is edited',async()=>{
 const validate=await validator(),input=candidate(),result=validate(input),before=JSON.stringify(result);
 input.ownerRefs.api='CHANGED';input.scopes.push('new-scope');input.hosts[0]='https://foreign.example.invalid';
 assert.equal(JSON.stringify(result),before);
 for(const value of [result,result.candidate,result.candidate.hosts,result.candidate.scopes,result.candidate.ownerRefs,result.candidate.accessRevision])assert.equal(Object.isFrozen(value),true);
 assert.throws(()=>{result.liveAdapterAllowed=true;},TypeError);
});
test('CG01 fingerprint is canonical for object key order and binds all candidate fields',async()=>{
 const validate=await validator(),input=candidate(),original=validate(input);
 const reversed=Object.fromEntries(Object.entries(input).reverse());
 reversed.ownerRefs=Object.fromEntries(Object.entries(input.ownerRefs).reverse());
 assert.equal(validate(reversed).fingerprint,original.fingerprint);
 for(const edit of [(x:any)=>{x.clientId+='-B';},(x:any)=>{x.issuer+='b';},(x:any)=>{x.ownerRefs.api+='-2';},(x:any)=>{x.scopes.push('new-scope');},(x:any)=>{x.schemaHash='1'.repeat(64);},(x:any)=>{x.accessRevision.strategy='source_revision';}]){
  const other=candidate();edit(other);assert.notEqual(validate(other).fingerprint,original.fingerprint);
 }
});
test('CG01 issuer, client and scopes preserve case and trailing slash exactly',async()=>{
 const validate=await validator(),input=candidate(),first=validate(input);
 assert.equal(first.candidate.issuer,input.issuer);assert.equal(first.candidate.clientId,input.clientId);
 input.issuer+='/';assert.notEqual(validate(input).fingerprint,first.fingerprint);
 input.scopes[1]='SYNTHETIC:Access:Read';assert.equal(validate(input).candidate.scopes[1],input.scopes[1]);
});
for(const field of Object.keys(fixture.manifest))test('CG01 missing '+field+' fails closed',async()=>{
 const validate=await validator(),input=candidate();delete input[field];assert.throws(()=>validate(input),invalid);
});
for(const field of ['approved','liveAdapterAllowed','clientSecret','accessToken','refreshToken','__proto__'])test('CG01 foreign or activation field '+field+' is rejected',async()=>{
 const validate=await validator(),input=candidate();Object.defineProperty(input,field,{value:'private-marker',enumerable:true});assert.throws(()=>validate(input),invalid);
});
for(const [field,value] of [['schemaVersion',2],['status','approved'],['system','GEOLAB'],['system','GEO_LEGACY'],['clientId',''],['clientId',' padded '],['schemaHash','g'.repeat(64)],['schemaHash','abc'],['scopes',[]],['scopes',['profile']],['scopes',['openid','openid']],['scopes',['openid','two scopes']],['scopes',Array(33).fill('openid')]] as const)test('CG01 invalid '+field+' '+JSON.stringify(value)+' is rejected',async()=>{
 const validate=await validator(),input=candidate();input[field]=value;assert.throws(()=>validate(input),invalid);
});
for(const url of ['http://identity.example.invalid/Realm','https://private:secret@identity.example.invalid/Realm','https://identity.example.invalid/Realm?token=private','https://identity.example.invalid/Realm#private','https://identity.example.invalid/Realm?','https://identity.example.invalid/Realm#','https://127.0.0.1/Realm','https://2130706433/Realm','https://[::1]/Realm','https://localhost/Realm','https://id.local/Realm','https://id.internal/Realm','https://identity.example.invalid/../Realm','https://identity.example.invalid/%2e%2e/Realm','https://identity.example.invalid\\@foreign.example.invalid/Realm','https://identity.example.invalid/Realm\n','https://*.example.invalid/Realm'])test('CG01 unsafe or ambiguous issuer variant '+JSON.stringify(url),async()=>{
 const validate=await validator(),input=candidate();input.issuer=url;
 assert.throws(()=>validate(input),(error:any)=>error.code===invalid.code&&!/private|secret|foreign|127\.0\.0\.1/.test(error.message));
});
test('CG01 origins are exact, allowlisted and cannot silently authorize another host',async()=>{
 const validate=await validator();
 for(const edit of [(x:any)=>{x.issuer='https://other.example.invalid/Realm';},(x:any)=>{x.redirectUri='https://foreign.example.invalid/auth/callback';},(x:any)=>{x.apiOrigin+='/v1';},(x:any)=>{x.hosts.push('https://extra.example.invalid');},(x:any)=>{x.hosts.push(x.hosts[0]);},(x:any)=>{x.hosts[0]+='/path';},(x:any)=>{x.redirectUri='https://helpdesk.example.invalid/';}]){
  const input=candidate();edit(input);assert.throws(()=>validate(input),invalid);
 }
});
test('CG01 owner and revision fields are mandatory references, not inferred approvals',async()=>{
 const validate=await validator();
 for(const edit of [(x:any)=>{x.ownerRefs.api='';},(x:any)=>{x.ownerRefs.api='someone@example.invalid';},(x:any)=>{delete x.ownerRefs.security;},(x:any)=>{x.ownerRefs.approved=true;},(x:any)=>{x.accessRevision.strategy='cache_forever';},(x:any)=>{x.accessRevision.contractRef='';},(x:any)=>{x.accessRevision.token='private-marker';}]){
  const input=candidate();edit(input);assert.throws(()=>validate(input),invalid);
 }
});
test('CG01 descriptors and prototypes cannot execute getters or inherited configuration',async()=>{
 const validate=await validator();let reads=0;
 const top=candidate();Object.defineProperty(top,'issuer',{get:()=>{reads++;return fixture.manifest.issuer;},enumerable:true});
 const nested=candidate();Object.defineProperty(nested.ownerRefs,'api',{get:()=>{reads++;return 'OWNER';},enumerable:true});
 const array=candidate();Object.defineProperty(array.scopes,1,{get:()=>{reads++;return 'scope';},enumerable:true});
 for(const input of [top,nested,array,Object.create(candidate())])assert.throws(()=>validate(input),invalid);
 assert.equal(reads,0);
});
test('CG01 sparse arrays, symbols and hidden fields are not a plain candidate document',async()=>{
 const validate=await validator();const sparse=candidate();delete sparse.scopes[1];
 const symbolic=candidate();symbolic[Symbol('hidden')]='private-marker';
 const hidden=candidate();Object.defineProperty(hidden,'hidden',{value:'private-marker'});
 const arrayExtra=candidate();arrayExtra.scopes.secret='private-marker';
 for(const input of [sparse,symbolic,hidden,arrayExtra,null,[],true,Infinity])assert.throws(()=>validate(input),invalid);
});
test('CG01 a hostile proxy cannot leak its exception through candidate validation',async()=>{
 const validate=await validator();const input=new Proxy({},{ownKeys(){throw Error('private-marker');}});
 assert.throws(()=>validate(input),(e:any)=>e.code===invalid.code&&!e.message.includes('private-marker'));
});
test('CG01 null-prototype records are safely copied without inherited behavior',async()=>{
 const validate=await validator(),input=Object.assign(Object.create(null),candidate());
 input.ownerRefs=Object.assign(Object.create(null),input.ownerRefs);
 assert.deepEqual(validate(input).candidate,candidate());
});
