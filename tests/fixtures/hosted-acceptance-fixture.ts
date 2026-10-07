/** Synthetic identities and in-memory data. Never an authentication provider or hosted fixture. */
import {HelpdeskService} from '../../src/application/helpdesk.ts';
import {MemoryUnitOfWork} from '../../src/infrastructure/memory.ts';
import {createHttpHandler} from '../../src/http/handler.ts';
import {HelpdeskError} from '../../src/domain/errors.ts';
import type {Principal,Coverage} from '../../src/domain/model.ts';
export const uuid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const jwt=(name:string)=>`${Buffer.from('{"alg":"TEST"}').toString('base64url')}.${Buffer.from(JSON.stringify({role:'authenticated',fixture:name})).toString('base64url')}.synthetic`;
export async function hostedFixture(){
 const tokens={requesterA:jwt('requesterA'),requesterB:jwt('requesterB'),agentA:jwt('agentA'),machineA:'hd_session_'+'m'.repeat(43)};
 const config={schema:1,environment:'production',origin:'https://'+'a'.repeat(24)+'--helpdesk-consultegeo.netlify.app',
  supabaseUrl:'https://'+'a'.repeat(20)+'.supabase.co',deploymentCommit:'b'.repeat(40),workspaceId:uuid(1),deniedWorkspaceId:uuid(2),
  agentId:uuid(13),integrationId:uuid(14),
  accountA:{accountId:uuid(101),requesterId:uuid(11),productInstanceId:uuid(301),ticketId:uuid(501),serviceCode:'SUPPORT'},
  accountB:{accountId:uuid(102),requesterId:uuid(12),productInstanceId:uuid(302),ticketId:uuid(502),serviceCode:'SUPPORT'},
  machineTicketId:uuid(503),machinePublicMessageId:uuid(603),internalNoteId:uuid(601),internalNoteMarker:'HD_TEST_INTERNAL_9f56c18bd42840a2',publicMessageId:uuid(602)};
 const scopes=['contexts:resolve','tickets:read','tickets:write'];
 const requester=(id:string,accountId:string):Principal=>({id,kind:'human',workspaceId:config.workspaceId,workspaceRole:null,grants:[{accountId,role:'requester'}],scopes:[...scopes]});
 const people:Record<string,Principal>={
  [tokens.requesterA]:requester(config.accountA.requesterId,config.accountA.accountId),
  [tokens.requesterB]:requester(config.accountB.requesterId,config.accountB.accountId),
  [tokens.agentA]:{...requester(config.agentId,config.accountA.accountId),grants:[{accountId:config.accountA.accountId,role:'agent'}],scopes:[...scopes,'notes:read','notes:write']},
  [tokens.machineA]:{...requester(config.integrationId,config.accountA.accountId),kind:'integration',connectionId:uuid(901),productInstanceIds:[config.accountA.productInstanceId]}
 };
 const accounts=[config.accountA,config.accountB];
 const coverages:Coverage[]=accounts.map((a,i)=>({id:uuid(401+i),workspaceId:config.workspaceId,accountId:a.accountId,productInstanceId:a.productInstanceId,
  serviceCode:a.serviceCode,contractId:uuid(701+i),contractVersionId:uuid(801+i),contractVersion:1,contractStatus:'active',enabled:true,published:true,
  validFrom:'2020-01-01T00:00:00Z',validUntil:null,policy:{}}));
 const db=new MemoryUnitOfWork({coverages,supportContexts:accounts.map((a,i)=>({workspaceId:config.workspaceId,accountId:a.accountId,accountName:'Synthetic '+i,
  productInstanceId:a.productInstanceId,productName:'Product '+i,environment:'production' as const,serviceCode:a.serviceCode,serviceName:'Support'}))});
 const service=new HelpdeskService(db);
 for(const [i,a] of accounts.entries()){
  const p=people[i===0?tokens.requesterA:tokens.requesterB]!;
  a.ticketId=(await service.create(p,{accountId:a.accountId,productInstanceId:a.productInstanceId,serviceCode:a.serviceCode,subject:'Synthetic acceptance '+i,description:'Fixture only',priority:'normal'},'hosted-fixture-create-'+i,'test')).ticket.id;
 }
 config.machineTicketId=(await service.create(people[tokens.machineA]!,{accountId:config.accountA.accountId,productInstanceId:config.accountA.productInstanceId,serviceCode:'SUPPORT',subject:'Synthetic integration ticket',description:'Fixture only',priority:'normal'},'hosted-machine-create','test')).ticket.id;
 config.machinePublicMessageId=(await service.addMessage(people[tokens.agentA]!,config.machineTicketId,'Synthetic integration message','hosted-machine-message','test')).message.id;
 config.publicMessageId=(await service.addMessage(people[tokens.agentA]!,config.accountA.ticketId,'Public synthetic message','hosted-fixture-message','test')).message.id;
 config.internalNoteId=(await service.addNote(people[tokens.agentA]!,config.accountA.ticketId,config.internalNoteMarker,'hosted-fixture-note','test')).note.id;
 const handler=createHttpHandler({service,publicConfig:{supabaseUrl:config.supabaseUrl,publishableKey:'sb_publishable_synthetic'},revokeSession:async()=>{},authenticate:async req=>{
  const token=req.headers.get('authorization')?.replace(/^Bearer /,'')??'';
  const person=people[token];if(!person)throw new HelpdeskError(401,'unauthorized','Synthetic identity rejected.');
  if(req.headers.get('x-workspace-id')!==person.workspaceId)throw new HelpdeskError(403,'membership_required','Synthetic workspace rejected.');
  return structuredClone(person);
 }});
 const requests:Request[]=[];
 const fetcher:typeof fetch=async(input,init)=>{const request=new Request(input,init);requests.push(request);return handler(request);};
 return {config,tokens,requests,fetcher,handler,people,db};
}
