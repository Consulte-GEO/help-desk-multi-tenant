import {parseConsulteGeoConfigurationRecord} from './consultegeo-configuration.ts';
import {parseConsulteGeoCustomerConfiguration,CONSULTE_GEO_ACTION_LABELS} from '../../shared/consultegeo-request.js';
import {copyFormData} from '../../shared/form-rules.js';
import {configurationFailure} from '../integrations/consultegeo/configuration.ts';
/** PURE projection of an already authorized server record. No HTTP mount or reader.
 * Never send the private M04 record to a customer and redact it in the browser. */
export function projectConsulteGeoCustomerConfiguration(raw:unknown){
 const r=parseConsulteGeoConfigurationRecord(raw);
 if(r.status!=='published')throw configurationFailure('consultegeo_configuration_not_publishable',409);
 return parseConsulteGeoCustomerConfiguration({schema:1,product:'CONSULTE_GEO',id:r.id,version:r.version,contentHash:r.contentHash,service:r.definition.service,title:r.definition.title,entries:r.artifacts!.entries.map((e,i)=>{
  const window=r.definition.entries[i]!;
  return {action:e.action,priority:e.priority,label:CONSULTE_GEO_ACTION_LABELS[e.action],form:{...copyFormData(e.form) as object,fields:e.form.fields.filter(f=>f.public)},serviceWindow:{firstResponseHours:window.firstResponseHours,resolutionHours:window.resolutionHours,reopenDays:window.reopenDays,timeZone:'America/Sao_Paulo'}};
 })});
}
