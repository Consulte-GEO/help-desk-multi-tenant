import test from 'node:test';
import assert from 'node:assert/strict';

async function api(){
 const name='../src/domain/external-identity.ts';
 const m=await import(name).catch((e:unknown)=>{if((e as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof m.parseExternalIdentityRef,'function','C02 identity domain is not implemented');
 return m as Record<string,(input:unknown)=>any>;
}
const issuer='https://identity.example.invalid/Realm-A';
const id='00000000-0000-4000-8000-000000000001';
const p='00000000-0000-4000-8000-000000000002';
const ref=()=>({issuer,subject:'0001'});
const origin=()=>({kind:'external',identityId:id,...ref()});
const registration=()=>({principalId:p,principalKind:'human',revision:'1',active:true,principalActive:true,origin:origin()});
const invalid={status:400,code:'external_identity_data_invalid'};

test('C02 references preserve case, spaces in subjects and leading zeroes',async()=>{
 const a=await api();for(const subject of ['0001','User-A','user-a',' subject ', '__proto__','a|b','a"b']){
  assert.deepEqual(a.parseExternalIdentityRef!({issuer,subject}),{issuer,subject});
 }
});
test('C02 pair keys bind the exact issuer and subject without delimiter ambiguity',async()=>{
 const a=await api(),keys=new Set<string>();
 for(const r of [ref(),{issuer,subject:'1'},{issuer:issuer.toLowerCase(),subject:'0001'},
  {issuer:issuer+'/',subject:'0001'},{issuer,subject:'0001 '},
  {issuer:issuer+'|x',subject:'y'},{issuer,subject:'x|y'}])keys.add(a.externalIdentityKey!(r));
 assert.equal(keys.size,7);for(const k of keys)assert.match(k,/^[a-f0-9]{64}$/);
 assert.equal(a.externalIdentityKey!(ref()),a.externalIdentityKey!({subject:'0001',issuer}));
});
test('C02 namespace does not normalize issuer text or client identity',async()=>{
 const a=await api(),value={issuer:'https://IDENTITY.example.invalid/Realm-A/',clientId:'Client-A'};
 assert.deepEqual(a.parseIdentityNamespace!(value),value);
});
for(const value of ['', 'http://identity.example.invalid', 'https://private:secret@identity.example.invalid',
 'https://identity.example.invalid?secret=x', 'https://identity.example.invalid#x',
 'https://identity.example.invalid?', 'https://identity.example.invalid#',
 'https://identity.example.invalid\\x',' https://identity.example.invalid', 'https://identity.example.invalid\n',
 'https://', 'not-an-issuer'])test('C02 invalid issuer '+JSON.stringify(value),async()=>{
 const a=await api();assert.throws(()=>a.parseExternalIdentityRef!({issuer:value,subject:'a'}),invalid);
});
for(const subject of ['', 'á', 'a\n', '\u0000','\ud800','a'.repeat(256),1,null])test('C02 invalid OIDC subject '+JSON.stringify(subject),async()=>{
 const a=await api();assert.throws(()=>a.parseExternalIdentityRef!({issuer,subject}),invalid);
});
test('C02 unknown fields including email and authorization hints are never identity',async()=>{
 const a=await api();for(const extra of [{email:'same@example.invalid'},{role:'admin'},{verified:true},{workspaceId:p},{sub:'0001'}]){
  assert.throws(()=>a.parseExternalIdentityRef!({...ref(),...extra}),invalid);
 }
});
test('C02 unsafe descriptors, prototypes and proxies are refused without executing their code',async()=>{
 const a=await api();let reads=0;
 const getter={...ref()};Object.defineProperty(getter,'subject',{get(){reads++;return '0001';},enumerable:true});
 const proxy=new Proxy(ref(),{ownKeys(){reads++;throw Error('private');}});
 const hidden={...ref()};Object.defineProperty(hidden,'email',{value:'private'});
 const symbol={...ref(),[Symbol('x')]:'private'};
 for(const item of [getter,proxy,hidden,symbol,Object.create(ref()),[],null])assert.throws(()=>a.parseExternalIdentityRef!(item),invalid);
 assert.equal(reads,0);
});
test('C02 null-prototype input is copied into frozen plain data',async()=>{
 const a=await api(),input=Object.assign(Object.create(null),ref()),output=a.parseExternalIdentityRef!(input);
 input.subject='changed';assert.equal(output.subject,'0001');assert.equal(Object.isFrozen(output),true);
});
test('C02 Supabase credential registration remains a distinct valid origin',async()=>{
 const a=await api();assert.deepEqual(a.parseHumanIdentityOrigin!({kind:'supabase',userId:id.toUpperCase()}),{kind:'supabase',userId:id});
});
test('C02 external registration needs no fabricated Supabase user UUID',async()=>{
 const a=await api(),output=a.parseHumanIdentityOrigin!(origin());assert.deepEqual(output,origin());
 assert.equal(Object.hasOwn(output,'userId'),false);assert.equal(Object.hasOwn(output,'supabaseUserId'),false);
});
test('C02 mixed, missing or inferred identity origins fail closed',async()=>{
 const a=await api();for(const item of [{...origin(),userId:id},{...origin(),supabaseUserId:id},
  {kind:'supabase',userId:id,issuer},{kind:'external',identityId:id,email:'x@example.invalid'},
  {kind:'human',id},{kind:'supabase',userId:'fake'},{}])assert.throws(()=>a.parseHumanIdentityOrigin!(item),invalid);
});
test('C02 persisted mapping remains immutable, versioned and credential-only',async()=>{
 const a=await api(),input=registration(),result=a.parseExternalIdentityRegistration!(input);
 input.origin.subject='new';assert.equal(result.origin.subject,'0001');assert.equal(Object.isFrozen(result.origin),true);
 assert.equal(Object.isFrozen(result),true);assert.equal(result.principalId,p);
 assert.equal(Object.hasOwn(result,'scopes'),false);
});
for(const revision of ['0','01','-1','1.0',1,'9007199254740992',null])test('C02 invalid mapping revision '+JSON.stringify(revision),async()=>{
 const a=await api();assert.throws(()=>a.parseExternalIdentityRegistration!({...registration(),revision}),invalid);
});
test('C02 mapping cannot retarget an internal Supabase credential or an integration principal',async()=>{
 const a=await api();for(const patch of [{origin:{kind:'supabase',userId:id}}, {kind:'integration'}, {principalId:'email@example.invalid'}, {active:'true'}, {principalActive:undefined}]){
  assert.throws(()=>a.parseExternalIdentityRegistration!({...registration(),...patch}),invalid);
 }
});
test('C02 normalized observation preserves exact UTC microseconds without becoming a proof by itself',async()=>{
 const a=await api(),x={...ref(),clientId:'Client-A',asOf:'2026-10-09T12:00:00.123456Z',expiresAt:'2026-10-09T12:00:01.000Z'};
 assert.deepEqual(a.parseIdentityObservation!(x),x);
 for(const patch of [{expiresAt:x.asOf},{expiresAt:'2026-10-09T11:59:59.000Z'},{asOf:'2026-02-30T12:00:00.000Z'}, {verified:true}]){
  assert.throws(()=>a.parseIdentityObservation!({...x,...patch}),invalid);
 }
});
