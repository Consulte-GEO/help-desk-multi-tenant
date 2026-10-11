import {copyFormData,freezeFormData,parseFormVersion,assertFormPublishable,FORM_TYPES,type FormVersion,type FormRegistry,type FormField} from '../../shared/form-rules.js';
import {requestHash} from './canonical.ts';
import {uuidIdentifier} from './input-values.ts';
import {HelpdeskError} from './errors.ts';
import {externalResourceKey} from './external-resource.ts';
import {parseReleaseManifest,releaseManifestHash,releaseRecord,releaseReference,releaseDigest,releaseInteger,RELEASE_FEATURES,type PilotCohort,type ReleaseFeature} from './release-manifest.ts';

/** Internal normalized taxonomy, not the API contract or approval of the source. */
export type ExpansionDefinition=Readonly<{categoryId:string;channelId:string;critical:boolean;requiredFields:readonly Readonly<{key:string;type:string}>[];requiredFeatures:readonly ReleaseFeature[]}>;
export type ExpansionContract=Readonly<{schema:1;system:'NOVO_GEO';profileId:string;revision:string;sourceRef:string;definitions:readonly ExpansionDefinition[]}>;
export type ProfileExpansion=Readonly<{schema:1;id:string;profileId:string;previousVersion:number;nextVersion:number;contractHash:string;forms:readonly Readonly<{categoryId:string;channelId:string;form:FormVersion}>[]}>;
export type ExpansionReport=Readonly<{state:'blocked'|'ready_for_attested_review';operational:false;proposalHash:string;contractHash:string;previousManifestHash:string;targetManifestHash:string;policySetDigest:string;addedCohortIds:readonly string[];blockers:readonly Readonly<{code:string;categoryId?:string;channelId?:string}>[]}>;
const invalid=()=>new HelpdeskError(400,'profile_expansion_invalid','Proposta de expansão inválida. Nenhum escopo foi liberado.');
const pair=(a:{categoryId:string;channelId:string})=>JSON.stringify([a.categoryId,a.channelId]);
function list(raw:unknown,max:number,min=0):unknown[]{if(!Array.isArray(raw)||raw.length<min||raw.length>max)throw invalid();return raw;}
export function parseExpansionContract(raw:unknown):ExpansionContract{try{
 const r=releaseRecord(raw,['schema','system','profileId','revision','sourceRef','definitions']);if(r.schema!==1||r.system!=='NOVO_GEO')throw invalid();
 releaseReference(r.profileId,80);releaseReference(r.revision);releaseReference(r.sourceRef);
 const definitions=list(r.definitions,64).map(x=>{
  const d=releaseRecord(x,['categoryId','channelId','critical','requiredFields','requiredFeatures']);releaseReference(d.categoryId,80);releaseReference(d.channelId,80);if(typeof d.critical!=='boolean')throw invalid();
  d.requiredFields=list(d.requiredFields,100).map(f=>{const a=releaseRecord(f,['key','type']);releaseReference(a.key,64);if(!FORM_TYPES.includes(a.type as never)||['info','download'].includes(a.type as string))throw invalid();return a;});
  if(new Set((d.requiredFields as {key:string}[]).map(f=>f.key)).size!==(d.requiredFields as unknown[]).length)throw invalid();
  const fs=list(d.requiredFeatures,RELEASE_FEATURES.length,1);if(!fs.includes('core')||new Set(fs).size!==fs.length||fs.some(f=>!RELEASE_FEATURES.includes(f as ReleaseFeature)))throw invalid();
  return d as unknown as ExpansionDefinition;
 });if(new Set(definitions.map(pair)).size!==definitions.length)throw invalid();r.definitions=definitions;
 return freezeFormData(r) as unknown as ExpansionContract;
}catch{throw invalid();}}
export function parseProfileExpansion(raw:unknown):ProfileExpansion{try{
 const r=releaseRecord(raw,['schema','id','profileId','previousVersion','nextVersion','contractHash','forms']);if(r.schema!==1)throw invalid();r.id=uuidIdentifier(r.id);releaseReference(r.profileId,80);releaseInteger(r.previousVersion,1);releaseInteger(r.nextVersion,1);releaseDigest(r.contractHash);
 const forms=list(r.forms,64,1).map(x=>{const f=releaseRecord(x,['categoryId','channelId','form']);releaseReference(f.categoryId,80);releaseReference(f.channelId,80);f.form=parseFormVersion(f.form);return f as unknown as ProfileExpansion['forms'][number];});
 if(new Set(forms.map(pair)).size!==forms.length)throw invalid();r.forms=forms;return freezeFormData(r) as unknown as ProfileExpansion;
}catch{throw invalid();}}
/** Bind the new policy set to its parent and to ALL reviewed fields/requirements.
 * This recipe must be adopted by the trusted release producer, not copied from a request. */
export function expansionPolicyDigest(previous:unknown,proposal:unknown,contract:unknown):string{
 try{return requestHash(['helpdesk-profile-expansion-policy-v1',releaseManifestHash(previous),parseProfileExpansion(proposal),parseExpansionContract(contract)]);}catch{throw invalid();}
}
function flat(fields:readonly FormField[]):readonly FormField[]{return fields.flatMap(f=>[f,...(['repeater','table_paste'].includes(f.type)?flat(f.config.fields as readonly FormField[]):[])]);}
function overlap(a:PilotCohort,b:PilotCohort):boolean{
 return pair(a)===pair(b)&&a.workspaceId===b.workspaceId&&a.accountId===b.accountId&&a.productInstanceId===b.productInstanceId&&a.personIds.some(p=>b.personIds.includes(p))&&a.refs.some(r=>b.refs.some(v=>externalResourceKey(r)===externalResourceKey(v)));
}
/** Pure diagnostics. No store, side effects, route or publishable authorization proof. */
export function evaluateProfileExpansion(proposal:unknown,contract:unknown,registry:FormRegistry,previous:unknown,target:unknown):ExpansionReport{
 try{
 const p=parseProfileExpansion(proposal),c=parseExpansionContract(contract),a=parseReleaseManifest(previous),b=parseReleaseManifest(target),reg=copyFormData(registry) as FormRegistry;
 const blockers:{code:string;categoryId?:string;channelId?:string}[]=[],add=(code:string,d?:{categoryId:string;channelId:string})=>blockers.push({code,...(d?{categoryId:d.categoryId,channelId:d.channelId}:{})});
 const h=requestHash(c),policy=expansionPolicyDigest(a,p,c);
 if(p.contractHash!==h)add('contract_hash_mismatch');if(p.profileId!==c.profileId)add('profile_contract_mismatch');
 if(p.previousVersion===Number.MAX_SAFE_INTEGER||p.nextVersion!==p.previousVersion+1)add('profile_version_not_successor');
 if(a.releaseId===b.releaseId)add('new_release_required');
 if(b.policySetDigest!==policy)add('policy_binding_mismatch');
 if(['netlifySiteId','supabaseProjectId','recoveryEpoch'].some(k=>a.identity[k as keyof typeof a.identity]!==b.identity[k as keyof typeof b.identity]))add('release_boundary_changed');
 for(const old of a.cohorts){const current=b.cohorts.find(x=>x.id===old.id);if(!current)add('existing_cohort_removed');else if(requestHash(old)!==requestHash(current))add('existing_cohort_changed');}
 const added=b.cohorts.filter(x=>!a.cohorts.some(o=>o.id===x.id));
 for(let i=0;i<b.cohorts.length;i++)for(let j=i+1;j<b.cohorts.length;j++)if(overlap(b.cohorts[i]!,b.cohorts[j]!))add('ambiguous_cohort_overlap',b.cohorts[j]);
 for(const row of added)if(!p.forms.some(f=>pair(f)===pair(row)))add('unreviewed_cohort',row);
 for(const f of p.forms){
  const d=c.definitions.find(v=>pair(v)===pair(f)),rows=added.filter(v=>pair(v)===pair(f));
  if(!rows.length)add('category_without_cohort',f);
  if(f.form.status!=='published')add('form_not_published',f);
  try{assertFormPublishable(f.form,reg);}catch{add('form_handler_unavailable',f);}
  if(!d){add('category_not_qualified',f);continue;}
  // Conservative normalized policy: a critical workflow cannot rely solely on free description.
  if(d.critical&&!d.requiredFields.some(x=>!['text','textarea','boolean'].includes(x.type)))add('critical_definition_incomplete',f);
  for(const req of d.requiredFields){const field=f.form.fields.find(x=>x.key===req.key);if(!field||field.type!==req.type||!field.required||!field.public||field.when)add('required_field_mismatch',f);}
  const needed=new Set<ReleaseFeature>(d.requiredFeatures);if(flat(f.form.fields).some(x=>x.type==='file'))needed.add('attachments');
  if(needed.has('packages'))for(const k of ['attachments','approvals','email'] as const)needed.add(k);
  for(const row of rows)if([...needed].some(x=>!row.features.includes(x)))add('cohort_feature_missing',f);
 }
 return freezeFormData({state:blockers.length?'blocked':'ready_for_attested_review',operational:false,proposalHash:requestHash(p),contractHash:h,previousManifestHash:releaseManifestHash(a),targetManifestHash:releaseManifestHash(b),policySetDigest:policy,addedCohortIds:added.map(x=>x.id).sort(),blockers}) as ExpansionReport;
 }catch{throw invalid();}
}
export function assertProfileExpansionReady(...args:Parameters<typeof evaluateProfileExpansion>):ExpansionReport{
 const report=evaluateProfileExpansion(...args);if(report.state==='blocked')throw new HelpdeskError(409,'profile_expansion_blocked','Expansão incompleta. Revise os impedimentos antes de solicitar aceite.');return report;
}
