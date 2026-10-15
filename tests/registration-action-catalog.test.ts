import test from 'node:test';import assert from 'node:assert/strict';
import {getRegistrationAction, listRegistrationActions, parseGrantWorkPayload, registrationActionDisposition} from '../src/domain/registration-action-catalog.ts';
import {registrationHash} from '../src/domain/registration-canonical.ts';
const key='geo.user.grant_work.v1';
test('A05 registry has exactly one pilot action, non-executable',()=>{
 const all=listRegistrationActions();assert.equal(all.length,1);assert.equal(all[0]?.actionKey,key);
 assert.equal(all[0]?.liveExecutionAllowed,false);assert.equal(all[0]?.status,'candidate');assert.ok(Object.isFrozen(all));
});
test('X03 published support category never enables an action implicitly',()=>{
 for(const input of ['user_access','create','geo.user.create_standard.v1','SQL','__proto__','constructor','',null,{},key+' ']){
  assert.equal(registrationActionDisposition(input).mode,'manual');
  assert.throws(()=>getRegistrationAction(input));
 }
 assert.equal(registrationActionDisposition(key).mode,'analysis_candidate');
 assert.equal(registrationActionDisposition(key).executionAllowed,false);
});
test('catalog schema hash is deterministic and all metadata immutable',()=>{
 const def=getRegistrationAction(key);assert.equal(def.schemaHash,registrationHash(def.schema));
 assert.ok(Object.isFrozen(def.schema));assert.ok(Object.isFrozen(def.effects));
 assert.deepEqual(def.effects,{addWorkLink:true,preserveExistingLinks:true,changeProfile:false,sendInvitation:false});
});
test('E08 pilot payload can only add, preserving existing links',()=>{
 assert.deepEqual(parseGrantWorkPayload({kind:'add_work_link',preserveExistingLinks:true}),{kind:'add_work_link',preserveExistingLinks:true});
 for(const payload of [{},{kind:'replace'},{kind:'add_work_link',preserveExistingLinks:false},{kind:'add_work_link',preserveExistingLinks:true,role:'Admin'},{kind:'add_work_link',preserveExistingLinks:true,sourceWorkKey:'other'},{kind:'add_work_link',preserveExistingLinks:true,sql:'private-secret'}])assert.throws(()=>parseGrantWorkPayload(payload));
});
