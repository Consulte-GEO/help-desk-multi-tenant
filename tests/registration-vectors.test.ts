import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {canonicalRegistrationJson,registrationHash,parseRegistrationJson} from '../src/domain/registration-canonical.ts';
const vectors=JSON.parse(readFileSync(new URL('./fixtures/registration/canonical-vectors.v1.json',import.meta.url),'utf8'));
for(const v of vectors.valid)test('X01 fixed canonical vector '+v.id,()=>{
 const canonical=canonicalRegistrationJson(v.input);assert.equal(canonical,v.canonical);assert.equal(Buffer.from(canonical,'utf8').toString('hex'),v.utf8Hex);assert.equal(registrationHash(v.input),v.sha256);
});
for(const v of vectors.invalid)test('X01 invalid canonical vector '+v.id,()=>assert.throws(()=>parseRegistrationJson(v.raw)));
test('vector fixture does not claim .NET execution',()=>assert.equal(vectors.dotnetVerified,false));
