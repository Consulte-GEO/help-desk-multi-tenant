import source from '../../../profiles/consultegeo/operational-policy.v1.json' with {type:'json'};
import {freezeFormData} from '../../../shared/form-rules.js';
import {HelpdeskError} from '../../domain/errors.ts';
export const CONSULTE_GEO_POLICY=freezeFormData(source);
export type ConsulteGeoService='user_access'|'questions'|'backup'|'new_work'|'structure_adjustment'|'problem';
export type ConsulteGeoPriority='low'|'normal'|'high'|'urgent';
/** Product defaults prepared for the existing publisher; not a grant or an installed calendar. */
export function consulteGeoServicePolicy(service:ConsulteGeoService,priority:ConsulteGeoPriority){
 if(!Object.hasOwn(CONSULTE_GEO_POLICY.services,service)||!['low','normal','high','urgent'].includes(priority))throw new HelpdeskError(400,'invalid_consultegeo_policy','Serviço ou prioridade de atendimento inválidos.');
 const sla=service==='problem'?CONSULTE_GEO_POLICY.services.problem[priority]:CONSULTE_GEO_POLICY.services[service];
 return freezeFormData({product:'CONSULTE_GEO',policyVersion:1,service,priority,sla,calendar:CONSULTE_GEO_POLICY.calendar,reopenWindowMicros:CONSULTE_GEO_POLICY.reopenWindowMicros});
}
/** Extension/MIME/size admission only; storage inspection and malware scan remain mandatory. */
export function isConsulteGeoImplementationSpreadsheet(name:string,mime:string,bytes:number):boolean{
 if(typeof name!=='string'||name.length>255||/[\p{Cc}\p{Cs}\\/]/u.test(name)||typeof mime!=='string'||!Number.isSafeInteger(bytes)||bytes<1||bytes>CONSULTE_GEO_POLICY.implementationSpreadsheets.maxBytes)return false;
 const ext=/\.[^.]+$/.exec(name)?.[0].toLowerCase();
 return ext==='.xlsx'&&mime==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'||ext==='.csv'&&mime==='text/csv';
}
