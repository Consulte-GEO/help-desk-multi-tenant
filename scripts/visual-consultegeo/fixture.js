/* TEST ONLY: real UI + real adapters; identity and server replies are synthetic. */
import {mountConsulteGeoRequest} from '../../web/consultegeo-request.js';
import {mountConsulteGeoConfigurationEditor} from '../../web/consultegeo-configuration.js';
import {createConsulteGeoIntakeApi} from '../../web/consultegeo-intake-api.js';
import {createHumanSession} from '../../web/human-session.js';
import {createSessionFetch} from '../../web/session-fetch.js';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const actionLabels=[['include','Incluir usuário'],['change','Alterar usuário'],['disable','Desativar usuário'],['resend_access','Reenviar acesso'],['grant_work_access','Liberar em nova obra']];
const fields=[{key:'nome',type:'text',label:'Nome do colaborador',required:true,public:true,config:{maxLength:100}},{key:'email',type:'text',label:'E-mail de contato',required:true,public:true,config:{maxLength:200}},{key:'grupo',type:'select',label:'Grupo solicitado',required:true,public:true,config:{options:[{value:'consulta',label:'Consulta (exemplo da bancada)'},{value:'gestao',label:'Gestão (exemplo da bancada)'}]}}];
const config={schema:1,product:'CONSULTE_GEO',id:id(1),version:1,contentHash:'a'.repeat(64),service:'user_access',title:'Acesso ao Novo Consulte GEO',entries:actionLabels.map(([action,label],i)=>({action,label,priority:'normal',form:{id:id(10+i),version:1,status:'published',title:label,fields},serviceWindow:{firstResponseHours:2,resolutionHours:8,reopenDays:5,timeZone:'America/Sao_Paulo'}}))};
const context={workspaceId:id(1),principalId:id(2),accountId:id(3),coverageId:id(9),refs:[{connectionId:id(4),tenantId:'tenant-ficticio',type:'work',id:'obra-ficticia'}]};
const initialDefinition={schema:1,product:'CONSULTE_GEO',id:id(1),version:1,service:'user_access',title:'Política de atendimento — Acesso de usuários',calendar:{holidays:[],startDate:'2026-01-01',endDate:'2026-12-31'},entries:config.entries.map(e=>({action:e.action,priority:e.priority,firstResponseHours:2,resolutionHours:8,reopenDays:5,form:e.form,checklist:{items:[{label:'Conferir vínculo com a obra antes de executar',required:true,risk:'ordinary'},{label:'Registrar a devolutiva no chamado',required:true,risk:'ordinary'}]}}))};
const syntheticTime='2026-10-13T23:00:00.000Z';
export async function setupFixture(root){
 const control={calls:[],effects:new Map(),delay:null,release:null,lose:false,rejectReplay:false,editorOutcome:'confirmed',editorCalls:[],kind:null,panel:null};
 const drafts=new Map();
 const session=createHumanSession({signIn:async()=>({accessToken:'fixture.token.value',refreshToken:'fixture-refresh',expiresAt:Date.now()+3600000,userId:id(2)}),signOut:async()=>{} });
 await session.signIn({email:'teste@example.invalid',password:'ficticia',workspace:id(1)});
 const fetcher=async(path,init)=>{
  const body=JSON.parse(init.body),record={path,method:init.method,body,key:new Headers(init.headers).get('idempotency-key')};control.calls.push(record);
  if(control.delay&&path.endsWith(control.delay))await new Promise(resolve=>control.release=resolve);
  if(path.startsWith('/v1/form-drafts/')){drafts.set(body.id,body);const revision=Number(new Headers(init.headers).get('if-match').replaceAll('"',''))+1;return Response.json({...body,revision,expiresAt:'2027-01-01T00:00:00.000Z',status:'editing',ticketId:null},{headers:{etag:`"${revision}"`}});}
  if(path==='/v1/support-requests/preview')return Response.json({valid:true,commitAuthorized:false,draftId:body.draftId,draftRevision:body.expectedDraftRevision,previewHash:'a'.repeat(64),subject:body.subject,priority:'normal',clocks:{},attachmentCount:0});
  if(path==='/v1/support-requests'){
   const replayed=control.effects.has(record.key),d=drafts.get(body.draftId);
   if(replayed&&control.rejectReplay){control.rejectReplay=false;return Response.json({status:403,code:'draft_forbidden'},{status:403});}
   const receipt={ticketId:id(50),protocol:'CG-10001',sequence:'10001',workspaceId:context.workspaceId,accountId:context.accountId,actorId:context.principalId,requesterId:context.principalId,draftId:d.id,draftRevision:body.expectedDraftRevision,version:1,profileVersionId:'cg-wf-'+d.formId+'-v'+d.formVersion,formId:d.formId,formVersion:d.formVersion,priority:'normal',createdAt:syntheticTime,notification:'pending',replayed};
   control.effects.set(record.key,receipt);
   if(control.lose){control.lose=false;throw Error('Synthetic ACK loss');}
   return Response.json(receipt,{status:replayed?200:201,headers:{etag:'"1"',location:'/v1/tickets/'+id(50),'idempotency-replayed':String(replayed)}});
  }
  throw Error('Unexpected fixture path: '+path);
 };
 const request=createSessionFetch(session,fetcher);
 control.mount=kind=>{control.panel?.destroy();control.kind=kind;
  if(kind==='request')control.panel=mountConsulteGeoRequest(root,{configuration:config,context,createApi:(draft,e,c)=>createConsulteGeoIntakeApi({context:c,draft,profileVersionId:'cg-wf-'+draft.formId+'-v'+draft.formVersion,request})});
  else control.panel=mountConsulteGeoConfigurationEditor(root,{definition:initialDefinition,revision:4,entityRevision:1,status:'draft',submit:async(intent)=>{control.editorCalls.push(structuredClone(intent));return {state:control.editorOutcome};}});
 };
 control.mount('request');window.UX10=control;return control;
}
