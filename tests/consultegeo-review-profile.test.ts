import test from 'node:test';import assert from 'node:assert/strict';
import {consulteGeoConfigurationFixture} from './helpers/consultegeo-configuration-fixture.ts';
import {createConsulteGeoConfigurationAdministration} from '../src/application/consultegeo-configuration.ts';
import {createConsulteGeoConfigurationDraft} from '../src/integrations/consultegeo/configuration.ts';
import {mapConsulteGeoIntakeProfile} from '../src/application/consultegeo-intake-profile.ts';
import {requestHash} from '../src/domain/canonical.ts';
const product='00000000-0000-4000-8000-000000000820';
async function fixture(version=2){
 const f=consulteGeoConfigurationFixture(),service=createConsulteGeoConfigurationAdministration({store:f.store,clock:f.clock});
 const definition=createConsulteGeoConfigurationDraft('user_access','00000000-0000-4000-8000-000000000811',1,{startDate:'2026-10-09',endDate:'2027-10-09',holidays:[]});
 await f.withProof((p,proof)=>service.execute(p,proof,{action:'save',definition,expectedRevision:1,expectedEntityRevision:0,reason:'Owned review profile qualification'},'review-profile-save-0001'));
 let published=await f.withProof((p,proof)=>service.execute(p,proof,{action:'publish',id:definition.id,version:1,expectedRevision:2,expectedEntityRevision:1,reason:'Owned original profile publication'},'review-profile-publish-01'));
 if(version===2){
  await f.withProof((p,proof)=>service.execute(p,proof,{action:'restore',id:definition.id,version:1,expectedRevision:3,expectedEntityRevision:2,reason:'New immutable version for approval policy'},'review-profile-restore-02'));
  published=await f.withProof((p,proof)=>service.execute(p,proof,{action:'publish',id:definition.id,version:2,expectedRevision:4,expectedEntityRevision:1,reason:'Owned review profile publication'},'review-profile-publish-02'));
 }
 const record=published.record,entry=record.artifacts!.entries[0]!;
 const review={formId:entry.form.id,formVersion:version,profileVersionId:entry.workflow.versionId,schemaHash:requestHash(entry.form),configurationHash:record.contentHash,policyVersionId:'cg_initial_approval_v1',policyHash:'1'.repeat(64),approvalRequired:true};
 return {entry,record,review,raw:{record,productInstanceId:product,serviceCode:'user_access',review}};
}
test('a separately published v2 form with pinned approval policy opens in triage with approval pending',async()=>{
 const f=await fixture(),result=mapConsulteGeoIntakeProfile(f.raw,f.entry.form.id,2);
 assert.equal(result.approvalRequired,true);assert.equal(result.initialState,'triage');assert.equal(result.profileVersionId,f.entry.workflow.versionId);
 assert.equal(result.form.version,2);assert.equal(Object.isFrozen(result),true);
});
test('a review descriptor cannot reinterpret a historical v1 published form',async()=>{
 const f=await fixture(1);assert.throws(()=>mapConsulteGeoIntakeProfile(f.raw,f.entry.form.id,1),{code:'form_schema_changed'});
});
test('review descriptor pins the exact published configuration, schema and workflow rather than browser hints',async()=>{
 const f=await fixture();
 for(const patch of [{formId:product},{formVersion:3},{profileVersionId:'foreign-profile'},{schemaHash:'2'.repeat(64)},{configurationHash:'3'.repeat(64)},{policyVersionId:''},{policyHash:'malformed'},{approvalRequired:false},{selfApprovalAllowed:true}])
  assert.throws(()=>mapConsulteGeoIntakeProfile({...f.raw,review:{...f.review,...patch}},f.entry.form.id,2),{code:'form_schema_changed'});
});
test('an absent review descriptor preserves the exact legacy profile for the same immutable published form',async()=>{
 const f=await fixture(),{review,...raw}=f.raw,result=mapConsulteGeoIntakeProfile(raw,f.entry.form.id,2);
 assert.equal(result.approvalRequired,false);assert.equal(result.initialState,'new');assert.equal(result.workflow.versionId,f.entry.workflow.versionId);
 for(const reviewValue of [null,{},[],true])assert.throws(()=>mapConsulteGeoIntakeProfile({...raw,review:reviewValue},f.entry.form.id,2),{code:'form_schema_changed'});
});
