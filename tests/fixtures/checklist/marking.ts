import {requestHash} from '../../../src/domain/canonical.ts';
import type {Principal} from '../../../src/domain/model.ts';
export const id=(n:number)=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export const AT='2026-10-12T12:00:00.000001Z';
export function markingFixture(){
 const principal:Principal={id:id(2),kind:'human',workspaceId:id(1),workspaceRole:null,grants:[{accountId:id(3),role:'agent'}],scopes:['tickets:read','tickets:write','notes:read','notes:write']};
 const template={schema:1 as const,id:'cadastro-usuario',version:1,status:'published' as const,items:[
  {id:'grupo',label:'Conferir grupo',required:true,allowNotApplicable:false,evidenceRequired:true,risk:'ordinary' as const},
  {id:'email',label:'Preferências',required:true,allowNotApplicable:true,evidenceRequired:false,risk:'ordinary' as const},
  {id:'risco',label:'Ação sensível',required:true,allowNotApplicable:false,evidenceRequired:true,risk:'sensitive' as const}]};
 const context={workspaceId:id(1),accountId:id(3),ticketId:id(6),ticketVersion:4,profileVersionId:'P1',reference:{id:template.id,version:1,sha256:requestHash(template)}};
 const record={context,template,snapshot:null as any,ticketStatus:'open',assignedTo:id(2),readAt:AT};
 const command={action:'mark' as const,itemId:'grupo',status:'done' as const,expectedTicketVersion:4,expectedChecklistRevision:0,evidenceRefs:['note:'+id(90)],reason:null as string|null,acknowledgeRisk:false};
 const evidence={reference:'note:'+id(90),workspaceId:id(1),accountId:id(3),ticketId:id(6),actorId:id(2),at:AT};
 return {principal,template,context,record,command,evidence};
}
