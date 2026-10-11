import test from 'node:test';
import assert from 'node:assert/strict';
import {requestHash} from '../src/domain/canonical.ts';
import {rawExpansion} from './helpers/expansion-fixture.ts';
import {manifest,cohort,u,resource} from './helpers/release-fixtures.ts';

async function api(){
 const path='../src/domain/profile-expansion.ts';
 const m=await import(path).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof m.evaluateProfileExpansion,'function','C17 expansion evaluator missing');
 assert.equal(typeof m.expansionPolicyDigest,'function','C17 policy binding missing');
 return m as typeof import('../src/domain/profile-expansion.ts');
}

async function setup(){const m=await api(),f=rawExpansion();f.after.policySetDigest=m.expansionPolicyDigest(f.before,f.proposal,f.contract);return {...f,m,evaluate:()=>m.evaluateProfileExpansion(f.proposal,f.contract,f.registry,f.before,f.after),rebind:()=>{f.proposal.contractHash=requestHash(f.contract);f.after.policySetDigest=m.expansionPolicyDigest(f.before,f.proposal,f.contract);}};}
const blocked=(r:any,code:string)=>{assert.equal(r.state,'blocked');assert.ok(r.blockers.some((x:any)=>x.code===code),JSON.stringify(r.blockers));assert.equal(r.operational,false);};

test('C17 complete additive candidate is reviewable, never operational',async()=>{const f=await setup(),r=f.evaluate();assert.equal(r.state,'ready_for_attested_review');assert.equal(r.operational,false);assert.deepEqual(r.addedCohortIds,[u(904)]);assert.match(r.proposalHash,/^[a-f0-9]{64}$/);assert.ok(Object.isFrozen(r));});
test('C17 unchanged proposal and source objects are not mutated',async()=>{const f=await setup(),before=JSON.stringify(f);f.evaluate();assert.equal(JSON.stringify(f),before);});
test('C17 published schema is bound to the policy digest, not only its displayed ID',async()=>{const f=await setup();f.proposal.forms[0].form.title='Changed without a new release';blocked(f.evaluate(),'policy_binding_mismatch');});
test('C17 a source taxonomy hash cannot be changed without rebinding',async()=>{const f=await setup();f.contract.revision='origin-r3';blocked(f.evaluate(),'contract_hash_mismatch');});
test('C17 profile versions advance exactly once and do not overflow',async()=>{const f=await setup();f.proposal.nextVersion=3;f.after.policySetDigest=f.m.expansionPolicyDigest(f.before,f.proposal,f.contract);blocked(f.evaluate(),'profile_version_not_successor');f.proposal.previousVersion=Number.MAX_SAFE_INTEGER;f.proposal.nextVersion=Number.MAX_SAFE_INTEGER;blocked(f.evaluate(),'profile_version_not_successor');});
test('C17 source profile mismatch is not an implicit cross-product approval',async()=>{const f=await setup();f.contract.profileId='ANOTHER';f.rebind();blocked(f.evaluate(),'profile_contract_mismatch');});
test('C17 published form is required; a draft cannot be announced',async()=>{const f=await setup();f.proposal.forms[0].form.status='draft';f.rebind();blocked(f.evaluate(),'form_not_published');});
test('C17 a critical subcategory cannot degrade into generic description',async()=>{const f=await setup();f.contract.definitions[0].requiredFields=[];f.proposal.forms[0].form.fields=[{key:'description',type:'textarea',label:'Description',required:true,public:true,config:{maxLength:2000}}];f.rebind();blocked(f.evaluate(),'critical_definition_incomplete');});
for(const [label,edit] of [
 ['absent',(x:any)=>{x.fields=[{key:'other',type:'text',label:'Other',required:false,public:true,config:{maxLength:100}}];}],['wrong type',(x:any)=>{x.fields[0]={key:'target',type:'text',label:'Target',required:true,public:true,config:{maxLength:100}};}],
 ['optional',(x:any)=>{x.fields[0].required=false;}],['internal only',(x:any)=>{x.fields[0].public=false;}],
 ['conditional',(x:any)=>{x.fields.unshift({key:'choose',type:'boolean',label:'Choose',required:false,public:true,config:{}});x.fields[1].when={field:'choose',equals:true};}]
] as const)test('C17 mandatory source field '+label+' blocks the category',async()=>{const f=await setup();edit(f.proposal.forms[0].form);f.rebind();blocked(f.evaluate(),'required_field_mismatch');});
test('C17 missing file provider blocks publication even with a file field',async()=>{const f=await setup();f.proposal.forms[0].form.fields.push({key:'file',type:'file',label:'Proof',required:false,public:true,config:{maxItems:1}});f.rebind();blocked(f.evaluate(),'form_handler_unavailable');});
test('C17 available file handler still requires attachment acceptance in the new cohort',async()=>{const f=await setup();f.registry.files=true;f.proposal.forms[0].form.fields.push({key:'file',type:'file',label:'Proof',required:false,public:true,config:{maxItems:1}});f.rebind();blocked(f.evaluate(),'cohort_feature_missing');});
test('C17 qualified category requiring approvals cannot omit that feature',async()=>{const f=await setup();f.contract.definitions[0].requiredFeatures.push('approvals');f.rebind();blocked(f.evaluate(),'cohort_feature_missing');});
test('C17 category absent from the source contract is not invented',async()=>{const f=await setup();f.contract.definitions=[];f.rebind();blocked(f.evaluate(),'category_not_qualified');});
test('C17 existing cohort cannot expand its people or resources in place',async()=>{const f=await setup();f.after.cohorts[0].personIds=[u(4),u(999)];blocked(f.evaluate(),'existing_cohort_changed');});
test('C17 omission of an accepted cohort is not classified as an expansion',async()=>{const f=await setup();f.after.cohorts.shift();blocked(f.evaluate(),'existing_cohort_removed');});
test('C17 overlap between new and old cohort is refused instead of creating ambiguous authorization',async()=>{const f=await setup();f.contract.definitions[0].categoryId='SYNTHETIC';f.proposal.forms[0].categoryId='SYNTHETIC';f.after.cohorts[1].categoryId='SYNTHETIC';f.rebind();blocked(f.evaluate(),'ambiguous_cohort_overlap');});
test('C17 a new cohort from an unreviewed category is blocked',async()=>{const f=await setup();f.after.cohorts.push({...cohort(),id:u(905),categoryId:'UNREVIEWED'});blocked(f.evaluate(),'unreviewed_cohort');});
test('C17 each proposed category/channel needs a distinct target cohort',async()=>{const f=await setup();f.after.cohorts.pop();blocked(f.evaluate(),'category_without_cohort');});
test('C17 another recovery generation or destination cannot piggyback on an expansion',async()=>{for(const [key,value] of [['recoveryEpoch',u(600)],['supabaseProjectId','abcdefghijklmnopqrst'],['netlifySiteId',u(600)]]){const f=await setup();f.after.identity[key!]=value;blocked(f.evaluate(),'release_boundary_changed');}});
test('C17 another deployed source is allowed only through its own new manifest/attestation',async()=>{const f=await setup();f.after.identity.sourceSha='b'.repeat(40);assert.equal(f.evaluate().state,'ready_for_attested_review');assert.notEqual(f.evaluate().previousManifestHash,f.evaluate().targetManifestHash);});
test('C17 duplicate source definitions and proposals are rejected, not first-match wins',async()=>{const f=await setup();f.contract.definitions.push(structuredClone(f.contract.definitions[0]));assert.throws(()=>f.evaluate(),{code:'profile_expansion_invalid'});const g=await setup();g.proposal.forms.push(structuredClone(g.proposal.forms[0]));assert.throws(()=>g.evaluate(),{code:'profile_expansion_invalid'});});
test('C17 getters and foreign activation fields never execute or enable anything',async()=>{const f=await setup();let calls=0;Object.defineProperty(f.proposal,'approved',{enumerable:true,get(){calls++;return true;}});assert.throws(()=>f.evaluate(),{code:'profile_expansion_invalid'});assert.equal(calls,0);});
test('C17 the blocking assertion refuses a critical incomplete proposal',async()=>{const f=await setup();f.contract.definitions[0].requiredFields=[];f.rebind();assert.throws(()=>f.m.assertProfileExpansionReady(f.proposal,f.contract,f.registry,f.before,f.after),{code:'profile_expansion_blocked',status:409});});
test('C17 tenant repeated ID cannot overlap or inherit another cohort',async()=>{const f=await setup();f.after.cohorts[1].refs=[resource('A','tenant-B')];const r=f.evaluate();assert.equal(r.state,'ready_for_attested_review');assert.equal(r.operational,false);});
