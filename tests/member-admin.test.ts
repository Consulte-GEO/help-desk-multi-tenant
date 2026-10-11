import type {createMemberAdministration} from '../src/application/member-admin.ts';
import test from 'node:test';import assert from 'node:assert/strict';
import {memberFixture,id,NOW,LATER} from './helpers/member-admin-fixture.ts';
async function service(f:ReturnType<typeof memberFixture>):Promise<ReturnType<typeof createMemberAdministration>>{
 const name='../src/application/member-admin.ts';const mod=await import(name).catch((e:unknown)=>{if((e as any).code==='ERR_MODULE_NOT_FOUND')return {};throw e;});
 assert.equal(typeof mod.createMemberAdministration,'function','C04 member administration is missing');
 return mod.createMemberAdministration({store:f.store,clock:f.clock}) as any;
}
const key='member-intent-0000001';
const cmd=(action='revoke',target=id(4),extra:any={})=>({action,targetPrincipalId:target,expectedRevision:1,expectedMemberRevision:1,reason:'Explicit test reason',...extra});
async function run(f:ReturnType<typeof memberFixture>,input:any,k=key){const s=await service(f);return f.withProof((p,proof)=>s.execute(p,proof,input,k));}

test('C04 administrative action uses real assurance, a distinct capability and an atomic audit/receipt',async()=>{
 const f=memberFixture();const r=await run(f,cmd());assert.equal(r.member.status,'revoked');assert.equal(r.revision,2);assert.equal(r.replayed,false);assert.equal(f.audit().length,1);assert.equal(f.receipts().size,1);assert.equal(f.counters.writes,1);assert.deepEqual(f.principal.scopes,['contexts:resolve','tickets:read']);assert.equal(f.state().capabilityGrants.length,6);
});
test('C04 forged assurance cannot read the store',async()=>{const f=memberFixture(),s=await service(f);await assert.rejects(s.execute(f.principal,{} as never,cmd(),key),{status:403});assert.equal(f.counters.transactions,0);});
test('C04 AAL1 never reaches administrative persistence',async()=>{const f=memberFixture(),s=await service(f);await assert.rejects(f.auth.withAdministrativeAssurance(f.request('aal1'),(p,proof)=>s.execute(p,proof,cmd(),key)),{status:403});assert.equal(f.counters.transactions,0);});
for(const cap of [[],['tickets:write']])test('C04 administrator role or business scopes do not supply a missing capability '+JSON.stringify(cap),async()=>{const f=memberFixture();f.state().capabilityGrants=f.state().capabilityGrants.filter((g:any)=>g.principalId!==id(2));f.principal.scopes.push(...cap);await assert.rejects(run(f,cmd()),{status:403});assert.equal(f.counters.writes,0);});
for(const edit of ['expired','inactive','other-person','other-workspace'])test('C04 ignores no invalid grant: '+edit,async()=>{const f=memberFixture();const g=f.state().capabilityGrants.find((g:any)=>g.capability==='members.revoke');if(edit==='expired')g.expiresAt=NOW;else if(edit==='inactive')g.active=false;else if(edit==='other-person')g.principalId=id(8);else g.workspaceId=id(8);await assert.rejects(run(f,cmd()),(e:any)=>[403,503].includes(e.status));assert.equal(f.counters.writes,0);});
test('C04 same actor in neighboring workspace cannot use the capability snapshot',async()=>{const f=memberFixture();f.state().workspaceId=id(8);await assert.rejects(run(f,cmd()),(e:any)=>[403,503].includes(e.status));assert.equal(f.counters.writes,0);});
test('C04 self-promotion is denied even to an administrator with members.write',async()=>{const f=memberFixture();await assert.rejects(run(f,cmd('set_role',id(2),{role:'admin'})),{status:403});assert.equal(f.counters.writes,0);});
test('C04 command cannot insert business scopes, approvals or source grant fields',async()=>{for(const field of ['scopes','capabilityGrants','approvedBy','accountId','workspaceId']){const f=memberFixture();await assert.rejects(run(f,cmd('revoke',id(4),{[field]:'fake'})),{status:400});assert.equal(f.counters.writes,0);}});
test('C04 deleting the last effective manager is denied',async()=>{const f=memberFixture();f.state().capabilityGrants=f.state().capabilityGrants.filter((g:any)=>!(g.principalId===id(2)&&g.capability==='members.write'));await assert.rejects(run(f,cmd('revoke',id(3))),{code:'last_administrator_required'});assert.equal(f.counters.writes,0);});
test('C04 expired admin or role without management capability cannot be used as successor',async()=>{for(const mode of ['expired','no-capability','invited']){const f=memberFixture();if(mode==='expired')f.state().members[1].expiresAt=NOW;else if(mode==='invited')f.state().members[1].status='invited';else f.state().capabilityGrants=f.state().capabilityGrants.filter((g:any)=>g.principalId!==id(3));await assert.rejects(run(f,cmd('handoff',id(2),{successorPrincipalId:id(3)})),{code:'successor_not_ready'});assert.equal(f.counters.writes,0);}});
test('C04 explicit succession changes only the outgoing role and records the successor',async()=>{const f=memberFixture();const r=await run(f,cmd('handoff',id(2),{successorPrincipalId:id(3)}));assert.equal(r.member.role,'agent');assert.equal(f.state().members[1].role,'admin');assert.equal(f.audit()[0].successorPrincipalId,id(3));assert.equal(f.state().capabilityGrants.length,6);});
test('C04 invitation resolves an existing human, stays pending and sends nothing',async()=>{const f=memberFixture();const r=await run(f,{action:'invite',targetPrincipalId:id(9),expectedRevision:1,reason:'Invite known person',expiresAt:LATER});assert.equal(r.member.status,'invited');assert.equal(r.member.role,'agent');assert.equal(r.member.principalId,id(9));assert.equal(r.notification,'not_requested');assert.equal(f.audit().length,1);});
test('C04 missing person cannot be created from an invitation',async()=>{const f=memberFixture();await assert.rejects(run(f,{action:'invite',targetPrincipalId:id(90),expectedRevision:1,reason:'Invite missing person',expiresAt:LATER}),{status:404});assert.equal(f.state().members.length,3);});
test('C04 invitation never accepts email or administrator role as identity',async()=>{for(const change of [{targetPrincipalId:'someone@example.test'},{role:'admin'},{expiresAt:NOW}]){const f=memberFixture();await assert.rejects(run(f,{action:'invite',targetPrincipalId:id(9),expectedRevision:1,reason:'Known person',expiresAt:LATER,...change}),(e:any)=>[400,409].includes(e.status));assert.equal(f.counters.writes,0);}});
test('C04 revision conflicts preserve the member, audit and receipt',async()=>{const f=memberFixture();await assert.rejects(run(f,cmd('revoke',id(4),{expectedRevision:99})),{status:412});assert.equal(f.state().revision,1);assert.equal(f.audit().length,0);assert.equal(f.receipts().size,0);});
test('C04 member revision is checked independently of workspace revision',async()=>{const f=memberFixture();await assert.rejects(run(f,cmd('revoke',id(4),{expectedMemberRevision:9})),{status:412});assert.equal(f.counters.writes,0);});
test('C04 duplicate intent returns the immutable original receipt',async()=>{const f=memberFixture();const a=await run(f,cmd());const b=await run(f,cmd());assert.equal(b.replayed,true);assert.deepEqual({...a,replayed:true},b);assert.equal(f.counters.writes,1);assert.equal(f.audit().length,1);});
test('C04 reused key with another command is a conflict, never another action',async()=>{const f=memberFixture();await run(f,cmd());await assert.rejects(run(f,cmd('revoke',id(3))),{status:409});assert.equal(f.counters.writes,1);});
test('C04 current rights are checked before returning an old receipt',async()=>{const f=memberFixture();await run(f,cmd());f.state().capabilityGrants=f.state().capabilityGrants.filter((g:any)=>g.capability!=='members.revoke');await assert.rejects(run(f,cmd()),{status:403});assert.equal(f.counters.writes,1);});
test('C04 two concurrent changes on the same revision have one winner',async()=>{const f=memberFixture();const s=await service(f);const [a,b]=await Promise.allSettled([f.withProof((p,proof)=>s.execute(p,proof,cmd(),key)),f.withProof((p,proof)=>s.execute(p,proof,cmd('set_role',id(3),{role:'agent'}),'other-intent-00001'))]);assert.equal([a,b].filter(x=>x.status==='fulfilled').length,1);assert.equal(f.state().revision,2);assert.equal(f.audit().length,1);});
test('C04 expired capability while waiting prevents commit',async()=>{const f=memberFixture();f.state().capabilityGrants.find((g:any)=>g.capability==='members.revoke').expiresAt=LATER;f.switches.beforeCommit=()=>f.setTime(LATER);await assert.rejects(run(f,cmd()),(e:any)=>[403,503].includes(e.status));assert.equal(f.state().members[2].status,'active');assert.equal(f.audit().length,0);});
test('C04 loss of COMMIT response is unknown, and repeating the key reconciles without another write',async()=>{const f=memberFixture();f.switches.loseCommit=true;await assert.rejects(run(f,cmd()),{code:'member_admin_outcome_unknown'});const r=await run(f,cmd());assert.equal(r.replayed,true);assert.equal(f.counters.writes,1);});
test('C04 store transport messages are not returned',async()=>{const f=memberFixture();f.switches.failBeforeWrite=true;await assert.rejects(run(f,cmd()),(e:any)=>e.status===503&&!e.message.includes('private'));assert.equal(f.audit().length,0);});
test('C04 list has revision-bound keyset pagination and never returns capability approvals',async()=>{const f=memberFixture(),s=await service(f);const a=await f.withProof((p,proof)=>s.list(p,proof,{limit:2}));assert.equal(a.total,3);assert.equal(a.items.length,2);assert.ok(a.nextCursor);assert.doesNotMatch(JSON.stringify(a),/capabilityGrants|policyRef|approvedBy/);const b=await f.withProof((p,proof)=>s.list(p,proof,{limit:2,cursor:a.nextCursor}));assert.equal(b.items.length,1);assert.equal(b.nextCursor,null);});
test('C04 stale cursor is refused after a workspace change',async()=>{const f=memberFixture(),s=await service(f);const a=await f.withProof((p,proof)=>s.list(p,proof,{limit:1}));await run(f,cmd());await assert.rejects(f.withProof((p,proof)=>s.list(p,proof,{limit:1,cursor:a.nextCursor})),{status:409});});
test('C04 expiry is explicit and does not revoke a membership that is still current',async()=>{const f=memberFixture();await assert.rejects(run(f,cmd('expire')),{status:409});f.state().members[2].expiresAt=NOW;const r=await run(f,cmd('expire'));assert.equal(r.member.status,'revoked');assert.equal(f.audit()[0].action,'expire');});
test('C04 tampering with the authenticated object while the store reads invalidates assurance',async()=>{const f=memberFixture();f.switches.readHook=()=>{f.principal.scopes.push('tickets:write');};/* private Auth factory detaches its principal, so mutate the actual callback object below */const s=await service(f);await assert.rejects(f.withProof((p,proof)=>{f.switches.readHook=()=>p.scopes.push('tickets:write');return s.execute(p,proof,cmd(),key);}),{status:403});assert.equal(f.counters.writes,0);});

test('C04 review sanitizes application-shaped store errors instead of relaying their message',async()=>{
 const f=memberFixture(),name='../src/domain/errors.ts',mod=await import(name);
 const wrapped={...f.store,transaction:async()=>{throw new mod.HelpdeskError(403,'administrative_capability_required','private-provider-credential');}};
 const {createMemberAdministration}=await import('../src/application/member-admin.ts');const s=createMemberAdministration({store:wrapped,clock:f.clock});
 for(const operation of ['list','execute'])await assert.rejects(f.withProof<unknown>((p,proof)=>operation==='list'?s.list(p,proof,{limit:10}):s.execute(p,proof,cmd(),key)),(e:any)=>e.status===403&&!e.message.includes('private-provider'));
});
test('C04 review untrusted receipt descriptor cannot impersonate a locally detected key conflict',async()=>{
 const f=memberFixture();const {HelpdeskError}=await import('../src/domain/errors.ts');
 const poison=new Proxy({},{getPrototypeOf(){throw new HelpdeskError(409,'member_idempotency_conflict','private-descriptor');}});
 const wrapped={...f.store,transaction:(p:any,admit:any,work:any)=>f.store.transaction(p,admit,(tx:any)=>work({...tx,getReceipt:async()=>poison}))};
 const {createMemberAdministration}=await import('../src/application/member-admin.ts');const s=createMemberAdministration({store:wrapped,clock:f.clock});
 await assert.rejects(f.withProof((p,proof)=>s.execute(p,proof,cmd(),key)),(e:any)=>e.status===503&&!e.message.includes('private-descriptor'));
 assert.equal(f.counters.writes,0);
});

test('C04 list provides only current administrative action hints, never business scopes',async()=>{const f=memberFixture(),s=await service(f);f.state().capabilityGrants=f.state().capabilityGrants.filter((g:any)=>g.principalId!==id(2)||g.capability==='members.read'||g.capability==='members.revoke');const result=await f.withProof((p,proof)=>s.list(p,proof,{limit:10}));assert.deepEqual(result.availableActions,['revoke']);assert.deepEqual(f.principal.scopes,['contexts:resolve','tickets:read']);});

test('C04 review successor capability must remain effective at commit, not only at preview',async()=>{
 const f=memberFixture();const expiry='2026-10-09T12:01:00.123000Z';
 f.state().capabilityGrants=f.state().capabilityGrants.filter((g:any)=>!(g.principalId===id(2)&&g.capability==='members.write'));
 f.state().members[2].role='admin';f.state().capabilityGrants.push({...f.state().capabilityGrants.find((g:any)=>g.principalId===id(3)),id:id(68),principalId:id(4),expiresAt:expiry});
 f.switches.beforeCommit=()=>f.setTime(expiry);
 await assert.rejects(run(f,cmd('revoke',id(3))),(e:any)=>[409,503].includes(e.status));
 assert.equal(f.state().members[1].status,'active');assert.equal(f.audit().length,0);
});
test('C04 review an invitation that expires while the transaction waits cannot be committed',async()=>{
 const f=memberFixture(),expiry='2026-10-09T12:01:00.123000Z';f.switches.beforeCommit=()=>f.setTime(expiry);
 await assert.rejects(run(f,{action:'invite',targetPrincipalId:id(9),expectedRevision:1,reason:'Invite known person',expiresAt:expiry}),(e:any)=>[400,409,503].includes(e.status));
 assert.equal(f.state().members.length,3);assert.equal(f.audit().length,0);
});

for(const kind of ['workspace','member'])test('C04 revision overflow cannot produce an unrepresentable receipt: '+kind,async()=>{
 const f=memberFixture();if(kind==='workspace')f.state().revision=Number.MAX_SAFE_INTEGER;else f.state().members[2].revision=Number.MAX_SAFE_INTEGER;
 await assert.rejects(run(f,cmd('revoke',id(4),kind==='workspace'?{expectedRevision:Number.MAX_SAFE_INTEGER}:{expectedMemberRevision:Number.MAX_SAFE_INTEGER})),(e:any)=>e.status===503);
 assert.equal(f.counters.writes,0);assert.equal(f.audit().length,0);
});

test('C04 replay rejects a valid-looking receipt for a different member',async()=>{const f=memberFixture();await run(f,cmd());const entry=[...f.receipts().values()][0];entry.result.member.principalId=id(9);await assert.rejects(run(f,cmd()),(e:any)=>e.status===503);assert.equal(f.counters.writes,1);});
