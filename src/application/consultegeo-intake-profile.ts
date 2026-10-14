import {parseConsulteGeoConfigurationRecord} from './consultegeo-configuration.ts';import type {IntakeProfile} from './support-intake.ts';
import {freezeFormData} from '../../shared/form-rules.js';import {uuidIdentifier} from '../domain/input-values.ts';import {formRecord,formRevision} from '../domain/form-schema.ts';import {intakeFailure} from './intake-context.ts';
/** Mapping of a PRIVATE already authorized SQL result. Product comes from the
 * resource connection; family service must exist in core coverage. No name/email mapping. */
export function mapConsulteGeoIntakeProfile(raw:unknown,formId:string,version:number):IntakeProfile{try{
 const x=formRecord(raw,['record','productInstanceId','serviceCode']),r=parseConsulteGeoConfigurationRecord(x.record);uuidIdentifier(formId);formRevision(version);
 const e=r.artifacts?.entries.find(e=>e.form.id===formId&&e.form.version===version);
 if(r.status!=='published'||!e||x.serviceCode!==r.definition.service)throw Error();
 return freezeFormData({status:'published',form:e.form,productInstanceId:uuidIdentifier(x.productInstanceId),serviceCode:r.definition.service,profileVersionId:e.workflow.versionId,workflow:e.workflow,fixedPriority:e.priority,impactField:'',priorityPolicy:null,initialState:'new',approvalRequired:false,sla:{versionId:'cg-sla-'+e.form.id+'-v'+version,status:'published',profileVersionId:e.workflow.versionId,calendar:r.artifacts!.calendar,firstResponseMicros:e.sla.firstResponseMicros,solutionMicros:e.sla.resolutionMicros,startStates:['new','triage','open'],pausedSolutionStates:e.sla.pauseSolutionStates}}) as IntakeProfile;
 }catch{throw intakeFailure('form_schema_changed',409);}}
