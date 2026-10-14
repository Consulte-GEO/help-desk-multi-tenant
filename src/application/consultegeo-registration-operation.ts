import {copyFormData,freezeFormData} from '../../shared/form-rules.js';
import {formRecord,type FormField} from '../domain/form-schema.ts';
import {uuidIdentifier,isPersistableText} from '../domain/input-values.ts';
import {canonicalJson,requestHash} from '../domain/canonical.ts';
import {createConsulteGeoConfigurationDraft,parseConsulteGeoConfiguration,compileConsulteGeoConfiguration,type ConsulteGeoCalendar} from '../integrations/consultegeo/configuration.ts';
import {planConsulteGeoLocalProvisioning} from './consultegeo-local-provisioning.ts';
const failure=()=>Error('Plano de cadastros Consulte GEO inválido. Nenhuma operação foi executada.');
const text=(v:unknown,max:number)=>{if(!isPersistableText(v)||!v.trim()||v.trim()!==v||v.length>max||/[\p{Cc}\p{Cs}]/u.test(v))throw failure();return v;};
export const REGISTRATION_KINDS=Object.freeze([{value:'user',label:'Usuário'},{value:'mix',label:'Traço'},{value:'plant',label:'Usina'},{value:'laboratory',label:'Laboratório'},{value:'block',label:'Bloco de alvenaria'},{value:'ceramic',label:'Cerâmica'},{value:'cable',label:'Cabos'},{value:'supplier',label:'Fornecedor'}]);
/** Existing five-action family. Manual identifiers are declarations for support,
 * never proof of a GEO identity or an automatic permission change. */
export function createRegistrationConfiguration(id:string,calendar:ConsulteGeoCalendar){
 const base=createConsulteGeoConfigurationDraft('user_access',id,1,calendar);
 const field=(key:string,type:FormField['type'],label:string,config:Record<string,unknown>,required=true,kind?:string):FormField=>({key,type,label,config,required,public:true,...(kind?{when:{field:'registration_kind',equals:kind}}:{})});
 const input=(key:string,label:string,kind:string,required=true,maxLength=160)=>field(key,'text',label,{maxLength},required,kind);
 const entries=base.entries.map(entry=>{
  const fields:FormField[]=[field('orientation','info','Orientação',{text:'Informe os dados do cadastro para a obra selecionada. A equipe Consulte GEO confere as informações e executa a solicitação no sistema.'},false)];
  if(entry.action==='include')fields.push(field('registration_kind','select','Tipo de cadastro',{options:REGISTRATION_KINDS.map(x=>({...x}))}),
   input('person_name','Nome completo','user'),input('person_email','Email do usuário','user',true,254),input('requested_group','Perfil e permissões solicitadas','user',true,500),input('person_phone','Telefone','user',false,40),
   field('mix_type','select','Tipo de traço',{options:[{value:'concrete',label:'Traço de concreto'},{value:'grout',label:'Graute'}]},true,'mix'),input('mix_fck','FCK (MPa, ex. 30)','mix',true,40),field('mix_aggregate','select','Brita',{options:[{value:'brita_0',label:'Brita 0'},{value:'brita_1',label:'Brita 1'},{value:'brita_0_1',label:'Brita 0 e 1'},{value:'other',label:'Outra — detalhar na descrição'}]},true,'mix'),input('mix_slump','Slump (cm, ex. 12)','mix',true,40),input('mix_tolerance','Tolerância do slump (cm, ex. 2)','mix',true,40),input('mix_supplier','Usina ou fornecedor do traço','mix'),input('mix_code','Código do traço na usina','mix',false),
   input('plant_name','Nome da usina','plant'),input('plant_document','CNPJ da usina','plant',false,18),input('plant_address','Endereço da usina','plant',false,500),
   input('laboratory_name','Nome do laboratório','laboratory'),input('laboratory_document','CNPJ do laboratório','laboratory',false,18),input('laboratory_contact','Contato do laboratório','laboratory',false,254),
   input('block_name','Identificação ou modelo do bloco','block'),input('block_supplier','Fabricante ou fornecedor do bloco','block'),input('block_strength','Resistência do bloco (MPa)','block',true,40),
   input('ceramic_name','Identificação ou modelo da cerâmica','ceramic'),input('ceramic_supplier','Fabricante ou fornecedor da cerâmica','ceramic'),input('ceramic_dimensions','Dimensões da cerâmica','ceramic',false),
   input('cable_name','Identificação ou modelo do cabo','cable'),input('cable_supplier','Fabricante ou fornecedor do cabo','cable'),input('cable_diameter','Diâmetro nominal do cabo (mm)','cable',true,40),
   input('supplier_name','Razão social ou nome do fornecedor','supplier'),input('supplier_document','CNPJ ou CPF do fornecedor','supplier',true,18),input('supplier_contact','Contato do fornecedor','supplier',false,254));
  else{fields.push(field('beneficiary','text','Email ou identificação do usuário',{maxLength:254}));if(['change','grant_work_access'].includes(entry.action))fields.push(field('requested_group','text','Perfil e permissões solicitadas',{maxLength:500}));if(entry.action==='disable')fields.push(field('confirmed','boolean','Confirmo a solicitação de desativação',{}));}
  fields.push(field('details','textarea','Descrição e informações adicionais',{maxLength:12000}));
  const labels=['Conferir tipo de cadastro, dados obrigatórios, cliente e obra autorizada.','Executar a solicitação no GEO e registrar a evidência do resultado.','Conferir os dados cadastrados e registrar a devolutiva pública.'];
  return {...entry,form:{...entry.form,title:entry.action==='include'?'Novo cadastro':entry.action==='grant_work_access'?'Liberação de usuário em obra':entry.form.title,fields},checklist:{...entry.checklist,items:entry.checklist.items.map((item,i)=>({...item,label:labels[i]!}))}};
 });
 return parseConsulteGeoConfiguration({...base,title:'Cadastros e acessos',entries});
}
/** Offline operator extension; immutable local receipt binds the exact profile
 * hash, target and sponsor. No HTTP admin/MFA assurance is fabricated. */
export function planConsulteGeoRegistrationOperation(input:unknown){try{
 const x=formRecord(copyFormData(input),['workspaceId','administratorId','administratorEmail','requestId','accountId','accountName','workId','workName','productId','productInstanceId','connectionId','bindingId','contractId','contractVersionId','configurationId','coverageId','calendar','reason']);
 const ids=Object.fromEntries(['workspaceId','administratorId','requestId','accountId','productId','productInstanceId','connectionId','bindingId','contractId','contractVersionId','configurationId','coverageId'].map(k=>[k,uuidIdentifier(x[k])]));
 const email=text(x.administratorEmail,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw failure();const accountName=text(x.accountName,160),workId=text(x.workId,256),workName=text(x.workName,160),reason=text(x.reason,300),registry={types:['text','textarea','boolean','select','info'],lookups:[],files:false,downloads:[]};
 const definition=createRegistrationConfiguration(ids.configurationId!,copyFormData(x.calendar) as ConsulteGeoCalendar),artifacts=compileConsulteGeoConfiguration(definition,registry),configuration={definition,artifacts,contentHash:requestHash({definition,artifacts}),coverageId:ids.coverageId};
 const approval={schema:1,purpose:'consultegeo-registration',assurance:'operator-delegation',...ids,administratorEmail:email,accountName,workId,workName,reason,registry,configuration},approvalHash=requestHash(approval);
 const localPlan=planConsulteGeoLocalProvisioning({workspaceId:ids.workspaceId,expectedRegistryRevision:1,requestId:ids.requestId,reason:reason+' Configuração '+ids.configurationId+'/v1 SHA256 '+configuration.contentHash+' aprovação '+approvalHash,accounts:[{accountId:ids.accountId,name:accountName,productInstanceId:ids.productInstanceId,connectionId:ids.connectionId,bindingId:ids.bindingId,tenantId:ids.accountId,active:true}],works:[{accountId:ids.accountId,id:workId,name:workName,active:true}],permissions:['tickets.read','tickets.write','notes.read','notes.write'].map(operation=>({accountId:ids.accountId,principalId:ids.administratorId,role:'agent',operation,active:true,workIds:[workId]}))});
 const command={...approval,approvalHash,local:JSON.parse(localPlan.values[0]),localHash:localPlan.values[1]},json=canonicalJson(command);if(Buffer.byteLength(json)>160*1024)throw failure();return freezeFormData({executesDatabase:false as const,values:[json,requestHash(command)] as const});
}catch{throw failure();}}
