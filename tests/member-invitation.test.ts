import test from 'node:test';
import assert from 'node:assert/strict';
import {memberFixture,id,NOW,LATER} from './helpers/member-admin-fixture.ts';
async function factory(){
 const modulePath='../src/application/member-invitation.ts';
 const m=await import(modulePath).catch((e:unknown)=>{if((e as {code?:string}).code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof m.createMemberInvitationAcceptance,'function','Explicit invitation acceptance must exist');return m.createMemberInvitationAcceptance;
}
function fixture(){const f=memberFixture();f.state().members.push({principalId:id(5),principalKind:'human',role:'agent',status:'invited',revision:1,expiresAt:LATER});return f;}
const request={expectedRevision:1,expectedMemberRevision:1};const key='invitation-accept-0001';
function person(f:ReturnType<typeof fixture>){return {...f.principal,id:id(5),workspaceRole:null};}
test('C04 acceptance activates only the authenticated invitee and preserves role, expiry and business scopes',async()=>{
 const f=fixture(),p=person(f),scopes=[...p.scopes],run=(await factory())({store:f.store,clock:f.clock});
 const r=await run.accept(p,request,key);assert.equal(r.member.principalId,p.id);assert.equal(r.member.status,'active');assert.equal(r.member.role,'agent');assert.equal(r.member.expiresAt,LATER);assert.deepEqual(p.scopes,scopes);assert.equal(f.audit().length,1);assert.equal(f.audit()[0].action,'accept_invitation');assert.equal(r.notification,'not_requested');
});
test('C04 another person cannot accept an invitation by injecting its principal id',async()=>{
 const f=fixture(),run=(await factory())({store:f.store,clock:f.clock});await assert.rejects(run.accept(f.principal,{...request,targetPrincipalId:id(5)},key),{code:'invalid_invitation_acceptance'});assert.equal(f.counters.writes,0);
});
test('C04 no invitation is not auto-registration',async()=>{
 const f=fixture(),run=(await factory())({store:f.store,clock:f.clock});await assert.rejects(run.accept({...person(f),id:id(7)},request,key),{code:'invitation_unavailable'});assert.equal(f.counters.writes,0);
});
test('C04 expired invitation is refused without a write',async()=>{
 const f=fixture();f.setTime(LATER);const run=(await factory())({store:f.store,clock:f.clock});await assert.rejects(run.accept(person(f),request,key),{code:'invitation_unavailable'});assert.equal(f.counters.writes,0);
});
test('C04 expiration before COMMIT rolls back the model state',async()=>{
 const f=fixture();f.switches.beforeCommit=()=>f.setTime(LATER);const run=(await factory())({store:f.store,clock:f.clock});await assert.rejects(run.accept(person(f),request,key));assert.equal(f.state().members.at(-1).status,'invited');assert.equal(f.audit().length,0);
});
test('C04 replay returns the same historical audit receipt without another activation',async()=>{
 const f=fixture(),run=(await factory())({store:f.store,clock:f.clock}),p=person(f);
 const a=await run.accept(p,request,key),b=await run.accept(p,request,key);assert.equal(b.auditId,a.auditId);assert.equal(b.replayed,true);assert.equal(f.audit().length,1);
});
test('C04 replay after revocation does not re-activate a member',async()=>{
 const f=fixture(),run=(await factory())({store:f.store,clock:f.clock}),p=person(f);await run.accept(p,request,key);f.state().members.at(-1).status='revoked';await assert.rejects(run.accept(p,request,key),{code:'invitation_unavailable'});assert.equal(f.state().members.at(-1).status,'revoked');
});
test('C04 concurrent acceptance with same revision produces one durable intent in the model',async()=>{
 const f=fixture(),run=(await factory())({store:f.store,clock:f.clock}),p=person(f);const results=await Promise.allSettled([run.accept(p,request,key),run.accept(p,request,key+'2')]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.audit().length,1);
});
for(const invalid of ['integration','other-workspace','invited-admin','revoked'])test('C04 invitation refuses '+invalid,async()=>{
 const f=fixture(),p=person(f);if(invalid==='integration')p.kind='integration';if(invalid==='other-workspace')p.workspaceId=id(99);if(invalid==='invited-admin')f.state().members.at(-1).role='admin';if(invalid==='revoked')f.state().members.at(-1).status='revoked';const run=(await factory())({store:f.store,clock:f.clock});await assert.rejects(run.accept(p,request,key));assert.equal(f.counters.writes,0);
});
test('C04 stale member or workspace revision is refused',async()=>{
 const f=fixture(),run=(await factory())({store:f.store,clock:f.clock});for(const r of [{...request,expectedRevision:2},{...request,expectedMemberRevision:2}])await assert.rejects(run.accept(person(f),r,key),{code:'member_version_conflict'});assert.equal(f.counters.writes,0);
});
test('C04 lost acceptance acknowledgement never creates a second intent on reconciliation',async()=>{
 const f=fixture(),run=(await factory())({store:f.store,clock:f.clock}),p=person(f);f.switches.loseCommit=true;await assert.rejects(run.accept(p,request,key),{code:'member_admin_outcome_unknown'});const r=await run.accept(p,request,key);assert.equal(r.replayed,true);assert.equal(f.audit().length,1);
});
