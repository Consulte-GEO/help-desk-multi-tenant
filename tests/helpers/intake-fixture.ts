import {supportIo,sid,NOW,LATER} from './support-io-fixture.ts';
export {sid,NOW,LATER};
export async function intakeFixture(){
 const path='../../src/application/support-intake.ts',dm='../../src/application/form-draft.ts';const m=await import(path).catch(()=>({})),d=await import(dm).catch(()=>({}));
 if(typeof m.createSupportIntake!=='function'||typeof d.createFormDraftService!=='function')throw Error('C10 draft and intake interfaces missing');
 const f=supportIo(()=>({drafts:new Map(),receipts:new Map(),bundles:[],sequence:10000}));
 const schema:any={id:sid(7),version:1,status:'published',title:'Synthetic',fields:[{key:'summary',type:'text',label:'Resumo',required:true,public:true,config:{maxLength:200}},{key:'impact',type:'select',label:'Impacto',required:true,public:true,config:{options:[{value:'normal',label:'Normal'},{value:'major',label:'Alto'}]}},{key:'files',type:'file',label:'Anexos',required:false,public:true,config:{maxItems:1}}]};
 const profile:any={profileVersionId:'PROFILE1',status:'published',form:schema,productInstanceId:sid(20),serviceCode:'SUPPORT',impactField:'impact',priorityPolicy:{id:'PRIORITY1',status:'published',priorities:{normal:'P3',major:'P2'}},workflow:{versionId:'PROFILE1',status:'published',reopenWindowMicros:'60000000'},initialState:'new',approvalRequired:false,sla:{versionId:'SLA1',status:'published',profileVersionId:'PROFILE1',calendar:{versionId:'CAL1',timeZone:'America/Sao_Paulo',from:'2026-10-10T00:00:00.000000Z',until:'2026-10-12T00:00:00.000000Z',intervals:[['2026-10-10T08:00:00.000000Z','2026-10-10T18:00:00.000000Z'],['2026-10-11T08:00:00.000000Z','2026-10-11T18:00:00.000000Z']]},firstResponseMicros:'60000000',solutionMicros:'600000000',startStates:['new','open'],pausedSolutionStates:['waiting_customer']}};
 const coverage:any={id:sid(30),workspaceId:sid(1),accountId:sid(3),productInstanceId:sid(20),serviceCode:'SUPPORT',contractId:sid(31),contractVersionId:sid(32),contractVersion:1,contractStatus:'active',enabled:true,published:true,validFrom:NOW,validUntil:LATER,policy:{support:'synthetic'}};
 const controls=Object.assign(f.controls,{scopeMismatch:false,receiptForeign:false,evidence:'clean',beneficiaryAllowed:true});
 const draft=()=>({id:sid(8),accountId:sid(3),refs:f.refs,formId:sid(7),formVersion:1,answers:{summary:'Relatório não concluiu',impact:'normal'}});
 const metadata={filename:'file.png',mime:'image/png',bytes:16};
 const filePolicy={id:'TEST',status:'published',maxBytes:1024,maxFiles:3,uploadTtlSeconds:120,receiptTtlSeconds:600,allowedMime:['image/png'],uploadOrigin:'https://storage.example.invalid',downloadOrigin:'https://storage.example.invalid',scanPolicyId:'TEST-SCAN'};
 const createStore=(c:any)=>({
  lockScope:async(scope:any)=>{await c.query('select current resource scope');return controls.scopeMismatch?null:scope;},
  readDraft:async(id:string)=>f.stage().drafts.get(id)??null,
  readSchema:async()=>schema,readProfile:async()=>profile,readCoverages:async()=>[coverage],
  saveDraft:async(record:any,expected:number)=>{await f.write(c);const current=f.stage().drafts.get(record.id);if((current?.revision??0)!==expected)throw Error('draft CAS');f.stage().drafts.set(record.id,structuredClone(record));},
  lockEvidence:async(q:any)=>{const binding={workspaceId:f.p.workspaceId,accountId:sid(3),ownerId:f.p.id,draftId:sid(8),draftRevision:f.stage().drafts.get(sid(8)).revision,formId:sid(7),formVersion:1,fieldPath:q.path,registryKey:q.registryKey,visibility:'customer',refs:f.refs};const object={key:'quarantine/'+sid(1)+'/'+sid(9),version:'v1',bytes:16};return {record:{id:sid(9),version:3,binding,metadata,policy:filePolicy,objectKey:object.key,object,status:controls.evidence,sha256:'a'.repeat(64),createdAt:NOW,expiresAt:LATER,scanPolicyId:'TEST-SCAN'},object};},
  lockLookup:async(q:any)=>({queryHash:q.queryHash,status:'verified' as const,expiresAt:LATER}),
  readReceipt:async(key:string)=>{const x=f.stage().receipts.get(key);return x?{...x,result:{...x.result,...(controls.receiptForeign?{actorId:sid(99)}:{})}}:null;},
  authorizeReceipt:async()=>!controls.scopeMismatch,
  allocateProtocol:async()=>{await c.query('select next protocol sequence');return String(++f.stage().sequence);},
  commitRequest:async(bundle:any,expected:number,receipt:any)=>{await f.write(c);const current=f.stage().drafts.get(bundle.draftId);if(current.revision!==expected||current.status!=='editing')throw Error('draft CAS');f.stage().bundles.push(structuredClone(bundle));f.stage().drafts.set(bundle.draftId,{...current,status:'committed',ticketId:bundle.ticket.id});f.stage().receipts.set(receipt.key,structuredClone(receipt));},
  verifyBeneficiary:async()=>controls.beneficiaryAllowed,
 });
 const directory={locateDraft:async(_p:any,id:string)=>{const row=f.current().drafts.get(id);return row?{refs:row.refs,accountId:row.accountId}:null;}};
 const options={...f,directory,createStore,clock:f.clock,draftTtlSeconds:1800};const drafts=d.createFormDraftService(options),intake=m.createSupportIntake(options);
 const input=()=>({draftId:sid(8),expectedDraftRevision:f.current().drafts.get(sid(8))?.revision??1,subject:'Falha no relatório',description:'Descrição do resultado esperado',coverageId:sid(30)});
 return {...f,schema,profile,coverage,controls,draft,drafts,intake,directory,createStore,input,save:(data=draft(),expected=0)=>drafts.saveFormDraft(f.p,data,expected),preview:()=>intake.previewSupportRequest(f.p,input()),commit:async(key='intake-intent-0001',v?:any)=>{const base=input(),prev=v??await intake.previewSupportRequest(f.p,base);return intake.createSupportRequest(f.p,{...base,previewHash:prev.previewHash},key,sid(99));}};
}
