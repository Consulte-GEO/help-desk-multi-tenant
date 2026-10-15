import {parseConsulteGeoConfigurationRecord} from './consultegeo-configuration.ts';import type {IntakeProfile} from './support-intake.ts';
import {freezeFormData} from '../../shared/form-rules.js';import {uuidIdentifier} from '../domain/input-values.ts';import {formRecord,formRevision} from '../domain/form-schema.ts';import {intakeFailure} from './intake-context.ts';
import {requestHash} from '../domain/canonical.ts';
/** Mapping of a PRIVATE already authorized SQL result. Product comes from the
 * resource connection; family service must exist in core coverage. No name/email mapping. */
export function mapConsulteGeoIntakeProfile(raw:unknown,formId:string,version:number):IntakeProfile{try{
 const hasReview=raw!==null&&typeof raw==='object'&&Object.hasOwn(raw,'review');
 const x=formRecord(raw,['record','productInstanceId','serviceCode',...(hasReview?['review']:[])]),r=parseConsulteGeoConfigurationRecord(x.record);uuidIdentifier(formId);formRevision(version);
 const e=r.artifacts?.entries.find(e=>e.form.id===formId&&e.form.version===version);
 if(r.status!=='published'||!e||x.serviceCode!==r.definition.service)throw Error();
 if(hasReview){
  const q=formRecord(x.review,['formId','formVersion','profileVersionId','schemaHash','configurationHash','policyVersionId','policyHash','approvalRequired']);
  if(version<2||q.formId!==formId||q.formVersion!==version||q.profileVersionId!==e.workflow.versionId||q.schemaHash!==requestHash(e.form)||q.configurationHash!==r.contentHash||q.approvalRequired!==true||typeof q.policyVersionId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(q.policyVersionId)||typeof q.policyHash!=='string'||!/^[a-f0-9]{64}$/.test(q.policyHash))throw Error();
 }
 return freezeFormData({status:'published',form:e.form,productInstanceId:uuidIdentifier(x.productInstanceId),serviceCode:r.definition.service,profileVersionId:e.workflow.versionId,workflow:e.workflow,fixedPriority:e.priority,impactField:'',priorityPolicy:null,initialState:hasReview?'triage':'new',approvalRequired:hasReview,sla:{versionId:'cg-sla-'+e.form.id+'-v'+version,status:'published',profileVersionId:e.workflow.versionId,calendar:r.artifacts!.calendar,firstResponseMicros:e.sla.firstResponseMicros,solutionMicros:e.sla.resolutionMicros,startStates:['new','triage','open'],pausedSolutionStates:e.sla.pauseSolutionStates}}) as IntakeProfile;
 }catch{throw intakeFailure('form_schema_changed',409);}}
