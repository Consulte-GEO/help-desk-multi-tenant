import test from 'node:test';import assert from 'node:assert/strict';
import {createNotificationIntent,NOTIFICATION_KINDS} from '../src/domain/notification-delivery.ts';
import {requestHash} from '../src/domain/canonical.ts';
import {sid,NOW,LATER} from './helpers/support-io-fixture.ts';
const base={ticketId:sid(20),workspaceId:sid(1),profileVersionId:'profile1',sequence:2,at:NOW,actorId:sid(2),actorKind:'human_agent',from:'open',to:'open'};
async function mapping(){const path='../src/application/notification-workflow-mapping.ts';const m=await import(path).catch(e=>{if(e.code==='ERR_MODULE_NOT_FOUND')return {};throw e;});assert.equal(typeof m.mapPublicWorkflowNotification,'function','wave2 public workflow mapping is missing');return m.mapPublicWorkflowNotification;}
const cases=[
 {name:'start from new',event:{type:'transition',from:'new',to:'open'},kind:'support.transition'},
 {name:'start from triage',event:{type:'transition',from:'triage',to:'open'},kind:'support.transition'},
 {name:'ordinary reply',event:{type:'reply',body:'Mensagem permanece no portal'},kind:'support.reply'},
 {name:'request information',event:{type:'devolutiva',to:'waiting_customer',body:'Complemento solicitado'},kind:'support.devolutiva'},
 {name:'internal handoff',event:{type:'handoff',to:'waiting_internal'},kind:'support.handoff'},
 {name:'third-party handoff',event:{type:'handoff',to:'waiting_third_party'},kind:'support.handoff'},
 {name:'close after resolution',event:{type:'closed',from:'resolved',to:'closed'},kind:'support.closed'},
 {name:'reopen',event:{type:'reopened',from:'resolved',to:'open'},kind:'support.reopened'},
 {name:'cancel',event:{type:'cancelled',to:'cancelled'},kind:'support.cancelled'},
 {name:'resolution',event:{type:'resolved',to:'resolved',body:'Solução no portal'},kind:'support.resolved'},
 {name:'customer reply',event:{type:'customer_reply',actorKind:'customer',from:'waiting_customer',to:'open',body:'Retorno'},kind:'support.customer_reply'},
 {name:'triage is not start',event:{type:'transition',from:'new',to:'triage'},kind:null},
 {name:'resume is not start',event:{type:'transition',from:'waiting_internal',to:'open'},kind:null},
 {name:'assignment is private',event:{type:'assigned'},kind:null},
 {name:'notes never notify',event:{type:'note.created',body:'Nota privada'},kind:null},
 {name:'automation cannot impersonate human start',event:{type:'transition',from:'new',to:'open',actorKind:'automation'},kind:null},
 {name:'integration cannot impersonate reply',event:{type:'reply',body:'Integração',actorKind:'integration'},kind:null},
 {name:'support reply is not customer return',event:{type:'customer_reply',actorKind:'human_agent'},kind:null},
 {name:'closed requires recorded close',event:{type:'closed',from:'open',to:'closed'},kind:null}
];
for(const c of cases)test('wave2 mapping: '+c.name,async()=>{const map=await mapping(),event={...base,...c.event};const before=structuredClone(event);assert.equal(map(event),c.kind);assert.deepEqual(event,before);});
for(const kind of ['support.transition','support.reply','support.handoff','support.closed','support.reopened','support.cancelled'])test('wave2 intent accepts qualified '+kind,()=>{
 assert.ok((NOTIFICATION_KINDS as readonly string[]).includes(kind));
 const i=createNotificationIntent({id:sid(80),workspaceId:sid(1),accountId:sid(3),ticketId:sid(20),eventId:sid(81),recipientId:sid(2),channelId:'resend',templateId:'wave2-notice',templateVersion:1,templateHash:requestHash({kind}),kind,sourceVersion:2,resourceHash:'b'.repeat(64),protocol:'CG-10002',invitationId:null,createdAt:NOW,expiresAt:LATER});
 assert.equal(i.kind,kind);assert.doesNotMatch(JSON.stringify(i),/body|notes|email|reason/);
});

