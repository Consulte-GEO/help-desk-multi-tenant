import test from 'node:test';import assert from 'node:assert/strict';
import {reviewFixture,sid} from './helpers/review-fixture.ts';
test('revision preserves a published fixed priority without requiring customer impact classification',async()=>{
 const f=await reviewFixture(),command=f.editing();
 Object.assign(f.current().aggregate.profile,{fixedPriority:'normal',impactField:'',priorityPolicy:null});
 const preview=await f.service.previewSupportRevision(f.p,command);
 await f.service.reviseSupportForm(f.p,{...command,previewHash:preview.previewHash},'fixed-priority-revision-01',sid(99));
 assert.equal(f.current().aggregate.ticket.priority,'normal');
});
test('invalid published fixed priority cannot silently fall back to customer-controlled impact',async()=>{
 const f=await reviewFixture(),command=f.editing();f.current().aggregate.profile.fixedPriority='invalid';
 await assert.rejects(f.service.previewSupportRevision(f.p,command));
 assert.equal(f.current().audits.length,0);assert.equal(f.current().revisions.length,0);
});
