import {createHash} from 'node:crypto';
import {copyFormData,freezeFormData,assertFormPublishable,type FormRegistry} from '../../../shared/form-rules.js';
import {formRecord,parseFormVersion,type FormVersion,type FormField} from '../../domain/form-schema.ts';
import {parseExecutionChecklistTemplate,type ExecutionChecklistTemplate} from '../../domain/execution-checklist.ts';
import {createBusinessCalendar,type BusinessCalendarVersion} from '../../domain/business-calendar.ts';
import type {SupportWorkflowProfile} from '../../domain/support-workflow.ts';
import {uuidIdentifier} from '../../domain/input-values.ts';
import {requestHash} from '../../domain/canonical.ts';
import {HelpdeskError} from '../../domain/errors.ts';
import {consulteGeoServicePolicy,CONSULTE_GEO_POLICY,type ConsulteGeoService,type ConsulteGeoPriority} from './service-policy.ts';
export const CONSULTE_CONFIGURATION_FIELD_TYPES=Object.freeze(['text','textarea','boolean','select','lookup','file','info','download']);
export type ConsulteGeoCalendar=Readonly<{startDate:string;endDate:string;holidays:readonly string[]}>;
export type ConsulteGeoConfigurationEntry=Readonly<{action:string;priority:ConsulteGeoPriority;form:FormVersion;checklist:ExecutionChecklistTemplate;reopenDays:number;firstResponseHours:number;resolutionHours:number}>;
export type ConsulteGeoConfiguration=Readonly<{schema:1;product:'CONSULTE_GEO';id:string;version:number;service:ConsulteGeoService;title:string;calendar:ConsulteGeoCalendar;entries:readonly ConsulteGeoConfigurationEntry[]}>;
export type ConsulteGeoArtifacts=Readonly<{calendar:BusinessCalendarVersion;entries:readonly Readonly<{action:string;priority:ConsulteGeoPriority;form:FormVersion;checklist:ExecutionChecklistTemplate;workflow:SupportWorkflowProfile;sla:Readonly<{firstResponseMicros:string;resolutionMicros:string;calendarVersionId:string;pauseSolutionStates:readonly ['waiting_customer']}>}>[];attachmentsPolicy:typeof CONSULTE_GEO_POLICY.implementationSpreadsheets|null}>;
export const configurationFailure=(code='invalid_consultegeo_configuration',status=400)=>new HelpdeskError(status,code,'Não foi possível validar a configuração Consulte GEO.');
const number=(x:unknown,min:number,max:number)=>{if(!Number.isSafeInteger(x)||Number(x)<min||Number(x)>max)throw configurationFailure();return x as number;};
const text=(x:unknown,max:number)=>{if(typeof x!=='string'||!x.trim()||x.length>max||/[\p{Cc}\p{Cs}]/u.test(x))throw configurationFailure();return x;};
export function consulteGeoConfigurationActions(service:ConsulteGeoService):readonly Readonly<{action:string;priority:ConsulteGeoPriority}>[]{
 if(service==='user_access')return CONSULTE_GEO_POLICY.userActions.map(action=>({action,priority:'normal' as const}));
 if(service==='problem')return (['urgent','high','normal','low'] as const).map(priority=>({action:'request',priority}));
 if(!['questions','backup','new_work','structure_adjustment'].includes(service))throw configurationFailure();return [{action:'request',priority:'normal'}];
}
export function consulteGeoFormId(id:string,action:string,priority:string):string{
 const h=createHash('sha256').update(id+':'+action+':'+priority).digest('hex');return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);
}
function date(x:unknown):string{if(typeof x!=='string'||!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(x)||new Date(x+'T00:00:00Z').toISOString().slice(0,10)!==x)throw configurationFailure();return x;}
export function parseConsulteGeoConfiguration(raw:unknown):ConsulteGeoConfiguration{try{
 const d=formRecord(raw,['schema','product','id','version','service','title','calendar','entries']);if(d.schema!==1||d.product!=='CONSULTE_GEO')throw configurationFailure();
 const id=uuidIdentifier(d.id),version=number(d.version,1,2147483647),service=d.service as ConsulteGeoService,expected=consulteGeoConfigurationActions(service),title=text(d.title,200);
 const c=formRecord(d.calendar,['startDate','endDate','holidays']),startDate=date(c.startDate),endDate=date(c.endDate),days=(Date.parse(endDate)-Date.parse(startDate))/86400000;
 if(days<1||days>366||!Array.isArray(c.holidays)||c.holidays.length>366)throw configurationFailure();const holidays=c.holidays.map(date);
 if(new Set(holidays).size!==holidays.length||holidays.some(h=>h<startDate||h>=endDate)||!Array.isArray(d.entries)||d.entries.length!==expected.length)throw configurationFailure();
 const entries=d.entries.map((raw,i)=>{const e=formRecord(raw,['action','priority','form','checklist','reopenDays','firstResponseHours','resolutionHours']);
  if(e.action!==expected[i]!.action||e.priority!==expected[i]!.priority)throw configurationFailure();const form=parseFormVersion(e.form),checklist=parseExecutionChecklistTemplate(e.checklist),formId=consulteGeoFormId(id,e.action as string,e.priority as string);
  if(form.id!==formId||form.version!==version||form.status!=='draft'||form.fields.some(f=>!CONSULTE_CONFIGURATION_FIELD_TYPES.includes(f.type))||checklist.id!=='cg-exec-'+formId||checklist.version!==version||checklist.status!=='draft'||!checklist.items.some(x=>x.required&&x.evidenceRequired))throw configurationFailure();
  const firstResponseHours=number(e.firstResponseHours,1,2000),resolutionHours=number(e.resolutionHours,1,2000);if(firstResponseHours>resolutionHours)throw configurationFailure();
  const implementation=['new_work','structure_adjustment'].includes(service);if(implementation&&!form.fields.some(f=>f.type==='file'&&f.required&&f.public&&!f.when))throw configurationFailure();
  return {action:e.action as string,priority:e.priority as ConsulteGeoPriority,form,checklist,reopenDays:number(e.reopenDays,0,30),firstResponseHours,resolutionHours};
 });
 return freezeFormData({schema:1,product:'CONSULTE_GEO',id,version,service,title,calendar:{startDate,endDate,holidays},entries}) as ConsulteGeoConfiguration;
}catch{throw configurationFailure();}}
const formatter=new Intl.DateTimeFormat('en-GB',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const parts=(ms:number)=>Object.fromEntries(formatter.formatToParts(new Date(ms)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
/** Round-trip local time and reject ambiguous/nonexistent instants; no fixed offset. */
function localInstant(day:string,hour:number):string{
 const target=Date.parse(day+'T'+String(hour).padStart(2,'0')+':00:00Z'),candidates=new Set<number>();
 for(const delta of [-86400000,0,86400000]){const probe=target+delta,p=parts(probe),offset=Date.parse(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second+'Z')-probe,at=target-offset,q=parts(at);if(q.year+'-'+q.month+'-'+q.day===day&&Number(q.hour)===hour&&q.minute==='00'&&q.second==='00')candidates.add(at);}
 if(candidates.size!==1)throw configurationFailure();return new Date([...candidates][0]!).toISOString().replace('.000Z','.000000Z');
}
export function compileConsulteGeoConfiguration(raw:unknown,registry:FormRegistry):ConsulteGeoArtifacts{const d=parseConsulteGeoConfiguration(raw);try{
 const versionId='cg_'+d.id.replaceAll('-','_')+'_'+d.version,intervals:[string,string][]=[];
 for(let at=Date.parse(d.calendar.startDate);at<Date.parse(d.calendar.endDate);at+=86400000){const day=new Date(at).toISOString().slice(0,10),weekday=new Date(at).getUTCDay();if(weekday>=1&&weekday<=5&&!d.calendar.holidays.includes(day))intervals.push([localInstant(day,8),localInstant(day,18)]);}
 const calendar=createBusinessCalendar({versionId,timeZone:'America/Sao_Paulo',from:localInstant(d.calendar.startDate,0),until:localInstant(d.calendar.endDate,0),intervals}).version;
 const entries=d.entries.map(e=>{assertFormPublishable(e.form,registry);const form=parseFormVersion({...e.form,status:'published'}),checklist=parseExecutionChecklistTemplate({...e.checklist,status:'published'}),reference={id:checklist.id,version:checklist.version,sha256:requestHash(checklist)};
  return {action:e.action,priority:e.priority,form,checklist,workflow:{versionId:'cg-wf-'+form.id+'-v'+d.version,status:'published' as const,reopenWindowMicros:String(BigInt(e.reopenDays)*86400000000n),executionChecklist:reference},sla:{firstResponseMicros:String(BigInt(e.firstResponseHours)*3600000000n),resolutionMicros:String(BigInt(e.resolutionHours)*3600000000n),calendarVersionId:versionId,pauseSolutionStates:['waiting_customer'] as const}};
 });return freezeFormData({calendar,entries,attachmentsPolicy:['new_work','structure_adjustment'].includes(d.service)?CONSULTE_GEO_POLICY.implementationSpreadsheets:null});
}catch{throw configurationFailure('consultegeo_configuration_not_publishable',409);}}
export function createConsulteGeoConfigurationDraft(service:ConsulteGeoService,id:string,version:number,calendar:ConsulteGeoCalendar):ConsulteGeoConfiguration{
 uuidIdentifier(id);const titles={user_access:'Acesso de usuário',questions:'Dúvidas',backup:'Solicitação de backup',new_work:'Implantação de nova obra',structure_adjustment:'Ajuste de estrutura',problem:'Relatar problema'};
 const field=(key:string,type:FormField['type'],label:string,config:Record<string,unknown>,required=true):FormField=>({key,type,label,config,required,public:true});
 const entries=consulteGeoConfigurationActions(service).map(({action,priority})=>{
  const formId=consulteGeoFormId(id,action,priority),policy=consulteGeoServicePolicy(service,priority),user=service==='user_access';
  const fields:FormField[]=[field('orientation','info','Orientação',{text:user?'A equipe executará a ação no GEO após conferir identidade, grupo e todas as obras autorizadas.':'Descreva a solicitação e selecione somente as obras autorizadas no contexto do portal.'},false)];
  if(user){if(action==='include')fields.push(field('person_name','text','Nome completo da pessoa',{maxLength:160}),field('person_email','text','E-mail para o acesso',{maxLength:254}));else fields.push(field('beneficiary','lookup','Pessoa no Consulte GEO',{resolver:'consultegeo_people'}));
   if(['include','change','grant_work_access'].includes(action))fields.push(field('requested_group','text','Grupo e permissões solicitadas',{maxLength:500}));
   if(action==='disable')fields.push(field('confirmed','boolean','Confirme a solicitação de desativação',{}));
  }
  fields.push(field('details','textarea','Descrição e informações para atendimento',{maxLength:12000}));
  if(['new_work','structure_adjustment'].includes(service))fields.push(field('spreadsheets','file','Planilha de implantação XLSX ou CSV',{maxItems:3}));
  const checklist:ExecutionChecklistTemplate={schema:1,id:'cg-exec-'+formId,version,status:'draft',items:[{id:'scope',label:'Conferir ação, beneficiário e conjunto completo de obras autorizadas.',required:true,allowNotApplicable:false,evidenceRequired:true,risk:action==='disable'?'sensitive':'ordinary'},{id:'execution',label:'Registrar a execução manual na origem e a evidência correspondente.',required:true,allowNotApplicable:false,evidenceRequired:true,risk:'ordinary'},{id:'review',label:'Conferir o resultado e registrar a devolutiva pública.',required:true,allowNotApplicable:false,evidenceRequired:true,risk:'ordinary'}]};
  return {action,priority,form:{id:formId,version,status:'draft' as const,title:titles[service]+' · '+action,fields},checklist,reopenDays:7,firstResponseHours:policy.sla.firstResponseHours,resolutionHours:policy.sla.resolutionHours};
 });return parseConsulteGeoConfiguration({schema:1,product:'CONSULTE_GEO',id,version,service,title:titles[service],calendar:copyFormData(calendar),entries});
}
