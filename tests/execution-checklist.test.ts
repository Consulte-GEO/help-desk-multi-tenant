import test from 'node:test';
import assert from 'node:assert/strict';
import {requestHash} from '../src/domain/canonical.ts';

const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const AT='2026-10-12T12:00:00.000001Z';
async function api(){
 const path='../src/domain/execution-checklist.ts';
 const m=await import(path).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof m.assertExecutionChecklistComplete,'function','HDN01 execution checklist validator is missing');return m;
}
export function fixture(){
 const template:any={schema:1,id:'cadastro-usuario',version:1,status:'published',items:[
  {id:'grupo',label:'Conferir grupo e materiais',required:true,allowNotApplicable:false,evidenceRequired:true,risk:'ordinary'},
  {id:'email',label:'Conferir preferências de e-mail',required:true,allowNotApplicable:true,evidenceRequired:false,risk:'ordinary'},
  {id:'observacao',label:'Conferência adicional',required:false,allowNotApplicable:true,evidenceRequired:false,risk:'ordinary'}]};
 const reference={id:template.id,version:template.version,sha256:requestHash(template)};
 const expected:any={workspaceId:id(1),accountId:id(3),ticketId:id(6),ticketVersion:4,profileVersionId:'P1',reference};
 const snapshot:any={workspaceId:expected.workspaceId,accountId:expected.accountId,ticketId:expected.ticketId,ticketVersion:4,profileVersionId:'P1',reference:{...reference},revision:2,entries:[
  {itemId:'grupo',status:'done',actorId:id(2),at:AT,evidenceRefs:['audit:origem:001'],reason:null,riskAcknowledgement:null},
  {itemId:'email',status:'not_applicable',actorId:id(2),at:AT,evidenceRefs:[],reason:'Sem preferência solicitada nesta revisão.',riskAcknowledgement:null},
  {itemId:'observacao',status:'pending',actorId:null,at:null,evidenceRefs:[],reason:null,riskAcknowledgement:null}]};
 return {input:{template,snapshot},expected};
}
const unavailable={code:'workflow_checklist_unavailable',status:503};
const mismatch={code:'workflow_checklist_mismatch',status:409};
const required={code:'workflow_checklist_required',status:409};
const confirmation={code:'workflow_checklist_confirmation_required',status:409};
function replaceTemplate(f:ReturnType<typeof fixture>){const r={id:f.input.template.id,version:f.input.template.version,sha256:requestHash(f.input.template)};f.expected.reference=r;f.input.snapshot.reference={...r};}

test('HDN01 complete private checklist produces a frozen minimal audit summary',async()=>{
 const m=await api(),f=fixture(),before=structuredClone(f.input),r=m.assertExecutionChecklistComplete(f.input,f.expected,AT);
 assert.deepEqual(r,{templateId:'cadastro-usuario',templateVersion:1,templateSha256:f.expected.reference.sha256,snapshotRevision:2,snapshotSha256:requestHash(f.input.snapshot),doneCount:1,waivedCount:1,optionalPendingCount:1});
 assert.ok(Object.isFrozen(r));assert.deepEqual(f.input,before);
 assert.doesNotMatch(JSON.stringify(r),/audit:origem|Sem preferência|Conferir|actorId|evidenceRefs/);
});
test('HDN01 reference parser preserves identity and digest exactly',async()=>{
 const m=await api(),f=fixture();assert.deepEqual(m.parseExecutionChecklistReference(f.expected.reference),f.expected.reference);
 for(const x of [null,{}, {...f.expected.reference,approved:true},{...f.expected.reference,version:0},{...f.expected.reference,sha256:'G'.repeat(64)}])assert.throws(()=>m.parseExecutionChecklistReference(x),unavailable);
});
for(const [name,edit,error] of [
 ['null snapshot',(f:any)=>f.input.snapshot=null,required],
 ['draft template',(f:any)=>{f.input.template.status='draft';replaceTemplate(f);},required],
 ['template text changed with same digest',(f:any)=>f.input.template.items[0].label='Changed',mismatch],
 ['workspace changed',(f:any)=>f.input.snapshot.workspaceId=id(90),mismatch],
 ['account changed',(f:any)=>f.input.snapshot.accountId=id(90),mismatch],
 ['ticket changed',(f:any)=>f.input.snapshot.ticketId=id(90),mismatch],
 ['ticket version changed',(f:any)=>f.input.snapshot.ticketVersion=3,mismatch],
 ['profile changed',(f:any)=>f.input.snapshot.profileVersionId='P2',mismatch],
 ['template version changed',(f:any)=>f.input.snapshot.reference.version=2,mismatch],
 ['template hash changed',(f:any)=>f.input.snapshot.reference.sha256='1'.repeat(64),mismatch],
 ['missing mandatory answer',(f:any)=>f.input.snapshot.entries.shift(),required],
 ['mandatory pending',(f:any)=>{f.input.snapshot.entries[0]={itemId:'grupo',status:'pending',actorId:null,at:null,evidenceRefs:[],reason:null,riskAcknowledgement:null};},required],
 ['missing evidence',(f:any)=>f.input.snapshot.entries[0].evidenceRefs=[],required],
 ['waiver without allowed rule',(f:any)=>{f.input.snapshot.entries[0].status='not_applicable';f.input.snapshot.entries[0].reason='Pretendida';},required],
 ['waiver without reason',(f:any)=>f.input.snapshot.entries[1].reason=null,required],
 ['future completion microsecond',(f:any)=>f.input.snapshot.entries[0].at='2026-10-12T12:00:00.000002Z',mismatch],
 ['duplicate entry',(f:any)=>f.input.snapshot.entries.push({...f.input.snapshot.entries[0]}),unavailable],
 ['unknown entry',(f:any)=>f.input.snapshot.entries[0].itemId='surprise',unavailable],
 ['missing actor',(f:any)=>f.input.snapshot.entries[0].actorId=null,unavailable],
 ['truthy status instead of enum',(f:any)=>f.input.snapshot.entries[0].status=true,unavailable],
 ['invalid calendar instant',(f:any)=>f.input.snapshot.entries[0].at='2026-02-30T12:00:00.000Z',unavailable],
 ['pending hides completion data',(f:any)=>f.input.snapshot.entries[2].reason='Private ignored reason',unavailable],
 ['extra approval flag',(f:any)=>f.input.approved=true,unavailable],
 ['URL as evidence selector',(f:any)=>f.input.snapshot.entries[0].evidenceRefs=['https://foreign.invalid/token'],unavailable],
 ['duplicated evidence',(f:any)=>f.input.snapshot.entries[0].evidenceRefs.push('audit:origem:001'),unavailable],
 ['unsafe integer revision',(f:any)=>f.input.snapshot.revision=Number.MAX_SAFE_INTEGER+1,unavailable],
 ['getter input',(f:any)=>Object.defineProperty(f.input.snapshot,'ticketId',{enumerable:true,get:()=>{throw Error('secret-value');}}),unavailable],
 ['symbol field',(f:any)=>f.input.snapshot[Symbol('secret')]=true,unavailable],
 ['sparse entries',(f:any)=>delete f.input.snapshot.entries[1],unavailable],
 ['definition duplicate IDs',(f:any)=>{f.input.template.items.push({...f.input.template.items[0]});replaceTemplate(f);},unavailable],
 ['empty template',(f:any)=>{f.input.template.items=[];replaceTemplate(f);},unavailable],
 ['template has no mandatory item',(f:any)=>{for(const i of f.input.template.items)i.required=false;replaceTemplate(f);},unavailable],
 ['unbounded template',(f:any)=>{f.input.template.items=Array.from({length:101},(_,i)=>({...f.input.template.items[0],id:'item-'+i}));replaceTemplate(f);},unavailable],
] as [string,(f:ReturnType<typeof fixture>)=>void,{code:string;status:number}][]){
 test('HDN01 rejects '+name,async()=>{const m=await api(),f=fixture();edit(f);assert.throws(()=>m.assertExecutionChecklistComplete(f.input,f.expected,AT),error);});
}
test('HDN01 data getters are never executed',async()=>{const m=await api(),f=fixture();let reads=0;Object.defineProperty(f.input.snapshot.entries[0],'reason',{enumerable:true,get:()=>{reads++;return null;}});assert.throws(()=>m.assertExecutionChecklistComplete(f.input,f.expected,AT),unavailable);assert.equal(reads,0);});
test('HDN01 ordinary optional missing answer is explicit pending in the summary',async()=>{const m=await api(),f=fixture();f.input.snapshot.entries.pop();assert.equal(m.assertExecutionChecklistComplete(f.input,f.expected,AT).optionalPendingCount,1);});
test('HDN01 milliseconds and equivalent microseconds compare equally',async()=>{const m=await api(),f=fixture();for(const e of f.input.snapshot.entries)if(e.at)e.at='2026-10-12T12:00:00.000Z';assert.equal(m.assertExecutionChecklistComplete(f.input,f.expected,'2026-10-12T12:00:00.000000Z').doneCount,1);});
function sensitive(){const f=fixture();f.input.template.items[0].risk='sensitive';replaceTemplate(f);f.input.snapshot.entries[0].riskAcknowledgement={actorId:id(2),at:AT,statement:'Conferi o impacto e a evidência desta execução.'};return f;}
test('HDN01 sensitive completion requires explicit same-executor acknowledgement',async()=>{const m=await api(),f=sensitive();assert.equal(m.assertExecutionChecklistComplete(f.input,f.expected,AT).doneCount,1);});
for(const [name,edit,error] of [
 ['missing acknowledgement',(f:any)=>f.input.snapshot.entries[0].riskAcknowledgement=null,confirmation],
 ['different acknowledging actor',(f:any)=>f.input.snapshot.entries[0].riskAcknowledgement.actorId=id(10),confirmation],
 ['acknowledgement before execution',(f:any)=>f.input.snapshot.entries[0].riskAcknowledgement.at='2026-10-12T12:00:00.000000Z',confirmation],
 ['acknowledgement from future',(f:any)=>f.input.snapshot.entries[0].riskAcknowledgement.at='2026-10-12T12:00:00.000002Z',confirmation],
 ['empty confirmation statement',(f:any)=>f.input.snapshot.entries[0].riskAcknowledgement.statement='',unavailable],
 ['sensitive template allowing waiver',(f:any)=>{f.input.template.items[0].allowNotApplicable=true;replaceTemplate(f);},unavailable],
 ['sensitive template omitting evidence',(f:any)=>{f.input.template.items[0].evidenceRequired=false;replaceTemplate(f);},unavailable],
] as [string,(f:ReturnType<typeof fixture>)=>void,{code:string;status:number}][])test('HDN01 rejects sensitive '+name,async()=>{const m=await api(),f=sensitive();edit(f);assert.throws(()=>m.assertExecutionChecklistComplete(f.input,f.expected,AT),error);});
test('HDN01 hostile parsing errors never disclose private values or forge completion',async()=>{const m=await api(),f=fixture();f.input.snapshot=new Proxy({},{ownKeys(){throw Object.assign(Error('secret-value'),{code:'workflow_checklist_required'});}});assert.throws(()=>m.assertExecutionChecklistComplete(f.input,f.expected,AT),(e:any)=>e.code==='workflow_checklist_unavailable'&&!e.message.includes('secret'));});

test('HDN01 sensitive action cannot be hidden as an optional item',async()=>{const m=await api(),f=sensitive();f.input.template.items[0].required=false;replaceTemplate(f);assert.throws(()=>m.assertExecutionChecklistComplete(f.input,f.expected,AT),unavailable);});
